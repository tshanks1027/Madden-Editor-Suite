"""
Combine Historical and Modern Rosters

Combines ROSTER_lookup_historical.csv (1970-2001) with ROSTER_lookup.csv (2002-2024)
into a single comprehensive roster lookup file.
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

MODERN_FILE = LOOKUPS_DIR / 'ROSTER_lookup.csv'
HISTORICAL_FILE = LOOKUPS_DIR / 'ROSTER_lookup_historical.csv'
OUTPUT_FILE = LOOKUPS_DIR / 'ROSTER_lookup.csv'
BACKUP_FILE = LOOKUPS_DIR / 'ROSTER_lookup_BACKUP.csv'

def main():
    print("="*80)
    print("COMBINING HISTORICAL AND MODERN ROSTERS")
    print("="*80)
    print()

    # Load files
    print(f"Loading {HISTORICAL_FILE.name}...")
    historical_df = pd.read_csv(HISTORICAL_FILE)
    print(f"  Loaded {len(historical_df)} rows (1970-2001)")
    print()

    print(f"Loading {MODERN_FILE.name}...")
    modern_df = pd.read_csv(MODERN_FILE)
    print(f"  Loaded {len(modern_df)} rows (2002-2024)")
    print()

    # Create backup
    print(f"Creating backup at {BACKUP_FILE}...")
    modern_df.to_csv(BACKUP_FILE, index=False)
    print("  Backup created")
    print()

    # Get all unique columns from both DataFrames
    all_columns = list(modern_df.columns) + [col for col in historical_df.columns if col not in modern_df.columns]

    print("Aligning columns...")
    print(f"  Modern columns: {len(modern_df.columns)}")
    print(f"  Historical columns: {len(historical_df.columns)}")
    print(f"  Combined unique columns: {len(all_columns)}")
    print()

    # Add missing columns to each DataFrame
    for col in all_columns:
        if col not in modern_df.columns:
            modern_df[col] = ''
            print(f"  Added '{col}' to modern roster")
        if col not in historical_df.columns:
            historical_df[col] = ''
            print(f"  Added '{col}' to historical roster")

    print()

    # Harmonize column names (Years_Pro vs YearsPro)
    if 'Years_Pro' in historical_df.columns and 'YearsPro' in modern_df.columns:
        print("Harmonizing Years_Pro column...")
        # Copy historical Years_Pro to YearsPro column
        historical_df['YearsPro'] = historical_df['Years_Pro']
        print("  Done")
        print()

    # Reorder both to match
    historical_df = historical_df[all_columns]
    modern_df = modern_df[all_columns]

    # Combine
    print("Combining rosters...")
    combined_df = pd.concat([historical_df, modern_df], ignore_index=True)
    print(f"  Combined total: {len(combined_df)} rows")
    print()

    # Sort by year
    print("Sorting by year...")
    combined_df = combined_df.sort_values('Year')
    print("  Sorted")
    print()

    # Verify year range
    print("="*80)
    print("VERIFICATION")
    print("="*80)
    print()

    years = combined_df['Year'].unique()
    years_sorted = sorted(years)
    print(f"Year range: {years_sorted[0]} - {years_sorted[-1]}")
    print(f"Total years: {len(years_sorted)}")
    print()

    # Show distribution by decade
    print("Distribution by decade:")
    for decade in range(1970, 2030, 10):
        decade_count = len(combined_df[(combined_df['Year'] >= decade) & (combined_df['Year'] < decade + 10)])
        if decade_count > 0:
            print(f"  {decade}s: {decade_count} rows")
    print()

    # Save
    print(f"Saving combined roster to {OUTPUT_FILE}...")
    combined_df.to_csv(OUTPUT_FILE, index=False)
    print("  Saved successfully")
    print()

    print("="*80)
    print("ROSTER COMBINATION COMPLETE!")
    print("="*80)
    print()
    print(f"Combined roster now contains:")
    print(f"  Historical (1970-2001): {len(historical_df)} players")
    print(f"  Modern (2002-2024): {len(modern_df)} players")
    print(f"  Total: {len(combined_df)} player-years")
    print()
    print(f"Backup of original modern roster: {BACKUP_FILE}")

    return 0

if __name__ == '__main__':
    sys.exit(main())
