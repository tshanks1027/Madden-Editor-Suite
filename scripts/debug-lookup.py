#!/usr/bin/env python3
"""
Debug script to simulate exactly what PlayerDataService.ts does
"""
import pandas as pd
import csv

ROSTER_FILE = r'C:\Users\tshan\Documents\Dev\madden-editor-suite\data\lookups\ROSTER_lookup.csv'

print('=' * 80)
print('DEBUG: Simulating PlayerDataService.ts lookup logic')
print('=' * 80)

# Read the CSV exactly like TypeScript does
with open(ROSTER_FILE, 'r', encoding='utf-8') as f:
    content = f.read()

lines = content.strip().split('\n')
print(f'\nTotal lines: {len(lines):,}')
print(f'Header line: {lines[0][:200]}...')

# Parse header (using Python's CSV parser which handles quoted fields)
reader = csv.reader([lines[0]])
header = next(reader)
print(f'\nHeader columns (first 10):')
for i, col in enumerate(header[:10]):
    print(f'  {i}: {repr(col)}')

# Find Joe Burrow in 2021
print('\n' + '=' * 80)
print('Searching for Joe Burrow in Year 2021...')
print('=' * 80)

burrow_entries = []
for i, line in enumerate(lines[1:], start=1):  # Skip header
    if not line.strip():
        continue

    # Parse CSV line
    reader = csv.reader([line])
    try:
        parts = next(reader)
    except:
        continue

    if len(parts) < 70:
        continue

    year_str = parts[0].strip()
    player_name = parts[2].strip()

    # Check if this is Joe Burrow in 2021 (year might be "2021" or "2021.0")
    try:
        year_val = int(float(year_str)) if year_str else 0
    except:
        year_val = 0

    if 'Burrow' in player_name and year_val == 2021:
        burrow_entries.append({
            'line': i,
            'year': year_str,
            'player_name': player_name,
            'first_name': parts[3].strip(),
            'last_name': parts[4].strip(),
            'position': parts[5].strip(),
            'povr': parts[13].strip() if len(parts) > 13 else '',
            'team': parts[1].strip()
        })

print(f'\nFound {len(burrow_entries)} Burrow entries in 2021:')
for entry in burrow_entries:
    print(f'  Line {entry["line"]}:')
    print(f'    Player_Name (col 2): {repr(entry["player_name"])}')
    print(f'    First_Name (col 3): {repr(entry["first_name"])}')
    print(f'    Last_Name (col 4): {repr(entry["last_name"])}')
    print(f'    Position: {entry["position"]}')
    print(f'    OVR (col 13): {entry["povr"]}')
    print(f'    Team: {entry["team"]}')

    # Build the key exactly like TypeScript does
    # Line 514: const key = `${stats.playerName}_${stats.year}`;
    # Line 473: playerName: parts[2].trim(),
    # Line 471: year: parseInt(parts[0].trim()),
    lookup_key = f'{entry["player_name"]}_{entry["year"]}'
    print(f'    Lookup key would be: {repr(lookup_key)}')
    print()

# Now check what MaddenRatingGenerator passes
print('=' * 80)
print('What does MaddenRatingGenerator.ts pass?')
print('=' * 80)
print('Line 54-56:')
print('  const rookieStats = await playerDataService.getRookieStats(')
print('    context.name,           // <-- What is this value?')
print('    context.careerStats.draftClass  // <-- For 2020 draft')
print('  );')
print('\nLine 569: const rookieSeasonYear = draftYear + 1;  // 2020 + 1 = 2021')
print('Line 570: const key = `${playerName}_${rookieSeasonYear}`;')
print()
print('CRITICAL QUESTION: What is context.name in MaddenRatingGenerator?')
print('  - Is it "Joe Burrow" (with space)?')
print('  - Is it "Joseph Lee Burrow"?')
print('  - Is it something else?')
print()
print('The Player_Name in CSV is:', repr(burrow_entries[0]['player_name']) if burrow_entries else 'NOT FOUND')
print('The expected lookup key is:', repr(burrow_entries[0]['player_name'] + '_2021') if burrow_entries else 'NOT FOUND')
