/**
 * Rating Calculator Service
 *
 * Converts real-world player statistics to Madden NFL ratings.
 * Uses position-specific formulas to calculate realistic attribute values.
 *
 * Rating Scale: 40-99 (Madden standard)
 * - 99-90: Elite
 * - 89-80: Very Good
 * - 79-70: Good
 * - 69-60: Average
 * - 59-50: Below Average
 * - 49-40: Poor
 */

import { PlayerStats } from './ScraperService';

export interface MaddenRatings {
  // Core Physical
  speed: number;
  acceleration: number;
  agility: number;
  strength: number;
  awareness: number;
  jumping: number;
  stamina: number;
  injury: number;

  // QB Attributes
  throwPower?: number;
  throwAccuracyShort?: number;
  throwAccuracyMid?: number;
  throwAccuracyDeep?: number;
  throwOnTheRun?: number;
  throwUnderPressure?: number;
  playAction?: number;
  breakSack?: number;

  // Ball Carrier
  carrying?: number;
  ballCarrierVision?: number;
  breakTackle?: number;
  trucking?: number;
  stiffArm?: number;
  spinMove?: number;
  jukeMove?: number;

  // Receiving
  catching?: number;
  catchInTraffic?: number;
  spectacularCatch?: number;
  shortRouteRunning?: number;
  mediumRouteRunning?: number;
  deepRouteRunning?: number;
  release?: number;

  // Blocking
  passBlock?: number;
  runBlock?: number;
  leadBlock?: number;
  impactBlocking?: number;

  // Defense
  tackle?: number;
  hitPower?: number;
  powerMoves?: number;
  finesseMoves?: number;
  blockShedding?: number;
  pursuit?: number;
  playRecognition?: number;
  manCoverage?: number;
  zoneCoverage?: number;
  pressCoverage?: number;

  // Special Teams
  kickPower?: number;
  kickAccuracy?: number;
  kickReturn?: number;

  // Overall
  overall: number;
}

/**
 * Rating Calculator Class
 */
export class RatingCalculator {

  /**
   * Clamp a value between min and max
   */
  private clamp(value: number, min: number = 40, max: number = 99): number {
    return Math.max(min, Math.min(max, Math.round(value)));
  }

  /**
   * Convert stats to Madden ratings based on position
   * @param stats - Player stats from scraper
   * @returns Madden ratings object
   */
  calculateRatings(stats: PlayerStats): MaddenRatings {
    const position = stats.position?.toUpperCase() || 'QB';

    // Base ratings (applied to all positions)
    const ratings: MaddenRatings = {
      speed: this.calculateSpeed(stats),
      acceleration: this.calculateAcceleration(stats),
      agility: this.calculateAgility(stats),
      strength: this.calculateStrength(stats),
      awareness: 65, // Default, adjusted per position
      jumping: 70,
      stamina: 85,
      injury: 90,
      overall: 50 // Will be calculated at the end
    };

    // Position-specific ratings
    if (position === 'QB') {
      Object.assign(ratings, this.calculateQBRatings(stats));
    } else if (['RB', 'FB'].includes(position)) {
      Object.assign(ratings, this.calculateRBRatings(stats));
    } else if (['WR', 'TE'].includes(position)) {
      Object.assign(ratings, this.calculateReceiverRatings(stats));
    } else if (['T', 'G', 'C', 'OT', 'OG'].includes(position)) {
      Object.assign(ratings, this.calculateOLineRatings(stats));
    } else if (['DE', 'DT', 'NT'].includes(position)) {
      Object.assign(ratings, this.calculateDLineRatings(stats));
    } else if (['LB', 'MLB', 'OLB', 'ILB'].includes(position)) {
      Object.assign(ratings, this.calculateLBRatings(stats));
    } else if (['CB', 'FS', 'SS', 'S'].includes(position)) {
      Object.assign(ratings, this.calculateDBRatings(stats));
    }

    // Calculate overall rating
    ratings.overall = this.calculateOverall(ratings, position);

    return ratings;
  }

  /**
   * Calculate speed rating (estimate based on position and stats)
   */
  private calculateSpeed(stats: PlayerStats): number {
    const position = stats.position?.toUpperCase() || '';

    // Position-based speed baselines
    const speedByPosition: { [key: string]: number } = {
      'WR': 90, 'CB': 90, 'RB': 88, 'FS': 87, 'SS': 85,
      'TE': 80, 'LB': 80, 'QB': 75, 'DE': 75, 'DT': 65,
      'OT': 60, 'OG': 58, 'C': 55
    };

    let baseSpeed = speedByPosition[position] || 75;

    // Adjust based on yards per carry/reception (indicates explosiveness)
    if (stats.rushAttempts && stats.rushYards) {
      const ypc = stats.rushYards / stats.rushAttempts;
      if (ypc > 5.0) baseSpeed += 3;
      else if (ypc < 3.5) baseSpeed -= 3;
    }

    return this.clamp(baseSpeed);
  }

  /**
   * Calculate acceleration (typically correlates with speed)
   */
  private calculateAcceleration(stats: PlayerStats): number {
    const speed = this.calculateSpeed(stats);
    return this.clamp(speed - 2); // Acceleration typically 2-3 points lower than speed
  }

  /**
   * Calculate agility (based on position and elusiveness stats)
   */
  private calculateAgility(stats: PlayerStats): number {
    const position = stats.position?.toUpperCase() || '';

    const agilityByPosition: { [key: string]: number } = {
      'WR': 85, 'CB': 85, 'RB': 85, 'FS': 80, 'SS': 78,
      'TE': 75, 'LB': 75, 'QB': 70, 'DE': 70, 'DT': 55,
      'OT': 50, 'OG': 48, 'C': 45
    };

    return this.clamp(agilityByPosition[position] || 70);
  }

  /**
   * Calculate strength (based on position and weight)
   */
  private calculateStrength(stats: PlayerStats): number {
    const position = stats.position?.toUpperCase() || '';
    const weight = stats.weight || 200;

    // Strength correlates with weight and position
    const strByPosition: { [key: string]: number } = {
      'OT': 85, 'OG': 85, 'C': 83, 'DT': 90, 'NT': 92,
      'DE': 80, 'TE': 75, 'LB': 75, 'FB': 70, 'RB': 60,
      'SS': 65, 'FS': 60, 'QB': 60, 'WR': 55, 'CB': 55
    };

    let baseStr = strByPosition[position] || 65;

    // Adjust for weight
    if (weight > 280) baseStr += 5;
    else if (weight < 200) baseStr -= 5;

    return this.clamp(baseStr);
  }

  /**
   * Calculate QB-specific ratings
   */
  private calculateQBRatings(stats: PlayerStats): Partial<MaddenRatings> {
    const passAttempts = stats.passAttempts || 0;
    const completions = stats.passCompletions || 0;
    const passYards = stats.passYards || 0;
    const passTDs = stats.passTDs || 0;
    const ints = stats.interceptions || 0;

    // Calculate completion percentage
    const compPct = passAttempts > 0 ? (completions / passAttempts) * 100 : 0;

    // Calculate yards per attempt
    const ypa = passAttempts > 0 ? passYards / passAttempts : 0;

    // Calculate TD:INT ratio
    const tdIntRatio = ints > 0 ? passTDs / ints : passTDs;

    // Throw Power (based on average depth of target - estimate from YPA)
    const throwPower = this.clamp(70 + (ypa * 2));

    // Throw Accuracy Short (based on completion %)
    const throwAccuracyShort = this.clamp(50 + (compPct * 0.6));

    // Throw Accuracy Mid (slightly lower than short)
    const throwAccuracyMid = this.clamp(throwAccuracyShort - 3);

    // Throw Accuracy Deep (based on YPA and TD rate)
    const throwAccuracyDeep = this.clamp(60 + (ypa * 2) + (passTDs * 0.5));

    // Throw on the Run (estimate based on rushing yards)
    const rushYards = stats.rushYards || 0;
    const throwOnTheRun = this.clamp(65 + (rushYards * 0.1));

    // Throw Under Pressure (based on TD:INT ratio)
    const throwUnderPressure = this.clamp(60 + (tdIntRatio * 5));

    // Play Action (correlates with overall accuracy)
    const playAction = this.clamp((throwAccuracyShort + throwAccuracyMid) / 2);

    // Break Sack (based on sack rate - estimate)
    const breakSack = this.clamp(65);

    return {
      throwPower,
      throwAccuracyShort,
      throwAccuracyMid,
      throwAccuracyDeep,
      throwOnTheRun,
      throwUnderPressure,
      playAction,
      breakSack,
      awareness: this.clamp(70 + (tdIntRatio * 3))
    };
  }

  /**
   * Calculate RB-specific ratings
   */
  private calculateRBRatings(stats: PlayerStats): Partial<MaddenRatings> {
    const rushAttempts = stats.rushAttempts || 0;
    const rushYards = stats.rushYards || 0;
    const rushTDs = stats.rushTDs || 0;
    const receptions = stats.receptions || 0;

    // Yards per carry
    const ypc = rushAttempts > 0 ? rushYards / rushAttempts : 0;

    // Carrying (fumble prevention - estimate high for productive RBs)
    const carrying = this.clamp(80 + (rushAttempts / 50));

    // Ball Carrier Vision (based on YPC)
    const ballCarrierVision = this.clamp(60 + (ypc * 6));

    // Break Tackle (based on TDs and yards after contact estimate)
    const breakTackle = this.clamp(65 + (rushTDs * 2));

    // Trucking (for power backs - based on strength)
    const trucking = this.clamp(70);

    // Stiff Arm (correlates with strength)
    const stiffArm = this.clamp(70);

    // Spin Move (agility-based)
    const spinMove = this.clamp(75);

    // Juke Move (agility-based)
    const jukeMove = this.clamp(75);

    // Catching (based on receptions)
    const catching = receptions > 30 ? this.clamp(70 + receptions * 0.3) : this.clamp(60);

    return {
      carrying,
      ballCarrierVision,
      breakTackle,
      trucking,
      stiffArm,
      spinMove,
      jukeMove,
      catching,
      catchInTraffic: catching - 5,
      awareness: this.clamp(70 + (ypc * 2))
    };
  }

  /**
   * Calculate Receiver-specific ratings (WR/TE)
   */
  private calculateReceiverRatings(stats: PlayerStats): Partial<MaddenRatings> {
    const receptions = stats.receptions || 0;
    const recYards = stats.recYards || 0;
    const recTDs = stats.recTDs || 0;
    const targets = stats.targets || receptions;

    // Catch rate
    const catchRate = targets > 0 ? (receptions / targets) * 100 : 0;

    // Yards per reception
    const ypr = receptions > 0 ? recYards / receptions : 0;

    // Catching (based on catch rate and volume)
    const catching = this.clamp(55 + (catchRate * 0.4) + (receptions * 0.2));

    // Catch in Traffic (slightly lower than catching)
    const catchInTraffic = this.clamp(catching - 5);

    // Spectacular Catch (based on TD rate)
    const spectacularCatch = this.clamp(60 + (recTDs * 3));

    // Route Running (based on YPR and catch rate)
    const shortRouteRunning = this.clamp(60 + (catchRate * 0.3));
    const mediumRouteRunning = this.clamp(shortRouteRunning - 2);
    const deepRouteRunning = this.clamp(55 + (ypr * 2));

    // Release (ability to get off line)
    const release = this.clamp(70 + (catchRate * 0.2));

    return {
      catching,
      catchInTraffic,
      spectacularCatch,
      shortRouteRunning,
      mediumRouteRunning,
      deepRouteRunning,
      release,
      awareness: this.clamp(65 + (receptions * 0.15))
    };
  }

  /**
   * Calculate Offensive Line ratings
   */
  private calculateOLineRatings(stats: PlayerStats): Partial<MaddenRatings> {
    // O-line stats aren't typically available, use position defaults
    return {
      passBlock: this.clamp(75),
      runBlock: this.clamp(75),
      passBlockPower: 75,
      passBlockFinesse: 70,
      runBlockPower: 75,
      runBlockFinesse: 70,
      impactBlocking: this.clamp(70),
      awareness: this.clamp(70)
    };
  }

  /**
   * Calculate Defensive Line ratings
   */
  private calculateDLineRatings(stats: PlayerStats): Partial<MaddenRatings> {
    const sacks = stats.sacks || 0;
    const tackles = stats.tackles || 0;
    const forcedFumbles = stats.forcedFumbles || 0;

    // Power Moves (based on sacks)
    const powerMoves = this.clamp(65 + (sacks * 2));

    // Finesse Moves (also based on sacks, slightly lower)
    const finesseMoves = this.clamp(powerMoves - 5);

    // Block Shedding (ability to disengage)
    const blockShedding = this.clamp(70 + (tackles * 0.1));

    // Tackle
    const tackle = this.clamp(60 + (tackles * 0.2));

    // Hit Power
    const hitPower = this.clamp(75 + (forcedFumbles * 5));

    // Pursuit
    const pursuit = this.clamp(70 + (tackles * 0.1));

    // Play Recognition
    const playRecognition = this.clamp(65);

    return {
      powerMoves,
      finesseMoves,
      blockShedding,
      tackle,
      hitPower,
      pursuit,
      playRecognition,
      awareness: this.clamp(65 + (tackles * 0.1))
    };
  }

  /**
   * Calculate Linebacker ratings
   */
  private calculateLBRatings(stats: PlayerStats): Partial<MaddenRatings> {
    const tackles = stats.tackles || 0;
    const sacks = stats.sacks || 0;
    const interceptions = stats.interceptionsCaught || 0;
    const passDefended = stats.passDefended || 0;

    // Tackle
    const tackle = this.clamp(60 + (tackles * 0.25));

    // Hit Power
    const hitPower = this.clamp(70 + (tackles * 0.15));

    // Block Shedding
    const blockShedding = this.clamp(65 + (tackles * 0.1));

    // Power/Finesse Moves (based on sacks)
    const powerMoves = this.clamp(60 + (sacks * 3));
    const finesseMoves = this.clamp(powerMoves - 3);

    // Coverage
    const zoneCoverage = this.clamp(60 + (interceptions * 5) + (passDefended * 2));
    const manCoverage = this.clamp(zoneCoverage - 5);

    // Pursuit
    const pursuit = this.clamp(70 + (tackles * 0.1));

    // Play Recognition
    const playRecognition = this.clamp(65 + (tackles * 0.1));

    return {
      tackle,
      hitPower,
      blockShedding,
      powerMoves,
      finesseMoves,
      pursuit,
      playRecognition,
      manCoverage,
      zoneCoverage,
      awareness: this.clamp(65 + (tackles * 0.12))
    };
  }

  /**
   * Calculate Defensive Back ratings (CB/S)
   */
  private calculateDBRatings(stats: PlayerStats): Partial<MaddenRatings> {
    const tackles = stats.tackles || 0;
    const interceptions = stats.interceptionsCaught || 0;
    const passDefended = stats.passDefended || 0;

    // Man Coverage (based on interceptions and pass defenses)
    const manCoverage = this.clamp(65 + (interceptions * 4) + (passDefended * 1.5));

    // Zone Coverage (typically higher than man for safeties)
    const zoneCoverage = this.clamp(manCoverage + 2);

    // Press Coverage (physical coverage)
    const pressCoverage = this.clamp(manCoverage - 3);

    // Tackle (safeties tackle more than CBs)
    const tackle = this.clamp(55 + (tackles * 0.2));

    // Hit Power
    const hitPower = this.clamp(65 + (tackles * 0.15));

    // Play Recognition
    const playRecognition = this.clamp(65 + (interceptions * 3));

    // Pursuit
    const pursuit = this.clamp(70 + (tackles * 0.1));

    return {
      manCoverage,
      zoneCoverage,
      pressCoverage,
      tackle,
      hitPower,
      playRecognition,
      pursuit,
      catching: this.clamp(60 + (interceptions * 4)),
      awareness: this.clamp(70 + (interceptions * 2))
    };
  }

  /**
   * Calculate overall rating based on position-weighted attributes
   */
  private calculateOverall(ratings: MaddenRatings, position: string): number {
    position = position.toUpperCase();

    // Position-specific weight maps
    const weights: { [key: string]: { [key: string]: number } } = {
      'QB': {
        'throwPower': 0.15,
        'throwAccuracyShort': 0.15,
        'throwAccuracyMid': 0.15,
        'throwAccuracyDeep': 0.12,
        'awareness': 0.12,
        'speed': 0.08,
        'throwOnTheRun': 0.08,
        'throwUnderPressure': 0.10,
        'playAction': 0.05
      },
      'RB': {
        'speed': 0.18,
        'acceleration': 0.12,
        'carrying': 0.12,
        'breakTackle': 0.12,
        'ballCarrierVision': 0.12,
        'agility': 0.10,
        'trucking': 0.08,
        'catching': 0.08,
        'awareness': 0.08
      },
      'WR': {
        'speed': 0.15,
        'catching': 0.18,
        'shortRouteRunning': 0.12,
        'mediumRouteRunning': 0.12,
        'deepRouteRunning': 0.10,
        'catchInTraffic': 0.10,
        'spectacularCatch': 0.08,
        'release': 0.08,
        'awareness': 0.07
      },
      'CB': {
        'manCoverage': 0.18,
        'zoneCoverage': 0.15,
        'speed': 0.15,
        'agility': 0.12,
        'pressCoverage': 0.10,
        'playRecognition': 0.10,
        'awareness': 0.10,
        'acceleration': 0.10
      }
    };

    // Get weights for position (or use default balanced weights)
    const posWeights = weights[position] || {};

    let overall = 0;
    let totalWeight = 0;

    for (const [attr, weight] of Object.entries(posWeights)) {
      const value = (ratings as any)[attr];
      if (value !== undefined) {
        overall += value * weight;
        totalWeight += weight;
      }
    }

    // Normalize if we didn't have all attributes
    if (totalWeight > 0) {
      overall = overall / totalWeight;
    } else {
      // Fallback: average of key attributes
      overall = (ratings.speed + ratings.awareness + ratings.strength) / 3;
    }

    return this.clamp(overall);
  }
}

// Export singleton
export const ratingCalculator = new RatingCalculator();
