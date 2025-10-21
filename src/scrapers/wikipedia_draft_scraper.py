"""
Scraper for NFL Draft supplemental picks and notable UDFAs from Wikipedia
"""
from typing import List, Optional, Dict
import logging
import re

from .base_scraper import BaseScraper
from ..models.prospect import Prospect
from ..utils.data_mapper import DataMapper

logger = logging.getLogger(__name__)


class WikipediaDraftScraper(BaseScraper):
    """
    Scraper for Wikipedia NFL Draft pages

    Extracts:
    - Supplemental draft picks
    - Notable undrafted free agents (UDFAs)

    These sections are typically found at the bottom of each year's draft page.
    """

    def __init__(self, config, http_client, data_mapper: DataMapper):
        super().__init__(config, http_client)
        self.data_mapper = data_mapper
        self.wiki_base_url = "https://en.wikipedia.org/wiki/"

    def scrape_draft_class(self, year: int) -> List[Prospect]:
        """
        Scrape supplemental draft picks and notable UDFAs for a given draft year

        Args:
            year: NFL Draft year (e.g., 2023)

        Returns:
            List of Prospect objects
        """
        prospects = []

        # Build Wikipedia URL for the draft
        url = f"{self.wiki_base_url}{year}_NFL_draft"

        self.log_progress(f"Scraping {year} NFL Draft from Wikipedia: {url}")

        soup = self.fetch_page(url)
        if not soup:
            self.log_progress(f"Failed to fetch Wikipedia page for {year}", 'error')
            return prospects

        # Scrape supplemental draft picks
        supplemental_picks = self._scrape_supplemental_draft(soup, year)
        prospects.extend(supplemental_picks)
        self.log_progress(f"Found {len(supplemental_picks)} supplemental draft picks")

        # Scrape notable UDFAs
        udfa_picks = self._scrape_notable_udfas(soup, year)
        prospects.extend(udfa_picks)
        self.log_progress(f"Found {len(udfa_picks)} notable UDFAs")

        return prospects

    def _scrape_supplemental_draft(self, soup, year: int) -> List[Prospect]:
        """
        Extract supplemental draft picks from the Wikipedia page

        Args:
            soup: BeautifulSoup object of the draft page
            year: Draft year

        Returns:
            List of Prospect objects
        """
        prospects = []

        # Find the supplemental draft section
        # Common headings: "Supplemental draft", "Supplemental Draft", "Supplemental draft picks"
        supplemental_heading = soup.find(['h2', 'h3'],
            string=re.compile(r'Supplemental\s+draft', re.IGNORECASE))

        if not supplemental_heading:
            # Try finding by id
            supplemental_heading = soup.find(['span', 'h2', 'h3'],
                id=re.compile(r'Supplemental', re.IGNORECASE))

        if not supplemental_heading:
            self.log_progress(f"No supplemental draft section found for {year}", 'info')
            return prospects

        # Get the parent element to search from
        if supplemental_heading.name == 'span':
            section_start = supplemental_heading.parent
        else:
            section_start = supplemental_heading

        # Find the table following this heading
        table = section_start.find_next('table', class_='wikitable')

        if not table:
            self.log_progress(f"No supplemental draft table found for {year}", 'warning')
            return prospects

        # Parse the table
        rows = table.find_all('tr')[1:]  # Skip header row

        for row in rows:
            cells = row.find_all(['td', 'th'])
            if len(cells) < 3:
                continue

            prospect = self._parse_supplemental_row(cells, year)
            if prospect:
                prospects.append(prospect)

        return prospects

    def _parse_supplemental_row(self, cells, year: int) -> Optional[Prospect]:
        """
        Parse a row from the supplemental draft table

        Args:
            cells: List of table cells
            year: Draft year

        Returns:
            Prospect object or None
        """
        try:
            # Common format: Pick | Team | Name | Position | College
            # But format can vary, so we'll be flexible

            pick_num = None
            team = None
            name = None
            position = None
            college = None

            # Try to identify columns by content
            for i, cell in enumerate(cells):
                text = cell.get_text(strip=True)

                # Pick number (usually first column, numeric)
                if i == 0 or (pick_num is None and text.isdigit()):
                    try:
                        pick_num = int(text)
                    except ValueError:
                        pass

                # Look for player name (usually has a link)
                if cell.find('a') and name is None:
                    link = cell.find('a')
                    # Skip team links (they usually have specific patterns)
                    if link and not any(skip in link.get('href', '') for skip in ['/wiki/National_Football_League', '/wiki/List_of']):
                        potential_name = link.get_text(strip=True)
                        # Check if this looks like a person's name
                        if potential_name and len(potential_name.split()) >= 2:
                            name = potential_name

                # Position (usually 2-3 letter codes)
                if text in ['QB', 'RB', 'WR', 'TE', 'OL', 'OT', 'OG', 'C', 'DL', 'DT', 'DE', 'LB', 'DB', 'CB', 'S', 'K', 'P', 'LS']:
                    position = text

                # College (look for college-like text)
                if i > 0 and college is None and len(text) > 3 and not text.isdigit():
                    # If it's not the name and not the position, might be college
                    if text != name and text != position:
                        college = text

            if not name:
                return None

            # Parse name
            name_parts = name.split(maxsplit=1)
            first_name = name_parts[0] if len(name_parts) > 0 else ""
            last_name = name_parts[1] if len(name_parts) > 1 else name_parts[0]

            # Create prospect
            prospect = Prospect(
                first_name=first_name,
                last_name=last_name,
                college=college or "Unknown",
                draft_class=year,
                position=self.data_mapper.normalize_position(position) if position else "Unknown",
                round=0,  # Supplemental draft
                pick=pick_num or 0
            )

            prospect.metadata['draft_type'] = 'supplemental'
            prospect.metadata['source'] = 'wikipedia'
            if team:
                prospect.metadata['team'] = team

            return prospect

        except Exception as e:
            logger.error(f"Error parsing supplemental draft row: {e}")
            return None

    def _scrape_notable_udfas(self, soup, year: int) -> List[Prospect]:
        """
        Extract notable undrafted free agents from the Wikipedia page

        Args:
            soup: BeautifulSoup object of the draft page
            year: Draft year

        Returns:
            List of Prospect objects
        """
        prospects = []

        # Find the UDFA section
        # Common headings: "Notable undrafted players", "Undrafted free agents", etc.
        udfa_heading = soup.find(['h2', 'h3'],
            string=re.compile(r'(Notable\s+)?[Uu]ndrafted', re.IGNORECASE))

        if not udfa_heading:
            # Try finding by id
            udfa_heading = soup.find(['span', 'h2', 'h3'],
                id=re.compile(r'[Uu]ndrafted', re.IGNORECASE))

        if not udfa_heading:
            self.log_progress(f"No notable UDFA section found for {year}", 'info')
            return prospects

        # Get the parent element to search from
        if udfa_heading.name == 'span':
            section_start = udfa_heading.parent
        else:
            section_start = udfa_heading

        # Find the table following this heading
        table = section_start.find_next('table', class_='wikitable')

        if not table:
            self.log_progress(f"No UDFA table found for {year}", 'warning')
            return prospects

        # Parse the table
        rows = table.find_all('tr')[1:]  # Skip header row

        for row in rows:
            cells = row.find_all(['td', 'th'])
            if len(cells) < 2:
                continue

            prospect = self._parse_udfa_row(cells, year)
            if prospect:
                prospects.append(prospect)

        return prospects

    def _parse_udfa_row(self, cells, year: int) -> Optional[Prospect]:
        """
        Parse a row from the notable UDFA table

        Args:
            cells: List of table cells
            year: Draft year

        Returns:
            Prospect object or None
        """
        try:
            # Common format: Name | Position | College | Team
            # But format can vary

            name = None
            position = None
            college = None
            team = None

            # Try to identify columns
            for i, cell in enumerate(cells):
                text = cell.get_text(strip=True)

                # Look for player name (usually has a link and comes first)
                if cell.find('a') and name is None:
                    link = cell.find('a')
                    # Skip team/college links initially
                    if link:
                        href = link.get('href', '')
                        potential_name = link.get_text(strip=True)

                        # First link with a person-like name
                        if potential_name and len(potential_name.split()) >= 2 and '/wiki/' in href:
                            name = potential_name

                # Position
                if text in ['QB', 'RB', 'WR', 'TE', 'OL', 'OT', 'OG', 'C', 'DL', 'DT', 'DE', 'LB', 'DB', 'CB', 'S', 'K', 'P', 'LS', 'FB']:
                    position = text

                # College and Team - harder to distinguish, collect links
                if i > 0 and cell.find('a'):
                    link_text = cell.find('a').get_text(strip=True)
                    if link_text != name:
                        if college is None:
                            college = link_text
                        elif team is None:
                            team = link_text

            if not name:
                return None

            # Parse name
            name_parts = name.split(maxsplit=1)
            first_name = name_parts[0] if len(name_parts) > 0 else ""
            last_name = name_parts[1] if len(name_parts) > 1 else name_parts[0]

            # Create prospect
            prospect = Prospect(
                first_name=first_name,
                last_name=last_name,
                college=college or "Unknown",
                draft_class=year,
                position=self.data_mapper.normalize_position(position) if position else "Unknown",
                round=None,  # UDFA
                pick=None
            )

            prospect.metadata['draft_type'] = 'undrafted'
            prospect.metadata['source'] = 'wikipedia'
            prospect.metadata['notable'] = True
            if team:
                prospect.metadata['team'] = team

            return prospect

        except Exception as e:
            logger.error(f"Error parsing UDFA row: {e}")
            return None

    def scrape_multiple_years(self, start_year: int, end_year: int) -> Dict[int, List[Prospect]]:
        """
        Scrape supplemental draft and UDFA data for multiple years

        Args:
            start_year: First year to scrape
            end_year: Last year to scrape (inclusive)

        Returns:
            Dictionary mapping year to list of prospects
        """
        all_prospects = {}

        for year in range(start_year, end_year + 1):
            self.log_progress(f"Processing year {year}...")
            prospects = self.scrape_draft_class(year)
            all_prospects[year] = prospects

        return all_prospects
