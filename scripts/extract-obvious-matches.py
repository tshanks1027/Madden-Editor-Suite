#!/usr/bin/env python3
"""
Extract obvious college matches from the smart analysis file
"""
import re

# Colleges we've already mapped
already_mapped = {
    'Southern California', 'Louisiana State', 'University of California Los Angeles', 'Penn St.', 'Ohio St.', 'Bucks',
    'Mississippi', 'Brigham Young', 'Texas Christian', 'Boston Col.', 'Southern Methodist', 'North Carolina State',
    'Louisiana Tech', 'Utah St.', 'Iowa St.', 'Central Florida', 'Bowling Green', 'Miami (OH)', 'Florida A&M',
    'South Florida', 'Texas-El Paso', 'Kent St.', 'S.F. Austin', 'Boise St.', 'La-Monroe', 'Western Carolina',
    'Wash. St.', 'Texas St.', 'Middle Tenn. St.', 'Bethune-Cookman', 'Florida International', 'Florida Atlantic',
    'Ball St.', 'Weber St.', 'Miss. Valley St.', 'S.D. State', 'Southern Mississippi', 'Ark-Pine Bluff',
    'Western Kentucky', 'Louisiana', 'Louisiana-Monroe', 'Western Michigan', 'Appalach. St.', 'Nevada-Las Vegas',
    'Pitt', 'Pennsylvania', 'Idaho St.', 'J. Madison', 'Ga. Southern', 'Eastern Wash.', 'Elon', 'Ala-Birmingham',
    'Mid Tenn St.', 'Kutztown (PA)', 'New Mex. Highlands', 'New Mex. St.', 'Texas-Arlington', 'Cal State-Northridge',
    'Cal State-Fullerton', 'Cal Poly-San Luis Obispo', 'California,San Diego St.', 'Miami (FL)', 'Lamar',
    'Southeastern Louisiana', 'Lincoln (MO)', 'Miami Univ.', 'Sacramento St.', 'Wisconsin—LaCrosse', 'WisconsinâLaCrosse',
    'Catawba', 'San Diego St.', 'S. Dakota St.', 'Eastern New Mexico', 'Southern Connecticut St.', 'Wisconsin—Whitewater',
    'WisconsinâWhitewater', 'Kansas St.', 'Adams St.', 'Sacranento State', 'Jackson St.', 'Livingstone',
    'Abilene Chr.', 'Benedictine', 'San Jose St.', 'Appalachian St.', 'Arkansas P.B.', 'Jacksonv. St.',
    'East Central (OK)', 'Montclair St.', "St. Mary's (CA)", 'UT Martin', 'Trinity (TX)', 'Fort Hays St.',
    "N'western St.", 'North Dakota St.', 'Knoxville', 'Arkansas St.', 'Washington St.', 'Minnesota-Duluth',
    'South Carolina St.', 'Walla Walla CC (WA)', 'Western Wash.', 'Tennessee St.', 'Delta St.', 'Florida St.',
    'Saginaw Valley St.', "T A&M K'ville", 'TTech', 'Newberry', 'Wisconsin—Milwaukee', 'WisconsinâMilwaukee',
    'West Texas A&M', 'Emporia St.', 'Western Illinois', 'JMU', 'Palomar (CA)', 'Morningside', 'West Liberty St.',
    'Arizona St.', 'Fairmont St.', 'Wisconsin—Stevens Point', 'WisconsinâStevens Point', 'ECU', 'Colorado St.',
    'Abilene Christian', 'Michigan St.', 'Trinity (IL)', 'Tenn. Tech', 'Middle Tennessee', 'Mississippi St.',
    'New Mexico St.', 'Sonoma St.', 'P. View AM', 'Sam Houston State', 'GTech', 'Oregon St.', 'Wayne State (MI)',
    'Fayetteville St.', 'Grambling St.', "St. John's (NY)", 'Central Connecticut St.', 'Hastings',
    'Texas A&M-Kingsville', 'Savannah St.', 'NIU', 'Tennessee Tech', 'Fresno St.', 'Indiana St.', 'NC Central',
    'Western State Colorado', 'Wagner', 'Bethune–Cookman', 'Ottawa (KS)', 'Mount San Antonio JC', 'Trinity (CT)',
    'Franklin & Marshall', 'Cal Poly', 'W. Mich', 'McNeese St.', 'Prairie View A&M', 'Bowie St.', 'South Dakota St.',
    'Chadron St.', 'McGill Univ.', 'Limestone College', 'Southeast Missouri State', 'Memphis State',
    'Southern Connecticut State', 'Saginaw Valley State', 'Truman St.', 'Minot St.', 'Youngstown St.',
    "Saint John's (MN)", 'Portland St.', 'Nicholls St.', 'Sam Houston St.', 'Fort Valley St.', 'Valdosta St.',
    'Northwestern St. (LA)', 'Morgan St.', 'Mt S. Antonio', 'SE Missouri', 'Shepherd Univ.', 'Centre',
    'Wisconsin–La Crosse', 'Clem', 'Cinci', 'Missouri Western', 'Louisiana-Lafayette', 'UL Laf', 'N. Texas',
    'Alabama St.', 'Missouri Southern', 'Oklahoma St.', 'Alcorn St.', 'Illinois St.', 'Murray St.', 'Tarleton St.',
    'Cal-Bakersfield', 'Lamar Univ.', 'Northeast Mississippi Community College', 'Kennesaw State University', 'Weber',
    'North Texas State', 'Northern State Univ.', 'Western New Mexico', 'West Liberty', 'Northwestern Oklahoma State',
    'Carroll', 'WVU', 'VTech', 'BGSU', 'Pacific', 'Chattanooga', 'Tenn-Chat'
}

# Read the file
with open('data/lookups/smart_college_analysis.txt', 'r', encoding='utf-8') as f:
    content = f.read()

# Parse colleges and their matches
pattern = r'(\d+)\.\s+([^\(]+?)\s+\(\s*(\d+)\s+players?\)\s+Possible matches:\s+([^\n]+)'
matches = re.findall(pattern, content)

obvious_matches = []

for num, source, count, suggestions in matches:
    source = source.strip()

    # Skip if already mapped
    if source in already_mapped:
        continue

    # Get the first suggested match
    first_match = suggestions.split(',')[0].strip()

    # Check if it's an obvious match (very similar names)
    source_lower = source.lower().replace('.', '').replace(' ', '').replace('-', '')
    match_lower = first_match.lower().replace('.', '').replace(' ', '').replace('-', '')

    # If the match contains most of the source name, it's likely correct
    if len(source_lower) >= 4 and (source_lower in match_lower or match_lower in source_lower):
        obvious_matches.append((source, first_match, int(count)))
    # Or if it's a state abbreviation match
    elif ' St.' in source and 'State' in first_match:
        base_source = source.replace(' St.', '').strip()
        base_match = first_match.replace(' State', '').strip()
        if base_source.lower() == base_match.lower():
            obvious_matches.append((source, first_match, int(count)))

# Sort by player count descending
obvious_matches.sort(key=lambda x: x[2], reverse=True)

# Print as TypeScript mapping entries
print(f"\nFound {len(obvious_matches)} obvious matches affecting {sum(m[2] for m in obvious_matches)} players:\n")

for source, target, count in obvious_matches[:100]:  # Limit to top 100
    print(f"        '{source}': '{target}',")

print(f"\n\nTotal: {len(obvious_matches)} mappings")
