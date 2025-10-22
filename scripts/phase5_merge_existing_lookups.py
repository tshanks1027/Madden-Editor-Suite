#!/usr/bin/env python3
"""
Phase 5: Merge Existing Lookup Data

Takes Phase 1 drafted players and merges in PIDs, PLPOs, and other data
from existing lookup CSVs.

Input: phase1_drafted_players.csv
Output: phase5_with_pids.csv
"""

import pandas as pd
import os
from pathlib import Path

# Paths
base_dir = Path(__file__).parent.parent
lookups_dir = base_dir / "data" / "lookups"

phase1_file = lookups_dir / "phase1_drafted_players.csv"
output_file = lookups_dir / "phase5_with_pids.csv"

# Existing lookup files (from template notes)
LOOKUP_FILES = [
    'PID_lookup.csv',
    'PID_Portrait_Mapping.csv',
    'FullData_Lookup.csv',
    'MASTER_LOOKUP.csv',
    'MASTER_LOOKUP_COMPLETE.csv'
]

def normalize_name_key(first, last):
    """
    Create normalized key for name matching.
    Handles variations like "T.J." vs "TJ", "O'Brien" vs "OBrien"
    """
    first = str(first).lower().strip()
    last = str(last).lower().strip()

    # Remove common punctuation
    for char in ['.', "'", '-', ' ']:
        first = first.replace(char, '')
        last = last.replace(char, '')

    return f"{first}|{last}"

def load_existing_lookups():
    """Load all existing lookup files and create name-based index"""
    print("\nLoading existing lookup files...")

    lookup_data = {}

    for filename in LOOKUP_FILES:
        filepath = lookups_dir / filename
        if not filepath.exists():
            print(f"  SKIP: {filename} (not found)")
            continue

        try:
            df = pd.read_csv(filepath, encoding='utf-8', low_memory=False)

            # Check for required name columns
            name_cols = []
            if 'First Name' in df.columns and 'Last Name' in df.columns:
                name_cols = ['First Name', 'Last Name']
            elif 'FirstName' in df.columns and 'LastName' in df.columns:
                name_cols = ['FirstName', 'LastName']
            elif 'first_name' in df.columns and 'last_name' in df.columns:
                name_cols = ['first_name', 'last_name']

            if not name_cols:
                print(f"  SKIP: {filename} (no name columns)")
                continue

            # Index by normalized name
            for _, row in df.iterrows():
                first = row.get(name_cols[0], '')
                last = row.get(name_cols[1], '')

                if pd.isna(first) or pd.isna(last):
                    continue

                key = normalize_name_key(first, last)

                # Store row data if we don't have this player yet, or merge
                if key not in lookup_data:
                    lookup_data[key] = {}

                # Merge data - prefer non-empty values
                for col in df.columns:
                    value = row.get(col, '')
                    if pd.notna(value) and value != '':
                        # Only update if current value is empty
                        if col not in lookup_data[key] or lookup_data[key][col] == '':
                            lookup_data[key][col] = value

            print(f"  OK: {filename} ({len(df)} rows)")

        except Exception as e:
            print(f"  ERROR: {filename} - {e}")

    print(f"\nIndexed {len(lookup_data)} unique players from existing lookups")
    return lookup_data

def merge_lookup_data(phase1_df, lookup_data):
    """Merge existing lookup data into Phase 1 data"""
    print("\nMerging lookup data...")

    # Fields to merge (if they exist in lookup data)
    merge_fields = [
        'PhotoID', 'Player Assets ID', 'CommID', 'PLPO',
        'Height', 'Weight', 'Race', 'Home State',
        'Wiki_Image_URL', 'PFR_Image_URL'
    ]

    merged_count = 0

    for idx, row in phase1_df.iterrows():
        first = row['First Name']
        last = row['Last Name']
        key = normalize_name_key(first, last)

        if key in lookup_data:
            player_data = lookup_data[key]
            has_data = False

            for field in merge_fields:
                # Check various column name formats
                possible_names = [
                    field,
                    field.replace(' ', ''),
                    field.replace(' ', '_').lower(),
                    field.lower()
                ]

                for col_name in possible_names:
                    if col_name in player_data:
                        value = player_data[col_name]
                        if pd.notna(value) and value != '':
                            # Only update if Phase 1 value is empty
                            if pd.isna(row[field]) or row[field] == '':
                                phase1_df.at[idx, field] = value
                                has_data = True
                        break

            if has_data:
                merged_count += 1

    print(f"  Merged data for {merged_count} players")
    return phase1_df

def main():
    print("="*80)
    print("PHASE 5: MERGE EXISTING LOOKUP DATA")
    print("="*80)

    # Load Phase 1 data
    print(f"\nLoading Phase 1 data: {phase1_file}")
    df = pd.read_csv(phase1_file, encoding='utf-8')
    print(f"  Loaded {len(df)} players")

    # Load existing lookups
    lookup_data = load_existing_lookups()

    # Merge data
    df = merge_lookup_data(df, lookup_data)

    # Save output
    print(f"\nSaving to: {output_file}")
    df.to_csv(output_file, index=False, encoding='utf-8')

    # Stats
    print("\n" + "="*80)
    print("SUMMARY")
    print("="*80)
    print(f"Total players: {len(df)}")

    # Check coverage
    fields_to_check = ['PhotoID', 'Player Assets ID', 'PLPO', 'Height', 'Weight']
    for field in fields_to_check:
        filled = df[field].notna() & (df[field] != '')
        count = filled.sum()
        pct = (count / len(df)) * 100
        print(f"  {field}: {count} ({pct:.1f}% coverage)")

    # Sample check
    print("\nSample player with PIDs:")
    sample = df[(df['PhotoID'].notna()) & (df['PhotoID'] != '')].head(1)
    if not sample.empty:
        s = sample.iloc[0]
        print(f"  {s['First Name']} {s['Last Name']} ({s['Draft Class']})")
        print(f"    PhotoID: {s['PhotoID']}")
        print(f"    Player Assets ID: {s['Player Assets ID']}")
        print(f"    PLPO: {s['PLPO']}")

    print("\nDone!")

if __name__ == '__main__':
    main()
