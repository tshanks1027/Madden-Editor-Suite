"""
Pro Football Reference Roster Scraper (1970-2001) - Puppeteer Version

Uses pyppeteer (Python Puppeteer) to bypass bot detection.
Scrapes historical NFL rosters from Pro-Football-Reference.com for years 1970-2001.
Outputs to data/lookups/ROSTER_lookup_historical.csv
"""

import pandas as pd
import asyncio
import time
from pathlib import Path
from datetime import datetime
import re

# Try to import pyppeteer
try:
    from pyppeteer import launch
except ImportError:
    print("ERROR: pyppeteer is not installed!")
    print("Please install it with: pip install pyppeteer")
    exit(1)

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
    # Modern teams (with historical codes)
    'ARI': ['crd', 'ari'],  # Cardinals (Phoenix 1988-1993, Arizona 1994+)
    'ATL': ['atl'],
    'BAL': ['rav', 'bal'],  # Ravens (1996+)
    'BUF': ['buf'],
    'CAR': ['car'],  # Panthers (1995+)
    'CHI': ['chi'],
    'CIN': ['cin'],
    'CLE': ['cle'],  # Browns
    'DAL': ['dal'],
    'DEN': ['den'],
    'DET': ['det'],
    'GB': ['gnb'],
    'HOU': ['oti', 'htx'],  # Oilers->Titans, Texans (2002+)
    'IND': ['clt', 'ind'],  # Colts (Baltimore->Indianapolis 1984)
    'JAX': ['jax'],  # Jaguars (1995+)
    'KC': ['kan'],
    'LAC': ['sdg'],  # Chargers (San Diego 1961-2016)
    'LAR': ['ram'],  # Rams (LA->St.Louis 1995, back to LA 2016)
    'LV': ['rai', 'oak'],  # Raiders (Oakland/LA/Oakland/Vegas)
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
    'TEN': ['oti', 'ten'],  # Oilers/Titans
    'WAS': ['was'],  # Commanders (formerly Redskins/Football Team)
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
        # Format: "Indianapolis Colts / 4th / 106th pick / 1994"
        match = re.search(r'/\s*(\d{4})\s*$', str(draft_str))
        if match:
            return int(match.group(1))
    except:
        pass
    return None

async def scrape_team_roster(browser, team_code, year):
    """Scrape a single team's roster for a given year using Puppeteer"""
    url = f"https://www.pro-football-reference.com/teams/{team_code}/{year}_roster.htm"

    page = None
    try:
        # Be polite - add delay between requests
        await asyncio.sleep(2)

        page = await browser.newPage()

        log_message(f"  Scraping: {team_code} {year}...")

        # Navigate to page
        response = await page.goto(url, {'waitUntil': 'networkidle0', 'timeout': 30000})

        if response.status == 404:
            # Team didn't exist this year (expansion/relocation)
            await page.close()
            return []

        # Get page HTML
        html = await page.content()

        # Parse HTML tables
        tables = pd.read_html(html)
        if not tables:
            log_message(f"    WARNING: No tables found for {team_code} {year}")
            await page.close()
            return []

        df = tables[0]  # First table is roster
        log_message(f"    Found {len(df)} players")

        # Process each player
        players = []
        for _, row in df.iterrows():
            try:
                # Extract player name
                player_name = str(row.get('Player', '')).strip()
                if not player_name or player_name == 'Player':
                    continue  # Skip header rows

                # Split name into first/last
                name_parts = player_name.split(' ', 1)
                first_name = name_parts[0] if len(name_parts) > 0 else ''
                last_name = name_parts[1] if len(name_parts) > 1 else ''

                if not first_name or not last_name:
                    continue

                # Extract data
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
                av = row.get('AV', 0)  # Approximate Value - key for ratings!
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
                    # Placeholder for Madden ratings - will be calculated later
                    'POVR': 0,
                    'PID': 0,
                    'PAM': 0,
                }

                players.append(player)
                stats['players_extracted'] += 1

            except Exception as e:
                stats['errors'].append(f"Error processing player in {team_code} {year}: {e}")
                continue

        await page.close()
        stats['teams_scraped'] += 1
        return players

    except Exception as e:
        stats['errors'].append(f"Error scraping {team_code} {year}: {e}")
        if page:
            await page.close()
        return []

async def main():
    """Main scraping process"""
    log_message("=" * 80)
    log_message("PRO FOOTBALL REFERENCE ROSTER SCRAPER (1970-2001) - PUPPETEER VERSION")
    log_message("=" * 80)
    log_message("")

    # Clear previous log
    if LOG_FILE.exists():
        LOG_FILE.unlink()

    all_players = []

    # Launch browser
    log_message("Launching headless browser...")
    browser = await launch({
        'headless': True,
        'args': ['--no-sandbox', '--disable-setuid-sandbox']
    })

    try:
        # Scrape all years 1970-2001
        for year in range(1970, 2002):
            log_message(f"\nProcessing {year}...")
            stats['years_processed'].add(year)

            # Try all team codes (some teams didn't exist in early years)
            for team_name, team_codes in PFR_TEAMS.items():
                for team_code in team_codes:
                    players = await scrape_team_roster(browser, team_code, year)
                    if players:
                        all_players.extend(players)
                        break  # Found roster, move to next team

    finally:
        await browser.close()

    # Create DataFrame
    log_message("")
    log_message("Creating output DataFrame...")

    if not all_players:
        log_message("ERROR: No players were extracted!")
        log_message("Check the log above for warnings/errors.")
        return

    df_output = pd.DataFrame(all_players)

    # Sort by year and team
    df_output = df_output.sort_values(['Year', 'Season_Team', 'AV'], ascending=[True, True, False])

    # Save to CSV
    log_message(f"Saving to {OUTPUT_FILE}...")
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
        for error in stats['errors'][:20]:  # Show first 20 errors
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
    asyncio.get_event_loop().run_until_complete(main())
