import pandas as pd

# Copy the normalize function and mapping function
TEAM_NORMALIZATIONS = {
    "Arizona Cardinals": "Cardinals",
    "Atlanta Falcons": "Falcons",
    "San Francisco 49Ers": "49ers",
}

def normalize_team_name(team_name, year):
    """Normalize team name to short format"""
    if pd.isna(team_name) or team_name == "":
        return None

    team_str = str(team_name).strip()

    if team_str.lower() in ["free agent", "free agents"]:
        return f"{year} Free Agents"

    if team_str in TEAM_NORMALIZATIONS:
        return TEAM_NORMALIZATIONS[team_str]

    return team_str

def safe_int(value, default=0):
    """Safely convert value to int"""
    if pd.isna(value):
        return default
    try:
        return int(float(value))
    except (ValueError, TypeError):
        return default

def safe_str(value, default=""):
    """Safely convert value to string"""
    if pd.isna(value):
        return default
    return str(value).strip()

def map_2007_format(df, year, team_name):
    """Map 2007/2008 format (PLYR_ prefix) to ROSTER_lookup format"""
    mapped = pd.DataFrame()

    # Fix: Assign scalar values properly for all rows
    n_rows = len(df)
    mapped['Year'] = [year] * n_rows
    mapped['Season_Team'] = [normalize_team_name(team_name, year)] * n_rows
    mapped['First_Name'] = df['PLYR_FIRSTNAME'].apply(safe_str)
    mapped['Last_Name'] = df['PLYR_LASTNAME'].apply(safe_str)
    mapped['Player_Name'] = mapped['First_Name'] + ' ' + mapped['Last_Name']

    return mapped

# Test 2007 mapping
print("Testing 2007 mapping:")
print("-" * 80)
file_2007 = r"c:\Users\tshan\Documents\Dev\madden-editor-suite\data\Madden Old Ratings\2007\arizona_cardinals_madden_nfl_07.xlsx"
df = pd.read_excel(file_2007)

# Extract team name
filename = "arizona_cardinals_madden_nfl_07"
team_parts = filename.replace("_madden_nfl_07", "").split("_")
team_name = " ".join(team_parts).title()

print(f"Team name extracted: '{team_name}'")
print(f"Normalized: '{normalize_team_name(team_name, 2007)}'")

# Run the mapping
mapped = map_2007_format(df, 2007, team_name)

print(f"\nMapped DataFrame shape: {mapped.shape}")
print(f"\nSeason_Team column:")
print(f"  Unique values: {mapped['Season_Team'].unique()}")
print(f"  NaN count: {mapped['Season_Team'].isna().sum()}")
print(f"  Non-NaN count: {mapped['Season_Team'].notna().sum()}")

print(f"\nFirst 3 rows:")
print(mapped[['Year', 'Season_Team', 'First_Name', 'Last_Name']].head(3))

# Check the filter
valid_mask = (mapped['First_Name'] != "") & (mapped['Last_Name'] != "") & (mapped['Season_Team'].notna())
print(f"\nValid mask results:")
print(f"  Total rows: {len(mapped)}")
print(f"  Valid rows: {valid_mask.sum()}")
print(f"  Invalid rows: {(~valid_mask).sum()}")

print(f"\nBreakdown:")
print(f"  First_Name not empty: {(mapped['First_Name'] != '').sum()}")
print(f"  Last_Name not empty: {(mapped['Last_Name'] != '').sum()}")
print(f"  Season_Team not na: {mapped['Season_Team'].notna().sum()}")
