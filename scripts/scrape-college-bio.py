"""
Scrape College Bio Script

Scrapes missing biographical data for college players:
- Height
- Weight
- Hometown
- Homestate
- Class (year)
- Jersey number

Attempts to scrape from multiple sources:
1. Sports-Reference team roster pages
2. College team official websites (if available)

WARNING: This script may take 6-8 hours to complete due to:
- 16,000+ players to check
- Rate limiting (2-second delays between requests)
- Multiple source attempts per player
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
CHECKPOINTS_DIR = BASE_DIR / 'data' / 'checkpoints'

MERGED_ROSTER_FILE = LOOKUPS_DIR / 'FutureDraft_Lookup_MERGED.csv'
OUTPUT_FILE = LOOKUPS_DIR / 'FutureDraft_Lookup_MERGED.csv'
CHECKPOINT_FILE = CHECKPOINTS_DIR / 'bio_scrape_checkpoint.csv'

# Create checkpoints directory
CHECKPOINTS_DIR.mkdir(parents=True, exist_ok=True)

def normalize_team_name(team):
    """Normalize team name for URL slugs"""
    if pd.isna(team) or not team:
        return None

    team = str(team).strip().lower()

    # Special cases
    special_cases = {
        'miami (fl)': 'miami-fl',
        'miami (oh)': 'miami-oh',
        'southern california': 'usc',
        'central florida': 'ucf',
        'southern methodist': 'smu',
        'texas christian': 'tcu',
        'brigham young': 'byu',
        'louisiana state': 'louisiana-state',
        'north carolina state': 'north-carolina-state',
        'alabama-birmingham': 'alabama-birmingham',
        'texas-el paso': 'texas-el-paso',
        'nevada-las vegas': 'nevada-las-vegas',
    }

    if team in special_cases:
        return special_cases[team]

    # Default: replace spaces with hyphens
    return team.replace(' ', '-').replace('&', '').replace('.', '').replace("'", '')

def parse_height(height_str):
    """Parse height string to inches (e.g., '6-2' -> 74)"""
    if pd.isna(height_str) or not height_str:
        return None

    height_str = str(height_str).strip()

    # Try format: 6-2
    if '-' in height_str:
        parts = height_str.split('-')
        if len(parts) == 2:
            try:
                feet = int(parts[0])
                inches = int(parts[1])
                return (feet * 12) + inches
            except:
                pass

    # Try format: 6'2"
    if "'" in height_str:
        try:
            height_str = height_str.replace('"', '').replace("'", '-')
            parts = height_str.split('-')
            if len(parts) == 2:
                feet = int(parts[0])
                inches = int(parts[1])
                return (feet * 12) + inches
        except:
            pass

    return None

def scrape_team_roster(team_slug, team_name):
    """Scrape roster from Sports-Reference team page"""
    url = f"https://www.sports-reference.com/cfb/schools/{team_slug}/2025-roster.html"

    try:
        headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
        response = requests.get(url, headers=headers, timeout=30)

        if response.status_code != 200:
            return []

        soup = BeautifulSoup(response.content, 'html.parser')

        # Find roster table
        table = soup.find('table', {'id': 'roster'})
        if not table:
            return []

        players = []
        tbody = table.find('tbody')
        if not tbody:
            return []

        for tr in tbody.find_all('tr'):
            # Get player name
            player_th = tr.find('th', {'data-stat': 'player'})
            if not player_th:
                continue

            player_link = player_th.find('a')
            if not player_link:
                continue

            player_name = player_link.text.strip()

            # Extract bio data
            player_data = {
                'name': player_name,
                'team': team_name
            }

            # Jersey
            jersey_td = tr.find('td', {'data-stat': 'jersey_number'})
            if jersey_td and jersey_td.text.strip():
                player_data['jersey'] = jersey_td.text.strip()

            # Height
            height_td = tr.find('td', {'data-stat': 'height'})
            if height_td and height_td.text.strip():
                player_data['height'] = height_td.text.strip()

            # Weight
            weight_td = tr.find('td', {'data-stat': 'weight'})
            if weight_td and weight_td.text.strip():
                try:
                    player_data['weight'] = int(weight_td.text.strip())
                except:
                    pass

            # Class
            class_td = tr.find('td', {'data-stat': 'class'})
            if class_td and class_td.text.strip():
                player_data['class'] = class_td.text.strip()

            # Hometown
            hometown_td = tr.find('td', {'data-stat': 'hometown'})
            if hometown_td and hometown_td.text.strip():
                hometown = hometown_td.text.strip()
                # Split hometown and state
                if ',' in hometown:
                    parts = hometown.split(',')
                    player_data['hometown'] = parts[0].strip()
                    if len(parts) > 1:
                        player_data['homestate'] = parts[1].strip()
                else:
                    player_data['hometown'] = hometown

            players.append(player_data)

        return players

    except Exception as e:
        print(f"      WARNING: Failed to scrape {team_name}: {e}")
        return []

def match_player(roster_player, scraped_players):
    """Match roster player to scraped player data"""
    first = str(roster_player.get('First Name', '')).lower().strip()
    last = str(roster_player.get('Last Name', '')).lower().strip()

    if not first or not last:
        return None

    best_match = None
    best_score = 0

    for scraped in scraped_players:
        scraped_name = scraped['name'].lower()

        # Try exact match
        if f"{first} {last}" in scraped_name or f"{last}, {first}" in scraped_name:
            return scraped

        # Fuzzy match on last name (most distinctive)
        if last in scraped_name:
            # Calculate similarity
            name_parts = scraped_name.split()
            for part in name_parts:
                last_dist = levenshtein_distance(last, part)
                similarity = 1 - (last_dist / max(len(last), len(part), 1))

                if similarity > best_score and similarity >= 0.8:
                    best_score = similarity
                    best_match = scraped

    return best_match if best_score >= 0.8 else None

def main():
    print("="*80)
    print("SCRAPING COLLEGE BIO DATA")
    print("="*80)
    print()
    print("WARNING: This script may take 6-8 hours to complete!")
    print("         Processing 16,000+ players with rate limiting")
    print()

    # Load roster
    print("Loading merged roster...")
    roster_df = pd.read_csv(MERGED_ROSTER_FILE)
    print(f"  Loaded {len(roster_df)} players")
    print()

    # Check for checkpoint
    start_idx = 0
    if CHECKPOINT_FILE.exists():
        print("Found checkpoint file, resuming from previous run...")
        checkpoint_df = pd.read_csv(CHECKPOINT_FILE)
        roster_df = checkpoint_df
        # Find first player without complete data
        for idx, row in roster_df.iterrows():
            if pd.isna(row.get('Height')) or pd.isna(row.get('Weight')):
                start_idx = idx
                break
        print(f"  Resuming from player {start_idx + 1}/{len(roster_df)}")
        print()

    # Get unique teams
    teams = roster_df['College'].dropna().unique()
    print(f"Found {len(teams)} unique teams")
    print()

    # Statistics
    n_updated = 0
    n_skipped = 0
    teams_scraped = {}

    print("="*80)
    print("SCRAPING PLAYER BIO DATA")
    print("="*80)
    print()

    for idx in range(start_idx, len(roster_df)):
        player = roster_df.iloc[idx]
        team = player['College']

        # Skip if already has complete data
        if (pd.notna(player.get('Height')) and
            pd.notna(player.get('Weight')) and
            pd.notna(player.get('Jersey'))):
            n_skipped += 1
            continue

        # Scrape team roster if not cached
        if team not in teams_scraped:
            team_slug = normalize_team_name(team)
            if team_slug:
                print(f"  Scraping {team} roster...")
                team_players = scrape_team_roster(team_slug, team)
                teams_scraped[team] = team_players
                time.sleep(2)  # Rate limiting
            else:
                teams_scraped[team] = []

        # Match player to scraped data
        scraped_data = match_player(player, teams_scraped[team])

        if scraped_data:
            # Update missing fields
            if pd.isna(player.get('Jersey')) and scraped_data.get('jersey'):
                roster_df.at[idx, 'Jersey'] = scraped_data['jersey']

            if pd.isna(player.get('Height')) and scraped_data.get('height'):
                height_inches = parse_height(scraped_data['height'])
                if height_inches:
                    roster_df.at[idx, 'Height'] = height_inches

            if pd.isna(player.get('Weight')) and scraped_data.get('weight'):
                roster_df.at[idx, 'Weight'] = scraped_data['weight']

            if pd.isna(player.get('Class')) and scraped_data.get('class'):
                roster_df.at[idx, 'Class'] = scraped_data['class']

            if pd.isna(player.get('Hometown')) and scraped_data.get('hometown'):
                roster_df.at[idx, 'Hometown'] = scraped_data['hometown']

            if pd.isna(player.get('Homestate')) and scraped_data.get('homestate'):
                roster_df.at[idx, 'Homestate'] = scraped_data['homestate']

            n_updated += 1

        # Progress update every 100 players
        if (idx + 1) % 100 == 0:
            print(f"Processed {idx + 1}/{len(roster_df)} players... "
                  f"(Updated: {n_updated}, Skipped: {n_skipped}, Teams: {len(teams_scraped)})")
            sys.stdout.flush()

            # Save checkpoint
            roster_df.to_csv(CHECKPOINT_FILE, index=False)

    print()
    print(f"Processed all {len(roster_df)} players")
    print()

    # Summary
    print("="*80)
    print("BIO SCRAPING COMPLETE")
    print("="*80)
    print()

    print(f"Total players: {len(roster_df)}")
    print(f"  Updated with scraped data: {n_updated}")
    print(f"  Already complete: {n_skipped}")
    print(f"  Teams scraped: {len(teams_scraped)}")
    print()

    # Data completeness
    print("Data Completeness:")
    for field in ['Jersey', 'Height', 'Weight', 'Class', 'Hometown', 'Homestate']:
        filled = roster_df[field].notna() & (roster_df[field] != '')
        pct = (filled.sum() / len(roster_df)) * 100
        print(f"  {field}: {filled.sum()}/{len(roster_df)} ({pct:.1f}%)")
    print()

    # Save output
    print(f"Saving updated roster to {OUTPUT_FILE}...")
    roster_df.to_csv(OUTPUT_FILE, index=False)
    print("  Saved successfully")
    print()

    # Clean up checkpoint
    if CHECKPOINT_FILE.exists():
        CHECKPOINT_FILE.unlink()
        print("  Removed checkpoint file")

    print("Next step: Run flag-college-players.py to flag uncertain players")

    return 0

if __name__ == '__main__':
    sys.exit(main())
