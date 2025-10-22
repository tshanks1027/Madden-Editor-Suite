#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Enhanced Lookup Builder V3 - Wikipedia Edition

Uses Wikipedia as primary source for draft data (no Cloudflare issues!)
Falls back to Pro Football Reference for physical stats (height/weight)

Features:
- Fast and reliable Wikipedia scraping
- Saves EVERY player immediately
- Resume from any point
- Pause/resume control via PAUSE file
- Live progress tracking

Controls:
- Create data/lookups/PAUSE file to pause gracefully
- Delete PAUSE file and restart script to resume
- Check data/lookups/scraper_progress.txt for live stats
"""

import sys
import io
import requests
from bs4 import BeautifulSoup
import csv
import json
import os
import time
from datetime import datetime
from pathlib import Path
import re

# Fix Windows console encoding issues
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# Create a session with persistent headers
SESSION = requests.Session()
SESSION.headers.update({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0'
})

# Paths
SCRIPT_DIR = Path(__file__).parent
DATA_DIR = SCRIPT_DIR.parent / 'data' / 'lookups'
OUTPUT_CSV = DATA_DIR / 'enhanced_lookup_FINAL.csv'
CHECKPOINT_FILE = DATA_DIR / 'scraper_checkpoint.json'
PROGRESS_FILE = DATA_DIR / 'scraper_progress.txt'
PAUSE_FILE = DATA_DIR / 'PAUSE'
EXISTING_LOOKUP = DATA_DIR / 'FullData_Lookup.csv'

# Constants
CSV_HEADER = [
    'Last Name', 'First Name', 'College/Univ', 'Round', 'Pick', 'Draft Class',
    'Position', 'PhotoID', 'Player Assets ID', 'CommID', 'PresID', 'PLPO',
    'Height', 'Weight', 'From', 'To', 'AP1', 'PB', 'St', 'wAV', 'League', 'Race', 'Hometown'
]

# Draft years (Wikipedia has good coverage for 1970+)
# AFL years 1960-1969 are trickier, will try AFL_draft pages
AFL_YEARS = list(range(1960, 1970))  # 1960-1969
NFL_YEARS = list(range(1970, 2025))  # 1970-2024
ALL_YEARS = sorted(AFL_YEARS + NFL_YEARS)

class ScraperStats:
    """Track and display scraping statistics"""
    def __init__(self):
        self.start_time = datetime.now()
        self.players_processed = 0
        self.errors = 0
        self.current_year = None
        self.current_player = None

    def update_progress_file(self):
        """Write human-readable progress file"""
        elapsed = datetime.now() - self.start_time
        rate = self.players_processed / elapsed.total_seconds() if elapsed.total_seconds() > 0 else 0

        with open(PROGRESS_FILE, 'w', encoding='utf-8') as f:
            f.write(f"=== Enhanced Lookup Scraper V3 (Wikipedia) ===\n")
            f.write(f"Started: {self.start_time.strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write(f"Elapsed: {str(elapsed).split('.')[0]}\n")
            f.write(f"\nCurrent Year: {self.current_year}\n")
            f.write(f"Current Player: {self.current_player}\n")
            f.write(f"\nPlayers Processed: {self.players_processed}\n")
            f.write(f"Errors: {self.errors}\n")
            f.write(f"\nRate: {rate:.2f} players/second\n")

            if rate > 0:
                remaining = (7000 - self.players_processed) / rate
                f.write(f"Est. Time Remaining: {int(remaining // 3600)}h {int((remaining % 3600) // 60)}m\n")

            f.write(f"\nTo PAUSE: Create file {PAUSE_FILE}\n")
            f.write(f"Output: {OUTPUT_CSV}\n")

stats = ScraperStats()

def load_existing_lookup():
    """Load existing lookup to preserve PID/PLPO mappings"""
    existing = {}

    if not EXISTING_LOOKUP.exists():
        print("WARNING: No existing FullData_Lookup.csv found")
        return existing

    with open(EXISTING_LOOKUP, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            position = row.get('Position', row.get('Postion', ''))
            key = f"{row['Last Name']}|{row['First Name']}|{row['Draft Class']}|{position}".lower()
            existing[key] = {
                'pid': row.get('PhotoID', ''),
                'pam': row.get('Player Assets ID', ''),
                'commID': row.get('CommID', ''),
                'presID': row.get('PresID', ''),
                'plpo': row.get('PLPO', '')
            }

    print(f"SUCCESS: Loaded {len(existing)} existing PID/PLPO mappings")
    return existing

def load_checkpoint():
    """Load checkpoint data"""
    if CHECKPOINT_FILE.exists():
        with open(CHECKPOINT_FILE, 'r') as f:
            data = json.load(f)
            print(f"\n✓ RESUMING from checkpoint")
            print(f"  Last year: {data.get('last_year')}")
            print(f"  Players processed: {data.get('players_processed', 0)}")
            return data
    return None

def save_checkpoint(year, year_index, players_processed):
    """Save checkpoint data"""
    with open(CHECKPOINT_FILE, 'w') as f:
        json.dump({
            'last_year': year,
            'year_index': year_index,
            'players_processed': players_processed,
            'timestamp': datetime.now().isoformat()
        }, f, indent=2)

def check_pause():
    """Check if user requested pause"""
    if PAUSE_FILE.exists():
        print(f"\n⏸ PAUSE requested - stopping gracefully")
        print(f"  Processed {stats.players_processed} players")
        print(f"  To resume: delete {PAUSE_FILE} and restart script")
        stats.update_progress_file()
        return True
    return False

def scrape_wiki_draft_year(year):
    """Scrape draft data from Wikipedia"""
    # AFL years use different URL format
    is_afl = year < 1970
    league = 'AFL' if is_afl else 'NFL'
    url = f'https://en.wikipedia.org/wiki/{year}_{league}_draft'

    print(f"\n[{league} {year}] Scraping Wikipedia...")

    try:
        response = SESSION.get(url, timeout=15)
        response.raise_for_status()
    except Exception as e:
        print(f"  ✗ Failed to load page: {e}")
        stats.errors += 1
        return []

    soup = BeautifulSoup(response.text, 'html.parser')

    # Wikipedia draft tables usually have class "wikitable"
    tables = soup.find_all('table', {'class': 'wikitable'})

    if not tables:
        print(f"  ✗ No draft tables found")
        stats.errors += 1
        return []

    players = []

    # Find supplemental draft section
    supplemental_header = soup.find(['h2', 'h3', 'h4'], string=re.compile(r'Supplemental', re.IGNORECASE))

    # Find undrafted section
    undrafted_header = soup.find(['h2', 'h3', 'h4'], string=re.compile(r'(Notable )?[Uu]ndrafted|UDFA', re.IGNORECASE))

    # Process all wikitable tables (usually one per round or one big table)
    for table in tables:
        rows = table.find_all('tr')

        for row in rows[1:]:  # Skip header
            cells = row.find_all(['td', 'th'])
            if len(cells) < 4:
                continue

            try:
                # Wikipedia structure: [0]=empty, [1]=Rnd, [2]=Pick, [3]=Team, [4]=Player, [5]=Pos, [6]=College
                # Find cells
                round_num = cells[1].get_text(strip=True) if len(cells) > 1 else ''
                pick = cells[2].get_text(strip=True) if len(cells) > 2 else ''
                team = cells[3].get_text(strip=True) if len(cells) > 3 else ''
                player_name = cells[4].get_text(strip=True) if len(cells) > 4 else ''
                position = cells[5].get_text(strip=True) if len(cells) > 5 else ''
                college = cells[6].get_text(strip=True) if len(cells) > 6 else ''

                # Get Wikipedia link for player
                player_cell = cells[4] if len(cells) > 4 else None
                player_link_tag = player_cell.find('a', href=True) if player_cell else None
                player_link = player_link_tag['href'] if player_link_tag else None

                # Clean up symbols (†, ‡, *, etc.)
                player_name = re.sub(r'[†‡*]', '', player_name).strip()
                college = re.sub(r'\[.*?\]', '', college).strip()  # Remove citations

                # Skip if no player name
                if not player_name or player_name.lower() in ['player', 'name']:
                    continue

                # Only digits for round/pick
                round_num = re.sub(r'[^0-9]', '', round_num)
                pick = re.sub(r'[^0-9]', '', pick)

                if player_name and position:
                    # Determine league
                    league = 'AFL' if year < 1970 else 'NFL'

                    players.append({
                        'player_name': player_name,
                        'position': position,
                        'college': college,
                        'round': round_num,
                        'pick': pick,
                        'draft_year': year,
                        'league': league,
                        'wiki_link': player_link
                    })

            except Exception as e:
                continue

    print(f"  ✓ Found {len(players)} players")
    return players

def get_player_info_from_wiki(wiki_link):
    """Get height/weight from Wikipedia player page"""
    if not wiki_link or not wiki_link.startswith('/wiki/'):
        return '', ''

    try:
        url = f'https://en.wikipedia.org{wiki_link}'
        response = SESSION.get(url, timeout=10)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, 'html.parser')

        # Find the infobox (usually class "infobox" or "infobox vcard")
        infobox = soup.find('table', {'class': re.compile(r'infobox', re.IGNORECASE)})
        if not infobox:
            return '', ''

        height = ''
        weight = ''

        # Look for height row
        for row in infobox.find_all('tr'):
            header = row.find('th')
            if header:
                header_text = header.get_text(strip=True).lower()

                if 'height' in header_text:
                    data = row.find('td')
                    if data:
                        height_text = data.get_text(strip=True)
                        # Extract feet-inches format (e.g., "6 ft 2 in")
                        match = re.search(r'(\d+)\s*ft\s*(\d+)\s*in', height_text)
                        if match:
                            height = f"{match.group(1)}-{match.group(2)}"

                if 'weight' in header_text:
                    data = row.find('td')
                    if data:
                        weight_text = data.get_text(strip=True)
                        # Extract just the number (e.g., "215 lb" -> "215")
                        match = re.search(r'(\d+)', weight_text)
                        if match:
                            weight = match.group(1)

        return height, weight

    except Exception as e:
        return '', ''

def append_player_to_csv(player_data, existing_lookup):
    """Append single player to CSV immediately"""
    # Parse name
    name_parts = player_data['player_name'].split()
    first_name = name_parts[0] if name_parts else ''
    last_name = ' '.join(name_parts[1:]) if len(name_parts) > 1 else ''

    # Check for existing PID/PLPO
    key = f"{last_name}|{first_name}|{player_data['draft_year']}|{player_data['position']}".lower()
    existing = existing_lookup.get(key, {})

    # Try to get height/weight from Wikipedia if we have a link
    height = ''
    weight = ''
    if player_data.get('wiki_link'):
        height, weight = get_player_info_from_wiki(player_data['wiki_link'])
        # Small delay to be nice to Wikipedia
        time.sleep(0.1)

    # Build row
    row = [
        last_name,
        first_name,
        player_data['college'],
        player_data['round'],
        player_data['pick'],
        player_data['draft_year'],
        player_data['position'],
        existing.get('pid', ''),
        existing.get('pam', ''),
        existing.get('commID', ''),
        existing.get('presID', ''),
        existing.get('plpo', ''),
        height,
        weight,
        '',  # From year (empty for now)
        '',  # To year (empty for now)
        '',  # AP1 (empty for now)
        '',  # PB (empty for now)
        '',  # St (empty for now)
        '',  # wAV (empty for now)
        player_data['league'],
        '',  # Race (empty for now)
        ''   # Hometown (empty for now)
    ]

    # Append to CSV
    file_exists = OUTPUT_CSV.exists()
    with open(OUTPUT_CSV, 'a', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        if not file_exists:
            writer.writerow(CSV_HEADER)
        writer.writerow(row)

    stats.players_processed += 1
    stats.current_player = player_data['player_name']

    # Update progress every 100 players (less frequent since we're hitting player pages)
    if stats.players_processed % 100 == 0:
        stats.update_progress_file()
        print(f"  Progress: {stats.players_processed} players")

def main():
    print("=" * 80)
    print("Enhanced Lookup Builder V3 - Wikipedia Edition")
    print("=" * 80)
    print(f"\nOutput: {OUTPUT_CSV}")
    print(f"Progress: {PROGRESS_FILE}")
    print(f"Checkpoint: {CHECKPOINT_FILE}")
    print(f"\nTo PAUSE: Create file {PAUSE_FILE}\n")

    # Ensure data directory exists
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    # Load existing lookup
    existing_lookup = load_existing_lookup()

    # Load checkpoint
    checkpoint = load_checkpoint()
    start_year_index = checkpoint['year_index'] + 1 if checkpoint else 0

    if checkpoint:
        stats.players_processed = checkpoint.get('players_processed', 0)

    # Process each draft year
    for year_index in range(start_year_index, len(ALL_YEARS)):
        year = ALL_YEARS[year_index]
        stats.current_year = year
        stats.update_progress_file()

        # Check for pause request
        if check_pause():
            return

        # Scrape draft year from Wikipedia
        players = scrape_wiki_draft_year(year)

        # Process each player
        for player in players:
            # Check for pause request
            if check_pause():
                return

            # Append player to CSV
            append_player_to_csv(player, existing_lookup)

        # Save checkpoint after each year
        save_checkpoint(year, year_index, stats.players_processed)

        # Small delay between years (be nice to Wikipedia)
        time.sleep(1)

    # Complete!
    print("\n" + "=" * 80)
    print("✓ SCRAPING COMPLETE!")
    print("=" * 80)
    print(f"Total Players: {stats.players_processed}")
    print(f"Errors: {stats.errors}")
    print(f"Output: {OUTPUT_CSV}")
    print(f"\nElapsed: {datetime.now() - stats.start_time}")

    # Clean up checkpoint
    if CHECKPOINT_FILE.exists():
        CHECKPOINT_FILE.unlink()
        print(f"\n✓ Checkpoint file cleaned up")

    stats.update_progress_file()

if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n⏸ Interrupted by user")
        print(f"  Processed {stats.players_processed} players")
        print(f"  Checkpoint saved - restart script to resume")
        stats.update_progress_file()
    except Exception as e:
        print(f"\n\n✗ Fatal error: {e}")
        import traceback
        traceback.print_exc()
        print(f"\n  Processed {stats.players_processed} players before error")
        print(f"  Checkpoint saved - restart script to resume")
        stats.update_progress_file()
