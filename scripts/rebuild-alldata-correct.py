#!/usr/bin/env python3
"""
Rebuild ALLDATA_Lookup.csv using the CORRECT source file.

Base: MASTER_LOOKUP_COMPLETE.csv (50k players, correct HOF data, pre-1970 players)
Add PIDs/PLPOs from: FullData_Lookup.csv
"""

import csv
import os

# File paths
base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
data_dir = os.path.join(base_dir, 'data', 'lookups')

master_complete = os.path.join(data_dir, 'MASTER_LOOKUP_COMPLETE.csv')
fulldata = os.path.join(data_dir, 'FullData_Lookup.csv')
output_file = os.path.join(data_dir, 'ALLDATA_Lookup.csv')

def normalize_name(first, last):
    """Create normalized key for matching"""
    first = (first or '').strip().lower().replace('.', '').replace("'", '').replace('-', '').replace(' ', '')
    last = (last or '').strip().lower().replace('.', '').replace("'", '').replace('-', '').replace(' ', '')
    return f"{first}|{last}"

print("Loading MASTER_LOOKUP_COMPLETE.csv (base with 50k players)...")
master_data = {}
with open(master_complete, 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    for row in reader:
        # Use normalized name as key
        key = normalize_name(row['First Name'], row['Last Name'])
        # Store the row
        master_data[key] = row

print(f"Loaded {len(master_data)} players from MASTER_LOOKUP_COMPLETE.csv")

print("\nLoading FullData_Lookup.csv (PIDs and PLPOs)...")
fulldata_map = {}
with open(fulldata, 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    for row in reader:
        key = normalize_name(row['First Name'], row['Last Name'])
        fulldata_map[key] = {
            'PhotoID': row.get('PhotoID', ''),
            'Player Assets ID': row.get('Player Assets ID', ''),
            'CommID': row.get('CommID', ''),
            'PresID': row.get('PresID', ''),
            'PLPO': row.get('PLPO', '')
        }

print(f"Loaded {len(fulldata_map)} players with PIDs/PLPOs")

print("\nMerging data...")
merged_count = 0

# Get first row to see what fields exist
first_key = list(master_data.keys())[0]
fieldnames = list(master_data[first_key].keys())

# Add missing columns if they don't exist
if 'PhotoID' not in fieldnames:
    for row in master_data.values():
        row['PhotoID'] = ''
    fieldnames.insert(7, 'PhotoID')  # Insert after Position

if 'Player Assets ID' not in fieldnames:
    for row in master_data.values():
        row['Player Assets ID'] = ''
    fieldnames.insert(8, 'Player Assets ID')

if 'CommID' not in fieldnames:
    for row in master_data.values():
        row['CommID'] = ''
    fieldnames.insert(9, 'CommID')

if 'PresID' not in fieldnames:
    for row in master_data.values():
        row['PresID'] = ''
    fieldnames.insert(10, 'PresID')

if 'PLPO' not in fieldnames:
    for row in master_data.values():
        row['PLPO'] = ''
    fieldnames.insert(11, 'PLPO')

# Now merge the actual data
for key, master_row in master_data.items():
    if key in fulldata_map:
        # Merge PID/PLPO data into master row
        fulldata_row = fulldata_map[key]
        master_row['PhotoID'] = fulldata_row['PhotoID']
        master_row['Player Assets ID'] = fulldata_row['Player Assets ID']
        master_row['CommID'] = fulldata_row['CommID']
        master_row['PresID'] = fulldata_row['PresID']
        master_row['PLPO'] = fulldata_row['PLPO']
        merged_count += 1

print(f"Merged PIDs/PLPOs for {merged_count} players")

print(f"\nWriting ALLDATA_Lookup.csv...")

with open(output_file, 'w', newline='', encoding='utf-8') as f:
    writer = csv.DictWriter(f, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(master_data.values())

print(f"✓ Created ALLDATA_Lookup.csv with {len(master_data)} players")
print(f"\nVerifying Terry Bradshaw HOF status...")
bradshaw_key = normalize_name('Terry', 'Bradshaw')
if bradshaw_key in master_data:
    bradshaw = master_data[bradshaw_key]
    print(f"  Terry Bradshaw: isHOF={bradshaw['isHOF']}, PID={bradshaw.get('PhotoID', 'N/A')}")
else:
    print("  WARNING: Terry Bradshaw not found!")

print("\nDone!")
