"""
Example Wikipedia NFL Player Scraper
This demonstrates how to scrape NFL player data from Wikipedia.
Can be adapted for both undrafted players and free agents.
"""

import requests
from bs4 import BeautifulSoup
import pandas as pd
from typing import List, Dict, Optional


class WikiNFLScraper:
    """Scraper for NFL player data from Wikipedia"""

    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        })

    def scrape_undrafted_players(self, url: str) -> Optional[pd.DataFrame]:
        """
        Scrape undrafted players from a Wikipedia page

        Args:
            url: Wikipedia URL containing undrafted player data

        Returns:
            DataFrame with player information or None if failed
        """
        try:
            response = self.session.get(url, timeout=10)
            response.raise_for_status()

            # Parse HTML
            soup = BeautifulSoup(response.content, 'html.parser')

            # Wikipedia tables are usually in 'wikitable' class
            tables = soup.find_all('table', {'class': 'wikitable'})

            if not tables:
                print("No tables found on page")
                return None

            # Try to parse the first table (adjust index as needed)
            df = pd.read_html(str(tables[0]))[0]

            return df

        except Exception as e:
            print(f"Error scraping {url}: {e}")
            return None

    def scrape_free_agents_by_year(self, year: int) -> Optional[pd.DataFrame]:
        """
        Scrape free agents for a specific NFL season from Wikipedia

        Args:
            year: NFL season year

        Returns:
            DataFrame with free agent information
        """
        # Wikipedia URLs typically follow this pattern
        url = f"https://en.wikipedia.org/wiki/{year}_NFL_season"

        try:
            response = self.session.get(url, timeout=10)
            response.raise_for_status()

            soup = BeautifulSoup(response.content, 'html.parser')

            # Look for free agency section
            free_agency_section = None
            for heading in soup.find_all(['h2', 'h3']):
                if 'free agency' in heading.get_text().lower():
                    free_agency_section = heading
                    break

            if not free_agency_section:
                print(f"No free agency section found for {year}")
                return None

            # Find tables after the heading
            current = free_agency_section.find_next()
            tables = []

            while current and current.name != 'h2':
                if current.name == 'table' and 'wikitable' in current.get('class', []):
                    tables.append(current)
                current = current.find_next()

            if tables:
                df = pd.read_html(str(tables[0]))[0]
                return df

            return None

        except Exception as e:
            print(f"Error scraping {year} free agents: {e}")
            return None

    def scrape_player_career_stats(self, player_name: str) -> Dict:
        """
        Scrape individual player career information

        Args:
            player_name: Player's name (formatted for Wikipedia URL)

        Returns:
            Dictionary with player career information
        """
        # Convert name to Wikipedia format (e.g., "Tom_Brady")
        formatted_name = player_name.replace(' ', '_')
        url = f"https://en.wikipedia.org/wiki/{formatted_name}"

        try:
            response = self.session.get(url, timeout=10)
            response.raise_for_status()

            soup = BeautifulSoup(response.content, 'html.parser')

            # Extract infobox data (player bio)
            infobox = soup.find('table', {'class': 'infobox'})

            player_data = {'name': player_name, 'url': url}

            if infobox:
                rows = infobox.find_all('tr')
                for row in rows:
                    header = row.find('th')
                    data = row.find('td')
                    if header and data:
                        key = header.get_text().strip()
                        value = data.get_text().strip()
                        player_data[key] = value

            return player_data

        except Exception as e:
            print(f"Error scraping {player_name}: {e}")
            return {'name': player_name, 'error': str(e)}


def main():
    """Example usage"""
    scraper = WikiNFLScraper()

    # Example 1: Scrape undrafted players with 100+ career starts
    print("Example 1: Scraping undrafted players")
    undrafted_url = "https://en.wikipedia.org/wiki/List_of_undrafted_NFL_players_with_100_career_starts"
    undrafted_df = scraper.scrape_undrafted_players(undrafted_url)

    if undrafted_df is not None:
        print(f"Found {len(undrafted_df)} undrafted players")
        print(undrafted_df.head())

    # Example 2: Scrape free agents for a specific year
    print("\nExample 2: Scraping 2024 free agents")
    fa_df = scraper.scrape_free_agents_by_year(2024)

    if fa_df is not None:
        print(f"Found {len(fa_df)} free agents")
        print(fa_df.head())

    # Example 3: Get individual player data
    print("\nExample 3: Scraping individual player")
    player_data = scraper.scrape_player_career_stats("Kurt_Warner")
    print(player_data)


if __name__ == "__main__":
    main()
