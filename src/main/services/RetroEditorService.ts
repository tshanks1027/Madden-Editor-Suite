/**
 * Retro Editor Service
 *
 * Service layer for franchise file retro editing operations.
 * Enables modifying Madden 26 franchise files for historical NFL seasons.
 *
 * Uses madden-franchise npm package for franchise file parsing/writing.
 * Reference: https://github.com/bep713/madden-franchise
 */

import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { lookupService } from './lookup-service';
import { userDatabaseService } from './UserDatabaseService';

// madden-franchise provides both CJS and ESM builds
// We need to use the named 'create' export for the static factory method
let FranchiseModule: any = null;

async function getFranchiseModule() {
  if (!FranchiseModule) {
    try {
      // Import the module
      const module = await import('madden-franchise');
      console.log('[RetroEditorService] madden-franchise module keys:', Object.keys(module));
      FranchiseModule = module;
    } catch (err) {
      console.error('[RetroEditorService] Failed to import madden-franchise:', err);
      throw err;
    }
  }
  return FranchiseModule;
}

// M26 Table IDs from madden-franchise-utils
const TABLE_IDS = {
  // Core tables
  seasonInfoTable: 3123991521,
  teamTable: 637929298,
  draftPickTable: 2546719563,
  scheduleTable: 1395485428,
  gameTable: 2816609684,

  // Additional useful tables
  // NOTE: Player table ID is 4222 (found via franchise-table-list.txt dump)
  playerTable: 4222,
  coachTable: 1864063867,
  ownerTable: 3429237668,
  stadiumTable: 459799498,
  leagueTable: 1625193857,

  // FA array table - discovered via research (RESEARCH_SUMMARY_FA_VISIBILITY.md)
  // This is the Player[] array that contains ALL free agent player references
  // Referenced by Franchise.FreeAgents and League.FreeAgents
  faArrayTable: 5930,
};

// Empty reference constant - marks unused slots in array tables
const ZERO_REF = '00000000000000000000000000000000';

// SeasonGame field mappings for M26 (when schema is missing)
// Based on schema-output.xml indices:
// idx 8 = AwayTeam, idx 28 = HomeTeam, idx 52 = SeasonWeek, idx 53 = SeasonWeekType
const SEASON_GAME_FIELD_MAPPING = {
  AwayTeam: 'Field_8',
  HomeTeam: 'Field_28',
  SeasonWeek: 'Field_52',
  SeasonWeekType: 'Field_53',
  SeasonYear: 'Field_54',
  SeasonGameNum: 'Field_51',
  GameStatus: 'Field_18',
  Stadium: 'Field_55',
  DayOfWeek: 'Field_13',
};

// SeasonWeekType enum values (from M26 schema)
const SEASON_WEEK_TYPES = {
  PreSeason: 0,
  RegularSeason: 1,
  WildCard: 2,
  Divisional: 3,
  Conference: 4,
  SuperBowl: 5,
  ProBowl: 6,
  PostSeason: 7,
  OffSeason: 8,  // Used for weeks beyond regular season end
};

/**
 * SqlJsWrapper - Provides a better-sqlite3-like API for sql.js
 * This allows using sql.js (pure JS) while maintaining compatibility with existing code
 */
class SqlJsWrapper {
  private db: any;

  constructor(db: any) {
    this.db = db;
  }

  /**
   * Prepare a SQL statement and return a statement object with get() and all() methods
   */
  prepare(sql: string): SqlJsStatement {
    return new SqlJsStatement(this.db, sql);
  }

  /**
   * Close the database
   */
  close(): void {
    this.db.close();
  }
}

/**
 * SqlJsStatement - Wraps a sql.js prepared statement
 */
class SqlJsStatement {
  private db: any;
  private sql: string;

  constructor(db: any, sql: string) {
    this.db = db;
    this.sql = sql;
  }

  /**
   * Execute query and return first result row
   */
  get(...params: any[]): any {
    const stmt = this.db.prepare(this.sql);
    try {
      if (params.length > 0) {
        stmt.bind(params);
      }
      if (stmt.step()) {
        return stmt.getAsObject();
      }
      return null;
    } finally {
      stmt.free();
    }
  }

  /**
   * Execute query and return all result rows
   */
  all(...params: any[]): any[] {
    const stmt = this.db.prepare(this.sql);
    const results: any[] = [];
    try {
      if (params.length > 0) {
        stmt.bind(params);
      }
      while (stmt.step()) {
        results.push(stmt.getAsObject());
      }
      return results;
    } finally {
      stmt.free();
    }
  }
}

/**
 * Get a field value from a record, trying both the named field and the generic Field_X name
 */
function getGameField(record: any, fieldName: keyof typeof SEASON_GAME_FIELD_MAPPING): any {
  // First try the proper field name (works when schema is available)
  const namedValue = record[fieldName];
  if (namedValue !== null && namedValue !== undefined) {
    return namedValue;
  }
  // Fall back to generic field name (when schema is missing)
  const genericName = SEASON_GAME_FIELD_MAPPING[fieldName];
  return record[genericName];
}

/**
 * Set a field value on a record, using both the named field and the generic Field_X name
 *
 * IMPORTANT: For enum fields like SeasonWeekType, the madden-franchise library's
 * getMemberByName() function expects a STRING value, not a number. When you pass
 * a number like 8, the library does name.toLowerCase() which fails.
 *
 * Solution: ALWAYS pass STRING values for enum fields. The library will look up
 * the enum member by name and convert to the correct binary representation.
 */
function setGameField(record: any, fieldName: keyof typeof SEASON_GAME_FIELD_MAPPING, value: any): void {
  const genericName = SEASON_GAME_FIELD_MAPPING[fieldName];

  // For SeasonWeekType, we need special handling due to madden-franchise library quirks
  // The library's getMemberByName() crashes when passed a number (it calls .toLowerCase() on it)
  if (fieldName === 'SeasonWeekType') {
    const weekTypeReverseMap: Record<number, string> = {
      0: 'PreSeason',
      1: 'RegularSeason',
      2: 'WildCard',
      3: 'Divisional',
      4: 'Conference',
      5: 'SuperBowl',
      6: 'ProBowl',
      7: 'PostSeason',
      8: 'OffSeason',
    };

    // Convert numeric value to string if needed
    let stringValue: string;
    if (typeof value === 'number') {
      stringValue = weekTypeReverseMap[value] || 'PreSeason';
    } else if (typeof value === 'string') {
      stringValue = value;
    } else {
      stringValue = 'PreSeason';
    }

    console.log(`[setGameField] Setting SeasonWeekType: input=${value} (${typeof value}), stringValue="${stringValue}"`);

    // Try multiple approaches in order of preference:
    let success = false;

    // Approach 1: Try setting the NAMED field with string value
    if (!success) {
      try {
        if (record[fieldName] !== undefined) {
          console.log(`[setGameField] Approach 1: Setting ${fieldName} = "${stringValue}"`);
          record[fieldName] = stringValue;
          console.log(`[setGameField] Approach 1 SUCCESS: ${fieldName} set to "${stringValue}"`);
          success = true;
        }
      } catch (err: any) {
        console.log(`[setGameField] Approach 1 FAILED: ${err.message}`);
      }
    }

    // Approach 2: Try setting the GENERIC field with string value
    if (!success) {
      try {
        if (record[genericName] !== undefined) {
          console.log(`[setGameField] Approach 2: Setting ${genericName} = "${stringValue}"`);
          record[genericName] = stringValue;
          console.log(`[setGameField] Approach 2 SUCCESS: ${genericName} set to "${stringValue}"`);
          success = true;
        }
      } catch (err: any) {
        console.log(`[setGameField] Approach 2 FAILED: ${err.message}`);
      }
    }

    // Approach 3: Just skip it - the schedule might still work without OffSeason marking
    if (!success) {
      console.warn(`[setGameField] All approaches failed for SeasonWeekType - skipping (schedule may have extra games)`);
    }

    return;
  }

  // For other fields, set both named and generic
  if (record[fieldName] !== undefined) {
    record[fieldName] = value;
  }
  if (record[genericName] !== undefined) {
    record[genericName] = value;
  }
}

// Types for historical data
interface TeamChange {
  yearRange: [number, number];
  city: string | null;
  name: string | null;
  abbreviation: string | null;
  inactive?: boolean;
  note?: string;
}

interface HistoricalTeam {
  teamIndex: number;
  currentName: string;
  currentCity: string;
  currentAbbreviation?: string;
  changes: TeamChange[];
  expansionYear?: number;
  note?: string;
}

interface ExpansionTeam {
  team: string;
  teamIndex: number;
  year: number;
  note: string;
}

interface SpecialCase {
  note: string;
  inactiveYears: number[];
  teamIndex: number;
}

interface ExpansionEventTeam {
  teamIndex: number;
  name: string;
}

interface ExpansionEventRules {
  playersPerTeam?: number;
  protectedPerTeam?: number;
  rounds?: number;
  selectionOrder?: string;
  maxFromSameTeam?: number | string;
  playerTransfer?: string;
  description: string;
}

interface ExpansionProtectionRules {
  maxProtected: number;
  positionLimits: Record<string, number> | null;
}

interface ExpansionEvent {
  id: string;
  type: 'expansion' | 'relocation';
  year: number;
  name: string;
  description: string;
  teams?: ExpansionEventTeam[];
  sourceTeam?: ExpansionEventTeam;
  destinationTeam?: ExpansionEventTeam;
  rules: ExpansionEventRules;
  protectionRules?: ExpansionProtectionRules;
  inactiveTeam?: {
    teamIndex: number;
    inactiveYears: number[];
    reason: string;
  };
}

interface PlayerForDraft {
  recordIndex: number;
  firstName: string;
  lastName: string;
  position: string;
  overall: number;
  age: number;
  teamIndex: number;
  teamName: string;
  isProtected: boolean;
  // Contract info
  contractYearsLeft: number;
  contractSalary: number;
  capHit: number;
}

interface ExpansionDraftSelection {
  playerRecordIndex: number;
  newTeamIndex: number;
}

interface FranchiseMetadata {
  filePath: string;
  gameYear: string;
  currentSeasonYear: number;
  superBowlNumber: number;
  teamCount: number;
  valid: boolean;
  error?: string;
}

interface TeamNameChange {
  teamIndex: number;
  originalCity: string;
  originalName: string;
  newCity: string;
  newName: string;
  newAbbreviation: string;
}

interface PreviewChanges {
  seasonChanges: {
    currentYear: number;
    newYear: number;
    currentSuperBowl: number;
    newSuperBowl: number;
  };
  teamChanges: TeamNameChange[];
  draftChanges: {
    inactiveTeams: string[];
    picksToReorder: number;
  };
}

/**
 * Retro Editor Service
 * Provides methods for modifying franchise files for historical seasons
 */
export class RetroEditorService {
  private franchiseInstances: Map<string, any> = new Map();
  private historicalTeams: HistoricalTeam[] = [];
  private superBowlMapping: Record<string, number> = {};
  private expansionHistory: ExpansionTeam[] = [];
  private specialCases: Record<string, SpecialCase> = {};
  private expansionEvents: ExpansionEvent[] = [];
  private draftPickCompensation: Record<string, any> = {};
  private dataLoaded = false;

  constructor() {
    this.loadHistoricalData();
  }

  /**
   * Normalize file path for consistent Map key usage on Windows
   * Converts to lowercase and uses forward slashes
   */
  private normalizePath(filePath: string): string {
    // Normalize: forward slashes, lowercase for Windows case-insensitivity
    return path.normalize(filePath).replace(/\\/g, '/').toLowerCase();
  }

  /**
   * Get franchise instance with normalized path lookup
   */
  private getFranchise(filePath: string): any {
    const normalizedPath = this.normalizePath(filePath);
    const franchise = this.franchiseInstances.get(normalizedPath);
    if (!franchise) {
      console.error(`[RetroEditorService] No franchise instance for path: ${filePath}`);
      console.error(`[RetroEditorService] Normalized path: ${normalizedPath}`);
      console.error(`[RetroEditorService] Available keys:`, Array.from(this.franchiseInstances.keys()));
    }
    return franchise;
  }

  /**
   * Store franchise instance with normalized path key
   */
  private setFranchise(filePath: string, franchise: any): void {
    const normalizedPath = this.normalizePath(filePath);
    console.log(`[RetroEditorService] Storing franchise with key: ${normalizedPath}`);
    this.franchiseInstances.set(normalizedPath, franchise);
  }

  /**
   * Delete franchise instance with normalized path key
   */
  private deleteFranchise(filePath: string): void {
    const normalizedPath = this.normalizePath(filePath);
    this.franchiseInstances.delete(normalizedPath);
  }

  /**
   * Load historical data JSON files
   */
  private loadHistoricalData(): void {
    try {
      const appPath = app.getAppPath();
      // Use same pattern as lookup-service: app.getAppPath()/data/retro
      // In dev mode with Vite, appPath is .vite/build so files are at .vite/build/data/retro
      // In packaged mode, appPath is the asar so files are at app.asar/data/retro
      const dataPath = path.join(appPath, 'data', 'retro');
      console.log('[RetroEditorService] Loading historical data from:', dataPath);

      // Load historical teams
      const teamsPath = path.join(dataPath, 'historical-teams.json');
      if (fs.existsSync(teamsPath)) {
        const teamsData = JSON.parse(fs.readFileSync(teamsPath, 'utf-8'));
        this.historicalTeams = teamsData.teams;
        console.log('[RetroEditorService] Loaded historical teams:', this.historicalTeams.length);
      }

      // Load Super Bowl mapping
      const superBowlPath = path.join(dataPath, 'super-bowl-mapping.json');
      if (fs.existsSync(superBowlPath)) {
        const sbData = JSON.parse(fs.readFileSync(superBowlPath, 'utf-8'));
        this.superBowlMapping = sbData.mapping;
        console.log('[RetroEditorService] Loaded Super Bowl mappings:', Object.keys(this.superBowlMapping).length);
      }

      // Load expansion history
      const expansionPath = path.join(dataPath, 'expansion-history.json');
      if (fs.existsSync(expansionPath)) {
        const expData = JSON.parse(fs.readFileSync(expansionPath, 'utf-8'));
        this.expansionHistory = expData.expansions || [];
        this.specialCases = expData.specialCases || {};
        console.log('[RetroEditorService] Loaded expansion history:', this.expansionHistory.length, 'teams');
      }

      // Load expansion events (detailed draft/relocation rules)
      const eventsPath = path.join(dataPath, 'expansion-events.json');
      console.log('[RetroEditorService] Looking for expansion-events.json at:', eventsPath);
      console.log('[RetroEditorService] File exists:', fs.existsSync(eventsPath));
      if (fs.existsSync(eventsPath)) {
        const eventsData = JSON.parse(fs.readFileSync(eventsPath, 'utf-8'));
        this.expansionEvents = eventsData.events || [];
        this.draftPickCompensation = eventsData.draftPickCompensation || {};
        console.log('[RetroEditorService] Loaded expansion events:', this.expansionEvents.length);
        console.log('[RetroEditorService] Loaded draft pick compensation for years:', Object.keys(this.draftPickCompensation).filter(k => k !== 'description').join(', '));
        console.log('[RetroEditorService] Event years:', this.expansionEvents.map(e => `${e.year}:${e.type}`).join(', '));
      } else {
        console.log('[RetroEditorService] expansion-events.json NOT FOUND - expansion features will not work');
      }

      this.dataLoaded = true;
    } catch (error) {
      console.error('[RetroEditorService] Error loading historical data:', error);
    }
  }

  /**
   * Get list of available years (1966-2025)
   */
  getAvailableYears(): number[] {
    const years: number[] = [];
    for (let year = 1966; year <= 2025; year++) {
      years.push(year);
    }
    return years;
  }

  /**
   * Get expansion/relocation event for a specific year
   * Returns null if no event for that year
   */
  getExpansionEventForYear(year: number): ExpansionEvent | null {
    console.log(`[RetroEditorService] getExpansionEventForYear(${year}) - total events loaded: ${this.expansionEvents.length}`);
    const event = this.expansionEvents.find(e => e.year === year);
    if (event) {
      console.log(`[RetroEditorService] Found expansion event for ${year}: ${event.name} (${event.type})`);
    } else {
      console.log(`[RetroEditorService] No expansion event found for ${year}`);
      if (this.expansionEvents.length > 0) {
        console.log(`[RetroEditorService] Available years: ${this.expansionEvents.map(e => e.year).join(', ')}`);
      }
    }
    return event || null;
  }

  /**
   * Get all expansion events
   */
  getAllExpansionEvents(): ExpansionEvent[] {
    return this.expansionEvents;
  }

  /**
   * Move a single player to a new team
   * Used for relocations and expansion drafts
   */
  async movePlayerToTeam(
    filePath: string,
    playerRecordIndex: number,
    newTeamIndex: number
  ): Promise<{ success: boolean; playerName?: string; error?: string }> {
    try {
      const franchise = this.getFranchise(filePath);
      if (!franchise) {
        throw new Error('Franchise file not loaded');
      }

      // Get player table - try by name first, then by ID
      let playerTable = franchise.getTableByName('Player');
      if (!playerTable) {
        playerTable = franchise.getTableByUniqueId(TABLE_IDS.playerTable);
      }
      if (!playerTable) {
        throw new Error('Player table not found');
      }
      await playerTable.readRecords();

      // Get the player record
      const player = playerTable.records[playerRecordIndex];
      if (!player || player.isEmpty) {
        throw new Error(`Player record ${playerRecordIndex} not found or empty`);
      }

      const playerName = `${player.FirstName || ''} ${player.LastName || ''}`.trim();
      const oldTeamIndex = player.TeamIndex;

      // Update player's team
      player.TeamIndex = newTeamIndex;

      console.log(`[RetroEditorService] Moved player "${playerName}" from team ${oldTeamIndex} to team ${newTeamIndex}`);

      return { success: true, playerName };
    } catch (error: any) {
      console.error('[RetroEditorService] Error moving player:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Remove a player from a team's roster array using MFT shift-pad pattern.
   * Remaining players are shifted down to fill the gap, end is padded with ZERO_REF.
   *
   * @param franchise - The loaded franchise instance
   * @param playerRef - The player's reference string (32-char binary)
   * @param rosterRef - The team's roster reference { tableId, rowNumber }
   * @returns true if player was found and removed, false otherwise
   */
  private async removePlayerFromRoster(
    franchise: any,
    playerRef: string,
    rosterRef: { tableId: number; rowNumber: number }
  ): Promise<boolean> {
    const rosterTable = franchise.getTableById(rosterRef.tableId);
    await rosterTable.readRecords();

    const roster = rosterTable.records[rosterRef.rowNumber];
    if (!roster) {
      console.error('[removePlayerFromRoster] Roster record not found');
      return false;
    }

    // Collect all non-ZERO_REF player refs EXCEPT the one we're removing
    const remainingRefs: string[] = [];
    let foundPlayer = false;

    for (let i = 0; i < roster.arraySize; i++) {
      const ref = roster[`Player${i}`];
      if (ref === playerRef) {
        foundPlayer = true;
        console.log(`[removePlayerFromRoster] Found player at slot ${i}`);
      } else if (ref && ref !== ZERO_REF) {
        remainingRefs.push(ref);
      }
    }

    if (!foundPlayer) {
      console.log('[removePlayerFromRoster] Player ref not found in roster');
      return false;
    }

    // Rebuild roster: remaining players shifted to front, pad end with ZERO_REF
    const totalSlots = roster.arraySize;
    for (let i = 0; i < totalSlots; i++) {
      if (i < remainingRefs.length) {
        roster[`Player${i}`] = remainingRefs[i];
      } else {
        roster[`Player${i}`] = ZERO_REF;
      }
    }

    // Update arraySize
    roster.arraySize = remainingRefs.length;
    rosterTable.arraySizes[rosterRef.rowNumber] = remainingRefs.length;

    // Mark as changed
    roster.isChanged = true;
    roster._parent.onEvent('change', roster);

    console.log(`[removePlayerFromRoster] Removed player, new roster size: ${remainingRefs.length}`);
    return true;
  }

  /**
   * Add a player to a team's roster array.
   * Appends the player ref to the end of the array and increments arraySize.
   *
   * @param franchise - The loaded franchise instance
   * @param playerRef - The player's reference string (32-char binary)
   * @param rosterRef - The team's roster reference { tableId, rowNumber }
   * @returns true if player was added successfully
   */
  private async addPlayerToRoster(
    franchise: any,
    playerRef: string,
    rosterRef: { tableId: number; rowNumber: number }
  ): Promise<boolean> {
    const rosterTable = franchise.getTableById(rosterRef.tableId);
    await rosterTable.readRecords();

    const roster = rosterTable.records[rosterRef.rowNumber];
    if (!roster) {
      console.error('[addPlayerToRoster] Roster record not found');
      return false;
    }

    const currentSize = roster.arraySize;

    // Add player at the next available slot
    roster[`Player${currentSize}`] = playerRef;

    // Increment arraySize
    roster.arraySize = currentSize + 1;
    rosterTable.arraySizes[rosterRef.rowNumber] = currentSize + 1;

    // Mark as changed
    roster.isChanged = true;
    roster._parent.onEvent('change', roster);

    console.log(`[addPlayerToRoster] Added player at slot ${currentSize}, new roster size: ${currentSize + 1}`);
    return true;
  }

  /**
   * Add a player to the Free Agent array (table 5930).
   * This is CRITICAL for FA visibility - players must be in this array to appear in-game.
   *
   * The FA array is referenced by Franchise.FreeAgents and League.FreeAgents.
   * See RESEARCH_SUMMARY_FA_VISIBILITY.md for details.
   *
   * @param franchise - The loaded franchise instance
   * @param playerRef - The player's reference string (32-char binary)
   * @returns true if player was added successfully
   */
  private async addPlayerToFAArray(
    franchise: any,
    playerRef: string
  ): Promise<boolean> {
    try {
      const faArrayTable = franchise.getTableById(TABLE_IDS.faArrayTable);
      if (!faArrayTable) {
        console.error('[addPlayerToFAArray] FA array table not found (id=5930)');
        return false;
      }

      await faArrayTable.readRecords();

      // The FA array is at row 0
      const faArray = faArrayTable.records[0];
      if (!faArray) {
        console.error('[addPlayerToFAArray] FA array record not found at row 0');
        return false;
      }

      // Check if player is already in the array (avoid duplicates)
      for (let i = 0; i < faArray.arraySize; i++) {
        if (faArray[`Player${i}`] === playerRef) {
          console.log(`[addPlayerToFAArray] Player already in FA array at slot ${i}`);
          return true; // Already present, consider it a success
        }
      }

      const currentSize = faArray.arraySize || 0;

      // Add player at the next available slot
      faArray[`Player${currentSize}`] = playerRef;

      // Increment arraySize
      faArray.arraySize = currentSize + 1;
      faArrayTable.arraySizes[0] = currentSize + 1;

      // Mark as changed
      faArray.isChanged = true;
      faArray._parent.onEvent('change', faArray);

      console.log(`[addPlayerToFAArray] Added player at slot ${currentSize}, new FA array size: ${currentSize + 1}`);
      return true;
    } catch (error: any) {
      console.error('[addPlayerToFAArray] Error:', error.message);
      return false;
    }
  }

  /**
   * Remove a player from the Free Agent array (table 5930).
   * Call this when signing a player to a team.
   *
   * @param franchise - The loaded franchise instance
   * @param playerRef - The player's reference string (32-char binary)
   * @returns true if player was found and removed, false otherwise
   */
  private async removePlayerFromFAArray(
    franchise: any,
    playerRef: string
  ): Promise<boolean> {
    try {
      const faArrayTable = franchise.getTableById(TABLE_IDS.faArrayTable);
      if (!faArrayTable) {
        console.error('[removePlayerFromFAArray] FA array table not found (id=5930)');
        return false;
      }

      await faArrayTable.readRecords();

      // The FA array is at row 0
      const faArray = faArrayTable.records[0];
      if (!faArray) {
        console.error('[removePlayerFromFAArray] FA array record not found at row 0');
        return false;
      }

      // Collect all non-ZERO_REF player refs EXCEPT the one we're removing
      const remainingRefs: string[] = [];
      let foundPlayer = false;

      for (let i = 0; i < faArray.arraySize; i++) {
        const ref = faArray[`Player${i}`];
        if (ref === playerRef) {
          foundPlayer = true;
          console.log(`[removePlayerFromFAArray] Found player at slot ${i}`);
        } else if (ref && ref !== ZERO_REF) {
          remainingRefs.push(ref);
        }
      }

      if (!foundPlayer) {
        console.log('[removePlayerFromFAArray] Player ref not found in FA array');
        return false;
      }

      // Rebuild array: remaining players shifted to front, pad end with ZERO_REF
      const totalSlots = faArray.arraySize;
      for (let i = 0; i < totalSlots; i++) {
        if (i < remainingRefs.length) {
          faArray[`Player${i}`] = remainingRefs[i];
        } else {
          faArray[`Player${i}`] = ZERO_REF;
        }
      }

      // Update arraySize
      faArray.arraySize = remainingRefs.length;
      faArrayTable.arraySizes[0] = remainingRefs.length;

      // Mark as changed
      faArray.isChanged = true;
      faArray._parent.onEvent('change', faArray);

      console.log(`[removePlayerFromFAArray] Removed player, new FA array size: ${remainingRefs.length}`);
      return true;
    } catch (error: any) {
      console.error('[removePlayerFromFAArray] Error:', error.message);
      return false;
    }
  }

  /**
   * Add multiple players to the FA array in bulk (more efficient for large operations).
   *
   * @param franchise - The loaded franchise instance
   * @param playerRefs - Array of player reference strings
   * @returns Number of players successfully added
   */
  private async addPlayersToFAArrayBulk(
    franchise: any,
    playerRefs: string[]
  ): Promise<number> {
    if (!playerRefs || playerRefs.length === 0) return 0;

    try {
      const faArrayTable = franchise.getTableById(TABLE_IDS.faArrayTable);
      if (!faArrayTable) {
        console.error('[addPlayersToFAArrayBulk] FA array table not found (id=5930)');
        return 0;
      }

      await faArrayTable.readRecords();

      const faArray = faArrayTable.records[0];
      if (!faArray) {
        console.error('[addPlayersToFAArrayBulk] FA array record not found at row 0');
        return 0;
      }

      // Build set of existing players for quick lookup
      const existingRefs = new Set<string>();
      for (let i = 0; i < faArray.arraySize; i++) {
        const ref = faArray[`Player${i}`];
        if (ref && ref !== ZERO_REF) {
          existingRefs.add(ref);
        }
      }

      // Filter out players already in the array
      const newRefs = playerRefs.filter(ref => !existingRefs.has(ref));
      if (newRefs.length === 0) {
        console.log('[addPlayersToFAArrayBulk] All players already in FA array');
        return 0;
      }

      let currentSize = faArray.arraySize || 0;
      let addedCount = 0;

      for (const ref of newRefs) {
        faArray[`Player${currentSize}`] = ref;
        currentSize++;
        addedCount++;
      }

      // Update arraySize
      faArray.arraySize = currentSize;
      faArrayTable.arraySizes[0] = currentSize;

      // Mark as changed
      faArray.isChanged = true;
      faArray._parent.onEvent('change', faArray);

      console.log(`[addPlayersToFAArrayBulk] Added ${addedCount} players, new FA array size: ${currentSize}`);
      return addedCount;
    } catch (error: any) {
      console.error('[addPlayersToFAArrayBulk] Error:', error.message);
      return 0;
    }
  }

  /**
   * Get a player's reference string from their record index.
   * This creates the 32-char binary reference used in roster arrays.
   *
   * @param franchise - The loaded franchise instance
   * @param playerRecordIndex - The player's index in the Player table
   * @returns The player's reference string or null if not found
   */
  private async getPlayerReference(
    franchise: any,
    playerRecordIndex: number
  ): Promise<string | null> {
    let playerTable = franchise.getTableByName('Player');
    if (!playerTable) {
      const tables = franchise.getAllTablesByName('Player');
      if (tables?.length) playerTable = tables[0];
    }
    if (!playerTable) return null;

    await playerTable.readRecords();
    const player = playerTable.records[playerRecordIndex];
    if (!player || player.isEmpty) return null;

    // Get the reference data which contains the binary reference string
    // The reference is constructed from tableId (15 bits) + rowNumber (17 bits)
    const tableId = playerTable.header.tableId;
    const rowNumber = playerRecordIndex;

    // Convert to binary string (15 bits table + 17 bits row = 32 bits)
    const tableBits = tableId.toString(2).padStart(15, '0');
    const rowBits = rowNumber.toString(2).padStart(17, '0');
    const binaryRef = tableBits + rowBits;

    console.log(`[getPlayerReference] Player ${playerRecordIndex}: tableId=${tableId}, row=${rowNumber}, ref=${binaryRef}`);
    return binaryRef;
  }

  /**
   * Get a team's roster reference from their TeamIndex.
   *
   * @param franchise - The loaded franchise instance
   * @param teamIndex - The team's TeamIndex (0-31)
   * @returns The roster reference { tableId, rowNumber } or null
   */
  private async getTeamRosterRef(
    franchise: any,
    teamIndex: number
  ): Promise<{ tableId: number; rowNumber: number } | null> {
    const teamTable = franchise.getTableByUniqueId(TABLE_IDS.teamTable);
    await teamTable.readRecords();

    for (const team of teamTable.records) {
      if (team.isEmpty) continue;
      if (Number(team.TeamIndex) === teamIndex) {
        const rosterRef = team.getReferenceDataByKey('Roster');
        if (rosterRef) {
          return { tableId: rosterRef.tableId, rowNumber: rosterRef.rowNumber };
        }
      }
    }
    return null;
  }

  /**
   * Remove a player reference from a team's depth chart.
   * Scans all depth chart positions and removes the player using shift-pad pattern.
   *
   * @param franchise - The loaded franchise instance
   * @param playerRef - The player's reference string to remove
   * @param teamIndex - The team's TeamIndex (0-31)
   * @returns Number of depth chart slots cleaned
   */
  private async removePlayerFromDepthChart(
    franchise: any,
    playerRef: string,
    teamIndex: number
  ): Promise<number> {
    let slotsRemoved = 0;

    try {
      // Get DepthChart table - ID 5879 from franchise-table-list.txt
      const depthChartTable = franchise.getTableById(5879);
      if (!depthChartTable) {
        console.log('[removePlayerFromDepthChart] DepthChart table not found');
        return 0;
      }
      await depthChartTable.readRecords();

      // Find the team's depth chart record
      for (const depthChart of depthChartTable.records) {
        if (depthChart.isEmpty) continue;
        if (Number(depthChart.TeamIndex) !== teamIndex) continue;

        // Scan all Player fields in this depth chart record
        // Depth charts have Player0, Player1, etc. fields for each position slot
        for (const field of depthChart.fieldsArray || []) {
          if (!field.key?.startsWith('Player') || field.key === 'PlayerCount') continue;

          if (field.value === playerRef) {
            // Found the player - set to ZERO_REF
            field.value = ZERO_REF;
            slotsRemoved++;
            console.log(`[removePlayerFromDepthChart] Removed player from ${field.key}`);
          }
        }

        if (slotsRemoved > 0) {
          depthChart.isChanged = true;
          depthChart._parent.onEvent('change', depthChart);
        }
      }
    } catch (err: any) {
      console.log(`[removePlayerFromDepthChart] Error: ${err.message}`);
    }

    return slotsRemoved;
  }

  /**
   * Full cleanup when removing a player from a team.
   * Removes from roster array and depth chart.
   *
   * @param franchise - The loaded franchise instance
   * @param playerRef - The player's reference string
   * @param teamIndex - The team's TeamIndex (0-31)
   * @returns Cleanup result
   */
  private async cleanupPlayerFromTeam(
    franchise: any,
    playerRef: string,
    teamIndex: number
  ): Promise<{ rosterRemoved: boolean; depthChartSlots: number }> {
    // 1. Get team's roster ref
    const rosterRef = await this.getTeamRosterRef(franchise, teamIndex);
    if (!rosterRef) {
      console.log(`[cleanupPlayerFromTeam] Could not find roster for team ${teamIndex}`);
      return { rosterRemoved: false, depthChartSlots: 0 };
    }

    // 2. Remove from roster array
    const rosterRemoved = await this.removePlayerFromRoster(franchise, playerRef, rosterRef);

    // 3. Remove from depth chart
    const depthChartSlots = await this.removePlayerFromDepthChart(franchise, playerRef, teamIndex);

    console.log(`[cleanupPlayerFromTeam] Team ${teamIndex}: rosterRemoved=${rosterRemoved}, depthChartSlots=${depthChartSlots}`);
    return { rosterRemoved, depthChartSlots };
  }

  /**
   * Execute a team relocation (e.g., Cleveland Browns → Baltimore Ravens 1996)
   * SWAPS rosters between source and dest teams.
   * Source players go to dest roster, dest players go to source roster.
   */
  async executeRelocation(
    filePath: string,
    sourceTeamIndex: number,
    destTeamIndex: number
  ): Promise<{ success: boolean; playersTransferred: number; playerNames: string[]; error?: string }> {
    // FULL SWAP: Match working swap-rosters.js pattern exactly
    // Must swap BOTH roster arrays AND TeamIndex fields
    try {
      const franchise = this.getFranchise(filePath);
      if (!franchise) {
        throw new Error('Franchise file not loaded');
      }

      console.log(`[executeRelocation] ========== START ==========`);
      console.log(`[executeRelocation] Swapping teams: ${sourceTeamIndex} <-> ${destTeamIndex}`);

      // 1. Get Team table and find source/dest teams
      const teamTable = franchise.getTableByUniqueId(637929298);
      await teamTable.readRecords();

      let sourceTeam: any = null;
      let destTeam: any = null;
      for (const t of teamTable.records) {
        if (t.isEmpty) continue;
        const ti = Number(t.TeamIndex);
        if (ti === sourceTeamIndex) sourceTeam = t;
        if (ti === destTeamIndex) destTeam = t;
      }

      if (!sourceTeam || !destTeam) {
        throw new Error(`Could not find teams: source=${sourceTeamIndex} dest=${destTeamIndex}`);
      }

      console.log(`[executeRelocation] Source team: ${sourceTeam.ShortName} (TeamIndex=${sourceTeamIndex})`);
      console.log(`[executeRelocation] Dest team: ${destTeam.ShortName} (TeamIndex=${destTeamIndex})`);

      // 2. Get roster refs from teams
      const sourceRosterRef = sourceTeam.getReferenceDataByKey('Roster');
      const destRosterRef = destTeam.getReferenceDataByKey('Roster');

      console.log(`[executeRelocation] Source roster ref: tableId=${sourceRosterRef.tableId}, row=${sourceRosterRef.rowNumber}`);
      console.log(`[executeRelocation] Dest roster ref: tableId=${destRosterRef.tableId}, row=${destRosterRef.rowNumber}`);

      // 3. Get roster array table
      const rosterTable = franchise.getTableById(sourceRosterRef.tableId);
      await rosterTable.readRecords();

      const sourceRoster = rosterTable.records[sourceRosterRef.rowNumber];
      const destRoster = rosterTable.records[destRosterRef.rowNumber];

      console.log(`[executeRelocation] Source roster size: ${sourceRoster.arraySize}`);
      console.log(`[executeRelocation] Dest roster size: ${destRoster.arraySize}`);

      // 4. SAVE all player refs BEFORE swapping (critical - refs become stale after swap)
      const sourcePlayerRefs: string[] = [];
      for (let i = 0; i < sourceRoster.arraySize; i++) {
        sourcePlayerRefs.push(sourceRoster[`Player${i}`]);
      }
      const sourceSize = sourceRoster.arraySize;

      const destPlayerRefs: string[] = [];
      for (let i = 0; i < destRoster.arraySize; i++) {
        destPlayerRefs.push(destRoster[`Player${i}`]);
      }
      const destSize = destRoster.arraySize;

      console.log(`[executeRelocation] Saved ${sourcePlayerRefs.length} source refs, ${destPlayerRefs.length} dest refs`);

      // 5. SWAP: Put dest player refs into source roster
      for (let i = 0; i < destPlayerRefs.length; i++) {
        sourceRoster[`Player${i}`] = destPlayerRefs[i];
      }
      sourceRoster.arraySize = destSize;
      rosterTable.arraySizes[sourceRosterRef.rowNumber] = destSize;
      sourceRoster.isChanged = true;
      sourceRoster._parent.onEvent('change', sourceRoster);

      // 6. SWAP: Put source player refs into dest roster
      for (let i = 0; i < sourcePlayerRefs.length; i++) {
        destRoster[`Player${i}`] = sourcePlayerRefs[i];
      }
      destRoster.arraySize = sourceSize;
      rosterTable.arraySizes[destRosterRef.rowNumber] = sourceSize;
      destRoster.isChanged = true;
      destRoster._parent.onEvent('change', destRoster);

      console.log(`[executeRelocation] Swapped roster arrays`);

      // 7. Get Player table for TeamIndex updates
      let playerTable = franchise.getTableByName('Player');
      if (!playerTable) {
        const tables = franchise.getAllTablesByName('Player');
        if (tables?.length) playerTable = tables[0];
      }
      await playerTable.readRecords();

      // 8. Update TeamIndex on players using the SAVED refs
      // sourceRoster now has destPlayerRefs (formerly dest team players)
      // These players should have TeamIndex = sourceTeamIndex
      const sourcePlayerNames: string[] = [];
      for (let i = 0; i < destPlayerRefs.length; i++) {
        const ref = sourceRoster.getReferenceDataByKey(`Player${i}`);
        if (ref?.rowNumber !== undefined) {
          const p = playerTable.records[ref.rowNumber];
          if (p && !p.isEmpty) {
            p.TeamIndex = sourceTeamIndex;
          }
        }
      }

      // destRoster now has sourcePlayerRefs (formerly source team players)
      // These players should have TeamIndex = destTeamIndex
      for (let i = 0; i < sourcePlayerRefs.length; i++) {
        const ref = destRoster.getReferenceDataByKey(`Player${i}`);
        if (ref?.rowNumber !== undefined) {
          const p = playerTable.records[ref.rowNumber];
          if (p && !p.isEmpty) {
            p.TeamIndex = destTeamIndex;
            sourcePlayerNames.push(`${p.FirstName || ''} ${p.LastName || ''}`.trim());
          }
        }
      }

      console.log(`[executeRelocation] Updated TeamIndex on ${sourcePlayerNames.length} source players -> ${destTeamIndex}`);
      console.log(`[executeRelocation] Updated TeamIndex on ${destPlayerRefs.length} dest players -> ${sourceTeamIndex}`);
      console.log(`[executeRelocation] ========== END ==========`);

      return { success: true, playersTransferred: sourcePlayerNames.length, playerNames: sourcePlayerNames };
    } catch (error: any) {
      console.error('[executeRelocation] Error:', error);
      return { success: false, playersTransferred: 0, playerNames: [], error: error.message };
    }
  }


  /**
   * Prepare franchise for expansion draft by moving existing expansion team players to FA
   * This must be called BEFORE getEligiblePlayersForExpansionDraft
   */
  async prepareExpansionDraft(
    filePath: string,
    event: ExpansionEvent
  ): Promise<{ success: boolean; movedCount: number; error?: string }> {
    try {
      const franchise = this.getFranchise(filePath);
      if (!franchise) {
        throw new Error('Franchise file not loaded');
      }

      // Get expansion team indices
      const expansionTeamIndices = new Set<number>();
      for (const team of event.teams || []) {
        expansionTeamIndices.add(team.teamIndex);
      }

      if (expansionTeamIndices.size === 0) {
        return { success: true, movedCount: 0 };
      }

      // Get player table
      let playerTable = franchise.getTableByName('Player');
      if (!playerTable) {
        playerTable = franchise.getTableByUniqueId(TABLE_IDS.playerTable);
      }
      if (!playerTable) {
        throw new Error('Player table not found');
      }
      await playerTable.readRecords();

      // Get team table for roster refs
      const teamTable = franchise.getTableByUniqueId(TABLE_IDS.teamTable);
      await teamTable.readRecords();

      // Clear roster arrays for expansion teams
      for (const team of teamTable.records) {
        if (team.isEmpty) continue;
        const teamIdx = Number(team.TeamIndex);
        if (expansionTeamIndices.has(teamIdx)) {
          const rosterRef = team.getReferenceDataByKey('Roster');
          if (rosterRef) {
            const rosterTable = franchise.getTableById(rosterRef.tableId);
            await rosterTable.readRecords();
            const rosterRecord = rosterTable.records[rosterRef.rowNumber];
            if (rosterRecord) {
              const originalSize = rosterRecord.arraySize || 0;
              for (let i = 0; i < originalSize; i++) {
                rosterRecord[`Player${i}`] = ZERO_REF;
              }
              rosterRecord.arraySize = 0;
              rosterTable.arraySizes[rosterRef.rowNumber] = 0;
              rosterRecord.isChanged = true;
              rosterRecord._parent.onEvent('change', rosterRecord);
              console.log(`[prepareExpansionDraft] Cleared roster for team ${teamIdx}`);
            }
          }
        }
      }

      // Move players on expansion teams to FA (TeamIndex 32)
      const FREE_AGENT_TEAM_INDEX = 32;
      let movedCount = 0;
      const playerRefsToAddToFA: string[] = [];

      for (const player of playerTable.records) {
        if (player.isEmpty) continue;
        const playerTeamIndex = Number(player.TeamIndex);
        if (expansionTeamIndices.has(playerTeamIndex)) {
          const playerName = `${player.FirstName || ''} ${player.LastName || ''}`.trim();
          console.log(`[prepareExpansionDraft] Moving ${playerName} from team ${playerTeamIndex} to FA`);
          player.TeamIndex = FREE_AGENT_TEAM_INDEX;

          // Set FA status fields
          try { player.ContractStatus = 'FreeAgent'; } catch (e) { /* field may not exist */ }
          try {
            player.ContractLength = 0;
            player.ContractYear = 0;
            for (let i = 0; i < 8; i++) {
              try {
                player[`ContractSalary${i}`] = 0;
                player[`ContractBonus${i}`] = 0;
              } catch (e) { /* Some years may not exist */ }
            }
            player.PLYR_CONSECYEARSWITHTEAM = 0;
            player.PLYR_ISCAPTAIN = false;
          } catch (e) { /* Fields may not exist */ }

          // Collect player reference for FA array
          const tableId = playerTable.header.tableId;
          const rowNumber = player.index;
          const tableBits = tableId.toString(2).padStart(15, '0');
          const rowBits = rowNumber.toString(2).padStart(17, '0');
          const playerRef = tableBits + rowBits;
          playerRefsToAddToFA.push(playerRef);

          movedCount++;
        }
      }

      // Add players to FA array for game visibility
      if (playerRefsToAddToFA.length > 0) {
        const addedToFAArray = await this.addPlayersToFAArrayBulk(franchise, playerRefsToAddToFA);
        console.log(`[prepareExpansionDraft] Added ${addedToFAArray} players to FA array (table 5930)`);
      }

      console.log(`[prepareExpansionDraft] Moved ${movedCount} players to FA`);
      return { success: true, movedCount };
    } catch (error: any) {
      console.error('[prepareExpansionDraft] Error:', error);
      return { success: false, movedCount: 0, error: error.message };
    }
  }

  /**
   * Get players eligible for an expansion draft
   * Returns all players from existing teams that can be drafted
   * @param filePath - Path to the franchise file
   * @param event - The expansion event details
   * @param rosterPath - Optional path to roster file to read correct OVR values from
   */
  async getEligiblePlayersForExpansionDraft(
    filePath: string,
    event: ExpansionEvent,
    rosterPath?: string
  ): Promise<{ success: boolean; players?: PlayerForDraft[]; error?: string }> {
    try {
      const franchise = this.getFranchise(filePath);
      if (!franchise) {
        throw new Error('Franchise file not loaded');
      }

      // Get player table - try by name first, then by ID
      let playerTable = franchise.getTableByName('Player');
      if (!playerTable) {
        playerTable = franchise.getTableByUniqueId(TABLE_IDS.playerTable);
      }
      if (!playerTable) {
        throw new Error('Player table not found');
      }
      await playerTable.readRecords();

      // Debug: Log table field definitions to find OVR field name
      if (playerTable.fieldDefinitions && playerTable.fieldDefinitions.length > 0) {
        const ovrFieldDefs = playerTable.fieldDefinitions.filter((f: any) =>
          (f.name || f.key || '').toLowerCase().includes('overall') ||
          (f.name || f.key || '').toLowerCase().includes('ovr') ||
          (f.name || f.key || '').toLowerCase().includes('rating')
        );
        console.log(`[getEligiblePlayers] TABLE FIELD DEFINITIONS with OVR:`, ovrFieldDefs.map((f: any) => f.name || f.key));
      }

      // Get team table for team names
      let teamTable = franchise.getTableByName('Team');
      if (!teamTable) {
        teamTable = franchise.getTableByUniqueId(TABLE_IDS.teamTable);
      }
      if (!teamTable) {
        throw new Error('Team table not found');
      }
      await teamTable.readRecords();

      // Build OVR lookup from roster file if provided (has correct OVR values)
      // The roster file uses POVR field for OVR, while franchise file has garbage values
      const rosterOvrMap = new Map<string, number>();
      if (rosterPath) {
        try {
          const RosterParser = require(require('path').join(__dirname, 'parsers', 'RosterParser.js'));
          const { parseRosterFile } = RosterParser;
          const rosterData = await parseRosterFile(rosterPath);
          console.log(`[getEligiblePlayersForExpansionDraft] Loaded roster file with ${rosterData.playerCount} players`);

          // Build lookup by firstName_lastName
          for (const player of rosterData.players || []) {
            if (!player.PFNA || !player.PLNA) continue;
            const key = `${player.PFNA}_${player.PLNA}`.toLowerCase();
            const ovr = player.POVR || 0;
            if (ovr > 0) {
              // Keep highest OVR if duplicates
              const existing = rosterOvrMap.get(key) || 0;
              if (ovr > existing) {
                rosterOvrMap.set(key, ovr);
              }
            }
          }
          console.log(`[getEligiblePlayersForExpansionDraft] Built roster OVR lookup with ${rosterOvrMap.size} players`);
        } catch (e: any) {
          console.warn(`[getEligiblePlayersForExpansionDraft] Failed to load roster file: ${e.message}`);
        }
      }

      // Fallback: Load player OVR data from database for this year
      const year = event.year;
      const dbPlayers = lookupService.getAllPlayerSeasonsForYear(year);
      console.log(`[getEligiblePlayersForExpansionDraft] Loaded ${dbPlayers.length} players from database for year ${year}`);

      // Build lookup map by firstName_lastName for OVR lookup
      const ovrLookupMap = new Map<string, number>();
      for (const dbPlayer of dbPlayers) {
        const key = `${dbPlayer.firstName}_${dbPlayer.lastName}`.toLowerCase();
        const ovr = dbPlayer.ratings?.POVR || 0;
        if (ovr > 0) {
          // Keep the highest OVR if there are duplicates
          const existing = ovrLookupMap.get(key) || 0;
          if (ovr > existing) {
            ovrLookupMap.set(key, ovr);
          }
        }
      }
      console.log(`[getEligiblePlayersForExpansionDraft] Built OVR lookup map with ${ovrLookupMap.size} players`);

      // Debug: Log some sample entries from the map
      const sampleKeys = Array.from(ovrLookupMap.keys()).slice(0, 10);
      console.log(`[getEligiblePlayersForExpansionDraft] Sample DB names: ${sampleKeys.join(', ')}`);

      // Track stats for debugging
      let dbMatchCount = 0;
      let dbMissCount = 0;

      // Build team name map from historicalTeams (already loaded from historical-teams.json)
      const teamNameMap = new Map<number, string>();
      for (const team of this.historicalTeams) {
        const teamName = `${team.currentCity} ${team.currentName}`;
        teamNameMap.set(team.teamIndex, teamName);
      }
      console.log('[getEligiblePlayersForExpansionDraft] Team name map built from historicalTeams:', teamNameMap.size, 'teams');

      // Get expansion team indices (these teams don't contribute players)
      const expansionTeamIndices = new Set<number>();
      if (event.teams) {
        for (const team of event.teams) {
          expansionTeamIndices.add(team.teamIndex);
        }
      }
      if (event.destinationTeam) {
        expansionTeamIndices.add(event.destinationTeam.teamIndex);
      }

      // Get inactive team indices (Browns 1996-98)
      const inactiveTeamIndices = new Set<number>();
      if (event.inactiveTeam) {
        inactiveTeamIndices.add(event.inactiveTeam.teamIndex);
      }

      const players: PlayerForDraft[] = [];

      // Debug: Log available fields on first non-empty player
      let loggedFields = false;

      for (const player of playerTable.records) {
        if (player.isEmpty) continue;

        // Look for first non-empty player to dump ALL fields (for debugging OVR)
        if (!loggedFields) {
          console.log(`[RetroEditorService] *** DEBUG: First player found: ${player.FirstName} ${player.LastName}, OverallRating=${player.OverallRating}, Age=${player.Age}`);
          try {
            const fs = require('fs');
            const debugPath = require('path').join(process.cwd(), 'player-fields-debug.txt');
            console.log(`[RetroEditorService] *** DEBUG: Writing to ${debugPath}`);
            // Get all field names from _fields (the internal field object)
            const fieldsObj = player._fields || player.fields || {};
            const allFieldNames = Object.keys(fieldsObj).filter(k => !k.startsWith('_')).sort();
            // Also try Object.keys on player directly to catch proxy properties
            const proxyKeys = Object.keys(player).filter(k => !k.startsWith('_')).sort();

            // Build comprehensive debug content
            const ovrRelatedFields = allFieldNames.filter(f =>
              f.toLowerCase().includes('overall') ||
              f.toLowerCase().includes('ovr') ||
              f.toLowerCase().includes('rating')
            );

            let debugContent = `=== PLAYER FIELDS DEBUG (from first player) ===
Player: ${player.FirstName} ${player.LastName}

OVR-RELATED FIELDS: ${ovrRelatedFields.join(', ') || 'NONE FOUND'}

FIELD ACCESS TESTS:
  player.OverallRating = ${player.OverallRating}
  player.Overall = ${player.Overall}
  player.POVR = ${player.POVR}
  player.PlayerOverall = ${player.PlayerOverall}
  player.OverallValue = ${player.OverallValue}
  player.Age = ${player.Age}
  player.Position = ${player.Position}
  player.TeamIndex = ${player.TeamIndex}

ALL FIELD NAMES (${allFieldNames.length} fields from _fields):
${allFieldNames.join('\n')}

PROXY KEYS (${proxyKeys.length} keys from Object.keys):
${proxyKeys.join('\n')}

ALL FIELD VALUES (first 100 fields):
${allFieldNames.slice(0, 100).map(f => `  ${f}: ${player[f]}`).join('\n')}
`;
            fs.writeFileSync(debugPath, debugContent);
            console.log('[RetroEditorService] COMPLETE PLAYER FIELDS DEBUG written successfully');
          } catch (err: any) {
            console.error('[RetroEditorService] *** DEBUG: FAILED to write debug file:', err.message);
          }
          loggedFields = true;
        }

        const teamIndex = player.TeamIndex;

        // Skip free agents and invalid teams
        if (teamIndex === undefined || teamIndex >= 32) continue;

        // Skip players on expansion teams
        if (expansionTeamIndices.has(teamIndex)) continue;

        // Skip players on inactive teams
        if (inactiveTeamIndices.has(teamIndex)) continue;

        // Map position to standard abbreviation
        const positionMap: { [key: number]: string } = {
          0: 'QB', 1: 'HB', 2: 'FB', 3: 'WR', 4: 'TE',
          5: 'LT', 6: 'LG', 7: 'C', 8: 'RG', 9: 'RT',
          10: 'LEDG', 11: 'REDG', 12: 'DT',
          13: 'SAM', 14: 'Mike', 15: 'WILL',
          16: 'CB', 17: 'FS', 18: 'SS',
          19: 'K', 20: 'P', 21: 'LS'
        };
        // String position map for when franchise returns string enums
        const stringPositionMap: { [key: string]: string } = {
          'LeftEnd': 'LEDG', 'RightEnd': 'REDG',
          'LeftTackle': 'LT', 'LeftGuard': 'LG', 'Center': 'C', 'RightGuard': 'RG', 'RightTackle': 'RT',
          'Quarterback': 'QB', 'Halfback': 'HB', 'Fullback': 'FB', 'WideReceiver': 'WR', 'TightEnd': 'TE',
          'DefensiveTackle': 'DT', 'MiddleLinebacker': 'Mike', 'OutsideLinebacker': 'SAM',
          'StrongSideLinebacker': 'SAM', 'WeakSideLinebacker': 'WILL',
          'Cornerback': 'CB', 'FreeSafety': 'FS', 'StrongSafety': 'SS',
          'Kicker': 'K', 'Punter': 'P', 'LongSnapper': 'LS',
          'LE': 'LEDG', 'RE': 'REDG', 'LOLB': 'SAM', 'ROLB': 'WILL', 'MLB': 'Mike',
          'LEDG': 'LEDG', 'REDG': 'REDG', 'SAM': 'SAM', 'Mike': 'Mike', 'WILL': 'WILL'
        };
        const rawPosition = player.Position;
        let mappedPosition = 'Unknown';
        if (typeof rawPosition === 'number') {
          mappedPosition = positionMap[rawPosition] || `POS${rawPosition}`;
        } else if (typeof rawPosition === 'string') {
          // Check if it has a prefix like "Position:"
          let cleanPosition = rawPosition;
          if (rawPosition.includes(':')) {
            cleanPosition = rawPosition.split(':').pop() || rawPosition;
          }
          // Try string map first, then use as-is
          mappedPosition = stringPositionMap[cleanPosition] || cleanPosition;
        }

        // Debug: Log first player to see all available fields - write to file for certainty
        if (players.length === 0) {
          // The player record is a Proxy - access _fields directly if available, or fields property
          const fieldsObj = player._fields || player.fields || {};
          const allFields = Object.keys(fieldsObj).filter(k => !k.startsWith('_'));
          const ovrFields = allFields.filter(f => f.toLowerCase().includes('over') || f.toLowerCase().includes('ovr') || f.toLowerCase().includes('rating'));
          console.log(`[getEligiblePlayers] AVAILABLE OVR-RELATED FIELDS:`, ovrFields);
          console.log(`[getEligiblePlayers] Sample player field values:`, {
            OverallRating: player.OverallRating,
            Overall: player.Overall,
            POVR: player.POVR,
            PlayerOverall: player.PlayerOverall,
          });
          // Write debug info to file
          const fs = require('fs');
          const debugPath = require('path').join(process.cwd(), 'expansion-ovr-debug.txt');
          const fieldsList = allFields.sort().map(f => `  ${f}: ${player[f]}`).join('\n');
          const debugContent = `Player: ${player.FirstName} ${player.LastName}

OVR-RELATED FIELDS: ${ovrFields.join(', ')}

ALL PLAYER FIELDS (${allFields.length} total):
${fieldsList}
`;
          fs.writeFileSync(debugPath, debugContent);
          console.log(`[getEligiblePlayers] DEBUG: Wrote field names to ${debugPath}`);
        }
        // Debug: Log first few players with detailed OVR info
        if (players.length < 5) {
          console.log(`[getEligiblePlayers] Player ${player.FirstName} ${player.LastName}: rawPosition=${rawPosition} (${typeof rawPosition}) -> ${mappedPosition}, OverallRating=${player.OverallRating} (type: ${typeof player.OverallRating}), Age=${player.Age}`);
        }

        // Look up OVR - NEW PRIORITY ORDER:
        // 1. Franchise file (player.OverallRating) - source of truth
        // 2. Roster file (if provided)
        // 3. Database fallback
        const playerKey = `${player.FirstName}_${player.LastName}`.toLowerCase();

        // Priority 1: Try franchise file's OverallRating first
        let overall: number | undefined = undefined;
        let ovrSource = 'unknown';

        const franchiseOVR = player.OverallRating;
        if (franchiseOVR !== undefined && franchiseOVR > 0 && franchiseOVR <= 99) {
          overall = franchiseOVR;
          ovrSource = 'franchise';
        }

        // Priority 2: Try roster file (if provided and franchise OVR not available)
        if ((overall === undefined || overall <= 0) && rosterOvrMap.size > 0) {
          overall = rosterOvrMap.get(playerKey);
          if (overall !== undefined && overall > 0) {
            ovrSource = 'roster';
          }
        }

        // Priority 3: Fall back to database
        if (overall === undefined || overall <= 0) {
          overall = ovrLookupMap.get(playerKey);
          if (overall !== undefined && overall > 0) {
            ovrSource = 'database';
          }
        }

        // If still no OVR found, skip this player
        if (overall === undefined || overall <= 0) {
          dbMissCount++;
          if (dbMissCount <= 10) {
            console.log(`[getEligiblePlayers] SKIPPING: ${player.FirstName} ${player.LastName} (${mappedPosition}) - no valid OVR (franchise=${franchiseOVR}, roster=${rosterOvrMap.get(playerKey)}, db=${ovrLookupMap.get(playerKey)})`);
          }
          continue;
        }

        dbMatchCount++;
        if (players.length < 5) {
          console.log(`[getEligiblePlayers] ${player.FirstName} ${player.LastName}: OVR=${overall} (from ${ovrSource})`);
        }

        const playerData: PlayerForDraft = {
          recordIndex: player.index,
          firstName: player.FirstName || '',
          lastName: player.LastName || '',
          position: mappedPosition,
          overall: overall,
          age: player.Age || 0,
          teamIndex: teamIndex,
          teamName: teamNameMap.get(teamIndex) || `Team ${teamIndex}`,
          isProtected: false, // Will be set by auto-protect logic
          // Contract info - franchise files use ContractLength, ContractYear, ContractSalary0-7
          // Years left = ContractLength - ContractYear
          contractYearsLeft: (player.ContractLength || 0) - (player.ContractYear || 0),
          // Total contract value (sum of all years)
          contractSalary: this.getTotalContractValue(player),
          // Current year cap hit
          capHit: this.getContractCapHit(player),
        };

        players.push(playerData);
      }

      // Sort by overall descending
      players.sort((a, b) => b.overall - a.overall);

      // Debug: Count positions to verify mapping
      const positionCounts = new Map<string, number>();
      for (const p of players) {
        positionCounts.set(p.position, (positionCounts.get(p.position) || 0) + 1);
      }
      console.log(`[RetroEditorService] Found ${players.length} eligible players for expansion draft`);
      console.log(`[RetroEditorService] Position breakdown:`, Object.fromEntries(positionCounts));
      console.log(`[RetroEditorService] DB OVR lookup: ${dbMatchCount} matched, ${dbMissCount} missed (${((dbMatchCount / (dbMatchCount + dbMissCount)) * 100).toFixed(1)}% match rate)`);

      return { success: true, players };
    } catch (error: any) {
      console.error('[RetroEditorService] Error getting eligible players:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Auto-protect players based on expansion draft rules
   * Each team can protect up to maxProtected players
   */
  autoProtectPlayers(players: PlayerForDraft[], maxProtected: number): PlayerForDraft[] {
    // Group players by team
    const playersByTeam = new Map<number, PlayerForDraft[]>();
    for (const player of players) {
      if (!playersByTeam.has(player.teamIndex)) {
        playersByTeam.set(player.teamIndex, []);
      }
      playersByTeam.get(player.teamIndex)!.push(player);
    }

    // For each team, protect the top N players by overall
    for (const [teamIndex, teamPlayers] of playersByTeam) {
      // Sort by overall descending
      teamPlayers.sort((a, b) => b.overall - a.overall);

      // Protect top N
      for (let i = 0; i < Math.min(maxProtected, teamPlayers.length); i++) {
        teamPlayers[i].isProtected = true;
      }
    }

    console.log(`[RetroEditorService] Auto-protected top ${maxProtected} players per team`);

    return players;
  }

  /**
   * Get total contract value (sum of all years salary + bonus)
   * Values are stored in ~$10K units
   */
  private getTotalContractValue(player: any): number {
    const salaryFields = [
      player.ContractSalary0 || 0,
      player.ContractSalary1 || 0,
      player.ContractSalary2 || 0,
      player.ContractSalary3 || 0,
      player.ContractSalary4 || 0,
      player.ContractSalary5 || 0,
      player.ContractSalary6 || 0,
      player.ContractSalary7 || 0,
    ];
    const bonusFields = [
      player.ContractBonus0 || 0,
      player.ContractBonus1 || 0,
      player.ContractBonus2 || 0,
      player.ContractBonus3 || 0,
      player.ContractBonus4 || 0,
      player.ContractBonus5 || 0,
      player.ContractBonus6 || 0,
      player.ContractBonus7 || 0,
    ];

    const contractLength = player.ContractLength || 0;
    let total = 0;
    for (let i = 0; i < contractLength; i++) {
      total += salaryFields[i] + bonusFields[i];
    }
    // Return total in millions
    return total * 0.01;
  }

  /**
   * Calculate approximate cap hit for current year
   * Cap hit = current year salary + prorated bonuses
   */
  private getContractCapHit(player: any): number {
    const yearIndex = player.ContractYear || 0;
    const contractLength = player.ContractLength || 1;

    // Get current year salary
    const salaryFields = [
      player.ContractSalary0,
      player.ContractSalary1,
      player.ContractSalary2,
      player.ContractSalary3,
      player.ContractSalary4,
      player.ContractSalary5,
      player.ContractSalary6,
      player.ContractSalary7,
    ];
    const bonusFields = [
      player.ContractBonus0,
      player.ContractBonus1,
      player.ContractBonus2,
      player.ContractBonus3,
      player.ContractBonus4,
      player.ContractBonus5,
      player.ContractBonus6,
      player.ContractBonus7,
    ];

    const salary = salaryFields[yearIndex] || 0;
    const bonus = bonusFields[yearIndex] || 0;

    // Cap hit = salary + bonus (both in same units ~$10K)
    return (salary + bonus) * 0.01;
  }

  /**
   * Execute expansion draft with selected players.
   * Properly removes players from source teams (roster + depth chart)
   * and adds them to expansion team rosters.
   * @param filePath - Path to the franchise file
   * @param selections - Array of player selections (playerRecordIndex + newTeamIndex)
   * @param expansionTeamIndices - Optional array of team indices that should be cleared before draft
   *                               (handles edge case where teams like Browns may have leftover players)
   */
  async executeExpansionDraft(
    filePath: string,
    selections: ExpansionDraftSelection[],
    expansionTeamIndices?: number[]
  ): Promise<{ success: boolean; playersSelected: number; error?: string }> {
    try {
      const franchise = this.getFranchise(filePath);
      if (!franchise) {
        throw new Error('Franchise file not loaded');
      }

      console.log(`[executeExpansionDraft] Starting with ${selections.length} selections`);
      console.log(`[executeExpansionDraft] expansionTeamIndices param:`, expansionTeamIndices);
      console.log(`[executeExpansionDraft] expansionTeamIndices type:`, typeof expansionTeamIndices);
      if (expansionTeamIndices?.length) {
        console.log(`[executeExpansionDraft] Expansion team indices to clear: ${expansionTeamIndices.join(', ')}`);
      } else {
        console.log(`[executeExpansionDraft] WARNING: No expansion team indices provided!`);
      }

      // Get player table
      let playerTable = franchise.getTableByName('Player');
      if (!playerTable) {
        playerTable = franchise.getTableByUniqueId(TABLE_IDS.playerTable);
      }
      if (!playerTable) {
        throw new Error('Player table not found');
      }
      await playerTable.readRecords();

      // Get team table for roster refs
      const teamTable = franchise.getTableByUniqueId(TABLE_IDS.teamTable);
      await teamTable.readRecords();

      // Build expansion team roster refs - include BOTH:
      // 1. Teams that are targets in selections
      // 2. Teams explicitly listed in expansionTeamIndices (to handle edge cases like Browns)
      const expansionRosterRefs = new Map<number, { tableId: number; rowNumber: number }>();
      const teamsToClear = new Set<number>(expansionTeamIndices || []);

      // Also add teams from selections
      for (const sel of selections) {
        teamsToClear.add(sel.newTeamIndex);
      }

      for (const team of teamTable.records) {
        if (team.isEmpty) continue;
        const teamIdx = Number(team.TeamIndex);
        // Get roster ref for any team that should be cleared
        if (teamsToClear.has(teamIdx)) {
          const rosterRef = team.getReferenceDataByKey('Roster');
          if (rosterRef) {
            expansionRosterRefs.set(teamIdx, { tableId: rosterRef.tableId, rowNumber: rosterRef.rowNumber });
          }
        }
      }

      // Move existing players on expansion teams to Free Agency (TeamIndex 32)
      // This must happen BEFORE clearing the roster to ensure players aren't orphaned
      const FREE_AGENT_TEAM_INDEX = 32;

      // Debug: Count players per team before clearing
      const teamCounts = new Map<number, number>();
      for (const player of playerTable.records) {
        if (player.isEmpty) continue;
        const tIdx = Number(player.TeamIndex);
        teamCounts.set(tIdx, (teamCounts.get(tIdx) || 0) + 1);
      }
      console.log(`[executeExpansionDraft] Teams to clear: ${Array.from(teamsToClear).join(', ')}`);
      for (const teamIdx of teamsToClear) {
        console.log(`[executeExpansionDraft] Team ${teamIdx} has ${teamCounts.get(teamIdx) || 0} players BEFORE clearing`);
      }

      let totalMovedToFA = 0;
      const playerRefsToAddToFA: string[] = [];

      for (const teamIdx of teamsToClear) {
        let movedToFA = 0;
        for (const player of playerTable.records) {
          if (player.isEmpty) continue;
          const playerTeamIndex = Number(player.TeamIndex);
          if (playerTeamIndex === teamIdx) {
            const playerName = `${player.FirstName || ''} ${player.LastName || ''}`.trim();
            console.log(`[executeExpansionDraft] Moving ${playerName} from expansion team ${teamIdx} to FA`);
            player.TeamIndex = FREE_AGENT_TEAM_INDEX;

            // Set FA status fields
            try { player.ContractStatus = 'FreeAgent'; } catch (e) { /* field may not exist */ }
            try {
              player.ContractLength = 0;
              player.ContractYear = 0;
              for (let i = 0; i < 8; i++) {
                try {
                  player[`ContractSalary${i}`] = 0;
                  player[`ContractBonus${i}`] = 0;
                } catch (e) { /* Some years may not exist */ }
              }
              player.PLYR_CONSECYEARSWITHTEAM = 0;
              player.PLYR_ISCAPTAIN = false;
            } catch (e) { /* Fields may not exist */ }

            // Collect player reference for FA array
            const tableId = playerTable.header.tableId;
            const rowNumber = player.index;
            const tableBits = tableId.toString(2).padStart(15, '0');
            const rowBits = rowNumber.toString(2).padStart(17, '0');
            const playerRef = tableBits + rowBits;
            playerRefsToAddToFA.push(playerRef);

            movedToFA++;
          }
        }
        console.log(`[executeExpansionDraft] Moved ${movedToFA} players from team ${teamIdx} to Free Agency`);
        totalMovedToFA += movedToFA;
      }
      console.log(`[executeExpansionDraft] TOTAL moved to FA from expansion teams: ${totalMovedToFA}`);

      // Add players to FA array for game visibility
      if (playerRefsToAddToFA.length > 0) {
        const addedToFAArray = await this.addPlayersToFAArrayBulk(franchise, playerRefsToAddToFA);
        console.log(`[executeExpansionDraft] Added ${addedToFAArray} players to FA array (table 5930)`);
      }

      // Clear expansion team rosters before adding drafted players
      // This handles edge case where Browns (TeamIndex 4) might have leftover players
      for (const [teamIdx, rosterRef] of expansionRosterRefs) {
        console.log(`[executeExpansionDraft] Clearing roster for expansion team ${teamIdx}`);
        const rosterTable = franchise.getTableById(rosterRef.tableId);
        await rosterTable.readRecords();
        const rosterRecord = rosterTable.records[rosterRef.rowNumber];

        if (rosterRecord) {
          // Clear all player slots
          const originalSize = rosterRecord.arraySize || 0;
          for (let i = 0; i < originalSize; i++) {
            rosterRecord[`Player${i}`] = ZERO_REF;
          }
          // Reset array size to 0
          rosterRecord.arraySize = 0;
          rosterTable.arraySizes[rosterRef.rowNumber] = 0;
          rosterRecord.isChanged = true;
          rosterRecord._parent.onEvent('change', rosterRecord);
          console.log(`[executeExpansionDraft] Cleared ${originalSize} players from team ${teamIdx} roster`);
        }
      }

      let playersSelected = 0;

      for (const selection of selections) {
        const player = playerTable.records[selection.playerRecordIndex];
        if (!player || player.isEmpty) continue;

        const playerName = `${player.FirstName || ''} ${player.LastName || ''}`.trim();
        const oldTeamIndex = Number(player.TeamIndex);
        const newTeamIndex = selection.newTeamIndex;

        console.log(`[executeExpansionDraft] Processing: ${playerName} (${oldTeamIndex} -> ${newTeamIndex})`);

        // 1. Get player's reference string
        const playerRef = await this.getPlayerReference(franchise, selection.playerRecordIndex);
        if (!playerRef) {
          console.log(`[executeExpansionDraft] Could not get player ref for ${playerName}`);
          continue;
        }

        // 2. Remove from source team (roster + depth chart)
        if (oldTeamIndex >= 0 && oldTeamIndex < 32) {
          await this.cleanupPlayerFromTeam(franchise, playerRef, oldTeamIndex);
        }

        // 3. Add to expansion team roster
        const expansionRosterRef = expansionRosterRefs.get(newTeamIndex);
        if (expansionRosterRef) {
          await this.addPlayerToRoster(franchise, playerRef, expansionRosterRef);
        } else {
          console.log(`[executeExpansionDraft] No roster ref for expansion team ${newTeamIndex}`);
        }

        // 4. Update player's TeamIndex
        player.TeamIndex = newTeamIndex;

        playersSelected++;
        console.log(`[executeExpansionDraft] Drafted "${playerName}" from team ${oldTeamIndex} to team ${newTeamIndex}`);
      }

      console.log(`[executeExpansionDraft] Complete: ${playersSelected} players selected`);

      return { success: true, playersSelected };
    } catch (error: any) {
      console.error('[executeExpansionDraft] Error:', error);
      return { success: false, playersSelected: 0, error: error.message };
    }
  }

  /**
   * Load and validate a franchise file
   */
  async loadFranchiseFile(filePath: string): Promise<FranchiseMetadata> {
    try {
      console.log('[RetroEditorService] Loading franchise file:', filePath);

      // Check if file exists
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }

      // Get the franchise module (ESM dynamic import)
      const module = await getFranchiseModule();
      console.log('[RetroEditorService] Franchise module loaded');

      // The module exports both default (FranchiseFile class) and named 'create' function
      // Use the 'create' named export which is the static factory method
      const createFranchise = module.create;
      if (!createFranchise) {
        throw new Error('madden-franchise module does not export create function');
      }

      console.log('[RetroEditorService] Creating franchise instance for:', filePath);
      const franchise = await createFranchise(filePath);
      console.log('[RetroEditorService] Franchise file parsed successfully');
      console.log('[RetroEditorService] Tables count:', franchise.tables?.length || 0);

      // Store instance for later operations (using normalized path for consistent lookup)
      this.setFranchise(filePath, franchise);

      // Try to find the season info table
      // First, let's see what tables exist
      if (franchise.tables && franchise.tables.length > 0) {
        console.log('[RetroEditorService] Available tables (first 10):');
        franchise.tables.slice(0, 10).forEach((t: any, i: number) => {
          console.log(`  [${i}] name: ${t.name}, uniqueId: ${t.header?.uniqueId || 'N/A'}`);
        });
      }

      // Get season info table - try by name first, then by unique ID
      let seasonInfoTable = franchise.getTableByName('SeasonInfo');
      if (!seasonInfoTable) {
        seasonInfoTable = franchise.getTableByUniqueId(TABLE_IDS.seasonInfoTable);
      }

      if (!seasonInfoTable) {
        // List all tables to help debug
        console.log('[RetroEditorService] All table names:');
        franchise.tables?.forEach((t: any) => console.log(`  - ${t.name}`));
        throw new Error('Could not find SeasonInfo table in franchise file');
      }

      console.log('[RetroEditorService] Found SeasonInfo table');

      // Read season info
      await seasonInfoTable.readRecords();
      const seasonRecord = seasonInfoTable.records[0];

      // Log available fields
      console.log('[RetroEditorService] SeasonInfo record fields:', Object.keys(seasonRecord || {}).slice(0, 20));

      const currentSeasonYear = seasonRecord?.SeasonYear || seasonRecord?.CurrentSeasonYear || 2025;
      const superBowlNumber = seasonRecord?.SuperBowlNumber || seasonRecord?.BaseSuperBowlNumber || 59;

      // Get team count
      let teamTable = franchise.getTableByName('Team');
      if (!teamTable) {
        teamTable = franchise.getTableByUniqueId(TABLE_IDS.teamTable);
      }

      let teamCount = 32;
      if (teamTable) {
        await teamTable.readRecords();
        teamCount = teamTable.records.filter((r: any) => !r.isEmpty).length;
      }

      console.log('[RetroEditorService] Franchise loaded successfully');
      console.log(`  Season Year: ${currentSeasonYear}`);
      console.log(`  Super Bowl: ${superBowlNumber}`);
      console.log(`  Teams: ${teamCount}`);

      return {
        filePath,
        gameYear: 'M26',
        currentSeasonYear,
        superBowlNumber,
        teamCount,
        valid: true
      };

    } catch (error: any) {
      console.error('[RetroEditorService] Error loading franchise file:', error);
      console.error('[RetroEditorService] Error stack:', error.stack);
      return {
        filePath,
        gameYear: 'unknown',
        currentSeasonYear: 0,
        superBowlNumber: 0,
        teamCount: 0,
        valid: false,
        error: error.message
      };
    }
  }

  /**
   * Preview changes for a given year without applying them
   */
  async previewChanges(filePath: string, targetYear: number): Promise<PreviewChanges> {
    const franchise = this.getFranchise(filePath);
    if (!franchise) {
      throw new Error('Franchise file not loaded. Call loadFranchiseFile first.');
    }

    // Get current season info
    const seasonInfoTable = franchise.getTableByUniqueId(TABLE_IDS.seasonInfoTable);
    await seasonInfoTable.readRecords();
    const seasonRecord = seasonInfoTable.records[0];

    const currentYear = seasonRecord.SeasonYear || seasonRecord.CurrentSeasonYear || 2025;
    const currentSuperBowl = seasonRecord.SuperBowlNumber || seasonRecord.BaseSuperBowlNumber || 59;
    const newSuperBowl = this.superBowlMapping[targetYear.toString()] || 1;

    // Calculate team changes
    const teamChanges: TeamNameChange[] = [];
    let teamTable = franchise.getTableByUniqueId(TABLE_IDS.teamTable);
    if (!teamTable) {
      teamTable = franchise.getTableByName('Team');
    }

    if (teamTable) {
      await teamTable.readRecords();

      // Iterate through records by index position
      for (let i = 0; i < teamTable.records.length; i++) {
        const teamRecord = teamTable.records[i];
        if (teamRecord.isEmpty) continue;

        const team = this.historicalTeams.find(t => t.teamIndex === i);
        if (!team) continue;

        const change = this.getTeamInfoForYear(team, targetYear);
        if (change && !change.inactive && (change.city !== team.currentCity || change.name !== team.currentName)) {
          teamChanges.push({
            teamIndex: i,
            originalCity: team.currentCity,
            originalName: team.currentName,
            newCity: change.city || team.currentCity,
            newName: change.name || team.currentName,
            newAbbreviation: change.abbreviation || ''
          });
        }
      }
    }

    // Calculate inactive teams for draft reordering
    const inactiveTeams = this.getInactiveTeamsForYear(targetYear);

    // Estimate picks to reorder
    const draftPickTable = franchise.getTableByUniqueId(TABLE_IDS.draftPickTable);
    let picksToReorder = 0;
    if (draftPickTable) {
      await draftPickTable.readRecords();
      picksToReorder = draftPickTable.records.filter((r: any) => {
        const teamIndex = r.TeamIndex || r.teamIndex;
        return inactiveTeams.some(t => t.teamIndex === teamIndex);
      }).length;
    }

    return {
      seasonChanges: {
        currentYear,
        newYear: targetYear,
        currentSuperBowl,
        newSuperBowl
      },
      teamChanges,
      draftChanges: {
        inactiveTeams: inactiveTeams.map(t => t.team),
        picksToReorder
      }
    };
  }

  /**
   * Set the season year, calendar year, Super Bowl number, and regular season week count
   *
   * IMPORTANT: SeasonInfo table fields control the in-game year display:
   * - CurrentSeasonYear: The current season year (e.g., 1976)
   * - BaseCalendarYear: The base calendar year
   * - BaseSuperBowlNumber: The base Super Bowl number
   */
  async setSeasonYear(filePath: string, year: number): Promise<void> {
    const franchise = this.getFranchise(filePath);
    if (!franchise) {
      throw new Error('Franchise file not loaded. Call loadFranchiseFile first.');
    }

    console.log(`[RetroEditorService] Setting season year to ${year}`);

    const seasonInfoTable = franchise.getTableByUniqueId(TABLE_IDS.seasonInfoTable);
    await seasonInfoTable.readRecords();
    const seasonRecord = seasonInfoTable.records[0];

    // Log all available fields in SeasonInfo
    const fieldNames = Object.keys(seasonRecord).filter(k => !k.startsWith('_') && typeof seasonRecord[k] !== 'function');
    console.log('[RetroEditorService] SeasonInfo fields:', fieldNames);

    // Log BEFORE values
    console.log('[RetroEditorService] BEFORE changes:');
    console.log(`  CurrentSeasonYear: ${seasonRecord.CurrentSeasonYear}`);
    console.log(`  BaseCalendarYear: ${seasonRecord.BaseCalendarYear}`);
    console.log(`  BaseSuperBowlNumber: ${seasonRecord.BaseSuperBowlNumber}`);

    // Get Super Bowl number for this year
    const superBowlNumber = this.superBowlMapping[year.toString()] || 1;

    // Get regular season week count for this era
    const { scheduleService } = await import('./ScheduleService');
    await scheduleService.initialize();
    const era = scheduleService.getSeasonEra(year);
    // regularSeasonWeeks: how many weeks of regular season games
    // Pre-1990 (no byes): 16 weeks for 16 games
    // 1990-2020 (with byes): 17 weeks for 16 games
    // 2021+ (17-game season): 18 weeks for 17 games
    const regularSeasonWeeks = era?.regularSeasonWeeks || (era?.byeWeeks ? 17 : era?.seasonLength || 18);
    console.log(`[RetroEditorService] Era for ${year}: ${era?.seasonLength} games, ${regularSeasonWeeks} regular season weeks, byes: ${era?.byeWeeks}`);

    // Update season info fields
    // NOTE: Don't use 'X' in obj check - properties are on prototype as getters/setters
    // Just try to set and catch any errors
    let changesApplied = 0;

    try {
      const oldVal = seasonRecord.CurrentSeasonYear;
      console.log(`[RetroEditorService] Setting CurrentSeasonYear: ${oldVal} -> ${year}`);
      seasonRecord.CurrentSeasonYear = year;
      console.log(`[RetroEditorService] CurrentSeasonYear after set: ${seasonRecord.CurrentSeasonYear}`);
      changesApplied++;
    } catch (e: any) {
      console.error(`[RetroEditorService] Failed to set CurrentSeasonYear: ${e.message}`);
    }

    try {
      const oldVal = seasonRecord.BaseCalendarYear;
      console.log(`[RetroEditorService] Setting BaseCalendarYear: ${oldVal} -> ${year}`);
      seasonRecord.BaseCalendarYear = year;
      console.log(`[RetroEditorService] BaseCalendarYear after set: ${seasonRecord.BaseCalendarYear}`);
      changesApplied++;
    } catch (e: any) {
      console.error(`[RetroEditorService] Failed to set BaseCalendarYear: ${e.message}`);
    }

    try {
      const oldVal = seasonRecord.BaseSuperBowlNumber;
      console.log(`[RetroEditorService] Setting BaseSuperBowlNumber: ${oldVal} -> ${superBowlNumber}`);
      seasonRecord.BaseSuperBowlNumber = superBowlNumber;
      console.log(`[RetroEditorService] BaseSuperBowlNumber after set: ${seasonRecord.BaseSuperBowlNumber}`);
      changesApplied++;
    } catch (e: any) {
      console.error(`[RetroEditorService] Failed to set BaseSuperBowlNumber: ${e.message}`);
    }

    // NOTE: We intentionally do NOT change NflseasonWeekCount here!
    // Changing the week count without also updating the schedule data causes Madden to crash.
    // The schedule application will handle this if needed, or we keep the default 18 weeks.
    // if ('NflseasonWeekCount' in seasonRecord) {
    //   console.log(`[RetroEditorService] Setting NflseasonWeekCount: ${seasonRecord.NflseasonWeekCount} -> ${regularSeasonWeeks}`);
    //   seasonRecord.NflseasonWeekCount = regularSeasonWeeks;
    //   changesApplied++;
    // }
    console.log(`[RetroEditorService] NOTE: Keeping NflseasonWeekCount at ${seasonRecord.NflseasonWeekCount} (not changing to ${regularSeasonWeeks})`);
    console.log(`[RetroEditorService] Changing week count without schedule update causes Madden crash`);

    // Log AFTER values to verify changes took effect
    console.log('[RetroEditorService] AFTER changes:');
    console.log(`  CurrentSeasonYear: ${seasonRecord.CurrentSeasonYear}`);
    console.log(`  BaseCalendarYear: ${seasonRecord.BaseCalendarYear}`);
    console.log(`  BaseSuperBowlNumber: ${seasonRecord.BaseSuperBowlNumber}`);
    console.log(`[RetroEditorService] Applied ${changesApplied} field changes`);
    console.log(`[RetroEditorService] Set season year to ${year}, Super Bowl ${superBowlNumber}, weeks ${regularSeasonWeeks}`);
  }

  /**
   * Update team names based on the selected year
   */
  async updateTeamNames(filePath: string, year: number): Promise<TeamNameChange[]> {
    const franchise = this.getFranchise(filePath);
    if (!franchise) {
      throw new Error('Franchise file not loaded. Call loadFranchiseFile first.');
    }

    console.log(`[RetroEditorService] Updating team names for year ${year}`);

    // Try to get team table by unique ID first, then by name
    let teamTable = franchise.getTableByUniqueId(TABLE_IDS.teamTable);
    if (!teamTable) {
      teamTable = franchise.getTableByName('Team');
    }
    if (!teamTable) {
      console.error('[RetroEditorService] Could not find Team table!');
      return [];
    }

    await teamTable.readRecords();
    console.log(`[RetroEditorService] Found ${teamTable.records.length} team records`);

    // Log first record fields to understand structure
    if (teamTable.records.length > 0) {
      const firstRecord = teamTable.records[0];
      const fieldNames = Object.keys(firstRecord).filter(k => !k.startsWith('_') && typeof firstRecord[k] !== 'function');
      console.log('[RetroEditorService] Team table fields:', fieldNames.slice(0, 20));
    }

    const changes: TeamNameChange[] = [];

    // IMPORTANT: TeamIndex != RecordIndex in Madden franchise files!
    // TeamIndex is the team's ID (0-31), RecordIndex is the position in the table
    // We must match by TeamIndex field, not by array position
    for (const teamRecord of teamTable.records) {
      if (teamRecord.isEmpty) continue;

      const teamIndex = teamRecord.TeamIndex;
      if (teamIndex === undefined || teamIndex >= 32) continue; // Skip non-NFL teams (AFC, NFC, FA)

      // Find the historical team that matches this TeamIndex
      const team = this.historicalTeams.find(t => t.teamIndex === teamIndex);
      if (!team) {
        console.log(`[RetroEditorService] No historical data for TeamIndex ${teamIndex}`);
        continue;
      }

      const change = this.getTeamInfoForYear(team, year);
      if (!change) {
        console.log(`[RetroEditorService] No change found for ${team.currentName} in year ${year}`);
        continue;
      }

      if (change.inactive) {
        console.log(`[RetroEditorService] Team ${team.currentName} is inactive for year ${year}`);
        continue;
      }

      // Get current values from the franchise file (what's actually in the file now)
      const franchiseCity = teamRecord.LongName || '';
      const franchiseName = teamRecord.DisplayName || teamRecord.NickName || '';
      const franchiseAbbr = teamRecord.ShortName || '';

      // Get target values for this year
      const targetCity = change.city || '';
      const targetName = change.name || '';
      const targetAbbr = change.abbreviation || '';

      // Check if any field needs updating (compare franchise file vs target year)
      const needsUpdate = targetCity !== franchiseCity ||
                          targetName !== franchiseName ||
                          targetAbbr !== franchiseAbbr;

      console.log(`[RetroEditorService] TeamIndex ${teamIndex} (${team.currentName}): franchise=[${franchiseCity}|${franchiseName}|${franchiseAbbr}] target=[${targetCity}|${targetName}|${targetAbbr}] needsUpdate=${needsUpdate}`);

      if (!needsUpdate) {
        continue;
      }

      const originalCity = franchiseCity || team.currentCity;
      const originalName = franchiseName || team.currentName;

      console.log(`[RetroEditorService] Applying change to TeamIndex ${teamIndex}: ${originalCity} ${originalName} -> ${change.city} ${change.name}`);

      // Update team fields - Madden field meanings:
      // LongName = City name only (e.g., "Houston")
      // DisplayName = Team name display (e.g., "Oilers")
      // ShortName = 2-3 letter abbreviation (e.g., "HOU")
      // NickName = Short nickname (e.g., "Oilers")
      if (teamRecord.LongName !== undefined && change.city) {
        teamRecord.LongName = change.city;
        console.log(`[RetroEditorService]   Set LongName = "${change.city}"`);
      }
      if (teamRecord.DisplayName !== undefined && change.name) {
        teamRecord.DisplayName = change.name;
        console.log(`[RetroEditorService]   Set DisplayName = "${change.name}"`);
      }
      if (teamRecord.ShortName !== undefined && change.abbreviation) {
        teamRecord.ShortName = change.abbreviation;
        console.log(`[RetroEditorService]   Set ShortName = "${change.abbreviation}"`);
      }
      if (teamRecord.NickName !== undefined && change.name) {
        teamRecord.NickName = change.name;
        console.log(`[RetroEditorService]   Set NickName = "${change.name}"`);
      }

      changes.push({
        teamIndex,
        originalCity,
        originalName,
        newCity: change.city || team.currentCity,
        newName: change.name || team.currentName,
        newAbbreviation: change.abbreviation || ''
      });

      console.log(`[RetroEditorService] Updated: ${originalCity} ${originalName} -> ${change.city} ${change.name}`);
    }

    console.log(`[RetroEditorService] Total team changes: ${changes.length}`);
    return changes;
  }

  /**
   * Reorder draft picks for expansion year - assign picks to expansion teams at specified positions
   */
  async reorderDraftPicks(filePath: string, year: number): Promise<number> {
    const franchise = this.getFranchise(filePath);
    if (!franchise) {
      throw new Error('Franchise file not loaded. Call loadFranchiseFile first.');
    }

    console.log(`[RetroEditorService] Reordering draft picks for year ${year}`);

    const draftPickTable = franchise.getTableByUniqueId(TABLE_IDS.draftPickTable);
    if (!draftPickTable) {
      console.log('[RetroEditorService] No draft pick table found');
      return 0;
    }

    await draftPickTable.readRecords();

    // Get draft pick compensation for this year
    const compensation = this.draftPickCompensation[year.toString()];
    if (!compensation || !compensation.teams || !compensation.pickPositions) {
      console.log(`[RetroEditorService] No draft pick compensation data for ${year}, using default inactive team logic`);
      return this.reorderDraftPicksForInactiveTeams(draftPickTable, year);
    }

    console.log(`[RetroEditorService] Applying expansion draft pick compensation for ${year}`);
    console.log(`[RetroEditorService] Expansion teams: ${compensation.teams.map((t: any) => t.name).join(', ')}`);

    const expansionTeamIndices = new Set(compensation.teams.map((t: any) => t.teamIndex));
    let assignedCount = 0;

    // Group picks by round
    const picksByRound = new Map<number, any[]>();
    for (const pick of draftPickTable.records) {
      if (pick.isEmpty) continue;
      const round = pick.Round || pick.round || 1;
      if (!picksByRound.has(round)) {
        picksByRound.set(round, []);
      }
      picksByRound.get(round)!.push(pick);
    }

    // For each round, assign picks according to compensation rules
    for (const [round, picks] of picksByRound) {
      const roundPositions = compensation.pickPositions[round.toString()];
      if (!roundPositions) continue;

      // Sort picks by current pick number
      picks.sort((a, b) => (a.PickNumber || a.pickNumber || 0) - (b.PickNumber || b.pickNumber || 0));

      // For each expansion team, assign their pick at the specified position
      for (let teamIdx = 0; teamIdx < compensation.teams.length; teamIdx++) {
        const team = compensation.teams[teamIdx];
        const position = roundPositions[teamIdx];
        if (!position) continue;

        // Find a pick owned by the expansion team or reassign one
        let expansionPick = picks.find((p: any) => {
          const pTeam = p.TeamIndex || p.teamIndex || p.OriginalTeam;
          return pTeam === team.teamIndex;
        });

        if (!expansionPick) {
          // No pick for this team yet - find a pick to reassign
          // Take the last pick in the round from a non-expansion team
          for (let i = picks.length - 1; i >= 0; i--) {
            const pTeam = picks[i].TeamIndex || picks[i].teamIndex || picks[i].OriginalTeam;
            if (!expansionTeamIndices.has(pTeam)) {
              expansionPick = picks[i];
              // Assign to expansion team
              // NOTE: Don't use 'in' check - properties are on prototype
              try { expansionPick.TeamIndex = team.teamIndex; } catch (e) { /* field may not exist */ }
              try { expansionPick.teamIndex = team.teamIndex; } catch (e) { /* field may not exist */ }
              try { expansionPick.OriginalTeam = team.teamIndex; } catch (e) { /* field may not exist */ }
              console.log(`[RetroEditorService] Assigned pick in round ${round} position ${position} to ${team.name}`);
              assignedCount++;
              break;
            }
          }
        }
      }

      // Re-sort picks to put expansion teams at their designated positions
      picks.sort((a, b) => {
        const aTeam = a.TeamIndex || a.teamIndex || a.OriginalTeam;
        const bTeam = b.TeamIndex || b.teamIndex || b.OriginalTeam;
        const aExpIdx = compensation.teams.findIndex((t: any) => t.teamIndex === aTeam);
        const bExpIdx = compensation.teams.findIndex((t: any) => t.teamIndex === bTeam);

        if (aExpIdx >= 0 && bExpIdx < 0) {
          // a is expansion team, b is not
          const aPos = roundPositions[aExpIdx] || 99;
          const bPos = b.PickNumber || b.pickNumber || 99;
          return aPos - bPos;
        }
        if (bExpIdx >= 0 && aExpIdx < 0) {
          // b is expansion team, a is not
          const bPos = roundPositions[bExpIdx] || 99;
          const aPos = a.PickNumber || a.pickNumber || 99;
          return aPos - bPos;
        }
        if (aExpIdx >= 0 && bExpIdx >= 0) {
          // Both expansion teams
          return (roundPositions[aExpIdx] || 99) - (roundPositions[bExpIdx] || 99);
        }
        // Neither expansion team - maintain original order
        return (a.PickNumber || a.pickNumber || 0) - (b.PickNumber || b.pickNumber || 0);
      });

      // Reassign pick numbers
      // NOTE: Don't use 'in' check - properties are on prototype
      picks.forEach((pick, index) => {
        try { pick.PickNumber = index + 1; } catch (e) { /* field may not exist */ }
        try { pick.pickNumber = index + 1; } catch (e) { /* field may not exist */ }
      });
    }

    console.log(`[RetroEditorService] Assigned/reordered ${assignedCount} picks for expansion teams`);
    return assignedCount;
  }

  /**
   * Fallback: Reorder draft picks for years without specific compensation data
   */
  private reorderDraftPicksForInactiveTeams(draftPickTable: any, year: number): number {
    const inactiveTeams = this.getInactiveTeamsForYear(year);
    const inactiveTeamIndices = new Set(inactiveTeams.map(t => t.teamIndex));

    if (inactiveTeamIndices.size === 0) {
      console.log('[RetroEditorService] No inactive teams for this year');
      return 0;
    }

    let reorderedCount = 0;

    // Group picks by round
    const picksByRound = new Map<number, any[]>();
    for (const pick of draftPickTable.records) {
      if (pick.isEmpty) continue;
      const round = pick.Round || pick.round || 1;
      if (!picksByRound.has(round)) {
        picksByRound.set(round, []);
      }
      picksByRound.get(round)!.push(pick);
    }

    // For each round, move inactive team picks to the end
    for (const [round, picks] of picksByRound) {
      picks.sort((a, b) => {
        const aTeamIndex = a.TeamIndex || a.teamIndex;
        const bTeamIndex = b.TeamIndex || b.teamIndex;
        const aInactive = inactiveTeamIndices.has(aTeamIndex);
        const bInactive = inactiveTeamIndices.has(bTeamIndex);

        if (aInactive && !bInactive) return 1;
        if (!aInactive && bInactive) return -1;
        return (a.PickNumber || a.pickNumber || 0) - (b.PickNumber || b.pickNumber || 0);
      });

      picks.forEach((pick, index) => {
        const teamIndex = pick.TeamIndex || pick.teamIndex;
        if (inactiveTeamIndices.has(teamIndex)) {
          reorderedCount++;
        }
        // NOTE: Don't use 'in' check - properties are on prototype
        try { pick.PickNumber = index + 1; } catch (e) { /* field may not exist */ }
        try { pick.pickNumber = index + 1; } catch (e) { /* field may not exist */ }
      });
    }

    console.log(`[RetroEditorService] Reordered ${reorderedCount} picks for inactive teams`);
    return reorderedCount;
  }

  /**
   * Get current team list from historical teams data
   */
  async getTeamList(filePath: string): Promise<any[]> {
    // Use historicalTeams which is already loaded from historical-teams.json
    return this.historicalTeams.map(team => ({
      teamIndex: team.teamIndex,
      longName: team.currentCity,
      displayName: team.currentName,
      shortName: team.currentName,
      abbreviation: team.currentAbbreviation
    }));
  }

  /**
   * Save the modified franchise file (overwrite original)
   */
  async saveFranchiseFile(filePath: string): Promise<void> {
    console.log(`[RetroEditorService] Saving franchise file: ${filePath}`);

    const franchise = this.getFranchise(filePath);
    if (!franchise) {
      throw new Error('Franchise file not loaded. Call loadFranchiseFile first.');
    }

    // VERIFY: Check player counts before save to confirm changes are in memory
    try {
      const playerTable = franchise.getTableByName('Player');
      if (playerTable && playerTable.records) {
        let panthers = 0, jaguars = 0, fa = 0;
        for (const p of playerTable.records) {
          if (p.isEmpty) continue;
          const ti = Number(p.TeamIndex);
          if (ti === 20) panthers++;
          if (ti === 16) jaguars++;
          if (ti === 32) fa++;
        }
        console.log(`[RetroEditorService] PRE-SAVE STATE: Panthers=${panthers}, Jaguars=${jaguars}, FA=${fa}`);
      }

      const seasonInfo = franchise.getTableByName('SeasonInfo');
      if (seasonInfo && seasonInfo.records && seasonInfo.records[0]) {
        console.log(`[RetroEditorService] PRE-SAVE Super Bowl: ${seasonInfo.records[0].BaseSuperBowlNumber}`);
      }
    } catch (e) {
      console.log('[RetroEditorService] Could not verify pre-save state');
    }

    await franchise.save(filePath);
    console.log('[RetroEditorService] Save complete');
  }

  /**
   * Save the modified franchise file to a new location (Save As)
   */
  async saveFranchiseFileAs(originalPath: string, newPath: string): Promise<void> {
    const franchise = this.getFranchise(originalPath);
    if (!franchise) {
      throw new Error('Franchise file not loaded. Call loadFranchiseFile first.');
    }

    console.log('[RetroEditorService] Saving franchise file as:', newPath);
    await franchise.save(newPath);
    console.log('[RetroEditorService] Franchise file saved successfully to:', newPath);

    // Update the instance map to use the new path
    this.deleteFranchise(originalPath);
    this.setFranchise(newPath, franchise);
  }

  /**
   * Close a franchise file and release resources
   */
  closeFranchiseFile(filePath: string): void {
    this.deleteFranchise(filePath);
    console.log('[RetroEditorService] Closed franchise file:', filePath);
  }

  /**
   * Create a backup copy of the franchise file before making changes
   * Backup is created with timestamp suffix: FILENAME_backup_YYYYMMDD_HHMMSS
   */
  async createBackup(filePath: string): Promise<string> {
    const path = require('path');

    // Generate backup filename with timestamp
    const dir = path.dirname(filePath);
    const baseName = path.basename(filePath);
    const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14); // YYYYMMDDHHMMSS
    const backupName = `${baseName}_backup_${timestamp}`;
    const backupPath = path.join(dir, backupName);

    console.log('[RetroEditorService] Creating backup:', backupPath);

    // Copy the file
    fs.copyFileSync(filePath, backupPath);

    console.log('[RetroEditorService] Backup created successfully');
    return backupPath;
  }

  /**
   * Helper: Get team info for a specific year
   */
  private getTeamInfoForYear(team: HistoricalTeam, year: number): TeamChange | null {
    if (!team.changes || team.changes.length === 0) {
      return null;
    }

    for (const change of team.changes) {
      if (year >= change.yearRange[0] && year <= change.yearRange[1]) {
        return change;
      }
    }

    return null;
  }

  /**
   * Helper: Get list of teams that should be inactive for a given year
   * This considers both expansion teams that didn't exist yet AND special cases like Browns 1996-1998
   */
  private getInactiveTeamsForYear(year: number): ExpansionTeam[] {
    // Get expansion teams that didn't exist yet
    const inactiveExpansion = this.expansionHistory.filter(team => team.year > year);

    // Check special cases (like Browns 1996-1998)
    const specialInactive: ExpansionTeam[] = [];
    for (const [key, specialCase] of Object.entries(this.specialCases)) {
      if (specialCase.inactiveYears && specialCase.inactiveYears.includes(year)) {
        specialInactive.push({
          team: key.charAt(0).toUpperCase() + key.slice(1), // Capitalize
          teamIndex: specialCase.teamIndex,
          year: specialCase.inactiveYears[0],
          note: specialCase.note
        });
      }
    }

    return [...inactiveExpansion, ...specialInactive];
  }

  /**
   * Helper: Check if a specific team is active in a given year
   */
  private isTeamActiveInYear(teamIndex: number, year: number): boolean {
    // Check if team is in expansion history and hasn't joined yet
    const expansion = this.expansionHistory.find(t => t.teamIndex === teamIndex);
    if (expansion && expansion.year > year) {
      return false;
    }

    // Check special cases
    for (const specialCase of Object.values(this.specialCases)) {
      if (specialCase.teamIndex === teamIndex && specialCase.inactiveYears.includes(year)) {
        return false;
      }
    }

    return true;
  }

  // ============================================
  // SCHEDULE METHODS
  // ============================================

  /**
   * Get schedule preview for a year
   * Shows what schedule changes would be applied without modifying the file
   */
  async getSchedulePreview(filePath: string, year: number): Promise<{
    available: boolean;
    totalGames: number;
    regularSeasonWeeks: number;
    byeWeeks: boolean;
    seasonLength: number;
    gamesByWeek: Record<number, Array<{ homeTeam: string; awayTeam: string }>>;
    validation: { warnings: string[]; errors: string[] };
  }> {
    // Import schedule service dynamically to avoid circular dependencies
    const { scheduleService } = await import('./ScheduleService');

    await scheduleService.initialize();

    // Check if schedule data exists for this year
    const hasSchedule = scheduleService.hasSchedule(year);
    const era = scheduleService.getSeasonEra(year);

    if (!hasSchedule) {
      return {
        available: false,
        totalGames: 0,
        regularSeasonWeeks: era?.regularSeasonWeeks || 17,
        byeWeeks: era?.byeWeeks || false,
        seasonLength: era?.seasonLength || 16,
        gamesByWeek: {},
        validation: { warnings: [`No schedule data available for ${year}`], errors: [] }
      };
    }

    const schedule = await scheduleService.loadSchedule(year);
    if (!schedule) {
      return {
        available: false,
        totalGames: 0,
        regularSeasonWeeks: era?.regularSeasonWeeks || 17,
        byeWeeks: era?.byeWeeks || false,
        seasonLength: era?.seasonLength || 16,
        gamesByWeek: {},
        validation: { warnings: [`Failed to load schedule for ${year}`], errors: [] }
      };
    }

    // Validate the schedule
    const validationResult = scheduleService.validateScheduleForYear(schedule, year);

    // Group games by week for preview display
    const gamesByWeek: Record<number, Array<{ homeTeam: string; awayTeam: string }>> = {};
    for (const game of schedule.games) {
      if (game.weekType === 'regular') {
        if (!gamesByWeek[game.week]) {
          gamesByWeek[game.week] = [];
        }
        gamesByWeek[game.week].push({
          homeTeam: game.homeTeam,
          awayTeam: game.awayTeam
        });
      }
    }

    return {
      available: true,
      totalGames: schedule.games.length,
      regularSeasonWeeks: schedule.regularSeasonWeeks || 17,
      byeWeeks: schedule.byeWeeksEnabled,
      seasonLength: schedule.seasonLength,
      gamesByWeek,
      validation: { warnings: validationResult.warnings, errors: validationResult.errors }
    };
  }

  /**
   * Apply historical schedule to franchise file
   * Updates the SeasonGame table with historical matchups
   *
   * Strategy: The franchise file has pre-allocated game slots. We need to:
   * 1. Build a TeamIndex → RecordIndex mapping from the Team table
   * 2. Find all regular season game slots (by week type)
   * 3. Group them by week number
   * 4. For each week, assign games from the historical schedule
   * 5. Set both HomeTeam and AwayTeam using proper binary reference format
   */
  async applyHistoricalSchedule(filePath: string, year: number): Promise<{
    success: boolean;
    gamesUpdated: number;
    warnings: string[];
    error?: string;
  }> {
    const franchise = this.getFranchise(filePath);
    if (!franchise) {
      return {
        success: false,
        gamesUpdated: 0,
        warnings: [],
        error: 'Franchise file not loaded. Call loadFranchiseFile first.'
      };
    }

    // Import schedule service
    const { scheduleService } = await import('./ScheduleService');
    await scheduleService.initialize();

    // Load schedule data
    const schedule = await scheduleService.loadSchedule(year);
    if (!schedule) {
      return {
        success: false,
        gamesUpdated: 0,
        warnings: [],
        error: `No schedule data available for ${year}`
      };
    }

    console.log(`[RetroEditorService] Applying schedule for year ${year}: ${schedule.games.length} games`);

    // Update SeasonInfo with correct regular season week count for this era
    // This is critical - tells Madden how many weeks of regular season to expect
    const era = scheduleService.getSeasonEra(year);
    const regularSeasonWeeks = schedule.regularSeasonWeeks || era?.regularSeasonWeeks || (era?.byeWeeks ? 17 : era?.seasonLength || 18);
    // NOTE: We intentionally do NOT change NflseasonWeekCount during schedule application!
    // Based on testing, changing the week count can cause Madden to crash when simming.
    // The game expects 18 weeks of regular season regardless of era.
    // FIX: We also do NOT mark extra weeks as OffSeason - that also causes crashes!
    // Instead, we leave extra game slots untouched with their original matchups.
    console.log(`[RetroEditorService] Historical season has ${regularSeasonWeeks} weeks`);
    console.log(`[RetroEditorService] NOT changing NflseasonWeekCount or marking OffSeason - keeping Madden default to prevent crashes`);
    console.log(`[RetroEditorService] Extra game slots beyond historical schedule will be left untouched`)

    // Get the Team table and build TeamIndex → RecordIndex mapping
    let teamTable = franchise.getTableByUniqueId(TABLE_IDS.teamTable);
    if (!teamTable) {
      teamTable = franchise.getTableByName('Team');
    }
    if (!teamTable) {
      console.error('[RetroEditorService] Could not find Team table!');
      return {
        success: false,
        gamesUpdated: 0,
        warnings: [],
        error: 'Could not find Team table in franchise file'
      };
    }

    await teamTable.readRecords();

    // Build TeamIndex → RecordIndex mapping
    const teamIndexToRecordIndex = new Map<number, number>();
    for (const team of teamTable.records) {
      if (team.isEmpty) continue;
      const teamIndex = team.TeamIndex;
      if (teamIndex !== undefined && teamIndex < 32) { // Only NFL teams (0-31)
        teamIndexToRecordIndex.set(teamIndex, team.index);
      }
    }
    console.log(`[RetroEditorService] Built team mapping for ${teamIndexToRecordIndex.size} teams`);

    // Get the SeasonGame table
    let gameTable = franchise.getTableByUniqueId(TABLE_IDS.gameTable);
    if (!gameTable) {
      gameTable = franchise.getTableByName('SeasonGame');
    }
    if (!gameTable) {
      console.error('[RetroEditorService] Could not find SeasonGame table!');
      return {
        success: false,
        gamesUpdated: 0,
        warnings: [],
        error: 'Could not find SeasonGame table in franchise file'
      };
    }

    await gameTable.readRecords();
    console.log(`[RetroEditorService] Found ${gameTable.records.length} game records`);

    // Debug: Count games by week type
    const weekTypeCounts: Record<string, number> = {};
    let nonEmptyCount = 0;
    for (const record of gameTable.records) {
      if (record.isEmpty) continue;
      nonEmptyCount++;
      const weekType = getGameField(record, 'SeasonWeekType');
      const typeKey = String(weekType);
      weekTypeCounts[typeKey] = (weekTypeCounts[typeKey] || 0) + 1;
    }
    console.log(`[RetroEditorService] Non-empty game records: ${nonEmptyCount}`);
    console.log(`[RetroEditorService] Games by SeasonWeekType:`, weekTypeCounts);

    // Find the reference prefix from an existing game record with teams assigned
    // Format: prefix (24 bits) + record index (8 bits) = 32-bit binary string
    let teamRefPrefix = '001011100011101000000000'; // Default prefix for Team table references

    // Try to extract prefix from an existing game with team assignments
    for (const record of gameTable.records) {
      if (record.isEmpty) continue;
      const homeTeam = record.HomeTeam;
      if (homeTeam && homeTeam !== '00000000000000000000000000000000' && homeTeam.length === 32) {
        teamRefPrefix = homeTeam.slice(0, 24);
        console.log(`[RetroEditorService] Extracted team reference prefix: ${teamRefPrefix}`);
        break;
      }
    }

    // Helper function to create team reference from TeamIndex
    const createTeamRef = (teamIndex: number): string => {
      const recordIndex = teamIndexToRecordIndex.get(teamIndex);
      if (recordIndex === undefined) {
        console.warn(`[RetroEditorService] No record index for TeamIndex ${teamIndex}`);
        return '00000000000000000000000000000000';
      }
      return teamRefPrefix + recordIndex.toString(2).padStart(8, '0');
    };

    const warnings: string[] = [];
    let gamesUpdated = 0;

    // Group schedule games by week for easier matching
    const gamesByWeek = new Map<number, typeof schedule.games>();
    // Separate regular season and preseason games
    const preseasonByWeek = new Map<number, typeof schedule.games>();

    for (const game of schedule.games) {
      if (game.weekType === 'preseason') {
        if (!preseasonByWeek.has(game.week)) {
          preseasonByWeek.set(game.week, []);
        }
        preseasonByWeek.get(game.week)!.push(game);
      } else if (game.weekType === 'regular') {
        if (!gamesByWeek.has(game.week)) {
          gamesByWeek.set(game.week, []);
        }
        gamesByWeek.get(game.week)!.push(game);
      }
    }

    console.log(`[RetroEditorService] Schedule has ${gamesByWeek.size} weeks of regular season games`);
    console.log(`[RetroEditorService] Schedule has ${preseasonByWeek.size} weeks of preseason games`);

    // Group franchise game records by week
    // IMPORTANT: Madden has Week 0 RegularSeason slots that may need special handling.
    // Our historical schedules use Week 1 = first week of regular season.
    // Madden Week 1 = NFL Week 1 (main games), Week 0 may be pre-populated or placeholder.
    const franchiseGamesByWeek = new Map<number, any[]>();
    let hasWeek0RegularSeason = false;
    let week0Count = 0;

    for (const record of gameTable.records) {
      if (record.isEmpty) continue;

      // Get the week number using our helper (handles both schema and generic fields)
      const weekNum = getGameField(record, 'SeasonWeek');
      if (weekNum === undefined || weekNum === null) continue;

      // Get week type (1 = RegularSeason for M26)
      const weekType = getGameField(record, 'SeasonWeekType');
      // Only process regular season games (weekType 1 or 'RegularSeason')
      const isRegularSeason = weekType === 1 || weekType === SEASON_WEEK_TYPES.RegularSeason || weekType === 'RegularSeason';
      if (!isRegularSeason) continue;

      if (weekNum === 0) {
        hasWeek0RegularSeason = true;
        week0Count++;
      }

      if (!franchiseGamesByWeek.has(weekNum)) {
        franchiseGamesByWeek.set(weekNum, []);
      }
      franchiseGamesByWeek.get(weekNum)!.push(record);
    }

    console.log(`[RetroEditorService] Franchise file has ${franchiseGamesByWeek.size} weeks of regular season game slots`);
    console.log(`[RetroEditorService] Has Week 0 RegularSeason: ${hasWeek0RegularSeason} (${week0Count} games)`);

    // NOTE: Week 0 is now handled in the main loop below via the week shift mapping
    // (Madden Week 0 → Historical Week 1)

    // Get max historical week number for this schedule
    const maxHistoricalWeek = Math.max(...gamesByWeek.keys());
    console.log(`[RetroEditorService] Historical schedule max week: ${maxHistoricalWeek}`);

    // Now assign historical games to franchise game slots
    // IMPORTANT: 2011 Throwback uses 0-indexed weeks (Week 0-16 for 17-week season)
    // Our historical schedules use 1-indexed (Week 1-17)
    // So: Madden Week 0 → Historical Week 1, Madden Week 16 → Historical Week 17
    console.log(`[RetroEditorService] ====== WEEK MAPPING ======`);
    const sortedWeeks = [...franchiseGamesByWeek.keys()].sort((a, b) => a - b);
    console.log(`[RetroEditorService] Madden weeks with RegularSeason games: ${sortedWeeks.join(', ')}`);
    console.log(`[RetroEditorService] Historical weeks available: ${[...gamesByWeek.keys()].sort((a, b) => a - b).join(', ')}`);

    for (const [maddenWeekNum, franchiseGames] of franchiseGamesByWeek) {
      try {
        // Map Madden week to historical week (shift by +1)
        // Madden week 0 = Historical week 1, Madden week 16 = Historical week 17
        const historicalWeekNum = maddenWeekNum + 1;
        const historicalGames = gamesByWeek.get(historicalWeekNum);

        if (!historicalGames || historicalGames.length === 0) {
          // No historical games for this week - this happens when:
          // - Madden week >= maxHistoricalWeek (e.g., Madden week 17+ for 17-week seasons)
          // FIX: Do NOT mark as OffSeason - this causes Madden to crash when simming!
          // Instead, leave these games untouched with their original matchups.
          // Madden will still sim these games but with the original teams.
          if (historicalWeekNum > maxHistoricalWeek) {
            console.log(`[RetroEditorService] >>> Madden Week ${maddenWeekNum} → Historical Week ${historicalWeekNum} BEYOND SEASON END (max=${maxHistoricalWeek})`);
            console.log(`[RetroEditorService] >>> SKIPPING ${franchiseGames.length} games (leaving untouched to prevent crash)`);
            warnings.push(`Week ${maddenWeekNum}: Beyond historical season - leaving ${franchiseGames.length} games untouched`);
            // Do NOT modify these games - leave them as-is to prevent crash
          } else {
            warnings.push(`No historical games for week ${maddenWeekNum}`);
          }
          continue;
        }

        // We have franchiseGames.length game slots and historicalGames.length games to assign
        // Typically these should match (16 games per week in modern NFL)
        // But 28-team eras have only 14 games per week
        if (franchiseGames.length !== historicalGames.length) {
          warnings.push(`Week ${maddenWeekNum}: ${franchiseGames.length} game slots vs ${historicalGames.length} historical games`);
        }

        // Assign games to slots
        const gamesThisWeek = Math.min(franchiseGames.length, historicalGames.length);
        for (let i = 0; i < gamesThisWeek; i++) {
          try {
            const franchiseRecord = franchiseGames[i];
            const historicalGame = historicalGames[i];

            // Create team references from TeamIndex values
            const homeTeamRef = createTeamRef(historicalGame.homeTeamIndex);
            const awayTeamRef = createTeamRef(historicalGame.awayTeamIndex);

            // Set home and away teams using the binary reference format
            franchiseRecord.HomeTeam = homeTeamRef;
            franchiseRecord.AwayTeam = awayTeamRef;
            // Reset GameStatus to Unplayed (important: existing slots may have been simmed)
            franchiseRecord.GameStatus = 'Unplayed';

            gamesUpdated++;

            // Log first few updates for debugging
            if (gamesUpdated <= 3) {
              console.log(`[RetroEditorService] Week ${maddenWeekNum} Game ${i+1}: ${historicalGame.awayTeam} @ ${historicalGame.homeTeam}`);
              console.log(`  HomeTeam ref: ${homeTeamRef} (TeamIndex ${historicalGame.homeTeamIndex})`);
              console.log(`  AwayTeam ref: ${awayTeamRef} (TeamIndex ${historicalGame.awayTeamIndex})`);
            }
          } catch (gameErr: any) {
            console.error(`[RetroEditorService] Error setting game ${i} in week ${maddenWeekNum}:`, gameErr.message);
            console.error(`[RetroEditorService] Error stack:`, gameErr.stack);
            throw gameErr;
          }
        }

        // Handle extra game slots when historical has fewer games (e.g., 28-team era with 14 games/week)
        // FIX: Do NOT mark as OffSeason - this causes Madden to crash when simming!
        // Instead, leave these games untouched with their original matchups.
        if (franchiseGames.length > historicalGames.length) {
          const extraCount = franchiseGames.length - historicalGames.length;
          console.log(`[RetroEditorService] Week ${maddenWeekNum}: SKIPPING ${extraCount} extra slots (leaving untouched to prevent crash)`);
          warnings.push(`Week ${maddenWeekNum}: ${extraCount} extra game slots left untouched (historical had ${historicalGames.length} games)`);
          // Do NOT modify these games - leave them as-is to prevent crash
        }
      } catch (weekErr: any) {
        console.error(`[RetroEditorService] Error processing week ${maddenWeekNum}:`, weekErr.message);
        throw weekErr;
      }
    }

    console.log(`[RetroEditorService] Updated ${gamesUpdated} regular season games`);

    // ====== PRESEASON HANDLING ======
    // IMPORTANT: Do NOT modify preseason - keep Madden's default preseason structure
    // This approach is proven to work (tested with 2011, 1994, 1980, 1975 schedules)
    // The schedule JSON files have preseason data but we intentionally skip it
    let preseasonGamesApplied = 0;
    const SKIP_PRESEASON = true; // Set to false only if you want to apply historical preseason
    if (!SKIP_PRESEASON && preseasonByWeek.size > 0) {
      console.log(`[RetroEditorService] ====== APPLYING PRESEASON SCHEDULE ======`);

      // Madden 26 preseason structure: 3 weeks (0, 1, 2), max 16 games per week = 48 total slots
      const MADDEN_PRESEASON_WEEKS = 3;
      const MAX_PRESEASON_GAMES = 48;

      // Flatten all historical preseason games into a single array
      // FIX: Skip week 4+ games to prevent teams playing twice in a week
      // Historical preseasons often had 4 weeks but Madden only supports 3
      const allHistoricalPreseasonGames: typeof schedule.games = [];
      const sortedWeeks = [...preseasonByWeek.keys()].sort((a, b) => a - b);
      let skippedWeek4Games = 0;
      for (const week of sortedWeeks) {
        const gamesThisWeek = preseasonByWeek.get(week) || [];
        // Skip week 4+ games to avoid teams playing twice in week 3
        if (week > MADDEN_PRESEASON_WEEKS) {
          skippedWeek4Games += gamesThisWeek.length;
          console.log(`[RetroEditorService] Skipping week ${week} games (${gamesThisWeek.length} games) - beyond Madden's 3-week preseason`);
          continue;
        }
        allHistoricalPreseasonGames.push(...gamesThisWeek);
      }
      console.log(`[RetroEditorService] Total historical preseason games: ${allHistoricalPreseasonGames.length} (skipped ${skippedWeek4Games} week 4+ games)`);
      console.log(`[RetroEditorService] Historical preseason weeks used: ${sortedWeeks.filter(w => w <= MADDEN_PRESEASON_WEEKS).join(', ')}`);
      if (skippedWeek4Games > 0) {
        warnings.push(`Skipped ${skippedWeek4Games} preseason week 4+ games to fit Madden's 3-week format`);
      }

      // Calculate actual games per week from the schedule (may be less than 16 for years with fewer teams)
      const gamesPerHistoricalWeek = sortedWeeks.length > 0
        ? Math.ceil(allHistoricalPreseasonGames.length / sortedWeeks.length)
        : 16;
      console.log(`[RetroEditorService] Historical games per week: ${gamesPerHistoricalWeek}`);
      console.log(`[RetroEditorService] Historical weeks: ${sortedWeeks.length}, Madden weeks: ${MADDEN_PRESEASON_WEEKS}`);

      // STEP 1: Collect ALL preseason AND offseason slots (file may be corrupted from previous runs)
      const allPreseasonSlots: any[] = [];
      const offSeasonSlots: any[] = [];
      for (const record of gameTable.records) {
        if (record.isEmpty) continue;
        const weekType = getGameField(record, 'SeasonWeekType');
        const isPreseason = weekType === 0 || weekType === SEASON_WEEK_TYPES.PreSeason || weekType === 'PreSeason';
        const isOffSeason = weekType === 8 || weekType === 'OffSeason';
        if (isPreseason) {
          allPreseasonSlots.push(record);
        } else if (isOffSeason) {
          offSeasonSlots.push(record);
        }
      }
      console.log(`[RetroEditorService] Found ${allPreseasonSlots.length} PreSeason + ${offSeasonSlots.length} OffSeason slots`);

      // STEP 2: Reset ALL preseason slots to OffSeason first (clean slate)
      for (const slot of allPreseasonSlots) {
        try {
          slot.SeasonWeek = 0;
          slot.Field_52 = 0;
          setGameField(slot, 'SeasonWeekType', 'OffSeason');
        } catch (err) {
          // Ignore errors during reset
        }
      }
      console.log(`[RetroEditorService] Reset all ${allPreseasonSlots.length} preseason slots to OffSeason`);

      // STEP 3: Now we have a clean pool - take exactly 48 slots for preseason
      const availableSlots = [...allPreseasonSlots, ...offSeasonSlots].slice(0, MAX_PRESEASON_GAMES);
      console.log(`[RetroEditorService] Using ${availableSlots.length} slots for preseason (max ${MAX_PRESEASON_GAMES})`);

      // Limit historical games to what Madden can handle
      const gamesToApply = allHistoricalPreseasonGames.slice(0, MAX_PRESEASON_GAMES);
      if (allHistoricalPreseasonGames.length > MAX_PRESEASON_GAMES) {
        console.log(`[RetroEditorService] Limiting to ${MAX_PRESEASON_GAMES} games (dropping ${allHistoricalPreseasonGames.length - MAX_PRESEASON_GAMES})`);
      }

      // Apply games to slots, setting the correct week for each
      for (let i = 0; i < availableSlots.length; i++) {
        const slot = availableSlots[i];

        if (i < gamesToApply.length) {
          // Apply historical game to this slot
          const game = gamesToApply[i];

          // Use the game's actual week from the schedule (convert to 0-indexed for Madden)
          // Historical weeks are 1, 2, 3 -> Madden weeks 0, 1, 2
          const maddenWeek = Math.min((game.week || 1) - 1, MADDEN_PRESEASON_WEEKS - 1);

          const homeRecordIndex = teamIndexToRecordIndex.get(game.homeTeamIndex);
          const awayRecordIndex = teamIndexToRecordIndex.get(game.awayTeamIndex);

          // DEBUG: Log the mapping for first 10 games
          if (i < 10) {
            console.log(`[DEBUG] Game ${i}: ${game.awayTeam} (idx=${game.awayTeamIndex}) @ ${game.homeTeam} (idx=${game.homeTeamIndex})`);
            console.log(`[DEBUG]   homeRecordIndex = teamIndexToRecordIndex.get(${game.homeTeamIndex}) = ${homeRecordIndex}`);
            console.log(`[DEBUG]   awayRecordIndex = teamIndexToRecordIndex.get(${game.awayTeamIndex}) = ${awayRecordIndex}`);
          }

          if (homeRecordIndex !== undefined && awayRecordIndex !== undefined) {
            const homeTeamRef = teamRefPrefix + homeRecordIndex.toString(2).padStart(8, '0');
            const awayTeamRef = teamRefPrefix + awayRecordIndex.toString(2).padStart(8, '0');

            // DEBUG: Log the references being created
            if (i < 10) {
              console.log(`[DEBUG]   homeTeamRef = ${homeTeamRef} (last 8: ${homeRecordIndex.toString(2).padStart(8, '0')})`);
              console.log(`[DEBUG]   awayTeamRef = ${awayTeamRef} (last 8: ${awayRecordIndex.toString(2).padStart(8, '0')})`);
            }

            slot.HomeTeam = homeTeamRef;
            slot.AwayTeam = awayTeamRef;
            slot.SeasonWeek = maddenWeek;
            slot.Field_52 = maddenWeek; // Generic field name backup
            setGameField(slot, 'SeasonWeekType', 'PreSeason');
            slot.GameStatus = 'Unplayed';

            // VERIFY: Read back values immediately to confirm write
            const verifyHome = slot.HomeTeam;
            const verifyAway = slot.AwayTeam;
            if (verifyHome !== homeTeamRef || verifyAway !== awayTeamRef) {
              console.error(`[DEBUG] WRITE VERIFICATION FAILED for slot ${i} (record ${slot.index})!`);
              console.error(`[DEBUG]   HomeTeam: wrote ${homeTeamRef}, read back ${verifyHome}`);
              console.error(`[DEBUG]   AwayTeam: wrote ${awayTeamRef}, read back ${verifyAway}`);
            } else if (i < 10) {
              console.log(`[DEBUG]   Write verified OK for slot ${i} (record ${slot.index})`);
            }

            preseasonGamesApplied++;
            gamesUpdated++;

            // Log first few games per week for verification
            if (i < 6) {
              console.log(`[RetroEditorService] Preseason W${maddenWeek}: ${game.awayTeam} @ ${game.homeTeam}`);
            }
          } else {
            console.warn(`[RetroEditorService] Could not resolve teams: ${game.awayTeam} (idx=${game.awayTeamIndex}, rec=${awayRecordIndex}) @ ${game.homeTeam} (idx=${game.homeTeamIndex}, rec=${homeRecordIndex})`);
          }
        } else {
          // Mark unused preseason slot as Invalid_ with null team refs
          // CRITICAL: Keep SeasonWeekType as PreSeason, just set GameStatus to Invalid_
          // This matches how the working 2011 mod handles unused preseason slots
          try {
            slot.GameStatus = 'Invalid_';
            slot.HomeTeam = '00000000000000000000000000000000';
            slot.AwayTeam = '00000000000000000000000000000000';
            slot.SeasonWeek = 0;
            gamesUpdated++;
          } catch (err: any) {
            // Ignore
          }
        }
      }

      console.log(`[RetroEditorService] Applied ${preseasonGamesApplied} preseason games across ${MADDEN_PRESEASON_WEEKS} weeks`);

      // Diagnostic: Log final preseason week distribution
      const weekDistribution: Record<number, number> = {};
      for (const record of gameTable.records) {
        if (record.isEmpty) continue;
        const weekType = getGameField(record, 'SeasonWeekType');
        const isPreseason = weekType === 0 || weekType === SEASON_WEEK_TYPES.PreSeason || weekType === 'PreSeason';
        if (!isPreseason) continue;
        const week = getGameField(record, 'SeasonWeek') ?? record.SeasonWeek ?? record.Field_52;
        weekDistribution[week] = (weekDistribution[week] || 0) + 1;
      }
      console.log(`[RetroEditorService] Preseason games per week: ${JSON.stringify(weekDistribution)}`);
    }

    // ====== HANDLE PRESEASON GAMES FOR INACTIVE/EXPANSION TEAMS ======
    // NOTE: Even with SKIP_PRESEASON=true (don't apply historical preseason data),
    // we MUST still handle inactive teams (like Browns 1996-1998) in preseason.
    // Otherwise the Browns will still appear in preseason games.
    {
      // Get teams that didn't exist in the target year
      const inactiveTeamIndices = new Set<number>();
      for (const team of this.expansionHistory) {
        if (team.year > year) {
          inactiveTeamIndices.add(team.teamIndex);
          console.log(`[RetroEditorService] Team ${team.team} (teamIndex ${team.teamIndex}) didn't exist in ${year} - joined in ${team.year}`);
        }
      }

    // Also check special cases like Browns 1996-1998
    const brownsSpecialCase = {
      teamIndex: 4,
      inactiveYears: [1996, 1997, 1998]
    };
    if (brownsSpecialCase.inactiveYears.includes(year)) {
      inactiveTeamIndices.add(brownsSpecialCase.teamIndex);
      console.log(`[RetroEditorService] Browns (teamIndex ${brownsSpecialCase.teamIndex}) were inactive in ${year}`);
    }

    if (inactiveTeamIndices.size > 0) {
      console.log(`[RetroEditorService] ====== HANDLING PRESEASON FOR ${inactiveTeamIndices.size} INACTIVE TEAMS ======`);
      let preseasonGamesModified = 0;

      // Build list of active team indices (teams that existed in the target year)
      const activeTeamIndices: number[] = [];
      for (const [teamIndex] of teamIndexToRecordIndex.entries()) {
        if (!inactiveTeamIndices.has(teamIndex)) {
          activeTeamIndices.push(teamIndex);
        }
      }
      console.log(`[RetroEditorService] Active teams in ${year}: ${activeTeamIndices.length} teams`);

      // Build a map from inactive team to replacement active team
      // We'll rotate through active teams to ensure variety
      const inactiveToActive = new Map<number, number>();
      const inactiveArray = Array.from(inactiveTeamIndices);
      for (let i = 0; i < inactiveArray.length; i++) {
        // Map each inactive team to an active team (rotating through active teams)
        const replacementIndex = i % activeTeamIndices.length;
        inactiveToActive.set(inactiveArray[i], activeTeamIndices[replacementIndex]);
        console.log(`[RetroEditorService] Inactive team ${inactiveArray[i]} -> replacement ${activeTeamIndices[replacementIndex]}`);
      }

      // Go through ALL preseason games and replace inactive teams
      for (const record of gameTable.records) {
        if (record.isEmpty) continue;

        const weekType = getGameField(record, 'SeasonWeekType');
        const isPreseason = weekType === 0 || weekType === SEASON_WEEK_TYPES.PreSeason || weekType === 'PreSeason';

        if (!isPreseason) continue;

        // Check if either team is inactive
        const homeTeam = record.HomeTeam;
        const awayTeam = record.AwayTeam;

        // Reverse lookup: find teamIndex from record reference
        let homeTeamIndex: number | undefined;
        let awayTeamIndex: number | undefined;

        for (const [tIndex, rIndex] of teamIndexToRecordIndex.entries()) {
          const expectedRef = teamRefPrefix + rIndex.toString(2).padStart(8, '0');
          if (homeTeam === expectedRef) {
            homeTeamIndex = tIndex;
          }
          if (awayTeam === expectedRef) {
            awayTeamIndex = tIndex;
          }
        }

        const homeInactive = homeTeamIndex !== undefined && inactiveTeamIndices.has(homeTeamIndex);
        const awayInactive = awayTeamIndex !== undefined && inactiveTeamIndices.has(awayTeamIndex);

        if (homeInactive || awayInactive) {
          try {
            // Replace inactive teams with active teams
            if (homeInactive && homeTeamIndex !== undefined) {
              const replacementIndex = inactiveToActive.get(homeTeamIndex);
              if (replacementIndex !== undefined) {
                const recordIndex = teamIndexToRecordIndex.get(replacementIndex);
                if (recordIndex !== undefined) {
                  const newRef = teamRefPrefix + recordIndex.toString(2).padStart(8, '0');
                  record.HomeTeam = newRef;
                  if (preseasonGamesModified < 5) {
                    console.log(`[RetroEditorService] Replaced home team ${homeTeamIndex} with ${replacementIndex}`);
                  }
                }
              }
            }
            if (awayInactive && awayTeamIndex !== undefined) {
              const replacementIndex = inactiveToActive.get(awayTeamIndex);
              if (replacementIndex !== undefined) {
                const recordIndex = teamIndexToRecordIndex.get(replacementIndex);
                if (recordIndex !== undefined) {
                  const newRef = teamRefPrefix + recordIndex.toString(2).padStart(8, '0');
                  record.AwayTeam = newRef;
                  if (preseasonGamesModified < 5) {
                    console.log(`[RetroEditorService] Replaced away team ${awayTeamIndex} with ${replacementIndex}`);
                  }
                }
              }
            }
            preseasonGamesModified++;
          } catch (err: any) {
            console.warn(`[RetroEditorService] Failed to replace inactive team in preseason: ${err.message}`);
          }
        }
      }

      console.log(`[RetroEditorService] Modified ${preseasonGamesModified} preseason games - replaced inactive teams with active teams`);
      gamesUpdated += preseasonGamesModified;
      if (preseasonGamesModified > 0) {
        warnings.push(`Modified ${preseasonGamesModified} preseason games - replaced teams that didn't exist in ${year}`);
      }
    }
    } // End of inactive/expansion team handling block

    console.log(`[RetroEditorService] Total games updated: ${gamesUpdated}`);

    // ====== FIX GAMES WITH BAD TEAM REFERENCE PREFIXES ======
    // Some high-index game slots (like Hall of Fame games) have team references
    // with incorrect prefixes from the original Madden file. These cause issues
    // when Madden tries to resolve the team - fix by marking as Invalid_.
    console.log(`[RetroEditorService] ====== FIXING BAD TEAM REFERENCES ======`);
    let badRefGamesFixed = 0;
    for (const record of gameTable.records) {
      if (record.isEmpty) continue;

      const homeRef = record.HomeTeam;
      const awayRef = record.AwayTeam;

      // Check if either team has a wrong prefix
      const homePrefix = homeRef ? homeRef.slice(0, 24) : null;
      const awayPrefix = awayRef ? awayRef.slice(0, 24) : null;
      const nullRef = '000000000000000000000000';

      const homeBad = homePrefix && homePrefix !== teamRefPrefix && homePrefix !== nullRef;
      const awayBad = awayPrefix && awayPrefix !== teamRefPrefix && awayPrefix !== nullRef;

      if (homeBad || awayBad) {
        // Mark this game as Invalid_ so Madden skips it
        record.GameStatus = 'Invalid_';
        // Also mark as OffSeason to ensure it's not shown in preseason schedule
        try {
          setGameField(record, 'SeasonWeekType', 'OffSeason');
        } catch {
          // If we can't set OffSeason, Invalid_ status should be enough
        }
        badRefGamesFixed++;
        if (badRefGamesFixed <= 5) {
          console.log(`[RetroEditorService] Fixed bad ref game at index ${record.index}: home=${homePrefix}, away=${awayPrefix}`);
        }
      }
    }
    if (badRefGamesFixed > 0) {
      console.log(`[RetroEditorService] Fixed ${badRefGamesFixed} games with bad team reference prefixes`);
      warnings.push(`Fixed ${badRefGamesFixed} games with invalid team references`);
    }

    // NOTE: Do NOT save here - let user choose when to save at end of Apply flow
    console.log(`[RetroEditorService] Schedule changes applied (${gamesUpdated} games) - changes pending user save`);

    return {
      success: true,
      gamesUpdated,
      warnings,
      diagnostics: {
        preseasonGamesApplied,
        preseasonWeeks: preseasonByWeek.size,
        historicalPreseasonGames: [...preseasonByWeek.values()].reduce((sum, games) => sum + games.length, 0)
      }
    };
  }

  /**
   * Get season era information for a year
   */
  async getSeasonInfo(year: number): Promise<{
    seasonLength: number;
    byeWeeks: boolean;
    regularSeasonWeeks: number;
    playoffTeams: number;
    note?: string;
  } | null> {
    const { scheduleService } = await import('./ScheduleService');
    await scheduleService.initialize();

    const era = scheduleService.getSeasonEra(year);
    if (!era) return null;

    return {
      seasonLength: era.seasonLength,
      byeWeeks: era.byeWeeks,
      regularSeasonWeeks: era.regularSeasonWeeks || (era.byeWeeks ? 17 : era.seasonLength),
      playoffTeams: era.playoffTeams,
      note: era.note
    };
  }

  /**
   * Check if schedule data is available for a year
   */
  async hasScheduleData(year: number): Promise<boolean> {
    const { scheduleService } = await import('./ScheduleService');
    await scheduleService.initialize();
    return scheduleService.hasSchedule(year);
  }

  /**
   * Get list of years with available schedule data
   */
  async getAvailableScheduleYears(): Promise<number[]> {
    const { scheduleService } = await import('./ScheduleService');
    await scheduleService.initialize();
    return scheduleService.getAvailableYears();
  }

  // ============================================
  // COACH METHODS
  // ============================================

  /**
   * Load coach data for a specific year
   */
  async loadCoachData(year: number): Promise<any | null> {
    try {
      const appPath = app.getAppPath();
      const dataPath = app.isPackaged
        ? path.join(appPath, '.vite', 'build', 'data', 'retro', 'coaches')
        : path.join(appPath, 'data', 'retro', 'coaches');

      const coachFilePath = path.join(dataPath, `${year}.json`);

      if (!fs.existsSync(coachFilePath)) {
        console.log(`[RetroEditorService] No coach data file for year ${year}`);
        return null;
      }

      const coachData = JSON.parse(fs.readFileSync(coachFilePath, 'utf-8'));
      console.log(`[RetroEditorService] Loaded coach data for ${year}: ${coachData.teams?.length || 0} teams`);
      return coachData;
    } catch (error) {
      console.error(`[RetroEditorService] Error loading coach data for ${year}:`, error);
      return null;
    }
  }

  /**
   * Check if coach data is available for a year
   */
  async hasCoachData(year: number): Promise<boolean> {
    const appPath = app.getAppPath();
    const dataPath = app.isPackaged
      ? path.join(appPath, '.vite', 'build', 'data', 'retro', 'coaches')
      : path.join(appPath, 'data', 'retro', 'coaches');

    const coachFilePath = path.join(dataPath, `${year}.json`);
    return fs.existsSync(coachFilePath);
  }

  /**
   * Get coach preview for a year
   * Shows what coach changes would be applied without modifying the file
   */
  async getCoachPreview(filePath: string, year: number): Promise<{
    available: boolean;
    teamCount: number;
    coachChanges: Array<{
      teamAbbr: string;
      teamIndex: number;
      headCoach: string;
      offensiveCoordinator: string;
      defensiveCoordinator: string;
      offScheme?: string;
      defScheme?: string;
    }>;
    warnings: string[];
  }> {
    const coachData = await this.loadCoachData(year);

    if (!coachData) {
      return {
        available: false,
        teamCount: 0,
        coachChanges: [],
        warnings: [`No coach data available for ${year}`]
      };
    }

    // Also get scheme preview to include scheme info with coaches
    const schemePreview = await this.getSchemePreview(filePath, year);
    const schemeByTeamIndex = new Map<number, { offense: string; defense: string }>();
    if (schemePreview.available && schemePreview.schemeChanges) {
      for (const sc of schemePreview.schemeChanges) {
        schemeByTeamIndex.set(sc.teamIndex, {
          offense: sc.newOffense || sc.currentOffense,
          defense: sc.newDefense || sc.currentDefense
        });
      }
    }

    const warnings: string[] = [];
    const coachChanges: Array<{
      teamAbbr: string;
      teamIndex: number;
      headCoach: string;
      offensiveCoordinator: string;
      defensiveCoordinator: string;
      offScheme?: string;
      defScheme?: string;
    }> = [];

    for (const team of coachData.teams) {
      const hcName = team.headCoach.firstName && team.headCoach.lastName
        ? `${team.headCoach.firstName} ${team.headCoach.lastName}`
        : 'N/A';
      const ocName = team.offensiveCoordinator.firstName && team.offensiveCoordinator.lastName
        ? `${team.offensiveCoordinator.firstName} ${team.offensiveCoordinator.lastName}`
        : '(Keep Default)';
      const dcName = team.defensiveCoordinator.firstName && team.defensiveCoordinator.lastName
        ? `${team.defensiveCoordinator.firstName} ${team.defensiveCoordinator.lastName}`
        : '(Keep Default)';

      // Get scheme info for this team
      const schemes = schemeByTeamIndex.get(team.teamIndex);

      coachChanges.push({
        teamAbbr: team.teamAbbr,
        teamIndex: team.teamIndex,
        headCoach: hcName,
        offensiveCoordinator: ocName,
        defensiveCoordinator: dcName,
        offScheme: schemes?.offense,
        defScheme: schemes?.defense
      });
    }

    return {
      available: true,
      teamCount: coachData.teams.length,
      coachChanges,
      warnings
    };
  }

  /**
   * Apply historical coaches to franchise file
   * Updates the Coach table with historical HC, OC, DC names
   *
   * Strategy:
   * 1. Find all Coach records for each team (by TeamIndex)
   * 2. Identify HC, OC, DC by Position field (0=HC, 1=OC, 2=DC typically)
   * 3. Update FirstName/LastName fields
   * 4. If OC or DC is empty in historical data, leave the game's default
   */
  async applyHistoricalCoaches(filePath: string, year: number): Promise<{
    success: boolean;
    coachesUpdated: number;
    warnings: string[];
    error?: string;
  }> {
    const franchise = this.getFranchise(filePath);
    if (!franchise) {
      return {
        success: false,
        coachesUpdated: 0,
        warnings: [],
        error: 'Franchise file not loaded. Call loadFranchiseFile first.'
      };
    }

    // Load coach data for this year
    const coachData = await this.loadCoachData(year);
    if (!coachData) {
      return {
        success: false,
        coachesUpdated: 0,
        warnings: [],
        error: `No coach data available for ${year}`
      };
    }

    console.log(`[RetroEditorService] Applying coaches for year ${year}: ${coachData.teams.length} teams`);

    // Get the Coach table
    let coachTable = franchise.getTableByUniqueId(TABLE_IDS.coachTable);
    if (!coachTable) {
      coachTable = franchise.getTableByName('Coach');
    }
    if (!coachTable) {
      console.error('[RetroEditorService] Could not find Coach table!');
      return {
        success: false,
        coachesUpdated: 0,
        warnings: [],
        error: 'Could not find Coach table in franchise file'
      };
    }

    await coachTable.readRecords();
    console.log(`[RetroEditorService] Found ${coachTable.records.length} coach records`);

    // Log first record fields to understand structure
    if (coachTable.records.length > 0) {
      const firstRecord = coachTable.records[0];
      const fieldNames = Object.keys(firstRecord).filter(k => !k.startsWith('_') && typeof firstRecord[k] !== 'function');
      console.log('[RetroEditorService] Coach table fields:', fieldNames.slice(0, 25));
    }

    const warnings: string[] = [];
    let coachesUpdated = 0;

    // Group coaches by TeamIndex
    const coachesByTeam = new Map<number, any[]>();
    for (const record of coachTable.records) {
      if (record.isEmpty) continue;

      const teamIndex = record.TeamIndex;
      if (teamIndex === undefined || teamIndex >= 32) continue; // Only NFL teams

      if (!coachesByTeam.has(teamIndex)) {
        coachesByTeam.set(teamIndex, []);
      }
      coachesByTeam.get(teamIndex)!.push(record);
    }

    console.log(`[RetroEditorService] Grouped coaches for ${coachesByTeam.size} teams`);

    // Process each team from historical data
    for (const teamData of coachData.teams) {
      const teamIndex = teamData.teamIndex;
      const teamCoaches = coachesByTeam.get(teamIndex);

      console.log(`[RetroEditorService] Processing ${teamData.teamAbbr} (teamIndex=${teamIndex}): Found ${teamCoaches?.length || 0} coaches in file`);

      if (!teamCoaches || teamCoaches.length === 0) {
        warnings.push(`No coaches found for team ${teamData.teamAbbr} (index ${teamIndex})`);
        console.log(`[RetroEditorService] WARNING: No coaches with TeamIndex=${teamIndex} found in franchise file!`);
        continue;
      }

      // Find HC, OC, DC among team's coaches
      // Position can be numeric (0, 1, 2) or string enum ("HeadCoach", "OffensiveCoordinator", "DefensiveCoordinator")
      let hcRecord: any = null;
      let ocRecord: any = null;
      let dcRecord: any = null;

      for (const coach of teamCoaches) {
        const position = coach.Position;
        // Log ALL fields for team 0 HeadCoaches to find the field that identifies the active coach
        if (teamIndex === 0 && (position === 'HeadCoach' || position === 0)) {
          const fields = Object.keys(coach).filter(k => !k.startsWith('_') && typeof coach[k] !== 'function');
          console.log(`[RetroEditorService] Team 0 HC "${coach.FirstName} ${coach.LastName}" - ALL FIELDS:`);
          for (const field of fields) {
            const val = coach[field];
            if (val !== undefined && val !== '' && val !== null) {
              console.log(`  ${field}: ${typeof val === 'object' ? JSON.stringify(val) : val}`);
            }
          }
        }

        // Handle both numeric and string enum values
        const isHC = position === 0 || position === 'HeadCoach' || position === 'CoachPosition:HeadCoach';
        const isOC = position === 1 || position === 'OffensiveCoordinator' || position === 'CoachPosition:OffensiveCoordinator';
        const isDC = position === 2 || position === 'DefensiveCoordinator' || position === 'CoachPosition:DefensiveCoordinator';

        // For teams with multiple coaches of same position (user's controlled team has staff pool),
        // we need to find the "active" coach. The active one has ContractStatus = "Signed".
        // Free agents, candidates, and pool coaches have ContractStatus = "FreeAgent".
        const contractStatus = coach.ContractStatus;
        const isSigned = contractStatus === 'Signed' || contractStatus === 'ContractStatus:Signed';

        if (isHC) {
          // Prefer a signed HC, otherwise take first one found
          if (!hcRecord || (isSigned && hcRecord.ContractStatus !== 'Signed')) {
            hcRecord = coach;
          }
        }
        else if (isOC) {
          if (!ocRecord || (isSigned && ocRecord.ContractStatus !== 'Signed')) {
            ocRecord = coach;
          }
        }
        else if (isDC) {
          if (!dcRecord || (isSigned && dcRecord.ContractStatus !== 'Signed')) {
            dcRecord = coach;
          }
        }
      }

      // Log if no HC found
      if (!hcRecord) {
        console.log(`[RetroEditorService] WARNING: No HC (Position=0) found for ${teamData.teamAbbr}! Available positions: ${teamCoaches.map((c: any) => c.Position).join(', ')}`);
      }

      // Helper to update coach record with portrait, AssetName, and career stats
      const updateCoachRecord = (record: any, firstName: string, lastName: string, role: string, coachStats?: any) => {
        const oldFirst = record.FirstName;
        const oldLast = record.LastName;
        const oldName = record.Name;
        const oldPortrait = record.Portrait;
        const oldAssetName = record.AssetName;

        // Update name fields
        record.FirstName = firstName;
        record.LastName = lastName;

        // Update the short display name (used by upgrade screen and UI)
        // Format: "F. LastName" (e.g., "N. Armstrong")
        if (record.Name !== undefined) {
          const shortName = `${firstName.charAt(0)}. ${lastName}`;
          record.Name = shortName;
          console.log(`[RetroEditorService]   Name: "${oldName}" -> "${shortName}"`);
        }

        // First, check User Database for edited/custom coaches (has priority)
        // This allows users to assign custom portraits and use year-specific stats
        const userDbCoach = userDatabaseService.getCoachByNameForRetro(firstName, lastName, year);

        if (userDbCoach) {
          // Coach found in user database
          // Use PID/PAM if available
          if (userDbCoach.pid !== null && userDbCoach.pid >= 0) {
            if (record.Portrait !== undefined) {
              record.Portrait = userDbCoach.pid;
              console.log(`[RetroEditorService]   Portrait: Using USER DB PID ${userDbCoach.pid} for ${firstName} ${lastName}`);
            }
            if (userDbCoach.pam && record.AssetName !== undefined) {
              record.AssetName = userDbCoach.pam;
              console.log(`[RetroEditorService]   AssetName: Using USER DB "${userDbCoach.pam}" for ${firstName} ${lastName}`);
            }
          }

          // Use year-specific stats from user database if available (overrides coachStats from JSON)
          if (userDbCoach.seasonStats) {
            console.log(`[RetroEditorService]   Using USER DB stats for year ${year}: W-L-T: ${userDbCoach.seasonStats.careerWins}-${userDbCoach.seasonStats.careerLosses}-${userDbCoach.seasonStats.careerTies}`);
            // Override coachStats with user database season stats
            if (coachStats) {
              coachStats.careerWins = userDbCoach.seasonStats.careerWins;
              coachStats.careerLosses = userDbCoach.seasonStats.careerLosses;
              coachStats.careerTies = userDbCoach.seasonStats.careerTies;
              coachStats.playoffWins = userDbCoach.seasonStats.playoffWins;
              coachStats.superBowlWins = userDbCoach.seasonStats.superBowlWins;
            }
          }
        }

        // If no PID from user database, fall back to Coach_lookup.csv
        if (!userDbCoach || userDbCoach.pid === null || userDbCoach.pid < 0) {
          // Fall back to Coach_lookup.csv
          // Coach_lookup.csv has: LastName,FirstName,PAM(AssetName),PID
          const coachLookup = lookupService.getCoachByName(lastName, firstName);

          if (coachLookup && coachLookup.pid !== undefined && coachLookup.pid >= 0) {
            // Coach found in database with valid PID - use their portrait
            if (record.Portrait !== undefined) {
              record.Portrait = coachLookup.pid;
              console.log(`[RetroEditorService]   Portrait: Using PID ${coachLookup.pid} for ${firstName} ${lastName}`);
            }
            // If coach has a PAM/AssetName in our database, use it
            if (coachLookup.pam && record.AssetName !== undefined) {
              record.AssetName = coachLookup.pam;
              console.log(`[RetroEditorService]   AssetName: Using "${coachLookup.pam}" for ${firstName} ${lastName}`);
            }
          } else {
            // Coach not found in any database - use generic face and generic AssetName
            if (record.Portrait !== undefined) {
              record.Portrait = 9999; // Generic face
              console.log(`[RetroEditorService]   Portrait: Coach ${firstName} ${lastName} not in database, using generic (9999)`);
            }
            // For historical coaches without a database entry, try clearing AssetName
            // This may force the game to use FirstName/LastName from the Coach table
            // The 2011 throwback used custom assets (e.g., "SmithLovie1") which requires FMT
            if (record.AssetName !== undefined) {
              // Try setting to empty to force fallback to Coach table names
              record.AssetName = '';
              console.log(`[RetroEditorService]   AssetName: Cleared (was "${oldAssetName}") for ${firstName} ${lastName}`);
            }
          }
        }

        // Apply career stats from historical data (stats by year)
        if (coachStats) {
          // Career record
          if (record.CareerWins !== undefined && coachStats.careerWins !== undefined) {
            record.CareerWins = coachStats.careerWins;
          }
          if (record.CareerLosses !== undefined && coachStats.careerLosses !== undefined) {
            record.CareerLosses = coachStats.careerLosses;
          }
          if (record.CareerTies !== undefined && coachStats.careerTies !== undefined) {
            record.CareerTies = coachStats.careerTies;
          }
          // Experience
          if (record.YearsExperience !== undefined && coachStats.yearsAsHC !== undefined) {
            record.YearsExperience = coachStats.yearsAsHC;
          }
          if (record.YearsWithTeam !== undefined && coachStats.yearsWithTeam !== undefined) {
            record.YearsWithTeam = coachStats.yearsWithTeam;
          }
          // Playoff stats
          if (record.CareerPlayoffWins !== undefined && coachStats.playoffWins !== undefined) {
            record.CareerPlayoffWins = coachStats.playoffWins;
          }
          if (record.CareerPlayoffLosses !== undefined && coachStats.playoffLosses !== undefined) {
            record.CareerPlayoffLosses = coachStats.playoffLosses;
          }
          if (record.SuperBowlWins !== undefined && coachStats.superBowlWins !== undefined) {
            record.SuperBowlWins = coachStats.superBowlWins;
          }
          console.log(`[RetroEditorService]   Stats: W-L-T: ${coachStats.careerWins || 0}-${coachStats.careerLosses || 0}-${coachStats.careerTies || 0}, Years: ${coachStats.yearsAsHC || 0}`);
        }

        coachesUpdated++;
        console.log(`[RetroEditorService] ${teamData.teamAbbr} ${role}: "${oldFirst} ${oldLast}" -> "${firstName} ${lastName}"`);
        console.log(`[RetroEditorService]   Portrait: ${oldPortrait} -> ${record.Portrait}, AssetName: "${oldAssetName}" -> "${record.AssetName}"`);
      };

      // Update Head Coach (with stats - HC has career record)
      if (hcRecord && teamData.headCoach.firstName && teamData.headCoach.lastName) {
        updateCoachRecord(hcRecord, teamData.headCoach.firstName, teamData.headCoach.lastName, 'HC', teamData.headCoach);
      } else if (!hcRecord) {
        warnings.push(`No HC record found for ${teamData.teamAbbr}`);
      }

      // Update Offensive Coordinator (only if historical data has one)
      if (ocRecord && teamData.offensiveCoordinator.firstName && teamData.offensiveCoordinator.lastName) {
        updateCoachRecord(ocRecord, teamData.offensiveCoordinator.firstName, teamData.offensiveCoordinator.lastName, 'OC', teamData.offensiveCoordinator);
      }
      // If no OC in historical data, leave the game's default (don't update)

      // Update Defensive Coordinator (only if historical data has one)
      if (dcRecord && teamData.defensiveCoordinator.firstName && teamData.defensiveCoordinator.lastName) {
        updateCoachRecord(dcRecord, teamData.defensiveCoordinator.firstName, teamData.defensiveCoordinator.lastName, 'DC', teamData.defensiveCoordinator);
      }
      // If no DC in historical data, leave the game's default (don't update)
    }

    console.log(`[RetroEditorService] Updated ${coachesUpdated} coaches`);

    return {
      success: true,
      coachesUpdated,
      warnings
    };
  }

  // ============================================
  // SALARY CAP METHODS
  // ============================================

  /**
   * Load salary cap data
   */
  private loadSalaryCapData(): any | null {
    try {
      const appPath = app.getAppPath();
      const dataPath = app.isPackaged
        ? path.join(appPath, '.vite', 'build', 'data', 'retro')
        : path.join(appPath, 'data', 'retro');

      const salaryCapPath = path.join(dataPath, 'salary-caps.json');
      if (!fs.existsSync(salaryCapPath)) {
        console.log('[RetroEditorService] No salary cap data file found');
        return null;
      }

      const salaryCapData = JSON.parse(fs.readFileSync(salaryCapPath, 'utf-8'));
      console.log('[RetroEditorService] Loaded salary cap data');
      return salaryCapData;
    } catch (error) {
      console.error('[RetroEditorService] Error loading salary cap data:', error);
      return null;
    }
  }

  /**
   * Madden's minimum salary cap floor in dollars
   * The game engine enforces this as the minimum cap regardless of what's set in save files
   *
   * FORMULA DISCOVERED:
   *   Display Cap = $120M + (TeamSalaryCap × $10,000)
   *   TeamSalaryCap = (Target Cap - $120M) / $10,000
   *
   * Minimum: TeamSalaryCap = 0 → Display = $120M
   */
  private readonly MADDEN_MIN_CAP = 120000000; // $120M minimum cap (TeamSalaryCap=0)
  private readonly MADDEN_BASE_CAP = 120000000; // $120M base for display formula
  private readonly MADDEN_DEFAULT_CAP = 277000000; // $277M default M26 cap

  /**
   * Get salary cap for a specific year
   * Applies Madden's $120M minimum floor - years with lower historical caps
   * will use $120M to ensure game compatibility
   */
  getSalaryCapForYear(year: number): { value: number; note?: string } {
    const data = this.loadSalaryCapData();
    if (!data) {
      // Return minimum cap if no data available
      return {
        value: this.MADDEN_MIN_CAP,
        note: 'No salary cap data available - using Madden minimum ($120M)'
      };
    }

    let historicalCap = 0;
    let baseNote: string | undefined;

    // Check if pre-cap era (before 1994)
    if (data.preCap && year >= data.preCap.startYear && year <= data.preCap.endYear) {
      historicalCap = 0;
      baseNote = data.preCap.note || 'No salary cap in this era';
    } else {
      // Get specific year cap
      const yearStr = year.toString();
      if (data.caps && data.caps[yearStr]) {
        historicalCap = data.caps[yearStr];
        baseNote = data.notes && data.notes[yearStr] ? data.notes[yearStr] : undefined;
      }
    }

    // Apply Madden's minimum cap floor
    if (historicalCap < this.MADDEN_MIN_CAP) {
      const effectiveCap = this.MADDEN_MIN_CAP;
      const note = historicalCap === 0
        ? `${baseNote || 'Pre-cap era'} - Madden minimum $120M applied`
        : `Historical cap $${(historicalCap / 1000000).toFixed(1)}M below Madden minimum - using $120M`;
      return { value: effectiveCap, note };
    }

    return { value: historicalCap, note: baseNote };
  }

  /**
   * Get Madden's minimum salary cap in dollars
   */
  getMaddenMinCap(): number {
    return this.MADDEN_MIN_CAP;
  }

  /**
   * Apply salary cap to franchise file
   *
   * FORMULA DISCOVERED:
   *   Display Cap = $120M + (TeamSalaryCap × $10,000)
   *   TeamSalaryCap = (Target Cap - $120M) / $10,000
   *
   * Fields to update:
   *   - SalaryInfo: TeamSalaryCap, InitialSalaryCap
   *   - Player: PLYR_CAPSALARY, ContractSalary0-7, ContractBonus0-7 (scaled)
   *   - Team: TEAM_SALARY, SalCapRosterReserve, SalCapCapRoom, ThisYearCapPenalties (scaled)
   *
   * @param filePath - Path to the franchise file
   * @param year - The year to use for historical salary cap lookup (if no custom cap)
   * @param customCapValue - Optional custom salary cap in dollars (e.g., 255400000 for $255.4M)
   */
  async applySalaryCap(filePath: string, year: number, customCapValue?: number): Promise<{
    success: boolean;
    previousCap: number;
    newCap: number;
    note?: string;
    error?: string;
  }> {
    const franchise = this.getFranchise(filePath);
    if (!franchise) {
      return {
        success: false,
        previousCap: 0,
        newCap: 0,
        error: 'Franchise file not loaded. Call loadFranchiseFile first.'
      };
    }

    // Use custom cap if provided, otherwise look up historical cap
    let capValue: number;
    let note: string | undefined;

    if (customCapValue && customCapValue > 0) {
      capValue = customCapValue;
      note = `Custom salary cap: $${(customCapValue / 1000000).toFixed(1)}M`;
      console.log(`[RetroEditorService] Using custom salary cap: $${capValue.toLocaleString()}`);
    } else {
      const capInfo = this.getSalaryCapForYear(year);
      capValue = capInfo.value;
      note = capInfo.note;
      console.log(`[RetroEditorService] Using historical salary cap for ${year}: $${capValue.toLocaleString()}`);
    }

    // Enforce minimum cap
    if (capValue < this.MADDEN_MIN_CAP) {
      capValue = this.MADDEN_MIN_CAP;
      note = `${note || ''} (enforced $120M minimum)`.trim();
    }

    // ===== FORMULA: Display Cap = $120M + (TeamSalaryCap × $10,000) =====
    // TeamSalaryCap = (Target Cap - $120M) / $10,000
    const teamSalaryCapValue = Math.round((capValue - this.MADDEN_BASE_CAP) / 10000);
    console.log(`[RetroEditorService] Target display cap: $${(capValue / 1000000).toFixed(1)}M`);
    console.log(`[RetroEditorService] TeamSalaryCap value: ${teamSalaryCapValue}`);

    // Calculate scale factor for contracts: target/default
    const scaleFactor = capValue / this.MADDEN_DEFAULT_CAP;
    console.log(`[RetroEditorService] Contract scale factor: ${(scaleFactor * 100).toFixed(1)}%`);

    // Internal cap for team calculations (in $10k units)
    const internalCapUnits = Math.round(capValue / 10000);

    // ===== 1. UPDATE SALARYINFO TABLE =====
    const SALARY_INFO_TABLE_ID = 3759217828;
    let salaryInfoTable = franchise.getTableByUniqueId(SALARY_INFO_TABLE_ID);
    if (!salaryInfoTable) {
      salaryInfoTable = franchise.getTableByName('SalaryInfo');
    }
    if (!salaryInfoTable) {
      console.error('[RetroEditorService] Could not find SalaryInfo table!');
      return {
        success: false,
        previousCap: 0,
        newCap: capValue,
        error: 'Could not find SalaryInfo table in franchise file'
      };
    }

    await salaryInfoTable.readRecords();
    const salaryRecord = salaryInfoTable.records.find((r: any) => !r.isEmpty);
    if (!salaryRecord) {
      return {
        success: false,
        previousCap: 0,
        newCap: capValue,
        error: 'No active SalaryInfo record found'
      };
    }

    const previousCap = salaryRecord.TeamSalaryCap || salaryRecord.InitialSalaryCap || 0;

    try {
      salaryRecord.TeamSalaryCap = teamSalaryCapValue;
      salaryRecord.InitialSalaryCap = teamSalaryCapValue;
      console.log(`[RetroEditorService] Set TeamSalaryCap/InitialSalaryCap to ${teamSalaryCapValue}`);
    } catch (e: any) {
      console.error(`[RetroEditorService] Failed to set salary cap fields: ${e.message}`);
      return {
        success: false,
        previousCap: previousCap * 10000,
        newCap: capValue,
        error: 'Could not set TeamSalaryCap or InitialSalaryCap fields'
      };
    }

    // ===== 2. SCALE PLAYER CONTRACTS =====
    let playerTable: any = null;
    for (const table of franchise.tables) {
      if (table.name === 'Player') {
        playerTable = table;
        break;
      }
    }

    let playersScaled = 0;
    if (playerTable) {
      await playerTable.readRecords();

      for (const player of playerTable.records) {
        if (player.isEmpty) continue;

        let modified = false;

        // Scale ContractSalary0-7
        for (let i = 0; i <= 7; i++) {
          const field = `ContractSalary${i}`;
          const val = player[field] || 0;
          if (val > 0) {
            player[field] = Math.round(val * scaleFactor);
            modified = true;
          }
        }

        // Scale ContractBonus0-7
        for (let i = 0; i <= 7; i++) {
          const field = `ContractBonus${i}`;
          const val = player[field] || 0;
          if (val > 0) {
            player[field] = Math.round(val * scaleFactor);
            modified = true;
          }
        }

        // Scale PLYR_CAPSALARY
        const capSalary = player.PLYR_CAPSALARY || 0;
        if (capSalary > 0) {
          player.PLYR_CAPSALARY = Math.round(capSalary * scaleFactor);
          modified = true;
        }

        if (modified) playersScaled++;
      }

      console.log(`[RetroEditorService] Scaled contracts for ${playersScaled} players`);
    } else {
      console.warn('[RetroEditorService] Could not find Player table to scale contracts');
    }

    // ===== 3. UPDATE TEAM SALARY AND CAP FIELDS =====
    const TEAM_TABLE_ID = 637929298;
    let teamTable = franchise.getTableByUniqueId(TEAM_TABLE_ID);
    if (!teamTable) {
      teamTable = franchise.getTableByName('Team');
    }

    let teamsUpdated = 0;
    if (teamTable) {
      await teamTable.readRecords();

      for (const team of teamTable.records) {
        if (team.isEmpty) continue;
        const name = team.DisplayName || team.ShortName;
        if (!name || name === 'Free Agents' || name === 'AFC' || name === 'NFC') continue;

        try {
          // Scale salary fields
          const oldTeamSalary = team.TEAM_SALARY || 0;
          const oldRosterReserve = team.SalCapRosterReserve || 0;
          const oldPenalties = team.ThisYearCapPenalties || 0;
          const oldNextYearReserve = team.SalCapNextYearSalaryReserve || 0;

          const newTeamSalary = Math.round(oldTeamSalary * scaleFactor);
          const newRosterReserve = Math.round(oldRosterReserve * scaleFactor);
          const newPenalties = Math.round(oldPenalties * scaleFactor);
          const newNextYearReserve = Math.round(oldNextYearReserve * scaleFactor);

          // Calculate cap room: Internal cap - displayed salary - penalties
          const newCapRoom = internalCapUnits - newRosterReserve - newPenalties;

          // Update all fields
          team.TEAM_SALARY = newTeamSalary;
          team.SalCapRosterReserve = newRosterReserve;
          team.ThisYearCapPenalties = newPenalties;
          team.SalCapCapRoom = Math.max(0, newCapRoom);
          team.SalCapSpendingMoney = Math.max(0, newCapRoom);
          team.SalCapNextYearSalaryReserve = newNextYearReserve;

          // Clear rollover cap for historical accuracy
          if (team.RolloverCap && team.RolloverCap > 0) {
            team.RolloverCap = 0;
          }

          if (teamsUpdated < 3) {
            console.log(`[RetroEditorService] ${name}: Salary $${(newRosterReserve * 10000 / 1000000).toFixed(1)}M, CapRoom $${(newCapRoom * 10000 / 1000000).toFixed(1)}M`);
          }

          teamsUpdated++;
        } catch (e: any) {
          console.error(`[RetroEditorService] Failed to update team cap fields: ${e.message}`);
        }
      }

      console.log(`[RetroEditorService] Updated cap fields for ${teamsUpdated} teams`);
    } else {
      console.warn('[RetroEditorService] Could not find Team table to update per-team cap fields');
    }

    return {
      success: true,
      previousCap: previousCap * 10000,
      newCap: capValue,
      note
    };
  }

  // ============================================
  // NFL RECORDS METHODS
  // ============================================

  /**
   * Load NFL historical records data
   */
  private loadNFLRecordsData(): any | null {
    try {
      const appPath = app.getAppPath();
      const dataPath = app.isPackaged
        ? path.join(appPath, '.vite', 'build', 'data', 'retro')
        : path.join(appPath, 'data', 'retro');

      // Try full version first, fall back to basic version
      let recordsPath = path.join(dataPath, 'historical-records-full.json');
      if (!fs.existsSync(recordsPath)) {
        recordsPath = path.join(dataPath, 'historical-records.json');
      }

      if (!fs.existsSync(recordsPath)) {
        console.log('[RetroEditorService] No historical records data file found');
        return null;
      }

      const recordsData = JSON.parse(fs.readFileSync(recordsPath, 'utf-8'));
      console.log('[RetroEditorService] Loaded historical records data from', path.basename(recordsPath));
      return recordsData;
    } catch (error) {
      console.error('[RetroEditorService] Error loading historical records data:', error);
      return null;
    }
  }

  /**
   * Get the historical data for a specific scope and year
   * Falls back to the most recent available year if exact year not found
   */
  private getHistoricalRecordsForYear(data: any, scope: string, year: number): any | null {
    const scopeData = data[scope];
    if (!scopeData) return null;

    const availableYears = Object.keys(scopeData).map(Number).sort((a, b) => a - b);
    if (availableYears.length === 0) return null;

    // Find the closest year that's <= target year
    let dataYear = availableYears[0];
    for (const y of availableYears) {
      if (y <= year) dataYear = y;
      else break;
    }

    return scopeData[dataYear];
  }

  /**
   * Get NFL records preview for a specific year
   */
  getNFLRecordsPreview(year: number): { career: any; season: any; game: any; rookieSeason?: any; rookieGame?: any } {
    const data = this.loadNFLRecordsData();
    if (!data) {
      throw new Error('No historical records data available');
    }

    return {
      career: this.getHistoricalRecordsForYear(data, 'career', year),
      season: this.getHistoricalRecordsForYear(data, 'season', year),
      game: this.getHistoricalRecordsForYear(data, 'game', year),
      rookieSeason: this.getHistoricalRecordsForYear(data, 'rookieSeason', year),
      rookieGame: this.getHistoricalRecordsForYear(data, 'rookieGame', year)
    };
  }

  /**
   * Apply historical NFL records to franchise file
   */
  async applyNFLRecords(filePath: string, year: number): Promise<{ success: boolean; recordsUpdated: number }> {
    console.log(`[RetroEditorService] Applying NFL records for year ${year}`);

    const recordsData = this.loadNFLRecordsData();
    if (!recordsData) {
      throw new Error('No historical records data available');
    }

    // Table IDs for each record scope
    const RECORD_TABLES = {
      career: { id: 3126035436, jsonKey: 'career' },
      season: { id: 3016865922, jsonKey: 'season' },
      game: { id: 3197279835, jsonKey: 'game' },
      rookieSeason: { id: 1211717477, jsonKey: 'rookieSeason' },
      rookieGame: { id: 1291340498, jsonKey: 'rookieGame' }
    };

    const STAT_TYPES = [
      'PassYards', 'PassTds', 'RushYards', 'RushTds',
      'ReceiveYards', 'ReceiveTDs', 'ReceiveCatches',
      'DefensiveInts', 'DefensiveSacks'
    ];

    // Use the correct method to get the franchise instance
    const franchise = this.getFranchise(filePath);

    // Get current season year for offset calculation
    let currentSeasonYear = 2012;
    const seasonInfoId = 3123991521;
    for (const table of franchise.tables) {
      if (table.header?.uniqueId === seasonInfoId) {
        await table.readRecords();
        if (table.records && table.records.length > 0) {
          currentSeasonYear = table.records[0].CurrentSeasonYear || 2012;
        }
        break;
      }
    }
    console.log(`[RetroEditorService] Current season year: ${currentSeasonYear}`);

    // Build team name to index mapping
    const teamTable = franchise.getTableByUniqueId(637929298);
    await teamTable.readRecords();

    const teamNameToIndex: { [key: string]: number } = {};
    for (let i = 0; i < teamTable.records.length; i++) {
      const t = teamTable.records[i];
      if (t.isEmpty) continue;
      const name = (t.DisplayName || t.ShortName || '').toLowerCase();
      const city = (t.TEAM_CITY || '').toLowerCase();
      if (name) teamNameToIndex[name] = i;
      if (city) teamNameToIndex[city] = i;

      // Add common team aliases
      const aliases: { [key: string]: string[] } = {
        'redskins': ['washington', 'commanders'],
        'commanders': ['washington', 'redskins'],
        'oilers': ['titans', 'texans'],
        'texans': ['oilers'],
        '49ers': ['niners', 'san francisco'],
        'raiders': ['las vegas', 'oakland', 'los angeles'],
        'rams': ['los angeles', 'st. louis'],
        'chargers': ['san diego', 'los angeles'],
        'cardinals': ['arizona', 'phoenix', 'st. louis']
      };

      if (aliases[name]) {
        for (const alias of aliases[name]) {
          if (!teamNameToIndex[alias]) teamNameToIndex[alias] = i;
        }
      }
    }

    // Get base teamRef format from a sample record
    let baseRef = '';
    const sampleTable = franchise.getTableByUniqueId(RECORD_TABLES.career.id);
    if (sampleTable) {
      await sampleTable.readRecords();
      const sampleRec = sampleTable.records.find((r: any) => !r.isEmpty);
      if (sampleRec && sampleRec.teamRef) {
        baseRef = sampleRec.teamRef.substring(0, sampleRec.teamRef.length - 6);
      }
    }

    const makeTeamRef = (teamIndex: number): string => {
      const indexBinary = teamIndex.toString(2).padStart(6, '0');
      return baseRef + indexBinary;
    };

    let totalRecordsUpdated = 0;

    // Process each record table
    for (const [scopeName, tableInfo] of Object.entries(RECORD_TABLES)) {
      const table = franchise.getTableByUniqueId(tableInfo.id);
      if (!table) {
        console.log(`[RetroEditorService] Table not found for ${scopeName}, skipping...`);
        continue;
      }

      await table.readRecords();
      console.log(`[RetroEditorService] Processing ${scopeName} records (${table.records.length} total)`);

      // Get historical data for this scope
      const historical = this.getHistoricalRecordsForYear(recordsData, tableInfo.jsonKey, year);
      if (!historical) {
        console.log(`[RetroEditorService] No historical data for ${scopeName}, zeroing out...`);
        for (const r of table.records) {
          if (r.isEmpty) continue;
          r.statValue = 0;
        }
        continue;
      }

      // Group records by statType
      const recordsByType: { [key: string]: any[] } = {};
      for (const r of table.records) {
        if (r.isEmpty) continue;
        const type = r.statType;
        if (!recordsByType[type]) recordsByType[type] = [];
        recordsByType[type].push(r);
      }

      // Process each stat type
      for (const statType of STAT_TYPES) {
        const records = recordsByType[statType];
        if (!records || records.length === 0) continue;

        const historicalData = historical[statType];
        if (!historicalData) {
          // Zero out this stat type if no historical data
          for (const r of records) {
            r.statValue = 0;
          }
          continue;
        }

        // Check if this record is from AFTER the target year (anachronistic)
        if (historicalData.year && historicalData.year > year) {
          for (const r of records) {
            r.statValue = 0;
          }
          continue;
        }

        // Sort by table index (lowest first)
        records.sort((a: any, b: any) => {
          const aIdx = table.records.indexOf(a);
          const bIdx = table.records.indexOf(b);
          return aIdx - bIdx;
        });

        const currentMax = Math.max(...records.map((r: any) => r.statValue));
        const historicalMax = typeof historicalData.value === 'number'
          ? Math.floor(historicalData.value)
          : historicalData.value;

        // Calculate scale factor
        const scaleFactor = currentMax > 0 ? (historicalMax * 0.95) / currentMax : 1;

        // Get team index and ref
        const teamName = historicalData.team || '';
        const teamIndex = teamNameToIndex[teamName.toLowerCase()];
        const teamRef = teamIndex !== undefined ? makeTeamRef(teamIndex) : records[0].teamRef;

        // Calculate the correct year offset
        let recordYear: number;
        if (historicalData.year) {
          recordYear = historicalData.year - currentSeasonYear;
        } else {
          recordYear = year - currentSeasonYear;
        }

        // Update ALL records for this stat type
        // Game reads from fixed indices, so ALL records must show correct year
        for (let i = 0; i < records.length; i++) {
          const r = records[i];
          const originalValue = r.statValue;

          // Set player info on ALL records
          r.firstName = historicalData.firstName;
          r.lastName = historicalData.lastName;
          r.position = historicalData.position;
          if (teamIndex !== undefined) {
            r.teamRef = teamRef;
          }

          // ALL records get the same correct year
          r.seasonYear = recordYear;

          if (i === 0) {
            // Primary record - highest value
            r.statValue = historicalMax;
          } else {
            // Secondary records - scaled value
            r.statValue = currentMax > 0 ? Math.floor(originalValue * scaleFactor) : 0;
          }

          totalRecordsUpdated++;
        }
      }
    }

    console.log(`[RetroEditorService] NFL records applied: ${totalRecordsUpdated} records updated`);

    // Save the franchise file to persist changes
    await franchise.save(filePath);
    console.log(`[RetroEditorService] Franchise file saved`);

    return {
      success: true,
      recordsUpdated: totalRecordsUpdated
    };
  }

  // ============================================
  // SUPER BOWL HISTORY METHODS
  // ============================================

  /**
   * Load Super Bowl history data
   */
  private loadSuperBowlHistoryData(): any | null {
    try {
      const appPath = app.getAppPath();
      const dataPath = app.isPackaged
        ? path.join(appPath, '.vite', 'build', 'data', 'retro')
        : path.join(appPath, 'data', 'retro');

      const historyPath = path.join(dataPath, 'super-bowl-history.json');
      if (!fs.existsSync(historyPath)) {
        console.log('[RetroEditorService] No Super Bowl history data file found');
        return null;
      }

      const historyData = JSON.parse(fs.readFileSync(historyPath, 'utf-8'));
      console.log('[RetroEditorService] Loaded Super Bowl history data');
      return historyData;
    } catch (error) {
      console.error('[RetroEditorService] Error loading Super Bowl history data:', error);
      return null;
    }
  }

  /**
   * Get historical stats preview for a specific year
   * Shows database stats and sample players that will be matched
   */
  async getHistoricalStatsPreview(year: number): Promise<{
    totalPlayers: number;
    yearCoverage: string;
    matchedPlayers: number;
    samplePlayers: any[];
  }> {
    console.log(`[RetroEditorService] Getting historical stats preview for year ${year}`);

    const db = await this.getCareerStatsDatabase();
    if (!db) {
      throw new Error('Career stats database not available');
    }

    try {
      // Get total players and year coverage from database
      const playerCount = db.prepare('SELECT COUNT(*) as c FROM players').get() as any;
      const yearRange = db.prepare('SELECT MIN(from_year) as min_year, MAX(to_year) as max_year FROM players').get() as any;

      // Get sample players who would have stats before the target year
      // Note: handles both 'success' (PFR scraped) and 'imported' (XLS imported) data
      const samplePlayers = db.prepare(`
        SELECT p.first_name, p.last_name, p.position, p.from_year, p.to_year,
               SUM(s.pass_yds) as pass_yds, SUM(s.rush_yds) as rush_yds,
               SUM(s.rec_yds) as rec_yds, SUM(s.tackles) as tackles, SUM(s.sacks) as sacks
        FROM players p
        LEFT JOIN player_season_stats s ON p.pfr_id = s.pfr_id AND s.year < ?
        WHERE p.to_year >= ? AND p.from_year < ?
        GROUP BY p.pfr_id
        HAVING SUM(s.games) > 0
        ORDER BY (SUM(s.pass_yds) + SUM(s.rush_yds) + SUM(s.rec_yds)) DESC
        LIMIT 10
      `).all(year, year - 15, year) as any[];

      // Count players who would have stats
      const matchedCount = db.prepare(`
        SELECT COUNT(DISTINCT p.pfr_id) as c
        FROM players p
        JOIN player_season_stats s ON p.pfr_id = s.pfr_id AND s.year < ?
        WHERE p.to_year >= ? AND p.from_year < ?
      `).get(year, year - 15, year) as any;

      return {
        totalPlayers: playerCount?.c || 0,
        yearCoverage: `${yearRange?.min_year || '?'}-${yearRange?.max_year || '?'}`,
        matchedPlayers: matchedCount?.c || 0,
        samplePlayers: samplePlayers.map(p => ({
          first_name: p.first_name,
          last_name: p.last_name,
          position: p.position,
          pass_yds: p.pass_yds || 0,
          rush_yds: p.rush_yds || 0,
          rec_yds: p.rec_yds || 0,
          tackles: p.tackles || 0,
          sacks: p.sacks || 0
        }))
      };
    } finally {
      db.close();
    }
  }

  /**
   * Get career stats database connection using sql.js (pure JS SQLite)
   * This avoids native module compatibility issues with Electron
   */
  private async getCareerStatsDatabase(): Promise<SqlJsWrapper | null> {
    try {
      const initSqlJs = require('sql.js');
      const appPath = app.getAppPath();
      const dbPath = app.isPackaged
        ? path.join(appPath, '.vite', 'build', 'data', 'player-career-stats.db')
        : path.join(appPath, 'data', 'player-career-stats.db');

      if (!fs.existsSync(dbPath)) {
        console.log('[RetroEditorService] Career stats database not found at:', dbPath);
        return null;
      }

      // Initialize sql.js
      const SQL = await initSqlJs();

      // Load database file into memory
      const fileBuffer = fs.readFileSync(dbPath);
      const db = new SQL.Database(fileBuffer);

      // Return a wrapper that provides a better-sqlite3-like API
      return new SqlJsWrapper(db);
    } catch (error) {
      console.error('[RetroEditorService] Error opening career stats database:', error);
      return null;
    }
  }

  /**
   * Apply historical career stats to franchise file players
   * Matches players by name and populates their career stats
   */
  async applyHistoricalStats(filePath: string, year: number): Promise<{ success: boolean; playersUpdated: number }> {
    console.log(`[RetroEditorService] Applying historical stats for year ${year}`);

    const db = await this.getCareerStatsDatabase();
    if (!db) {
      throw new Error('Career stats database not available');
    }

    const franchise = this.getFranchise(filePath);
    if (!franchise) {
      db.close();
      throw new Error(`Franchise file not loaded: ${filePath}`);
    }

    try {
      // Get Player table
      const PLAYER_TABLE_ID = 1612938518;
      const playerTable = franchise.getTableByUniqueId(PLAYER_TABLE_ID);
      if (!playerTable) {
        throw new Error('Player table not found');
      }

      await playerTable.readRecords();
      console.log(`[RetroEditorService] Found ${playerTable.records.length} players in franchise`);

      // Get CareerOffensiveStats and CareerDefensiveStats tables
      const CAREER_OFF_STATS_ID = 3425633076;
      const CAREER_DEF_STATS_ID = 2990623107;

      const careerOffTable = franchise.getTableByUniqueId(CAREER_OFF_STATS_ID);
      const careerDefTable = franchise.getTableByUniqueId(CAREER_DEF_STATS_ID);

      if (careerOffTable) await careerOffTable.readRecords();
      if (careerDefTable) await careerDefTable.readRecords();

      console.log(`[RetroEditorService] Career tables: Offensive=${careerOffTable?.records?.length || 0}, Defensive=${careerDefTable?.records?.length || 0}`);

      // Prepare query for getting player stats
      const getPlayerStats = db.prepare(`
        SELECT p.pfr_id, p.first_name, p.last_name, p.position, p.from_year, p.to_year,
               SUM(s.games) as games, SUM(s.games_started) as games_started,
               SUM(s.pass_cmp) as pass_cmp, SUM(s.pass_att) as pass_att,
               SUM(s.pass_yds) as pass_yds, SUM(s.pass_td) as pass_td, SUM(s.pass_int) as pass_int,
               SUM(s.rush_att) as rush_att, SUM(s.rush_yds) as rush_yds, SUM(s.rush_td) as rush_td,
               SUM(s.rec) as rec, SUM(s.rec_yds) as rec_yds, SUM(s.rec_td) as rec_td,
               SUM(s.tackles) as tackles, SUM(s.sacks) as sacks,
               SUM(s.def_int) as def_int, SUM(s.ff) as ff, SUM(s.fr) as fr
        FROM players p
        JOIN player_season_stats s ON p.pfr_id = s.pfr_id
        WHERE LOWER(p.first_name) = LOWER(?) AND LOWER(p.last_name) = LOWER(?) AND s.year < ?
        GROUP BY p.pfr_id
        ORDER BY ABS(p.from_year - ?) ASC
        LIMIT 1
      `);

      let playersUpdated = 0;

      for (const player of playerTable.records) {
        if (player.isEmpty) continue;

        const firstName = player.FirstName;
        const lastName = player.LastName;
        if (!firstName || !lastName) continue;

        // Look up player in our database
        const stats = getPlayerStats.get(firstName, lastName, year, year - 10) as any;
        if (!stats || stats.games === 0) continue;

        // Apply offensive stats if player has career stats reference
        if (careerOffTable && player.CareerStats) {
          try {
            // Extract record index from CareerStats reference (last 17 bits)
            const careerStatsRef = parseInt(player.CareerStats);
            if (careerStatsRef > 0) {
              const recordIndex = careerStatsRef & 0x1FFFF;
              if (recordIndex < careerOffTable.records.length) {
                const careerRecord = careerOffTable.records[recordIndex];

                // Set offensive stats
                if (stats.pass_yds > 0) {
                  careerRecord.PASSYARDS = stats.pass_yds || 0;
                  careerRecord.PASSTDS = stats.pass_td || 0;
                  careerRecord.PASSINTS = stats.pass_int || 0;
                  careerRecord.PASSATT = stats.pass_att || 0;
                  careerRecord.PASSCOMP = stats.pass_cmp || 0;
                }

                if (stats.rush_yds > 0) {
                  careerRecord.RUSHYARDS = stats.rush_yds || 0;
                  careerRecord.RUSHTDS = stats.rush_td || 0;
                  careerRecord.RUSHATTS = stats.rush_att || 0;
                }

                if (stats.rec_yds > 0) {
                  careerRecord.RECYARDS = stats.rec_yds || 0;
                  careerRecord.RECTDS = stats.rec_td || 0;
                  careerRecord.RECEPTIONS = stats.rec || 0;
                }

                careerRecord.GAMESPLAYED = stats.games || 0;
                careerRecord.GAMESSTARTED = stats.games_started || 0;

                playersUpdated++;

                if (playersUpdated <= 5) {
                  console.log(`[RetroEditorService] Updated ${firstName} ${lastName}: ${stats.pass_yds} pass yds, ${stats.rush_yds} rush yds, ${stats.rec_yds} rec yds`);
                }
              }
            }
          } catch (e: any) {
            console.error(`[RetroEditorService] Error updating offensive stats for ${firstName} ${lastName}:`, e.message);
          }
        }

        // Apply defensive stats
        if (careerDefTable && player.CareerDefensiveStats) {
          try {
            const defStatsRef = parseInt(player.CareerDefensiveStats);
            if (defStatsRef > 0) {
              const recordIndex = defStatsRef & 0x1FFFF;
              if (recordIndex < careerDefTable.records.length) {
                const defRecord = careerDefTable.records[recordIndex];

                if (stats.tackles > 0 || stats.sacks > 0 || stats.def_int > 0) {
                  defRecord.TOTALTACKLES = stats.tackles || 0;
                  defRecord.SACKS = stats.sacks || 0;
                  defRecord.DEFINTS = stats.def_int || 0;
                  defRecord.FORCEDFUMBLES = stats.ff || 0;
                  defRecord.FUMRECS = stats.fr || 0;
                }
              }
            }
          } catch (e: any) {
            console.error(`[RetroEditorService] Error updating defensive stats for ${firstName} ${lastName}:`, e.message);
          }
        }
      }

      console.log(`[RetroEditorService] Historical stats applied: ${playersUpdated} players updated`);

      // Save the franchise file
      await franchise.save(filePath);
      console.log(`[RetroEditorService] Franchise file saved`);

      return {
        success: true,
        playersUpdated
      };
    } finally {
      db.close();
    }
  }

  // ============================================
  // STADIUM NAME METHODS
  // ============================================

  /**
   * Load stadium data
   */
  private loadStadiumData(): any | null {
    try {
      const appPath = app.getAppPath();
      const dataPath = app.isPackaged
        ? path.join(appPath, '.vite', 'build', 'data', 'retro')
        : path.join(appPath, 'data', 'retro');

      const stadiumPath = path.join(dataPath, 'stadiums.json');
      if (!fs.existsSync(stadiumPath)) {
        console.log('[RetroEditorService] No stadium data file found');
        return null;
      }

      const stadiumData = JSON.parse(fs.readFileSync(stadiumPath, 'utf-8'));
      console.log('[RetroEditorService] Loaded stadium data');
      return stadiumData;
    } catch (error) {
      console.error('[RetroEditorService] Error loading stadium data:', error);
      return null;
    }
  }

  /**
   * Get stadium name for a team in a specific year
   */
  getStadiumNameForYear(teamIndex: number, year: number): string | null {
    const data = this.loadStadiumData();
    if (!data || !data.stadiums) return null;

    const teamStadiums = data.stadiums[teamIndex.toString()];
    if (!teamStadiums || !teamStadiums.ranges) return null;

    for (const range of teamStadiums.ranges) {
      if (year >= range.start && year <= range.end) {
        return range.name;
      }
    }

    return null;
  }

  /**
   * Get stadium preview for a year
   */
  async getStadiumPreview(filePath: string, year: number): Promise<{
    available: boolean;
    stadiumChanges: Array<{
      teamIndex: number;
      teamName: string;
      oldName: string;
      newName: string;
    }>;
    warnings: string[];
  }> {
    const data = this.loadStadiumData();
    if (!data) {
      return {
        available: false,
        stadiumChanges: [],
        warnings: ['No stadium data available']
      };
    }

    const stadiumChanges: Array<{
      teamIndex: number;
      teamName: string;
      oldName: string;
      newName: string;
    }> = [];

    for (const [teamIndexStr, teamData] of Object.entries(data.stadiums)) {
      const teamIndex = parseInt(teamIndexStr);
      const stadiumInfo = teamData as any;
      const newName = this.getStadiumNameForYear(teamIndex, year);

      if (newName && stadiumInfo.teamName) {
        stadiumChanges.push({
          teamIndex,
          teamName: stadiumInfo.teamName,
          oldName: '(Current)',
          newName
        });
      }
    }

    return {
      available: true,
      stadiumChanges,
      warnings: []
    };
  }

  /**
   * Apply historical stadium names to franchise file
   */
  async applyStadiumNames(filePath: string, year: number): Promise<{
    success: boolean;
    stadiumsUpdated: number;
    warnings: string[];
    error?: string;
  }> {
    const franchise = this.getFranchise(filePath);
    if (!franchise) {
      return {
        success: false,
        stadiumsUpdated: 0,
        warnings: [],
        error: 'Franchise file not loaded. Call loadFranchiseFile first.'
      };
    }

    const stadiumData = this.loadStadiumData();
    if (!stadiumData) {
      return {
        success: false,
        stadiumsUpdated: 0,
        warnings: [],
        error: 'No stadium data available'
      };
    }

    console.log(`[RetroEditorService] Applying stadium names for year ${year}`);

    // Get the Stadium table
    let stadiumTable = franchise.getTableByUniqueId(TABLE_IDS.stadiumTable);
    if (!stadiumTable) {
      stadiumTable = franchise.getTableByName('Stadium');
    }
    if (!stadiumTable) {
      console.error('[RetroEditorService] Could not find Stadium table!');
      return {
        success: false,
        stadiumsUpdated: 0,
        warnings: [],
        error: 'Could not find Stadium table in franchise file'
      };
    }

    await stadiumTable.readRecords();
    console.log(`[RetroEditorService] Found ${stadiumTable.records.length} stadium records`);

    // Log first record fields
    if (stadiumTable.records.length > 0) {
      const firstRecord = stadiumTable.records[0];
      const fieldNames = Object.keys(firstRecord).filter(k => !k.startsWith('_') && typeof firstRecord[k] !== 'function');
      console.log('[RetroEditorService] Stadium table fields:', fieldNames.slice(0, 20));
    }

    const warnings: string[] = [];
    let stadiumsUpdated = 0;

    // We need to match stadiums to teams
    // Stadium table typically has TeamIndex field or we need to match by team association
    for (const stadiumRecord of stadiumTable.records) {
      if (stadiumRecord.isEmpty) continue;

      // Try to get team index from stadium record
      const teamIndex = stadiumRecord.TeamIndex;
      if (teamIndex === undefined || teamIndex >= 32) continue;

      const newName = this.getStadiumNameForYear(teamIndex, year);
      if (!newName) continue;

      const oldName = stadiumRecord.Name || stadiumRecord.StadiumName || '(unknown)';

      // Update stadium name
      // NOTE: Don't use 'in' check - properties are on prototype
      let updated = false;
      try {
        stadiumRecord.Name = newName;
        updated = true;
        console.log(`[RetroEditorService] Stadium for team ${teamIndex}: "${oldName}" -> "${newName}"`);
      } catch (e) {
        // Name field may not exist, try StadiumName
        try {
          stadiumRecord.StadiumName = newName;
          updated = true;
          console.log(`[RetroEditorService] Stadium for team ${teamIndex}: "${oldName}" -> "${newName}"`);
        } catch (e2) {
          warnings.push(`Stadium record for team ${teamIndex} has no Name field`);
        }
      }
      if (updated) stadiumsUpdated++;
    }

    console.log(`[RetroEditorService] Updated ${stadiumsUpdated} stadium names`);

    return {
      success: true,
      stadiumsUpdated,
      warnings
    };
  }

  // ============================================
  // TEAM SCHEME METHODS
  // ============================================

  /**
   * Load team schemes data
   */
  private loadTeamSchemesData(): any | null {
    try {
      const appPath = app.getAppPath();
      const dataPath = app.isPackaged
        ? path.join(appPath, '.vite', 'build', 'data', 'retro')
        : path.join(appPath, 'data', 'retro');

      const schemesPath = path.join(dataPath, 'team-schemes.json');
      if (!fs.existsSync(schemesPath)) {
        console.log('[RetroEditorService] No team schemes data file found');
        return null;
      }

      const schemesData = JSON.parse(fs.readFileSync(schemesPath, 'utf-8'));
      console.log('[RetroEditorService] Loaded team schemes data');
      return schemesData;
    } catch (error) {
      console.error('[RetroEditorService] Error loading team schemes data:', error);
      return null;
    }
  }

  /**
   * Get scheme for a team in a specific year
   */
  getSchemeForTeam(teamName: string, year: number): { offense: string; defense: string; note?: string } | null {
    const data = this.loadTeamSchemesData();
    if (!data) return null;

    // Check for team-specific override first
    const yearStr = year.toString();
    if (data.teamOverrides && data.teamOverrides[yearStr]) {
      const teamOverride = data.teamOverrides[yearStr][teamName];
      if (teamOverride) {
        return {
          offense: teamOverride.offense,
          defense: teamOverride.defense,
          note: teamOverride.note
        };
      }
    }

    // Fall back to era default
    if (data.defaultByEra) {
      for (const [eraRange, eraScheme] of Object.entries(data.defaultByEra)) {
        const [startYear, endYear] = eraRange.split('-').map(Number);
        if (year >= startYear && year <= endYear) {
          const scheme = eraScheme as any;
          return {
            offense: scheme.offense,
            defense: scheme.defense,
            note: scheme.note
          };
        }
      }
    }

    return null;
  }

  /**
   * Get scheme preview for a year
   */
  async getSchemePreview(filePath: string, year: number): Promise<{
    available: boolean;
    schemeChanges: Array<{
      teamIndex: number;
      teamName: string;
      offenseScheme: string;
      defenseScheme: string;
      note?: string;
    }>;
    warnings: string[];
  }> {
    const data = this.loadTeamSchemesData();
    if (!data) {
      return {
        available: false,
        schemeChanges: [],
        warnings: ['No team schemes data available']
      };
    }

    const schemeChanges: Array<{
      teamIndex: number;
      teamName: string;
      offenseScheme: string;
      defenseScheme: string;
      note?: string;
    }> = [];

    // Get all teams and their schemes
    for (const team of this.historicalTeams) {
      const teamName = team.currentName;
      const scheme = this.getSchemeForTeam(teamName, year);

      if (scheme) {
        schemeChanges.push({
          teamIndex: team.teamIndex,
          teamName,
          offenseScheme: scheme.offense,
          defenseScheme: scheme.defense,
          note: scheme.note
        });
      }
    }

    return {
      available: true,
      schemeChanges,
      warnings: []
    };
  }

  /**
   * Apply historical team schemes to franchise file
   * Updates the Coach table's OffensiveScheme and DefensiveScheme fields on the HC
   */
  async applyTeamSchemes(filePath: string, year: number): Promise<{
    success: boolean;
    schemesUpdated: number;
    warnings: string[];
    error?: string;
  }> {
    const franchise = this.getFranchise(filePath);
    if (!franchise) {
      return {
        success: false,
        schemesUpdated: 0,
        warnings: [],
        error: 'Franchise file not loaded. Call loadFranchiseFile first.'
      };
    }

    const schemesData = this.loadTeamSchemesData();
    if (!schemesData) {
      return {
        success: false,
        schemesUpdated: 0,
        warnings: [],
        error: 'No team schemes data available'
      };
    }

    console.log(`[RetroEditorService] Applying team schemes for year ${year}`);

    // Get the Coach table (schemes are on the HC record)
    let coachTable = franchise.getTableByUniqueId(TABLE_IDS.coachTable);
    if (!coachTable) {
      coachTable = franchise.getTableByName('Coach');
    }
    if (!coachTable) {
      console.error('[RetroEditorService] Could not find Coach table!');
      return {
        success: false,
        schemesUpdated: 0,
        warnings: [],
        error: 'Could not find Coach table in franchise file'
      };
    }

    await coachTable.readRecords();

    const warnings: string[] = [];
    let schemesUpdated = 0;

    // Group coaches by TeamIndex, find HC for each team
    const hcByTeam = new Map<number, any>();
    for (const record of coachTable.records) {
      if (record.isEmpty) continue;

      const teamIndex = record.TeamIndex;
      if (teamIndex === undefined || teamIndex >= 32) continue;

      const position = record.Position;
      const isHC = position === 0 || position === 'HeadCoach' || position === 'CoachPosition:HeadCoach';

      // For teams with multiple HCs, prefer signed one
      if (isHC) {
        const contractStatus = record.ContractStatus;
        const isSigned = contractStatus === 'Signed' || contractStatus === 'ContractStatus:Signed';
        const existing = hcByTeam.get(teamIndex);

        if (!existing || (isSigned && existing.ContractStatus !== 'Signed')) {
          hcByTeam.set(teamIndex, record);
        }
      }
    }

    // Apply schemes to each team's HC
    for (const team of this.historicalTeams) {
      const hcRecord = hcByTeam.get(team.teamIndex);
      if (!hcRecord) {
        warnings.push(`No HC found for ${team.currentName}`);
        continue;
      }

      const scheme = this.getSchemeForTeam(team.currentName, year);
      if (!scheme) {
        continue;
      }

      // Get scheme enum values
      const offenseEnum = schemesData.schemeEnums?.offense?.[scheme.offense];
      const defenseEnum = schemesData.schemeEnums?.defense?.[scheme.defense];

      let updated = false;

      // Set offensive scheme
      // NOTE: Don't use 'in' check - properties are on prototype
      if (offenseEnum !== undefined) {
        try {
          const oldScheme = hcRecord.OffensiveScheme;
          hcRecord.OffensiveScheme = offenseEnum;
          console.log(`[RetroEditorService] ${team.currentName} offense: ${oldScheme} -> ${scheme.offense} (${offenseEnum})`);
          updated = true;
        } catch (e) { /* field may not exist */ }
      }

      // Set defensive scheme
      if (defenseEnum !== undefined) {
        try {
          const oldScheme = hcRecord.DefensiveScheme;
          hcRecord.DefensiveScheme = defenseEnum;
          console.log(`[RetroEditorService] ${team.currentName} defense: ${oldScheme} -> ${scheme.defense} (${defenseEnum})`);
          updated = true;
        } catch (e) { /* field may not exist */ }
      }

      if (updated) {
        schemesUpdated++;
      }
    }

    console.log(`[RetroEditorService] Updated ${schemesUpdated} team schemes`);

    return {
      success: true,
      schemesUpdated,
      warnings
    };
  }

  // ============================================
  // UNIFORM MANAGEMENT
  // ============================================

  /**
   * Load uniform mapping data
   */
  async loadUniformMapping(): Promise<any | null> {
    try {
      const appPath = app.getAppPath();
      const dataPath = app.isPackaged
        ? path.join(appPath, '.vite', 'build', 'data', 'retro')
        : path.join(appPath, 'data', 'retro');

      const uniformFilePath = path.join(dataPath, 'uniform-mapping.json');

      if (!fs.existsSync(uniformFilePath)) {
        console.log('[RetroEditorService] No uniform mapping file found');
        return null;
      }

      const uniformData = JSON.parse(fs.readFileSync(uniformFilePath, 'utf-8'));
      console.log(`[RetroEditorService] Loaded uniform mapping for ${Object.keys(uniformData.teams || {}).length} teams`);
      return uniformData;
    } catch (error) {
      console.error('[RetroEditorService] Error loading uniform mapping:', error);
      return null;
    }
  }

  /**
   * Get uniform configuration for all teams for a specific year
   * Returns what uniforms would be applied for the given year
   */
  async getUniformsForYear(year: number): Promise<{
    available: boolean;
    year: number;
    teamCount: number;
    uniforms: Array<{
      teamAbbr: string;
      variantName: string;
      homeIndex: number;
      awayIndex: number;
      homeShade: string;
      awayShade: string;
      note?: string;
    }>;
    warnings: string[];
  }> {
    const uniformData = await this.loadUniformMapping();

    if (!uniformData || !uniformData.teams) {
      return {
        available: false,
        year,
        teamCount: 0,
        uniforms: [],
        warnings: ['No uniform mapping data available']
      };
    }

    const uniforms: Array<{
      teamAbbr: string;
      variantName: string;
      homeIndex: number;
      awayIndex: number;
      homeShade: string;
      awayShade: string;
      note?: string;
    }> = [];
    const warnings: string[] = [];

    for (const [teamAbbr, teamData] of Object.entries(uniformData.teams as Record<string, any>)) {
      const variants = teamData.uniformVariants || [];
      const yearMappings = teamData.yearMapping || [];

      // Find the appropriate variant for this year
      let selectedVariant = null;
      let selectedMapping = null;

      for (const mapping of yearMappings) {
        if (year >= mapping.startYear && year <= mapping.endYear) {
          selectedMapping = mapping;
          if (mapping.variantIndex >= 0 && mapping.variantIndex < variants.length) {
            selectedVariant = variants[mapping.variantIndex];
          }
          break;
        }
      }

      if (selectedVariant) {
        uniforms.push({
          teamAbbr,
          variantName: selectedVariant.name || 'Unknown',
          homeIndex: selectedVariant.homeIndex ?? -1,
          awayIndex: selectedVariant.awayIndex ?? -1,
          homeShade: selectedVariant.homeShade || 'Dark',
          awayShade: selectedVariant.awayShade || 'Light',
          note: selectedVariant.note || selectedMapping?.note
        });
      } else {
        // Default to modern/index 0 if no mapping found
        const defaultVariant = variants[0];
        if (defaultVariant) {
          uniforms.push({
            teamAbbr,
            variantName: defaultVariant.name || 'Modern',
            homeIndex: defaultVariant.homeIndex ?? -1,
            awayIndex: defaultVariant.awayIndex ?? -1,
            homeShade: defaultVariant.homeShade || 'Dark',
            awayShade: defaultVariant.awayShade || 'Light',
            note: `No specific mapping for ${year}, using default`
          });
        } else {
          warnings.push(`No uniform data for ${teamAbbr}`);
        }
      }
    }

    return {
      available: true,
      year,
      teamCount: uniforms.length,
      uniforms,
      warnings
    };
  }

  /**
   * Apply uniforms for a specific year to the loaded franchise
   * Sets HomeUniformIndex/AwayUniformIndex on Team table records
   */
  async applyUniforms(year: number): Promise<{
    success: boolean;
    uniformsApplied: number;
    warnings: string[];
    error?: string;
  }> {
    if (!this.franchise) {
      return {
        success: false,
        uniformsApplied: 0,
        warnings: [],
        error: 'Franchise file not loaded. Call loadFranchiseFile first.'
      };
    }

    const uniformConfig = await this.getUniformsForYear(year);
    if (!uniformConfig.available) {
      return {
        success: false,
        uniformsApplied: 0,
        warnings: uniformConfig.warnings,
        error: 'No uniform configuration available'
      };
    }

    const warnings: string[] = [...uniformConfig.warnings];
    let uniformsApplied = 0;

    try {
      // Get team table
      const teamTable = await this.franchise.getTableByUniqueId(TABLE_IDS.teamTable);
      if (!teamTable) {
        return {
          success: false,
          uniformsApplied: 0,
          warnings,
          error: 'Could not find Team table in franchise file'
        };
      }

      await teamTable.readRecords();
      const teams = teamTable.records;

      // Build team abbreviation to index mapping
      const teamAbbrToIndex: Map<string, number> = new Map();
      for (let i = 0; i < teams.length; i++) {
        const team = teams[i];
        const shortName = team.ShortName || team.Field_51; // ShortName field
        if (shortName && !team.isEmpty) {
          teamAbbrToIndex.set(shortName.toUpperCase(), i);
        }
      }

      // Apply uniforms
      for (const uniformInfo of uniformConfig.uniforms) {
        const teamIndex = teamAbbrToIndex.get(uniformInfo.teamAbbr.toUpperCase());
        if (teamIndex === undefined) {
          warnings.push(`Team ${uniformInfo.teamAbbr} not found in franchise`);
          continue;
        }

        const teamRecord = teams[teamIndex];

        // Only apply if we have valid indices (not -1)
        let applied = false;

        // Apply HomeUniformShade
        // NOTE: Don't use 'in' check - properties are on prototype
        try {
          teamRecord.HomeUniformShade = uniformInfo.homeShade;
          applied = true;
        } catch (err) {
          console.log(`[RetroEditorService] Could not set HomeUniformShade for ${uniformInfo.teamAbbr}`);
        }

        // Apply AwayUniformShade
        try {
          teamRecord.AwayUniformShade = uniformInfo.awayShade;
          applied = true;
        } catch (err) {
          console.log(`[RetroEditorService] Could not set AwayUniformShade for ${uniformInfo.teamAbbr}`);
        }

        // Note: HomeUniformIndex/AwayUniformIndex are game-level fields, not team-level
        // If these fields exist on Team table, try to set them
        if (uniformInfo.homeIndex >= 0) {
          try {
            teamRecord.HomeUniform = uniformInfo.homeIndex;
            applied = true;
          } catch (err) {
            console.log(`[RetroEditorService] Could not set HomeUniform for ${uniformInfo.teamAbbr}`);
          }
        }

        if (uniformInfo.awayIndex >= 0) {
          try {
            teamRecord.AwayUniform = uniformInfo.awayIndex;
            applied = true;
          } catch (err) {
            console.log(`[RetroEditorService] Could not set AwayUniform for ${uniformInfo.teamAbbr}`);
          }
        }

        if (applied) {
          uniformsApplied++;
          console.log(`[RetroEditorService] Applied ${uniformInfo.variantName} uniform to ${uniformInfo.teamAbbr}`);
        }
      }

      console.log(`[RetroEditorService] Applied uniforms to ${uniformsApplied} teams for year ${year}`);

      return {
        success: true,
        uniformsApplied,
        warnings
      };
    } catch (error) {
      console.error('[RetroEditorService] Error applying uniforms:', error);
      return {
        success: false,
        uniformsApplied,
        warnings,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Get uniform preview summary for a year
   * Returns a simplified summary for UI display
   */
  async getUniformPreviewSummary(year: number): Promise<{
    available: boolean;
    summary: string;
    teamsWithThrowbacks: number;
    teamsWithModern: number;
  }> {
    const uniformConfig = await this.getUniformsForYear(year);

    if (!uniformConfig.available) {
      return {
        available: false,
        summary: 'No uniform data available',
        teamsWithThrowbacks: 0,
        teamsWithModern: 0
      };
    }

    let throwbackCount = 0;
    let modernCount = 0;

    for (const uniform of uniformConfig.uniforms) {
      if (uniform.variantName.toLowerCase().includes('modern') || uniform.variantName.toLowerCase() === 'default') {
        modernCount++;
      } else {
        throwbackCount++;
      }
    }

    const summary = throwbackCount > 0
      ? `${throwbackCount} teams with era-appropriate uniforms, ${modernCount} with modern`
      : `All ${modernCount} teams using modern uniforms`;

    return {
      available: true,
      summary,
      teamsWithThrowbacks: throwbackCount,
      teamsWithModern: modernCount
    };
  }

  // ============================================
  // ERA-APPROPRIATE CONTRACT METHODS
  // ============================================

  /**
   * Position importance multipliers for contract calculations
   * Higher value = more money for that position
   */
  private readonly positionValueMultipliers: { [key: string]: number } = {
    // Premium positions
    'QB': 2.0,      // Quarterbacks get paid the most
    'LEDG': 1.3,    // Pass rushers
    'REDG': 1.3,
    'CB': 1.2,      // Corners
    'WR': 1.15,     // Receivers
    'LT': 1.15,     // Left Tackles
    // Standard positions
    'DT': 1.0,
    'FS': 1.0,
    'SS': 1.0,
    'LG': 0.95,
    'RG': 0.95,
    'RT': 0.95,
    'C': 0.9,
    'TE': 0.9,
    'HB': 0.85,
    'FB': 0.7,
    'Mike': 0.85,   // Linebackers
    'WILL': 0.8,
    'SAM': 0.8,
    // Specialists (lowest)
    'K': 0.5,
    'P': 0.5,
    'LS': 0.3
  };

  /**
   * Get historical average salary for a year (in thousands)
   * Based on actual NFL salary history
   */
  private getHistoricalAverageSalary(year: number): number {
    // Historical NFL average salary progression (in thousands)
    // Pre-1970: ~$20-25K average
    // 1970s: $30-100K range
    // 1980s: $100-400K range
    // 1990s: $400K-1.5M range
    // 2000s: $1.5-2.5M range
    // 2010s: $2.5-3M range
    // 2020s: $3M+ range

    if (year < 1970) return 25;      // $25K average
    if (year < 1975) return 40;      // $40K average
    if (year < 1980) return 70;      // $70K average
    if (year < 1985) return 150;     // $150K average
    if (year < 1990) return 300;     // $300K average
    if (year < 1995) return 700;     // $700K average
    if (year < 2000) return 1200;    // $1.2M average
    if (year < 2005) return 1800;    // $1.8M average
    if (year < 2010) return 2200;    // $2.2M average
    if (year < 2015) return 2500;    // $2.5M average
    if (year < 2020) return 2900;    // $2.9M average
    return 3500;                      // $3.5M+ average for modern era
  }

  /**
   * Generate era-appropriate contract for a player
   *
   * @param position Player's position
   * @param overall Player's overall rating
   * @param year Historical year
   * @param yearsOfService Player's years pro (affects contract length)
   * @returns Contract details
   */
  generateEraAppropriateContract(
    position: string,
    overall: number,
    year: number,
    yearsOfService: number = 0
  ): {
    salary: number;      // Annual salary in thousands
    length: number;      // Contract length in years
    bonus: number;       // Signing bonus in thousands
  } {
    // Get base historical average
    const baseAverage = this.getHistoricalAverageSalary(year);

    // Get position multiplier (default to 1.0 if position not found)
    const positionMultiplier = this.positionValueMultipliers[position] || 1.0;

    // OVR-based multiplier (scale from 0.3x for 60 OVR to 5x for 99 OVR)
    // This creates a steep curve where elite players get much more
    let ovrMultiplier: number;
    if (overall >= 90) {
      // Elite players: 90-99 OVR get 2.5x to 5x
      ovrMultiplier = 2.5 + ((overall - 90) / 9) * 2.5;
    } else if (overall >= 80) {
      // Good players: 80-89 OVR get 1.2x to 2.5x
      ovrMultiplier = 1.2 + ((overall - 80) / 9) * 1.3;
    } else if (overall >= 70) {
      // Average players: 70-79 OVR get 0.6x to 1.2x
      ovrMultiplier = 0.6 + ((overall - 70) / 9) * 0.6;
    } else {
      // Below average: 60-69 OVR get 0.3x to 0.6x
      ovrMultiplier = 0.3 + ((overall - 60) / 9) * 0.3;
    }

    // Calculate base salary
    let salary = Math.round(baseAverage * positionMultiplier * ovrMultiplier);

    // Apply minimum salary (varies by era)
    const minSalary = year < 1994 ? Math.round(baseAverage * 0.2) : Math.round(baseAverage * 0.3);
    salary = Math.max(salary, minSalary);

    // Determine contract length based on OVR and experience
    let length: number;
    if (overall >= 90) {
      length = yearsOfService > 3 ? 5 : 4;  // Elite players get longer deals
    } else if (overall >= 80) {
      length = yearsOfService > 3 ? 4 : 3;
    } else if (overall >= 70) {
      length = yearsOfService > 5 ? 3 : 2;
    } else {
      length = 1;  // Roster fillers get 1-year deals
    }

    // Cap length at 7 years (Madden max)
    length = Math.min(length, 7);

    // Signing bonus (only for longer contracts)
    let bonus = 0;
    if (length >= 3 && overall >= 75) {
      // Signing bonus is roughly 10-20% of total contract value
      bonus = Math.round(salary * length * 0.15);
    }

    return { salary, length, bonus };
  }

  /**
   * Apply era-appropriate contracts to all players in the franchise
   *
   * @param filePath Path to franchise file
   * @param year Historical year
   * @returns Results of contract application
   */
  async applyEraAppropriateContracts(filePath: string, year: number): Promise<{
    success: boolean;
    playersUpdated: number;
    averageSalary: number;
    warnings: string[];
    error?: string;
  }> {
    const franchise = this.getFranchise(filePath);
    if (!franchise) {
      return {
        success: false,
        playersUpdated: 0,
        averageSalary: 0,
        warnings: [],
        error: 'Franchise file not loaded. Call loadFranchiseFile first.'
      };
    }

    console.log(`[RetroEditorService] Applying era-appropriate contracts for year ${year}`);

    // Get Player table
    let playerTable = franchise.getTableByUniqueId(TABLE_IDS.playerTable);
    if (!playerTable) {
      playerTable = franchise.getTableByName('Player');
    }
    if (!playerTable) {
      return {
        success: false,
        playersUpdated: 0,
        averageSalary: 0,
        warnings: [],
        error: 'Could not find Player table'
      };
    }

    await playerTable.readRecords();
    console.log(`[RetroEditorService] Found ${playerTable.records.length} player records`);

    const warnings: string[] = [];
    let playersUpdated = 0;
    let totalSalary = 0;
    const FREE_AGENT_TEAM_INDEX = 32;

    for (const player of playerTable.records) {
      if (player.isEmpty) continue;

      // Get player info
      const position = player.Position;
      // Use explicit null/undefined checks - OverallRating is the correct field name per M26 schema
      let overall: number;
      if (player.OverallRating !== undefined && player.OverallRating !== null) {
        overall = player.OverallRating;
      } else {
        overall = 70;
      }
      const teamIndex = player.TeamIndex;
      const yearsOfService = player.YearsPro || 0;

      // Skip free agents (they don't have active contracts)
      if (teamIndex >= FREE_AGENT_TEAM_INDEX) continue;

      // Generate era-appropriate contract
      const contract = this.generateEraAppropriateContract(position, overall, year, yearsOfService);

      // Apply contract fields
      try {
        // Set contract length
        player.ContractLength = contract.length;
        player.ContractYear = 0;  // Start at year 0

        // Set salary for each year of the contract
        // NOTE: Don't use 'in' check - properties are on prototype
        for (let i = 0; i < 8; i++) {
          const salaryField = `ContractSalary${i}`;
          const bonusField = `ContractBonus${i}`;

          if (i < contract.length) {
            // Active contract year - set salary
            try { player[salaryField] = contract.salary; } catch (e) { /* field may not exist */ }
            // Set signing bonus in year 0 only
            try { player[bonusField] = (i === 0) ? contract.bonus : 0; } catch (e) { /* field may not exist */ }
          } else {
            // Beyond contract length - zero out
            try { player[salaryField] = 0; } catch (e) { /* field may not exist */ }
            try { player[bonusField] = 0; } catch (e) { /* field may not exist */ }
          }
        }

        // Update PLYR_CAPSALARY (appears to be cap hit)
        try { player.PLYR_CAPSALARY = contract.salary + (contract.bonus / contract.length); } catch (e) { /* field may not exist */ }

        // Set contract status to signed
        try { player.ContractStatus = 'Signed'; } catch (e) { /* field may not exist */ }

        playersUpdated++;
        totalSalary += contract.salary;
      } catch (err: any) {
        warnings.push(`Failed to update contract for ${player.FirstName} ${player.LastName}: ${err.message}`);
      }
    }

    const averageSalary = playersUpdated > 0 ? Math.round(totalSalary / playersUpdated) : 0;
    console.log(`[RetroEditorService] Updated ${playersUpdated} player contracts`);
    console.log(`[RetroEditorService] Average salary: $${(averageSalary * 1000).toLocaleString()}`);

    return {
      success: true,
      playersUpdated,
      averageSalary,
      warnings
    };
  }

  // ============================================
  // INACTIVE TEAM COACH METHODS
  // ============================================

  /**
   * Set placeholder coaches for inactive teams to prevent coaching FA pool issues
   *
   * When teams are inactive (e.g., Texans before 2002, Browns 1996-1998),
   * we need to ensure their coaches are "locked" so they don't appear in FA.
   *
   * @param filePath Path to franchise file
   * @param year Historical year
   * @returns Results of placeholder coach application
   */
  async setPlaceholderCoachesForInactiveTeams(filePath: string, year: number): Promise<{
    success: boolean;
    coachesUpdated: number;
    inactiveTeams: string[];
    warnings: string[];
    error?: string;
  }> {
    const franchise = this.getFranchise(filePath);
    if (!franchise) {
      return {
        success: false,
        coachesUpdated: 0,
        inactiveTeams: [],
        warnings: [],
        error: 'Franchise file not loaded. Call loadFranchiseFile first.'
      };
    }

    console.log(`[RetroEditorService] Setting placeholder coaches for inactive teams in year ${year}`);

    // Get inactive teams for this year
    const inactiveTeams = this.getInactiveTeamsForYear(year);
    const inactiveTeamIndices = new Set(inactiveTeams.map(t => t.teamIndex));

    if (inactiveTeamIndices.size === 0) {
      console.log('[RetroEditorService] No inactive teams for this year');
      return {
        success: true,
        coachesUpdated: 0,
        inactiveTeams: [],
        warnings: []
      };
    }

    console.log(`[RetroEditorService] Found ${inactiveTeamIndices.size} inactive teams:`,
      inactiveTeams.map(t => `${t.team} (${t.teamIndex})`).join(', '));

    // Get Coach table
    let coachTable = franchise.getTableByUniqueId(TABLE_IDS.coachTable);
    if (!coachTable) {
      coachTable = franchise.getTableByName('Coach');
    }
    if (!coachTable) {
      return {
        success: false,
        coachesUpdated: 0,
        inactiveTeams: inactiveTeams.map(t => t.team),
        warnings: [],
        error: 'Could not find Coach table'
      };
    }

    await coachTable.readRecords();
    console.log(`[RetroEditorService] Found ${coachTable.records.length} coach records`);

    const warnings: string[] = [];
    let coachesUpdated = 0;

    // Placeholder coach names for inactive teams
    const placeholderNames = [
      { first: 'Inactive', last: 'Coach' },
      { first: 'Reserved', last: 'Position' },
      { first: 'Placeholder', last: 'Staff' }
    ];

    for (const coach of coachTable.records) {
      if (coach.isEmpty) continue;

      const teamIndex = coach.TeamIndex;
      if (!inactiveTeamIndices.has(teamIndex)) continue;

      // This coach is on an inactive team - set placeholder values
      try {
        const position = coach.Position || 'Unknown';
        const inactiveTeam = inactiveTeams.find(t => t.teamIndex === teamIndex);
        const teamName = inactiveTeam?.team || `Team ${teamIndex}`;

        console.log(`[RetroEditorService] Setting placeholder for ${position} on ${teamName}`);

        // Choose placeholder name based on position
        let placeholderIndex = 0;
        if (position === 'HeadCoach') placeholderIndex = 0;
        else if (position === 'OffensiveCoordinator') placeholderIndex = 1;
        else placeholderIndex = 2;

        const placeholder = placeholderNames[placeholderIndex];

        // Set placeholder name
        coach.FirstName = placeholder.first;
        coach.LastName = `${placeholder.last} (${teamName})`;

        // Lock them with a long contract so they don't become FA
        // NOTE: Don't use 'in' check - properties are on prototype as getters/setters
        try { coach.ContractLength = 30; } catch (e) { /* field may not exist */ }
        try { coach.ContractYearsRemaining = 30; } catch (e) { /* field may not exist */ }
        try { coach.ContractStatus = 'Signed'; } catch (e) { /* field may not exist */ }

        // Set a low salary so they don't count against cap
        try { coach.ContractSalary = 1; } catch (e) { /* field may not exist */ }

        // Mark as not user controlled
        try { coach.IsUserControlled = false; } catch (e) { /* field may not exist */ }

        // Set a placeholder portrait (generic face)
        try { coach.Portrait = 0; } catch (e) { /* field may not exist */ }

        coachesUpdated++;
      } catch (err: any) {
        warnings.push(`Failed to set placeholder for coach on team ${teamIndex}: ${err.message}`);
      }
    }

    console.log(`[RetroEditorService] Updated ${coachesUpdated} coaches on inactive teams`);

    return {
      success: true,
      coachesUpdated,
      inactiveTeams: inactiveTeams.map(t => t.team),
      warnings
    };
  }

  /**
   * Load the retro coaches database
   */
  private loadCoachDatabase(): any | null {
    try {
      const appPath = app.getAppPath();
      console.log(`[RetroEditorService] app.getAppPath() = ${appPath}`);
      console.log(`[RetroEditorService] app.isPackaged = ${app.isPackaged}`);

      // Try multiple potential paths
      const possiblePaths = [
        path.join(appPath, 'data', 'lookups', 'retro-coaches-database.json'),
        path.join(appPath, '.vite', 'build', 'data', 'lookups', 'retro-coaches-database.json'),
        path.join(process.cwd(), 'data', 'lookups', 'retro-coaches-database.json'),
      ];

      let coachDbPath = null;
      for (const p of possiblePaths) {
        console.log(`[RetroEditorService] Checking path: ${p}`);
        if (fs.existsSync(p)) {
          coachDbPath = p;
          console.log(`[RetroEditorService] FOUND at: ${p}`);
          break;
        }
      }

      if (!coachDbPath) {
        console.log('[RetroEditorService] No coach database file found at any path');
        return null;
      }

      const coachData = JSON.parse(fs.readFileSync(coachDbPath, 'utf-8'));
      console.log(`[RetroEditorService] Loaded coach database: ${coachData.totalCoaches} coaches`);
      return coachData;
    } catch (error) {
      console.error('[RetroEditorService] Error loading coach database:', error);
      return null;
    }
  }

  /**
   * Get coaches who were active in a specific year from the database
   */
  private getCoachesActiveInYear(coachDb: any, year: number, position?: string): any[] {
    if (!coachDb || !coachDb.coaches) return [];

    return coachDb.coaches.filter((coach: any) => {
      // Check if coach's career spans this year
      if (coach.careerFrom > year || coach.careerTo < year) return false;

      // If position filter is specified, check if coach held that position
      if (position) {
        return coach.positions.includes(position);
      }

      return true;
    });
  }

  /**
   * Replace free agent coaches with real historical coaches from the database
   *
   * This ensures that coaching FA pool has era-appropriate coaches based on
   * when they actually entered the league.
   *
   * @param filePath Path to franchise file
   * @param year Historical year
   * @returns Results of coach replacement
   */
  async replaceFACoachesWithRealCoaches(filePath: string, year: number): Promise<{
    success: boolean;
    coachesReplaced: number;
    faCoachCount: number;
    availableRealCoaches: number;
    warnings: string[];
    error?: string;
  }> {
    const franchise = this.getFranchise(filePath);
    if (!franchise) {
      return {
        success: false,
        coachesReplaced: 0,
        faCoachCount: 0,
        availableRealCoaches: 0,
        warnings: [],
        error: 'Franchise file not loaded. Call loadFranchiseFile first.'
      };
    }

    console.log(`[RetroEditorService] Replacing FA coaches with real historical coaches for year ${year}`);

    // Load coach database
    const coachDb = this.loadCoachDatabase();
    if (!coachDb) {
      return {
        success: false,
        coachesReplaced: 0,
        faCoachCount: 0,
        availableRealCoaches: 0,
        warnings: [],
        error: 'Could not load coach database'
      };
    }

    // Get Coach table
    let coachTable = franchise.getTableByUniqueId(TABLE_IDS.coachTable);
    if (!coachTable) {
      coachTable = franchise.getTableByName('Coach');
    }
    if (!coachTable) {
      return {
        success: false,
        coachesReplaced: 0,
        faCoachCount: 0,
        availableRealCoaches: 0,
        warnings: [],
        error: 'Could not find Coach table'
      };
    }

    await coachTable.readRecords();
    console.log(`[RetroEditorService] Found ${coachTable.records.length} coach records`);

    // Get inactive teams (we don't want to replace their placeholder coaches)
    const inactiveTeams = this.getInactiveTeamsForYear(year);
    const inactiveTeamIndices = new Set(inactiveTeams.map(t => t.teamIndex));

    // Find FA coaches (not on any team or on special FA team)
    const FREE_AGENT_COACH_TEAM = 32; // FA team index
    const faCoaches: any[] = [];

    for (const coach of coachTable.records) {
      if (coach.isEmpty) continue;

      const teamIndex = coach.TeamIndex;
      const contractStatus = coach.ContractStatus;

      // Skip coaches on inactive teams (they're placeholders)
      if (inactiveTeamIndices.has(teamIndex)) continue;

      // Identify FA coaches - either by team index or contract status
      if (teamIndex >= FREE_AGENT_COACH_TEAM || contractStatus === 'FreeAgent') {
        faCoaches.push(coach);
      }
    }

    console.log(`[RetroEditorService] Found ${faCoaches.length} free agent coaches`);

    // Get real coaches who were active in or before this year
    // We want coaches whose career started by this year (they'd be available)
    const availableHCs = this.getCoachesActiveInYear(coachDb, year, 'HC');
    const availableOCs = this.getCoachesActiveInYear(coachDb, year, 'OC');
    const availableDCs = this.getCoachesActiveInYear(coachDb, year, 'DC');

    console.log(`[RetroEditorService] Available real coaches: ${availableHCs.length} HC, ${availableOCs.length} OC, ${availableDCs.length} DC`);

    const warnings: string[] = [];
    let coachesReplaced = 0;

    // Track which real coaches we've already used
    const usedCoaches = new Set<string>();

    // Sort FA coaches by position to replace HC, OC, DC in order
    for (const faCoach of faCoaches) {
      const position = faCoach.Position || 'Unknown';

      // Get the appropriate pool of real coaches
      let coachPool: any[];
      if (position === 'HeadCoach') {
        coachPool = availableHCs;
      } else if (position === 'OffensiveCoordinator') {
        coachPool = availableOCs;
      } else if (position === 'DefensiveCoordinator') {
        coachPool = availableDCs;
      } else {
        // For other positions, use any available coach
        coachPool = [...availableOCs, ...availableDCs];
      }

      // Find an unused real coach
      let realCoach = null;
      for (const candidate of coachPool) {
        const key = `${candidate.firstName}_${candidate.lastName}`;
        if (!usedCoaches.has(key)) {
          realCoach = candidate;
          usedCoaches.add(key);
          break;
        }
      }

      if (!realCoach) {
        warnings.push(`No available real coach for ${position} position`);
        continue;
      }

      // Replace the FA coach with the real coach's info
      try {
        console.log(`[RetroEditorService] Replacing ${faCoach.FirstName} ${faCoach.LastName} (${position}) with ${realCoach.firstName} ${realCoach.lastName}`);

        faCoach.FirstName = realCoach.firstName;
        faCoach.LastName = realCoach.lastName;

        // Set career stats from database
        // NOTE: Don't use 'in' check - properties are on prototype as getters/setters
        if (realCoach.careerWins !== undefined) {
          try { faCoach.CareerWins = realCoach.careerWins; } catch (e) { /* field may not exist */ }
        }
        if (realCoach.careerLosses !== undefined) {
          try { faCoach.CareerLosses = realCoach.careerLosses; } catch (e) { /* field may not exist */ }
        }
        if (realCoach.careerTies !== undefined) {
          try { faCoach.CareerTies = realCoach.careerTies; } catch (e) { /* field may not exist */ }
        }
        if (realCoach.playoffWins !== undefined) {
          try { faCoach.CareerPlayoffWins = realCoach.playoffWins; } catch (e) { /* field may not exist */ }
        }
        if (realCoach.playoffLosses !== undefined) {
          try { faCoach.CareerPlayoffLosses = realCoach.playoffLosses; } catch (e) { /* field may not exist */ }
        }
        if (realCoach.superBowlWins !== undefined) {
          try { faCoach.CareerSuperbowlWins = realCoach.superBowlWins; } catch (e) { /* field may not exist */ }
        }

        // Calculate approximate years coaching
        try {
          const yearsCoaching = Math.max(1, year - realCoach.careerFrom + 1);
          faCoach.YearsCoaching = yearsCoaching;
        } catch (e) { /* field may not exist */ }

        // Set age based on career start (assume started at 35-45)
        try {
          const yearsCoaching = year - realCoach.careerFrom;
          faCoach.Age = 40 + yearsCoaching; // Approximate age
        } catch (e) { /* field may not exist */ }

        coachesReplaced++;
      } catch (err: any) {
        warnings.push(`Failed to replace coach ${faCoach.FirstName} ${faCoach.LastName}: ${err.message}`);
      }
    }

    console.log(`[RetroEditorService] Replaced ${coachesReplaced} FA coaches with real historical coaches`);

    return {
      success: true,
      coachesReplaced,
      faCoachCount: faCoaches.length,
      availableRealCoaches: availableHCs.length + availableOCs.length + availableDCs.length,
      warnings
    };
  }

  /**
   * Move players from inactive/non-existent teams to Free Agency
   * This is called during apply to handle teams that don't exist in the target year
   * (e.g., for 1994, Panthers and Jaguars didn't exist yet)
   */
  async moveInactiveTeamPlayersToFA(filePath: string, year: number): Promise<{
    success: boolean;
    playersMoved: number;
    inactiveTeams: string[];
    warnings: string[];
    error?: string;
  }> {
    const franchise = this.getFranchise(filePath);
    if (!franchise) {
      return {
        success: false,
        playersMoved: 0,
        inactiveTeams: [],
        warnings: [],
        error: 'Franchise file not loaded. Call loadFranchiseFile first.'
      };
    }

    console.log(`[RetroEditorService] Moving expansion team players to FA for year ${year}`);

    // Get EXPANSION teams for this year (teams where year == targetYear)
    const expansionTeamsThisYear = this.expansionHistory.filter(team => team.year === year);
    const expansionTeamIndices = new Set(expansionTeamsThisYear.map(t => t.teamIndex));

    console.log(`[RetroEditorService] Expansion teams: ${expansionTeamsThisYear.map(t => `${t.team}(${t.teamIndex})`).join(', ') || 'NONE'}`);

    // Rename for clarity in the rest of the function
    const inactiveTeams = expansionTeamsThisYear;
    const inactiveTeamIndices = expansionTeamIndices;

    if (inactiveTeamIndices.size === 0) {
      console.log('[RetroEditorService] No inactive teams for this year');
      return {
        success: true,
        playersMoved: 0,
        inactiveTeams: [],
        warnings: []
      };
    }

    console.log(`[RetroEditorService] Found ${inactiveTeamIndices.size} inactive teams:`,
      inactiveTeams.map(t => `${t.team} (${t.teamIndex})`).join(', '));

    // Get Player table
    let playerTable = franchise.getTableByName('Player');
    if (!playerTable) {
      playerTable = franchise.getTableByUniqueId(TABLE_IDS.playerTable);
    }
    if (!playerTable) {
      return {
        success: false,
        playersMoved: 0,
        inactiveTeams: inactiveTeams.map(t => t.team),
        warnings: [],
        error: 'Could not find Player table'
      };
    }

    await playerTable.readRecords();
    console.log(`[RetroEditorService] Found ${playerTable.records.length} player records`);

    const FREE_AGENT_TEAM_INDEX = 32;
    const warnings: string[] = [];
    let playersMoved = 0;

    // Collect player references for adding to FA array
    const playerRefsToAddToFA: string[] = [];

    for (const player of playerTable.records) {
      if (player.isEmpty) continue;

      const teamIndex = Number(player.TeamIndex);
      if (!inactiveTeamIndices.has(teamIndex)) continue;

      // This player is on an inactive team - move to FA
      try {
        const playerName = `${player.FirstName || ''} ${player.LastName || ''}`.trim() || `Player_${player.index}`;
        const inactiveTeam = inactiveTeams.find(t => t.teamIndex === teamIndex);
        const teamName = inactiveTeam?.team || `Team ${teamIndex}`;

        if (playersMoved < 10) {
          console.log(`[RetroEditorService] Moving ${playerName} from ${teamName} to FA`);
        }

        player.TeamIndex = FREE_AGENT_TEAM_INDEX;

        // Also update contract status to FreeAgent
        try { player.ContractStatus = 'FreeAgent'; } catch (e) { /* field may not exist */ }

        // Clear contract fields - FA players should have no active contract
        try {
          player.ContractLength = 0;
          player.ContractYear = 0;
          for (let i = 0; i < 8; i++) {
            try {
              player[`ContractSalary${i}`] = 0;
              player[`ContractBonus${i}`] = 0;
            } catch (e) { /* Some years may not exist */ }
          }
          player.PLYR_CONSECYEARSWITHTEAM = 0;
          player.PLYR_ISCAPTAIN = false;
        } catch (e) { /* Fields may not exist */ }

        // Collect player reference for FA array
        const tableId = playerTable.header.tableId;
        const rowNumber = player.index;
        const tableBits = tableId.toString(2).padStart(15, '0');
        const rowBits = rowNumber.toString(2).padStart(17, '0');
        const playerRef = tableBits + rowBits;
        playerRefsToAddToFA.push(playerRef);

        playersMoved++;
      } catch (err: any) {
        warnings.push(`Failed to move player from team ${teamIndex}: ${err.message}`);
      }
    }

    if (playersMoved >= 10) {
      console.log(`[RetroEditorService] ... and ${playersMoved - 10} more players`);
    }
    console.log(`[RetroEditorService] Moved ${playersMoved} players from inactive teams to FA`);

    // CRITICAL: Add players to FA array (table 5930) for game visibility
    if (playerRefsToAddToFA.length > 0) {
      const addedToFAArray = await this.addPlayersToFAArrayBulk(franchise, playerRefsToAddToFA);
      console.log(`[RetroEditorService] Added ${addedToFAArray} players to FA array (table 5930)`);
    }

    return {
      success: true,
      playersMoved,
      inactiveTeams: inactiveTeams.map(t => t.team),
      warnings
    };
  }

  /**
   * Set the correct Super Bowl number for historical mode
   * This updates SeasonInfo.BaseSuperBowlNumber so the game shows the correct Super Bowl
   * for the historical year (e.g., 1976 = Super Bowl XI)
   *
   * Super Bowl I was after the 1966 season, so Super Bowl # = Year - 1965
   * - 1976 → Super Bowl XI (11)
   * - 1995 → Super Bowl XXX (30)
   * - 2002 → Super Bowl XXXVII (37)
   */
  async clearLeagueHistory(filePath: string, year: number): Promise<{
    success: boolean;
    entriesCleared: number;
    warnings: string[];
    error?: string;
  }> {
    const franchise = this.getFranchise(filePath);
    if (!franchise) {
      return {
        success: false,
        entriesCleared: 0,
        warnings: [],
        error: 'Franchise file not loaded. Call loadFranchiseFile first.'
      };
    }

    console.log(`[RetroEditorService] Setting Super Bowl for year ${year}`);

    const warnings: string[] = [];
    let entriesCleared = 0;

    // Calculate the correct Super Bowl number: Year - 1965
    const targetSuperBowlNumber = Math.max(0, year - 1965);
    console.log(`[RetroEditorService] Target Super Bowl: ${targetSuperBowlNumber}`);

    // Set SeasonInfo.BaseSuperBowlNumber to the correct value for this year
    try {
      const seasonInfoTable = franchise.getTableByName('SeasonInfo');
      if (seasonInfoTable) {
        await seasonInfoTable.readRecords();
        for (const record of seasonInfoTable.records) {
          if (record.isEmpty) continue;
          try {
            if (record.BaseSuperBowlNumber !== undefined) {
              const oldValue = record.BaseSuperBowlNumber;
              record.BaseSuperBowlNumber = targetSuperBowlNumber;
              console.log(`[RetroEditorService] Updated BaseSuperBowlNumber from ${oldValue} to ${targetSuperBowlNumber}`);
              entriesCleared++;
            }
          } catch (e) {
            // Field may not exist - ignore
          }
        }
      } else {
        console.log(`[RetroEditorService] SeasonInfo table not found`);
        warnings.push('SeasonInfo table not found - could not update Super Bowl number');
      }
    } catch (err: any) {
      console.error(`[RetroEditorService] Error updating SeasonInfo: ${err.message}`);
      warnings.push(`Error updating Super Bowl number: ${err.message}`);
    }

    if (entriesCleared === 0) {
      warnings.push('No SeasonInfo records updated - Super Bowl number may be incorrect');
    }

    console.log(`[RetroEditorService] Super Bowl number update complete`);

    return {
      success: true,
      entriesCleared,
      warnings
    };
  }

  /**
   * SINGLE OPERATION: Apply ALL retro changes and save
   * This is the correct approach - gather all data first, then apply everything at once
   *
   * @param sourcePath - Path to the franchise file to read from
   * @param targetPath - Path to save to (can be same as source for overwrite)
   * @param config - All the configuration gathered from the wizard
   */
  async applyAllRetroChangesAndSave(sourcePath: string, targetPath: string, config: {
    year: number;
    options: {
      teams?: boolean;
      abbreviations?: boolean;
      schedule?: boolean;
      coaches?: boolean;
      salaryCap?: boolean;
      stadiums?: boolean;
      schemes?: boolean;
      uniforms?: boolean;
      expansion?: boolean;
    };
    expansionEvent?: any;
    expansionDraftSelections?: Array<{ playerRecordIndex: number; newTeamIndex: number }>;
    expansionTeamIndices?: number[]; // Team indices for clearing rosters before expansion draft
    customSalaryCap?: number; // Custom salary cap in dollars (e.g., 255400000 for $255.4M)
  }): Promise<{
    success: boolean;
    results: {
      seasonYearSet: boolean;
      superBowlNumber: number;
      teamChanges: number;
      draftPicksReordered: number;
      scheduleGamesUpdated: number;
      coachesUpdated: number;
      salaryCapSet: boolean;
      stadiumsUpdated: number;
      schemesUpdated: number;
      playersMovedToFA: number;
      expansionPlayersSelected: number;
      uniformsApplied: number;
    };
    diagnostics?: {
      beforeCounts: { team16: number; team20: number; fa: number };
      afterMoveCounts: { team16: number; team20: number; fa: number };
      finalCounts: { team16: number; team20: number; fa: number };
      expansionCondition: { optsExpansion: boolean; hasEvent: boolean; hasTeams: boolean };
      steps: string[];
    };
    error?: string;
  }> {
    console.log(`[RetroEditorService] ===== APPLY ALL RETRO CHANGES AND SAVE =====`);
    console.log(`[RetroEditorService] Source: ${sourcePath}`);
    console.log(`[RetroEditorService] Target: ${targetPath}`);
    console.log(`[RetroEditorService] Year: ${config.year}`);
    console.log(`[RetroEditorService] Options:`, config.options);

    const results = {
      seasonYearSet: false,
      superBowlNumber: 0,
      teamChanges: 0,
      draftPicksReordered: 0,
      scheduleGamesUpdated: 0,
      coachesUpdated: 0,
      salaryCapSet: false,
      stadiumsUpdated: 0,
      schemesUpdated: 0,
      playersMovedToFA: 0,
      expansionPlayersSelected: 0,
      uniformsApplied: 0,
    };

    // Diagnostics for renderer visibility
    const diagnostics = {
      beforeCounts: { team16: 0, team20: 0, fa: 0 },
      afterMoveCounts: { team16: 0, team20: 0, fa: 0 },
      finalCounts: { team16: 0, team20: 0, fa: 0 },
      expansionCondition: { optsExpansion: false, hasEvent: false, hasTeams: false },
      steps: [] as string[],
    };

    try {
      // Load the franchise file fresh
      const module = await getFranchiseModule();
      const createFranchise = module.create || module.default?.create || module.Franchise?.create;
      if (!createFranchise) {
        throw new Error('Could not find create function in madden-franchise module');
      }

      console.log(`[RetroEditorService] Loading franchise file...`);
      const franchise = await createFranchise(sourcePath);
      console.log(`[RetroEditorService] Franchise loaded`);

      // Store in cache so existing methods can find it
      this.setFranchise(sourcePath, franchise);

      const year = config.year;
      const opts = config.options;

      // DIAGNOSTIC: Track expansion condition for renderer visibility
      diagnostics.expansionCondition = {
        optsExpansion: !!opts.expansion,
        hasEvent: !!config.expansionEvent,
        hasTeams: !!(config.expansionEvent?.teams),
      };
      diagnostics.steps.push(`Expansion condition: opts.expansion=${opts.expansion}, hasEvent=${!!config.expansionEvent}, hasTeams=${!!(config.expansionEvent?.teams)}`);

      if (config.expansionEvent) {
        diagnostics.steps.push(`Event: type=${config.expansionEvent.type}, teams=${JSON.stringify(config.expansionEvent.teams)}`);
      }

      // DIAGNOSTIC: Check player team indices BEFORE any changes
      let playerTable = franchise.getTableByName('Player');
      if (!playerTable) {
        playerTable = franchise.getTableByUniqueId(TABLE_IDS.playerTable);
        diagnostics.steps.push(`Player table found by uniqueId: ${!!playerTable}`);
      } else {
        diagnostics.steps.push(`Player table found by name: true`);
      }

      if (playerTable) {
        await playerTable.readRecords();
        let team16Count = 0, team20Count = 0, faCount = 0;
        for (const p of playerTable.records) {
          if (p.isEmpty) continue;
          const ti = Number(p.TeamIndex);
          if (ti === 16) team16Count++;
          if (ti === 20) team20Count++;
          if (ti === 32) faCount++;
        }
        diagnostics.beforeCounts = { team16: team16Count, team20: team20Count, fa: faCount };
        diagnostics.steps.push(`BEFORE: Jaguars(16)=${team16Count}, Panthers(20)=${team20Count}, FA(32)=${faCount}`);
        console.log(`[RetroEditorService] DIAGNOSTIC - BEFORE CHANGES: Jaguars(16)=${team16Count}, Panthers(20)=${team20Count}, FA(32)=${faCount}`);
      } else {
        diagnostics.steps.push(`ERROR: Could not find Player table!`);
      }

      // ===== 1. SET SEASON YEAR AND SUPER BOWL NUMBER =====
      console.log(`[RetroEditorService] Step 1: Setting season year and Super Bowl...`);
      try {
        await this.setSeasonYear(sourcePath, year);
        results.seasonYearSet = true;
        results.superBowlNumber = Math.max(0, year - 1965);
        console.log(`[RetroEditorService] Season year set to ${year}, Super Bowl to ${results.superBowlNumber}`);
      } catch (e) {
        console.warn(`[RetroEditorService] Season year failed:`, e);
      }

      // ===== 2. UPDATE TEAM NAMES (if enabled) =====
      if (opts.teams) {
        console.log(`[RetroEditorService] Step 2: Updating team names...`);
        try {
          const teamChanges = await this.updateTeamNames(sourcePath, year);
          results.teamChanges = teamChanges.length;
          console.log(`[RetroEditorService] Updated ${results.teamChanges} teams`);
        } catch (e) {
          console.warn(`[RetroEditorService] Team names failed:`, e);
        }

        // Also reorder draft picks for expansion teams
        try {
          const draftReordered = await this.reorderDraftPicks(sourcePath, year);
          results.draftPicksReordered = draftReordered;
        } catch (e) {
          console.warn(`[RetroEditorService] Draft reorder failed:`, e);
        }
      }

      // ===== 3. APPLY SCHEDULE (if enabled and available) =====
      if (opts.schedule) {
        console.log(`[RetroEditorService] Step 3: Applying schedule...`);
        try {
          const scheduleResult = await this.applyHistoricalSchedule(sourcePath, year);
          results.scheduleGamesUpdated = scheduleResult.gamesUpdated;
          console.log(`[RetroEditorService] Schedule: ${results.scheduleGamesUpdated} games updated`);
        } catch (e) {
          console.warn(`[RetroEditorService] Schedule failed:`, e);
        }
      }

      // ===== 4. APPLY COACHES (if enabled) =====
      if (opts.coaches) {
        console.log(`[RetroEditorService] Step 4: Applying coaches...`);
        try {
          const coachResult = await this.applyHistoricalCoaches(sourcePath, year);
          results.coachesUpdated = coachResult.coachesUpdated;
          console.log(`[RetroEditorService] Coaches: ${results.coachesUpdated} updated`);
        } catch (e) {
          console.warn(`[RetroEditorService] Coaches failed:`, e);
        }
      }

      // ===== 5. APPLY SALARY CAP (if enabled) =====
      if (opts.salaryCap) {
        console.log(`[RetroEditorService] Step 5: Applying salary cap...`);
        console.log(`[RetroEditorService] Custom salary cap value: ${config.customSalaryCap ? `$${(config.customSalaryCap / 1000000).toFixed(1)}M` : 'not set (using historical)'}`);
        try {
          const capResult = await this.applySalaryCap(sourcePath, year, config.customSalaryCap);
          results.salaryCapSet = capResult.success;
          if (capResult.success) {
            console.log(`[RetroEditorService] Salary cap set: $${(capResult.newCap / 1000000).toFixed(1)}M (was $${(capResult.previousCap / 1000000).toFixed(1)}M)`);
          } else {
            console.warn(`[RetroEditorService] Salary cap failed: ${capResult.error}`);
          }
        } catch (e) {
          console.warn(`[RetroEditorService] Salary cap failed:`, e);
        }
      }

      // ===== 6. APPLY STADIUM NAMES (if enabled) =====
      if (opts.stadiums) {
        console.log(`[RetroEditorService] Step 6: Applying stadium names...`);
        try {
          const stadiumResult = await this.applyStadiumNames(sourcePath, year);
          results.stadiumsUpdated = stadiumResult.stadiumsUpdated;
          console.log(`[RetroEditorService] Stadiums: ${results.stadiumsUpdated} updated`);
        } catch (e) {
          console.warn(`[RetroEditorService] Stadiums failed:`, e);
        }
      }

      // ===== 7. APPLY TEAM SCHEMES (if enabled) =====
      if (opts.schemes) {
        console.log(`[RetroEditorService] Step 7: Applying team schemes...`);
        try {
          const schemeResult = await this.applyTeamSchemes(sourcePath, year);
          results.schemesUpdated = schemeResult.schemesUpdated;
          console.log(`[RetroEditorService] Schemes: ${results.schemesUpdated} updated`);
        } catch (e) {
          console.warn(`[RetroEditorService] Schemes failed:`, e);
        }
      }

      // ===== 8. MOVE EXPANSION TEAM PLAYERS TO FA =====
      // This must happen BEFORE expansion draft - clear the modern rosters of teams that will be filled via draft
      diagnostics.steps.push(`Step 8 check: opts.expansion=${opts.expansion}, hasEvent=${!!config.expansionEvent}, hasTeams=${!!(config.expansionEvent?.teams)}`);
      if (opts.expansion && config.expansionEvent && config.expansionEvent.teams) {
        diagnostics.steps.push(`Step 8: ENTERING expansion move block`);
        console.log(`[RetroEditorService] Step 8: Moving expansion team players to FA...`);
        console.log(`[RetroEditorService] Expansion teams from event:`, config.expansionEvent.teams.map((t: any) => `${t.name} (${t.teamIndex})`).join(', '));
        try {
          // Get the team indices directly from the expansion event
          const expansionTeamIndices = config.expansionEvent.teams.map((t: any) => t.teamIndex);
          diagnostics.steps.push(`Calling moveExpansionPlayersToFAInternal with indices: ${expansionTeamIndices.join(', ')}`);
          const moveResult = await this.moveExpansionPlayersToFAInternal(franchise, expansionTeamIndices, diagnostics);
          results.playersMovedToFA = moveResult.playersMoved;
          diagnostics.steps.push(`moveExpansionPlayersToFAInternal returned: ${moveResult.playersMoved} players moved`);
          console.log(`[RetroEditorService] Moved ${results.playersMovedToFA} players to FA`);

          // DIAGNOSTIC: Verify changes are in memory
          let team16After = 0, team20After = 0, faAfter = 0;
          for (const p of playerTable.records) {
            if (p.isEmpty) continue;
            const ti = Number(p.TeamIndex);
            if (ti === 16) team16After++;
            if (ti === 20) team20After++;
            if (ti === 32) faAfter++;
          }
          diagnostics.afterMoveCounts = { team16: team16After, team20: team20After, fa: faAfter };
          diagnostics.steps.push(`AFTER MOVE: Jaguars(16)=${team16After}, Panthers(20)=${team20After}, FA(32)=${faAfter}`);
          console.log(`[RetroEditorService] DIAGNOSTIC - AFTER MOVE: Jaguars(16)=${team16After}, Panthers(20)=${team20After}, FA(32)=${faAfter}`);
        } catch (e: any) {
          diagnostics.steps.push(`Step 8 ERROR: ${e.message}`);
          console.warn(`[RetroEditorService] Move to FA failed:`, e);
        }
      } else {
        diagnostics.steps.push(`Step 8 SKIPPED: condition not met`);
        console.log(`[RetroEditorService] DIAGNOSTIC - Step 8 SKIPPED: opts.expansion=${opts.expansion}, hasEvent=${!!config.expansionEvent}, hasTeams=${!!(config.expansionEvent?.teams)}`);
      }

      // ===== 9. EXECUTE EXPANSION/RELOCATION =====
      if (opts.expansion && config.expansionEvent) {
        console.log(`[RetroEditorService] Step 9: Processing expansion/relocation event...`);
        console.log(`[RetroEditorService] Event type: ${config.expansionEvent.type}`);

        if (config.expansionEvent.type === 'relocation') {
          // Handle relocation: move all players from source team to destination team
          console.log(`[RetroEditorService] Executing relocation: ${config.expansionEvent.sourceTeam?.teamIndex} → ${config.expansionEvent.destinationTeam?.teamIndex}`);
          try {
            const relocationResult = await this.executeRelocation(
              sourcePath,
              config.expansionEvent.sourceTeam?.teamIndex,
              config.expansionEvent.destinationTeam?.teamIndex
            );
            if (relocationResult.success) {
              results.expansionPlayersSelected = relocationResult.playersTransferred;
              console.log(`[RetroEditorService] Relocation: ${results.expansionPlayersSelected} players transferred`);
            }
          } catch (e) {
            console.warn(`[RetroEditorService] Relocation failed:`, e);
          }
        } else {
          // Handle expansion draft
          let selections = config.expansionDraftSelections || [];

          // If no selections provided, auto-compute them
          if (selections.length === 0) {
            console.log(`[RetroEditorService] Auto-computing expansion draft selections...`);
            try {
              // Get eligible players
              const eligibleResult = await this.getEligiblePlayersForExpansionDraft(sourcePath, config.expansionEvent);
              if (eligibleResult.success && eligibleResult.players && eligibleResult.players.length > 0) {
                // Auto-protect based on rules
                const maxProtected = config.expansionEvent.protectionRules?.maxProtected || 32;
                const protectedPlayers = this.autoProtectPlayers(eligibleResult.players, maxProtected);

                // Select unprotected players
                const unprotected = protectedPlayers.filter((p: any) => !p.isProtected);
                const playersPerTeam = config.expansionEvent.rules?.playersPerTeam || 30;
                const expansionTeams = config.expansionEvent.teams || [];

                console.log(`[RetroEditorService] Auto-select: ${unprotected.length} unprotected, ${playersPerTeam} per team, ${expansionTeams.length} teams`);

                for (let t = 0; t < expansionTeams.length; t++) {
                  const team = expansionTeams[t];
                  const startIdx = t * playersPerTeam;
                  const endIdx = Math.min(startIdx + playersPerTeam, unprotected.length);

                  for (let i = startIdx; i < endIdx; i++) {
                    selections.push({
                      playerRecordIndex: unprotected[i].recordIndex,
                      newTeamIndex: team.teamIndex
                    });
                  }
                }
                console.log(`[RetroEditorService] Auto-computed ${selections.length} selections`);
              }
            } catch (e) {
              console.warn(`[RetroEditorService] Auto-compute selections failed:`, e);
            }
          }

          // Execute the draft with selections
          if (selections.length > 0) {
            console.log(`[RetroEditorService] Executing expansion draft with ${selections.length} selections...`);
            try {
              // Get expansion team indices: use config values if provided, otherwise extract from event
              let expansionTeamIndices = config.expansionTeamIndices || [];
              if (expansionTeamIndices.length === 0 && config.expansionEvent?.teams) {
                expansionTeamIndices = config.expansionEvent.teams.map((t: any) => t.teamIndex);
              }
              console.log(`[RetroEditorService] Expansion team indices for draft: ${expansionTeamIndices.join(', ')}`);

              const draftResult = await this.executeExpansionDraftInternal(franchise, selections, expansionTeamIndices);
              results.expansionPlayersSelected = draftResult.playersSelected;
              console.log(`[RetroEditorService] Expansion draft: ${results.expansionPlayersSelected} players selected`);
            } catch (e) {
              console.warn(`[RetroEditorService] Expansion draft failed:`, e);
            }
          }
        }
      }

      // ===== 10. APPLY UNIFORMS (if enabled) =====
      if (opts.uniforms) {
        console.log(`[RetroEditorService] Step 10: Applying uniforms...`);
        // Note: applyUniforms uses the currently loaded franchise from cache
        try {
          const uniformResult = await this.applyUniforms(year);
          results.uniformsApplied = uniformResult.uniformsApplied;
          console.log(`[RetroEditorService] Uniforms: ${results.uniformsApplied} applied`);
        } catch (e) {
          console.warn(`[RetroEditorService] Uniforms failed:`, e);
        }
      }

      // ===== FINAL: LOG STATE BEFORE SAVE =====
      // playerTable already loaded above, just check state
      if (playerTable) {
        let panthers = 0, jaguars = 0, fa = 0;
        for (const p of playerTable.records) {
          if (p.isEmpty) continue;
          const ti = Number(p.TeamIndex);
          if (ti === 20) panthers++;
          if (ti === 16) jaguars++;
          if (ti === 32) fa++;
        }
        diagnostics.finalCounts = { team16: jaguars, team20: panthers, fa };
        diagnostics.steps.push(`FINAL STATE BEFORE SAVE: Panthers(20)=${panthers}, Jaguars(16)=${jaguars}, FA(32)=${fa}`);
        diagnostics.steps.push(`Player table isChanged=${playerTable.isChanged}`);
        console.log(`[RetroEditorService] FINAL STATE: Panthers=${panthers}, Jaguars=${jaguars}, FA=${fa}`);
      }

      // ===== SAVE =====
      diagnostics.steps.push(`Calling franchise.save(${targetPath})`);
      console.log(`[RetroEditorService] Saving to ${targetPath}...`);
      await franchise.save(targetPath);
      diagnostics.steps.push(`SAVE COMPLETED`);
      console.log(`[RetroEditorService] SAVED SUCCESSFULLY`);

      return { success: true, results, diagnostics };

    } catch (err: any) {
      console.error('[RetroEditorService] applyAllRetroChangesAndSave error:', err);
      diagnostics.steps.push(`ERROR: ${err.message}`);
      return { success: false, results, diagnostics, error: err.message };
    }
  }

  /**
   * Internal: Move expansion team players to FA (for use within single operation)
   * Takes the expansion team indices directly from the expansion event.
   *
   * This method:
   * 1. Sets TeamIndex = 32 (FA) for all players on expansion teams
   * 2. Clears the roster arrays for expansion teams (removes player references)
   * 3. Removes players from depth charts
   */
  private async moveExpansionPlayersToFAInternal(
    franchise: any,
    expansionTeamIndices: number[],
    diagnostics?: { steps: string[] }
  ): Promise<{ playersMoved: number }> {
    const log = (msg: string) => {
      console.log(`[RetroEditorService] moveExpansionPlayersToFAInternal: ${msg}`);
      if (diagnostics) diagnostics.steps.push(`[moveFA] ${msg}`);
    };

    if (!expansionTeamIndices || expansionTeamIndices.length === 0) {
      log(`No expansion team indices provided`);
      return { playersMoved: 0 };
    }

    const expansionIndicesSet = new Set(expansionTeamIndices);
    log(`Clearing teams ${expansionTeamIndices.join(', ')}`);

    let playerTable = franchise.getTableByName('Player');
    if (!playerTable) {
      playerTable = franchise.getTableByUniqueId(TABLE_IDS.playerTable);
      log(`Table found by uniqueId: ${!!playerTable}`);
    } else {
      log(`Table found by name`);
    }

    if (!playerTable) {
      log(`ERROR: Could not find Player table`);
      return { playersMoved: 0 };
    }

    await playerTable.readRecords();
    log(`Records loaded: ${playerTable.records.length} total records`);

    // Get team table for roster refs
    const teamTable = franchise.getTableByUniqueId(TABLE_IDS.teamTable);
    if (!teamTable) {
      log(`ERROR: Could not find Team table`);
      return { playersMoved: 0 };
    }
    await teamTable.readRecords();

    // Build roster refs for expansion teams
    const expansionRosterRefs = new Map<number, { tableId: number; rowNumber: number }>();
    for (const team of teamTable.records) {
      if (team.isEmpty) continue;
      const teamIdx = Number(team.TeamIndex);
      if (expansionIndicesSet.has(teamIdx)) {
        const rosterRef = team.getReferenceDataByKey('Roster');
        if (rosterRef) {
          expansionRosterRefs.set(teamIdx, { tableId: rosterRef.tableId, rowNumber: rosterRef.rowNumber });
          log(`Found roster ref for team ${teamIdx}: tableId=${rosterRef.tableId}, row=${rosterRef.rowNumber}`);
        }
      }
    }

    // Step 1: Clear roster arrays for expansion teams BEFORE changing TeamIndex
    for (const [teamIdx, rosterRef] of expansionRosterRefs) {
      log(`Clearing roster array for team ${teamIdx}`);
      const rosterTable = franchise.getTableById(rosterRef.tableId);
      await rosterTable.readRecords();
      const rosterRecord = rosterTable.records[rosterRef.rowNumber];

      if (rosterRecord) {
        const originalSize = rosterRecord.arraySize || 0;
        for (let i = 0; i < originalSize; i++) {
          rosterRecord[`Player${i}`] = ZERO_REF;
        }
        rosterRecord.arraySize = 0;
        rosterTable.arraySizes[rosterRef.rowNumber] = 0;
        rosterRecord.isChanged = true;
        rosterRecord._parent.onEvent('change', rosterRecord);
        log(`Cleared ${originalSize} player slots from team ${teamIdx} roster array`);
      }
    }

    // Step 1b: Clear depth charts for expansion teams
    try {
      const depthChartTable = franchise.getTableById(5879); // DepthChart table ID
      if (depthChartTable) {
        await depthChartTable.readRecords();
        for (const depthChart of depthChartTable.records) {
          if (depthChart.isEmpty) continue;
          const dcTeamIndex = Number(depthChart.TeamIndex);
          if (!expansionIndicesSet.has(dcTeamIndex)) continue;

          log(`Clearing depth chart for team ${dcTeamIndex}`);
          let slotsCleared = 0;

          // Clear all Player fields in this depth chart
          for (const field of depthChart.fieldsArray || []) {
            if (!field.key?.startsWith('Player') || field.key === 'PlayerCount') continue;
            if (field.value && field.value !== ZERO_REF) {
              field.value = ZERO_REF;
              slotsCleared++;
            }
          }

          if (slotsCleared > 0) {
            depthChart.isChanged = true;
            depthChart._parent.onEvent('change', depthChart);
            log(`Cleared ${slotsCleared} depth chart slots for team ${dcTeamIndex}`);
          }
        }
      }
    } catch (err: any) {
      log(`Warning: Could not clear depth charts: ${err.message}`);
    }

    // Step 2: Move players to FA (set TeamIndex = 32)
    const FA = 32;
    let playersMoved = 0;
    let firstFewChanges: string[] = [];

    // Collect player references for adding to FA array
    const playerRefsToAddToFA: string[] = [];

    for (const player of playerTable.records) {
      if (player.isEmpty) continue;
      const beforeTi = Number(player.TeamIndex);
      if (expansionIndicesSet.has(beforeTi)) {
        // Log first few changes for debugging
        if (firstFewChanges.length < 3) {
          const playerName = `${player.FirstName || ''} ${player.LastName || ''}`.trim() || `Record#${player._index}`;
          firstFewChanges.push(`${playerName}: TeamIndex ${beforeTi} -> ${FA}`);
        }

        // Make the assignment
        player.TeamIndex = FA;

        // Also set ContractStatus to FreeAgent - the game may check this
        try {
          player.ContractStatus = 'FreeAgent';
        } catch (e) {
          // Field may not exist in all franchise versions
        }

        // CRITICAL: Clear contract fields - game won't show FA players with active contracts
        // Players with ContractLength > 0 appear as "signed but no team" which is invalid
        try {
          const beforeLength = player.ContractLength;
          player.ContractLength = 0;
          player.ContractYear = 0;
          // Clear all salary/bonus years
          for (let i = 0; i < 8; i++) {
            try {
              player[`ContractSalary${i}`] = 0;
              player[`ContractBonus${i}`] = 0;
            } catch (e) {
              // Some contract years may not exist
            }
          }
          // CRITICAL: Clear consecutive years with team - FA players must have 0
          // Research showed visible FA players have PLYR_CONSECYEARSWITHTEAM = 0
          try {
            player.PLYR_CONSECYEARSWITHTEAM = 0;
          } catch (e) {
            // Field may not exist
          }
          // Clear captain status - FA players are not team captains
          try {
            player.PLYR_ISCAPTAIN = false;
          } catch (e) {
            // Field may not exist
          }
          // Log the first few contract clears for debugging
          if (firstFewChanges.length < 3) {
            log(`Cleared contract for player: ContractLength ${beforeLength} -> 0, CONSECYEARS -> 0`);
          }
        } catch (e) {
          log(`WARNING: Failed to clear contract: ${e}`);
        }

        // VERIFY: Check if the assignment actually changed the value
        const afterTi = Number(player.TeamIndex);
        if (afterTi !== FA) {
          log(`WARNING: Assignment failed for player! Before=${beforeTi}, After=${afterTi}, Expected=${FA}`);
        }

        // Collect player reference for FA array
        // Reference format: 15-bit tableId + 17-bit rowNumber = 32 bits
        const tableId = playerTable.header.tableId;
        const rowNumber = player.index;
        const tableBits = tableId.toString(2).padStart(15, '0');
        const rowBits = rowNumber.toString(2).padStart(17, '0');
        const playerRef = tableBits + rowBits;
        playerRefsToAddToFA.push(playerRef);

        playersMoved++;
      }
    }

    if (firstFewChanges.length > 0) {
      log(`First changes: ${firstFewChanges.join('; ')}`);
    }

    // CRITICAL: Explicitly mark table as changed so save() writes the modifications
    if (playersMoved > 0) {
      playerTable.isChanged = true;
      log(`Marked Player table as changed (isChanged=${playerTable.isChanged})`);
    }

    // CRITICAL: Add players to FA array (table 5930) for game visibility
    // See RESEARCH_SUMMARY_FA_VISIBILITY.md - this is required for FA players to appear in-game
    if (playerRefsToAddToFA.length > 0) {
      const addedToFAArray = await this.addPlayersToFAArrayBulk(franchise, playerRefsToAddToFA);
      log(`Added ${addedToFAArray} players to FA array (table 5930)`);
    }

    log(`Moved ${playersMoved} players to FA`);
    return { playersMoved };
  }

  /**
   * Internal: Execute expansion draft (for use within single operation)
   * Properly handles roster arrays by:
   * 1. Clearing expansion team rosters
   * 2. Removing drafted players from source team rosters
   * 3. Adding drafted players to expansion team rosters
   * 4. Updating TeamIndex
   *
   * @param franchise - The loaded franchise instance
   * @param selections - Array of player selections (playerRecordIndex + newTeamIndex)
   * @param expansionTeamIndices - Array of team indices that should be cleared before draft
   */
  private async executeExpansionDraftInternal(
    franchise: any,
    selections: Array<{ playerRecordIndex: number; newTeamIndex: number }>,
    expansionTeamIndices: number[] = []
  ): Promise<{ playersSelected: number }> {
    console.log(`[executeExpansionDraftInternal] Starting with ${selections.length} selections`);
    console.log(`[executeExpansionDraftInternal] Expansion team indices: ${expansionTeamIndices.join(', ')}`);

    // Get player table
    let playerTable = franchise.getTableByName('Player');
    if (!playerTable) {
      playerTable = franchise.getTableByUniqueId(TABLE_IDS.playerTable);
    }
    if (!playerTable) {
      console.error('[executeExpansionDraftInternal] Player table not found');
      return { playersSelected: 0 };
    }
    await playerTable.readRecords();

    // Get team table for roster refs
    const teamTable = franchise.getTableByUniqueId(TABLE_IDS.teamTable);
    if (!teamTable) {
      console.error('[executeExpansionDraftInternal] Team table not found');
      return { playersSelected: 0 };
    }
    await teamTable.readRecords();

    // Build expansion team roster refs - include teams from selections and explicit indices
    const expansionRosterRefs = new Map<number, { tableId: number; rowNumber: number }>();
    const teamsToClear = new Set<number>(expansionTeamIndices);

    // Also add teams from selections
    for (const sel of selections) {
      teamsToClear.add(sel.newTeamIndex);
    }

    for (const team of teamTable.records) {
      if (team.isEmpty) continue;
      const teamIdx = Number(team.TeamIndex);
      // Get roster ref for any team that should be cleared
      if (teamsToClear.has(teamIdx)) {
        const rosterRef = team.getReferenceDataByKey('Roster');
        if (rosterRef) {
          expansionRosterRefs.set(teamIdx, { tableId: rosterRef.tableId, rowNumber: rosterRef.rowNumber });
        }
      }
    }

    console.log(`[executeExpansionDraftInternal] Teams to clear: ${Array.from(teamsToClear).join(', ')}`);

    // Clear expansion team rosters before adding drafted players
    for (const [teamIdx, rosterRef] of expansionRosterRefs) {
      console.log(`[executeExpansionDraftInternal] Clearing roster for expansion team ${teamIdx}`);
      const rosterTable = franchise.getTableById(rosterRef.tableId);
      await rosterTable.readRecords();
      const rosterRecord = rosterTable.records[rosterRef.rowNumber];

      if (rosterRecord) {
        // Clear all player slots
        const originalSize = rosterRecord.arraySize || 0;
        for (let i = 0; i < originalSize; i++) {
          rosterRecord[`Player${i}`] = ZERO_REF;
        }
        // Reset array size to 0
        rosterRecord.arraySize = 0;
        rosterTable.arraySizes[rosterRef.rowNumber] = 0;
        rosterRecord.isChanged = true;
        rosterRecord._parent.onEvent('change', rosterRecord);
        console.log(`[executeExpansionDraftInternal] Cleared ${originalSize} players from team ${teamIdx} roster`);
      }
    }

    let playersSelected = 0;

    for (const selection of selections) {
      const player = playerTable.records[selection.playerRecordIndex];
      if (!player || player.isEmpty) continue;

      const playerName = `${player.FirstName || ''} ${player.LastName || ''}`.trim();
      const oldTeamIndex = Number(player.TeamIndex);
      const newTeamIndex = selection.newTeamIndex;

      console.log(`[executeExpansionDraftInternal] Processing: ${playerName} (${oldTeamIndex} -> ${newTeamIndex})`);

      // 1. Get player's reference string
      const playerRef = await this.getPlayerReference(franchise, selection.playerRecordIndex);
      if (!playerRef) {
        console.log(`[executeExpansionDraftInternal] Could not get player ref for ${playerName}`);
        continue;
      }

      // 2. Remove from source team (roster + depth chart)
      if (oldTeamIndex >= 0 && oldTeamIndex < 32) {
        await this.cleanupPlayerFromTeam(franchise, playerRef, oldTeamIndex);
      }

      // 3. Add to expansion team roster
      const expansionRosterRef = expansionRosterRefs.get(newTeamIndex);
      if (expansionRosterRef) {
        await this.addPlayerToRoster(franchise, playerRef, expansionRosterRef);
      } else {
        console.log(`[executeExpansionDraftInternal] No roster ref for expansion team ${newTeamIndex}`);
      }

      // 4. Update player's TeamIndex
      player.TeamIndex = newTeamIndex;

      playersSelected++;
      console.log(`[executeExpansionDraftInternal] Drafted "${playerName}" from team ${oldTeamIndex} to team ${newTeamIndex}`);
    }

    // CRITICAL: Explicitly mark player table as changed so save() writes the modifications
    if (playersSelected > 0) {
      playerTable.isChanged = true;
    }

    console.log(`[executeExpansionDraftInternal] Complete: ${playersSelected} players selected`);
    return { playersSelected };
  }

  /**
   * Set Super Bowl number and save - does NOT move players
   * Player movements should be done by moveInactivePlayersToFA BEFORE expansion draft
   */
  async applyAndSave(filePath: string, year: number): Promise<{
    success: boolean;
    playersMoved: number;
    superBowlSet: number;
    error?: string;
  }> {
    console.log(`[RetroEditorService] ===== APPLY AND SAVE (year=${year}) =====`);

    try {
      // Get the franchise (must already be loaded)
      const franchise = this.getFranchise(filePath);
      if (!franchise) {
        return { success: false, playersMoved: 0, superBowlSet: 0, error: 'File not loaded' };
      }

      // Set Super Bowl number
      const superBowlNum = Math.max(0, year - 1965);
      const seasonInfo = franchise.getTableByName('SeasonInfo');
      if (seasonInfo) {
        await seasonInfo.readRecords();
        for (const rec of seasonInfo.records) {
          if (rec.isEmpty) continue;
          if (rec.BaseSuperBowlNumber !== undefined) {
            rec.BaseSuperBowlNumber = superBowlNum;
          }
        }
      }
      console.log(`[RetroEditorService] Set Super Bowl to ${superBowlNum}`);

      // Log current state before save
      let playerTable = franchise.getTableByName('Player');
      if (!playerTable) {
        playerTable = franchise.getTableByUniqueId(TABLE_IDS.playerTable);
      }
      if (playerTable) {
        await playerTable.readRecords();
        let panthers = 0, jaguars = 0, fa = 0;
        for (const p of playerTable.records) {
          if (p.isEmpty) continue;
          const ti = Number(p.TeamIndex);
          if (ti === 20) panthers++;
          if (ti === 16) jaguars++;
          if (ti === 32) fa++;
        }
        console.log(`[RetroEditorService] BEFORE SAVE: Panthers=${panthers}, Jaguars=${jaguars}, FA=${fa}`);
      }

      // Save
      await franchise.save(filePath);
      console.log(`[RetroEditorService] SAVED to ${filePath}`);

      return { success: true, playersMoved: 0, superBowlSet: superBowlNum };

    } catch (err: any) {
      console.error('[RetroEditorService] applyAndSave error:', err);
      return { success: false, playersMoved: 0, superBowlSet: 0, error: err.message };
    }
  }

  /**
   * Set Super Bowl number and save to a NEW location (Save As)
   * Does NOT move players - that should be done by moveInactivePlayersToFA BEFORE expansion draft
   */
  async applyAndSaveAs(originalPath: string, newPath: string, year: number): Promise<{
    success: boolean;
    playersMoved: number;
    superBowlSet: number;
    newPath?: string;
    error?: string;
  }> {
    console.log(`[RetroEditorService] ===== APPLY AND SAVE AS (year=${year}) =====`);
    console.log(`[RetroEditorService] Original: ${originalPath}`);
    console.log(`[RetroEditorService] New path: ${newPath}`);

    try {
      // Get the franchise (must already be loaded)
      const franchise = this.getFranchise(originalPath);
      if (!franchise) {
        return { success: false, playersMoved: 0, superBowlSet: 0, error: 'File not loaded' };
      }

      // Set Super Bowl number
      const superBowlNum = Math.max(0, year - 1965);
      const seasonInfo = franchise.getTableByName('SeasonInfo');
      if (seasonInfo) {
        await seasonInfo.readRecords();
        for (const rec of seasonInfo.records) {
          if (rec.isEmpty) continue;
          if (rec.BaseSuperBowlNumber !== undefined) {
            rec.BaseSuperBowlNumber = superBowlNum;
          }
        }
      }
      console.log(`[RetroEditorService] Set Super Bowl to ${superBowlNum}`);

      // Log current state before save
      let playerTable = franchise.getTableByName('Player');
      if (!playerTable) {
        playerTable = franchise.getTableByUniqueId(TABLE_IDS.playerTable);
      }
      if (playerTable) {
        await playerTable.readRecords();
        let panthers = 0, jaguars = 0, fa = 0;
        for (const p of playerTable.records) {
          if (p.isEmpty) continue;
          const ti = Number(p.TeamIndex);
          if (ti === 20) panthers++;
          if (ti === 16) jaguars++;
          if (ti === 32) fa++;
        }
        console.log(`[RetroEditorService] BEFORE SAVE: Panthers=${panthers}, Jaguars=${jaguars}, FA=${fa}`);
      }

      // Save to new path
      await franchise.save(newPath);
      console.log(`[RetroEditorService] SAVED to ${newPath}`);

      // Update the instance map to use the new path
      const normalizedOldPath = path.normalize(originalPath);
      const normalizedNewPath = path.normalize(newPath);
      if (normalizedOldPath !== normalizedNewPath) {
        this.franchiseInstances.set(normalizedNewPath, franchise);
        this.franchiseInstances.delete(normalizedOldPath);
      }

      return { success: true, playersMoved: 0, superBowlSet: superBowlNum, newPath };

    } catch (err: any) {
      console.error('[RetroEditorService] applyAndSaveAs error:', err);
      return { success: false, playersMoved: 0, superBowlSet: 0, error: err.message };
    }
  }

  /**
   * Get commentary preview - shows players with incorrect or missing commentary IDs
   * Uses lookupService to check what the correct commentary ID should be based on last name
   */
  async getCommentaryPreview(filePath: string): Promise<{
    success: boolean;
    playersToFix: Array<{
      playerIndex: number;
      firstName: string;
      lastName: string;
      currentCommId: number;
      correctCommId: number;
      teamIndex: number;
    }>;
    totalPlayers: number;
    error?: string;
  }> {
    const franchise = this.getFranchise(filePath);
    if (!franchise) {
      return {
        success: false,
        playersToFix: [],
        totalPlayers: 0,
        error: 'Franchise file not loaded. Call loadFranchiseFile first.'
      };
    }

    console.log('[RetroEditorService] Getting commentary preview...');

    // Get Player table
    let playerTable = franchise.getTableByName('Player');
    if (!playerTable) {
      playerTable = franchise.getTableByUniqueId(TABLE_IDS.playerTable);
    }
    if (!playerTable) {
      return {
        success: false,
        playersToFix: [],
        totalPlayers: 0,
        error: 'Could not find Player table'
      };
    }

    await playerTable.readRecords();
    console.log(`[RetroEditorService] Found ${playerTable.records.length} player records`);

    const playersToFix: Array<{
      playerIndex: number;
      firstName: string;
      lastName: string;
      currentCommId: number;
      correctCommId: number;
      teamIndex: number;
    }> = [];

    let totalPlayers = 0;

    for (const player of playerTable.records) {
      if (player.isEmpty) continue;

      const firstName = player.FirstName || '';
      const lastName = player.LastName || '';

      // Skip placeholder names
      if (!lastName || lastName === 'Player' || lastName.startsWith('Empty')) continue;

      totalPlayers++;

      // Get current commentary ID
      const currentCommId = player.CommentaryId !== undefined ? Number(player.CommentaryId) : 0;

      // Lookup correct commentary ID from the lookup service
      const correctCommId = lookupService.getCommentaryId(lastName) || 0;

      // If they don't match, add to the list
      if (currentCommId !== correctCommId && correctCommId > 0) {
        playersToFix.push({
          playerIndex: player.index,
          firstName,
          lastName,
          currentCommId,
          correctCommId,
          teamIndex: Number(player.TeamIndex) || 32
        });
      }
    }

    console.log(`[RetroEditorService] Commentary preview: ${playersToFix.length} players need fixing out of ${totalPlayers}`);

    return {
      success: true,
      playersToFix,
      totalPlayers
    };
  }

  /**
   * Apply commentary fix - updates CommentaryId for all players based on their last name
   */
  async applyCommentaryFix(filePath: string): Promise<{
    success: boolean;
    playersFixed: number;
    error?: string;
  }> {
    const franchise = this.getFranchise(filePath);
    if (!franchise) {
      return {
        success: false,
        playersFixed: 0,
        error: 'Franchise file not loaded. Call loadFranchiseFile first.'
      };
    }

    console.log('[RetroEditorService] Applying commentary fix...');

    // Get Player table
    let playerTable = franchise.getTableByName('Player');
    if (!playerTable) {
      playerTable = franchise.getTableByUniqueId(TABLE_IDS.playerTable);
    }
    if (!playerTable) {
      return {
        success: false,
        playersFixed: 0,
        error: 'Could not find Player table'
      };
    }

    await playerTable.readRecords();
    let playersFixed = 0;

    for (const player of playerTable.records) {
      if (player.isEmpty) continue;

      const lastName = player.LastName || '';
      if (!lastName || lastName === 'Player' || lastName.startsWith('Empty')) continue;

      // Get current and correct commentary IDs
      const currentCommId = player.CommentaryId !== undefined ? Number(player.CommentaryId) : 0;
      const correctCommId = lookupService.getCommentaryId(lastName) || 0;

      // If they don't match and we have a correct ID, update it
      if (currentCommId !== correctCommId && correctCommId > 0) {
        try {
          player.CommentaryId = correctCommId;
          playersFixed++;
        } catch (err: any) {
          console.warn(`[RetroEditorService] Failed to update CommentaryId for ${player.FirstName} ${lastName}: ${err.message}`);
        }
      }
    }

    console.log(`[RetroEditorService] Commentary fix applied: ${playersFixed} players updated`);

    // Save the file
    await franchise.save();
    console.log('[RetroEditorService] File saved after commentary fix');

    return {
      success: true,
      playersFixed
    };
  }

  /**
   * Get list of free agent coaches in the franchise file
   * These are coaches not assigned to any team (team index >= 32)
   */
  async getFreeAgentCoaches(filePath: string): Promise<{
    success: boolean;
    faCoaches: Array<{
      coachIndex: number;
      firstName: string;
      lastName: string;
      position: string;
      age: number;
      yearsCoaching: number;
    }>;
    error?: string;
  }> {
    const franchise = this.getFranchise(filePath);
    if (!franchise) {
      return {
        success: false,
        faCoaches: [],
        error: 'Franchise file not loaded. Call loadFranchiseFile first.'
      };
    }

    console.log('[RetroEditorService] Getting free agent coaches...');

    // Get Coach table
    let coachTable = franchise.getTableByUniqueId(TABLE_IDS.coachTable);
    if (!coachTable) {
      coachTable = franchise.getTableByName('Coach');
    }
    if (!coachTable) {
      return {
        success: false,
        faCoaches: [],
        error: 'Could not find Coach table'
      };
    }

    await coachTable.readRecords();
    console.log(`[RetroEditorService] Found ${coachTable.records.length} coach records`);

    const FREE_AGENT_COACH_TEAM = 32;
    const faCoaches: Array<{
      coachIndex: number;
      firstName: string;
      lastName: string;
      position: string;
      age: number;
      yearsCoaching: number;
    }> = [];

    for (const coach of coachTable.records) {
      if (coach.isEmpty) continue;

      const teamIndex = Number(coach.TeamIndex);
      const contractStatus = coach.ContractStatus;

      // FA coaches have team index >= 32 or FreeAgent contract status
      if (teamIndex >= FREE_AGENT_COACH_TEAM || contractStatus === 'FreeAgent') {
        faCoaches.push({
          coachIndex: coach.index,
          firstName: coach.FirstName || '',
          lastName: coach.LastName || '',
          position: coach.Position || 'Unknown',
          age: Number(coach.Age) || 0,
          yearsCoaching: Number(coach.YearsCoaching) || 0
        });
      }
    }

    console.log(`[RetroEditorService] Found ${faCoaches.length} free agent coaches`);

    return {
      success: true,
      faCoaches
    };
  }

  /**
   * Search the coach database for coaches matching a query
   * Searches by first name, last name, or full name
   */
  searchCoachDatabase(query: string, year: number, limit: number = 20): {
    success: boolean;
    results: Array<{
      firstName: string;
      lastName: string;
      position: string;
      careerFrom: number;
      careerTo: number;
      careerWins: number;
      careerLosses: number;
    }>;
    error?: string;
  } {
    console.log(`[RetroEditorService] searchCoachDatabase called: query="${query}", year=${year}, limit=${limit}`);

    const coachDb = this.loadCoachDatabase();
    if (!coachDb) {
      console.warn('[RetroEditorService] Could not load coach database');
      return { success: false, results: [], error: 'Could not load coach database file' };
    }

    console.log(`[RetroEditorService] Coach database loaded with ${coachDb.coaches?.length || 0} coaches`);

    const queryLower = query.toLowerCase().trim();
    if (!queryLower) {
      console.log('[RetroEditorService] Empty query, returning empty results');
      return { success: true, results: [] };
    }

    const results: Array<{
      firstName: string;
      lastName: string;
      position: string;
      careerFrom: number;
      careerTo: number;
      careerWins: number;
      careerLosses: number;
    }> = [];

    for (const coach of coachDb.coaches) {
      // Skip if coach started after the target year
      if (coach.careerFrom > year) continue;

      const fullName = `${coach.firstName} ${coach.lastName}`.toLowerCase();
      const firstName = coach.firstName.toLowerCase();
      const lastName = coach.lastName.toLowerCase();

      if (fullName.includes(queryLower) || firstName.includes(queryLower) || lastName.includes(queryLower)) {
        // Get primary position
        const positions = coach.positions || [];
        const position = positions.includes('HC') ? 'HC' : positions[0] || 'Unknown';

        results.push({
          firstName: coach.firstName,
          lastName: coach.lastName,
          position,
          careerFrom: coach.careerFrom,
          careerTo: coach.careerTo,
          careerWins: coach.careerWins || 0,
          careerLosses: coach.careerLosses || 0
        });

        if (results.length >= limit) break;
      }
    }

    console.log(`[RetroEditorService] Search found ${results.length} results for query "${query}"`);
    return { success: true, results };
  }

  /**
   * Replace a specific FA coach in the franchise with a coach from the database
   */
  async replaceCoachWithDatabaseCoach(
    filePath: string,
    faCoachIndex: number,
    dbCoach: { firstName: string; lastName: string; careerFrom?: number; careerWins?: number; careerLosses?: number },
    year: number
  ): Promise<{
    success: boolean;
    error?: string;
  }> {
    const franchise = this.getFranchise(filePath);
    if (!franchise) {
      return {
        success: false,
        error: 'Franchise file not loaded. Call loadFranchiseFile first.'
      };
    }

    console.log(`[RetroEditorService] Replacing FA coach at index ${faCoachIndex} with ${dbCoach.firstName} ${dbCoach.lastName}`);

    // Get Coach table
    let coachTable = franchise.getTableByUniqueId(TABLE_IDS.coachTable);
    if (!coachTable) {
      coachTable = franchise.getTableByName('Coach');
    }
    if (!coachTable) {
      return {
        success: false,
        error: 'Could not find Coach table'
      };
    }

    await coachTable.readRecords();

    // Find the FA coach by index
    const faCoach = coachTable.records.find((c: any) => c.index === faCoachIndex);
    if (!faCoach) {
      return {
        success: false,
        error: `Coach with index ${faCoachIndex} not found`
      };
    }

    try {
      // Update the coach's info
      faCoach.FirstName = dbCoach.firstName;
      faCoach.LastName = dbCoach.lastName;

      // Set career stats if available
      if (dbCoach.careerWins !== undefined) {
        try { faCoach.CareerWins = dbCoach.careerWins; } catch (e) { /* field may not exist */ }
      }
      if (dbCoach.careerLosses !== undefined) {
        try { faCoach.CareerLosses = dbCoach.careerLosses; } catch (e) { /* field may not exist */ }
      }

      // Calculate years coaching
      if (dbCoach.careerFrom !== undefined) {
        try {
          const yearsCoaching = Math.max(1, year - dbCoach.careerFrom + 1);
          faCoach.YearsCoaching = yearsCoaching;
        } catch (e) { /* field may not exist */ }
      }

      console.log(`[RetroEditorService] Successfully replaced coach with ${dbCoach.firstName} ${dbCoach.lastName}`);

      return { success: true };
    } catch (err: any) {
      return {
        success: false,
        error: `Failed to update coach: ${err.message}`
      };
    }
  }
}

// Export singleton instance
export const retroEditorService = new RetroEditorService();
