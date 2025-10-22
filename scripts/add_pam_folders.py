"""
Script to add PAM folder names to enhanced_lookup_FINAL.csv
This will create a new column 'PAM_Folder' and attempt to match player names
Reads from pam_folders_complete.txt which contains all 1800+ folder names
"""

import csv
import os
from pathlib import Path

def load_pam_folders(pam_file_path):
    """
    Load all PAM folder names from pam_folders_complete.txt
    Returns a list of folder names
    """
    folders = []
    with open(pam_file_path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            # Skip comments and empty lines
            if not line or line.startswith('#'):
                continue
            folders.append(line)
    return folders

def parse_folder_name(folder_name):
    """
    Parse PAM folder name into last name and first name
    Examples:
        'westbrookDede_12618' -> ('westbrook', 'Dede')
        'WilliamsCaleb_14500' -> ('Williams', 'Caleb')
        'williamsaeneas' -> ('williams', 'aeneas')
        'gen_1_B_B_005' -> ('gen', '1')  # generic player
        'teen_1_b_n_1' -> ('teen', '1')  # teen player
    """
    # Skip generic and teen players for now (we can add these later if needed)
    if folder_name.startswith(('gen_', 'teen_', 'mut')):
        return (None, None)

    # Remove ID number if present
    name_part = folder_name.split('_')[0]

    # Find where uppercase letter appears (indicates start of first name)
    for i, char in enumerate(name_part):
        if i > 0 and char.isupper():
            last_name = name_part[:i]
            first_name = name_part[i:]
            return (last_name.lower(), first_name.lower())

    # If no uppercase found, it's likely all lowercase
    # Try to split intelligently (this is a fallback)
    return (name_part.lower(), '')

def match_player_to_folder(last_name, first_name, pam_folders_dict):
    """
    Try to match a player to a PAM folder
    """
    if not last_name or not first_name:
        return None

    # Create lookup key (all lowercase for matching)
    key = f"{last_name.lower()}{first_name.lower()}"

    # Direct match
    if key in pam_folders_dict:
        return pam_folders_dict[key]

    # Try with just last name (for cases where first name differs)
    matches = [folder for folder_key, folder in pam_folders_dict.items()
               if folder_key.startswith(last_name.lower())]

    if len(matches) == 1:
        # Only one player with this last name, likely a match
        return matches[0]
    elif len(matches) > 1:
        # Multiple players with same last name, try first initial match
        key_initial = f"{last_name.lower()}{first_name[0].lower()}" if first_name else None
        if key_initial:
            for folder_key, folder_name in pam_folders_dict.items():
                if folder_key == key_initial or folder_key.startswith(key_initial):
                    return folder_name

    return None

def main():
    # Paths
    script_dir = Path(__file__).parent.parent
    pam_file = script_dir / 'data' / 'lookups' / 'pam_folders_complete.txt'
    csv_path = script_dir / 'data' / 'lookups' / 'enhanced_lookup_FINAL.csv'
    output_path = script_dir / 'data' / 'lookups' / 'enhanced_lookup_with_PAM.csv'

    print("Loading PAM folder names...")
    pam_folders = load_pam_folders(pam_file)
    print(f"[OK] Loaded {len(pam_folders)} PAM folder names from {pam_file.name}")

    # Create PAM folders dictionary
    pam_dict = {}
    for folder in pam_folders:
        last, first = parse_folder_name(folder)
        if last and first is not None:  # Skip generic/teen/mut players
            key = f"{last}{first}".lower()
            pam_dict[key] = folder

    print(f"[OK] Created lookup dictionary with {len(pam_dict)} real player entries")
    print(f"Sample entries: {list(pam_dict.items())[:5]}")

    # Read the CSV and add PAM_Folder column
    print(f"\nProcessing {csv_path.name}...")
    rows_processed = 0
    matches_found = 0

    with open(csv_path, 'r', encoding='utf-8', newline='') as infile:
        reader = csv.DictReader(infile)
        fieldnames = list(reader.fieldnames) + ['PAM_Folder']

        with open(output_path, 'w', encoding='utf-8', newline='') as outfile:
            writer = csv.DictWriter(outfile, fieldnames=fieldnames)
            writer.writeheader()

            for row in reader:
                rows_processed += 1

                # Try to match
                pam_folder = match_player_to_folder(
                    row.get('Last Name', ''),
                    row.get('First Name', ''),
                    pam_dict
                )

                row['PAM_Folder'] = pam_folder if pam_folder else ''

                if pam_folder:
                    matches_found += 1
                    if matches_found <= 10:  # Show first 10 matches
                        print(f"[OK] Matched: {row['First Name']} {row['Last Name']} -> {pam_folder}")

                writer.writerow(row)

    print(f"\n[OK] Processing complete!")
    print(f"  Rows processed: {rows_processed}")
    print(f"  Matches found: {matches_found}")
    print(f"  Match rate: {matches_found/rows_processed*100:.1f}%")
    print(f"  Output: {output_path}")
    print(f"\nNext step: Review the output file and then replace enhanced_lookup_FINAL.csv if satisfied")

if __name__ == '__main__':
    main()
