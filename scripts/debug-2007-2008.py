import pandas as pd

madden_dir = r"c:\Users\tshan\Documents\Dev\madden-editor-suite\data\Madden Old Ratings"

def normalize_team_name(team_name, year):
    """Test normalization"""
    TEAM_NORMALIZATIONS = {
        "Arizona Cardinals": "Cardinals",
        "San Francisco 49Ers": "49ers",
    }

    if pd.isna(team_name) or team_name == "":
        return None

    team_str = str(team_name).strip()

    if team_str.lower() in ["free agent", "free agents"]:
        return f"{year} Free Agents"

    if team_str in TEAM_NORMALIZATIONS:
        return TEAM_NORMALIZATIONS[team_str]

    return team_str

# Test 2007
print("2007 Test:")
print("-" * 80)
file_2007 = f"{madden_dir}/2007/arizona_cardinals_madden_nfl_07.xlsx"
df_2007 = pd.read_excel(file_2007)

# Extract team name from filename
filename = "arizona_cardinals_madden_nfl_07"
team_parts = filename.replace("_madden_nfl_07", "").split("_")
team_name = " ".join(team_parts).title()
print(f"Extracted team name: '{team_name}'")
print(f"Normalized: '{normalize_team_name(team_name, 2007)}'")
print(f"First row data:")
print(df_2007[['PLYR_FIRSTNAME', 'PLYR_LASTNAME']].head(1))

# Check if values are strings
print(f"\nFirst name type: {type(df_2007['PLYR_FIRSTNAME'].iloc[0])}")
print(f"First name value: '{df_2007['PLYR_FIRSTNAME'].iloc[0]}'")
print(f"Is empty string: {df_2007['PLYR_FIRSTNAME'].iloc[0] == ''}")
print(f"Is None: {df_2007['PLYR_FIRSTNAME'].iloc[0] is None}")
print(f"Is NaN: {pd.isna(df_2007['PLYR_FIRSTNAME'].iloc[0])}")

# Test 2008
print("\n\n2008 Test:")
print("-" * 80)
file_2008 = f"{madden_dir}/2008/arizona_cardinals_madden_nfl_08.xlsx"
df_2008 = pd.read_excel(file_2008)

filename = "arizona_cardinals_madden_nfl_08"
team_parts = filename.replace("_madden_nfl_08", "").split("_")
team_name = " ".join(team_parts).title()
print(f"Extracted team name: '{team_name}'")
print(f"Normalized: '{normalize_team_name(team_name, 2008)}'")
print(f"First row data:")
print(df_2008[['First_Name', 'Last_Name']].head(1))

print(f"\nFirst name type: {type(df_2008['First_Name'].iloc[0])}")
print(f"First name value: '{df_2008['First_Name'].iloc[0]}'")
print(f"Is empty string: {df_2008['First_Name'].iloc[0] == ''}")
