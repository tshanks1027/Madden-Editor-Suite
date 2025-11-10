import pandas as pd

df = pd.read_csv(r'C:\Users\tshan\Documents\Dev\madden-editor-suite\data\lookups\ROSTER_lookup.csv', low_memory=False)
df_2004 = df[df['Year'] == 2004]

print(f'2004: {len(df_2004)} players')
print(f'Teams: {df_2004["Season_Team"].nunique()}')
print('\nTop 10 teams:')
teams = df_2004['Season_Team'].value_counts().head(10)
for team, count in teams.items():
    print(f'  {team}: {count} players')

print('\nSample players:')
for _, row in df_2004.head(5).iterrows():
    print(f'  - {row["First_Name"]} {row["Last_Name"]} ({row["Season_Team"]}, {row["Position"]})')
