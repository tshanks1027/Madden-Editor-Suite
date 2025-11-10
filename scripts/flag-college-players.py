"""
Flag College Players Script

Flags uncertain college players for manual review based on:
1. Low wAV values (< threshold)
2. Missing critical bio data (Height, Weight)
3. No statistics found
4. Low production metrics
5. Unusual archetype assignments
6. Defensive players (limited stats available)

Outputs:
- Adds "Flagged" and "Flag_Reason" columns to roster
- Generates summary report of flagged players
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
FLAGGED_REPORT_FILE = LOOKUPS_DIR / 'FutureDraft_Flagged_Report.csv'

# Flagging thresholds
LOW_WAV_THRESHOLD = 3.0  # wAV below this is flagged
MIN_HEIGHT = 60  # 5'0" in inches
MAX_HEIGHT = 90  # 7'6" in inches
MIN_WEIGHT = 140  # lbs
MAX_WEIGHT = 400  # lbs

# Position groups
OFFENSIVE_SKILL = ['QB', 'RB', 'WR', 'TE', 'FB', 'HB']
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

def check_flags(player, stats_df):
    """
    Check player for flag conditions
    Returns list of flag reasons
    """
    flags = []
    position = normalize_position(player['Position'])

    # 1. Missing critical bio data
    height = player.get('Height')
    weight = player.get('Weight')

    if pd.isna(height) or height == '':
        flags.append('MISSING_HEIGHT')
    elif height < MIN_HEIGHT or height > MAX_HEIGHT:
        flags.append('INVALID_HEIGHT')

    if pd.isna(weight) or weight == '':
        flags.append('MISSING_WEIGHT')
    elif weight < MIN_WEIGHT or weight > MAX_WEIGHT:
        flags.append('INVALID_WEIGHT')

    # 2. Low wAV value
    wav = player.get('wAV')
    if pd.isna(wav) or wav == '' or wav == 0:
        flags.append('MISSING_WAV')
    elif float(wav) < LOW_WAV_THRESHOLD:
        flags.append('LOW_WAV')

    # 3. Missing archetype
    archetype = player.get('Archetype')
    if pd.isna(archetype) or archetype == '':
        flags.append('MISSING_ARCHETYPE')

    # 4. No statistics found (for offensive skill positions)
    if position in OFFENSIVE_SKILL:
        player_stats = stats_df[stats_df['Roster_Index'] == player.name] if not stats_df.empty else pd.DataFrame()
        if player_stats.empty:
            flags.append('NO_STATS_FOUND')

    # 5. Defensive player (limited stats available)
    if position in DEFENSIVE_LINE + LINEBACKER + DEFENSIVE_BACK:
        flags.append('DEFENSIVE_PLAYER')

    # 6. Special teams (kickers/punters - user will handle manually)
    if position in SPECIAL_TEAMS:
        flags.append('SPECIAL_TEAMS')

    # 7. Missing hometown/state
    hometown = player.get('Hometown')
    homestate = player.get('Homestate')

    if pd.isna(hometown) or hometown == '':
        flags.append('MISSING_HOMETOWN')

    if pd.isna(homestate) or homestate == '':
        flags.append('MISSING_HOMESTATE')

    # 8. Missing class year
    class_year = player.get('Class')
    if pd.isna(class_year) or class_year == '':
        flags.append('MISSING_CLASS')

    # 9. Missing jersey
    jersey = player.get('Jersey')
    if pd.isna(jersey) or jersey == '':
        flags.append('MISSING_JERSEY')

    # 10. Missing college
    college = player.get('College')
    if pd.isna(college) or college == '':
        flags.append('MISSING_COLLEGE')

    return flags

def get_flag_priority(flags):
    """
    Determine priority of flags (higher = more critical)
    """
    if not flags:
        return 0

    # Critical flags
    critical = ['MISSING_HEIGHT', 'MISSING_WEIGHT', 'INVALID_HEIGHT', 'INVALID_WEIGHT',
                'MISSING_WAV', 'MISSING_ARCHETYPE', 'MISSING_COLLEGE']

    # High priority flags
    high = ['LOW_WAV', 'NO_STATS_FOUND']

    # Medium priority flags
    medium = ['MISSING_HOMETOWN', 'MISSING_HOMESTATE', 'MISSING_CLASS', 'MISSING_JERSEY']

    # Low priority flags (informational)
    low = ['DEFENSIVE_PLAYER', 'SPECIAL_TEAMS']

    # Calculate priority score
    score = 0
    for flag in flags:
        if flag in critical:
            score += 100
        elif flag in high:
            score += 50
        elif flag in medium:
            score += 10
        elif flag in low:
            score += 1

    return score

def main():
    print("="*80)
    print("FLAGGING COLLEGE PLAYERS FOR REVIEW")
    print("="*80)
    print()

    # Load merged roster
    print("Loading merged roster...")
    roster_df = pd.read_csv(MERGED_ROSTER_FILE)
    print(f"  Loaded {len(roster_df)} players")
    print()

    # Load stats
    print("Loading parsed stats...")
    if STATS_FILE.exists():
        stats_df = pd.read_csv(STATS_FILE)
        print(f"  Loaded {len(stats_df)} stat records")
    else:
        print("  WARNING: Stats file not found")
        stats_df = pd.DataFrame()
    print()

    # Add flag columns if they don't exist
    if 'Flagged' not in roster_df.columns:
        roster_df['Flagged'] = 0
    if 'Flag_Reason' not in roster_df.columns:
        roster_df['Flag_Reason'] = ''

    # Check flags for all players
    print("="*80)
    print("CHECKING PLAYERS FOR FLAGS")
    print("="*80)
    print()

    n_flagged = 0
    n_clean = 0
    flag_counts = {}
    flagged_players = []

    for idx, player in roster_df.iterrows():
        # Check for flags
        flags = check_flags(player, stats_df)

        if flags:
            n_flagged += 1

            # Set flag columns
            roster_df.at[idx, 'Flagged'] = 1
            roster_df.at[idx, 'Flag_Reason'] = ', '.join(flags)

            # Track flag counts
            for flag in flags:
                if flag not in flag_counts:
                    flag_counts[flag] = 0
                flag_counts[flag] += 1

            # Add to flagged report
            priority = get_flag_priority(flags)
            flagged_players.append({
                'Index': idx,
                'Last_Name': player['Last Name'],
                'First_Name': player['First Name'],
                'College': player['College'],
                'Position': player['Position'],
                'wAV': player.get('wAV', ''),
                'Height': player.get('Height', ''),
                'Weight': player.get('Weight', ''),
                'Archetype': player.get('Archetype', ''),
                'Flags': ', '.join(flags),
                'Priority': priority
            })
        else:
            n_clean += 1
            roster_df.at[idx, 'Flagged'] = 0
            roster_df.at[idx, 'Flag_Reason'] = ''

        # Progress update
        if (idx + 1) % 1000 == 0:
            print(f"Processed {idx + 1}/{len(roster_df)} players... "
                  f"(Flagged: {n_flagged}, Clean: {n_clean})")
            sys.stdout.flush()

    print()
    print(f"Processed all {len(roster_df)} players")
    print()

    # Summary
    print("="*80)
    print("FLAGGING COMPLETE")
    print("="*80)
    print()

    print(f"Total players: {len(roster_df)}")
    print(f"  Flagged for review: {n_flagged} ({n_flagged/len(roster_df)*100:.1f}%)")
    print(f"  Clean (no issues): {n_clean} ({n_clean/len(roster_df)*100:.1f}%)")
    print()

    # Flag breakdown
    print("Flag Breakdown:")
    for flag, count in sorted(flag_counts.items(), key=lambda x: x[1], reverse=True):
        pct = (count / len(roster_df)) * 100
        print(f"  {flag}: {count} ({pct:.1f}%)")
    print()

    # Save updated roster
    print(f"Saving updated roster to {OUTPUT_FILE}...")
    roster_df.to_csv(OUTPUT_FILE, index=False)
    print("  Saved successfully")
    print()

    # Save flagged players report
    if flagged_players:
        print(f"Saving flagged players report to {FLAGGED_REPORT_FILE}...")
        flagged_df = pd.DataFrame(flagged_players)
        # Sort by priority (highest first)
        flagged_df = flagged_df.sort_values('Priority', ascending=False)
        flagged_df.to_csv(FLAGGED_REPORT_FILE, index=False)
        print("  Saved successfully")
        print()

        # Top 20 highest priority flagged players
        print("Top 20 Highest Priority Flagged Players:")
        print("-" * 80)
        for i, row in flagged_df.head(20).iterrows():
            print(f"{row['Last_Name']}, {row['First_Name']} ({row['College']}) - {row['Position']}")
            print(f"  Priority: {row['Priority']} | Flags: {row['Flags']}")
            print()

    print("="*80)
    print("COLLEGE FUTURE DRAFT PIPELINE COMPLETE!")
    print("="*80)
    print()
    print("Pipeline execution summary:")
    print("  1. ✓ merge-college-rosters.py - Merged rosters with fuzzy matching")
    print("  2. ✓ parse-college-stats.py - Parsed statistics from HTML files")
    print("  3. ✓ calculate-college-wav.py - Calculated wAV values")
    print("  4. ✓ assign-college-archetypes.py - Assigned Madden archetypes")
    print("  5. ○ scrape-college-bio.py - Bio scraping (run if needed)")
    print("  6. ✓ flag-college-players.py - Flagged players for review")
    print()
    print("Next steps:")
    print("  1. Review flagged players in FutureDraft_Flagged_Report.csv")
    print("  2. Run scrape-college-bio.py to fill missing bio data (6-8 hours)")
    print("  3. Manually review special teams players (kickers/punters)")
    print("  4. Manually review defensive players (limited stats)")
    print("  5. Import FutureDraft_Lookup_MERGED.csv into Madden Editor Suite")
    print()

    return 0

if __name__ == '__main__':
    sys.exit(main())
