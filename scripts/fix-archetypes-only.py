"""
Fix Archetypes Only

Converts historical archetype format (QB_Arch0, RB_Arch2, etc.) to Madden archetype IDs (0-67)
"""

import pandas as pd
import sys
from pathlib import Path

# Unbuffered output
sys.stdout.reconfigure(line_buffering=True)
sys.stderr.reconfigure(line_buffering=True)

# Archetype mapping from historical format to Madden IDs
ARCHETYPE_MAPPING = {
    # QB Archetypes (0-4)
    'QB_Arch0': 0,   # QB Field General
    'QB_Arch1': 1,   # QB Strong Arm
    'QB_Arch2': 2,   # QB Improviser
    'QB_Arch3': 3,   # QB Scrambler
    'QB_Arch4': 4,   # QB Pure Scrambler

    # RB/HB Archetypes (5-11)
    'RB_Arch0': 5,   # HB Power Back
    'RB_Arch2': 6,   # HB Elusive Back
    'RB_Arch6': 7,   # HB Receiving Back
    'RB_Arch9': 10,  # HB Elusive Power

    # FB Archetypes (12-13)
    'FB_Arch0': 12,  # FB Blocking
    'FB_Arch1': 13,  # FB Utility

    # WR Archetypes (14-21)
    'WR_Arch0': 14,  # WR Deep Threat
    'WR_Arch3': 15,  # WR Playmaker
    'WR_Arch4': 16,  # WR Physical Route Runner
    'WR_Arch9': 17,  # WR Shifty Route Runner
    'WR_Arch5': 18,  # WR Physical Blocker
    'WR_Arch6': 19,  # WR Gadget Receiver

    # TE Archetypes (22-26)
    'TE_Arch0': 22,  # TE Blocking
    'TE_Arch2': 23,  # TE Vertical Threat
    'TE_Arch4': 24,  # TE Physical Route Runner

    # OL Archetypes (27-38)
    'OL_Arch0': 29,  # C Well-Rounded
    'OL_Arch7': 33,  # OT Well-Rounded
    'C_Arch0': 29,   # C Well-Rounded
    'C_Arch1': 27,   # C Pass Protector
    'OT_Arch0': 33,  # OT Well-Rounded
    'OT_Arch1': 31,  # OT Pass Protector
    'G_Arch0': 36,   # G Well-Rounded
    'G_Arch1': 35,   # G Pass Protector

    # DL Archetypes (39-46)
    'DL_Arch0': 40,  # DE Power Rusher
    'DL_Arch3': 42,  # DE Run Stopper
    'DL_Arch6': 45,  # DT Speed Rusher
    'DL_Arch7': 46,  # DT Power Rusher
    'DL_Arch8': 43,  # DT Nose Tackle
    'DE_Arch0': 40,  # DE Power Rusher
    'DE_Arch1': 39,  # DE Smaller Speed Rusher
    'DT_Arch0': 46,  # DT Power Rusher
    'DT_Arch1': 44,  # DT Pure Power

    # LB Archetypes (47-53)
    'LB_Arch6': 51,  # MLB Field General
    'LB_Arch7': 52,  # MLB Pass Coverage
    'LB_Arch9': 53,  # MLB Run Stopper
    'OLB_Arch0': 47, # OLB Speed Rusher
    'OLB_Arch1': 48, # OLB Power Rusher
    'MLB_Arch0': 51, # MLB Field General

    # DB/CB/S Archetypes (54-60)
    'DB_Arch2': 54,  # CB Man-to-Man
    'DB_Arch3': 55,  # CB Slot
    'DB_Arch6': 56,  # CB Zone
    'DB_Arch7': 57,  # CB Hybrid Corner
    'DB_Arch8': 58,  # S Zone
    'DB_Arch9': 59,  # S Hybrid
    'CB_Arch0': 54,  # CB Man-to-Man
    'CB_Arch1': 55,  # CB Slot
    'S_Arch0': 58,   # S Zone
    'S_Arch1': 59,   # S Hybrid

    # K/P Archetypes (61-62)
    'K_Arch0': 61,   # KP Accurate
    'K_Arch1': 62,   # KP Power
    'P_Arch0': 61,   # KP Accurate
    'P_Arch1': 62,   # KP Power
}

def main():
    if len(sys.argv) < 2:
        print("Usage: python fix-archetypes-only.py <file_path>")
        print("Example: python fix-archetypes-only.py data/lookups/ROSTER_lookup_historical.csv")
        return 1

    input_file = Path(sys.argv[1])

    if not input_file.exists():
        print(f"ERROR: File not found: {input_file}")
        return 1

    print("="*80)
    print(f"FIXING ARCHETYPES: {input_file.name}")
    print("="*80)
    print()

    # Load file
    print(f"Loading {input_file}...")
    df = pd.read_csv(input_file)
    print(f"  Loaded {len(df)} rows")
    print()

    # Check current archetype values
    print("Current archetype distribution:")
    arch_counts = df['Archetype'].value_counts()
    unmapped = 0
    for arch in arch_counts.head(20).index:
        if arch not in ARCHETYPE_MAPPING and arch != '' and not pd.isna(arch):
            if str(arch) not in ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']:
                print(f"  UNMAPPED: {arch}: {arch_counts[arch]}")
                unmapped += arch_counts[arch]
    print()

    # Convert archetypes
    print("Converting archetypes to Madden format...")
    n_converted = 0
    n_already_numeric = 0
    n_unmapped = 0

    for idx, row in df.iterrows():
        arch = row['Archetype']

        # Skip if empty/NaN
        if pd.isna(arch) or arch == '':
            continue

        arch_str = str(arch)

        # Already numeric (0-67)?
        try:
            arch_int = int(arch_str)
            if 0 <= arch_int <= 67:
                n_already_numeric += 1
                continue
        except:
            pass

        # Try to map
        if arch_str in ARCHETYPE_MAPPING:
            df.at[idx, 'Archetype'] = ARCHETYPE_MAPPING[arch_str]
            n_converted += 1
        else:
            # Unmapped - set to reasonable default based on position
            pos = str(row.get('Position', '')).upper().strip()
            default_arch = {
                'QB': 0, 'RB': 6, 'HB': 6, 'FB': 12,
                'WR': 15, 'TE': 23,
                'C': 29, 'OT': 33, 'OG': 36, 'G': 36, 'T': 33,
                'DE': 40, 'DT': 46, 'NT': 43,
                'LB': 51, 'OLB': 47, 'ILB': 51, 'MLB': 51,
                'CB': 54, 'S': 58, 'SS': 58, 'FS': 58, 'DB': 54,
                'K': 61, 'P': 61, 'LS': 65
            }.get(pos, 0)

            df.at[idx, 'Archetype'] = default_arch
            n_unmapped += 1

    print(f"  Converted: {n_converted}")
    print(f"  Already numeric: {n_already_numeric}")
    print(f"  Unmapped (assigned defaults): {n_unmapped}")
    print()

    # Verify all archetypes are now valid Madden IDs
    print("Verifying archetypes...")
    invalid = 0
    for idx, row in df.iterrows():
        arch = row['Archetype']
        if pd.isna(arch) or arch == '':
            continue

        try:
            arch_int = int(arch)
            if arch_int < 0 or arch_int > 67:
                invalid += 1
        except:
            invalid += 1

    print(f"  Valid Madden IDs (0-67): {len(df) - invalid}")
    print(f"  Invalid: {invalid}")
    print()

    # Save
    print(f"Saving updated file to {input_file}...")
    df.to_csv(input_file, index=False)
    print("  Saved successfully")
    print()

    print("="*80)
    print("ARCHETYPE CONVERSION COMPLETE!")
    print("="*80)

    return 0

if __name__ == '__main__':
    sys.exit(main())
