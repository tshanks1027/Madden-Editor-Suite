import pandas as pd

file_path = r'data\Madden Old Ratings\2003 Rosters\arizona_cardinals_madden_nfl_2003.xlsx'
print(f"Checking: {file_path}\n")

try:
    df = pd.read_excel(file_path)

    print(f"Rows: {len(df)}")
    print(f"Columns: {list(df.columns)}\n")

    print("First 3 rows:")
    print(df.head(3))

    print("\nColumn name checks:")
    print(f"'OverallRating' in columns: {'OverallRating' in df.columns}")
    print(f"'AccelerationRating' in columns: {'AccelerationRating' in df.columns}")
    print(f"'First' in columns: {'First' in df.columns}")
    print(f"'FirstName' in columns: {'FirstName' in df.columns}")
except Exception as e:
    print(f"ERROR: {e}")
