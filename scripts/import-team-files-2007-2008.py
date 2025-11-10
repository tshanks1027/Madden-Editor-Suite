"""
Import 2007 and 2008 team-by-team Excel files into ROSTER_lookup.csv
"""

import pandas as pd
import os
from pathlib import Path

OLD_RATINGS_DIR = Path(r'C:\Users\tshan\Documents\Dev\madden-editor-suite\data\Madden Old Ratings')
OUTPUT_CSV = Path(r'C:\Users\tshan\Documents\Dev\madden-editor-suite\data\lookups\ROSTER_lookup.csv')

# Team filename → actual team name mapping
TEAM_NAME_MAP = {
    'arizona_cardinals': 'Cardinals',
    'atlanta_falcons': 'Falcons',
    'baltimore_ravens': 'Ravens',
    'buffalo_bills': 'Bills',
    'carolina_panthers': 'Panthers',
    'chicago_bears': 'Bears',
    'cincinnati_bengals': 'Bengals',
    'cleveland_browns': 'Browns',
    'dallas_cowboys': 'Cowboys',
    'denver_broncos': 'Broncos',
    'detroit_lions': 'Lions',
    'green_bay_packers': 'Packers',
    'houston_texans': 'Texans',
    'indianapolis_colts': 'Colts',
    'jacksonville_jaguars': 'Jaguars',
    'kansas_city_chiefs': 'Chiefs',
    'miami_dolphins': 'Dolphins',
    'minnesota_vikings': 'Vikings',
    'new_england_patriots': 'Patriots',
    'new_orleans_saints': 'Saints',
    'new_york_giants': 'Giants',
    'new_york_jets': 'Jets',
    'oakland_raiders': 'Raiders',
    'philadelphia_eagles': 'Eagles',
    'pittsburgh_steelers': 'Steelers',
    'san_diego_chargers': 'Chargers',
    'san_francisco_49ers': '49ers',
    'seattle_seahawks': 'Seahawks',
    'st._louis_rams': 'Rams',
    'tampa_bay_buccaneers': 'Buccaneers',
    'tennessee_titans': 'Titans',
    'washington_redskins': 'Washington'
}

# Column mapping (same as before)
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
    'Throw On The Run': 'PTOR'
}

def split_name(full_name):
    """Split 'Full Name' into First and Last"""
    parts = full_name.strip().split(' ', 1)
    if len(parts) == 2:
        return parts[0], parts[1]
    else:
        return parts[0], ''

def process_team_file(filepath, team_name, year):
    """Process single team file"""
    df = pd.read_excel(filepath)

    output_rows = []
    for _, row in df.iterrows():
        first_name, last_name = split_name(row.get('Full Name', ''))

        out_row = {
            'Year': year,
            'Season_Team': team_name,
            'Player_Name': row.get('Full Name', ''),
            'First_Name': first_name,
            'Last_Name': last_name,
            'Position': row.get('Position', ''),
            'Jersey': row.get('Jersey Number', ''),
            'Age': row.get('Age', ''),
            'PID': '',
            'PAM': '',
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

    return pd.DataFrame(output_rows)

def main():
    print("=" * 80)
    print("IMPORTING 2007-2008 TEAM FILES TO ROSTER_LOOKUP.CSV")
    print("=" * 80)

    # Load existing CSV
    existing_df = pd.read_csv(OUTPUT_CSV, low_memory=False)
    existing_columns = list(existing_df.columns)
    print(f"\nExisting ROSTER_lookup.csv has {len(existing_df)} rows")

    all_new_rows = []

    # Process 2007
    year_2007_dir = OLD_RATINGS_DIR / '2007'
    if year_2007_dir.exists():
        print(f"\nProcessing 2007 files from {year_2007_dir}...")
        for team_file in year_2007_dir.glob('*.xlsx'):
            # Extract team name from filename
            team_slug = team_file.stem.replace('_madden_nfl_07', '')
            team_name = TEAM_NAME_MAP.get(team_slug, team_slug.replace('_', ' ').title())

            try:
                team_df = process_team_file(team_file, team_name, 2007)
                all_new_rows.append(team_df)
                print(f"  {team_name}: {len(team_df)} players")
            except Exception as e:
                print(f"  ERROR with {team_file.name}: {e}")

    # Process 2008
    year_2008_dir = OLD_RATINGS_DIR / '2008'
    if year_2008_dir.exists():
        print(f"\nProcessing 2008 files from {year_2008_dir}...")
        for team_file in year_2008_dir.glob('*.xlsx'):
            team_slug = team_file.stem.replace('_madden_nfl_08', '')
            team_name = TEAM_NAME_MAP.get(team_slug, team_slug.replace('_', ' ').title())

            try:
                team_df = process_team_file(team_file, team_name, 2008)
                all_new_rows.append(team_df)
                print(f"  {team_name}: {len(team_df)} players")
            except Exception as e:
                print(f"  ERROR with {team_file.name}: {e}")

    if not all_new_rows:
        print("\nNo files were processed!")
        return

    # Combine all new rows
    new_data = pd.concat(all_new_rows, ignore_index=True)
    print(f"\n{'='*80}")
    print(f"Total new rows to add: {len(new_data)}")

    # Ensure columns match
    for col in existing_columns:
        if col not in new_data.columns:
            new_data[col] = ''

    new_data = new_data[existing_columns]

    # Append to existing
    combined = pd.concat([existing_df, new_data], ignore_index=True)

    # Save
    print(f"Saving to {OUTPUT_CSV}...")
    combined.to_csv(OUTPUT_CSV, index=False)

    print(f"\nSUCCESS!")
    print(f"  Previous rows: {len(existing_df)}")
    print(f"  New rows: {len(new_data)}")
    print(f"  Total rows: {len(combined)}")
    print("=" * 80)

if __name__ == '__main__':
    main()
