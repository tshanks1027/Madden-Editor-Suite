"""
NFL Player Data Scraper
This script fills in missing data for NFL players from Pro Football Reference and Wikipedia.
Designed to run in Claude Code with proper rate limiting and error handling.
"""

import pandas as pd
import cloudscraper
from bs4 import BeautifulSoup
import time
import re
from datetime import datetime
import os

# Create cloudscraper session to bypass Cloudflare
scraper = cloudscraper.create_scraper(
    browser={
        'browser': 'chrome',
        'platform': 'windows',
        'mobile': False
    }
)

# Configuration
INPUT_FILE = 'data/lookups/MASTER_LOOKUP_FINAL.csv'
OUTPUT_FILE = 'data/lookups/MASTER_LOOKUP_UPDATED.csv'
PROGRESS_FILE = 'scraper_progress.txt'
ERROR_LOG = 'scraper_errors.log'
DELAY_BETWEEN_REQUESTS = 1.5  # seconds - important to avoid rate limiting
SAVE_EVERY_N_PLAYERS = 50  # Save progress frequently

# US State abbreviations for parsing
STATE_ABBREVS = {
    'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR', 'California': 'CA',
    'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE', 'Florida': 'FL', 'Georgia': 'GA',
    'Hawaii': 'HI', 'Idaho': 'ID', 'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA',
    'Kansas': 'KS', 'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
    'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS', 'Missouri': 'MO',
    'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV', 'New Hampshire': 'NH', 'New Jersey': 'NJ',
    'New Mexico': 'NM', 'New York': 'NY', 'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH',
    'Oklahoma': 'OK', 'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
    'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT', 'Vermont': 'VT',
    'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV', 'Wisconsin': 'WI', 'Wyoming': 'WY'
}

def log_error(message):
    """Log errors to file with timestamp"""
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    with open(ERROR_LOG, 'a') as f:
        f.write(f"[{timestamp}] {message}\n")
    print(f"ERROR: {message}")

def save_progress(index):
    """Save current progress index"""
    with open(PROGRESS_FILE, 'w') as f:
        f.write(str(index))

def load_progress():
    """Load progress from last run"""
    if os.path.exists(PROGRESS_FILE):
        with open(PROGRESS_FILE, 'r') as f:
            return int(f.read().strip())
    return 0

def convert_height_to_inches(height_str):
    """Convert height like '6-2' or '6\'2\"' to inches (74)"""
    if pd.isna(height_str) or height_str == '':
        return None

    # Try different formats
    patterns = [
        r"(\d+)['\-](\d+)",  # 6-2 or 6'2
        r"(\d+)\.(\d+)",      # 6.2
    ]

    for pattern in patterns:
        match = re.search(pattern, str(height_str))
        if match:
            feet = int(match.group(1))
            inches = int(match.group(2))
            return feet * 12 + inches

    return None

def extract_state_from_text(text):
    """Extract US state abbreviation from text"""
    if not text:
        return None

    text = str(text)

    # Check for state abbreviations (2 letters)
    state_abbrev_pattern = r'\b([A-Z]{2})\b'
    matches = re.findall(state_abbrev_pattern, text)
    for match in matches:
        if match in STATE_ABBREVS.values():
            return match

    # Check for full state names
    for full_name, abbrev in STATE_ABBREVS.items():
        if full_name.lower() in text.lower():
            return abbrev

    return None

def search_pro_football_reference(first_name, last_name):
    """Search Pro Football Reference for a player"""
    try:
        # PFR search URL
        search_url = f"https://www.pro-football-reference.com/search/search.fcgi?search={first_name}+{last_name}"

        response = scraper.get(search_url, timeout=10)

        if response.status_code != 200:
            return None

        soup = BeautifulSoup(response.content, 'html.parser')

        # Check if we got redirected directly to a player page
        if '/players/' in response.url:
            return response.url

        # Otherwise, look for the first player result
        search_results = soup.find('div', {'id': 'players'})
        if search_results:
            first_link = search_results.find('div', {'class': 'search-item-name'})
            if first_link:
                link = first_link.find('a')
                if link and 'href' in link.attrs:
                    return 'https://www.pro-football-reference.com' + link['href']

        return None

    except Exception as e:
        log_error(f"Error searching PFR for {first_name} {last_name}: {str(e)}")
        return None

def scrape_pfr_player_page(url):
    """Scrape data from a Pro Football Reference player page"""
    try:
        response = scraper.get(url, timeout=10)

        if response.status_code != 200:
            return None

        soup = BeautifulSoup(response.content, 'html.parser')

        data = {
            'height': None,
            'weight': None,
            'home_state': None,
            'to_year': None,
            'pro_bowls': 0,
            'all_pro': 0,
            'pfr_url': url
        }

        # Get player info meta section
        meta_div = soup.find('div', {'id': 'meta'})

        if meta_div:
            # Extract height and weight
            paragraphs = meta_div.find_all('p')
            for p in paragraphs:
                text = p.get_text()

                # Height (e.g., "6-2, 223lb")
                height_match = re.search(r'(\d+)-(\d+)', text)
                if height_match and not data['height']:
                    feet = int(height_match.group(1))
                    inches = int(height_match.group(2))
                    data['height'] = feet * 12 + inches

                # Weight
                weight_match = re.search(r'(\d+)lb', text)
                if weight_match and not data['weight']:
                    data['weight'] = int(weight_match.group(1))

                # Birthplace (hometown/state)
                if 'Born:' in text or 'born' in text.lower():
                    state = extract_state_from_text(text)
                    if state:
                        data['home_state'] = state

        # Get career span (To year)
        # Look for the last year in the stats table
        stats_table = soup.find('table', {'id': 'stats'})
        if stats_table:
            rows = stats_table.find_all('tr')
            years = []
            for row in rows:
                year_cell = row.find('th', {'data-stat': 'year_id'})
                if year_cell:
                    year_text = year_cell.get_text().strip()
                    try:
                        year = int(year_text)
                        years.append(year)
                    except:
                        pass
            if years:
                data['to_year'] = max(years)

        # Count Pro Bowls and All-Pro selections
        highlight_div = soup.find('div', {'id': 'bling'})
        if highlight_div:
            text = highlight_div.get_text()

            # Pro Bowl count
            pro_bowl_match = re.search(r'(\d+)x Pro Bowl', text)
            if pro_bowl_match:
                data['pro_bowls'] = int(pro_bowl_match.group(1))
            elif 'Pro Bowl' in text:
                data['pro_bowls'] = 1

            # All-Pro count (First-team)
            all_pro_match = re.search(r'(\d+)x All-Pro', text)
            if all_pro_match:
                data['all_pro'] = int(all_pro_match.group(1))
            elif 'All-Pro' in text:
                data['all_pro'] = 1

        return data

    except Exception as e:
        log_error(f"Error scraping PFR page {url}: {str(e)}")
        return None

def search_wikipedia(first_name, last_name, position=None):
    """Search Wikipedia for player page"""
    try:
        # Try direct Wikipedia search - add "American football" to avoid footballer confusion
        search_term = f"{first_name} {last_name} American football"

        wiki_search_url = f"https://en.wikipedia.org/w/api.php?action=opensearch&search={search_term}&limit=1&format=json"

        response = scraper.get(wiki_search_url, timeout=10)

        if response.status_code == 200:
            data = response.json()
            if len(data) > 3 and len(data[3]) > 0:
                wiki_url = data[3][0]
                # Verify it's about American football
                if 'american_football' in wiki_url.lower() or ('football' in wiki_url.lower() and 'soccer' not in wiki_url.lower()):
                    return wiki_url

        return None

    except Exception as e:
        log_error(f"Error searching Wikipedia for {first_name} {last_name}: {str(e)}")
        return None

def scrape_wikipedia_player_page(url):
    """Scrape data from Wikipedia player page"""
    try:
        response = scraper.get(url, timeout=10)

        if response.status_code != 200:
            return None

        soup = BeautifulSoup(response.content, 'html.parser')

        data = {
            'height': None,
            'weight': None,
            'home_state': None,
            'wiki_url': url
        }

        # Find infobox (Wikipedia player info table)
        infobox = soup.find('table', {'class': 'infobox'})

        if infobox:
            rows = infobox.find_all('tr')

            for row in rows:
                header = row.find('th')
                value = row.find('td')

                if not header or not value:
                    continue

                header_text = header.get_text().strip().lower()
                value_text = value.get_text().strip()

                # Height (e.g., "6 ft 2 in")
                if 'height' in header_text and not data['height']:
                    height_match = re.search(r'(\d+)\s*ft\s*(\d+)\s*in', value_text)
                    if height_match:
                        feet = int(height_match.group(1))
                        inches = int(height_match.group(2))
                        data['height'] = feet * 12 + inches

                # Weight (e.g., "223 lb")
                if 'weight' in header_text and not data['weight']:
                    weight_match = re.search(r'(\d+)\s*lb', value_text)
                    if weight_match:
                        data['weight'] = int(weight_match.group(1))

                # Born location for home state
                if 'born' in header_text and not data['home_state']:
                    state = extract_state_from_text(value_text)
                    if state:
                        data['home_state'] = state

        return data

    except Exception as e:
        log_error(f"Error scraping Wikipedia page {url}: {str(e)}")
        return None

def process_player(row):
    """Process a single player and return updated data"""
    first_name = str(row['First Name']).strip()
    last_name = str(row['Last Name']).strip()

    print(f"\nProcessing: {first_name} {last_name} (Pick {row['Pick']}, {row['Draft Class']})")

    # Check what data is missing
    needs_height = pd.isna(row['Height']) or row['Height'] == ''
    needs_weight = pd.isna(row['Weight']) or row['Weight'] == ''
    needs_state = pd.isna(row['Home State']) or row['Home State'] == ''
    needs_to_year = pd.isna(row['To']) or row['To'] == ''
    needs_pb = pd.isna(row['PB']) or row['PB'] == ''
    needs_ap = pd.isna(row['AP1']) or row['AP1'] == ''
    needs_pfr_url = pd.isna(row['PFR_Image_URL']) or row['PFR_Image_URL'] == ''
    needs_wiki_url = pd.isna(row['Wiki_Image_URL']) or row['Wiki_Image_URL'] == ''

    # If everything is complete, skip
    if not any([needs_height, needs_weight, needs_state, needs_to_year,
                needs_pb, needs_ap, needs_pfr_url, needs_wiki_url]):
        print("  [OK] All data complete, skipping")
        return row

    updated_row = row.copy()

    # Search Pro Football Reference
    pfr_url = search_pro_football_reference(first_name, last_name)
    time.sleep(DELAY_BETWEEN_REQUESTS)

    if pfr_url:
        print(f"  Found PFR page: {pfr_url}")
        pfr_data = scrape_pfr_player_page(pfr_url)
        time.sleep(DELAY_BETWEEN_REQUESTS)

        if pfr_data:
            if needs_height and pfr_data['height']:
                updated_row['Height'] = pfr_data['height']
                print(f"  [OK] Height: {pfr_data['height']} inches")

            if needs_weight and pfr_data['weight']:
                updated_row['Weight'] = pfr_data['weight']
                print(f"  [OK] Weight: {pfr_data['weight']} lbs")

            if needs_state and pfr_data['home_state']:
                updated_row['Home State'] = pfr_data['home_state']
                print(f"  [OK] State: {pfr_data['home_state']}")

            if needs_to_year and pfr_data['to_year']:
                updated_row['To'] = pfr_data['to_year']
                print(f"  [OK] Career end: {pfr_data['to_year']}")

            if needs_pb and pfr_data['pro_bowls'] > 0:
                updated_row['PB'] = pfr_data['pro_bowls']
                print(f"  [OK] Pro Bowls: {pfr_data['pro_bowls']}")

            if needs_ap and pfr_data['all_pro'] > 0:
                updated_row['AP1'] = pfr_data['all_pro']
                print(f"  [OK] All-Pro: {pfr_data['all_pro']}")

            if needs_pfr_url:
                updated_row['PFR_Image_URL'] = pfr_url
                print(f"  [OK] PFR URL added")
    else:
        print("  [X] No PFR page found")

        # Try Wikipedia as fallback when PFR not found
        if any([needs_height, needs_weight, needs_state]):
            wiki_url = search_wikipedia(first_name, last_name, row.get('Position'))
            time.sleep(DELAY_BETWEEN_REQUESTS)

            if wiki_url:
                print(f"  [FALLBACK] Trying Wikipedia: {wiki_url}")
                wiki_data = scrape_wikipedia_player_page(wiki_url)
                time.sleep(DELAY_BETWEEN_REQUESTS)

                if wiki_data:
                    if needs_height and wiki_data['height']:
                        updated_row['Height'] = wiki_data['height']
                        print(f"  [OK] Height (Wiki): {wiki_data['height']} inches")

                    if needs_weight and wiki_data['weight']:
                        updated_row['Weight'] = wiki_data['weight']
                        print(f"  [OK] Weight (Wiki): {wiki_data['weight']} lbs")

                    if needs_state and wiki_data['home_state']:
                        updated_row['Home State'] = wiki_data['home_state']
                        print(f"  [OK] State (Wiki): {wiki_data['home_state']}")

                    if needs_wiki_url:
                        updated_row['Wiki_Image_URL'] = wiki_url
                        print(f"  [OK] Wikipedia URL added")

    # Still need Wikipedia URL? (if we got PFR but not Wiki URL)
    if needs_wiki_url and (pd.isna(updated_row['Wiki_Image_URL']) or updated_row['Wiki_Image_URL'] == ''):
        wiki_url = search_wikipedia(first_name, last_name, row.get('Position'))
        time.sleep(DELAY_BETWEEN_REQUESTS)

        if wiki_url:
            updated_row['Wiki_Image_URL'] = wiki_url
            print(f"  [OK] Wikipedia URL: {wiki_url}")

    return updated_row

def main():
    """Main function to process all players"""
    print("=" * 80)
    print("NFL PLAYER DATA SCRAPER")
    print("=" * 80)

    # Load the CSV
    print(f"\nLoading CSV: {INPUT_FILE}")
    try:
        df = pd.read_csv(INPUT_FILE)
        print(f"[OK] Loaded {len(df)} players")
    except Exception as e:
        print(f"ERROR: Could not load CSV: {str(e)}")
        return

    # Load progress
    start_index = load_progress()
    if start_index > 0:
        print(f"\n[!] Resuming from player #{start_index}")

    # Filter to only players from 1970+ (PFR has limited data before then)
    # Sort by draft class (oldest first) to prioritize historical legends with missing data
    df_filtered = df[df['Draft Class'] >= 1970].copy()
    print(f"[OK] Filtered to {len(df_filtered)} players from 1970+ (PFR coverage era)")
    df_sorted = df_filtered.sort_values('Draft Class', ascending=True).reset_index(drop=True)

    print(f"\nStarting data collection...")
    print(f"Delay between requests: {DELAY_BETWEEN_REQUESTS}s")
    print(f"Saving progress every {SAVE_EVERY_N_PLAYERS} players")
    print("=" * 80)

    # Process each player
    players_processed = 0
    start_time = time.time()

    for idx in range(start_index, len(df_sorted)):
        try:
            df_sorted.iloc[idx] = process_player(df_sorted.iloc[idx])
            players_processed += 1

            # Save progress periodically
            if players_processed % SAVE_EVERY_N_PLAYERS == 0:
                df_sorted.to_csv(OUTPUT_FILE, index=False)
                save_progress(idx + 1)
                elapsed = time.time() - start_time
                rate = players_processed / elapsed * 60
                print(f"\n{'=' * 80}")
                print(f"PROGRESS: {idx + 1}/{len(df_sorted)} players processed")
                print(f"Rate: {rate:.1f} players/minute")
                print(f"Elapsed: {elapsed/60:.1f} minutes")
                print(f"Saved to: {OUTPUT_FILE}")
                print(f"{'=' * 80}\n")

        except Exception as e:
            log_error(f"Failed to process player at index {idx}: {str(e)}")
            continue

    # Final save
    df_sorted.to_csv(OUTPUT_FILE, index=False)
    save_progress(len(df_sorted))

    elapsed = time.time() - start_time
    print("\n" + "=" * 80)
    print("COMPLETE!")
    print(f"Total players processed: {len(df_sorted)}")
    print(f"Total time: {elapsed/60:.1f} minutes")
    print(f"Output saved to: {OUTPUT_FILE}")
    print(f"Error log: {ERROR_LOG}")
    print("=" * 80)

if __name__ == "__main__":
    main()
