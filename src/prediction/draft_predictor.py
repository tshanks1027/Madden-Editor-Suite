"""
Draft position prediction based on recruiting rankings and college stats
"""
import random
from typing import List, Tuple
import logging

from ..models.prospect import Prospect

logger = logging.getLogger(__name__)


class DraftPredictor:
    """Predicts draft round and pick based on available data"""

    def __init__(self, config: dict):
        """
        Initialize predictor

        Args:
            config: Prediction configuration from config file
        """
        self.config = config
        self.weights = config.get('prediction', {})

        # Recruiting rank to draft round mapping
        self.recruiting_mapping = {
            5: (1, 1),    # 5-star: Round 1
            4: (1, 3),    # 4-star: Rounds 1-3
            3: (3, 7),    # 3-star: Rounds 3-7
            2: (5, 7),    # 2-star: Rounds 5-7
            1: (6, 7),    # 1-star: Rounds 6-7
        }

    def predict_draft_position(self, prospects: List[Prospect]) -> List[Prospect]:
        """
        Predict draft round and pick for all prospects

        Args:
            prospects: List of prospects to predict for

        Returns:
            Same list with predicted_round and predicted_pick populated
        """
        # Sort by predicted quality (for pick ordering)
        sorted_prospects = self._rank_prospects(prospects)

        # Assign draft positions
        current_pick = 1

        for prospect in sorted_prospects:
            round_num, confidence = self._predict_round(prospect)

            prospect.predicted_round = round_num
            prospect.predicted_pick = current_pick
            prospect.confidence_score = confidence

            # Increment pick counter
            current_pick += 1

            # Reset pick counter for display purposes (32 picks per round)
            if current_pick > 32:
                current_pick = 1

        logger.info(f"Predicted positions for {len(prospects)} prospects")
        return sorted_prospects

    def _rank_prospects(self, prospects: List[Prospect]) -> List[Prospect]:
        """
        Rank prospects by predicted quality

        Args:
            prospects: List of prospects

        Returns:
            Sorted list (best to worst)
        """
        def score_prospect(p: Prospect) -> float:
            """Calculate composite score for prospect"""
            score = 0.0

            # Recruiting ranking component
            if p.recruiting_stars:
                score += p.recruiting_stars * 20.0

            if p.recruiting_rating:
                score += p.recruiting_rating

            # Position value (some positions go earlier)
            position_values = {
                'QB': 1.2,
                'EDGE': 1.15,
                'CB': 1.1,
                'WR': 1.1,
                'LT': 1.1,
                'DT': 1.05,
            }
            score *= position_values.get(p.position, 1.0)

            # Add small random factor for variety
            score += random.uniform(-2, 2)

            return score

        # Sort by score (descending)
        return sorted(prospects, key=score_prospect, reverse=True)

    def _predict_round(self, prospect: Prospect) -> Tuple[int, float]:
        """
        Predict which round a prospect will be drafted

        Args:
            prospect: Prospect to predict for

        Returns:
            Tuple of (round_number, confidence_score)
        """
        # Default to late round
        predicted_round = 7
        confidence = 0.3

        # Use recruiting stars if available
        if prospect.recruiting_stars:
            min_round, max_round = self.recruiting_mapping.get(
                prospect.recruiting_stars,
                (6, 7)
            )

            # Pick a round within the range (favor earlier for higher stars)
            if prospect.recruiting_stars >= 4:
                # High recruits: favor earlier in range
                predicted_round = min_round
                confidence = 0.7
            else:
                # Lower recruits: middle of range
                predicted_round = (min_round + max_round) // 2
                confidence = 0.5

        # Adjust based on recruiting rating
        if prospect.recruiting_rating:
            if prospect.recruiting_rating >= 0.98:  # Elite
                predicted_round = min(predicted_round, 1)
                confidence = max(confidence, 0.8)
            elif prospect.recruiting_rating >= 0.95:  # High 4-star
                predicted_round = min(predicted_round, 2)
                confidence = max(confidence, 0.7)
            elif prospect.recruiting_rating >= 0.90:  # 4-star
                predicted_round = min(predicted_round, 3)
                confidence = max(confidence, 0.6)
            elif prospect.recruiting_rating >= 0.85:  # High 3-star
                predicted_round = min(predicted_round, 5)
                confidence = max(confidence, 0.5)

        # Adjust for position (some go earlier)
        premium_positions = ['QB', 'EDGE', 'CB', 'LT', 'WR']
        if prospect.position in premium_positions and predicted_round > 1:
            predicted_round = max(1, predicted_round - 1)
            confidence += 0.05

        # Add some randomness to avoid everyone in same round
        if random.random() < 0.3:  # 30% chance to vary by one round
            variation = random.choice([-1, 1])
            predicted_round = max(1, min(7, predicted_round + variation))
            confidence -= 0.1

        # Ensure round is valid (1-7)
        predicted_round = max(1, min(7, predicted_round))

        # Ensure confidence is valid (0-1)
        confidence = max(0.0, min(1.0, confidence))

        return predicted_round, confidence

    def distribute_picks_by_round(self, prospects: List[Prospect]) -> List[Prospect]:
        """
        Distribute prospects into appropriate rounds and assign pick numbers

        Args:
            prospects: List of prospects with predicted_round set

        Returns:
            List with realistic pick numbers assigned
        """
        # Group by round
        rounds = {i: [] for i in range(1, 8)}

        for prospect in prospects:
            round_num = prospect.predicted_round or 7
            rounds[round_num].append(prospect)

        # Assign pick numbers within each round
        overall_pick = 1

        for round_num in range(1, 8):
            round_prospects = rounds[round_num]

            for i, prospect in enumerate(round_prospects, 1):
                # Pick number within round (1-32)
                prospect.metadata['round_pick'] = i

                # Overall pick number
                prospect.predicted_pick = overall_pick
                overall_pick += 1

        return prospects
