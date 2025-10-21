"""
Utility functions for mapping and normalizing scraped data
"""
import re
from typing import Optional, Dict, Any
import logging

logger = logging.getLogger(__name__)


class DataMapper:
    """Maps scraped data to standardized format"""

    def __init__(self, position_mapping: Dict[str, str]):
        self.position_mapping = position_mapping

    def normalize_position(self, position: str) -> Optional[str]:
        """
        Normalize position to Madden format

        Args:
            position: Raw position string from source

        Returns:
            Normalized position or None
        """
        if not position:
            return None

        # Clean up position string
        pos = position.strip().upper()

        # Handle composite positions (e.g., "OLB/DE")
        if '/' in pos:
            pos = pos.split('/')[0]

        return self.position_mapping.get(pos, pos)

    @staticmethod
    def parse_height(height_str: str) -> Optional[str]:
        """
        Parse height string to standard format

        Args:
            height_str: Height in various formats (6'2", 6-2, 74 inches, etc.)

        Returns:
            Height in format "F-I" (feet-inches) or None
        """
        if not height_str:
            return None

        # Try format: 6'2" or 6'2
        match = re.search(r"(\d+)'(\d+)", height_str)
        if match:
            feet, inches = match.groups()
            return f"{feet}-{inches}"

        # Try format: 6-2
        match = re.search(r"(\d+)-(\d+)", height_str)
        if match:
            return height_str.strip()

        # Try format: 74 (total inches)
        match = re.search(r"^(\d+)$", height_str.strip())
        if match:
            total_inches = int(match.group(1))
            feet = total_inches // 12
            inches = total_inches % 12
            return f"{feet}-{inches}"

        logger.warning(f"Could not parse height: {height_str}")
        return None

    @staticmethod
    def parse_weight(weight_str: str) -> Optional[int]:
        """
        Parse weight string to integer

        Args:
            weight_str: Weight string (e.g., "215 lbs", "215")

        Returns:
            Weight in pounds or None
        """
        if not weight_str:
            return None

        # Extract numeric value
        match = re.search(r"(\d+)", str(weight_str))
        if match:
            return int(match.group(1))

        logger.warning(f"Could not parse weight: {weight_str}")
        return None

    @staticmethod
    def parse_stars(rating_str: str) -> Optional[int]:
        """
        Parse recruiting star rating

        Args:
            rating_str: Star rating string

        Returns:
            Number of stars (1-5) or None
        """
        if not rating_str:
            return None

        # Look for number followed by "star" or just a number 1-5
        match = re.search(r"(\d+)[- ]?(?:star)?", rating_str.lower())
        if match:
            stars = int(match.group(1))
            if 1 <= stars <= 5:
                return stars

        # Count star symbols
        star_count = rating_str.count('★') + rating_str.count('*')
        if 1 <= star_count <= 5:
            return star_count

        return None

    @staticmethod
    def clean_name(name: str) -> str:
        """
        Clean and normalize name

        Args:
            name: Raw name string

        Returns:
            Cleaned name
        """
        if not name:
            return ""

        # Remove extra whitespace
        name = re.sub(r'\s+', ' ', name.strip())

        # Remove special characters but keep hyphens and apostrophes
        name = re.sub(r"[^a-zA-Z\s\-']", '', name)

        return name.strip()

    @staticmethod
    def extract_state(location_str: str) -> Optional[str]:
        """
        Extract state from location string

        Args:
            location_str: Location string (e.g., "Miami, FL")

        Returns:
            State abbreviation or None
        """
        if not location_str:
            return None

        # Common state abbreviations pattern
        match = re.search(r'\b([A-Z]{2})\b', location_str)
        if match:
            state = match.group(1)
            # Verify it's a valid state (basic check)
            valid_states = [
                'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
                'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
                'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
                'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
                'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC'
            ]
            if state in valid_states:
                return state

        return None

    def map_prospect_data(self, raw_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Map raw scraped data to prospect model format

        Args:
            raw_data: Dictionary of raw scraped data

        Returns:
            Dictionary with normalized field names and values
        """
        mapped = {}

        # Name fields
        if 'name' in raw_data:
            name_parts = self.clean_name(raw_data['name']).split(maxsplit=1)
            if len(name_parts) == 2:
                mapped['first_name'] = name_parts[0]
                mapped['last_name'] = name_parts[1]

        if 'first_name' in raw_data:
            mapped['first_name'] = self.clean_name(raw_data['first_name'])
        if 'last_name' in raw_data:
            mapped['last_name'] = self.clean_name(raw_data['last_name'])

        # Position
        if 'position' in raw_data:
            mapped['position'] = self.normalize_position(raw_data['position'])

        # Physical attributes
        if 'height' in raw_data:
            mapped['height'] = self.parse_height(raw_data['height'])
        if 'weight' in raw_data:
            mapped['weight'] = self.parse_weight(raw_data['weight'])

        # College
        if 'college' in raw_data:
            mapped['college'] = raw_data['college'].strip()
        if 'school' in raw_data:
            mapped['college'] = raw_data['school'].strip()

        # Location
        if 'hometown' in raw_data:
            mapped['home_state'] = self.extract_state(raw_data['hometown'])
        if 'location' in raw_data:
            mapped['home_state'] = self.extract_state(raw_data['location'])

        # Recruiting
        if 'stars' in raw_data:
            mapped['recruiting_stars'] = self.parse_stars(str(raw_data['stars']))
        if 'rating' in raw_data:
            try:
                mapped['recruiting_rating'] = float(raw_data['rating'])
            except (ValueError, TypeError):
                pass

        # Images
        if 'image_url' in raw_data:
            mapped['wiki_image_url'] = raw_data['image_url']
        if 'photo_url' in raw_data:
            mapped['wiki_image_url'] = raw_data['photo_url']

        # Copy other fields directly
        direct_fields = ['draft_class', 'round', 'pick']
        for field in direct_fields:
            if field in raw_data:
                mapped[field] = raw_data[field]

        return mapped
