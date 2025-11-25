/**
 * OVR Weights Calculator
 *
 * Calculates Overall Rating using the official Madden archetype-based formulas
 * from ovrweights.json. Formula: OVR = Sum(attribute * weight) / 10
 * where weights sum to 10 for each archetype.
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

    if (app.isPackaged) {
      weightsPath = path.join(app.getAppPath(), 'data', 'lookups', 'ovrweights.json');
    } else {
      // In dev mode, compiled files are in .vite/build/services/rating-modes/
      // Need to go up to .vite/build/, then into data/lookups/
      weightsPath = path.join(__dirname, '../../data/lookups/ovrweights.json');
    }

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
   */
  private findArchetype(player: PlayerAttributes, jsonPos: string): string | null {
    // First, try to use the player's archetype field
    const playerArchetype = player['ARCHETYPE'] || player['Archetype'] || player['archetype'] ||
                           player['PLTY'] || player['PlayerType'];

    if (playerArchetype) {
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
   * @returns Calculated Overall Rating (0-99)
   */
  calculateOVR(attributes: PlayerAttributes, position: string | number, archetype?: string): number {
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

    // Divide by 10 (weights sum to 10)
    const rawOVR = weightedSum / 10;

    // Round and clamp to 0-99
    const finalOVR = Math.max(0, Math.min(99, Math.round(rawOVR)));

    console.log(`[OVRWeightsCalculator] Pos: ${normalizedPos} | Archetype: ${archetypeName} | Raw: ${rawOVR.toFixed(2)} | Final: ${finalOVR}`);

    return finalOVR;
  }

  /**
   * Calculate OVR with detailed breakdown
   */
  calculateOVRWithBreakdown(attributes: PlayerAttributes, position: string | number, archetype?: string): OVRBreakdown {
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
          contribution: contribution / 10 // Normalized contribution
        };
      }
    }

    const rawOVR = weightedSum / 10;
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
}

// Export singleton instance
export const ovrWeightsCalculator = new OVRWeightsCalculator();
