"""
Scraper for 247Sports recruiting rankings
"""
from typing import List, Optional
import logging
import re

from .base_scraper import BaseScraper
from ..models.prospect import Prospect
from ..utils.data_mapper import DataMapper

logger = logging.getLogger(__name__)


class RecruitingScraper(BaseScraper):
    """
    Scraper for 247Sports recruiting data

    This scraper collects high school recruiting rankings for future draft classes.
    Useful for projecting draft prospects 4+ years out.
    """

    def __init__(self, config, http_client, data_mapper: DataMapper):
        super().__init__(config, http_client)
        self.data_mapper = data_mapper

    def scrape_draft_class(self, year: int) -> List[Prospect]:
        """
        Scrape recruiting class that would be drafted in the given year

        Args:
            year: NFL Draft year (e.g., 2031)

        Returns:
            List of Prospect objects
        """
        prospects = []

        # Calculate recruiting class year
        # NFL draft is ~3 years after high school (redshirt freshman/sophomore)
        # For 2031 draft, we want 2028 recruiting class
        recruiting_year = year - 3

        self.log_progress(f"Scraping {recruiting_year} recruiting class for {year} draft")

        # Get composite rankings
        composite_prospects = self._scrape_composite_rankings(recruiting_year, year)
        prospects.extend(composite_prospects)

        # Get position-specific rankings for top positions
        for position in ['QB', 'RB', 'WR', 'OL', 'DL', 'LB', 'DB']:
            pos_prospects = self._scrape_position_rankings(recruiting_year, position, year)
            prospects.extend(pos_prospects)

        # Remove duplicates (same player from different rankings)
        prospects = self._deduplicate_prospects(prospects)

        self.log_progress(f"Found {len(prospects)} recruiting prospects for {year}")
        return prospects

    def _scrape_composite_rankings(
        self,
        recruiting_year: int,
        draft_year: int
    ) -> List[Prospect]:
        """
        Scrape 247Sports Composite rankings

        Args:
            recruiting_year: High school recruiting year
            draft_year: Projected NFL draft year

        Returns:
            List of prospects
        """
        prospects = []

        # 247Sports composite rankings URL
        url = f"https://247sports.com/Season/{recruiting_year}-Football/CompositeRecruitRankings/"

        self.log_progress(f"Fetching composite rankings: {url}")

        soup = self.fetch_page(url)
        if not soup:
            return prospects

        # Find ranking list
        ranking_list = soup.find('ul', class_='rankings-page__list')
        if not ranking_list:
            # Try alternate structure
            ranking_list = soup.find('div', class_='rankings')

        if not ranking_list:
            self.log_progress("Could not find rankings list", 'warning')
            return prospects

        # Parse recruit items (top 100)
        recruit_items = ranking_list.find_all('li', class_='rankings-page__list-item', limit=100)

        for item in recruit_items:
            prospect = self._parse_recruit_item(item, draft_year, recruiting_year)
            if prospect:
                prospects.append(prospect)

        return prospects

    def _scrape_position_rankings(
        self,
        recruiting_year: int,
        position: str,
        draft_year: int
    ) -> List[Prospect]:
        """
        Scrape position-specific rankings

        Args:
            recruiting_year: High school recruiting year
            position: Position abbreviation
            draft_year: Projected NFL draft year

        Returns:
            List of prospects at this position
        """
        prospects = []

        # 247Sports position rankings URL
        url = (f"https://247sports.com/Season/{recruiting_year}-Football/"
               f"CompositeRecruitRankings/?Position={position}")

        self.log_progress(f"Fetching {position} rankings for {recruiting_year}")

        soup = self.fetch_page(url)
        if not soup:
            return prospects

        # Similar parsing logic as composite
        ranking_list = soup.find('ul', class_='rankings-page__list')
        if ranking_list:
            recruit_items = ranking_list.find_all(
                'li',
                class_='rankings-page__list-item',
                limit=30
            )

            for item in recruit_items:
                prospect = self._parse_recruit_item(item, draft_year, recruiting_year)
                if prospect:
                    prospects.append(prospect)

        return prospects

    def _parse_recruit_item(
        self,
        item,
        draft_year: int,
        recruiting_year: int
    ) -> Optional[Prospect]:
        """
        Parse a recruit item from rankings

        Args:
            item: BeautifulSoup element for recruit
            draft_year: Projected draft year
            recruiting_year: Recruiting class year

        Returns:
            Prospect object or None
        """
        try:
            # Extract name
            name_elem = item.find('a', class_='rankings-page__name-link')
            if not name_elem:
                name_elem = item.find('div', class_='recruit')

            if not name_elem:
                return None

            full_name = name_elem.get_text(strip=True)
            name_parts = full_name.split(maxsplit=1)

            if len(name_parts) < 2:
                return None

            first_name, last_name = name_parts[0], name_parts[1]

            # Extract position
            pos_elem = item.find('div', class_='position')
            if not pos_elem:
                pos_elem = item.find('span', class_='position')

            position = pos_elem.get_text(strip=True) if pos_elem else "ATH"

            # Extract committed school
            school_elem = item.find('div', class_='status')
            if not school_elem:
                school_elem = item.find('img', class_='logo')

            if school_elem:
                college = school_elem.get('alt', '') or school_elem.get_text(strip=True)
            else:
                college = "Uncommitted"

            # Extract rating and stars
            rating_elem = item.find('span', class_='score')
            rating = None
            if rating_elem:
                try:
                    rating = float(rating_elem.get_text(strip=True))
                except ValueError:
                    pass

            stars_elem = item.find('div', class_='rankings-page__stars')
            stars = None
            if stars_elem:
                star_count = len(stars_elem.find_all('span', class_='icon-starsolid'))
                if star_count > 0:
                    stars = star_count

            # Extract hometown
            hometown_elem = item.find('span', class_='meta')
            hometown = hometown_elem.get_text(strip=True) if hometown_elem else ""

            # Extract height/weight if available
            metrics_elem = item.find('div', class_='metrics')
            height, weight = None, None

            if metrics_elem:
                metrics_text = metrics_elem.get_text()
                # Parse height (e.g., "6-2")
                height_match = re.search(r'(\d+-\d+)', metrics_text)
                if height_match:
                    height = height_match.group(1)

                # Parse weight (e.g., "215")
                weight_match = re.search(r'(\d{3})', metrics_text)
                if weight_match:
                    weight = int(weight_match.group(1))

            # Create prospect
            prospect = Prospect(
                first_name=first_name,
                last_name=last_name,
                college=college,
                draft_class=draft_year,
                position=self.data_mapper.normalize_position(position),
                height=height,
                weight=weight,
                recruiting_rating=rating,
                recruiting_stars=stars,
                home_state=self.data_mapper.extract_state(hometown)
            )

            # Store metadata
            prospect.metadata['recruiting_year'] = recruiting_year
            prospect.metadata['hometown'] = hometown
            prospect.metadata['source'] = '247sports'

            return prospect

        except Exception as e:
            logger.error(f"Error parsing recruit item: {e}")
            return None

    def _deduplicate_prospects(self, prospects: List[Prospect]) -> List[Prospect]:
        """
        Remove duplicate prospects (same player from different rankings)

        Args:
            prospects: List of prospects that may contain duplicates

        Returns:
            Deduplicated list
        """
        seen = {}
        unique_prospects = []

        for prospect in prospects:
            # Create unique key based on name and college
            key = f"{prospect.first_name}_{prospect.last_name}_{prospect.college}".lower()

            if key not in seen:
                seen[key] = prospect
                unique_prospects.append(prospect)
            else:
                # Merge data from duplicate (keep highest rating)
                existing = seen[key]
                if prospect.recruiting_rating:
                    if not existing.recruiting_rating or \
                       prospect.recruiting_rating > existing.recruiting_rating:
                        existing.recruiting_rating = prospect.recruiting_rating

                if prospect.recruiting_stars:
                    if not existing.recruiting_stars or \
                       prospect.recruiting_stars > existing.recruiting_stars:
                        existing.recruiting_stars = prospect.recruiting_stars

        return unique_prospects
