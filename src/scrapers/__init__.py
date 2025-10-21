"""Scrapers package"""
from .base_scraper import BaseScraper
from .sports_reference import SportsReferenceScraper
from .recruiting_scraper import RecruitingScraper
from .wikipedia_draft_scraper import WikipediaDraftScraper

__all__ = [
    'BaseScraper',
    'SportsReferenceScraper',
    'RecruitingScraper',
    'WikipediaDraftScraper',
]
