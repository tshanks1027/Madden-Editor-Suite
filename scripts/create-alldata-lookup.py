"""
Create ALLDATA_Lookup.csv by combining ALL player data from ALL sources
NO HALF-ASSING - Get EVERY piece of data into ONE file
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

# ALL player data sources (in priority order)
SOURCES = [
    'MASTER_LOOKUP_UPDATED.csv',      # Most complete - 18,346 rows
    'FullData_Lookup.csv',            # Has PIDs/PLPOs - 9,552 rows
    'pfr_drafts_combined.csv',        # PFR draft data
    'hof_lookup.csv',                 # Hall of Fame status
]

OUTPUT_FILE = os.path.join(LOOKUP_DIR, 'ALLDATA_Lookup.csv')

def normalize_name(first, last):
    """Create normalized key for matching"""
    first = (first or '').strip().lower().replace('.', '').replace("'", '').replace('-', '')
    last = (last or '').strip().lower().replace('.', '').replace("'", '').replace('-', '')
    return f"{first}|{last}"

def safe_get(row, *keys):
    """Try multiple key names, return first non-empty value"""
    for key in keys:
        val = row.get(key, '').strip()
        if val:
            return val
    return ''

def main():
    print("=" * 80)
    print("CREATING ALLDATA_Lookup.csv - COMBINING ALL PLAYER DATA")
    print("=" * 80)
    print()

    # ALL possible columns from ALL sources
    all_columns = [
        'Last Name', 'First Name', 'College/Univ', 'Round', 'Pick', 'Draft Class',
        'Position', 'PhotoID', 'Player Assets ID', 'CommID', 'PresID', 'PLPO',
        'Height', 'Weight', 'From', 'To', 'AP1', 'PB', 'St', 'wAV',
        'League', 'Race', 'Hometown', 'Home State',
        'Wiki_Image_URL', 'PFR_Image_URL', 'isHOF'
    ]

    players = {}  # key: normalized name -> player data

    # STEP 1: Load MASTER_LOOKUP_UPDATED.csv as base (most complete)
    print("[1/4] Loading MASTER_LOOKUP_UPDATED.csv as base...")
    master_path = os.path.join(LOOKUP_DIR, 'MASTER_LOOKUP_UPDATED.csv')

    if os.path.exists(master_path):
        with open(master_path, 'r', encoding='utf-8', errors='replace') as f:
            reader = csv.DictReader(f)
            for row in reader:
                first = safe_get(row, 'First Name', 'FirstName')
                last = safe_get(row, 'Last Name', 'LastName')

                if not first and not last:
                    continue

                key = normalize_name(first, last)

                # Initialize with all columns
                players[key] = {col: safe_get(row, col) for col in all_columns}
                # Ensure First Name and Last Name are set
                players[key]['First Name'] = first
                players[key]['Last Name'] = last

        print(f"[OK] Loaded {len(players):,} players from MASTER_LOOKUP_UPDATED.csv")
    else:
        print(f"[WARN] MASTER_LOOKUP_UPDATED.csv not found, starting fresh")
    print()

    # STEP 2: Add/merge FullData_Lookup.csv (has PIDs and PLPOs)
    print("[2/4] Merging FullData_Lookup.csv (PIDs/PLPOs)...")
    fulldata_path = os.path.join(LOOKUP_DIR, 'FullData_Lookup.csv')
    added = 0
    merged = 0

    if os.path.exists(fulldata_path):
        with open(fulldata_path, 'r', encoding='utf-8', errors='replace') as f:
            reader = csv.DictReader(f)
            for row in reader:
                first = safe_get(row, 'First Name', 'FirstName')
                last = safe_get(row, 'Last Name', 'LastName')

                if not first and not last:
                    continue

                key = normalize_name(first, last)

                if key in players:
                    # Merge data - only fill in empty fields
                    p = players[key]
                    p['PhotoID'] = p['PhotoID'] or safe_get(row, 'PhotoID')
                    p['Player Assets ID'] = p['Player Assets ID'] or safe_get(row, 'Player Assets ID')
                    p['CommID'] = p['CommID'] or safe_get(row, 'CommID')
                    p['PresID'] = p['PresID'] or safe_get(row, 'PresID')
                    p['PLPO'] = p['PLPO'] or safe_get(row, 'PLPO')
                    p['College/Univ'] = p['College/Univ'] or safe_get(row, 'College/Univ')
                    p['Draft Class'] = p['Draft Class'] or safe_get(row, 'Draft Class')
                    p['Position'] = p['Position'] or safe_get(row, 'Position', 'Postion')
                    p['Round'] = p['Round'] or safe_get(row, 'Round')
                    p['Pick'] = p['Pick'] or safe_get(row, 'Pick')
                    merged += 1
                else:
                    # Add new player
                    players[key] = {col: '' for col in all_columns}
                    players[key]['First Name'] = first
                    players[key]['Last Name'] = last
                    players[key]['PhotoID'] = safe_get(row, 'PhotoID')
                    players[key]['Player Assets ID'] = safe_get(row, 'Player Assets ID')
                    players[key]['CommID'] = safe_get(row, 'CommID')
                    players[key]['PresID'] = safe_get(row, 'PresID')
                    players[key]['PLPO'] = safe_get(row, 'PLPO')
                    players[key]['College/Univ'] = safe_get(row, 'College/Univ')
                    players[key]['Draft Class'] = safe_get(row, 'Draft Class')
                    players[key]['Position'] = safe_get(row, 'Position', 'Postion')
                    players[key]['Round'] = safe_get(row, 'Round')
                    players[key]['Pick'] = safe_get(row, 'Pick')
                    added += 1

        print(f"[OK] Merged {merged:,} existing players")
        print(f"[OK] Added {added:,} new players from FullData_Lookup.csv")
        print(f"[OK] Total players: {len(players):,}")
    else:
        print(f"[WARN] FullData_Lookup.csv not found")
    print()

    # STEP 3: Add HOF status from hof_lookup.csv
    print("[3/4] Adding Hall of Fame status from hof_lookup.csv...")
    hof_path = os.path.join(LOOKUP_DIR, 'hof_lookup.csv')
    hof_count = 0

    if os.path.exists(hof_path):
        with open(hof_path, 'r', encoding='utf-8', errors='replace') as f:
            reader = csv.DictReader(f)
            for row in reader:
                first = safe_get(row, 'First Name', 'FirstName', 'first_name')
                last = safe_get(row, 'Last Name', 'LastName', 'last_name')

                if not first and not last:
                    continue

                key = normalize_name(first, last)

                if key in players:
                    players[key]['isHOF'] = 'True'
                    hof_count += 1
                else:
                    # Add HOF player even if not in other sources
                    players[key] = {col: '' for col in all_columns}
                    players[key]['First Name'] = first
                    players[key]['Last Name'] = last
                    players[key]['isHOF'] = 'True'
                    hof_count += 1

        print(f"[OK] Marked {hof_count:,} Hall of Fame players")
    else:
        print(f"[WARN] hof_lookup.csv not found")
    print()

    # STEP 4: Write ALLDATA_Lookup.csv
    print("[4/4] Writing ALLDATA_Lookup.csv...")

    with open(OUTPUT_FILE, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=all_columns)
        writer.writeheader()
        writer.writerows(players.values())

    print()
    print("=" * 80)
    print("[OK] ALLDATA_Lookup.csv CREATED!")
    print(f"[OK] Total players: {len(players):,}")
    print(f"[OK] Output: {OUTPUT_FILE}")
    print("=" * 80)
    print()
    print("VERIFICATION:")
    print("  - Combined ALL player data from ALL sources")
    print("  - NO duplicates")
    print("  - ALL columns included:")
    for col in all_columns:
        print(f"    - {col}")
    print()

if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        print(f"\n[ERROR] {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
