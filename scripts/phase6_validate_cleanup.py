#!/usr/bin/env python3
"""
Phase 6: Validate and Cleanup Data

Normalizes positions, validates HOF tags, removes "nan" strings,
and cleans up any data quality issues.

Input: phase5_with_pids.csv
Output: phase6_cleaned.csv
"""

import pandas as pd
import numpy as np
from pathlib import Path

# Paths
base_dir = Path(__file__).parent.parent
lookups_dir = base_dir / "data" / "lookups"

phase5_file = lookups_dir / "phase5_with_pids.csv"
hof_file = lookups_dir / "hof_lookup.csv"
output_file = lookups_dir / "phase6_cleaned.csv"

# M26 Position Mapping (from create-alldatafull.py)
POSITION_MAPPING = {
    'B': 'HB',  # Old "Back" position
    'BB': 'FB',  # Blocking back
    'C': 'C',
    'CB': 'CB',
    'DB': 'CB',  # DB -> CB
    'DE': 'LE',  # DE -> LE (or RE, using LE for consistency)
    'DT': 'DT',
    'E': 'TE',  # Old "End" position
    'FB': 'FB',
    'FS': 'FS',
    'G': 'LG',  # G -> LG
    'HB': 'HB',
    'K': 'K',
    'LB': 'MLB',  # LB -> MLB
    'LE': 'LE',
    'LG': 'LG',
    'LOLB': 'LOLB',
    'LT': 'LT',
    'MLB': 'MLB',
    'NT': 'DT',  # Nose tackle -> DT
    'OG': 'LG',  # Offensive guard
    'OL': 'LG',  # Generic offensive line
    'OT': 'LT',  # OT -> LT
    'P': 'P',
    'QB': 'QB',
    'RB': 'HB',  # RB -> HB
    'RE': 'RE',
    'RG': 'RG',
    'ROLB': 'ROLB',
    'RT': 'RT',
    'S': 'SS',  # S -> SS
    'SS': 'SS',
    'T': 'LT',  # T -> LT
    'TB': 'HB',  # Tailback
    'TE': 'TE',
    'WB': 'HB',  # Wingback
    'WR': 'WR'
}

def load_hof_players():
    """Load HOF players from hof_lookup.csv"""
    print("\nLoading Hall of Fame data...")
    if not hof_file.exists():
        print(f"  WARNING: {hof_file} not found, skipping HOF validation")
        return set()

    try:
        df = pd.read_csv(hof_file, encoding='utf-8')

        hof_set = set()
        for _, row in df.iterrows():
            # Try different possible column names
            player_name = None
            for col in ['PlayerName', 'Player Name', 'Name', 'player_name']:
                if col in df.columns:
                    player_name = row.get(col, '')
                    break

            if player_name and pd.notna(player_name):
                # Normalize for matching
                name_normalized = str(player_name).strip().lower()
                hof_set.add(name_normalized)

        print(f"  Loaded {len(hof_set)} HOF players")
        return hof_set

    except Exception as e:
        print(f"  ERROR loading HOF data: {e}")
        return set()

def normalize_position(pos):
    """Normalize position code to M26 standard"""
    if pd.isna(pos) or pos == '':
        return ''

    pos = str(pos).strip().upper()
    return POSITION_MAPPING.get(pos, pos)  # Return mapped or original if not in map

def clean_nan_strings(value):
    """Replace 'nan' strings with empty string"""
    if pd.isna(value):
        return ''
    value_str = str(value).strip()
    if value_str.lower() == 'nan' or value_str == '':
        return ''
    return value_str

def validate_hof_status(first, last, hof_set):
    """Check if player should be marked as HOF"""
    if not hof_set:
        return None  # Don't change if no HOF data

    full_name = f"{first} {last}".strip().lower()

    # Also try just last name
    last_only = str(last).strip().lower()

    return str(full_name in hof_set or last_only in hof_set)

def main():
    print("="*80)
    print("PHASE 6: VALIDATE AND CLEANUP DATA")
    print("="*80)

    # Load Phase 5 data
    print(f"\nLoading Phase 5 data: {phase5_file}")
    df = pd.read_csv(phase5_file, encoding='utf-8', low_memory=False)
    print(f"  Loaded {len(df)} players")

    # Load HOF data
    hof_players = load_hof_players()

    # Process each player
    print("\nCleaning data...")

    # 1. Normalize positions
    print("  Normalizing positions...")
    original_positions = df['Position'].copy()
    df['Position'] = df['Position'].apply(normalize_position)
    changed_count = (df['Position'] != original_positions).sum()
    print(f"    Updated {changed_count} positions to M26 standard")

    # 2. Clean "nan" strings from ALL columns
    print("  Removing 'nan' strings...")
    nan_count = 0
    for col in df.columns:
        df[col] = df[col].apply(clean_nan_strings)
        nan_count += (df[col] == '').sum()
    print(f"    Cleaned {nan_count} empty/nan values")

    # 3. Validate HOF status
    if hof_players:
        print("  Validating HOF status...")
        hof_changes = 0
        for idx, row in df.iterrows():
            first = row['First Name']
            last = row['Last Name']
            current_hof = row['isHOF']

            correct_hof = validate_hof_status(first, last, hof_players)
            if correct_hof is not None and str(correct_hof) != str(current_hof):
                df.at[idx, 'isHOF'] = correct_hof
                hof_changes += 1

        print(f"    Updated {hof_changes} HOF tags")

    # 4. Ensure proper boolean format for isHOF
    df['isHOF'] = df['isHOF'].apply(lambda x: 'True' if str(x).lower() in ['true', '1', 'yes'] else 'False')

    # 5. Remove duplicate records (same name, year, position)
    print("  Checking for duplicates...")
    before_count = len(df)
    df = df.drop_duplicates(subset=['First Name', 'Last Name', 'Draft Class', 'Position'], keep='first')
    after_count = len(df)
    removed_dupes = before_count - after_count
    print(f"    Removed {removed_dupes} duplicate records")

    # 6. Sort by Draft Class, Round, Pick
    print("  Sorting by draft order...")
    df['_sort_draft'] = pd.to_numeric(df['Draft Class'], errors='coerce')
    df['_sort_round'] = pd.to_numeric(df['Round'].replace('UD', '999'), errors='coerce')
    df['_sort_pick'] = pd.to_numeric(df['Pick'].replace('UD', '999'), errors='coerce')

    df = df.sort_values(['_sort_draft', '_sort_round', '_sort_pick'])
    df = df.drop(columns=['_sort_draft', '_sort_round', '_sort_pick'])
    df = df.reset_index(drop=True)

    # Save cleaned data
    print(f"\nSaving cleaned data to: {output_file}")
    df.to_csv(output_file, index=False, encoding='utf-8')

    # Summary
    print("\n" + "="*80)
    print("SUMMARY")
    print("="*80)
    print(f"Total players: {len(df)}")
    print(f"Removed duplicates: {removed_dupes}")
    print(f"Position changes: {changed_count}")

    # Position breakdown
    print("\nTop 10 positions:")
    pos_counts = df['Position'].value_counts().head(10)
    for pos, count in pos_counts.items():
        print(f"  {pos}: {count}")

    # HOF count
    hof_count = (df['isHOF'] == 'True').sum()
    print(f"\nHall of Fame players: {hof_count}")

    # Sample HOF player
    hof_sample = df[df['isHOF'] == 'True'].head(1)
    if not hof_sample.empty:
        s = hof_sample.iloc[0]
        print(f"  Example: {s['First Name']} {s['Last Name']} ({s['Draft Class']}) - {s['Position']}")

    print("\nDone!")

if __name__ == '__main__':
    main()
