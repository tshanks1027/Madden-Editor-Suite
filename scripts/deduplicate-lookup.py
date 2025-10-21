"""
Remove duplicate player entries from MASTER_LOOKUP_COMPLETE.csv
Keeps the first occurrence of each unique player+year combination
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

INPUT_FILE = os.path.join(LOOKUP_DIR, 'MASTER_LOOKUP_COMPLETE.csv')
OUTPUT_FILE = os.path.join(LOOKUP_DIR, 'MASTER_LOOKUP_FINAL.csv')
BACKUP_FILE = os.path.join(LOOKUP_DIR, 'MASTER_LOOKUP_COMPLETE_WITH_DUPES.csv')

def main():
    print("=" * 80)
    print("MASTER LOOKUP DEDUPLICATOR")
    print("=" * 80)
    print()

    # Backup original file
    if os.path.exists(INPUT_FILE):
        print(f"[1/3] Creating backup...")
        import shutil
        shutil.copy(INPUT_FILE, BACKUP_FILE)
        print(f"[OK] Backup saved: {BACKUP_FILE}")
        print()

    # Read and deduplicate
    print("[2/3] Deduplicating entries...")
    seen = set()
    unique_rows = []
    duplicates_removed = 0
    total_processed = 0

    with open(INPUT_FILE, 'r', encoding='utf-8', errors='replace') as f:
        reader = csv.DictReader(f)
        fieldnames = reader.fieldnames

        for row in reader:
            total_processed += 1

            # Create unique key from player name + draft year
            first_name = row.get('First Name', '').strip()
            last_name = row.get('Last Name', '').strip()
            draft_year = row.get('Draft Class', '').strip()
            round_num = row.get('Round', '').strip()
            pick_num = row.get('Pick', '').strip()

            # Key: "FirstName LastName,DraftYear,Round,Pick"
            # This allows same player in different years (e.g., supplemental draft)
            # But removes exact duplicates
            unique_key = f"{first_name}|{last_name}|{draft_year}|{round_num}|{pick_num}".lower()

            if unique_key not in seen:
                seen.add(unique_key)
                unique_rows.append(row)
            else:
                duplicates_removed += 1
                if duplicates_removed <= 10:
                    print(f"  [DUPLICATE] {first_name} {last_name} ({draft_year} - R{round_num} P{pick_num})")

    if duplicates_removed > 10:
        print(f"  ... and {duplicates_removed - 10} more duplicates")

    print()
    print(f"[OK] Processed {total_processed:,} rows")
    print(f"[OK] Removed {duplicates_removed:,} duplicates")
    print(f"[OK] Kept {len(unique_rows):,} unique players")
    print()

    # Write deduplicated file
    print("[3/3] Writing deduplicated file...")
    with open(OUTPUT_FILE, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(unique_rows)

    print()
    print("=" * 80)
    print(f"[OK] Deduplication complete!")
    print(f"[OK] Original entries: {total_processed:,}")
    print(f"[OK] Final entries: {len(unique_rows):,}")
    print(f"[OK] Duplicates removed: {duplicates_removed:,}")
    print()
    print(f"[OK] Output: {OUTPUT_FILE}")
    print(f"[OK] Backup: {BACKUP_FILE}")
    print("=" * 80)

if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        print(f"\n[ERROR] {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
