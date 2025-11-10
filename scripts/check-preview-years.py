import pandas as pd

df = pd.read_csv(r'c:\Users\tshan\Documents\Dev\madden-editor-suite\data\lookups\ROSTER_lookup_PREVIEW.csv', low_memory=False)

print("Checking years 2000-2024 in PREVIEW file:")
print("-" * 40)
for year in range(2000, 2025):
    count = len(df[df['Year'] == year])
    if count > 0:
        print(f"{year}: {count:,} players")

print(f"\nTotal rows: {len(df):,}")
