"""
Simple PFR Scraper - No Selenium, just requests
Uses requests + random delays to avoid detection
"""

import pandas as pd
import time
import random
from pathlib import Path
from datetime import datetime
import re

# Configure paths
BASE_DIR = Path('.')
OUTPUT_FILE = BASE_DIR / 'data' / 'lookups' / 'ROSTER_lookup_historical.csv'
LOG_FILE = BASE_DIR / 'pfr_scrape_log.txt'

# User agents to rotate
USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
]

# PFR team abbreviations
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

stats = {
    'teams_scraped': 0,
    'players_extracted': 0,
    'errors': []
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

def scrape_team_roster(team_code, year, session):
    """Scrape a single team's roster using requests"""
    url = f"https://www.pro-football-reference.com/teams/{team_code}/{year}_roster.htm"

    try:
        # Random delay between 3-8 seconds
        delay = random.uniform(3, 8)
        time.sleep(delay)

        # Random user agent
        headers = {
            'User-Agent': random.choice(USER_AGENTS),
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1'
        }

        # Make request with timeout
        response = session.get(url, headers=headers, timeout=20)

        if response.status_code == 404:
            return []  # Team doesn't exist this year

        if response.status_code == 429:
            log_message(f"    Rate limited, waiting 30 seconds...")
            time.sleep(30)
            return None  # Signal to retry

        if response.status_code != 200:
            log_message(f"    HTTP {response.status_code} for {team_code} {year}")
            return []

        # PFR hides full tables in HTML comments to prevent scraping
        # Find commented-out table data
        comment_pattern = r'<!--(.*?)-->'
        comments = re.findall(comment_pattern, response.text, re.DOTALL)

        # Try to find roster table in comments
        df = None
        for comment in comments:
            if 'id="roster"' in comment or ('<table' in comment and 'Player' in comment):
                try:
                    tables = pd.read_html(comment)
                    if tables:
                        df = max(tables, key=len)  # Get largest table from comment
                        break
                except:
                    continue

        # Fallback: try parsing visible HTML (for older pages)
        if df is None:
            tables = pd.read_html(response.text)
            if not tables:
                return []
            df = max(tables, key=len)

        # Process players
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

                player = {
                    'Year': year,
                    'Season_Team': team_code.upper(),
                    'Player_Name': player_name,
                    'First_Name': first_name,
                    'Last_Name': last_name,
                    'Position': row.get('Pos', ''),
                    'Jersey': str(row.get('No.', '')),
                    'Age': int(row.get('Age', 0)) if not pd.isna(row.get('Age', 0)) else 0,
                    'Height': parse_height(row.get('Ht', '')),
                    'Weight': int(row.get('Wt', 0)) if not pd.isna(row.get('Wt', 0)) else 0,
                    'College': row.get('College/Univ', '') if not pd.isna(row.get('College/Univ', '')) else '',
                    'BirthDate': row.get('BirthDate', '') if not pd.isna(row.get('BirthDate', '')) else '',
                    'Years_Pro': str(row.get('Yrs', '')) if not pd.isna(row.get('Yrs', '')) else '',
                    'Games': int(row.get('G', 0)) if not pd.isna(row.get('G', 0)) else 0,
                    'Games_Started': int(row.get('GS', 0)) if not pd.isna(row.get('GS', 0)) else 0,
                    'AV': float(row.get('AV', 0)) if not pd.isna(row.get('AV', 0)) else 0.0,
                    'Draft_Year': parse_draft_info(row.get('Drafted (tm/rnd/yr)', '')),
                    'POVR': 0,
                    'PID': 0,
                    'PAM': 0,
                }

                players.append(player)
                stats['players_extracted'] += 1

            except Exception as e:
                stats['errors'].append(f"Error processing player in {team_code} {year}: {e}")
                continue

        if players:
            log_message(f"    Found {len(players)} players")
            stats['teams_scraped'] += 1

        return players

    except Exception as e:
        log_message(f"    Error: {e}")
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
    """Main scraping process"""
    log_message("=" * 80)
    log_message("PRO FOOTBALL REFERENCE ROSTER SCRAPER - SIMPLE VERSION")
    log_message("=" * 80)
    log_message("")

    # Load existing data
    existing_players, start_year = load_existing_data()
    all_players = existing_players.copy()

    # Check for gaps in years
    if existing_players:
        df_existing = pd.DataFrame(existing_players)
        existing_years = set(df_existing['Year'].unique())
        all_years = set(range(1970, 2002))
        missing_years = sorted(all_years - existing_years)

        if missing_years:
            start_year = missing_years[0]
            log_message(f"Found gaps in data: {missing_years}")
            log_message(f"Starting from first gap: {start_year}")
        elif start_year > 2001:
            log_message("All years already scraped!")
            return
    elif start_year > 2001:
        log_message("All years already scraped!")
        return

    # Create session for connection reuse
    import requests
    session = requests.Session()

    try:
        # Scrape all years from start_year to 2001
        for year in range(start_year, 2002):
            log_message(f"\nProcessing {year}...")
            year_players = []

            # Try all team codes
            for team_name, team_codes in PFR_TEAMS.items():
                for team_code in team_codes:
                    players = scrape_team_roster(team_code, year, session)

                    # If rate limited, retry after delay
                    if players is None:
                        players = scrape_team_roster(team_code, year, session)

                    if players:
                        year_players.extend(players)
                        all_players.extend(players)
                        break

            # Save checkpoint after each year
            if year_players:
                save_checkpoint(all_players)

    finally:
        session.close()

    # Print final statistics
    log_message("")
    log_message("=" * 80)
    log_message("SCRAPING COMPLETE")
    log_message("=" * 80)
    log_message(f"Teams scraped: {stats['teams_scraped']}")
    log_message(f"Players extracted: {stats['players_extracted']}")
    log_message(f"Output file: {OUTPUT_FILE}")

    if stats['errors']:
        log_message(f"\nWarnings/Errors: {len(stats['errors'])}")
        for error in stats['errors'][:10]:
            log_message(f"  - {error}")

if __name__ == '__main__':
    main()
