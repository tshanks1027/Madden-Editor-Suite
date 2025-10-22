"""
Script to examine ALL available data sources and list their columns
This will help create a comprehensive mapping template
"""

import pandas as pd
from pathlib import Path
import csv

def examine_draft_file(file_path):
    """Examine a draft XLS file and show ALL columns"""
    try:
        df = pd.read_html(str(file_path))[0]

        # Handle multi-level columns
        if isinstance(df.columns, pd.MultiIndex):
            columns = [f"{col[0]}_{col[1]}" if col[1] else col[0] for col in df.columns]
        else:
            columns = list(df.columns)

        return columns, df.head(3)
    except Exception as e:
        return None, str(e)

def examine_csv_file(file_path):
    """Examine a CSV file and show ALL columns"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            columns = reader.fieldnames
            # Get first 3 rows
            rows = []
            for i, row in enumerate(reader):
                if i >= 3:
                    break
                rows.append(row)
        return columns, rows
    except Exception as e:
        return None, str(e)

def main():
    base_dir = Path(r"C:\Users\tshan\OneDrive\Documents\Madden Files\KNuttZFranchiseSandBox")

    print("="*80)
    print("EXAMINING ALL DATA SOURCES")
    print("="*80)

    # 1. Examine Draft Files
    print("\n1. DRAFT FILES (XLS)")
    print("-"*80)
    draft_file = base_dir / "Drafts" / "2024.xls"
    cols, sample = examine_draft_file(draft_file)
    if cols:
        print(f"Sample file: {draft_file.name}")
        print(f"Total columns: {len(cols)}")
        print("\nALL COLUMNS:")
        for i, col in enumerate(cols, 1):
            print(f"  {i:2d}. {col}")
        print("\nSample data (first 3 rows):")
        print(sample)

    # 2. Examine Enhanced Lookup CSV files
    print("\n\n2. ENHANCED LOOKUP FILES (CSV)")
    print("-"*80)
    lookup_dir = base_dir / "madden-editor-suite" / "data" / "lookups"

    csv_files = [
        "enhanced_lookup_FINAL.csv",
        "enhanced_lookup_with_PAM.csv",
        "enhanced_lookup_complete.csv"
    ]

    for csv_file in csv_files:
        csv_path = lookup_dir / csv_file
        if csv_path.exists():
            print(f"\nFile: {csv_file}")
            cols, sample = examine_csv_file(csv_path)
            if cols:
                print(f"Total columns: {len(cols)}")
                print("Columns:", ", ".join(cols))

    # 3. Examine PAM folders list
    print("\n\n3. PAM FOLDERS LIST")
    print("-"*80)
    pam_file = lookup_dir / "pam_folders_complete.txt"
    if pam_file.exists():
        with open(pam_file, 'r', encoding='utf-8') as f:
            lines = [line.strip() for line in f if line.strip() and not line.startswith('#')]
        print(f"File: {pam_file.name}")
        print(f"Total entries: {len(lines)}")
        print(f"Sample entries: {lines[:5]}")

    # 4. Look for PID lookup files
    print("\n\n4. PID LOOKUP FILES")
    print("-"*80)
    pid_files = list(lookup_dir.glob("*pid*.csv")) + list(lookup_dir.glob("*PID*.csv"))
    if pid_files:
        for pid_file in pid_files:
            print(f"\nFound: {pid_file.name}")
            cols, sample = examine_csv_file(pid_file)
            if cols:
                print(f"Columns: {', '.join(cols)}")
    else:
        print("No PID files found - please specify the PID file location")

    # 5. Look for XML files
    print("\n\n5. XML FILES")
    print("-"*80)
    xml_files = list(base_dir.rglob("*.xml"))[:5]  # First 5 XML files
    if xml_files:
        for xml_file in xml_files:
            print(f"Found: {xml_file.relative_to(base_dir)}")
    else:
        print("No XML files found in search")

    print("\n\n" + "="*80)
    print("Please provide a template showing which columns from which files")
    print("should be combined into the final lookup table.")
    print("="*80)

if __name__ == '__main__':
    main()
