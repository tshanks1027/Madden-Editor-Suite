"""
Improved PAM matching with better name fuzzy matching
"""
import csv
import os
import re

script_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(script_dir)
lookups_dir = os.path.join(project_root, "data", "lookups")

extracted_pams_file = os.path.join(project_root, "data", "PAM", "extracted_pam_names.txt")
pid_mapping_file = os.path.join(lookups_dir, "PID_Portrait_Mapping.csv")
roster_lookup_file = os.path.join(lookups_dir, "ROSTER_lookup.csv")

print("=== Improved PAM Matching ===\n")

# Load extracted PAMs
print("1. Loading extracted PAM names...")
with open(extracted_pams_file, 'r', encoding='utf-8') as f:
    extracted_pams = [line.strip() for line in f if line.strip()]
print(f"   {len(extracted_pams)} extracted PAM names\n")

# Load ALL roster players (all years)
print("2. Loading ROSTER_lookup.csv (all years)...")
all_players = {}  # name_key -> list of {pid, first, last, year, ...}
with open(roster_lookup_file, 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    for row in reader:
        pid = str(row.get('PID', '')).strip()
        if '.' in pid:
            pid = pid.split('.')[0]
        if not pid:
            continue

        first = row.get('First Name', '').strip()
        last = row.get('Last Name', '').strip()
        year = row.get('Year', '').strip()

        if first and last:
            # Create multiple name keys for flexibility
            name_normalized = f"{last}{first}".lower().replace(' ', '').replace('.', '').replace("'", '').replace('-', '')

            if name_normalized not in all_players:
                all_players[name_normalized] = []

            all_players[name_normalized].append({
                'pid': pid,
                'first': first,
                'last': last,
                'year': year,
                'full_name': f"{first} {last}"
            })

print(f"   {len(all_players)} unique name combinations\n")

# Load existing PAM mappings
print("3. Loading existing PAM mappings from PID_Portrait_Mapping.csv...")
pid_mapping_rows = []
existing_pams = {}  # PID -> PAM
with open(pid_mapping_file, 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    fieldnames = reader.fieldnames
    for row in reader:
        pid_mapping_rows.append(row)
        pam = row.get('PAM', '').strip()
        pid = row.get('PID', '').strip()
        if pam and pam not in ['0', '0.0'] and pid:
            existing_pams[pid] = pam

print(f"   {len(existing_pams)} existing PAM mappings\n")

# Match PAMs to players
print("4. Matching PAMs to player names...")

def normalize_pam_name(pam):
    """Extract and normalize name from PAM"""
    if '_' not in pam:
        return None
    name_part = pam.split('_')[0]
    return name_part.lower().replace(' ', '').replace('.', '').replace("'", '').replace('-', '')

matched_mappings = {}  # PID -> PAM
match_count = 0

for pam in extracted_pams:
    pam_name = normalize_pam_name(pam)
    if not pam_name:
        continue

    # Try exact match first
    if pam_name in all_players:
        # Found exact match - use the most recent year's PID
        players = all_players[pam_name]
        # Sort by year descending (most recent first)
        players_sorted = sorted(players, key=lambda x: float(x['year']) if x['year'] else 0, reverse=True)
        player = players_sorted[0]

        pid = player['pid']
        # Only add if not already mapped
        if pid not in existing_pams:
            matched_mappings[pid] = pam
            match_count += 1
            continue

    # Try partial matches (name starts with lastname or firstname)
    for name_key, players in all_players.items():
        if pam_name.startswith(name_key[:5]) or name_key.startswith(pam_name[:5]):
            # Partial match found
            players_sorted = sorted(players, key=lambda x: float(x['year']) if x['year'] else 0, reverse=True)
            player = players_sorted[0]

            pid = player['pid']
            if pid not in existing_pams and pid not in matched_mappings:
                # Check if the match is reasonable (at least 60% of name matches)
                match_len = min(len(pam_name), len(name_key))
                matching_chars = sum(1 for a, b in zip(pam_name, name_key) if a == b)

                if matching_chars >= match_len * 0.6:
                    matched_mappings[pid] = pam
                    match_count += 1
                    break

print(f"   Matched {match_count} new PAMs to PIDs\n")

# Show sample
print("Sample of new matches (first 30):")
print(f"{'PID':<10} {'PAM':<30}")
print("-" * 45)
count = 0
for pid, pam in matched_mappings.items():
    print(f"{pid:<10} {pam:<30}")
    count += 1
    if count >= 30:
        break
print()

# Update PID_Portrait_Mapping.csv
print("5. Updating PID_Portrait_Mapping.csv...")
updates_made = 0
for row in pid_mapping_rows:
    pid = row.get('PID', '').strip()
    if pid in matched_mappings:
        current_pam = row.get('PAM', '').strip()
        if not current_pam or current_pam in ['0', '0.0']:
            row['PAM'] = matched_mappings[pid]
            updates_made += 1

print(f"   Updated {updates_made} rows\n")

# Write back
print("6. Saving PID_Portrait_Mapping.csv...")
with open(pid_mapping_file, 'w', encoding='utf-8', newline='') as f:
    writer = csv.DictWriter(f, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(pid_mapping_rows)
print("   Saved!\n")

# Update ROSTER_lookup.csv
print("7. Updating ROSTER_lookup.csv...")
roster_rows = []
roster_updates = 0

# Build complete PAM mapping
complete_pam_mapping = existing_pams.copy()
complete_pam_mapping.update(matched_mappings)

with open(roster_lookup_file, 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    roster_fieldnames = reader.fieldnames
    for row in reader:
        pid = str(row.get('PID', '')).strip()
        if '.' in pid:
            pid = pid.split('.')[0]

        if pid in complete_pam_mapping:
            current_pam = row.get('PAM', '').strip()
            if not current_pam or current_pam in ['0', '0.0']:
                row['PAM'] = complete_pam_mapping[pid]
                roster_updates += 1

        roster_rows.append(row)

print(f"   Updated {roster_updates} rows\n")

# Write back
print("8. Saving ROSTER_lookup.csv...")
with open(roster_lookup_file, 'w', encoding='utf-8', newline='') as f:
    writer = csv.DictWriter(f, fieldnames=roster_fieldnames)
    writer.writeheader()
    writer.writerows(roster_rows)
print("   Saved!\n")

print("=== Complete! ===")
print(f"New PAM mappings added: {match_count}")
print(f"PID_Portrait_Mapping.csv: Updated {updates_made} rows")
print(f"ROSTER_lookup.csv: Updated {roster_updates} rows")
