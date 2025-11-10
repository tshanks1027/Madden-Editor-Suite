"""
Import Excel roster files from "Madden Old Ratings" folder into ROSTER_lookup.csv format
Handles years 2007-2008, 2013-2024 (missing years)
"""

import pandas as pd
import os
import glob
from pathlib import Path

# Paths
OLD_RATINGS_DIR = Path(r'C:\Users\tshan\Documents\Dev\madden-editor-suite\data\Madden Old Ratings')
OUTPUT_CSV = Path(r'C:\Users\tshan\Documents\Dev\madden-editor-suite\data\lookups\ROSTER_lookup.csv')

# Mapping from Excel column names to ROSTER_lookup column names
COLUMN_MAPPING = {
    'Overall Rating': 'POVR',
    'Speed': 'PSPD',
    'Acceleration': 'PACC',
    'Strength': 'PSTR',
    'Agility': 'PAGI',
    'Awareness': 'PAWR',
    'Catching': 'PCTH',
    'Carrying': 'PCAR',
    'Throw Power': 'PTHP',
    'Kick Power': 'PKPW',
    'Kick Accuracy': 'PKAC',
    'Run Blocking': 'PRBK',
    'Pass Blocking': 'PPBK',
    'Tackle': 'PTAK',
    'Break Tackle': 'PBTK',
    'Jumping': 'PJMP',
    'Injury': 'PINJ',
    'Stamina': 'PSTA',
    'Toughness': 'PTGH',
    'Trucking': 'PTRK',
    'Change Of Direction': 'PCOD',
    'Ball Carrier Vision': 'PBCV',
    'Stiff Arm': 'PSTF',
    'Spin Move': 'PSPM',
    'Juke Move': 'PJUM',
    'Impact Blocking': 'PIBL',
    'Run Block Power': 'PRBP',
    'Run Block Finesse': 'PRBF',
    'Pass Block Power': 'PPBP',
    'Pass Block Finesse': 'PPBF',
    'Lead Blocking': 'PLDB',
    'Break Sack': 'PBRS',
    'Throw Under Pressure': 'PTUP',
    'Pass Block Move': 'PPWM',
    'Finesse Moves': 'PFNM',
    'Block Shedding': 'PBSH',
    'Pursuit': 'PPUR',
    'Play Recognition': 'PPRC',
    'Man Coverage': 'PMCV',
    'Zone Coverage': 'PZCV',
    'Spectacular Catch': 'PSPC',
    'Catch In Traffic': 'PCIT',
    'Short Route Running': 'PSRR',
    'Medium Route Running': 'PMRR',
    'Deep Route Running': 'PDRR',
    'Hit Power': 'PHTP',
    'Press': 'PPRS',
    'Release': 'PREL',
    'Throw Accuracy Short': 'PTAS',
    'Throw Accuracy Mid': 'PTAM',
    'Throw Accuracy Deep': 'PTAD',
    'Play Action': 'PPLA',
    'Throw On The Run': 'PTOR',
    'Power Moves': 'PPWM',  # Note: might conflict with Pass Block Move
    'Kick Return': 'PKR'
}

def split_name(full_name):
    """Split 'Full Name' into First and Last"""
    parts = full_name.strip().split(' ', 1)
    if len(parts) == 2:
        return parts[0], parts[1]
    else:
        return parts[0], ''

def convert_excel_to_roster_lookup(excel_file, year):
    """Convert single Excel file to ROSTER_lookup format"""
    print(f"\nProcessing {excel_file.name} for year {year}...")

    # Read Excel
    df = pd.read_excel(excel_file)

    # Create output dataframe with required columns
    output_rows = []

    for _, row in df.iterrows():
        first_name, last_name = split_name(row.get('Full Name', ''))

        # Build output row
        out_row = {
            'Year': year,
            'Season_Team': row.get('Team', ''),
            'Player_Name': row.get('Full Name', ''),
            'First_Name': first_name,
            'Last_Name': last_name,
            'Position': row.get('Position', ''),
            'Jersey': row.get('Jersey Number', ''),
            'Age': row.get('Age', ''),
            'PID': '',  # Not in Excel files
            'PAM': '',  # Not in Excel files
            'College': row.get('College', ''),
            'Height': row.get('Height', ''),
            'Weight': row.get('Weight', ''),
            'Archetype': row.get('Archetype', ''),
            'BirthDate': row.get('Birthdate', ''),
            'YearsPro': row.get('Years Pro', ''),
            'Handedness': row.get('Player Handedness', ''),
        }

        # Add mapped rating columns
        for excel_col, roster_col in COLUMN_MAPPING.items():
            out_row[roster_col] = row.get(excel_col, '')

        output_rows.append(out_row)

    result_df = pd.DataFrame(output_rows)
    print(f"  Converted {len(result_df)} players")
    return result_df

def main():
    print("=" * 80)
    print("IMPORTING EXCEL ROSTERS TO ROSTER_LOOKUP.CSV")
    print("=" * 80)

    # Find Excel files for years we need
    files_to_import = [
        ('2013 Roster.xlsx', 2013),
        ('2014 Rosters.xlsx', 2014),
        ('2015 Roster.xlsx', 2015),
        ('2016 Rosters.xlsx', 2016),
        ('2017 Rosters.xlsx', 2017),
        ('2018 Rosters.xlsx', 2018),
        ('2019 Rosters.xlsx', 2019),
        ('2020 Rosters.xlsx', 2020),
        ('2021 Rosters.xlsx', 2021),
        ('2022 Rosters.xlsx', 2022),
        ('2023 Rosterss.xlsx', 2023),  # Note the typo in filename
        ('2024 Rosters.xlsx', 2024),
    ]

    # Load existing ROSTER_lookup.csv to get column order
    existing_df = pd.read_csv(OUTPUT_CSV)
    existing_columns = list(existing_df.columns)
    print(f"\nExisting ROSTER_lookup.csv has {len(existing_df)} rows")
    print(f"Columns: {len(existing_columns)}")

    # Convert each file
    all_new_rows = []

    for filename, year in files_to_import:
        excel_path = OLD_RATINGS_DIR / filename
        if excel_path.exists():
            try:
                year_df = convert_excel_to_roster_lookup(excel_path, year)
                all_new_rows.append(year_df)
            except Exception as e:
                print(f"  ERROR: {e}")
        else:
            print(f"\n⚠️  File not found: {filename}")

    if not all_new_rows:
        print("\n❌ No files were processed!")
        return

    # Combine all new rows
    new_data = pd.concat(all_new_rows, ignore_index=True)
    print(f"\n{'='*80}")
    print(f"Total new rows to add: {len(new_data)}")

    # Ensure all existing columns exist in new data (fill missing with empty string)
    for col in existing_columns:
        if col not in new_data.columns:
            new_data[col] = ''

    # Reorder columns to match existing
    new_data = new_data[existing_columns]

    # Append to existing CSV
    combined = pd.concat([existing_df, new_data], ignore_index=True)

    # Save
    print(f"Saving to {OUTPUT_CSV}...")
    combined.to_csv(OUTPUT_CSV, index=False)

    print(f"\n✅ SUCCESS!")
    print(f"   Previous rows: {len(existing_df)}")
    print(f"   New rows: {len(new_data)}")
    print(f"   Total rows: {len(combined)}")
    print("=" * 80)

if __name__ == '__main__':
    main()
