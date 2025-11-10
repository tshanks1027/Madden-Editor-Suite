"""
Add 2024 roster data to ROSTER_lookup.csv
"""
import pandas as pd
import re

# Read 2024 Rosters
print("Reading 2024 Rosters.xlsx...")
df_2024 = pd.read_excel('data/Madden Old Ratings/2024 Rosters.xlsx')
print(f"Found {len(df_2024)} players in 2024 rosters")

# Read existing ROSTER_lookup
print("Reading existing ROSTER_lookup.csv...")
df_roster = pd.read_csv('data/lookups/ROSTER_lookup.csv')
print(f"Current ROSTER_lookup has {len(df_roster)} rows")
print(f"Years: {sorted(df_roster['Year'].unique())}")

def parse_height_to_inches(height_str):
    """Convert height like 6'5" to inches"""
    if pd.isna(height_str) or not height_str:
        return 0
    try:
        match = re.match(r"(\d+)'(\d+)", str(height_str))
        if match:
            feet, inches = match.groups()
            return int(feet) * 12 + int(inches)
    except:
        pass
    return 0

def split_name(full_name):
    """Split 'First Last' into first and last names"""
    if pd.isna(full_name) or not full_name:
        return "", ""
    parts = str(full_name).strip().split(' ', 1)
    first = parts[0] if len(parts) > 0 else ""
    last = parts[1] if len(parts) > 1 else ""
    return first, last

# Create 2024 roster records matching ROSTER_lookup format
records_2024 = []

for _, row in df_2024.iterrows():
    first_name, last_name = split_name(row.get('Full Name', ''))

    if not first_name or not last_name:
        continue

    record = {
        'Year': 2024,
        'Season_Team': row.get('Team', ''),
        'Player_Name': row.get('Full Name', ''),
        'First_Name': first_name,
        'Last_Name': last_name,
        'Position': row.get('Position', ''),
        'Jersey': int(row.get('Jersey Number', 0)) if not pd.isna(row.get('Jersey Number')) else 0,
        'Age': int(row.get('Age', 0)) if not pd.isna(row.get('Age')) else 0,
        'PID': 0,  # Will be filled later
        'PAM': 0,  # Will be filled later
        'College': row.get('College', ''),
        'Height': row.get('Height', 0) if not pd.isna(row.get('Height')) else 0,  # Already in inches
        'Weight': int(row.get('Weight', 0)) if not pd.isna(row.get('Weight')) else 0,
        'POVR': int(row.get('Overall Rating', 0)) if not pd.isna(row.get('Overall Rating')) else 0,
        'Archetype': row.get('Archetype', ''),
        'PSPD': int(row.get('Speed', 0)) if not pd.isna(row.get('Speed')) else 0,
        'PACC': int(row.get('Acceleration', 0)) if not pd.isna(row.get('Acceleration')) else 0,
        'PSTR': int(row.get('Strength', 0)) if not pd.isna(row.get('Strength')) else 0,
        'PAGI': int(row.get('Agility', 0)) if not pd.isna(row.get('Agility')) else 0,
        'PAWR': int(row.get('Awareness', 0)) if not pd.isna(row.get('Awareness')) else 0,
        'PCTH': int(row.get('Catching', 0)) if not pd.isna(row.get('Catching')) else 0,
        'PCAR': int(row.get('Carrying', 0)) if not pd.isna(row.get('Carrying')) else 0,
        'PTHP': int(row.get('Throw Power', 0)) if not pd.isna(row.get('Throw Power')) else 0,
        'PKPW': int(row.get('Kick Power', 0)) if not pd.isna(row.get('Kick Power')) else 0,
        'PKAC': int(row.get('Kick Accuracy', 0)) if not pd.isna(row.get('Kick Accuracy')) else 0,
        'PRBK': int(row.get('Run Block', 0)) if not pd.isna(row.get('Run Block')) else 0,
        'PPBK': int(row.get('Pass Block', 0)) if not pd.isna(row.get('Pass Block')) else 0,
        'PTAK': int(row.get('Tackle', 0)) if not pd.isna(row.get('Tackle')) else 0,
        'PBTK': int(row.get('Break Tackle', 0)) if not pd.isna(row.get('Break Tackle')) else 0,
        'PJMP': int(row.get('Jumping', 0)) if not pd.isna(row.get('Jumping')) else 0,
        'PINJ': int(row.get('Injury', 0)) if not pd.isna(row.get('Injury')) else 0,
        'PSTA': int(row.get('Stamina', 0)) if not pd.isna(row.get('Stamina')) else 0,
        'PTGH': int(row.get('Toughness', 0)) if not pd.isna(row.get('Toughness')) else 0,
        'PTRK': int(row.get('Trucking', 0)) if not pd.isna(row.get('Trucking')) else 0,
        'PCOD': int(row.get('Change Of Direction', 0)) if not pd.isna(row.get('Change Of Direction')) else 0,
        'PBCV': int(row.get('Ball Carrier Vision', 0)) if not pd.isna(row.get('Ball Carrier Vision')) else 0,
        'PSTF': int(row.get('Stiff Arm', 0)) if not pd.isna(row.get('Stiff Arm')) else 0,
        'PSPM': int(row.get('Spin Move', 0)) if not pd.isna(row.get('Spin Move')) else 0,
        'PJUM': int(row.get('Juke Move', 0)) if not pd.isna(row.get('Juke Move')) else 0,
        'PIBL': int(row.get('Impact Blocking', 0)) if not pd.isna(row.get('Impact Blocking')) else 0,
        'PRBP': int(row.get('Run Block Power', 0)) if not pd.isna(row.get('Run Block Power')) else 0,
        'PRBF': int(row.get('Run Block Finesse', 0)) if not pd.isna(row.get('Run Block Finesse')) else 0,
        'PPBP': int(row.get('Pass Block Power', 0)) if not pd.isna(row.get('Pass Block Power')) else 0,
        'PPBF': int(row.get('Pass Block Finesse', 0)) if not pd.isna(row.get('Pass Block Finesse')) else 0,
        'PLDB': int(row.get('Lead Block', 0)) if not pd.isna(row.get('Lead Block')) else 0,
        'PBRS': int(row.get('Break Sack', 0)) if not pd.isna(row.get('Break Sack')) else 0,
        'PTUP': int(row.get('Throw Under Pressure', 0)) if not pd.isna(row.get('Throw Under Pressure')) else 0,
        'PPWM': int(row.get('Power Moves', 0)) if not pd.isna(row.get('Power Moves')) else 0,
        'PFNM': int(row.get('Finesse Moves', 0)) if not pd.isna(row.get('Finesse Moves')) else 0,
        'PBSH': int(row.get('Block Shedding', 0)) if not pd.isna(row.get('Block Shedding')) else 0,
        'PPUR': int(row.get('Pursuit', 0)) if not pd.isna(row.get('Pursuit')) else 0,
        'PPRC': int(row.get('Play Recognition', 0)) if not pd.isna(row.get('Play Recognition')) else 0,
        'PMCV': int(row.get('Man Coverage', 0)) if not pd.isna(row.get('Man Coverage')) else 0,
        'PZCV': int(row.get('Zone Coverage', 0)) if not pd.isna(row.get('Zone Coverage')) else 0,
        'PSPC': int(row.get('Spectacular Catch', 0)) if not pd.isna(row.get('Spectacular Catch')) else 0,
        'PCIT': int(row.get('Catch In Traffic', 0)) if not pd.isna(row.get('Catch In Traffic')) else 0,
        'PSRR': int(row.get('Short Route Running', 0)) if not pd.isna(row.get('Short Route Running')) else 0,
        'PMRR': int(row.get('Medium Route Running', 0)) if not pd.isna(row.get('Medium Route Running')) else 0,
        'PDRR': int(row.get('Deep Route Running', 0)) if not pd.isna(row.get('Deep Route Running')) else 0,
        'PHTP': int(row.get('Hit Power', 0)) if not pd.isna(row.get('Hit Power')) else 0,
        'PPRS': int(row.get('Press', 0)) if not pd.isna(row.get('Press')) else 0,
        'PREL': int(row.get('Release', 0)) if not pd.isna(row.get('Release')) else 0,
        'PTAS': int(row.get('Throw Accuracy Short', 0)) if not pd.isna(row.get('Throw Accuracy Short')) else 0,
        'PTAM': int(row.get('Throw Accuracy Mid', 0)) if not pd.isna(row.get('Throw Accuracy Mid')) else 0,
        'PTAD': int(row.get('Throw Accuracy Deep', 0)) if not pd.isna(row.get('Throw Accuracy Deep')) else 0,
        'PPLA': int(row.get('Play Action', 0)) if not pd.isna(row.get('Play Action')) else 0,
        'PTOR': int(row.get('Throw On The Run', 0)) if not pd.isna(row.get('Throw On The Run')) else 0,
        'BirthDate': '',  # Not in 2024 file
        'YearsPro': int(row.get('Years Pro', 0)) if not pd.isna(row.get('Years Pro')) else 0,
        'Handedness': row.get('Player Handness', ''),
        '40yd': 0.0,
        'Vertical': 0.0,
        'Bench': 0.0,
        'Broad_Jump': 0.0,
        '3Cone': 0.0,
        'Shuttle': 0.0
    }

    records_2024.append(record)

print(f"\nCreated {len(records_2024)} 2024 records")

# Append to existing roster
df_new_2024 = pd.DataFrame(records_2024)
df_combined = pd.concat([df_roster, df_new_2024], ignore_index=True)

# Sort by Year, Team, Overall descending
df_combined = df_combined.sort_values(['Year', 'Season_Team', 'POVR'], ascending=[True, True, False])

# Save back
print(f"\nSaving combined roster with {len(df_combined)} total rows...")
df_combined.to_csv('data/lookups/ROSTER_lookup.csv', index=False)

print("✓ Successfully added 2024 roster data!")
print(f"New years in ROSTER_lookup: {sorted(df_combined['Year'].unique())}")
