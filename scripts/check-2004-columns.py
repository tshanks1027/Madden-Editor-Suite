import pandas as pd

df = pd.read_excel(r'C:\Users\tshan\Documents\Dev\madden-editor-suite\data\Madden Old Ratings\2004 Rosters.xlsx')
print('All columns:')
for i, col in enumerate(df.columns):
    print(f'  {i+1}. {col}')

print(f'\nSample data:')
print(df[['Team', 'Name', 'Position', 'Overall']].head(5))
