"""
Fix ALL_PLAYER_LOOKUP.csv entries where Jr/II/III/IV/Sr are in the wrong field.

Current (WRONG):  Last Name = "III", First Name = "Henry Ruggs"
Fixed (CORRECT):  Last Name = "Ruggs III", First Name = "Henry"
"""

import pandas as pd
from pathlib import Path

ALL_PLAYER_LOOKUP = Path(r'C:\Users\tshan\Documents\Dev\madden-editor-suite\data\lookups\ALL_PLAYER_LOOKUP.csv')

def fix_suffix_name(row):
    """Fix rows where suffix is in Last Name field"""
    last_name = str(row['Last Name']).strip()
    first_name = str(row['First Name']).strip()

    # Check if last name is a suffix
    if last_name in ['Jr', 'Jr.', 'II', 'III', 'IV', 'Sr', 'Sr.']:
        # First name contains the actual name (e.g., "Henry Ruggs")
        # Split it to get actual first and last
        name_parts = first_name.split()

        if len(name_parts) >= 2:
            # Last word is the actual last name
            actual_last_name = name_parts[-1]
            actual_first_name = ' '.join(name_parts[:-1])

            # Reconstruct properly
            row['Last Name'] = f"{actual_last_name} {last_name}"
            row['First Name'] = actual_first_name

            return row, True

    return row, False

def main():
    print("=" * 80)
    print("FIXING SUFFIX NAMES IN ALL_PLAYER_LOOKUP.CSV")
    print("=" * 80)

    # Load CSV
    df = pd.read_csv(ALL_PLAYER_LOOKUP, low_memory=False)
    print(f"\nLoaded {len(df)} rows from ALL_PLAYER_LOOKUP.csv")

    # Find affected rows
    suffixes = ['Jr', 'Jr.', 'II', 'III', 'IV', 'Sr', 'Sr.']
    affected = df[df['Last Name'].isin(suffixes)]
    print(f"Found {len(affected)} rows with suffix as Last Name")

    if len(affected) > 0:
        print("\nSample affected rows (before fix):")
        for _, row in affected.head(5).iterrows():
            print(f"  {row['Last Name']}, {row['First Name']} - {row['Draft Class']}")

    # Fix each row
    fixed_count = 0
    for idx, row in df.iterrows():
        fixed_row, was_fixed = fix_suffix_name(row)
        if was_fixed:
            df.iloc[idx] = fixed_row
            fixed_count += 1

    print(f"\nFixed {fixed_count} rows")

    # Show samples after fix
    if fixed_count > 0:
        print("\nSample fixed rows (after fix):")
        # Find some of the fixed ones
        for suffix in ['Jr', 'II', 'III']:
            matching = df[df['Last Name'].str.contains(f' {suffix}$', na=False, regex=True)]
            if len(matching) > 0:
                sample = matching.iloc[0]
                print(f"  {sample['Last Name']}, {sample['First Name']} - {sample['Draft Class']}")

    # Save
    print(f"\nSaving updated ALL_PLAYER_LOOKUP.csv...")
    df.to_csv(ALL_PLAYER_LOOKUP, index=False)

    print(f"\n✓ SUCCESS! Fixed {fixed_count} player names")
    print("=" * 80)

if __name__ == '__main__':
    main()
