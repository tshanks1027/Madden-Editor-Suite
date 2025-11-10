"""
Assign College Archetypes Script

Assigns NFL-style archetypes to college players based on:
1. Player position
2. Calculated wAV (as proxy for OVR)
3. Trained NFL archetype clusters

Uses trained K-Means models to match college players to the closest archetype.
"""

import pandas as pd
import sys
import json
from pathlib import Path

# Unbuffered output
sys.stdout.reconfigure(line_buffering=True)
sys.stderr.reconfigure(line_buffering=True)

# Paths
BASE_DIR = Path('.')
LOOKUPS_DIR = BASE_DIR / 'data' / 'lookups'
MODELS_DIR = BASE_DIR / 'data' / 'models'

MERGED_ROSTER_FILE = LOOKUPS_DIR / 'FutureDraft_Lookup_MERGED.csv'
OUTPUT_FILE = LOOKUPS_DIR / 'FutureDraft_Lookup_MERGED.csv'

# Position group mappings (match NFL training)
POSITION_GROUPS = {
    'QB': ['QB'],
    'RB': ['RB', 'FB', 'HB'],
    'WR': ['WR'],
    'TE': ['TE'],
    'OL': ['OT', 'OG', 'OC', 'C', 'G', 'T'],
    'DL': ['DE', 'DT', 'NT'],
    'LB': ['LB', 'OLB', 'ILB', 'MLB'],
    'DB': ['CB', 'S', 'SS', 'FS', 'DB'],
    'K': ['K', 'P', 'LS']
}

# Cluster ID to Madden Archetype mapping
# Based on cluster characteristics and OVR ranges
CLUSTER_TO_ARCHETYPE = {
    'QB': {
        0: 'QB Field General',      # High OVR, balanced
        1: 'QB Improviser',          # Medium OVR
        2: 'QB Scrambler',           # Low attributes
        3: 'QB Field General',       # Medium-high
        4: 'QB Improviser',          # Low OVR baseline
        5: 'QB Strong Arm',          # High attributes
        6: 'QB Scrambler',           # High speed/agility
        7: 'QB Strong Arm',          # Medium, passing focused
    },
    'RB': {
        0: 'HB Elusive Back',
        1: 'HB Power Back',
        2: 'HB Elusive Back',
        3: 'HB Power Back',
        4: 'HB Receiving Back',
        5: 'HB Elusive Receiving',
        6: 'HB Power Receiving',
        7: 'HB Receiving Back',
        8: 'HB Power Back',
        9: 'HB Elusive Back',
    },
    'WR': {
        0: 'WR Deep Threat',
        1: 'WR Slot',
        2: 'WR Physical Route Runner',
        3: 'WR Shifty Route Runner',
        4: 'WR Playmaker',
        5: 'WR Physical',
        6: 'WR Deep Threat',
        7: 'WR Slot',
        8: 'WR Physical Route Runner',
        9: 'WR Shifty Route Runner',
    },
    'TE': {
        0: 'TE Vertical Threat',
        1: 'TE Blocking',
        2: 'TE Vertical Threat',
        3: 'TE Physical Route Runner',
        4: 'TE Possession',
    },
    'OL': {
        0: 'G Well-Rounded',         # Generic for OL
        1: 'OT Pass Protector',
        2: 'G Power',
        3: 'OT Agile',
        4: 'C Well-Rounded',
        5: 'G Pass Protector',
        6: 'OT Power',
        7: 'C Agile',
    },
    'DL': {
        0: 'DE Power Rusher',
        1: 'DT Power Rusher',
        2: 'DE Speed Rusher',
        3: 'DT Speed Rusher',
        4: 'DE Run Stopper',
        5: 'DT Nose Tackle',
        6: 'DE Pure Power',
        7: 'DT Pure Power',
        8: 'DE Speed Rusher',
        9: 'DT Power Rusher',
    },
    'LB': {
        0: 'MLB Run Stopper',
        1: 'OLB Pass Coverage',
        2: 'MLB Field General',
        3: 'OLB Speed Rusher',
        4: 'MLB Pass Coverage',
        5: 'OLB Run Stopper',
        6: 'MLB Field General',
        7: 'OLB Power Rusher',
        8: 'MLB Run Stopper',
        9: 'OLB Pass Coverage',
    },
    'DB': {
        0: 'CB Man-to-Man',
        1: 'S Zone',
        2: 'CB Zone',
        3: 'S Hybrid',
        4: 'CB Slot',
        5: 'S Run Support',
        6: 'CB Hybrid Corner',
        7: 'S Zone',
        8: 'CB Man-to-Man',
        9: 'S Hybrid',
    },
    'K': {
        0: 'KP Accurate',
        1: 'KP Power',
        2: 'KP Accurate',
    }
}

def normalize_position(pos):
    """Normalize position to standard format"""
    if pd.isna(pos) or not pos:
        return 'UNKNOWN'

    pos = str(pos).upper().strip()

    # Map variations
    if pos in ['QUARTERBACK', 'QBS']:
        return 'QB'
    if pos in ['RUNNINGBACK', 'RUNNING BACK', 'HALFBACK', 'HB', 'RBS']:
        return 'RB'
    if pos in ['WIDE RECEIVER', 'WIDERECEIVER', 'RECEIVER', 'WRS']:
        return 'WR'
    if pos in ['TIGHT END', 'TIGHTEND', 'TES']:
        return 'TE'
    if pos in ['FULLBACK', 'FBS']:
        return 'FB'
    if pos in ['OFFENSIVE TACKLE', 'TACKLE', 'OTS']:
        return 'OT'
    if pos in ['OFFENSIVE GUARD', 'GUARD', 'OGS']:
        return 'OG'
    if pos in ['CENTER', 'CENTERS', 'OCS']:
        return 'OC'
    if pos in ['DEFENSIVE END', 'DES']:
        return 'DE'
    if pos in ['DEFENSIVE TACKLE', 'DTS']:
        return 'DT'
    if pos in ['NOSE TACKLE', 'NTS']:
        return 'NT'
    if pos in ['LINEBACKER', 'LBS']:
        return 'LB'
    if pos in ['OUTSIDE LINEBACKER', 'OLBS']:
        return 'OLB'
    if pos in ['INSIDE LINEBACKER', 'ILBS']:
        return 'ILB'
    if pos in ['MIDDLE LINEBACKER', 'MLBS']:
        return 'MLB'
    if pos in ['CORNERBACK', 'CORNER', 'CBS']:
        return 'CB'
    if pos in ['SAFETY', 'SAFETIES', 'SS', 'FS', 'DBS']:
        return 'S'
    if pos in ['KICKER', 'PK', 'KS']:
        return 'K'
    if pos in ['PUNTER', 'PS']:
        return 'P'
    if pos in ['LONG SNAPPER']:
        return 'LS'

    return pos

def get_position_group(position):
    """Map position to position group"""
    pos_norm = normalize_position(position)

    for group, positions in POSITION_GROUPS.items():
        if pos_norm in positions:
            return group

    return None

def load_archetypes(position_group):
    """Load archetype definitions for a position group"""
    archetype_file = MODELS_DIR / f'{position_group}_archetypes.json'

    if not archetype_file.exists():
        return None

    with open(archetype_file, 'r') as f:
        return json.load(f)

def assign_archetype(player_wav, archetypes, position_group):
    """
    Assign player to closest archetype based on wAV
    Uses wAV as a proxy for OVR to match to archetype mean_ovr
    Returns actual Madden archetype name
    """
    if not archetypes or not archetypes.get('archetypes'):
        return None

    # Handle missing/invalid wAV
    if pd.isna(player_wav) or player_wav == '' or player_wav == 0:
        player_wav = 4.0  # Default baseline

    player_wav = float(player_wav)

    # Find closest archetype by mean_ovr
    # Scale wAV (0-20) to approximate OVR range (40-99)
    # Rough conversion: wAV of 10 ≈ OVR of 70
    estimated_ovr = min(99, max(40, 40 + (player_wav * 3)))

    best_archetype_cluster = None
    best_diff = float('inf')

    for archetype in archetypes['archetypes']:
        mean_ovr = archetype.get('mean_ovr', 65)
        diff = abs(estimated_ovr - mean_ovr)

        if diff < best_diff:
            best_diff = diff
            best_archetype_cluster = archetype['cluster_id']

    # Map cluster ID to Madden archetype name
    if best_archetype_cluster is not None and position_group in CLUSTER_TO_ARCHETYPE:
        archetype_map = CLUSTER_TO_ARCHETYPE[position_group]
        if best_archetype_cluster in archetype_map:
            return archetype_map[best_archetype_cluster]

    return None

def main():
    print("="*80)
    print("ASSIGNING COLLEGE ARCHETYPES")
    print("="*80)
    print()

    # Load merged roster
    print("Loading merged roster...")
    roster_df = pd.read_csv(MERGED_ROSTER_FILE)
    print(f"  Loaded {len(roster_df)} players")
    print()

    # Load archetype models
    print("Loading NFL archetype models...")
    archetype_data = {}
    for group in POSITION_GROUPS.keys():
        archetypes = load_archetypes(group)
        if archetypes:
            n_archetypes = archetypes.get('n_archetypes', 0)
            archetype_data[group] = archetypes
            print(f"  {group}: {n_archetypes} archetypes")
        else:
            print(f"  {group}: No archetypes found")

    print()

    # Add Archetype column if it doesn't exist
    if 'Archetype' not in roster_df.columns:
        roster_df['Archetype'] = ''

    # Assign archetypes
    print("="*80)
    print("ASSIGNING ARCHETYPES")
    print("="*80)
    print()

    n_assigned = 0
    n_skipped = 0
    position_counts = {}

    for idx, player in roster_df.iterrows():
        position = player['Position']
        wav = player.get('wAV', 4.0)

        # Get position group
        pos_group = get_position_group(position)

        if not pos_group or pos_group not in archetype_data:
            n_skipped += 1
            continue

        # Assign archetype (returns Madden archetype name)
        archetype_name = assign_archetype(wav, archetype_data[pos_group], pos_group)

        if archetype_name is not None:
            roster_df.at[idx, 'Archetype'] = archetype_name
            n_assigned += 1

            # Track counts
            if pos_group not in position_counts:
                position_counts[pos_group] = {}
            if archetype_name not in position_counts[pos_group]:
                position_counts[pos_group][archetype_name] = 0
            position_counts[pos_group][archetype_name] += 1
        else:
            n_skipped += 1

        # Progress update
        if (idx + 1) % 1000 == 0:
            print(f"Processed {idx + 1}/{len(roster_df)} players... "
                  f"(Assigned: {n_assigned}, Skipped: {n_skipped})")
            sys.stdout.flush()

    print()
    print(f"Processed all {len(roster_df)} players")
    print()

    # Summary
    print("="*80)
    print("ARCHETYPE ASSIGNMENT COMPLETE")
    print("="*80)
    print()

    print(f"Total players: {len(roster_df)}")
    print(f"  Archetypes assigned: {n_assigned}")
    print(f"  Skipped (no model): {n_skipped}")
    print()

    # Position group breakdown
    print("Archetype Distribution by Position:")
    for pos_group in sorted(position_counts.keys()):
        print(f"\n  {pos_group}:")
        total = sum(position_counts[pos_group].values())
        for archetype_name in sorted(position_counts[pos_group].keys()):
            count = position_counts[pos_group][archetype_name]
            pct = (count / total * 100) if total > 0 else 0
            print(f"    {archetype_name}: {count} ({pct:.1f}%)")

    print()

    # Save output
    print(f"Saving updated roster to {OUTPUT_FILE}...")
    roster_df.to_csv(OUTPUT_FILE, index=False)
    print("  Saved successfully")
    print()

    print("Next step: Run scrape-college-bio.py to fill missing bio data")

    return 0

if __name__ == '__main__':
    sys.exit(main())
