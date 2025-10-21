"""
Main entry point for Draft Prospect Scraper
"""
import argparse
import logging
import sys
from pathlib import Path
from typing import List
import yaml
import pandas as pd
from tqdm import tqdm

from models.prospect import Prospect
from scrapers.sports_reference import SportsReferenceScraper
from scrapers.recruiting_scraper import RecruitingScraper
from prediction.draft_predictor import DraftPredictor
from utils.http_client import RateLimitedClient
from utils.data_mapper import DataMapper


# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('scraper.log')
    ]
)
logger = logging.getLogger(__name__)


class DraftProspectScraper:
    """Main orchestrator for scraping draft prospects"""

    def __init__(self, config_path: str = 'config/scraper_config.yaml'):
        """
        Initialize scraper

        Args:
            config_path: Path to configuration file
        """
        self.config = self._load_config(config_path)
        self.http_client = self._create_http_client()
        self.data_mapper = DataMapper(self.config['position_mapping'])
        self.predictor = DraftPredictor(self.config)

        # Initialize scrapers
        self.scrapers = self._initialize_scrapers()

        # Create output directory
        output_dir = Path(self.config['output']['directory'])
        output_dir.mkdir(exist_ok=True)

    def _load_config(self, config_path: str) -> dict:
        """Load configuration from YAML file"""
        try:
            with open(config_path, 'r') as f:
                return yaml.safe_load(f)
        except FileNotFoundError:
            logger.error(f"Config file not found: {config_path}")
            sys.exit(1)
        except yaml.YAMLError as e:
            logger.error(f"Error parsing config: {e}")
            sys.exit(1)

    def _create_http_client(self) -> RateLimitedClient:
        """Create HTTP client with rate limiting"""
        scraping_config = self.config['scraping']
        return RateLimitedClient(
            rate_limit_seconds=scraping_config['rate_limit_seconds'],
            timeout=scraping_config['timeout_seconds'],
            max_retries=scraping_config['max_retries'],
            user_agent_rotation=scraping_config['user_agent_rotation']
        )

    def _initialize_scrapers(self) -> dict:
        """Initialize all enabled scrapers"""
        scrapers = {}

        # Sports Reference scraper (for current college players)
        if self.config['data_sources']['sports_reference']['enabled']:
            scrapers['sports_reference'] = SportsReferenceScraper(
                self.config['data_sources']['sports_reference'],
                self.http_client,
                self.data_mapper
            )

        # 247Sports recruiting scraper (for future recruits)
        if self.config['data_sources']['recruiting_247']['enabled']:
            scrapers['recruiting'] = RecruitingScraper(
                self.config['data_sources']['recruiting_247'],
                self.http_client,
                self.data_mapper
            )

        return scrapers

    def scrape_draft_class(self, year: int) -> List[Prospect]:
        """
        Scrape a single draft class

        Args:
            year: Draft year to scrape

        Returns:
            List of prospects for that year
        """
        logger.info(f"Scraping draft class {year}")
        all_prospects = []

        # Determine which scraper to use based on year
        current_year = 2025  # Update this as needed
        years_out = year - current_year

        if years_out <= 5:
            # Use college stats for near-term drafts (current college players)
            if 'sports_reference' in self.scrapers:
                logger.info(f"Using Sports Reference for {year} (current college players)")
                prospects = self.scrapers['sports_reference'].scrape_draft_class(year)
                all_prospects.extend(prospects)
        else:
            # Use recruiting rankings for far-future drafts
            if 'recruiting' in self.scrapers:
                logger.info(f"Using recruiting rankings for {year} (future recruits)")
                prospects = self.scrapers['recruiting'].scrape_draft_class(year)
                all_prospects.extend(prospects)

        # Remove duplicates
        all_prospects = self._deduplicate_prospects(all_prospects)

        logger.info(f"Found {len(all_prospects)} total prospects for {year}")
        return all_prospects

    def _deduplicate_prospects(self, prospects: List[Prospect]) -> List[Prospect]:
        """Remove duplicate prospects"""
        seen = {}
        unique = []

        for prospect in prospects:
            key = f"{prospect.first_name}_{prospect.last_name}_{prospect.college}".lower()
            if key not in seen:
                seen[key] = True
                unique.append(prospect)

        return unique

    def predict_positions(self, prospects: List[Prospect]) -> List[Prospect]:
        """
        Predict draft positions for prospects

        Args:
            prospects: List of prospects

        Returns:
            Prospects with predictions added
        """
        logger.info("Predicting draft positions")
        return self.predictor.predict_draft_position(prospects)

    def export_to_csv(self, prospects: List[Prospect], year: int):
        """
        Export prospects to CSV file

        Args:
            prospects: List of prospects to export
            year: Draft year
        """
        output_dir = Path(self.config['output']['directory'])
        filename_pattern = self.config['output']['filename_pattern']
        output_file = output_dir / filename_pattern.format(year=year)

        # Convert prospects to CSV rows
        rows = [p.to_csv_row() for p in prospects]

        # Create DataFrame
        df = pd.DataFrame(rows)

        # Sort by predicted pick
        df = df.sort_values('Pick', na_position='last')

        # Export to CSV
        df.to_csv(output_file, index=False)
        logger.info(f"Exported {len(prospects)} prospects to {output_file}")

    def run(self, years: List[int]):
        """
        Run scraper for multiple draft years

        Args:
            years: List of draft years to scrape
        """
        logger.info(f"Starting scraper for years: {years}")

        for year in tqdm(years, desc="Draft Classes"):
            try:
                # Scrape prospects
                prospects = self.scrape_draft_class(year)

                if not prospects:
                    logger.warning(f"No prospects found for {year}")
                    continue

                # Predict draft positions
                prospects = self.predict_positions(prospects)

                # Export to CSV
                self.export_to_csv(prospects, year)

            except Exception as e:
                logger.error(f"Error processing year {year}: {e}", exc_info=True)

        logger.info("Scraping complete!")

    def cleanup(self):
        """Clean up resources"""
        self.http_client.close()


def parse_args():
    """Parse command line arguments"""
    parser = argparse.ArgumentParser(
        description='Scrape NFL draft prospect data from college stats and recruiting rankings'
    )

    parser.add_argument(
        '--years',
        type=int,
        nargs='+',
        help='Draft years to scrape (e.g., 2026 2027 2028)'
    )

    parser.add_argument(
        '--year-range',
        type=str,
        help='Range of years to scrape (e.g., 2026-2030)'
    )

    parser.add_argument(
        '--config',
        type=str,
        default='config/scraper_config.yaml',
        help='Path to configuration file'
    )

    parser.add_argument(
        '--verbose',
        action='store_true',
        help='Enable verbose logging'
    )

    return parser.parse_args()


def main():
    """Main entry point"""
    args = parse_args()

    # Set logging level
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    # Determine years to scrape
    years = []

    if args.years:
        years = args.years
    elif args.year_range:
        # Parse range (e.g., "2026-2030")
        start, end = map(int, args.year_range.split('-'))
        years = list(range(start, end + 1))
    else:
        # Default to next 5 years
        current_year = 2025
        years = list(range(current_year + 1, current_year + 6))

    # Initialize and run scraper
    scraper = DraftProspectScraper(args.config)

    try:
        scraper.run(years)
    except KeyboardInterrupt:
        logger.info("Scraping interrupted by user")
    finally:
        scraper.cleanup()


if __name__ == '__main__':
    main()
