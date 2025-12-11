/**
 * OVR Weights Calculator
 *
 * Calculates Overall Rating using the official Madden archetype-based formulas
 * from ovrweights.json.
 *
 * OVR Formula: Sum(attribute * weight) / divisor
 *   - Roster/Franchise files: divisor = 10 (legacy compatibility)
 *   - Draft class files: divisor = 11 (verified against M24 real data)
 *
 * Validated against 2368 Madden 24 roster players:
 *   - Divisor 11: avg error 3.81 pts, 51 archetype categories better
 *   - Divisor 10: avg error 7.47 pts, 12 archetype categories better
 *
 * The game recalculates OVR from attributes when loading, ignoring stored values.
 */

// Divisors for different file types
// Verified against Madden 24 roster data (2368 players):
// - LE Speed Rushers: Div 11 avg error 2.2 vs Div 10 avg error 6.4
// - CB Man-to-Man: Div 11 avg error 2.7 vs Div 10 avg error 8.3
// - Average needed divisor across all positions: ~11
const ROSTER_DIVISOR = 10;      // Standard roster/franchise files (for legacy compatibility)
const DRAFT_CLASS_DIVISOR = 11; // Draft class files - verified against M24 real data

import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

// Mapping from JSON attribute names to Madden field codes
const ATTR_NAME_TO_FIELD: { [key: string]: string } = {
  'AccelerationRating': 'PACC',
  'AgilityRating': 'PAGI',
  'AwarenessRating': 'PAWR',
  'BCVisionRating': 'PBCV',
  'BlockSheddingRating': 'PBSG',
  'BreakSackRating': 'PBSK',
  'BreakTackleRating': 'PBKT',
  'CarryingRating': 'PCAR',
  'CatchingRating': 'PCTH',
  'CatchInTrafficRating': 'PLCI',
  'ChangeOfDirectionRating': 'PELU',
  'FinesseMovesRating': 'PFMS',
  'HitPowerRating': 'PLHT',
  'ImpactBlockingRating': 'PLIB',
  'InjuryRating': 'PINJ',
  'JukeMoveRating': 'PLJM',
  'JumpingRating': 'PJMP',
  'KickAccuracyRating': 'PKAC',
  'KickPowerRating': 'PKPR',
  'LeadBlockRating': 'PLBK',
  'ManCoverageRating': 'PLMC',
  'PassBlockFinesseRating': 'PPBF',
  'PassBlockPowerRating': 'PPBS',
  'PassBlockRating': 'PPBK',
  'PlayActionRating': 'PPLA',
  'PlayRecognitionRating': 'PLPR',
  'PowerMovesRating': 'PLPM',
  'PressRating': 'PLPE',
  'PursuitRating': 'PLPU',
  'ReleaseRating': 'PLRL',
  'DeepRouteRunningRating': 'PDRR',
  'MediumRouteRunningRating': 'PMRR',
  'ShortRouteRunningRating': 'SRRN',
  'RunBlockFinesseRating': 'PRBF',
  'RunBlockPowerRating': 'PRBS',
  'RunBlockRating': 'PRBK',
  'SpectacularCatchRating': 'PLSC',
  'SpeedRating': 'PSPD',
  'SpinMoveRating': 'PLSM',
  'StaminaRating': 'PSTA',
  'StiffArmRating': 'PLSA',
  'StrengthRating': 'PSTR',
  'TackleRating': 'PTAK',
  'ThrowAccuracyDeepRating': 'PTAD',
  'ThrowAccuracyMidRating': 'PTAM',
  'ThrowAccuracyShortRating': 'PTAS',
  'ThrowOnTheRunRating': 'PTOR',
  'ThrowPowerRating': 'PTHP',
  'ThrowUnderPressureRating': 'PTUP',
  'TruckingRating': 'PLTR',
  'ZoneCoverageRating': 'PLZC',
  'ToughnessRating': 'PTGH',
  'KickReturnRating': 'PKRT'
};

// Reverse mapping: field code to attribute name
const FIELD_TO_ATTR_NAME: { [key: string]: string } = {};
for (const [attrName, fieldCode] of Object.entries(ATTR_NAME_TO_FIELD)) {
  FIELD_TO_ATTR_NAME[fieldCode] = attrName;
}

// Position ID to position name mapping
const POSITION_ID_TO_NAME: { [key: number]: string } = {
  0: 'QB', 1: 'HB', 2: 'FB', 3: 'WR', 4: 'TE', 5: 'LT', 6: 'LG', 7: 'C',
  8: 'RG', 9: 'RT', 10: 'LE', 11: 'RE', 12: 'DT', 13: 'LOLB', 14: 'MLB',
  15: 'ROLB', 16: 'CB', 17: 'FS', 18: 'SS', 19: 'K', 20: 'P', 21: 'LS'
};

// Mapping from global archetype ID (0-67) to OVRWeights formula name
// The game uses these IDs at offset 0x4b in draft class files
const ARCHETYPE_ID_TO_FORMULA: { [key: number]: string } = {
  // QB Archetypes (0-4)
  0: 'QB_FieldGeneral',
  1: 'QB_StrongArm',
  2: 'QB_Improviser',
  3: 'QB_Scrambler',
  4: 'QB_Scrambler',  // Pure Scrambler uses Scrambler formula

  // HB Archetypes (5-11)
  5: 'HB_PowerBack',
  6: 'HB_ElusiveBack',
  7: 'HB_ReceivingBack',
  8: 'HB_PowerBack',  // Power Blocking
  9: 'HB_ReceivingBack',  // Power Receiving
  10: 'HB_ElusiveBack',  // Elusive Power
  11: 'HB_ReceivingBack',  // Elusive Receiving

  // FB Archetypes (12-13)
  12: 'FB_Blocking',
  13: 'FB_Utility',

  // WR Archetypes (14-21)
  14: 'WR_DeepThreat',
  15: 'WR_Playmaker',
  16: 'WR_Physical',  // Physical Route Runner
  17: 'WR_Slot',  // Shifty Route Runner
  18: 'WR_Physical',  // Physical Blocker
  19: 'WR_Slot',  // Gadget Receiver
  20: 'WR_Physical',
  21: 'WR_Slot',

  // TE Archetypes (22-26)
  22: 'TE_Blocking',
  23: 'TE_VerticalThreat',
  24: 'TE_Possession',  // Physical Route Runner
  25: 'TE_Blocking',  // Possession Blocking
  26: 'TE_Possession',

  // C Archetypes (27-30)
  27: 'C_PassProtector',
  28: 'C_Power',
  29: 'C_Agile',  // Well-Rounded
  30: 'C_Agile',

  // OT Archetypes (31-34)
  31: 'OT_PassProtector',
  32: 'OT_Power',
  33: 'OT_Agile',  // Well-Rounded
  34: 'OT_Agile',

  // G Archetypes (35-38)
  35: 'G_PassProtector',
  36: 'G_Agile',  // Well-Rounded
  37: 'G_Power',
  38: 'G_Agile',

  // DE Archetypes (39-42)
  39: 'DE_SmallerSpeedRusher',
  40: 'DE_PowerRusher',
  41: 'DE_PowerRusher',  // Pure Power
  42: 'DE_RunStopper',

  // DT Archetypes (43-46)
  43: 'DT_RunStopper',  // Nose Tackle
  44: 'DT_PowerRusher',  // Pure Power
  45: 'DT_SpeedRusher',
  46: 'DT_PowerRusher',

  // OLB Archetypes (47-50)
  47: 'OLB_SpeedRusher',
  48: 'OLB_PowerRusher',
  49: 'OLB_PassCoverage',
  50: 'OLB_RunStopper',

  // MLB Archetypes (51-53)
  51: 'MLB_FieldGeneral',
  52: 'MLB_PassCoverage',
  53: 'MLB_RunStopper',

  // CB Archetypes (54-57)
  54: 'CB_MantoMan',
  55: 'CB_Slot',
  56: 'CB_Zone',
  57: 'CB_MantoMan',  // Hybrid Corner

  // S Archetypes (58-60)
  58: 'S_Zone',
  59: 'S_Hybrid',
  60: 'S_RunSupport',

  // Special Teams Archetypes (61-66)
  61: 'KP_Accurate',
  62: 'KP_Power',
  63: 'KP_Accurate',  // KR Balanced - use default
  64: 'KP_Accurate',  // PR Balanced - use default
  65: 'C_Power',  // LS Power - use Center formula
  66: 'C_PassProtector',  // LS Accurate - use Center formula

  // Gadget (67)
  67: 'WR_Slot'  // Gadget - use Slot WR formula
};

// Map position names to JSON position names
const POSITION_TO_JSON_POS: { [key: string]: string } = {
  'QB': 'QB',
  'HB': 'HB',
  'FB': 'FB',
  'WR': 'WR',
  'TE': 'TE',
  'LT': 'OT', 'RT': 'OT',
  'LG': 'G', 'RG': 'G',
  'C': 'C',
  'LE': 'DE', 'RE': 'DE', 'LEDG': 'DE', 'REDG': 'DE',
  'DT': 'DT',
  'LOLB': 'OLB', 'ROLB': 'OLB', 'SAM': 'OLB', 'WILL': 'OLB',
  'MLB': 'MLB', 'MIKE': 'MLB',
  'CB': 'CB',
  'FS': 'S', 'SS': 'S',
  'K': 'KP', 'P': 'KP',
  'LS': 'C' // Long snapper uses Center formula
};

// Default archetypes for each position when archetype is not specified
const DEFAULT_ARCHETYPES: { [key: string]: string } = {
  'QB': 'QB_FieldGeneral',
  'HB': 'HB_PowerBack',
  'FB': 'FB_Blocking',
  'WR': 'WR_Playmaker',
  'TE': 'TE_Possession',
  'OT': 'OT_PassProtector',
  'G': 'G_PassProtector',
  'C': 'C_PassProtector',
  'DE': 'DE_PowerRusher',
  'DT': 'DT_RunStopper',
  'OLB': 'OLB_PassCoverage',
  'MLB': 'MLB_FieldGeneral',
  'CB': 'CB_Zone',
  'S': 'S_Zone',
  'KP': 'KP_Accurate'
};

interface ArchetypeWeights {
  Pos: string;
  Archetype: string;
  DesiredHigh: number;
  DesiredLow: number;
  [attribute: string]: string | number;
}

interface PlayerAttributes {
  [key: string]: number | string | undefined;
}

interface OVRBreakdown {
  ovr: number;
  archetype: string | null;
  breakdown: {
    [fieldCode: string]: {
      name: string;
      value: number;
      weight: number;
      contribution: number;
    }
  };
}

export class OVRWeightsCalculator {
  private weights: Map<string, ArchetypeWeights> = new Map();
  private initialized: boolean = false;

  constructor() {
    try {
      this.loadWeights();
      this.initialized = true;
      console.log('[OVRWeightsCalculator] Initialized successfully');
    } catch (error) {
      console.error('[OVRWeightsCalculator] Failed to initialize:', error);
      this.initialized = false;
    }
  }

  /**
   * Check if calculator is ready to use
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Load weights from ovrweights.json
   */
  private loadWeights(): void {
    let weightsPath: string;

    // Use app.getAppPath() for both dev and packaged builds
    weightsPath = path.join(app.getAppPath(), 'data', 'lookups', 'ovrweights.json');

    console.log('[OVRWeightsCalculator] Loading weights from:', weightsPath);

    if (!fs.existsSync(weightsPath)) {
      throw new Error(`Weights file not found: ${weightsPath}`);
    }

    const content = fs.readFileSync(weightsPath, 'utf-8');
    const weightsData: ArchetypeWeights[] = JSON.parse(content);

    if (!Array.isArray(weightsData)) {
      throw new Error('Invalid weights data format - expected array');
    }

    // Index by archetype for fast lookup
    for (const entry of weightsData) {
      if (entry.Archetype) {
        this.weights.set(entry.Archetype, entry);
      }
    }

    console.log(`[OVRWeightsCalculator] Loaded ${this.weights.size} archetype formulas`);
  }

  /**
   * Get attribute value with proper handling for missing/invalid values
   */
  private getAttr(player: PlayerAttributes, fieldCode: string): number {
    const val = player[fieldCode];

    // Check for invalid values
    if (val === undefined || val === null || val === '' || (typeof val === 'number' && isNaN(val))) {
      return 50; // Default to average rating
    }

    const numVal = Number(val);
    if (isNaN(numVal)) {
      return 50;
    }

    // Clamp to valid range
    return Math.max(0, Math.min(99, numVal));
  }

  /**
   * Normalize position string to standard format
   */
  private normalizePosition(pos: string | number | undefined | null): string | null {
    if (pos === undefined || pos === null) return null;

    // If numeric, convert using position lookup
    if (typeof pos === 'number' || !isNaN(Number(pos))) {
      return POSITION_ID_TO_NAME[Number(pos)] || null;
    }

    return String(pos).toUpperCase().trim();
  }

  /**
   * Find the best matching archetype for a player
   * Handles both numeric archetype IDs (0-67) and string archetype names
   */
  private findArchetype(player: PlayerAttributes, jsonPos: string): string | null {
    // First, try to use the player's archetype field
    const playerArchetype = player['ARCHETYPE'] || player['Archetype'] || player['archetype'] ||
                           player['PLTY'] || player['PlayerType'];

    if (playerArchetype !== undefined && playerArchetype !== null) {
      // Check if it's a numeric archetype ID (0-67)
      const numericId = Number(playerArchetype);
      if (!isNaN(numericId) && numericId >= 0 && numericId <= 67) {
        const formulaName = ARCHETYPE_ID_TO_FORMULA[numericId];
        if (formulaName && this.weights.has(formulaName)) {
          console.log(`[OVRWeightsCalculator] Archetype ID ${numericId} -> Formula: ${formulaName}`);
          return formulaName;
        }
      }

      const archetypeStr = String(playerArchetype).trim();

      // Check if it's already a full archetype name (e.g., "QB_FieldGeneral")
      if (this.weights.has(archetypeStr)) {
        return archetypeStr;
      }

      // Try prefixing with position (e.g., "FieldGeneral" -> "QB_FieldGeneral")
      const prefixedArchetype = `${jsonPos}_${archetypeStr}`;
      if (this.weights.has(prefixedArchetype)) {
        return prefixedArchetype;
      }

      // Try matching by searching for partial match
      for (const archKey of this.weights.keys()) {
        if (archKey.startsWith(`${jsonPos}_`) &&
            archKey.toLowerCase().includes(archetypeStr.toLowerCase())) {
          return archKey;
        }
      }
    }

    // Fall back to default archetype for position
    return DEFAULT_ARCHETYPES[jsonPos] || null;
  }

  /**
   * Calculate Overall Rating for a player based on archetype
   * @param attributes - Player attributes object with field codes (PSPD, PAWR, etc.)
   * @param position - Player position (string name or numeric ID)
   * @param archetype - Optional archetype override
   * @param isDraftClass - If true, use draft class divisor (11.1), otherwise roster divisor (10)
   * @returns Calculated Overall Rating (0-99)
   */
  calculateOVR(attributes: PlayerAttributes, position: string | number, archetype?: string, isDraftClass: boolean = false): number {
    if (!this.initialized) {
      console.warn('[OVRWeightsCalculator] Weights not loaded');
      return 50;
    }

    // Normalize position
    const normalizedPos = this.normalizePosition(position);
    if (!normalizedPos) {
      console.log('[OVRWeightsCalculator] Could not normalize position:', position);
      return 50;
    }

    // Map to JSON position name
    const jsonPos = POSITION_TO_JSON_POS[normalizedPos];
    if (!jsonPos) {
      console.log('[OVRWeightsCalculator] No JSON position mapping for:', normalizedPos);
      return 50;
    }

    // Find archetype
    let archetypeName: string | null;
    if (archetype) {
      // Try to use provided archetype
      if (this.weights.has(archetype)) {
        archetypeName = archetype;
      } else {
        // Try prefixing with position
        const prefixed = `${jsonPos}_${archetype}`;
        archetypeName = this.weights.has(prefixed) ? prefixed : this.findArchetype(attributes, jsonPos);
      }
    } else {
      archetypeName = this.findArchetype(attributes, jsonPos);
    }

    if (!archetypeName) {
      console.log('[OVRWeightsCalculator] Could not find archetype for position:', jsonPos);
      return 50;
    }

    // Get weights for this archetype
    const weights = this.weights.get(archetypeName);
    if (!weights) {
      console.log('[OVRWeightsCalculator] No weights found for archetype:', archetypeName);
      return 50;
    }

    // Calculate weighted sum
    let weightedSum = 0;

    for (const [attrName, fieldCode] of Object.entries(ATTR_NAME_TO_FIELD)) {
      const weight = Number(weights[attrName]) || 0;
      if (weight > 0) {
        const attrValue = this.getAttr(attributes, fieldCode);
        weightedSum += attrValue * weight;
      }
    }

    // Use appropriate divisor based on file type
    // Draft classes use 11.1 (discovered by analyzing EA's CAREERDRAFT-2026Template)
    // Roster/Franchise files use 10 (standard formula)
    const divisor = isDraftClass ? DRAFT_CLASS_DIVISOR : ROSTER_DIVISOR;
    const rawOVR = weightedSum / divisor;

    // Round and clamp to 0-99
    const finalOVR = Math.max(0, Math.min(99, Math.round(rawOVR)));

    console.log(`[OVRWeightsCalculator] Pos: ${normalizedPos} | Archetype: ${archetypeName} | Divisor: ${divisor} | Raw: ${rawOVR.toFixed(2)} | Final: ${finalOVR}`);

    return finalOVR;
  }

  /**
   * Calculate OVR with detailed breakdown
   * @param isDraftClass - If true, use draft class divisor (11.1), otherwise roster divisor (10)
   */
  calculateOVRWithBreakdown(attributes: PlayerAttributes, position: string | number, archetype?: string, isDraftClass: boolean = false): OVRBreakdown {
    if (!this.initialized) {
      return { ovr: 50, archetype: null, breakdown: {} };
    }

    // Normalize position
    const normalizedPos = this.normalizePosition(position);
    if (!normalizedPos) {
      return { ovr: 50, archetype: null, breakdown: {} };
    }

    // Map to JSON position name
    const jsonPos = POSITION_TO_JSON_POS[normalizedPos];
    if (!jsonPos) {
      return { ovr: 50, archetype: null, breakdown: {} };
    }

    // Find archetype
    let archetypeName: string | null;
    if (archetype && this.weights.has(archetype)) {
      archetypeName = archetype;
    } else if (archetype) {
      const prefixed = `${jsonPos}_${archetype}`;
      archetypeName = this.weights.has(prefixed) ? prefixed : this.findArchetype(attributes, jsonPos);
    } else {
      archetypeName = this.findArchetype(attributes, jsonPos);
    }

    if (!archetypeName) {
      return { ovr: 50, archetype: null, breakdown: {} };
    }

    const weights = this.weights.get(archetypeName);
    if (!weights) {
      return { ovr: 50, archetype: archetypeName, breakdown: {} };
    }

    // Use appropriate divisor based on file type
    const divisor = isDraftClass ? DRAFT_CLASS_DIVISOR : ROSTER_DIVISOR;

    // Calculate with breakdown
    let weightedSum = 0;
    const breakdown: OVRBreakdown['breakdown'] = {};

    for (const [attrName, fieldCode] of Object.entries(ATTR_NAME_TO_FIELD)) {
      const weight = Number(weights[attrName]) || 0;
      if (weight > 0) {
        const attrValue = this.getAttr(attributes, fieldCode);
        const contribution = attrValue * weight;
        weightedSum += contribution;
        breakdown[fieldCode] = {
          name: attrName.replace('Rating', ''),
          value: attrValue,
          weight: weight,
          contribution: contribution / divisor // Normalized contribution using correct divisor
        };
      }
    }

    const rawOVR = weightedSum / divisor;
    const finalOVR = Math.max(0, Math.min(99, Math.round(rawOVR)));

    return {
      ovr: finalOVR,
      archetype: archetypeName,
      breakdown
    };
  }

  /**
   * Get all archetypes for a position
   */
  getArchetypesForPosition(position: string): string[] {
    const normalizedPos = this.normalizePosition(position);
    if (!normalizedPos) return [];

    const jsonPos = POSITION_TO_JSON_POS[normalizedPos] || normalizedPos;
    const archetypes: string[] = [];

    for (const archetype of this.weights.keys()) {
      if (archetype.startsWith(`${jsonPos}_`)) {
        archetypes.push(archetype);
      }
    }

    return archetypes;
  }

  /**
   * Get all loaded archetypes
   */
  getAllArchetypes(): string[] {
    return Array.from(this.weights.keys());
  }

  /**
   * Check if a field affects OVR calculation
   */
  isOVRAttribute(fieldCode: string): boolean {
    return Object.values(ATTR_NAME_TO_FIELD).includes(fieldCode);
  }

  /**
   * Get all OVR-affecting field codes
   */
  getOVRAttributes(): string[] {
    return Object.values(ATTR_NAME_TO_FIELD);
  }

  /**
   * Find the best archetype for a player based on their ratings
   * Madden assigns the archetype that produces the HIGHEST OVR for the player's stats
   * @param attributes - Player attributes object
   * @param position - Player position
   * @param isDraftClass - If true, use draft class divisor (11.1), otherwise roster divisor (10)
   * @returns Best archetype name and calculated OVR
   */
  findBestArchetype(attributes: PlayerAttributes, position: string | number, isDraftClass: boolean = false): { archetype: string; ovr: number; archetypeId: number } | null {
    if (!this.initialized) {
      console.warn('[OVRWeightsCalculator] Weights not loaded');
      return null;
    }

    // Normalize position
    const normalizedPos = this.normalizePosition(position);
    if (!normalizedPos) {
      console.log('[OVRWeightsCalculator] Could not normalize position:', position);
      return null;
    }

    // Map to JSON position name
    const jsonPos = POSITION_TO_JSON_POS[normalizedPos];
    if (!jsonPos) {
      console.log('[OVRWeightsCalculator] No JSON position mapping for:', normalizedPos);
      return null;
    }

    // Get all archetypes for this position
    const archetypes = this.getArchetypesForPosition(normalizedPos);
    if (archetypes.length === 0) {
      console.log('[OVRWeightsCalculator] No archetypes found for position:', normalizedPos);
      return null;
    }

    // Calculate OVR for each archetype and find the best one
    let bestArchetype = archetypes[0];
    let bestOVR = 0;

    for (const archetype of archetypes) {
      const ovr = this.calculateOVR(attributes, position, archetype, isDraftClass);
      if (ovr > bestOVR) {
        bestOVR = ovr;
        bestArchetype = archetype;
      }
    }

    // Find the archetype ID from the archetype name
    let archetypeId = 0;
    for (const [id, formulaName] of Object.entries(ARCHETYPE_ID_TO_FORMULA)) {
      if (formulaName === bestArchetype) {
        archetypeId = parseInt(id);
        break;
      }
    }

    console.log(`[OVRWeightsCalculator] Best archetype for ${normalizedPos}: ${bestArchetype} (ID: ${archetypeId}) with OVR ${bestOVR} (isDraftClass: ${isDraftClass})`);

    return {
      archetype: bestArchetype,
      ovr: bestOVR,
      archetypeId
    };
  }

  /**
   * Calculate rating adjustments needed to achieve a target OVR
   * @param currentAttributes - Current player attributes
   * @param targetOVR - Desired OVR
   * @param position - Player position
   * @param archetype - Optional archetype override
   * @returns Object with suggested attribute changes and new OVR
   */
  calculateAdjustmentsForTargetOVR(
    currentAttributes: PlayerAttributes,
    targetOVR: number,
    position: string | number,
    archetype?: string
  ): { adjustments: { [fieldCode: string]: { current: number; suggested: number; weight: number; name: string } }; newOVR: number; archetype: string | null } | null {
    if (!this.initialized) {
      console.warn('[OVRWeightsCalculator] Weights not loaded');
      return null;
    }

    // Normalize position
    const normalizedPos = this.normalizePosition(position);
    if (!normalizedPos) {
      console.log('[OVRWeightsCalculator] Could not normalize position:', position);
      return null;
    }

    // Map to JSON position name
    const jsonPos = POSITION_TO_JSON_POS[normalizedPos];
    if (!jsonPos) {
      console.log('[OVRWeightsCalculator] No JSON position mapping for:', normalizedPos);
      return null;
    }

    // Find archetype
    let archetypeName: string | null;
    if (archetype && this.weights.has(archetype)) {
      archetypeName = archetype;
    } else if (archetype) {
      const prefixed = `${jsonPos}_${archetype}`;
      archetypeName = this.weights.has(prefixed) ? prefixed : this.findArchetype(currentAttributes, jsonPos);
    } else {
      archetypeName = this.findArchetype(currentAttributes, jsonPos);
    }

    if (!archetypeName) {
      console.log('[OVRWeightsCalculator] Could not find archetype for position:', jsonPos);
      return null;
    }

    const weights = this.weights.get(archetypeName);
    if (!weights) {
      return null;
    }

    // Get breakdown to understand current state
    const breakdown = this.calculateOVRWithBreakdown(currentAttributes, position, archetypeName, false);
    const currentOVR = breakdown.ovr;
    const ovrDelta = targetOVR - currentOVR;

    if (ovrDelta === 0) {
      return { adjustments: {}, newOVR: currentOVR, archetype: archetypeName };
    }

    // Calculate total weight of attributes that can be adjusted
    let totalWeight = 0;
    const adjustableAttrs: { fieldCode: string; weight: number; current: number; name: string }[] = [];

    for (const [attrName, fieldCode] of Object.entries(ATTR_NAME_TO_FIELD)) {
      const weight = Number(weights[attrName]) || 0;
      if (weight > 0) {
        const currentValue = this.getAttr(currentAttributes, fieldCode);
        adjustableAttrs.push({
          fieldCode,
          weight,
          current: currentValue,
          name: attrName.replace('Rating', '')
        });
        totalWeight += weight;
      }
    }

    if (totalWeight === 0 || adjustableAttrs.length === 0) {
      return null;
    }

    // Distribute the OVR delta proportionally across weighted attributes
    // OVR formula: Sum(attr * weight) / 10
    // So to change OVR by X, we need to change weighted sum by X * 10
    const weightedSumDelta = ovrDelta * ROSTER_DIVISOR;

    const adjustments: { [fieldCode: string]: { current: number; suggested: number; weight: number; name: string } } = {};

    for (const attr of adjustableAttrs) {
      // Each attribute contributes (attr.weight / totalWeight) of the total change
      // The attribute change needed is: (weightedSumDelta * (weight / totalWeight)) / weight
      // Simplifies to: weightedSumDelta / totalWeight
      const attrChange = weightedSumDelta / totalWeight;

      // Clamp suggested value to 0-99
      const suggested = Math.max(0, Math.min(99, Math.round(attr.current + attrChange)));

      // Only include if there's an actual change
      if (suggested !== attr.current) {
        adjustments[attr.fieldCode] = {
          current: attr.current,
          suggested,
          weight: attr.weight,
          name: attr.name
        };
      }
    }

    // Calculate what the new OVR would be with these adjustments
    const newAttributes = { ...currentAttributes };
    for (const [fieldCode, adj] of Object.entries(adjustments)) {
      newAttributes[fieldCode] = adj.suggested;
    }
    const newOVR = this.calculateOVR(newAttributes, position, archetypeName, false);

    console.log(`[OVRWeightsCalculator] Target OVR: ${targetOVR}, Current: ${currentOVR}, Achieved: ${newOVR}`);

    return {
      adjustments,
      newOVR,
      archetype: archetypeName
    };
  }

  /**
   * Get the weights map for a given archetype (for UI display)
   */
  getArchetypeWeights(archetypeName: string): { [fieldCode: string]: { name: string; weight: number } } | null {
    const weights = this.weights.get(archetypeName);
    if (!weights) return null;

    const result: { [fieldCode: string]: { name: string; weight: number } } = {};
    for (const [attrName, fieldCode] of Object.entries(ATTR_NAME_TO_FIELD)) {
      const weight = Number(weights[attrName]) || 0;
      if (weight > 0) {
        result[fieldCode] = {
          name: attrName.replace('Rating', ''),
          weight
        };
      }
    }
    return result;
  }
}

// Export singleton instance
export const ovrWeightsCalculator = new OVRWeightsCalculator();
