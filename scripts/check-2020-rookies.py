import pandas as pd

df = pd.read_csv(r'C:\Users\tshan\Documents\Dev\madden-editor-suite\data\lookups\ROSTER_lookup.csv', low_memory=False)

# 2020 draft class → 2021 rookie season
rookies_2021 = df[df['Year'] == 2021]

print('2020 Draft Class Rookie Ratings (from 2021 season):')
print('=' * 80)

players_to_check = [
    'Joe Burrow',
    'Chase Young',
    'Jeff Okudah',
    'Andrew Thomas',
    'Tua Tagovailoa',
    'Justin Herbert',
    'Derrick Brown',
    'Isaiah Simmons',
    'C.J. Henderson'
]

for player_name in players_to_check:
    player = rookies_2021[rookies_2021['Player_Name'] == player_name]
    if len(player) > 0:
        p = player.iloc[0]
        print(f'\n{player_name}:')
        print(f'  Position: {p["Position"]}')
        print(f'  OVR (POVR): {p["POVR"]}')
        print(f'  Team: {p["Season_Team"]}')
        print(f'  SPD: {p["PSPD"]}')
        print(f'  ACC: {p["PACC"]}')
    else:
        print(f'\n{player_name}: NOT FOUND')
