#!/usr/bin/env python3
"""
PAM Name Extractor
Extracts Player Asset Manager (PAM) folder names from screenshots
"""

import os
import glob
import re
import csv
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

def normalize_name(name):
    """Normalize name for matching"""
    if not name:
        return ""
    return ' '.join(str(name).strip().split()).lower()

def main():
    """
    Extract PAM names from text file (you'll need to manually extract text from screenshots)
    or from a CSV that you create
    """

    print("\n=== PAM Name Extractor ===")
    print("\nNOTE: This script requires a text file with PAM folder names")
    print("Please create a file 'pam_names.txt' in the data/lookups folder")
    print("with one PAM folder name per line (e.g., abanikandaIsrael_22741)")
    print("\nYou can extract these from the screenshots manually or use OCR")

    # For now, let's create a sample output format
    output_file = "C:/Users/tshan/OneDrive/Documents/Madden Files/KNuttZFranchiseSandBox/madden-editor-suite/data/lookups/pam_mapping.csv"

    print(f"\nOutput file: {output_file}")
    print("\nSample output format:")
    print("PAM_Folder_Name,Last_Name,First_Name,Suffix")
    print("abanikandaIsrael_22741,Abanikanda,Israel,22741")
    print("MatthewsTommy_FOTF,Matthews,Tommy,FOTF")

    # Test the parsing function
    test_names = [
        "abanikandaIsrael_22741",
        "abdullahAmeer_2402",
        "MatthewsTommy_FOTF",
        "robinsonchop_14753",
        "RobinsonJames_21043"
    ]

    print("\n\nTesting PAM name parser:")
    print("-" * 80)
    for name in test_names:
        last, first, suffix = parse_pam_name(name)
        print(f"{name:30} -> Last: {last:15} First: {first:15} Suffix: {suffix}")

    # Create empty CSV template
    with open(output_file, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(['PAM_Folder_Name', 'Last_Name', 'First_Name', 'Suffix'])

        # Write test examples
        for name in test_names:
            last, first, suffix = parse_pam_name(name)
            writer.writerow([name, last, first, suffix])

    print(f"\n\nCreated template CSV: {output_file}")
    print("\nNext steps:")
    print("1. Extract all PAM folder names from screenshots (manually or with OCR)")
    print("2. Add them to pam_mapping.csv")
    print("3. Run the matching script to add PAM names to the lookup database")

if __name__ == "__main__":
    main()
