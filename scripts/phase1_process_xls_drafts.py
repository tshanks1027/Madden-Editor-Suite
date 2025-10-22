#!/usr/bin/env python3
"""
Phase 1: Process XLS Draft Files (PRIMARY SOURCE)

Reads all XLS draft files (1936-2025, including AFL) and extracts player data.
These are HTML tables saved as .xls files from Pro Football Reference.

Output: phase1_drafted_players.csv
"""

import pandas as pd
import os
import re
from pathlib import Path

# Paths
base_dir = Path(__file__).parent.parent
drafts_dir = Path("C:/Users/tshan/OneDrive/Documents/Madden Files/KNuttZFranchiseSandBox/Drafts")
output_dir = base_dir / "data" / "lookups"
output_file = output_dir / "phase1_drafted_players.csv"

# Output columns (matching template format)
OUTPUT_COLUMNS = [
    'Last Name', 'First Name', 'College/Univ', 'Round', 'Pick', 'Draft Class',
    'Position', 'PhotoID', 'Player Assets ID', 'CommID', 'PLPO',
    'Height', 'Weight', 'From', 'To', 'AP1', 'PB', 'St', 'wAV', 'League',
    'Race', 'Home State', 'Wiki_Image_URL', 'PFR_Image_URL', 'isHOF'
]

def parse_player_name(full_name):
    """
    Parse player name into first and last name.

    Handles:
    - "Terry Bradshaw HOF" -> first="Terry", last="Bradshaw", hof=True
    - "Jay Berwanger" -> first="Jay", last="Berwanger", hof=False
    - "T.J. Slaton" -> first="T.J.", last="Slaton", hof=False
    """
    full_name = str(full_name).strip()

    # Check for HOF suffix
    is_hof = False
    if full_name.endswith(' HOF'):
        is_hof = True
        full_name = full_name[:-4].strip()

    # Split name into parts
    parts = full_name.split()

    if len(parts) == 0:
        return '', '', is_hof
    elif len(parts) == 1:
        # Only last name provided
        return '', parts[0], is_hof
    else:
        # First name is everything except last part
        first_name = ' '.join(parts[:-1])
        last_name = parts[-1]
        return first_name, last_name, is_hof

def extract_draft_year_from_filename(filename):
    """Extract draft year from filename (e.g., '2024.xls' -> 2024)"""
    # Match pattern like "2024.xls" or "1960 AFL.xls"
    match = re.search(r'(\d{4})', filename)
    if match:
        return match.group(1)
    return None

def is_afl_file(filename):
    """Check if this is an AFL draft file"""
    return 'AFL' in filename.upper()

def is_1960_afl_special_case(filename):
    """Check if this is the special 1960 AFL file (no Rnd/Pick columns)"""
    return '1960' in filename and 'AFL' in filename.upper()

def flatten_columns(df):
    """Flatten multi-level column headers from HTML table"""
    if isinstance(df.columns[0], tuple):
        # Multi-level columns - use the second level (actual column name)
        new_cols = []
        for i, col in enumerate(df.columns):
            if len(col) > 1:
                # Prefer non-empty second level
                if col[1] and not col[1].startswith('Unnamed:'):
                    new_cols.append(col[1])
                else:
                    new_cols.append(col[0])
            else:
                new_cols.append(col[0])
        df.columns = new_cols
    return df

def process_xls_file(filepath):
    """Process a single XLS draft file and return list of player records"""
    filename = os.path.basename(filepath)
    print(f"\n{'='*60}")
    print(f"Processing: {filename}")

    try:
        # Read HTML table
        tables = pd.read_html(filepath)
        if not tables:
            print(f"  WARNING: No tables found in {filename}")
            return []

        df = tables[0]
        df = flatten_columns(df)

        # Extract metadata from filename
        draft_year = extract_draft_year_from_filename(filename)
        is_afl = is_afl_file(filename)
        is_special_1960 = is_1960_afl_special_case(filename)
        league = 'AFL' if is_afl else 'NFL'

        print(f"  Draft Year: {draft_year}")
        print(f"  League: {league}")
        print(f"  Rows: {len(df)}")

        # Check if required columns exist
        required_cols = ['Player']
        missing_cols = [col for col in required_cols if col not in df.columns]
        if missing_cols:
            print(f"  ERROR: Missing columns: {missing_cols}")
            return []

        # Process each row
        players = []
        for idx, row in df.iterrows():
            # Skip rows with no player name
            player_name = str(row.get('Player', '')).strip()
            if not player_name or player_name == 'nan' or player_name == '':
                continue

            # Parse name
            first_name, last_name, is_hof = parse_player_name(player_name)
            if not last_name:
                continue

            # Extract data
            player_data = {
                'Last Name': last_name,
                'First Name': first_name,
                'College/Univ': str(row.get('College/Univ', '')).strip() if pd.notna(row.get('College/Univ')) else '',
                'Position': str(row.get('Pos', '')).strip().upper() if pd.notna(row.get('Pos')) else '',
                'Draft Class': draft_year,
                'League': league,
                'isHOF': 'True' if is_hof else 'False',

                # Stats from PFR
                'To': str(int(row['To'])) if pd.notna(row.get('To')) else '',
                'AP1': str(int(row['AP1'])) if pd.notna(row.get('AP1')) else '0',
                'PB': str(int(row['PB'])) if pd.notna(row.get('PB')) else '0',
                'St': str(int(row['St'])) if pd.notna(row.get('St')) else '0',
                'wAV': str(row['wAV']) if pd.notna(row.get('wAV')) else '',

                # Empty fields (filled in later phases)
                'PhotoID': '',
                'Player Assets ID': '',
                'CommID': '',
                'PLPO': '',
                'Height': '',
                'Weight': '',
                'From': draft_year,  # Career start = draft year
                'Race': '',
                'Home State': '',
                'Wiki_Image_URL': '',
                'PFR_Image_URL': ''
            }

            # Handle Round and Pick
            if is_special_1960:
                # 1960 AFL special case - no draft, all undrafted
                player_data['Round'] = 'UD'
                player_data['Pick'] = 'UD'
            else:
                # Normal draft file with Rnd/Pick columns
                rnd = row.get('Rnd', '')
                pick = row.get('Pick', '')

                player_data['Round'] = str(int(rnd)) if pd.notna(rnd) else ''
                player_data['Pick'] = str(int(pick)) if pd.notna(pick) else ''

            players.append(player_data)

        print(f"  OK: Extracted {len(players)} players")
        return players

    except Exception as e:
        print(f"  ERROR: {e}")
        import traceback
        traceback.print_exc()
        return []

def main():
    print("="*80)
    print("PHASE 1: PROCESS XLS DRAFT FILES")
    print("="*80)
    print(f"Input directory: {drafts_dir}")
    print(f"Output file: {output_file}")

    # Find all XLS files
    xls_files = sorted(drafts_dir.glob("*.xls"))
    print(f"\nFound {len(xls_files)} XLS files")

    # Process all files
    all_players = []
    processed_count = 0
    error_count = 0

    for filepath in xls_files:
        players = process_xls_file(filepath)
        if players:
            all_players.extend(players)
            processed_count += 1
        else:
            error_count += 1

    print(f"\n{'='*80}")
    print("SUMMARY")
    print(f"{'='*80}")
    print(f"Files processed: {processed_count}")
    print(f"Files with errors: {error_count}")
    print(f"Total players extracted: {len(all_players)}")

    # Convert to DataFrame and save
    df = pd.DataFrame(all_players, columns=OUTPUT_COLUMNS)

    # Sort by Draft Class, Round, Pick
    df['_sort_draft'] = pd.to_numeric(df['Draft Class'], errors='coerce')
    df['_sort_round'] = pd.to_numeric(df['Round'].replace('UD', '999'), errors='coerce')
    df['_sort_pick'] = pd.to_numeric(df['Pick'].replace('UD', '999'), errors='coerce')

    df = df.sort_values(['_sort_draft', '_sort_round', '_sort_pick'])
    df = df.drop(columns=['_sort_draft', '_sort_round', '_sort_pick'])

    # Save to CSV
    output_file.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(output_file, index=False, encoding='utf-8')

    print(f"\nSUCCESS: Created {output_file}")
    print(f"  Total players: {len(df)}")

    # Sample verification
    print("\nSample records:")
    print("\n1936 - First draft pick ever:")
    first_1936 = df[df['Draft Class'] == '1936'].head(1)
    if not first_1936.empty:
        print(f"  {first_1936.iloc[0]['First Name']} {first_1936.iloc[0]['Last Name']} - {first_1936.iloc[0]['College/Univ']}")

    print("\n1970 - Terry Bradshaw:")
    bradshaw = df[(df['Last Name'] == 'Bradshaw') & (df['First Name'] == 'Terry')]
    if not bradshaw.empty:
        print(f"  Round {bradshaw.iloc[0]['Round']}, Pick {bradshaw.iloc[0]['Pick']}")
        print(f"  isHOF: {bradshaw.iloc[0]['isHOF']}")
        print(f"  wAV: {bradshaw.iloc[0]['wAV']}")

    print("\n2024 - Caleb Williams:")
    caleb = df[(df['Last Name'] == 'Williams') & (df['First Name'] == 'Caleb')]
    if not caleb.empty:
        print(f"  Round {caleb.iloc[0]['Round']}, Pick {caleb.iloc[0]['Pick']}")
        print(f"  College: {caleb.iloc[0]['College/Univ']}")

    print("\nDone!")

if __name__ == '__main__':
    main()
