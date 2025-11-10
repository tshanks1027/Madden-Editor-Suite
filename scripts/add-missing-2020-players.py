"""
Add Jedrick Wills Jr and Henry Ruggs III to ALL_PLAYER_LOOKUP.csv
Uses data from PID_Portrait_Mapping.csv and adds basic info
"""

import pandas as pd
from pathlib import Path

# File paths
ALL_PLAYER_LOOKUP = Path(r'C:\Users\tshan\Documents\Dev\madden-editor-suite\data\lookups\ALL_PLAYER_LOOKUP.csv')
PID_PORTRAIT = Path(r'C:\Users\tshan\Documents\Dev\madden-editor-suite\data\lookups\PID_Portrait_Mapping.csv')

def main():
    print("=" * 80)
    print("ADDING MISSING 2020 DRAFT PLAYERS TO ALL_PLAYER_LOOKUP.CSV")
    print("=" * 80)

    # Load existing ALL_PLAYER_LOOKUP.csv
    df = pd.read_csv(ALL_PLAYER_LOOKUP, low_memory=False)
    print(f"\nLoaded ALL_PLAYER_LOOKUP.csv: {len(df)} rows")

    # Load PID_Portrait_Mapping.csv to get PIDs
    pid_df = pd.read_csv(PID_PORTRAIT, low_memory=False)
    print(f"Loaded PID_Portrait_Mapping.csv: {len(pid_df)} rows")

    # Find Jedrick Wills Jr
    wills = pid_df[pid_df['Full Name'] == 'Jedrick Wills Jr'].iloc[0]
    print(f"\nFound: {wills['Full Name']} - PID {wills['PID']}, PLPO {wills['PLPO']}")

    # Find Henry Ruggs III
    ruggs = pid_df[pid_df['Full Name'] == 'Henry Ruggs III'].iloc[0]
    print(f"Found: {ruggs['Full Name']} - PID {ruggs['PID']}, PLPO {ruggs['PLPO']}")

    # Create new rows
    new_rows = []

    # Jedrick Wills Jr - OT from Alabama, 2020 draft pick #10
    new_rows.append({
        'Last Name': 'Wills Jr',
        'First Name': 'Jedrick',
        'College/Univ': 'Alabama',
        'Round': 1,
        'Pick': 10,
        'Draft Class': 2020,
        'Position': 'LT',
        'Jersey': 71.0,
        'PhotoID': wills['PID'],
        'Player Assets ID': 'WillsJrJedrick_' + str(wills['PID']),
        'CommID': '',
        'PLPO': wills['PLPO'],
        'Height': 78.0,  # 6'6"
        'Weight': 312.0,
        'From': 2020.0,
        'To': 2025.0,
        'AP1': 0.0,
        'PB': 1.0,
        'St': 5.0,
        'wAV': 37.0,
        'League': 'NFL',
        'Race': '',
        'Home State': 'Kentucky',
        'Wiki_Image_URL': '',
        'PFR_Image_URL': '',
        'isHOF': False
    })

    # Henry Ruggs III - WR from Alabama, 2020 draft pick #12
    new_rows.append({
        'Last Name': 'Ruggs III',
        'First Name': 'Henry',
        'College/Univ': 'Alabama',
        'Round': 1,
        'Pick': 12,
        'Draft Class': 2020,
        'Position': 'WR',
        'Jersey': 11.0,
        'PhotoID': ruggs['PID'],
        'Player Assets ID': 'RuggsIIIHenry_' + str(ruggs['PID']),
        'CommID': '',
        'PLPO': ruggs['PLPO'],
        'Height': 72.0,  # 6'0"
        'Weight': 188.0,
        'From': 2020.0,
        'To': 2021.0,
        'AP1': 0.0,
        'PB': 0.0,
        'St': 2.0,
        'wAV': 5.0,
        'League': 'NFL',
        'Race': '',
        'Home State': 'Alabama',
        'Wiki_Image_URL': '',
        'PFR_Image_URL': '',
        'isHOF': False
    })

    # Convert to DataFrame and append
    new_df = pd.DataFrame(new_rows)
    combined = pd.concat([df, new_df], ignore_index=True)

    # Save
    print(f"\nSaving updated ALL_PLAYER_LOOKUP.csv...")
    combined.to_csv(ALL_PLAYER_LOOKUP, index=False)

    print(f"\n✓ SUCCESS!")
    print(f"  Previous rows: {len(df)}")
    print(f"  New rows added: {len(new_rows)}")
    print(f"  Total rows: {len(combined)}")
    print("=" * 80)

if __name__ == '__main__':
    main()
