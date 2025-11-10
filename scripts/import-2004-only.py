#!/usr/bin/env python3
"""
Quick script to import only 2004 data
"""

import pandas as pd
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

# Import the necessary functions
from pathlib import Path

BASE_DIR = Path(__file__).parent.parent
MADDEN_DIR = BASE_DIR / "data" / "Madden Old Ratings"
LOOKUP_FILE = BASE_DIR / "data" / "lookups" / "ROSTER_lookup.csv"

def safe_int(value, default=0):
    """Safely convert value to int"""
    if pd.isna(value):
        return default
    try:
        return int(float(value))
    except (ValueError, TypeError):
        return default

def safe_str(value, default=""):
    """Safely convert value to string"""
    if pd.isna(value):
        return default
    return str(value).strip()

def normalize_team_name(team_name, year):
    """Normalize team name to short format"""
    if pd.isna(team_name) or team_name == "":
        return None

    team_str = str(team_name).strip()

    # Remove trailing spaces (like "Cardinals ")
    team_str = team_str.strip()

    if team_str.lower() in ["free agent", "free agents"]:
        return f"{year} Free Agents"

    return team_str

def map_2004_format(df, year):
    """Map 2004 format (single Name column) to ROSTER_lookup format"""
    mapped = pd.DataFrame()

    # Assign scalar values properly for all rows
    n_rows = len(df)
    mapped['Year'] = [year] * n_rows

    # Split Name column into First and Last
    if 'Name' in df.columns:
        names = df['Name'].str.split(' ', n=1, expand=True)
        mapped['First_Name'] = names[0].apply(safe_str) if 0 in names.columns else ""
        mapped['Last_Name'] = names[1].apply(safe_str) if 1 in names.columns else ""
    mapped['Player_Name'] = df['Name'].apply(safe_str)

    mapped['Season_Team'] = df['Team'].apply(lambda x: normalize_team_name(x, year))
    mapped['Position'] = df['Position'].apply(safe_str)
    mapped['POVR'] = df['Overall'].apply(safe_int)
    mapped['Age'] = df['Age'].apply(safe_int)
    mapped['PSPD'] = df['Speed'].apply(safe_int)
    mapped['PSTR'] = df['Strength'].apply(safe_int)
    mapped['PAWR'] = df['Awareness'].apply(safe_int)
    mapped['PAGI'] = df['Agility'].apply(safe_int)
    mapped['PACC'] = df['Acceleration'].apply(safe_int)
    mapped['PCTH'] = df['Catching'].apply(safe_int)
    mapped['PCAR'] = df['Carrying'].apply(safe_int)
    mapped['PJMP'] = df['Jumping'].apply(safe_int)
    mapped['PTAK'] = df['Tackle'].apply(safe_int)
    mapped['PTHP'] = df['Throw Power'].apply(safe_int)
    mapped['PPBK'] = df['Pass Block'].apply(safe_int)
    mapped['PRBK'] = df['Run Block'].apply(safe_int)
    mapped['PKPW'] = df['Kick Power'].apply(safe_int)
    mapped['PKAC'] = df['Kick Accuracy'].apply(safe_int)
    mapped['PINJ'] = df['Injury'].apply(safe_int)
    mapped['PSTA'] = df['Stamina'].apply(safe_int)
    mapped['PTGH'] = df['Toughness'].apply(safe_int)

    # Map single Throw Accuracy to all three
    if 'Throw Accuracy' in df.columns:
        throw_acc = df['Throw Accuracy'].apply(safe_int)
        mapped['PTAS'] = throw_acc
        mapped['PTAM'] = throw_acc
        mapped['PTAD'] = throw_acc

    # 2004-specific columns
    if 'Break Tackle' in df.columns:
        mapped['PBTK'] = df['Break Tackle'].apply(safe_int)
    if 'Kick Return' in df.columns:
        mapped['PKRT'] = df['Kick Return'].apply(safe_int)

    return mapped

# Main execution
print("=" * 80)
print("IMPORTING 2004 DATA")
print("=" * 80)

# Read 2004 file
file_2004 = MADDEN_DIR / "2004 Rosters.xlsx"
print(f"\nReading: {file_2004}")
df = pd.read_excel(file_2004, sheet_name="Madden NFL 2004")
print(f"  Rows: {len(df)}")

# Map the data
print("\nMapping data...")
mapped = map_2004_format(df, 2004)
print(f"  Mapped: {len(mapped)} players")

# Check for valid data
valid_mask = (mapped['First_Name'] != "") & (mapped['Last_Name'] != "") & (mapped['Season_Team'].notna())
mapped_valid = mapped[valid_mask]
print(f"  Valid: {len(mapped_valid)} players")

# Load existing lookup
print(f"\nLoading existing lookup: {LOOKUP_FILE}")
df_lookup = pd.read_csv(LOOKUP_FILE, low_memory=False)
print(f"  Current rows: {len(df_lookup):,}")

# Append new data
print("\nAppending 2004 data...")
df_combined = pd.concat([df_lookup, mapped_valid], ignore_index=True)
print(f"  New total: {len(df_combined):,} rows")

# Save
print(f"\nSaving to {LOOKUP_FILE}...")
df_combined.to_csv(LOOKUP_FILE, index=False)

print("\n[SUCCESS] 2004 data imported!")

# Show team breakdown
print("\n2004 Team Breakdown:")
teams = mapped_valid['Season_Team'].value_counts()
for team, count in teams.items():
    print(f"  {team}: {count} players")
