"""
Populate missing PIDs in ALL_PLAYER_LOOKUP.csv from PID_Portrait_Mapping.csv

Strategy:
1. Load both CSVs
2. For each row in ALL_PLAYER_LOOKUP with missing PID:
   - Search PID_Portrait_Mapping for matching name
   - Handle Jr/II/III/IV variations
   - Fill in the PID
"""

import pandas as pd
import re
from pathlib import Path

ALL_PLAYER_LOOKUP = Path(r'C:\Users\tshan\Documents\Dev\madden-editor-suite\data\lookups\ALL_PLAYER_LOOKUP.csv')
PID_PORTRAIT = Path(r'C:\Users\tshan\Documents\Dev\madden-editor-suite\data\lookups\PID_Portrait_Mapping.csv')

def normalize_name(name):
    """Normalize name for matching - remove punctuation, lowercase"""
    return re.sub(r'[^a-z\s]', '', name.lower().strip())

def build_name_variants(first, last):
    """Build all possible name variations for matching"""
    variants = []

    # Standard format
    full_name = f"{first} {last}".strip()
    variants.append(normalize_name(full_name))

    # Handle suffixes
    suffixes = ['Jr', 'Jr.', 'II', 'III', 'IV', 'Sr', 'Sr.']

    # Try with and without periods
    for suffix in suffixes:
        if last.endswith(suffix):
            # Remove suffix from last name
            base_last = last.replace(suffix, '').strip()
            variants.append(normalize_name(f"{first} {base_last}"))
            variants.append(normalize_name(f"{first} {base_last} {suffix}"))
            variants.append(normalize_name(f"{first} {last}"))

    return list(set(variants))  # Remove duplicates

def main():
    print("=" * 80)
    print("POPULATING MISSING PIDs FROM PID_PORTRAIT_MAPPING.CSV")
    print("=" * 80)

    # Load CSVs
    lookup_df = pd.read_csv(ALL_PLAYER_LOOKUP, low_memory=False)
    pid_df = pd.read_csv(PID_PORTRAIT, low_memory=False)

    print(f"\nLoaded {len(lookup_df)} rows from ALL_PLAYER_LOOKUP.csv")
    print(f"Loaded {len(pid_df)} rows from PID_Portrait_Mapping.csv")

    # Count missing PIDs
    missing_mask = lookup_df['PhotoID'].isna() | (lookup_df['PhotoID'] == '') | (lookup_df['PhotoID'] == 0)
    missing_count = missing_mask.sum()
    print(f"\nFound {missing_count} rows with missing PIDs")

    if missing_count == 0:
        print("No missing PIDs to populate!")
        return

    # Build PID mapping index for fast lookup
    # Key = normalized full name, Value = (PID, Player Name from mapping)
    pid_index = {}
    for _, row in pid_df.iterrows():
        player_name = str(row['Player Name']).strip()
        pid = int(row['PID'])

        # Index by normalized name
        normalized = normalize_name(player_name)
        if normalized:
            pid_index[normalized] = (pid, player_name)

    print(f"Built PID index with {len(pid_index)} entries")

    # Process missing PIDs
    filled_count = 0
    sample_fills = []

    for idx, row in lookup_df[missing_mask].iterrows():
        first_name = str(row['First Name']).strip()
        last_name = str(row['Last Name']).strip()

        # Generate name variants
        variants = build_name_variants(first_name, last_name)

        # Try to find match
        matched = False
        for variant in variants:
            if variant in pid_index:
                pid, original_name = pid_index[variant]
                lookup_df.at[idx, 'PhotoID'] = pid
                filled_count += 1
                matched = True

                # Sample first 10
                if len(sample_fills) < 10:
                    sample_fills.append(f"  {first_name} {last_name} -> PID {pid} (matched: {original_name})")

                break

    print(f"\nFilled {filled_count} missing PIDs")

    if sample_fills:
        print("\nSample fills:")
        for sample in sample_fills:
            print(sample)

    # Save
    print(f"\nSaving updated ALL_PLAYER_LOOKUP.csv...")
    lookup_df.to_csv(ALL_PLAYER_LOOKUP, index=False)

    # Final stats
    still_missing = (lookup_df['PhotoID'].isna() | (lookup_df['PhotoID'] == '') | (lookup_df['PhotoID'] == 0)).sum()
    print(f"\nSUCCESS!")
    print(f"  Before: {missing_count} missing PIDs")
    print(f"  Filled: {filled_count} PIDs")
    print(f"  Still missing: {still_missing} PIDs")
    print("=" * 80)

if __name__ == '__main__':
    main()
