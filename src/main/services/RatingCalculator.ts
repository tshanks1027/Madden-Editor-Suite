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
import { ovrWeightsCalculator } from './rating-modes/OVRWeightsCalculator';

export interface MaddenRatings {
  // Core Physical
  speed: number;
  acceleration: number;
  agility: number;
  changeOfDirection?: number; // COD - Agility/quick cuts
  strength: number;
  awareness: number;
  jumping: number;
  stamina: number;
  injury: number;
  toughness?: number; // TGH - Injury resilience

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
  passBlockPower?: number; // PBS - Pass Block Strength
  passBlockFinesse?: number; // PBF - Pass Block Finesse
  runBlock?: number;
  runBlockPower?: number; // RBS - Run Block Strength
  runBlockFinesse?: number; // RBF - Run Block Finesse
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
  longSnap?: number; // LS - Long snapping accuracy

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
      changeOfDirection: this.calculateChangeOfDirection(stats), // COD - based on agility
      strength: this.calculateStrength(stats),
      awareness: 65, // Default, adjusted per position
      jumping: 70,
      stamina: 85,
      injury: 90,
      toughness: this.calculateToughness(stats, position), // TGH - based on position
      longSnap: 1, // Default to 1 (overridden for LS position)
      overall: 50 // Will be calculated at the end
    };

    // Position-specific ratings
    if (position === 'QB') {
      Object.assign(ratings, this.calculateQBRatings(stats));
    } else if (['RB', 'FB'].includes(position)) {
      Object.assign(ratings, this.calculateRBRatings(stats));
    } else if (['WR', 'TE'].includes(position)) {
      Object.assign(ratings, this.calculateReceiverRatings(stats));
    } else if (['T', 'G', 'C', 'OT', 'OG', 'LT', 'LG', 'RG', 'RT'].includes(position)) {
      Object.assign(ratings, this.calculateOLineRatings(stats));
    } else if (['DE', 'DT', 'NT', 'LEDG', 'REDG'].includes(position)) {
      Object.assign(ratings, this.calculateDLineRatings(stats));
    } else if (['LB', 'MLB', 'OLB', 'ILB', 'SAM', 'Mike', 'MIKE', 'WILL'].includes(position)) {
      Object.assign(ratings, this.calculateLBRatings(stats));
    } else if (['CB', 'FS', 'SS', 'S'].includes(position)) {
      Object.assign(ratings, this.calculateDBRatings(stats));
    } else if (position === 'LS') {
      // Long Snapper - special case
      ratings.longSnap = this.clamp(75); // LS have high long snap rating
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
   * Calculate Change of Direction (COD) - typically slightly lower than agility
   */
  private calculateChangeOfDirection(stats: PlayerStats): number {
    const agility = this.calculateAgility(stats);
    // COD is typically 2-3 points lower than agility
    return this.clamp(agility - 2);
  }

  /**
   * Calculate Toughness (TGH) - injury resilience, varies by position
   */
  private calculateToughness(stats: PlayerStats, position: string): number {
    const pos = position.toUpperCase();

    // Toughness by position (linemen are toughest, skill positions less so)
    const toughnessByPosition: { [key: string]: number } = {
      'OT': 85, 'OG': 85, 'C': 83, 'DT': 88, 'NT': 90,
      'DE': 82, 'TE': 80, 'LB': 82, 'FB': 80, 'RB': 75,
      'SS': 78, 'FS': 75, 'QB': 72, 'WR': 70, 'CB': 70,
      'K': 60, 'P': 60, 'LS': 75
    };

    return this.clamp(toughnessByPosition[pos] || 75);
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
    const passBlockBase = this.clamp(75);
    const runBlockBase = this.clamp(75);

    return {
      passBlock: passBlockBase,
      passBlockPower: this.clamp(passBlockBase - 2), // PBS slightly lower than passBlock
      passBlockFinesse: this.clamp(passBlockBase - 5), // PBF typically lower for OL
      runBlock: runBlockBase,
      runBlockPower: this.clamp(runBlockBase + 2), // RBS typically higher for OL
      runBlockFinesse: this.clamp(runBlockBase - 3), // RBF lower
      impactBlocking: this.clamp(70),
      leadBlock: this.clamp(70),
      awareness: this.clamp(70),
      toughness: this.clamp(85) // OL are tough!
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
   * Calculate overall rating using OVRWeightsCalculator for official Madden 26 formulas
   * This ensures consistency with ovrweights.json across all features
   */
  private calculateOverall(ratings: MaddenRatings, position: string): number {
    // Convert MaddenRatings to the attribute format OVRWeightsCalculator expects
    const attributes: { [key: string]: number } = {
      PSPD: ratings.speed || 50,
      PACC: ratings.acceleration || 50,
      PAGI: ratings.agility || 50,
      PELU: ratings.changeOfDirection || ratings.agility || 50, // COD
      PSTR: ratings.strength || 50,
      PAWR: ratings.awareness || 50,
      PJMP: ratings.jumping || 50,
      PSTA: ratings.stamina || 50,
      PINJ: ratings.injury || 90,
      PTGH: ratings.toughness || 75, // Toughness
      // QB
      PTHP: ratings.throwPower || 50,
      PTAS: ratings.throwAccuracyShort || 50,
      PTAM: ratings.throwAccuracyMid || 50,
      PTAD: ratings.throwAccuracyDeep || 50,
      PTOR: ratings.throwOnTheRun || 50,
      PTUP: ratings.throwUnderPressure || 50,
      PPLA: ratings.playAction || 50,
      PBSK: ratings.breakSack || 50,
      // Ball Carrier
      PCAR: ratings.carrying || 50,
      PBCV: ratings.ballCarrierVision || 50,
      PBKT: ratings.breakTackle || 50,
      PLTR: ratings.trucking || 50,
      PLSA: ratings.stiffArm || 50,
      PLSM: ratings.spinMove || 50,
      PLJM: ratings.jukeMove || 50,
      // Receiving
      PCTH: ratings.catching || 50,
      PLCI: ratings.catchInTraffic || 50,
      PLSC: ratings.spectacularCatch || 50,
      SRRN: ratings.shortRouteRunning || 50,
      PMRR: ratings.mediumRouteRunning || 50,
      PDRR: ratings.deepRouteRunning || 50,
      PLRL: ratings.release || 50,
      // Blocking
      PPBK: ratings.passBlock || 50,
      PPBS: ratings.passBlockPower || 50,
      PPBF: ratings.passBlockFinesse || 50,
      PRBK: ratings.runBlock || 50,
      PRBS: ratings.runBlockPower || 50,
      PRBF: ratings.runBlockFinesse || 50,
      PLBK: ratings.leadBlock || 50,
      PLIB: ratings.impactBlocking || 50,
      // Defense
      PTAK: ratings.tackle || 50,
      PLHT: ratings.hitPower || 50,
      PLPM: ratings.powerMoves || 50,
      PFMS: ratings.finesseMoves || 50,
      PBSG: ratings.blockShedding || 50,
      PLPU: ratings.pursuit || 50,
      PLPR: ratings.playRecognition || 50,
      PLMC: ratings.manCoverage || 50,
      PLZC: ratings.zoneCoverage || 50,
      PLPE: ratings.pressCoverage || 50,
      // Special Teams
      PKPR: ratings.kickPower || 50,
      PKAC: ratings.kickAccuracy || 50,
      PKRT: ratings.kickReturn || 50
    };

    // Use OVRWeightsCalculator if initialized, otherwise fallback
    if (ovrWeightsCalculator.isInitialized()) {
      return ovrWeightsCalculator.calculateOVR(attributes, position);
    }

    // Fallback: simple average of key attributes
    console.warn('[RatingCalculator] OVRWeightsCalculator not initialized, using fallback');
    return this.clamp((ratings.speed + ratings.awareness + ratings.strength) / 3);
  }

  /**
   * Public method to recalculate overall rating from existing ratings
   * Used by renderer for dynamic OVR calculation in grid
   * @param ratings - Current player ratings
   * @param position - Player position
   * @returns Calculated overall rating
   */
  public recalculateOverall(ratings: Partial<MaddenRatings>, position: string): number {
    // Create a complete ratings object with defaults
    const fullRatings: MaddenRatings = {
      speed: ratings.speed || 50,
      acceleration: ratings.acceleration || 50,
      agility: ratings.agility || 50,
      changeOfDirection: ratings.changeOfDirection,
      strength: ratings.strength || 50,
      awareness: ratings.awareness || 50,
      jumping: ratings.jumping || 50,
      stamina: ratings.stamina || 50,
      injury: ratings.injury || 90,
      toughness: ratings.toughness,
      throwPower: ratings.throwPower,
      throwAccuracyShort: ratings.throwAccuracyShort,
      throwAccuracyMid: ratings.throwAccuracyMid,
      throwAccuracyDeep: ratings.throwAccuracyDeep,
      throwOnTheRun: ratings.throwOnTheRun,
      throwUnderPressure: ratings.throwUnderPressure,
      playAction: ratings.playAction,
      breakSack: ratings.breakSack,
      carrying: ratings.carrying,
      ballCarrierVision: ratings.ballCarrierVision,
      breakTackle: ratings.breakTackle,
      trucking: ratings.trucking,
      stiffArm: ratings.stiffArm,
      spinMove: ratings.spinMove,
      jukeMove: ratings.jukeMove,
      catching: ratings.catching,
      catchInTraffic: ratings.catchInTraffic,
      spectacularCatch: ratings.spectacularCatch,
      shortRouteRunning: ratings.shortRouteRunning,
      mediumRouteRunning: ratings.mediumRouteRunning,
      deepRouteRunning: ratings.deepRouteRunning,
      release: ratings.release,
      passBlock: ratings.passBlock,
      passBlockPower: ratings.passBlockPower,
      passBlockFinesse: ratings.passBlockFinesse,
      runBlock: ratings.runBlock,
      runBlockPower: ratings.runBlockPower,
      runBlockFinesse: ratings.runBlockFinesse,
      leadBlock: ratings.leadBlock,
      impactBlocking: ratings.impactBlocking,
      tackle: ratings.tackle,
      hitPower: ratings.hitPower,
      powerMoves: ratings.powerMoves,
      finesseMoves: ratings.finesseMoves,
      blockShedding: ratings.blockShedding,
      pursuit: ratings.pursuit,
      playRecognition: ratings.playRecognition,
      manCoverage: ratings.manCoverage,
      zoneCoverage: ratings.zoneCoverage,
      pressCoverage: ratings.pressCoverage,
      kickPower: ratings.kickPower,
      kickAccuracy: ratings.kickAccuracy,
      kickReturn: ratings.kickReturn,
      longSnap: ratings.longSnap,
      overall: 50
    };

    return this.calculateOverall(fullRatings, position);
  }
}

// Export singleton
export const ratingCalculator = new RatingCalculator();
