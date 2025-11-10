import pandas as pd

df = pd.read_csv(r'C:\Users\tshan\Documents\Dev\madden-editor-suite\data\lookups\ROSTER_lookup.csv', low_memory=False)

# Look for Joe Burrow in 2021 (2020 draft class rookie season)
burrow = df[(df['Year'] == 2021) &
            (df['First_Name'].str.contains('Joe', na=False)) &
            (df['Last_Name'].str.contains('Burrow', na=False))]

print('Joe Burrow 2021 (Rookie Season):')
if len(burrow) > 0:
    print(f"  Position: {burrow.iloc[0]['Position']}")
    print(f"  OVR: {burrow.iloc[0]['POVR']}")
    print(f"  Team: {burrow.iloc[0]['Season_Team']}")
    print(f"  Full name: {burrow.iloc[0]['Player_Name']}")
else:
    print('  NOT FOUND')

# Also check what names are available for Burrow
all_burrow = df[df['Last_Name'].str.contains('Burrow', na=False)]
print(f'\nAll Burrow entries: {len(all_burrow)}')
if len(all_burrow) > 0:
    print('Years:', sorted(all_burrow['Year'].dropna().unique()))
