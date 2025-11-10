import pandas as pd

file_path = r'data\Madden Old Ratings\2005\atlanta_falcons_madden_nfl_2005.xlsx'
print(f"Checking: {file_path}\n")

try:
    df = pd.read_excel(file_path)

    print(f"Rows: {len(df)}")
    print(f"Columns: {list(df.columns)}\n")

    print("First 3 rows:")
    print(df.head(3))

    print("\nColumn name checks:")
    print(f"'FirstName' in columns: {'FirstName' in df.columns}")
    print(f"'OverallRating' in columns: {'OverallRating' in df.columns}")
    print(f"'First' in columns: {'First' in df.columns}")
    print(f"'OVR' in columns: {'OVR' in df.columns}")
    print(f"'Name' in columns: {'Name' in df.columns}")
    print(f"'Overall Rating' in columns: {'Overall Rating' in df.columns}")
except Exception as e:
    print(f"ERROR: {e}")
