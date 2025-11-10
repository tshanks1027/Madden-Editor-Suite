import pandas as pd

madden_dir = r"c:\Users\tshan\Documents\Dev\madden-editor-suite\data\Madden Old Ratings"

def normalize_team_name(team_name, year):
    """Test the team name normalization"""
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

# Test with 2007 Arizona Cardinals
print("Testing 2007 team name normalization:")
print("-" * 80)

team_name = "Arizona Cardinals"
print(f"Input: '{team_name}'")
print(f"Output: '{normalize_team_name(team_name, 2007)}'")

# Now test the full mapping
df = pd.read_excel(f"{madden_dir}/2007/arizona_cardinals_madden_nfl_07.xlsx")

print(f"\n Data shape: {df.shape}")
print(f"First 3 rows of First/Last names:")
print(df[['PLYR_FIRSTNAME', 'PLYR_LASTNAME']].head(3))

# Apply the mapping
mapped_team = normalize_team_name(team_name, 2007)
print(f"\nMapped team: '{mapped_team}'")
print(f"Is None?: {mapped_team is None}")
print(f"Is NaN?: {pd.isna(mapped_team)}")
