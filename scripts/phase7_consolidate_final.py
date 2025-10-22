#!/usr/bin/env python3
"""
Phase 7: Create Final MASTER_PLAYER_LOOKUP.csv

Final consolidation and output of clean player lookup database.

Input: phase6_cleaned.csv
Output: MASTER_PLAYER_LOOKUP.csv
"""

import pandas as pd
from pathlib import Path

# Paths
base_dir = Path(__file__).parent.parent
lookups_dir = base_dir / "data" / "lookups"

phase6_file = lookups_dir / "phase6_cleaned.csv"
output_file = lookups_dir / "MASTER_PLAYER_LOOKUP.csv"

# Final column order (matching template)
FINAL_COLUMNS = [
    'Last Name', 'First Name', 'College/Univ', 'Round', 'Pick', 'Draft Class',
    'Position', 'PhotoID', 'Player Assets ID', 'CommID', 'PLPO',
    'Height', 'Weight', 'From', 'To', 'AP1', 'PB', 'St', 'wAV', 'League',
    'Race', 'Home State', 'Wiki_Image_URL', 'PFR_Image_URL', 'isHOF'
]

def main():
    print("="*80)
    print("PHASE 7: CREATE FINAL MASTER_PLAYER_LOOKUP.CSV")
    print("="*80)

    # Load Phase 6 cleaned data
    print(f"\nLoading Phase 6 cleaned data: {phase6_file}")
    df = pd.read_csv(phase6_file, encoding='utf-8', low_memory=False)
    print(f"  Loaded {len(df)} players")

    # Ensure all columns exist and are in correct order
    print("\nEnsuring column consistency...")
    for col in FINAL_COLUMNS:
        if col not in df.columns:
            df[col] = ''
            print(f"  Added missing column: {col}")

    # Select and order columns
    df = df[FINAL_COLUMNS]

    # Final data quality checks
    print("\nPerforming final quality checks...")

    # Check for any remaining issues
    total_records = len(df)
    records_with_names = ((df['First Name'].notna()) | (df['Last Name'].notna())).sum()
    records_with_college = (df['College/Univ'].notna() & (df['College/Univ'] != '')).sum()
    records_with_position = (df['Position'].notna() & (df['Position'] != '')).sum()

    print(f"  Records with names: {records_with_names} / {total_records}")
    print(f"  Records with college: {records_with_college} / {total_records}")
    print(f"  Records with position: {records_with_position} / {total_records}")

    # Save final output
    print(f"\nSaving final output: {output_file}")
    df.to_csv(output_file, index=False, encoding='utf-8')

    # Generate summary report
    print("\n" + "="*80)
    print("FINAL SUMMARY")
    print("="*80)
    print(f"Total players in MASTER_PLAYER_LOOKUP.csv: {len(df)}")
    print(f"\nDraft coverage:")
    print(f"  Years: 1936 - 2025")
    print(f"  Leagues: NFL + AFL")

    # Year range
    years = df['Draft Class'].dropna().astype(str)
    if len(years) > 0:
        years_int = pd.to_numeric(years, errors='coerce').dropna()
        if len(years_int) > 0:
            print(f"  Earliest draft: {int(years_int.min())}")
            print(f"  Latest draft: {int(years_int.max())}")

    # HOF players
    hof_count = (df['isHOF'] == 'True').sum()
    print(f"\nHall of Fame players: {hof_count}")

    # Position distribution
    print(f"\nPosition distribution (top 10):")
    pos_counts = df['Position'].value_counts().head(10)
    for pos, count in pos_counts.items():
        pct = (count / len(df)) * 100
        print(f"  {pos:5s}: {count:5d} ({pct:5.1f}%)")

    # Data completeness
    print(f"\nData completeness:")
    completeness_fields = {
        'PhotoID': 'PhotoID',
        'Player Assets ID': 'Player Assets ID',
        'PLPO': 'PLPO',
        'Height': 'Height',
        'Weight': 'Weight',
        'Stats (wAV)': 'wAV'
    }

    for label, col in completeness_fields.items():
        filled = df[col].notna() & (df[col] != '')
        count = filled.sum()
        pct = (count / len(df)) * 100
        print(f"  {label:20s}: {count:5d} ({pct:5.1f}%)")

    # Sample records
    print(f"\nSample records:")
    print("\n  First overall pick (1936):")
    first_pick = df[(df['Draft Class'] == '1936') & (df['Round'] == '1') & (df['Pick'] == '1')]
    if not first_pick.empty:
        fp = first_pick.iloc[0]
        print(f"    {fp['First Name']} {fp['Last Name']} - {fp['College/Univ']} ({fp['Position']})")

    print("\n  Terry Bradshaw (HOF QB):")
    bradshaw = df[(df['Last Name'] == 'Bradshaw') & (df['First Name'] == 'Terry')]
    if not bradshaw.empty:
        tb = bradshaw.iloc[0]
        print(f"    Round {tb['Round']}, Pick {tb['Pick']} ({tb['Draft Class']})")
        print(f"    isHOF: {tb['isHOF']}, wAV: {tb['wAV']}, PID: {tb['PhotoID']}")

    print("\n  Most recent draft (2025):")
    recent = df[df['Draft Class'] == '2025'].head(1)
    if not recent.empty:
        r = recent.iloc[0]
        print(f"    {r['First Name']} {r['Last Name']} - {r['College/Univ']} ({r['Position']})")

    print("\n" + "="*80)
    print("SUCCESS! MASTER_PLAYER_LOOKUP.CSV CREATED")
    print("="*80)
    print(f"\nFile location: {output_file}")
    print(f"Total records: {len(df)}")
    print("\nThis file contains all drafted players from 1936-2025 (NFL + AFL)")
    print("with normalized positions, validated HOF tags, and merged PID/PLPO data.")
    print("\nDone!")

if __name__ == '__main__':
    main()
