"""
Madden Ratings Extraction Script

Extracts player ratings from all Excel files in data/Madden Old Ratings/
Handles both simple format (2003-2012) and detailed format (2013-2024)
Merges with combine data from data/archive/
Outputs to data/lookups/ROSTER_lookup.csv
"""

import pandas as pd
import os
import glob
from pathlib import Path
import re

# Configure paths
BASE_DIR = Path('.')
RATINGS_DIR = BASE_DIR / 'data' / 'Madden Old Ratings'
COMBINE_DIR = BASE_DIR / 'data' / 'archive'
ALL_PLAYER_LOOKUP = BASE_DIR / 'data' / 'lookups' / 'ALL_PLAYER_LOOKUP.csv'
OUTPUT_FILE = BASE_DIR / 'data' / 'lookups' / 'ROSTER_lookup.csv'

# Track statistics
stats = {
    'files_processed': 0,
    'players_extracted': 0,
    'years_processed': set(),
    'teams_processed': set(),
    'errors': []
}

def load_all_player_lookup():
    """Load ALL_PLAYER_LOOKUP for PID and PAM matching, excluding (R) tagged entries"""
    print("Loading ALL_PLAYER_LOOKUP.csv for PID/PAM matching...")
    df = pd.read_csv(ALL_PLAYER_LOOKUP)

    # Create lookup dictionary: (FirstName, LastName, DraftYear) -> (PID, PAM)
    # Prefer entries without (R) - these are modding versions we should skip
    lookup = {}
    for _, row in df.iterrows():
        # Check if PLPO contains (R) - skip these modding entries
        plpo = str(row.get('PLPO', ''))
        if '(R)' in plpo:
            continue  # Skip entries with (R) tag

        key = (
            str(row['First Name']).strip().lower(),
            str(row['Last Name']).strip().lower(),
            str(row['Draft Class']).strip()
        )
        pid = row['PhotoID']
        pam = row.get('Player Assets ID', 0)  # Default to 0 if missing

        # Only add if not already in lookup, or if this is a non-(R) version replacing an (R) version
        # (Though we already skipped (R) entries, this ensures we keep first non-(R) match)
        if key not in lookup:
            lookup[key] = (pid, pam)

    print(f"Loaded {len(lookup)} player records from ALL_PLAYER_LOOKUP (excluding (R) tagged entries)")
    return lookup

def load_combine_data():
    """Load all combine CSV files"""
    print("Loading combine data from archive/...")
    combine_files = glob.glob(str(COMBINE_DIR / '*.csv'))

    all_combine = []
    for file in combine_files:
        try:
            df = pd.read_csv(file)
            all_combine.append(df)
        except Exception as e:
            print(f"  Warning: Could not read {file}: {e}")

    if all_combine:
        combined_df = pd.concat(all_combine, ignore_index=True)
        print(f"Loaded {len(combined_df)} combine records from {len(all_combine)} files")
        return combined_df
    else:
        print("No combine data found")
        return pd.DataFrame()

def match_pid(first_name, last_name, year, player_lookup):
    """Match player to PID and PAM from ALL_PLAYER_LOOKUP"""
    # Try exact match with draft year
    key = (first_name.strip().lower(), last_name.strip().lower(), str(year))
    if key in player_lookup:
        return player_lookup[key]  # Returns (PID, PAM) tuple

    # Try adjacent years (player might be from draft year +/- 1)
    for offset in [-1, 1, -2, 2]:
        key = (first_name.strip().lower(), last_name.strip().lower(), str(year + offset))
        if key in player_lookup:
            return player_lookup[key]  # Returns (PID, PAM) tuple

    # No match found
    return (0, 0)  # Return tuple of (PID=0, PAM=0)

def match_combine(first_name, last_name, combine_df):
    """Match player to combine data"""
    if combine_df.empty:
        return {}

    # Try to find player in combine data
    matches = combine_df[
        (combine_df['Player'].str.lower().str.contains(last_name.lower(), na=False)) &
        (combine_df['Player'].str.lower().str.contains(first_name.lower(), na=False))
    ]

    if len(matches) > 0:
        row = matches.iloc[0]
        return {
            '40yd': row.get('40yd', ''),
            'Vertical': row.get('Vertical', ''),
            'Bench': row.get('Bench', ''),
            'Broad_Jump': row.get('Broad Jump', ''),
            '3Cone': row.get('3Cone', ''),
            'Shuttle': row.get('Shuttle', '')
        }

    return {}

def extract_year_from_path(file_path):
    """Extract year from file path"""
    # Try to find 4-digit year in path
    match = re.search(r'(20\d{2})', str(file_path))
    if match:
        return int(match.group(1))

    # Try to find 2-digit year in filename like "madden_nfl_10"
    match = re.search(r'madden_nfl_(\d{2})', str(file_path), re.I)
    if match:
        year_suffix = int(match.group(1))
        # Convert 10 -> 2010, 03 -> 2003
        return 2000 + year_suffix if year_suffix < 50 else 1900 + year_suffix

    return None

def extract_team_from_filename(file_path):
    """Extract team name from filename"""
    filename = Path(file_path).stem

    # Remove common suffixes
    filename = re.sub(r'_madden_nfl_\d+_?', '', filename, flags=re.I)
    filename = re.sub(r'_rosters?', '', filename, flags=re.I)

    # Clean up
    filename = filename.replace('_', ' ').strip()

    return filename.title() if filename else 'Unknown'

def process_excel_file(file_path, player_lookup, combine_df):
    """Process a single Excel file"""
    try:
        # Extract year and team from path
        year = extract_year_from_path(file_path)
        team = extract_team_from_filename(file_path)

        if not year:
            stats['errors'].append(f"Could not extract year from {file_path}")
            return []

        print(f"  Processing: {Path(file_path).name} (Year: {year}, Team: {team})")

        # Read Excel file
        df = pd.read_excel(file_path)

        # Track processed
        stats['years_processed'].add(year)
        stats['teams_processed'].add(team)
        stats['files_processed'] += 1

        # Normalize column names (handle variations)
        df.columns = df.columns.str.strip()

        # Create case-insensitive column lookup
        col_map = {col.upper().replace(' ', ''): col for col in df.columns}

        def get_col(name_variations):
            """Get column value, trying different name variations"""
            for name in name_variations:
                key = name.upper().replace(' ', '')
                if key in col_map:
                    return col_map[key]
            return None

        # Determine format based on available columns
        # Format 1 (2003-2004): Name, Overall Rating
        # Format 2 (2005-2012): FIRSTNAME/FirstName/First Name, LASTNAME/LastName/Last Name, OVERALLRATING/OverallRating/Overall
        # Format 3 (2013-2024): Same as Format 2 but with more detailed ratings

        first_col = get_col(['FirstName', 'First Name', 'First', 'FIRSTNAME'])
        last_col = get_col(['LastName', 'Last Name', 'Last', 'LASTNAME'])
        ovr_col = get_col(['OverallRating', 'Overall Rating', 'Overall', 'OVR', 'OVERALLRATING'])
        name_col = get_col(['Name'])

        has_format1 = name_col is not None and ovr_col is not None and first_col is None
        has_format2 = first_col is not None and last_col is not None

        players = []

        # Get commonly used column names
        pos_col = get_col(['Position', 'POS', 'Pos'])
        jersey_col = get_col(['JerseyNum', 'Jersey', 'Number', 'JERSEYNUM', '#'])
        age_col = get_col(['Age', 'AGE'])
        college_col = get_col(['College', 'COLLEGE'])
        height_col = get_col(['Height', 'HEIGHT'])
        weight_col = get_col(['Weight', 'WEIGHT', 'Wt'])

        # Rating columns (for detailed formats)
        archetype_col = get_col(['Archetype', 'ARCHETYPE'])
        speed_col = get_col(['SpeedRating', 'Speed', 'SPEED'])
        acc_col = get_col(['AccelerationRating', 'Acceleration', 'ACCELERATION'])
        str_col = get_col(['StrengthRating', 'Strength', 'STRENGTH'])
        agi_col = get_col(['AgilityRating', 'Agility', 'AGILITY'])
        awr_col = get_col(['AwarenessRating', 'Awareness', 'AWARENESS'])

        for _, row in df.iterrows():
            try:
                # Extract basic info based on format
                if has_format1:
                    # Format 1: Single Name column, need to split
                    full_name = str(row.get(name_col, '')).strip()
                    # Split name (simple: first word = first name, rest = last name)
                    name_parts = full_name.split(' ', 1)
                    first_name = name_parts[0] if len(name_parts) > 0 else ''
                    last_name = name_parts[1] if len(name_parts) > 1 else ''

                    position = row.get(pos_col, '') if pos_col else ''
                    overall = row.get(ovr_col, 0) if ovr_col else 0
                    jersey = str(row.get(jersey_col, '')).replace('#', '').strip() if jersey_col else ''
                    age = 0
                    college = ''
                    height = 0
                    weight = 0

                elif has_format2:
                    # Format 2: First/Last columns with variable detail levels
                    first_name = str(row.get(first_col, '')).strip()
                    last_name = str(row.get(last_col, '')).strip()
                    position = row.get(pos_col, '') if pos_col else ''
                    overall = row.get(ovr_col, 0) if ovr_col else 0
                    jersey = str(row.get(jersey_col, '')).replace('#', '').strip() if jersey_col else ''
                    age = row.get(age_col, 0) if age_col else 0
                    college = row.get(college_col, '') if college_col else ''
                    height = row.get(height_col, 0) if height_col else 0
                    weight = row.get(weight_col, 0) if weight_col else 0
                else:
                    # Unknown format, skip this row
                    continue

                # Skip if no name
                if not first_name or not last_name:
                    continue

                # Match to PID and PAM
                pid, pam = match_pid(first_name, last_name, year, player_lookup)

                # Match to combine data
                combine_data = match_combine(first_name, last_name, combine_df)

                # Build player record
                player = {
                    'Year': year,
                    'Season_Team': team,
                    'Player_Name': f"{first_name} {last_name}",
                    'First_Name': first_name,
                    'Last_Name': last_name,
                    'Position': position,
                    'Jersey': jersey,
                    'Age': age,
                    'PID': pid,
                    'PAM': pam,
                    'College': college,
                    'Height': height,
                    'Weight': weight,
                    'POVR': overall,
                }

                # Add all available detailed ratings (try all column variations)
                # This works across all formats since we check if columns exist
                def safe_get(col):
                    """Safely get column value, return 0 if column doesn't exist"""
                    return row.get(col, 0) if col else 0

                player.update({
                    'Archetype': safe_get(archetype_col) if archetype_col else '',
                    'PSPD': safe_get(speed_col),
                    'PACC': safe_get(acc_col),
                    'PSTR': safe_get(str_col),
                    'PAGI': safe_get(agi_col),
                    'PAWR': safe_get(awr_col),
                    'PCTH': safe_get(get_col(['CatchingRating', 'Catching', 'CATCHING'])),
                    'PCAR': safe_get(get_col(['CarryingRating', 'Carrying', 'CARRYING'])),
                    'PTHP': safe_get(get_col(['ThrowPowerRating', 'Throw Power', 'THROWPOWER', 'ThrowPower'])),
                    'PKPW': safe_get(get_col(['KickPowerRating', 'Kick Power', 'KICKPOWER', 'KickPower'])),
                    'PKAC': safe_get(get_col(['KickAccuracyRating', 'Kick Accuracy', 'KICKACCURACY', 'KickAccuracy'])),
                    'PRBK': safe_get(get_col(['RunBlockRating', 'Run Block', 'RUNBLOCK', 'RunBlock'])),
                    'PPBK': safe_get(get_col(['PassBlockRating', 'Pass Block', 'PASSBLOCK', 'PassBlock'])),
                    'PTAK': safe_get(get_col(['TackleRating', 'Tackle', 'TACKLE'])),
                    'PBTK': safe_get(get_col(['BreakTackleRating', 'Break Tackle', 'BREAKTACKLE', 'BreakTackle'])),
                    'PJMP': safe_get(get_col(['JumpingRating', 'Jumping', 'JUMPING'])),
                    'PINJ': safe_get(get_col(['InjuryRating', 'Injury', 'INJURY'])),
                    'PSTA': safe_get(get_col(['StaminaRating', 'Stamina', 'STAMINA'])),
                    'PTGH': safe_get(get_col(['ToughnessRating', 'Toughness', 'TOUGHNESS'])),
                    'PTRK': safe_get(get_col(['TruckingRating', 'Trucking', 'TRUCKING'])),
                    'PCOD': safe_get(get_col(['ChangeOfDirectionRating', 'Change of Direction', 'COD'])),
                    'PBCV': safe_get(get_col(['BCVisionRating', 'Ball Carrier Vision', 'BALLCARRIERVISION', 'BallCarrierVision'])),
                    'PSTF': safe_get(get_col(['StiffArmRating', 'Stiff Arm', 'STIFFARM', 'StiffArm'])),
                    'PSPM': safe_get(get_col(['SpinMoveRating', 'Spin Move', 'SPINMOVE', 'SpinMove'])),
                    'PJUM': safe_get(get_col(['JukeMoveRating', 'Juke Move', 'JUKEMOVE', 'JukeMove'])),
                    'PIBL': safe_get(get_col(['ImpactBlockingRating', 'Impact Blocking', 'IMPACTBLOCKING', 'ImpactBlocking'])),
                    'PRBP': safe_get(get_col(['RunBlockPowerRating', 'Run Block Power'])),
                    'PRBF': safe_get(get_col(['RunBlockFinesseRating', 'Run Block Finesse'])),
                    'PPBP': safe_get(get_col(['PassBlockPowerRating', 'Pass Block Power'])),
                    'PPBF': safe_get(get_col(['PassBlockFinesseRating', 'Pass Block Finesse'])),
                    'PLDB': safe_get(get_col(['LeadBlockRating', 'Lead Block'])),
                    'PBRS': safe_get(get_col(['BreakSackRating', 'Break Sack'])),
                    'PTUP': safe_get(get_col(['ThrowUnderPressureRating', 'Throw Under Pressure'])),
                    'PPWM': safe_get(get_col(['PowerMovesRating', 'Power Moves', 'POWERMOVES', 'PowerMoves'])),
                    'PFNM': safe_get(get_col(['FinesseMovesRating', 'Finesse Moves', 'FINESSEMOVES', 'FinesseMoves'])),
                    'PBSH': safe_get(get_col(['BlockSheddingRating', 'Block Shedding', 'BLOCKSHEDDING', 'BlockShedding'])),
                    'PPUR': safe_get(get_col(['PursuitRating', 'Pursuit', 'PURSUIT'])),
                    'PPRC': safe_get(get_col(['PlayRecognitionRating', 'Play Recognition', 'PLAYRECOGNITION', 'PlayRecognition'])),
                    'PMCV': safe_get(get_col(['ManCoverageRating', 'Man Coverage', 'MANCOVERAGE', 'ManCoverage'])),
                    'PZCV': safe_get(get_col(['ZoneCoverageRating', 'Zone Coverage', 'ZONECOVERAGE', 'ZoneCoverage'])),
                    'PSPC': safe_get(get_col(['SpectacularCatchRating', 'Spectacular Catch', 'SpectacularCatch'])),
                    'PCIT': safe_get(get_col(['CatchInTrafficRating', 'Catch in Traffic', 'CatchInTraffic'])),
                    'PSRR': safe_get(get_col(['ShortRouteRunningRating', 'Short Route Running'])),
                    'PMRR': safe_get(get_col(['MediumRouteRunningRating', 'Medium Route Running'])),
                    'PDRR': safe_get(get_col(['DeepRouteRunningRating', 'Deep Route Running'])),
                    'PHTP': safe_get(get_col(['HitPowerRating', 'Hit Power', 'HITPOWER', 'HitPower'])),
                    'PPRS': safe_get(get_col(['PressRating', 'Press', 'PRESS'])),
                    'PREL': safe_get(get_col(['ReleaseRating', 'Release', 'RELEASE'])),
                    'PTAS': safe_get(get_col(['ThrowAccuracyShortRating', 'Throw Accuracy Short', 'ThrowAccuracyShort'])),
                    'PTAM': safe_get(get_col(['ThrowAccuracyMidRating', 'Throw Accuracy Mid', 'ThrowAccuracyMid'])),
                    'PTAD': safe_get(get_col(['ThrowAccuracyDeepRating', 'Throw Accuracy Deep', 'ThrowAccuracyDeep'])),
                    'PPLA': safe_get(get_col(['PlayActionRating', 'Play Action', 'PLAYACTION', 'PlayAction'])),
                    'PTOR': safe_get(get_col(['ThrowOnTheRunRating', 'Throw on Run', 'ThrowOnRun', 'THROWONRUN'])),
                    'BirthDate': safe_get(get_col(['PLYR_BIRTHDATE', 'BirthDate'])) if get_col(['PLYR_BIRTHDATE', 'BirthDate']) else '',
                    'YearsPro': safe_get(get_col(['YearsPro', 'Years Pro'])),
                    'Handedness': safe_get(get_col(['PLYR_HANDEDNESS', 'Handedness'])) if get_col(['PLYR_HANDEDNESS', 'Handedness']) else '',
                })

                # Add combine data
                player.update({
                    '40yd': combine_data.get('40yd', ''),
                    'Vertical': combine_data.get('Vertical', ''),
                    'Bench': combine_data.get('Bench', ''),
                    'Broad_Jump': combine_data.get('Broad_Jump', ''),
                    '3Cone': combine_data.get('3Cone', ''),
                    'Shuttle': combine_data.get('Shuttle', ''),
                })

                players.append(player)
                stats['players_extracted'] += 1

            except Exception as e:
                stats['errors'].append(f"Error processing player in {file_path}: {e}")
                continue

        return players

    except Exception as e:
        stats['errors'].append(f"Error reading {file_path}: {e}")
        return []

def main():
    """Main extraction process"""
    print("="*80)
    print("MADDEN RATINGS EXTRACTION")
    print("="*80)
    print()

    # Load lookup data
    player_lookup = load_all_player_lookup()
    combine_df = load_combine_data()

    print()
    print("Scanning for Excel files...")

    # Find all Excel files (skip HOF files - those go in ALL_PLAYER_LOOKUP)
    excel_files = []
    for root, dirs, files in os.walk(RATINGS_DIR):
        for file in files:
            if file.endswith(('.xlsx', '.xls')) and not file.startswith('~'):
                # Skip HOF files
                if 'HOF' in file or 'hof' in file:
                    print(f"Skipping HOF file: {file}")
                    continue
                excel_files.append(os.path.join(root, file))

    print(f"Found {len(excel_files)} Excel files to process")
    print()

    # Process all files
    all_players = []

    for file_path in sorted(excel_files):
        players = process_excel_file(file_path, player_lookup, combine_df)
        all_players.extend(players)

    # Create DataFrame
    print()
    print("Creating output DataFrame...")
    df_output = pd.DataFrame(all_players)

    # Sort by year and team
    df_output = df_output.sort_values(['Year', 'Season_Team', 'POVR'], ascending=[True, True, False])

    # Save to CSV
    print(f"Saving to {OUTPUT_FILE}...")
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    df_output.to_csv(OUTPUT_FILE, index=False)

    # Print statistics
    print()
    print("="*80)
    print("EXTRACTION COMPLETE")
    print("="*80)
    print(f"Files processed: {stats['files_processed']}")
    print(f"Players extracted: {stats['players_extracted']}")
    print(f"Years covered: {sorted(stats['years_processed'])}")
    print(f"Teams processed: {len(stats['teams_processed'])}")
    print(f"Output file: {OUTPUT_FILE}")
    print(f"Output rows: {len(df_output)}")
    print(f"Output columns: {len(df_output.columns)}")

    if stats['errors']:
        print(f"\nWarnings/Errors: {len(stats['errors'])}")
        for error in stats['errors'][:10]:  # Show first 10 errors
            print(f"  - {error}")
        if len(stats['errors']) > 10:
            print(f"  ... and {len(stats['errors']) - 10} more")

    print()
    print("Next steps:")
    print("1. Review ROSTER_lookup.csv for data quality")
    print("2. Check PID match rate (PID=0 means no match)")
    print("3. Spot-check known players (Mahomes, Brady, etc.)")
    print()

if __name__ == '__main__':
    main()
