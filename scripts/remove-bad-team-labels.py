"""
Remove duplicate entries from ROSTER_lookup.csv that have bad team labels
like "2013 Roster", "2014 Roster" etc. instead of actual team names.
"""

import pandas as pd
from pathlib import Path

CSV_PATH = Path(r'C:\Users\tshan\Documents\Dev\madden-editor-suite\data\lookups\ROSTER_lookup.csv')

def main():
    print("=" * 80)
    print("REMOVING BAD TEAM LABELS FROM ROSTER_LOOKUP.CSV")
    print("=" * 80)

    # Load CSV
    print(f"\nLoading {CSV_PATH}...")
    df = pd.read_csv(CSV_PATH, low_memory=False)
    print(f"Loaded {len(df)} rows")

    # Count bad entries
    bad_patterns = [
        '2013 Roster', '2014 Roster', '2015 Roster', '2016 Roster',
        '2017 Roster', '2018 Roster', '2019 Roster', '2020 Roster',
        '2021 Roster', '2022 Roster', '2023 Roster', '2024 Roster',
        '2013 Rosters', '2014 Rosters', '2015 Rosters', '2016 Rosters',
        '2017 Rosters', '2018 Rosters', '2019 Rosters', '2020 Rosters',
        '2021 Rosters', '2022 Rosters', '2023 Rosters', '2024 Rosters'
    ]

    bad_mask = df['Season_Team'].isin(bad_patterns)
    bad_count = bad_mask.sum()

    print(f"\nFound {bad_count} rows with bad team labels:")
    for pattern in bad_patterns:
        count = (df['Season_Team'] == pattern).sum()
        if count > 0:
            print(f"  {pattern}: {count} rows")

    # Remove bad entries
    print(f"\nRemoving {bad_count} bad entries...")
    cleaned_df = df[~bad_mask].copy()

    print(f"Rows after cleanup: {len(cleaned_df)}")
    print(f"Rows removed: {len(df) - len(cleaned_df)}")

    # Save
    print(f"\nSaving to {CSV_PATH}...")
    cleaned_df.to_csv(CSV_PATH, index=False)

    print("\nSUCCESS!")
    print(f"  Original rows: {len(df)}")
    print(f"  Removed rows: {len(df) - len(cleaned_df)}")
    print(f"  Final rows: {len(cleaned_df)}")
    print("=" * 80)

if __name__ == '__main__':
    main()
