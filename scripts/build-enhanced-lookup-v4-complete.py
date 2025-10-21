#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Enhanced Lookup Builder V4 - Complete Edition

Phase 1: Wikipedia scraping (fast, reliable)
- Draft tables (regular + supplemental + UDFA)
- Player pages (height, weight, hometown, image, pro bowls, all-pro)

Phase 2: Pro Football Reference enrichment (slower, needs Selenium)
- Career stats (From, To, AP1, PB, St, wAV)
- Draft table data as backup

Features:
- Incremental saving (every player saved immediately)
- Resume from any point
- Error-tolerant (individual player failures don't stop scraper)
- Pause/resume control
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
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException
import undetected_chromedriver as uc

# Fix Windows console encoding
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# Create session for Wikipedia
WIKI_SESSION = requests.Session()
WIKI_SESSION.headers.update({
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

# CSV Header
CSV_HEADER = [
    'Last Name', 'First Name', 'College/Univ', 'Round', 'Pick', 'Draft Class',
    'Position', 'PhotoID', 'Player Assets ID', 'CommID', 'PresID', 'PLPO',
    'Height', 'Weight', 'From', 'To', 'AP1', 'PB', 'St', 'wAV', 'League',
    'Race', 'Hometown', 'Wiki_Image_URL', 'PFR_Image_URL'
]

# Draft years - Complete NFL history
# NFL Draft started in 1936, AFL existed 1960-1969, merged in 1970
NFL_EARLY_YEARS = list(range(1936, 1960))  # 1936-1959 (pre-AFL)
AFL_YEARS = list(range(1960, 1970))         # 1960-1969 (AFL era)
NFL_MODERN_YEARS = list(range(1970, 2025))  # 1970-2024 (merged NFL)
ALL_YEARS = sorted(NFL_EARLY_YEARS + AFL_YEARS + NFL_MODERN_YEARS)

class ScraperStats:
    def __init__(self):
        self.start_time = datetime.now()
        self.players_processed = 0
        self.wiki_errors = 0
        self.pfr_errors = 0
        self.current_year = None
        self.current_player = None
        self.current_phase = 'Wikipedia'

    def update_progress_file(self):
        elapsed = datetime.now() - self.start_time
        rate = self.players_processed / elapsed.total_seconds() if elapsed.total_seconds() > 0 else 0

        with open(PROGRESS_FILE, 'w', encoding='utf-8') as f:
            f.write(f"=== Enhanced Lookup Scraper V4 (Complete) ===\n")
            f.write(f"Started: {self.start_time.strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write(f"Elapsed: {str(elapsed).split('.')[0]}\n")
            f.write(f"\nPhase: {self.current_phase}\n")
            f.write(f"Current Year: {self.current_year}\n")
            f.write(f"Current Player: {self.current_player}\n")
            f.write(f"\nPlayers Processed: {self.players_processed}\n")
            f.write(f"Wikipedia Errors: {self.wiki_errors}\n")
            f.write(f"PFR Errors: {self.pfr_errors}\n")
            f.write(f"\nRate: {rate:.2f} players/second\n")

            if rate > 0 and self.current_phase == 'Wikipedia':
                remaining = (25000 - self.players_processed) / rate
                f.write(f"Est. Time Remaining: {int(remaining // 3600)}h {int((remaining % 3600) // 60)}m\n")

            f.write(f"\nTo PAUSE: Create file {PAUSE_FILE}\n")
            f.write(f"Output: {OUTPUT_CSV}\n")

stats = ScraperStats()

def load_existing_lookup():
    """Load existing lookup for PID/PLPO mappings"""
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
    if CHECKPOINT_FILE.exists():
        with open(CHECKPOINT_FILE, 'r') as f:
            data = json.load(f)
            print(f"\n✓ RESUMING from checkpoint")
            print(f"  Last year: {data.get('last_year')}")
            print(f"  Phase: {data.get('phase', 'Wikipedia')}")
            print(f"  Players processed: {data.get('players_processed', 0)}")
            return data
    return None

def save_checkpoint(year, year_index, players_processed, phase='Wikipedia'):
    with open(CHECKPOINT_FILE, 'w') as f:
        json.dump({
            'last_year': year,
            'year_index': year_index,
            'players_processed': players_processed,
            'phase': phase,
            'timestamp': datetime.now().isoformat()
        }, f, indent=2)

def check_pause():
    if PAUSE_FILE.exists():
        print(f"\n⏸ PAUSE requested - stopping gracefully")
        print(f"  Processed {stats.players_processed} players")
        print(f"  To resume: delete {PAUSE_FILE} and restart script")
        stats.update_progress_file()
        return True
    return False

def scrape_wiki_draft_year(year):
    """Scrape draft data from Wikipedia including supplemental and UDFAs"""
    is_afl = year < 1970
    league = 'AFL' if is_afl else 'NFL'
    url = f'https://en.wikipedia.org/wiki/{year}_{league}_draft'

    print(f"\n[{league} {year}] Scraping Wikipedia...")

    try:
        response = WIKI_SESSION.get(url, timeout=15)
        response.raise_for_status()
    except Exception as e:
        print(f"  ✗ Failed to load page: {e}")
        stats.wiki_errors += 1
        return []

    soup = BeautifulSoup(response.text, 'html.parser')
    tables = soup.find_all('table', {'class': 'wikitable'})

    if not tables:
        print(f"  ✗ No draft tables found")
        stats.wiki_errors += 1
        return []

    players = []

    # Find supplemental draft section
    supplemental_header = soup.find(['h2', 'h3', 'h4'], string=re.compile(r'Supplemental', re.IGNORECASE))

    # Find undrafted section
    undrafted_header = soup.find(['h2', 'h3', 'h4'], string=re.compile(r'(Notable )?[Uu]ndrafted|UDFA', re.IGNORECASE))

    for table in tables:
        rows = table.find_all('tr')

        # Determine if this table is supplemental or UDFA
        is_supplemental = False
        is_udfa = False

        if supplemental_header:
            # Check if table comes after supplemental header
            for sibling in supplemental_header.next_siblings:
                if sibling == table:
                    is_supplemental = True
                    break
                if sibling.name in ['h2', 'h3', 'h4']:
                    break

        if undrafted_header:
            for sibling in undrafted_header.next_siblings:
                if sibling == table:
                    is_udfa = True
                    break
                if sibling.name in ['h2', 'h3', 'h4']:
                    break

        for row in rows[1:]:
            cells = row.find_all(['td', 'th'])
            if len(cells) < 4:
                continue

            try:
                # Wikipedia structure: [0]=empty, [1]=Rnd, [2]=Pick, [3]=Team, [4]=Player, [5]=Pos, [6]=College
                round_num = cells[1].get_text(strip=True) if len(cells) > 1 else ''
                pick = cells[2].get_text(strip=True) if len(cells) > 2 else ''
                player_name = cells[4].get_text(strip=True) if len(cells) > 4 else ''
                position = cells[5].get_text(strip=True) if len(cells) > 5 else ''
                college = cells[6].get_text(strip=True) if len(cells) > 6 else ''

                # Get Wikipedia link
                player_cell = cells[4] if len(cells) > 4 else None
                player_link_tag = player_cell.find('a', href=True) if player_cell else None
                player_link = player_link_tag['href'] if player_link_tag else None

                # Clean up
                player_name = re.sub(r'[†‡*]', '', player_name).strip()
                college = re.sub(r'\[.*?\]', '', college).strip()

                # Skip invalid entries
                if not player_name or player_name.lower() in ['player', 'name']:
                    continue

                # Skip rows with no meaningful player name (must have comma or space for Last, First format)
                if ',' not in player_name and ' ' not in player_name:
                    continue

                # Skip junk positions (must be valid football position abbreviation)
                valid_positions = ['QB', 'RB', 'FB', 'WR', 'TE', 'OT', 'OG', 'OL', 'C', 'G', 'T',
                                 'DE', 'DT', 'DL', 'NT', 'LB', 'ILB', 'OLB', 'MLB',
                                 'CB', 'S', 'FS', 'SS', 'DB', 'K', 'P', 'LS', 'KR', 'PR',
                                 'E', 'B', 'HB', 'FL']  # Include old-school positions

                # Clean position and check if it's valid
                position_clean = re.sub(r'[^A-Z]', '', position.upper())
                if not position_clean or position_clean not in valid_positions:
                    # Check if it contains any valid position
                    has_valid_pos = any(pos in position.upper() for pos in valid_positions)
                    if not has_valid_pos:
                        continue

                # Handle UDFA and supplemental
                if is_udfa:
                    round_num = 'UDFA'
                    pick = ''
                elif is_supplemental:
                    round_num = f"{re.sub(r'[^0-9]', '', round_num)}S" if round_num else 'S'
                else:
                    round_num = re.sub(r'[^0-9]', '', round_num)
                    pick = re.sub(r'[^0-9]', '', pick)

                if player_name and position:
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
    """Get height, weight, hometown, image, pro bowls, all-pro from Wikipedia"""
    if not wiki_link or not wiki_link.startswith('/wiki/'):
        return {}, []

    try:
        url = f'https://en.wikipedia.org{wiki_link}'
        response = WIKI_SESSION.get(url, timeout=10)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, 'html.parser')

        infobox = soup.find('table', {'class': re.compile(r'infobox', re.IGNORECASE)})
        if not infobox:
            return {}, []

        data = {
            'height': '',
            'weight': '',
            'hometown': '',
            'wiki_image': '',
            'pro_bowls': '',
            'all_pro': ''
        }

        # Get image
        img_tag = infobox.find('img')
        if img_tag and img_tag.get('src'):
            img_url = img_tag['src']
            if img_url.startswith('//'):
                img_url = 'https:' + img_url
            data['wiki_image'] = img_url

        # Parse infobox rows
        for row in infobox.find_all('tr'):
            header = row.find('th')
            if not header:
                continue

            header_text = header.get_text(strip=True).lower()
            data_cell = row.find('td')
            if not data_cell:
                continue

            # Height
            if 'height' in header_text:
                height_text = data_cell.get_text(strip=True)
                match = re.search(r'(\d+)\s*ft\s*(\d+)\s*in', height_text)
                if match:
                    data['height'] = f"{match.group(1)}-{match.group(2)}"

            # Weight
            if 'weight' in header_text:
                weight_text = data_cell.get_text(strip=True)
                match = re.search(r'(\d+)', weight_text)
                if match:
                    data['weight'] = match.group(1)

            # Hometown (Born)
            if 'born' in header_text:
                born_text = data_cell.get_text(strip=True)
                # Try to extract city, state
                match = re.search(r'([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),\s*([A-Z]{2}|[A-Za-z]+)', born_text)
                if match:
                    data['hometown'] = f"{match.group(1)}, {match.group(2)}"

            # Pro Bowls
            if 'pro bowl' in header_text:
                pb_text = data_cell.get_text(strip=True)
                match = re.search(r'(\d+)', pb_text)
                if match:
                    data['pro_bowls'] = match.group(1)

            # All-Pro
            if 'all-pro' in header_text or 'first-team' in header_text:
                ap_text = data_cell.get_text(strip=True)
                match = re.search(r'(\d+)', ap_text)
                if match:
                    data['all_pro'] = match.group(1)

        return data, []

    except Exception as e:
        stats.wiki_errors += 1
        return {}, []

def get_pfr_player_id(first_name, last_name):
    """Generate PFR player ID (e.g., MahoPa00)"""
    # PFR format: First 4 of last name + First 2 of first name + 00
    last_part = last_name[:4].ljust(4, 'x')
    first_part = first_name[:2].ljust(2, 'x')
    return f"{last_part}{first_part}00"

def get_pfr_career_stats(driver, first_name, last_name):
    """Get career stats from PFR using Selenium"""
    player_id = get_pfr_player_id(first_name, last_name)
    url = f"https://www.pro-football-reference.com/players/{last_name[0].upper()}/{player_id}.htm"

    try:
        driver.get(url)
        time.sleep(2)  # Give page time to load

        data = {
            'from_year': '',
            'to_year': '',
            'ap1': '',
            'pro_bowls': '',
            'starts': '',
            'wav': '',
            'pfr_image': ''
        }

        # Get headshot image
        try:
            img = driver.find_element(By.CSS_SELECTOR, 'img[src*="headshots"]')
            data['pfr_image'] = img.get_attribute('src')
        except:
            pass

        # Get career years from meta info
        try:
            meta = driver.find_element(By.ID, 'meta')
            meta_text = meta.text

            # Years played
            years_match = re.search(r'(\d{4})-(\d{4})', meta_text)
            if years_match:
                data['from_year'] = years_match.group(1)
                data['to_year'] = years_match.group(2)
        except:
            pass

        # Get stats from career stats table
        try:
            stats_table = driver.find_element(By.ID, 'stats')

            # AP1 (All-Pro 1st team)
            try:
                ap1_cells = stats_table.find_elements(By.XPATH, "//td[@data-stat='all_pros_first_team']")
                ap1_count = sum(1 for cell in ap1_cells if cell.text.strip())
                data['ap1'] = str(ap1_count) if ap1_count > 0 else ''
            except:
                pass

            # Pro Bowls
            try:
                pb_cells = stats_table.find_elements(By.XPATH, "//td[@data-stat='pro_bowls']")
                pb_count = sum(1 for cell in pb_cells if cell.text.strip())
                data['pro_bowls'] = str(pb_count) if pb_count > 0 else ''
            except:
                pass

            # Career stats (from career totals row)
            try:
                career_row = driver.find_element(By.ID, 'stats.totals_summary')

                # Starts
                starts_cell = career_row.find_element(By.XPATH, ".//td[@data-stat='gs']")
                data['starts'] = starts_cell.text.strip()

                # wAV
                wav_cell = career_row.find_element(By.XPATH, ".//td[@data-stat='av']")
                data['wav'] = wav_cell.text.strip()
            except:
                pass

        except:
            pass

        return data

    except Exception as e:
        stats.pfr_errors += 1
        return {}

def append_player_to_csv(player_data, wiki_info, pfr_info, existing_lookup):
    """Append player to CSV with all data"""
    name_parts = player_data['player_name'].split()
    first_name = name_parts[0] if name_parts else ''
    last_name = ' '.join(name_parts[1:]) if len(name_parts) > 1 else ''

    key = f"{last_name}|{first_name}|{player_data['draft_year']}|{player_data['position']}".lower()
    existing = existing_lookup.get(key, {})

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
        wiki_info.get('height', ''),
        wiki_info.get('weight', ''),
        pfr_info.get('from_year', ''),
        pfr_info.get('to_year', ''),
        pfr_info.get('ap1', '') or wiki_info.get('all_pro', ''),
        pfr_info.get('pro_bowls', '') or wiki_info.get('pro_bowls', ''),
        pfr_info.get('starts', ''),
        pfr_info.get('wav', ''),
        player_data['league'],
        '',  # Race (empty for now)
        wiki_info.get('hometown', ''),
        wiki_info.get('wiki_image', ''),
        pfr_info.get('pfr_image', '')
    ]

    file_exists = OUTPUT_CSV.exists()
    with open(OUTPUT_CSV, 'a', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        if not file_exists:
            writer.writerow(CSV_HEADER)
        writer.writerow(row)

    stats.players_processed += 1
    stats.current_player = player_data['player_name']

    if stats.players_processed % 50 == 0:
        stats.update_progress_file()
        print(f"  Progress: {stats.players_processed} players")

def main():
    print("=" * 80)
    print("Enhanced Lookup Builder V4 - Complete Edition")
    print("=" * 80)
    print(f"\nOutput: {OUTPUT_CSV}")
    print(f"Progress: {PROGRESS_FILE}")
    print(f"\nPhase 1: Wikipedia (draft data + player info)")
    print(f"Phase 2: Pro Football Reference (career stats)\n")
    print(f"To PAUSE: Create file {PAUSE_FILE}\n")

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    existing_lookup = load_existing_lookup()
    checkpoint = load_checkpoint()

    start_year_index = checkpoint['year_index'] + 1 if checkpoint else 0
    if checkpoint:
        stats.players_processed = checkpoint.get('players_processed', 0)
        stats.current_phase = checkpoint.get('phase', 'Wikipedia')

    # Selenium driver disabled - Wikipedia only mode for speed
    driver = None
    print("\n[WIKI-ONLY MODE] Skipping PFR scraping - user will handle separately")

    # Process each draft year
    for year_index in range(start_year_index, len(ALL_YEARS)):
        year = ALL_YEARS[year_index]
        stats.current_year = year
        stats.update_progress_file()

        if check_pause():
            if driver:
                driver.quit()
            return

        # PHASE 1: Wikipedia
        stats.current_phase = 'Wikipedia'
        players = scrape_wiki_draft_year(year)

        for player in players:
            if check_pause():
                if driver:
                    driver.quit()
                return

            # Get Wikipedia player info
            wiki_info = {}
            try:
                wiki_info, _ = get_player_info_from_wiki(player.get('wiki_link'))
                time.sleep(0.1)  # Be nice to Wikipedia
            except Exception as e:
                stats.wiki_errors += 1

            # PHASE 2: PFR enrichment - DISABLED (user will handle PFR separately)
            pfr_info = {}
            # Skipping PFR scraping for speed - user will add PFR data later

            # Save player
            append_player_to_csv(player, wiki_info, pfr_info, existing_lookup)

        save_checkpoint(year, year_index, stats.players_processed)
        time.sleep(1)

    # Complete
    if driver:
        driver.quit()

    print("\n" + "=" * 80)
    print("✓ SCRAPING COMPLETE!")
    print("=" * 80)
    print(f"Total Players: {stats.players_processed}")
    print(f"Wikipedia Errors: {stats.wiki_errors}")
    print(f"PFR Errors: {stats.pfr_errors}")
    print(f"Output: {OUTPUT_CSV}")
    print(f"\nElapsed: {datetime.now() - stats.start_time}")

    if CHECKPOINT_FILE.exists():
        CHECKPOINT_FILE.unlink()

    stats.update_progress_file()

if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print(f"\n\n⏸ Interrupted by user")
        print(f"  Processed {stats.players_processed} players")
        print(f"  Checkpoint saved - restart to resume")
        stats.update_progress_file()
    except Exception as e:
        print(f"\n\n✗ Fatal error: {e}")
        import traceback
        traceback.print_exc()
        print(f"\n  Processed {stats.players_processed} players before error")
        stats.update_progress_file()
