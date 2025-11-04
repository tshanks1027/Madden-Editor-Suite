#!/usr/bin/env python3
"""
NFL Draft Class Year Scraper - API Version
Uses the College Football Data API instead of web scraping
"""

import csv
import json
import time
import requests
from collections import defaultdict
from difflib import SequenceMatcher

# Configuration
INPUT_FILE = './data/lookups/FutureDraft_Lookup.csv'
OUTPUT_FILE = './data/lookups/FutureDraft_Lookup_WITH_CLASSES.csv'
PROGRESS_FILE = 'scraping_progress_api.json'

# College Football Data API
API_BASE_URL = 'https://api.collegefootballdata.com'
CURRENT_YEAR = 2025  # Current roster year

# Rate limiting for API
DELAY_BETWEEN_REQUESTS = 1.0  # seconds

# Team name mappings to API format
TEAM_NAME_MAPPINGS = {
    'Miami (FL)': 'Miami',
    'Miami (OH)': 'Miami (OH)',
    'USC': 'USC',
    'Ohio State': 'Ohio State',
    'Texas A&M': 'Texas A&M',
    'Penn State': 'Penn State',
    'Bucks': 'Ohio State',
    'Penn St.': 'Penn State',
    'SC': 'South Carolina',
    'TA&M': 'Texas A&M',
    'FSU': 'Florida State',
    'NC': 'North Carolina',
    'OSU': 'Ohio State',
    'Missou': 'Missouri',
    'Mich St.': 'Michigan State',
    'ASU': 'Arizona State',
    'WVU': 'West Virginia',
    'ISU': 'Iowa State',
    'G Tech': 'Georgia Tech',
    'Miss St.': 'Mississippi State',
    'Minn': 'Minnesota',
    'Boise St.': 'Boise State',
    'Virgina': 'Virginia',
    'NW': 'Northwestern',
    'Cal': 'California',
    'LA Tech': 'Louisiana Tech',
    'V Tech': 'Virginia Tech',
    'K St.': 'Kansas State',
    'NCSt.': 'NC State',
    'NDSt.': 'North Dakota State',
    'SDSt.': 'San Diego State',
    'ECU': 'East Carolina',
    'Fresno St.': 'Fresno State',
    'FAU': 'Florida Atlantic',
    'YSU': 'Youngstown State',
    'Georgia St.': 'Georgia State',
    'BC': 'Boston College',
    'Texas St.': 'Texas State',
    'UL Laf': 'Louisiana',
    'BGSU': 'Bowling Green',
    'N. Texas': 'North Texas',
    'W. Mich': 'Western Michigan',
    'JMU': 'James Madison',
    'SD': 'San Diego State',
    'SJSt.': 'San Jose State',
    'NMU': 'Northern Michigan',
    'W&M': 'William & Mary',
    'Utah St.': 'Utah State',
    'Tenn-Martin': 'UT Martin',
    'ESU': 'Emporia State',
    'WIU': 'Western Illinois',
    'TSU': 'Tennessee State',
    'Mich State': 'Michigan State',
    'W. Illinois': 'Western Illinois',
    'Tenn': 'Tennessee',
    'M. Tenn St.': 'Middle Tennessee',
    'Tex S.': 'Texas State',
    'Ole Miss': 'Mississippi',
    'Pitt': 'Pittsburgh',
}

def load_progress():
    """Load previous progress"""
    try:
        with open(PROGRESS_FILE, 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        return {}

def save_progress(progress):
    """Save progress"""
    with open(PROGRESS_FILE, 'w') as f:
        json.dump(progress, f, indent=2)

def normalize_name(name):
    """Normalize player name for matching"""
    import re
    # Remove suffixes and special characters
    name = re.sub(r'\s+(Jr\.?|Sr\.?|II|III|IV)$', '', name, flags=re.IGNORECASE)
    name = re.sub(r'[^\w\s-]', '', name)
    return name.lower().strip()

def name_similarity(name1, name2):
    """Calculate similarity between two names"""
    return SequenceMatcher(None, normalize_name(name1), normalize_name(name2)).ratio()

def get_team_roster(team_name, year=CURRENT_YEAR):
    """Fetch roster from College Football Data API"""
    try:
        # Map team name to API format
        api_team_name = TEAM_NAME_MAPPINGS.get(team_name, team_name)

        url = f"{API_BASE_URL}/roster"
        params = {
            'team': api_team_name,
            'year': year
        }

        headers = {
            'Accept': 'application/json'
        }

        response = requests.get(url, params=params, headers=headers, timeout=10)

        if response.status_code == 200:
            return response.json()
        elif response.status_code == 429:
            print(f"    ⚠ Rate limited, waiting 5 seconds...")
            time.sleep(5)
            return get_team_roster(team_name, year)
        else:
            return None

    except Exception as e:
        print(f"    Error fetching {team_name} roster: {e}")
        return None

def find_player_in_roster(roster_data, first_name, last_name):
    """Find a player in the roster data and extract their year"""
    if not roster_data:
        return None

    best_match = None
    best_score = 0

    for player in roster_data:
        # Try to match by first and last name
        api_first = normalize_name(player.get('first_name', ''))
        api_last = normalize_name(player.get('last_name', ''))
        search_first = normalize_name(first_name)
        search_last = normalize_name(last_name)

        # Calculate similarity scores
        first_score = name_similarity(first_name, player.get('first_name', ''))
        last_score = name_similarity(last_name, player.get('last_name', ''))
        total_score = (first_score + last_score) / 2

        # Require high similarity for both names
        if total_score > 0.85 and total_score > best_score:
            best_score = total_score
            best_match = player

    if best_match:
        year = best_match.get('year')
        # Map API year values to our format
        year_mapping = {
            1: 'Freshman',
            2: 'Sophomore',
            3: 'Junior',
            4: 'Senior',
            5: 'RS Senior',
            'FR': 'Freshman',
            'SO': 'Sophomore',
            'JR': 'Junior',
            'SR': 'Senior',
            'RS FR': 'RS Freshman',
            'RS SO': 'RS Sophomore',
            'RS JR': 'RS Junior',
            'RS SR': 'RS Senior',
        }

        return year_mapping.get(year, str(year))

    return None

def process_school_roster(school_name, players):
    """Process all players from a single school using the API"""
    print(f"\n  Fetching roster for {school_name} ({len(players)} players)...")

    roster_data = get_team_roster(school_name)

    if not roster_data:
        print(f"    ✗ Could not fetch roster from API")
        return {}

    print(f"    ✓ Retrieved {len(roster_data)} players from API")

    results = {}
    found_count = 0

    for player in players:
        first_name = player['First Name']
        last_name = player['Last Name']

        class_year = find_player_in_roster(roster_data, first_name, last_name)

        if class_year:
            player_key = f"{first_name}_{last_name}_{school_name}"
            results[player_key] = class_year
            found_count += 1

    print(f"    ✓ Found class years for {found_count}/{len(players)} players")
    time.sleep(DELAY_BETWEEN_REQUESTS)

    return results

def main():
    print("="*70)
    print("NFL DRAFT CLASS YEAR SCRAPER - API VERSION")
    print("="*70)

    # Load data
    with open(INPUT_FILE, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    print(f"\nTotal players in database: {len(rows)}")

    # Load progress
    progress = load_progress()

    print(f"Previously completed: {len(progress)} players")

    # Organize players by school
    college_players_by_school = defaultdict(list)
    hs_count = 0

    for row in rows:
        draft_class = row['Draft Class']

        # Handle high school players
        if draft_class == '2029':
            row['2025 College Year'] = 'HS Senior'
            hs_count += 1
        elif draft_class == '2030':
            row['2025 College Year'] = 'HS Junior'
            hs_count += 1
        elif draft_class == '2031':
            row['2025 College Year'] = 'HS Sophomore'
            hs_count += 1
        # College players
        elif draft_class in ['2026', '2027', '2028'] and row['College']:
            player_key = f"{row['First Name']}_{row['Last Name']}_{row['College']}"
            if player_key not in progress:
                college_players_by_school[row['College']].append(row)

    print(f"High school players filled: {hs_count}")
    print(f"Colleges to process: {len(college_players_by_school)}")
    print(f"College players to scrape: {sum(len(v) for v in college_players_by_school.values())}")

    # Process each school
    schools_processed = 0
    players_found = 0

    # Sort by number of players (most first) to process big schools first
    sorted_schools = sorted(
        college_players_by_school.keys(),
        key=lambda x: len(college_players_by_school[x]),
        reverse=True
    )

    for school_name in sorted_schools:
        schools_processed += 1
        players = college_players_by_school[school_name]

        print(f"\n[{schools_processed}/{len(college_players_by_school)}] Processing {school_name}...")

        # Get class years for this school
        school_results = process_school_roster(school_name, players)

        # Update progress
        progress.update(school_results)
        players_found += len(school_results)

        # Save progress every 10 schools
        if schools_processed % 10 == 0:
            save_progress(progress)
            print(f"\n  [Progress saved: {len(progress)} total players]")

    # Final save
    save_progress(progress)

    # Apply progress to rows
    updated_count = 0
    for row in rows:
        if row['Draft Class'] in ['2026', '2027', '2028'] and row['College']:
            player_key = f"{row['First Name']}_{row['Last Name']}_{row['College']}"
            if player_key in progress:
                row['2025 College Year'] = progress[player_key]
                updated_count += 1

    # Write output
    with open(OUTPUT_FILE, 'w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=rows[0].keys())
        writer.writeheader()
        writer.writerows(rows)

    # Final report
    print("\n" + "="*70)
    print("SCRAPING COMPLETE!")
    print("="*70)
    print(f"High school players: {hs_count}")
    print(f"College players found: {players_found}")
    print(f"Total updated: {updated_count + hs_count}")
    print(f"Not found: {2232 - players_found} college players")
    print(f"Output saved to: {OUTPUT_FILE}")
    print("="*70)

if __name__ == '__main__':
    main()
