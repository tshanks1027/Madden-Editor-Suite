"""
Merge College Rosters Script

Merges cfb_rosters_2025_fbs.csv into FutureDraft_Lookup_COMPLETE.csv
- Fuzzy name matching with Levenshtein distance
- College name normalization
- Field priority: Keep FutureDraft values, fill gaps from cfb_rosters
- CRITICAL: Preserve user-entered wAV values
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
CHECKPOINTS_DIR = BASE_DIR / 'data' / 'checkpoints'

FUTURE_DRAFT_FILE = LOOKUPS_DIR / 'FutureDraft_Lookup_COMPLETE.csv'
CFB_ROSTERS_FILE = LOOKUPS_DIR / 'cfb_rosters_2025_fbs.csv'
OUTPUT_FILE = LOOKUPS_DIR / 'FutureDraft_Lookup_MERGED.csv'

# Create checkpoints directory
CHECKPOINTS_DIR.mkdir(parents=True, exist_ok=True)

# College name normalization mappings
COLLEGE_ALIASES = {
    'uconn': 'connecticut',
    'pitt': 'pittsburgh',
    'ole miss': 'mississippi',
    'miami': 'miami (fl)',
    'miami fl': 'miami (fl)',
    'miami-fl': 'miami (fl)',
    'miami oh': 'miami (oh)',
    'miami-oh': 'miami (oh)',
    'usc': 'southern california',
    'southern cal': 'southern california',
    'nc state': 'north carolina state',
    'ncstate': 'north carolina state',
    'smu': 'southern methodist',
    'tcu': 'texas christian',
    'byu': 'brigham young',
    'ucf': 'central florida',
    'lsu': 'louisiana state',
    'uab': 'alabama-birmingham',
    'unlv': 'nevada-las vegas',
}

def normalize_college_name(college):
    """Normalize college names for consistent matching"""
    if pd.isna(college) or not college:
        return ''

    college = str(college).strip().lower()

    # Check aliases
    if college in COLLEGE_ALIASES:
        return COLLEGE_ALIASES[college]

    # Remove common suffixes
    college = college.replace(' university', '')
    college = college.replace(' college', '')
    college = college.replace('-', ' ')

    return college.strip()

def normalize_name_part(name):
    """Normalize name for matching (handle suffixes, case)"""
    if pd.isna(name) or not name:
        return ''

    name = str(name).strip().lower()

    # Remove common suffixes
    suffixes = [' jr', ' jr.', ' sr', ' sr.', ' iii', ' ii', ' iv']
    for suffix in suffixes:
        if name.endswith(suffix):
            name = name[:-len(suffix)].strip()

    return name

def build_player_index(df):
    """Build fast lookup indices for existing players"""
    exact_index = {}  # (last, first, college) -> idx
    name_index = {}   # (last, first) -> idx
    last_index = {}   # last -> [idx, idx, ...]

    for idx, row in df.iterrows():
        last_norm = normalize_name_part(row['Last Name'])
        first_norm = normalize_name_part(row['First Name'])
        college_norm = normalize_college_name(row['College'])

        if not last_norm or not first_norm:
            continue

        # Exact match index
        exact_key = (last_norm, first_norm, college_norm)
        exact_index[exact_key] = idx

        # Name-only index (first match wins)
        name_key = (last_norm, first_norm)
        if name_key not in name_index:
            name_index[name_key] = idx

        # Last name index for fuzzy matching
        if last_norm not in last_index:
            last_index[last_norm] = []
        last_index[last_norm].append(idx)

    return {'exact': exact_index, 'name': name_index, 'last': last_index}

def fuzzy_match_player(last, first, college, existing_players, indices):
    """
    Find best match using indexed lookups for speed
    Returns (matched_index, confidence_score) or (None, 0)
    """
    last_norm = normalize_name_part(last)
    first_norm = normalize_name_part(first)
    college_norm = normalize_college_name(college)

    if not last_norm or not first_norm:
        return None, 0

    # Try exact match first (O(1))
    exact_key = (last_norm, first_norm, college_norm)
    if exact_key in indices['exact']:
        return indices['exact'][exact_key], 1.0

    # Try exact name match (O(1))
    name_key = (last_norm, first_norm)
    if name_key in indices['name']:
        return indices['name'][name_key], 0.95

    # Fuzzy match on same last name candidates only
    candidates = indices['last'].get(last_norm, [])

    if not candidates:
        # Try similar last names (Levenshtein distance <= 2)
        for last_key in indices['last'].keys():
            if last_key[0] == last_norm[0]:  # First letter must match
                if levenshtein_distance(last_norm, last_key) <= 2:
                    candidates.extend(indices['last'][last_key])

    if not candidates:
        return None, 0

    # Compare against candidates
    best_match_idx = None
    best_score = 0

    for idx in candidates:
        existing = existing_players.iloc[idx]
        existing_last = normalize_name_part(existing['Last Name'])
        existing_first = normalize_name_part(existing['First Name'])
        existing_college = normalize_college_name(existing['College'])

        # Calculate similarity
        last_dist = levenshtein_distance(last_norm, existing_last)
        first_dist = levenshtein_distance(first_norm, existing_first)

        last_sim = 1 - (last_dist / max(len(last_norm), len(existing_last), 1))
        first_sim = 1 - (first_dist / max(len(first_norm), len(existing_first), 1))
        college_match = 1.0 if college_norm == existing_college else 0.0

        score = (last_sim * 0.45) + (first_sim * 0.35) + (college_match * 0.20)

        if score > best_score:
            best_score = score
            best_match_idx = idx

    # Require 80% confidence
    if best_score >= 0.80:
        return best_match_idx, best_score
    else:
        return None, best_score

def merge_fields(future_draft_row, cfb_roster_row):
    """
    Merge fields with priority: keep FutureDraft values, fill gaps
    CRITICAL: Preserve user-entered wAV values
    """
    merged = future_draft_row.copy()

    # All columns in order
    columns = ['Last Name', 'First Name', 'College', 'Rank', 'Draft Class',
               'Position', 'Jersey', 'Height', 'Weight', 'Class', 'wAV',
               'Hometown', 'Homestate', 'Race', 'Photo']

    for col in columns:
        future_val = future_draft_row[col]
        cfb_val = cfb_roster_row[col]

        # Special handling for wAV - NEVER overwrite if user entered
        if col == 'wAV':
            # If FutureDraft has a wAV value (not empty/0/NaN), preserve it
            if pd.notna(future_val) and future_val != '' and future_val != 0:
                merged[col] = future_val  # Keep user value
            else:
                # Only fill from cfb_rosters if FutureDraft is truly empty
                if pd.notna(cfb_val) and cfb_val != '' and cfb_val != 0:
                    merged[col] = cfb_val
        else:
            # For all other fields: keep FutureDraft if not empty, else use cfb_rosters
            if pd.isna(future_val) or future_val == '':
                if pd.notna(cfb_val) and cfb_val != '':
                    merged[col] = cfb_val

    return merged

def main():
    print("="*80)
    print("MERGING COLLEGE ROSTERS")
    print("="*80)
    print()

    # Load files
    print("Loading FutureDraft_Lookup_COMPLETE.csv...")
    df_future = pd.read_csv(FUTURE_DRAFT_FILE)
    print(f"  Loaded {len(df_future)} existing draft prospects")

    # Count existing wAV values
    existing_wav = df_future['wAV'].notna() & (df_future['wAV'] != '') & (df_future['wAV'] != 0)
    n_existing_wav = existing_wav.sum()
    print(f"  Found {n_existing_wav} players with existing wAV values (will be preserved)")
    print()

    print("Loading cfb_rosters_2025_fbs.csv...")
    df_cfb = pd.read_csv(CFB_ROSTERS_FILE)
    print(f"  Loaded {len(df_cfb)} FBS roster players")
    print()

    # Build indices for fast lookups
    print("Building player indices for fast matching...")
    indices = build_player_index(df_future)
    print(f"  Indexed {len(df_future)} existing players")
    print()

    # Statistics
    n_matched = 0
    n_updated = 0
    n_new = 0
    n_wav_preserved = 0

    print("="*80)
    print("PROCESSING CFB ROSTER PLAYERS")
    print("="*80)
    print()

    # Process each CFB roster player
    for idx, cfb_player in df_cfb.iterrows():
        last = cfb_player['Last Name']
        first = cfb_player['First Name']
        college = cfb_player['College']

        # Progress update every 500 players
        if (idx + 1) % 500 == 0:
            print(f"Processed {idx + 1}/{len(df_cfb)} players... "
                  f"(Matched: {n_matched}, New: {n_new}, wAV Preserved: {n_wav_preserved})")
            sys.stdout.flush()

        # Try fuzzy matching
        match_idx, confidence = fuzzy_match_player(last, first, college, df_future, indices)

        if match_idx is not None:
            # Player exists - merge fields
            n_matched += 1

            # Check if we're preserving wAV
            future_wav = df_future.loc[match_idx, 'wAV']
            if pd.notna(future_wav) and future_wav != '' and future_wav != 0:
                n_wav_preserved += 1

            # Merge fields
            merged_row = merge_fields(df_future.loc[match_idx], cfb_player)
            df_future.loc[match_idx] = merged_row
            n_updated += 1
        else:
            # New player - add to dataframe
            n_new += 1
            df_future = pd.concat([df_future, pd.DataFrame([cfb_player])], ignore_index=True)

    print()
    print(f"Processed all {len(df_cfb)} CFB roster players")
    print()

    # Final statistics
    print("="*80)
    print("MERGE COMPLETE")
    print("="*80)
    print()
    print(f"Total players in merged roster: {len(df_future)}")
    print(f"  Matched existing players: {n_matched}")
    print(f"  Updated with new data: {n_updated}")
    print(f"  Added new players: {n_new}")
    print(f"  User wAV values preserved: {n_wav_preserved}")
    print()

    # Save output
    print(f"Saving merged roster to {OUTPUT_FILE}...")
    df_future.to_csv(OUTPUT_FILE, index=False)
    print("  Saved successfully")
    print()

    # Data quality summary
    print("Data Quality Summary:")
    for col in ['Jersey', 'Height', 'Weight', 'Class', 'wAV', 'Hometown', 'Homestate']:
        filled = df_future[col].notna() & (df_future[col] != '')
        pct = (filled.sum() / len(df_future)) * 100
        print(f"  {col}: {filled.sum()}/{len(df_future)} filled ({pct:.1f}%)")
    print()

    print("Next step: Run parse-college-stats.py to extract statistics")

if __name__ == '__main__':
    main()
