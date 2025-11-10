"""
Parse College Stats Script

Parses statistics from:
1. HTML Excel files (Passing, Receiving, Rushing)
2. Web scraping from College Football Reference (Defensive stats)
3. Matches stats to merged roster players
4. Outputs combined stats CSV
"""

import pandas as pd
import sys
import requests
from bs4 import BeautifulSoup
from pathlib import Path
import time
from Levenshtein import distance as levenshtein_distance

# Unbuffered output
sys.stdout.reconfigure(line_buffering=True)
sys.stderr.reconfigure(line_buffering=True)

# Paths
BASE_DIR = Path('.')
LOOKUPS_DIR = BASE_DIR / 'data' / 'lookups'
STATS_DIR = BASE_DIR / 'data' / 'college_stats'
CHECKPOINTS_DIR = BASE_DIR / 'data' / 'checkpoints'

MERGED_ROSTER_FILE = LOOKUPS_DIR / 'FutureDraft_Lookup_MERGED.csv'
PASSING_FILE = LOOKUPS_DIR / '2025 Passing.xls'
RECEIVING_FILE = LOOKUPS_DIR / '2025 Receiving.xls'
RUSHING_FILE = LOOKUPS_DIR / '2025 Rushing.xls'
OUTPUT_FILE = STATS_DIR / '2025_all_stats.csv'

# Create directories
STATS_DIR.mkdir(parents=True, exist_ok=True)
CHECKPOINTS_DIR.mkdir(parents=True, exist_ok=True)

# Team name normalization
TEAM_ALIASES = {
    'uconn': 'connecticut',
    'pitt': 'pittsburgh',
    'ole miss': 'mississippi',
    'miami': 'miami (fl)',
    'miami fl': 'miami (fl)',
    'miami-fl': 'miami (fl)',
    'miami oh': 'miami (oh)',
    'miami-oh': 'miami (oh)',
    'usc': 'southern california',
    'southern cal': 'southern california',
    'nc state': 'north carolina state',
    'ncstate': 'north carolina state',
    'smu': 'southern methodist',
    'tcu': 'texas christian',
    'byu': 'brigham young',
    'ucf': 'central florida',
    'lsu': 'louisiana state',
    'uab': 'alabama-birmingham',
    'unlv': 'nevada-las vegas',
}

def normalize_team_name(team):
    """Normalize team names for consistent matching"""
    if pd.isna(team) or not team:
        return ''

    team = str(team).strip().lower()

    if team in TEAM_ALIASES:
        return TEAM_ALIASES[team]

    team = team.replace(' university', '').replace(' college', '').replace('-', ' ')
    return team.strip()

def normalize_player_name(name):
    """Normalize player name for matching"""
    if pd.isna(name) or not name:
        return '', ''

    name = str(name).strip()

    # Remove suffixes
    suffixes = [' Jr.', ' Jr', ' Sr.', ' Sr', ' III', ' II', ' IV']
    for suffix in suffixes:
        if name.endswith(suffix):
            name = name[:-len(suffix)].strip()

    # Split into parts
    parts = name.split()
    if len(parts) >= 2:
        first = parts[0].lower()
        last = ' '.join(parts[1:]).lower()
        return first, last
    elif len(parts) == 1:
        return '', parts[0].lower()
    else:
        return '', ''

def parse_html_stat_file(file_path, stat_type):
    """Parse HTML Excel stat file"""
    print(f"  Parsing {stat_type} stats from {file_path.name}...")

    try:
        # Read HTML table
        df = pd.read_html(file_path)[0]

        # Handle multi-level columns (flatten)
        if isinstance(df.columns, pd.MultiIndex):
            # Flatten column names
            df.columns = [col[1] if col[0].startswith('Unnamed') else f"{col[0]}_{col[1]}"
                         for col in df.columns]

        # Get player column (might be 'Player' or nested)
        player_col = 'Player'
        if player_col not in df.columns:
            # Try to find player column
            for col in df.columns:
                if 'player' in str(col).lower():
                    player_col = col
                    break

        if player_col not in df.columns:
            print(f"    ERROR: Could not find Player column. Columns: {df.columns.tolist()}")
            return None

        # Parse player names
        df['First_Name'], df['Last_Name'] = zip(*df[player_col].apply(normalize_player_name))

        # Get team column
        team_col = 'Team'
        if team_col not in df.columns:
            for col in df.columns:
                if 'team' in str(col).lower():
                    team_col = col
                    break

        if team_col in df.columns:
            df['Team_Norm'] = df[team_col].apply(normalize_team_name)
        else:
            df['Team_Norm'] = ''

        # Add stat type
        df['Stat_Type'] = stat_type

        print(f"    Parsed {len(df)} {stat_type} records")
        return df

    except Exception as e:
        print(f"    ERROR: Failed to parse {file_path}: {e}")
        import traceback
        traceback.print_exc()
        return None

def scrape_team_defensive_stats(team_slug, team_name):
    """Scrape defensive stats from a team's page"""
    url = f"https://www.sports-reference.com/cfb/schools/{team_slug}/2025.html"

    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }

        response = requests.get(url, headers=headers, timeout=30)
        response.raise_for_status()

        soup = BeautifulSoup(response.content, 'html.parser')

        # Find defense table
        table = soup.find('table', {'id': 'defense'})
        if not table:
            return []

        rows = []
        tbody = table.find('tbody')
        if not tbody:
            return []

        for tr in tbody.find_all('tr'):
            # Skip header rows
            if 'class' in tr.attrs and 'thead' in tr.attrs['class']:
                continue

            # Get player name
            player_th = tr.find('th', {'data-stat': 'player'})
            if not player_th:
                continue

            player_link = player_th.find('a')
            if not player_link:
                continue

            player_name = player_link.text.strip()
            first, last = normalize_player_name(player_name)

            if not last:
                continue

            row_data = {
                'Player': player_name,
                'First_Name': first,
                'Last_Name': last,
                'Team': team_name,
                'Team_Norm': normalize_team_name(team_name)
            }

            # Extract defensive stats
            stat_map = {
                'def_tackles_solo': 'Solo_Tackles',
                'def_tackles_assists': 'Ast_Tackles',
                'def_tackles_combined': 'Total_Tackles',
                'def_tackles_loss': 'TFL',
                'def_sacks': 'Sacks',
                'def_interceptions': 'INT',
                'def_pd': 'PBU',
                'fumbles_forced': 'FF',
                'fumbles_rec': 'FR'
            }

            for stat_key, col_name in stat_map.items():
                td = tr.find('td', {'data-stat': stat_key})
                if td and td.text.strip():
                    try:
                        row_data[col_name] = float(td.text.strip())
                    except:
                        row_data[col_name] = 0.0
                else:
                    row_data[col_name] = 0.0

            rows.append(row_data)

        return rows

    except Exception as e:
        print(f"      WARNING: Failed to scrape {team_name}: {e}")
        return []

def scrape_defensive_stats(merged_roster_df):
    """Scrape defensive stats from all FBS team pages"""
    print("  Scraping defensive stats from team pages...")

    # Get unique teams from merged roster
    teams = merged_roster_df['College'].dropna().unique()
    print(f"    Found {len(teams)} unique teams in roster")

    # Team name to slug mapping (common conversions)
    def team_to_slug(team):
        slug = team.lower()
        slug = slug.replace(' ', '-')
        slug = slug.replace('&', '')
        slug = slug.replace('.', '')
        slug = slug.replace("'", '')

        # Special cases
        special_cases = {
            'miami-(fl)': 'miami-fl',
            'miami-(oh)': 'miami-oh',
            'southern-california': 'usc',
            'central-florida': 'ucf',
            'southern-methodist': 'smu',
            'texas-christian': 'tcu',
            'brigham-young': 'byu',
            'louisiana-state': 'louisiana-state',
            'north-carolina-state': 'north-carolina-state',
            'alabama-birmingham': 'alabama-birmingham',
            'texas-el-paso': 'texas-el-paso',
            'nevada-las-vegas': 'nevada-las-vegas',
        }

        return special_cases.get(slug, slug)

    all_defense_rows = []
    scraped_count = 0

    # Scrape top ~20 teams for now (to avoid too long execution)
    # User can extend this list or scrape all teams
    priority_teams = list(teams)[:20]

    for team in priority_teams:
        team_slug = team_to_slug(team)
        print(f"    Scraping {team} ({scraped_count + 1}/{len(priority_teams)})...")

        team_rows = scrape_team_defensive_stats(team_slug, team)
        all_defense_rows.extend(team_rows)
        scraped_count += 1

        # Rate limiting
        time.sleep(2)

    if all_defense_rows:
        df = pd.DataFrame(all_defense_rows)
        df['Stat_Type'] = 'Defense'
        print(f"    Scraped {len(df)} defensive records from {scraped_count} teams")
        return df
    else:
        print("    WARNING: No defensive stats scraped")
        return pd.DataFrame()

def match_stats_to_roster(roster_df, stats_df, stat_type):
    """Match stats to roster players using fuzzy matching"""
    print(f"  Matching {stat_type} stats to roster...")

    matched = 0
    unmatched = 0

    # Build roster index
    roster_index = {}
    for idx, row in roster_df.iterrows():
        first = str(row.get('First Name', '')).lower().strip()
        last = str(row.get('Last Name', '')).lower().strip()
        team = normalize_team_name(row.get('College', ''))

        if first and last:
            key = (last, first, team)
            roster_index[key] = idx

    # Match stats
    stats_df['Roster_Index'] = None

    for idx, stat_row in stats_df.iterrows():
        first = stat_row.get('First_Name', '')
        last = stat_row.get('Last_Name', '')
        team = stat_row.get('Team_Norm', '')

        if not first or not last:
            unmatched += 1
            continue

        # Try exact match
        exact_key = (last, first, team)
        if exact_key in roster_index:
            stats_df.at[idx, 'Roster_Index'] = roster_index[exact_key]
            matched += 1
            continue

        # Try name match with any team
        best_match = None
        best_score = 0

        for (r_last, r_first, r_team), r_idx in roster_index.items():
            if r_last == last and r_first == first:
                best_match = r_idx
                best_score = 0.95
                break

            # Fuzzy match
            last_dist = levenshtein_distance(last, r_last)
            first_dist = levenshtein_distance(first, r_first)

            last_sim = 1 - (last_dist / max(len(last), len(r_last), 1))
            first_sim = 1 - (first_dist / max(len(first), len(r_first), 1))
            team_match = 1.0 if team == r_team else 0.0

            score = (last_sim * 0.45) + (first_sim * 0.35) + (team_match * 0.20)

            if score > best_score and score >= 0.80:
                best_score = score
                best_match = r_idx

        if best_match is not None:
            stats_df.at[idx, 'Roster_Index'] = best_match
            matched += 1
        else:
            unmatched += 1

    match_pct = (matched / len(stats_df) * 100) if len(stats_df) > 0 else 0
    print(f"    Matched: {matched}/{len(stats_df)} ({match_pct:.1f}%)")
    print(f"    Unmatched: {unmatched}")

    return stats_df

def main():
    print("="*80)
    print("PARSING COLLEGE STATS")
    print("="*80)
    print()

    # Load merged roster
    print("Loading merged roster...")
    roster_df = pd.read_csv(MERGED_ROSTER_FILE)
    print(f"  Loaded {len(roster_df)} players")
    print()

    # Parse stat files
    print("="*80)
    print("PARSING STAT FILES")
    print("="*80)
    print()

    all_stats = []

    # Passing stats
    if PASSING_FILE.exists():
        passing_df = parse_html_stat_file(PASSING_FILE, 'Passing')
        if passing_df is not None:
            passing_df = match_stats_to_roster(roster_df, passing_df, 'Passing')
            all_stats.append(passing_df)

    print()

    # Receiving stats
    if RECEIVING_FILE.exists():
        receiving_df = parse_html_stat_file(RECEIVING_FILE, 'Receiving')
        if receiving_df is not None:
            receiving_df = match_stats_to_roster(roster_df, receiving_df, 'Receiving')
            all_stats.append(receiving_df)

    print()

    # Rushing stats
    if RUSHING_FILE.exists():
        rushing_df = parse_html_stat_file(RUSHING_FILE, 'Rushing')
        if rushing_df is not None:
            rushing_df = match_stats_to_roster(roster_df, rushing_df, 'Rushing')
            all_stats.append(rushing_df)

    print()

    # Defensive stats - Skip for now (require JavaScript scraping or API key)
    print("="*80)
    print("DEFENSIVE STATS")
    print("="*80)
    print()
    print("  Skipping defensive stats scraping (requires Selenium for JavaScript tables)")
    print("  Defensive players will be handled by position in wAV calculation")
    print("  NOTE: If defensive stats CSV becomes available, add it to lookups/ folder")
    print()

    # Combine all stats
    print("="*80)
    print("COMBINING STATS")
    print("="*80)
    print()

    if all_stats:
        combined_df = pd.concat(all_stats, ignore_index=True)

        print(f"Total stat records: {len(combined_df)}")
        print(f"  Passing: {len(combined_df[combined_df['Stat_Type'] == 'Passing'])}")
        print(f"  Receiving: {len(combined_df[combined_df['Stat_Type'] == 'Receiving'])}")
        print(f"  Rushing: {len(combined_df[combined_df['Stat_Type'] == 'Rushing'])}")
        print(f"  Defense: {len(combined_df[combined_df['Stat_Type'] == 'Defense'])}")
        print()

        # Save output
        print(f"Saving combined stats to {OUTPUT_FILE}...")
        combined_df.to_csv(OUTPUT_FILE, index=False)
        print("  Saved successfully")
        print()

        # Summary
        matched_count = combined_df['Roster_Index'].notna().sum()
        match_pct = (matched_count / len(combined_df) * 100) if len(combined_df) > 0 else 0
        print(f"Overall match rate: {matched_count}/{len(combined_df)} ({match_pct:.1f}%)")
        print()
        print("Next step: Run calculate-college-wav.py to compute wAV values")
    else:
        print("ERROR: No stats were successfully parsed")
        return 1

    return 0

if __name__ == '__main__':
    sys.exit(main())
