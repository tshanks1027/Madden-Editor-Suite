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

// Position ID to position name mapping
const POSITION_ID_TO_NAME = {
    0: 'QB', 1: 'HB', 2: 'FB', 3: 'WR', 4: 'TE', 5: 'LT', 6: 'LG', 7: 'C',
    8: 'RG', 9: 'RT', 10: 'LE', 11: 'RE', 12: 'DT', 13: 'LOLB', 14: 'MLB',
    15: 'ROLB', 16: 'CB', 17: 'FS', 18: 'SS', 19: 'K', 20: 'P', 21: 'LS'
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
 * @param {Object} player - Player object
 * @param {string} fieldCode - Madden field code (e.g., 'PSPD')
 * @returns {number} - Attribute value (0-99)
 */
function getAttr(player, fieldCode) {
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
 * @param {Object} player - Player object
 * @param {string} jsonPos - Position name from JSON (e.g., 'QB', 'HB', 'OT')
 * @returns {string|null} - Archetype name or null if not found
 */
function findArchetype(player, jsonPos) {
    // First, try to use the player's archetype field
    const playerArchetype = player.ARCHETYPE || player.Archetype || player.archetype;

    if (playerArchetype && OVR_WEIGHTS) {
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

    // Calculate weighted sum
    let weightedSum = 0;
    let debugAttrs = {};

    for (const [attrName, fieldCode] of Object.entries(ATTR_NAME_TO_FIELD)) {
        const weight = weights[attrName] || 0;
        if (weight > 0) {
            const attrValue = getAttr(player, fieldCode);
            weightedSum += attrValue * weight;
            debugAttrs[fieldCode] = { value: attrValue, weight: weight };
        }
    }

    // Divide by 10 (weights sum to 10)
    const rawOVR = weightedSum / 10;

    // Round and clamp to 0-99
    const finalOVR = Math.max(0, Math.min(99, Math.round(rawOVR)));

    console.log(`[OVR] ${player.PFNA || ''} ${player.PLNA || ''} | Pos: ${position} | Archetype: ${archetype} | Raw: ${rawOVR.toFixed(2)} | Final: ${finalOVR}`);

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

    // Calculate with breakdown
    let weightedSum = 0;
    const breakdown = {};

    for (const [attrName, fieldCode] of Object.entries(ATTR_NAME_TO_FIELD)) {
        const weight = weights[attrName] || 0;
        if (weight > 0) {
            const attrValue = getAttr(player, fieldCode);
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
