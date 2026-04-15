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
   */
  private findBioConflicts(prospect: any, bundledPlayer: any, derivedRace: number | null): FieldConflict[] {
    const conflicts: FieldConflict[] = [];

    const fieldsToCheck = [
      { prospectField: 'college', bundledField: 'collegeId', displayName: 'College', transform: 'college' },
      { prospectField: 'homeState', bundledField: 'homeState', displayName: 'Home State' },
      { prospectField: 'height', bundledField: 'height', displayName: 'Height' },
      { prospectField: 'heightInches', bundledField: 'height', displayName: 'Height' },
      { prospectField: 'weight', bundledField: 'weight', displayName: 'Weight' },
      { prospectField: 'bodyType', bundledField: 'bodyType', displayName: 'Body Type' }
    ];

    for (const { prospectField, bundledField, displayName, transform } of fieldsToCheck) {
      let newValue = prospect[prospectField];
      const currentValue = bundledPlayer[bundledField];

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
      if (String(newValue) !== String(currentValue)) {
        conflicts.push({
          field: bundledField,
          displayName,
          currentValue,
          newValue
        });
      }
    }

    // Check race conflict if we derived one
    if (derivedRace !== null && bundledPlayer.race !== undefined && bundledPlayer.race !== null) {
      if (derivedRace !== bundledPlayer.race) {
        conflicts.push({
          field: 'race',
          displayName: 'Race',
          currentValue: bundledPlayer.race,
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
      if (String(newValue) !== String(currentValue)) {
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
      if (derivedRace !== customPlayer.race) {
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

    // Create the custom player - always include name and draft class
    const customPlayer: CustomPlayer = {
      firstName: prospect.firstName,
      lastName: prospect.lastName,
      draftClass: draftYear,  // Draft class editor should always set this
      careerFrom: draftYear,
      careerTo: draftYear + 15,  // Default 15 year career span
      maddenPid: prospect.PID || 0,
      maddenPam: prospect.PEPS || prospect.visuals?.genericHeadName,
      has3DModel: (prospect.PID || 0) > 0
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
      // Process conflicts with resolutions
      for (const conflict of item.conflicts || []) {
        const keepCurrent = resolutionMap.get(`${item.prospectIndex}_${conflict.field}`) ?? true;
        if (!keepCurrent) {
          // Check if this field is enabled in bioFieldOptions
          const fieldEnabled = this.isBioFieldEnabled(conflict.field, bioFieldOptions);
          if (fieldEnabled) {
            bioEdits[conflict.field] = conflict.newValue;
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
          if (collegeId) bioEdits.collegeId = collegeId;
        }
      }

      if (bioFieldOptions.homeState !== false && prospect.homeState) {
        if (!fillEmptyBioFields || !currentPlayer.homeState) {
          bioEdits.homeState = prospect.homeState;
        }
      }

      if (bioFieldOptions.height !== false && (prospect.height || prospect.heightInches)) {
        if (!fillEmptyBioFields || !currentPlayer.height) {
          bioEdits.height = prospect.heightInches || prospect.height;
        }
      }

      if (bioFieldOptions.weight !== false && prospect.weight) {
        if (!fillEmptyBioFields || !currentPlayer.weight) {
          bioEdits.weight = prospect.weight;
        }
      }

      if (bioFieldOptions.race !== false && (prospect.race || item.derivedRace)) {
        if (!fillEmptyBioFields || !currentPlayer.race) {
          bioEdits.race = item.derivedRace ?? prospect.race;
        }
      }

      if (bioFieldOptions.bodyType !== false && prospect.bodyType !== undefined) {
        if (!fillEmptyBioFields || !currentPlayer.bodyType) {
          bioEdits.bodyType = this.normalizeBodyType(prospect.bodyType);
        }
      }

      if (bioFieldOptions.handedness !== false && prospect.handedness !== undefined) {
        if (!fillEmptyBioFields || !currentPlayer.handedness) {
          bioEdits.handedness = prospect.handedness;
        }
      }

      // Save bio edits if any
      if (Object.keys(bioEdits).length > 0) {
        console.log(`[DraftClassDatabaseService] updateBundledPlayer - bioEdits:`, bioEdits);
        userDatabaseService.savePlayerEdit(playerId, bioEdits);
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
      if (bioFieldOptions.pid !== false && prospect.PID !== undefined) {
        if (!fillEmptyBioFields || !currentPlayer.maddenPid) {
          bioUpdates.maddenPid = prospect.PID;
        }
      }
      if (bioFieldOptions.pam !== false && (prospect.PEPS || prospect.visuals?.genericHeadName)) {
        if (!fillEmptyBioFields || !currentPlayer.maddenPam) {
          bioUpdates.maddenPam = prospect.PEPS || prospect.visuals?.genericHeadName;
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
      }
    }

    // Extract ratings - check both direct fields and mapped names (always include ratings)
    const ratings: Record<string, number> = {};

    // DEBUG: Log first prospect's data to see what fields exist
    console.log(`[DraftClassDatabaseService] saveSeasonData - Prospect keys:`, Object.keys(prospect).slice(0, 30));
    console.log(`[DraftClassDatabaseService] Sample values: speed=${prospect.speed}, breakTackle=${prospect.breakTackle}, overall=${prospect.overall}`);

    // First check M26 rating field names (POVR, PSPD, PSTA, PBKT, etc.)
    for (const field of RATING_FIELDS) {
      if (prospect[field] !== undefined && prospect[field] !== null) {
        ratings[field] = prospect[field];
      }
    }
    console.log(`[DraftClassDatabaseService] After M26 field check: ${Object.keys(ratings).length} ratings found`);

    // Check for legacy field names (PSTM, PBTK, etc.) and convert to M26 names
    for (const [legacyName, m26Name] of Object.entries(LEGACY_TO_M26_FIELD_MAP)) {
      if (prospect[legacyName] !== undefined && prospect[legacyName] !== null && !ratings[m26Name]) {
        ratings[m26Name] = prospect[legacyName];
      }
    }
    console.log(`[DraftClassDatabaseService] After legacy field check: ${Object.keys(ratings).length} ratings found`);

    // Also check alternative names (overall, speed, etc.)
    for (const [altName, dbName] of Object.entries(RATING_FIELD_MAP)) {
      if (prospect[altName] !== undefined && prospect[altName] !== null && !ratings[dbName]) {
        ratings[dbName] = prospect[altName];
      }
    }
    console.log(`[DraftClassDatabaseService] After alt name check: ${Object.keys(ratings).length} ratings found`);
    console.log(`[DraftClassDatabaseService] Final ratings object:`, ratings);

    // Merge ratings into season
    Object.assign(season, ratings);

    userDatabaseService.saveCustomPlayerSeason(customPlayerId, year, season);
  }

  /**
   * Save season edit data for a bundled player
   */
  private async saveSeasonEditData(
    playerId: number,
    year: number,
    prospect: any,
    pushMode: 'all' | 'ratings' = 'all',
    bioFieldOptions: BioFieldOptions = {}
  ): Promise<void> {
    // DUMP ALL PROSPECT KEYS AND VALUES FOR DEBUGGING
    const allKeys = Object.keys(prospect);
    console.log(`\n[DraftClassDB] ====== PROSPECT DATA DUMP for ${prospect.firstName} ${prospect.lastName} ======`);
    console.log(`[DraftClassDB] Total keys: ${allKeys.length}`);
    console.log(`[DraftClassDB] ALL KEYS: ${allKeys.join(', ')}`);

    // Log all rating-related values (both camelCase and M26)
    const ratingKeys = ['speed', 'overall', 'acceleration', 'strength', 'awareness', 'tackle',
                        'PSPD', 'POVR', 'PACC', 'PSTR', 'PAWR', 'PTAK'];
    for (const key of ratingKeys) {
      console.log(`[DraftClassDB]   ${key} = ${prospect[key]} (type: ${typeof prospect[key]})`);
    }

    debugLog(`saveSeasonEditData called for player ${playerId}, year ${year}`);
    debugLog(`Prospect keys: ${Object.keys(prospect).slice(0, 40).join(', ')}`);
    debugLog(`Prospect sample: speed=${prospect.speed}, overall=${prospect.overall}, PSPD=${prospect.PSPD}, POVR=${prospect.POVR}`);

    const includeBioFields = pushMode === 'all';

    const seasonEdits: any = {
      team: prospect.team
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
        seasonEdits.archetype = prospect.archetype;
      }
    }

    // Extract ratings (always include)
    let m26Count = 0, legacyCount = 0, camelCount = 0;

    // First check M26 rating field names
    for (const field of RATING_FIELDS) {
      if (prospect[field] !== undefined && prospect[field] !== null) {
        seasonEdits[field] = prospect[field];
        m26Count++;
      }
    }
    console.log(`[DraftClassDB] M26 fields found directly: ${m26Count}`);

    // Check for legacy field names and convert to M26 names
    for (const [legacyName, m26Name] of Object.entries(LEGACY_TO_M26_FIELD_MAP)) {
      if (prospect[legacyName] !== undefined && prospect[legacyName] !== null && !seasonEdits[m26Name]) {
        seasonEdits[m26Name] = prospect[legacyName];
        legacyCount++;
      }
    }
    console.log(`[DraftClassDB] Legacy fields mapped: ${legacyCount}`);

    // Also check alternative names (overall, speed, etc.)
    for (const [altName, dbName] of Object.entries(RATING_FIELD_MAP)) {
      if (prospect[altName] !== undefined && prospect[altName] !== null && !seasonEdits[dbName]) {
        seasonEdits[dbName] = prospect[altName];
        camelCount++;
        // Log the first few mappings for debugging
        if (camelCount <= 5) {
          console.log(`[DraftClassDB]   Mapped ${altName}=${prospect[altName]} -> ${dbName}`);
        }
      }
    }
    console.log(`[DraftClassDB] CamelCase fields mapped: ${camelCount}`);

    // Count how many ratings were found
    const ratingCount = Object.keys(seasonEdits).filter(k => k.startsWith('P') || k.startsWith('S')).length;
    console.log(`[DraftClassDB] Extracted ${ratingCount} rating fields for ${prospect.firstName} ${prospect.lastName}`);
    console.log(`[DraftClassDB] seasonEdits: POVR=${seasonEdits.POVR}, PSPD=${seasonEdits.PSPD}, PTAK=${seasonEdits.PTAK}`);
    debugLog(`saveSeasonEditData - extracted ${ratingCount} ratings`);

    // NOTE: Do NOT recalculate OVR here - the draft class editor already calculates the correct OVR
    // using findBestArchetype. The POVR from the draft class is authoritative.
    // Recalculating here was causing OVR mismatches (e.g., 81 in draft → 75 in database).

    userDatabaseService.saveSeasonEdit(playerId, year, seasonEdits);
    console.log(`[DraftClassDB] saveSeasonEdit CALLED for player ${playerId}, year ${year}`);
    debugLog(`saveSeasonEdit called successfully for player ${playerId}, year ${year}`);
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
