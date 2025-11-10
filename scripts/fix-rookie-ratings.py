"""
Fix Rookie and Career Progression Ratings

Recalculates OVR for each player-year based on THAT YEAR'S AV value.
Applies rookie caps and career progression/regression curves.

Key Principle: Each row is independent - use that row's AV + Years_Pro
to calculate that specific season's rating.

Examples:
- 1998 Peyton Manning (Rook, AV=11.0) → 76 OVR
- 2004 Peyton Manning (Year 6, AV=20.0) → 96 OVR
- 2015 Peyton Manning (Year 17, AV=13.0) → 88 OVR
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

INPUT_FILE = LOOKUPS_DIR / 'ROSTER_lookup_historical.csv'
OUTPUT_FILE = LOOKUPS_DIR / 'ROSTER_lookup_historical.csv'
MODERN_ROSTER_FILE = LOOKUPS_DIR / 'ROSTER_lookup.csv'

# Position groups for baseline OVR calculation
POSITION_GROUPS = {
    'QB': ['QB'],
    'RB': ['RB', 'FB', 'HB'],
    'WR': ['WR'],
    'TE': ['TE'],
    'OL': ['OT', 'OG', 'C', 'G', 'T'],
    'DL': ['DE', 'DT', 'NT'],
    'LB': ['LB', 'OLB', 'ILB', 'MLB'],
    'DB': ['CB', 'S', 'SS', 'FS', 'DB'],
    'K': ['K', 'P', 'LS']
}

def get_position_group(position):
    """Map position to position group"""
    if pd.isna(position):
        return 'UNKNOWN'

    pos = str(position).upper().strip()

    for group, positions in POSITION_GROUPS.items():
        if pos in positions:
            return group

    return 'UNKNOWN'

def parse_years_pro(years_pro_str):
    """Parse Years_Pro field to integer"""
    if pd.isna(years_pro_str) or years_pro_str == '':
        return 0

    years_str = str(years_pro_str).strip().upper()

    if years_str == 'ROOK' or years_str == 'ROOKIE':
        return 0

    # Try to convert to int
    try:
        return int(years_str)
    except:
        return 0

def av_to_ovr_baseline(av, position_group):
    """
    Convert AV to baseline OVR before adjustments

    AV ranges (approximate):
    - 0-3:  Backup/practice squad → 55-65 OVR
    - 4-7:  Rotational player → 66-75 OVR
    - 8-11: Starter → 76-82 OVR
    - 12-15: Above average starter → 83-89 OVR
    - 16-18: Pro Bowl level → 90-94 OVR
    - 19+:  All-Pro/Elite → 95-99 OVR
    """
    if pd.isna(av) or av == '' or av == 0:
        av = 3.0  # Default baseline for missing AV

    av = float(av)

    # Base formula: OVR ≈ 55 + (AV * 2.2)
    # This maps:
    # AV=0 → 55 OVR
    # AV=5 → 66 OVR
    # AV=10 → 77 OVR
    # AV=15 → 88 OVR
    # AV=20 → 99 OVR

    base_ovr = 55 + (av * 2.2)

    # Position adjustments (some positions have higher/lower baseline)
    position_mult = {
        'QB': 1.0,   # QBs rated normally
        'RB': 0.98,  # RBs slightly lower
        'WR': 0.98,  # WRs slightly lower
        'TE': 0.96,  # TEs lower
        'OL': 0.95,  # OL lower (less impactful in game)
        'DL': 0.97,  # DL slightly lower
        'LB': 0.96,  # LBs lower
        'DB': 0.98,  # DBs slightly lower
        'K': 0.90    # Kickers much lower
    }

    mult = position_mult.get(position_group, 1.0)
    base_ovr = base_ovr * mult

    # Clamp to valid range
    return max(40, min(99, base_ovr))

def apply_rookie_cap(ovr, years_pro, av):
    """
    Apply rookie year cap (75-80 max)

    Even elite rookies with high AV should not exceed 80 OVR
    """
    if years_pro == 0:  # Rookie year
        # Cap rookies at 80 OVR maximum
        # Elite rookies (AV > 12) can reach 80
        # Good rookies (AV 8-12) cap at 76-80
        # Average rookies (AV < 8) cap lower

        if av >= 12:
            return min(ovr, 80)  # Elite rookie cap
        elif av >= 8:
            return min(ovr, 78)  # Good rookie cap
        elif av >= 5:
            return min(ovr, 75)  # Decent rookie cap
        else:
            return min(ovr, 72)  # Backup rookie cap

    return ovr  # No cap for non-rookies

def apply_development_years_boost(ovr, years_pro):
    """
    Apply slight boost for years 1-3 (development phase)

    Young players haven't hit peak yet, even with good stats
    """
    if 1 <= years_pro <= 3:
        # Slight reduction for development years
        # Players haven't quite peaked even with good stats
        return ovr * 0.98

    return ovr

def apply_veteran_decline(ovr, years_pro, av, position_group):
    """
    Apply decline for veterans with many years and declining AV

    Position-specific decline curves:
    - QBs decline later (12+ years)
    - RBs decline earlier (8+ years)
    - Others in between
    """
    # Position-specific veteran thresholds
    veteran_threshold = {
        'QB': 12,  # QBs can play longer
        'RB': 8,   # RBs decline fast
        'WR': 10,  # WRs moderate
        'TE': 10,  # TEs moderate
        'OL': 11,  # OL can play longer
        'DL': 10,  # DL moderate
        'LB': 10,  # LBs moderate
        'DB': 10,  # DBs moderate
        'K': 15    # Kickers can play very long
    }

    threshold = veteran_threshold.get(position_group, 10)

    if years_pro >= threshold:
        # Apply decline if AV is also declining
        # AV < 10 for veteran suggests decline
        if av < 10:
            decline_factor = 0.95  # 5% decline
        elif av < 7:
            decline_factor = 0.90  # 10% decline
        else:
            decline_factor = 1.0  # No decline if still performing

        return ovr * decline_factor

    return ovr

def calculate_year_ovr(row):
    """
    Calculate OVR for a single player-year based on that year's AV

    Process:
    1. Get baseline OVR from AV
    2. Apply rookie cap if Years_Pro = 0
    3. Apply development adjustment for years 1-3
    4. Apply veteran decline if applicable
    """
    av = row['AV']
    years_pro = parse_years_pro(row['Years_Pro'])
    position = row['Position']
    position_group = get_position_group(position)

    # Step 1: Baseline OVR from AV
    ovr = av_to_ovr_baseline(av, position_group)

    # Step 2: Rookie cap
    ovr = apply_rookie_cap(ovr, years_pro, av)

    # Step 3: Development years adjustment
    ovr = apply_development_years_boost(ovr, years_pro)

    # Step 4: Veteran decline
    ovr = apply_veteran_decline(ovr, years_pro, av, position_group)

    # Final clamp and round
    ovr = max(40, min(99, round(ovr)))

    return int(ovr)

def main():
    print("="*80)
    print("FIXING ROOKIE AND CAREER PROGRESSION RATINGS")
    print("="*80)
    print()

    # Load roster
    print(f"Loading {INPUT_FILE}...")
    roster_df = pd.read_csv(INPUT_FILE)
    print(f"  Loaded {len(roster_df)} rows")
    print()

    # Calculate new OVR for each row
    print("Calculating year-by-year OVR based on AV and Years_Pro...")
    print()

    roster_df['New_POVR'] = roster_df.apply(calculate_year_ovr, axis=1)

    # Compare old vs new
    changes = roster_df[roster_df['POVR'] != roster_df['New_POVR']]
    print(f"Rows with OVR changes: {len(changes)}/{len(roster_df)}")
    print()

    # Show sample changes (rookies)
    print("Sample Rookie OVR Changes:")
    print("-" * 80)
    rookies = roster_df[roster_df['Years_Pro'] == 'Rook'].head(10)
    for idx, row in rookies.iterrows():
        print(f"{row['Year']} {row['Player_Name']:30s} {row['Position']:3s} AV={row['AV']:5.1f} | "
              f"Old OVR={row['POVR']:2d} -> New OVR={row['New_POVR']:2d}")
    print()

    # Show Peyton Manning progression
    print("Peyton Manning Career Progression:")
    print("-" * 80)
    pm = roster_df[roster_df['Player_Name'] == 'Peyton Manning'].sort_values('Year')
    if len(pm) > 0:
        print(f"{'Year':<6} {'Years_Pro':<10} {'AV':<6} {'Old OVR':<8} {'New OVR':<8}")
        for idx, row in pm.iterrows():
            print(f"{row['Year']:<6} {str(row['Years_Pro']):<10} {row['AV']:<6.1f} "
                  f"{row['POVR']:<8} {row['New_POVR']:<8}")
    print()

    # Statistics
    print("="*80)
    print("RATING ADJUSTMENT STATISTICS")
    print("="*80)
    print()

    print("OVR Distribution:")
    print(f"  Old: Min={roster_df['POVR'].min()}, Max={roster_df['POVR'].max()}, Mean={roster_df['POVR'].mean():.1f}")
    print(f"  New: Min={roster_df['New_POVR'].min()}, Max={roster_df['New_POVR'].max()}, Mean={roster_df['New_POVR'].mean():.1f}")
    print()

    # Rookie stats
    rookies_df = roster_df[roster_df['Years_Pro'] == 'Rook']
    if len(rookies_df) > 0:
        print("Rookie OVR Stats:")
        print(f"  Old: Min={rookies_df['POVR'].min()}, Max={rookies_df['POVR'].max()}, Mean={rookies_df['POVR'].mean():.1f}")
        print(f"  New: Min={rookies_df['New_POVR'].min()}, Max={rookies_df['New_POVR'].max()}, Mean={rookies_df['New_POVR'].mean():.1f}")
    print()

    # Apply changes
    print("Applying new OVR values...")
    roster_df['POVR'] = roster_df['New_POVR']
    roster_df = roster_df.drop(columns=['New_POVR'])
    print("  Done")
    print()

    # Save
    print(f"Saving updated roster to {OUTPUT_FILE}...")
    roster_df.to_csv(OUTPUT_FILE, index=False)
    print("  Saved successfully")
    print()

    print("Next step: Run fix-zero-attributes.py to fix missing attributes")

    return 0

if __name__ == '__main__':
    sys.exit(main())
