"""
Pro Football Reference Roster Scraper (1970-2001) - Selenium Version

Uses Selenium with Chrome to bypass bot detection.
Scrapes historical NFL rosters from Pro-Football-Reference.com for years 1970-2001.
Outputs to data/lookups/ROSTER_lookup_historical.csv
"""

import pandas as pd
import time
from pathlib import Path
from datetime import datetime
import re
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

# Configure paths
BASE_DIR = Path('.')
OUTPUT_FILE = BASE_DIR / 'data' / 'lookups' / 'ROSTER_lookup_historical.csv'
LOG_FILE = BASE_DIR / 'pfr_scrape_log.txt'

# Track statistics
stats = {
    'teams_scraped': 0,
    'players_extracted': 0,
    'years_processed': set(),
    'errors': []
}

# PFR team abbreviations (handling relocations/name changes)
PFR_TEAMS = {
    'ARI': ['crd', 'ari'],
    'ATL': ['atl'],
    'BAL': ['rav', 'bal'],
    'BUF': ['buf'],
    'CAR': ['car'],
    'CHI': ['chi'],
    'CIN': ['cin'],
    'CLE': ['cle'],
    'DAL': ['dal'],
    'DEN': ['den'],
    'DET': ['det'],
    'GB': ['gnb'],
    'HOU': ['oti', 'htx'],
    'IND': ['clt', 'ind'],
    'JAX': ['jax'],
    'KC': ['kan'],
    'LAC': ['sdg'],
    'LAR': ['ram'],
    'LV': ['rai', 'oak'],
    'MIA': ['mia'],
    'MIN': ['min'],
    'NE': ['nwe'],
    'NO': ['nor'],
    'NYG': ['nyg'],
    'NYJ': ['nyj'],
    'PHI': ['phi'],
    'PIT': ['pit'],
    'SF': ['sfo'],
    'SEA': ['sea'],
    'TB': ['tam'],
    'TEN': ['oti', 'ten'],
    'WAS': ['was'],
}

def log_message(message):
    """Log message to both console and file"""
    print(message)
    with open(LOG_FILE, 'a') as f:
        f.write(f"{datetime.now().strftime('%Y-%m-%d %H:%M:%S')} - {message}\n")

def parse_height(ht_str):
    """Convert height string like '6-2' to inches"""
    if pd.isna(ht_str) or not ht_str:
        return 0
    try:
        match = re.match(r'(\d+)-(\d+)', str(ht_str))
        if match:
            feet, inches = match.groups()
            return int(feet) * 12 + int(inches)
    except:
        pass
    return 0

def parse_draft_info(draft_str):
    """Extract draft year from 'Team / Round / Pick / Year' string"""
    if pd.isna(draft_str) or not draft_str:
        return None
    try:
        match = re.search(r'/\s*(\d{4})\s*$', str(draft_str))
        if match:
            return int(match.group(1))
    except:
        pass
    return None

def scrape_team_roster(driver, team_code, year):
    """Scrape a single team's roster for a given year using Selenium"""
    url = f"https://www.pro-football-reference.com/teams/{team_code}/{year}_roster.htm"

    try:
        # Be polite - add delay between requests
        time.sleep(0.5)

        # Navigate to page with timeout
        driver.set_page_load_timeout(15)  # 15 second max for page load
        driver.get(url)

        # Wait for page to load (wait for roster table)
        try:
            WebDriverWait(driver, 5).until(
                EC.presence_of_element_located((By.ID, "roster"))
            )
        except:
            # Table not found - team might not exist this year
            return []

        # Get page source and parse with pandas
        html = driver.page_source
        tables = pd.read_html(html)

        if not tables:
            log_message(f"    WARNING: No tables found for {team_code} {year}")
            return []

        # IMPORTANT: Modern pages have 2 tables: [0]=starters (~24), [1]=full roster (50+)
        # Older pages might have just 1 table: [0]=full roster (50+)
        # Use the LAST table which is always the full roster
        df = tables[-1]  # Last table is always full roster
        log_message(f"    Found {len(df)} players")

        # Process each player
        players = []
        for _, row in df.iterrows():
            try:
                player_name = str(row.get('Player', '')).strip()
                if not player_name or player_name == 'Player':
                    continue

                name_parts = player_name.split(' ', 1)
                first_name = name_parts[0] if len(name_parts) > 0 else ''
                last_name = name_parts[1] if len(name_parts) > 1 else ''

                if not first_name or not last_name:
                    continue

                jersey = row.get('No.', '')
                age = row.get('Age', 0)
                position = row.get('Pos', '')
                games = row.get('G', 0)
                games_started = row.get('GS', 0)
                weight = row.get('Wt', 0)
                height = parse_height(row.get('Ht', ''))
                college = row.get('College/Univ', '')
                birth_date = row.get('BirthDate', '')
                years_pro = row.get('Yrs', '')
                av = row.get('AV', 0)
                draft_year = parse_draft_info(row.get('Drafted (tm/rnd/yr)', ''))

                player = {
                    'Year': year,
                    'Season_Team': team_code.upper(),
                    'Player_Name': player_name,
                    'First_Name': first_name,
                    'Last_Name': last_name,
                    'Position': position,
                    'Jersey': str(jersey) if not pd.isna(jersey) else '',
                    'Age': int(age) if not pd.isna(age) else 0,
                    'Height': height,
                    'Weight': int(weight) if not pd.isna(weight) else 0,
                    'College': college if not pd.isna(college) else '',
                    'BirthDate': birth_date if not pd.isna(birth_date) else '',
                    'Years_Pro': str(years_pro) if not pd.isna(years_pro) else '',
                    'Games': int(games) if not pd.isna(games) else 0,
                    'Games_Started': int(games_started) if not pd.isna(games_started) else 0,
                    'AV': float(av) if not pd.isna(av) else 0.0,
                    'Draft_Year': draft_year,
                    'POVR': 0,
                    'PID': 0,
                    'PAM': 0,
                }

                players.append(player)
                stats['players_extracted'] += 1

            except Exception as e:
                stats['errors'].append(f"Error processing player in {team_code} {year}: {e}")
                continue

        stats['teams_scraped'] += 1
        return players

    except Exception as e:
        stats['errors'].append(f"Error scraping {team_code} {year}: {e}")
        return []

def save_checkpoint(all_players):
    """Save current progress to CSV"""
    if not all_players:
        return

    df_output = pd.DataFrame(all_players)
    df_output = df_output.sort_values(['Year', 'Season_Team', 'AV'], ascending=[True, True, False])
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    df_output.to_csv(OUTPUT_FILE, index=False)
    log_message(f"  >> Checkpoint saved: {len(df_output)} players")

def load_existing_data():
    """Load existing data and determine what years to skip"""
    if not OUTPUT_FILE.exists():
        log_message("No existing data found - starting from 1970")
        return [], 1970

    log_message("Loading existing data...")
    df_existing = pd.read_csv(OUTPUT_FILE)
    completed_years = sorted(df_existing['Year'].unique())

    if completed_years:
        last_year = max(completed_years)
        log_message(f"Found existing data through {last_year}")
        log_message(f"Resuming from {last_year + 1}...")
        return df_existing.to_dict('records'), last_year + 1

    return [], 1970

def main():
    """Main scraping process with checkpointing"""
    log_message("=" * 80)
    log_message("PRO FOOTBALL REFERENCE ROSTER SCRAPER (1970-2001) - SELENIUM VERSION")
    log_message("=" * 80)
    log_message("")

    # Load existing data and determine starting year
    existing_players, start_year = load_existing_data()
    all_players = existing_players.copy()

    if start_year > 2001:
        log_message("All years already scraped!")
        return

    # Setup Chrome options
    chrome_options = Options()
    chrome_options.add_argument('--headless')
    chrome_options.add_argument('--no-sandbox')
    chrome_options.add_argument('--disable-dev-shm-usage')
    chrome_options.add_argument('--disable-blink-features=AutomationControlled')
    chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
    chrome_options.add_experimental_option('useAutomationExtension', False)
    chrome_options.add_argument('user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')

    log_message("Starting Chrome browser...")
    driver = webdriver.Chrome(options=chrome_options)

    # Remove webdriver flag
    driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")

    try:
        # Scrape all years from start_year to 2001
        for year in range(start_year, 2002):
            log_message(f"\nProcessing {year}...")
            stats['years_processed'].add(year)
            year_players = []

            # Try all team codes
            for team_name, team_codes in PFR_TEAMS.items():
                for team_code in team_codes:
                    players = scrape_team_roster(driver, team_code, year)
                    if players:
                        year_players.extend(players)
                        all_players.extend(players)
                        break

            # Save checkpoint after each year
            if year_players:
                save_checkpoint(all_players)

    finally:
        driver.quit()
        log_message("\nBrowser closed")

    # Create final DataFrame
    log_message("")
    log_message("Creating final output...")

    if not all_players:
        log_message("ERROR: No players were extracted!")
        log_message("Check the log above for warnings/errors.")
        return

    df_output = pd.DataFrame(all_players)
    df_output = df_output.sort_values(['Year', 'Season_Team', 'AV'], ascending=[True, True, False])

    # Save final CSV
    log_message(f"Saving final version to {OUTPUT_FILE}...")
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    df_output.to_csv(OUTPUT_FILE, index=False)

    # Print statistics
    log_message("")
    log_message("=" * 80)
    log_message("SCRAPING COMPLETE")
    log_message("=" * 80)
    log_message(f"Teams scraped: {stats['teams_scraped']}")
    log_message(f"Players extracted: {stats['players_extracted']}")
    log_message(f"Years covered: {sorted(stats['years_processed'])}")
    log_message(f"Output file: {OUTPUT_FILE}")
    log_message(f"Output rows: {len(df_output)}")
    log_message(f"Output columns: {len(df_output.columns)}")

    if stats['errors']:
        log_message(f"\nWarnings/Errors: {len(stats['errors'])}")
        for error in stats['errors'][:20]:
            log_message(f"  - {error}")
        if len(stats['errors']) > 20:
            log_message(f"  ... and {len(stats['errors']) - 20} more")

    log_message("")
    log_message("Next steps:")
    log_message("1. Review ROSTER_lookup_historical.csv for data quality")
    log_message("2. Design AV -> Madden ratings conversion formula")
    log_message("3. Merge with ROSTER_lookup.csv (2002-2024)")
    log_message("")

if __name__ == '__main__':
    main()
