"""
Data model for NFL Draft Prospects
"""
from dataclasses import dataclass, field, asdict
from typing import Optional, Dict, Any
import hashlib


@dataclass
class Prospect:
    """Represents an NFL draft prospect with all relevant data"""

    # Required fields
    last_name: str
    first_name: str
    college: str
    draft_class: int
    position: str

    # Draft information
    round: Optional[int] = None
    pick: Optional[int] = None

    # Physical attributes
    height: Optional[str] = None  # Format: "6-2"
    weight: Optional[int] = None

    # Identifiers and images
    photo_id: Optional[str] = None
    player_assets_id: Optional[str] = None
    comm_id: Optional[str] = None
    wiki_image_url: Optional[str] = None
    pfr_image_url: Optional[str] = None

    # Career information
    from_year: Optional[int] = None
    to_year: Optional[int] = None

    # Honors and achievements
    ap1: Optional[int] = None  # All-Pro First Team
    pb: Optional[int] = None   # Pro Bowl
    st: Optional[int] = None   # Special Teams
    wav: Optional[float] = None  # Weighted Approximate Value

    # Demographics
    league: Optional[str] = None
    race: Optional[str] = None
    home_state: Optional[str] = None

    # Internal tracking
    plpo: Optional[str] = None

    # Prediction metadata
    predicted_round: Optional[int] = None
    predicted_pick: Optional[int] = None
    confidence_score: Optional[float] = None
    recruiting_rating: Optional[float] = None
    recruiting_stars: Optional[int] = None

    # Additional data
    metadata: Dict[str, Any] = field(default_factory=dict)

    def __post_init__(self):
        """Generate photo_id if image URL is available"""
        if self.wiki_image_url and not self.photo_id:
            self.photo_id = self._generate_photo_id(self.wiki_image_url)

    @staticmethod
    def _generate_photo_id(url: str) -> str:
        """Generate a unique photo ID from image URL"""
        return hashlib.md5(url.encode()).hexdigest()[:12]

    def to_dict(self) -> Dict[str, Any]:
        """Convert prospect to dictionary"""
        data = asdict(self)
        # Remove metadata from output
        data.pop('metadata', None)
        return data

    def to_csv_row(self) -> Dict[str, Any]:
        """Convert to CSV row format matching the schema"""
        return {
            'Last Name': self.last_name,
            'First Name': self.first_name,
            'College/Univ': self.college,
            'Round': self.round or self.predicted_round,
            'Pick': self.pick or self.predicted_pick,
            'Draft Class': self.draft_class,
            'Position': self.position,
            'PhotoID': self.photo_id,
            'Player Assets ID': self.player_assets_id,
            'CommID': self.comm_id,
            'PLPO': self.plpo,
            'Height': self.height,
            'Weight': self.weight,
            'From': self.from_year,
            'To': self.to_year,
            'AP1': self.ap1,
            'PB': self.pb,
            'St': self.st,
            'wAV': self.wav,
            'League': self.league,
            'Race': self.race,
            'Home State': self.home_state,
            'Wiki_Image_URL': self.wiki_image_url,
            'PFR_Image_URL': self.pfr_image_url,
        }

    def update_from_dict(self, data: Dict[str, Any]):
        """Update prospect fields from dictionary"""
        for key, value in data.items():
            if hasattr(self, key) and value is not None:
                setattr(self, key, value)

    def merge_data(self, other_data: Dict[str, Any], overwrite: bool = False):
        """
        Merge data from another source

        Args:
            other_data: Dictionary of field values
            overwrite: Whether to overwrite existing non-None values
        """
        for key, value in other_data.items():
            if hasattr(self, key) and value is not None:
                current_value = getattr(self, key)
                if current_value is None or overwrite:
                    setattr(self, key, value)

    @property
    def full_name(self) -> str:
        """Get full name"""
        return f"{self.first_name} {self.last_name}"

    @property
    def is_complete(self) -> bool:
        """Check if all required fields are populated"""
        required = [self.last_name, self.first_name, self.college,
                   self.draft_class, self.position]
        return all(required)

    def __repr__(self) -> str:
        return (f"Prospect(name='{self.full_name}', "
                f"college='{self.college}', "
                f"position='{self.position}', "
                f"class={self.draft_class})")
