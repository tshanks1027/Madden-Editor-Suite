import pandas as pd

roster = pd.read_csv('C:/Users/tshan/Documents/Dev/madden-editor-suite/data/lookups/ROSTER_lookup.csv', low_memory=False)
all_players = pd.read_csv('C:/Users/tshan/Documents/Dev/madden-editor-suite/data/lookups/ALL_PLAYER_LOOKUP.csv')
pid_mapping = pd.read_csv('C:/Users/tshan/Documents/Dev/madden-editor-suite/data/lookups/PID_Portrait_Mapping.csv')

print('=== PID/PAM ANALYSIS ===\n')

# ROSTER_lookup analysis
print('1. ROSTER_lookup.csv')
print(f'   Total players: {len(roster)}')
pid_zero = (roster['PID'] == 0) | (roster['PID'] == 0.0) | roster['PID'].isna()
print(f'   PID = 0 or missing: {pid_zero.sum()} ({pid_zero.sum()/len(roster)*100:.1f}%)')

pam_zero = (roster['PAM'] == 0) | (roster['PAM'] == 0.0) | (roster['PAM'] == '0') | roster['PAM'].isna() | (roster['PAM'] == '')
print(f'   PAM = 0 or missing: {pam_zero.sum()} ({pam_zero.sum()/len(roster)*100:.1f}%)')

both_zero = pid_zero & pam_zero
print(f'   Both PID and PAM = 0: {both_zero.sum()} ({both_zero.sum()/len(roster)*100:.1f}%)')

# Check by year
print('\n   PID=0 by year:')
for year in sorted(roster['Year'].unique())[:10]:
    year_data = roster[roster['Year'] == year]
    year_pid_zero = ((year_data['PID'] == 0) | (year_data['PID'] == 0.0) | year_data['PID'].isna()).sum()
    print(f'     {year}: {year_pid_zero}/{len(year_data)} players ({year_pid_zero/len(year_data)*100:.1f}%)')

# ALL_PLAYER_LOOKUP analysis
print('\n2. ALL_PLAYER_LOOKUP.csv')
print(f'   Total players: {len(all_players)}')
pid_zero_all = (all_players['PID'] == 0) | (all_players['PID'] == 0.0) | all_players['PID'].isna()
print(f'   PID = 0 or missing: {pid_zero_all.sum()} ({pid_zero_all.sum()/len(all_players)*100:.1f}%)')

pam_zero_all = (all_players['PAM'] == 0) | (all_players['PAM'] == 0.0) | (all_players['PAM'] == '0') | all_players['PAM'].isna() | (all_players['PAM'] == '')
print(f'   PAM = 0 or missing: {pam_zero_all.sum()} ({pam_zero_all.sum()/len(all_players)*100:.1f}%)')

# PID_Portrait_Mapping analysis
print('\n3. PID_Portrait_Mapping.csv')
print(f'   Total mappings: {len(pid_mapping)}')

# Check for generic faces
generic_faces = pid_mapping[pid_mapping['Type'] == 'generic']
print(f'   Generic face mappings: {len(generic_faces)}')

# Show sample generic mappings
print('\n   Sample generic face mappings:')
for _, row in generic_faces.head(10).iterrows():
    print(f'     PID={row["PID"]:6.0f} Portrait={row["Portrait"]:30s} PAM={row["PAM"]}')

# Check highest PID used
max_pid_roster = roster['PID'].max()
max_pid_all = all_players['PID'].max()
max_pid_mapping = pid_mapping['PID'].max()
print(f'\n4. Highest PID values:')
print(f'   ROSTER_lookup: {max_pid_roster:.0f}')
print(f'   ALL_PLAYER_LOOKUP: {max_pid_all:.0f}')
print(f'   PID_Portrait_Mapping: {max_pid_mapping:.0f}')

# Suggest next PID to use for generic assignments
next_pid = int(max(max_pid_roster, max_pid_all, max_pid_mapping)) + 1
print(f'\n   Suggested next PID for generic assignments: {next_pid}')

print('\n=== ANALYSIS COMPLETE ===')
