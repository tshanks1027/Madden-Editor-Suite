"""
Base scraper class with common functionality
"""
from abc import ABC, abstractmethod
from typing import List, Optional, Dict, Any
import logging
from bs4 import BeautifulSoup

from ..utils.http_client import RateLimitedClient
from ..models.prospect import Prospect

logger = logging.getLogger(__name__)


class BaseScraper(ABC):
    """Abstract base class for all scrapers"""

    def __init__(self, config: Dict[str, Any], http_client: RateLimitedClient):
        """
        Initialize scraper

        Args:
            config: Configuration dictionary for this scraper
            http_client: Shared HTTP client instance
        """
        self.config = config
        self.client = http_client
        self.base_url = config.get('base_url', '')
        self.enabled = config.get('enabled', True)

    @abstractmethod
    def scrape_draft_class(self, year: int) -> List[Prospect]:
        """
        Scrape prospects for a specific draft class year

        Args:
            year: Draft class year (e.g., 2026)

        Returns:
            List of Prospect objects
        """
        pass

    def fetch_page(self, url: str) -> Optional[BeautifulSoup]:
        """
        Fetch and parse a web page

        Args:
            url: URL to fetch

        Returns:
            BeautifulSoup object or None if failed
        """
        response = self.client.get(url)

        if response is None:
            logger.error(f"Failed to fetch {url}")
            return None

        try:
            soup = BeautifulSoup(response.content, 'lxml')
            return soup
        except Exception as e:
            logger.error(f"Failed to parse {url}: {e}")
            return None

    @staticmethod
    def safe_find_text(element, selector: str, default: str = '') -> str:
        """
        Safely find text in an element

        Args:
            element: BeautifulSoup element to search
            selector: CSS selector
            default: Default value if not found

        Returns:
            Text content or default
        """
        if element is None:
            return default

        found = element.select_one(selector)
        if found:
            return found.get_text(strip=True)
        return default

    @staticmethod
    def safe_find_attr(element, selector: str, attr: str, default: str = '') -> str:
        """
        Safely find attribute in an element

        Args:
            element: BeautifulSoup element to search
            selector: CSS selector
            attr: Attribute name
            default: Default value if not found

        Returns:
            Attribute value or default
        """
        if element is None:
            return default

        found = element.select_one(selector)
        if found:
            return found.get(attr, default)
        return default

    def log_progress(self, message: str, level: str = 'info'):
        """Log progress message"""
        if level == 'info':
            logger.info(f"[{self.__class__.__name__}] {message}")
        elif level == 'warning':
            logger.warning(f"[{self.__class__.__name__}] {message}")
        elif level == 'error':
            logger.error(f"[{self.__class__.__name__}] {message}")
        else:
            logger.debug(f"[{self.__class__.__name__}] {message}")
