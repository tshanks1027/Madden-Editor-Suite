/**
 * OVR Weights Calculator
 *
 * Calculates Overall Rating using the EXACT formula from Madden's game code.
 * Source: reference/madden-franchise-utils/Utils/FranchiseUtils.js
 *
 * CORRECT OVR Formula:
 *   For each attribute with weight > 0:
 *     normalized = (value - DesiredLow) / (DesiredHigh - DesiredLow)
 *     contribution = normalized * (weight / Sum)
 *
 *   OVR = Math.round(Math.min(sum_of_contributions * 99, 99))
 *
 * Each archetype has:
 *   - DesiredHigh/DesiredLow: Expected rating range for that archetype
 *   - Attribute weights: How much each rating contributes (weights sum to 10)
 *   - Sum: Always 10 (used to normalize weights)
 *
 * The game picks the archetype that gives the HIGHEST OVR for the player's ratings.
 */

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
  'LongSnapRating': 'PIMP',
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
    // Check multiple paths for dev and packaged builds
    const possiblePaths = [
      path.join(app.getAppPath(), '.vite', 'build', 'data', 'lookups', 'ovrweights.json'),  // Packaged build
      path.join(app.getAppPath(), 'data', 'lookups', 'ovrweights.json'),                     // Dev mode
      path.join(process.cwd(), 'data', 'lookups', 'ovrweights.json'),                        // Fallback
    ];

    const weightsPath = possiblePaths.find(p => fs.existsSync(p));

    console.log('[OVRWeightsCalculator] Loading weights from:', weightsPath);

    if (!weightsPath) {
      throw new Error(`Weights file not found in any location: ${possiblePaths.join(', ')}`);
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
   * Uses same default (50) as roster editor for consistency
   */
  private getAttr(player: PlayerAttributes, fieldCode: string): number {
    const val = player[fieldCode];

    // Default to 50 for missing values - matches roster editor behavior
    if (val === undefined || val === null || val === '' || (typeof val === 'number' && isNaN(val))) {
      return 50;
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
   * Normalize archetype name from space-separated format to underscore format
   * Converts "QB Strong Arm" -> "QB_StrongArm", "HB Elusive Back" -> "HB_ElusiveBack"
   * This handles the mismatch between ArchetypeService names and ovrweights.json keys
   */
  private normalizeArchetypeName(archetype: string): string | null {
    if (!archetype) return null;

    // Already in correct format (has underscore and no space after position)
    if (this.weights.has(archetype)) {
      return archetype;
    }

    // Convert "QB Strong Arm" -> "QB_StrongArm"
    // Format: "POS Word1 Word2 ..." -> "POS_Word1Word2..."
    const parts = archetype.trim().split(/\s+/);
    if (parts.length < 2) return null;

    // First part is position prefix
    const position = parts[0];
    // Remaining parts are the archetype name words
    const nameParts = parts.slice(1);

    // Join with underscores for position_Name format, no spaces between name words
    const normalized = `${position}_${nameParts.join('')}`;

    // Also try with the common naming variations
    const variations = [
      normalized,
      // Handle "Man-to-Man" -> "MantoMan"
      normalized.replace(/-/g, ''),
      // Handle "Well-Rounded" -> "Well-Rounded" style names aren't in the weights, they map differently
    ];

    for (const variant of variations) {
      if (this.weights.has(variant)) {
        return variant;
      }
    }

    // Try fuzzy match - find weight key that contains all the name parts
    const weightKeys = Array.from(this.weights.keys());
    for (const weightKey of weightKeys) {
      if (weightKey.startsWith(`${position}_`)) {
        const keyLower = weightKey.toLowerCase();
        const allMatch = nameParts.every(part =>
          keyLower.includes(part.toLowerCase().replace(/-/g, ''))
        );
        if (allMatch) {
          return weightKey;
        }
      }
    }

    return null;
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
      const weightKeys = Array.from(this.weights.keys());
      for (const archKey of weightKeys) {
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
  calculateOVR(attributes: PlayerAttributes, position: string | number, archetype?: string | number, isDraftClass: boolean = false): number {
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
    if (archetype !== undefined && archetype !== null) {
      // CRITICAL: Handle numeric archetype IDs (0-67) - this is what the UI passes!
      const numericId = Number(archetype);
      if (!isNaN(numericId) && numericId >= 0 && numericId <= 67) {
        const formulaName = ARCHETYPE_ID_TO_FORMULA[numericId];
        if (formulaName && this.weights.has(formulaName)) {
          // CRITICAL FIX: Check if archetype matches player's position!
          // Archetype ID 0 = QB_FieldGeneral, but many non-QB players have PLTY=0
          // Using QB formula for a CB gives OVR=0 because CBs lack QB attributes
          const archetypePos = formulaName.split('_')[0]; // e.g., "QB" from "QB_FieldGeneral"
          if (archetypePos === jsonPos) {
            archetypeName = formulaName;
          } else {
            // Archetype doesn't match position - find correct archetype for this position
            console.log(`[OVRWeightsCalculator] Archetype ID ${numericId} (${formulaName}) doesn't match position ${jsonPos}, finding correct archetype`);
            archetypeName = this.findArchetype(attributes, jsonPos);
          }
        } else {
          console.warn(`[OVRWeightsCalculator] Unknown archetype ID ${numericId}, using default`);
          archetypeName = this.findArchetype(attributes, jsonPos);
        }
      } else if (this.weights.has(String(archetype))) {
        // String archetype name provided directly (already in weights format)
        archetypeName = String(archetype);
      } else {
        // CRITICAL FIX: Convert space-separated names to underscore format
        // ArchetypeService uses "QB Strong Arm" but weights use "QB_StrongArm"
        const archetypeStr = String(archetype);
        const normalizedName = this.normalizeArchetypeName(archetypeStr);
        if (normalizedName && this.weights.has(normalizedName)) {
          archetypeName = normalizedName;
          console.log(`[OVRWeightsCalculator] Normalized archetype "${archetypeStr}" -> "${normalizedName}"`);
        } else {
          // Try prefixing with position
          const prefixed = `${jsonPos}_${archetype}`;
          archetypeName = this.weights.has(prefixed) ? prefixed : this.findArchetype(attributes, jsonPos);
        }
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

    // CORRECT FORMULA from reference/madden-franchise-utils/Utils/FranchiseUtils.js:
    // For each attribute: ((value - DesiredLow) / (DesiredHigh - DesiredLow)) * (weight / Sum)
    // Final OVR: Math.round(Math.min(sum * 99, 99))

    const desiredLow = Number(weights.DesiredLow) || 0;
    const desiredHigh = Number(weights.DesiredHigh) || 99;
    const sumDivisor = Number(weights.Sum) || 10;
    const desiredRange = desiredHigh - desiredLow;

    let normalizedSum = 0;

    for (const [attrName, fieldCode] of Object.entries(ATTR_NAME_TO_FIELD)) {
      const weight = Number(weights[attrName]) || 0;
      if (weight > 0) {
        const attrValue = this.getAttr(attributes, fieldCode);
        // Normalize: (value - DesiredLow) / (DesiredHigh - DesiredLow)
        const normalized = desiredRange > 0 ? (attrValue - desiredLow) / desiredRange : 0;
        // Apply weight: weight / Sum
        normalizedSum += normalized * (weight / sumDivisor);
      }
    }

    // Final OVR: sum * 99, clamped to 0-99
    const finalOVR = Math.round(Math.min(Math.max(normalizedSum * 99, 0), 99));

    return finalOVR;
  }

  /**
   * Calculate OVR with detailed breakdown
   * @param isDraftClass - If true, use draft class divisor (11.1), otherwise roster divisor (10)
   */
  calculateOVRWithBreakdown(attributes: PlayerAttributes, position: string | number, archetype?: string | number, isDraftClass: boolean = false): OVRBreakdown {
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

    // Find archetype - must handle numeric IDs the same way as calculateOVR
    let archetypeName: string | null;
    if (archetype !== undefined && archetype !== null) {
      // CRITICAL: Handle numeric archetype IDs (0-67) - same as calculateOVR
      const numericId = Number(archetype);
      if (!isNaN(numericId) && numericId >= 0 && numericId <= 67) {
        const formulaName = ARCHETYPE_ID_TO_FORMULA[numericId];
        if (formulaName && this.weights.has(formulaName)) {
          archetypeName = formulaName;
        } else {
          archetypeName = this.findArchetype(attributes, jsonPos);
        }
      } else if (this.weights.has(String(archetype))) {
        // String archetype name provided directly (already in weights format)
        archetypeName = String(archetype);
      } else {
        // CRITICAL FIX: Convert space-separated names to underscore format
        // ArchetypeService uses "QB Strong Arm" but weights use "QB_StrongArm"
        const archetypeStr = String(archetype);
        const normalizedName = this.normalizeArchetypeName(archetypeStr);
        if (normalizedName && this.weights.has(normalizedName)) {
          archetypeName = normalizedName;
        } else {
          // Try prefixing with position
          const prefixed = `${jsonPos}_${archetype}`;
          archetypeName = this.weights.has(prefixed) ? prefixed : this.findArchetype(attributes, jsonPos);
        }
      }
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

    // CORRECT FORMULA from reference/madden-franchise-utils/Utils/FranchiseUtils.js
    const desiredLow = Number(weights.DesiredLow) || 0;
    const desiredHigh = Number(weights.DesiredHigh) || 99;
    const sumDivisor = Number(weights.Sum) || 10;
    const desiredRange = desiredHigh - desiredLow;

    let normalizedSum = 0;
    const breakdown: OVRBreakdown['breakdown'] = {};

    for (const [attrName, fieldCode] of Object.entries(ATTR_NAME_TO_FIELD)) {
      const weight = Number(weights[attrName]) || 0;
      if (weight > 0) {
        const attrValue = this.getAttr(attributes, fieldCode);
        // Normalize: (value - DesiredLow) / (DesiredHigh - DesiredLow)
        const normalized = desiredRange > 0 ? (attrValue - desiredLow) / desiredRange : 0;
        // Apply weight: weight / Sum
        const contribution = normalized * (weight / sumDivisor);
        normalizedSum += contribution;

        breakdown[fieldCode] = {
          name: attrName.replace('Rating', ''),
          value: attrValue,
          weight: weight,
          contribution: contribution * 99 // Contribution to final OVR (scaled to 99)
        };
      }
    }

    // Final OVR: sum * 99, clamped to 0-99
    const finalOVR = Math.round(Math.min(Math.max(normalizedSum * 99, 0), 99));

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

    const weightKeys = Array.from(this.weights.keys());
    for (const archetype of weightKeys) {
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
   * Uses WEIGHT-PROPORTIONAL distribution: high-weight attributes change more
   * Uses ITERATIVE REFINEMENT to handle attribute limits (0-99 clamping)
   *
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
    archetype?: string | number
  ): { adjustments: { [fieldCode: string]: { current: number; suggested: number; weight: number; name: string } }; newOVR: number; archetype: string | null } | null {
    console.log(`[OVRWeightsCalculator] calculateAdjustmentsForTargetOVR called:`);
    console.log(`  - targetOVR: ${targetOVR}`);
    console.log(`  - position: ${position}`);
    console.log(`  - archetype: ${archetype}`);
    console.log(`  - attributes count: ${Object.keys(currentAttributes).length}`);
    console.log(`  - sample attrs: PPBK=${currentAttributes.PPBK}, PRBK=${currentAttributes.PRBK}, PSTR=${currentAttributes.PSTR}`);

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

    // Find archetype - must handle numeric IDs the same way as calculateOVR
    let archetypeName: string | null;
    if (archetype !== undefined && archetype !== null) {
      // CRITICAL: Handle numeric archetype IDs (0-67) - same as calculateOVR
      const numericId = Number(archetype);
      if (!isNaN(numericId) && numericId >= 0 && numericId <= 67) {
        const formulaName = ARCHETYPE_ID_TO_FORMULA[numericId];
        if (formulaName && this.weights.has(formulaName)) {
          archetypeName = formulaName;
          console.log(`[OVRWeightsCalculator] Adjustment: Converted archetype ID ${numericId} -> ${formulaName}`);
        } else {
          console.warn(`[OVRWeightsCalculator] Unknown archetype ID ${numericId}, using auto-detect`);
          archetypeName = this.findArchetype(currentAttributes, jsonPos);
        }
      } else if (this.weights.has(String(archetype))) {
        // String archetype name provided directly (already in weights format)
        archetypeName = String(archetype);
      } else {
        // CRITICAL FIX: Convert space-separated names to underscore format
        // ArchetypeService uses "QB Strong Arm" but weights use "QB_StrongArm"
        const archetypeStr = String(archetype);
        const normalizedName = this.normalizeArchetypeName(archetypeStr);
        if (normalizedName && this.weights.has(normalizedName)) {
          archetypeName = normalizedName;
          console.log(`[OVRWeightsCalculator] Adjustment: Normalized archetype "${archetypeStr}" -> "${normalizedName}"`);
        } else {
          // Try prefixing with position
          const prefixed = `${jsonPos}_${archetype}`;
          archetypeName = this.weights.has(prefixed) ? prefixed : this.findArchetype(currentAttributes, jsonPos);
        }
      }
    } else {
      archetypeName = this.findArchetype(currentAttributes, jsonPos);
    }

    if (!archetypeName) {
      console.log('[OVRWeightsCalculator] Could not find archetype for position:', jsonPos);
      return null;
    }

    console.log(`[OVRWeightsCalculator] Found archetype: ${archetypeName}`);

    const weights = this.weights.get(archetypeName);
    if (!weights) {
      console.log('[OVRWeightsCalculator] No weights found for archetype:', archetypeName);
      return null;
    }

    // Get breakdown to understand current state
    const breakdown = this.calculateOVRWithBreakdown(currentAttributes, position, archetypeName, false);
    const currentOVR = breakdown.ovr;
    const ovrDelta = targetOVR - currentOVR;

    console.log(`[OVRWeightsCalculator] Current OVR: ${currentOVR}, Target: ${targetOVR}, Delta: ${ovrDelta}`);

    if (ovrDelta === 0) {
      console.log('[OVRWeightsCalculator] No change needed (delta is 0)');
      return { adjustments: {}, newOVR: currentOVR, archetype: archetypeName };
    }

    // CORRECT FORMULA: OVR = normalizedSum * 99
    // So normalizedSum = OVR / 99
    // DeltaNormalizedSum = DeltaOVR / 99
    const desiredLow = Number(weights.DesiredLow) || 0;
    const desiredHigh = Number(weights.DesiredHigh) || 99;
    const sumDivisor = Number(weights.Sum) || 10;
    const desiredRange = desiredHigh - desiredLow;

    // Build list of adjustable attributes with their weights and current values
    const adjustableAttrs: { fieldCode: string; weight: number; current: number; name: string; suggested: number }[] = [];

    for (const [attrName, fieldCode] of Object.entries(ATTR_NAME_TO_FIELD)) {
      const weight = Number(weights[attrName]) || 0;
      if (weight > 0) {
        const currentValue = this.getAttr(currentAttributes, fieldCode);
        adjustableAttrs.push({
          fieldCode,
          weight,
          current: currentValue,
          suggested: currentValue, // Start with current
          name: attrName.replace('Rating', '')
        });
      }
    }

    console.log(`[OVRWeightsCalculator] Found ${adjustableAttrs.length} adjustable attributes`);
    if (adjustableAttrs.length === 0) {
      console.log('[OVRWeightsCalculator] No adjustable attributes found!');
      return null;
    }

    // Log first few adjustable attrs
    console.log('[OVRWeightsCalculator] Sample adjustable attrs:',
      adjustableAttrs.slice(0, 5).map(a => `${a.fieldCode}=${a.current}(w:${a.weight})`).join(', '));

    // ITERATIVE WEIGHT-PROPORTIONAL ADJUSTMENT
    // We iterate because some attributes may hit limits (0 or 99), requiring redistribution
    const MAX_ITERATIONS = 10;
    let remainingDelta = ovrDelta;

    for (let iter = 0; iter < MAX_ITERATIONS && Math.abs(remainingDelta) >= 0.5; iter++) {
      // Calculate how much "headroom" each attribute has to change
      // For decreasing OVR: headroom = current - 0 (can decrease by this much)
      // For increasing OVR: headroom = 99 - current (can increase by this much)
      const isDecreasing = remainingDelta < 0;

      // Calculate effective weight (weight * headroom proportion)
      // Attributes with more headroom can absorb more change
      let effectiveTotalWeight = 0;
      for (const attr of adjustableAttrs) {
        const headroom = isDecreasing
          ? attr.suggested - 0  // How much can decrease
          : 99 - attr.suggested; // How much can increase

        // Only attributes with headroom can contribute
        if (headroom > 0) {
          effectiveTotalWeight += attr.weight;
        }
      }

      if (effectiveTotalWeight === 0) {
        // No more headroom - can't reach target
        console.log(`[OVRWeightsCalculator] Iteration ${iter}: No headroom left, stopping`);
        break;
      }

      // Calculate normalized sum delta needed for remaining OVR change
      // Formula: OVR = normalizedSum * 99, so DeltaNormalizedSum = DeltaOVR / 99
      // Each attribute contributes: ((value - DesiredLow) / desiredRange) * (weight / Sum)
      // To change normalizedSum by X, we need to change values proportionally
      const normalizedSumNeeded = remainingDelta / 99;

      // Distribute change proportionally by WEIGHT
      // Each attribute's contribution: ((value - DesiredLow) / desiredRange) * (weight / Sum)
      // To change normalizedSum by X total, distribute proportionally to weight^2
      // (higher weight attributes should change more)

      // Calculate sum of (weight/Sum)^2 for attributes with headroom
      let sumSquaredNormalizedWeights = 0;
      for (const attr of adjustableAttrs) {
        const headroom = isDecreasing
          ? attr.suggested - 0
          : 99 - attr.suggested;
        if (headroom > 0) {
          const normalizedWeight = attr.weight / sumDivisor;
          sumSquaredNormalizedWeights += normalizedWeight * normalizedWeight;
        }
      }

      // k is the proportionality constant
      const k = normalizedSumNeeded / sumSquaredNormalizedWeights;

      // Apply proportional changes
      for (const attr of adjustableAttrs) {
        const headroom = isDecreasing
          ? attr.suggested - 0
          : 99 - attr.suggested;

        if (headroom > 0) {
          // Each attribute's contribution change = k * (weight/Sum)
          // contribution = ((value - DesiredLow) / desiredRange) * (weight / Sum)
          // So value change = contributionChange * desiredRange / (weight / Sum)
          //                 = k * (weight/Sum) * desiredRange / (weight / Sum)
          //                 = k * desiredRange
          // But we want weight-proportional, so:
          // valueChange = k * (weight/Sum) * desiredRange
          const normalizedWeight = attr.weight / sumDivisor;
          const valueChange = k * normalizedWeight * desiredRange;
          const newValue = attr.suggested + valueChange;

          // Clamp to 0-99
          attr.suggested = Math.max(0, Math.min(99, Math.round(newValue)));
        }
      }

      // Recalculate OVR with current suggested values
      const testAttributes: PlayerAttributes = { ...currentAttributes };
      for (const attr of adjustableAttrs) {
        testAttributes[attr.fieldCode] = attr.suggested;
      }
      const achievedOVR = this.calculateOVR(testAttributes, position, archetypeName, false);
      remainingDelta = targetOVR - achievedOVR;

      // Debug logging
      if (iter < 3 || Math.abs(remainingDelta) < 1) {
        console.log(`[OVRWeightsCalculator] Iteration ${iter}: Target=${targetOVR}, Achieved=${achievedOVR}, Remaining=${remainingDelta.toFixed(2)}`);
      }
    }

    // Build final adjustments object
    const adjustments: { [fieldCode: string]: { current: number; suggested: number; weight: number; name: string } } = {};

    let changedCount = 0;
    let unchangedCount = 0;
    for (const attr of adjustableAttrs) {
      // Only include if there's an actual change
      if (attr.suggested !== attr.current) {
        changedCount++;
        adjustments[attr.fieldCode] = {
          current: attr.current,
          suggested: attr.suggested,
          weight: attr.weight,
          name: attr.name
        };
      } else {
        unchangedCount++;
      }
    }
    console.log(`[OVRWeightsCalculator] Building adjustments: ${changedCount} changed, ${unchangedCount} unchanged`);

    // Calculate final OVR
    const newAttributes: PlayerAttributes = { ...currentAttributes };
    for (const [fieldCode, adj] of Object.entries(adjustments)) {
      newAttributes[fieldCode] = adj.suggested;
    }
    const newOVR = this.calculateOVR(newAttributes, position, archetypeName, false);

    console.log(`[OVRWeightsCalculator] FINAL: Target OVR: ${targetOVR}, Current: ${currentOVR}, Achieved: ${newOVR}, Adjustments: ${Object.keys(adjustments).length}`);

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
