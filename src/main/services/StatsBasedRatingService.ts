/**
 * Stats-Based Rating Service
 *
 * Generates player OVR ratings from career stats following the documented formula
 * in docs/STATS_BASED_OVR_FORMULA.md
 *
 * Key factors:
 * 1. Position Performance Score from stats
 * 2. Era normalization (14 vs 16 vs 17 game seasons, passing era)
 * 3. Achievement bonuses (Pro Bowl, All-Pro, HOF)
 * 4. Age curves by position
 * 5. Archetype detection from stats
 * 6. Career progression (rookies capped, sustained excellence rewarded)
 *
 * OVR Scale Philosophy:
 * - 99: Legendary season (rare - requires sustained multi-year dominance)
 * - 95-98: MVP-caliber season
 * - 90-94: All-Pro / Elite
 * - 85-89: Pro Bowl level
 * - 80-84: Quality starter
 * - 75-79: Solid starter
 * - 70-74: Backup / role player
 * - 65-69: Depth
 * - 55-64: Fringe roster
 */

import { ovrWeightsCalculator } from './rating-modes/OVRWeightsCalculator';

// Era definitions for stats normalization
interface Era {
  startYear: number;
  endYear: number;
  games: number;
  passingMultiplier: number; // Higher = more pass-heavy era
  rushMultiplier: number;    // Higher = more valuable rush stats
  description: string;
}

const ERAS: Era[] = [
  { startYear: 1960, endYear: 1969, games: 14, passingMultiplier: 0.8, rushMultiplier: 1.3, description: 'AFL/NFL pre-merger' },
  { startYear: 1970, endYear: 1977, games: 14, passingMultiplier: 0.85, rushMultiplier: 1.25, description: 'Run-heavy, physical DBs' },
  { startYear: 1978, endYear: 1993, games: 16, passingMultiplier: 0.95, rushMultiplier: 1.1, description: 'More passing, Mel Blount rule' },
  { startYear: 1994, endYear: 2003, games: 16, passingMultiplier: 1.0, rushMultiplier: 1.0, description: 'Balanced offenses' },
  { startYear: 2004, endYear: 2010, games: 16, passingMultiplier: 1.05, rushMultiplier: 0.95, description: 'Emphasis on passing' },
  { startYear: 2011, endYear: 2020, games: 16, passingMultiplier: 1.15, rushMultiplier: 0.85, description: 'Pass-heavy, QB protection rules' },
  { startYear: 2021, endYear: 2099, games: 17, passingMultiplier: 1.2, rushMultiplier: 0.8, description: 'Modern era' },
];

// Age curves by position
interface AgeCurve {
  primeStart: number;
  primeEnd: number;
  declineStart: number;
  cliff: number;
}

const AGE_CURVES: { [position: string]: AgeCurve } = {
  'QB': { primeStart: 28, primeEnd: 37, declineStart: 38, cliff: 42 },
  'HB': { primeStart: 24, primeEnd: 27, declineStart: 28, cliff: 31 },
  'RB': { primeStart: 24, primeEnd: 27, declineStart: 28, cliff: 31 },
  'FB': { primeStart: 25, primeEnd: 30, declineStart: 31, cliff: 33 },
  'WR': { primeStart: 26, primeEnd: 31, declineStart: 32, cliff: 35 },
  'TE': { primeStart: 26, primeEnd: 31, declineStart: 32, cliff: 34 },
  'LT': { primeStart: 26, primeEnd: 33, declineStart: 34, cliff: 37 },
  'LG': { primeStart: 26, primeEnd: 33, declineStart: 34, cliff: 37 },
  'C': { primeStart: 26, primeEnd: 33, declineStart: 34, cliff: 37 },
  'RG': { primeStart: 26, primeEnd: 33, declineStart: 34, cliff: 37 },
  'RT': { primeStart: 26, primeEnd: 33, declineStart: 34, cliff: 37 },
  'LE': { primeStart: 25, primeEnd: 31, declineStart: 32, cliff: 35 },
  'RE': { primeStart: 25, primeEnd: 31, declineStart: 32, cliff: 35 },
  'DT': { primeStart: 25, primeEnd: 31, declineStart: 32, cliff: 35 },
  'LOLB': { primeStart: 25, primeEnd: 30, declineStart: 31, cliff: 34 },
  'MLB': { primeStart: 25, primeEnd: 30, declineStart: 31, cliff: 33 },
  'ROLB': { primeStart: 25, primeEnd: 30, declineStart: 31, cliff: 34 },
  'CB': { primeStart: 25, primeEnd: 29, declineStart: 30, cliff: 33 },
  'FS': { primeStart: 26, primeEnd: 31, declineStart: 32, cliff: 35 },
  'SS': { primeStart: 26, primeEnd: 31, declineStart: 32, cliff: 35 },
  'K': { primeStart: 28, primeEnd: 40, declineStart: 42, cliff: 48 },
  'P': { primeStart: 28, primeEnd: 40, declineStart: 42, cliff: 48 },
};

// Achievement bonuses (toned down - 99 should be very hard to achieve)
const ACHIEVEMENT_BONUSES = {
  proBowl: 2,        // Was 3 - Pro Bowl is nice but not elite
  allPro1st: 4,      // Was 5 - All-Pro 1st team is elite
  allPro2nd: 2,      // Was 3
  mvp: 4,            // Was 5 - MVP is huge but one year
  opoy: 3,           // Was 4
  dpoy: 3,           // Was 4
  hof: 2,            // Was 3 - HOF is career achievement, small per-year boost
  startedAllGames: 1,
  missedHalfSeason: -3,
};

// Career progression modifiers (years in league)
// Rookies should be capped, veterans get experience bonus
const CAREER_PROGRESSION = {
  rookie: { maxOVR: 82, modifier: -3 },      // Year 1: Capped at 82, -3 penalty
  sophomore: { maxOVR: 88, modifier: -1 },   // Year 2: Capped at 88, -1 penalty
  thirdYear: { maxOVR: 94, modifier: 0 },    // Year 3: Can reach starter tier
  established: { maxOVR: 97, modifier: 1 },  // Years 4-6: Experience bonus
  veteran: { maxOVR: 99, modifier: 2 },      // Years 7+: Can reach elite (if stats support)
};

export interface PlayerSeasonStats {
  year: number;
  games?: number;
  gamesStarted?: number;

  // Passing
  passAttempts?: number;
  passCompletions?: number;
  passYards?: number;
  passTDs?: number;
  passInt?: number;
  passerRating?: number;

  // Rushing
  rushAttempts?: number;
  rushYards?: number;
  rushTDs?: number;

  // Receiving
  receptions?: number;
  recYards?: number;
  recTDs?: number;
  targets?: number;

  // Defense
  tackles?: number;
  sacks?: number;
  interceptions?: number;
  forcedFumbles?: number;
  passDefended?: number;

  // Kicking
  fgAttempts?: number;
  fgMade?: number;
  fgLong?: number;
  xpAttempts?: number;
  xpMade?: number;

  // Punting
  punts?: number;
  puntYards?: number;
  puntInside20?: number;
}

export interface PlayerAchievements {
  proBowlYears?: number[];
  allPro1stYears?: number[];
  allPro2ndYears?: number[];
  mvpYears?: number[];
  opoyYears?: number[];
  dpoyYears?: number[];
  isHOF?: boolean;
  draftRound?: number;
  draftPick?: number;
  rookieYear?: number; // First year in the league (for career progression)
}

export interface GeneratedRating {
  overall: number;
  baseScore: number;
  eraAdjustedScore: number;
  achievementBonus: number;
  ageModifier: number;
  breakdown: string;
}

export class StatsBasedRatingService {

  /**
   * Generate OVR rating for a player in a given year
   * Uses PREVIOUS year's stats (matching Madden's approach)
   */
  generateRating(
    position: string,
    stats: PlayerSeasonStats,
    achievements: PlayerAchievements,
    playerAge: number,
    targetYear: number
  ): GeneratedRating {

    const pos = this.normalizePosition(position);
    const era = this.getEra(stats.year);

    // Step 1: Calculate Position Performance Score
    const baseScore = this.calculatePerformanceScore(pos, stats, era);

    // Step 2: Map to OVR scale (55-95 base range - leaves room for bonuses)
    const eraAdjustedScore = this.mapToOVRScale(baseScore, pos);

    // Step 3: Apply age curve
    const ageModifier = this.calculateAgeModifier(pos, playerAge);

    // Step 4: Apply achievement bonuses (OL get extra weight on achievements)
    const achievementBonus = this.calculateAchievementBonus(achievements, stats.year, targetYear, pos);

    // Step 5: Calculate years in league for career progression
    const yearsInLeague = this.calculateYearsInLeague(stats.year, achievements, pos);
    const careerProgression = this.getCareerProgression(yearsInLeague);

    // Step 6: Calculate final OVR with career progression modifier
    let overall = eraAdjustedScore + ageModifier + achievementBonus + careerProgression.modifier;

    // Apply career stage ceiling (rookies capped at 82, sophomores at 88, etc.)
    overall = Math.min(overall, careerProgression.maxOVR);

    // HOF floor boost - HOFers shouldn't drop below 68 even in decline years
    // But this doesn't apply to their actual rookie years
    if (achievements.isHOF && yearsInLeague >= 3) {
      overall = Math.max(overall, 68);
    }

    // Clamp to valid range (55-99, but 99 is very hard to achieve)
    overall = Math.max(55, Math.min(99, Math.round(overall)));

    const breakdown = this.generateBreakdown(
      baseScore, eraAdjustedScore, ageModifier, achievementBonus,
      era, yearsInLeague, careerProgression
    );

    return {
      overall,
      baseScore,
      eraAdjustedScore,
      achievementBonus,
      ageModifier,
      breakdown
    };
  }

  /**
   * Calculate years in league based on rookie year or estimate from stats
   */
  private calculateYearsInLeague(
    statYear: number,
    achievements: PlayerAchievements,
    position: string
  ): number {
    if (achievements.rookieYear) {
      return statYear - achievements.rookieYear + 1;
    }
    // If no rookie year provided, we can't determine career stage
    // Return 4 (established) as a reasonable default
    return 4;
  }

  /**
   * Get career progression stage based on years in league
   */
  private getCareerProgression(yearsInLeague: number): { maxOVR: number; modifier: number; stage: string } {
    if (yearsInLeague <= 1) {
      return { ...CAREER_PROGRESSION.rookie, stage: 'Rookie' };
    } else if (yearsInLeague === 2) {
      return { ...CAREER_PROGRESSION.sophomore, stage: 'Sophomore' };
    } else if (yearsInLeague === 3) {
      return { ...CAREER_PROGRESSION.thirdYear, stage: '3rd Year' };
    } else if (yearsInLeague <= 6) {
      return { ...CAREER_PROGRESSION.established, stage: 'Established' };
    } else {
      return { ...CAREER_PROGRESSION.veteran, stage: 'Veteran' };
    }
  }

  /**
   * Calculate position-specific performance score from stats
   */
  private calculatePerformanceScore(position: string, stats: PlayerSeasonStats, era: Era): number {
    const games = stats.games || era.games;

    switch (position) {
      case 'QB':
        return this.calculateQBPerformance(stats, era, games);
      case 'HB':
      case 'RB':
      case 'FB':
        return this.calculateRBPerformance(stats, era, games);
      case 'WR':
        return this.calculateWRPerformance(stats, era, games);
      case 'TE':
        return this.calculateTEPerformance(stats, era, games);
      case 'LT':
      case 'LG':
      case 'C':
      case 'RG':
      case 'RT':
        return this.calculateOLPerformance(stats, games);
      case 'LE':
      case 'RE':
      case 'DT':
        return this.calculateDLPerformance(stats, games);
      case 'LOLB':
      case 'MLB':
      case 'ROLB':
        return this.calculateLBPerformance(stats, games);
      case 'CB':
      case 'FS':
      case 'SS':
        return this.calculateDBPerformance(stats, games);
      case 'K':
        return this.calculateKPerformance(stats);
      case 'P':
        return this.calculatePPerformance(stats);
      default:
        return 50; // Default for unknown positions
    }
  }

  /**
   * QB Performance Score
   * Performance = (Passer Rating × 0.40) + (Completion% × 0.30) + (TD:INT Ratio × 20) + (Yards/Game × 0.10)
   */
  private calculateQBPerformance(stats: PlayerSeasonStats, era: Era, games: number): number {
    const passerRating = stats.passerRating || 0;
    const compPct = stats.passAttempts ? ((stats.passCompletions || 0) / stats.passAttempts) * 100 : 0;
    const tdIntRatio = (stats.passInt || 1) > 0 ? (stats.passTDs || 0) / (stats.passInt || 1) : (stats.passTDs || 0);
    const yardsPerGame = games > 0 ? (stats.passYards || 0) / games : 0;

    let score = (passerRating * 0.40) +
                (compPct * 0.30) +
                (tdIntRatio * 20) +
                (yardsPerGame * 0.10);

    // Era adjustment - passing was harder in earlier eras
    score *= era.passingMultiplier;

    return score;
  }

  /**
   * RB Performance Score
   * Performance = (Yards/Carry × 15) + (Rush TDs × 2) + (Receptions × 0.5) + (Total Yards / 50)
   */
  private calculateRBPerformance(stats: PlayerSeasonStats, era: Era, games: number): number {
    const rushAttempts = stats.rushAttempts || 1;
    const ypc = (stats.rushYards || 0) / rushAttempts;
    const rushTDs = stats.rushTDs || 0;
    const receptions = stats.receptions || 0;
    const totalYards = (stats.rushYards || 0) + (stats.recYards || 0);

    let score = (ypc * 15) +
                (rushTDs * 2) +
                (receptions * 0.5) +
                (totalYards / 50);

    // Era adjustment - rushing was more valuable in older eras
    score *= era.rushMultiplier;

    // Volume bonus for workhorse backs
    if (rushAttempts > 250) score += 10;
    else if (rushAttempts > 200) score += 5;

    // 1000+ yard seasons are elite regardless of era
    if ((stats.rushYards || 0) >= 1000) {
      const eraGames = era.games;
      const adjustedYards = (stats.rushYards || 0) * (16 / eraGames); // Normalize to 16 games
      if (adjustedYards >= 1500) score += 15;
      else if (adjustedYards >= 1200) score += 10;
      else score += 5;
    }

    return score;
  }

  /**
   * WR Performance Score
   * Performance = (Receptions × 0.5) + (Yards/Reception × 3) + (TDs × 3) + (Total Yards / 40)
   */
  private calculateWRPerformance(stats: PlayerSeasonStats, era: Era, games: number): number {
    const receptions = stats.receptions || 0;
    const ypr = receptions > 0 ? (stats.recYards || 0) / receptions : 0;
    const tds = stats.recTDs || 0;
    const totalYards = stats.recYards || 0;

    let score = (receptions * 0.5) +
                (ypr * 3) +
                (tds * 3) +
                (totalYards / 40);

    // Era adjustment
    score *= era.passingMultiplier;

    // 1000+ yard seasons bonus
    if (totalYards >= 1000) {
      score += 10;
    }

    return score;
  }

  /**
   * TE Performance Score
   * Performance = (Receptions × 0.6) + (Yards/Reception × 2) + (TDs × 4) + (Games Started × 0.5)
   */
  private calculateTEPerformance(stats: PlayerSeasonStats, era: Era, games: number): number {
    const receptions = stats.receptions || 0;
    const ypr = receptions > 0 ? (stats.recYards || 0) / receptions : 0;
    const tds = stats.recTDs || 0;
    const gamesStarted = stats.gamesStarted || 0;

    let score = (receptions * 0.6) +
                (ypr * 2) +
                (tds * 4) +
                (gamesStarted * 0.5);

    // TEs get blocking proxy from games started
    score *= era.passingMultiplier;

    return score;
  }

  /**
   * OL Performance Score (limited stats available)
   * OL are special - they don't have traditional stats like yards/TDs
   * We rely on:
   * 1. Games started/played (durability = quality for OL)
   * 2. A base floor (if they're in our database, they were notable)
   * 3. Pro Bowl/All-Pro achievements (handled in achievement bonus)
   */
  private calculateOLPerformance(stats: PlayerSeasonStats, games: number): number {
    // Use gamesStarted if available, otherwise fall back to games played
    // Many scraped stats don't have gamesStarted for OL
    const gamesStarted = stats.gamesStarted || stats.games || 0;

    // OL have a higher base floor than other positions
    // If they're in our database at all, they were notable enough to be recorded
    // This gives them a solid starting point of ~35 before games factor
    let score = 35;

    // Add points for games started/played
    // OL durability is a key indicator of quality
    // Max 16 games * 3 = 48 points
    score += gamesStarted * 3;

    // Big bonus for starting full season (iron man bonus)
    // OL who start all games are typically starters, not backups
    if (gamesStarted >= games && games > 0) {
      score += 15;
    } else if (gamesStarted >= games * 0.75) {
      // Started most games - solid starter
      score += 8;
    } else if (gamesStarted >= games * 0.5) {
      // Started half - likely platoon or mid-season starter
      score += 4;
    }

    // Even if we have no games data, give OL credit for being in database
    // A player with 0 games in our DB was still notable enough to track
    if (gamesStarted === 0) {
      // Assume they played at least half a season if they're in our records
      score += 8 * 3 + 4; // ~8 games worth + partial starter bonus
    }

    return score;
  }

  /**
   * DL Performance Score
   * Performance = (Sacks × 5) + (Tackles × 0.3) + (FF × 3)
   */
  private calculateDLPerformance(stats: PlayerSeasonStats, games: number): number {
    const sacks = stats.sacks || 0;
    const tackles = stats.tackles || 0;
    const ff = stats.forcedFumbles || 0;

    let score = (sacks * 5) +
                (tackles * 0.3) +
                (ff * 3);

    // Double-digit sacks is elite
    if (sacks >= 10) score += 15;
    else if (sacks >= 8) score += 8;

    return score;
  }

  /**
   * LB Performance Score
   * Performance = (Tackles × 0.4) + (Sacks × 4) + (INTs × 5) + (FF × 2)
   */
  private calculateLBPerformance(stats: PlayerSeasonStats, games: number): number {
    const tackles = stats.tackles || 0;
    const sacks = stats.sacks || 0;
    const ints = stats.interceptions || 0;
    const ff = stats.forcedFumbles || 0;

    let score = (tackles * 0.4) +
                (sacks * 4) +
                (ints * 5) +
                (ff * 2);

    // 100+ tackle seasons bonus
    if (tackles >= 100) score += 10;

    return score;
  }

  /**
   * DB Performance Score
   * Performance = (INTs × 6) + (Tackles × 0.3) + (FF × 2) + (Games Started × 0.2)
   */
  private calculateDBPerformance(stats: PlayerSeasonStats, games: number): number {
    const ints = stats.interceptions || 0;
    const tackles = stats.tackles || 0;
    const ff = stats.forcedFumbles || 0;
    const gamesStarted = stats.gamesStarted || 0;

    let score = (ints * 6) +
                (tackles * 0.3) +
                (ff * 2) +
                (gamesStarted * 0.2);

    // Elite INT seasons
    if (ints >= 8) score += 15;
    else if (ints >= 5) score += 8;

    return score;
  }

  /**
   * Kicker Performance Score
   * Performance = (FG% × 0.6) + (Long FG × 0.3) + (50+ FG% × 0.1)
   */
  private calculateKPerformance(stats: PlayerSeasonStats): number {
    const fgPct = stats.fgAttempts ? ((stats.fgMade || 0) / stats.fgAttempts) * 100 : 0;
    const fgLong = stats.fgLong || 0;

    let score = (fgPct * 0.6) +
                (fgLong * 0.3);

    // Bonus for accuracy
    if (fgPct >= 90) score += 15;
    else if (fgPct >= 85) score += 10;

    return score;
  }

  /**
   * Punter Performance Score
   * Performance = (Punt Avg × 2) + (Inside 20 % × 0.5)
   */
  private calculatePPerformance(stats: PlayerSeasonStats): number {
    const puntAvg = stats.punts ? (stats.puntYards || 0) / stats.punts : 0;
    const inside20Pct = stats.punts ? ((stats.puntInside20 || 0) / stats.punts) * 100 : 0;

    let score = (puntAvg * 2) +
                (inside20Pct * 0.5);

    return score;
  }

  /**
   * Map performance score to OVR scale (55-99)
   * Different positions have different score ranges
   */
  private mapToOVRScale(score: number, position: string): number {
    // Position-specific score ranges based on typical stat outputs
    // These are calibrated so that:
    // - Average starter: ~75-80
    // - Good starter: ~80-85
    // - Pro Bowl level: ~85-88
    // - All-Pro level: ~88-92 (stats alone)
    // - 93+ requires career progression + achievements
    const ranges: { [key: string]: { min: number; max: number } } = {
      'QB': { min: 30, max: 130 },   // Adjusted for better distribution
      'HB': { min: 30, max: 180 },   // 1800+ yard seasons are rare
      'RB': { min: 30, max: 180 },
      'FB': { min: 15, max: 80 },
      'WR': { min: 20, max: 140 },
      'TE': { min: 15, max: 90 },
      'LT': { min: 35, max: 100 },  // OL use games + base floor, higher range
      'LG': { min: 35, max: 100 },
      'C': { min: 35, max: 100 },
      'RG': { min: 35, max: 100 },
      'RT': { min: 35, max: 100 },
      'LE': { min: 10, max: 90 },
      'RE': { min: 10, max: 90 },
      'DT': { min: 10, max: 70 },
      'LOLB': { min: 15, max: 90 },
      'MLB': { min: 20, max: 100 },
      'ROLB': { min: 15, max: 90 },
      'CB': { min: 10, max: 80 },
      'FS': { min: 10, max: 80 },
      'SS': { min: 10, max: 80 },
      'K': { min: 40, max: 100 },
      'P': { min: 60, max: 110 },
    };

    const range = ranges[position] || { min: 20, max: 100 };

    // Normalize score to 0-1 range
    const normalized = Math.max(0, Math.min(1, (score - range.min) / (range.max - range.min)));

    // Map to OVR scale: 55-92 (base stats alone)
    // This leaves room for achievements, career progression, etc. to push to 93+
    // A perfect 1.0 normalized score = 92 OVR from stats alone
    const ovr = 55 + (normalized * 37);

    return ovr;
  }

  /**
   * Calculate age modifier based on position-specific curves
   */
  private calculateAgeModifier(position: string, age: number): number {
    const curve = AGE_CURVES[position] || AGE_CURVES['WR']; // Default to WR curve

    if (age < curve.primeStart) {
      // Pre-prime (rising)
      const yearsToGo = curve.primeStart - age;
      return Math.max(-5, Math.min(5, 3 + yearsToGo)); // +3 to +5
    } else if (age >= curve.primeStart && age <= curve.primeEnd) {
      // In prime
      return 0;
    } else if (age > curve.primeEnd && age < curve.cliff) {
      // Early decline
      const yearsDecline = age - curve.primeEnd;
      return -2 - (yearsDecline * 1.5); // -2 to -5
    } else {
      // Post-cliff
      const yearsPostCliff = age - curve.cliff;
      return -8 - (yearsPostCliff * 2); // -8 to -15
    }
  }

  /**
   * Calculate achievement bonuses for the target year
   * OL positions get extra weight since achievements are their primary quality indicator
   */
  private calculateAchievementBonus(
    achievements: PlayerAchievements,
    statYear: number,
    targetYear: number,
    position?: string
  ): number {
    let bonus = 0;

    // OL positions rely more heavily on achievements since they don't have stats
    const isOL = ['LT', 'LG', 'C', 'RG', 'RT'].includes(position || '');
    const achievementMultiplier = isOL ? 1.5 : 1.0;

    // Pro Bowl for previous year (stat year)
    if (achievements.proBowlYears?.includes(statYear)) {
      bonus += ACHIEVEMENT_BONUSES.proBowl * achievementMultiplier;
    }

    // All-Pro for previous year
    if (achievements.allPro1stYears?.includes(statYear)) {
      bonus += ACHIEVEMENT_BONUSES.allPro1st * achievementMultiplier;
    } else if (achievements.allPro2ndYears?.includes(statYear)) {
      bonus += ACHIEVEMENT_BONUSES.allPro2nd * achievementMultiplier;
    }

    // MVP for previous year
    if (achievements.mvpYears?.includes(statYear)) {
      bonus += ACHIEVEMENT_BONUSES.mvp;
    }

    // OPOY/DPOY for previous year
    if (achievements.opoyYears?.includes(statYear)) {
      bonus += ACHIEVEMENT_BONUSES.opoy;
    }
    if (achievements.dpoyYears?.includes(statYear)) {
      bonus += ACHIEVEMENT_BONUSES.dpoy;
    }

    // HOF bonus (floor boost applied separately)
    // HOF OL get extra recognition
    if (achievements.isHOF) {
      bonus += ACHIEVEMENT_BONUSES.hof * achievementMultiplier;
    }

    return Math.round(bonus);
  }

  /**
   * Get era definition for a given year
   */
  private getEra(year: number): Era {
    for (const era of ERAS) {
      if (year >= era.startYear && year <= era.endYear) {
        return era;
      }
    }
    return ERAS[ERAS.length - 1]; // Default to modern era
  }

  /**
   * Normalize position to our standard format
   */
  private normalizePosition(position: string): string {
    const posMap: { [key: string]: string } = {
      'RB': 'HB',
      'OLB': 'LOLB',
      'ILB': 'MLB',
      'DE': 'LE',
      'S': 'SS',
      'DB': 'CB',
      'T': 'LT',
      'G': 'LG',
      'OT': 'LT',
      'OG': 'LG',
    };

    const upper = position.toUpperCase();
    return posMap[upper] || upper;
  }

  /**
   * Generate a human-readable breakdown of the rating calculation
   */
  private generateBreakdown(
    baseScore: number,
    eraAdjustedScore: number,
    ageModifier: number,
    achievementBonus: number,
    era: Era,
    yearsInLeague: number,
    careerProgression: { maxOVR: number; modifier: number; stage: string }
  ): string {
    const parts = [
      `Base: ${baseScore.toFixed(0)}`,
      `Era OVR: ${eraAdjustedScore.toFixed(0)} (${era.games}g ${era.description})`,
      `Career: Yr${yearsInLeague} ${careerProgression.stage} (max ${careerProgression.maxOVR})`,
    ];

    if (ageModifier !== 0) {
      parts.push(`Age: ${ageModifier > 0 ? '+' : ''}${ageModifier.toFixed(0)}`);
    }

    if (achievementBonus > 0) {
      parts.push(`Achievements: +${achievementBonus}`);
    }

    return parts.join(' | ');
  }

  /**
   * Distribute OVR to individual Madden attributes based on position and archetype
   */
  distributeToAttributes(
    overall: number,
    position: string,
    stats: PlayerSeasonStats
  ): { [key: string]: number } {
    const pos = this.normalizePosition(position);
    const archetype = this.detectArchetype(pos, stats);

    // Base attributes around the OVR
    const baseAttr = overall;

    // Initialize ALL attributes with reasonable defaults
    // Field codes MUST match what the UI expects (database-player-card.js ratingColumns)
    const attrs: { [key: string]: number } = {
      // Core physical
      PSPD: this.clamp(baseAttr - 3),      // Speed
      PACC: this.clamp(baseAttr - 3),      // Acceleration
      PSTR: this.clamp(baseAttr - 5),      // Strength
      PAGI: this.clamp(baseAttr - 5),      // Agility
      PAWR: this.clamp(baseAttr),          // Awareness
      PJMP: this.clamp(baseAttr - 10),     // Jumping
      PSTA: this.clamp(baseAttr + 5),      // Stamina
      PINJ: this.clamp(85),                // Injury
      PTGH: this.clamp(75),                // Toughness
      PCOD: this.clamp(baseAttr - 5),      // Change of Direction
      // Passing (UI uses PPWR for throw power, not PTHP)
      PPWR: this.clamp(50),                // Throw Power
      PTAS: this.clamp(50),                // Throw Accuracy Short
      PTAM: this.clamp(50),                // Throw Accuracy Medium
      PTAD: this.clamp(50),                // Throw Accuracy Deep
      PTOR: this.clamp(50),                // Throw on Run
      PTUP: this.clamp(50),                // Throw Under Pressure
      // Running (UI uses different codes)
      PCAR: this.clamp(50),                // Carrying
      PBCV: this.clamp(50),                // Ball Carrier Vision
      PBTK: this.clamp(50),                // Break Tackle (was PBKT)
      PTRK: this.clamp(50),                // Trucking (was PLTR)
      PELU: this.clamp(baseAttr - 5),      // Elusiveness
      PSFA: this.clamp(50),                // Stiff Arm (was PLSA)
      PSPN: this.clamp(50),                // Spin Move (was PLSM)
      PJKM: this.clamp(50),                // Juke Move (was PLJM)
      // Receiving
      PCTH: this.clamp(50),                // Catching
      PSPC: this.clamp(50),                // Spectacular Catch (was PLSC)
      PCIT: this.clamp(50),                // Catch in Traffic (was PLCI)
      PSRR: this.clamp(50),                // Short Route Running (was SRRN)
      PMRR: this.clamp(50),                // Medium Route Running
      PDRR: this.clamp(50),                // Deep Route Running
      PREL: this.clamp(50),                // Release (was PLRL)
      // Blocking
      PRBK: this.clamp(50),                // Run Block
      PPBK2: this.clamp(50),               // Pass Block (UI uses PPBK2)
      PIBK: this.clamp(50),                // Impact Block (was PLIB)
      PLBK: this.clamp(50),                // Lead Block
      // Defense
      PTAK: this.clamp(50),                // Tackle
      PHIT: this.clamp(50),                // Hit Power (was PLHT)
      PPWM: this.clamp(50),                // Power Moves (was PLPM)
      PFMV: this.clamp(50),                // Finesse Moves (was PFMS)
      PBSH: this.clamp(50),                // Block Shed (was PBSG)
      PPRC: this.clamp(50),                // Pursuit (was PLPU)
      PPLA: this.clamp(50),                // Play Recognition (was PLPR)
      // Coverage
      PMCV: this.clamp(50),                // Man Coverage (was PLMC)
      PZCV: this.clamp(50),                // Zone Coverage (was PLZC)
      PPRS: this.clamp(50),                // Press Coverage (was PLPE)
      // Kicking
      PKPR: this.clamp(50),                // Kick Power
      PKAC: this.clamp(50),                // Kick Accuracy
      PKRT: this.clamp(50),                // Kick Return
    };

    // Position-specific attribute distribution
    this.applyPositionAttributes(attrs, pos, archetype, baseAttr, stats);

    return attrs;
  }

  /**
   * Apply position-specific attribute distributions
   * IMPORTANT: Field codes MUST match database-player-card.js ratingColumns
   */
  private applyPositionAttributes(
    attrs: { [key: string]: number },
    position: string,
    archetype: string,
    baseAttr: number,
    stats: PlayerSeasonStats
  ): void {
    switch (position) {
      case 'QB':
        attrs.PPWR = this.clamp(baseAttr + 5);   // Throw Power
        attrs.PTAS = this.clamp(baseAttr + 3);   // Throw Accuracy Short
        attrs.PTAM = this.clamp(baseAttr);       // Throw Accuracy Medium
        attrs.PTAD = this.clamp(baseAttr - 5);   // Throw Accuracy Deep
        attrs.PTOR = this.clamp(baseAttr - 5);   // Throw on Run
        attrs.PTUP = this.clamp(baseAttr - 3);   // Throw Under Pressure
        attrs.PPLA = this.clamp(baseAttr - 5);   // Play Recognition
        break;

      case 'HB':
      case 'RB':
        // Adjust based on archetype
        if (archetype === 'POWER') {
          attrs.PTRK = this.clamp(baseAttr + 5);  // Trucking
          attrs.PBTK = this.clamp(baseAttr + 3);  // Break Tackle
          attrs.PSPD = this.clamp(baseAttr - 5);  // Slower
        } else if (archetype === 'SPEED') {
          attrs.PSPD = this.clamp(baseAttr + 5);
          attrs.PACC = this.clamp(baseAttr + 5);
          attrs.PELU = this.clamp(baseAttr + 3);  // Elusiveness
        } else if (archetype === 'RECEIVING') {
          attrs.PCTH = this.clamp(baseAttr + 5);  // Catching
          attrs.PSRR = this.clamp(baseAttr);      // Short Route Running
        }
        attrs.PCAR = this.clamp(baseAttr + 3);    // Carrying
        attrs.PBCV = this.clamp(baseAttr);        // Ball Carrier Vision
        attrs.PSFA = this.clamp(baseAttr - 5);    // Stiff Arm
        attrs.PSPN = this.clamp(baseAttr - 5);    // Spin Move
        attrs.PJKM = this.clamp(baseAttr - 5);    // Juke Move
        break;

      case 'WR':
        if (archetype === 'DEEP') {
          attrs.PSPD = this.clamp(baseAttr + 8);
          attrs.PDRR = this.clamp(baseAttr + 5);  // Deep Route Running
          attrs.PREL = this.clamp(baseAttr + 3);  // Release
        } else if (archetype === 'POSSESSION') {
          attrs.PCTH = this.clamp(baseAttr + 8);  // Catching
          attrs.PCIT = this.clamp(baseAttr + 5);  // Catch in Traffic
          attrs.PSRR = this.clamp(baseAttr + 5);  // Short Route Running
        } else {
          attrs.PAGI = this.clamp(baseAttr + 3);
          attrs.PSRR = this.clamp(baseAttr + 3);  // Short Route Running
        }
        attrs.PCTH = this.clamp(baseAttr + 3);    // Catching
        attrs.PSPC = this.clamp(baseAttr - 5);    // Spectacular Catch
        attrs.PMRR = this.clamp(baseAttr);        // Medium Route Running
        attrs.PDRR = this.clamp(baseAttr - 3);    // Deep Route Running
        break;

      case 'TE':
        attrs.PCTH = this.clamp(baseAttr);        // Catching
        attrs.PCIT = this.clamp(baseAttr - 3);    // Catch in Traffic
        attrs.PSRR = this.clamp(baseAttr - 5);    // Short Route Running
        attrs.PRBK = this.clamp(baseAttr - 5);    // Run Block
        attrs.PPBK2 = this.clamp(baseAttr - 8);   // Pass Block
        break;

      case 'LT':
      case 'LG':
      case 'C':
      case 'RG':
      case 'RT':
        attrs.PPBK2 = this.clamp(baseAttr + 3);   // Pass Block
        attrs.PRBK = this.clamp(baseAttr + 3);    // Run Block
        attrs.PIBK = this.clamp(baseAttr);        // Impact Block
        attrs.PLBK = this.clamp(baseAttr);        // Lead Block
        attrs.PSTR = this.clamp(baseAttr + 5);    // Strength
        attrs.PAWR = this.clamp(baseAttr);        // Awareness
        break;

      case 'LE':
      case 'RE':
      case 'DT':
        attrs.PPWM = this.clamp(baseAttr + 3);    // Power Moves
        attrs.PFMV = this.clamp(baseAttr);        // Finesse Moves
        attrs.PBSH = this.clamp(baseAttr);        // Block Shed
        attrs.PTAK = this.clamp(baseAttr - 5);    // Tackle
        attrs.PHIT = this.clamp(baseAttr - 3);    // Hit Power
        attrs.PPRC = this.clamp(baseAttr - 5);    // Pursuit
        attrs.PSTR = this.clamp(baseAttr + 5);    // Strength
        break;

      case 'LOLB':
      case 'MLB':
      case 'ROLB':
        if (archetype === 'EDGE') {
          attrs.PPWM = this.clamp(baseAttr + 5);  // Power Moves
          attrs.PSPD = this.clamp(baseAttr + 3);
        } else if (archetype === 'COVERAGE') {
          attrs.PZCV = this.clamp(baseAttr + 5);  // Zone Coverage
          attrs.PMCV = this.clamp(baseAttr + 3);  // Man Coverage
        }
        attrs.PTAK = this.clamp(baseAttr + 3);    // Tackle
        attrs.PHIT = this.clamp(baseAttr);        // Hit Power
        attrs.PBSH = this.clamp(baseAttr - 3);    // Block Shed
        attrs.PPRC = this.clamp(baseAttr);        // Pursuit
        attrs.PPLA = this.clamp(baseAttr - 3);    // Play Recognition
        break;

      case 'CB':
      case 'FS':
      case 'SS':
        attrs.PMCV = this.clamp(baseAttr + 3);    // Man Coverage
        attrs.PZCV = this.clamp(baseAttr + 3);    // Zone Coverage
        attrs.PPRS = this.clamp(baseAttr - 3);    // Press
        attrs.PTAK = this.clamp(baseAttr - 5);    // Tackle
        attrs.PHIT = this.clamp(baseAttr - 8);    // Hit Power
        attrs.PPRC = this.clamp(baseAttr);        // Pursuit
        attrs.PPLA = this.clamp(baseAttr);        // Play Recognition
        attrs.PCTH = this.clamp(baseAttr - 5);    // Catching
        break;

      case 'K':
        attrs.PKPR = this.clamp(baseAttr + 5);    // Kick Power
        attrs.PKAC = this.clamp(baseAttr + 5);    // Kick Accuracy
        break;

      case 'P':
        attrs.PKPR = this.clamp(baseAttr + 3);    // Kick Power
        attrs.PKAC = this.clamp(baseAttr);        // Kick Accuracy
        break;
    }
  }

  /**
   * Detect player archetype from stats
   */
  private detectArchetype(position: string, stats: PlayerSeasonStats): string {
    switch (position) {
      case 'HB':
      case 'RB':
        const ypc = stats.rushAttempts ? (stats.rushYards || 0) / stats.rushAttempts : 0;
        const receptions = stats.receptions || 0;
        if (ypc > 5.0) return 'SPEED';
        if (receptions > 40) return 'RECEIVING';
        return 'POWER';

      case 'WR':
        const ypr = stats.receptions ? (stats.recYards || 0) / stats.receptions : 0;
        if (ypr > 16) return 'DEEP';
        if ((stats.receptions || 0) > 70) return 'POSSESSION';
        return 'SLOT';

      case 'LOLB':
      case 'MLB':
      case 'ROLB':
        if ((stats.sacks || 0) > 5) return 'EDGE';
        if ((stats.interceptions || 0) > 2) return 'COVERAGE';
        return 'RUN_STUFFER';

      default:
        return 'DEFAULT';
    }
  }

  /**
   * Clamp a value to Madden rating range
   */
  private clamp(value: number, min: number = 40, max: number = 99): number {
    return Math.max(min, Math.min(max, Math.round(value)));
  }
}

// Export singleton
export const statsBasedRatingService = new StatsBasedRatingService();
