import pandas as pd

file_path = r'C:\Users\tshan\Downloads\sportsref_download.xls'
print(f"Inspecting: {file_path}\n")

try:
    # PFR exports HTML tables with .xls extension
    df = pd.read_html(file_path)[0]  # Get first table

    print(f"Rows: {len(df)}")
    print(f"Columns: {list(df.columns)}\n")

    print("First 10 rows:")
    print(df.head(10))

    print("\n" + "="*80)
    print("Data types:")
    print(df.dtypes)

except Exception as e:
    print(f"ERROR: {e}")
