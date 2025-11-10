import pandas as pd

df = pd.read_csv(r'C:\Users\tshan\Documents\Dev\madden-editor-suite\data\lookups\ROSTER_lookup.csv', low_memory=False)

# 2020 draft class → 2021 rookie season
wills = df[(df['Year'] == 2021) & (df['Last_Name'] == 'Wills')]

print('All Wills in 2021:')
for idx, row in wills.iterrows():
    print(f'  {row["First_Name"]} {row["Last_Name"]}: OVR={row["POVR"]}, Position={row["Position"]}')
