"""
Analyze PAM matching between files and add missing PAMs to PID_Portrait_Mapping.csv
"""
import csv
import os

# Define paths
script_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(script_dir)
lookups_dir = os.path.join(project_root, "data", "lookups")

extracted_pams_file = os.path.join(project_root, "data", "PAM", "extracted_pam_names.txt")
pid_mapping_file = os.path.join(lookups_dir, "PID_Portrait_Mapping.csv")
roster_lookup_file = os.path.join(lookups_dir, "ROSTER_lookup.csv")

print("=== PAM Matching Analysis ===\n")

# Load extracted PAMs
print("Loading extracted PAM names...")
with open(extracted_pams_file, 'r', encoding='utf-8') as f:
    extracted_pams = set(line.strip() for line in f if line.strip())
print(f"  {len(extracted_pams)} extracted PAM names\n")

# Load PID_Portrait_Mapping.csv
print("Loading PID_Portrait_Mapping.csv...")
pid_mapping_rows = []
existing_pams = set()
with open(pid_mapping_file, 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    fieldnames = reader.fieldnames
    for row in reader:
        pid_mapping_rows.append(row)
        pam = row.get('PAM', '').strip()
        if pam and pam != '0':
            existing_pams.add(pam)
print(f"  {len(pid_mapping_rows)} total rows")
print(f"  {len(existing_pams)} existing PAM values\n")

# Load ROSTER_lookup.csv to find players without PAMs
print("Loading ROSTER_lookup.csv...")
roster_players = {}  # PID -> player info
empty_pam_count = 0
with open(roster_lookup_file, 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    for row in reader:
        pid = str(row.get('PID', '')).strip()
        if '.' in pid:
            pid = pid.split('.')[0]
        if pid and pid != '':
            first_name = row.get('First Name', '').strip()
            last_name = row.get('Last Name', '').strip()
            pam = row.get('PAM', '').strip()
            if not pam or pam == '0':
                empty_pam_count += 1
            roster_players[pid] = {
                'first_name': first_name,
                'last_name': last_name,
                'full_name': row.get('Player_Name', '').strip(),
                'pam': pam
            }
print(f"  {len(roster_players)} unique PIDs")
print(f"  {empty_pam_count} players without PAM values\n")

# Find matches
print("Finding matches...")
matched_pams = existing_pams.intersection(extracted_pams)
unmatched_in_extracted = extracted_pams - existing_pams
print(f"  {len(matched_pams)} PAMs match")
print(f"  {len(unmatched_in_extracted)} PAMs in extracted but not in PID_Portrait_Mapping\n")

# Try to match unmatched PAMs by name pattern
print("Attempting to match unmatched PAMs by name...")
# PAM format is usually: lastnamefirstname_number or firstnamelastname_number
potential_matches = []
for pam in unmatched_in_extracted:
    # Extract name portion (before underscore)
    if '_' in pam:
        name_part = pam.split('_')[0].lower()
        # Try to find matching players in roster
        for pid, player in roster_players.items():
            first = player['first_name'].lower().replace(' ', '').replace('.', '').replace("'", '')
            last = player['last_name'].lower().replace(' ', '').replace('.', '').replace("'", '').replace('-', '')

            # Check if name_part matches lastname+firstname or firstname+lastname
            combo1 = last + first
            combo2 = first + last

            if name_part == combo1 or name_part == combo2 or name_part.startswith(last) or name_part.startswith(first):
                # Check if this PID already has a PAM in PID_Portrait_Mapping
                pid_has_pam = any(row['PID'] == pid and row.get('PAM', '').strip() and row.get('PAM', '').strip() != '0'
                                 for row in pid_mapping_rows)
                if not pid_has_pam:
                    potential_matches.append({
                        'pam': pam,
                        'pid': pid,
                        'player_name': f"{player['first_name']} {player['last_name']}",
                        'confidence': 'high' if name_part in [combo1, combo2] else 'medium'
                    })
                    break

print(f"  Found {len(potential_matches)} potential matches\n")

# Show sample of potential matches
if potential_matches:
    print("Sample potential matches (first 20):")
    for match in potential_matches[:20]:
        print(f"    {match['pam']} -> PID {match['pid']} ({match['player_name']}) [{match['confidence']}]")
    print()

# Ask if we should add these to PID_Portrait_Mapping
print("\n=== Summary ===")
print(f"Extracted PAMs: {len(extracted_pams)}")
print(f"Already in PID_Portrait_Mapping: {len(matched_pams)}")
print(f"New potential matches found: {len(potential_matches)}")
print(f"Could not match: {len(unmatched_in_extracted) - len(potential_matches)}")

# Save potential matches report
report_file = os.path.join(project_root, "data", "PAM", "potential_pam_matches.csv")
with open(report_file, 'w', encoding='utf-8', newline='') as f:
    writer = csv.DictWriter(f, fieldnames=['pam', 'pid', 'player_name', 'confidence'])
    writer.writeheader()
    writer.writerows(potential_matches)
print(f"\nPotential matches saved to: {report_file}")

# Save unmatched PAMs
unmatched_file = os.path.join(project_root, "data", "PAM", "unmatched_pams.txt")
still_unmatched = unmatched_in_extracted - set(m['pam'] for m in potential_matches)
with open(unmatched_file, 'w', encoding='utf-8') as f:
    for pam in sorted(still_unmatched):
        f.write(pam + '\n')
print(f"Unmatched PAMs saved to: {unmatched_file}")
