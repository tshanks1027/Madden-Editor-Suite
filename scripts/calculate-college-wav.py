"""
Calculate College wAV Script

Calculates weighted Approximate Value (wAV) for college players based on:
1. Production stats (passing, rushing, receiving)
2. Position-based baseline for players without stats
3. CRITICAL: Preserves user-entered wAV values
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
STATS_DIR = BASE_DIR / 'data' / 'college_stats'

MERGED_ROSTER_FILE = LOOKUPS_DIR / 'FutureDraft_Lookup_MERGED.csv'
STATS_FILE = STATS_DIR / '2025_all_stats.csv'
OUTPUT_FILE = LOOKUPS_DIR / 'FutureDraft_Lookup_MERGED.csv'

# Position groups
OFFENSIVE_POSITIONS = ['QB', 'RB', 'WR', 'TE', 'FB']
OFFENSIVE_LINE = ['OT', 'OG', 'OC', 'C', 'G', 'T']
DEFENSIVE_LINE = ['DE', 'DT', 'NT']
LINEBACKER = ['LB', 'OLB', 'ILB', 'MLB']
DEFENSIVE_BACK = ['CB', 'S', 'SS', 'FS', 'DB']
SPECIAL_TEAMS = ['K', 'P', 'LS']

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

def calculate_qb_wav(stats_row):
    """Calculate wAV for quarterbacks"""
    # Get stats (handle missing values)
    pass_yds = float(stats_row.get('Yds', 0) or 0)
    pass_tds = float(stats_row.get('TD', 0) or 0)
    ints = float(stats_row.get('Int', 0) or 0)

    # Production score (simplified AV formula)
    # 1 point per 20 pass yards, 3 points per TD, -2 per INT
    production = (pass_yds / 20) + (pass_tds * 3) - (ints * 2)

    # Convert to wAV (scale 0-20)
    wav = max(0, min(20, production / 10))

    return round(wav, 1)

def calculate_rb_wav(stats_row):
    """Calculate wAV for running backs"""
    # Get rushing stats
    rush_yds = float(stats_row.get('Yds', 0) or 0)
    rush_tds = float(stats_row.get('TD', 0) or 0)

    # Production score
    # 1 point per 10 rush yards, 4 points per TD
    production = (rush_yds / 10) + (rush_tds * 4)

    # Convert to wAV
    wav = max(0, min(20, production / 10))

    return round(wav, 1)

def calculate_receiver_wav(stats_row):
    """Calculate wAV for receivers (WR/TE)"""
    # Get receiving stats
    receptions = float(stats_row.get('Rec', 0) or 0)
    rec_yds = float(stats_row.get('Yds', 0) or 0)
    rec_tds = float(stats_row.get('TD', 0) or 0)

    # Production score
    # 1 point per reception, 1 point per 10 yards, 4 points per TD
    production = receptions + (rec_yds / 10) + (rec_tds * 4)

    # Convert to wAV
    wav = max(0, min(20, production / 10))

    return round(wav, 1)

def get_baseline_wav(position, class_year):
    """Get baseline wAV for players without stats"""
    pos_norm = normalize_position(position)

    # Determine experience multiplier
    exp_mult = 1.0
    if class_year in ['SR', 'Senior', '4', 'JR', 'Junior', '3']:
        exp_mult = 1.2
    elif class_year in ['SO', 'Sophomore', '2']:
        exp_mult = 0.9
    elif class_year in ['FR', 'Freshman', '1']:
        exp_mult = 0.7

    # Baseline by position group
    if pos_norm in OFFENSIVE_POSITIONS:
        baseline = 4.0  # Skill position
    elif pos_norm in OFFENSIVE_LINE:
        baseline = 5.0  # O-line typically higher value
    elif pos_norm in DEFENSIVE_LINE:
        baseline = 5.0  # D-line
    elif pos_norm in LINEBACKER:
        baseline = 4.5  # Linebackers
    elif pos_norm in DEFENSIVE_BACK:
        baseline = 4.0  # DBs
    elif pos_norm in SPECIAL_TEAMS:
        baseline = 3.0  # Kickers/Punters
    else:
        baseline = 4.0  # Default

    wav = baseline * exp_mult
    return round(wav, 1)

def calculate_player_wav(player_row, stats_df):
    """Calculate wAV for a single player"""
    position = normalize_position(player_row['Position'])
    class_year = player_row.get('Class', '')
    roster_idx = player_row.name

    # Check if player has stats
    player_stats = stats_df[stats_df['Roster_Index'] == roster_idx]

    if player_stats.empty:
        # No stats - use baseline
        return get_baseline_wav(position, class_year)

    # Has stats - calculate from production
    total_wav = 0
    count = 0

    for _, stat_row in player_stats.iterrows():
        stat_type = stat_row.get('Stat_Type', '')

        if stat_type == 'Passing' and position == 'QB':
            total_wav += calculate_qb_wav(stat_row)
            count += 1
        elif stat_type == 'Rushing' and position in ['RB', 'FB', 'QB']:
            total_wav += calculate_rb_wav(stat_row)
            count += 1
        elif stat_type == 'Receiving' and position in ['WR', 'TE', 'RB']:
            total_wav += calculate_receiver_wav(stat_row)
            count += 1

    if count > 0:
        # Average if multiple stat types
        return round(total_wav / count, 1)
    else:
        # Has stats but not for this position - use baseline
        return get_baseline_wav(position, class_year)

def main():
    print("="*80)
    print("CALCULATING COLLEGE WAV")
    print("="*80)
    print()

    # Load merged roster
    print("Loading merged roster...")
    roster_df = pd.read_csv(MERGED_ROSTER_FILE)
    print(f"  Loaded {len(roster_df)} players")

    # Count existing wAV values
    existing_wav = roster_df['wAV'].notna() & (roster_df['wAV'] != '') & (roster_df['wAV'] != 0)
    n_existing = existing_wav.sum()
    print(f"  Found {n_existing} players with existing wAV (will be preserved)")
    print()

    # Load stats
    print("Loading parsed stats...")
    if STATS_FILE.exists():
        stats_df = pd.read_csv(STATS_FILE)
        print(f"  Loaded {len(stats_df)} stat records")

        # Count players with stats
        players_with_stats = stats_df['Roster_Index'].notna().sum()
        print(f"  {players_with_stats} stat records matched to roster")
    else:
        print("  WARNING: Stats file not found, using baseline values for all players")
        stats_df = pd.DataFrame()

    print()

    # Calculate wAV
    print("="*80)
    print("CALCULATING WAV VALUES")
    print("="*80)
    print()

    n_calculated = 0
    n_preserved = 0
    n_baseline = 0

    for idx, player in roster_df.iterrows():
        # Check if player already has user-entered wAV
        current_wav = player['wAV']
        if pd.notna(current_wav) and current_wav != '' and current_wav != 0:
            n_preserved += 1
            continue  # Skip - preserve user value

        # Calculate wAV
        wav = calculate_player_wav(player, stats_df)
        roster_df.at[idx, 'wAV'] = wav
        n_calculated += 1

        # Track if baseline was used
        player_stats = stats_df[stats_df['Roster_Index'] == idx] if not stats_df.empty else pd.DataFrame()
        if player_stats.empty:
            n_baseline += 1

        # Progress update
        if (idx + 1) % 1000 == 0:
            print(f"Processed {idx + 1}/{len(roster_df)} players... "
                  f"(Calculated: {n_calculated}, Preserved: {n_preserved})")
            sys.stdout.flush()

    print()
    print(f"Processed all {len(roster_df)} players")
    print()

    # Summary statistics
    print("="*80)
    print("WAV CALCULATION COMPLETE")
    print("="*80)
    print()

    print(f"Total players: {len(roster_df)}")
    print(f"  User wAV preserved: {n_preserved}")
    print(f"  wAV calculated from stats: {n_calculated - n_baseline}")
    print(f"  wAV assigned (baseline): {n_baseline}")
    print()

    # wAV distribution
    wav_values = roster_df['wAV'].replace('', 0).fillna(0).astype(float)
    print("wAV Distribution:")
    print(f"  Min: {wav_values.min():.1f}")
    print(f"  Max: {wav_values.max():.1f}")
    print(f"  Mean: {wav_values.mean():.1f}")
    print(f"  Median: {wav_values.median():.1f}")
    print()

    # Position breakdown
    print("Position Breakdown (Top 10 by count):")
    pos_counts = roster_df.groupby(roster_df['Position'].apply(normalize_position)).size()
    for pos, count in pos_counts.nlargest(10).items():
        pos_wav = roster_df[roster_df['Position'].apply(normalize_position) == pos]['wAV']
        pos_wav = pos_wav.replace('', 0).fillna(0).astype(float)
        avg_wav = pos_wav.mean()
        print(f"  {pos}: {count} players, Avg wAV={avg_wav:.1f}")
    print()

    # Save output
    print(f"Saving updated roster to {OUTPUT_FILE}...")
    roster_df.to_csv(OUTPUT_FILE, index=False)
    print("  Saved successfully")
    print()

    print("Next step: Run assign-college-archetypes.py to assign player archetypes")

    return 0

if __name__ == '__main__':
    sys.exit(main())
