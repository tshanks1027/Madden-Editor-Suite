"""
HTTP client with rate limiting and retry logic
"""
import time
import random
import logging
from typing import Optional, Dict
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from fake_useragent import UserAgent

logger = logging.getLogger(__name__)


class RateLimitedClient:
    """HTTP client with rate limiting and smart retry logic"""

    def __init__(
        self,
        rate_limit_seconds: float = 2.0,
        timeout: int = 30,
        max_retries: int = 3,
        user_agent_rotation: bool = True
    ):
        self.rate_limit_seconds = rate_limit_seconds
        self.timeout = timeout
        self.max_retries = max_retries
        self.user_agent_rotation = user_agent_rotation
        self.last_request_time = 0

        # Initialize user agent
        self.ua = UserAgent() if user_agent_rotation else None

        # Setup session with retry strategy
        self.session = self._create_session()

    def _create_session(self) -> requests.Session:
        """Create a requests session with retry logic"""
        session = requests.Session()

        # Retry strategy
        retry_strategy = Retry(
            total=self.max_retries,
            backoff_factor=1,
            status_forcelist=[429, 500, 502, 503, 504],
            allowed_methods=["HEAD", "GET", "OPTIONS"]
        )

        adapter = HTTPAdapter(max_retries=retry_strategy)
        session.mount("http://", adapter)
        session.mount("https://", adapter)

        return session

    def _get_headers(self) -> Dict[str, str]:
        """Get headers with optional user agent rotation"""
        headers = {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1'
        }

        if self.user_agent_rotation and self.ua:
            headers['User-Agent'] = self.ua.random
        else:
            headers['User-Agent'] = 'Mozilla/5.0 (Madden Draft Prospect Scraper/1.0)'

        return headers

    def _wait_for_rate_limit(self):
        """Enforce rate limiting between requests"""
        current_time = time.time()
        time_since_last_request = current_time - self.last_request_time

        if time_since_last_request < self.rate_limit_seconds:
            sleep_time = self.rate_limit_seconds - time_since_last_request
            # Add small random jitter to avoid patterns
            sleep_time += random.uniform(0, 0.5)
            time.sleep(sleep_time)

        self.last_request_time = time.time()

    def get(self, url: str, **kwargs) -> Optional[requests.Response]:
        """
        Make a GET request with rate limiting and error handling

        Args:
            url: URL to fetch
            **kwargs: Additional arguments to pass to requests.get

        Returns:
            Response object or None if failed
        """
        self._wait_for_rate_limit()

        # Merge headers
        headers = self._get_headers()
        if 'headers' in kwargs:
            headers.update(kwargs['headers'])
        kwargs['headers'] = headers

        # Set timeout
        if 'timeout' not in kwargs:
            kwargs['timeout'] = self.timeout

        try:
            logger.debug(f"Fetching: {url}")
            response = self.session.get(url, **kwargs)
            response.raise_for_status()
            return response

        except requests.exceptions.HTTPError as e:
            logger.error(f"HTTP error fetching {url}: {e}")
            return None

        except requests.exceptions.ConnectionError as e:
            logger.error(f"Connection error fetching {url}: {e}")
            return None

        except requests.exceptions.Timeout as e:
            logger.error(f"Timeout fetching {url}: {e}")
            return None

        except Exception as e:
            logger.error(f"Unexpected error fetching {url}: {e}")
            return None

    def close(self):
        """Close the session"""
        self.session.close()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()
