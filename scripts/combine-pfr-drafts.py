#!/usr/bin/env python3
"""
PFR Draft Combiner Script
Combines Pro Football Reference draft HTML files (.xls) into a single CSV
Handles special format for 1960 AFL draft (sorted by team, no round/pick columns)
"""

import pandas as pd
import os
import glob
import re
from pathlib import Path

def normalize_name(name):
    """Normalize player name for matching"""
    if not name or pd.isna(name):
        return ""
    # Remove extra whitespace, convert to lowercase for comparison
    return ' '.join(str(name).strip().split()).lower()

def parse_year_from_filename(filename):
    """Extract year from filename like '2024.xls' or '1960 AFL.xls'"""
    basename = os.path.basename(filename)
    # Try to find year pattern
    match = re.search(r'(\d{4})', basename)
    if match:
        return int(match.group(1))
    return None

def is_afl_draft(filename):
    """Check if this is an AFL draft file"""
    return 'AFL' in os.path.basename(filename).upper()

def read_regular_draft(filepath, year):
    """Read a regular PFR draft file (has Rnd and Pick columns)"""
    print(f"  Reading {os.path.basename(filepath)} (regular format)...", end=" ")

    # Read HTML table
    df = pd.read_html(filepath)[0]

    # Flatten multi-level columns
    if isinstance(df.columns, pd.MultiIndex):
        # Get the second level of column names (the actual column names)
        df.columns = [col[1] if col[1] and col[1] != col[0] else col[0] for col in df.columns.values]

    # Add Draft Class column
    df['Draft Class'] = year

    # Rename columns to match our schema
    column_map = {
        'Player': 'Player',
        'Pos': 'Position',
        'College/Univ': 'College/Univ',
        'Rnd': 'Round',
        'Pick': 'Pick',
        'wAV': 'wAV',
        'To': 'To',
        'AP1': 'AP1',
        'PB': 'PB',
        'St': 'St'
    }

    # Rename existing columns
    for old_col, new_col in column_map.items():
        if old_col in df.columns:
            df.rename(columns={old_col: new_col}, inplace=True)

    # Split player name into Last Name, First Name
    if 'Player' in df.columns:
        # Most PFR names are in "First Last" format
        def split_name(full_name):
            if pd.isna(full_name) or not full_name:
                return pd.Series({'Last Name': '', 'First Name': ''})

            full_name = str(full_name).strip()

            # Handle "Last, First" format
            if ',' in full_name:
                parts = full_name.split(',', 1)
                return pd.Series({'Last Name': parts[0].strip(), 'First Name': parts[1].strip()})

            # Handle "First Last" format
            parts = full_name.rsplit(' ', 1)  # Split from right to handle "First Middle Last"
            if len(parts) == 2:
                return pd.Series({'Last Name': parts[1].strip(), 'First Name': parts[0].strip()})
            else:
                # Single name - put in Last Name
                return pd.Series({'Last Name': full_name, 'First Name': ''})

        name_parts = df['Player'].apply(split_name)
        df['Last Name'] = name_parts['Last Name']
        df['First Name'] = name_parts['First Name']
        df.drop(columns=['Player'], inplace=True)

    # Select and reorder columns we need
    keep_columns = ['Last Name', 'First Name', 'College/Univ', 'Round', 'Pick', 'Draft Class',
                    'Position', 'wAV', 'To', 'AP1', 'PB', 'St']

    # Keep only columns that exist
    keep_columns = [col for col in keep_columns if col in df.columns]
    df = df[keep_columns]

    print(f"OK ({len(df)} players)")
    return df

def read_1960_afl_draft(filepath, year):
    """Read 1960 AFL draft file (special format: sorted by team, no Rnd/Pick)"""
    print(f"  Reading {os.path.basename(filepath)} (1960 AFL special format)...", end=" ")

    # Read HTML table
    df = pd.read_html(filepath)[0]

    # Flatten multi-level columns
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = [col[1] if col[1] and col[1] != col[0] else col[0] for col in df.columns.values]

    # Add Draft Class column
    df['Draft Class'] = year

    # Add Round and Pick as empty (not available for 1960 AFL)
    df['Round'] = ''
    df['Pick'] = ''

    # Rename columns
    column_map = {
        'Player': 'Player',
        'Pos': 'Position',
        'College/Univ': 'College/Univ',
        'wAV': 'wAV',
        'To': 'To',
        'AP1': 'AP1',
        'PB': 'PB',
        'St': 'St'
    }

    for old_col, new_col in column_map.items():
        if old_col in df.columns:
            df.rename(columns={old_col: new_col}, inplace=True)

    # Split player name into Last Name, First Name
    if 'Player' in df.columns:
        def split_name(full_name):
            if pd.isna(full_name) or not full_name:
                return pd.Series({'Last Name': '', 'First Name': ''})

            full_name = str(full_name).strip()

            if ',' in full_name:
                parts = full_name.split(',', 1)
                return pd.Series({'Last Name': parts[0].strip(), 'First Name': parts[1].strip()})

            parts = full_name.rsplit(' ', 1)
            if len(parts) == 2:
                return pd.Series({'Last Name': parts[1].strip(), 'First Name': parts[0].strip()})
            else:
                return pd.Series({'Last Name': full_name, 'First Name': ''})

        name_parts = df['Player'].apply(split_name)
        df['Last Name'] = name_parts['Last Name']
        df['First Name'] = name_parts['First Name']
        df.drop(columns=['Player'], inplace=True)

    # Select and reorder columns
    keep_columns = ['Last Name', 'First Name', 'College/Univ', 'Round', 'Pick', 'Draft Class',
                    'Position', 'wAV', 'To', 'AP1', 'PB', 'St']

    keep_columns = [col for col in keep_columns if col in df.columns]
    df = df[keep_columns]

    print(f"OK ({len(df)} players)")
    return df

def combine_pfr_drafts(input_folder, output_csv):
    """
    Combine all PFR draft .xls files into a single CSV

    Args:
        input_folder: Path to folder containing draft .xls files
        output_csv: Path for output CSV file
    """
    print(f"\n=== Combining PFR Draft Files ===")
    print(f"Input Folder: {input_folder}")
    print(f"Output CSV: {output_csv}")

    # Find all .xls files
    xls_files = glob.glob(os.path.join(input_folder, "*.xls"))

    if not xls_files:
        print(f"ERROR: No .xls files found in {input_folder}")
        return None

    print(f"\nFound {len(xls_files)} draft files")

    # Read and combine all files
    all_data = []
    errors = []

    for file in sorted(xls_files):
        year = parse_year_from_filename(file)
        if not year:
            print(f"  Skipping {os.path.basename(file)} - cannot determine year")
            continue

        try:
            # Check if this is the special 1960 AFL draft
            if year == 1960 and is_afl_draft(file):
                df = read_1960_afl_draft(file, year)
            else:
                df = read_regular_draft(file, year)

            all_data.append(df)
        except Exception as e:
            error_msg = f"  X ERROR reading {os.path.basename(file)}: {e}"
            print(error_msg)
            errors.append(error_msg)
            continue

    if not all_data:
        print("\nERROR: No data could be read from any files")
        return None

    # Combine all dataframes
    print("\nCombining data...")
    combined_df = pd.concat(all_data, ignore_index=True)

    # Remove duplicates (same player name + draft year)
    before_count = len(combined_df)
    combined_df['_match_name'] = (combined_df['Last Name'].fillna('') + ', ' + combined_df['First Name'].fillna('')).apply(normalize_name)
    combined_df = combined_df.drop_duplicates(subset=['_match_name', 'Draft Class'], keep='first')
    combined_df = combined_df.drop(columns=['_match_name'])
    after_count = len(combined_df)
    removed = before_count - after_count
    if removed > 0:
        print(f"Removed {removed} duplicate entries")

    # Save to CSV
    combined_df.to_csv(output_csv, index=False)
    print(f"\nOK Combined CSV saved: {output_csv}")
    print(f"Total rows: {len(combined_df)}")
    print(f"Columns: {', '.join(combined_df.columns)}")
    print(f"Year range: {combined_df['Draft Class'].min()}-{combined_df['Draft Class'].max()}")

    if errors:
        print(f"\nWARNING: {len(errors)} files had errors:")
        for error in errors:
            print(error)

    return combined_df

def merge_with_wikipedia(pfr_csv, wiki_csv, output_csv):
    """
    Merge PFR data with Wikipedia data

    Args:
        pfr_csv: Path to PFR CSV file (from combine_pfr_drafts)
        wiki_csv: Path to Wikipedia CSV file
        output_csv: Path for merged output CSV
    """
    print(f"\n=== Merging PFR with Wikipedia Data ===")
    print(f"PFR CSV: {pfr_csv}")
    print(f"Wiki CSV: {wiki_csv}")
    print(f"Output CSV: {output_csv}")

    # Read both CSVs
    print("\nReading PFR data...", end=" ")
    pfr_df = pd.read_csv(pfr_csv)
    print(f"OK ({len(pfr_df)} rows)")

    print("Reading Wikipedia data...", end=" ")
    wiki_df = pd.read_csv(wiki_csv)
    print(f"OK ({len(wiki_df)} rows)")

    # Create normalized name columns for matching
    pfr_df['_match_name'] = (pfr_df['Last Name'].fillna('') + ', ' + pfr_df['First Name'].fillna('')).apply(normalize_name)
    wiki_df['_match_name'] = (wiki_df['Last Name'].fillna('') + ', ' + wiki_df['First Name'].fillna('')).apply(normalize_name)

    print(f"\nMatching on: Name + Draft Class")

    # Merge on name + year
    merged_df = wiki_df.merge(
        pfr_df,
        how='left',
        left_on=['_match_name', 'Draft Class'],
        right_on=['_match_name', 'Draft Class'],
        suffixes=('', '_pfr')
    )

    # Fill in missing columns from PFR data
    pfr_only_columns = ['wAV', 'To', 'AP1', 'PB', 'St']
    for col in pfr_only_columns:
        pfr_col = col + '_pfr'
        if pfr_col in merged_df.columns:
            if col not in wiki_df.columns:
                # Column doesn't exist in wiki, use PFR value
                merged_df[col] = merged_df[pfr_col]
            else:
                # Column exists in wiki, fill nulls with PFR value
                merged_df[col] = merged_df[col].fillna(merged_df[pfr_col])

    # For other columns, prefer wiki data but fill with PFR if missing
    for col in ['Height', 'Weight', 'College/Univ', 'Position']:
        pfr_col = col + '_pfr'
        if col in wiki_df.columns and pfr_col in merged_df.columns:
            merged_df[col] = merged_df[col].fillna(merged_df[pfr_col])

    # Drop duplicate columns (ones with _pfr suffix)
    cols_to_drop = [col for col in merged_df.columns if col.endswith('_pfr') or col == '_match_name']
    merged_df = merged_df.drop(columns=cols_to_drop)

    # Save merged data
    merged_df.to_csv(output_csv, index=False)

    print(f"\nOK Merged CSV saved: {output_csv}")
    print(f"Total rows: {len(merged_df)}")

    # Stats
    # Count how many players got PFR data by checking if wAV column has values
    if 'wAV' in merged_df.columns:
        matched = merged_df['wAV'].notna().sum()
        wiki_only = len(merged_df) - matched
        print(f"\nMerge Statistics:")
        print(f"  Players with PFR data: {matched}")
        print(f"  Wiki only: {wiki_only}")
        print(f"  Match rate: {(matched / len(merged_df) * 100):.1f}%")

    return merged_df

if __name__ == "__main__":
    import sys

    if len(sys.argv) < 3:
        print("\n=== PFR Draft Combiner ===")
        print("\nUsage:")
        print("  1. Combine PFR draft files only:")
        print("     python combine-pfr-drafts.py <input_folder> <output_csv>")
        print("\n  2. Combine PFR drafts AND merge with Wikipedia:")
        print("     python combine-pfr-drafts.py <input_folder> <output_csv> <wiki_csv> <merged_output_csv>")
        print("\nExample:")
        print('  python combine-pfr-drafts.py "../Drafts" "data/lookups/pfr_combined.csv"')
        print('  python combine-pfr-drafts.py "../Drafts" "data/lookups/pfr_combined.csv" "data/lookups/enhanced_lookup_FINAL.csv" "data/lookups/merged_lookup.csv"')
        sys.exit(1)

    input_folder = sys.argv[1]
    output_csv = sys.argv[2]

    # Combine PFR draft files
    combined_df = combine_pfr_drafts(input_folder, output_csv)

    if combined_df is None:
        print("\nERROR: Failed to combine PFR draft files")
        sys.exit(1)

    # If wiki CSV and merged output specified, do the merge
    if len(sys.argv) >= 5:
        wiki_csv = sys.argv[3]
        merged_output = sys.argv[4]

        if not os.path.exists(wiki_csv):
            print(f"\nERROR: Wikipedia CSV not found: {wiki_csv}")
            sys.exit(1)

        merge_with_wikipedia(output_csv, wiki_csv, merged_output)

    print("\nOK All done!")
