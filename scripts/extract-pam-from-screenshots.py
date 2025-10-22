#!/usr/bin/env python3
"""
PAM Name Extractor from Screenshots
Reads folder names manually from screenshots and creates PAM mapping CSV
"""

import csv
import os
from pathlib import Path

def parse_pam_name(pam_folder_name):
    """
    Parse PAM folder name to extract last name, first name, and suffix

    Examples:
        abanikandaIsrael_22741 -> (Abanikanda, Israel, 22741)
        MatthewsTommy_FOTF -> (Matthews, Tommy, FOTF)
        robinsonchop_14753 -> (Robinson, Chop, 14753)

    Returns:
        tuple: (last_name, first_name, suffix) or (None, None, None) if parsing fails
    """
    if not pam_folder_name or '_' not in pam_folder_name:
        return (None, None, None)

    # Split on underscore to get name part and suffix
    parts = pam_folder_name.split('_', 1)
    if len(parts) != 2:
        return (None, None, None)

    name_part = parts[0]
    suffix = parts[1]

    # Try to split the name part into last name and first name
    # Look for capital letters as boundaries
    # Pattern: find transitions from lowercase to uppercase

    # Find all positions where there's a transition from lowercase to uppercase
    capitals = [i for i, c in enumerate(name_part) if c.isupper()]

    if len(capitals) == 0:
        # All lowercase - can't determine split
        return (name_part.capitalize(), '', suffix)
    elif len(capitals) == 1:
        # Only one capital at start
        return (name_part.capitalize(), '', suffix)
    else:
        # Multiple capitals - split at the second capital letter
        split_pos = capitals[1]
        last_name = name_part[:split_pos]
        first_name = name_part[split_pos:]

        return (last_name.capitalize(), first_name.capitalize(), suffix)

def main():
    """
    Manual PAM name extraction - you'll need to type or paste the names from screenshots
    """

    print("\n=== PAM Name Extractor from Screenshots ===\n")

    screenshots_folder = r"C:\Users\tshan\OneDrive\Documents\Madden Files\KNuttZFranchiseSandBox\Planning Screenshots and Read Me files\PAM"
    output_file = r"C:\Users\tshan\OneDrive\Documents\Madden Files\KNuttZFranchiseSandBox\madden-editor-suite\data\lookups\pam_mapping.csv"

    print(f"Screenshots folder: {screenshots_folder}")
    print(f"Output file: {output_file}")
    print(f"\nNOTE: This script will process manually extracted PAM names")
    print("You can provide a text file with one PAM folder name per line\n")

    # PAM names extracted from the screenshots provided
    # Format: lastnamefirstname_suffix
    pam_names = [
        # From Screenshot 2025-10-17 101330
        "alShaairAzeez_20688",
        "alstottMike_12232",
        "AltJoe_14694",
        "amersondavid_11893",
        "andersonDerek_26674",
        "andersonJrWill_22702",
        "andersonRobby_17960",
        "andrewsmark_13112",
        "AngerBryan_11594",
        "ansahezekiel_1121",
        "antetokounmpoGiannis_2995",
        "antetokounmpoKostas_2997",
        "antetokounmpothanasis_2996",
        "anzaloneAlex_12613",
        "appleEli_17653",
        "arcegaWhitesideJJ_20344",

        # From Screenshot 2025-10-17 105036
        "matthewschris_2249",
        "matthewsclay_20143",
        "matthewsJake_12349",
        "matthewsjordan_12350",
        "MatthewsTommy_FOTF",
        "mattisonAlexander_20641",
        "maualugarey_20077",
        "maxwellbyron_10788",
        "MayeDrake_14501",
        "mayermichael_22697",
        "MayfieldBaker_13117",
        "McBrideTrey_22093",
        "mcCaffreyChristian_12556",
        "McCarthyJJ_14610",
        "mcclaimrobert_10068",
        "McConkeyLadd_14651",

        # From Screenshot 2025-10-17 105521
        "robinsonAShawn_17562",
        "robinsonBijan_22690",
        "robinsonCam_12557",
        "robinsonchop_14753",
        "RobinsonJames_21043",
        "robinsonJrBrian_22055",
        "robinsonPatrick_9924",
        "robinsonWanDale_22368",
        "robinsonbrian_28021",
        "rodgersAaron_26668",
        "rodgersjacquizz_10600",
        "roethlisbergerben_17271",
        "rogersII_12430",
        "romoTony_17083",
        "RosenJosh_13094",
        "rossJohn_12539",
        "rudolphKyle_10642",

        # From Screenshot 2025-10-17 110210
        "ZabelGrey_4601",
        "zappeBailey_22049",
        "zuerleingregThe_11598",
    ]

    print(f"\nProcessing {len(pam_names)} PAM folder names...")

    # Parse all names and create CSV
    with open(output_file, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(['PAM_Folder_Name', 'Last_Name', 'First_Name', 'Suffix'])

        for pam_name in pam_names:
            last, first, suffix = parse_pam_name(pam_name)
            writer.writerow([pam_name, last, first, suffix])
            print(f"  {pam_name:40} -> {last:15} {first:15} ({suffix})")

    print(f"\n\nCreated PAM mapping CSV: {output_file}")
    print(f"Total PAM names: {len(pam_names)}")
    print("\nNext step: Match these PAM names with the lookup database")

if __name__ == "__main__":
    main()
