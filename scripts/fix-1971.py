import pandas as pd

# Load the data
df = pd.read_csv('data/lookups/ROSTER_lookup_historical.csv')
print(f'Before: {len(df)} players')
print(f'1971 players: {len(df[df["Year"] == 1971])}')

# Remove 1971 data
df = df[df['Year'] != 1971]

# Save back
df.to_csv('data/lookups/ROSTER_lookup_historical.csv', index=False)
print(f'After: {len(df)} players')
print(f'Years: {sorted(df["Year"].unique())}')
