"""
Match extracted PAM names to PID_Portrait_Mapping.csv and update ROSTER_lookup.csv
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
output_file = os.path.join(lookups_dir, "ROSTER_lookup.csv")

print("Loading extracted PAM names...")
with open(extracted_pams_file, 'r', encoding='utf-8') as f:
    extracted_pams = set(line.strip() for line in f if line.strip())
print(f"Loaded {len(extracted_pams)} extracted PAM names")

print("\nLoading PID_Portrait_Mapping.csv...")
# Build a mapping of PAM -> PID from PID_Portrait_Mapping.csv
pam_to_pid = {}
with open(pid_mapping_file, 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    for row in reader:
        pam = row.get('PAM', '').strip()
        pid = row.get('PID', '').strip()
        if pam and pid and pam != '0':  # Skip empty and '0' PAM values
            pam_to_pid[pam] = pid
print(f"Found {len(pam_to_pid)} PAM->PID mappings")

print("\nFinding matches between extracted PAMs and PID mappings...")
# Find which extracted PAMs have PIDs
matched_pams = {}
for pam in extracted_pams:
    if pam in pam_to_pid:
        matched_pams[pam] = pam_to_pid[pam]
print(f"Matched {len(matched_pams)} PAMs to PIDs")

print("\nUpdating ROSTER_lookup.csv...")
# Read the roster lookup
roster_rows = []
with open(roster_lookup_file, 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    fieldnames = reader.fieldnames
    roster_rows = list(reader)

# Update PAM column for matching PIDs
updates_made = 0
for row in roster_rows:
    pid = str(row.get('PID', '')).strip()
    if pid:
        # Remove decimal point if present (e.g., "14375.0" -> "14375")
        if '.' in pid:
            pid = pid.split('.')[0]

        # Find PAM for this PID
        for pam, mapped_pid in matched_pams.items():
            if mapped_pid == pid:
                current_pam = row.get('PAM', '').strip()
                if not current_pam or current_pam == '0':
                    row['PAM'] = pam
                    updates_made += 1
                break

print(f"Updated {updates_made} rows with PAM data")

# Write the updated roster back
print(f"\nWriting updated roster to {output_file}...")
with open(output_file, 'w', encoding='utf-8', newline='') as f:
    writer = csv.DictWriter(f, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(roster_rows)

print(f"Complete! Updated {updates_made} entries in ROSTER_lookup.csv")

# Show some stats
print("\n--- Statistics ---")
print(f"Extracted PAM names: {len(extracted_pams)}")
print(f"PAM->PID mappings in PID_Portrait_Mapping.csv: {len(pam_to_pid)}")
print(f"Matched PAMs (found in both files): {len(matched_pams)}")
print(f"ROSTER rows updated: {updates_made}")
print(f"Unmatched PAMs (in extracted but not in PID_Portrait_Mapping): {len(extracted_pams - set(matched_pams.keys()))}")
