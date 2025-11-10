"""
Fix Historical Roster Duplicates

Removes same-year duplicate entries from ROSTER_lookup_historical.csv

CRITICAL SAFETY:
- Only removes duplicates where Year + Team + Player_Name are IDENTICAL
- Preserves multi-year careers (Tom Brady 2000-2023 all kept)
- Keeps row with POVR > 0, deletes row with POVR = 0

Example:
  KEEP: 2005 Aaron Rodgers, OVR=75
  DELETE: 2005 Aaron Rodgers, OVR=0 (same year duplicate)
  KEEP: 2006 Aaron Rodgers, OVR=76 (different year)
  KEEP: 2007 Aaron Rodgers, OVR=78 (different year)
"""

import pandas as pd
import sys
from pathlib import Path

# Unbuffered output
sys.stdout.reconfigure(line_buffering=True)
sys.stderr.reconfigure(line_buffering=True)

# Paths
BASE_DIR = Path('.')
LOOKUPS_DIR = BASE_DIR / 'data' / 'lookups'

INPUT_FILE = LOOKUPS_DIR / 'ROSTER_lookup_historical.csv'
OUTPUT_FILE = LOOKUPS_DIR / 'ROSTER_lookup_historical.csv'
BACKUP_FILE = LOOKUPS_DIR / 'ROSTER_lookup_historical_BACKUP.csv'

def main():
    print("="*80)
    print("REMOVING SAME-YEAR DUPLICATES FROM HISTORICAL ROSTER")
    print("="*80)
    print()

    # Load roster
    print(f"Loading {INPUT_FILE}...")
    roster_df = pd.read_csv(INPUT_FILE)
    print(f"  Loaded {len(roster_df)} rows")
    print()

    # Create backup
    print(f"Creating backup at {BACKUP_FILE}...")
    roster_df.to_csv(BACKUP_FILE, index=False)
    print("  Backup created")
    print()

    # Identify duplicates
    print("Identifying same-year duplicates...")
    print("  Grouping by: Year + Team + Player_Name")

    # Add a composite key for grouping
    roster_df['_key'] = (roster_df['Year'].astype(str) + '_' +
                         roster_df['Season_Team'].astype(str) + '_' +
                         roster_df['Player_Name'].astype(str))

    # Find groups with duplicates
    duplicate_groups = roster_df.groupby('_key').filter(lambda x: len(x) > 1)
    n_duplicate_rows = len(duplicate_groups)
    n_duplicate_groups = duplicate_groups['_key'].nunique()

    print(f"  Found {n_duplicate_rows} duplicate rows in {n_duplicate_groups} groups")
    print()

    if n_duplicate_rows == 0:
        print("No duplicates found! File is clean.")
        return 0

    # Show samples
    print("Sample duplicate groups:")
    print("-" * 80)
    for key in duplicate_groups['_key'].unique()[:5]:
        group = roster_df[roster_df['_key'] == key]
        for idx, row in group.iterrows():
            print(f"  {row['Year']} {row['Season_Team']} {row['Player_Name']} - OVR={row['POVR']}")
        print()

    # Remove duplicates
    print("="*80)
    print("REMOVING DUPLICATES")
    print("="*80)
    print()

    rows_to_keep = []
    rows_to_delete = []

    for key, group in roster_df.groupby('_key'):
        if len(group) == 1:
            # No duplicate, keep it
            rows_to_keep.extend(group.index.tolist())
        else:
            # Duplicate found
            # Keep row with POVR > 0, or first row if all are 0
            valid_rows = group[group['POVR'] > 0]

            if len(valid_rows) > 0:
                # Keep first row with POVR > 0
                rows_to_keep.append(valid_rows.index[0])
                # Delete all others
                rows_to_delete.extend([idx for idx in group.index if idx != valid_rows.index[0]])
            else:
                # All rows have POVR = 0, keep first
                rows_to_keep.append(group.index[0])
                # Delete all others
                rows_to_delete.extend(group.index[1:].tolist())

    print(f"Rows to keep: {len(rows_to_keep)}")
    print(f"Rows to delete: {len(rows_to_delete)}")
    print()

    # Create clean dataframe
    clean_df = roster_df.loc[rows_to_keep].copy()

    # Drop the temporary key column
    clean_df = clean_df.drop(columns=['_key'])

    # Verify multi-year players preserved
    print("="*80)
    print("VERIFICATION: Multi-Year Players")
    print("="*80)
    print()

    # Check a few known multi-year players
    test_players = ['Tom Brady', 'Peyton Manning', 'Brett Favre', 'Jerry Rice']

    for player_name in test_players:
        player_years = clean_df[clean_df['Player_Name'] == player_name]['Year'].unique()
        if len(player_years) > 0:
            print(f"{player_name}: {len(player_years)} years ({player_years.min()}-{player_years.max()})")

    print()

    # Summary
    print("="*80)
    print("DEDUPLICATION COMPLETE")
    print("="*80)
    print()

    print(f"Original rows: {len(roster_df)}")
    print(f"Cleaned rows: {len(clean_df)}")
    print(f"Rows removed: {len(roster_df) - len(clean_df)}")
    print()

    # Save
    print(f"Saving cleaned roster to {OUTPUT_FILE}...")
    clean_df.to_csv(OUTPUT_FILE, index=False)
    print("  Saved successfully")
    print()

    print(f"Backup of original file: {BACKUP_FILE}")
    print()
    print("Next step: Run fix-rookie-ratings.py to apply year-by-year rating calculation")

    return 0

if __name__ == '__main__':
    sys.exit(main())
