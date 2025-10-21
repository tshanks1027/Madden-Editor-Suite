"""
Combine Enhanced Lookup and UFA data into final MASTER_LOOKUP
- Split Hometown into Hometown and Home State
- Add isHOF flag using HOF lookup
- Remove PresID column
- Combine both files
"""

import csv
import os
import sys
import io
import re

# Fix Windows encoding issues
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# File paths
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
LOOKUP_DIR = os.path.join(PROJECT_ROOT, 'data', 'lookups')

ENHANCED_LOOKUP = os.path.join(LOOKUP_DIR, 'enhanced_lookup_FINAL.csv')
UFA_LOOKUP = os.path.join(PROJECT_ROOT, '..', 'undrafted_players_complete.csv')
HOF_LOOKUP = os.path.join(LOOKUP_DIR, 'hof_lookup.csv')
OUTPUT_FILE = os.path.join(LOOKUP_DIR, 'MASTER_LOOKUP_COMPLETE.csv')

def load_hof_players(hof_file):
    """Load HOF player names into a set for quick lookup"""
    hof_players = set()

    if not os.path.exists(hof_file):
        print(f"Warning: HOF lookup not found at {hof_file}")
        return hof_players

    with open(hof_file, 'r', encoding='utf-8', errors='replace') as f:
        reader = csv.DictReader(f)
        for row in reader:
            player_name = row.get('PlayerName', '').strip()
            if player_name:
                hof_players.add(player_name.lower())

    print(f"[OK] Loaded {len(hof_players)} Hall of Fame players")
    return hof_players

def split_hometown(hometown):
    """
    Split hometown into city and state
    Formats handled:
    - "City, State"
    - "City, State Abbreviation"
    - Just "City" (return empty state)
    """
    if not hometown or hometown.strip() == '':
        return '', ''

    hometown = hometown.strip()

    # Pattern: "City, State" or "City, XX"
    if ',' in hometown:
        parts = hometown.split(',', 1)
        city = parts[0].strip()
        state = parts[1].strip() if len(parts) > 1 else ''
        return city, state
    else:
        # No comma, assume it's just a city
        return hometown, ''

def normalize_name(first, last):
    """Create normalized name for HOF matching: FirstName LastName"""
    first = (first or '').strip()
    last = (last or '').strip()
    return f"{first} {last}".strip().lower()

def process_csv_file(input_file, hof_players, writer, stats):
    """Process a CSV file and write cleaned rows"""

    if not os.path.exists(input_file):
        print(f"Warning: File not found: {input_file}")
        return

    with open(input_file, 'r', encoding='utf-8', errors='replace') as f:
        reader = csv.DictReader(f)

        for row in reader:
            # Skip empty rows
            if not row.get('Last Name') and not row.get('First Name'):
                continue

            # Split Hometown into Hometown and Home State
            hometown_full = row.get('Hometown', '')
            city, state = split_hometown(hometown_full)

            # Check if player is HOF
            player_name = normalize_name(row.get('First Name'), row.get('Last Name'))
            is_hof = player_name in hof_players

            if is_hof:
                stats['hof_found'] += 1
                print(f"  [HOF] {row.get('First Name')} {row.get('Last Name')}")

            # Build output row (without PresID, with split hometown)
            output_row = {
                'Last Name': row.get('Last Name', ''),
                'First Name': row.get('First Name', ''),
                'College/Univ': row.get('College/Univ', ''),
                'Round': row.get('Round', ''),
                'Pick': row.get('Pick', ''),
                'Draft Class': row.get('Draft Class', ''),
                'Position': row.get('Position', ''),
                'PhotoID': row.get('PhotoID', ''),
                'Player Assets ID': row.get('Player Assets ID', ''),
                'CommID': row.get('CommID', ''),
                'PLPO': row.get('PLPO', ''),
                'Height': row.get('Height', ''),
                'Weight': row.get('Weight', ''),
                'From': row.get('From', ''),
                'To': row.get('To', ''),
                'AP1': row.get('AP1', ''),
                'PB': row.get('PB', ''),
                'St': row.get('St', ''),
                'wAV': row.get('wAV', ''),
                'League': row.get('League', ''),
                'Race': row.get('Race', ''),
                'Hometown': city,
                'Home State': state,
                'Wiki_Image_URL': row.get('Wiki_Image_URL', ''),
                'PFR_Image_URL': row.get('PFR_Image_URL', ''),
                'isHOF': 'True' if is_hof else 'False'
            }

            writer.writerow(output_row)
            stats['total_players'] += 1

def main():
    print("=" * 80)
    print("MASTER LOOKUP COMBINER")
    print("=" * 80)
    print()

    # Load HOF players
    print("[1/3] Loading Hall of Fame players...")
    hof_players = load_hof_players(HOF_LOOKUP)
    print()

    # Prepare output file
    print("[2/3] Processing and combining CSV files...")
    stats = {
        'total_players': 0,
        'hof_found': 0
    }

    fieldnames = [
        'Last Name', 'First Name', 'College/Univ', 'Round', 'Pick', 'Draft Class',
        'Position', 'PhotoID', 'Player Assets ID', 'CommID', 'PLPO',
        'Height', 'Weight', 'From', 'To', 'AP1', 'PB', 'St', 'wAV',
        'League', 'Race', 'Hometown', 'Home State', 'Wiki_Image_URL', 'PFR_Image_URL', 'isHOF'
    ]

    with open(OUTPUT_FILE, 'w', newline='', encoding='utf-8') as outfile:
        writer = csv.DictWriter(outfile, fieldnames=fieldnames)
        writer.writeheader()

        # Process enhanced lookup (drafted players)
        print("\nProcessing drafted players...")
        process_csv_file(ENHANCED_LOOKUP, hof_players, writer, stats)

        # Process UFA lookup (undrafted players)
        print("\nProcessing undrafted free agents...")
        process_csv_file(UFA_LOOKUP, hof_players, writer, stats)

    print()
    print("[3/3] Complete!")
    print("=" * 80)
    print(f"[OK] Total Players: {stats['total_players']:,}")
    print(f"[OK] Hall of Famers: {stats['hof_found']}")
    print(f"[OK] Output: {OUTPUT_FILE}")
    print("=" * 80)
    print()
    print("Changes made:")
    print("  1. [OK] Split 'Hometown' into 'Hometown' and 'Home State'")
    print("  2. [OK] Added 'isHOF' column using HOF lookup")
    print("  3. [OK] Removed 'PresID' column")
    print("  4. [OK] Combined drafted + undrafted players")
    print()

if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        print(f"\n[ERROR] {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
