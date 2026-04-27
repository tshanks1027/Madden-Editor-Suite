/**
 * Draft Class Database Service
 *
 * Handles pushing draft class data to the user database.
 * Supports creating new custom players and updating existing bundled/custom players.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

import { lookupService } from './lookup-service';
import {
  userDatabaseService,
  CustomPlayer,
  CustomPlayerSeason
} from './UserDatabaseService';
import { ovrWeightsCalculator } from './rating-modes/OVRWeightsCalculator';
import { pgheLookupService } from './PGHELookupService';

// Debug log file - use os.tmpdir() instead of app.getPath to avoid timing issues
const DEBUG_LOG_PATH = path.join(os.tmpdir(), 'draft-push-debug.log');
function debugLog(msg: string) {
  try {
    const timestamp = new Date().toISOString();
    const line = `[${timestamp}] ${msg}\n`;
    fs.appendFileSync(DEBUG_LOG_PATH, line);
    console.log(`[DraftClassDB] ${msg}`);
  } catch (e) {
    console.error('[DraftClassDB] Failed to write debug log:', e);
  }
}

// Rating field mapping from draft class to database
// These are the CORRECT M26 field codes that match UserDatabaseService
const RATING_FIELDS = [
  // Core ratings
  'POVR',  // Overall
  'PLTY',  // Archetype ID (numeric 0-67) - CRITICAL for consistent OVR calculation
  // Physical
  'PSPD',  // Speed
  'PACC',  // Acceleration
  'PSTR',  // Strength
  'PAGI',  // Agility
  'PJMP',  // Jumping
  'PSTA',  // Stamina (M26 code - NOT PSTM!)
  'PINJ',  // Injury
  'PTGH',  // Toughness
  'PAWR',  // Awareness
  'PELU',  // Change of Direction (M26 code - NOT PCOD!)
  // Running
  'PBCV',  // Ball Carrier Vision
  'PBKT',  // Break Tackle (M26 code - NOT PBTK!)
  'PLTR',  // Trucking (M26 code - NOT PTRK!)
  'PLSA',  // Stiff Arm (M26 code - NOT PSFA!)
  'PLSM',  // Spin Move (M26 code - NOT PSPN!)
  'PLJM',  // Juke Move (M26 code - NOT PJKM!)
  'PCAR',  // Carrying
  // Passing
  'PTHA',  // Throw Accuracy
  'PTAS',  // Throw Accuracy Short
  'PTAM',  // Throw Accuracy Mid
  'PTAD',  // Throw Accuracy Deep
  'PTOR',  // Throw on the Run
  'PTUP',  // Throw Under Pressure
  'PTHP',  // Throw Power (M26 code - NOT PPWR!)
  'PPLA',  // Play Action
  // Receiving
  'PCTH',  // Catching
  'PLSC',  // Spectacular Catch (M26 code - NOT PSPC!)
  'PLCI',  // Catch in Traffic (M26 code - NOT PCIT!)
  'SRRN',  // Short Route Running (M26 code - NOT PSRR!)
  'PMRR',  // Medium Route Running
  'PDRR',  // Deep Route Running
  'PLRL',  // Release (M26 code - NOT PREL!)
  // Blocking
  'PRBK',  // Run Block
  'PPBK',  // Pass Block
  'PLIB',  // Impact Blocking (M26 code - NOT PIBK!)
  'PLBK',  // Lead Block
  'PRBF',  // Run Block Finesse (M26 code - NOT PRNS!)
  'PPBS',  // Pass Block Power
  'PRBS',  // Run Block Power
  'PPBF',  // Pass Block Finesse
  // Defense
  'PTAK',  // Tackle
  'PLHT',  // Hit Power (M26 code - NOT PHIT!)
  'PLPE',  // Press (M26 code - NOT PPRS!)
  'PFMS',  // Finesse Moves
  'PLPM',  // Power Moves (M26 code - NOT PFMV/PPWM!)
  'PBSG',  // Block Shedding (M26 code - NOT PBSH!)
  'PLPR',  // Play Recognition (M26 code - NOT PPRC!)
  'PLPU',  // Pursuit
  // Coverage
  'PLMC',  // Man Coverage (M26 code - NOT PMCV!)
  'PLZC',  // Zone Coverage (M26 code - NOT PZCV!)
  // Kicking
  'PKAC',  // Kick Accuracy
  'PKPR',  // Kick Power
  'PKRT',  // Kick Return
  // Special
  'PIMP',  // Long Snap
  'PBSK'   // Break Sack
];

// Map legacy/draft class field names to correct M26 field names
// This allows draft class files using old names to still work
const LEGACY_TO_M26_FIELD_MAP: Record<string, string> = {
  'PSTM': 'PSTA',  // Stamina
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
  'PFMV': 'PFMS',  // Finesse Moves - note: some files use PFMV, M26 uses PFMS
  'PPWM': 'PLPM',  // Power Moves
  'PBSH': 'PBSG',  // Block Shedding
  'PPRC': 'PLPR',  // Play Recognition
  'PMCV': 'PLMC',  // Man Coverage
  'PZCV': 'PLZC',  // Zone Coverage
  'PPBP': 'PPBS',  // Pass Block Power -> PPBS (some files use PPBP)
};

// Alternative rating field names used in draft class files
// Maps EXACT names from draftClassFunctions.js parser to correct M26 field codes
const RATING_FIELD_MAP: Record<string, string> = {
  // Core ratings - exact names from parser
  'overall': 'POVR',
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
  // Ball carrier - exact names from parser
  'ballCarrierVision': 'PBCV',
  'breakTackle': 'PBKT',
  'trucking': 'PLTR',
  'stiffArm': 'PLSA',
  'spinMove': 'PLSM',
  'jukeMove': 'PLJM',
  'carrying': 'PCAR',
  // Passing - exact names from parser
  'throwAccuracy': 'PTHA',
  'throwAccuracyShort': 'PTAS',
  'throwAccuracyMid': 'PTAM',
  'throwAccuracyDeep': 'PTAD',
  'throwOnTheRun': 'PTOR',
  'throwUnderPressure': 'PTUP',
  'throwPower': 'PTHP',
  'playAction': 'PPLA',
  // Receiving - exact names from parser
  'catching': 'PCTH',
  'spectacularCatch': 'PLSC',
  'catchInTraffic': 'PLCI',
  'shortRouteRunning': 'SRRN',
  'mediumRouteRunning': 'PMRR',
  'deepRouteRunning': 'PDRR',
  'release': 'PLRL',
  // Blocking - exact names from parser (NOTE: parser uses passBlock/runBlock not passBlocking/runBlocking!)
  'passBlock': 'PPBK',           // Parser uses 'passBlock' not 'passBlocking'
  'runBlock': 'PRBK',            // Parser uses 'runBlock' not 'runBlocking'
  'passBlocking': 'PPBK',        // Also support alternate name
  'runBlocking': 'PRBK',         // Also support alternate name
  'impactBlocking': 'PLIB',
  'leadBlock': 'PLBK',           // Parser uses 'leadBlock' not 'leadBlocking'
  'leadBlocking': 'PLBK',        // Also support alternate name
  'passBlockFinesse': 'PPBF',
  'passBlockPower': 'PPBS',
  'runBlockFinesse': 'PRBF',
  'runBlockPower': 'PRBS',
  // Defense - exact names from parser
  'tackle': 'PTAK',              // Parser uses 'tackle' not 'tackling'
  'tackling': 'PTAK',            // Also support alternate name
  'hitPower': 'PLHT',
  'finesseMoves': 'PFMS',
  'powerMoves': 'PLPM',
  'blockShedding': 'PBSG',
  'playRecognition': 'PLPR',
  'pursuit': 'PLPU',             // Parser uses 'pursuit' not 'pursuitMoves'
  'pursuitMoves': 'PLPU',        // Also support alternate name
  // Coverage - exact names from parser
  'pressCoverage': 'PLPE',       // Parser uses 'pressCoverage' not 'press'
  'press': 'PLPE',               // Also support alternate name
  'manCoverage': 'PLMC',
  'zoneCoverage': 'PLZC',
  // Kicking - exact names from parser
  'kickAccuracy': 'PKAC',
  'kickPower': 'PKPR',
  'kickReturn': 'PKRT',
  // Special - exact names from parser
  'longSnap': 'PIMP',
  'breakSack': 'PBSK',
  // Archetype - parser outputs this as numeric byte (0-67)
  'archetype': 'PLTY'
};

// Bio field names from draft class that need mapping
const BIO_FIELD_MAP: Record<string, string> = {
  'firstName': 'firstName',
  'lastName': 'lastName',
  'homeState': 'homeState',
  'hometown': 'hometown',
  'homeTown': 'hometown',
  'college': 'college',
  'heightInches': 'height',
  'height': 'height',
  'weight': 'weight',
  'draftRound': 'draftRound',
  'round': 'draftRound',
  'draftPick': 'draftPick',
  'pick': 'draftPick',
  'position': 'position',
  'archetype': 'archetype',
  'jerseyNum': 'jersey',
  'age': 'age',
  'bodyType': 'bodyType'
};

export interface FieldConflict {
  field: string;
  displayName: string;
  currentValue: any;
  newValue: any;
}

export interface ProspectAnalysis {
  prospect: any;
  prospectIndex: number;
  matchType: 'new' | 'existing_bundled' | 'existing_custom';
  existingPlayerId?: number;  // For bundled: internal ID, for custom: custom_player_id
  isCustomPlayer?: boolean;
  conflicts?: FieldConflict[];
  derivedRace?: number;
  yearAlreadyHasRatings?: boolean;
}

export interface PushAnalysisResult {
  draftYear: number;
  newPlayers: ProspectAnalysis[];
  existingBundled: ProspectAnalysis[];
  existingCustom: ProspectAnalysis[];
  totalConflicts: number;
  hasYearConflicts: boolean;
}

export interface FieldResolution {
  prospectIndex: number;
  field: string;
  keepCurrent: boolean;  // true = keep existing value, false = overwrite with new
}

export interface PushExecutionResult {
  success: boolean;
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
}

export interface BioFieldOptions {
  college?: boolean;
  homeState?: boolean;
  hometown?: boolean;
  height?: boolean;
  weight?: boolean;
  jersey?: boolean;
  age?: boolean;
  position?: boolean;
  archetype?: boolean;
  draftRound?: boolean;
  draftPick?: boolean;
  draftInfo?: boolean;  // Combined draft round/pick option from UI
  race?: boolean;
  bodyType?: boolean;
  handedness?: boolean;
  pid?: boolean;
  pam?: boolean;
}

class DraftClassDatabaseService {
  /**
   * Extract PGHE face data from a prospect's GENR string (PEPS/genericHeadName)
   * Returns face fields or null if no match found
   */
  private extractFaceData(prospect: any): {
    maddenPghe: number;
    maddenPfcg: string;
    maddenGpan: string;
    maddenGslp: number;
    maddenCpvf: number;
    maddenSkinTone: number;
  } | null {
    // Check multiple sources for GENR string:
    // 1. assignedGenr - set by face picker
    // 2. visuals.genericHeadName - set by face picker or parser
    // 3. PEPS - from parser (but empty for generic faces)
    const genr = prospect.assignedGenr || prospect.visuals?.genericHeadName || prospect.PEPS;
    if (!genr || !genr.startsWith('gen_')) {
      return null;
    }

    const entry = pgheLookupService.getByGenr(genr);
    if (!entry) {
      console.log(`[DraftClassDB] No PGHE entry found for GENR: ${genr}`);
      return null;
    }

    console.log(`[DraftClassDB] Extracted face data for GENR ${genr}: PGHE=${entry.pghe}, PFCG=${entry.pfcg}, skinTone=${entry.skinTone}`);
    return {
      maddenPghe: entry.pghe,
      maddenPfcg: entry.pfcg,
      maddenGpan: entry.gpan,
      maddenGslp: entry.gslp,
      maddenCpvf: entry.cpvf,
      maddenSkinTone: entry.skinTone
    };
  }

  /**
   * Derive race from generic head name
   * Generic heads follow the pattern gen_X_* where X indicates race category
   * Category 2 = African American (race 7)
   * Category 3 = Caucasian (race 1)
   * Category 4 = Caucasian (race 1)
   * Category 5 = Hispanic (race 5)
   * Category 6 = Asian (race 6)
   */
  public deriveRaceFromGenericHead(genericHeadName: string | null | undefined): number | null {
    if (!genericHeadName) return null;

    const match = genericHeadName.match(/^gen_(\d+)_/i);
    if (!match) return null;

    const category = parseInt(match[1]);
    const raceMap: Record<number, number> = {
      2: 7,  // African American
      3: 1,  // Caucasian
      4: 1,  // Caucasian variant
      5: 5,  // Hispanic
      6: 6   // Asian
    };

    return raceMap[category] ?? null;
  }

  /**
   * Analyze draft class prospects for database push
   * Categorizes each prospect as new/existing and identifies conflicts
   */
  public async analyzeForPush(prospects: any[], draftYear: number): Promise<PushAnalysisResult> {
    console.log(`[DraftClassDatabaseService] Analyzing ${prospects.length} prospects for year ${draftYear}`);

    await lookupService.waitForReady();
    await userDatabaseService.waitForReady();

    const newPlayers: ProspectAnalysis[] = [];
    const existingBundled: ProspectAnalysis[] = [];
    const existingCustom: ProspectAnalysis[] = [];
    let totalConflicts = 0;
    let hasYearConflicts = false;

    for (let i = 0; i < prospects.length; i++) {
      const prospect = prospects[i];
      const firstName = prospect.firstName?.trim() || '';
      const lastName = prospect.lastName?.trim() || '';

      if (!firstName || !lastName) {
        console.log(`[DraftClassDatabaseService] Skipping prospect ${i}: missing name`);
        continue;
      }

      // Derive race from generic head if PID is 0
      const pid = prospect.PID || 0;
      const genericHead = prospect.PEPS || prospect.visuals?.genericHeadName;
      const derivedRace = pid === 0 ? this.deriveRaceFromGenericHead(genericHead) : null;

      // Try to find existing player by name
      // First check bundled database
      const bundledPlayer = lookupService.findPlayerByNameAndYear(firstName, lastName, draftYear);

      // Also check custom players
      const customPlayers = userDatabaseService.searchCustomPlayers(`${firstName} ${lastName}`, 10);
      const matchingCustom = customPlayers.find(cp =>
        cp.firstName?.toLowerCase() === firstName.toLowerCase() &&
        cp.lastName?.toLowerCase() === lastName.toLowerCase()
      );

      if (bundledPlayer) {
        // Existing bundled player
        const analysis: ProspectAnalysis = {
          prospect,
          prospectIndex: i,
          matchType: 'existing_bundled',
          existingPlayerId: bundledPlayer.internalId,
          isCustomPlayer: false,
          derivedRace,
          conflicts: []
        };

        // Check for bio field conflicts
        analysis.conflicts = this.findBioConflicts(prospect, bundledPlayer, derivedRace);

        // Check if this year already has ratings
        const existingSeason = userDatabaseService.getSeasonEdit(bundledPlayer.internalId, draftYear);
        if (existingSeason) {
          analysis.yearAlreadyHasRatings = true;
          hasYearConflicts = true;
        }

        totalConflicts += analysis.conflicts.length;
        existingBundled.push(analysis);

      } else if (matchingCustom) {
        // Existing custom player
        const analysis: ProspectAnalysis = {
          prospect,
          prospectIndex: i,
          matchType: 'existing_custom',
          existingPlayerId: matchingCustom.id,
          isCustomPlayer: true,
          derivedRace,
          conflicts: []
        };

        // Check for bio field conflicts with custom player
        analysis.conflicts = this.findCustomPlayerConflicts(prospect, matchingCustom, derivedRace);

        // Check if this year already has ratings
        const existingSeason = userDatabaseService.getCustomPlayerSeason(matchingCustom.id!, draftYear);
        if (existingSeason) {
          analysis.yearAlreadyHasRatings = true;
          hasYearConflicts = true;
        }

        totalConflicts += analysis.conflicts.length;
        existingCustom.push(analysis);

      } else {
        // New player
        const analysis: ProspectAnalysis = {
          prospect,
          prospectIndex: i,
          matchType: 'new',
          derivedRace
        };
        newPlayers.push(analysis);
      }
    }

    console.log(`[DraftClassDatabaseService] Analysis complete: ${newPlayers.length} new, ${existingBundled.length} bundled, ${existingCustom.length} custom, ${totalConflicts} conflicts`);

    return {
      draftYear,
      newPlayers,
      existingBundled,
      existingCustom,
      totalConflicts,
      hasYearConflicts
    };
  }

  /**
   * Helper to convert college name to ID
   */
  private getCollegeId(collegeName: string): number | null {
    if (!collegeName) return null;
    const id = lookupService.getNumericId('college_lookup.csv', collegeName);
    return id > 0 ? id : null;
  }

  /**
   * Helper to convert state name to ID
   */
  private getStateId(stateName: string): number | null {
    if (!stateName) return null;
    const id = lookupService.getNumericId('state_lookup.csv', stateName);
    return id > 0 ? id : null;
  }

  /**
   * Helper to convert position ID to name
   */
  private getPositionName(positionId: number): string | null {
    if (positionId === undefined || positionId === null) return null;
    const name = lookupService.getDisplayName('position_lookup.csv', positionId);
    return name !== String(positionId) ? name : null;
  }

  /**
   * Find bio field conflicts between prospect and bundled player
   * IMPORTANT: Checks stored edits first, so re-pushing after a push shows no conflicts
   */
  private findBioConflicts(prospect: any, bundledPlayer: any, derivedRace: number | null): FieldConflict[] {
    const conflicts: FieldConflict[] = [];

    // CRITICAL: Get any stored edits from the database first
    // This ensures that after a push, re-analyzing shows no conflicts
    const storedEdits = userDatabaseService.getPlayerEdit(bundledPlayer.internalId);

    // DEBUG: Log for first few players to see what's happening
    const playerName = `${prospect.firstName} ${prospect.lastName}`;
    if (playerName.includes('Hall') || playerName.includes('Montgomery') || conflicts.length === 0) {
      console.log(`\n=== CONFLICT CHECK: ${playerName} (internalId=${bundledPlayer.internalId}) ===`);
      console.log(`storedEdits:`, storedEdits);
      console.log(`prospect.bodyType:`, prospect.bodyType, `bundledPlayer.bodyType:`, bundledPlayer.bodyType);
    }

    const fieldsToCheck = [
      { prospectField: 'college', bundledField: 'collegeId', editField: 'collegeId', displayName: 'College', transform: 'college' },
      { prospectField: 'homeState', bundledField: 'homeState', editField: 'homeState', displayName: 'Home State' },
      { prospectField: 'homeTown', bundledField: 'hometown', editField: 'hometown', displayName: 'Hometown' },
      { prospectField: 'height', bundledField: 'height', editField: 'height', displayName: 'Height' },
      { prospectField: 'heightInches', bundledField: 'height', editField: 'height', displayName: 'Height' },
      { prospectField: 'weight', bundledField: 'weight', editField: 'weight', displayName: 'Weight' },
      { prospectField: 'bodyType', bundledField: 'bodyType', editField: 'bodyType', displayName: 'Body Type' }
    ];

    for (const { prospectField, bundledField, editField, displayName, transform } of fieldsToCheck) {
      let newValue = prospect[prospectField];

      // Use stored edit value if available, otherwise use bundled player value
      const currentValue = (storedEdits && storedEdits[editField] !== undefined && storedEdits[editField] !== null)
        ? storedEdits[editField]
        : bundledPlayer[bundledField];

      // Skip if new value is empty/null
      if (newValue === undefined || newValue === null || newValue === '') continue;

      // Skip if current value is empty (will be filled automatically)
      if (currentValue === undefined || currentValue === null || currentValue === '') continue;

      // Transform college name to ID for comparison if needed
      if (transform === 'college' && typeof newValue === 'string') {
        const collegeId = this.getCollegeId(newValue);
        if (collegeId) {
          newValue = collegeId;
        }
      }

      // Check if values differ
      // Special handling for bodyType - need to normalize both to same format
      let normalizedNewValue = newValue;
      let normalizedCurrentValue = currentValue;

      if (bundledField === 'bodyType') {
        // Body type names to index mapping
        const bodyTypeNames = ['Standard', 'Thin', 'Muscular', 'Heavy', 'Lean'];

        // Normalize new value to index
        if (typeof newValue === 'string' && isNaN(Number(newValue))) {
          const idx = bodyTypeNames.findIndex(name => name.toLowerCase() === newValue.toLowerCase());
          normalizedNewValue = idx >= 0 ? idx : newValue;
        } else {
          normalizedNewValue = Number(newValue);
        }

        // Normalize current value to index
        if (typeof currentValue === 'string' && isNaN(Number(currentValue))) {
          const idx = bodyTypeNames.findIndex(name => name.toLowerCase() === currentValue.toLowerCase());
          normalizedCurrentValue = idx >= 0 ? idx : currentValue;
        } else {
          normalizedCurrentValue = Number(currentValue);
        }
      }

      if (String(normalizedNewValue) !== String(normalizedCurrentValue)) {
        // Log ALL conflicts to terminal
        console.log(`  CONFLICT ${displayName}: stored/bundled=${currentValue} (norm=${normalizedCurrentValue}) vs prospect=${newValue} (norm=${normalizedNewValue})`);
        conflicts.push({
          field: bundledField,
          displayName,
          currentValue,
          newValue
        });
      }
    }

    // Check race conflict if we derived one
    // Also check stored race edit first
    const currentRace = (storedEdits && storedEdits.race !== undefined && storedEdits.race !== null)
      ? storedEdits.race
      : bundledPlayer.race;

    if (derivedRace !== null && currentRace !== undefined && currentRace !== null) {
      // Use Number() conversion to handle string vs number comparison ("1" vs 1)
      if (Number(derivedRace) !== Number(currentRace)) {
        conflicts.push({
          field: 'race',
          displayName: 'Race',
          currentValue: currentRace,
          newValue: derivedRace
        });
      }
    }

    return conflicts;
  }

  /**
   * Find bio field conflicts between prospect and custom player
   */
  private findCustomPlayerConflicts(prospect: any, customPlayer: CustomPlayer, derivedRace: number | null): FieldConflict[] {
    const conflicts: FieldConflict[] = [];

    const fieldsToCheck = [
      { prospectField: 'college', customField: 'collegeId', displayName: 'College', transform: 'college' },
      { prospectField: 'homeState', customField: 'homeState', displayName: 'Home State' },
      { prospectField: 'homeTown', customField: 'hometown', displayName: 'Hometown' },
      { prospectField: 'height', customField: 'height', displayName: 'Height' },
      { prospectField: 'heightInches', customField: 'height', displayName: 'Height' },
      { prospectField: 'weight', customField: 'weight', displayName: 'Weight' },
      { prospectField: 'bodyType', customField: 'bodyType', displayName: 'Body Type' }
    ];

    for (const { prospectField, customField, displayName, transform } of fieldsToCheck) {
      let newValue = prospect[prospectField];
      const currentValue = (customPlayer as any)[customField];

      // Skip if new value is empty/null
      if (newValue === undefined || newValue === null || newValue === '') continue;

      // Skip if current value is empty (will be filled automatically)
      if (currentValue === undefined || currentValue === null || currentValue === '') continue;

      // Transform college name to ID for comparison if needed
      if (transform === 'college' && typeof newValue === 'string') {
        const collegeId = this.getCollegeId(newValue);
        if (collegeId) {
          newValue = collegeId;
        }
      }

      // Check if values differ
      // Special handling for bodyType - need to normalize both to same format
      let normalizedNewValue = newValue;
      let normalizedCurrentValue = currentValue;

      if (customField === 'bodyType') {
        // Body type names to index mapping
        const bodyTypeNames = ['Standard', 'Thin', 'Muscular', 'Heavy', 'Lean'];

        // Normalize new value to index
        if (typeof newValue === 'string' && isNaN(Number(newValue))) {
          const idx = bodyTypeNames.findIndex(name => name.toLowerCase() === newValue.toLowerCase());
          normalizedNewValue = idx >= 0 ? idx : newValue;
        } else {
          normalizedNewValue = Number(newValue);
        }

        // Normalize current value to index
        if (typeof currentValue === 'string' && isNaN(Number(currentValue))) {
          const idx = bodyTypeNames.findIndex(name => name.toLowerCase() === currentValue.toLowerCase());
          normalizedCurrentValue = idx >= 0 ? idx : currentValue;
        } else {
          normalizedCurrentValue = Number(currentValue);
        }
      }

      if (String(normalizedNewValue) !== String(normalizedCurrentValue)) {
        conflicts.push({
          field: customField,
          displayName,
          currentValue,
          newValue
        });
      }
    }

    // Check race conflict if we derived one
    if (derivedRace !== null && customPlayer.race !== undefined && customPlayer.race !== null) {
      // Use Number() conversion to handle string vs number comparison ("1" vs 1)
      if (Number(derivedRace) !== Number(customPlayer.race)) {
        conflicts.push({
          field: 'race',
          displayName: 'Race',
          currentValue: customPlayer.race,
          newValue: derivedRace
        });
      }
    }

    return conflicts;
  }

  /**
   * Execute the push to database with user-resolved conflicts
   * @param pushMode - 'all' for full data, 'ratings' for ratings only
   * @param bioFieldOptions - which bio fields to include when pushMode is 'all'
   */
  public async executePush(
    analysis: PushAnalysisResult,
    resolutions: FieldResolution[],
    options: {
      overwriteExistingSeasons?: boolean;
      fillEmptyBioFields?: boolean;
      pushMode?: 'all' | 'ratings';
      bioFieldOptions?: BioFieldOptions;
    } = {}
  ): Promise<PushExecutionResult> {
    // PROMINENT LOGGING - MUST SHOW IN TERMINAL
    console.log('\n\n========================================');
    console.log('[DraftClassDB] executePush CALLED');
    console.log(`[DraftClassDB] Year: ${analysis.draftYear}`);
    console.log(`[DraftClassDB] newPlayers: ${analysis.newPlayers?.length || 0}`);
    console.log(`[DraftClassDB] existingBundled: ${analysis.existingBundled?.length || 0}`);
    console.log(`[DraftClassDB] existingCustom: ${analysis.existingCustom?.length || 0}`);
    console.log(`[DraftClassDB] pushMode: ${options?.pushMode || 'all'}`);
    console.log('========================================\n');

    // Clear debug log at start of push
    try { fs.writeFileSync(DEBUG_LOG_PATH, ''); } catch { /* ignore */ }
    debugLog(`========== STARTING PUSH ==========`);
    debugLog(`Year: ${analysis.draftYear}`);
    debugLog(`newPlayers: ${analysis.newPlayers.length}, existingBundled: ${analysis.existingBundled.length}, existingCustom: ${analysis.existingCustom.length}`);

    const {
      overwriteExistingSeasons = true,
      fillEmptyBioFields = true,
      pushMode = 'all',
      bioFieldOptions = {}
    } = options;

    // CRITICAL DEBUG: Log what options were received vs defaults
    console.log(`[DraftClassDatabaseService] ========== OPTIONS RECEIVED ==========`);
    console.log(`[DraftClassDatabaseService] RAW options object:`, JSON.stringify(options));
    console.log(`[DraftClassDatabaseService] DESTRUCTURED fillEmptyBioFields=${fillEmptyBioFields} (type: ${typeof fillEmptyBioFields})`);
    console.log(`[DraftClassDatabaseService] options.fillEmptyBioFields=${options.fillEmptyBioFields} (type: ${typeof options.fillEmptyBioFields})`);
    console.log(`[DraftClassDatabaseService] pushMode=${pushMode}, overwriteExistingSeasons=${overwriteExistingSeasons}`);

    debugLog(`Push mode: ${pushMode}, overwrite: ${overwriteExistingSeasons}`);
    const result: PushExecutionResult = {
      success: true,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: []
    };

    // Build resolution lookup for quick access
    const resolutionMap = new Map<string, boolean>();
    for (const res of resolutions) {
      resolutionMap.set(`${res.prospectIndex}_${res.field}`, res.keepCurrent);
    }

    // DEBUG: Log all resolutions received
    console.log(`\n=== PUSH EXECUTION: ${resolutions.length} resolutions received ===`);
    resolutions.slice(0, 10).forEach((res, i) => {
      console.log(`  res[${i}]: prospectIndex=${res.prospectIndex}, field=${res.field}, keepCurrent=${res.keepCurrent}`);
    });
    if (resolutions.length > 10) console.log(`  ... and ${resolutions.length - 10} more`);

    try {
      // Process new players - create custom players
      for (const item of analysis.newPlayers) {
        try {
          await this.createNewPlayer(item, analysis.draftYear, pushMode, bioFieldOptions);
          result.created++;
        } catch (error) {
          result.errors.push(`Failed to create ${item.prospect.firstName} ${item.prospect.lastName}: ${error}`);
        }
      }

      // Process existing bundled players
      for (const item of analysis.existingBundled) {
        try {
          // Skip if year already has ratings and we're not overwriting
          if (item.yearAlreadyHasRatings && !overwriteExistingSeasons) {
            result.skipped++;
            continue;
          }

          await this.updateBundledPlayer(item, analysis.draftYear, resolutionMap, fillEmptyBioFields, pushMode, bioFieldOptions);
          result.updated++;
        } catch (error) {
          result.errors.push(`Failed to update ${item.prospect.firstName} ${item.prospect.lastName}: ${error}`);
        }
      }

      // Process existing custom players
      for (const item of analysis.existingCustom) {
        try {
          // Skip if year already has ratings and we're not overwriting
          if (item.yearAlreadyHasRatings && !overwriteExistingSeasons) {
            result.skipped++;
            continue;
          }

          await this.updateCustomPlayer(item, analysis.draftYear, resolutionMap, fillEmptyBioFields, pushMode, bioFieldOptions);
          result.updated++;
        } catch (error) {
          result.errors.push(`Failed to update ${item.prospect.firstName} ${item.prospect.lastName}: ${error}`);
        }
      }

    } catch (error) {
      result.success = false;
      result.errors.push(`Push failed: ${error}`);
    }

    console.log('\n========================================');
    console.log(`[DraftClassDB] PUSH COMPLETE`);
    console.log(`[DraftClassDB] Created: ${result.created}`);
    console.log(`[DraftClassDB] Updated: ${result.updated}`);
    console.log(`[DraftClassDB] Skipped: ${result.skipped}`);
    console.log(`[DraftClassDB] Errors: ${result.errors.length}`);
    if (result.errors.length > 0) {
      console.log(`[DraftClassDB] Error details:`, result.errors);
    }
    console.log('========================================\n');
    return result;
  }

  /**
   * Create a new custom player from a prospect
   */
  private async createNewPlayer(
    item: ProspectAnalysis,
    draftYear: number,
    pushMode: 'all' | 'ratings',
    bioFieldOptions: BioFieldOptions
  ): Promise<void> {
    const prospect = item.prospect;
    const includeBioFields = pushMode === 'all';

    // Map college name to ID (only if bio fields are being included and college option is enabled)
    let collegeId: number | undefined;
    if (includeBioFields && (bioFieldOptions.college !== false)) {
      if (prospect.college && typeof prospect.college === 'string') {
        const id = this.getCollegeId(prospect.college);
        if (id) collegeId = id;
      } else if (typeof prospect.college === 'number') {
        collegeId = prospect.college;
      }
    }

    // Map state name to ID
    let homeStateId: number | undefined;
    if (includeBioFields && (bioFieldOptions.homeState !== false)) {
      if (prospect.homeState && typeof prospect.homeState === 'string') {
        const id = this.getStateId(prospect.homeState);
        if (id) homeStateId = id;
      } else if (typeof prospect.homeState === 'number') {
        homeStateId = prospect.homeState;
      }
    }

    // Get position name
    let positionName: string | undefined;
    if (includeBioFields && (bioFieldOptions.position !== false)) {
      positionName = prospect.position;
      if (typeof positionName === 'number') {
        const name = this.getPositionName(positionName);
        if (name) positionName = name;
      }
    }

    // Determine draft round - use draftInfo option (or individual draftRound option for backwards compat)
    const includeDraftInfo = bioFieldOptions.draftInfo !== false && bioFieldOptions.draftRound !== false;
    let draftRound: string | undefined;
    if (includeBioFields && includeDraftInfo) {
      draftRound = prospect.draftRound || prospect.round;
      if (draftRound === 8) {
        draftRound = 'UFA';
      } else if (typeof draftRound === 'number') {
        draftRound = String(draftRound);
      }
    }

    // Extract face data from GENR string if available
    const faceData = this.extractFaceData(prospect);

    // Get PAM (3D model) from multiple sources: assignedGenr, PEPS, visuals.genericHeadName
    const prospectPam = prospect.assignedGenr || prospect.PEPS || prospect.visuals?.genericHeadName;

    // Create the custom player - always include name and draft class
    const customPlayer: CustomPlayer = {
      firstName: prospect.firstName,
      lastName: prospect.lastName,
      draftClass: draftYear,  // Draft class editor should always set this
      careerFrom: draftYear,
      careerTo: draftYear + 15,  // Default 15 year career span
      maddenPid: prospect.PID || 0,
      maddenPam: prospectPam,
      has3DModel: (prospect.PID || 0) > 0,
      // Include face data if extracted
      ...(faceData && {
        maddenPghe: faceData.maddenPghe,
        maddenPfcg: faceData.maddenPfcg,
        maddenGpan: faceData.maddenGpan,
        maddenGslp: faceData.maddenGslp,
        maddenCpvf: faceData.maddenCpvf,
        maddenSkinTone: faceData.maddenSkinTone
      })
    };

    // Conditionally add bio fields based on pushMode and options
    if (includeBioFields) {
      if (bioFieldOptions.college !== false && collegeId !== undefined) {
        customPlayer.collegeId = collegeId;
      }
      if (bioFieldOptions.race !== false) {
        customPlayer.race = item.derivedRace ?? prospect.race;
      }
      if (bioFieldOptions.height !== false) {
        customPlayer.height = prospect.heightInches || prospect.height;
      }
      if (bioFieldOptions.weight !== false) {
        customPlayer.weight = prospect.weight;
      }
      if (bioFieldOptions.homeState !== false && homeStateId !== undefined) {
        customPlayer.homeState = String(homeStateId);
      }
      if (bioFieldOptions.hometown !== false && (prospect.homeTown || prospect.hometown)) {
        customPlayer.hometown = prospect.homeTown || prospect.hometown;
      }
      if (bioFieldOptions.position !== false && positionName) {
        customPlayer.position = positionName;
      }
      if (includeDraftInfo && draftRound) {
        customPlayer.draftRound = draftRound;
      }
      if (includeDraftInfo) {
        customPlayer.draftPick = prospect.draftPick || prospect.pick;
      }
      if (bioFieldOptions.bodyType !== false) {
        customPlayer.bodyType = this.normalizeBodyType(prospect.bodyType);
      }
      if (bioFieldOptions.handedness !== false) {
        customPlayer.handedness = prospect.handedness;
      }
    }

    const customPlayerId = userDatabaseService.createCustomPlayer(customPlayer);

    // Create season data for draft year
    await this.saveSeasonData(customPlayerId, draftYear, prospect, true, pushMode, bioFieldOptions);
  }

  /**
   * Update an existing bundled player
   */
  private async updateBundledPlayer(
    item: ProspectAnalysis,
    draftYear: number,
    resolutionMap: Map<string, boolean>,
    fillEmptyBioFields: boolean,
    pushMode: 'all' | 'ratings',
    bioFieldOptions: BioFieldOptions
  ): Promise<void> {
    const prospect = item.prospect;
    const playerId = item.existingPlayerId!;
    const includeBioFields = pushMode === 'all';

    console.log(`[DraftClassDB] updateBundledPlayer: ${prospect.firstName} ${prospect.lastName} (id=${playerId}), year=${draftYear}`);

    // Get current player data
    const currentPlayer = lookupService.getPlayerByInternalId(playerId);
    if (!currentPlayer) {
      console.log(`[DraftClassDB] ERROR: Player ${playerId} not found in lookup!`);
      throw new Error(`Player ${playerId} not found in lookup`);
    }

    // Prepare bio edits - only include fields that should be updated
    const bioEdits: any = {};

    // Only process bio fields if pushMode is 'all'
    if (includeBioFields) {
      // DEBUG: Log resolution processing
      console.log(`\n=== RESOLUTION PROCESSING: ${prospect.firstName} ${prospect.lastName} (idx=${item.prospectIndex}) ===`);
      console.log(`  conflicts count: ${item.conflicts?.length || 0}`);
      console.log(`  fillEmptyBioFields: ${fillEmptyBioFields}`);

      // Track fields where user chose "Keep Current" - these should NOT be overwritten
      const keepCurrentFields = new Set<string>();

      // Process conflicts with resolutions
      for (const conflict of item.conflicts || []) {
        const resKey = `${item.prospectIndex}_${conflict.field}`;
        const keepCurrent = resolutionMap.get(resKey) ?? true;
        console.log(`  Resolution for ${conflict.field}: key="${resKey}", keepCurrent=${keepCurrent}, newValue=${conflict.newValue}`);
        if (!keepCurrent) {
          // User chose "Use New" - apply the prospect value
          const fieldEnabled = this.isBioFieldEnabled(conflict.field, bioFieldOptions);
          if (fieldEnabled) {
            bioEdits[conflict.field] = conflict.newValue;
            console.log(`    -> SET bioEdits.${conflict.field} = ${conflict.newValue}`);
          }
        } else {
          // User chose "Keep Current" - mark this field to skip in default code
          keepCurrentFields.add(conflict.field);
          console.log(`    -> KEEPING CURRENT for ${conflict.field}`);
        }
      }

      // Push bio fields when checkbox is selected
      // Only set defaults for fields NOT in keepCurrentFields (user wants to keep DB value)
      // The resolution loop already handled explicit choices, default code fills in the rest

      if (bioFieldOptions.college !== false && prospect.college && bioEdits.collegeId === undefined && !keepCurrentFields.has('collegeId')) {
        let collegeId: number | undefined = undefined;
        if (typeof prospect.college === 'string') {
          const id = this.getCollegeId(prospect.college);
          if (id) collegeId = id;
        } else if (typeof prospect.college === 'number') {
          collegeId = prospect.college;
        }
        if (collegeId) {
          bioEdits.collegeId = collegeId;
        }
      }

      if (bioFieldOptions.homeState !== false && prospect.homeState && bioEdits.homeState === undefined && !keepCurrentFields.has('homeState')) {
        bioEdits.homeState = prospect.homeState;
      }

      if (bioFieldOptions.hometown !== false && (prospect.homeTown || prospect.hometown) && bioEdits.hometown === undefined && !keepCurrentFields.has('hometown')) {
        bioEdits.hometown = prospect.homeTown || prospect.hometown;
      }

      if (bioFieldOptions.height !== false && (prospect.height || prospect.heightInches) && bioEdits.height === undefined && !keepCurrentFields.has('height')) {
        bioEdits.height = prospect.heightInches || prospect.height;
      }

      if (bioFieldOptions.weight !== false && prospect.weight && bioEdits.weight === undefined && !keepCurrentFields.has('weight')) {
        bioEdits.weight = prospect.weight;
      }

      if (bioFieldOptions.race !== false && (prospect.race || item.derivedRace) && bioEdits.race === undefined && !keepCurrentFields.has('race')) {
        bioEdits.race = item.derivedRace ?? prospect.race;
      }

      if (bioFieldOptions.bodyType !== false && prospect.bodyType !== undefined && bioEdits.bodyType === undefined && !keepCurrentFields.has('bodyType')) {
        bioEdits.bodyType = this.normalizeBodyType(prospect.bodyType);
      }

      if (bioFieldOptions.handedness !== false && prospect.handedness !== undefined && bioEdits.handedness === undefined && !keepCurrentFields.has('handedness')) {
        bioEdits.handedness = prospect.handedness;
      }

      // DEBUG: Final bioEdits before save
      console.log(`  FINAL bioEdits:`, JSON.stringify(bioEdits));

      // Save bio edits if any
      if (Object.keys(bioEdits).length > 0) {
        console.log(`[DraftClassDatabaseService] SAVING BIO EDITS for player ${playerId}:`, bioEdits);
        userDatabaseService.savePlayerEdit(playerId, bioEdits);

        // VERIFY: Read back the saved bio edits
        const verifyBio = userDatabaseService.getPlayerEdit(playerId);
        console.log(`[DraftClassDatabaseService] VERIFY BIO SAVE for player ${playerId}:`);
        console.log(`  - Saved weight: ${bioEdits.weight}, Read back weight: ${verifyBio?.weight}`);
        console.log(`  - Match: ${bioEdits.weight === verifyBio?.weight ? 'YES' : 'NO'}`);
      } else {
        console.log(`[DraftClassDatabaseService] NO BIO EDITS TO SAVE for player ${playerId}`);
        console.log(`  - fillEmptyBioFields=${fillEmptyBioFields}`);
        console.log(`  - currentPlayer.weight=${currentPlayer.weight}`);
      }
    }

    // Extract and save face data to appearance_edits
    // Check multiple sources for PAM (3D model): assignedGenr, PEPS, visuals.genericHeadName
    const prospectPam = prospect.assignedGenr || prospect.PEPS || prospect.visuals?.genericHeadName;
    const faceData = this.extractFaceData(prospect);

    if (faceData) {
      const appearanceEdits: any = {
        maddenPid: prospect.PID || 0,
        maddenPam: prospectPam,
        maddenPghe: faceData.maddenPghe,
        maddenPfcg: faceData.maddenPfcg,
        maddenGpan: faceData.maddenGpan,
        maddenGslp: faceData.maddenGslp,
        maddenCpvf: faceData.maddenCpvf,
        maddenSkinTone: faceData.maddenSkinTone
      };
      console.log(`[DraftClassDatabaseService] updateBundledPlayer - saving appearance edits:`, appearanceEdits);
      userDatabaseService.saveAppearanceEdit(playerId, appearanceEdits);
    } else if (prospect.PID !== undefined || prospectPam) {
      // Save PID/PAM even without full PGHE data
      const appearanceEdits: any = {};
      if (prospect.PID !== undefined) appearanceEdits.maddenPid = prospect.PID;
      if (prospectPam) {
        appearanceEdits.maddenPam = prospectPam;
      }
      if (Object.keys(appearanceEdits).length > 0) {
        console.log(`[DraftClassDatabaseService] updateBundledPlayer - saving basic appearance:`, appearanceEdits);
        userDatabaseService.saveAppearanceEdit(playerId, appearanceEdits);
      }
    }

    // Save season data with ratings (always save ratings, conditionally save bio fields)
    await this.saveSeasonEditData(playerId, draftYear, prospect, pushMode, bioFieldOptions);
  }

  /**
   * Update an existing custom player
   */
  private async updateCustomPlayer(
    item: ProspectAnalysis,
    draftYear: number,
    resolutionMap: Map<string, boolean>,
    fillEmptyBioFields: boolean,
    pushMode: 'all' | 'ratings',
    bioFieldOptions: BioFieldOptions
  ): Promise<void> {
    const prospect = item.prospect;
    const customPlayerId = item.existingPlayerId!;
    const includeBioFields = pushMode === 'all';

    // Get current custom player data
    const currentPlayer = userDatabaseService.getCustomPlayer(customPlayerId);
    if (!currentPlayer) {
      throw new Error(`Custom player ${customPlayerId} not found`);
    }

    // Prepare bio updates - only if pushMode is 'all'
    const bioUpdates: Partial<CustomPlayer> = {};

    if (includeBioFields) {
      // Process conflicts with resolutions
      for (const conflict of item.conflicts || []) {
        const keepCurrent = resolutionMap.get(`${item.prospectIndex}_${conflict.field}`) ?? true;
        if (!keepCurrent) {
          // Check if this field is enabled in bioFieldOptions
          const fieldEnabled = this.isBioFieldEnabled(conflict.field, bioFieldOptions);
          if (fieldEnabled) {
            (bioUpdates as any)[conflict.field] = conflict.newValue;
          }
        }
      }

      // Push bio fields when checkbox is selected
      // If fillEmptyBioFields is true, only fill empty fields
      // If fillEmptyBioFields is false, always push (overwrite)
      if (bioFieldOptions.college !== false && prospect.college) {
        if (!fillEmptyBioFields || !currentPlayer.collegeId) {
          let collegeId: number | undefined = undefined;
          if (typeof prospect.college === 'string') {
            const id = this.getCollegeId(prospect.college);
            if (id) collegeId = id;
          } else if (typeof prospect.college === 'number') {
            collegeId = prospect.college;
          }
          if (collegeId) bioUpdates.collegeId = collegeId;
        }
      }

      if (bioFieldOptions.homeState !== false && prospect.homeState) {
        if (!fillEmptyBioFields || !currentPlayer.homeState) {
          let homeStateId: number | string | undefined = prospect.homeState;
          if (typeof homeStateId === 'string') {
            const id = this.getStateId(homeStateId);
            if (id) homeStateId = id;
          }
          bioUpdates.homeState = String(homeStateId);
        }
      }

      if (bioFieldOptions.hometown !== false && (prospect.homeTown || prospect.hometown)) {
        if (!fillEmptyBioFields || !currentPlayer.hometown) {
          bioUpdates.hometown = prospect.homeTown || prospect.hometown;
        }
      }

      if (bioFieldOptions.height !== false && (prospect.height || prospect.heightInches)) {
        if (!fillEmptyBioFields || !currentPlayer.height) {
          bioUpdates.height = prospect.heightInches || prospect.height;
        }
      }

      if (bioFieldOptions.weight !== false && prospect.weight) {
        if (!fillEmptyBioFields || !currentPlayer.weight) {
          bioUpdates.weight = prospect.weight;
        }
      }

      if (bioFieldOptions.race !== false && (prospect.race || item.derivedRace)) {
        if (!fillEmptyBioFields || !currentPlayer.race) {
          bioUpdates.race = item.derivedRace ?? prospect.race;
        }
      }

      if (bioFieldOptions.bodyType !== false && prospect.bodyType !== undefined) {
        if (!fillEmptyBioFields || !currentPlayer.bodyType) {
          bioUpdates.bodyType = this.normalizeBodyType(prospect.bodyType);
        }
      }

      if (bioFieldOptions.handedness !== false && prospect.handedness !== undefined) {
        if (!fillEmptyBioFields || !currentPlayer.handedness) {
          bioUpdates.handedness = prospect.handedness;
        }
      }

      // Push PID and PAM for custom players
      // PAM sources: assignedGenr (face picker), PEPS (parser), visuals.genericHeadName
      const prospectPam = prospect.assignedGenr || prospect.PEPS || prospect.visuals?.genericHeadName;

      if (bioFieldOptions.pid !== false && prospect.PID !== undefined) {
        if (!fillEmptyBioFields || !currentPlayer.maddenPid) {
          bioUpdates.maddenPid = prospect.PID;
        }
      }
      if (bioFieldOptions.pam !== false && prospectPam) {
        if (!fillEmptyBioFields || !currentPlayer.maddenPam) {
          bioUpdates.maddenPam = prospectPam;
        }
      }

      // Extract and save face data for custom players
      const faceData = this.extractFaceData(prospect);
      if (faceData) {
        // For custom players, face data is stored directly in custom_players table
        if (!fillEmptyBioFields || !currentPlayer.maddenPghe) {
          bioUpdates.maddenPghe = faceData.maddenPghe;
          bioUpdates.maddenPfcg = faceData.maddenPfcg;
          bioUpdates.maddenGpan = faceData.maddenGpan;
          bioUpdates.maddenGslp = faceData.maddenGslp;
          bioUpdates.maddenCpvf = faceData.maddenCpvf;
          bioUpdates.maddenSkinTone = faceData.maddenSkinTone;
          console.log(`[DraftClassDatabaseService] updateCustomPlayer - adding face data:`, faceData);
        }
      }

      // Save bio updates if any
      if (Object.keys(bioUpdates).length > 0) {
        console.log(`[DraftClassDatabaseService] updateCustomPlayer - bioUpdates:`, bioUpdates);
        userDatabaseService.updateCustomPlayer(customPlayerId, bioUpdates);
      }
    }

    // Save season data with ratings
    await this.saveSeasonData(customPlayerId, draftYear, prospect, true, pushMode, bioFieldOptions);
  }

  /**
   * Helper to check if a bio field is enabled in the options
   */
  private isBioFieldEnabled(field: string, bioFieldOptions: BioFieldOptions): boolean {
    const fieldMap: Record<string, keyof BioFieldOptions> = {
      'collegeId': 'college',
      'college': 'college',
      'homeState': 'homeState',
      'hometown': 'hometown',
      'homeTown': 'hometown',
      'height': 'height',
      'weight': 'weight',
      'race': 'race',
      'bodyType': 'bodyType',
      'jersey': 'jersey',
      'age': 'age',
      'position': 'position',
      'archetype': 'archetype',
      'draftRound': 'draftInfo',  // Use draftInfo for draft round/pick
      'draftPick': 'draftInfo',
      'handedness': 'handedness'
    };

    const optionKey = fieldMap[field];
    if (!optionKey) return true;  // Unknown field, allow by default

    return bioFieldOptions[optionKey] !== false;
  }

  /**
   * Save season data for a custom player
   * SIMPLIFIED: Uses same pattern as RosterDatabaseService
   */
  private async saveSeasonData(
    customPlayerId: number,
    year: number,
    prospect: any,
    isCustomPlayer: boolean,
    pushMode: 'all' | 'ratings' = 'all',
    bioFieldOptions: BioFieldOptions = {}
  ): Promise<void> {
    const includeBioFields = pushMode === 'all';

    const season: Partial<CustomPlayerSeason> = {
      year,
      team: prospect.team || 'FA'
    };

    // Conditionally include bio fields in season data
    if (includeBioFields) {
      if (bioFieldOptions.jersey !== false) {
        season.jersey = prospect.jerseyNum || prospect.jersey;
      }
      if (bioFieldOptions.age !== false) {
        season.age = prospect.age;
      }
      if (bioFieldOptions.position !== false) {
        season.position = typeof prospect.position === 'string' ? prospect.position : undefined;
      }
      if (bioFieldOptions.archetype !== false) {
        season.archetype = prospect.archetype;
        // Also store numeric archetype ID (PLTY)
        if (prospect.PLTY !== undefined) {
          (season as any).PLTY = prospect.PLTY;
        }
      }
    }

    // Extract ratings - EXACTLY like RosterDatabaseService
    this.extractRatingsToSeason(prospect, season);

    console.log(`[DraftClassDB] saveSeasonData for custom player ${customPlayerId}, year ${year}, POVR=${(season as any).POVR}`);

    userDatabaseService.saveCustomPlayerSeason(customPlayerId, year, season);
  }

  /**
   * Extract ratings from prospect to season object
   * COPIED DIRECTLY FROM RosterDatabaseService - IDENTICAL LOGIC
   */
  private extractRatingsToSeason(prospect: any, season: any): void {
    // Simple loop - EXACTLY like RosterDatabaseService
    for (const field of RATING_FIELDS) {
      if (prospect[field] !== undefined && prospect[field] !== null) {
        season[field] = prospect[field];
      }
    }
  }

  /**
   * Save season edit data for a bundled player
   * SIMPLIFIED: Uses same pattern as RosterDatabaseService
   */
  private async saveSeasonEditData(
    playerId: number,
    year: number,
    prospect: any,
    pushMode: 'all' | 'ratings' = 'all',
    bioFieldOptions: BioFieldOptions = {}
  ): Promise<void> {
    debugLog(`saveSeasonEditData called for player ${playerId}, year ${year}`);
    console.log(`[DraftClassDB] saveSeasonEditData: ${prospect.firstName} ${prospect.lastName} (id=${playerId}), year=${year}`);

    const includeBioFields = pushMode === 'all';

    const seasonEdits: any = {
      team: prospect.team || 'FA'  // Default to Free Agent if no team specified
    };

    // Conditionally include bio fields in season edits
    if (includeBioFields) {
      if (bioFieldOptions.jersey !== false) {
        seasonEdits.jersey = prospect.jerseyNum || prospect.jersey;
      }
      if (bioFieldOptions.age !== false) {
        seasonEdits.age = prospect.age;
      }
      if (bioFieldOptions.position !== false) {
        seasonEdits.position = typeof prospect.position === 'string' ? prospect.position : undefined;
      }
      if (bioFieldOptions.archetype !== false) {
        // Support both string archetype and numeric PLTY
        seasonEdits.archetype = prospect.archetype;
        if (prospect.PLTY !== undefined) {
          seasonEdits.PLTY = prospect.PLTY;
        }
      }
    }

    // Extract ratings - EXACTLY like RosterDatabaseService
    this.extractRatingsToSeason(prospect, seasonEdits);

    console.log(`[DraftClassDB] seasonEdits: POVR=${seasonEdits.POVR}, PSPD=${seasonEdits.PSPD}, PTAK=${seasonEdits.PTAK}, PLTY=${seasonEdits.PLTY}`);

    userDatabaseService.saveSeasonEdit(playerId, year, seasonEdits);
    console.log(`[DraftClassDB] saveSeasonEdit CALLED for player ${playerId}, year ${year}`);

    // Verify save
    const verify = userDatabaseService.getSeasonEdit(playerId, year);
    if (verify) {
      console.log(`[DraftClassDB] VERIFY: Saved POVR=${seasonEdits.POVR}, Read back POVR=${verify.ratings?.POVR}`);
    }
  }

  /**
   * Normalize body type to numeric value
   */
  private normalizeBodyType(bodyType: any): number | undefined {
    if (typeof bodyType === 'number') {
      return bodyType;
    }
    if (typeof bodyType === 'string') {
      const map: Record<string, number> = {
        'Standard': 0, 'standard': 0,
        'Thin': 1, 'thin': 1,
        'Muscular': 2, 'muscular': 2,
        'Heavy': 3, 'heavy': 3,
        'Lean': 4, 'lean': 4
      };
      return map[bodyType];
    }
    return undefined;
  }
}

export const draftClassDatabaseService = new DraftClassDatabaseService();
