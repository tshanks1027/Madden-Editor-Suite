import pandas as pd
import os
import sys

# Inspect the structure of the Madden ratings files
madden_dir = r"c:\Users\tshan\Documents\Dev\madden-editor-suite\data\Madden Old Ratings"

print("=" * 80)
print("INSPECTING MADDEN RATINGS FILE STRUCTURE")
print("=" * 80)

# Check 2002 Rosters.xlsx structure
print("\n2002 Rosters.xlsx:")
print("-" * 80)
try:
    excel_file = pd.ExcelFile(os.path.join(madden_dir, "2002 Rosters.xlsx"))
    print(f"Sheets: {excel_file.sheet_names}")

    # Read first sheet to see structure
    first_sheet = excel_file.sheet_names[0]
    df = pd.read_excel(excel_file, sheet_name=first_sheet, nrows=3)
    print(f"\nFirst sheet ({first_sheet}) columns:")
    print(df.columns.tolist())
    print(f"\nSample data:")
    print(df.head())
except Exception as e:
    print(f"Error: {e}")

# Check 2007 individual team files
print("\n\n2007 Team Files (sample - arizona_cardinals):")
print("-" * 80)
try:
    sample_file = os.path.join(madden_dir, "2007", "arizona_cardinals_madden_nfl_07.xlsx")
    excel_file = pd.ExcelFile(sample_file)
    print(f"Sheets: {excel_file.sheet_names}")

    first_sheet = excel_file.sheet_names[0]
    df = pd.read_excel(excel_file, sheet_name=first_sheet, nrows=3)
    print(f"\nSheet ({first_sheet}) columns:")
    print(df.columns.tolist())
    print(f"\nSample data:")
    print(df.head())
except Exception as e:
    print(f"Error: {e}")

# Check 2013 Roster.xlsx
print("\n\n2013 Roster.xlsx:")
print("-" * 80)
try:
    excel_file = pd.ExcelFile(os.path.join(madden_dir, "2013 Roster.xlsx"))
    print(f"Sheets: {excel_file.sheet_names}")

    first_sheet = excel_file.sheet_names[0]
    df = pd.read_excel(excel_file, sheet_name=first_sheet, nrows=3)
    print(f"\nFirst sheet ({first_sheet}) columns:")
    print(df.columns.tolist())
    print(f"\nSample data:")
    print(df.head())
except Exception as e:
    print(f"Error: {e}")

# Check 2008 directory structure
print("\n\n2008 Directory:")
print("-" * 80)
try:
    dir_2008 = os.path.join(madden_dir, "2008")
    files = os.listdir(dir_2008)
    print(f"Files found: {len(files)}")
    if files:
        print(f"Sample files: {files[:5]}")
        # Try to read first file
        if files[0].endswith('.xlsx'):
            sample_file = os.path.join(dir_2008, files[0])
            excel_file = pd.ExcelFile(sample_file)
            print(f"\nSample file ({files[0]}) sheets: {excel_file.sheet_names}")
            df = pd.read_excel(excel_file, sheet_name=excel_file.sheet_names[0], nrows=3)
            print(f"Columns: {df.columns.tolist()}")
except Exception as e:
    print(f"Error: {e}")

print("\n" + "=" * 80)
print("INSPECTION COMPLETE")
print("=" * 80)
