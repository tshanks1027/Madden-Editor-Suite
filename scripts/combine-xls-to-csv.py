#!/usr/bin/env python3
"""
XLS Combiner and Merger Script
Combines multiple .xls files into a single CSV and optionally merges with Wikipedia data
"""

import pandas as pd
import os
import glob
from pathlib import Path
import re

def normalize_name(name):
    """Normalize player name for matching"""
    if not name or pd.isna(name):
        return ""
    # Remove extra whitespace, convert to lowercase for comparison
    return ' '.join(str(name).strip().split()).lower()

def combine_xls_files(input_folder, output_csv):
    """
    Combine all .xls files in a folder into a single CSV

    Args:
        input_folder: Path to folder containing .xls files
        output_csv: Path for output CSV file
    """
    print(f"\n=== Combining XLS Files ===")
    print(f"Input Folder: {input_folder}")
    print(f"Output CSV: {output_csv}")

    # Find all .xls and .xlsx files
    xls_files = glob.glob(os.path.join(input_folder, "*.xls"))
    xlsx_files = glob.glob(os.path.join(input_folder, "*.xlsx"))
    all_files = xls_files + xlsx_files

    if not all_files:
        print(f"ERROR: No .xls or .xlsx files found in {input_folder}")
        return None

    print(f"\nFound {len(all_files)} Excel files:")
    for f in all_files:
        print(f"  - {os.path.basename(f)}")

    # Read and combine all files
    all_data = []
    for file in all_files:
        try:
            print(f"\nReading {os.path.basename(file)}...", end=" ")
            df = pd.read_excel(file)
            print(f"✓ ({len(df)} rows)")
            all_data.append(df)
        except Exception as e:
            print(f"✗ ERROR: {e}")
            continue

    if not all_data:
        print("\nERROR: No data could be read from any files")
        return None

    # Combine all dataframes
    print("\nCombining data...")
    combined_df = pd.concat(all_data, ignore_index=True)

    # Remove duplicates (same player name + draft year)
    if 'Draft Class' in combined_df.columns or 'Year' in combined_df.columns:
        year_col = 'Draft Class' if 'Draft Class' in combined_df.columns else 'Year'
        if 'Last Name' in combined_df.columns and 'First Name' in combined_df.columns:
            before_count = len(combined_df)
            combined_df['_full_name'] = combined_df['Last Name'].astype(str) + ', ' + combined_df['First Name'].astype(str)
            combined_df = combined_df.drop_duplicates(subset=['_full_name', year_col], keep='first')
            combined_df = combined_df.drop(columns=['_full_name'])
            after_count = len(combined_df)
            removed = before_count - after_count
            if removed > 0:
                print(f"Removed {removed} duplicate entries")

    # Save to CSV
    combined_df.to_csv(output_csv, index=False)
    print(f"\n✓ Combined CSV saved: {output_csv}")
    print(f"Total rows: {len(combined_df)}")
    print(f"Columns: {', '.join(combined_df.columns)}")

    return combined_df

def merge_with_wikipedia(pfr_csv, wiki_csv, output_csv):
    """
    Merge PFR data with Wikipedia data

    Args:
        pfr_csv: Path to PFR CSV file (from combine_xls_files)
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
    print(f"✓ ({len(pfr_df)} rows)")

    print("Reading Wikipedia data...", end=" ")
    wiki_df = pd.read_csv(wiki_csv)
    print(f"✓ ({len(wiki_df)} rows)")

    # Create normalized name columns for matching
    pfr_df['_match_name'] = (pfr_df['Last Name'].fillna('') + ', ' + pfr_df['First Name'].fillna('')).apply(normalize_name)
    wiki_df['_match_name'] = (wiki_df['Last Name'].fillna('') + ', ' + wiki_df['First Name'].fillna('')).apply(normalize_name)

    # Determine year column names
    pfr_year_col = 'Draft Class' if 'Draft Class' in pfr_df.columns else 'Year'
    wiki_year_col = 'Draft Class' if 'Draft Class' in wiki_df.columns else 'Year'

    print(f"\nMatching on: Name + {pfr_year_col}")

    # Merge on name + year
    merged_df = wiki_df.merge(
        pfr_df,
        how='left',
        left_on=['_match_name', wiki_year_col],
        right_on=['_match_name', pfr_year_col],
        suffixes=('', '_pfr')
    )

    # Fill in missing columns from PFR data
    pfr_only_columns = ['wAV', 'From', 'To', 'AP1', 'PB', 'St']
    for col in pfr_only_columns:
        if col in pfr_df.columns:
            if col not in wiki_df.columns:
                # Column doesn't exist in wiki, use PFR value
                merged_df[col] = merged_df[col + '_pfr'] if col + '_pfr' in merged_df.columns else None
            else:
                # Column exists in wiki, fill nulls with PFR value
                pfr_col = col + '_pfr'
                if pfr_col in merged_df.columns:
                    merged_df[col] = merged_df[col].fillna(merged_df[pfr_col])

    # For other columns, prefer wiki data but fill with PFR if missing
    for col in ['Height', 'Weight', 'College/Univ', 'Position']:
        if col in wiki_df.columns and col + '_pfr' in merged_df.columns:
            merged_df[col] = merged_df[col].fillna(merged_df[col + '_pfr'])

    # Add PFR image URL if available
    if 'PFR_Image_URL' in pfr_df.columns:
        if 'PFR_Image_URL' not in wiki_df.columns:
            merged_df['PFR_Image_URL'] = merged_df['PFR_Image_URL_pfr'] if 'PFR_Image_URL_pfr' in merged_df.columns else None
        else:
            if 'PFR_Image_URL_pfr' in merged_df.columns:
                merged_df['PFR_Image_URL'] = merged_df['PFR_Image_URL'].fillna(merged_df['PFR_Image_URL_pfr'])

    # Drop duplicate columns (ones with _pfr suffix)
    cols_to_drop = [col for col in merged_df.columns if col.endswith('_pfr') or col == '_match_name']
    merged_df = merged_df.drop(columns=cols_to_drop)

    # Save merged data
    merged_df.to_csv(output_csv, index=False)

    print(f"\n✓ Merged CSV saved: {output_csv}")
    print(f"Total rows: {len(merged_df)}")

    # Stats
    wiki_only = len(merged_df[merged_df[pfr_year_col + '_pfr'].isna()]) if pfr_year_col + '_pfr' in merged_df.columns else 0
    matched = len(merged_df) - wiki_only

    print(f"\nMerge Statistics:")
    print(f"  Matched (Wiki + PFR): {matched}")
    print(f"  Wiki only: {wiki_only}")
    print(f"  Match rate: {(matched / len(merged_df) * 100):.1f}%")

    return merged_df

if __name__ == "__main__":
    import sys

    if len(sys.argv) < 3:
        print("\n=== XLS Combiner and Merger ===")
        print("\nUsage:")
        print("  1. Combine XLS files only:")
        print("     python combine-xls-to-csv.py <input_folder> <output_csv>")
        print("\n  2. Combine XLS files AND merge with Wikipedia:")
        print("     python combine-xls-to-csv.py <input_folder> <output_csv> <wiki_csv> <merged_output_csv>")
        print("\nExample:")
        print('  python combine-xls-to-csv.py "C:/PFR_Data" "pfr_combined.csv"')
        print('  python combine-xls-to-csv.py "C:/PFR_Data" "pfr_combined.csv" "enhanced_lookup_FINAL.csv" "merged_lookup.csv"')
        sys.exit(1)

    input_folder = sys.argv[1]
    output_csv = sys.argv[2]

    # Combine XLS files
    combined_df = combine_xls_files(input_folder, output_csv)

    if combined_df is None:
        print("\nERROR: Failed to combine XLS files")
        sys.exit(1)

    # If wiki CSV and merged output specified, do the merge
    if len(sys.argv) >= 5:
        wiki_csv = sys.argv[3]
        merged_output = sys.argv[4]

        if not os.path.exists(wiki_csv):
            print(f"\nERROR: Wikipedia CSV not found: {wiki_csv}")
            sys.exit(1)

        merge_with_wikipedia(output_csv, wiki_csv, merged_output)

    print("\n✓ All done!")
