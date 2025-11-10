"""
Data Preparation Script for Historical Rating Generation

This script:
1. Loads modern roster data (2002-2024) with full ratings
2. Loads historical roster data (1970-2001) without ratings
3. Enriches with wAV data from ALL_PLAYER_LOOKUP.csv
4. Parses Rating Tools Excel for formulas and templates
5. Normalizes position names
6. Splits by position groups for ML training
7. Outputs training CSVs per position group
"""

import pandas as pd
import numpy as np
from pathlib import Path
import openpyxl
import re

# Paths
BASE_DIR = Path('.')
DATA_DIR = BASE_DIR / 'data'
LOOKUPS_DIR = DATA_DIR / 'lookups'
TRAINING_DIR = DATA_DIR / 'training'
RATING_TOOLS = Path('C:/Users/tshan/Downloads/Copy of Rating Tools (1).xlsx')

# Create training output directory
TRAINING_DIR.mkdir(parents=True, exist_ok=True)

print("=" * 80)
print("HISTORICAL RATING GENERATION - DATA PREPARATION")
print("=" * 80)
print()

# Position group mappings
POSITION_GROUPS = {
    'QB': ['QB'],
    'RB': ['RB', 'HB', 'FB'],
    'WR': ['WR', 'FL', 'SE'],
    'TE': ['TE'],
    'OL': ['LT', 'LG', 'C', 'RG', 'RT', 'G', 'T', 'OT', 'OG', 'OL'],
    'DL': ['LE', 'RE', 'LDE', 'RDE', 'DT', 'LDT', 'RDT', 'NT', 'DE', 'DL'],
    'LB': ['LOLB', 'ROLB', 'MLB', 'LB', 'OLB', 'ILB'],
    'DB': ['CB', 'FS', 'SS', 'S', 'DB', 'LCB', 'RCB'],
    'K': ['K', 'P']
}

def normalize_position(pos):
    """Convert position to standard format and group"""
    if pd.isna(pos) or not pos:
        return None, None

    pos = str(pos).strip().upper()

    # Direct mapping to group
    for group, positions in POSITION_GROUPS.items():
        if pos in positions:
            return pos, group

    return pos, None

def load_modern_rosters():
    """Load modern rosters (2002-2024) with full ratings"""
    print("Loading modern roster data (2002-2024)...")
    df = pd.read_csv(LOOKUPS_DIR / 'ROSTER_lookup.csv', low_memory=False)

    # Filter to years with ratings
    df = df[df['Year'] >= 2002].copy()

    # Normalize positions
    df[['Position_Normalized', 'Position_Group']] = df['Position'].apply(
        lambda x: pd.Series(normalize_position(x))
    )

    # Remove players without position group
    df = df[df['Position_Group'].notna()].copy()

    print(f"  Loaded {len(df)} modern players")
    print(f"  Years: {sorted(df['Year'].unique())}")
    print(f"  Position groups: {df['Position_Group'].value_counts().to_dict()}")

    return df

def load_historical_rosters():
    """Load historical rosters (1970-2001) without ratings"""
    print("\nLoading historical roster data (1970-2001)...")
    df = pd.read_csv(LOOKUPS_DIR / 'ROSTER_lookup_historical.csv', low_memory=False)

    # Normalize positions
    df[['Position_Normalized', 'Position_Group']] = df['Position'].apply(
        lambda x: pd.Series(normalize_position(x))
    )

    # Remove players without position group
    df = df[df['Position_Group'].notna()].copy()

    print(f"  Loaded {len(df)} historical players")
    print(f"  Years: {sorted(df['Year'].unique())}")
    print(f"  Position groups: {df['Position_Group'].value_counts().to_dict()}")

    return df

def load_player_lookup():
    """Load ALL_PLAYER_LOOKUP.csv for wAV enrichment"""
    print("\nLoading player lookup data for wAV...")
    df = pd.read_csv(LOOKUPS_DIR / 'ALL_PLAYER_LOOKUP.csv')

    # Create lookup key from first/last name
    df['lookup_key'] = (
        df['First Name'].str.strip().str.lower() + '_' +
        df['Last Name'].str.strip().str.lower()
    )

    # Keep relevant columns
    df = df[['lookup_key', 'wAV', 'From', 'To', 'AP1', 'PB', 'St']].copy()

    print(f"  Loaded {len(df)} player records with wAV")
    print(f"  Players with wAV > 0: {(df['wAV'] > 0).sum()}")

    return df

def enrich_with_wav(df_roster, df_lookup):
    """Add wAV and career stats to roster data"""
    print("\nEnriching roster data with wAV...")

    # Create lookup key
    df_roster['lookup_key'] = (
        df_roster['First_Name'].str.strip().str.lower() + '_' +
        df_roster['Last_Name'].str.strip().str.lower()
    )

    # Merge with player lookup
    df_merged = df_roster.merge(
        df_lookup[['lookup_key', 'wAV', 'AP1', 'PB']],
        on='lookup_key',
        how='left'
    )

    # Fill missing wAV with 0
    df_merged['wAV'] = df_merged['wAV'].fillna(0)
    df_merged['AP1'] = df_merged['AP1'].fillna(0)
    df_merged['PB'] = df_merged['PB'].fillna(0)

    print(f"  Matched {(df_merged['wAV'] > 0).sum()} players with wAV")

    return df_merged

def parse_rating_tools():
    """Parse Rating Tools Excel for AV→OVR and archetype templates"""
    print("\nParsing Rating Tools Excel...")

    wb = openpyxl.load_workbook(RATING_TOOLS, data_only=True)

    # Parse AV to Value Multiplier table
    print("  Parsing AV→OVR conversion table...")
    av_sheet = wb['OVR Generator']
    av_to_value = {}

    # Find the AV column (typically starts at row 2)
    # Format: AV value in one column, Value Multiplier in next
    for row in av_sheet.iter_rows(min_row=2, max_row=30, values_only=True):
        if row[0] is not None and row[1] is not None:
            try:
                av = float(row[0])
                value = float(row[1])
                av_to_value[av] = value
            except:
                continue

    print(f"    Found {len(av_to_value)} AV→Value mappings")

    # Parse Speed Calculator (40-time to speed by position)
    print("  Parsing Speed Calculator...")
    speed_sheet = wb['Speed Calculator']
    speed_by_position = {}

    # Parse archetype templates
    print("  Parsing Archetype Templates...")
    template_sheet = wb['Archetype Rating Template']
    archetype_templates = {}

    # Find header row (first row with position names)
    header_row = None
    for idx, row in enumerate(template_sheet.iter_rows(values_only=True), 1):
        if row and 'QB' in str(row):
            header_row = idx
            break

    if header_row:
        headers = [cell for cell in template_sheet[header_row]]
        # Parse each archetype column
        for col_idx, header in enumerate(headers, 1):
            if header.value and header.value.strip():
                archetype_name = str(header.value).strip()
                archetype_data = {}

                # Read stats below header
                for row in template_sheet.iter_rows(min_row=header_row+1, max_row=header_row+60,
                                                   min_col=col_idx, max_col=col_idx, values_only=True):
                    # Parse stat name from row label (column A)
                    stat_name = template_sheet.cell(row=template_sheet.max_row, column=1).value
                    if row[0] is not None:
                        archetype_data[str(row[0])] = row[0]

                if archetype_data:
                    archetype_templates[archetype_name] = archetype_data

    print(f"    Found {len(archetype_templates)} archetype templates")

    wb.close()

    return {
        'av_to_value': av_to_value,
        'speed_calculator': speed_by_position,
        'archetypes': archetype_templates
    }

def select_training_features(position_group):
    """Select relevant features for each position group"""

    # Base features for all positions
    base_features = [
        'AV', 'Height', 'Weight', 'Age', 'Years_Pro',
        'Games', 'Games_Started', 'wAV', 'AP1', 'PB'
    ]

    # Position-specific features
    position_features = {
        'QB': base_features + [
            'POVR', 'PSPD', 'PACC', 'PAGI', 'PSTR', 'PAWR',
            'PTHP', 'PTAS', 'PTAM', 'PTAD', 'PTUP', 'PPLA', 'PTOR', 'PBRS'
        ],
        'RB': base_features + [
            'POVR', 'PSPD', 'PACC', 'PAGI', 'PSTR', 'PAWR',
            'PCTH', 'PCAR', 'PBTK', 'PTRK', 'PCOD', 'PBCV',
            'PSTF', 'PSPM', 'PJUM', 'PJMP'
        ],
        'WR': base_features + [
            'POVR', 'PSPD', 'PACC', 'PAGI', 'PSTR', 'PAWR',
            'PCTH', 'PSPC', 'PCIT', 'PSRR', 'PMRR', 'PDRR',
            'PREL', 'PJMP', 'PCOD'
        ],
        'TE': base_features + [
            'POVR', 'PSPD', 'PACC', 'PAGI', 'PSTR', 'PAWR',
            'PCTH', 'PSPC', 'PCIT', 'PSRR', 'PMRR', 'PDRR', 'PREL',
            'PRBK', 'PPBK', 'PIBL', 'PRBP', 'PRBF', 'PPBP', 'PPBF'
        ],
        'OL': base_features + [
            'POVR', 'PSPD', 'PACC', 'PAGI', 'PSTR', 'PAWR',
            'PRBK', 'PPBK', 'PIBL', 'PRBP', 'PRBF', 'PPBP', 'PPBF', 'PLDB'
        ],
        'DL': base_features + [
            'POVR', 'PSPD', 'PACC', 'PAGI', 'PSTR', 'PAWR',
            'PTAK', 'PPWM', 'PFNM', 'PBSH', 'PPUR', 'PPRC', 'PHTP'
        ],
        'LB': base_features + [
            'POVR', 'PSPD', 'PACC', 'PAGI', 'PSTR', 'PAWR',
            'PTAK', 'PBSH', 'PPUR', 'PPRC', 'PMCV', 'PZCV', 'PHTP', 'PPRS'
        ],
        'DB': base_features + [
            'POVR', 'PSPD', 'PACC', 'PAGI', 'PSTR', 'PAWR',
            'PCTH', 'PMCV', 'PZCV', 'PPRS', 'PPRC', 'PJMP', 'PHTP'
        ],
        'K': base_features + [
            'POVR', 'PKPW', 'PKAC'
        ]
    }

    return position_features.get(position_group, base_features)

def split_by_position_group(df, rating_tools):
    """Split data by position group and save training CSVs"""
    print("\nSplitting data by position group...")

    for group in POSITION_GROUPS.keys():
        print(f"\n  Processing {group}...")

        # Filter to position group
        df_group = df[df['Position_Group'] == group].copy()

        if len(df_group) == 0:
            print(f"    No players in {group}, skipping")
            continue

        # Select training features
        features = select_training_features(group)

        # Keep only available columns
        available_features = [f for f in features if f in df_group.columns]
        df_group = df_group[available_features].copy()

        # Remove rows with missing POVR (if it exists)
        if 'POVR' in df_group.columns:
            df_group = df_group[df_group['POVR'] > 0].copy()

        # Fill missing numeric values with 0
        numeric_cols = df_group.select_dtypes(include=[np.number]).columns
        df_group[numeric_cols] = df_group[numeric_cols].fillna(0)

        print(f"    {len(df_group)} players with {len(available_features)} features")

        # Save training data
        output_file = TRAINING_DIR / f'{group}_training.csv'
        df_group.to_csv(output_file, index=False)
        print(f"    Saved to {output_file}")

def main():
    """Main data preparation pipeline"""

    # Load all data sources
    df_modern = load_modern_rosters()
    df_historical = load_historical_rosters()
    df_lookup = load_player_lookup()

    # Enrich modern data with wAV
    df_modern = enrich_with_wav(df_modern, df_lookup)

    # Enrich historical data with wAV
    df_historical = enrich_with_wav(df_historical, df_lookup)

    # Parse rating tools
    try:
        rating_tools = parse_rating_tools()
        # Save parsed data for later use
        import json
        with open(TRAINING_DIR / 'rating_tools.json', 'w') as f:
            # Convert to serializable format
            serializable_tools = {
                'av_to_value': {str(k): v for k, v in rating_tools['av_to_value'].items()},
                'speed_calculator': rating_tools['speed_calculator'],
                'archetype_names': list(rating_tools['archetypes'].keys())
            }
            json.dump(serializable_tools, f, indent=2)
        print("  Saved rating tools metadata")
    except Exception as e:
        print(f"  Warning: Could not parse Rating Tools Excel: {e}")
        rating_tools = {'av_to_value': {}, 'speed_calculator': {}, 'archetypes': {}}

    # Split modern data by position for training
    print("\n" + "=" * 80)
    print("PREPARING TRAINING DATA (MODERN ROSTERS)")
    print("=" * 80)
    split_by_position_group(df_modern, rating_tools)

    # Save historical data for later rating generation
    print("\n" + "=" * 80)
    print("SAVING HISTORICAL DATA")
    print("=" * 80)
    for group in POSITION_GROUPS.keys():
        df_group = df_historical[df_historical['Position_Group'] == group].copy()
        if len(df_group) > 0:
            output_file = TRAINING_DIR / f'{group}_historical.csv'
            df_group.to_csv(output_file, index=False)
            print(f"  Saved {len(df_group)} {group} players to {output_file}")

    # Print summary
    print("\n" + "=" * 80)
    print("DATA PREPARATION COMPLETE")
    print("=" * 80)
    print(f"\nTraining data saved to: {TRAINING_DIR}")
    print("\nNext steps:")
    print("  1. Run train-rating-models.py to train ML models")
    print("  2. Run generate-historical-ratings.py to generate ratings")
    print("  3. Run review-flagged-players.py to review uncertain ratings")

if __name__ == '__main__':
    main()
