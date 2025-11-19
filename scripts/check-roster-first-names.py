"""
Check if First Name and Last Name columns have data in ROSTER_lookup.csv for 2024
"""
import csv
import os

script_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(script_dir)
roster_file = os.path.join(project_root, "data", "lookups", "ROSTER_lookup.csv")

print("=== Checking First Name / Last Name in ROSTER_lookup.csv (2024) ===\n")

# Check 2024 data
year_2024_players = []

with open(roster_file, 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    fieldnames = reader.fieldnames
    print(f"Column headers: {fieldnames[:12]}\n")  # Show first 12 columns

    for row in reader:
        year = row.get('Year', '').strip()
        if year == '2024.0':
            year_2024_players.append(row)
            if len(year_2024_players) >= 20:
                break

print(f"First 20 players in 2024:\n")
print(f"{'Row':<5} {'First Name':<20} {'Last Name':<20} {'Player_Name':<30}")
print("-" * 80)
for i, player in enumerate(year_2024_players, 1):
    first = player.get('First Name', '(MISSING KEY)')
    last = player.get('Last Name', '(MISSING KEY)')
    player_name = player.get('Player_Name', '')
    print(f"{i:<5} {first:<20} {last:<20} {player_name:<30}")
