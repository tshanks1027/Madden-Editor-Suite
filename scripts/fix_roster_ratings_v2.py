"""
ROSTER_lookup.csv Rating Fixer v2

Uses AV (Approximate Value) to determine appropriate rating tier,
then uses 2002+ rating distributions to generate realistic ratings.
Also fills all empty/0 values with appropriate random values.
Finally recalculates OVR using position-specific formulas adapted to CSV attribute names.
"""

import pandas as pd
import numpy as np
import json
import random
import re
from pathlib import Path

# Paths
BASE_DIR = Path("C:/Users/tshan/Documents/Dev/madden-editor-suite")
ROSTER_CSV = BASE_DIR / "data/lookups/ROSTER_lookup.csv"
RATING_MODEL = BASE_DIR / "data/lookups/rating_model_2002.json"
OUTPUT_CSV = BASE_DIR / "data/lookups/ROSTER_lookup_fixed.csv"

# Attribute name mapping: formula name -> CSV column name
# Some attributes need to be mapped to equivalents that exist in the CSV
ATTR_MAP = {
    'PLPR': 'PAWR',   # Play Recognition -> Awareness (closest equivalent)
    'PLPU': 'PPUR',   # Pursuit -> Pursuit (PPUR exists)
    'PBSG': 'PBSH',   # Block Shedding -> Block Shed (PBSH exists)
    'PLHT': 'PHTP',   # Hit Power -> Hit Power (PHTP exists)
    'PLZC': 'PZCV',   # Zone Coverage -> Zone Coverage
    'PLMC': 'PMCV',   # Man Coverage -> Man Coverage
    'PBKT': 'PBTK',   # Break Tackle -> Break Tackle
    'PELU': 'PTRK',   # Elusiveness -> Trucking (closest for elusiveness concept)
    'PFMS': 'PFNM',   # Finesse Moves -> Finesse Moves
    'PLPM': 'PPWM',   # Power Moves -> Power Moves
    'PKPR': 'PKPW',   # Kick Power -> Kick Power (close enough)
    'PLCI': 'PCIT',   # Catch in Traffic -> Catch in Traffic
    'PLPE': 'PPRS',   # Press -> Press
    'PLIB': 'PIBL',   # Lead Block -> Impact Block
    'PLRL': 'PREL',   # Release -> Release
    'PLSC': 'PSPC',   # Spectacular Catch -> Spectacular Catch
    'SRRN': 'PSRR',   # Short Route Running -> Short Route Running
    'PSRRN': 'PSRR',  # Alternate SRR name
}

# OVR formulas using CSV column names
# Adapted from madden-formulas.txt but using CSV attributes
OVR_FORMULAS = {
    # QB: PAWR*0.16+PTHP*0.16+PTAS*0.12+PTAM*0.12+PTAD*0.10+PTOR*0.04+PSPD*0.03+PCAR*0.02+PAGI*0.02+PSTR*0.02+PINJ*0.01+PSTA*0.01
    'QB': {'PAWR': 0.16, 'PTHP': 0.16, 'PTAS': 0.12, 'PTAM': 0.12, 'PTAD': 0.10,
           'PTOR': 0.04, 'PSPD': 0.03, 'PCAR': 0.02, 'PAGI': 0.02, 'PSTR': 0.02,
           'PINJ': 0.01, 'PSTA': 0.01},

    # HB: PSPD*0.20+PACC*0.10+PAGI*0.08+PCAR*0.10+PBCV*0.08+PBKT(PBTK)*0.08+PSTR*0.06+PELU(PTRK)*0.06+PCTH*0.04+PAWR*0.08+PSTA*0.04+PINJ*0.03+PJMP*0.03+PTGH*0.02
    'HB': {'PSPD': 0.20, 'PACC': 0.10, 'PAGI': 0.08, 'PCAR': 0.10, 'PBCV': 0.08,
           'PBTK': 0.08, 'PSTR': 0.06, 'PTRK': 0.06, 'PCTH': 0.04, 'PAWR': 0.08,
           'PSTA': 0.04, 'PINJ': 0.03, 'PJMP': 0.03, 'PTGH': 0.02},

    # WR: PSPD*0.18+PCTH*0.12+PCIT(PLCI)*0.10+PAWR*0.10+PACC*0.08+PAGI*0.08+PSRR*0.06+PDRR*0.06+PMRR*0.06+PSPC*0.04+PJMP*0.04+PSTR*0.03+PREL*0.03+PSTA*0.02
    'WR': {'PSPD': 0.18, 'PCTH': 0.12, 'PCIT': 0.10, 'PAWR': 0.10, 'PACC': 0.08,
           'PAGI': 0.08, 'PSRR': 0.06, 'PDRR': 0.06, 'PMRR': 0.06, 'PSPC': 0.04,
           'PJMP': 0.04, 'PSTR': 0.03, 'PREL': 0.03, 'PSTA': 0.02},

    # TE: PSPD*0.08+PCTH*0.10+PCIT*0.08+PAWR*0.08+PACC*0.06+PAGI*0.06+PRBK*0.10+PPBK*0.10+PSTR*0.08+PSRR*0.05+PMRR*0.05+PDRR*0.05+PJMP*0.04+PREL*0.03+PSTA*0.02+PINJ*0.02
    'TE': {'PSPD': 0.08, 'PCTH': 0.10, 'PCIT': 0.08, 'PAWR': 0.08, 'PACC': 0.06,
           'PAGI': 0.06, 'PRBK': 0.10, 'PPBK': 0.10, 'PSTR': 0.08, 'PSRR': 0.05,
           'PMRR': 0.05, 'PDRR': 0.05, 'PJMP': 0.04, 'PREL': 0.03, 'PSTA': 0.02, 'PINJ': 0.02},

    # FB: PIBL*0.18+PRBK*0.14+PPBK*0.12+PAWR*0.12+PSTR*0.10+PCAR*0.08+PSPD*0.06+PACC*0.06+PCTH*0.05+PBTK*0.05+PSTA*0.02+PINJ*0.02
    'FB': {'PIBL': 0.18, 'PRBK': 0.14, 'PPBK': 0.12, 'PAWR': 0.12, 'PSTR': 0.10,
           'PCAR': 0.08, 'PSPD': 0.06, 'PACC': 0.06, 'PCTH': 0.05, 'PBTK': 0.05,
           'PSTA': 0.02, 'PINJ': 0.02},

    # DL (DT, LEDG, REDG): PSTR*0.15+PTAK*0.12+PBSH*0.12+PAWR*0.10+PAWR*0.10+PFNM*0.08+PPWM*0.08+PSPD*0.06+PACC*0.05+PAGI*0.05+PPUR*0.04+PSTA*0.03+PINJ*0.02
    'DT': {'PSTR': 0.15, 'PTAK': 0.12, 'PBSH': 0.12, 'PAWR': 0.20, 'PFNM': 0.08,
           'PPWM': 0.08, 'PSPD': 0.06, 'PACC': 0.05, 'PAGI': 0.05, 'PPUR': 0.04,
           'PSTA': 0.03, 'PINJ': 0.02},
    'LEDG': {'PSTR': 0.12, 'PTAK': 0.12, 'PBSH': 0.10, 'PAWR': 0.15, 'PFNM': 0.12,
             'PPWM': 0.10, 'PSPD': 0.10, 'PACC': 0.06, 'PAGI': 0.05, 'PPUR': 0.04,
             'PSTA': 0.02, 'PINJ': 0.02},
    'REDG': {'PSTR': 0.12, 'PTAK': 0.12, 'PBSH': 0.10, 'PAWR': 0.15, 'PFNM': 0.12,
             'PPWM': 0.10, 'PSPD': 0.10, 'PACC': 0.06, 'PAGI': 0.05, 'PPUR': 0.04,
             'PSTA': 0.02, 'PINJ': 0.02},

    # LB: PTAK*0.15+PAWR*0.22+PPUR*0.10+PBSH*0.08+PHTP*0.08+PSPD*0.07+PACC*0.06+PAGI*0.06+PZCV*0.05+PMCV*0.05+PSTR*0.04+PSTA*0.02+PINJ*0.02
    'MIKE': {'PTAK': 0.15, 'PAWR': 0.22, 'PPUR': 0.10, 'PBSH': 0.08, 'PHTP': 0.08,
             'PSPD': 0.07, 'PACC': 0.06, 'PAGI': 0.06, 'PZCV': 0.05, 'PMCV': 0.05,
             'PSTR': 0.04, 'PSTA': 0.02, 'PINJ': 0.02},
    'SAM': {'PTAK': 0.15, 'PAWR': 0.22, 'PPUR': 0.10, 'PBSH': 0.08, 'PHTP': 0.08,
            'PSPD': 0.07, 'PACC': 0.06, 'PAGI': 0.06, 'PZCV': 0.05, 'PMCV': 0.05,
            'PSTR': 0.04, 'PSTA': 0.02, 'PINJ': 0.02},
    'WILL': {'PTAK': 0.15, 'PAWR': 0.20, 'PPUR': 0.10, 'PBSH': 0.06, 'PHTP': 0.06,
             'PSPD': 0.10, 'PACC': 0.07, 'PAGI': 0.07, 'PZCV': 0.07, 'PMCV': 0.05,
             'PSTR': 0.03, 'PSTA': 0.02, 'PINJ': 0.02},

    # CB: PSPD*0.15+PMCV*0.12+PZCV*0.12+PAWR*0.10+PAWR*0.10+PACC*0.08+PAGI*0.08+PPRS*0.06+PCTH*0.05+PPUR*0.05+PTAK*0.04+PSTA*0.03+PINJ*0.02
    'CB': {'PSPD': 0.15, 'PMCV': 0.12, 'PZCV': 0.12, 'PAWR': 0.20, 'PACC': 0.08,
           'PAGI': 0.08, 'PPRS': 0.06, 'PCTH': 0.05, 'PPUR': 0.05, 'PTAK': 0.04,
           'PSTA': 0.03, 'PINJ': 0.02},

    # S (FS, SS): PZCV*0.14+PAWR*0.12+PAWR*0.10+PPUR*0.10+PTAK*0.09+PSPD*0.08+PHTP*0.07+PACC*0.06+PAGI*0.06+PMCV*0.06+PSTR*0.04+PSTA*0.04+PINJ*0.04
    'FS': {'PZCV': 0.14, 'PAWR': 0.22, 'PPUR': 0.10, 'PTAK': 0.09, 'PSPD': 0.08,
           'PHTP': 0.07, 'PACC': 0.06, 'PAGI': 0.06, 'PMCV': 0.06, 'PSTR': 0.04,
           'PSTA': 0.04, 'PINJ': 0.04},
    'SS': {'PTAK': 0.14, 'PAWR': 0.20, 'PZCV': 0.12, 'PPUR': 0.10, 'PHTP': 0.10,
           'PSPD': 0.08, 'PACC': 0.06, 'PAGI': 0.06, 'PMCV': 0.06, 'PSTR': 0.04,
           'PSTA': 0.02, 'PINJ': 0.02},

    # OL: PPBK*0.22+PAWR*0.18+PPBF*0.14+PRBK*0.13+PRBF*0.11+PSTR*0.10+PAGI*0.06+PSTA*0.03+PINJ*0.03
    'LT': {'PPBK': 0.22, 'PAWR': 0.18, 'PPBF': 0.14, 'PRBK': 0.13, 'PRBF': 0.11,
           'PSTR': 0.10, 'PAGI': 0.06, 'PSTA': 0.03, 'PINJ': 0.03},
    'RT': {'PRBK': 0.18, 'PPBK': 0.18, 'PAWR': 0.16, 'PSTR': 0.14, 'PRBF': 0.12,
           'PPBF': 0.10, 'PAGI': 0.06, 'PSTA': 0.03, 'PINJ': 0.03},
    'LG': {'PRBK': 0.20, 'PAWR': 0.18, 'PPBK': 0.15, 'PSTR': 0.14, 'PRBF': 0.11,
           'PPBF': 0.10, 'PAGI': 0.06, 'PSTA': 0.03, 'PINJ': 0.03},
    'RG': {'PRBK': 0.20, 'PAWR': 0.18, 'PPBK': 0.15, 'PSTR': 0.14, 'PRBF': 0.11,
           'PPBF': 0.10, 'PAGI': 0.06, 'PSTA': 0.03, 'PINJ': 0.03},
    'C': {'PAWR': 0.20, 'PRBK': 0.16, 'PPBK': 0.14, 'PSTR': 0.14, 'PRBF': 0.12,
          'PPBF': 0.12, 'PAGI': 0.06, 'PSTA': 0.03, 'PINJ': 0.03},

    # K: PKAC*0.35+PKPW*0.32+PAWR*0.33
    'K': {'PKAC': 0.35, 'PKPW': 0.32, 'PAWR': 0.33},

    # P: PKAC*0.33+PKPW*0.34+PAWR*0.33
    'P': {'PKAC': 0.33, 'PKPW': 0.34, 'PAWR': 0.33},
}

# AV to OVR tier mapping (per-season AV)
def av_to_ovr_tier(av, position):
    """Convert per-season AV to expected OVR tier"""
    if pd.isna(av) or av < 0:
        av = 0

    # Different positions have different AV scales
    # QBs and skill positions tend to have higher AV
    if position in ['QB', 'HB', 'WR']:
        if av >= 15:
            return 'tier_4'  # Elite (90+)
        elif av >= 10:
            return 'tier_3'  # Good (80-89)
        elif av >= 6:
            return 'tier_2'  # Average (70-79)
        elif av >= 3:
            return 'tier_1'  # Below avg (60-69)
        else:
            return 'tier_0'  # Poor (40-59)
    elif position in ['K', 'P']:
        # Kickers/Punters have low AV generally
        if av >= 4:
            return 'tier_4'
        elif av >= 3:
            return 'tier_3'
        elif av >= 2:
            return 'tier_2'
        elif av >= 1:
            return 'tier_1'
        else:
            return 'tier_0'
    else:
        # OL, DL, LB, DB, TE, FB
        if av >= 12:
            return 'tier_4'
        elif av >= 8:
            return 'tier_3'
        elif av >= 5:
            return 'tier_2'
        elif av >= 2:
            return 'tier_1'
        else:
            return 'tier_0'

def calculate_ovr(row, position):
    """Calculate OVR from formula and row data"""
    if position not in OVR_FORMULAS:
        return row.get('POVR', 60)

    formula = OVR_FORMULAS[position]
    result = 0
    total_weight = 0

    for attr, weight in formula.items():
        val = row.get(attr, 0)
        if pd.isna(val):
            val = 0
        result += val * weight
        total_weight += weight

    # Normalize if weights don't sum to 1
    if total_weight > 0 and abs(total_weight - 1.0) > 0.01:
        result = result / total_weight

    return min(99, max(40, round(result)))

def generate_rating(model, position, tier, attr, existing_val):
    """Generate a rating based on model, with some randomness"""
    if position not in model or tier not in model[position]:
        # Fallback: use existing or generate random
        if pd.notna(existing_val) and existing_val > 0:
            return existing_val
        return random.randint(40, 75)

    tier_data = model[position][tier]
    if attr not in tier_data:
        # Attribute not in model - use existing or random
        if pd.notna(existing_val) and existing_val > 0:
            return existing_val
        return random.randint(12, 55)  # Random for non-key attributes

    stats = tier_data[attr]
    mean = stats['mean']
    std = stats['std']

    # Generate value with normal distribution, clamped to reasonable range
    val = np.random.normal(mean, std * 0.7)  # Reduce variance slightly
    val = max(stats['min'], min(stats['max'], val))
    return round(val)

def is_position_relevant_attr(position, attr):
    """Check if an attribute is relevant for a position"""
    # Get key attributes from OVR formula for this position
    if position in OVR_FORMULAS:
        return attr in OVR_FORMULAS[position]

    # Fallback key attributes by position
    key_attrs = {
        'QB': ['PTHP', 'PTAS', 'PTAM', 'PTAD', 'PAWR', 'PTOR', 'PSPD', 'PACC', 'PAGI'],
        'HB': ['PSPD', 'PACC', 'PAGI', 'PCAR', 'PBCV', 'PBTK', 'PSTR', 'PCTH', 'PTRK'],
        'WR': ['PSPD', 'PACC', 'PAGI', 'PCTH', 'PSRR', 'PMRR', 'PDRR', 'PJMP'],
        'TE': ['PCTH', 'PRBK', 'PPBK', 'PSTR', 'PSPD', 'PACC'],
        'FB': ['PRBK', 'PPBK', 'PIBL', 'PSTR', 'PCAR', 'PCTH'],
        'LT': ['PPBK', 'PRBK', 'PSTR', 'PAWR', 'PAGI'],
        'LG': ['PPBK', 'PRBK', 'PSTR', 'PAWR'],
        'C': ['PPBK', 'PRBK', 'PSTR', 'PAWR'],
        'RG': ['PPBK', 'PRBK', 'PSTR', 'PAWR'],
        'RT': ['PPBK', 'PRBK', 'PSTR', 'PAWR', 'PAGI'],
        'DT': ['PSTR', 'PTAK', 'PBSH', 'PAWR'],
        'LEDG': ['PSPD', 'PSTR', 'PTAK', 'PFNM', 'PPWM'],
        'REDG': ['PSPD', 'PSTR', 'PTAK', 'PFNM', 'PPWM'],
        'MIKE': ['PTAK', 'PAWR', 'PSPD', 'PBSH'],
        'SAM': ['PTAK', 'PAWR', 'PSPD', 'PSTR'],
        'WILL': ['PTAK', 'PAWR', 'PSPD', 'PMCV', 'PZCV'],
        'CB': ['PSPD', 'PACC', 'PAGI', 'PMCV', 'PZCV', 'PPRS'],
        'FS': ['PSPD', 'PACC', 'PTAK', 'PZCV', 'PAWR'],
        'SS': ['PTAK', 'PSPD', 'PSTR', 'PZCV', 'PAWR'],
        'K': ['PKAC', 'PKPW', 'PAWR'],
        'P': ['PKAC', 'PKPW', 'PAWR']
    }

    return attr in key_attrs.get(position, [])

def main():
    print("Loading data...")
    df = pd.read_csv(ROSTER_CSV, low_memory=False)

    with open(RATING_MODEL, 'r') as f:
        rating_model = json.load(f)

    print(f"Loaded {len(OVR_FORMULAS)} OVR formulas")

    # Get rating columns
    rating_cols = [c for c in df.columns if c.startswith('P') and c not in
                   ['POVR', 'PID', 'PAM', 'Position', 'Player_Name']]
    print(f"Rating columns: {len(rating_cols)}")

    # Process pre-2002 records
    pre_2002_mask = df['Year'] < 2002
    print(f"\nPre-2002 records to fix: {pre_2002_mask.sum()}")

    fixed_count = 0
    empty_filled = 0

    for idx in df[pre_2002_mask].index:
        row = df.loc[idx]
        position = row['Position']
        av = row['AV']

        # Determine target tier from AV
        tier = av_to_ovr_tier(av, position)

        # Generate/fix ratings for each attribute
        for col in rating_cols:
            existing_val = row[col]

            # Fix if value is 0, NaN, or clearly placeholder
            # For key attributes of the position, also fix if suspiciously low (under 60 for elite players)
            needs_fix = (pd.isna(existing_val) or existing_val == 0)

            # Additional check: for key attributes, fix if value is too low for the player's tier
            if not needs_fix and is_position_relevant_attr(position, col):
                # For elite players (tier_4), key attributes should be at least 70
                # For tier_3, at least 60, etc.
                tier_minimums = {
                    'tier_4': 70,
                    'tier_3': 60,
                    'tier_2': 50,
                    'tier_1': 40,
                    'tier_0': 30
                }
                min_val = tier_minimums.get(tier, 30)
                if existing_val < min_val:
                    needs_fix = True

            if needs_fix:
                if is_position_relevant_attr(position, col):
                    # Generate from model for key attributes
                    new_val = generate_rating(rating_model, position, tier, col, existing_val)
                else:
                    # Random for non-key attributes
                    new_val = random.randint(12, 55)

                df.at[idx, col] = new_val
                empty_filled += 1

        fixed_count += 1

        if fixed_count % 5000 == 0:
            print(f"  Processed {fixed_count} pre-2002 records...")

    print(f"\nFixed {fixed_count} pre-2002 records")
    print(f"Filled {empty_filled} empty/placeholder values")

    # Now recalculate OVR for ALL records using position formulas
    print("\nRecalculating OVR for all records...")
    ovr_recalc = 0

    for idx in df.index:
        row = df.loc[idx]
        position = row['Position']

        if position in OVR_FORMULAS:
            new_ovr = calculate_ovr(row, position)
            df.at[idx, 'POVR'] = new_ovr
            ovr_recalc += 1

    print(f"Recalculated OVR for {ovr_recalc} records")

    # Fill any remaining empty values in 2002+ data
    print("\nFilling remaining empty values in 2002+ data...")
    post_2002_mask = df['Year'] >= 2002

    for idx in df[post_2002_mask].index:
        row = df.loc[idx]
        position = row['Position']

        for col in rating_cols:
            val = row[col]
            if pd.isna(val) or val == 0:
                if is_position_relevant_attr(position, col):
                    # Use position average from model
                    if position in rating_model and 'tier_2' in rating_model[position]:
                        if col in rating_model[position]['tier_2']:
                            df.at[idx, col] = rating_model[position]['tier_2'][col]['mean']
                        else:
                            df.at[idx, col] = random.randint(40, 70)
                    else:
                        df.at[idx, col] = random.randint(40, 70)
                else:
                    df.at[idx, col] = random.randint(12, 55)
                empty_filled += 1

    # Convert all rating columns to integers before saving
    print("\nConverting rating columns to integers...")
    rating_cols_for_int = [c for c in df.columns if c.startswith('P') and c not in ['PID', 'PAM', 'Position', 'Player_Name']]
    int_cols = rating_cols_for_int + ['Year', 'Jersey', 'Age', 'PID', 'PAM', 'Height', 'Weight', 'Draft_Year', 'Games', 'Games_Started', 'AV']

    for col in int_cols:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0).astype(int)

    # Save
    print(f"\nSaving to {OUTPUT_CSV}...")
    df.to_csv(OUTPUT_CSV, index=False)
    print("Done!")

    # Print sample comparison
    print("\n=== Sample Pre-2002 Players After Fix ===")

    # QB sample
    qb = df[(df['Year'] < 2002) & (df['Position'] == 'QB')].nlargest(3, 'AV')
    print("\nTop 3 QBs by AV:")
    for _, row in qb.iterrows():
        print(f"  {row['Player_Name']} ({int(row['Year'])}): AV={row['AV']}, OVR={row['POVR']}, THP={row['PTHP']}, TAS={row['PTAS']}, TAM={row['PTAM']}, TAD={row['PTAD']}")

    # HB sample
    hb = df[(df['Year'] < 2002) & (df['Position'] == 'HB')].nlargest(3, 'AV')
    print("\nTop 3 HBs by AV:")
    for _, row in hb.iterrows():
        print(f"  {row['Player_Name']} ({int(row['Year'])}): AV={row['AV']}, OVR={row['POVR']}, SPD={row['PSPD']}, ACC={row['PACC']}, CAR={row['PCAR']}")

    # LB sample
    lb = df[(df['Year'] < 2002) & (df['Position'].isin(['MIKE', 'WILL', 'SAM']))].nlargest(3, 'AV')
    print("\nTop 3 LBs by AV:")
    for _, row in lb.iterrows():
        print(f"  {row['Player_Name']} ({int(row['Year'])}): AV={row['AV']}, OVR={row['POVR']}, TAK={row['PTAK']}, AWR={row['PAWR']}, SPD={row['PSPD']}")

    # CB sample
    cb = df[(df['Year'] < 2002) & (df['Position'] == 'CB')].nlargest(3, 'AV')
    print("\nTop 3 CBs by AV:")
    for _, row in cb.iterrows():
        print(f"  {row['Player_Name']} ({int(row['Year'])}): AV={row['AV']}, OVR={row['POVR']}, SPD={row['PSPD']}, MCV={row['PMCV']}, ZCV={row['PZCV']}")

    # OVR distribution
    print("\n=== OVR Distribution Pre-2002 ===")
    pre_2002_df = df[df['Year'] < 2002]
    print(f"Mean: {pre_2002_df['POVR'].mean():.1f}")
    print(f"Std: {pre_2002_df['POVR'].std():.1f}")
    print(f"Min: {pre_2002_df['POVR'].min()}")
    print(f"Max: {pre_2002_df['POVR'].max()}")
    print(f"25%: {pre_2002_df['POVR'].quantile(0.25):.0f}")
    print(f"50%: {pre_2002_df['POVR'].quantile(0.50):.0f}")
    print(f"75%: {pre_2002_df['POVR'].quantile(0.75):.0f}")

if __name__ == "__main__":
    main()
