"""
Master Lookup Builder - Following EXACT template mapping
Row 4 of Lookup_Template.csv tells us exactly where to get each column
"""

import pandas as pd
import csv
from pathlib import Path

def convert_height_to_inches(height_str):
    """Convert height like '6-3' to inches (75)"""
    if not height_str or pd.isna(height_str):
        return ''

    height_str = str(height_str).strip()
    if '-' in height_str:
        parts = height_str.split('-')
        if len(parts) == 2:
            try:
                feet = int(parts[0])
                inches = int(parts[1])
                return feet * 12 + inches
            except:
                return ''
    return ''

def load_all_draft_files(drafts_dir):
    """Load all draft XLS files including AFL files"""
    all_data = {}

    draft_files = sorted(drafts_dir.glob("*.xls"))
    print(f"Loading {len(draft_files)} draft files...")

    for file_path in draft_files:
        try:
            # Read HTML table
            df = pd.read_html(str(file_path))[0]

            # Flatten multi-level columns
            if isinstance(df.columns, pd.MultiIndex):
                new_cols = []
                for col in df.columns:
                    if col[1] and col[1] != '':
                        new_cols.append(col[1])
                    else:
                        new_cols.append(col[0])
                df.columns = new_cols

            # Determine league (NFL or AFL)
            filename = file_path.stem
            if 'AFL' in filename:
                league = 'AFL'
                year = filename.split()[0]  # "1960 AFL" -> "1960"
            else:
                league = 'NFL'
                year = filename

            # Check if this is the special 1960 AFL file (different column order)
            is_1960_afl = (filename == '1960 AFL')

            # Store each player with their draft data
            for _, row in df.iterrows():
                player_name = row.get('Player', '')
                if not player_name or pd.isna(player_name) or player_name == '':
                    continue

                # Parse name
                if ',' in player_name:
                    parts = player_name.split(',')
                    last_name = parts[0].strip()
                    first_name = parts[1].strip() if len(parts) > 1 else ''
                else:
                    parts = player_name.split()
                    if len(parts) >= 2:
                        first_name = parts[0]
                        last_name = ' '.join(parts[1:])
                    else:
                        continue

                # Remove HOF tag from names
                last_name = last_name.replace(' HOF', '').replace('HOF', '').strip()
                first_name = first_name.replace(' HOF', '').replace('HOF', '').strip()

                key = f"{first_name.lower()} {last_name.lower()}"

                # Store the data (use first occurrence if duplicate)
                if key not in all_data:
                    # For 1960 AFL, Rnd and Pick columns don't exist
                    if is_1960_afl:
                        round_val = ''
                        pick_val = ''
                    else:
                        round_val = row.get('Rnd', '')
                        pick_val = row.get('Pick', '')

                    all_data[key] = {
                        'Last Name': last_name,
                        'First Name': first_name,
                        'College/Univ': row.get('College/Univ', ''),  # PFR Column 27
                        'Round': round_val,  # PFR Column 1 (or empty for 1960 AFL)
                        'Pick': pick_val,  # PFR Column 2 (or empty for 1960 AFL)
                        'Draft Class': year,
                        'Position': row.get('Pos', ''),  # PFR Column 5
                        'To': row.get('To', ''),  # PFR Column 7
                        'AP1': row.get('AP1', ''),  # PFR Column 8
                        'PB': row.get('PB', ''),  # PFR Column 9
                        'St': row.get('St', ''),  # PFR Column 10
                        'wAV': row.get('wAV', ''),  # PFR Column 11
                        'League': league
                    }

        except Exception as e:
            print(f"  Error loading {file_path.name}: {e}")

    print(f"  Loaded {len(all_data)} unique players from draft files")
    return all_data

def load_pam_folders(pam_file):
    """Load PAM folder names"""
    pam_dict = {}
    with open(pam_file, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#'):
                continue

            # Skip generic/teen/mut
            if line.startswith(('gen_', 'teen_', 'mut')):
                continue

            # Parse name from folder
            name_part = line.split('_')[0]
            for i, char in enumerate(name_part):
                if i > 0 and char.isupper():
                    last_name = name_part[:i]
                    first_name = name_part[i:]
                    key = f"{first_name.lower()} {last_name.lower()}"
                    pam_dict[key] = line
                    break

    print(f"Loaded {len(pam_dict)} PAM folders")
    return pam_dict

def load_pid_lookups(lookup_dir):
    """Load PID data from PID_lookup.csv and PID_Portrait_Mapping.csv"""
    pid_dict = {}

    # Try PID_lookup.csv first (PSXP is the ID, Player Pic has the name)
    pid_file = lookup_dir / "PID_lookup.csv"
    if pid_file.exists():
        df = pd.read_csv(pid_file)
        for _, row in df.iterrows():
            psxp = str(row.get('PSXP', '')).strip()
            player_pic = str(row.get('Player Pic', '')).strip()

            if psxp and player_pic and psxp != 'nan' and player_pic != 'nan':
                # Parse player name from Player Pic column
                # Format: "First Last" or "First Last (R)" or just "First Last"
                name = player_pic.replace(' (R)', '').replace(' (HOF)', '').strip()

                if ' ' in name:
                    parts = name.split()
                    if len(parts) >= 2:
                        first_name = parts[0]
                        last_name = ' '.join(parts[1:])
                        key = f"{first_name.lower()} {last_name.lower()}"
                        pid_dict[key] = psxp

    print(f"Loaded {len(pid_dict)} PID mappings")
    return pid_dict

def load_existing_data(lookup_dir):
    """Load existing MASTER_LOOKUP.csv or FullData_Lookup.csv for additional fields"""
    existing = {}

    # Try MASTER_LOOKUP first, then FullData_Lookup
    for filename in ['MASTER_LOOKUP.csv', 'FullData_Lookup.csv']:
        file_path = lookup_dir / filename
        if file_path.exists():
            try:
                df = pd.read_csv(file_path)
                for _, row in df.iterrows():
                    first = str(row.get('First Name', '')).strip()
                    last = str(row.get('Last Name', '')).strip()
                    if first and last and first != 'nan' and last != 'nan':
                        key = f"{first.lower()} {last.lower()}"
                        existing[key] = {
                            'Height': row.get('Height', ''),
                            'Weight': row.get('Weight', ''),
                            'From': row.get('From', ''),
                            'CommID': row.get('CommID', ''),
                            'PLPO': row.get('PLPO', ''),
                            'PhotoID': row.get('PhotoID', ''),
                            'Race': row.get('Race', ''),
                            'Home State': row.get('Home State', ''),
                            'Wiki_Image_URL': row.get('Wiki_Image_URL', ''),
                            'PFR_Image_URL': row.get('PFR_Image_URL', '')
                        }
                print(f"Loaded {len(existing)} existing player records from {filename}")
                break
            except Exception as e:
                print(f"Could not load {filename}: {e}")

    return existing

def main():
    base_dir = Path(r"C:\Users\tshan\OneDrive\Documents\Madden Files\KNuttZFranchiseSandBox")
    script_dir = base_dir / "madden-editor-suite"

    print("="*80)
    print("BUILDING MASTER LOOKUP - FOLLOWING EXACT TEMPLATE")
    print("="*80)

    # Load all data sources
    print("\n1. Loading Draft Files (XLS)...")
    draft_data = load_all_draft_files(base_dir / "Drafts")

    print("\n2. Loading PAM Folders...")
    pam_data = load_pam_folders(script_dir / "data" / "lookups" / "pam_folders_complete.txt")

    print("\n3. Loading PID Data...")
    pid_data = load_pid_lookups(script_dir / "data" / "lookups")

    print("\n4. Loading Existing Data...")
    existing_data = load_existing_data(script_dir / "data" / "lookups")

    print("\n5. Building Master Lookup...")
    output_file = script_dir / "data" / "lookups" / "MASTER_LOOKUP_FINAL.csv"

    # Template columns
    columns = [
        'Last Name', 'First Name', 'College/Univ', 'Round', 'Pick', 'Draft Class',
        'Position', 'PhotoID', 'Player Assets ID', 'CommID', 'PLPO',
        'Height', 'Weight', 'From', 'To', 'AP1', 'PB', 'St', 'wAV',
        'League', 'Race', 'Home State', 'Wiki_Image_URL', 'PFR_Image_URL'
    ]

    with open(output_file, 'w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=columns)
        writer.writeheader()

        rows_written = 0

        # Process each player from draft data
        for key, player in draft_data.items():
            output_row = player.copy()

            # Get PAM folder
            output_row['Player Assets ID'] = pam_data.get(key, '')

            # Get PID
            output_row['PhotoID'] = pid_data.get(key, '')

            # Get additional data from existing files
            if key in existing_data:
                existing = existing_data[key]
                # Convert height to inches if needed
                height = existing.get('Height', '')
                if height:
                    height_inches = convert_height_to_inches(height)
                    output_row['Height'] = height_inches if height_inches else height
                else:
                    output_row['Height'] = ''

                output_row['Weight'] = existing.get('Weight', '')
                output_row['From'] = existing.get('From', '')
                output_row['CommID'] = existing.get('CommID', '')
                output_row['PLPO'] = existing.get('PLPO', '')
                if not output_row.get('PhotoID'):
                    output_row['PhotoID'] = existing.get('PhotoID', '')
                output_row['Race'] = existing.get('Race', '')
                output_row['Home State'] = existing.get('Home State', '')
                output_row['Wiki_Image_URL'] = existing.get('Wiki_Image_URL', '')
                output_row['PFR_Image_URL'] = existing.get('PFR_Image_URL', '')
            else:
                output_row['Height'] = ''
                output_row['Weight'] = ''
                output_row['From'] = ''
                output_row['CommID'] = ''
                output_row['PLPO'] = ''
                if not output_row.get('PhotoID'):
                    output_row['PhotoID'] = ''
                output_row['Race'] = ''
                output_row['Home State'] = ''
                output_row['Wiki_Image_URL'] = ''
                output_row['PFR_Image_URL'] = ''

            # Ensure all columns exist
            for col in columns:
                if col not in output_row:
                    output_row[col] = ''

            writer.writerow(output_row)
            rows_written += 1

    print(f"\n{'='*80}")
    print("MASTER LOOKUP COMPLETE!")
    print(f"{'='*80}")
    print(f"  Total rows: {rows_written}")
    print(f"  Output: {output_file}")

if __name__ == '__main__':
    main()
