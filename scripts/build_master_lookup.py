"""
Master Lookup Builder - Combines ALL data sources into one comprehensive lookup
Following the exact template structure from Lookup_Template.csv
"""

import pandas as pd
import csv
from pathlib import Path

def load_all_draft_data(drafts_dir):
    """Load ALL columns from all draft files"""
    all_drafts = []

    draft_files = sorted(drafts_dir.glob("*.xls"))
    print(f"Loading {len(draft_files)} draft files...")

    for file_path in draft_files:
        try:
            df = pd.read_html(str(file_path))[0]

            # Flatten multi-level columns
            if isinstance(df.columns, pd.MultiIndex):
                new_cols = []
                for col in df.columns:
                    if col[1] and col[1] not in ['Unnamed: 0_level_1', 'Unnamed: 1_level_1']:
                        new_cols.append(col[1])
                    else:
                        new_cols.append(col[0])
                df.columns = new_cols

            # Extract year from filename
            year = file_path.stem.split()[0]
            df['Draft_Year'] = year

            # Standardize column names to ensure consistency
            column_mapping = {
                'Rnd': 'Draft_Round',
                'Pick': 'Draft_Pick',
                'Tm': 'Team',
                'Pos': 'Draft_Position',
                'Age': 'Draft_Age',
                'College/Univ': 'College'
            }
            df.rename(columns=column_mapping, inplace=True)

            # Keep only the columns we need
            cols_to_keep = ['Player', 'Draft_Round', 'Draft_Pick', 'Team', 'Draft_Position',
                           'Draft_Age', 'To', 'AP1', 'PB', 'St', 'wAV', 'College', 'Draft_Year']
            df = df[[col for col in cols_to_keep if col in df.columns]]

            all_drafts.append(df)

        except Exception as e:
            print(f"  Error loading {file_path.name}: {e}")

    combined = pd.concat(all_drafts, ignore_index=True)
    print(f"  Total draft records: {len(combined)}")
    return combined

def load_pam_folders(pam_file):
    """Load PAM folder mappings"""
    pam_dict = {}
    with open(pam_file, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#'):
                continue

            # Skip generic/teen/mut players
            if line.startswith(('gen_', 'teen_', 'mut')):
                continue

            # Parse folder name
            name_part = line.split('_')[0]

            # Find where uppercase appears
            for i, char in enumerate(name_part):
                if i > 0 and char.isupper():
                    last_name = name_part[:i].lower()
                    first_name = name_part[i:].lower()
                    key = f"{first_name} {last_name}"
                    pam_dict[key] = line
                    break

    print(f"Loaded {len(pam_dict)} PAM folder mappings")
    return pam_dict

def load_pid_data(lookup_dir):
    """Load PID lookup data"""
    pid_dict = {}

    # Load PID_lookup.csv
    pid_file = lookup_dir / "PID_lookup.csv"
    if pid_file.exists():
        with open(pid_file, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                psxp = row.get('PSXP', '').strip()
                player_pic = row.get('Player Pic', '').strip()
                if psxp:
                    pid_dict[psxp] = player_pic
        print(f"Loaded {len(pid_dict)} PID entries")

    return pid_dict

def parse_player_name(full_name):
    """Parse full name into first and last"""
    if not full_name or pd.isna(full_name):
        return None, None

    full_name = str(full_name).strip()

    if ',' in full_name:
        parts = full_name.split(',')
        last_name = parts[0].strip()
        first_name = parts[1].strip() if len(parts) > 1 else ''
    else:
        parts = full_name.split()
        if len(parts) >= 2:
            first_name = parts[0]
            last_name = ' '.join(parts[1:])
        else:
            return None, None

    return first_name, last_name

def main():
    base_dir = Path(r"C:\Users\tshan\OneDrive\Documents\Madden Files\KNuttZFranchiseSandBox")
    script_dir = base_dir / "madden-editor-suite"

    print("="*80)
    print("BUILDING MASTER LOOKUP TABLE")
    print("="*80)

    # 1. Load Draft Data (ALL columns)
    print("\n1. Loading Draft Data...")
    drafts_dir = base_dir / "Drafts"
    draft_df = load_all_draft_data(drafts_dir)

    # 2. Load existing enhanced lookup
    print("\n2. Loading Enhanced Lookup...")
    enhanced_file = script_dir / "data" / "lookups" / "enhanced_lookup_FINAL.csv"
    enhanced_df = pd.read_csv(enhanced_file)
    print(f"  Loaded {len(enhanced_df)} existing records")

    # 3. Load PAM folders
    print("\n3. Loading PAM Folders...")
    pam_file = script_dir / "data" / "lookups" / "pam_folders_complete.txt"
    pam_dict = load_pam_folders(pam_file)

    # 4. Load PID data
    print("\n4. Loading PID Data...")
    pid_dict = load_pid_data(script_dir / "data" / "lookups")

    # 5. Build master lookup
    print("\n5. Building Master Lookup...")
    output_file = script_dir / "data" / "lookups" / "MASTER_LOOKUP.csv"

    # Template columns (from Lookup_Template.csv)
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
        draft_matches = 0
        pam_matches = 0

        # Process each player from enhanced lookup
        for _, row in enhanced_df.iterrows():
            first_name = row.get('First Name', '')
            last_name = row.get('Last Name', '')

            if not first_name or not last_name:
                continue

            # Create output row
            output_row = {}

            # Copy existing data from enhanced_lookup
            output_row['Last Name'] = last_name
            output_row['First Name'] = first_name
            output_row['College/Univ'] = row.get('College/Univ', '')
            output_row['Round'] = row.get('Round', '')
            output_row['Pick'] = row.get('Pick', '')
            output_row['Draft Class'] = row.get('Draft Class', '')
            output_row['Position'] = row.get('Position', '')
            output_row['PhotoID'] = row.get('PhotoID', '')
            output_row['CommID'] = row.get('CommID', '')
            output_row['PLPO'] = row.get('PLPO', '')
            output_row['Height'] = row.get('Height', '')
            output_row['Weight'] = row.get('Weight', '')
            output_row['From'] = row.get('From', '')
            output_row['League'] = row.get('League', '')
            output_row['Race'] = row.get('Race', '')
            output_row['Home State'] = row.get('Hometown', '')  # Map Hometown to Home State
            output_row['Wiki_Image_URL'] = row.get('Wiki_Image_URL', '')
            output_row['PFR_Image_URL'] = row.get('PFR_Image_URL', '')

            # Get draft stats (To, AP1, PB, St, wAV) from draft files
            full_name_for_draft = f"{first_name} {last_name}"
            draft_matches_found = draft_df[
                (draft_df['Player'].str.lower() == full_name_for_draft.lower()) |
                (draft_df['Player'].str.lower() == f"{last_name}, {first_name}".lower())
            ]

            if not draft_matches_found.empty:
                draft_row = draft_matches_found.iloc[0]
                output_row['To'] = draft_row.get('To', '')
                output_row['AP1'] = draft_row.get('AP1', '')
                output_row['PB'] = draft_row.get('PB', '')
                output_row['St'] = draft_row.get('St', '')
                output_row['wAV'] = draft_row.get('wAV', '')
                draft_matches += 1
            else:
                # Use data from enhanced_lookup if available
                output_row['To'] = row.get('To', '')
                output_row['AP1'] = row.get('AP1', '')
                output_row['PB'] = row.get('PB', '')
                output_row['St'] = row.get('St', '')
                output_row['wAV'] = row.get('wAV', '')

            # Get PAM folder
            pam_key = f"{first_name} {last_name}".lower()
            if pam_key in pam_dict:
                output_row['Player Assets ID'] = pam_dict[pam_key]
                pam_matches += 1
            elif row.get('Player Assets ID'):
                output_row['Player Assets ID'] = row.get('Player Assets ID', '')
            else:
                output_row['Player Assets ID'] = ''

            writer.writerow(output_row)
            rows_written += 1

            if rows_written % 5000 == 0:
                print(f"  Processed {rows_written} rows...")

    print(f"\n{'='*80}")
    print("MASTER LOOKUP COMPLETE!")
    print(f"{'='*80}")
    print(f"  Total rows written: {rows_written}")
    print(f"  Draft stat matches: {draft_matches}")
    print(f"  PAM folder matches: {pam_matches}")
    print(f"  Output: {output_file}")
    print(f"\nThis file follows the exact template structure with ALL required columns.")

if __name__ == '__main__':
    main()
