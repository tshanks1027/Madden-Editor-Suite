"""
Fill in PhotoID (PID) and Player Assets ID (PAM) in ALL_PLAYER_LOOKUP.csv
by matching with ROSTER_lookup.csv
"""
import pandas as pd

# Read files
print("Reading ROSTER_lookup.csv...")
df_roster = pd.read_csv('data/lookups/ROSTER_lookup.csv', low_memory=False)
print(f"Found {len(df_roster)} roster entries")

# Filter to players with valid PID or PAM
df_roster_with_ids = df_roster[
    ((df_roster['PID'].notna()) & (df_roster['PID'] != 0) & (df_roster['PID'] != '0')) |
    ((df_roster['PAM'].notna()) & (df_roster['PAM'] != 0) & (df_roster['PAM'] != '0'))
]
print(f"Found {len(df_roster_with_ids)} roster entries with PID/PAM")

print("\nReading ALL_PLAYER_LOOKUP.csv...")
df_all_players = pd.read_csv('data/lookups/ALL_PLAYER_LOOKUP.csv')
print(f"Found {len(df_all_players)} total player records")

# Count how many already have IDs
has_photoid = (df_all_players['PhotoID'].notna()) & (df_all_players['PhotoID'] != '')
has_assets = (df_all_players['Player Assets ID'].notna()) & (df_all_players['Player Assets ID'] != '')
print(f"Already have PhotoID: {has_photoid.sum()}")
print(f"Already have Player Assets ID: {has_assets.sum()}")

# Create lookup dictionaries from roster
# Key: (last_name, first_name) -> (PID, PAM, PLPO)
player_id_map = {}

for _, row in df_roster_with_ids.iterrows():
    last = str(row['Last_Name']).strip().lower()
    first = str(row['First_Name']).strip().lower()

    if not last or not first or last == 'nan' or first == 'nan':
        continue

    key = (last, first)

    # Store the most recent (highest year) IDs for each player
    pid = row['PID'] if pd.notna(row['PID']) and row['PID'] != 0 else ''
    pam = row['PAM'] if pd.notna(row['PAM']) and row['PAM'] != 0 else ''

    if key not in player_id_map or row['Year'] > player_id_map[key][3]:
        player_id_map[key] = (pid, pam, '', row['Year'])  # PLPO not in roster file

print(f"\nCreated lookup map with {len(player_id_map)} unique players")

# Match and fill in IDs
matches = 0
filled_pid = 0
filled_pam = 0

for idx, row in df_all_players.iterrows():
    last = str(row['Last Name']).strip().lower()
    first = str(row['First Name']).strip().lower()

    if not last or not first or last == 'nan' or first == 'nan':
        continue

    key = (last, first)

    if key in player_id_map:
        matches += 1
        pid, pam, _, _ = player_id_map[key]

        # Fill in PhotoID if empty
        if (pd.isna(row['PhotoID']) or row['PhotoID'] == '') and pid:
            df_all_players.at[idx, 'PhotoID'] = pid
            filled_pid += 1

        # Fill in Player Assets ID if empty
        if (pd.isna(row['Player Assets ID']) or row['Player Assets ID'] == '') and pam:
            df_all_players.at[idx, 'Player Assets ID'] = pam
            filled_pam += 1

print(f"\nMatched {matches} players")
print(f"Filled {filled_pid} PhotoID values")
print(f"Filled {filled_pam} Player Assets ID values")

# Save back
print(f"\nSaving ALL_PLAYER_LOOKUP.csv...")
df_all_players.to_csv('data/lookups/ALL_PLAYER_LOOKUP.csv', index=False)

print("Done! Successfully updated ALL_PLAYER_LOOKUP.csv")

# Show final stats
has_photoid = (df_all_players['PhotoID'].notna()) & (df_all_players['PhotoID'] != '')
has_assets = (df_all_players['Player Assets ID'].notna()) & (df_all_players['Player Assets ID'] != '')
print(f"\nFinal counts:")
print(f"Have PhotoID: {has_photoid.sum()}")
print(f"Have Player Assets ID: {has_assets.sum()}")
