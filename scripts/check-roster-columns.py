import pandas as pd

df = pd.read_csv(r'C:\Users\tshan\Documents\Dev\madden-editor-suite\data\lookups\ROSTER_lookup.csv', low_memory=False, nrows=1)
print(f'Total columns: {len(df.columns)}')
print('\nColumn names (first 80):')
for i, col in enumerate(df.columns[:80]):
    print(f'{i}: {col}')
