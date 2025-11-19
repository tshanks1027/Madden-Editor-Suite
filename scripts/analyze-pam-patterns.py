import pandas as pd
import re

all_players = pd.read_csv('C:/Users/tshan/Documents/Dev/madden-editor-suite/data/lookups/ALL_PLAYER_LOOKUP.csv')
pid_mapping = pd.read_csv('C:/Users/tshan/Documents/Dev/madden-editor-suite/data/lookups/PID_Portrait_Mapping.csv')

print('=== PAM NAMING PATTERN ANALYSIS ===\n')

# Filter to rows with both Portrait and PAM
valid_pam = pid_mapping[(pid_mapping['PAM'].notna()) & (pid_mapping['PAM'] != '') & (pid_mapping['PAM'] != '0')]
print(f'Rows with valid PAM: {len(valid_pam)}\n')

# Show samples to find pattern
print('Sample Portrait -> PAM mappings:')
for _, row in valid_pam.head(30).iterrows():
    print(f'  PID={row["PID"]:6.0f}  Portrait={row["Portrait"]:40s}  PAM={row["PAM"]}')

# Check if there's a pattern between Portrait and PAM
print('\n\nPattern Analysis:')
print('Looking for relationships between Portrait (PLPO) and PAM...\n')

# Try to extract patterns
patterns = {
    'same_name': 0,  # Portrait name matches PAM name
    'lastname_firstname': 0,  # plpo_LastnameFirstname -> LastnameFirstname_XXXXX
    'firstname_lastname': 0,  # plpo_FirstnameLast -> FirstnameLast_XXXXX
    'generic': 0,  # plpo_generic_XXX
    'no_pattern': 0
}

for _, row in valid_pam.iterrows():
    portrait = str(row['Portrait']).lower()
    pam = str(row['PAM']).lower()

    # Remove plpo_ prefix if present
    portrait_clean = portrait.replace('plpo_', '')

    # Check if PAM starts with portrait name
    if portrait_clean in pam or pam.startswith(portrait_clean.split('_')[0]):
        patterns['lastname_firstname'] += 1
    elif 'generic' in portrait:
        patterns['generic'] += 1
    else:
        patterns['no_pattern'] += 1

print('Pattern Distribution:')
for pattern, count in patterns.items():
    print(f'  {pattern:20s}: {count}')

# Check ALL_PLAYER_LOOKUP for additional patterns
print('\n\nALL_PLAYER_LOOKUP Portrait -> PAM patterns:')
valid_all = all_players[(all_players['PAM'].notna()) & (all_players['PAM'] != '') & (all_players['PLPO'].notna())]
print(f'Rows with both PLPO and PAM: {len(valid_all)}\n')

print('Sample PLPO -> PAM mappings from ALL_PLAYER_LOOKUP:')
for _, row in valid_all.head(20).iterrows():
    name = f"{row.get('First Name', '')} {row.get('Last Name', '')}"
    plpo = row.get('PLPO', '')
    pam = row.get('PAM', '')
    print(f'  {name:30s}  PLPO={plpo:40s}  PAM={pam}')

# Try to derive a pattern
print('\n\nPattern Detection:')
print('Checking if PAM = LastnameFirstname_XXXXX format...')
matches = 0
for _, row in valid_all.iterrows():
    first = str(row.get('First Name', '')).replace(' ', '').replace("'", "").replace('-', '')
    last = str(row.get('Last Name', '')).replace(' ', '').replace("'", "").replace('-', '')
    pam = str(row.get('PAM', '')).lower()

    expected_pattern = f"{last}{first}_".lower()
    if pam.startswith(expected_pattern):
        matches += 1

print(f'  Matches LastnameFirstname_XXXXX: {matches}/{len(valid_all)} ({matches/len(valid_all)*100:.1f}%)')

print('\n=== ANALYSIS COMPLETE ===')
