"""
Historical Rating Generation Script

This script:
1. Loads trained ML models (K-Means + Random Forest) for each position
2. Applies models to historical players (1970-2001)
3. Predicts OVR from available data (wAV, Height, Weight, Age, PB, AP1)
4. Assigns archetypes based on clustering
5. Generates attribute distributions from archetype mean stats
6. Applies era adjustments (-3 SPD for <1980, -2 for <1990)
7. Calculates confidence scores based on cluster distance + data completeness
8. Flags uncertain players for manual review
9. Updates ROSTER_lookup_historical.csv with generated ratings
"""

import pandas as pd
import numpy as np
from pathlib import Path
import pickle
import json
import sys
from datetime import datetime
from sklearn.preprocessing import StandardScaler

# Paths
BASE_DIR = Path('.')
TRAINING_DIR = BASE_DIR / 'data' / 'training'
MODELS_DIR = BASE_DIR / 'data' / 'models'
LOOKUPS_DIR = BASE_DIR / 'data' / 'lookups'
OUTPUT_FILE = LOOKUPS_DIR / 'ROSTER_lookup_historical.csv'
CHECKPOINT_FILE = MODELS_DIR / 'rating_generation_checkpoint.json'

# Position groups
POSITION_GROUPS = ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'DB', 'K']

# Stat ranges for generation (min, max)
STAT_RANGES = {
    # Speed/Agility
    'PSPD': (55, 99), 'PACC': (70, 99), 'PAGI': (65, 99), 'PCOD': (65, 99),
    # Strength/Physical
    'PSTR': (50, 99), 'PJMP': (60, 99), 'PSTA': (85, 99), 'PINJ': (85, 99), 'PTGH': (75, 99),
    # Awareness
    'PAWR': (40, 99), 'PPRC': (40, 99),
    # Offensive Skills
    'PCTH': (40, 99), 'PCAR': (50, 99), 'PBTK': (50, 99), 'PTRK': (50, 99),
    'PBCV': (50, 99), 'PSTF': (40, 99), 'PSPM': (40, 99), 'PJUM': (40, 99),
    'PSPC': (40, 99), 'PCIT': (40, 99), 'PSRR': (40, 99), 'PMRR': (40, 99),
    'PDRR': (40, 99), 'PREL': (40, 99),
    # QB Skills
    'PTHP': (70, 99), 'PTAS': (40, 99), 'PTAM': (40, 99), 'PTAD': (40, 99),
    'PTUP': (40, 99), 'PPLA': (40, 99), 'PTOR': (40, 99), 'PBRS': (40, 99),
    # Blocking
    'PRBK': (40, 99), 'PPBK': (40, 99), 'PIBL': (40, 99), 'PLDB': (40, 99),
    'PRBP': (40, 99), 'PRBF': (40, 99), 'PPBP': (40, 99), 'PPBF': (40, 99),
    # Defense
    'PTAK': (40, 99), 'PPWM': (40, 99), 'PFNM': (40, 99), 'PBSH': (40, 99),
    'PPUR': (40, 99), 'PMCV': (40, 99), 'PZCV': (40, 99), 'PHTP': (50, 99),
    'PPRS': (40, 99),
    # Kicking
    'PKPW': (60, 99), 'PKAC': (60, 99)
}

def load_checkpoint():
    """Load checkpoint if it exists"""
    if CHECKPOINT_FILE.exists():
        with open(CHECKPOINT_FILE, 'r') as f:
            return json.load(f)
    return None

def save_checkpoint(completed_positions, total_processed):
    """Save checkpoint after completing a position group"""
    checkpoint = {
        'completed_positions': completed_positions,
        'total_processed': total_processed,
        'timestamp': datetime.now().isoformat(),
        'last_position': completed_positions[-1] if completed_positions else None
    }
    with open(CHECKPOINT_FILE, 'w') as f:
        json.dump(checkpoint, f, indent=2)
    print(f"\n[CHECKPOINT] Saved progress: {len(completed_positions)}/9 position groups completed")
    sys.stdout.flush()

def load_models(position_group):
    """Load trained models for a position group"""
    model_file = MODELS_DIR / f'{position_group}_models.pkl'
    if not model_file.exists():
        return None

    with open(model_file, 'rb') as f:
        return pickle.load(f)

def calculate_confidence(player_data, cluster_distance, archetype_stats):
    """Calculate confidence score (0-100%) based on cluster distance and data completeness"""

    # Distance component (closer to centroid = higher confidence)
    # Normalize distance to 0-1 scale (assume max distance ~10 std devs)
    distance_score = max(0, min(1, 1 - (cluster_distance / 10)))

    # Data completeness component
    completeness_score = 1.0
    if pd.isna(player_data.get('wAV', 0)) or player_data.get('wAV', 0) == 0:
        completeness_score -= 0.4  # No career stats is big penalty
    if pd.isna(player_data.get('Height', 0)) or player_data.get('Height', 0) == 0:
        completeness_score -= 0.2
    if pd.isna(player_data.get('Weight', 0)) or player_data.get('Weight', 0) == 0:
        completeness_score -= 0.2
    if pd.isna(player_data.get('Age', 0)) or player_data.get('Age', 0) == 0:
        completeness_score -= 0.1

    completeness_score = max(0, completeness_score)

    # Combined confidence (weighted average)
    confidence = int(100 * (0.7 * distance_score + 0.3 * completeness_score))

    return max(0, min(100, confidence))

def should_flag_for_review(player_data, confidence, predicted_ovr):
    """Determine if player should be flagged for manual review"""

    # Low confidence
    if confidence < 70:
        return True, "Low confidence"

    # High wAV (star players deserve attention)
    if player_data.get('wAV', 0) >= 100:  # Approximate All-Pro level
        return True, "High wAV (star player)"

    # Pro Bowl/All-Pro selections
    if player_data.get('PB', 0) >= 3 or player_data.get('AP1', 0) >= 1:
        return True, "Multiple accolades"

    # Unusual physical profile
    height = player_data.get('Height', 72)
    weight = player_data.get('Weight', 200)
    position_group = player_data.get('Position_Group', '')

    if position_group == 'QB' and height > 80:  # 6'8"+ QB
        return True, "Unusual height for QB"
    if position_group in ['RB', 'WR', 'DB'] and weight > 250:
        return True, "Heavy for position"
    if position_group in ['OL', 'DL'] and weight < 250:
        return True, "Light for position"

    return False, ""

def apply_era_adjustments(attributes, year):
    """Apply era adjustments to speed ratings"""

    adjustments = {}

    # Speed penalty for older eras (training/nutrition)
    if year < 1980:
        speed_penalty = -3
    elif year < 1990:
        speed_penalty = -2
    else:
        speed_penalty = 0

    if speed_penalty != 0:
        for attr in ['PSPD', 'PACC', 'PAGI']:
            if attr in attributes:
                original = attributes[attr]
                adjusted = max(40, original + speed_penalty)  # Floor at 40
                adjustments[attr] = (original, adjusted)
                attributes[attr] = adjusted

    return adjustments

def generate_attributes_from_archetype(archetype_stats, position_group):
    """Generate full attribute set from archetype mean stats with variance"""

    mean_stats = archetype_stats['mean_stats']
    attributes = {}

    # For each attribute in the mean stats, add some variance (±3 points)
    for attr, mean_value in mean_stats.items():
        if attr in STAT_RANGES and attr != 'POVR':
            min_val, max_val = STAT_RANGES[attr]

            # Add random variance
            variance = np.random.randint(-3, 4)  # -3 to +3
            value = int(mean_value + variance)

            # Clamp to valid range
            value = max(min_val, min(max_val, value))

            attributes[attr] = value

    # Fill in missing base attributes with reasonable defaults
    base_attributes = {
        'PSTA': 90, 'PINJ': 90, 'PTGH': 85, 'PAWR': 65
    }

    for attr, default in base_attributes.items():
        if attr not in attributes:
            attributes[attr] = default

    return attributes

def process_position_group(position_group):
    """Generate ratings for all players in a position group"""

    print(f"\n{'='*80}")
    print(f"PROCESSING: {position_group}")
    print('='*80)
    sys.stdout.flush()

    # Load models
    models = load_models(position_group)
    if not models:
        print(f"  ERROR: No models found for {position_group}")
        sys.stdout.flush()
        return None

    # Load historical data
    historical_file = TRAINING_DIR / f'{position_group}_historical.csv'
    if not historical_file.exists():
        print(f"  ERROR: No historical data found for {position_group}")
        sys.stdout.flush()
        return None

    df = pd.read_csv(historical_file)
    print(f"  Loaded {len(df)} historical players")
    sys.stdout.flush()

    # Prepare features for prediction
    ovr_features = models['ovr_features']
    clustering_features = models['clustering_features']

    # Check available features
    available_ovr_features = [f for f in ovr_features if f in df.columns]
    print(f"  OVR prediction features: {len(available_ovr_features)}/{len(ovr_features)}")
    sys.stdout.flush()

    if len(available_ovr_features) < 3:
        print(f"  ERROR: Insufficient features for prediction")
        sys.stdout.flush()
        return None

    # Prepare data
    X_ovr = df[available_ovr_features].fillna(0).values

    # Standardize using trained scaler
    X_ovr_scaled = models['scaler_ovr'].transform(X_ovr)

    # Predict OVR
    print(f"  Predicting OVR...")
    sys.stdout.flush()
    predicted_ovr = models['rf_model'].predict(X_ovr_scaled)
    predicted_ovr = np.clip(predicted_ovr, 40, 99).astype(int)  # Clamp to valid range

    # For clustering, we need the actual attribute values (which we don't have yet)
    # So we'll assign archetypes based on predicted OVR ranges for now
    # This is a simplification - ideally we'd have some attributes to cluster on
    print(f"  Assigning archetypes based on OVR ranges...")
    sys.stdout.flush()

    # Load archetype stats
    archetype_file = MODELS_DIR / f'{position_group}_archetypes.json'
    with open(archetype_file, 'r') as f:
        archetype_data = json.load(f)

    archetypes = sorted(archetype_data['archetypes'], key=lambda x: x['mean_ovr'])

    # Assign archetype based on predicted OVR
    assigned_archetypes = []
    for ovr in predicted_ovr:
        # Find closest archetype by OVR
        closest_archetype = min(archetypes, key=lambda x: abs(x['mean_ovr'] - ovr))
        assigned_archetypes.append(closest_archetype['cluster_id'])

    # Generate full ratings
    print(f"  Generating full attribute sets...")
    sys.stdout.flush()

    results = []
    flagged_count = 0

    for idx, row in df.iterrows():
        player_ovr = predicted_ovr[idx]
        archetype_id = assigned_archetypes[idx]
        archetype = archetypes[archetype_id]

        # Generate attributes from archetype
        attributes = generate_attributes_from_archetype(archetype, position_group)

        # Apply era adjustments
        year = row.get('Year', 2000)
        era_adjustments = apply_era_adjustments(attributes, year)

        # Calculate confidence (using dummy distance since we didn't cluster)
        # Base confidence on data completeness and OVR deviation from archetype
        ovr_deviation = abs(player_ovr - archetype['mean_ovr'])
        pseudo_distance = ovr_deviation / 10.0  # Normalize

        confidence = calculate_confidence(row, pseudo_distance, archetype)

        # Check if needs review
        needs_review, review_reason = should_flag_for_review(
            {**row, 'Position_Group': position_group, 'wAV': row.get('wAV', 0)},
            confidence,
            player_ovr
        )

        if needs_review:
            flagged_count += 1

        # Compile result
        result = {
            'index': idx,
            'POVR': int(player_ovr),
            'Archetype': f"{position_group}_Arch{archetype_id}",
            'Confidence': confidence,
            'NeedsReview': needs_review,
            'ReviewReason': review_reason if needs_review else '',
            **attributes
        }

        results.append(result)

    print(f"  Generated ratings for {len(results)} players")
    print(f"  Average OVR: {np.mean([r['POVR'] for r in results]):.1f}")
    print(f"  Average Confidence: {np.mean([r['Confidence'] for r in results]):.1f}%")
    print(f"  Flagged for review: {flagged_count} ({100*flagged_count/len(results):.1f}%)")
    sys.stdout.flush()

    return results

def main():
    """Main rating generation pipeline"""

    print("="*80)
    print("HISTORICAL RATING GENERATION")
    print("="*80)
    print()
    sys.stdout.flush()

    # Check for existing checkpoint
    checkpoint = load_checkpoint()
    completed_positions = []
    total_processed = 0

    if checkpoint:
        completed_positions = checkpoint.get('completed_positions', [])
        total_processed = checkpoint.get('total_processed', 0)
        print(f"[RESUME] Found checkpoint from {checkpoint['timestamp']}")
        print(f"[RESUME] Already completed: {', '.join(completed_positions)}")
        print(f"[RESUME] Total players processed so far: {total_processed}")
        print()
        sys.stdout.flush()
    else:
        print("[NEW RUN] No checkpoint found, starting from scratch")
        print()
        sys.stdout.flush()

    # Load complete historical dataset
    print("Loading complete historical dataset...")
    sys.stdout.flush()
    df_historical = pd.read_csv(OUTPUT_FILE)
    print(f"  {len(df_historical)} total historical players")
    sys.stdout.flush()

    # Process each position group
    all_results = {}

    for position_group in POSITION_GROUPS:
        # Skip if already completed
        if position_group in completed_positions:
            print(f"\n[SKIP] {position_group} already completed (from checkpoint)")
            sys.stdout.flush()
            continue

        try:
            results = process_position_group(position_group)
            if results:
                all_results[position_group] = results
                completed_positions.append(position_group)
                total_processed += len(results)

                # Save checkpoint after each position group
                save_checkpoint(completed_positions, total_processed)

        except Exception as e:
            print(f"\n  ERROR processing {position_group}: {e}")
            sys.stdout.flush()
            import traceback
            traceback.print_exc()

            # Save checkpoint even on error so we don't lose progress
            save_checkpoint(completed_positions, total_processed)
            print(f"\n[CHECKPOINT] Progress saved. You can resume by running this script again.")
            sys.stdout.flush()
            return

    # Apply results back to dataframe
    print("\n" + "="*80)
    print("APPLYING GENERATED RATINGS")
    print("="*80)
    sys.stdout.flush()

    for position_group, results in all_results.items():
        print(f"\nApplying {position_group} ratings...")
        sys.stdout.flush()

        historical_file = TRAINING_DIR / f'{position_group}_historical.csv'
        df_pos = pd.read_csv(historical_file)

        for result in results:
            idx = result['index']

            # Find matching row in main dataframe
            # Match by Year, First_Name, Last_Name, Position
            row = df_pos.iloc[idx]

            mask = (
                (df_historical['Year'] == row['Year']) &
                (df_historical['First_Name'] == row['First_Name']) &
                (df_historical['Last_Name'] == row['Last_Name']) &
                (df_historical['Position'] == row['Position'])
            )

            matching_indices = df_historical[mask].index

            if len(matching_indices) > 0:
                main_idx = matching_indices[0]

                # Update POVR and metadata
                df_historical.at[main_idx, 'POVR'] = result['POVR']
                df_historical.at[main_idx, 'Archetype'] = result['Archetype']

                # Update all attributes
                for attr, value in result.items():
                    if attr.startswith('P') and attr not in ['POVR']:
                        if attr not in df_historical.columns:
                            df_historical[attr] = 0
                        df_historical.at[main_idx, attr] = value

    # Save updated historical roster
    print(f"\nSaving updated historical roster to {OUTPUT_FILE}...")
    sys.stdout.flush()
    df_historical.to_csv(OUTPUT_FILE, index=False)

    # Delete checkpoint file since we completed successfully
    if CHECKPOINT_FILE.exists():
        CHECKPOINT_FILE.unlink()
        print(f"[CLEANUP] Removed checkpoint file")
        sys.stdout.flush()

    # Generate summary report
    print("\n" + "="*80)
    print("GENERATION COMPLETE")
    print("="*80)
    sys.stdout.flush()

    total_generated = sum(len(results) for results in all_results.values())
    total_flagged = sum(
        sum(1 for r in results if r['NeedsReview'])
        for results in all_results.values()
    )

    print(f"\nTotal players rated: {total_generated}")
    print(f"Total flagged for review: {total_flagged} ({100*total_flagged/total_generated:.1f}%)")
    sys.stdout.flush()

    print("\nPosition Group Summary:")
    for position_group in POSITION_GROUPS:
        if position_group in all_results:
            results = all_results[position_group]
            avg_ovr = np.mean([r['POVR'] for r in results])
            avg_conf = np.mean([r['Confidence'] for r in results])
            flagged = sum(1 for r in results if r['NeedsReview'])
            print(f"  {position_group}: {len(results)} players, "
                  f"Avg OVR={avg_ovr:.1f}, "
                  f"Avg Conf={avg_conf:.1f}%, "
                  f"Flagged={flagged}")
    sys.stdout.flush()

    print(f"\nUpdated file: {OUTPUT_FILE}")
    print("\nNext step: Run review-flagged-players.py to review uncertain ratings")
    sys.stdout.flush()

if __name__ == '__main__':
    main()
