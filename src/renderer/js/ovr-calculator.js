/**
 * Madden OVR Calculator - Archetype-Based
 * Implements official Madden NFL OVR calculation formulas from ovrweights.json
 *
 * Each position has multiple archetypes with different weight distributions.
 * The formula is: OVR = Sum(attribute * weight) / 10
 * where weights sum to 10 for each archetype.
 */

// OVR weights will be loaded from JSON file
let OVR_WEIGHTS = null;

// Mapping from JSON attribute names to Madden field codes
const ATTR_NAME_TO_FIELD = {
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

// Position ID to position name mapping (M26 codes)
const POSITION_ID_TO_NAME = {
    0: 'QB', 1: 'HB', 2: 'FB', 3: 'WR', 4: 'TE', 5: 'LT', 6: 'LG', 7: 'C',
    8: 'RG', 9: 'RT', 10: 'LEDG', 11: 'REDG', 12: 'DT', 13: 'SAM', 14: 'Mike',
    15: 'WILL', 16: 'CB', 17: 'FS', 18: 'SS', 19: 'K', 20: 'P', 21: 'LS'
};

// Mapping from global archetype ID (0-67) to OVRWeights formula name
// The game uses these IDs at offset 0x4b in draft class files
const ARCHETYPE_ID_TO_FORMULA = {
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
const POSITION_TO_JSON_POS = {
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
const DEFAULT_ARCHETYPES = {
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

/**
 * Initialize OVR weights from JSON data
 * @param {Array} weightsData - Array of archetype weight objects from ovrweights.json
 */
export function initOVRWeights(weightsData) {
    OVR_WEIGHTS = {};

    if (!weightsData || !Array.isArray(weightsData)) {
        console.error('[OVR] Invalid weights data provided');
        return false;
    }

    // Index by archetype for fast lookup
    for (const entry of weightsData) {
        if (entry.Archetype) {
            OVR_WEIGHTS[entry.Archetype] = entry;
        }
    }

    console.log(`[OVR] Loaded ${Object.keys(OVR_WEIGHTS).length} archetype formulas`);
    return true;
}

/**
 * Get OVR weights - returns the loaded weights object
 */
export function getOVRWeights() {
    return OVR_WEIGHTS;
}

/**
 * Check if OVR weights are loaded
 */
export function areOVRWeightsLoaded() {
    return OVR_WEIGHTS !== null && Object.keys(OVR_WEIGHTS).length > 0;
}

/**
 * Get attribute value with proper handling for missing/invalid values
 * Uses same default (50) as roster editor for consistency
 * @param {Object} player - Player object
 * @param {string} fieldCode - Madden field code (e.g., 'PSPD')
 * @returns {number} - Attribute value (0-99)
 */
function getAttr(player, fieldCode) {
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
 * @param {string|number} pos - Position (numeric ID or string)
 * @returns {string|null} - Normalized position name
 */
function normalizePosition(pos) {
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
 * @param {Object} player - Player object
 * @param {string} jsonPos - Position name from JSON (e.g., 'QB', 'HB', 'OT')
 * @returns {string|null} - Archetype name or null if not found
 */
function findArchetype(player, jsonPos) {
    // First, try to use the player's archetype field
    const playerArchetype = player.ARCHETYPE || player.Archetype || player.archetype;

    if (playerArchetype !== undefined && playerArchetype !== null && OVR_WEIGHTS) {
        // Check if it's a numeric archetype ID (0-67)
        const numericId = Number(playerArchetype);
        if (!isNaN(numericId) && numericId >= 0 && numericId <= 67) {
            const formulaName = ARCHETYPE_ID_TO_FORMULA[numericId];
            if (formulaName && OVR_WEIGHTS[formulaName]) {
                console.log(`[OVR] Archetype ID ${numericId} -> Formula: ${formulaName}`);
                return formulaName;
            }
        }

        // Try exact match with archetype string
        const archetypeStr = String(playerArchetype).trim();

        // Check if it's already a full archetype name (e.g., "QB_FieldGeneral")
        if (OVR_WEIGHTS[archetypeStr]) {
            return archetypeStr;
        }

        // Try prefixing with position (e.g., "FieldGeneral" -> "QB_FieldGeneral")
        const prefixedArchetype = `${jsonPos}_${archetypeStr}`;
        if (OVR_WEIGHTS[prefixedArchetype]) {
            return prefixedArchetype;
        }

        // Try matching by searching for partial match
        for (const archKey of Object.keys(OVR_WEIGHTS)) {
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
 * @param {Object} player - Player object with all attributes
 * @returns {number} - Calculated Overall Rating (0-99)
 */
export function calculateOverall(player) {
    if (!OVR_WEIGHTS) {
        console.warn('[OVR] Weights not loaded, returning existing OVR');
        return player.POVR || 50;
    }

    // Get position
    const rawPosition = player.PPOS !== undefined && player.PPOS !== null
        ? player.PPOS
        : player.Position;

    if (rawPosition === undefined || rawPosition === null) {
        console.log('[OVR] No position found, returning existing OVR:', player.POVR);
        return player.POVR || 50;
    }

    // Normalize position
    const position = normalizePosition(rawPosition);
    if (!position) {
        console.log('[OVR] Could not normalize position:', rawPosition);
        return player.POVR || 50;
    }

    // Map to JSON position name
    const jsonPos = POSITION_TO_JSON_POS[position];
    if (!jsonPos) {
        console.log('[OVR] No JSON position mapping for:', position);
        return player.POVR || 50;
    }

    // Find archetype
    const archetype = findArchetype(player, jsonPos);
    if (!archetype) {
        console.log('[OVR] Could not find archetype for position:', jsonPos);
        return player.POVR || 50;
    }

    // Get weights for this archetype
    const weights = OVR_WEIGHTS[archetype];
    if (!weights) {
        console.log('[OVR] No weights found for archetype:', archetype);
        return player.POVR || 50;
    }

    // CORRECT FORMULA from reference/madden-franchise-utils/Utils/FranchiseUtils.js:
    // For each attribute: ((value - DesiredLow) / (DesiredHigh - DesiredLow)) * (weight / Sum)
    // Final OVR: Math.round(Math.min(sum * 99, 99))
    const desiredLow = Number(weights.DesiredLow) || 0;
    const desiredHigh = Number(weights.DesiredHigh) || 99;
    const sumDivisor = Number(weights.Sum) || 10;
    const desiredRange = desiredHigh - desiredLow;

    let normalizedSum = 0;
    let debugAttrs = {};

    for (const [attrName, fieldCode] of Object.entries(ATTR_NAME_TO_FIELD)) {
        const weight = Number(weights[attrName]) || 0;
        if (weight > 0) {
            const attrValue = getAttr(player, fieldCode);
            // Normalize: (value - DesiredLow) / (DesiredHigh - DesiredLow)
            const normalized = desiredRange > 0 ? (attrValue - desiredLow) / desiredRange : 0;
            // Apply weight: weight / Sum
            normalizedSum += normalized * (weight / sumDivisor);
            debugAttrs[fieldCode] = { value: attrValue, weight: weight };
        }
    }

    // Final OVR: sum * 99, clamped to 0-99
    const finalOVR = Math.round(Math.min(Math.max(normalizedSum * 99, 0), 99));

    console.log(`[OVR] ${player.PFNA || ''} ${player.PLNA || ''} | Pos: ${position} | Archetype: ${archetype} | Sum: ${normalizedSum.toFixed(4)} | Final: ${finalOVR}`);

    return finalOVR;
}

/**
 * Calculate OVR for a player with detailed breakdown
 * @param {Object} player - Player object
 * @returns {Object} - { ovr, archetype, breakdown }
 */
export function calculateOverallWithBreakdown(player) {
    if (!OVR_WEIGHTS) {
        return { ovr: player.POVR || 50, archetype: null, breakdown: {} };
    }

    // Get position
    const rawPosition = player.PPOS !== undefined && player.PPOS !== null
        ? player.PPOS
        : player.Position;

    const position = normalizePosition(rawPosition);
    if (!position) {
        return { ovr: player.POVR || 50, archetype: null, breakdown: {} };
    }

    const jsonPos = POSITION_TO_JSON_POS[position];
    if (!jsonPos) {
        return { ovr: player.POVR || 50, archetype: null, breakdown: {} };
    }

    const archetype = findArchetype(player, jsonPos);
    if (!archetype) {
        return { ovr: player.POVR || 50, archetype: null, breakdown: {} };
    }

    const weights = OVR_WEIGHTS[archetype];
    if (!weights) {
        return { ovr: player.POVR || 50, archetype: archetype, breakdown: {} };
    }

    // CORRECT FORMULA from reference/madden-franchise-utils/Utils/FranchiseUtils.js
    const desiredLow = Number(weights.DesiredLow) || 0;
    const desiredHigh = Number(weights.DesiredHigh) || 99;
    const sumDivisor = Number(weights.Sum) || 10;
    const desiredRange = desiredHigh - desiredLow;

    let normalizedSum = 0;
    const breakdown = {};

    for (const [attrName, fieldCode] of Object.entries(ATTR_NAME_TO_FIELD)) {
        const weight = Number(weights[attrName]) || 0;
        if (weight > 0) {
            const attrValue = getAttr(player, fieldCode);
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
        archetype: archetype,
        breakdown: breakdown
    };
}

/**
 * Get all archetypes for a position
 * @param {string} position - Position name (e.g., 'QB', 'HB')
 * @returns {Array} - Array of archetype names
 */
export function getArchetypesForPosition(position) {
    if (!OVR_WEIGHTS) return [];

    const jsonPos = POSITION_TO_JSON_POS[position] || position;
    const archetypes = [];

    for (const archetype of Object.keys(OVR_WEIGHTS)) {
        if (archetype.startsWith(`${jsonPos}_`)) {
            archetypes.push(archetype);
        }
    }

    return archetypes;
}

/**
 * Check if a field affects OVR calculation
 * @param {string} fieldName - Field code (e.g., 'PSPD', 'PAWR')
 * @returns {boolean} - True if field affects OVR
 */
export function isOVRAttribute(fieldName) {
    return Object.values(ATTR_NAME_TO_FIELD).includes(fieldName);
}

/**
 * Get all OVR-affecting field codes
 * @returns {Array} - Array of field codes that affect OVR
 */
export function getOVRAttributes() {
    return Object.values(ATTR_NAME_TO_FIELD);
}
