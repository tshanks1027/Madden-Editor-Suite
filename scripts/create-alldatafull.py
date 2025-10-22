#!/usr/bin/env python3
"""
Process EVERY LINE from EVERY lookup file to create ALLDATAFULL.csv

Requirements:
- Every player from 1936-2025 (drafted AND UDFA)
- Fix naming errors (e.g., "Franklin" first, "BradBrad Franklin" last)
- Fix state in hometown
- Map positions to M26
- Mark UFAs as "UD" in pick/round
- Correct HOF tags
- Include PAM and PID info
"""

import csv
import os
import re
from collections import OrderedDict

base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
data_dir = os.path.join(base_dir, 'data', 'lookups')

# Define standard column order for output
OUTPUT_COLUMNS = [
    'Last Name', 'First Name', 'College/Univ', 'Round', 'Pick', 'Draft Class',
    'Position', 'PhotoID', 'Player Assets ID', 'CommID', 'PresID', 'PLPO',
    'Height', 'Weight', 'From', 'To', 'AP1', 'PB', 'St', 'wAV', 'League',
    'Race', 'Hometown', 'Home State', 'Wiki_Image_URL', 'PFR_Image_URL', 'isHOF'
]

# Player data files to process (EVERY player lookup)
PLAYER_FILES = [
    'MASTER_LOOKUP_COMPLETE_WITH_DUPES.csv',
    'MASTER_LOOKUP_COMPLETE.csv',
    'MASTER_LOOKUP_UPDATED.csv',
    'MASTER_LOOKUP_WITH_PIDS.csv',
    'MASTER_LOOKUP_FINAL_BACKUP.csv',
    'MASTER_LOOKUP.csv',
    'enhanced_lookup_complete.csv',
    'enhanced_lookup_FINAL.csv',
    'enhanced_lookup_with_PAM.csv',
    'FullData_Lookup.csv',
    'FullData_Lookup_Enhanced.csv',
    'pfr_drafts_combined.csv',
    'Players_lookup.csv',
    'FINAL_MASTER_LOOKUP.csv'
]

# Load HOF data for correct tagging
def load_hof_players():
    """Load HOF players from hof_lookup.csv"""
    hof_set = set()
    hof_file = os.path.join(data_dir, 'hof_lookup.csv')
    if os.path.exists(hof_file):
        with open(hof_file, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                # Normalize name for matching
                name = f"{row.get('PlayerName', '')}".strip().lower()
                hof_set.add(name)
    print(f"Loaded {len(hof_set)} HOF players")
    return hof_set

# Load US states for hometown validation
US_STATES = {
    'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
    'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
    'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
    'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
    'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
}

def fix_name_parsing(first, last):
    """Fix name parsing errors like 'Franklin' first, 'BradBrad Franklin' last"""
    first = (first or '').strip()
    last = (last or '').strip()

    # Check if last name contains duplicate pattern (e.g., "BradBrad Franklin")
    # Pattern: word repeated + space + actual last name
    match = re.match(r'^(\w+)\1\s+(\w+)$', last)
    if match:
        # Fix: actual last name is the second part
        actual_last = match.group(2)
        # First name was probably in the duplicate part
        actual_first = match.group(1)
        print(f"  FIX: '{first}' '{last}' -> '{actual_first}' '{actual_last}'")
        return actual_first, actual_last

    return first, last

def fix_hometown_state(hometown, state):
    """Separate city from state if state is in hometown field"""
    hometown = (hometown or '').strip()
    state = (state or '').strip()

    # If hometown contains ", XX" pattern and state is empty
    if ',' in hometown and not state:
        parts = hometown.rsplit(',', 1)
        city = parts[0].strip()
        potential_state = parts[1].strip()

        # Check if it's a valid state abbreviation
        if potential_state in US_STATES:
            print(f"  FIX: Hometown '{hometown}' -> City='{city}', State='{potential_state}'")
            return city, potential_state

    return hometown, state

def normalize_position(pos):
    """Map position to M26 standard"""
    pos = (pos or '').strip().upper()

    # Position mappings
    mapping = {
        'C': 'C',
        'CB': 'CB',
        'DB': 'CB',  # DB -> CB
        'DE': 'LEDG',  # DE -> LEDG or REDG (pick left for now)
        'DT': 'DT',
        'FB': 'FB',
        'FS': 'FS',
        'G': 'LG',  # G -> LG or RG
        'HB': 'HB',
        'K': 'K',
        'LB': 'MLB',  # LB -> MLB
        'OT': 'LT',  # OT -> LT or RT
        'P': 'P',
        'QB': 'QB',
        'RB': 'HB',  # RB -> HB
        'S': 'SS',  # S -> SS or FS
        'T': 'LT',  # T -> LT or RT
        'TE': 'TE',
        'WR': 'WR'
    }

    return mapping.get(pos, pos)

def fix_ufa_markers(round_val, pick_val, draft_class):
    """Mark UFAs with 'UD' in round and pick"""
    draft_class = (draft_class or '').strip()

    # If no round/pick but has draft class, mark as UD
    if not round_val and not pick_val and draft_class:
        return 'UD', 'UD'

    # If explicitly marked as undrafted
    if str(round_val).upper() in ['UD', 'UDFA', 'FA', '']:
        return 'UD', 'UD'

    return round_val, pick_val

def is_hof_player(first, last, hof_set):
    """Check if player is in Hall of Fame"""
    full_name = f"{first} {last}".strip().lower()
    return full_name in hof_set

def create_unique_key(row):
    """Create unique key to identify distinct players"""
    # Use: Last Name + First Name + Draft Year + Position
    last = (row.get('Last Name', '') or '').strip().lower()
    first = (row.get('First Name', '') or '').strip().lower()
    draft = (row.get('Draft Class', '') or str(row.get('DraftYear', '')) or '').strip()
    pos = (row.get('Position', '') or '').strip().upper()

    # Clean draft year
    draft = re.sub(r'[^\d]', '', draft)  # Keep only digits

    return f"{last}|{first}|{draft}|{pos}"

def merge_row_data(existing, new):
    """Merge data from new row into existing, preferring non-empty values"""
    for key in OUTPUT_COLUMNS:
        # If existing doesn't have this field or it's empty, use new value
        if key not in existing or not existing[key]:
            if key in new and new[key]:
                existing[key] = new[key]

    return existing

# Main processing
print("=" * 80)
print("PROCESSING ALL LOOKUP FILES")
print("=" * 80)

# Load HOF players
hof_players = load_hof_players()

# Track all players
all_players = OrderedDict()  # key -> row data
processed_files = 0
total_lines = 0

# Process each file
for filename in PLAYER_FILES:
    filepath = os.path.join(data_dir, filename)

    if not os.path.exists(filepath):
        print(f"\nSKIP: {filename} (not found)")
        continue

    print(f"\n{'='*60}")
    print(f"Processing: {filename}")
    print(f"{'='*60}")

    try:
        with open(filepath, 'r', encoding='utf-8', errors='replace') as f:
            # Try to read as CSV
            sample = f.read(1024)
            f.seek(0)

            # Detect delimiter
            sniffer = csv.Sniffer()
            try:
                dialect = sniffer.sniff(sample)
                delimiter = dialect.delimiter
            except:
                delimiter = ','

            reader = csv.DictReader(f, delimiter=delimiter)
            file_count = 0

            for row in reader:
                total_lines += 1

                # Normalize column names
                normalized_row = {}
                for key, value in row.items():
                    # Map common variations to standard names
                    key_lower = (key or '').lower().strip()

                    if key_lower in ['last name', 'lastname', 'last']:
                        normalized_row['Last Name'] = value
                    elif key_lower in ['first name', 'firstname', 'first']:
                        normalized_row['First Name'] = value
                    elif key_lower in ['college/univ', 'college', 'coll']:
                        normalized_row['College/Univ'] = value
                    elif key_lower in ['round', 'rnd']:
                        normalized_row['Round'] = value
                    elif key_lower in ['pick', 'pk']:
                        normalized_row['Pick'] = value
                    elif key_lower in ['draft class', 'draftclass', 'draftyear', 'year']:
                        normalized_row['Draft Class'] = value
                    elif key_lower in ['position', 'pos', 'ppos']:
                        normalized_row['Position'] = value
                    elif key_lower in ['photoid', 'pid']:
                        normalized_row['PhotoID'] = value
                    elif key_lower in ['player assets id', 'pam']:
                        normalized_row['Player Assets ID'] = value
                    elif key_lower == 'plpo':
                        normalized_row['PLPO'] = value
                    elif key_lower in ['height', 'hgt']:
                        normalized_row['Height'] = value
                    elif key_lower in ['weight', 'wgt']:
                        normalized_row['Weight'] = value
                    elif key_lower == 'from':
                        normalized_row['From'] = value
                    elif key_lower == 'to':
                        normalized_row['To'] = value
                    elif key_lower == 'ap1':
                        normalized_row['AP1'] = value
                    elif key_lower == 'pb':
                        normalized_row['PB'] = value
                    elif key_lower == 'st':
                        normalized_row['St'] = value
                    elif key_lower == 'wav':
                        normalized_row['wAV'] = value
                    elif key_lower == 'league':
                        normalized_row['League'] = value
                    elif key_lower == 'race':
                        normalized_row['Race'] = value
                    elif key_lower in ['hometown', 'city']:
                        normalized_row['Hometown'] = value
                    elif key_lower in ['home state', 'state', 'birthstate']:
                        normalized_row['Home State'] = value
                    elif key_lower == 'wiki_image_url':
                        normalized_row['Wiki_Image_URL'] = value
                    elif key_lower == 'pfr_image_url':
                        normalized_row['PFR_Image_URL'] = value
                    elif key_lower in ['ishof', 'hof']:
                        normalized_row['isHOF'] = value
                    elif key_lower == 'commid':
                        normalized_row['CommID'] = value
                    elif key_lower == 'presid':
                        normalized_row['PresID'] = value

                # Skip if no name
                if not normalized_row.get('Last Name') and not normalized_row.get('First Name'):
                    continue

                # Apply fixes
                first, last = fix_name_parsing(
                    normalized_row.get('First Name', ''),
                    normalized_row.get('Last Name', '')
                )
                normalized_row['First Name'] = first
                normalized_row['Last Name'] = last

                # Fix hometown/state
                hometown, state = fix_hometown_state(
                    normalized_row.get('Hometown', ''),
                    normalized_row.get('Home State', '')
                )
                normalized_row['Hometown'] = hometown
                normalized_row['Home State'] = state

                # Normalize position
                normalized_row['Position'] = normalize_position(normalized_row.get('Position', ''))

                # Fix UFA markers
                round_val, pick_val = fix_ufa_markers(
                    normalized_row.get('Round', ''),
                    normalized_row.get('Pick', ''),
                    normalized_row.get('Draft Class', '')
                )
                normalized_row['Round'] = round_val
                normalized_row['Pick'] = pick_val

                # Check HOF status
                if is_hof_player(first, last, hof_players):
                    normalized_row['isHOF'] = 'True'
                elif 'isHOF' not in normalized_row or not normalized_row['isHOF']:
                    normalized_row['isHOF'] = 'False'

                # Create unique key
                key = create_unique_key(normalized_row)

                # Add or merge
                if key in all_players:
                    all_players[key] = merge_row_data(all_players[key], normalized_row)
                else:
                    # Fill in all columns
                    for col in OUTPUT_COLUMNS:
                        if col not in normalized_row:
                            normalized_row[col] = ''
                    all_players[key] = normalized_row
                    file_count += 1

            print(f"  Added {file_count} new players from {filename}")
            processed_files += 1

    except Exception as e:
        print(f"  ERROR processing {filename}: {e}")

print(f"\n{'='*80}")
print(f"SUMMARY")
print(f"{'='*80}")
print(f"Processed {processed_files} files")
print(f"Read {total_lines} total lines")
print(f"Found {len(all_players)} unique players")

# Write output
output_file = os.path.join(data_dir, 'ALLDATAFULL.csv')
print(f"\nWriting to {output_file}...")

with open(output_file, 'w', newline='', encoding='utf-8') as f:
    writer = csv.DictWriter(f, fieldnames=OUTPUT_COLUMNS)
    writer.writeheader()
    writer.writerows(all_players.values())

print(f"Done! Created ALLDATAFULL.csv with {len(all_players)} players")

# Verify key players
print(f"\nVerifying key players:")
for key, row in all_players.items():
    if 'bradshaw' in row['Last Name'].lower() and 'terry' in row['First Name'].lower():
        print(f"  Terry Bradshaw: isHOF={row['isHOF']}, PID={row.get('PhotoID', 'N/A')}")
        break
