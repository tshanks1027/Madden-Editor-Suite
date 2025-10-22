"""
Script to explore NFL Draft Excel files and understand their structure
"""

import pandas as pd
from pathlib import Path
import sys

def explore_draft_file(file_path):
    """
    Explore a single draft file to understand its structure
    """
    print(f"\n{'='*60}")
    print(f"Exploring: {file_path.name}")
    print(f"{'='*60}")

    try:
        # These are actually HTML files with .xls extension
        df = pd.read_html(str(file_path))[0]  # Read first table

        print(f"\nShape: {df.shape[0]} rows x {df.shape[1]} columns")
        print(f"\nColumns: {list(df.columns)}")
        print(f"\nFirst 5 rows:")
        print(df.head())
        print(f"\nSample data types:")
        print(df.dtypes)

        return df

    except Exception as e:
        print(f"Error reading {file_path.name}: {e}")
        return None

def main():
    # Path to Drafts folder
    drafts_dir = Path(r"C:\Users\tshan\OneDrive\Documents\Madden Files\KNuttZFranchiseSandBox\Drafts")

    # Get all .xls files
    draft_files = sorted(drafts_dir.glob("*.xls"))

    print(f"Found {len(draft_files)} draft files")

    # Explore a few sample files from different eras
    sample_years = ['1950.xls', '1970.xls', '1990.xls', '2010.xls', '2024.xls']

    for year_file in sample_years:
        file_path = drafts_dir / year_file
        if file_path.exists():
            df = explore_draft_file(file_path)

            if df is not None:
                # Try to identify key columns
                print(f"\nKey observations for {year_file}:")
                for col in df.columns:
                    col_lower = str(col).lower()
                    if 'name' in col_lower:
                        print(f"  - Found name column: '{col}'")
                    if 'pick' in col_lower or 'round' in col_lower:
                        print(f"  - Found draft position column: '{col}'")
                    if 'team' in col_lower or 'college' in col_lower:
                        print(f"  - Found team/college column: '{col}'")
                    if 'pos' in col_lower:
                        print(f"  - Found position column: '{col}'")
        else:
            print(f"\n{year_file} not found")

    print(f"\n{'='*60}")
    print("Exploration complete!")
    print(f"{'='*60}")

if __name__ == '__main__':
    main()
