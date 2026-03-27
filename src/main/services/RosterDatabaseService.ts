/**
 * Roster Database Service
 *
 * Handles pushing roster data to the user database.
 * Similar to DraftClassDatabaseService but handles roster-specific field names.
 * Includes team, jersey number, and archetype for season data.
 */

import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { lookupService } from './lookup-service';

// File-based logging for debugging roster push
const LOG_FILE = path.join(app.getPath('temp'), 'roster-push-debug.log');

function writeDebugLog(message: string): void {
  const timestamp = new Date().toISOString();
  const logLine = `[${timestamp}] ${message}\n`;
  fs.appendFileSync(LOG_FILE, logLine);
}

function clearDebugLog(): void {
  fs.writeFileSync(LOG_FILE, `=== Roster Push Debug Log ===\nStarted: ${new Date().toISOString()}\n\n`);
}
import {
  userDatabaseService,
  CustomPlayer,
  CustomPlayerSeason
} from './UserDatabaseService';
import { ovrWeightsCalculator } from './rating-modes/OVRWeightsCalculator';

// Roster field names to database field names mapping
const ROSTER_FIELD_MAP: Record<string, string> = {
  // Bio fields
  'PFNA': 'firstName',
  'PLNA': 'lastName',
  'PCOL': 'collegeId',
  'PHSN': 'homeState',
  'PHGT': 'height',
  'PWGT': 'weight',
  'PAGE': 'age',
  'PLRC': 'race',
  'PCBT': 'bodyType',
  'PHAN': 'handedness',
  // Photo/Asset fields
  'PSXP': 'pid',
  'PEPS': 'pam',
  // Team/Position fields
  'TGID': 'team',
  'PJEN': 'jersey',
  'PPOS': 'position',
  'PLTY': 'archetype'  // PLTY is what franchise reads for archetype!
};

// Rating fields from roster files (4-character codes)
const ROSTER_RATING_FIELDS = [
  // Core attributes
  'POVR', 'PSPD', 'PACC', 'PSTR', 'PAGI', 'PJMP', 'PSTA', 'PINJ', 'PTGH', 'PAWR',
  // Ball carrier
  'PBCV', 'PBKT', 'PLTR', 'PELU', 'PLSA', 'PLSM', 'PLJM', 'PCAR',
  // Passing
  'PTHA', 'PTAS', 'PTAM', 'PTAD', 'PTOR', 'PTUP', 'PTHP', 'PPLA',
  // Receiving
  'PCTH', 'PLSC', 'PLCI', 'SRRN', 'PMRR', 'PDRR', 'PLRL',
  // Blocking
  'PRBK', 'PPBK', 'PLIB', 'PLBK', 'PRBF', 'PRBS', 'PPBF', 'PPBS',
  // Defense
  'PTAK', 'PLHT', 'PLPE', 'PFMS', 'PLPM', 'PBSG', 'PLPR', 'PLPU',
  // Coverage
  'PLMC', 'PLZC',
  // Special teams
  'PKAC', 'PKPR', 'PKRT'
];

// Map roster field names to database field names
// NOW USING M26 ROSTER NAMES DIRECTLY IN DATABASE - NO CONVERSION NEEDED
// This map is kept for compatibility but all values are identity mappings
const ROSTER_TO_DB_FIELD_MAP: Record<string, string> = {
  // All fields now use M26 roster names directly - no conversion!
  'POVR': 'POVR', 'PSPD': 'PSPD', 'PACC': 'PACC', 'PSTR': 'PSTR', 'PAGI': 'PAGI',
  'PJMP': 'PJMP', 'PSTA': 'PSTA', 'PINJ': 'PINJ', 'PTGH': 'PTGH', 'PAWR': 'PAWR',
  'PCAR': 'PCAR', 'PBCV': 'PBCV', 'PBKT': 'PBKT', 'PLTR': 'PLTR', 'PELU': 'PELU',
  'PLSA': 'PLSA', 'PLSM': 'PLSM', 'PLJM': 'PLJM', 'PTHA': 'PTHA', 'PTAS': 'PTAS',
  'PTAM': 'PTAM', 'PTAD': 'PTAD', 'PTOR': 'PTOR', 'PTUP': 'PTUP', 'PTHP': 'PTHP',
  'PPLA': 'PPLA', 'PCTH': 'PCTH', 'PLSC': 'PLSC', 'PLCI': 'PLCI', 'SRRN': 'SRRN',
  'PMRR': 'PMRR', 'PDRR': 'PDRR', 'PLRL': 'PLRL', 'PRBK': 'PRBK', 'PPBK': 'PPBK',
  'PLIB': 'PLIB', 'PLBK': 'PLBK', 'PRBF': 'PRBF', 'PRBS': 'PRBS', 'PPBF': 'PPBF',
  'PPBS': 'PPBS', 'PTAK': 'PTAK', 'PLHT': 'PLHT', 'PLPE': 'PLPE', 'PFMS': 'PFMS',
  'PLPM': 'PLPM', 'PBSG': 'PBSG', 'PLPR': 'PLPR', 'PLPU': 'PLPU', 'PLMC': 'PLMC',
  'PLZC': 'PLZC', 'PKAC': 'PKAC', 'PKPR': 'PKPR', 'PKRT': 'PKRT'
};

// Map team ID to name (must match team_lookup.csv)
const TEAM_ID_TO_ABBR: Record<number, string> = {
  1: 'Bears', 2: 'Bengals', 3: 'Bills', 4: 'Broncos', 5: 'Browns', 6: 'Buccs', 7: 'Cards', 8: 'Chargers',
  9: 'Cheifs', 10: 'Colts', 11: 'Cowboys', 12: 'Dolphins', 13: 'Eagles', 14: 'Falcons', 15: '49ers', 16: 'Giants',
  17: 'Jags', 18: 'Jets', 19: 'Lions', 20: 'Packers', 21: 'Panthers', 22: 'Pats', 23: 'Raiders', 24: 'Rams',
  25: 'Ravens', 26: 'Commanders', 27: 'Saints', 28: 'Seahawks', 29: 'Steelers', 30: 'Titans', 31: 'Vikings', 32: 'Texans',
  1009: 'FA', 1010: 'FA' // Free agent codes
};

// Position ID to name mapping (must match position_lookup.csv)
const POSITION_ID_TO_NAME: Record<number, string> = {
  0: 'QB', 1: 'HB', 2: 'FB', 3: 'WR', 4: 'TE', 5: 'LT', 6: 'LG', 7: 'C',
  8: 'RG', 9: 'RT', 10: 'LEDG', 11: 'REDG', 12: 'DT', 13: 'SAM', 14: 'Mike',
  15: 'WILL', 16: 'CB', 17: 'FS', 18: 'SS', 19: 'K', 20: 'P', 21: 'LS'
};

export interface FieldConflict {
  field: string;
  displayName: string;
  currentValue: any;
  newValue: any;
}

export interface PlayerAnalysis {
  player: any;
  playerIndex: number;
  matchType: 'new' | 'existing_bundled' | 'existing_custom';
  existingPlayerId?: number;
  isCustomPlayer?: boolean;
  conflicts?: FieldConflict[];
  derivedRace?: number;
  yearAlreadyHasRatings?: boolean;
}

export interface RosterPushAnalysisResult {
  seasonYear: number;
  newPlayers: PlayerAnalysis[];
  existingBundled: PlayerAnalysis[];
  existingCustom: PlayerAnalysis[];
  totalConflicts: number;
  hasYearConflicts: boolean;
}

export interface FieldResolution {
  playerIndex: number;
  field: string;
  keepCurrent: boolean;
}

export interface RosterPushExecutionResult {
  success: boolean;
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
}

class RosterDatabaseService {
  /**
   * Derive race from generic head name (PAM value)
   * Generic heads follow the pattern gen_X_* where X indicates race category
   */
  public deriveRaceFromGenericHead(genericHeadName: string | null | undefined): number | null {
    if (!genericHeadName) {
      console.log(`[RosterDatabaseService] deriveRace: genericHeadName is null/undefined`);
      return null;
    }

    console.log(`[RosterDatabaseService] deriveRace: Trying to match "${genericHeadName}"`);

    // Try standard gen_X_ pattern first
    let match = genericHeadName.match(/^gen_(\d+)_/i);

    // If no match, try extracting number from anywhere in the string (e.g., "gen2_" or patterns like "2_aging")
    if (!match) {
      match = genericHeadName.match(/gen(\d+)/i);
    }

    // If still no match, try to find skin tone indicators in the name
    if (!match) {
      // Check for common naming patterns that indicate race
      const lowerName = genericHeadName.toLowerCase();
      if (lowerName.includes('_2_') || lowerName.startsWith('2_')) {
        console.log(`[RosterDatabaseService] deriveRace: Found pattern indicating race 2 (African American)`);
        return 7; // African American
      }
      if (lowerName.includes('_3_') || lowerName.startsWith('3_')) {
        console.log(`[RosterDatabaseService] deriveRace: Found pattern indicating race 3 (Caucasian)`);
        return 1; // Caucasian
      }
      if (lowerName.includes('_4_') || lowerName.startsWith('4_')) {
        return 1; // Caucasian variant
      }
      if (lowerName.includes('_5_') || lowerName.startsWith('5_')) {
        return 5; // Hispanic
      }
      if (lowerName.includes('_6_') || lowerName.startsWith('6_')) {
        return 6; // Asian
      }
      console.log(`[RosterDatabaseService] deriveRace: No race pattern found in "${genericHeadName}"`);
      return null;
    }

    const category = parseInt(match[1]);
    console.log(`[RosterDatabaseService] deriveRace: Matched category ${category} from "${genericHeadName}"`);

    const raceMap: Record<number, number> = {
      2: 7,  // African American
      3: 1,  // Caucasian
      4: 1,  // Caucasian variant
      5: 5,  // Hispanic
      6: 6   // Asian
    };

    const result = raceMap[category] ?? null;
    console.log(`[RosterDatabaseService] deriveRace: Returning race ${result} for category ${category}`);
    return result;
  }

  /**
   * Get team abbreviation from team ID
   */
  private getTeamAbbr(teamId: number | undefined | null): string {
    if (teamId === undefined || teamId === null) return 'FA';
    return TEAM_ID_TO_ABBR[teamId] || 'FA';
  }

  /**
   * Get team abbreviation with year validation
   * Ensures teams that didn't exist in a given year are redirected to FA
   * This normalizes storage so historical rosters don't have anachronistic team assignments
   */
  private getTeamAbbrForYear(teamId: number | undefined | null, year: number): string {
    if (teamId === undefined || teamId === null) return 'FA';

    const teamName = TEAM_ID_TO_ABBR[teamId];
    if (!teamName) return 'FA';

    // Validate team existed in the given year
    // Ravens (TGID 25) - founded 1996
    if (teamId === 25 && year < 1996) {
      console.log(`[RosterDatabaseService] WARNING: Ravens (TGID 25) didn't exist in ${year}, redirecting to FA`);
      return 'FA';
    }

    // Texans (TGID 32) - founded 2002
    if (teamId === 32 && year < 2002) {
      console.log(`[RosterDatabaseService] WARNING: Texans (TGID 32) didn't exist in ${year}, redirecting to FA`);
      return 'FA';
    }

    // Jaguars (TGID 17) - founded 1995
    if (teamId === 17 && year < 1995) {
      console.log(`[RosterDatabaseService] WARNING: Jaguars (TGID 17) didn't exist in ${year}, redirecting to FA`);
      return 'FA';
    }

    // Panthers (TGID 21) - founded 1995
    if (teamId === 21 && year < 1995) {
      console.log(`[RosterDatabaseService] WARNING: Panthers (TGID 21) didn't exist in ${year}, redirecting to FA`);
      return 'FA';
    }

    return teamName;
  }

  /**
   * Get position name from position ID
   */
  private getPositionName(positionId: number | undefined | null): string | null {
    if (positionId === undefined || positionId === null) return null;
    return POSITION_ID_TO_NAME[positionId] || null;
  }

  /**
   * Helper to convert college ID to name (for display)
   */
  private getCollegeName(collegeId: number): string | null {
    if (!collegeId) return null;
    const name = lookupService.getDisplayName('college_lookup.csv', collegeId);
    return name !== String(collegeId) ? name : null;
  }

  /**
   * Helper to convert state ID to name (for display)
   */
  private getStateName(stateId: number): string | null {
    if (!stateId) return null;
    const name = lookupService.getDisplayName('state_lookup.csv', stateId);
    return name !== String(stateId) ? name : null;
  }

  /**
   * Extract first name from roster player
   */
  private getFirstName(player: any): string {
    return (player.PFNA || player.firstName || '').trim();
  }

  /**
   * Extract last name from roster player
   */
  private getLastName(player: any): string {
    return (player.PLNA || player.lastName || '').trim();
  }

  /**
   * Analyze roster players for database push
   */
  public async analyzeForPush(players: any[], seasonYear: number): Promise<RosterPushAnalysisResult> {
    console.log(`[RosterDatabaseService] Analyzing ${players.length} players for year ${seasonYear}`);

    // Clear debug log at start of analysis
    clearDebugLog();
    writeDebugLog(`=== ANALYZING ${players.length} PLAYERS FOR YEAR ${seasonYear} ===`);

    // DEBUG: Check player objects right when they arrive from IPC
    if (players.length > 0) {
      const firstPlayer = players[0];
      const allKeys = Object.keys(firstPlayer);
      const ratingKeys = allKeys.filter(k => ['POVR', 'PSPD', 'PACC', 'PSTR', 'PAGI', 'PJMP', 'PSTA', 'PAWR'].includes(k));
      console.log(`[RosterDatabaseService] ANALYZE INPUT - First player: ${firstPlayer.PFNA} ${firstPlayer.PLNA}`);
      console.log(`[RosterDatabaseService] ANALYZE INPUT - Total keys: ${allKeys.length}, Rating keys found: ${ratingKeys.join(', ') || 'NONE'}`);
      console.log(`[RosterDatabaseService] ANALYZE INPUT - POVR=${firstPlayer.POVR}, PSPD=${firstPlayer.PSPD}, PACC=${firstPlayer.PACC}, PSTR=${firstPlayer.PSTR}`);

      // FILE-BASED DEBUG: Log bio fields from first player
      writeDebugLog(`First player: ${firstPlayer.PFNA} ${firstPlayer.PLNA}`);
      writeDebugLog(`Total keys: ${allKeys.length}`);
      writeDebugLog(`ALL KEYS: ${allKeys.join(', ')}`);
      writeDebugLog(`Bio fields from roster:`);
      writeDebugLog(`  PHGT (height): ${firstPlayer.PHGT} (type: ${typeof firstPlayer.PHGT})`);
      writeDebugLog(`  PWGT (weight): ${firstPlayer.PWGT} (type: ${typeof firstPlayer.PWGT})`);
      writeDebugLog(`  PHSN (homeState): ${firstPlayer.PHSN} (type: ${typeof firstPlayer.PHSN})`);
      writeDebugLog(`  PHTN (hometown): ${firstPlayer.PHTN} (type: ${typeof firstPlayer.PHTN})`);
      writeDebugLog(`  PCOL (college): ${firstPlayer.PCOL} (type: ${typeof firstPlayer.PCOL})`);
      writeDebugLog(`  PLRC (race): ${firstPlayer.PLRC} (type: ${typeof firstPlayer.PLRC})`);
      writeDebugLog(`  PCBT (bodyType): ${firstPlayer.PCBT} (type: ${typeof firstPlayer.PCBT})`);
      writeDebugLog(`  PHAN (handedness): ${firstPlayer.PHAN} (type: ${typeof firstPlayer.PHAN})`);
    }

    await lookupService.waitForReady();
    await userDatabaseService.waitForReady();

    const newPlayers: PlayerAnalysis[] = [];
    const existingBundled: PlayerAnalysis[] = [];
    const existingCustom: PlayerAnalysis[] = [];
    let totalConflicts = 0;
    let hasYearConflicts = false;

    for (let i = 0; i < players.length; i++) {
      const player = players[i];
      const firstName = this.getFirstName(player);
      const lastName = this.getLastName(player);

      // Skip players with invalid names
      const invalidNames = ['', '.', '0', ' '];
      if (!firstName || !lastName ||
          invalidNames.includes(firstName) || invalidNames.includes(lastName)) {
        console.log(`[RosterDatabaseService] Skipping player ${i}: invalid name "${firstName}" "${lastName}"`);
        continue;
      }

      // Derive race from generic head (PEPS) when PLRC is not available
      // This works for all players, not just those with generic faces (PID=0)
      const pid = player.PSXP || player.PID || 0;
      const genericHead = player.PEPS || player.pam;

      // DEBUG: Log PEPS values for first few players
      if (i < 5) {
        console.log(`[RosterDatabaseService] Player ${i} "${firstName} ${lastName}": PEPS="${player.PEPS}", pam="${player.pam}", PLRC=${player.PLRC}`);
      }

      // Always try to derive race if PLRC is missing - the roster file might not have PLRC
      const derivedRace = (player.PLRC === undefined || player.PLRC === null)
        ? this.deriveRaceFromGenericHead(genericHead)
        : null; // If PLRC exists, we'll use it directly

      if (i < 5) {
        console.log(`[RosterDatabaseService] Player ${i}: derivedRace=${derivedRace}`);
      }

      // Try to find existing player by name
      // First check bundled database - find player who was active during this season year
      const bundledPlayer = lookupService.findPlayerByNameActiveInYear(firstName, lastName, seasonYear);

      // Also check custom players
      const customPlayers = userDatabaseService.searchCustomPlayers(`${firstName} ${lastName}`, 10);
      const matchingCustom = customPlayers.find(cp =>
        cp.firstName?.toLowerCase() === firstName.toLowerCase() &&
        cp.lastName?.toLowerCase() === lastName.toLowerCase()
      );

      if (bundledPlayer) {
        // Existing bundled player
        console.log(`[RosterDatabaseService] Matched roster player "${firstName} ${lastName}" to bundled player internalId=${bundledPlayer.internalId} (${bundledPlayer.firstName} ${bundledPlayer.lastName})`);
        const analysis: PlayerAnalysis = {
          player,
          playerIndex: i,
          matchType: 'existing_bundled',
          existingPlayerId: bundledPlayer.internalId,
          isCustomPlayer: false,
          derivedRace,
          conflicts: []
        };

        // Check for bio field conflicts
        analysis.conflicts = this.findBioConflicts(player, bundledPlayer, derivedRace);

        // Check if this year already has ratings
        const existingSeason = userDatabaseService.getSeasonEdit(bundledPlayer.internalId, seasonYear);
        if (existingSeason) {
          analysis.yearAlreadyHasRatings = true;
          hasYearConflicts = true;
        }

        totalConflicts += analysis.conflicts.length;
        existingBundled.push(analysis);

      } else if (matchingCustom) {
        // Existing custom player
        const analysis: PlayerAnalysis = {
          player,
          playerIndex: i,
          matchType: 'existing_custom',
          existingPlayerId: matchingCustom.id,
          isCustomPlayer: true,
          derivedRace,
          conflicts: []
        };

        // Check for bio field conflicts with custom player
        analysis.conflicts = this.findCustomPlayerConflicts(player, matchingCustom, derivedRace);

        // Check if this year already has ratings
        const existingSeason = userDatabaseService.getCustomPlayerSeason(matchingCustom.id!, seasonYear);
        if (existingSeason) {
          analysis.yearAlreadyHasRatings = true;
          hasYearConflicts = true;
        }

        totalConflicts += analysis.conflicts.length;
        existingCustom.push(analysis);

      } else {
        // New player - log for debugging unmatched players
        const pos = player.PPOS !== undefined ? player.PPOS : '?';
        const ovr = player.POVR || '?';
        console.log(`[RosterDatabaseService] No match for "${firstName}" "${lastName}" (pos=${pos}, ovr=${ovr}) in year ${seasonYear}`);

        const analysis: PlayerAnalysis = {
          player,
          playerIndex: i,
          matchType: 'new',
          derivedRace
        };
        newPlayers.push(analysis);
      }
    }

    console.log(`[RosterDatabaseService] Analysis complete: ${newPlayers.length} new, ${existingBundled.length} bundled, ${existingCustom.length} custom, ${totalConflicts} conflicts`);

    // Log sample of unmatched players for debugging
    if (newPlayers.length > 0) {
      const samplesToLog = Math.min(5, newPlayers.length);
      console.log(`[RosterDatabaseService] Sample unmatched players (first ${samplesToLog}):`);
      for (let i = 0; i < samplesToLog; i++) {
        const p = newPlayers[i].player;
        console.log(`  - "${p.PFNA || p.firstName}" "${p.PLNA || p.lastName}" (POVR=${p.POVR})`);
      }
    }

    // DEBUG: Check player objects before returning
    if (existingBundled.length > 0) {
      const testPlayer = existingBundled[0].player;
      console.log(`[RosterDatabaseService] ANALYZE RETURN - First bundled: ${testPlayer?.PFNA} ${testPlayer?.PLNA}`);
      console.log(`[RosterDatabaseService] ANALYZE RETURN - POVR=${testPlayer?.POVR}, PSPD=${testPlayer?.PSPD}, PACC=${testPlayer?.PACC}`);
    }

    return {
      seasonYear,
      newPlayers,
      existingBundled,
      existingCustom,
      totalConflicts,
      hasYearConflicts
    };
  }

  /**
   * Find bio field conflicts between roster player and bundled player
   */
  private findBioConflicts(player: any, bundledPlayer: any, derivedRace: number | null): FieldConflict[] {
    const conflicts: FieldConflict[] = [];

    const fieldsToCheck = [
      { rosterField: 'PCOL', bundledField: 'collegeId', displayName: 'College' },
      { rosterField: 'PHSN', bundledField: 'homeState', displayName: 'Home State' },
      { rosterField: 'PHGT', bundledField: 'height', displayName: 'Height' },
      { rosterField: 'PWGT', bundledField: 'weight', displayName: 'Weight', transform: (v: number) => v + 160 },
      { rosterField: 'PCBT', bundledField: 'bodyType', displayName: 'Body Type' }
    ];

    for (const { rosterField, bundledField, displayName, transform } of fieldsToCheck) {
      let newValue = player[rosterField];
      const currentValue = bundledPlayer[bundledField];

      // Skip if new value is empty/null
      if (newValue === undefined || newValue === null || newValue === '') continue;

      // Skip if current value is empty (will be filled automatically)
      if (currentValue === undefined || currentValue === null || currentValue === '') continue;

      // Apply transform if needed (e.g., weight stored as offset)
      if (transform && typeof newValue === 'number') {
        newValue = transform(newValue);
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
   * Find bio field conflicts between roster player and custom player
   */
  private findCustomPlayerConflicts(player: any, customPlayer: CustomPlayer, derivedRace: number | null): FieldConflict[] {
    const conflicts: FieldConflict[] = [];

    const fieldsToCheck = [
      { rosterField: 'PCOL', customField: 'collegeId', displayName: 'College' },
      { rosterField: 'PHSN', customField: 'homeState', displayName: 'Home State' },
      { rosterField: 'PHGT', customField: 'height', displayName: 'Height' },
      { rosterField: 'PWGT', customField: 'weight', displayName: 'Weight', transform: (v: number) => v + 160 },
      { rosterField: 'PCBT', customField: 'bodyType', displayName: 'Body Type' }
    ];

    for (const { rosterField, customField, displayName, transform } of fieldsToCheck) {
      let newValue = player[rosterField];
      const currentValue = (customPlayer as any)[customField];

      // Skip if new value is empty/null
      if (newValue === undefined || newValue === null || newValue === '') continue;

      // Skip if current value is empty (will be filled automatically)
      if (currentValue === undefined || currentValue === null || currentValue === '') continue;

      // Apply transform if needed
      if (transform && typeof newValue === 'number') {
        newValue = transform(newValue);
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
   */
  public async executePush(
    analysis: RosterPushAnalysisResult,
    resolutions: FieldResolution[],
    options: {
      pushMode?: 'all' | 'ratings';
      bioFieldOptions?: {
        team?: boolean;
        jersey?: boolean;
        archetype?: boolean;
        position?: boolean;
        college?: boolean;
        height?: boolean;
        weight?: boolean;
        homeState?: boolean;
        race?: boolean;
        bodyType?: boolean;
        handedness?: boolean;
        pid?: boolean;
        pam?: boolean;
      };
      overwriteExistingSeasons?: boolean;
      fillEmptyBioFields?: boolean;
    } = {}
  ): Promise<RosterPushExecutionResult> {
    console.log(`[RosterDatabaseService] ========== EXECUTE PUSH START ==========`);
    console.log(`[RosterDatabaseService] Executing push for year ${analysis.seasonYear}`);
    console.log(`[RosterDatabaseService] DEBUG LOG FILE: ${LOG_FILE}`);

    // Write to debug log
    writeDebugLog(`\n\n========== EXECUTE PUSH START ==========`);
    writeDebugLog(`Year: ${analysis.seasonYear}`);
    writeDebugLog(`Options: ${JSON.stringify(options)}`);
    console.log(`[RosterDatabaseService] Analysis has: ${analysis.newPlayers?.length || 0} new, ${analysis.existingBundled?.length || 0} bundled, ${analysis.existingCustom?.length || 0} custom`);

    // DEBUG: Log first player's data to see what's being passed
    const firstBundled = analysis.existingBundled?.[0];
    if (firstBundled) {
      const allKeys = Object.keys(firstBundled.player || {});
      const ratingKeys = allKeys.filter(k => k.length === 4 && (k.startsWith('P') || k.startsWith('S')));
      console.log(`[RosterDatabaseService] First bundled player: ${firstBundled.player?.PFNA} ${firstBundled.player?.PLNA}`);
      console.log(`[RosterDatabaseService] First bundled player total keys: ${allKeys.length}`);
      console.log(`[RosterDatabaseService] First bundled player rating-like keys (${ratingKeys.length}): ${ratingKeys.join(', ')}`);
      console.log(`[RosterDatabaseService] First bundled player POVR=${firstBundled.player?.POVR}, PSPD=${firstBundled.player?.PSPD}, PACC=${firstBundled.player?.PACC}, PBKT=${firstBundled.player?.PBKT}, PLTR=${firstBundled.player?.PLTR}`);
    }

    const {
      pushMode = 'all',
      bioFieldOptions = {},
      overwriteExistingSeasons = true,
      fillEmptyBioFields = true
    } = options;

    // Set defaults for bioFieldOptions - all bio fields default to true now
    const bioFields = {
      team: bioFieldOptions.team ?? true,
      jersey: bioFieldOptions.jersey ?? true,
      archetype: bioFieldOptions.archetype ?? true,
      position: bioFieldOptions.position ?? true,
      college: bioFieldOptions.college ?? true,
      height: bioFieldOptions.height ?? true,
      weight: bioFieldOptions.weight ?? true,
      homeState: bioFieldOptions.homeState ?? true,
      race: bioFieldOptions.race ?? true,
      bodyType: bioFieldOptions.bodyType ?? true,
      handedness: bioFieldOptions.handedness ?? true,
      pid: bioFieldOptions.pid ?? true,
      pam: bioFieldOptions.pam ?? true
    };

    console.log(`[RosterDatabaseService] Push mode: ${pushMode}`);
    console.log(`[RosterDatabaseService] Bio fields:`, bioFields);

    const result: RosterPushExecutionResult = {
      success: true,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: []
    };

    // Build resolution lookup
    const resolutionMap = new Map<string, boolean>();
    for (const res of resolutions) {
      resolutionMap.set(`${res.playerIndex}_${res.field}`, res.keepCurrent);
    }

    try {
      // Process new players - create custom players (skip if ratings only mode)
      if (pushMode === 'all') {
        for (const item of analysis.newPlayers) {
          try {
            await this.createNewPlayer(item, analysis.seasonYear, bioFields);
            result.created++;
          } catch (error) {
            const name = `${this.getFirstName(item.player)} ${this.getLastName(item.player)}`;
            result.errors.push(`Failed to create ${name}: ${error}`);
          }
        }
      } else {
        // Ratings only mode - skip new players (they don't exist in DB yet)
        console.log(`[RosterDatabaseService] Ratings only mode - skipping ${analysis.newPlayers.length} new players`);
        result.skipped += analysis.newPlayers.length;
      }

      // Process existing bundled players
      for (const item of analysis.existingBundled) {
        try {
          const playerName = `${this.getFirstName(item.player)} ${this.getLastName(item.player)}`;
          console.log(`[RosterDatabaseService] Processing bundled player: ${playerName}, internalId: ${item.existingPlayerId}`);
          if (item.yearAlreadyHasRatings && !overwriteExistingSeasons) {
            console.log(`[RosterDatabaseService] Skipping ${playerName} - year already has ratings and overwrite=false`);
            result.skipped++;
            continue;
          }
          await this.updateBundledPlayer(item, analysis.seasonYear, resolutionMap, fillEmptyBioFields, pushMode, bioFields);
          console.log(`[RosterDatabaseService] Successfully updated bundled player: ${playerName} (id=${item.existingPlayerId}) for year ${analysis.seasonYear}`);
          result.updated++;
        } catch (error) {
          const name = `${this.getFirstName(item.player)} ${this.getLastName(item.player)}`;
          result.errors.push(`Failed to update ${name}: ${error}`);
        }
      }

      // Process existing custom players
      for (const item of analysis.existingCustom) {
        try {
          if (item.yearAlreadyHasRatings && !overwriteExistingSeasons) {
            result.skipped++;
            continue;
          }
          await this.updateCustomPlayer(item, analysis.seasonYear, resolutionMap, fillEmptyBioFields, pushMode, bioFields);
          result.updated++;
        } catch (error) {
          const name = `${this.getFirstName(item.player)} ${this.getLastName(item.player)}`;
          result.errors.push(`Failed to update ${name}: ${error}`);
        }
      }

    } catch (error) {
      result.success = false;
      result.errors.push(`Push failed: ${error}`);
    }

    console.log(`[RosterDatabaseService] Push complete: ${result.created} created, ${result.updated} updated, ${result.skipped} skipped, ${result.errors.length} errors`);
    console.log(`[RosterDatabaseService] ========== DEBUG LOG WRITTEN TO: ${LOG_FILE} ==========`);

    writeDebugLog(`\n========== PUSH COMPLETE ==========`);
    writeDebugLog(`Created: ${result.created}, Updated: ${result.updated}, Skipped: ${result.skipped}, Errors: ${result.errors.length}`);
    writeDebugLog(`DEBUG LOG FILE: ${LOG_FILE}`);

    return result;
  }

  /**
   * Create a new custom player from roster data
   * NOTE: Roster push does NOT set draft class - only draft class editor should set that.
   * We calculate career bounds from years pro (PYRP) if available.
   */
  private async createNewPlayer(
    item: PlayerAnalysis,
    seasonYear: number,
    bioFields: Record<string, boolean>
  ): Promise<void> {
    const player = item.player;

    // Validate name before creating - skip players with invalid names
    const firstName = this.getFirstName(player);
    const lastName = this.getLastName(player);
    const invalidNames = ['', '.', '0', ' '];

    if (invalidNames.includes(firstName) || invalidNames.includes(lastName) ||
        firstName.length === 0 || lastName.length === 0) {
      console.log(`[RosterDatabaseService] Skipping player with invalid name: "${firstName}" "${lastName}"`);
      return;
    }

    // Get position name
    const positionId = player.PPOS;
    const positionName = this.getPositionName(positionId) || 'FA';

    // Helper to get field value with fallbacks (try multiple field names)
    const getFieldValue = (fieldNames: string[]): any => {
      for (const name of fieldNames) {
        if (player[name] !== undefined) return player[name];
      }
      return undefined;
    };

    // Get height/weight/homeState/hometown with possible fallbacks
    const heightVal = getFieldValue(['PHGT', 'height', 'heightInches', 'HGT']);
    const weightVal = getFieldValue(['PWGT', 'weight', 'WGT']);
    const homeStateIdVal = getFieldValue(['PHSN', 'HSN']);  // Numeric state ID
    const hometownVal = getFieldValue(['PHTN', 'hometown', 'HTN']);
    const collegeVal = getFieldValue(['PCOL', 'college', 'collegeId', 'COL']);

    // Convert state ID to state name (PHSN is a numeric ID like 0=Alabama, 1=Alaska, etc.)
    let homeStateName: string | undefined = undefined;
    if (typeof homeStateIdVal === 'number') {
      homeStateName = lookupService.getDisplayName('state_lookup.csv', homeStateIdVal);
      if (homeStateName === homeStateIdVal.toString()) {
        // Lookup failed, returned the ID as string - don't use it
        homeStateName = undefined;
      }
    } else if (typeof homeStateIdVal === 'string') {
      // Already a state name
      homeStateName = homeStateIdVal;
    }

    // Get weight (stored with +160 offset in roster if using PWGT)
    const weight = weightVal !== undefined ? (player.PWGT !== undefined ? weightVal + 160 : weightVal) : undefined;

    // Calculate career bounds from years pro if available
    // PYRP = 0 means rookie, PYRP = 5 means 5 years in league
    const yearsPro = player.PYRP || 0;
    const careerFrom = seasonYear - yearsPro;

    console.log(`[RosterDatabaseService] createNewPlayer - ${firstName} ${lastName} bio fields:`);
    console.log(`  - heightVal: ${heightVal}, weightVal: ${weightVal}, homeStateIdVal: ${homeStateIdVal}, homeStateName: ${homeStateName}, hometownVal: ${hometownVal}, collegeVal: ${collegeVal}`);

    // Create the custom player - only include enabled bio fields
    // NOTE: draftClass is intentionally NOT set - roster push only sets season data
    const customPlayer: CustomPlayer = {
      firstName: this.getFirstName(player),
      lastName: this.getLastName(player),
      position: bioFields.position ? positionName : undefined,
      collegeId: bioFields.college ? collegeVal : undefined,
      race: bioFields.race ? (item.derivedRace ?? player.PLRC) : undefined,
      height: bioFields.height ? heightVal : undefined,
      weight: bioFields.weight ? weight : undefined,
      homeState: bioFields.homeState ? homeStateName : undefined,  // Now using the converted state NAME
      hometown: bioFields.homeState && typeof hometownVal === 'string' && hometownVal.trim() ? hometownVal : undefined,
      careerFrom,
      careerTo: undefined,
      maddenPid: bioFields.pid ? (player.PSXP || 0) : undefined,
      maddenPam: bioFields.pam ? player.PEPS : undefined,
      bodyType: bioFields.bodyType ? player.PCBT : undefined,
      handedness: bioFields.handedness ? player.PHAN : undefined,
      has3DModel: bioFields.pid ? ((player.PSXP || 0) > 0) : undefined
    };

    const customPlayerId = userDatabaseService.createCustomPlayer(customPlayer);

    // Create season data with team, jersey, archetype
    await this.saveSeasonData(customPlayerId, seasonYear, player, bioFields);
  }

  /**
   * Update an existing bundled player
   */
  private async updateBundledPlayer(
    item: PlayerAnalysis,
    seasonYear: number,
    resolutionMap: Map<string, boolean>,
    fillEmptyBioFields: boolean,
    pushMode: 'all' | 'ratings',
    bioFields: Record<string, boolean>
  ): Promise<void> {
    const player = item.player;
    const playerId = item.existingPlayerId!;

    // Only update bio fields if pushMode is 'all'
    if (pushMode === 'all') {
      // Get current player data
      const currentPlayer = lookupService.getPlayerByInternalId(playerId);
      if (!currentPlayer) {
        throw new Error(`Player ${playerId} not found in lookup`);
      }

      // Prepare bio edits
      const bioEdits: any = {};

      // Process conflicts with resolutions
      for (const conflict of item.conflicts || []) {
        const keepCurrent = resolutionMap.get(`${item.playerIndex}_${conflict.field}`) ?? true;
        if (!keepCurrent) {
          bioEdits[conflict.field] = conflict.newValue;
        }
      }

      // DEBUG: Log all bio fields from player object
      console.log(`[RosterDatabaseService] BIO FIELDS DEBUG for ${player.PFNA} ${player.PLNA}:`);
      console.log(`  - PHGT (height): ${player.PHGT} (type: ${typeof player.PHGT})`);
      console.log(`  - PWGT (weight): ${player.PWGT} (type: ${typeof player.PWGT})`);
      console.log(`  - PHSN (homeState): ${player.PHSN} (type: ${typeof player.PHSN})`);
      console.log(`  - PCOL (college): ${player.PCOL} (type: ${typeof player.PCOL})`);
      console.log(`  - PLRC (race): ${player.PLRC} (type: ${typeof player.PLRC})`);
      console.log(`  - PCBT (bodyType): ${player.PCBT} (type: ${typeof player.PCBT})`);
      console.log(`  - PHAN (handedness): ${player.PHAN} (type: ${typeof player.PHAN})`);
      console.log(`  - fillEmptyBioFields: ${fillEmptyBioFields}`);
      console.log(`  - bioFields.height: ${bioFields.height}, bioFields.weight: ${bioFields.weight}, bioFields.homeState: ${bioFields.homeState}`);

      // FILE-BASED DEBUG: Log bio field processing
      writeDebugLog(`\n=== UPDATING BUNDLED PLAYER: ${player.PFNA} ${player.PLNA} (id=${playerId}) ===`);
      writeDebugLog(`fillEmptyBioFields: ${fillEmptyBioFields}`);
      writeDebugLog(`bioFields checkboxes: height=${bioFields.height}, weight=${bioFields.weight}, homeState=${bioFields.homeState}`);
      writeDebugLog(`Roster file values:`);
      writeDebugLog(`  PHGT=${player.PHGT}, PWGT=${player.PWGT}, PHSN=${player.PHSN}, PHTN=${player.PHTN}`);
      writeDebugLog(`Current database values:`);
      writeDebugLog(`  height=${currentPlayer.height}, weight=${currentPlayer.weight}, homeState=${currentPlayer.homeState}, hometown=${(currentPlayer as any).hometown}`);

      // Push bio fields when checkbox is selected
      // If fillEmptyBioFields is true, only fill empty fields
      // If fillEmptyBioFields is false, always push (overwrite)

      // Helper to get field value with fallbacks (try multiple field names)
      const getFieldValue = (fieldNames: string[]): any => {
        for (const name of fieldNames) {
          if (player[name] !== undefined) return player[name];
        }
        return undefined;
      };

      // Get height/weight/homeState with possible fallbacks
      const heightVal = getFieldValue(['PHGT', 'height', 'heightInches', 'HGT']);
      const weightVal = getFieldValue(['PWGT', 'weight', 'WGT']);
      const homeStateIdVal = getFieldValue(['PHSN', 'HSN']);  // Numeric state ID
      const hometownVal = getFieldValue(['PHTN', 'hometown', 'HTN']);
      const collegeIdVal = getFieldValue(['PCOL', 'COL']);  // Numeric college ID

      // Convert state ID to state name (PHSN is a numeric ID like 0=Alabama, 1=Alaska, etc.)
      let homeStateName: string | undefined = undefined;
      if (typeof homeStateIdVal === 'number') {
        homeStateName = lookupService.getDisplayName('state_lookup.csv', homeStateIdVal);
        if (homeStateName === homeStateIdVal.toString()) {
          // Lookup failed, returned the ID as string - don't use it
          homeStateName = undefined;
        }
      } else if (typeof homeStateIdVal === 'string') {
        // Already a state name
        homeStateName = homeStateIdVal;
      }

      console.log(`[RosterDatabaseService] Field lookup results:`);
      console.log(`  - heightVal: ${heightVal}, weightVal: ${weightVal}, homeStateIdVal: ${homeStateIdVal}, homeStateName: ${homeStateName}, hometownVal: ${hometownVal}, collegeIdVal: ${collegeIdVal}`);

      writeDebugLog(`Field lookup results (with fallbacks):`);
      writeDebugLog(`  heightVal=${heightVal}, weightVal=${weightVal}`);
      writeDebugLog(`  homeStateIdVal=${homeStateIdVal} (type: ${typeof homeStateIdVal}) -> homeStateName=${homeStateName}`);
      writeDebugLog(`  hometownVal=${hometownVal} (type: ${typeof hometownVal})`);

      if (bioFields.college && collegeIdVal !== undefined) {
        if (!fillEmptyBioFields || !currentPlayer.college) {
          bioEdits.collegeId = collegeIdVal;
        }
      }
      if (bioFields.homeState && homeStateName !== undefined) {
        if (!fillEmptyBioFields || !currentPlayer.homeState) {
          bioEdits.homeState = homeStateName;  // Now passing the state NAME, not the ID
        }
      }
      // Push hometown (PHTN) - use homeState checkbox since there's no separate hometown checkbox
      // PHTN should be a string (city name), not an ID
      if (bioFields.homeState && hometownVal !== undefined) {
        if (!fillEmptyBioFields || !(currentPlayer as any).hometown) {
          // Only use string values for hometown
          if (typeof hometownVal === 'string' && hometownVal.trim()) {
            bioEdits.hometown = hometownVal;
          }
        }
      }
      if (bioFields.height && heightVal !== undefined) {
        if (!fillEmptyBioFields || !currentPlayer.height) {
          bioEdits.height = heightVal;
        }
      }
      if (bioFields.weight && weightVal !== undefined) {
        if (!fillEmptyBioFields || !currentPlayer.weight) {
          // Only add 160 offset if using PWGT (stored format)
          const actualWeight = player.PWGT !== undefined ? weightVal + 160 : weightVal;
          bioEdits.weight = actualWeight;
        }
      }
      if (bioFields.race && (player.PLRC !== undefined || item.derivedRace !== undefined)) {
        if (!fillEmptyBioFields || !currentPlayer.race) {
          bioEdits.race = item.derivedRace ?? player.PLRC;
        }
      }

      // Always save body type and handedness when checkbox is selected
      if (bioFields.bodyType && player.PCBT !== undefined) {
        bioEdits.bodyType = player.PCBT;
      }
      if (bioFields.handedness && player.PHAN !== undefined) {
        bioEdits.handedness = player.PHAN;
      }
      // Save position when checkbox is selected
      if (bioFields.position && player.PPOS !== undefined) {
        const positionName = this.getPositionName(player.PPOS);
        if (positionName) {
          bioEdits.position = positionName;
          console.log(`[RosterDatabaseService] Saving position: PPOS=${player.PPOS} -> "${positionName}"`);
        }
      }

      // FILE-BASED DEBUG: Log decision logic for each bio field
      writeDebugLog(`\nBio field decision logic:`);
      writeDebugLog(`  HEIGHT: checkbox=${bioFields.height}, rosterVal=${heightVal}, dbHasValue=${!!currentPlayer.height}`);
      writeDebugLog(`    -> willPush=${bioFields.height && heightVal !== undefined && (!fillEmptyBioFields || !currentPlayer.height)}`);
      writeDebugLog(`  WEIGHT: checkbox=${bioFields.weight}, rosterVal=${weightVal}, dbHasValue=${!!currentPlayer.weight}`);
      writeDebugLog(`    -> willPush=${bioFields.weight && weightVal !== undefined && (!fillEmptyBioFields || !currentPlayer.weight)}`);
      writeDebugLog(`  HOMESTATE: checkbox=${bioFields.homeState}, rosterIdVal=${homeStateIdVal}, convertedName=${homeStateName}, dbHasValue=${!!currentPlayer.homeState}`);
      writeDebugLog(`    -> willPush=${bioFields.homeState && homeStateName !== undefined && (!fillEmptyBioFields || !currentPlayer.homeState)}`);
      writeDebugLog(`  HOMETOWN: checkbox=${bioFields.homeState}, rosterVal=${hometownVal}, dbHasValue=${!!(currentPlayer as any).hometown}`);
      writeDebugLog(`    -> willPush=${bioFields.homeState && hometownVal !== undefined && (!fillEmptyBioFields || !(currentPlayer as any).hometown)}`);

      // Log what we're saving
      console.log(`[RosterDatabaseService] updateBundledPlayer - bioEdits:`, bioEdits);
      writeDebugLog(`\nFINAL bioEdits to save: ${JSON.stringify(bioEdits)}`);

      // Save bio edits if any
      if (Object.keys(bioEdits).length > 0) {
        writeDebugLog(`Saving ${Object.keys(bioEdits).length} bio edits for player ${playerId}`);
        userDatabaseService.savePlayerEdit(playerId, bioEdits);
      } else {
        writeDebugLog(`NO bio edits to save for player ${playerId}`);
      }

      // Save PID and PAM to appearance_edits table (separate from player_edits)
      if (bioFields.pid || bioFields.pam) {
        const appearanceEdits: any = {};
        if (bioFields.pid && player.PSXP !== undefined) {
          appearanceEdits.maddenPid = player.PSXP;
        }
        if (bioFields.pam && player.PEPS !== undefined) {
          appearanceEdits.maddenPam = player.PEPS;
        }
        if (Object.keys(appearanceEdits).length > 0) {
          console.log(`[RosterDatabaseService] updateBundledPlayer - saving appearance edits:`, appearanceEdits);
          userDatabaseService.saveAppearanceEdit(playerId, appearanceEdits);
        }
      }
    }

    // Save season data with ratings, team, jersey, archetype
    // DEBUG: Log player object before saving
    const playerKeys = Object.keys(player);
    const ratingKeysFound = playerKeys.filter(k => k.length === 4 && (k.startsWith('P') || k.startsWith('S')));
    console.log(`[RosterDatabaseService] updateBundledPlayer - about to save for ${player.PFNA || player.firstName} ${player.PLNA || player.lastName}`);
    console.log(`[RosterDatabaseService] updateBundledPlayer - Player total keys: ${playerKeys.length}, Rating-like keys found (${ratingKeysFound.length}): ${ratingKeysFound.join(', ')}`);
    console.log(`[RosterDatabaseService] updateBundledPlayer - Sample: POVR=${player.POVR}, PSPD=${player.PSPD}, PBKT=${player.PBKT}, PLTR=${player.PLTR}, PLMC=${player.PLMC}`);

    await this.saveSeasonEditData(playerId, seasonYear, player, pushMode, bioFields);
  }

  /**
   * Update an existing custom player
   */
  private async updateCustomPlayer(
    item: PlayerAnalysis,
    seasonYear: number,
    resolutionMap: Map<string, boolean>,
    fillEmptyBioFields: boolean,
    pushMode: 'all' | 'ratings',
    bioFields: Record<string, boolean>
  ): Promise<void> {
    const player = item.player;
    const customPlayerId = item.existingPlayerId!;

    // Only update bio fields if pushMode is 'all'
    if (pushMode === 'all') {
      const currentPlayer = userDatabaseService.getCustomPlayer(customPlayerId);
      if (!currentPlayer) {
        throw new Error(`Custom player ${customPlayerId} not found`);
      }

      // Prepare bio updates
      const bioUpdates: Partial<CustomPlayer> = {};

      // Process conflicts with resolutions
      for (const conflict of item.conflicts || []) {
        const keepCurrent = resolutionMap.get(`${item.playerIndex}_${conflict.field}`) ?? true;
        if (!keepCurrent) {
          (bioUpdates as any)[conflict.field] = conflict.newValue;
        }
      }

      // Push bio fields when checkbox is selected
      // If fillEmptyBioFields is true, only fill empty fields
      // If fillEmptyBioFields is false, always push (overwrite)

      // Helper to get field value with fallbacks (try multiple field names)
      const getFieldValue = (fieldNames: string[]): any => {
        for (const name of fieldNames) {
          if (player[name] !== undefined) return player[name];
        }
        return undefined;
      };

      // Get height/weight/homeState/hometown with possible fallbacks
      const heightVal = getFieldValue(['PHGT', 'height', 'heightInches', 'HGT']);
      const weightVal = getFieldValue(['PWGT', 'weight', 'WGT']);
      const homeStateIdVal = getFieldValue(['PHSN', 'HSN']);  // Numeric state ID
      const hometownVal = getFieldValue(['PHTN', 'hometown', 'HTN']);
      const collegeVal = getFieldValue(['PCOL', 'college', 'collegeId', 'COL']);

      // Convert state ID to state name (PHSN is a numeric ID like 0=Alabama, 1=Alaska, etc.)
      let homeStateName: string | undefined = undefined;
      if (typeof homeStateIdVal === 'number') {
        homeStateName = lookupService.getDisplayName('state_lookup.csv', homeStateIdVal);
        if (homeStateName === homeStateIdVal.toString()) {
          // Lookup failed, returned the ID as string - don't use it
          homeStateName = undefined;
        }
      } else if (typeof homeStateIdVal === 'string') {
        // Already a state name
        homeStateName = homeStateIdVal;
      }

      console.log(`[RosterDatabaseService] updateCustomPlayer - Field lookup results:`);
      console.log(`  - heightVal: ${heightVal}, weightVal: ${weightVal}, homeStateIdVal: ${homeStateIdVal}, homeStateName: ${homeStateName}, hometownVal: ${hometownVal}, collegeVal: ${collegeVal}`);

      if (bioFields.college && collegeVal !== undefined) {
        if (!fillEmptyBioFields || !currentPlayer.collegeId) {
          bioUpdates.collegeId = collegeVal;
        }
      }
      if (bioFields.homeState && homeStateName !== undefined) {
        if (!fillEmptyBioFields || !currentPlayer.homeState) {
          bioUpdates.homeState = homeStateName;  // Now using the converted state NAME
        }
      }
      // Push hometown (PHTN) - use homeState checkbox since there's no separate hometown checkbox
      // PHTN should be a string (city name), not an ID
      if (bioFields.homeState && hometownVal !== undefined) {
        if (!fillEmptyBioFields || !currentPlayer.hometown) {
          // Only use string values for hometown
          if (typeof hometownVal === 'string' && hometownVal.trim()) {
            bioUpdates.hometown = hometownVal;
          }
        }
      }
      if (bioFields.height && heightVal !== undefined) {
        if (!fillEmptyBioFields || !currentPlayer.height) {
          bioUpdates.height = heightVal;
        }
      }
      if (bioFields.weight && weightVal !== undefined) {
        if (!fillEmptyBioFields || !currentPlayer.weight) {
          // Only add 160 offset if using PWGT (stored format)
          const actualWeight = player.PWGT !== undefined ? weightVal + 160 : weightVal;
          bioUpdates.weight = actualWeight;
        }
      }
      if (bioFields.race && (player.PLRC !== undefined || item.derivedRace !== undefined)) {
        if (!fillEmptyBioFields || !currentPlayer.race) {
          bioUpdates.race = item.derivedRace ?? player.PLRC;
        }
      }
      // Also push bodyType and handedness for custom players
      if (bioFields.bodyType && player.PCBT !== undefined) {
        if (!fillEmptyBioFields || !currentPlayer.bodyType) {
          bioUpdates.bodyType = player.PCBT;
        }
      }
      if (bioFields.handedness && player.PHAN !== undefined) {
        if (!fillEmptyBioFields || !currentPlayer.handedness) {
          bioUpdates.handedness = player.PHAN;
        }
      }
      // Push position for custom players
      if (bioFields.position && player.PPOS !== undefined) {
        const positionName = this.getPositionName(player.PPOS);
        if (positionName && (!fillEmptyBioFields || !currentPlayer.position)) {
          bioUpdates.position = positionName;
          console.log(`[RosterDatabaseService] Custom player: Saving position: PPOS=${player.PPOS} -> "${positionName}"`);
        }
      }
      // Push PID and PAM for custom players
      if (bioFields.pid && player.PSXP !== undefined) {
        if (!fillEmptyBioFields || !currentPlayer.maddenPid) {
          bioUpdates.maddenPid = player.PSXP;
        }
      }
      if (bioFields.pam && player.PEPS !== undefined) {
        if (!fillEmptyBioFields || !currentPlayer.maddenPam) {
          bioUpdates.maddenPam = player.PEPS;
        }
      }

      // Save bio updates if any
      if (Object.keys(bioUpdates).length > 0) {
        console.log(`[RosterDatabaseService] updateCustomPlayer - bioUpdates:`, bioUpdates);
        userDatabaseService.updateCustomPlayer(customPlayerId, bioUpdates);
      }
    }

    // Save season data
    await this.saveSeasonDataForCustom(customPlayerId, seasonYear, player, pushMode, bioFields);
  }

  /**
   * Save season data for a custom player (includes team, jersey, archetype)
   */
  private async saveSeasonData(
    customPlayerId: number,
    year: number,
    player: any,
    bioFields: Record<string, boolean>
  ): Promise<void> {
    // Archetype - PLTY is what franchise reads!
    const archetype = player.PLTY ?? player.ARCHETYPE ?? player.archetype;

    const season: Partial<CustomPlayerSeason> = {
      year,
      team: bioFields.team ? this.getTeamAbbrForYear(player.TGID, year) : undefined,
      jersey: bioFields.jersey ? player.PJEN : undefined,
      age: player.PAGE,
      position: bioFields.position ? (this.getPositionName(player.PPOS) || undefined) : undefined,
      archetype: bioFields.archetype ? archetype : undefined
    };

    // Always extract ratings (that's the main purpose)
    this.extractRatingsToSeason(player, season);

    // Log for debugging
    console.log(`[RosterDatabaseService] Saving season for custom player ${customPlayerId}, year ${year}:`);
    console.log(`  - Team: ${season.team}, Jersey: ${season.jersey}, Position: ${season.position}`);
    console.log(`  - Archetype: ${archetype} (PLTY=${player.PLTY}, ARCHETYPE=${player.ARCHETYPE})`);
    console.log(`  - Sample ratings: POVR=${player.POVR}, PSPD=${player.PSPD}, PACC=${player.PACC}`);

    userDatabaseService.saveCustomPlayerSeason(customPlayerId, year, season);
  }

  /**
   * Save season data for a custom player (update)
   */
  private async saveSeasonDataForCustom(
    customPlayerId: number,
    year: number,
    player: any,
    pushMode: 'all' | 'ratings',
    bioFields: Record<string, boolean>
  ): Promise<void> {
    // Archetype - PLTY is what franchise reads!
    const archetype = player.PLTY ?? player.ARCHETYPE ?? player.archetype;

    const season: Partial<CustomPlayerSeason> = {
      year
    };

    // Only include bio fields if pushMode is 'all' and field is enabled
    if (pushMode === 'all') {
      if (bioFields.team) season.team = this.getTeamAbbrForYear(player.TGID, year);
      if (bioFields.jersey) season.jersey = player.PJEN;
      if (bioFields.position) season.position = this.getPositionName(player.PPOS) || undefined;
      if (bioFields.archetype) season.archetype = archetype;
    }
    season.age = player.PAGE; // Age is always relevant

    // Always extract ratings (that's the main purpose)
    this.extractRatingsToSeason(player, season);

    // Log for debugging
    console.log(`[RosterDatabaseService] Updating season for custom player ${customPlayerId}, year ${year} (mode: ${pushMode}):`);
    console.log(`  - Team: ${season.team}, Jersey: ${season.jersey}, Position: ${season.position}`);
    console.log(`  - Archetype: ${season.archetype}, Sample ratings: POVR=${player.POVR}`);

    userDatabaseService.saveCustomPlayerSeason(customPlayerId, year, season);
  }

  /**
   * Save season edit data for a bundled player
   */
  private async saveSeasonEditData(
    playerId: number,
    year: number,
    player: any,
    pushMode: 'all' | 'ratings',
    bioFields: Record<string, boolean>
  ): Promise<void> {
    // Archetype - PLTY is what franchise reads!
    const archetype = player.PLTY ?? player.ARCHETYPE ?? player.archetype;
    const position = this.getPositionName(player.PPOS) || 'HB';

    const seasonEdits: any = {};

    // Only include bio fields if pushMode is 'all' and field is enabled
    if (pushMode === 'all') {
      if (bioFields.team) seasonEdits.team = this.getTeamAbbrForYear(player.TGID, year);
      if (bioFields.jersey) seasonEdits.jersey = player.PJEN;
      if (bioFields.position) seasonEdits.position = position;
      if (bioFields.archetype) seasonEdits.archetype = archetype;
    }
    seasonEdits.age = player.PAGE; // Age is always relevant

    // Always extract ratings (that's the main purpose)
    // IMPORTANT: Convert roster field names to database field names
    // The database uses different 4-character codes for some attributes
    let ratingCount = 0;
    const mappedRatings: string[] = [];
    const missingRatings: string[] = [];
    for (const rosterField of ROSTER_RATING_FIELDS) {
      if (player[rosterField] !== undefined && player[rosterField] !== null) {
        // Map roster field name to database field name
        const dbField = ROSTER_TO_DB_FIELD_MAP[rosterField] || rosterField;
        seasonEdits[dbField] = player[rosterField];
        mappedRatings.push(`${rosterField}->${dbField}=${player[rosterField]}`);
        ratingCount++;
      } else {
        missingRatings.push(rosterField);
      }
    }

    // CRITICAL: Recalculate OVR using the same formula used everywhere
    // This ensures database OVR matches what roster generator calculates
    const originalPOVR = player.POVR;
    if (ovrWeightsCalculator.isInitialized() && ratingCount > 10) {
      // Build attributes object using ROSTER field names (what calculator expects)
      const attributes: Record<string, number> = {
        PSPD: player.PSPD || 50,
        PACC: player.PACC || 50,
        PAGI: player.PAGI || 50,
        PSTR: player.PSTR || 50,
        PAWR: player.PAWR || 50,
        PCAR: player.PCAR || 50,
        PBCV: player.PBCV || 50,
        PBKT: player.PBKT || 50,
        PLTR: player.PLTR || 50,
        PLSA: player.PLSA || 50,
        PLSM: player.PLSM || 50,
        PLJM: player.PLJM || 50,
        PCTH: player.PCTH || 50,
        PLCI: player.PLCI || 50,
        PLSC: player.PLSC || 50,
        PELU: player.PELU || 50,
        PJMP: player.PJMP || 50,
        PSTA: player.PSTA || 50,
        PTGH: player.PTGH || 50,
        PINJ: player.PINJ || 50,
        SRRN: player.SRRN || 50,
        PMRR: player.PMRR || 50,
        PDRR: player.PDRR || 50,
        PTHP: player.PTHP || 50,
        PTAS: player.PTAS || 50,
        PTAM: player.PTAM || 50,
        PTAD: player.PTAD || 50,
        PTOR: player.PTOR || 50,
        PTUP: player.PTUP || 50,
        PPLA: player.PPLA || 50,
        PBSK: player.PBSK || 50,
        PBSG: player.PBSG || 50,
        PLPM: player.PLPM || 50,
        PFMS: player.PFMS || 50,
        PTAK: player.PTAK || 50,
        PLHT: player.PLHT || 50,
        PLPU: player.PLPU || 50,
        PLPR: player.PLPR || 50,
        PLMC: player.PLMC || 50,
        PLZC: player.PLZC || 50,
        PLPE: player.PLPE || 50,
        PPBK: player.PPBK || 50,
        PPBS: player.PPBS || 50,
        PPBF: player.PPBF || 50,
        PRBK: player.PRBK || 50,
        PRBS: player.PRBS || 50,
        PRBF: player.PRBF || 50,
        PLIB: player.PLIB || 50,
        PLBK: player.PLBK || 50,
        PKPR: player.PKPR || 50,  // Kick power - M26 roster code
        PKAC: player.PKAC || 50,
        PLRL: player.PLRL || 50,
        PKRT: player.PKRT || 50,
      };

      const calculatedOVR = ovrWeightsCalculator.calculateOVR(attributes, position, archetype);
      seasonEdits.POVR = calculatedOVR;
      console.log(`[RosterDatabaseService] Recalculated OVR: original=${originalPOVR}, calculated=${calculatedOVR} (position=${position}, archetype=${archetype})`);
    } else {
      // Fallback to original POVR if calculator not ready
      seasonEdits.POVR = originalPOVR;
      console.log(`[RosterDatabaseService] Using original POVR=${originalPOVR} (calculator not ready or insufficient ratings)`);
    }

    // Log for debugging - VERBOSE to track down push issue
    console.log(`[RosterDatabaseService] Saving season edit for bundled player ${playerId}, year ${year} (mode: ${pushMode}):`);
    console.log(`  - Player object keys (${Object.keys(player).length} total): ${Object.keys(player).slice(0, 40).join(', ')}...`);
    console.log(`  - Team: ${seasonEdits.team}, Jersey: ${seasonEdits.jersey}, Position: ${seasonEdits.position}`);
    console.log(`  - Archetype: ${seasonEdits.archetype}`);
    console.log(`  - Ratings FOUND: ${ratingCount}/${ROSTER_RATING_FIELDS.length}`);
    console.log(`  - MISSING ratings from player object: ${missingRatings.join(', ') || 'NONE'}`);
    console.log(`  - Mapped ratings: ${mappedRatings.slice(0, 10).join(', ')}${mappedRatings.length > 10 ? '...' : ''}`);
    console.log(`  - SeasonEdits rating keys: ${Object.keys(seasonEdits).filter(k => k.startsWith('P') && k.length === 4).join(', ')}`);
    console.log(`  - Final POVR being saved: ${seasonEdits.POVR}`);
    // KICKING DEBUG
    console.log(`  - KICKING DEBUG: player.PKPR=${player.PKPR}, player.PKAC=${player.PKAC}`);
    console.log(`  - KICKING DEBUG: seasonEdits.PKPW=${seasonEdits.PKPW}, seasonEdits.PKAC=${seasonEdits.PKAC}`);

    userDatabaseService.saveSeasonEdit(playerId, year, seasonEdits);

    // CRITICAL: Save archetype at player level (constant across all seasons)
    // This ensures OVR is calculated consistently everywhere
    if (archetype) {
      const archetypeId = typeof player.PLTY === 'number' ? player.PLTY : null;
      userDatabaseService.savePlayerArchetype(playerId, archetype, archetypeId);
      console.log(`[RosterDatabaseService] Saved player-level archetype: playerId=${playerId}, archetype=${archetype}, archetypeId=${archetypeId}`);
    }

    // Verify the save by immediately reading back
    const verifyRead = userDatabaseService.getSeasonEdit(playerId, year);
    if (verifyRead) {
      console.log(`[RosterDatabaseService] VERIFY: Season edit saved successfully for player ${playerId}, year ${year}`);
      console.log(`  - Saved POVR: ${verifyRead.ratings?.POVR}, Team: ${verifyRead.team}, Position: ${verifyRead.position}`);
      console.log(`  - VERIFY KICK: PKPW=${verifyRead.ratings?.PKPW}, PKPR=${verifyRead.ratings?.PKPR}, PKAC=${verifyRead.ratings?.PKAC}`);
    } else {
      console.error(`[RosterDatabaseService] VERIFY FAILED: Could not read back season edit for player ${playerId}, year ${year}`);
    }
  }

  /**
   * Extract ratings from player data to season object
   * Converts roster field names to database field names
   */
  private extractRatingsToSeason(player: any, season: Partial<CustomPlayerSeason>): void {
    for (const rosterField of ROSTER_RATING_FIELDS) {
      if (player[rosterField] !== undefined && player[rosterField] !== null) {
        // Map roster field name to database field name
        const dbField = ROSTER_TO_DB_FIELD_MAP[rosterField] || rosterField;
        (season as any)[dbField] = player[rosterField];
      }
    }
  }
}

export const rosterDatabaseService = new RosterDatabaseService();
