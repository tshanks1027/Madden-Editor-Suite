"""
Basic usage example for Draft Prospect Scraper
"""
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent / 'src'))

from main import DraftProspectScraper


def example_single_year():
    """Example: Scrape a single draft class"""
    print("Example 1: Scraping 2026 draft class")
    print("-" * 50)

    scraper = DraftProspectScraper()

    try:
        # Scrape 2026 draft class
        prospects = scraper.scrape_draft_class(2026)
        print(f"Found {len(prospects)} prospects")

        # Show first few prospects
        print("\nTop 5 Prospects:")
        for i, prospect in enumerate(prospects[:5], 1):
            print(f"{i}. {prospect.full_name} - {prospect.position} - {prospect.college}")

        # Predict positions
        prospects = scraper.predict_positions(prospects)

        # Export
        scraper.export_to_csv(prospects, 2026)
        print("\nExported to output/draft_class_2026.csv")

    finally:
        scraper.cleanup()


def example_multiple_years():
    """Example: Scrape multiple draft classes"""
    print("\nExample 2: Scraping multiple years (2026-2028)")
    print("-" * 50)

    scraper = DraftProspectScraper()

    try:
        years = [2026, 2027, 2028]
        scraper.run(years)
        print(f"\nCompleted scraping for {len(years)} draft classes")

    finally:
        scraper.cleanup()


def example_custom_config():
    """Example: Using custom configuration"""
    print("\nExample 3: Custom configuration")
    print("-" * 50)

    # You can create a custom config file and pass it
    scraper = DraftProspectScraper(config_path='config/scraper_config.yaml')

    try:
        prospects = scraper.scrape_draft_class(2030)
        prospects = scraper.predict_positions(prospects)

        # Access prospect data
        for prospect in prospects[:3]:
            print(f"\n{prospect.full_name}")
            print(f"  Position: {prospect.position}")
            print(f"  College: {prospect.college}")
            print(f"  Predicted Round: {prospect.predicted_round}")
            print(f"  Recruiting Stars: {prospect.recruiting_stars or 'N/A'}")
            print(f"  Height: {prospect.height or 'N/A'}")
            print(f"  Weight: {prospect.weight or 'N/A'}")

    finally:
        scraper.cleanup()


if __name__ == '__main__':
    # Run examples
    example_single_year()
    # example_multiple_years()
    # example_custom_config()
