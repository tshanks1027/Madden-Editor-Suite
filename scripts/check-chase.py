import pandas as pd

df = pd.read_csv(r'C:\Users\tshan\Documents\Dev\madden-editor-suite\data\lookups\ROSTER_lookup.csv', low_memory=False)

# Find Chase Young in 2021 (2020 draft class)
young = df[(df['Year'] == 2021) & (df['Last_Name'] == 'Young')]

print('Chase Young entries in 2021:')
for idx, row in young.iterrows():
    print(f'  {row["First_Name"]} {row["Last_Name"]}')
    print(f'    Player_Name: {row["Player_Name"]}')
    print(f'    Position: {row["Position"]}')
    print(f'    OVR: {row["POVR"]}')
    print(f'    Team: {row["Season_Team"]}')
    print()

# Also check what the lookup key would be
if len(young) > 0:
    for idx, row in young.iterrows():
        if 'Chase' in row['First_Name']:
            key = f'{row["Player_Name"]}_2021'
            print(f'Lookup key for Chase Young: "{key}"')
