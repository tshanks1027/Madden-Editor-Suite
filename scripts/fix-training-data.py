"""
Fix Height field in training CSV files - convert from strings like '6\'2"' to numeric inches
"""

import pandas as pd
import re
from pathlib import Path

TRAINING_DIR = Path('data/training')
POSITION_GROUPS = ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'DB', 'K']

def parse_height_to_inches(height_str):
    """Convert height string like '6'2"' to inches"""
    if pd.isna(height_str):
        return 0

    # Already numeric
    if isinstance(height_str, (int, float)):
        return int(height_str)

    # Parse string format
    height_str = str(height_str).strip()
    if not height_str or height_str == '0':
        return 0

    # Match patterns like 6'2" or 6-2
    match = re.match(r"(\d+)['\-](\d+)", height_str)
    if match:
        feet, inches = match.groups()
        return int(feet) * 12 + int(inches)

    # Try to convert directly
    try:
        return int(float(height_str))
    except:
        return 0

print("Fixing Height field in training CSV files...")
print()

for position_group in POSITION_GROUPS:
    print(f"Processing {position_group}...")

    # Fix training file
    training_file = TRAINING_DIR / f'{position_group}_training.csv'
    if training_file.exists():
        df = pd.read_csv(training_file)
        if 'Height' in df.columns:
            before = df['Height'].iloc[0] if len(df) > 0 else None
            df['Height'] = df['Height'].apply(parse_height_to_inches)
            after = df['Height'].iloc[0] if len(df) > 0 else None
            df.to_csv(training_file, index=False)
            print(f"  Training: {len(df)} rows, Height: {before} -> {after}")

    # Fix historical file
    historical_file = TRAINING_DIR / f'{position_group}_historical.csv'
    if historical_file.exists():
        df = pd.read_csv(historical_file)
        if 'Height' in df.columns:
            before = df['Height'].iloc[0] if len(df) > 0 else None
            df['Height'] = df['Height'].apply(parse_height_to_inches)
            after = df['Height'].iloc[0] if len(df) > 0 else None
            df.to_csv(historical_file, index=False)
            print(f"  Historical: {len(df)} rows, Height: {before} -> {after}")

print("\nDone! All Height fields converted to numeric inches.")
