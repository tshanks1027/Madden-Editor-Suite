"""
Analyze Race column in MASTER_LOOKUP_FINAL.csv
Shows distribution, coverage, and sample entries by race
"""

import pandas as pd
from pathlib import Path
from collections import Counter

def main():
    base_dir = Path(r"C:\Users\tshan\OneDrive\Documents\Madden Files\KNuttZFranchiseSandBox")
    lookup_file = base_dir / "madden-editor-suite" / "data" / "lookups" / "MASTER_LOOKUP_FINAL.csv"

    print("="*80)
    print("MASTER_LOOKUP_FINAL.csv - RACE ANALYSIS")
    print("="*80)

    # Load data
    df = pd.read_csv(lookup_file)
    total = len(df)

    print(f"\nTotal Players: {total:,}")

    # Analyze Race column
    print("\n" + "="*80)
    print("RACE COLUMN ANALYSIS")
    print("="*80)

    # Count non-empty race values
    with_race = df[df['Race'].notna() & (df['Race'] != '')].shape[0]
    without_race = total - with_race

    print(f"\nCoverage:")
    print(f"  With Race Data: {with_race:,} ({with_race/total*100:.1f}%)")
    print(f"  Without Race Data: {without_race:,} ({without_race/total*100:.1f}%)")

    # Get race distribution
    race_counts = Counter(df[df['Race'].notna() & (df['Race'] != '')]['Race'])

    print(f"\nRace Distribution ({len(race_counts)} unique values):")
    print("-"*80)

    for race, count in race_counts.most_common():
        pct = count / with_race * 100
        print(f"  {race:<40} {count:>6,} ({pct:>5.1f}%)")

    # Sample entries by race
    print("\n" + "="*80)
    print("SAMPLE ENTRIES BY RACE")
    print("="*80)

    for race in sorted(race_counts.keys()):
        print(f"\n{race} ({race_counts[race]} players):")
        print("-"*80)

        sample = df[df['Race'] == race].head(5)
        for _, row in sample.iterrows():
            name = f"{row['First Name']} {row['Last Name']}"
            draft = row['Draft Class']
            pos = row['Position']
            league = row['League']
            print(f"  {name:<30} {draft:>6} {pos:<6} {league}")

    # Check correlation with other fields
    print("\n" + "="*80)
    print("RACE DATA CORRELATIONS")
    print("="*80)

    # Race by league
    print("\nRace by League:")
    for league in ['NFL', 'AFL']:
        league_df = df[df['League'] == league]
        with_race_league = league_df[league_df['Race'].notna() & (league_df['Race'] != '')].shape[0]
        total_league = len(league_df)
        if total_league > 0:
            pct = with_race_league / total_league * 100
            print(f"  {league}: {with_race_league:,}/{total_league:,} ({pct:.1f}%)")

    # Race by decade
    print("\nRace by Decade:")
    df['Decade'] = (df['Draft Class'].astype(int) // 10) * 10
    for decade in sorted(df['Decade'].unique()):
        decade_df = df[df['Decade'] == decade]
        with_race_decade = decade_df[decade_df['Race'].notna() & (decade_df['Race'] != '')].shape[0]
        total_decade = len(decade_df)
        if total_decade > 0:
            pct = with_race_decade / total_decade * 100
            print(f"  {decade}s: {with_race_decade:,}/{total_decade:,} ({pct:.1f}%)")

    # Most common race by position
    print("\nMost Common Race by Position:")
    print("-"*80)

    positions = ['QB', 'HB', 'FB', 'WR', 'TE', 'CB', 'FS', 'SS', 'LEDG', 'REDG', 'DT', 'SAM', 'Mike']
    for pos in positions:
        pos_df = df[df['Position'] == pos]
        if len(pos_df) == 0:
            continue

        pos_with_race = pos_df[pos_df['Race'].notna() & (pos_df['Race'] != '')]
        if len(pos_with_race) == 0:
            continue

        race_dist = Counter(pos_with_race['Race'])
        top_race = race_dist.most_common(1)[0]
        print(f"  {pos:<6} {top_race[0]:<40} ({top_race[1]}/{len(pos_with_race)} = {top_race[1]/len(pos_with_race)*100:.0f}%)")

    print("\n" + "="*80)

if __name__ == '__main__':
    main()
