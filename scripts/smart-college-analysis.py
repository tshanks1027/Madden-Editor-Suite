#!/usr/bin/env python3
"""
Smart college analysis - find close matches and eliminate duplicates
"""
import pandas as pd
from collections import Counter
from difflib import get_close_matches

# Read the official college list
college_lookup = pd.read_csv('data/lookups/college_lookup.csv')
madden_colleges = college_lookup['CollegeName'].dropna().str.strip().tolist()
madden_colleges_lower = [c.lower() for c in madden_colleges]

# Read all source files
roster_df = pd.read_csv('data/lookups/ROSTER_lookup.csv', low_memory=False)
all_player_df = pd.read_csv('data/lookups/ALL_PLAYER_LOOKUP.csv')
future_draft_df = pd.read_csv('data/lookups/FutureDraft_Lookup_MERGED.csv')

# Combine all college entries
all_colleges = []
all_colleges.extend(roster_df['College'].dropna().tolist())
all_colleges.extend(all_player_df['College'].dropna().tolist())
all_colleges.extend(future_draft_df['College'].dropna().tolist())

# Count occurrences
college_counts = Counter(all_colleges)

# Current abbreviation map (from our work)
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
    'Texas-Arlington': 'Texas',
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
    'San Diego St.': 'San Diego State',
    'S. Dakota St.': 'South Dakota State',
    'Eastern New Mexico': 'New Mexico',
    'Southern Connecticut St.': 'S. Connecticut State',
    'Wisconsin—Whitewater': 'Wisc-Whitewater',
    'WisconsinâWhitewater': 'Wisc-Whitewater',
    'Kansas St.': 'Kansas State',
    'Adams St.': 'Adams State',
    'Sacranento State': 'Sacramento State',
    'Jackson St.': 'Jackson State',
    'Livingstone': 'Livingstone College',
    'WVU': 'West Virginia',
    'VTech': 'Virginia Tech',
    'BGSU': 'Bowling Green State',
    'Pacific': 'Azusa Pacific',
    'Chattanooga': 'Tenn-Chattanooga',
    'Tenn-Chat': 'Tenn-Chattanooga'
}

# Find colleges that still need mapping
needs_review = []

for college, count in college_counts.items():
    college_clean = college.strip()

    # Handle comma-separated colleges (take second)
    if ',' in college_clean:
        parts = college_clean.split(',')
        college_clean = parts[1].strip() if len(parts) > 1 else parts[0].strip()

    # Skip if already mapped
    if college_clean in abbreviation_map:
        mapped_name = abbreviation_map[college_clean]
        if mapped_name in madden_colleges:
            continue

    # Skip if exists directly in Madden list
    if college_clean in madden_colleges:
        continue

    # Try to find close matches
    close_matches = get_close_matches(college_clean, madden_colleges, n=3, cutoff=0.6)

    needs_review.append({
        'source': college_clean,
        'count': count,
        'close_matches': close_matches
    })

# Sort by count descending
needs_review.sort(key=lambda x: x['count'], reverse=True)

# Write results
with open('data/lookups/smart_college_analysis.txt', 'w', encoding='utf-8') as f:
    f.write('='*100 + '\n')
    f.write('SMART COLLEGE ANALYSIS - CLOSE MATCHES FOUND\n')
    f.write('='*100 + '\n')
    f.write(f'\nTotal unmapped colleges: {len(needs_review)}\n')
    f.write(f'Total affected players: {sum(c["count"] for c in needs_review)}\n\n')

    # Colleges with close matches
    has_matches = [c for c in needs_review if c['close_matches']]
    no_matches = [c for c in needs_review if not c['close_matches']]

    f.write(f'\n{"="*100}\n')
    f.write(f'COLLEGES WITH POSSIBLE MATCHES ({len(has_matches)} colleges, {sum(c["count"] for c in has_matches)} players)\n')
    f.write(f'{"="*100}\n\n')

    for i, item in enumerate(has_matches, 1):
        f.write(f'{i:3}. {item["source"]:50} ({item["count"]:4} players)\n')
        f.write(f'     Possible matches: {", ".join(item["close_matches"])}\n\n')

    f.write(f'\n{"="*100}\n')
    f.write(f'COLLEGES WITH NO CLOSE MATCHES ({len(no_matches)} colleges, {sum(c["count"] for c in no_matches)} players)\n')
    f.write(f'{"="*100}\n\n')

    # Only show top 100 of no matches
    for i, item in enumerate(no_matches[:100], 1):
        f.write(f'{i:3}. {item["source"]:50} {item["count"]:6}\n')

    if len(no_matches) > 100:
        f.write(f'\n... and {len(no_matches) - 100} more colleges with no close matches\n')

print(f'Analysis complete!')
print(f'Colleges with possible matches: {len(has_matches)} ({sum(c["count"] for c in has_matches)} players)')
print(f'Colleges with no matches: {len(no_matches)} ({sum(c["count"] for c in no_matches)} players)')
print(f'Results written to: data/lookups/smart_college_analysis.txt')
