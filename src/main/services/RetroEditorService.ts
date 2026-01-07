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
  gameTable: 1607878349, // SeasonGame table - verified with check-table-ids.js

  // Additional useful tables
  playerTable: 432457634,
  coachTable: 1864063867,
  ownerTable: 3429237668,
  stadiumTable: 459799498,
  leagueTable: 1625193857,
};

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
  private dataLoaded = false;

  constructor() {
    this.loadHistoricalData();
  }

  /**
   * Load historical data JSON files
   */
  private loadHistoricalData(): void {
    try {
      const appPath = app.getAppPath();
      const dataPath = app.isPackaged
        ? path.join(appPath, '.vite', 'build', 'data', 'retro')
        : path.join(appPath, 'data', 'retro');

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
        this.expansionHistory = expData.expansions;
        this.specialCases = expData.specialCases || {};
        console.log('[RetroEditorService] Loaded expansion history:', this.expansionHistory.length);
        console.log('[RetroEditorService] Loaded special cases:', Object.keys(this.specialCases).length);
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

      // Store instance for later operations
      this.franchiseInstances.set(filePath, franchise);

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
    const franchise = this.franchiseInstances.get(filePath);
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
   */
  async setSeasonYear(filePath: string, year: number): Promise<void> {
    const franchise = this.franchiseInstances.get(filePath);
    if (!franchise) {
      throw new Error('Franchise file not loaded. Call loadFranchiseFile first.');
    }

    console.log(`[RetroEditorService] Setting season year to ${year}`);

    const seasonInfoTable = franchise.getTableByUniqueId(TABLE_IDS.seasonInfoTable);
    await seasonInfoTable.readRecords();
    const seasonRecord = seasonInfoTable.records[0];

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
    // Note: Field names may vary - try multiple common names
    if ('SeasonYear' in seasonRecord) {
      seasonRecord.SeasonYear = year;
    }
    if ('CurrentSeasonYear' in seasonRecord) {
      seasonRecord.CurrentSeasonYear = year;
    }
    if ('BaseCalendarYear' in seasonRecord) {
      seasonRecord.BaseCalendarYear = year;
    }
    if ('CalendarYear' in seasonRecord) {
      seasonRecord.CalendarYear = year;
    }
    if ('SuperBowlNumber' in seasonRecord) {
      seasonRecord.SuperBowlNumber = superBowlNumber;
    }
    if ('BaseSuperBowlNumber' in seasonRecord) {
      seasonRecord.BaseSuperBowlNumber = superBowlNumber;
    }

    // Set the regular season week count - critical for historical seasons!
    // This tells Madden how many weeks of regular season games to expect
    if ('NflseasonWeekCount' in seasonRecord) {
      seasonRecord.NflseasonWeekCount = regularSeasonWeeks;
      console.log(`[RetroEditorService] Set NflseasonWeekCount = ${regularSeasonWeeks}`);
    }

    console.log(`[RetroEditorService] Set season year to ${year}, Super Bowl ${superBowlNumber}, weeks ${regularSeasonWeeks}`);
  }

  /**
   * Update team names based on the selected year
   */
  async updateTeamNames(filePath: string, year: number): Promise<TeamNameChange[]> {
    const franchise = this.franchiseInstances.get(filePath);
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

      // Skip if no changes needed (check city, name, AND abbreviation)
      const currentAbbr = team.currentAbbreviation || '';
      const changeAbbr = change.abbreviation || '';
      const needsUpdate = change.city !== team.currentCity ||
                          change.name !== team.currentName ||
                          (changeAbbr && changeAbbr !== currentAbbr);
      if (!needsUpdate) {
        continue;
      }

      const originalCity = teamRecord.DisplayName || teamRecord.LongName?.split(' ')[0] || team.currentCity;
      const originalName = teamRecord.NickName || teamRecord.ShortName || team.currentName;

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
   * Reorder draft picks to move expansion teams to end of each round
   */
  async reorderDraftPicks(filePath: string, year: number): Promise<number> {
    const franchise = this.franchiseInstances.get(filePath);
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

    const inactiveTeams = this.getInactiveTeamsForYear(year);
    const inactiveTeamIndices = new Set(inactiveTeams.map(t => t.teamIndex));

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
      // Sort: active teams first, then inactive teams
      picks.sort((a, b) => {
        const aTeamIndex = a.TeamIndex || a.teamIndex;
        const bTeamIndex = b.TeamIndex || b.teamIndex;
        const aInactive = inactiveTeamIndices.has(aTeamIndex);
        const bInactive = inactiveTeamIndices.has(bTeamIndex);

        if (aInactive && !bInactive) return 1;
        if (!aInactive && bInactive) return -1;
        return (a.PickNumber || a.pickNumber || 0) - (b.PickNumber || b.pickNumber || 0);
      });

      // Reassign pick numbers
      picks.forEach((pick, index) => {
        const teamIndex = pick.TeamIndex || pick.teamIndex;
        if (inactiveTeamIndices.has(teamIndex)) {
          reorderedCount++;
        }
        if ('PickNumber' in pick) {
          pick.PickNumber = index + 1;
        }
        if ('pickNumber' in pick) {
          pick.pickNumber = index + 1;
        }
      });
    }

    console.log(`[RetroEditorService] Reordered ${reorderedCount} picks for inactive teams`);
    return reorderedCount;
  }

  /**
   * Get current team list from franchise file
   */
  async getTeamList(filePath: string): Promise<any[]> {
    const franchise = this.franchiseInstances.get(filePath);
    if (!franchise) {
      throw new Error('Franchise file not loaded. Call loadFranchiseFile first.');
    }

    const teamTable = franchise.getTableByUniqueId(TABLE_IDS.teamTable);
    await teamTable.readRecords();

    return teamTable.records
      .filter((r: any) => !r.isEmpty)
      .map((r: any) => ({
        teamIndex: r.TeamIndex || r.teamIndex,
        longName: r.LongName || r.longName,
        displayName: r.DisplayName || r.displayName,
        shortName: r.ShortName || r.shortName || r.NickName || r.nickName,
        abbreviation: r.Abbreviation || r.abbreviation
      }));
  }

  /**
   * Save the modified franchise file (overwrite original)
   */
  async saveFranchiseFile(filePath: string): Promise<void> {
    const franchise = this.franchiseInstances.get(filePath);
    if (!franchise) {
      throw new Error('Franchise file not loaded. Call loadFranchiseFile first.');
    }

    console.log('[RetroEditorService] Saving franchise file:', filePath);
    await franchise.save(filePath);
    console.log('[RetroEditorService] Franchise file saved successfully');
  }

  /**
   * Save the modified franchise file to a new location (Save As)
   */
  async saveFranchiseFileAs(originalPath: string, newPath: string): Promise<void> {
    const franchise = this.franchiseInstances.get(originalPath);
    if (!franchise) {
      throw new Error('Franchise file not loaded. Call loadFranchiseFile first.');
    }

    console.log('[RetroEditorService] Saving franchise file as:', newPath);
    await franchise.save(newPath);
    console.log('[RetroEditorService] Franchise file saved successfully to:', newPath);

    // Update the instance map to use the new path
    this.franchiseInstances.delete(originalPath);
    this.franchiseInstances.set(newPath, franchise);
  }

  /**
   * Close a franchise file and release resources
   */
  closeFranchiseFile(filePath: string): void {
    this.franchiseInstances.delete(filePath);
    console.log('[RetroEditorService] Closed franchise file:', filePath);
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
    gameCount: number;
    regularSeasonWeeks: number;
    byeWeeks: boolean;
    seasonLength: number;
    warnings: string[];
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
        gameCount: 0,
        regularSeasonWeeks: era?.regularSeasonWeeks || 17,
        byeWeeks: era?.byeWeeks || false,
        seasonLength: era?.seasonLength || 16,
        warnings: [`No schedule data available for ${year}`]
      };
    }

    const schedule = await scheduleService.loadSchedule(year);
    if (!schedule) {
      return {
        available: false,
        gameCount: 0,
        regularSeasonWeeks: era?.regularSeasonWeeks || 17,
        byeWeeks: era?.byeWeeks || false,
        seasonLength: era?.seasonLength || 16,
        warnings: [`Failed to load schedule for ${year}`]
      };
    }

    // Validate the schedule
    const validation = scheduleService.validateScheduleForYear(schedule, year);

    return {
      available: true,
      gameCount: schedule.games.length,
      regularSeasonWeeks: schedule.regularSeasonWeeks || 17,
      byeWeeks: schedule.byeWeeksEnabled,
      seasonLength: schedule.seasonLength,
      warnings: [...validation.warnings, ...validation.errors]
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
    const franchise = this.franchiseInstances.get(filePath);
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
    console.log(`[RetroEditorService] Setting NflseasonWeekCount = ${regularSeasonWeeks} for year ${year}`);

    const seasonInfoTable = franchise.getTableByUniqueId(TABLE_IDS.seasonInfoTable);
    if (seasonInfoTable) {
      await seasonInfoTable.readRecords();
      const seasonRecord = seasonInfoTable.records[0];
      if (seasonRecord && 'NflseasonWeekCount' in seasonRecord) {
        seasonRecord.NflseasonWeekCount = regularSeasonWeeks;
        console.log(`[RetroEditorService] Successfully set NflseasonWeekCount = ${regularSeasonWeeks}`);
      } else {
        console.warn('[RetroEditorService] NflseasonWeekCount field not found in SeasonInfo');
      }
    } else {
      console.warn('[RetroEditorService] SeasonInfo table not found');
    }

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
          // FIX: Set SeasonWeekType to OffSeason (8) so Madden skips these games
          // The 2011 Throwback mod uses OffSeason for weeks beyond the regular season
          if (historicalWeekNum > maxHistoricalWeek) {
            console.log(`[RetroEditorService] >>> Madden Week ${maddenWeekNum} → Historical Week ${historicalWeekNum} BEYOND SEASON END (max=${maxHistoricalWeek})`);
            console.log(`[RetroEditorService] >>> Marking ${franchiseGames.length} games as OffSeason`);
            warnings.push(`Week ${maddenWeekNum}: No historical games (historical week ${historicalWeekNum} beyond season end), marking ${franchiseGames.length} slots as OffSeason`);
            for (let i = 0; i < franchiseGames.length; i++) {
              try {
                const franchiseRecord = franchiseGames[i];
                // Mark as OffSeason so Madden won't try to simulate during regular season
                // (2011 Throwback uses OffSeason=8 for weeks beyond regular season)
                // Use string enum value - madden-franchise expects "OffSeason" not 8
                setGameField(franchiseRecord, 'SeasonWeekType', 'OffSeason');
                gamesUpdated++;
              } catch (gameErr: any) {
                console.error(`[RetroEditorService] Error marking game ${i} in week ${maddenWeekNum} as OffSeason:`, gameErr.message);
                console.error(`[RetroEditorService] Error stack:`, gameErr.stack);
                throw gameErr;
              }
            }
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
        // FIX: Set SeasonWeekType to OffSeason so Madden skips these games during regular season sim
        if (franchiseGames.length > historicalGames.length) {
          const extraCount = franchiseGames.length - historicalGames.length;
          console.log(`[RetroEditorService] Week ${maddenWeekNum}: Marking ${extraCount} extra slots as OffSeason (historical had ${historicalGames.length} games)`);
          warnings.push(`Week ${maddenWeekNum}: ${extraCount} extra slots marked as OffSeason (historical had ${historicalGames.length} games)`);
          for (let i = historicalGames.length; i < franchiseGames.length; i++) {
            try {
              const franchiseRecord = franchiseGames[i];
              // Mark as OffSeason so Madden won't try to simulate during regular season
              // Use string enum value - madden-franchise expects "OffSeason" not 8
              setGameField(franchiseRecord, 'SeasonWeekType', 'OffSeason');
              gamesUpdated++;
            } catch (gameErr: any) {
              console.error(`[RetroEditorService] Error marking extra slot ${i} in week ${maddenWeekNum} as OffSeason:`, gameErr.message);
              console.error(`[RetroEditorService] Error stack:`, gameErr.stack);
              throw gameErr;
            }
          }
        }
      } catch (weekErr: any) {
        console.error(`[RetroEditorService] Error processing week ${maddenWeekNum}:`, weekErr.message);
        throw weekErr;
      }
    }

    console.log(`[RetroEditorService] Updated ${gamesUpdated} regular season games`);

    // ====== APPLY HISTORICAL PRESEASON SCHEDULE ======
    // SIMPLIFIED APPROACH: Don't sort slots by current teams - just apply historical games directly
    // The current team matchups in M26 are irrelevant; we're replacing them entirely.
    let preseasonGamesApplied = 0;
    if (preseasonByWeek.size > 0) {
      console.log(`[RetroEditorService] ====== APPLYING PRESEASON SCHEDULE ======`);

      // Determine inactive teams for this year (for diagnostic purposes)
      const inactiveTeams = new Set<number>();
      for (const team of this.expansionHistory) {
        if (team.year > year) {
          inactiveTeams.add(team.teamIndex);
        }
      }
      if (year >= 1996 && year <= 1998) {
        inactiveTeams.add(4); // Browns 1996-1998
      }
      console.log(`[RetroEditorService] Inactive teams for ${year}: ${[...inactiveTeams].join(', ')}`);

      // Collect ALL franchise preseason game records by week (don't filter by current teams!)
      const franchisePreseasonByWeek = new Map<number, any[]>();

      for (const record of gameTable.records) {
        if (record.isEmpty) continue;

        const weekType = getGameField(record, 'SeasonWeekType');
        const isPreseason = weekType === 0 || weekType === SEASON_WEEK_TYPES.PreSeason || weekType === 'PreSeason';
        if (!isPreseason) continue;

        const weekNum = getGameField(record, 'SeasonWeek');
        if (weekNum === undefined || weekNum === null) continue;

        if (!franchisePreseasonByWeek.has(weekNum)) {
          franchisePreseasonByWeek.set(weekNum, []);
        }
        franchisePreseasonByWeek.get(weekNum)!.push(record);
      }

      const franchisePreseasonWeeks = [...franchisePreseasonByWeek.keys()].sort((a, b) => a - b);
      const historicalPreseasonWeeks = [...preseasonByWeek.keys()].sort((a, b) => a - b);

      console.log(`[RetroEditorService] Franchise preseason weeks: ${franchisePreseasonWeeks.join(', ')}`);
      console.log(`[RetroEditorService] Slots per week: ${franchisePreseasonWeeks.map(w => `W${w}=${franchisePreseasonByWeek.get(w)?.length || 0}`).join(', ')}`);
      console.log(`[RetroEditorService] Historical preseason weeks: ${historicalPreseasonWeeks.join(', ')}`);
      console.log(`[RetroEditorService] Historical games per week: ${historicalPreseasonWeeks.map(w => `W${w}=${preseasonByWeek.get(w)?.length || 0}`).join(', ')}`);

      // Determine week offset: Historical uses 1-indexed (1,2,3,4), Madden might use 0-indexed (0,1,2,3)
      let weekOffset = 0;
      if (franchisePreseasonWeeks.includes(0) && !franchisePreseasonWeeks.includes(4)) {
        weekOffset = -1; // Madden uses 0,1,2,3 so historical 1 -> Madden 0
        console.log(`[RetroEditorService] Detected 0-indexed Madden weeks, using offset ${weekOffset}`);
      } else if (franchisePreseasonWeeks.includes(1) && franchisePreseasonWeeks.includes(4)) {
        weekOffset = 0; // Madden uses 1,2,3,4 directly
        console.log(`[RetroEditorService] Detected 1-indexed Madden weeks, using offset ${weekOffset}`);
      } else {
        console.log(`[RetroEditorService] Week indexing unclear, will try both approaches`);
      }

      // CRITICAL: Madden 26 only has 3 preseason weeks (0,1,2) but historical years had 4 weeks
      // We need to convert OffSeason slots to PreSeason for week 3 if needed
      const offSeasonSlots: any[] = [];
      for (const record of gameTable.records) {
        if (record.isEmpty) continue;
        const weekType = getGameField(record, 'SeasonWeekType');
        const isOffSeason = weekType === 8 || weekType === 'OffSeason';
        if (isOffSeason) {
          offSeasonSlots.push(record);
        }
      }
      console.log(`[RetroEditorService] Found ${offSeasonSlots.length} OffSeason slots available for conversion`);

      // Apply historical preseason games
      for (const [historicalWeekNum, historicalGames] of preseasonByWeek) {
        // Try to find matching franchise week
        let maddenWeekNum = historicalWeekNum + weekOffset;
        let franchiseSlots = franchisePreseasonByWeek.get(maddenWeekNum);

        // If not found with offset, try direct match
        if (!franchiseSlots && weekOffset !== 0) {
          franchiseSlots = franchisePreseasonByWeek.get(historicalWeekNum);
          if (franchiseSlots) {
            maddenWeekNum = historicalWeekNum;
            console.log(`[RetroEditorService] Using direct match for week ${historicalWeekNum}`);
          }
        }

        // If still no slots, convert OffSeason slots to PreSeason for this week
        if ((!franchiseSlots || franchiseSlots.length === 0) && offSeasonSlots.length >= historicalGames.length) {
          console.log(`[RetroEditorService] Converting ${historicalGames.length} OffSeason slots to PreSeason week ${maddenWeekNum}`);
          franchiseSlots = offSeasonSlots.splice(0, historicalGames.length);
          // Set the week number on these slots
          for (const slot of franchiseSlots) {
            try {
              setGameField(slot, 'SeasonWeek', maddenWeekNum);
            } catch (err: any) {
              console.warn(`[RetroEditorService] Could not set SeasonWeek: ${err.message}`);
            }
          }
        }

        // If we have some slots but not enough, supplement with OffSeason slots
        if (franchiseSlots && franchiseSlots.length < historicalGames.length) {
          const needed = historicalGames.length - franchiseSlots.length;
          if (offSeasonSlots.length >= needed) {
            console.log(`[RetroEditorService] Supplementing week ${maddenWeekNum} with ${needed} additional OffSeason slots`);
            const additionalSlots = offSeasonSlots.splice(0, needed);
            for (const slot of additionalSlots) {
              try {
                setGameField(slot, 'SeasonWeek', maddenWeekNum);
              } catch (err: any) {
                console.warn(`[RetroEditorService] Could not set SeasonWeek: ${err.message}`);
              }
            }
            franchiseSlots = [...franchiseSlots, ...additionalSlots];
          }
        }

        if (!franchiseSlots || franchiseSlots.length === 0) {
          console.warn(`[RetroEditorService] No franchise preseason slots for week ${maddenWeekNum} (historical ${historicalWeekNum})`);
          continue;
        }

        console.log(`[RetroEditorService] Preseason Week ${historicalWeekNum} (Madden ${maddenWeekNum}): ${historicalGames.length} historical games, ${franchiseSlots.length} franchise slots`);

        // Apply historical games to franchise slots
        // Historical games (e.g., 14 for 28-team era) go to first N slots
        // Remaining slots (e.g., 2 for 32-team franchise) get marked as OffSeason
        for (let i = 0; i < franchiseSlots.length; i++) {
          const franchiseRecord = franchiseSlots[i];

          if (i < historicalGames.length) {
            // Apply historical game
            const historicalGame = historicalGames[i];
            const homeRecordIndex = teamIndexToRecordIndex.get(historicalGame.homeTeamIndex);
            const awayRecordIndex = teamIndexToRecordIndex.get(historicalGame.awayTeamIndex);

            if (homeRecordIndex !== undefined && awayRecordIndex !== undefined) {
              const homeTeamRef = teamRefPrefix + homeRecordIndex.toString(2).padStart(8, '0');
              const awayTeamRef = teamRefPrefix + awayRecordIndex.toString(2).padStart(8, '0');

              franchiseRecord.HomeTeam = homeTeamRef;
              franchiseRecord.AwayTeam = awayTeamRef;
              // Ensure it's marked as PreSeason (in case it was changed)
              setGameField(franchiseRecord, 'SeasonWeekType', 'PreSeason');
              // Reset GameStatus to Unplayed (important: existing slots may have been simmed)
              franchiseRecord.GameStatus = 'Unplayed';
              preseasonGamesApplied++;
              gamesUpdated++;

              // Log first few and last few for verification
              if (preseasonGamesApplied <= 3 || i === historicalGames.length - 1) {
                console.log(`[RetroEditorService] Preseason W${historicalWeekNum} G${i + 1}: ${historicalGame.awayTeam} @ ${historicalGame.homeTeam}`);
              }
            } else {
              console.warn(`[RetroEditorService] Could not get team refs for: ${historicalGame.awayTeam} @ ${historicalGame.homeTeam}`);
            }
          } else {
            // Mark extra slot as OffSeason (franchise has more slots than historical games)
            try {
              setGameField(franchiseRecord, 'SeasonWeekType', 'OffSeason');
              gamesUpdated++;
              if (i === historicalGames.length) {
                console.log(`[RetroEditorService] Marked slots ${historicalGames.length + 1}-${franchiseSlots.length} as OffSeason for week ${maddenWeekNum}`);
              }
            } catch (err: any) {
              console.warn(`[RetroEditorService] Could not mark slot ${i} as OffSeason: ${err.message}`);
            }
          }
        }
      }

      console.log(`[RetroEditorService] Applied ${preseasonGamesApplied} preseason games`);

      // Diagnostic: Count games per team after preseason application
      const teamGameCount: Record<number, number> = {};
      for (const record of gameTable.records) {
        if (record.isEmpty) continue;
        const weekType = getGameField(record, 'SeasonWeekType');
        const isPreseason = weekType === 0 || weekType === SEASON_WEEK_TYPES.PreSeason || weekType === 'PreSeason';
        if (!isPreseason) continue;

        const homeTeam = record.HomeTeam;
        const awayTeam = record.AwayTeam;

        for (const [tIndex, rIndex] of teamIndexToRecordIndex.entries()) {
          const expectedRef = teamRefPrefix + rIndex.toString(2).padStart(8, '0');
          if (homeTeam === expectedRef || awayTeam === expectedRef) {
            teamGameCount[tIndex] = (teamGameCount[tIndex] || 0) + 1;
          }
        }
      }

      // Log teams with wrong game count
      const expectedGames = schedule.preseasonWeeks || 4;
      const activeTeamCount = 32 - inactiveTeams.size;
      let wrongCount = 0;
      const wrongTeams: string[] = [];
      for (let teamIdx = 0; teamIdx < 32; teamIdx++) {
        const count = teamGameCount[teamIdx] || 0;
        if (inactiveTeams.has(teamIdx)) {
          // Inactive teams should have 0 games (or games marked OffSeason won't count)
          continue;
        }
        if (count !== expectedGames) {
          wrongTeams.push(`Team${teamIdx}=${count}`);
          wrongCount++;
        }
      }
      if (wrongCount === 0) {
        console.log(`[RetroEditorService] All ${activeTeamCount} active teams have ${expectedGames} preseason games`);
      } else {
        console.warn(`[RetroEditorService] ${wrongCount} teams have wrong preseason game count: ${wrongTeams.join(', ')}`);
      }
    }

    // ====== HANDLE PRESEASON GAMES FOR EXPANSION TEAMS ======
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

    // CRITICAL: Save the franchise file to persist changes!
    console.log(`[RetroEditorService] ====== SAVING FRANCHISE FILE ======`);
    console.log(`[RetroEditorService] Path: ${filePath}`);
    console.log(`[RetroEditorService] Games updated: ${gamesUpdated}`);
    console.log(`[RetroEditorService] Warnings: ${warnings.length}`);
    try {
      await franchise.save(filePath);
      console.log(`[RetroEditorService] ====== SAVE COMPLETED SUCCESSFULLY ======`);
    } catch (saveError: any) {
      console.error(`[RetroEditorService] ====== SAVE FAILED ======`);
      console.error(`[RetroEditorService] Error:`, saveError);
      throw saveError;
    }

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

    const warnings: string[] = [];
    const coachChanges: Array<{
      teamAbbr: string;
      teamIndex: number;
      headCoach: string;
      offensiveCoordinator: string;
      defensiveCoordinator: string;
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

      coachChanges.push({
        teamAbbr: team.teamAbbr,
        teamIndex: team.teamIndex,
        headCoach: hcName,
        offensiveCoordinator: ocName,
        defensiveCoordinator: dcName
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
    const franchise = this.franchiseInstances.get(filePath);
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

        // Look up coach in our database to see if they have a portrait and AssetName
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
          // Coach not found in database - use generic face and generic AssetName
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
   * Get salary cap for a specific year
   */
  getSalaryCapForYear(year: number): { value: number; note?: string } {
    const data = this.loadSalaryCapData();
    if (!data) {
      return { value: 0, note: 'No salary cap data available' };
    }

    // Check if pre-cap era (before 1994)
    if (data.preCap && year >= data.preCap.startYear && year <= data.preCap.endYear) {
      return { value: 0, note: data.preCap.note || 'No salary cap in this era' };
    }

    // Get specific year cap
    const yearStr = year.toString();
    if (data.caps && data.caps[yearStr]) {
      const note = data.notes && data.notes[yearStr] ? data.notes[yearStr] : undefined;
      return { value: data.caps[yearStr], note };
    }

    return { value: 0, note: `No salary cap data for ${year}` };
  }

  /**
   * Apply salary cap to franchise file
   */
  async applySalaryCap(filePath: string, year: number): Promise<{
    success: boolean;
    previousCap: number;
    newCap: number;
    note?: string;
    error?: string;
  }> {
    const franchise = this.franchiseInstances.get(filePath);
    if (!franchise) {
      return {
        success: false,
        previousCap: 0,
        newCap: 0,
        error: 'Franchise file not loaded. Call loadFranchiseFile first.'
      };
    }

    const capInfo = this.getSalaryCapForYear(year);
    console.log(`[RetroEditorService] Setting salary cap for ${year}: $${capInfo.value.toLocaleString()}`);

    // Get the League table
    let leagueTable = franchise.getTableByUniqueId(TABLE_IDS.leagueTable);
    if (!leagueTable) {
      leagueTable = franchise.getTableByName('League');
    }
    if (!leagueTable) {
      console.error('[RetroEditorService] Could not find League table!');
      return {
        success: false,
        previousCap: 0,
        newCap: capInfo.value,
        error: 'Could not find League table in franchise file'
      };
    }

    await leagueTable.readRecords();
    console.log(`[RetroEditorService] Found ${leagueTable.records.length} league records`);

    // Find the active league record
    const leagueRecord = leagueTable.records.find((r: any) => !r.isEmpty);
    if (!leagueRecord) {
      return {
        success: false,
        previousCap: 0,
        newCap: capInfo.value,
        error: 'No active league record found'
      };
    }

    // Log available fields
    const fieldNames = Object.keys(leagueRecord).filter(k => !k.startsWith('_') && typeof leagueRecord[k] !== 'function');
    console.log('[RetroEditorService] League table fields:', fieldNames.slice(0, 20));

    // Get previous cap value
    const previousCap = leagueRecord.SalaryCap || leagueRecord.SalaryCapTotal || 0;

    // Set salary cap - try various field names
    if ('SalaryCap' in leagueRecord) {
      leagueRecord.SalaryCap = capInfo.value;
      console.log(`[RetroEditorService] Set SalaryCap = ${capInfo.value}`);
    }
    if ('SalaryCapTotal' in leagueRecord) {
      leagueRecord.SalaryCapTotal = capInfo.value;
      console.log(`[RetroEditorService] Set SalaryCapTotal = ${capInfo.value}`);
    }
    if ('TeamSalaryCap' in leagueRecord) {
      leagueRecord.TeamSalaryCap = capInfo.value;
      console.log(`[RetroEditorService] Set TeamSalaryCap = ${capInfo.value}`);
    }

    return {
      success: true,
      previousCap,
      newCap: capInfo.value,
      note: capInfo.note
    };
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
    const franchise = this.franchiseInstances.get(filePath);
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
      if ('Name' in stadiumRecord) {
        stadiumRecord.Name = newName;
        stadiumsUpdated++;
        console.log(`[RetroEditorService] Stadium for team ${teamIndex}: "${oldName}" -> "${newName}"`);
      } else if ('StadiumName' in stadiumRecord) {
        stadiumRecord.StadiumName = newName;
        stadiumsUpdated++;
        console.log(`[RetroEditorService] Stadium for team ${teamIndex}: "${oldName}" -> "${newName}"`);
      } else {
        warnings.push(`Stadium record for team ${teamIndex} has no Name field`);
      }
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
    const franchise = this.franchiseInstances.get(filePath);
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
      if (offenseEnum !== undefined && 'OffensiveScheme' in hcRecord) {
        const oldScheme = hcRecord.OffensiveScheme;
        hcRecord.OffensiveScheme = offenseEnum;
        console.log(`[RetroEditorService] ${team.currentName} offense: ${oldScheme} -> ${scheme.offense} (${offenseEnum})`);
        updated = true;
      }

      // Set defensive scheme
      if (defenseEnum !== undefined && 'DefensiveScheme' in hcRecord) {
        const oldScheme = hcRecord.DefensiveScheme;
        hcRecord.DefensiveScheme = defenseEnum;
        console.log(`[RetroEditorService] ${team.currentName} defense: ${oldScheme} -> ${scheme.defense} (${defenseEnum})`);
        updated = true;
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
}

// Export singleton instance
export const retroEditorService = new RetroEditorService();
