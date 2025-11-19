"""
Add newly extracted PAMs to PID_Portrait_Mapping.csv by matching modern player names
Then update ROSTER_lookup.csv with the PAM values
"""
import csv
import os
import re

# Define paths
script_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(script_dir)
lookups_dir = os.path.join(project_root, "data", "lookups")

extracted_pams_file = os.path.join(project_root, "data", "PAM", "extracted_pam_names.txt")
pid_mapping_file = os.path.join(lookups_dir, "PID_Portrait_Mapping.csv")
roster_lookup_file = os.path.join(lookups_dir, "ROSTER_lookup.csv")

print("=== Adding New PAMs to PID_Portrait_Mapping.csv ===\n")

# Load extracted PAMs
print("1. Loading extracted PAM names...")
with open(extracted_pams_file, 'r', encoding='utf-8') as f:
    extracted_pams = [line.strip() for line in f if line.strip()]
print(f"   {len(extracted_pams)} extracted PAM names\n")

# Load PID_Portrait_Mapping.csv
print("2. Loading PID_Portrait_Mapping.csv...")
pid_mapping_rows = []
existing_pams = {}  # PAM -> PID
with open(pid_mapping_file, 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    fieldnames = reader.fieldnames
    for row in reader:
        pid_mapping_rows.append(row)
        pam = row.get('PAM', '').strip()
        pid = row.get('PID', '').strip()
        if pam and pam != '0' and pid:
            existing_pams[pam] = pid
print(f"   {len(pid_mapping_rows)} total rows")
print(f"   {len(existing_pams)} rows with PAM values\n")

# Load ROSTER_lookup.csv for ALL players
print("3. Loading ROSTER_lookup.csv (all players)...")
all_players = {}  # PID -> player info
with open(roster_lookup_file, 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    for row in reader:
        year = row.get('Year', '').strip()
        pid = str(row.get('PID', '')).strip()
        if '.' in pid:
            pid = pid.split('.')[0]
        if pid and pid != '':
            first_name = row.get('First Name', '').strip()
            last_name = row.get('Last Name', '').strip()
            current_pam = row.get('PAM', '').strip()

            # Store player info (first occurrence wins)
            if pid not in all_players:
                all_players[pid] = {
                    'first_name': first_name,
                    'last_name': last_name,
                    'full_name': row.get('Player_Name', '').strip(),
                    'current_pam': current_pam,
                    'year': year
                }

print(f"   {len(all_players)} total players\n")

# Match PAMs to ALL players
print("4. Matching PAMs to all player names...")

def normalize_name(name):
    """Remove spaces, dots, apostrophes, hyphens"""
    return name.lower().replace(' ', '').replace('.', '').replace("'", '').replace('-', '')

new_mappings = []  # List of (pam, pid, player_name)
matched_count = 0

for pam in extracted_pams:
    # Skip if PAM already exists in mapping
    if pam in existing_pams:
        matched_count += 1
        continue

    # Extract name from PAM (format: lastnamefirstname_number)
    if '_' not in pam:
        continue

    name_part = pam.split('_')[0]
    name_part_lower = name_part.lower()

    # Try to match against all players
    best_match = None
    best_match_score = 0

    for pid, player in all_players.items():
        first = normalize_name(player['first_name'])
        last = normalize_name(player['last_name'])

        # Try different combinations
        combo1 = last + first  # lastnamefirstname
        combo2 = first + last  # firstnamelastname

        # Exact match - best
        if name_part_lower == combo1 or name_part_lower == combo2:
            best_match = (pid, player)
            best_match_score = 100
            break

        # Starts with lastname and contains firstname
        elif name_part_lower.startswith(last) and first in name_part_lower:
            if len(last) + len(first) > best_match_score:
                best_match = (pid, player)
                best_match_score = len(last) + len(first)

        # Starts with firstname and contains lastname
        elif name_part_lower.startswith(first) and last in name_part_lower:
            if len(last) + len(first) > best_match_score:
                best_match = (pid, player)
                best_match_score = len(last) + len(first)

    if best_match and best_match_score >= 6:  # At least 6 characters matched
        pid, player = best_match
        player_name = f"{player['first_name']} {player['last_name']}"
        new_mappings.append({
            'pam': pam,
            'pid': pid,
            'player_name': player_name,
            'year': player['year']
        })
        matched_count += 1

print(f"   Matched {matched_count} total PAMs")
print(f"   {len(new_mappings)} new PAM->PID mappings to add\n")

# Show sample
if new_mappings:
    print("Sample of new mappings (first 30):")
    for mapping in new_mappings[:30]:
        print(f"    {mapping['pam']} -> PID {mapping['pid']} ({mapping['player_name']} - {mapping['year']})")
    print()

# Update PID_Portrait_Mapping.csv
print("5. Updating PID_Portrait_Mapping.csv...")
updates_made = 0
for mapping in new_mappings:
    # Find the row with this PID
    for row in pid_mapping_rows:
        if row['PID'] == mapping['pid']:
            current_pam = row.get('PAM', '').strip()
            # Only update if empty or '0'
            if not current_pam or current_pam == '0':
                row['PAM'] = mapping['pam']
                updates_made += 1
                break

print(f"   Updated {updates_made} rows in PID_Portrait_Mapping\n")

# Write updated PID_Portrait_Mapping back
print("6. Saving updated PID_Portrait_Mapping.csv...")
with open(pid_mapping_file, 'w', encoding='utf-8', newline='') as f:
    writer = csv.DictWriter(f, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(pid_mapping_rows)
print(f"   Saved!\n")

# Now update ROSTER_lookup.csv with all PAM mappings
print("7. Updating ROSTER_lookup.csv...")
# Rebuild PAM->PID mapping with new additions
all_pam_mappings = {}
for row in pid_mapping_rows:
    pam = row.get('PAM', '').strip()
    pid = row.get('PID', '').strip()
    if pam and pam != '0' and pid:
        all_pam_mappings[pid] = pam

# Update roster
roster_rows = []
roster_updates = 0
with open(roster_lookup_file, 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    roster_fieldnames = reader.fieldnames
    for row in reader:
        pid = str(row.get('PID', '')).strip()
        if '.' in pid:
            pid = pid.split('.')[0]

        # Update PAM if we have a mapping
        if pid in all_pam_mappings:
            current_pam = row.get('PAM', '').strip()
            if not current_pam or current_pam == '0':
                row['PAM'] = all_pam_mappings[pid]
                roster_updates += 1

        roster_rows.append(row)

print(f"   Updated {roster_updates} rows in ROSTER_lookup\n")

# Write updated roster back
print("8. Saving updated ROSTER_lookup.csv...")
with open(roster_lookup_file, 'w', encoding='utf-8', newline='') as f:
    writer = csv.DictWriter(f, fieldnames=roster_fieldnames)
    writer.writeheader()
    writer.writerows(roster_rows)
print(f"   Saved!\n")

print("=== Complete! ===")
print(f"PID_Portrait_Mapping.csv: Added PAMs to {updates_made} rows")
print(f"ROSTER_lookup.csv: Updated {roster_updates} rows with PAM values")
