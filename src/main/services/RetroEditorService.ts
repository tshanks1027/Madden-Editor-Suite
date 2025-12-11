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
  gameTable: 2816609684,

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

// SeasonWeekType enum values
const SEASON_WEEK_TYPES = {
  PreSeason: 0,
  RegularSeason: 1,
  WildCard: 2,
  Divisional: 3,
  Conference: 4,
  SuperBowl: 5,
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
 */
function setGameField(record: any, fieldName: keyof typeof SEASON_GAME_FIELD_MAPPING, value: any): void {
  // Try to set via named field first
  if (record[fieldName] !== undefined) {
    record[fieldName] = value;
  }
  // Also set via generic field name to ensure it's written
  const genericName = SEASON_GAME_FIELD_MAPPING[fieldName];
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
   * Set the season year, calendar year, and Super Bowl number
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

    console.log(`[RetroEditorService] Set season year to ${year}, Super Bowl ${superBowlNumber}`);
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
    for (const game of schedule.games) {
      // Only include regular season games (weekType === 'regular')
      if (game.weekType !== 'regular') continue;

      if (!gamesByWeek.has(game.week)) {
        gamesByWeek.set(game.week, []);
      }
      gamesByWeek.get(game.week)!.push(game);
    }

    console.log(`[RetroEditorService] Schedule has ${gamesByWeek.size} weeks of regular season games`);

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

    // Handle Week 0 specially: fill with Week 1 games (may be placeholder/kickoff slots)
    // For historical seasons, Week 0 didn't exist, so we use Week 1 data
    if (hasWeek0RegularSeason && gamesByWeek.has(1)) {
      const week0Slots = franchiseGamesByWeek.get(0) || [];
      const week1HistoricalGames = gamesByWeek.get(1) || [];

      console.log(`[RetroEditorService] Filling ${week0Slots.length} Week 0 slots with Week 1 historical games`);

      // Fill Week 0 slots with games from Week 1 historical data
      // Use different games than what we'll put in Week 1 if possible, or duplicate if needed
      for (let i = 0; i < week0Slots.length && i < week1HistoricalGames.length; i++) {
        const franchiseRecord = week0Slots[i];
        const historicalGame = week1HistoricalGames[i];

        const homeTeamRef = createTeamRef(historicalGame.homeTeamIndex);
        const awayTeamRef = createTeamRef(historicalGame.awayTeamIndex);

        franchiseRecord.HomeTeam = homeTeamRef;
        franchiseRecord.AwayTeam = awayTeamRef;
        gamesUpdated++;
      }
    }

    // Get max historical week number for this schedule
    const maxHistoricalWeek = Math.max(...gamesByWeek.keys());
    console.log(`[RetroEditorService] Historical schedule max week: ${maxHistoricalWeek}`);

    // Now assign historical games to franchise game slots (Week 1+)
    for (const [maddenWeekNum, franchiseGames] of franchiseGamesByWeek) {
      // Skip Week 0 - already handled above
      if (maddenWeekNum === 0) continue;

      // Historical week = Madden week (direct mapping for Week 1+)
      const historicalGames = gamesByWeek.get(maddenWeekNum);

      if (!historicalGames || historicalGames.length === 0) {
        // No historical games for this week - this can happen for:
        // 1. Week 17+ in pre-17-game eras (1978-2020)
        // 2. Week 18 in pre-18-week eras
        // Clear all slots for this week by setting teams to null reference
        if (maddenWeekNum > maxHistoricalWeek) {
          warnings.push(`Week ${maddenWeekNum}: No historical games (beyond season end), clearing ${franchiseGames.length} slots`);
          for (let i = 0; i < franchiseGames.length; i++) {
            const franchiseRecord = franchiseGames[i];
            franchiseRecord.HomeTeam = '00000000000000000000000000000000';
            franchiseRecord.AwayTeam = '00000000000000000000000000000000';
            gamesUpdated++;
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
        const franchiseRecord = franchiseGames[i];
        const historicalGame = historicalGames[i];

        // Create team references from TeamIndex values
        const homeTeamRef = createTeamRef(historicalGame.homeTeamIndex);
        const awayTeamRef = createTeamRef(historicalGame.awayTeamIndex);

        // Set home and away teams using the binary reference format
        franchiseRecord.HomeTeam = homeTeamRef;
        franchiseRecord.AwayTeam = awayTeamRef;

        gamesUpdated++;

        // Log first few updates for debugging
        if (gamesUpdated <= 3) {
          console.log(`[RetroEditorService] Week ${maddenWeekNum} Game ${i+1}: ${historicalGame.awayTeam} @ ${historicalGame.homeTeam}`);
          console.log(`  HomeTeam ref: ${homeTeamRef} (TeamIndex ${historicalGame.homeTeamIndex})`);
          console.log(`  AwayTeam ref: ${awayTeamRef} (TeamIndex ${historicalGame.awayTeamIndex})`);
        }
      }

      // Handle extra game slots when historical has fewer games (e.g., 28-team era with 14 games/week)
      // Clear extra slots by setting teams to null reference (all zeros)
      if (franchiseGames.length > historicalGames.length) {
        const extraCount = franchiseGames.length - historicalGames.length;
        console.log(`[RetroEditorService] Week ${maddenWeekNum}: Clearing ${extraCount} extra slots`);
        warnings.push(`Week ${maddenWeekNum}: ${extraCount} extra slots cleared (historical had ${historicalGames.length} games)`);
        for (let i = historicalGames.length; i < franchiseGames.length; i++) {
          const franchiseRecord = franchiseGames[i];
          // Set to null/empty team reference
          franchiseRecord.HomeTeam = '00000000000000000000000000000000';
          franchiseRecord.AwayTeam = '00000000000000000000000000000000';
          gamesUpdated++;
        }
      }
    }

    console.log(`[RetroEditorService] Updated ${gamesUpdated} games`);

    return {
      success: true,
      gamesUpdated,
      warnings
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

      // Helper to update coach record with portrait lookup
      const updateCoachRecord = (record: any, firstName: string, lastName: string, role: string) => {
        const oldFirst = record.FirstName;
        const oldLast = record.LastName;
        const oldPortrait = record.Portrait;

        // Update name
        record.FirstName = firstName;
        record.LastName = lastName;

        // Look up coach in our database to see if they have a portrait
        // Coach_lookup.csv has: LastName,FirstName,PAM,PID
        // The Portrait field in the franchise file is a numeric PID
        // If a coach is in our database with a valid PID, use it - they have a portrait in the game
        const coachLookup = lookupService.getCoachByName(lastName, firstName);

        if (coachLookup && coachLookup.pid !== undefined && coachLookup.pid >= 0) {
          // Coach found in database with valid PID - use their portrait
          // The PID is what matters, not the PAM string (many coaches have empty PAM but valid portraits)
          if (record.Portrait !== undefined) {
            record.Portrait = coachLookup.pid;
            console.log(`[RetroEditorService]   Portrait: Using PID ${coachLookup.pid} for ${firstName} ${lastName}`);
          }
        } else {
          // Coach not found in database - use generic face
          if (record.Portrait !== undefined) {
            record.Portrait = 9999; // Generic face
            console.log(`[RetroEditorService]   Portrait: Coach ${firstName} ${lastName} not in database, using generic (9999)`);
          }
        }

        coachesUpdated++;
        console.log(`[RetroEditorService] ${teamData.teamAbbr} ${role}: "${oldFirst} ${oldLast}" -> "${firstName} ${lastName}" (Portrait: ${oldPortrait} -> ${record.Portrait})`);
      };

      // Update Head Coach
      if (hcRecord && teamData.headCoach.firstName && teamData.headCoach.lastName) {
        updateCoachRecord(hcRecord, teamData.headCoach.firstName, teamData.headCoach.lastName, 'HC');
      } else if (!hcRecord) {
        warnings.push(`No HC record found for ${teamData.teamAbbr}`);
      }

      // Update Offensive Coordinator (only if historical data has one)
      if (ocRecord && teamData.offensiveCoordinator.firstName && teamData.offensiveCoordinator.lastName) {
        updateCoachRecord(ocRecord, teamData.offensiveCoordinator.firstName, teamData.offensiveCoordinator.lastName, 'OC');
      }
      // If no OC in historical data, leave the game's default (don't update)

      // Update Defensive Coordinator (only if historical data has one)
      if (dcRecord && teamData.defensiveCoordinator.firstName && teamData.defensiveCoordinator.lastName) {
        updateCoachRecord(dcRecord, teamData.defensiveCoordinator.firstName, teamData.defensiveCoordinator.lastName, 'DC');
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
}

// Export singleton instance
export const retroEditorService = new RetroEditorService();
