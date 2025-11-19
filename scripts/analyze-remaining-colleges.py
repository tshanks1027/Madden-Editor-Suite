#!/usr/bin/env python3
"""
Re-analyze which colleges still need mapping after all the fixes
"""
import pandas as pd
from collections import Counter

# Read the official college list
college_lookup = pd.read_csv('data/lookups/college_lookup.csv')
madden_colleges = set(college_lookup['CollegeName'].str.strip().str.lower())

# Read all source files
roster_df = pd.read_csv('data/lookups/ROSTER_lookup.csv')
all_player_df = pd.read_csv('data/lookups/ALL_PLAYER_LOOKUP.csv')
future_draft_df = pd.read_csv('data/lookups/FutureDraft_Lookup_MERGED.csv')

# Combine all college entries
all_colleges = []
all_colleges.extend(roster_df['College'].dropna().tolist())
all_colleges.extend(all_player_df['College'].dropna().tolist())
all_colleges.extend(future_draft_df['College'].dropna().tolist())

# Count occurrences
college_counts = Counter(all_colleges)

# Abbreviation map from RosterGeneratorService.ts
abbreviation_map = {
    'Southern California': 'USC',
    'Louisiana State': 'LSU',
    'University of California Los Angeles': 'UCLA',
    'Penn St.': 'Penn State',
    'Ohio St.': 'Ohio State',
    'Bucks': 'Ohio State',
    'Mississippi': 'Ole Miss',
    'Brigham Young': 'BYU',
    'Texas Christian': 'TCU',
    'Boston Col.': 'Boston College',
    'Southern Methodist': 'SMU',
    'North Carolina State': 'NC State',
    'Louisiana Tech': 'LA Tech',
    'Utah St.': 'Utah State',
    'Iowa St.': 'Iowa State',
    'Central Florida': 'UCF',
    'Bowling Green': 'Bowling Green State',
    'Miami (OH)': 'Miami of Ohio',
    'Florida A&M': 'Florida A&M',
    'South Florida': 'USF',
    'Texas-El Paso': 'UTEP',
    'Kent St.': 'Kent State',
    'S.F. Austin': 'Stephen F. Austin',
    'Boise St.': 'Boise State',
    'La-Monroe': 'UL Monroe',
    'Western Carolina': 'W. Carolina',
    'Wash. St.': 'Washington State',
    'Texas St.': 'Texas State',
    'Middle Tenn. St.': 'Middle Tennessee State',
    'Bethune-Cookman': 'Beth Cookman',
    'Florida International': 'FIU',
    'Florida Atlantic': 'FAU',
    'Ball St.': 'Ball State',
    'Weber St.': 'Weber State',
    'Miss. Valley St.': 'Mississippi Valley State',
    'S.D. State': 'San Diego State',
    'Southern Mississippi': 'Southern Miss',
    'Ark-Pine Bluff': 'Arkansas Pine Bluff',
    'Western Kentucky': 'W. Kentucky',
    'Louisiana': 'UL Lafayette',
    'Louisiana-Monroe': 'UL Monroe',
    'Western Michigan': 'W. Michigan',
    'Appalach. St.': 'Appalachian State',
    'Nevada-Las Vegas': 'UNLV',
    'Pitt': 'Pittsburgh',
    'Pennsylvania': 'Penn',
    'Idaho St.': 'Idaho State',
    'J. Madison': 'James Madison',
    'Ga. Southern': 'Georgia Southern',
    'Eastern Wash.': 'Eastern Washington',
    'Elon': 'Elon University',
    'Ala-Birmingham': 'Alabama',
    'Mid Tenn St.': 'Middle Tennessee State',
    'Kutztown (PA)': 'Kutztown',
    'New Mex. Highlands': 'W. New Mexico',
    'New Mex. St.': 'New Mexico State',
    'Wichita St.': 'Wichita State',
    'Long Beach St.': 'Long Beach State',
    'Cal State-Northridge': 'Cal State Northridge',
    'Cal State-Fullerton': 'Cal State Bakersfield',
    'Cal Poly-San Luis Obispo': 'Cal Poly SLO',
    'California,San Diego St.': 'San Diego State',
    'Miami (FL)': 'Miami',
    'Lamar': 'Lamar University',
    'Southeastern Louisiana': 'SE Louisiana',
    'Lincoln (MO)': 'Nebraska-Kearney',
    'Miami Univ.': 'Miami',
    'Sacramento St.': 'Sacramento State',
    'Wisconsin—LaCrosse': 'UW La Crosse',
    'WisconsinâLaCrosse': 'UW La Crosse',
    'Catawba': 'Catawba College',
    'WVU': 'West Virginia',
    'VTech': 'Virginia Tech',
    'BGSU': 'Bowling Green State',
    'Pacific': 'Azusa Pacific'
}

# Find colleges that still need mapping
unmapped_colleges = []

for college, count in college_counts.items():
    college_clean = college.strip()

    # Handle comma-separated colleges (take second)
    if ',' in college_clean:
        parts = college_clean.split(',')
        college_clean = parts[1].strip() if len(parts) > 1 else parts[0].strip()

    # Check if mapped via abbreviation map
    if college_clean in abbreviation_map:
        mapped_name = abbreviation_map[college_clean]
        if mapped_name.lower() in madden_colleges:
            continue

    # Check if exists directly in Madden list
    if college_clean.lower() in madden_colleges:
        continue

    # Still unmapped
    unmapped_colleges.append((college_clean, count))

# Sort by count descending
unmapped_colleges.sort(key=lambda x: x[1], reverse=True)

# Write results
with open('data/lookups/remaining_colleges_needed.txt', 'w', encoding='utf-8') as f:
    f.write('='*100 + '\n')
    f.write('REMAINING COLLEGES THAT NEED MAPPING\n')
    f.write('='*100 + '\n')
    f.write(f'\nTotal unmapped colleges: {len(unmapped_colleges)}\n')
    f.write(f'Total affected players: {sum(c[1] for c in unmapped_colleges)}\n\n')

    f.write('College Name' + ' ' * 40 + 'Count\n')
    f.write('-'*100 + '\n')

    for i, (college, count) in enumerate(unmapped_colleges, 1):
        f.write(f'{i:3}. {college:50} {count:6}\n')

print(f'Analysis complete!')
print(f'Remaining unmapped colleges: {len(unmapped_colleges)}')
print(f'Total affected players: {sum(c[1] for c in unmapped_colleges)}')
print(f'Results written to: data/lookups/remaining_colleges_needed.txt')
