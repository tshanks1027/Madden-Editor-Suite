import pandas as pd
import re

# Check how team names in the source files map to the Season_Team abbreviations

print("=" * 80)
print("TEAM NAME MAPPING ANALYSIS")
print("=" * 80)

# 1. Get unique team abbreviations from current ROSTER_lookup.csv
print("\n1. Team abbreviations in current ROSTER_lookup.csv:")
print("-" * 80)
lookup_df = pd.read_csv(r"c:\Users\tshan\Documents\Dev\madden-editor-suite\data\lookups\ROSTER_lookup.csv")
unique_teams = sorted(lookup_df['Season_Team'].dropna().unique())
print(f"Found {len(unique_teams)} unique teams:")
print(unique_teams[:20])  # Show first 20

# 2. Get team names from 2002 Rosters.xlsx
print("\n\n2. Team names in 2002 Rosters.xlsx:")
print("-" * 80)
df_2002 = pd.read_excel(r"c:\Users\tshan\Documents\Dev\madden-editor-suite\data\Madden Old Ratings\2002 Rosters.xlsx",
                         sheet_name='Player Ratings')
teams_2002 = sorted(df_2002['Team'].unique())
print(f"Found {len(teams_2002)} teams:")
print(teams_2002)

# 3. Get team names from 2007 filenames
print("\n\n3. Team names from 2007 filenames:")
print("-" * 80)
import os
dir_2007 = r"c:\Users\tshan\Documents\Dev\madden-editor-suite\data\Madden Old Ratings\2007"
files_2007 = [f for f in os.listdir(dir_2007) if f.endswith('.xlsx')]
teams_2007 = []
for f in files_2007:
    # Extract team name from filename: "arizona_cardinals_madden_nfl_07.xlsx"
    team = f.replace('_madden_nfl_07.xlsx', '').replace('_', ' ').title()
    teams_2007.append(team)
teams_2007 = sorted(teams_2007)
print(f"Found {len(teams_2007)} teams:")
print(teams_2007)

# 4. Get team names from 2013 Roster.xlsx
print("\n\n4. Team names in 2013 Roster.xlsx:")
print("-" * 80)
df_2013 = pd.read_excel(r"c:\Users\tshan\Documents\Dev\madden-editor-suite\data\Madden Old Ratings\2013 Roster.xlsx")
teams_2013 = sorted(df_2013['Team'].unique())
print(f"Found {len(teams_2013)} teams:")
print(teams_2013)

# 5. Check if there's a team_lookup.csv
print("\n\n5. Checking team_lookup.csv:")
print("-" * 80)
try:
    team_lookup = pd.read_csv(r"c:\Users\tshan\Documents\Dev\madden-editor-suite\data\lookups\team_lookup.csv")
    print("Columns:", team_lookup.columns.tolist())
    print("\nSample rows:")
    print(team_lookup.head(10))
except Exception as e:
    print(f"Error: {e}")

print("\n" + "=" * 80)
print("ANALYSIS COMPLETE")
print("=" * 80)
