#!/usr/bin/env python3
"""
NFL Draft Class Year Scraper
This script scrapes official college rosters to fill in the actual class year for each player.
Designed to be run in Claude Code or similar environment with full network access.

Usage:
    python nfl_class_scraper.py

The script will:
1. Process high school players automatically (filling in grade levels)
2. For college players, fetch official roster pages and extract class years
3. Save progress regularly to avoid losing work
4. Generate a complete output CSV with all class years filled in
"""

import csv
import json
import time
import requests
from bs4 import BeautifulSoup
import re
from urllib.parse import quote_plus, urljoin
from collections import defaultdict

# Configuration
INPUT_FILE = './data/lookups/FutureDraft_Lookup.csv'
OUTPUT_FILE = './data/lookups/FutureDraft_Lookup_WITH_CLASSES.csv'
PROGRESS_FILE = 'scraping_progress.json'
ERRORS_FILE = 'scraping_errors.json'

# Rate limiting
DELAY_BETWEEN_REQUESTS = 1.5  # seconds
DELAY_BETWEEN_SEARCHES = 2.0  # seconds

# College-specific roster URL patterns
ROSTER_URL_PATTERNS = {
    'Alabama': 'https://rolltide.com/sports/football/roster',
    'Georgia': 'https://georgiadogs.com/sports/football/roster/2025',
    'LSU': 'https://lsusports.net/sports/football/roster/',
    'Ohio State': 'https://ohiostatebuckeyes.com/sports/m-footbl/roster/',
    'Michigan': 'https://mgoblue.com/sports/football/roster',
    'Texas': 'https://texassports.com/sports/football/roster',
    'USC': 'https://usctrojans.com/sports/football/roster',
    'Penn State': 'https://gopsusports.com/sports/football/roster',
    'Oregon': 'https://goducks.com/sports/football/roster',
    'Clemson': 'https://clemsontigers.com/sports/football/roster/',
    'Notre Dame': 'https://und.com/sports/football/roster/',
    'Auburn': 'https://auburntigers.com/sports/football/roster',
    'Florida': 'https://floridagators.com/sports/football/roster',
    'Miami (FL)': 'https://hurricanesports.com/sports/football/roster',
    'Oklahoma': 'https://soonersports.com/sports/football/roster',
    'Texas A&M': 'https://12thman.com/sports/football/roster',
    'Tennessee': 'https://utsports.com/sports/football/roster',
    'TCU': 'https://gofrogs.com/sports/football/roster',
    'Colorado': 'https://cubuffs.com/sports/football/roster',
    'Texas Tech': 'https://texastech.com/sports/football/roster',
    'Florida State': 'https://seminoles.com/sports/football/roster/',
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

def load_errors():
    """Load error log"""
    try:
        with open(ERRORS_FILE, 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        return []

def save_errors(errors):
    """Save error log"""
    with open(ERRORS_FILE, 'w') as f:
        json.dump(errors, f, indent=2)

def normalize_name(name):
    """Normalize player name for matching"""
    # Remove suffixes and special characters
    name = re.sub(r'\s+(Jr\.?|Sr\.?|II|III|IV)$', '', name, flags=re.IGNORECASE)
    name = re.sub(r'[^\w\s-]', '', name)
    return name.lower().strip()

def extract_class_from_roster_html(html_content, player_first, player_last):
    """Extract class year from roster HTML"""
    soup = BeautifulSoup(html_content, 'html.parser')

    # Normalize player name for searching
    search_first = normalize_name(player_first)
    search_last = normalize_name(player_last)

    # Class year patterns (from most to least specific)
    class_patterns = {
        'RS Senior': ['r-sr', 'rs sr', 'redshirt senior', 'r-5th', 'r-sr.'],
        'RS Junior': ['r-jr', 'rs jr', 'redshirt junior', 'r-jr.'],
        'RS Sophomore': ['r-so', 'rs so', 'redshirt sophomore', 'r-so.'],
        'RS Freshman': ['r-fr', 'rs fr', 'redshirt freshman', 'r-fr.'],
        'Senior': ['senior', 'sr', 'sr.', '5th'],
        'Junior': ['junior', 'jr', 'jr.'],
        'Sophomore': ['sophomore', 'so', 'so.'],
        'Freshman': ['freshman', 'fr', 'fr.'],
    }

    # Strategy 1: Find player in table rows
    for row in soup.find_all(['tr', 'div'], class_=re.compile(r'player|roster|athlete', re.I)):
        row_text = row.get_text().lower()

        # Check if this row contains our player
        if search_first in row_text and search_last in row_text:
            # Look for class year in this row
            for class_name, patterns in class_patterns.items():
                for pattern in patterns:
                    if pattern in row_text:
                        return class_name

    # Strategy 2: Look for player name followed by class info
    text = soup.get_text().lower()
    player_full = f"{search_first} {search_last}"
    player_alt = f"{search_last}, {search_first}"

    for search_pattern in [player_full, player_alt]:
        if search_pattern in text:
            # Get text around the player name (within 200 characters)
            idx = text.find(search_pattern)
            context = text[max(0, idx-50):min(len(text), idx+150)]

            # Check for class year in context
            for class_name, patterns in class_patterns.items():
                for pattern in patterns:
                    if pattern in context:
                        return class_name

    return None

def fetch_roster_for_school(school_name):
    """Fetch the roster page for a school"""
    try:
        # Check if we have a known URL
        if school_name in ROSTER_URL_PATTERNS:
            url = ROSTER_URL_PATTERNS[school_name]
        else:
            # Try to construct URL or search for it
            # Common patterns for official athletic sites
            school_domain = school_name.lower().replace(' ', '').replace('(', '').replace(')', '')
            possible_urls = [
                f"https://{school_domain}.com/sports/football/roster",
                f"https://go{school_domain}.com/sports/football/roster",
                f"https://{school_domain}sports.com/sports/football/roster",
            ]

            url = None
            for test_url in possible_urls:
                try:
                    resp = requests.head(test_url, timeout=5)
                    if resp.status_code == 200:
                        url = test_url
                        break
                except:
                    continue

        if not url:
            return None

        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }

        response = requests.get(url, headers=headers, timeout=15)
        response.raise_for_status()

        return response.text

    except Exception as e:
        print(f"    Error fetching {school_name} roster: {e}")
        return None

def process_school_roster(school_name, players):
    """Process all players from a single school"""
    print(f"\n  Fetching roster for {school_name} ({len(players)} players)...")

    roster_html = fetch_roster_for_school(school_name)

    if not roster_html:
        print(f"    ✗ Could not fetch roster")
        return {}

    results = {}
    found_count = 0

    for player in players:
        first_name = player['First Name']
        last_name = player['Last Name']

        class_year = extract_class_from_roster_html(roster_html, first_name, last_name)

        if class_year:
            player_key = f"{first_name}_{last_name}_{school_name}"
            results[player_key] = class_year
            found_count += 1

    print(f"    ✓ Found class years for {found_count}/{len(players)} players")
    time.sleep(DELAY_BETWEEN_REQUESTS)

    return results

def main():
    print("="*70)
    print("NFL DRAFT CLASS YEAR SCRAPER")
    print("="*70)

    # Load data
    with open(INPUT_FILE, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    print(f"\nTotal players in database: {len(rows)}")

    # Load progress
    progress = load_progress()
    errors = load_errors()

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

    for school_name in sorted(college_players_by_school.keys(), key=lambda x: len(college_players_by_school[x]), reverse=True):
        schools_processed += 1
        players = college_players_by_school[school_name]

        print(f"\n[{schools_processed}/{len(college_players_by_school)}] Processing {school_name}...")

        # Get class years for this school
        school_results = process_school_roster(school_name, players)

        # Update progress
        progress.update(school_results)
        players_found += len(school_results)

        # Save progress every 5 schools
        if schools_processed % 5 == 0:
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
    print(f"Output saved to: {OUTPUT_FILE}")
    print("="*70)

if __name__ == '__main__':
    main()
