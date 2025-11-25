"""
ROSTER_lookup.csv Rating Fixer

Uses AV (Approximate Value) to determine appropriate rating tier,
then uses 2002+ rating distributions to generate realistic ratings.
Also fills all empty/0 values with appropriate random values.
Finally recalculates OVR using position-specific formulas.
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
FORMULAS_FILE = BASE_DIR / "data/formulas/madden-formulas.txt"
OUTPUT_CSV = BASE_DIR / "data/lookups/ROSTER_lookup_fixed.csv"

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

# Parse OVR formulas from madden-formulas.txt
def parse_ovr_formulas(filepath):
    """Parse position OVR formulas from file"""
    formulas = {}
    current_position = None

    with open(filepath, 'r') as f:
        lines = f.readlines()

    for i, line in enumerate(lines):
        line = line.strip()

        # Detect position headers
        if line in ['Quarterbacks', 'Halfback', 'Wide Receiver', 'Tight End',
                    'Defensive Linemen', 'Linebackers', 'Cornerbacks', 'Safeties',
                    'Fullback', 'Left Tackle', 'Left Guard', 'Center',
                    'Right Guard', 'Right Tackle', 'Kicker', 'Punter']:
            current_position = line

        # Detect Overall formula
        if line == 'Overall' and i + 1 < len(lines):
            next_line = lines[i + 1].strip()
            if next_line.startswith('='):
                formulas[current_position] = next_line[1:]  # Remove leading =

    # Map position names to CSV position codes
    pos_mapping = {
        'Quarterbacks': 'QB',
        'Halfback': 'HB',
        'Wide Receiver': 'WR',
        'Tight End': 'TE',
        'Defensive Linemen': ['DT', 'LEDG', 'REDG'],
        'Linebackers': ['MIKE', 'SAM', 'WILL'],
        'Cornerbacks': 'CB',
        'Safeties': ['FS', 'SS'],
        'Fullback': 'FB',
        'Left Tackle': 'LT',
        'Left Guard': 'LG',
        'Center': 'C',
        'Right Guard': 'RG',
        'Right Tackle': 'RT',
        'Kicker': 'K',
        'Punter': 'P'
    }

    result = {}
    for name, formula in formulas.items():
        if name in pos_mapping:
            mapping = pos_mapping[name]
            if isinstance(mapping, list):
                for pos in mapping:
                    result[pos] = formula
            else:
                result[mapping] = formula

    return result

def calculate_ovr(row, formula):
    """Calculate OVR from formula and row data"""
    if not formula:
        return row.get('POVR', 60)

    # Parse formula like: PAWR*0.16+PTHP*0.16+...
    # Handle IF statements by using base case
    if 'IF(' in formula:
        # Extract the else part (after the last comma before the closing paren)
        # For now, use a simplified approach - just use the base formula
        formula = re.sub(r'IF\([^,]+,[^,]+,([^)]+)\)', r'\1', formula)

    result = 0
    terms = formula.replace('-', '+-').split('+')

    for term in terms:
        term = term.strip()
        if not term:
            continue

        # Parse ATTR*weight format
        match = re.match(r'([A-Z]+)\*?([\d.]+)?', term)
        if match:
            attr = match.group(1)
            weight = float(match.group(2)) if match.group(2) else 1.0

            val = row.get(attr, 0)
            if pd.isna(val):
                val = 0
            result += val * weight

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
    # Key attributes by position
    key_attrs = {
        'QB': ['PTHP', 'PTAS', 'PTAM', 'PTAD', 'PAWR', 'PTOR', 'PSPD', 'PACC', 'PAGI'],
        'HB': ['PSPD', 'PACC', 'PAGI', 'PCAR', 'PBCV', 'PBKT', 'PSTR', 'PCTH', 'PELU'],
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

    ovr_formulas = parse_ovr_formulas(FORMULAS_FILE)
    print(f"Loaded {len(ovr_formulas)} OVR formulas")

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

            # Fix if value is 0, NaN, or clearly placeholder (like 40)
            needs_fix = (pd.isna(existing_val) or
                        existing_val == 0 or
                        (existing_val == 40 and col in ['PTHP', 'PTAS', 'PTAM', 'PTAD']))

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

        if position in ovr_formulas:
            new_ovr = calculate_ovr(row, ovr_formulas[position])
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

    # Save
    print(f"\nSaving to {OUTPUT_CSV}...")
    df.to_csv(OUTPUT_CSV, index=False)
    print("Done!")

    # Print sample comparison
    print("\n=== Sample Pre-2002 QB Before/After ===")
    sample_qb = df[(df['Year'] < 2002) & (df['Position'] == 'QB')].iloc[0]
    print(f"Player: {sample_qb['Player_Name']} ({sample_qb['Year']})")
    print(f"AV: {sample_qb['AV']}")
    print(f"POVR: {sample_qb['POVR']}")
    print(f"PTHP: {sample_qb['PTHP']}")
    print(f"PTAS: {sample_qb['PTAS']}")
    print(f"PTAM: {sample_qb['PTAM']}")

if __name__ == "__main__":
    main()
