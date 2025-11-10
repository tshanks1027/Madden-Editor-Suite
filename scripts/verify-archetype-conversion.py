import pandas as pd

df = pd.read_csv('data/lookups/ROSTER_lookup.csv', dtype=str)

# Filter rows with archetypes
df_with_arch = df[df['Archetype_Detailed'].notna() & (df['Archetype_Detailed'] != '')]

print(f'Total rows: {len(df)}')
print(f'Rows with archetypes: {len(df_with_arch)}')
print(f'Rows without archetypes: {len(df) - len(df_with_arch)}')
print()

print('Archetype conversion samples (Detailed ID -> Simplified Name):')
print('-' * 80)

samples = df_with_arch[['Player_Name', 'Position', 'Year', 'Archetype_Detailed', 'Archetype']].head(30)
for idx, row in samples.iterrows():
    print(f"{row['Year']} {row['Player_Name']:25s} {row['Position']:3s} ID {row['Archetype_Detailed']:6s} -> {row['Archetype']}")
