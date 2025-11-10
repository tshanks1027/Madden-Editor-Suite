"""
Check 2022 roster file structure
"""
import pandas as pd

# Read 2022 roster file
file_path = r'data\Madden Old Ratings\2022 Rosters.xlsx'
print(f"Inspecting: {file_path}\n")

# Check if file has multiple sheets
xl_file = pd.ExcelFile(file_path)
print(f"Sheet names: {xl_file.sheet_names}\n")

# Read first sheet
df = pd.read_excel(file_path, sheet_name=0)

# Show basic info
print(f"Total rows: {len(df)}")
print(f"Total columns: {len(df.columns)}\n")

# Show column names
print("Columns:")
for i, col in enumerate(df.columns, 1):
    print(f"  {i}. {col}")

print("\n" + "="*80 + "\n")

# Show first 2 rows
print("First 2 rows:")
print(df.head(2).to_string())
