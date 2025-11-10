/**
 * Variance Rating Generator
 *
 * Uses formula-based rating generation with draft rating caps (Rowdy Randy's tools).
 * Features:
 * - Draft rating guidelines by round/pick (Round 1 = 77-84 OVR, Round 7 = 62-67 OVR)
 * - Speed calculator from 40-yard dash time
 * - Archetype rating templates via MaddenFormulaCalculator
 * - Position-specific attribute generation
 */

import { IRatingGenerator, RatingContext, PlayerRatings } from './IRatingGenerator';
import { MaddenFormulaCalculator } from './MaddenFormulaCalculator';
import { playerDataService } from '../generator/PlayerDataService';

/**
 * Draft rating guidelines by round (OVR ranges)
 * Widened ranges to allow for proper variance and outliers
 */
const DRAFT_RATING_CAPS = {
  1: { min: 72, max: 89 },  // Top picks can be difference-makers
  2: { min: 69, max: 82 },  // Solid starters
  3: { min: 66, max: 78 },  // Quality depth
  4: { min: 64, max: 75 },  // Developmental players
  5: { min: 62, max: 73 },
  6: { min: 60, max: 71 },
  7: { min: 58, max: 69 },
  // Rounds 8-12+ (for historical drafts with more rounds)
  8: { min: 56, max: 67 },
  9: { min: 54, max: 65 },
  10: { min: 52, max: 63 },
  default: { min: 50, max: 70 } // For undrafted/late rounds
};

interface AttributeRange {
  min: number;
  max: number;
  weight?: number; // Importance weight for variance
}

export class VarianceRatingGenerator implements IRatingGenerator {
  private formulaCalculator: MaddenFormulaCalculator;

  constructor() {
    this.formulaCalculator = new MaddenFormulaCalculator();
  }

  getName(): string {
    return 'Variance';
  }

  async generateRatings(context: RatingContext): Promise<PlayerRatings> {
    // Try to fetch actual rookie stats (including AV) to determine OVR
    // This makes late-round gems with high rookie performance viable picks
    let rookieAV: number | undefined;

    if (context.name && context.careerStats?.draftClass) {
      // Use singleton instance - no need to create new instance or initialize each time
      const rookieStats = await playerDataService.getRookieStats(
        context.name,
        context.careerStats.draftClass
      );

      if (rookieStats) {
        rookieAV = rookieStats.av;
      }
    }

    // Step 1: Generate base physical attributes
    const baseAttributes = this.generateBaseAttributes(context);

    // Step 2: Apply speed calculator if 40-time is available
    if (context.fortyTime) {
      const calculatedSpeed = this.calculateSpeedFrom40Time(context.fortyTime);
      baseAttributes.PSPD = calculatedSpeed;
      // Acceleration is typically 95-100% of speed
      baseAttributes.PACC = Math.min(99, Math.round(calculatedSpeed * 0.975));
    }

    // Step 3: Generate position-specific attributes
    const allAttributes = this.generatePositionAttributes(context.position, baseAttributes);

    // Step 4: Apply archetype rating template if available
    let ratings: PlayerRatings;
    if (this.formulaCalculator.isInitialized() && context.position) {
      // Use formulas to calculate derived ratings
      ratings = this.applyArchetypeTemplate(context.position, allAttributes);
    } else {
      // Fallback to direct attributes
      ratings = allAttributes as PlayerRatings;
    }

    // Step 5: Calculate OVR with VARIANCE MODE logic
    // VARIANCE MODE creates draft-time ratings that reflect potential/scouting variance
    // We DON'T want to use actual career performance because that removes all uncertainty
    // Instead: use career/rookie data to INFORM the range, but add realistic variance

    if (context.careerStats?.wAV !== undefined && context.careerStats.wAV !== null) {
      // Use career wAV to determine talent tier, then apply variance
      ratings.POVR = this.calculateVarianceOVR(
        context.careerStats.wAV,
        context.position,
        context.draftRound,
        context.draftPosition,
        context.careerStats?.archetype
      );

      if (context.draftPosition && context.draftPosition <= 10) {
        console.log(`[VarianceRatingGenerator] ${context.name}: wAV=${context.careerStats.wAV}, OVR=${ratings.POVR}, Round=${context.draftRound}, Pick=${context.draftPosition}`);
      }
    } else {
      // No performance data: use attribute-based calculation with draft caps
      ratings.POVR = this.calculatePositionOVR(ratings, context.position);

      if (context.draftRound) {
        ratings.POVR = this.applyDraftRatingCap(ratings.POVR, context.draftRound, context.draftPosition);
      }
    }

    return ratings;
  }

  /**
   * Generate base physical attributes (SPD, ACC, AGI, STR, etc.)
   */
  private generateBaseAttributes(context: RatingContext): Partial<PlayerRatings> {
    // Base attributes with position-adjusted ranges
    const positionModifiers = this.getPositionModifiers(context.position);

    return {
      PSPD: this.randomInRange(60, 95, positionModifiers.speed),
      PACC: this.randomInRange(65, 95, positionModifiers.acceleration),
      PAGI: this.randomInRange(60, 90, positionModifiers.agility),
      PSTR: this.randomInRange(50, 90, positionModifiers.strength),
      PJMP: this.randomInRange(50, 85),
      PSTA: this.randomInRange(80, 99),
      PINJ: this.randomInRange(70, 99),
      PTGH: this.randomInRange(70, 95),
      PAWR: this.randomInRange(50, 85)
    };
  }

  /**
   * Get position-specific modifiers for attribute generation
   */
  private getPositionModifiers(position: string): {
    speed: number;
    acceleration: number;
    agility: number;
    strength: number;
  } {
    // Speed positions (CB, WR, HB, FS)
    if (['CB', 'WR', 'HB', 'FS'].includes(position)) {
      return { speed: 10, acceleration: 10, agility: 8, strength: 0 };
    }

    // Strength positions (DT, OL, TE)
    if (['DT', 'NT', 'LT', 'LG', 'C', 'RG', 'RT', 'TE'].includes(position)) {
      return { speed: -5, acceleration: -5, agility: -5, strength: 10 };
    }

    // Agility positions (QB, EDGE, LB)
    if (['QB', 'LEDG', 'REDG', 'SAM', 'Mike', 'WILL', 'SS'].includes(position)) {
      return { speed: 5, acceleration: 5, agility: 5, strength: 5 };
    }

    // Default (balanced)
    return { speed: 0, acceleration: 0, agility: 0, strength: 0 };
  }

  /**
   * Generate position-specific attributes (QB passing, HB carrying, etc.)
   */
  private generatePositionAttributes(
    position: string,
    baseAttributes: Partial<PlayerRatings>
  ): Partial<PlayerRatings> {
    const attributes = { ...baseAttributes };

    switch (position) {
      case 'QB':
        attributes.PTAD = this.randomInRange(55, 90);
        attributes.PTAM = this.randomInRange(60, 92);
        attributes.PTAS = this.randomInRange(65, 95);
        attributes.PTHP = this.randomInRange(70, 95);
        attributes.PTUP = this.randomInRange(55, 88);
        attributes.PTOR = this.randomInRange(50, 85);
        attributes.PPLA = this.randomInRange(60, 90);
        attributes.PBSK = this.randomInRange(50, 80);
        break;

      case 'HB':
      case 'FB':
        attributes.PCAR = this.randomInRange(65, 95);
        attributes.PBCV = this.randomInRange(60, 92);
        attributes.PBKT = this.randomInRange(50, 90);
        attributes.PLTR = this.randomInRange(45, 88);
        attributes.PLJM = this.randomInRange(60, 92);
        attributes.PLSM = this.randomInRange(60, 92);
        attributes.PLSA = this.randomInRange(45, 85);
        attributes.PELU = this.randomInRange(75, 95);
        attributes.PCTH = this.randomInRange(40, 75);
        attributes.PRBK = position === 'FB' ? this.randomInRange(60, 85) : this.randomInRange(25, 55);
        attributes.PPBK = position === 'FB' ? this.randomInRange(55, 80) : this.randomInRange(20, 50);
        break;

      case 'WR':
        attributes.PCTH = this.randomInRange(65, 95);
        attributes.PLCI = this.randomInRange(60, 92);
        attributes.PLSC = this.randomInRange(55, 90);
        attributes.PLRL = this.randomInRange(60, 92);
        attributes.PDRR = this.randomInRange(60, 92);
        attributes.PMRR = this.randomInRange(65, 93);
        attributes.SRRN = this.randomInRange(65, 93);
        attributes.PRBK = this.randomInRange(30, 60);
        break;

      case 'TE':
        attributes.PCTH = this.randomInRange(60, 88);
        attributes.PLCI = this.randomInRange(55, 85);
        attributes.PLSC = this.randomInRange(50, 80);
        attributes.PLRL = this.randomInRange(55, 85);
        attributes.PRBK = this.randomInRange(55, 85);
        attributes.PPBK = this.randomInRange(50, 82);
        break;

      case 'LT':
      case 'RT':
      case 'LG':
      case 'RG':
      case 'C':
        attributes.PRBK = this.randomInRange(60, 90);
        attributes.PPBK = this.randomInRange(60, 90);
        attributes.PLIB = this.randomInRange(50, 80);
        attributes.PLBK = this.randomInRange(45, 75);
        attributes.PRBF = this.randomInRange(55, 85);
        attributes.PRBS = this.randomInRange(55, 85);
        attributes.PPBF = this.randomInRange(55, 85);
        attributes.PPBS = this.randomInRange(55, 85);
        break;

      case 'LEDG':
      case 'REDG':
        attributes.PFMS = this.randomInRange(60, 92);
        attributes.PLPM = this.randomInRange(55, 88);
        attributes.PBSG = this.randomInRange(55, 88);
        attributes.PTAK = this.randomInRange(50, 82);
        attributes.PLPU = this.randomInRange(60, 88);
        attributes.PLPR = this.randomInRange(45, 78);
        break;

      case 'DT':
      case 'NT':
        attributes.PBSG = this.randomInRange(65, 92);
        attributes.PLPM = this.randomInRange(60, 90);
        attributes.PFMS = this.randomInRange(45, 75);
        attributes.PTAK = this.randomInRange(55, 85);
        attributes.PLPU = this.randomInRange(55, 82);
        attributes.PLPR = this.randomInRange(45, 75);
        break;

      case 'SAM':
      case 'Mike':
      case 'WILL':
        attributes.PTAK = this.randomInRange(65, 92);
        attributes.PLPU = this.randomInRange(60, 90);
        attributes.PLPR = this.randomInRange(55, 88);
        attributes.PLMC = this.randomInRange(45, 78);
        attributes.PLZC = this.randomInRange(50, 82);
        attributes.PLHT = this.randomInRange(55, 85);
        attributes.PBSG = this.randomInRange(50, 80);
        break;

      case 'CB':
        attributes.PLMC = this.randomInRange(60, 92);
        attributes.PLZC = this.randomInRange(55, 88);
        attributes.PLPE = this.randomInRange(60, 90);
        attributes.PTAK = this.randomInRange(40, 70);
        attributes.PLPU = this.randomInRange(50, 80);
        attributes.PLPR = this.randomInRange(45, 75);
        break;

      case 'FS':
      case 'SS':
        attributes.PLZC = this.randomInRange(60, 90);
        attributes.PLMC = this.randomInRange(50, 82);
        attributes.PLPR = this.randomInRange(55, 85);
        attributes.PTAK = position === 'SS' ? this.randomInRange(60, 88) : this.randomInRange(50, 78);
        attributes.PLHT = position === 'SS' ? this.randomInRange(60, 88) : this.randomInRange(45, 75);
        attributes.PLPU = this.randomInRange(60, 88);
        break;

      case 'K':
      case 'P':
        attributes.PKAC = this.randomInRange(65, 95);
        attributes.PKPR = this.randomInRange(70, 95);
        break;

      case 'LS':
        // Long snapper is mostly strength/awareness
        attributes.PSTR = this.randomInRange(70, 90);
        attributes.PAWR = this.randomInRange(70, 90);
        break;
    }

    return attributes;
  }

  /**
   * Apply archetype rating template using MaddenFormulaCalculator
   */
  private applyArchetypeTemplate(
    position: string,
    attributes: Partial<PlayerRatings>
  ): PlayerRatings {
    // The formula calculator can derive secondary ratings from primary attributes
    // For now, just return attributes as-is
    // TODO: Integrate archetype-specific formula application
    return attributes as PlayerRatings;
  }

  /**
   * Calculate position-specific OVR
   */
  private calculatePositionOVR(ratings: Partial<PlayerRatings>, position: string): number {
    const keyAttrs = this.getKeyAttributes(position);
    const values = keyAttrs
      .map(attr => ratings[attr as keyof PlayerRatings] || 0)
      .filter(v => v > 0);

    if (values.length === 0) return 65;

    const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
    return Math.round(avg);
  }

  /**
   * Get key attributes for OVR calculation by position
   */
  private getKeyAttributes(position: string): string[] {
    const keyAttrsByPosition: { [key: string]: string[] } = {
      'QB': ['PTAD', 'PTAM', 'PTAS', 'PTHP', 'PAWR', 'PTUP'],
      'HB': ['PSPD', 'PACC', 'PAGI', 'PCAR', 'PBCV', 'PBKT', 'PELU'],
      'FB': ['PRBK', 'PPBK', 'PSTR', 'PBKT', 'PLTR'],
      'WR': ['PSPD', 'PACC', 'PCTH', 'PLCI', 'PDRR', 'PMRR', 'SRRN'],
      'TE': ['PCTH', 'PLCI', 'PRBK', 'PPBK', 'PSTR', 'PAWR'],
      'LT': ['PRBK', 'PPBK', 'PSTR', 'PAWR', 'PAGI'],
      'LG': ['PRBK', 'PPBK', 'PSTR', 'PAWR'],
      'C': ['PRBK', 'PPBK', 'PSTR', 'PAWR'],
      'RG': ['PRBK', 'PPBK', 'PSTR', 'PAWR'],
      'RT': ['PRBK', 'PPBK', 'PSTR', 'PAWR', 'PAGI'],
      'LEDG': ['PFMS', 'PLPM', 'PBSG', 'PTAK', 'PAWR', 'PLPU'],
      'REDG': ['PFMS', 'PLPM', 'PBSG', 'PTAK', 'PAWR', 'PLPU'],
      'DT': ['PBSG', 'PLPM', 'PSTR', 'PTAK', 'PAWR'],
      'NT': ['PBSG', 'PLPM', 'PSTR', 'PTAK', 'PAWR'],
      'SAM': ['PTAK', 'PLPU', 'PLPR', 'PLMC', 'PLZC', 'PBSG'],
      'Mike': ['PTAK', 'PLPU', 'PLPR', 'PLMC', 'PLZC'],
      'WILL': ['PTAK', 'PLPU', 'PLPR', 'PLMC', 'PLZC', 'PSPD'],
      'CB': ['PSPD', 'PACC', 'PAGI', 'PLMC', 'PLZC', 'PLPE'],
      'FS': ['PSPD', 'PACC', 'PLZC', 'PLPR', 'PTAK', 'PLPU'],
      'SS': ['PTAK', 'PLHT', 'PLZC', 'PLPR', 'PSPD', 'PLPU'],
      'K': ['PKAC', 'PKPR'],
      'P': ['PKAC', 'PKPR'],
      'LS': ['PSTR', 'PAWR']
    };

    return keyAttrsByPosition[position] || ['PSPD', 'PSTR', 'PAWR'];
  }

  /**
   * Calculate OVR using VARIANCE MODE approach
   * Creates realistic draft-time ratings with scouting variance
   *
   * Philosophy:
   * - Use career wAV to determine player's talent tier
   * - Apply realistic draft-time uncertainty (busts, reaches, steals)
   * - Respect draft round caps but allow outliers
   * - Create a realistic distribution within each round
   *
   * @param careerWAV - Career weighted Approximate Value
   * @param position - Player position
   * @param draftRound - Round drafted
   * @param draftPosition - Overall pick number
   * @param archetype - Player archetype (optional)
   */
  private calculateVarianceOVR(
    careerWAV: number,
    position: string,
    draftRound?: number,
    draftPosition?: number,
    archetype?: string
  ): number {
    // Get the rating cap for this round
    const cap = draftRound
      ? (DRAFT_RATING_CAPS[draftRound as keyof typeof DRAFT_RATING_CAPS] || DRAFT_RATING_CAPS.default)
      : DRAFT_RATING_CAPS.default;

    // Determine talent tier from career wAV
    // This gives us a base expectation, but we'll add variance
    let talentTier: number;
    if (careerWAV >= 100) {
      talentTier = 5; // Elite talent (HOF level)
    } else if (careerWAV >= 70) {
      talentTier = 4; // Star talent (Pro Bowl)
    } else if (careerWAV >= 40) {
      talentTier = 3; // Above average (quality starter)
    } else if (careerWAV >= 20) {
      talentTier = 2; // Average (rotational/depth)
    } else if (careerWAV >= 5) {
      talentTier = 1; // Below average (backup)
    } else {
      talentTier = 0; // Bust/minimal impact
    }

    // Map talent tier to OVR range (with overlap to create variance)
    let baseMin: number, baseMax: number;
    switch (talentTier) {
      case 5: // Elite
        baseMin = 82;
        baseMax = 92;
        break;
      case 4: // Star
        baseMin = 76;
        baseMax = 86;
        break;
      case 3: // Above average
        baseMin = 71;
        baseMax = 80;
        break;
      case 2: // Average
        baseMin = 66;
        baseMax = 75;
        break;
      case 1: // Below average
        baseMin = 60;
        baseMax = 69;
        break;
      default: // Bust
        baseMin = 55;
        baseMax = 63;
        break;
    }

    // Apply scouting variance (±6 points) to simulate draft uncertainty
    // Some players are "reaches" (rated higher than career suggests)
    // Some are "steals" (rated lower but will outperform)
    const scoutingVariance = Math.floor((Math.random() - 0.5) * 12); // -6 to +6

    // Use bell curve for base rating within tier
    const tierRange = baseMax - baseMin;
    const bellCurveRandom = (Math.random() + Math.random()) / 2;
    let baseOVR = Math.round(baseMin + (tierRange * bellCurveRandom));

    // Apply variance
    baseOVR += scoutingVariance;

    // Apply draft position modifier (earlier picks get small boost)
    if (draftPosition) {
      if (draftPosition <= 5) {
        baseOVR += 2; // Top 5 picks
      } else if (draftPosition <= 10) {
        baseOVR += 1; // Top 10 picks
      }
    }

    // Ensure we stay within the round's cap (but allow some flexibility)
    // Allow players to exceed cap by up to 3 points (the "steal" picks)
    // Or fall below cap by up to 5 points (the "bust" picks)
    const flexibleMin = Math.max(55, cap.min - 5);
    const flexibleMax = Math.min(92, cap.max + 3);

    const finalOVR = Math.max(flexibleMin, Math.min(flexibleMax, baseOVR));

    return finalOVR;
  }

  /**
   * Estimate rookie year AV from career weighted AV (wAV)
   * Uses career value to predict rookie performance with variance
   *
   * Formula considers:
   * - Career wAV (total career value)
   * - Draft round (earlier picks tend to contribute more as rookies)
   * - Natural variance (some rookies boom/bust)
   */
  private estimateRookieAVFromCareer(careerWAV: number, draftRound?: number): number {
    if (careerWAV === 0) return 0;

    // Base estimate: rookies typically produce 15-25% of their career value in year 1
    // Great careers (100+ wAV): ~15-20% (they develop over time)
    // Good careers (50-99 wAV): ~20-25%
    // Short careers (<50 wAV): ~25-35% (they peaked early or got injured)

    let rookiePercentage: number;
    if (careerWAV >= 100) {
      rookiePercentage = 0.15 + Math.random() * 0.05; // 15-20%
    } else if (careerWAV >= 50) {
      rookiePercentage = 0.20 + Math.random() * 0.05; // 20-25%
    } else if (careerWAV >= 20) {
      rookiePercentage = 0.22 + Math.random() * 0.08; // 22-30%
    } else {
      rookiePercentage = 0.25 + Math.random() * 0.10; // 25-35%
    }

    // Draft round modifier: early picks tend to start strong
    if (draftRound) {
      if (draftRound === 1) {
        rookiePercentage *= 1.2; // Round 1 picks contribute 20% more as rookies
      } else if (draftRound === 2) {
        rookiePercentage *= 1.1; // Round 2 picks contribute 10% more
      } else if (draftRound >= 5) {
        rookiePercentage *= 0.85; // Late rounders take time to develop
      }
    }

    const estimatedAV = Math.round(careerWAV * rookiePercentage);

    // Cap at reasonable rookie maximum (even the best rookies rarely exceed 18 AV)
    return Math.min(18, Math.max(0, estimatedAV));
  }

  /**
   * Calculate OVR from rookie year Approximate Value (AV)
   * This method creates scouting variance by basing ratings on actual performance
   * Late round picks with high AV become valuable finds
   *
   * AV Scale (rookie year):
   * - 0-2:  Bust/minimal impact (60-68 OVR)
   * - 3-5:  Depth player (69-74 OVR)
   * - 6-8:  Rotational starter (75-79 OVR)
   * - 9-11: Quality starter (80-84 OVR)
   * - 12-14: Pro Bowl level (85-88 OVR)
   * - 15+:  Elite/All-Pro (89-92 OVR)
   */
  private calculateOVRFromAV(av: number, position: string, draftRound?: number): number {
    // Base OVR from AV (linear mapping with some randomness)
    let baseOVR: number;

    if (av === 0) {
      // Complete bust - very low rating
      baseOVR = this.randomInRange(55, 63);
    } else if (av <= 2) {
      // Minimal impact
      baseOVR = this.randomInRange(60, 68);
    } else if (av <= 5) {
      // Depth player
      baseOVR = this.randomInRange(69, 74);
    } else if (av <= 8) {
      // Rotational starter
      baseOVR = this.randomInRange(75, 79);
    } else if (av <= 11) {
      // Quality starter
      baseOVR = this.randomInRange(80, 84);
    } else if (av <= 14) {
      // Pro Bowl level
      baseOVR = this.randomInRange(85, 88);
    } else {
      // Elite/All-Pro
      baseOVR = this.randomInRange(89, 92);
    }

    // Add slight position-based adjustment (QBs/edge rushers get small boost)
    if (['QB', 'LEDG', 'REDG'].includes(position) && av >= 9) {
      baseOVR += 1;
    }

    // Clamp to valid range
    return Math.max(55, Math.min(99, Math.round(baseOVR)));
  }

  /**
   * Apply draft rating cap based on round (only used when no performance data available)
   * Uses a normal distribution within the cap range to create realistic variance
   */
  private applyDraftRatingCap(
    calculatedOVR: number,
    round: number,
    position?: number
  ): number {
    const cap = DRAFT_RATING_CAPS[round as keyof typeof DRAFT_RATING_CAPS] || DRAFT_RATING_CAPS.default;

    // Use the full range with weighted random distribution
    // This creates more variance than fixed targets
    const range = cap.max - cap.min;

    // Generate a value using weighted random (tends toward middle, but allows outliers)
    // Use two random numbers averaged to create bell curve distribution
    const randomFactor1 = Math.random();
    const randomFactor2 = Math.random();
    const bellCurveRandom = (randomFactor1 + randomFactor2) / 2;

    // Adjust based on draft position within the round
    let positionBoost = 0;
    if (position) {
      // Earlier picks in the round get a small boost (0-3 points)
      if (position <= 10) {
        positionBoost = 3 - Math.floor(position / 4);
      } else if (position <= 20) {
        positionBoost = 1;
      }
    }

    // Calculate final OVR using the range
    const baseOVR = Math.round(cap.min + (range * bellCurveRandom) + positionBoost);
    const finalOVR = Math.max(cap.min, Math.min(cap.max, baseOVR));

    // Debug logging for first few picks
    if (position && position <= 5) {
      console.log(`[VarianceRatingGenerator] Round ${round} Pick ${position}: cap=[${cap.min}-${cap.max}], boost=${positionBoost}, final=${finalOVR}`);
    }

    return finalOVR;
  }

  /**
   * Calculate Speed rating from 40-yard dash time
   *
   * Formula based on standard NFL combine conversions:
   * - 4.25s = 99 SPD
   * - 4.50s = 90 SPD
   * - 4.75s = 80 SPD
   * - 5.00s = 70 SPD
   * - 5.50s = 60 SPD
   */
  private calculateSpeedFrom40Time(fortyTime: number): number {
    // Clamp to reasonable range
    const clampedTime = Math.max(4.2, Math.min(5.8, fortyTime));

    // Linear interpolation: SPD = 139 - (fortyTime * 20)
    // This gives: 4.25 → 99, 4.50 → 90, 5.00 → 70, etc.
    let speed = Math.round(139 - (clampedTime * 20));

    // Clamp to Madden range
    return Math.max(60, Math.min(99, speed));
  }

  /**
   * Generate random number in range with optional modifier
   */
  private randomInRange(min: number, max: number, modifier: number = 0): number {
    const adjustedMin = Math.max(40, min + modifier);
    const adjustedMax = Math.min(99, max + modifier);
    return Math.floor(Math.random() * (adjustedMax - adjustedMin + 1)) + adjustedMin;
  }
}
