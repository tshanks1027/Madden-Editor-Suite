/**
 * PlayerAppearanceUtils.ts
 *
 * Centralized utility for player appearance calculations.
 * This is the SINGLE SOURCE OF TRUTH for:
 * - Body type calculation
 * - Generic face selection
 * - Race/skin tone mapping
 *
 * All services (CreatorService, RosterCreatorService, RosterGeneratorService, etc.)
 * should use these functions instead of implementing their own versions.
 */

import { pgheLookupService, PGHEEntry } from '../services/PGHELookupService';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Body type string values used in draft class JSON
 */
export type BodyTypeString = 'Thin' | 'Muscular' | 'Heavy' | 'Standard' | 'Lean';

/**
 * Body type numeric codes used in roster files (BTYP/PCBT fields)
 * 0=Standard, 1=Thin, 2=Muscular, 3=Heavy, 4=Lean
 */
export type BodyTypeCode = 0 | 1 | 2 | 3 | 4;

/**
 * Result of generic face selection
 * Contains all the fields needed for both roster and draft class formats
 */
export interface GenericFaceResult {
  pid: number;              // PSXP / PhotoID - the unique PID for this face
  portrait: number;         // PLYR_PORTRAIT value
  genericHead: string;      // PLYR_GENERICHEAD (e.g., "7_B_N_015")
  genericHeadAsset: string; // GenericHeadAssetName ("gen_7_B_N_015")
  pghe: number;             // PGHE index (face picker number 1-304)
  genr: string;             // GENR code (e.g., "gen_7_B_N_015")
  skinTone: number;         // Skin tone (1-7)
  pfcg: string;             // Face config code (e.g., "7_B_N_015")
}

/**
 * Options for looking up player PID
 */
export interface PIDLookupOptions {
  customPortraits?: Map<string, number>;  // Pre-loaded custom portrait mapping
  bundledDatabase?: Map<string, number>;  // Pre-loaded bundled database mapping
  fallbackSkinTone?: number;              // Skin tone for generic face fallback
}

/**
 * Result of PID lookup
 */
export interface PIDLookupResult {
  pid: number;
  source: 'custom' | 'bundled' | 'generic';
  genericFaceData?: GenericFaceResult;  // Only present if source is 'generic'
}

// ============================================================================
// BODY TYPE FUNCTIONS
// ============================================================================

/**
 * Calculate body type from position, weight, and height.
 * Uses BMI-based calculation with position-specific overrides.
 *
 * @param position - Position code or name (e.g., 'QB', 'HB', 0, 1)
 * @param weight - Weight in pounds
 * @param height - Height in inches
 * @returns Body type string: "Thin", "Muscular", or "Heavy"
 */
export function calculateBodyType(
  position: string | number,
  weight = 200,
  height = 73
): BodyTypeString {
  // Weight-only cutoffs based on in-game ranges
  // These match the game's actual body type display behavior
  const w = weight > 0 ? weight : 200;

  // Lean: <= 180 lbs (NOTE: Draft class format only supports Thin/Muscular/Heavy)
  if (w <= 180) {
    return 'Thin'; // Use Thin for draft classes (closest to Lean)
  }

  // Heavy: >= 280 lbs
  if (w >= 280) {
    return 'Heavy';
  }

  // Muscular: 220-279 lbs
  if (w >= 220) {
    return 'Muscular';
  }

  // Standard/Thin: 181-219 lbs
  // Draft classes don't support "Standard", so use "Thin" for this range
  return 'Thin';
}

/**
 * Calculate body type code from position code (numeric).
 * Used by RosterCreatorService for roster format.
 *
 * Position codes: QB=0, HB=1, FB=2, WR=3, TE=4, LT=5, LG=6, C=7, RG=8, RT=9,
 *                 LE=10, RE=11, DT=12, LOLB=13, MLB=14, ROLB=15, CB=16, FS=17, SS=18, K=19, P=20
 *
 * @param positionCode - Numeric position code (0-20)
 * @returns Body type code: 0=Standard, 1=Thin, 2=Muscular, 3=Heavy
 */
export function calculateBodyTypeCode(positionCode: number, weight?: number): BodyTypeCode {
  // Weight-only cutoffs based on in-game ranges
  // These match the game's actual body type display behavior
  const w = weight && weight > 0 ? weight : 220; // Default to Muscular range

  // Lean: <= 180 lbs
  if (w <= 180) {
    return 4; // Lean
  }

  // Heavy: >= 280 lbs
  if (w >= 280) {
    return 3; // Heavy
  }

  // Muscular: 220-279 lbs
  if (w >= 220) {
    return 2; // Muscular
  }

  // Standard: 181-219 lbs
  return 0; // Standard
}

/**
 * Convert body type string to numeric code
 */
export function bodyTypeStringToCode(bodyType: BodyTypeString): BodyTypeCode {
  switch (bodyType) {
    case 'Thin':
    case 'Lean':
      return 1;
    case 'Muscular':
      return 2;
    case 'Heavy':
      return 3;
    case 'Standard':
    default:
      return 2; // Default to Muscular to avoid fat appearance
  }
}

/**
 * Convert body type code to string
 */
export function bodyTypeCodeToString(code: BodyTypeCode): BodyTypeString {
  switch (code) {
    case 1: return 'Thin';
    case 2: return 'Muscular';
    case 3: return 'Heavy';
    case 4: return 'Heavy'; // Extra Heavy maps to Heavy
    case 0:
    default:
      return 'Muscular'; // Standard maps to Muscular to avoid fat appearance
  }
}

// ============================================================================
// GENERIC FACE FUNCTIONS
// ============================================================================

/**
 * Select a generic face for a player based on skin tone.
 * Returns all needed values at once for consistent face assignment.
 *
 * Uses PGHELookupService to get verified faces with actual portrait images.
 *
 * @param skinTone - Skin tone value (1-7, where 1=lightest, 7=darkest)
 * @returns GenericFaceResult with all face data, or null if no face found
 */
export function selectGenericFace(skinTone: number): GenericFaceResult | null {
  // Ensure skin tone is in valid range
  const validSkinTone = Math.max(1, Math.min(7, skinTone || 4));

  // Get random face from PGHE service
  const pgheEntry = pgheLookupService.getRandomBySkinTone(validSkinTone);

  if (pgheEntry) {
    return pgheEntryToGenericFaceResult(pgheEntry);
  }

  // Fallback if PGHE service unavailable
  console.warn(`[PlayerAppearanceUtils] PGHE lookup failed for skin tone ${validSkinTone}, using fallback`);
  return getFallbackGenericFace(validSkinTone);
}

/**
 * Convert PGHEEntry to GenericFaceResult
 */
function pgheEntryToGenericFaceResult(entry: PGHEEntry): GenericFaceResult {
  return {
    pid: entry.psxp,
    portrait: entry.psxp, // Portrait value is same as PID for generic faces
    genericHead: entry.pfcg,
    genericHeadAsset: entry.genr,
    pghe: entry.pghe,
    genr: entry.genr,
    skinTone: entry.skinTone,
    pfcg: entry.pfcg
  };
}

/**
 * Get fallback generic face when PGHE service is unavailable
 */
function getFallbackGenericFace(skinTone: number): GenericFaceResult {
  // Fallback PIDs by skin tone category
  const fallbackData: { [key: number]: { pid: number, pfcg: string } } = {
    1: { pid: 2547, pfcg: '1_B_N_005' },
    2: { pid: 2583, pfcg: '2_B_N_005' },
    3: { pid: 2761, pfcg: '3_B_N_005' },
    4: { pid: 2798, pfcg: '4_B_N_005' },
    5: { pid: 2758, pfcg: '5_B_N_005' },
    6: { pid: 2769, pfcg: '6_B_N_005' },
    7: { pid: 719, pfcg: '7_B_N_005' }
  };

  const data = fallbackData[skinTone] || fallbackData[4];
  const genr = `gen_${data.pfcg}`;

  return {
    pid: data.pid,
    portrait: data.pid,
    genericHead: data.pfcg,
    genericHeadAsset: genr,
    pghe: 0, // Unknown PGHE for fallback
    genr: genr,
    skinTone: skinTone,
    pfcg: data.pfcg
  };
}

/**
 * Get generic face by PID
 * @param pid - Player ID to look up
 * @returns GenericFaceResult if found, null otherwise
 */
export function getGenericFaceByPID(pid: number): GenericFaceResult | null {
  const entry = pgheLookupService.getByPID(pid);
  if (entry) {
    return pgheEntryToGenericFaceResult(entry);
  }
  return null;
}

/**
 * Get generic face by PGHE index
 * @param pghe - Face picker index (1-304)
 * @returns GenericFaceResult if found, null otherwise
 */
export function getGenericFaceByPGHE(pghe: number): GenericFaceResult | null {
  const entry = pgheLookupService.getByPGHE(pghe);
  if (entry) {
    return pgheEntryToGenericFaceResult(entry);
  }
  return null;
}

/**
 * Check if a PID is a generic face PID
 */
export function isGenericFacePID(pid: number): boolean {
  return pgheLookupService.isGenericFacePID(pid);
}

// ============================================================================
// RACE / SKIN TONE FUNCTIONS
// ============================================================================

/**
 * Map race category to Madden skin tone (1-7).
 * This is the SINGLE SOURCE OF TRUTH for race -> skin tone conversion.
 *
 * Race categories (from ROSTER_lookup / MASTER_LOOKUP):
 *   1 = Caucasian
 *   2 = African American Medium
 *   3 = African American Light
 *   4 = African American Dark
 *   5 = Hispanic/Latino
 *   6 = Mixed/Multi-Racial
 *   7 = Asian
 *
 * Skin tones (1-7, first digit of generic head name):
 *   1 = Lightest (Caucasian)
 *   2-3 = Light-Medium
 *   4-5 = Medium
 *   6-7 = Dark (African descent)
 *
 * @param race - Race value (string or number)
 * @returns Skin tone (1-7)
 */
export function raceToSkinTone(race: string | number | undefined): number {
  if (race === undefined || race === null || race === '') {
    return 4; // Default to medium skin tone
  }

  // Parse numeric value
  const numericValue = typeof race === 'number' ? race : parseInt(String(race).trim());

  if (isNaN(numericValue)) {
    // Try string matching for text values
    const raceStr = String(race).toLowerCase().trim();
    if (raceStr.includes('caucasian') || raceStr.includes('white')) return 1;
    if (raceStr.includes('african') || raceStr.includes('black')) return 7;
    if (raceStr.includes('hispanic') || raceStr.includes('latino')) return 4;
    if (raceStr.includes('asian')) return 3;
    if (raceStr.includes('mixed')) return 5;
    return 4; // Default
  }

  // Map race codes to skin tones
  switch (numericValue) {
    case 1: return 1;  // Caucasian -> lightest
    case 2: return 5;  // African American Medium -> medium-dark
    case 3: return 4;  // African American Light -> medium
    case 4: return 7;  // African American Dark -> darkest
    case 5: return 3;  // Hispanic/Latino -> light-medium
    case 6: return 5;  // Mixed/Multi-Racial -> medium
    case 7: return 3;  // Asian -> light-medium
    default:
      // Handle values 10-55 (variant faces within categories)
      if (numericValue >= 10 && numericValue < 20) return 1;  // Caucasian variants
      if (numericValue >= 20 && numericValue < 30) return 5;  // AA Medium variants
      if (numericValue >= 30 && numericValue < 40) return 4;  // AA Light variants
      if (numericValue >= 40 && numericValue < 50) return 7;  // AA Dark variants
      if (numericValue >= 50 && numericValue < 60) return 3;  // Hispanic variants
      return 6; // Default to medium-dark
  }
}

/**
 * Derive skin tone from generic head name.
 * The first character of the generic head name is the skin tone (1-7).
 *
 * @param genericHead - Generic head name (e.g., "7_B_N_015" or "gen_7_B_N_015")
 * @returns Skin tone (1-7)
 */
export function skinToneFromGenericHead(genericHead: string): number {
  if (!genericHead) return 4; // Default

  // Remove "gen_" prefix if present
  const name = genericHead.startsWith('gen_') ? genericHead.substring(4) : genericHead;

  // First character is skin tone
  const skinTone = parseInt(name.charAt(0));
  if (!isNaN(skinTone) && skinTone >= 1 && skinTone <= 7) {
    return skinTone;
  }

  return 4; // Default to medium
}

/**
 * Map PSKI (skin index) to race category
 * PSKI: 0=default, 1=black body, 2=white body
 */
export function pskiToRace(pski: number): number {
  switch (pski) {
    case 2: return 1;  // White skin -> Caucasian race
    case 1: return 7;  // Black skin -> African descent race
    case 0:
    default:
      return 7; // Default to black based on NFL demographics (~70%)
  }
}

/**
 * Get PSKI from skin tone
 * Returns: 1=black body, 2=white body, 0=mixed
 */
export function skinToneToPSKI(skinTone: number): number {
  if (skinTone <= 2) return 2;  // Light skin -> white body
  if (skinTone >= 5) return 1;  // Dark skin -> black body
  return 0;                      // Medium skin -> mixed body
}

/**
 * Generate a race-appropriate skin tone for position-based fallback.
 * Used when no race data is available for a player.
 * Based on NFL demographics by position.
 *
 * @param position - Position string
 * @returns Skin tone (1-7)
 */
export function generateSkinToneByPosition(position?: string): number {
  if (!position) return 6; // Default to darker based on NFL demographics

  const pos = position.toUpperCase();

  // Positions with higher white representation
  if (['QB', 'K', 'P', 'LS'].includes(pos)) {
    return Math.random() < 0.5 ? 1 : 7;
  }

  // OL and TE - more mixed
  if (['LT', 'LG', 'C', 'RG', 'RT', 'TE'].includes(pos)) {
    const rand = Math.random();
    if (rand < 0.4) return 1;  // 40% white
    return 7;                   // 60% black/mixed
  }

  // Skill positions - predominantly Black
  if (['WR', 'HB', 'RB', 'FB', 'CB', 'FS', 'SS', 'LOLB', 'MLB', 'ROLB', 'LE', 'RE', 'DT'].includes(pos)) {
    const rand = Math.random();
    if (rand < 0.7) return 7;       // 70% dark
    if (rand < 0.85) return 5;      // 15% medium
    if (rand < 0.95) return 4;      // 10% medium-light
    return 3;                        // 5% light
  }

  // Default based on overall NFL demographics (~70% Black)
  return Math.random() < 0.7 ? 7 : 1;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Normalize position to uppercase string.
 * Handles both string positions and numeric position codes.
 */
function normalizePosition(position: string | number): string {
  if (typeof position === 'number') {
    return positionCodeToString(position);
  }
  return position.toUpperCase().trim();
}

/**
 * Convert numeric position code to position string
 */
function positionCodeToString(code: number): string {
  const positions: { [key: number]: string } = {
    0: 'QB', 1: 'HB', 2: 'FB', 3: 'WR', 4: 'TE',
    5: 'LT', 6: 'LG', 7: 'C', 8: 'RG', 9: 'RT',
    10: 'LE', 11: 'RE', 12: 'DT',
    13: 'LOLB', 14: 'MLB', 15: 'ROLB',
    16: 'CB', 17: 'FS', 18: 'SS',
    19: 'K', 20: 'P'
  };
  return positions[code] || 'HB';
}

/**
 * Apply generic face data to a roster player object.
 * This mutates the player object to set all face-related fields.
 *
 * @param player - The player object to modify (must have PLPL, PSXP, PEPS, PGHE fields)
 * @param faceData - The generic face data to apply
 * @param race - The race value to store for BLBM GENR/SKNT assignment
 */
export function applyGenericFaceToRosterPlayer(
  player: {
    PLPL?: number;
    PSXP?: number;
    PEPS?: string;
    PGHE?: number;
    PLRC?: number;
    PSKI?: number;
    assignedGenr?: string;
    assignedSknt?: number;
    assignedRace?: number;
    _race?: number;
  },
  faceData: GenericFaceResult,
  race?: number
): void {
  player.PLPL = 0;                    // Generic face flag
  player.PSXP = faceData.pid;         // PID for portrait lookup
  player.PEPS = '';                   // EMPTY - BLBM GENR/SKNT controls the face
  player.PGHE = faceData.pghe;        // Face picker index
  player.assignedGenr = faceData.genr;
  player.assignedSknt = faceData.skinTone;
  player.PSKI = skinToneToPSKI(faceData.skinTone);

  if (race !== undefined) {
    player.PLRC = race;
    player.assignedRace = race;
    player._race = race;              // Legacy field used by GenericFaceService
  }
}

/**
 * Apply generic face data to a draft class player object.
 *
 * @param player - The player object to modify (draft class format)
 * @param faceData - The generic face data to apply
 */
export function applyGenericFaceToDraftClassPlayer(
  player: { PID?: number; PEPS?: string | null; PGHE?: number },
  faceData: GenericFaceResult
): void {
  player.PID = faceData.pid;
  player.PEPS = faceData.genr;  // Draft class uses GENR in PEPS field
  player.PGHE = faceData.pghe;
}
