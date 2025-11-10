"""
Simplify Archetypes to Madden 26 Format

Maps the 68 detailed Madden archetypes (IDs 0-67) to the simplified
Madden 26 archetype format from Archetypes.pdf.

Applies to:
- ALL_PLAYER_LOOKUP.csv
- FutureDraft_Lookup_MERGED.csv
- ROSTER_lookup.csv
"""

import pandas as pd
import sys
from pathlib import Path

# Unbuffered output
sys.stdout.reconfigure(line_buffering=True)
sys.stderr.reconfigure(line_buffering=True)

# Paths
BASE_DIR = Path('.')
LOOKUPS_DIR = BASE_DIR / 'data' / 'lookups'

# Madden 26 Simplified Archetypes (from PDF)
# Maps detailed archetype IDs (0-67) to simplified archetype names

ARCHETYPE_M26_MAPPING = {
    # QB Archetypes (0-4) -> 4 simplified
    0: 'Field General',      # QB Field General
    1: 'Strong Arm',         # QB Strong Arm
    2: 'Improviser',         # QB Improviser
    3: 'Scrambler',          # QB Scrambler
    4: 'Scrambler',          # QB Pure Scrambler (maps to Scrambler)

    # HB/RB Archetypes (5-11) -> 3 simplified
    5: 'Power Back',         # HB Power Back
    6: 'Elusive Back',       # HB Elusive Back
    7: 'Receiving',          # HB Receiving Back
    8: 'Power Back',         # HB Power Blocking (maps to Power)
    9: 'Power Back',         # HB Power Receiving (maps to Power)
    10: 'Elusive Back',      # HB Elusive Power (maps to Elusive)
    11: 'Elusive Back',      # HB Elusive Receiving (maps to Elusive)

    # FB Archetypes (12-13) -> Use RB categories
    12: 'Blocking',          # FB Blocking
    13: 'Receiving',         # FB Utility (maps to Receiving)

    # WR Archetypes (14-21) -> 4 simplified
    14: 'Deep Threat',       # WR Deep Threat
    15: 'Playmaker',         # WR Playmaker
    16: 'Physical',          # WR Physical Route Runner
    17: 'Slot',              # WR Shifty Route Runner (maps to Slot)
    18: 'Physical',          # WR Physical Blocker (maps to Physical)
    19: 'Slot',              # WR Gadget Receiver (maps to Slot)
    20: 'Deep Threat',       # WR Deep Speed (maps to Deep Threat)
    21: 'Playmaker',         # WR Route Running (maps to Playmaker)

    # TE Archetypes (22-26) -> 3 simplified
    22: 'Blocking',          # TE Blocking
    23: 'Vertical Threat',   # TE Vertical Threat
    24: 'Possession',        # TE Physical Route Runner (maps to Possession)
    25: 'Possession',        # TE Possession
    26: 'Vertical Threat',   # TE Receiving (maps to Vertical)

    # C Archetypes (27-30) -> 3 simplified (OL categories)
    27: 'Pass Protector',    # C Pass Protector
    28: 'Power',             # C Power
    29: 'Agile',             # C Well-Rounded (maps to Agile)
    30: 'Agile',             # C Agile

    # OT Archetypes (31-34) -> 3 simplified (OL categories)
    31: 'Pass Protector',    # OT Pass Protector
    32: 'Power',             # OT Power
    33: 'Agile',             # OT Well-Rounded (maps to Agile)
    34: 'Agile',             # OT Agile

    # OG Archetypes (35-38) -> 3 simplified (OL categories)
    35: 'Pass Protector',    # OG Pass Protector
    36: 'Agile',             # OG Well-Rounded (maps to Agile)
    37: 'Power',             # OG Power
    38: 'Agile',             # OG Agile

    # DE/EDGE Archetypes (39-42) -> 3 simplified
    39: 'Speed Rusher',      # DE Smaller Speed Rusher
    40: 'Power Rusher',      # DE Power Rusher
    41: 'Speed Rusher',      # DE Speed Rusher
    42: 'Run Stopper',       # DE Run Stopper

    # DT Archetypes (43-46) -> 3 simplified
    43: 'Nose',              # DT Nose Tackle
    44: 'Power Rusher',      # DT Pure Power (maps to Power Rusher)
    45: 'Speed Rusher',      # DT Speed Rusher
    46: 'Power Rusher',      # DT Power Rusher

    # OLB Archetypes (47-50) -> 2 simplified (Will/Sam)
    47: 'Speed Rusher',      # OLB Speed Rusher (for EDGE OLBs)
    48: 'Power Rusher',      # OLB Power Rusher (for EDGE OLBs)
    49: 'Pass Coverage',     # OLB Pass Coverage
    50: 'Run Stopper',       # OLB Run Stopper

    # MLB Archetypes (51-53) -> 3 simplified (Mike)
    51: 'Field General',     # MLB Field General
    52: 'Pass Coverage',     # MLB Pass Coverage
    53: 'Run Stopper',       # MLB Run Stopper

    # CB Archetypes (54-57) -> 3 simplified
    54: 'Man To Man',        # CB Man-to-Man
    55: 'Slot',              # CB Slot
    56: 'Zone',              # CB Zone
    57: 'Man To Man',        # CB Hybrid Corner (maps to Man)

    # S Archetypes (58-60) -> 3 simplified
    58: 'Zone',              # S Zone
    59: 'Hybrid',            # S Hybrid
    60: 'Run Support',       # S Run Support

    # K/P Archetypes (61-67)
    61: 'Accurate',          # KP Accurate
    62: 'Power',             # KP Power
    63: 'Accurate',          # K Accurate
    64: 'Power',             # K Power
    65: 'Accurate',          # LS (Long Snapper - use Accurate)
    66: 'Accurate',          # P Accurate
    67: 'Power',             # P Power
}

def simplify_archetype(archetype_value):
    """Convert archetype ID (0-67) or detailed name to simplified Madden 26 name"""
    if pd.isna(archetype_value) or archetype_value == '':
        return ''

    arch_str = str(archetype_value).strip()

    # Try numeric ID conversion first
    try:
        arch_id = int(float(arch_str))  # Handle "29.0" format
        if arch_id in ARCHETYPE_M26_MAPPING:
            return ARCHETYPE_M26_MAPPING[arch_id]
    except:
        pass

    # Already a string name - check if it needs simplification
    # Map detailed names to simplified names
    detailed_to_simplified = {
        # Already simplified - keep as-is
        'Field General': 'Field General',
        'Strong Arm': 'Strong Arm',
        'Improviser': 'Improviser',
        'Scrambler': 'Scrambler',
        'Power Back': 'Power Back',
        'Elusive Back': 'Elusive Back',
        'Receiving': 'Receiving',
        'Blocking': 'Blocking',
        'Deep Threat': 'Deep Threat',
        'Playmaker': 'Playmaker',
        'Physical': 'Physical',
        'Slot': 'Slot',
        'Vertical Threat': 'Vertical Threat',
        'Possession': 'Possession',
        'Pass Protector': 'Pass Protector',
        'Power': 'Power',
        'Agile': 'Agile',
        'Speed Rusher': 'Speed Rusher',
        'Power Rusher': 'Power Rusher',
        'Run Stopper': 'Run Stopper',
        'Nose': 'Nose',
        'Pass Coverage': 'Pass Coverage',
        'Man To Man': 'Man To Man',
        'Zone': 'Zone',
        'Hybrid': 'Hybrid',
        'Run Support': 'Run Support',
        'Accurate': 'Accurate',

        # Detailed names that need simplification
        'QB Field General': 'Field General',
        'QB Strong Arm': 'Strong Arm',
        'QB Improviser': 'Improviser',
        'QB Scrambler': 'Scrambler',
        'QB Pure Scrambler': 'Scrambler',
        'HB Power Back': 'Power Back',
        'HB Elusive Back': 'Elusive Back',
        'HB Receiving Back': 'Receiving',
        'HB Power Blocking': 'Power Back',
        'HB Power Receiving': 'Power Back',
        'HB Elusive Power': 'Elusive Back',
        'HB Elusive Receiving': 'Elusive Back',
        'FB Blocking': 'Blocking',
        'FB Utility': 'Receiving',
        'WR Deep Threat': 'Deep Threat',
        'WR Playmaker': 'Playmaker',
        'WR Physical Route Runner': 'Physical',
        'WR Shifty Route Runner': 'Slot',
        'WR Physical Blocker': 'Physical',
        'WR Gadget Receiver': 'Slot',
        'WR Deep Speed': 'Deep Threat',
        'WR Route Running': 'Playmaker',
        'TE Blocking': 'Blocking',
        'TE Vertical Threat': 'Vertical Threat',
        'TE Physical Route Runner': 'Possession',
        'TE Possession': 'Possession',
        'TE Receiving': 'Vertical Threat',
        'C Pass Protector': 'Pass Protector',
        'C Power': 'Power',
        'C Well-Rounded': 'Agile',
        'C Agile': 'Agile',
        'OT Pass Protector': 'Pass Protector',
        'OT Power': 'Power',
        'OT Well-Rounded': 'Agile',
        'OT Agile': 'Agile',
        'G Pass Protector': 'Pass Protector',
        'G Well-Rounded': 'Agile',
        'G Power': 'Power',
        'G Agile': 'Agile',
        'OG Pass Protector': 'Pass Protector',
        'OG Well-Rounded': 'Agile',
        'OG Power': 'Power',
        'OG Agile': 'Agile',
        'DE Smaller Speed Rusher': 'Speed Rusher',
        'DE Power Rusher': 'Power Rusher',
        'DE Speed Rusher': 'Speed Rusher',
        'DE Run Stopper': 'Run Stopper',
        'DT Nose Tackle': 'Nose',
        'DT Pure Power': 'Power Rusher',
        'DT Speed Rusher': 'Speed Rusher',
        'DT Power Rusher': 'Power Rusher',
        'OLB Speed Rusher': 'Speed Rusher',
        'OLB Power Rusher': 'Power Rusher',
        'OLB Pass Coverage': 'Pass Coverage',
        'OLB Run Stopper': 'Run Stopper',
        'MLB Field General': 'Field General',
        'MLB Pass Coverage': 'Pass Coverage',
        'MLB Run Stopper': 'Run Stopper',
        'CB Man-to-Man': 'Man To Man',
        'CB Slot': 'Slot',
        'CB Zone': 'Zone',
        'CB Hybrid Corner': 'Man To Man',
        'S Zone': 'Zone',
        'S Hybrid': 'Hybrid',
        'S Run Support': 'Run Support',
        'KP Accurate': 'Accurate',
        'KP Power': 'Power',
        'K Accurate': 'Accurate',
        'K Power': 'Power',
        'P Accurate': 'Accurate',
        'P Power': 'Power',
    }

    if arch_str in detailed_to_simplified:
        return detailed_to_simplified[arch_str]

    # Unknown archetype, return as-is
    return arch_str

def process_file(file_path):
    """Process a single CSV file to simplify archetypes"""
    print(f"Processing {file_path.name}...")

    # Load file
    df = pd.read_csv(file_path)
    print(f"  Loaded {len(df)} rows")

    # Check if Archetype column exists
    if 'Archetype' not in df.columns:
        print(f"  WARNING: No 'Archetype' column found, skipping")
        return

    # Show current archetype distribution (top 10)
    print("  Current archetype distribution (top 10):")
    arch_counts = df['Archetype'].value_counts()
    for arch in arch_counts.head(10).index:
        print(f"    {arch}: {arch_counts[arch]}")

    # Create backup column with detailed archetype OR restore from backup
    if 'Archetype_Detailed' not in df.columns:
        df['Archetype_Detailed'] = df['Archetype']
        print("  Created 'Archetype_Detailed' column (backup of original)")
    else:
        # Restore from backup before re-processing
        print("  Found existing 'Archetype_Detailed' column - restoring to 'Archetype' before re-processing")
        df['Archetype'] = df['Archetype_Detailed']

    # Simplify archetypes
    print("  Simplifying archetypes to Madden 26 format...")
    n_changed = 0

    for idx, row in df.iterrows():
        old_arch = row['Archetype']
        new_arch = simplify_archetype(old_arch)

        if new_arch != old_arch:
            df.at[idx, 'Archetype'] = new_arch
            n_changed += 1

    print(f"  Changed {n_changed}/{len(df)} archetypes")

    # Show new distribution
    print("  New archetype distribution (top 10):")
    new_counts = df['Archetype'].value_counts()
    for arch in new_counts.head(10).index:
        print(f"    {arch}: {new_counts[arch]}")

    # Save
    print(f"  Saving updated file...")
    df.to_csv(file_path, index=False)
    print(f"  Saved successfully")
    print()

def main():
    print("="*80)
    print("SIMPLIFYING ARCHETYPES TO MADDEN 26 FORMAT")
    print("="*80)
    print()

    # Files to process
    files = [
        LOOKUPS_DIR / 'ALL_PLAYER_LOOKUP.csv',
        LOOKUPS_DIR / 'FutureDraft_Lookup_MERGED.csv',
        LOOKUPS_DIR / 'ROSTER_lookup.csv'
    ]

    for file_path in files:
        if not file_path.exists():
            print(f"WARNING: {file_path.name} not found, skipping")
            print()
            continue

        process_file(file_path)

    print("="*80)
    print("ARCHETYPE SIMPLIFICATION COMPLETE!")
    print("="*80)
    print()
    print("Summary:")
    print("  - Original detailed archetype IDs (0-67) backed up to 'Archetype_Detailed' column")
    print("  - 'Archetype' column now contains simplified Madden 26 names")
    print("  - You can use 'Archetype_Detailed' for internal rating calculations if needed")

    return 0

if __name__ == '__main__':
    sys.exit(main())
