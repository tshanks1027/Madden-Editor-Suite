"""Scrapers package"""
from .base_scraper import BaseScraper
from .sports_reference import SportsReferenceScraper
from .recruiting_scraper import RecruitingScraper

__all__ = [
    'BaseScraper',
    'SportsReferenceScraper',
    'RecruitingScraper',
]
