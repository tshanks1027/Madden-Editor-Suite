import pandas as pd
import os

madden_dir = r"c:\Users\tshan\Documents\Dev\madden-editor-suite\data\Madden Old Ratings"

years_to_check = {
    2007: os.path.join(madden_dir, "2007", "arizona_cardinals_madden_nfl_07.xlsx"),
    2008: os.path.join(madden_dir, "2008", "arizona_cardinals_madden_nfl_08.xlsx"),
    2014: os.path.join(madden_dir, "2014 Rosters.xlsx"),
    2015: os.path.join(madden_dir, "2015 Roster.xlsx"),
    2016: os.path.join(madden_dir, "2016 Rosters.xlsx"),
    2017: os.path.join(madden_dir, "2017 Rosters.xlsx"),
    2019: os.path.join(madden_dir, "2019 Rosters.xlsx"),
    2020: os.path.join(madden_dir, "2020 Rosters.xlsx"),
    2022: os.path.join(madden_dir, "2022 Rosters.xlsx"),
}

for year, filepath in years_to_check.items():
    print("\n" + "=" * 80)
    print(f"YEAR {year}")
    print("=" * 80)

    try:
        df = pd.read_excel(filepath, nrows=3)

        print(f"Shape: {df.shape}")
        print(f"\nAll Columns ({len(df.columns)}):")
        for i, col in enumerate(df.columns, 1):
            print(f"  {i:2d}. {col}")

        print(f"\nFirst 2 rows (first 8 columns):")
        print(df[df.columns[:8]].head(2))

    except Exception as e:
        print(f"Error: {e}")

print("\n" + "=" * 80)
print("INSPECTION COMPLETE")
print("=" * 80)
