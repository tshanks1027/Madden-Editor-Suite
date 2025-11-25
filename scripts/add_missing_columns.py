"""
Add missing Madden columns to ROSTER_lookup.csv

The CSV uses different column names than Madden expects.
This script adds the Madden-named columns with values derived from existing columns.
"""

import pandas as pd
import numpy as np
from pathlib import Path

# Paths
BASE_DIR = Path("C:/Users/tshan/Documents/Dev/madden-editor-suite")
ROSTER_CSV = BASE_DIR / "data/lookups/ROSTER_lookup.csv"
OUTPUT_CSV = ROSTER_CSV  # Overwrite in place

print("Loading ROSTER_lookup.csv...")
df = pd.read_csv(ROSTER_CSV, low_memory=False)
print(f"Loaded {len(df)} rows")

# Create a backup first
backup_path = str(ROSTER_CSV) + ".bak"
df.to_csv(backup_path, index=False)
print(f"Backup saved to {backup_path}")

# Mapping from CSV columns to Madden columns
# These are columns that exist with different names - copy data over
COLUMN_MAPPINGS = {
    # CSV column -> Madden column
    'PTRK': 'PLTR',    # Trucking
    'PCOD': 'PELU',    # Change of Direction / Elusiveness
    'PSTF': 'PLSA',    # Stiff Arm
    'PSPM': 'PLSM',    # Spin Move
    'PJUM': 'PLJM',    # Juke Move
    'PIBL': 'PLIB',    # Impact Blocking
    'PLDB': 'PLBK',    # Lead Block
    'PPWM': 'PLPM',    # Power Moves
    'PFNM': 'PFMS',    # Finesse Moves
    'PBSH': 'PBSG',    # Block Shedding
    'PPUR': 'PLPU',    # Pursuit
    'PPRC': 'PLPR',    # Play Recognition
    'PMCV': 'PLMC',    # Man Coverage
    'PZCV': 'PLZC',    # Zone Coverage
    'PSPC': 'PLSC',    # Spectacular Catch
    'PCIT': 'PLCI',    # Catch in Traffic
    'PSRR': 'SRRN',    # Short Route Running
    'PHTP': 'PLHT',    # Hit Power
    'PPRS': 'PLPE',    # Press
    'PREL': 'PLRL',    # Release
}

# Add the Madden-named columns by copying from CSV columns
print("\nAdding Madden-named columns...")
for csv_col, madden_col in COLUMN_MAPPINGS.items():
    if csv_col in df.columns:
        if madden_col not in df.columns:
            df[madden_col] = df[csv_col]
            print(f"  Added {madden_col} (copied from {csv_col})")
        else:
            print(f"  {madden_col} already exists, skipping")
    else:
        print(f"  WARNING: Source column {csv_col} not found!")

# Add completely missing columns with generated values
MISSING_COLUMNS = {
    'PBSK': {  # Break Sack - QB attribute, based on throw power + awareness
        'default': 50,
        'derive_from': ['PTHP', 'PAWR'],
        'weights': [0.6, 0.4],
        'position_boost': {'QB': 20}  # QBs get higher break sack
    },
    'PPBS': {  # Pass Block Strength - based on strength + pass block
        'default': 50,
        'derive_from': ['PSTR', 'PPBK'],
        'weights': [0.5, 0.5],
        'position_boost': {'LT': 10, 'LG': 10, 'C': 10, 'RG': 10, 'RT': 10}
    },
    'PRBS': {  # Run Block Strength - based on strength + run block
        'default': 50,
        'derive_from': ['PSTR', 'PRBK'],
        'weights': [0.5, 0.5],
        'position_boost': {'LT': 10, 'LG': 10, 'C': 10, 'RG': 10, 'RT': 10, 'FB': 5, 'TE': 5}
    },
}

print("\nAdding missing columns with derived values...")
for col_name, config in MISSING_COLUMNS.items():
    if col_name not in df.columns:
        # Start with default value
        df[col_name] = config['default']

        # Derive from other columns if specified
        if 'derive_from' in config:
            source_cols = config['derive_from']
            weights = config.get('weights', [1.0/len(source_cols)] * len(source_cols))

            # Calculate weighted average where source columns exist
            valid_mask = True
            weighted_sum = pd.Series(0.0, index=df.index)

            for src_col, weight in zip(source_cols, weights):
                if src_col in df.columns:
                    col_values = pd.to_numeric(df[src_col], errors='coerce').fillna(config['default'])
                    weighted_sum += col_values * weight

            df[col_name] = weighted_sum.round().astype(int)

        # Apply position boosts
        if 'position_boost' in config:
            for pos, boost in config['position_boost'].items():
                mask = df['Position'] == pos
                df.loc[mask, col_name] = (df.loc[mask, col_name] + boost).clip(0, 99)

        # Ensure values are in valid range
        df[col_name] = df[col_name].clip(0, 99).astype(int)

        print(f"  Added {col_name} (derived, mean={df[col_name].mean():.1f})")
    else:
        print(f"  {col_name} already exists, skipping")

# Also ensure PBTK exists (Break Tackle, different from PBKT)
if 'PBTK' not in df.columns and 'PBKT' in df.columns:
    df['PBTK'] = df['PBKT']
    print("  Added PBTK (copied from PBKT)")

# Ensure all values are integers
print("\nConverting all rating columns to integers...")
rating_cols = [c for c in df.columns if c.startswith('P') and c not in ['Position', 'Player_Name', 'PAM', 'PID']]
for col in rating_cols:
    if col in df.columns:
        df[col] = pd.to_numeric(df[col], errors='coerce').fillna(50).astype(int)

# Save
print(f"\nSaving to {OUTPUT_CSV}...")
df.to_csv(OUTPUT_CSV, index=False)

print("\n=== Summary ===")
print(f"Total columns: {len(df.columns)}")
print(f"Total rows: {len(df)}")

# Show new columns
new_cols = list(COLUMN_MAPPINGS.values()) + list(MISSING_COLUMNS.keys())
existing_new = [c for c in new_cols if c in df.columns]
print(f"\nNew Madden-compatible columns added: {len(existing_new)}")
for col in existing_new:
    print(f"  {col}: mean={df[col].mean():.1f}, min={df[col].min()}, max={df[col].max()}")

print("\nDone!")
