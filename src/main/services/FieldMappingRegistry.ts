/**
 * FIELD MAPPING REGISTRY
 *
 * Single source of truth for ALL field mappings between:
 * - Draft Class Parser output (camelCase)
 * - Grid/Editor display fields
 * - Database storage fields (M26 codes for ratings, snake_case for bio)
 * - Roster file fields
 *
 * This file should be the ONLY place field mappings are defined.
 * All services should import from here.
 */

// ============================================================================
// BIO FIELD MAPPINGS
// Maps parser/grid field names to database field names
// ============================================================================
export const BIO_FIELD_MAP: Record<string, string> = {
  // Name fields
  'firstName': 'firstName',
  'lastName': 'lastName',

  // Location fields - NOTE: parser uses 'homeTown' (camelCase), DB uses 'hometown' (lowercase)
  'homeTown': 'hometown',
  'hometown': 'hometown',
  'homeState': 'homeState',

  // Physical attributes
  'heightInches': 'height',
  'height': 'height',
  'weight': 'weight',
  'age': 'age',
  'birthDate': 'birthDate',
  'bodyType': 'bodyType',

  // Player identity
  'college': 'collegeId',
  'collegeId': 'collegeId',
  'race': 'race',
  'handedness': 'handedness',

  // Position/Role
  'position': 'position',
  'archetype': 'archetype',
  'jerseyNum': 'jersey',
  'jersey': 'jersey',

  // Draft info
  'draftRound': 'draftRound',
  'round': 'draftRound',
  'draftPick': 'draftPick',
  'pick': 'draftPick',
  'draftable': 'draftable',
  'draftPosition': 'draftPosition',

  // Development
  'devTrait': 'devTrait',

  // IDs and Assets
  'PID': 'maddenPid',
  'PEPS': 'maddenPam',
  'assetName': 'assetName',
  'commentaryId': 'commentaryId',
  'portraitId': 'portraitId',
  'genericHead': 'genericHead',

  // Visual/Style
  'qbStyle': 'qbStyle',
  'qbStance': 'qbStance',
  'runningStyle': 'runningStyle',
  'visMoveType': 'visMoveType',

  // Career span (for custom players)
  'careerFrom': 'careerFrom',
  'careerTo': 'careerTo',
  'draftClass': 'draftClass',
};

// ============================================================================
// RATING FIELD MAPPINGS
// Maps parser/grid camelCase names to M26 database codes
// ============================================================================
export const RATING_FIELD_MAP: Record<string, string> = {
  // Core
  'overall': 'POVR',
  'archetype': 'PLTY',  // Archetype ID for OVR calculation

  // Physical
  'speed': 'PSPD',
  'acceleration': 'PACC',
  'strength': 'PSTR',
  'agility': 'PAGI',
  'jumping': 'PJMP',
  'stamina': 'PSTA',
  'injury': 'PINJ',
  'toughness': 'PTGH',
  'awareness': 'PAWR',
  'changeOfDirection': 'PELU',

  // Ball Carrier
  'ballCarrierVision': 'PBCV',
  'breakTackle': 'PBKT',
  'trucking': 'PLTR',
  'stiffArm': 'PLSA',
  'spinMove': 'PLSM',
  'jukeMove': 'PLJM',
  'carrying': 'PCAR',

  // Passing
  'throwAccuracy': 'PTHA',
  'throwAccuracyShort': 'PTAS',
  'throwAccuracyMid': 'PTAM',
  'throwAccuracyDeep': 'PTAD',
  'throwOnTheRun': 'PTOR',
  'throwUnderPressure': 'PTUP',
  'throwPower': 'PTHP',
  'playAction': 'PPLA',
  'breakSack': 'PBSK',

  // Receiving
  'catching': 'PCTH',
  'spectacularCatch': 'PLSC',
  'catchInTraffic': 'PLCI',
  'shortRouteRunning': 'SRRN',
  'mediumRouteRunning': 'PMRR',
  'deepRouteRunning': 'PDRR',
  'release': 'PLRL',

  // Blocking
  'passBlock': 'PPBK',
  'passBlocking': 'PPBK',  // Alternate name
  'passBlockFinesse': 'PPBF',
  'passBlockPower': 'PPBS',
  'runBlock': 'PRBK',
  'runBlocking': 'PRBK',  // Alternate name
  'runBlockFinesse': 'PRBF',
  'runBlockPower': 'PRBS',
  'impactBlocking': 'PLIB',
  'leadBlock': 'PLBK',
  'leadBlocking': 'PLBK',  // Alternate name

  // Defense
  'tackle': 'PTAK',
  'tackling': 'PTAK',  // Alternate name
  'hitPower': 'PLHT',
  'finesseMoves': 'PFMS',
  'powerMoves': 'PLPM',
  'blockShedding': 'PBSG',
  'playRecognition': 'PLPR',
  'pursuit': 'PLPU',
  'pursuitMoves': 'PLPU',  // Alternate name

  // Coverage
  'pressCoverage': 'PLPE',
  'press': 'PLPE',  // Alternate name
  'manCoverage': 'PLMC',
  'zoneCoverage': 'PLZC',

  // Kicking
  'kickAccuracy': 'PKAC',
  'kickPower': 'PKPR',
  'kickReturn': 'PKRT',

  // Special
  'longSnap': 'PIMP',
  'morale': 'PMOR',
  'personality': 'PPER',
};

// ============================================================================
// M26 RATING CODES
// The canonical list of all M26 rating field codes
// ============================================================================
export const M26_RATING_CODES = [
  // Core
  'POVR',  // Overall
  'PLTY',  // Archetype ID

  // Physical
  'PSPD',  // Speed
  'PACC',  // Acceleration
  'PSTR',  // Strength
  'PAGI',  // Agility
  'PJMP',  // Jumping
  'PSTA',  // Stamina
  'PINJ',  // Injury
  'PTGH',  // Toughness
  'PAWR',  // Awareness
  'PELU',  // Change of Direction

  // Ball Carrier
  'PBCV',  // Ball Carrier Vision
  'PBKT',  // Break Tackle
  'PLTR',  // Trucking
  'PLSA',  // Stiff Arm
  'PLSM',  // Spin Move
  'PLJM',  // Juke Move
  'PCAR',  // Carrying

  // Passing
  'PTHA',  // Throw Accuracy
  'PTAS',  // Throw Accuracy Short
  'PTAM',  // Throw Accuracy Mid
  'PTAD',  // Throw Accuracy Deep
  'PTOR',  // Throw on the Run
  'PTUP',  // Throw Under Pressure
  'PTHP',  // Throw Power
  'PPLA',  // Play Action
  'PBSK',  // Break Sack

  // Receiving
  'PCTH',  // Catching
  'PLSC',  // Spectacular Catch
  'PLCI',  // Catch in Traffic
  'SRRN',  // Short Route Running
  'PMRR',  // Medium Route Running
  'PDRR',  // Deep Route Running
  'PLRL',  // Release

  // Blocking
  'PPBK',  // Pass Block
  'PPBF',  // Pass Block Finesse
  'PPBS',  // Pass Block Power
  'PRBK',  // Run Block
  'PRBF',  // Run Block Finesse
  'PRBS',  // Run Block Power
  'PLIB',  // Impact Blocking
  'PLBK',  // Lead Block

  // Defense
  'PTAK',  // Tackle
  'PLHT',  // Hit Power
  'PFMS',  // Finesse Moves
  'PLPM',  // Power Moves
  'PBSG',  // Block Shedding
  'PLPR',  // Play Recognition
  'PLPU',  // Pursuit

  // Coverage
  'PLPE',  // Press Coverage
  'PLMC',  // Man Coverage
  'PLZC',  // Zone Coverage

  // Kicking
  'PKAC',  // Kick Accuracy
  'PKPR',  // Kick Power
  'PKRT',  // Kick Return

  // Special
  'PIMP',  // Long Snap
  'PMOR',  // Morale
  'PPER',  // Personality
];

// ============================================================================
// LEGACY TO M26 FIELD MAP
// Maps old field codes to current M26 codes
// ============================================================================
export const LEGACY_TO_M26_MAP: Record<string, string> = {
  // NOTE: PSTM is Sleeve Temperature, NOT stamina! PSTA is stamina in both formats.
  // Do NOT map PSTM to PSTA - they are different fields.
  'PCOD': 'PELU',  // Change of Direction
  'PBTK': 'PBKT',  // Break Tackle
  'PTRK': 'PLTR',  // Trucking
  'PSFA': 'PLSA',  // Stiff Arm
  'PSPN': 'PLSM',  // Spin Move
  'PJKM': 'PLJM',  // Juke Move
  'PPWR': 'PTHP',  // Throw Power
  'PSPC': 'PLSC',  // Spectacular Catch
  'PCIT': 'PLCI',  // Catch in Traffic
  'PSRR': 'SRRN',  // Short Route Running
  'PREL': 'PLRL',  // Release
  'PIBK': 'PLIB',  // Impact Blocking
  'PRNS': 'PRBF',  // Run Block Finesse
  'PHIT': 'PLHT',  // Hit Power
  'PPRS': 'PLPE',  // Press
  'PFMV': 'PFMS',  // Finesse Moves
  'PPWM': 'PLPM',  // Power Moves
  'PBSH': 'PBSG',  // Block Shedding
  'PPRC': 'PLPR',  // Play Recognition
  'PMCV': 'PLMC',  // Man Coverage
  'PZCV': 'PLZC',  // Zone Coverage
  'PPBP': 'PPBS',  // Pass Block Power
};

// ============================================================================
// TRAIT FIELD MAPPINGS
// ============================================================================
export const TRAIT_FIELD_MAP: Record<string, string> = {
  'traitBigHitter': 'TBHI',
  'traitPossessionCatch': 'TPCT',
  'traitClutch': 'TCLU',
  'traitCoverBall': 'TCBA',
  'traitDeepBall': 'TDBQ',
  'traitDlBullRush': 'TDLB',
  'traitDlSpinMove': 'TDLS',
  'traitDlSwimMove': 'TDLW',
  'traitDropsOpen': 'TDOP',
  'traitSidelineCatch': 'TSCT',
  'traitFightForYards': 'TFFY',
  'traitHighMotor': 'THMT',
  'traitAggressiveCatch': 'TAGR',
  'traitPenalty': 'TPEN',
  'traitPlayBall': 'TPBA',
  'traitPumpFake': 'TPFK',
  'traitLbStyle': 'TLBS',
  'traitSensePressure': 'TSPN',
  'traitStripBall': 'TSTB',
  'traitTackleLow': 'TTLO',
  'traitThrowAway': 'TTAW',
  'traitTightSpiral': 'TTSP',
  'traitTendency': 'TTND',
  'traitRunAfterCatch': 'TRAC',
  'traitPredictability': 'TPRD',
  'devTrait': 'PDEV',
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if a value is defined and not null
 * Handles numeric 0 correctly (returns true for 0)
 */
export function isDefined(value: any): boolean {
  return value !== undefined && value !== null;
}

/**
 * Check if a value has content (not empty string, not null, not undefined)
 * For strings: returns false for empty string
 * For numbers: returns true even for 0
 */
export function hasValue(value: any): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.trim() !== '';
  return true;  // Numbers (including 0), booleans, objects, arrays all have value
}

/**
 * Convert parser/grid field value to database field
 * Returns { dbField, dbValue } or null if field not mappable
 */
export function mapBioField(sourceField: string, sourceValue: any): { dbField: string; dbValue: any } | null {
  const dbField = BIO_FIELD_MAP[sourceField];
  if (!dbField) return null;
  if (!isDefined(sourceValue)) return null;

  return { dbField, dbValue: sourceValue };
}

/**
 * Convert parser/grid rating field to M26 code
 * Returns { m26Code, value } or null if not mappable
 */
export function mapRatingField(sourceField: string, sourceValue: any): { m26Code: string; value: number } | null {
  // First check if it's already an M26 code
  if (M26_RATING_CODES.includes(sourceField)) {
    if (!isDefined(sourceValue)) return null;
    return { m26Code: sourceField, value: sourceValue };
  }

  // Check legacy codes
  const legacyMapped = LEGACY_TO_M26_MAP[sourceField];
  if (legacyMapped) {
    if (!isDefined(sourceValue)) return null;
    return { m26Code: legacyMapped, value: sourceValue };
  }

  // Check camelCase to M26
  const m26Code = RATING_FIELD_MAP[sourceField];
  if (m26Code) {
    if (!isDefined(sourceValue)) return null;
    return { m26Code, value: sourceValue };
  }

  return null;
}

/**
 * Extract ALL bio fields from a prospect/player object
 * Returns object with database field names and values
 */
export function extractBioFields(source: any): Record<string, any> {
  const result: Record<string, any> = {};

  for (const [sourceField, dbField] of Object.entries(BIO_FIELD_MAP)) {
    if (isDefined(source[sourceField])) {
      result[dbField] = source[sourceField];
    }
  }

  return result;
}

/**
 * Extract ALL rating fields from a prospect/player object
 * Returns object with M26 codes and values
 */
export function extractRatingFields(source: any): Record<string, number> {
  const result: Record<string, number> = {};

  // Check all source fields
  for (const key of Object.keys(source)) {
    const mapped = mapRatingField(key, source[key]);
    if (mapped) {
      // Don't overwrite if already set (first match wins)
      if (!isDefined(result[mapped.m26Code])) {
        result[mapped.m26Code] = mapped.value;
      }
    }
  }

  return result;
}

/**
 * Extract ALL trait fields from a prospect/player object
 */
export function extractTraitFields(source: any): Record<string, any> {
  const result: Record<string, any> = {};

  for (const [sourceField, dbField] of Object.entries(TRAIT_FIELD_MAP)) {
    if (isDefined(source[sourceField])) {
      result[dbField] = source[sourceField];
    }
  }

  return result;
}

/**
 * Convert M26 code back to camelCase name (for display)
 */
export function m26ToCamelCase(m26Code: string): string | null {
  for (const [camel, code] of Object.entries(RATING_FIELD_MAP)) {
    if (code === m26Code) return camel;
  }
  return null;
}

/**
 * Convert database field name back to parser/grid field name
 */
export function dbFieldToSourceField(dbField: string): string | null {
  for (const [source, db] of Object.entries(BIO_FIELD_MAP)) {
    if (db === dbField) return source;
  }
  return null;
}
