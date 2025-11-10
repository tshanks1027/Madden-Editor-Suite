import pandas as pd

df = pd.read_csv(r'C:\Users\tshan\Documents\Dev\madden-editor-suite\data\lookups\ROSTER_lookup.csv', low_memory=False)

print("=" * 80)
print("FINAL DATA VERIFICATION")
print("=" * 80)

# Check years
print("\nYears 2000-2024:")
print("-" * 40)
for year in range(2000, 2025):
    count = len(df[df['Year'] == year])
    if count > 0:
        print(f"{year}: {count:,} players")

print(f"\nTotal rows: {len(df):,}")

# Check specific years we imported
print("\n" + "=" * 80)
print("IMPORTED YEARS - SAMPLE TEAMS")
print("=" * 80)

for year in [2002, 2007, 2008, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2022]:
    year_df = df[df['Year'] == year]
    if len(year_df) > 0:
        print(f"\n{year}:")
        teams = year_df['Season_Team'].value_counts()
        print(f"  Total: {len(year_df)} players")
        print(f"  Teams: {len(teams)}")
        print(f"  Sample teams: {', '.join(teams.head(5).index.tolist())}")

        # Sample a few players
        sample = year_df.head(3)[['First_Name', 'Last_Name', 'Season_Team', 'Position']]
        print(f"  Sample players:")
        for _, row in sample.iterrows():
            print(f"    - {row['First_Name']} {row['Last_Name']} ({row['Season_Team']}, {row['Position']})")

print("\n" + "=" * 80)
print("VERIFICATION COMPLETE")
print("=" * 80)
