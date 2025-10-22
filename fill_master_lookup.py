import csv
import os
from pathlib import Path

# Paths
lookup_dir = Path(r'C:\Users\tshan\OneDrive\Documents\Madden Files\KNuttZFranchiseSandBox\madden-editor-suite\data\lookups')
master_file = lookup_dir / 'MASTER_PLAYER_LOOKUP.csv'

print("Loading MASTER_PLAYER_LOOKUP.csv...")
# Load master lookup
master_data = []
with open(master_file, 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    for row in reader:
        master_data.append(row)

print(f"Loaded {len(master_data)} rows from master file")

# Get all CSV files except master
all_csvs = [f for f in lookup_dir.glob('*.csv') if f.name != 'MASTER_PLAYER_LOOKUP.csv']
print(f"Found {len(all_csvs)} other lookup files")

# Process each lookup file
for csv_file in all_csvs:
    print(f"\nChecking {csv_file.name}...")

    try:
        with open(csv_file, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            lookup_data = list(reader)

        matches_found = 0
        fields_filled = 0

        # For each row in master
        for master_row in master_data:
            master_last = master_row.get('Last Name', '').strip()
            master_first = master_row.get('First Name', '').strip()

            if not master_last or not master_first:
                continue

            # Search for matching player in this lookup
            for lookup_row in lookup_data:
                # Try different column name variations
                lookup_last = (lookup_row.get('Last Name') or lookup_row.get('LastName') or
                              lookup_row.get('last_name') or lookup_row.get('lastName') or '').strip()
                lookup_first = (lookup_row.get('First Name') or lookup_row.get('FirstName') or
                               lookup_row.get('first_name') or lookup_row.get('firstName') or '').strip()

                # Match found
                if lookup_last.lower() == master_last.lower() and lookup_first.lower() == master_first.lower():
                    matches_found += 1

                    # Check and fill Height
                    if not master_row.get('Height') or master_row['Height'].strip() == '':
                        height = (lookup_row.get('Height') or lookup_row.get('height') or
                                 lookup_row.get('HGT') or '').strip()
                        if height:
                            master_row['Height'] = height
                            fields_filled += 1

                    # Check and fill Weight
                    if not master_row.get('Weight') or master_row['Weight'].strip() == '':
                        weight = (lookup_row.get('Weight') or lookup_row.get('weight') or
                                 lookup_row.get('WGT') or '').strip()
                        if weight:
                            master_row['Weight'] = weight
                            fields_filled += 1

                    # Check and fill PhotoID (PID)
                    if not master_row.get('PhotoID') or master_row['PhotoID'].strip() == '':
                        pid = (lookup_row.get('PhotoID') or lookup_row.get('PID') or
                              lookup_row.get('photo_id') or lookup_row.get('PhotoId') or '').strip()
                        if pid:
                            master_row['PhotoID'] = pid
                            fields_filled += 1

                    # Check and fill Player Assets ID (PAM)
                    if not master_row.get('Player Assets ID') or master_row['Player Assets ID'].strip() == '':
                        pam = (lookup_row.get('Player Assets ID') or lookup_row.get('PAM') or
                              lookup_row.get('PlayerAssetsID') or lookup_row.get('player_assets_id') or '').strip()
                        if pam:
                            master_row['Player Assets ID'] = pam
                            fields_filled += 1

                    # Check and fill isHOF
                    if not master_row.get('isHOF') or master_row['isHOF'].strip() == '':
                        hof = (lookup_row.get('isHOF') or lookup_row.get('HOF') or
                              lookup_row.get('is_hof') or '').strip()
                        if hof:
                            master_row['isHOF'] = hof
                            fields_filled += 1

                    break  # Found match, move to next master row

        if matches_found > 0:
            print(f"  [OK] {matches_found} player matches, {fields_filled} fields filled")

    except Exception as e:
        print(f"  [ERROR] Error processing {csv_file.name}: {str(e)}")

# Write updated master file
print(f"\nWriting updated MASTER_PLAYER_LOOKUP.csv...")
fieldnames = ['Last Name', 'First Name', 'College/Univ', 'Round', 'Pick', 'Draft Class',
              'Position', 'PhotoID', 'Player Assets ID', 'CommID', 'PLPO', 'Height', 'Weight',
              'From', 'To', 'AP1', 'PB', 'St', 'wAV', 'League', 'Race', 'Home State',
              'Wiki_Image_URL', 'PFR_Image_URL', 'isHOF']

with open(master_file, 'w', encoding='utf-8', newline='') as f:
    writer = csv.DictWriter(f, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(master_data)

print(f"[COMPLETE] Updated MASTER_PLAYER_LOOKUP.csv with {len(master_data)} rows")
