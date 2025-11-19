"""
Check 2024 roster data quality
"""
import csv
import os

script_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(script_dir)
roster_file = os.path.join(project_root, "data", "lookups", "ROSTER_lookup.csv")

print("=== Checking 2024 Roster Data ===\n")

# Count 2024 data
year_2024_players = []
empty_names = []
empty_colleges = []

with open(roster_file, 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    for row in reader:
        year = row.get('Year', '').strip()
        if year == '2024.0':
            year_2024_players.append(row)

            first_name = row.get('First Name', '').strip()
            last_name = row.get('Last Name', '').strip()
            college = row.get('College', '').strip()

            if not first_name or not last_name:
                empty_names.append(row)

            if not college or college.lower() == 'blank':
                empty_colleges.append(row)

print(f"Total 2024 players: {len(year_2024_players)}")
print(f"Players with empty/missing names: {len(empty_names)}")
print(f"Players with empty/blank colleges: {len(empty_colleges)}\n")

# Show sample of 2024 data
print("Sample of 2024 roster data (first 20 players):")
print(f"{'PID':<8} {'Name':<30} {'PAM':<25} {'College':<20}")
print("-" * 90)
for player in year_2024_players[:20]:
    pid = player.get('PID', '').strip()
    first = player.get('First Name', '').strip()
    last = player.get('Last Name', '').strip()
    name = f"{first} {last}"
    pam = player.get('PAM', '').strip() or '(empty)'
    college = player.get('College', '').strip() or '(empty)'
    print(f"{pid:<8} {name:<30} {pam:<25} {college:<20}")

# Show sample of players with blank colleges
if empty_colleges:
    print(f"\n\nSample of players with blank colleges (first 10):")
    print(f"{'PID':<8} {'Name':<30} {'PAM':<25} {'College':<20}")
    print("-" * 90)
    for player in empty_colleges[:10]:
        pid = player.get('PID', '').strip()
        first = player.get('First Name', '').strip()
        last = player.get('Last Name', '').strip()
        name = f"{first} {last}"
        pam = player.get('PAM', '').strip() or '(empty)'
        college = player.get('College', '').strip() or '(empty)'
        print(f"{pid:<8} {name:<30} {pam:<25} {college:<20}")

# Show sample of players with empty names
if empty_names:
    print(f"\n\nSample of players with empty names (first 10):")
    print(f"{'PID':<8} {'Name':<30} {'PAM':<25} {'College':<20}")
    print("-" * 90)
    for player in empty_names[:10]:
        pid = player.get('PID', '').strip()
        first = player.get('First Name', '').strip()
        last = player.get('Last Name', '').strip()
        name = f"{first} {last}" if first or last else '(empty)'
        pam = player.get('PAM', '').strip() or '(empty)'
        college = player.get('College', '').strip() or '(empty)'
        print(f"{pid:<8} {name:<30} {pam:<25} {college:<20}")

# Check PAM coverage
players_with_pam = sum(1 for p in year_2024_players if p.get('PAM', '').strip() and p.get('PAM', '').strip() != '0')
print(f"\n\n=== PAM Coverage ===")
print(f"Players with PAM values: {players_with_pam} / {len(year_2024_players)} ({players_with_pam/len(year_2024_players)*100:.1f}%)")
