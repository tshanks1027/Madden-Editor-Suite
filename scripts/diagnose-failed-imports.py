import pandas as pd
import os

madden_dir = r"c:\Users\tshan\Documents\Dev\madden-editor-suite\data\Madden Old Ratings"

print("=" * 80)
print("DIAGNOSING FAILED IMPORTS")
print("=" * 80)

# Check 2007 file
print("\n2007 - Arizona Cardinals sample:")
print("-" * 80)
try:
    df = pd.read_excel(os.path.join(madden_dir, "2007", "arizona_cardinals_madden_nfl_07.xlsx"))
    print(f"Columns: {df.columns.tolist()[:10]}")
    print(f"Shape: {df.shape}")
    print(f"\nFirst 3 rows:")
    print(df.head(3))
    print(f"\nFirst/Last name check:")
    print(f"  PLYR_FIRSTNAME null count: {df['PLYR_FIRSTNAME'].isna().sum()}")
    print(f"  PLYR_LASTNAME null count: {df['PLYR_LASTNAME'].isna().sum()}")
except Exception as e:
    print(f"Error: {e}")

# Check 2008 file
print("\n\n2008 - Arizona Cardinals sample:")
print("-" * 80)
try:
    df = pd.read_excel(os.path.join(madden_dir, "2008", "arizona_cardinals_madden_nfl_08.xlsx"))
    print(f"Columns: {df.columns.tolist()}")
    print(f"Shape: {df.shape}")
    print(f"\nFirst 3 rows:")
    print(df[df.columns[:5]].head(3))
except Exception as e:
    print(f"Error: {e}")

# Check 2014
print("\n\n2014 Rosters:")
print("-" * 80)
try:
    df = pd.read_excel(os.path.join(madden_dir, "2014 Rosters.xlsx"))
    print(f"Columns: {df.columns.tolist()[:20]}")
    print(f"Shape: {df.shape}")
    print(f"\nFirst 3 rows (first 10 cols):")
    print(df[df.columns[:10]].head(3))
except Exception as e:
    print(f"Error: {e}")

# Check 2019
print("\n\n2019 Rosters:")
print("-" * 80)
try:
    df = pd.read_excel(os.path.join(madden_dir, "2019 Rosters.xlsx"))
    print(f"Columns: {df.columns.tolist()[:20]}")
    print(f"Shape: {df.shape}")
    print(f"\nFirst 3 rows (first 10 cols):")
    print(df[df.columns[:10]].head(3))
except Exception as e:
    print(f"Error: {e}")

print("\n" + "=" * 80)
print("DIAGNOSIS COMPLETE")
print("=" * 80)
