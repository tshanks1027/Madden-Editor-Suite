import pandas as pd

df = pd.read_csv(r'C:\Users\tshan\Documents\Dev\madden-editor-suite\data\lookups\ROSTER_lookup.csv', low_memory=False)
print(f'Before: {len(df):,} rows')

df_clean = df[df['Year'] != 2004]
print(f'After removing 2004: {len(df_clean):,} rows')
print(f'Removed: {len(df) - len(df_clean):,} rows')

df_clean.to_csv(r'C:\Users\tshan\Documents\Dev\madden-editor-suite\data\lookups\ROSTER_lookup.csv', index=False)
print('Removed 2004 data')
