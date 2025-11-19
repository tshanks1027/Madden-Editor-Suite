import csv
import os

# File paths
pid_mapping_file = r"C:\Users\tshan\Documents\Dev\madden-editor-suite\data\lookups\PID_Portrait_Mapping.csv"
roster_lookup_file = r"C:\Users\tshan\Documents\Dev\madden-editor-suite\data\lookups\ROSTER_lookup.csv"

print("Loading PID_Portrait_Mapping.csv...")
# Read PID mapping file
pid_map = {}
with open(pid_mapping_file, 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    for row in reader:
        player_name = row['Player Name'].strip()
        pid = row['PID'].strip()

        # Skip if PID is 0 (we'll leave those blank)
        if pid == '0':
            continue

        # Store mapping: player name -> PID
        pid_map[player_name] = pid

print(f"Loaded {len(pid_map)} player PID mappings")

print("\nProcessing ROSTER_lookup.csv...")
# Read roster lookup file
rows = []
updated_count = 0
skipped_zeros = 0

with open(roster_lookup_file, 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    fieldnames = reader.fieldnames

    for row in reader:
        player_name = row['Player_Name'].strip()

        # Check if we have a PID mapping for this player
        if player_name in pid_map:
            row['PID'] = pid_map[player_name]
            updated_count += 1
        elif row['PID'] == '0':
            # Remove zeros and leave blank
            row['PID'] = ''
            skipped_zeros += 1

        rows.append(row)

print(f"Updated {updated_count} player PIDs")
print(f"Removed {skipped_zeros} zero PIDs")

# Write updated roster lookup file
print("\nWriting updated ROSTER_lookup.csv...")
with open(roster_lookup_file, 'w', encoding='utf-8', newline='') as f:
    writer = csv.DictWriter(f, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(rows)

print("Done!")
