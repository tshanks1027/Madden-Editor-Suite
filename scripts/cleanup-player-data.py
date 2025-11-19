#!/usr/bin/env python3
"""
Player Data Cleanup Script
==========================
Cleans up player lookup CSV files:
1. Removes 2024 duplicate players in ROSTER_lookup.csv
2. Assigns missing archetypes based on player attributes
3. Updates PID_Portrait_Mapping.csv with PAM values from ALL_PLAYER_LOOKUP.csv

Usage:
    python cleanup-player-data.py [--dry-run] [--restore-backup]
"""

import pandas as pd
import re
import os
import sys
from datetime import datetime
from pathlib import Path

# File paths
BASE_DIR = Path(__file__).parent.parent
DATA_DIR = BASE_DIR / 'data' / 'lookups'
ROSTER_LOOKUP = DATA_DIR / 'ROSTER_lookup.csv'
ALL_PLAYER_LOOKUP = DATA_DIR / 'ALL_PLAYER_LOOKUP.csv'
PID_PORTRAIT_MAPPING = DATA_DIR / 'PID_Portrait_Mapping.csv'
REPORT_FILE = DATA_DIR / 'cleanup-report.txt'

# Suffix patterns to remove for soft matching
SUFFIXES = ['jr', 'sr', 'ii', 'iii', 'iv', 'v', 'jr.', 'sr.']


def normalize_name(name):
    """
    Normalize player name for soft matching.
    Handles: Jr/Sr/III suffixes, punctuation (O'Brien, De'Anthony), case differences

    Examples:
        "O'Brien Jr." -> "obrien"
        "De'Anthony Thomas III" -> "deanthony thomas"
    """
    if pd.isna(name) or not isinstance(name, str):
        return ""

    # Convert to lowercase
    name = name.lower().strip()

    # Remove punctuation (apostrophes, hyphens, periods, commas)
    name = re.sub(r"['\-.,]", "", name)

    # Remove suffixes
    for suffix in SUFFIXES:
        # Match suffix at word boundary (end of string or before space)
        name = re.sub(rf'\b{re.escape(suffix)}\b', '', name)

    # Normalize whitespace
    name = ' '.join(name.split())

    return name


def create_backup(file_path):
    """Create backup file with .bak extension"""
    backup_path = str(file_path) + '.bak'
    if os.path.exists(file_path):
        import shutil
        shutil.copy2(file_path, backup_path)
        print(f"[OK] Created backup: {backup_path}")
        return backup_path
    return None


def restore_backup(file_path):
    """Restore file from .bak backup"""
    backup_path = str(file_path) + '.bak'
    if os.path.exists(backup_path):
        import shutil
        shutil.copy2(backup_path, file_path)
        print(f"[OK] Restored from backup: {file_path}")
        return True
    else:
        print(f"[ERROR] No backup found: {backup_path}")
        return False


def load_csv_safe(file_path):
    """Load CSV with error handling"""
    try:
        df = pd.read_csv(file_path, low_memory=False)
        print(f"[OK] Loaded {len(df)} rows from {file_path.name}")
        return df
    except Exception as e:
        print(f"[ERROR] Error loading {file_path}: {e}")
        sys.exit(1)


def deduplicate_2024_players(df):
    """
    Remove duplicate 2024 players, keeping rows with valid PID.
    Returns: (cleaned_df, stats_dict)
    """
    print("\n=== Task 1: Deduplicating 2024 Players ===")

    # Filter 2024 players
    players_2024 = df[df['Year'] == 2024].copy()
    non_2024 = df[df['Year'] != 2024].copy()

    print(f"Found {len(players_2024)} total 2024 player rows")

    # Add normalized name column for matching
    players_2024['_norm_first'] = players_2024['First Name'].apply(normalize_name)
    players_2024['_norm_last'] = players_2024['Last Name'].apply(normalize_name)

    # Group by normalized name + position + team
    group_cols = ['_norm_first', '_norm_last', 'Position', 'Season_Team']

    duplicates_removed = 0
    unique_players = []

    for group_key, group_df in players_2024.groupby(group_cols):
        if len(group_df) > 1:
            # Multiple entries - keep the one with valid PID
            valid_pid_rows = group_df[group_df['PID'] != 0.0]
            if len(valid_pid_rows) > 0:
                # Keep first row with valid PID
                unique_players.append(valid_pid_rows.iloc[0])
                duplicates_removed += len(group_df) - 1
            else:
                # No valid PID - just keep first row
                unique_players.append(group_df.iloc[0])
                duplicates_removed += len(group_df) - 1
        else:
            # Single entry - keep as-is
            unique_players.append(group_df.iloc[0])

    # Reconstruct dataframe
    players_2024_clean = pd.DataFrame(unique_players)
    players_2024_clean = players_2024_clean.drop(columns=['_norm_first', '_norm_last'])

    # Combine with non-2024 players
    df_clean = pd.concat([non_2024, players_2024_clean], ignore_index=True)

    stats = {
        'total_2024_before': len(players_2024),
        'total_2024_after': len(players_2024_clean),
        'duplicates_removed': duplicates_removed,
        'unique_players': len(players_2024_clean)
    }

    print(f"[OK] Removed {duplicates_removed} duplicate rows")
    print(f"[OK] Kept {len(players_2024_clean)} unique 2024 players")

    return df_clean, stats


def assign_archetype(row):
    """
    Assign archetype based on position and attributes.
    Uses attribute-based rules for each position.
    """
    pos = row['Position']
    spd = row.get('PSPD', 0)
    str_val = row.get('PSTR', 0)
    agi = row.get('PAGI', 0)
    awr = row.get('PAWR', 0)
    cth = row.get('PCTH', 0)

    # Halfback
    if pos == 'HB':
        if spd >= 87 and cth >= 80:
            return 'HB_ReceivingBack'
        elif str_val >= 75:
            return 'HB_PowerBack'
        else:
            return 'HB_ElusiveBack'

    # Wide Receiver
    elif pos == 'WR':
        if spd >= 92:
            return 'WR_DeepThreat'
        elif str_val >= 70:
            return 'WR_Physical'
        elif spd >= 88:
            return 'WR_Slot'
        else:
            return 'WR_Playmaker'

    # Quarterback
    elif pos == 'QB':
        if spd >= 85 and awr >= 75:
            return 'QB_Improviser'
        elif spd >= 78:
            return 'QB_Scrambler'
        elif awr >= 75:
            return 'QB_FieldGeneral'
        else:
            return 'QB_StrongArm'

    # Cornerback
    elif pos == 'CB':
        if 88 <= spd <= 92 and awr < 90:
            return 'CB_Slot'
        elif awr >= 70:
            return 'CB_Zone'
        else:
            return 'CB_MantoMan'

    # Middle Linebacker
    elif pos in ['MLB', 'MIKE']:
        if awr >= 75:
            return 'MLB_FieldGeneral'
        elif str_val >= 75:
            return 'MLB_RunStopper'
        else:
            return 'MLB_PassCoverage'

    # Outside Linebacker
    elif pos in ['OLB', 'WILL', 'SAM', 'LOLB', 'ROLB']:
        if spd >= 82:
            return 'OLB_SpeedRusher'
        elif str_val >= 75:
            return 'OLB_RunStopper'
        else:
            return 'OLB_PassCoverage'

    # Defensive End
    elif pos in ['DE', 'LEDG', 'REDG', 'LE', 'RE']:
        if spd >= 80:
            return 'DE_SmallerSpeedRusher'
        elif str_val >= 80:
            return 'DE_RunStopper'
        else:
            return 'DE_PowerRusher'

    # Defensive Tackle
    elif pos in ['DT', 'LDT', 'RDT', 'NT']:
        if spd >= 70:
            return 'DT_SpeedRusher'
        elif str_val >= 85:
            return 'DT_RunStopper'
        else:
            return 'DT_PowerRusher'

    # Tight End
    elif pos == 'TE':
        if spd >= 80:
            return 'TE_VerticalThreat'
        elif cth >= 80:
            return 'TE_Possession'
        else:
            return 'TE_Blocking'

    # Safety
    elif pos in ['FS', 'SS', 'S']:
        if spd >= 88:
            return 'S_Zone'
        else:
            return 'S_Hybrid'

    # Offensive Line
    elif pos in ['LT', 'LG', 'C', 'RG', 'RT', 'T', 'G']:
        return 'OL_Balanced'

    # Kicker/Punter
    elif pos in ['K', 'P']:
        return ''  # No archetype for special teams

    # Fullback
    elif pos == 'FB':
        return 'FB_Blocking'

    else:
        # Unknown position - return empty
        return ''


def assign_missing_archetypes(df):
    """
    Assign archetypes to players with empty Archetype field.
    Returns: (df_with_archetypes, stats_dict)
    """
    print("\n=== Task 2: Assigning Missing Archetypes ===")

    # Count missing archetypes
    missing_mask = df['Archetype'].isna() | (df['Archetype'] == '') | (df['Archetype'] == '0')
    missing_count_before = missing_mask.sum()

    print(f"Found {missing_count_before} players with missing archetypes")

    # Assign archetypes
    archetype_counts = {}
    for idx in df[missing_mask].index:
        new_archetype = assign_archetype(df.loc[idx])
        if new_archetype:
            df.at[idx, 'Archetype'] = new_archetype
            archetype_counts[new_archetype] = archetype_counts.get(new_archetype, 0) + 1

    # Count still missing after assignment
    missing_mask_after = df['Archetype'].isna() | (df['Archetype'] == '') | (df['Archetype'] == '0')
    missing_count_after = missing_mask_after.sum()

    assigned_count = missing_count_before - missing_count_after

    stats = {
        'missing_before': missing_count_before,
        'assigned': assigned_count,
        'missing_after': missing_count_after,
        'by_archetype': archetype_counts
    }

    print(f"[OK] Assigned {assigned_count} archetypes")
    print(f"  Still missing: {missing_count_after} (special teams or unknown positions)")

    return df, stats


def backfill_pids_from_all_players(roster_df, all_players_df):
    """
    Match players in ROSTER_lookup with ALL_PLAYER_LOOKUP and backfill PIDs/PAMs.
    Uses soft name matching to handle Jr/Sr/III and punctuation differences.
    Returns: (roster_df, stats_dict)
    """
    print("\n=== Task 3a: Backfilling PIDs from ALL_PLAYER_LOOKUP ===")

    # Create normalized name columns for matching
    roster_df['_norm_first'] = roster_df['First Name'].apply(normalize_name)
    roster_df['_norm_last'] = roster_df['Last Name'].apply(normalize_name)

    all_players_df['_norm_first'] = all_players_df['First Name'].apply(normalize_name)
    all_players_df['_norm_last'] = all_players_df['Last Name'].apply(normalize_name)

    # Create lookup dictionary: (norm_first, norm_last, position) -> (PID, PAM, PLPO)
    lookup = {}
    for _, row in all_players_df.iterrows():
        key = (row['_norm_first'], row['_norm_last'], row.get('Position', ''))
        pid = row.get('PID', 0)
        pam = row.get('PAM', '')
        plpo = row.get('PLPO', '')

        # Only add if has valid PID
        if pd.notna(pid) and pid != 0 and pid != 0.0:
            lookup[key] = {
                'PID': pid,
                'PAM': pam if (pd.notna(pam) and pam != '' and pam != '0' and pam != 0.0) else '',
                'PLPO': plpo if pd.notna(plpo) else ''
            }

    print(f"Created lookup table with {len(lookup)} unique player entries from ALL_PLAYER_LOOKUP")

    # Match and backfill
    matched_count = 0
    pam_filled_count = 0

    for idx, row in roster_df.iterrows():
        current_pid = row.get('PID', 0)
        current_pam = row.get('PAM', '')

        # Only backfill if PID is 0
        if current_pid == 0 or current_pid == 0.0 or pd.isna(current_pid):
            key = (row['_norm_first'], row['_norm_last'], row.get('Position', ''))

            if key in lookup:
                roster_df.at[idx, 'PID'] = lookup[key]['PID']
                matched_count += 1

                # Also fill PAM if available and current PAM is empty/zero
                if lookup[key]['PAM'] and (pd.isna(current_pam) or current_pam == '' or current_pam == '0' or current_pam == 0 or current_pam == 0.0):
                    roster_df.at[idx, 'PAM'] = lookup[key]['PAM']
                    pam_filled_count += 1

    # Drop temporary columns
    roster_df = roster_df.drop(columns=['_norm_first', '_norm_last'])

    stats = {
        'players_matched': matched_count,
        'pam_backfilled': pam_filled_count
    }

    print(f"[OK] Matched {matched_count} players and filled PIDs from ALL_PLAYER_LOOKUP")
    print(f"[OK] Backfilled {pam_filled_count} PAM values")

    return roster_df, stats


def assign_missing_pids(roster_df, mapping_df):
    """
    Assign unique PIDs to players still with PID=0 (after backfill attempt) and clean up PAM=0 to empty.
    Returns: (roster_df, mapping_df, stats_dict)
    """
    print("\n=== Task 3b: Assigning Generic PIDs ===")

    # Find next available PID
    max_pid_roster = roster_df['PID'].max()
    max_pid_mapping = mapping_df['PID'].max()
    next_pid = int(max(max_pid_roster, max_pid_mapping)) + 1

    print(f"Starting generic PID assignment from: {next_pid}")

    # Count players with PID=0
    pid_zero_mask = (roster_df['PID'] == 0) | (roster_df['PID'] == 0.0) | roster_df['PID'].isna()
    players_needing_pid = pid_zero_mask.sum()

    print(f"Found {players_needing_pid} players still with PID=0 after backfill")

    # Assign unique PIDs
    new_pids = list(range(next_pid, next_pid + players_needing_pid))
    roster_df.loc[pid_zero_mask, 'PID'] = new_pids

    # Clean up PAM: change 0/0.0 to empty string
    pam_zero_mask = (roster_df['PAM'] == 0) | (roster_df['PAM'] == 0.0) | (roster_df['PAM'] == '0')
    pam_zero_count = pam_zero_mask.sum()
    roster_df.loc[pam_zero_mask, 'PAM'] = ''

    # Get available generic portraits
    generic_portraits = mapping_df[mapping_df['Type'] == 'generic']['Portrait'].tolist()
    print(f"Found {len(generic_portraits)} generic portraits available")

    # Add new PIDs to mapping with generic portraits
    new_mapping_entries = []
    for i, pid in enumerate(new_pids):
        # Cycle through generic portraits
        portrait = generic_portraits[i % len(generic_portraits)] if generic_portraits else 'plpo_Blank'

        new_entry = {
            'PID': pid,
            'Player Name': 'Generic Player',
            'Type': 'generic',
            'Portrait': portrait,
            'PAM': ''  # Leave PAM empty as instructed
        }
        new_mapping_entries.append(new_entry)

    if new_mapping_entries:
        new_df = pd.DataFrame(new_mapping_entries)
        mapping_df = pd.concat([mapping_df, new_df], ignore_index=True)

    stats = {
        'pids_assigned': players_needing_pid,
        'pam_cleaned': pam_zero_count,
        'new_mapping_entries': len(new_mapping_entries),
        'next_pid_start': next_pid,
        'next_pid_end': next_pid + players_needing_pid - 1
    }

    print(f"[OK] Assigned {players_needing_pid} unique PIDs ({next_pid} to {next_pid + players_needing_pid - 1})")
    print(f"[OK] Changed {pam_zero_count} PAM values from 0 to empty")
    print(f"[OK] Added {len(new_mapping_entries)} generic portrait mappings")

    return roster_df, mapping_df, stats


def update_portrait_mapping(mapping_df, all_players_df):
    """
    Update PID_Portrait_Mapping.csv with PAM values from ALL_PLAYER_LOOKUP.csv
    Returns: (updated_df, stats_dict)
    """
    print("\n=== Task 4: Updating PID Portrait Mapping (from ALL_PLAYER_LOOKUP) ===")

    # Create lookup dictionary: PID -> PAM from ALL_PLAYER_LOOKUP
    all_players_df = all_players_df.copy()
    all_players_df['PID'] = pd.to_numeric(all_players_df['PID'], errors='coerce')

    # Filter valid PIDs and PAMs
    valid_pam = all_players_df[
        (all_players_df['PID'].notna()) &
        (all_players_df['PID'] != 0) &
        (all_players_df['PAM'].notna()) &
        (all_players_df['PAM'] != '') &
        (all_players_df['PAM'] != '0') &
        (all_players_df['PAM'] != 0.0)
    ]

    pid_to_pam = dict(zip(valid_pam['PID'], valid_pam['PAM']))

    print(f"Found {len(pid_to_pam)} valid PID->PAM mappings in ALL_PLAYER_LOOKUP")

    # Update mapping file
    updated_count = 0
    for idx, row in mapping_df.iterrows():
        pid = row['PID']
        current_pam = row.get('PAM', '')

        # Check if PAM is empty/invalid
        is_empty_pam = (
            pd.isna(current_pam) or
            current_pam == '' or
            current_pam == '0' or
            current_pam == 0.0
        )

        if is_empty_pam and pid in pid_to_pam:
            mapping_df.at[idx, 'PAM'] = pid_to_pam[pid]
            updated_count += 1

    # Add new PIDs from ALL_PLAYER_LOOKUP that aren't in mapping
    existing_pids = set(mapping_df['PID'].values)
    new_entries = []

    for _, row in all_players_df.iterrows():
        pid = row['PID']
        if pid not in existing_pids and pid in pid_to_pam:
            new_entry = {
                'PID': pid,
                'Player Name': f"{row.get('First Name', '')} {row.get('Last Name', '')}".strip(),
                'Type': 'player',
                'Portrait': row.get('PLPO', ''),
                'PAM': pid_to_pam[pid]
            }
            new_entries.append(new_entry)

    if new_entries:
        new_df = pd.DataFrame(new_entries)
        mapping_df = pd.concat([mapping_df, new_df], ignore_index=True)
        print(f"[OK] Added {len(new_entries)} new PID entries from ALL_PLAYER_LOOKUP")

    stats = {
        'pam_updated': updated_count,
        'new_pids_added': len(new_entries),
        'total_valid_mappings': len(pid_to_pam)
    }

    print(f"[OK] Updated {updated_count} PAM values")

    return mapping_df, stats


def generate_report(dedup_stats, archetype_stats, backfill_stats, pid_stats, mapping_stats, output_file):
    """Generate cleanup report"""
    print("\n=== Generating Cleanup Report ===")

    report = []
    report.append("=" * 70)
    report.append("PLAYER DATA CLEANUP REPORT")
    report.append(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    report.append("=" * 70)

    report.append("\n1. 2024 DUPLICATE REMOVAL")
    report.append("-" * 70)
    report.append(f"Total 2024 rows before:  {dedup_stats['total_2024_before']}")
    report.append(f"Total 2024 rows after:   {dedup_stats['total_2024_after']}")
    report.append(f"Duplicates removed:      {dedup_stats['duplicates_removed']}")
    report.append(f"Unique players kept:     {dedup_stats['unique_players']}")

    report.append("\n2. ARCHETYPE ASSIGNMENT")
    report.append("-" * 70)
    report.append(f"Missing archetypes before: {archetype_stats['missing_before']}")
    report.append(f"Archetypes assigned:       {archetype_stats['assigned']}")
    report.append(f"Still missing after:       {archetype_stats['missing_after']}")

    report.append("\nArchetypes assigned by type:")
    for archetype, count in sorted(archetype_stats['by_archetype'].items()):
        report.append(f"  {archetype:30s} {count:5d}")

    report.append("\n3a. PID/PAM BACKFILL FROM ALL_PLAYER_LOOKUP")
    report.append("-" * 70)
    report.append(f"Players matched by name:          {backfill_stats['players_matched']}")
    report.append(f"PAM values backfilled:            {backfill_stats['pam_backfilled']}")

    report.append("\n3b. GENERIC PID ASSIGNMENT")
    report.append("-" * 70)
    report.append(f"PIDs assigned (PID=0 -> unique): {pid_stats['pids_assigned']}")
    report.append(f"PID range assigned:              {pid_stats['next_pid_start']} to {pid_stats['next_pid_end']}")
    report.append(f"PAM values cleaned (0 -> empty): {pid_stats['pam_cleaned']}")
    report.append(f"Generic portrait mappings added: {pid_stats['new_mapping_entries']}")

    report.append("\n4. PID PORTRAIT MAPPING UPDATE")
    report.append("-" * 70)
    report.append(f"PAM values updated:        {mapping_stats['pam_updated']}")
    report.append(f"New PIDs added:            {mapping_stats['new_pids_added']}")
    report.append(f"Total valid PID->PAM maps: {mapping_stats['total_valid_mappings']}")

    report.append("\n" + "=" * 70)
    report.append("CLEANUP COMPLETE")
    report.append("=" * 70)

    report_text = "\n".join(report)

    with open(output_file, 'w') as f:
        f.write(report_text)

    print(f"[OK] Report saved to: {output_file}")
    print("\n" + report_text)

    return report_text


def main():
    """Main cleanup process"""
    dry_run = '--dry-run' in sys.argv
    restore = '--restore-backup' in sys.argv

    print("=" * 70)
    print("PLAYER DATA CLEANUP SCRIPT")
    print("=" * 70)

    if restore:
        print("\n=== Restoring from Backup ===")
        restore_backup(ROSTER_LOOKUP)
        restore_backup(ALL_PLAYER_LOOKUP)
        restore_backup(PID_PORTRAIT_MAPPING)
        print("\n[OK] Restore complete")
        return

    if dry_run:
        print("\n*** DRY RUN MODE - No files will be modified ***\n")

    # Load CSV files
    print("\n=== Loading CSV Files ===")
    roster_df = load_csv_safe(ROSTER_LOOKUP)
    all_players_df = load_csv_safe(ALL_PLAYER_LOOKUP)
    mapping_df = load_csv_safe(PID_PORTRAIT_MAPPING)

    # Create backups
    if not dry_run:
        print("\n=== Creating Backups ===")
        create_backup(ROSTER_LOOKUP)
        create_backup(PID_PORTRAIT_MAPPING)

    # Task 1: Deduplicate 2024 players
    roster_df, dedup_stats = deduplicate_2024_players(roster_df)

    # Task 2: Assign missing archetypes
    roster_df, archetype_stats = assign_missing_archetypes(roster_df)

    # Task 3a: Backfill PIDs/PAMs from ALL_PLAYER_LOOKUP
    roster_df, backfill_stats = backfill_pids_from_all_players(roster_df, all_players_df)

    # Task 3b: Assign generic PIDs to remaining players and clean PAMs
    roster_df, mapping_df, pid_stats = assign_missing_pids(roster_df, mapping_df)

    # Task 4: Update PID Portrait Mapping from ALL_PLAYER_LOOKUP
    mapping_df, mapping_stats = update_portrait_mapping(mapping_df, all_players_df)

    # Save cleaned data
    if not dry_run:
        print("\n=== Saving Cleaned Data ===")
        roster_df.to_csv(ROSTER_LOOKUP, index=False)
        print(f"[OK] Saved {len(roster_df)} rows to {ROSTER_LOOKUP.name}")

        mapping_df.to_csv(PID_PORTRAIT_MAPPING, index=False)
        print(f"[OK] Saved {len(mapping_df)} rows to {PID_PORTRAIT_MAPPING.name}")
    else:
        print("\n*** DRY RUN - Skipping file writes ***")

    # Generate report
    generate_report(dedup_stats, archetype_stats, backfill_stats, pid_stats, mapping_stats, REPORT_FILE)

    print("\n" + "=" * 70)
    print("[OK] CLEANUP COMPLETE")
    print("=" * 70)

    if dry_run:
        print("\nRun without --dry-run to apply changes")
    else:
        print(f"\nBackup files created with .bak extension")
        print(f"To restore: python {Path(__file__).name} --restore-backup")


if __name__ == '__main__':
    main()
