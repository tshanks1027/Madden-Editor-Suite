"""
Script to integrate NFL Draft data from all draft year files into enhanced_lookup
Reads HTML-formatted .xls files and extracts draft information
"""

import pandas as pd
from pathlib import Path
import csv

def load_draft_file(file_path):
    """
    Load draft data from an HTML .xls file
    Returns a DataFrame with player names, round, pick, position, college
    """
    try:
        # Read HTML table
        df = pd.read_html(str(file_path))[0]

        # Handle multi-level columns by flattening
        if isinstance(df.columns, pd.MultiIndex):
            # Get the second level which has the actual column names
            df.columns = [col[1] if col[1] != '' else col[0] for col in df.columns]

        # Extract year from filename
        year = file_path.stem.split()[0]  # Handle "1960 AFL" format

        # Keep only relevant columns
        result = pd.DataFrame()
        result['Player'] = df.get('Player', pd.Series())
        result['Round'] = df.get('Rnd', pd.Series())
        result['Pick'] = df.get('Pick', pd.Series())
        result['Position'] = df.get('Pos', pd.Series())
        result['College'] = df.get('College/Univ', pd.Series())
        result['Draft_Year'] = year

        # Remove rows with missing player names
        result = result[result['Player'].notna() & (result['Player'] != '')]

        return result

    except Exception as e:
        print(f"Error loading {file_path.name}: {e}")
        return None

def parse_player_name(full_name):
    """
    Parse a full player name into first and last name
    Handles formats like "Joe Montana" or "Montana, Joe"
    """
    if not full_name or pd.isna(full_name):
        return None, None

    full_name = str(full_name).strip()

    # Check if name is in "Last, First" format
    if ',' in full_name:
        parts = full_name.split(',')
        last_name = parts[0].strip()
        first_name = parts[1].strip() if len(parts) > 1 else ''
    else:
        # Assume "First Last" format
        parts = full_name.split()
        if len(parts) >= 2:
            first_name = parts[0]
            last_name = ' '.join(parts[1:])
        elif len(parts) == 1:
            first_name = ''
            last_name = parts[0]
        else:
            return None, None

    return first_name, last_name

def main():
    # Paths
    drafts_dir = Path(r"C:\Users\tshan\OneDrive\Documents\Madden Files\KNuttZFranchiseSandBox\Drafts")
    script_dir = Path(__file__).parent.parent
    input_csv = script_dir / 'data' / 'lookups' / 'enhanced_lookup_with_PAM.csv'
    output_csv = script_dir / 'data' / 'lookups' / 'enhanced_lookup_complete.csv'

    print("Loading all draft files...")
    all_drafts = []

    # Get all .xls files
    draft_files = sorted(drafts_dir.glob("*.xls"))
    print(f"Found {len(draft_files)} draft files\n")

    for file_path in draft_files:
        print(f"Processing {file_path.name}...", end=' ')
        df = load_draft_file(file_path)
        if df is not None and len(df) > 0:
            all_drafts.append(df)
            print(f"[OK] {len(df)} players")
        else:
            print("[SKIP]")

    # Combine all draft data
    print("\nCombining all draft data...")
    combined_drafts = pd.concat(all_drafts, ignore_index=True)
    print(f"[OK] Total draft records: {len(combined_drafts)}")

    # Create a lookup dictionary by player name
    print("\nCreating draft lookup dictionary...")
    draft_dict = {}

    for _, row in combined_drafts.iterrows():
        first, last = parse_player_name(row['Player'])
        if first and last:
            key = f"{first.lower()} {last.lower()}"
            # Store draft info (use first occurrence if duplicate)
            if key not in draft_dict:
                draft_dict[key] = {
                    'Draft_Year': row['Draft_Year'],
                    'Draft_Round': row['Round'],
                    'Draft_Pick': row['Pick'],
                    'Draft_Position': row['Position'],
                    'College': row['College']
                }

    print(f"[OK] Created lookup with {len(draft_dict)} unique players")

    # Now integrate with enhanced_lookup
    print(f"\nIntegrating with {input_csv.name}...")
    rows_processed = 0
    matches_found = 0

    with open(input_csv, 'r', encoding='utf-8', newline='') as infile:
        reader = csv.DictReader(infile)

        # Add new columns for draft data
        fieldnames = list(reader.fieldnames) + ['Draft_Year', 'Draft_Round', 'Draft_Pick', 'Draft_Position', 'College']

        with open(output_csv, 'w', encoding='utf-8', newline='') as outfile:
            writer = csv.DictWriter(outfile, fieldnames=fieldnames)
            writer.writeheader()

            for row in reader:
                rows_processed += 1

                # Create lookup key
                first_name = row.get('First Name', '').strip()
                last_name = row.get('Last Name', '').strip()

                if first_name and last_name:
                    key = f"{first_name.lower()} {last_name.lower()}"

                    if key in draft_dict:
                        draft_info = draft_dict[key]
                        row['Draft_Year'] = draft_info['Draft_Year']
                        row['Draft_Round'] = draft_info['Draft_Round']
                        row['Draft_Pick'] = draft_info['Draft_Pick']
                        row['Draft_Position'] = draft_info['Draft_Position']
                        row['College'] = draft_info['College']
                        matches_found += 1

                        if matches_found <= 10:
                            print(f"[OK] Matched: {first_name} {last_name} - Drafted {draft_info['Draft_Year']} Rd {draft_info['Draft_Round']}")
                    else:
                        row['Draft_Year'] = ''
                        row['Draft_Round'] = ''
                        row['Draft_Pick'] = ''
                        row['Draft_Position'] = ''
                        row['College'] = ''
                else:
                    row['Draft_Year'] = ''
                    row['Draft_Round'] = ''
                    row['Draft_Pick'] = ''
                    row['Draft_Position'] = ''
                    row['College'] = ''

                writer.writerow(row)

    print(f"\n[OK] Processing complete!")
    print(f"  Rows processed: {rows_processed}")
    print(f"  Draft matches found: {matches_found}")
    print(f"  Match rate: {matches_found/rows_processed*100:.1f}%")
    print(f"  Output: {output_csv}")
    print(f"\nYour enhanced lookup now has:")
    print(f"  - PAM_Folder column (player asset folders)")
    print(f"  - Draft_Year, Draft_Round, Draft_Pick columns")
    print(f"  - Draft_Position, College columns")

if __name__ == '__main__':
    main()
