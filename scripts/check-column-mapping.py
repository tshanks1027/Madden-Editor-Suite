import pandas as pd

print("=" * 80)
print("COLUMN MAPPING VERIFICATION")
print("=" * 80)

# 1. ROSTER_lookup.csv columns
print("\n1. ROSTER_lookup.csv columns (target format):")
print("-" * 80)
lookup_df = pd.read_csv(r"c:\Users\tshan\Documents\Dev\madden-editor-suite\data\lookups\ROSTER_lookup.csv", nrows=0)
print(f"Total columns: {len(lookup_df.columns)}")
print("Columns:")
for i, col in enumerate(lookup_df.columns, 1):
    print(f"  {i:2d}. {col}")

# 2. 2002 Rosters columns
print("\n\n2. 2002 Rosters.xlsx columns (source):")
print("-" * 80)
df_2002 = pd.read_excel(r"c:\Users\tshan\Documents\Dev\madden-editor-suite\data\Madden Old Ratings\2002 Rosters.xlsx",
                         sheet_name='Player Ratings', nrows=0)
print(f"Total columns: {len(df_2002.columns)}")
print("Columns:")
for i, col in enumerate(df_2002.columns, 1):
    print(f"  {i:2d}. {col}")

# 3. 2007 columns
print("\n\n3. 2007 arizona_cardinals file columns (source):")
print("-" * 80)
df_2007 = pd.read_excel(r"c:\Users\tshan\Documents\Dev\madden-editor-suite\data\Madden Old Ratings\2007\arizona_cardinals_madden_nfl_07.xlsx",
                         nrows=0)
print(f"Total columns: {len(df_2007.columns)}")
print("Columns:")
for i, col in enumerate(df_2007.columns, 1):
    print(f"  {i:2d}. {col}")

# 4. 2013 columns
print("\n\n4. 2013 Roster.xlsx columns (source):")
print("-" * 80)
df_2013 = pd.read_excel(r"c:\Users\tshan\Documents\Dev\madden-editor-suite\data\Madden Old Ratings\2013 Roster.xlsx",
                         nrows=0)
print(f"Total columns: {len(df_2013.columns)}")
print("Columns:")
for i, col in enumerate(df_2013.columns, 1):
    print(f"  {i:2d}. {col}")

print("\n" + "=" * 80)
print("VERIFICATION COMPLETE")
print("=" * 80)
