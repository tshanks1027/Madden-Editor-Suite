#!/usr/bin/env python3
"""
Fix invalid PIDs in ROSTER_lookup.csv

This script:
1. Loads all valid PIDs from PID_Portrait_Mapping.csv
2. Scans ROSTER_lookup.csv for invalid PIDs
3. Replaces invalid PIDs with random valid generic PIDs
4. Saves the corrected CSV
"""

import csv
import random
from pathlib import Path

# Paths
project_root = Path(__file__).parent.parent
pid_mapping_path = project_root / "data" / "lookups" / "PID_Portrait_Mapping.csv"
roster_lookup_path = project_root / "data" / "lookups" / "ROSTER_lookup.csv"
output_path = project_root / "data" / "lookups" / "ROSTER_lookup_FIXED.csv"

print("=== FIX ROSTER PIDs ===")
print(f"Loading valid PIDs from: {pid_mapping_path}")

# Step 1: Load all valid PIDs from PID_Portrait_Mapping.csv
valid_pids = set()
generic_pids = []

with open(pid_mapping_path, 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    for row in reader:
        try:
            pid = int(float(row['PID']))
            valid_pids.add(pid)
            if row.get('Type') == 'generic':
                generic_pids.append(pid)
        except (ValueError, KeyError):
            continue

print(f"[OK] Loaded {len(valid_pids):,} valid PIDs")
print(f"[OK] Found {len(generic_pids):,} generic PIDs")

# Step 2: Load ROSTER_lookup.csv and fix invalid PIDs
print(f"\nLoading roster data from: {roster_lookup_path}")

with open(roster_lookup_path, 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    fieldnames = reader.fieldnames

    # Determine PID column name
    pid_column = None
    for possible_name in ['PID', 'PhotoID', 'PSXP']:
        if possible_name in fieldnames:
            pid_column = possible_name
            break

    if not pid_column:
        print(f"ERROR: Could not find PID column in CSV. Headers: {fieldnames}")
        exit(1)

    print(f"[OK] Using PID column: '{pid_column}'")

    rows = list(reader)

print(f"[OK] Loaded {len(rows):,} roster entries")

# Step 3: Scan and fix invalid PIDs
invalid_count = 0
replacements = []

for row in rows:
    try:
        # Get current PID value
        pid_str = str(row.get(pid_column, '0')).strip()
        if not pid_str or pid_str == '' or pid_str == 'nan':
            current_pid = 0
        else:
            current_pid = int(float(pid_str))

        # Check if PID is valid
        if current_pid > 0 and current_pid not in valid_pids:
            # Invalid PID - replace with random generic
            new_pid = random.choice(generic_pids)
            player_name = f"{row.get('First Name', '')} {row.get('Last Name', '')}"
            replacements.append((player_name, current_pid, new_pid))
            row[pid_column] = str(new_pid)
            invalid_count += 1
        elif current_pid == 0:
            # No PID - assign generic
            new_pid = random.choice(generic_pids)
            player_name = f"{row.get('First Name', '')} {row.get('Last Name', '')}"
            replacements.append((player_name, 0, new_pid))
            row[pid_column] = str(new_pid)
            invalid_count += 1

    except (ValueError, KeyError) as e:
        print(f"Warning: Error processing row: {e}")
        continue

print(f"\n=== RESULTS ===")
print(f"Total entries: {len(rows):,}")
print(f"Invalid/missing PIDs found: {invalid_count:,}")

if replacements:
    print(f"\nFirst 20 replacements:")
    for i, (name, old_pid, new_pid) in enumerate(replacements[:20], 1):
        print(f"  {i}. {name:30} | {old_pid:6} -> {new_pid}")

# Step 4: Save corrected CSV
print(f"\nSaving corrected data to: {output_path}")

with open(output_path, 'w', encoding='utf-8', newline='') as f:
    writer = csv.DictWriter(f, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(rows)

print(f"[OK] Saved {len(rows):,} entries")
print(f"\n=== DONE ===")
print(f"Original file: {roster_lookup_path}")
print(f"Fixed file:    {output_path}")
print(f"\nReview the fixed file, then replace the original with:")
print(f"  move /Y \"{output_path}\" \"{roster_lookup_path}\"")
