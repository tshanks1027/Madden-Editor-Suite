#!/usr/bin/env python3
"""
Scrape NFL Supplemental Draft Picks and Notable UDFAs from Wikipedia

This script collects historical data on:
- Supplemental draft picks
- Notable undrafted free agents

Data is scraped from Wikipedia's NFL Draft pages.

Usage:
    # Scrape a single year
    python scrape_supplemental_udfa.py --year 2023

    # Scrape a range of years
    python scrape_supplemental_udfa.py --start-year 2000 --end-year 2023

    # Output to JSON
    python scrape_supplemental_udfa.py --year 2023 --format json

    # Output to CSV
    python scrape_supplemental_udfa.py --year 2023 --format csv
"""
import argparse
import json
import csv
import logging
import sys
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent))

from src.scrapers.wikipedia_draft_scraper import WikipediaDraftScraper
from src.utils.http_client import RateLimitedClient
from src.utils.data_mapper import DataMapper


def setup_logging(verbose: bool = False):
    """Setup logging configuration"""
    level = logging.DEBUG if verbose else logging.INFO
    logging.basicConfig(
        level=level,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )


def save_to_json(data: dict, output_file: str):
    """Save data to JSON file"""
    output_data = {}

    for year, prospects in data.items():
        output_data[str(year)] = [
            {
                'first_name': p.first_name,
                'last_name': p.last_name,
                'full_name': f"{p.first_name} {p.last_name}",
                'college': p.college,
                'position': p.position,
                'draft_class': p.draft_class,
                'round': p.round,
                'pick': p.pick,
                'draft_type': p.metadata.get('draft_type', 'unknown'),
                'team': p.metadata.get('team'),
                'height': p.height,
                'weight': p.weight,
            }
            for p in prospects
        ]

    with open(output_file, 'w') as f:
        json.dump(output_data, f, indent=2)

    print(f"\nData saved to {output_file}")


def save_to_csv(data: dict, output_file: str):
    """Save data to CSV file"""
    with open(output_file, 'w', newline='') as f:
        fieldnames = [
            'year', 'first_name', 'last_name', 'full_name', 'college',
            'position', 'round', 'pick', 'draft_type', 'team',
            'height', 'weight'
        ]
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()

        for year, prospects in sorted(data.items()):
            for p in prospects:
                writer.writerow({
                    'year': year,
                    'first_name': p.first_name,
                    'last_name': p.last_name,
                    'full_name': f"{p.first_name} {p.last_name}",
                    'college': p.college,
                    'position': p.position,
                    'round': p.round if p.round else 'UDFA',
                    'pick': p.pick if p.pick else 'N/A',
                    'draft_type': p.metadata.get('draft_type', 'unknown'),
                    'team': p.metadata.get('team', ''),
                    'height': p.height or '',
                    'weight': p.weight or '',
                })

    print(f"\nData saved to {output_file}")


def print_summary(data: dict):
    """Print a summary of scraped data"""
    print("\n" + "=" * 80)
    print("SCRAPING SUMMARY")
    print("=" * 80)

    total_supplemental = 0
    total_udfa = 0

    for year, prospects in sorted(data.items()):
        supplemental = [p for p in prospects if p.metadata.get('draft_type') == 'supplemental']
        udfa = [p for p in prospects if p.metadata.get('draft_type') == 'undrafted']

        total_supplemental += len(supplemental)
        total_udfa += len(udfa)

        print(f"\n{year} NFL Draft:")
        print(f"  Supplemental Picks: {len(supplemental)}")
        print(f"  Notable UDFAs: {len(udfa)}")

        if supplemental:
            print(f"  Supplemental Draft Picks:")
            for p in supplemental:
                print(f"    - {p.first_name} {p.last_name} ({p.position}, {p.college})")

        if udfa:
            print(f"  Notable UDFAs:")
            for p in udfa:
                team = p.metadata.get('team', 'Unknown')
                print(f"    - {p.first_name} {p.last_name} ({p.position}, {p.college}) -> {team}")

    print("\n" + "-" * 80)
    print(f"TOTAL: {total_supplemental} supplemental picks, {total_udfa} notable UDFAs")
    print("=" * 80 + "\n")


def main():
    parser = argparse.ArgumentParser(
        description='Scrape NFL supplemental draft picks and notable UDFAs from Wikipedia'
    )

    # Year arguments
    year_group = parser.add_mutually_exclusive_group(required=True)
    year_group.add_argument('--year', type=int, help='Single year to scrape')
    year_group.add_argument('--years', nargs='+', type=int, help='Multiple specific years to scrape')

    parser.add_argument('--start-year', type=int, help='Start year for range (use with --end-year)')
    parser.add_argument('--end-year', type=int, help='End year for range (use with --start-year)')

    # Output arguments
    parser.add_argument('--format', choices=['json', 'csv', 'both'], default='json',
                        help='Output format (default: json)')
    parser.add_argument('--output-dir', default='output',
                        help='Output directory (default: output)')

    # Other arguments
    parser.add_argument('--verbose', '-v', action='store_true',
                        help='Verbose logging')

    args = parser.parse_args()

    # Setup logging
    setup_logging(args.verbose)

    # Determine years to scrape
    years_to_scrape = []

    if args.year:
        years_to_scrape = [args.year]
    elif args.years:
        years_to_scrape = args.years
    elif args.start_year and args.end_year:
        years_to_scrape = list(range(args.start_year, args.end_year + 1))
    else:
        parser.error("Must specify --year, --years, or both --start-year and --end-year")

    # Setup output directory
    output_dir = Path(args.output_dir)
    output_dir.mkdir(exist_ok=True)

    # Initialize scraper
    config = {
        'enabled': True,
        'base_url': 'https://en.wikipedia.org'
    }

    # Use a descriptive User-Agent for Wikipedia
    # Wikipedia prefers identifiable user agents
    http_client = RateLimitedClient(
        rate_limit_seconds=2.0,  # Be nice to Wikipedia
        user_agent_rotation=False  # Use consistent user agent for Wikipedia
    )
    data_mapper = DataMapper({})

    scraper = WikipediaDraftScraper(config, http_client, data_mapper)

    # Scrape data
    print(f"\nScraping supplemental draft picks and notable UDFAs...")
    print(f"Years: {', '.join(map(str, sorted(years_to_scrape)))}\n")

    all_data = {}
    for year in sorted(years_to_scrape):
        prospects = scraper.scrape_draft_class(year)
        all_data[year] = prospects

    # Print summary
    print_summary(all_data)

    # Save data
    if args.format in ['json', 'both']:
        if len(years_to_scrape) == 1:
            json_file = output_dir / f"supplemental_udfa_{years_to_scrape[0]}.json"
        else:
            start = min(years_to_scrape)
            end = max(years_to_scrape)
            json_file = output_dir / f"supplemental_udfa_{start}_{end}.json"
        save_to_json(all_data, str(json_file))

    if args.format in ['csv', 'both']:
        if len(years_to_scrape) == 1:
            csv_file = output_dir / f"supplemental_udfa_{years_to_scrape[0]}.csv"
        else:
            start = min(years_to_scrape)
            end = max(years_to_scrape)
            csv_file = output_dir / f"supplemental_udfa_{start}_{end}.csv"
        save_to_csv(all_data, str(csv_file))


if __name__ == '__main__':
    main()
