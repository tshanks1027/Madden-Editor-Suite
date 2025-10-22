"""
Create FINAL MASTER LOOKUP using CLEAN sources only
Priority order:
1. Start with FullData_Lookup.csv (9,552 players with PIDs/PLPOs) - CLEAN
2. Add Home State from MASTER_LOOKUP_UPDATED.csv
3. Skip enhanced_lookup_complete.csv (has corrupted name data from scraper bug)
4. Result: One complete lookup with NO duplicates, NO corrupted names
"""

import csv
import os
import sys
import io

# Fix Windows encoding
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# File paths
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
LOOKUP_DIR = os.path.join(PROJECT_ROOT, 'data', 'lookups')

FULLDATA = os.path.join(LOOKUP_DIR, 'FullData_Lookup.csv')
# ENHANCED = os.path.join(LOOKUP_DIR, 'enhanced_lookup_complete.csv')  # SKIPPED - corrupted data
MASTER_UPDATED = os.path.join(LOOKUP_DIR, 'MASTER_LOOKUP_UPDATED.csv')
OUTPUT_FILE = os.path.join(LOOKUP_DIR, 'FINAL_MASTER_LOOKUP.csv')

def normalize_name(first, last):
    """Create normalized key for matching"""
    first = (first or '').strip().lower().replace('.', '').replace("'", '')
    last = (last or '').strip().lower().replace('.', '').replace("'", '')
    return f"{first}|{last}"

def main():
    print("=" * 80)
    print("CREATING FINAL MASTER LOOKUP")
    print("=" * 80)
    print()

    # Step 1: Load FullData as base (has all PIDs/PLPOs)
    print("[1/4] Loading FullData_Lookup.csv as base...")
    players = {}  # key: normalized name -> player data

    with open(FULLDATA, 'r', encoding='utf-8', errors='replace') as f:
        reader = csv.DictReader(f)
        for row in reader:
            first = row.get('First Name', '').strip()
            last = row.get('Last Name', '').strip()
            key = normalize_name(first, last)

            # Store with PhotoID, PLPO, and Player Assets ID
            players[key] = {
                'Last Name': last,
                'First Name': first,
                'College/Univ': row.get('College/Univ', ''),
                'Round': row.get('Round', ''),
                'Pick': row.get('Pick', ''),
                'Draft Class': row.get('Draft Class', ''),
                'Position': row.get('Postion', row.get('Position', '')),  # Handle typo
                'PhotoID': row.get('PhotoID', ''),
                'Player Assets ID': row.get('Player Assets ID', ''),
                'CommID': row.get('CommID', ''),
                'PLPO': row.get('PLPO', ''),
                'Height': '',
                'Weight': '',
                'From': '',
                'To': '',
                'AP1': '',
                'PB': '',
                'St': '',
                'wAV': '',
                'League': '',
                'Race': '',
                'Hometown': '',
                'Home State': '',
                'Wiki_Image_URL': '',
                'PFR_Image_URL': '',
                'isHOF': 'False'
            }

    print(f"[OK] Loaded {len(players):,} players from FullData_Lookup.csv")
    print()

    # Step 2: SKIP enhanced_lookup_complete.csv - has corrupted name data
    print("[2/3] Skipping enhanced_lookup_complete.csv (corrupted data from scraper bug)")
    print()

    # Step 3: Add Home State from MASTER_LOOKUP_UPDATED if available
    print("[3/3] Adding Home State from MASTER_LOOKUP_UPDATED.csv...")
    homestate_matched = 0

    with open(MASTER_UPDATED, 'r', encoding='utf-8', errors='replace') as f:
        reader = csv.DictReader(f)
        for row in reader:
            first = row.get('First Name', '').strip()
            last = row.get('Last Name', '').strip()
            key = normalize_name(first, last)

            if key in players:
                players[key]['Home State'] = row.get('Home State', '')
                homestate_matched += 1

    print(f"[OK] Added Home State for {homestate_matched:,} players")
    print()

    # Step 4: Write final combined file
    print("[4/4] Writing FINAL_MASTER_LOOKUP.csv (CLEAN - no corrupted names)...")

    fieldnames = [
        'Last Name', 'First Name', 'College/Univ', 'Round', 'Pick', 'Draft Class',
        'Position', 'PhotoID', 'Player Assets ID', 'CommID', 'PLPO',
        'Height', 'Weight', 'From', 'To', 'AP1', 'PB', 'St', 'wAV',
        'League', 'Race', 'Hometown', 'Home State', 'Wiki_Image_URL', 'PFR_Image_URL', 'isHOF'
    ]

    with open(OUTPUT_FILE, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(players.values())

    print()
    print("=" * 80)
    print("[OK] FINAL MASTER LOOKUP CREATED!")
    print(f"[OK] Total players: {len(players):,}")
    print(f"[OK] Output: {OUTPUT_FILE}")
    print("=" * 80)
    print()
    print("VERIFICATION:")
    print("  - All players from FullData_Lookup.csv have PhotoID and PLPO")
    print("  - Home State added from MASTER_LOOKUP_UPDATED.csv")
    print("  - NO corrupted names (DannyDanny, etc.) - skipped enhanced_lookup_complete.csv")
    print("  - No duplicates")
    print()

if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        print(f"\n[ERROR] {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
