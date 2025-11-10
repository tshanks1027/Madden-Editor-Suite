"""
Quick inspection script to understand Excel file structure
"""
import pandas as pd
import sys

# Read one Excel file
file_path = r'data\Madden Old Ratings\2010\arizona_cardinals__madden_nfl_10_.xlsx'
print(f"Inspecting: {file_path}\n")

# Read Excel file
df = pd.read_excel(file_path)

# Show basic info
print(f"Total rows: {len(df)}")
print(f"Total columns: {len(df.columns)}\n")

# Show column names
print("Columns:")
for i, col in enumerate(df.columns, 1):
    print(f"  {i}. {col}")

print("\n" + "="*80 + "\n")

# Show first 3 rows
print("First 3 rows:")
print(df.head(3).to_string())

print("\n" + "="*80 + "\n")

# Show data types
print("Data types:")
print(df.dtypes)
