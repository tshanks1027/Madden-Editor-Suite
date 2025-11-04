#!/usr/bin/env python3
"""
NFL Draft Class Year Filler - Logic-Based Approach
Since scraping and APIs are blocked, this uses draft class logic to infer college year.

Logic:
- Draft Class 2026 (graduating spring 2026) → Senior or RS Senior (in 2025)
- Draft Class 2027 (graduating spring 2027) → Junior or RS Junior (in 2025)
- Draft Class 2028 (graduating spring 2028) → Sophomore or RS Sophomore (in 2025)
- Draft Class 2029 → HS Senior
- Draft Class 2030 → HS Junior
- Draft Class 2031 → HS Sophomore

For college players, we'll default to the non-redshirt version, but this can be
easily updated manually for specific players if needed.
"""

import csv

# Configuration
INPUT_FILE = './data/lookups/FutureDraft_Lookup.csv'
OUTPUT_FILE = './data/lookups/FutureDraft_Lookup_WITH_CLASSES.csv'

# Mapping from draft class to college year
DRAFT_CLASS_TO_COLLEGE_YEAR = {
    '2026': 'Senior',      # Graduating 2026, currently in final year
    '2027': 'Junior',      # Graduating 2027, currently in 3rd year
    '2028': 'Sophomore',   # Graduating 2028, currently in 2nd year
    '2029': 'HS Senior',   # High school seniors
    '2030': 'HS Junior',   # High school juniors
    '2031': 'HS Sophomore', # High school sophomores
}

def main():
    print("="*70)
    print("NFL DRAFT CLASS YEAR FILLER - LOGIC-BASED")
    print("="*70)
    print("\nUsing draft class logic to infer college years:")
    print("  2026 Draft Class → Senior")
    print("  2027 Draft Class → Junior")
    print("  2028 Draft Class → Sophomore")
    print("  2029 Draft Class → HS Senior")
    print("  2030 Draft Class → HS Junior")
    print("  2031 Draft Class → HS Sophomore")
    print("="*70)

    # Load data
    with open(INPUT_FILE, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    print(f"\nTotal players in database: {len(rows)}")

    # Count by draft class
    stats = {}
    updated_count = 0

    for row in rows:
        draft_class = row['Draft Class']

        # Apply logic-based mapping
        if draft_class in DRAFT_CLASS_TO_COLLEGE_YEAR:
            row['2025 College Year'] = DRAFT_CLASS_TO_COLLEGE_YEAR[draft_class]
            updated_count += 1

            # Track stats
            if draft_class not in stats:
                stats[draft_class] = 0
            stats[draft_class] += 1

    # Write output
    with open(OUTPUT_FILE, 'w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=rows[0].keys())
        writer.writeheader()
        writer.writerows(rows)

    # Final report
    print("\n" + "="*70)
    print("PROCESSING COMPLETE!")
    print("="*70)

    for draft_class in sorted(stats.keys()):
        college_year = DRAFT_CLASS_TO_COLLEGE_YEAR[draft_class]
        print(f"  {draft_class} Draft Class → {college_year}: {stats[draft_class]} players")

    print(f"\nTotal players updated: {updated_count}")
    print(f"Output saved to: {OUTPUT_FILE}")
    print("="*70)
    print("\nNote: College players are set to non-redshirt years by default.")
    print("Redshirt status can be updated manually if needed for specific players.")
    print("="*70)

if __name__ == '__main__':
    main()
