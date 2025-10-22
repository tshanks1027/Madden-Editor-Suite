"""
Populate PhotoID column in MASTER_LOOKUP_FINAL.csv using PID_lookup.csv
Matches player names from MASTER_LOOKUP to PIDs from PID_lookup
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

MASTER_LOOKUP = os.path.join(LOOKUP_DIR, 'MASTER_LOOKUP_FINAL.csv')
PID_LOOKUP = os.path.join(LOOKUP_DIR, 'PID_lookup.csv')
OUTPUT_FILE = os.path.join(LOOKUP_DIR, 'MASTER_LOOKUP_WITH_PIDS.csv')
BACKUP_FILE = os.path.join(LOOKUP_DIR, 'MASTER_LOOKUP_FINAL_BACKUP.csv')

def normalize_name(name):
    """Normalize player name for matching"""
    return name.strip().lower().replace('.', '').replace("'", '')

def load_pid_lookup():
    """Load PID lookup into memory: normalized name -> PID"""
    pid_map = {}

    with open(PID_LOOKUP, 'r', encoding='utf-8', errors='replace') as f:
        reader = csv.DictReader(f)
        for row in reader:
            pid = row.get('PSXP', '').strip()
            player_name = row.get('Player Pic', '').strip()

            if pid and player_name and pid.isdigit():
                # Remove (R) tag if present
                player_name = player_name.replace('(R)', '').strip()
                normalized = normalize_name(player_name)

                # Store PID (prefer non-(R) versions by overwriting)
                if normalized not in pid_map or '(R)' not in row.get('Player Pic', ''):
                    pid_map[normalized] = int(pid)

    print(f"[OK] Loaded {len(pid_map)} PIDs from PID_lookup.csv")
    return pid_map

def main():
    print("=" * 80)
    print("POPULATE PHOTO IDs IN MASTER LOOKUP")
    print("=" * 80)
    print()

    # Load PID lookup
    print("[1/4] Loading PID lookup...")
    pid_map = load_pid_lookup()
    print()

    # Backup original file
    print("[2/4] Creating backup...")
    import shutil
    shutil.copy(MASTER_LOOKUP, BACKUP_FILE)
    print(f"[OK] Backup saved: {BACKUP_FILE}")
    print()

    # Process MASTER_LOOKUP
    print("[3/4] Matching players to PIDs...")
    matched = 0
    unmatched = 0
    updated_rows = []

    with open(MASTER_LOOKUP, 'r', encoding='utf-8', errors='replace') as f:
        reader = csv.DictReader(f)
        fieldnames = reader.fieldnames

        for row in reader:
            first_name = row.get('First Name', '').strip()
            last_name = row.get('Last Name', '').strip()

            if not first_name and not last_name:
                # Skip empty rows
                updated_rows.append(row)
                continue

            # Try to match player name
            full_name = f"{first_name} {last_name}".strip()
            normalized = normalize_name(full_name)

            if normalized in pid_map:
                row['PhotoID'] = str(pid_map[normalized])
                matched += 1

                if matched <= 10:
                    print(f"  [MATCH] {full_name} -> PID {pid_map[normalized]}")
            else:
                # No match - leave PhotoID empty
                row['PhotoID'] = ''
                unmatched += 1

                if unmatched <= 5:
                    print(f"  [NO MATCH] {full_name}")

            updated_rows.append(row)

    if matched > 10:
        print(f"  ... and {matched - 10} more matches")
    if unmatched > 5:
        print(f"  ... and {unmatched - 5} more unmatched")

    print()
    print(f"[OK] Matched {matched:,} players")
    print(f"[OK] Unmatched {unmatched:,} players")
    print()

    # Write updated file
    print("[4/4] Writing updated lookup file...")
    with open(OUTPUT_FILE, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(updated_rows)

    print()
    print("=" * 80)
    print(f"[OK] PhotoID population complete!")
    print(f"[OK] Matched: {matched:,} players")
    print(f"[OK] Unmatched: {unmatched:,} players")
    print(f"[OK] Total players: {len(updated_rows):,}")
    print()
    print(f"[OK] Output: {OUTPUT_FILE}")
    print(f"[OK] Backup: {BACKUP_FILE}")
    print("=" * 80)
    print()
    print("NEXT STEP: Review the output file, then replace MASTER_LOOKUP_FINAL.csv:")
    print(f"  copy \"{OUTPUT_FILE}\" \"{MASTER_LOOKUP}\"")
    print()

if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        print(f"\n[ERROR] {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
