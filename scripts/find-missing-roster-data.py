"""
Find which players are missing names, colleges, or PAMs in the 2024 roster
"""
import csv
import os

script_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(script_dir)
roster_file = os.path.join(project_root, "data", "lookups", "ROSTER_lookup.csv")

print("=== Finding Missing Data in 2024 Roster ===\n")

# Track issues
missing_pam = []  # PAM is empty or "0" or "0.0"
blank_college = []
missing_names = []

with open(roster_file, 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    for row in reader:
        year = row.get('Year', '').strip()
        if year == '2024.0':
            pid = row.get('PID', '').strip()
            first = row.get('First Name', '').strip()
            last = row.get('Last Name', '').strip()
            pam = row.get('PAM', '').strip()
            college = row.get('College', '').strip()

            # Check for missing PAM
            if not pam or pam in ['0', '0.0', '0.00']:
                missing_pam.append({
                    'pid': pid,
                    'name': f"{first} {last}",
                    'college': college
                })

            # Check for blank college
            if not college or college.lower() == 'blank':
                blank_college.append({
                    'pid': pid,
                    'name': f"{first} {last}",
                    'pam': pam
                })

            # Check for missing names
            if not first or not last:
                missing_names.append({
                    'pid': pid,
                    'first': first,
                    'last': last,
                    'pam': pam,
                    'college': college
                })

print(f"Players missing PAM (empty or '0'): {len(missing_pam)}")
print(f"Players with blank college: {len(blank_college)}")
print(f"Players with missing names: {len(missing_names)}\n")

# Show samples
if missing_pam:
    print("Sample of players missing PAM (first 30):")
    print(f"{'PID':<10} {'Name':<35} {'College':<25}")
    print("-" * 75)
    for player in missing_pam[:30]:
        print(f"{player['pid']:<10} {player['name']:<35} {player['college']:<25}")

if blank_college:
    print(f"\n\nPlayers with blank colleges ({len(blank_college)} total):")
    print(f"{'PID':<10} {'Name':<35} {'PAM':<25}")
    print("-" * 75)
    for player in blank_college:
        print(f"{player['pid']:<10} {player['name']:<35} {player['pam']:<25}")

if missing_names:
    print(f"\n\nPlayers with missing names ({len(missing_names)} total):")
    print(f"{'PID':<10} {'First':<20} {'Last':<20}")
    print("-" * 55)
    for player in missing_names:
        print(f"{player['pid']:<10} {player['first']:<20} {player['last']:<20}")
