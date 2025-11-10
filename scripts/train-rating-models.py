"""
ML Training Script for Historical Rating Generation

This script:
1. Loads training data per position group from modern rosters (2002-2024)
2. Trains K-Means clustering to discover 8-12 natural archetypes per position
3. Trains Random Forest to predict OVR from [AV, Height, Weight, Age, etc.]
4. Saves trained models (pickle) for each position group
5. Generates archetype analysis reports
"""

import pandas as pd
import numpy as np
from pathlib import Path
from sklearn.cluster import KMeans
from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, r2_score
import pickle
import json

# Paths
BASE_DIR = Path('.')
TRAINING_DIR = BASE_DIR / 'data' / 'training'
MODELS_DIR = BASE_DIR / 'data' / 'models'

# Create models directory
MODELS_DIR.mkdir(parents=True, exist_ok=True)

# Position groups
POSITION_GROUPS = ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'DB', 'K']

# Number of archetypes per position
N_ARCHETYPES = {
    'QB': 8,   # Field General, Scrambler, Strong Arm, Accurate, Improviser, etc.
    'RB': 10,  # Power Back, Speed Back, Elusive, Receiving, Bruiser, etc.
    'WR': 10,  # Deep Threat, Possession, Route Runner, Physical, Slot, etc.
    'TE': 5,   # Blocking TE, Receiving TE, Balanced Elite, Route Runner, Move TE
    'OL': 8,   # Pass Protector, Run Blocker, Balanced, Power, Finesse, etc.
    'DL': 10,  # Power Rusher, Speed Rusher, Run Stopper, Balanced, etc.
    'LB': 10,  # Coverage LB, Run Stopper, Pass Rusher, Balanced, etc.
    'DB': 10,  # Man Coverage, Zone, Ball Hawk, Physical, Speed, etc.
    'K': 3     # Power, Accurate, Balanced
}

def get_clustering_features(position_group):
    """Select features for clustering by position group"""

    feature_sets = {
        'QB': ['PSPD', 'PACC', 'PAGI', 'PSTR', 'PTHP', 'PTAS', 'PTAM', 'PTAD', 'PTUP', 'PPLA', 'PTOR'],
        'RB': ['PSPD', 'PACC', 'PAGI', 'PSTR', 'PCTH', 'PCAR', 'PBTK', 'PTRK', 'PCOD', 'PBCV'],
        'WR': ['PSPD', 'PACC', 'PAGI', 'PCTH', 'PSPC', 'PCIT', 'PSRR', 'PMRR', 'PDRR', 'PREL'],
        'TE': [
            # Receiving features
            'PSPD', 'PACC', 'PAGI', 'PCTH', 'PSPC', 'PCIT', 'PSRR', 'PMRR', 'PDRR', 'PREL',
            # Blocking features
            'PSTR', 'PRBK', 'PPBK', 'PIBL', 'PRBP', 'PRBF', 'PPBP', 'PPBF'
        ],
        'OL': ['PSPD', 'PAGI', 'PSTR', 'PRBK', 'PPBK', 'PIBL', 'PRBP', 'PRBF', 'PPBP', 'PPBF'],
        'DL': ['PSPD', 'PACC', 'PAGI', 'PSTR', 'PTAK', 'PPWM', 'PFNM', 'PBSH', 'PPUR'],
        'LB': ['PSPD', 'PACC', 'PAGI', 'PSTR', 'PTAK', 'PBSH', 'PPUR', 'PPRC', 'PMCV', 'PZCV'],
        'DB': ['PSPD', 'PACC', 'PAGI', 'PCTH', 'PMCV', 'PZCV', 'PPRS', 'PPRC', 'PJMP'],
        'K': ['PKPW', 'PKAC']
    }

    return feature_sets.get(position_group, [])

def get_ovr_features():
    """Features for OVR prediction (available in historical data)"""
    return ['AV', 'Height', 'Weight', 'Age', 'Years_Pro', 'Games', 'Games_Started', 'wAV', 'AP1', 'PB']

def train_position_group(position_group):
    """Train K-Means and Random Forest for a position group"""

    print(f"\n{'='*80}")
    print(f"TRAINING: {position_group}")
    print('='*80)

    # Load training data
    training_file = TRAINING_DIR / f'{position_group}_training.csv'
    if not training_file.exists():
        print(f"  ERROR: Training file not found: {training_file}")
        return None

    df_train = pd.read_csv(training_file)
    print(f"  Loaded {len(df_train)} training samples")

    # Get features
    clustering_features = get_clustering_features(position_group)
    ovr_features = get_ovr_features()

    # Check for missing features
    missing_cluster_features = [f for f in clustering_features if f not in df_train.columns]
    missing_ovr_features = [f for f in ovr_features if f not in df_train.columns]

    if missing_cluster_features:
        print(f"  WARNING: Missing clustering features: {missing_cluster_features}")
        clustering_features = [f for f in clustering_features if f in df_train.columns]

    if missing_ovr_features:
        print(f"  WARNING: Missing OVR features: {missing_ovr_features}")
        ovr_features = [f for f in ovr_features if f in df_train.columns]

    if not clustering_features or not ovr_features:
        print(f"  ERROR: Insufficient features for training")
        return None

    # Prepare clustering data
    X_cluster = df_train[clustering_features].fillna(0).values

    # Standardize for clustering
    scaler_cluster = StandardScaler()
    X_cluster_scaled = scaler_cluster.fit_transform(X_cluster)

    # Train K-Means
    n_clusters = N_ARCHETYPES.get(position_group, 8)
    print(f"\n  Training K-Means (k={n_clusters})...")

    kmeans = KMeans(
        n_clusters=n_clusters,
        init='k-means++',
        n_init=10,
        max_iter=300,
        random_state=42
    )
    clusters = kmeans.fit_predict(X_cluster_scaled)

    # Add cluster assignments to dataframe
    df_train['Cluster'] = clusters

    # Analyze clusters
    print(f"\n  Archetype Discovery:")
    archetype_stats = []

    for cluster_id in range(n_clusters):
        cluster_mask = df_train['Cluster'] == cluster_id
        cluster_df = df_train[cluster_mask]

        # Calculate mean stats for this archetype
        mean_stats = cluster_df[clustering_features + ['POVR']].mean().to_dict()

        # Count players
        n_players = len(cluster_df)

        # Find representative players (closest to centroid)
        cluster_data = X_cluster_scaled[cluster_mask]
        centroid = kmeans.cluster_centers_[cluster_id]
        distances = np.linalg.norm(cluster_data - centroid, axis=1)
        closest_idx = np.argmin(distances)
        rep_player = cluster_df.iloc[closest_idx]

        archetype_stats.append({
            'cluster_id': int(cluster_id),
            'n_players': int(n_players),
            'mean_ovr': float(mean_stats.get('POVR', 0)),
            'mean_stats': {k: float(v) for k, v in mean_stats.items()},
            'representative': {
                'name': f"{rep_player.get('First_Name', '')} {rep_player.get('Last_Name', '')}",
                'year': int(rep_player.get('Year', 0)),
                'ovr': int(rep_player.get('POVR', 0))
            }
        })

        print(f"    Archetype {cluster_id}: {n_players} players, "
              f"Avg OVR={mean_stats.get('POVR', 0):.1f}, "
              f"Rep: {rep_player.get('First_Name', '')} {rep_player.get('Last_Name', '')} "
              f"({rep_player.get('Year', '')}, {rep_player.get('POVR', '')} OVR)")

    # Prepare OVR prediction data
    print(f"\n  Training Random Forest for OVR prediction...")
    X_ovr = df_train[ovr_features].fillna(0).values
    y_ovr = df_train['POVR'].values

    # Split for evaluation
    X_train, X_test, y_train, y_test = train_test_split(
        X_ovr, y_ovr, test_size=0.2, random_state=42
    )

    # Standardize
    scaler_ovr = StandardScaler()
    X_train_scaled = scaler_ovr.fit_transform(X_train)
    X_test_scaled = scaler_ovr.transform(X_test)

    # Train Random Forest
    rf_model = RandomForestRegressor(
        n_estimators=100,
        max_depth=20,
        min_samples_split=10,
        min_samples_leaf=5,
        random_state=42,
        n_jobs=-1
    )
    rf_model.fit(X_train_scaled, y_train)

    # Evaluate
    y_pred_train = rf_model.predict(X_train_scaled)
    y_pred_test = rf_model.predict(X_test_scaled)

    mae_train = mean_absolute_error(y_train, y_pred_train)
    mae_test = mean_absolute_error(y_test, y_pred_test)
    r2_train = r2_score(y_train, y_pred_train)
    r2_test = r2_score(y_test, y_pred_test)

    print(f"  Training MAE: {mae_train:.2f}, R²: {r2_train:.3f}")
    print(f"  Test MAE: {mae_test:.2f}, R²: {r2_test:.3f}")

    # Feature importance
    feature_importance = sorted(
        zip(ovr_features, rf_model.feature_importances_),
        key=lambda x: x[1],
        reverse=True
    )
    print(f"\n  Top 5 OVR Predictors:")
    for feat, importance in feature_importance[:5]:
        print(f"    {feat}: {importance:.3f}")

    # Save models
    model_package = {
        'position_group': position_group,
        'kmeans': kmeans,
        'rf_model': rf_model,
        'scaler_cluster': scaler_cluster,
        'scaler_ovr': scaler_ovr,
        'clustering_features': clustering_features,
        'ovr_features': ovr_features,
        'n_clusters': n_clusters,
        'archetype_stats': archetype_stats,
        'performance': {
            'mae_train': float(mae_train),
            'mae_test': float(mae_test),
            'r2_train': float(r2_train),
            'r2_test': float(r2_test)
        }
    }

    # Save pickle
    model_file = MODELS_DIR / f'{position_group}_models.pkl'
    with open(model_file, 'wb') as f:
        pickle.dump(model_package, f)
    print(f"\n  Saved models to {model_file}")

    # Save archetype analysis as JSON
    analysis_file = MODELS_DIR / f'{position_group}_archetypes.json'
    with open(analysis_file, 'w') as f:
        json.dump({
            'position_group': position_group,
            'n_archetypes': n_clusters,
            'archetypes': archetype_stats,
            'performance': model_package['performance']
        }, f, indent=2)
    print(f"  Saved archetype analysis to {analysis_file}")

    return model_package

def main():
    """Main training pipeline"""

    print("="*80)
    print("ML MODEL TRAINING FOR HISTORICAL RATING GENERATION")
    print("="*80)
    print()
    print(f"Training models for {len(POSITION_GROUPS)} position groups...")
    print()

    results = {}

    for position_group in POSITION_GROUPS:
        try:
            result = train_position_group(position_group)
            if result:
                results[position_group] = result
        except Exception as e:
            print(f"\n  ERROR training {position_group}: {e}")
            import traceback
            traceback.print_exc()

    # Summary
    print("\n" + "="*80)
    print("TRAINING COMPLETE")
    print("="*80)
    print(f"\nSuccessfully trained {len(results)}/{len(POSITION_GROUPS)} position groups")
    print(f"Models saved to: {MODELS_DIR}")

    print("\nModel Performance Summary:")
    for pos, result in results.items():
        perf = result['performance']
        print(f"  {pos}: Test MAE={perf['mae_test']:.2f}, R²={perf['r2_test']:.3f}")

    print("\nNext steps:")
    print("  1. Review archetype JSONs in data/models/")
    print("  2. Run generate-historical-ratings.py to apply models")
    print("  3. Run review-flagged-players.py to review uncertain ratings")

if __name__ == '__main__':
    main()
