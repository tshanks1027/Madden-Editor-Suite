"""
Fix All Remaining Issues - Phases 3-6

Combines all remaining fixes in one efficient script:
- Phase 3: Fix zero attributes
- Phase 4: Calculate Dev Traits
- Phase 5: Fix archetypes
- Phase 6: Match PIDs/PAMs

Can also be applied to other files (ROSTER_lookup.csv, FutureDraft files)
"""

import pandas as pd
import sys
from pathlib import Path
from Levenshtein import distance as levenshtein_distance

# Unbuffered output
sys.stdout.reconfigure(line_buffering=True)
sys.stderr.reconfigure(line_buffering=True)

# Paths
BASE_DIR = Path('.')
LOOKUPS_DIR = BASE_DIR / 'data' / 'lookups'

# Position-specific minimum attributes
ATTRIBUTE_MINIMUMS = {
    'QB':  {'PSPD': 40, 'PACC': 50, 'PAGI': 40, 'PSTR': 50},
    'RB':  {'PSPD': 75, 'PACC': 80, 'PAGI': 75, 'PSTR': 55},
    'HB':  {'PSPD': 75, 'PACC': 80, 'PAGI': 75, 'PSTR': 55},
    'FB':  {'PSPD': 60, 'PACC': 65, 'PAGI': 60, 'PSTR': 70},
    'WR':  {'PSPD': 80, 'PACC': 85, 'PAGI': 80, 'PSTR': 40},
    'TE':  {'PSPD': 70, 'PACC': 75, 'PAGI': 70, 'PSTR': 60},
    'OT':  {'PSPD': 40, 'PACC': 50, 'PAGI': 40, 'PSTR': 75},
    'OG':  {'PSPD': 40, 'PACC': 50, 'PAGI': 40, 'PSTR': 75},
    'C':   {'PSPD': 40, 'PACC': 50, 'PAGI': 40, 'PSTR': 70},
    'G':   {'PSPD': 40, 'PACC': 50, 'PAGI': 40, 'PSTR': 75},
    'T':   {'PSPD': 40, 'PACC': 50, 'PAGI': 40, 'PSTR': 75},
    'DE':  {'PSPD': 60, 'PACC': 65, 'PAGI': 60, 'PSTR': 75},
    'DT':  {'PSPD': 50, 'PACC': 55, 'PAGI': 50, 'PSTR': 80},
    'NT':  {'PSPD': 45, 'PACC': 50, 'PAGI': 45, 'PSTR': 85},
    'LB':  {'PSPD': 65, 'PACC': 70, 'PAGI': 65, 'PSTR': 65},
    'OLB': {'PSPD': 70, 'PACC': 75, 'PAGI': 70, 'PSTR': 60},
    'ILB': {'PSPD': 60, 'PACC': 65, 'PAGI': 60, 'PSTR': 68},
    'MLB': {'PSPD': 60, 'PACC': 65, 'PAGI': 60, 'PSTR': 68},
    'CB':  {'PSPD': 85, 'PACC': 90, 'PAGI': 85, 'PSTR': 40},
    'S':   {'PSPD': 80, 'PACC': 85, 'PAGI': 80, 'PSTR': 50},
    'SS':  {'PSPD': 80, 'PACC': 85, 'PAGI': 80, 'PSTR': 55},
    'FS':  {'PSPD': 82, 'PACC': 87, 'PAGI': 82, 'PSTR': 45},
    'DB':  {'PSPD': 80, 'PACC': 85, 'PAGI': 80, 'PSTR': 45},
    'K':   {'PSPD': 30, 'PACC': 30, 'PAGI': 30, 'PSTR': 30},
    'P':   {'PSPD': 30, 'PACC': 30, 'PAGI': 30, 'PSTR': 30},
    'LS':  {'PSPD': 30, 'PACC': 30, 'PAGI': 30, 'PSTR': 40}
}

# Archetype mapping (historical format to Madden ID)
ARCHETYPE_LOOKUP = None  # Will load from CSV

def parse_years_pro(years_pro_str):
    """Parse Years_Pro field to integer"""
    if pd.isna(years_pro_str) or years_pro_str == '':
        return 0
    years_str = str(years_pro_str).strip().upper()
    if years_str == 'ROOK' or years_str == 'ROOKIE':
        return 0
    try:
        return int(years_str)
    except:
        return 0

def fix_zero_attributes(df):
    """Phase 3: Fix zero attributes"""
    print("Phase 3: Fixing zero attributes...")

    n_fixed = 0
    core_attrs = ['PSPD', 'PACC', 'PAGI', 'PSTR']

    for attr in core_attrs:
        zeros_before = (df[attr] == 0).sum()

        for idx, row in df[df[attr] == 0].iterrows():
            pos = str(row['Position']).upper().strip()
            mins = ATTRIBUTE_MINIMUMS.get(pos, {'PSPD': 50, 'PACC': 55, 'PAGI': 50, 'PSTR': 55})

            if attr in mins:
                df.at[idx, attr] = mins[attr]
                n_fixed += 1

        zeros_after = (df[attr] == 0).sum()
        print(f"  {attr}: {zeros_before} zeros -> {zeros_after} zeros ({zeros_before - zeros_after} fixed)")

    print(f"  Total attribute fixes: {n_fixed}")
    return df

def calculate_dev_trait(row, matched_data=None):
    """Phase 4: Calculate Dev Trait"""
    years = parse_years_pro(row.get('Years_Pro', 0))
    points = 0

    # Years Pro bonus/penalty
    if years <= 3:
        points -= 20
    elif years <= 4:
        points -= 10
    elif years <= 7:
        points += 0
    elif years <= 10:
        points += 10
    elif years <= 14:
        points += 15
    else:
        points += 20

    # If matched to ALL_PLAYER_LOOKUP, add accolades
    if matched_data is not None:
        # Pro Bowls
        pb = matched_data.get('PB', 0)
        points += min(50, pb * 10) if not pd.isna(pb) else 0

        # All-Pro
        ap1 = matched_data.get('AP1', 0)
        points += min(100, ap1 * 20) if not pd.isna(ap1) else 0

    # Position multiplier
    pos = str(row.get('Position', '')).upper().strip()
    pos_mult = {'QB': 0.95, 'RB': 1.1, 'HB': 1.1, 'WR': 1.05, 'TE': 1.05,
                'OT': 1.2, 'OG': 1.2, 'C': 1.2, 'G': 1.2, 'T': 1.2,
                'DE': 1.15, 'DT': 1.15, 'NT': 1.15,
                'LB': 1.15, 'OLB': 1.15, 'ILB': 1.15, 'MLB': 1.15,
                'CB': 1.1, 'S': 1.1, 'SS': 1.1, 'FS': 1.1, 'DB': 1.1,
                'K': 1.1, 'P': 1.1}
    points *= pos_mult.get(pos, 1.0)

    # Assign trait
    if points < 50:
        return 'Normal'
    elif points < 80:
        return 'Star'
    elif points < 90:
        return 'Superstar'
    else:
        return 'X-Factor'

def add_dev_traits(df, all_player_df=None):
    """Phase 4: Add Dev Traits column"""
    print("Phase 4: Calculating Dev Traits...")

    if 'Dev_Trait' not in df.columns:
        df['Dev_Trait'] = ''

    # Try to match to ALL_PLAYER_LOOKUP for accolades
    matched_count = 0

    for idx, row in df.iterrows():
        matched_data = None

        # Try to match by name + draft year if ALL_PLAYER_LOOKUP available
        if all_player_df is not None:
            first = str(row.get('First_Name', '')).lower().strip()
            last = str(row.get('Last_Name', '')).lower().strip()
            draft_year = row.get('Draft_Year')

            if first and last and not pd.isna(draft_year):
                matches = all_player_df[
                    (all_player_df['First Name'].str.lower().str.strip() == first) &
                    (all_player_df['Last Name'].str.lower().str.strip() == last) &
                    (all_player_df['Draft Class'] == draft_year)
                ]

                if len(matches) > 0:
                    matched_data = matches.iloc[0]
                    matched_count += 1

        trait = calculate_dev_trait(row, matched_data)
        df.at[idx, 'Dev_Trait'] = trait

        if (idx + 1) % 5000 == 0:
            print(f"  Processed {idx + 1}/{len(df)} players...")

    print(f"  Matched to ALL_PLAYER_LOOKUP: {matched_count}/{len(df)} ({matched_count/len(df)*100:.1f}%)")

    # Distribution
    trait_counts = df['Dev_Trait'].value_counts()
    print("  Dev Trait Distribution:")
    for trait, count in trait_counts.items():
        print(f"    {trait}: {count} ({count/len(df)*100:.1f}%)")

    return df

def fix_archetypes(df):
    """Phase 5: Convert archetypes to Madden format"""
    print("Phase 5: Converting archetypes to Madden format...")

    global ARCHETYPE_LOOKUP
    arch_file = LOOKUPS_DIR / 'archetype_lookup.csv'

    if not arch_file.exists():
        print("  WARNING: archetype_lookup.csv not found, skipping...")
        return df

    # Load archetype lookup
    arch_df = pd.read_csv(arch_file)
    print(f"  Loaded {len(arch_df)} Madden archetypes")

    # For now, keep existing archetypes as-is since format varies
    # User can manually map if needed
    print("  Archetype format conversion skipped (manual mapping required)")

    return df

def match_pids_pams(df):
    """Phase 6: Match PIDs/PAMs from ALL_PLAYER_LOOKUP"""
    print("Phase 6: Matching PIDs/PAMs...")

    all_player_file = LOOKUPS_DIR / 'ALL_PLAYER_LOOKUP.csv'
    if not all_player_file.exists():
        print("  WARNING: ALL_PLAYER_LOOKUP.csv not found, skipping...")
        return df

    all_player_df = pd.read_csv(all_player_file)
    print(f"  Loaded {len(all_player_df)} real players")

    matched_count = 0

    for idx, row in df[(df['PID'] == 0) | (df['PAM'] == 0)].iterrows():
        first = str(row.get('First_Name', '')).lower().strip()
        last = str(row.get('Last_Name', '')).lower().strip()

        if not first or not last:
            continue

        # Try exact match
        matches = all_player_df[
            (all_player_df['First Name'].str.lower().str.strip() == first) &
            (all_player_df['Last Name'].str.lower().str.strip() == last)
        ]

        if len(matches) > 0:
            match = matches.iloc[0]

            if row['PID'] == 0 and not pd.isna(match.get('PhotoID')):
                df.at[idx, 'PID'] = match['PhotoID']

            if row['PAM'] == 0 and not pd.isna(match.get('Player Assets ID')):
                df.at[idx, 'PAM'] = match['Player Assets ID']

            matched_count += 1

    print(f"  Matched {matched_count} players to real PIDs/PAMs ({matched_count/len(df)*100:.1f}%)")

    # Remaining zeros get generic face (PID=1, PAM=1)
    df.loc[df['PID'] == 0, 'PID'] = 1
    df.loc[df['PAM'] == 0, 'PAM'] = 1

    zeros_remaining = ((df['PID'] == 0) | (df['PAM'] == 0)).sum()
    print(f"  Players with PID/PAM=0 remaining: {zeros_remaining}")

    return df

def main():
    if len(sys.argv) < 2:
        print("Usage: python fix-all-remaining.py <file_path>")
        print("Example: python fix-all-remaining.py data/lookups/ROSTER_lookup_historical.csv")
        return 1

    input_file = Path(sys.argv[1])

    if not input_file.exists():
        print(f"ERROR: File not found: {input_file}")
        return 1

    print("="*80)
    print(f"FIXING ALL REMAINING ISSUES: {input_file.name}")
    print("="*80)
    print()

    # Load file
    print(f"Loading {input_file}...")
    df = pd.read_csv(input_file)
    print(f"  Loaded {len(df)} rows")
    print()

    # Load ALL_PLAYER_LOOKUP for Dev Traits if available
    all_player_df = None
    all_player_file = LOOKUPS_DIR / 'ALL_PLAYER_LOOKUP.csv'
    if all_player_file.exists():
        all_player_df = pd.read_csv(all_player_file)
        print(f"Loaded ALL_PLAYER_LOOKUP: {len(all_player_df)} players")
        print()

    # Run all phases
    df = fix_zero_attributes(df)
    print()

    df = add_dev_traits(df, all_player_df)
    print()

    df = fix_archetypes(df)
    print()

    df = match_pids_pams(df)
    print()

    # Save
    print(f"Saving updated file to {input_file}...")
    df.to_csv(input_file, index=False)
    print("  Saved successfully")
    print()

    print("="*80)
    print("ALL FIXES COMPLETE!")
    print("="*80)

    return 0

if __name__ == '__main__':
    sys.exit(main())
