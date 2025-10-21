"""
Scraper for Sports Reference College Football data
"""
from typing import List, Optional
import logging

from .base_scraper import BaseScraper
from ..models.prospect import Prospect
from ..utils.data_mapper import DataMapper

logger = logging.getLogger(__name__)


class SportsReferenceScraper(BaseScraper):
    """
    Scraper for College Football Reference (part of Sports Reference)

    This scraper collects current college player statistics and information
    that can be used to predict future NFL draft prospects.
    """

    def __init__(self, config, http_client, data_mapper: DataMapper):
        super().__init__(config, http_client)
        self.data_mapper = data_mapper
        self.cfb_url = "https://www.sports-reference.com/cfb/"

    def scrape_draft_class(self, year: int) -> List[Prospect]:
        """
        Scrape college players who are likely to be drafted in the given year

        Args:
            year: NFL Draft year (e.g., 2026)

        Returns:
            List of Prospect objects
        """
        prospects = []

        # Calculate college season year (draft happens after season)
        # For 2026 draft, we want 2025 season players
        season_year = year - 1

        self.log_progress(f"Scraping {season_year} college season for {year} draft class")

        # Get top players by position
        for position in self._get_key_positions():
            position_prospects = self._scrape_position_leaders(season_year, position, year)
            prospects.extend(position_prospects)

        self.log_progress(f"Found {len(prospects)} prospects for {year}")
        return prospects

    def _get_key_positions(self) -> List[str]:
        """Get list of key positions to scrape"""
        return ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'DB']

    def _scrape_position_leaders(
        self,
        season_year: int,
        position: str,
        draft_year: int
    ) -> List[Prospect]:
        """
        Scrape top players at a position for a season

        Args:
            season_year: College football season year
            position: Position abbreviation
            draft_year: NFL Draft year

        Returns:
            List of prospects at this position
        """
        prospects = []

        # Sports Reference URL pattern for position leaders
        url = f"{self.cfb_url}years/{season_year}-{position.lower()}.html"

        self.log_progress(f"Fetching {position} leaders for {season_year}: {url}")

        soup = self.fetch_page(url)
        if not soup:
            return prospects

        # Find the stats table
        stats_table = soup.find('table', {'id': f'{position.lower()}_stats'})
        if not stats_table:
            # Try alternate table IDs
            stats_table = soup.find('table', class_='stats_table')

        if not stats_table:
            self.log_progress(f"No stats table found for {position}", 'warning')
            return prospects

        # Parse player rows (limit to top performers)
        rows = stats_table.find('tbody').find_all('tr', limit=50)

        for row in rows:
            # Skip header rows
            if row.get('class') and 'thead' in row.get('class'):
                continue

            prospect_data = self._parse_player_row(row, position, draft_year, season_year)
            if prospect_data:
                prospects.append(prospect_data)

        return prospects

    def _parse_player_row(
        self,
        row,
        position: str,
        draft_year: int,
        season_year: int
    ) -> Optional[Prospect]:
        """
        Parse a player row from stats table

        Args:
            row: BeautifulSoup row element
            position: Position
            draft_year: Draft class year
            season_year: College season year

        Returns:
            Prospect object or None
        """
        try:
            # Extract player name
            name_cell = row.find('td', {'data-stat': 'player'})
            if not name_cell:
                return None

            name_link = name_cell.find('a')
            if not name_link:
                return None

            full_name = name_link.get_text(strip=True)
            name_parts = full_name.split(maxsplit=1)

            if len(name_parts) < 2:
                return None

            first_name, last_name = name_parts[0], name_parts[1]

            # Extract school
            school_cell = row.find('td', {'data-stat': 'school_name'})
            college = school_cell.get_text(strip=True) if school_cell else "Unknown"

            # Extract class year to determine eligibility
            class_cell = row.find('td', {'data-stat': 'class'})
            class_year = class_cell.get_text(strip=True) if class_cell else ""

            # Only include juniors and seniors (likely draft eligible)
            if class_year not in ['JR', 'SR', 'Jr', 'Sr', 'Junior', 'Senior']:
                return None

            # Create prospect
            prospect = Prospect(
                first_name=first_name,
                last_name=last_name,
                college=college,
                draft_class=draft_year,
                position=self.data_mapper.normalize_position(position)
            )

            # Try to extract player profile URL for more data
            player_url = name_link.get('href')
            if player_url:
                self._enrich_from_profile(prospect, player_url)

            # Store season stats in metadata
            prospect.metadata['season_year'] = season_year
            prospect.metadata['class_year'] = class_year
            prospect.metadata['source'] = 'sports_reference'

            return prospect

        except Exception as e:
            logger.error(f"Error parsing player row: {e}")
            return None

    def _enrich_from_profile(self, prospect: Prospect, profile_path: str):
        """
        Enrich prospect data from player profile page

        Args:
            prospect: Prospect to enrich
            profile_path: Relative URL path to player profile
        """
        if not profile_path.startswith('http'):
            profile_url = f"{self.cfb_url.rstrip('/')}{profile_path}"
        else:
            profile_url = profile_path

        soup = self.fetch_page(profile_url)
        if not soup:
            return

        # Extract bio information
        info_div = soup.find('div', {'id': 'meta'})
        if not info_div:
            return

        # Height and Weight
        for p in info_div.find_all('p'):
            text = p.get_text()

            if 'Height' in text:
                height_match = p.find('span')
                if height_match:
                    prospect.height = self.data_mapper.parse_height(
                        height_match.get_text(strip=True)
                    )

            if 'Weight' in text:
                weight_match = p.find('span')
                if weight_match:
                    prospect.weight = self.data_mapper.parse_weight(
                        weight_match.get_text(strip=True)
                    )

        # Try to get player image
        img = soup.find('img', {'class': 'media-item'})
        if img:
            img_url = img.get('src')
            if img_url:
                prospect.pfr_image_url = img_url

        # Hometown
        hometown_span = soup.find('span', {'itemprop': 'birthPlace'})
        if hometown_span:
            hometown = hometown_span.get_text(strip=True)
            prospect.home_state = self.data_mapper.extract_state(hometown)
