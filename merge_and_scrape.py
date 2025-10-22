"""
Step 1: Merge PAM assets and HOF data into MASTER_LOOKUP
Step 2: Run scraper to fill ALL missing data
"""

import pandas as pd
import os

print("=" * 80)
print("STEP 1: MERGING PAM ASSETS AND HOF DATA")
print("=" * 80)

# File paths
DATA_DIR = r'C:\Users\tshan\OneDrive\Documents\Madden Files\KNuttZFranchiseSandBox\madden-editor-suite\data\lookups'
MASTER_FILE = os.path.join(DATA_DIR, 'MASTER_LOOKUP_FINAL.csv')
PAM_FILE = os.path.join(DATA_DIR, 'PAM_COMPLETE_Lookup.csv')
HOF_FILE = os.path.join(DATA_DIR, 'hof_lookup.csv')
OUTPUT_FILE = os.path.join(DATA_DIR, 'MASTER_LOOKUP_FINAL.csv')
BACKUP_FILE = os.path.join(DATA_DIR, 'MASTER_LOOKUP_FINAL_BACKUP.csv')

# Load files
print(f"\nLoading MASTER_LOOKUP from: {MASTER_FILE}")
master_df = pd.read_csv(MASTER_FILE)
print(f"[OK] Loaded {len(master_df)} entries from MASTER_LOOKUP")

print(f"\nLoading PAM data from: {PAM_FILE}")
pam_df = pd.read_csv(PAM_FILE)
print(f"[OK] Loaded {len(pam_df)} PAM assets")

print(f"\nLoading HOF data from: {HOF_FILE}")
hof_df = pd.read_csv(HOF_FILE)
print(f"[OK] Loaded {len(hof_df)} HOF entries")

# Backup original MASTER_LOOKUP
print(f"\nCreating backup: {BACKUP_FILE}")
master_df.to_csv(BACKUP_FILE, index=False)
print("[OK] Backup created")

# Merge PAM data
print("\n" + "=" * 80)
print("MERGING PAM ASSETS")
print("=" * 80)

pam_matches = 0
pam_updates = 0

for idx, pam_row in pam_df.iterrows():
    last_name = pam_row['Last Name']
    first_name = pam_row['First Name']
    asset_id = pam_row['Asset ID']
    pid = pam_row['PID']

    # Find matching player in MASTER_LOOKUP
    mask = (master_df['Last Name'] == last_name) & (master_df['First Name'] == first_name)
    matches = master_df[mask]

    if len(matches) > 0:
        pam_matches += 1
        # Update Player Assets ID if empty or missing
        for match_idx in matches.index:
            current_asset = master_df.at[match_idx, 'Player Assets ID']
            current_pid = master_df.at[match_idx, 'PhotoID']

            if pd.isna(current_asset) or current_asset == '':
                master_df.at[match_idx, 'Player Assets ID'] = asset_id
                pam_updates += 1
                print(f"  [+] {first_name} {last_name}: Added asset '{asset_id}'")

            # Also update PID if missing
            if pd.isna(current_pid) or current_pid == '':
                master_df.at[match_idx, 'PhotoID'] = pid
                print(f"    + Added PID {pid}")

print(f"\n[OK] PAM Merge Complete:")
print(f"  - Matched players: {pam_matches}/{len(pam_df)}")
print(f"  - Assets added: {pam_updates}")

# Add HOF column
print("\n" + "=" * 80)
print("ADDING HOF COLUMN")
print("=" * 80)

# Add isHOF column if it doesn't exist
if 'isHOF' not in master_df.columns:
    master_df['isHOF'] = False
    print("[OK] Created isHOF column")

hof_matches = 0

for idx, hof_row in hof_df.iterrows():
    # HOF lookup should have Player name or similar field
    # Try to match by name
    if 'Player' in hof_row:
        player_name = hof_row['Player']
        # Split into first/last
        parts = player_name.split()
        if len(parts) >= 2:
            first_name = parts[0]
            last_name = ' '.join(parts[1:])

            mask = (master_df['Last Name'] == last_name) & (master_df['First Name'] == first_name)
            matches = master_df[mask]

            if len(matches) > 0:
                hof_matches += 1
                for match_idx in matches.index:
                    master_df.at[match_idx, 'isHOF'] = True
                print(f"  [OK] {first_name} {last_name}: Marked as HOF")

print(f"\n[OK] HOF Merge Complete:")
print(f"  - HOF players matched: {hof_matches}/{len(hof_df)}")

# Save merged file
print(f"\n" + "=" * 80)
print("SAVING MERGED DATA")
print("=" * 80)
print(f"Saving to: {OUTPUT_FILE}")
master_df.to_csv(OUTPUT_FILE, index=False)
print("[OK] MASTER_LOOKUP updated with PAM and HOF data")

print("\n" + "=" * 80)
print("STEP 1 COMPLETE!")
print("=" * 80)
print(f"Next: Run the scraper to fill missing data")
print(f"Backup saved at: {BACKUP_FILE}")
