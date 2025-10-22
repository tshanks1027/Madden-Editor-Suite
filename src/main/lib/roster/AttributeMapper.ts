/**
 * Attribute Mapper
 *
 * Maps real NFL stats to Madden player attributes using position-specific algorithms.
 * Converts passing yards, rushing yards, tackles, etc. into Madden ratings (40-99).
 *
 * Source: Custom implementation based on Madden rating formulas
 */

import { PlayerStats } from '../../services/ScraperService';

export interface MaddenAttributes {
  // Core Attributes
  POVR: number; // Overall Rating
  PSPD: number; // Speed
  PACC: number; // Acceleration
  PAGI: number; // Agility
  PSTR: number; // Strength
  PAWR: number; // Awareness
  PJMP: number; // Jumping
  PSTA: number; // Stamina
  PINJ: number; // Injury
  PTGH: number; // Toughness

  // QB Attributes
  PTHP?: number; // Throw Power
  PTHA?: number; // Throw Accuracy Short
  PTAM?: number; // Throw Accuracy Medium
  PTAS?: number; // Throw Accuracy Deep

  // Offensive Attributes
  PCAR?: number; // Carrying
  PBTK?: number; // Break Tackle
  PCTH?: number; // Catching
  PCIT?: number; // Catch in Traffic
  PRTE?: number; // Route Running
  PREL?: number; // Release

  // Blocking
  PRBK?: number; // Run Block
  PLBK?: number; // Pass Block

  // Defensive Attributes
  PTAK?: number; // Tackling
  PHIT?: number; // Hit Power
  PPOW?: number; // Power Moves
  PFMS?: number; // Finesse Moves
  PBSH?: number; // Block Shedding
  PMAN?: number; // Man Coverage
  PZON?: number; // Zone Coverage
  PPRS?: number; // Press

  // Special Teams
  PKPR?: number; // Kick Power
  PKAC?: number; // Kick Accuracy
}

/**
 * Map player stats to Madden attributes
 * @param stats - Player stats from scraper
 * @param isHOF - Is player a Hall of Famer
 * @returns Madden attributes object
 */
export function mapStatsToAttributes(stats: PlayerStats, isHOF: boolean = false): MaddenAttributes {
  const position = normalizePosition(stats.position);

  // Base attributes (everyone gets these)
  const attributes: MaddenAttributes = {
    ...calculateBaseAttributes(stats, isHOF),
    ...calculatePositionSpecificAttributes(stats, position, isHOF)
  };

  // Calculate overall rating based on position
  attributes.POVR = calculateOverall(attributes, position, isHOF);

  return attributes;
}

/**
 * Calculate base attributes that every player has
 */
function calculateBaseAttributes(stats: PlayerStats, isHOF: boolean): Partial<MaddenAttributes> {
  const hofBonus = isHOF ? 10 : 0;

  // Base physical attributes
  const base = {
    PSPD: clamp(65 + hofBonus, 40, 99), // Default speed, adjusted by position
    PACC: clamp(65 + hofBonus, 40, 99),
    PAGI: clamp(65 + hofBonus, 40, 99),
    PSTR: clamp(estimateStrength(stats.weight), 40, 99),
    PAWR: clamp(65 + hofBonus, 40, 99), // Base awareness
    PJMP: clamp(65, 40, 99),
    PSTA: clamp(80, 40, 99), // Most players have good stamina
    PINJ: clamp(85, 1, 99), // Injury rating (higher = less prone)
    PTGH: clamp(70 + hofBonus, 40, 99)
  };

  return base;
}

/**
 * Calculate position-specific attributes
 */
function calculatePositionSpecificAttributes(
  stats: PlayerStats,
  position: string,
  isHOF: boolean
): Partial<MaddenAttributes> {
  const hofBonus = isHOF ? 10 : 0;

  switch (position) {
    case 'QB':
      return calculateQBAttributes(stats, hofBonus);
    case 'HB':
    case 'FB':
      return calculateRBAttributes(stats, hofBonus);
    case 'WR':
    case 'TE':
      return calculateReceiverAttributes(stats, hofBonus);
    case 'LT':
    case 'LG':
    case 'C':
    case 'RG':
    case 'RT':
      return calculateOLineAttributes(stats, hofBonus);
    case 'LE':
    case 'RE':
    case 'DT':
      return calculateDLineAttributes(stats, hofBonus);
    case 'LOLB':
    case 'MLB':
    case 'ROLB':
      return calculateLBAttributes(stats, hofBonus);
    case 'CB':
    case 'FS':
    case 'SS':
      return calculateDBAttributes(stats, hofBonus);
    case 'K':
    case 'P':
      return calculateKickerAttributes(stats, hofBonus);
    default:
      return {};
  }
}

/**
 * Calculate QB-specific attributes
 */
function calculateQBAttributes(stats: PlayerStats, hofBonus: number): Partial<MaddenAttributes> {
  const passYards = stats.passYards || 0;
  const passTDs = stats.passTDs || 0;
  const passAttempts = stats.passAttempts || 1;
  const passCompletions = stats.passCompletions || 0;
  const interceptions = stats.interceptions || 0;

  // Completion percentage
  const completionPct = passAttempts > 0 ? (passCompletions / passAttempts) * 100 : 50;

  // TD:INT ratio
  const tdIntRatio = interceptions > 0 ? passTDs / interceptions : passTDs;

  // Throw Power based on yards per attempt
  const yardsPerAttempt = passAttempts > 0 ? passYards / passAttempts : 5;
  const throwPower = clamp(55 + (yardsPerAttempt - 5) * 5 + hofBonus, 40, 99);

  // Accuracy based on completion percentage
  const throwAcc = clamp(50 + (completionPct - 50) * 0.8 + hofBonus, 40, 99);

  // Better QBs have better deep ball
  const deepAcc = clamp(throwAcc - 5 + (tdIntRatio * 2), 40, 99);

  return {
    PTHP: throwPower,
    PTHA: Math.round(throwAcc + 3), // Short accuracy slightly better
    PTAM: Math.round(throwAcc),
    PTAS: Math.round(deepAcc),
    PSPD: clamp(60 + hofBonus, 40, 99), // QBs are slower
    PACC: clamp(60 + hofBonus, 40, 99),
    PAGI: clamp(65 + hofBonus, 40, 99),
    PAWR: clamp(75 + (tdIntRatio * 2) + hofBonus, 40, 99),
    PCAR: clamp(60, 40, 99) // Basic carrying for scrambles
  };
}

/**
 * Calculate RB-specific attributes
 */
function calculateRBAttributes(stats: PlayerStats, hofBonus: number): Partial<MaddenAttributes> {
  const rushYards = stats.rushYards || 0;
  const rushAttempts = stats.rushAttempts || 1;
  const rushTDs = stats.rushTDs || 0;

  // Yards per carry
  const yardsPerCarry = rushAttempts > 0 ? rushYards / rushAttempts : 3;

  // Speed/Acceleration based on production
  const speed = clamp(75 + (yardsPerCarry - 4) * 5 + hofBonus, 40, 99);
  const carrying = clamp(70 + (rushTDs * 2) + hofBonus, 40, 99);
  const breakTackle = clamp(65 + (yardsPerCarry - 4) * 4 + hofBonus, 40, 99);

  return {
    PSPD: Math.round(speed),
    PACC: Math.round(speed - 2),
    PAGI: Math.round(speed - 3),
    PCAR: carrying,
    PBTK: breakTackle,
    PCTH: clamp(60 + hofBonus, 40, 99), // Basic catching
    PAWR: clamp(70 + hofBonus, 40, 99)
  };
}

/**
 * Calculate Receiver-specific attributes
 */
function calculateReceiverAttributes(stats: PlayerStats, hofBonus: number): Partial<MaddenAttributes> {
  const recYards = stats.recYards || 0;
  const receptions = stats.receptions || 1;
  const recTDs = stats.recTDs || 0;

  // Yards per reception
  const yardsPerCatch = receptions > 0 ? recYards / receptions : 10;

  const catching = clamp(65 + (receptions / 10) + (recTDs * 2) + hofBonus, 40, 99);
  const speed = clamp(75 + (yardsPerCatch - 10) * 2 + hofBonus, 40, 99);

  return {
    PCTH: Math.round(catching),
    PCIT: Math.round(catching - 5), // Catch in traffic slightly lower
    PSPD: Math.round(speed),
    PACC: Math.round(speed - 3),
    PAGI: Math.round(speed - 2),
    PRTE: clamp(70 + hofBonus, 40, 99), // Route running
    PREL: clamp(68 + hofBonus, 40, 99), // Release
    PAWR: clamp(70 + hofBonus, 40, 99)
  };
}

/**
 * Calculate O-Line-specific attributes
 */
function calculateOLineAttributes(stats: PlayerStats, hofBonus: number): Partial<MaddenAttributes> {
  // O-Line stats are hard to scrape, use defaults based on weight
  const strength = estimateStrength(stats.weight);

  return {
    PSTR: strength,
    PRBK: clamp(70 + hofBonus, 40, 99),
    PLBK: clamp(70 + hofBonus, 40, 99),
    PAWR: clamp(70 + hofBonus, 40, 99),
    PSPD: clamp(55, 40, 99), // O-Line is slow
    PACC: clamp(55, 40, 99),
    PAGI: clamp(50, 40, 99)
  };
}

/**
 * Calculate D-Line-specific attributes
 */
function calculateDLineAttributes(stats: PlayerStats, hofBonus: number): Partial<MaddenAttributes> {
  const sacks = stats.sacks || 0;
  const tackles = stats.tackles || 0;

  const strength = estimateStrength(stats.weight);
  const powerMoves = clamp(65 + (sacks * 3) + hofBonus, 40, 99);

  return {
    PSTR: strength,
    PTAK: clamp(70 + (tackles / 10) + hofBonus, 40, 99),
    PHIT: clamp(75 + hofBonus, 40, 99),
    PPOW: Math.round(powerMoves),
    PFMS: Math.round(powerMoves - 5),
    PBSH: clamp(70 + (sacks * 2) + hofBonus, 40, 99),
    PAWR: clamp(70 + hofBonus, 40, 99),
    PSPD: clamp(65 + hofBonus, 40, 99),
    PACC: clamp(65 + hofBonus, 40, 99),
    PAGI: clamp(60 + hofBonus, 40, 99)
  };
}

/**
 * Calculate LB-specific attributes
 */
function calculateLBAttributes(stats: PlayerStats, hofBonus: number): Partial<MaddenAttributes> {
  const tackles = stats.tackles || 0;
  const sacks = stats.sacks || 0;
  const interceptions = stats.interceptionsCaught || 0;

  const tackling = clamp(70 + (tackles / 10) + hofBonus, 40, 99);

  return {
    PTAK: Math.round(tackling),
    PHIT: clamp(75 + hofBonus, 40, 99),
    PPOW: clamp(65 + (sacks * 2) + hofBonus, 40, 99),
    PBSH: clamp(65 + hofBonus, 40, 99),
    PMAN: clamp(55 + (interceptions * 3) + hofBonus, 40, 99),
    PZON: clamp(60 + (interceptions * 3) + hofBonus, 40, 99),
    PAWR: clamp(75 + hofBonus, 40, 99),
    PSPD: clamp(70 + hofBonus, 40, 99),
    PACC: clamp(70 + hofBonus, 40, 99),
    PAGI: clamp(68 + hofBonus, 40, 99)
  };
}

/**
 * Calculate DB-specific attributes
 */
function calculateDBAttributes(stats: PlayerStats, hofBonus: number): Partial<MaddenAttributes> {
  const interceptions = stats.interceptionsCaught || 0;
  const passDefended = stats.passDefended || 0;
  const tackles = stats.tackles || 0;

  const coverage = clamp(65 + (interceptions * 4) + (passDefended * 1.5) + hofBonus, 40, 99);
  const speed = clamp(78 + hofBonus, 40, 99);

  return {
    PMAN: Math.round(coverage),
    PZON: Math.round(coverage + 2), // Zone slightly better than man
    PPRS: clamp(70 + hofBonus, 40, 99),
    PTAK: clamp(60 + (tackles / 10), 40, 99),
    PSPD: Math.round(speed),
    PACC: Math.round(speed - 2),
    PAGI: Math.round(speed - 1),
    PJMP: clamp(75 + (interceptions * 2), 40, 99),
    PAWR: clamp(75 + hofBonus, 40, 99)
  };
}

/**
 * Calculate Kicker-specific attributes
 */
function calculateKickerAttributes(stats: PlayerStats, hofBonus: number): Partial<MaddenAttributes> {
  return {
    PKPR: clamp(75 + hofBonus, 40, 99),
    PKAC: clamp(75 + hofBonus, 40, 99),
    PAWR: clamp(65 + hofBonus, 40, 99),
    PSPD: 50, // Kickers don't need speed
    PACC: 50,
    PAGI: 50,
    PSTR: 45
  };
}

/**
 * Calculate overall rating based on position key attributes
 */
function calculateOverall(attributes: MaddenAttributes, position: string, isHOF: boolean): number {
  let overall = 70;
  const hofBonus = isHOF ? 5 : 0;

  switch (position) {
    case 'QB':
      overall = Math.round((
        (attributes.PTHA || 70) * 0.3 +
        (attributes.PTAM || 70) * 0.25 +
        (attributes.PTAS || 70) * 0.2 +
        (attributes.PTHP || 70) * 0.15 +
        (attributes.PAWR || 70) * 0.1
      ));
      break;

    case 'HB':
    case 'FB':
      overall = Math.round((
        (attributes.PSPD || 70) * 0.25 +
        (attributes.PCAR || 70) * 0.25 +
        (attributes.PBTK || 70) * 0.2 +
        (attributes.PAGI || 70) * 0.15 +
        (attributes.PACC || 70) * 0.15
      ));
      break;

    case 'WR':
    case 'TE':
      overall = Math.round((
        (attributes.PCTH || 70) * 0.3 +
        (attributes.PSPD || 70) * 0.25 +
        (attributes.PRTE || 70) * 0.2 +
        (attributes.PREL || 70) * 0.15 +
        (attributes.PCIT || 70) * 0.1
      ));
      break;

    case 'LT':
    case 'LG':
    case 'C':
    case 'RG':
    case 'RT':
      overall = Math.round((
        (attributes.PRBK || 70) * 0.4 +
        (attributes.PLBK || 70) * 0.4 +
        (attributes.PSTR || 70) * 0.15 +
        (attributes.PAWR || 70) * 0.05
      ));
      break;

    case 'LE':
    case 'RE':
    case 'DT':
      overall = Math.round((
        (attributes.PPOW || 70) * 0.25 +
        (attributes.PBSH || 70) * 0.2 +
        (attributes.PSTR || 70) * 0.2 +
        (attributes.PTAK || 70) * 0.2 +
        (attributes.PFMS || 70) * 0.15
      ));
      break;

    case 'LOLB':
    case 'MLB':
    case 'ROLB':
      overall = Math.round((
        (attributes.PTAK || 70) * 0.3 +
        (attributes.PZON || 70) * 0.2 +
        (attributes.PMAN || 70) * 0.15 +
        (attributes.PHIT || 70) * 0.15 +
        (attributes.PAWR || 70) * 0.2
      ));
      break;

    case 'CB':
    case 'FS':
    case 'SS':
      overall = Math.round((
        (attributes.PMAN || 70) * 0.25 +
        (attributes.PZON || 70) * 0.25 +
        (attributes.PSPD || 70) * 0.2 +
        (attributes.PAGI || 70) * 0.15 +
        (attributes.PAWR || 70) * 0.15
      ));
      break;

    case 'K':
    case 'P':
      overall = Math.round((
        (attributes.PKAC || 70) * 0.5 +
        (attributes.PKPR || 70) * 0.5
      ));
      break;
  }

  return clamp(overall + hofBonus, 40, 99);
}

/**
 * Estimate strength based on weight
 */
function estimateStrength(weight: number = 200): number {
  // 150lb = 40 STR, 350lb = 99 STR (linear)
  return clamp(40 + ((weight - 150) / 200) * 59, 40, 99);
}

/**
 * Normalize position names to standard Madden positions
 */
function normalizePosition(position: string): string {
  const posMap: { [key: string]: string } = {
    'QB': 'QB',
    'RB': 'HB',
    'HB': 'HB',
    'FB': 'FB',
    'WR': 'WR',
    'TE': 'TE',
    'T': 'LT', // Generic tackle
    'OT': 'LT',
    'LT': 'LT',
    'RT': 'RT',
    'G': 'LG', // Generic guard
    'OG': 'LG',
    'LG': 'LG',
    'RG': 'RG',
    'C': 'C',
    'DE': 'LE', // Generic defensive end
    'LE': 'LE',
    'RE': 'RE',
    'DT': 'DT',
    'NT': 'DT', // Nose tackle = DT
    'LB': 'MLB', // Generic linebacker
    'OLB': 'LOLB',
    'LOLB': 'LOLB',
    'ROLB': 'ROLB',
    'ILB': 'MLB',
    'MLB': 'MLB',
    'CB': 'CB',
    'S': 'FS', // Generic safety
    'FS': 'FS',
    'SS': 'SS',
    'K': 'K',
    'P': 'P'
  };

  return posMap[position.toUpperCase()] || 'WR'; // Default to WR if unknown
}

/**
 * Clamp value between min and max
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}
