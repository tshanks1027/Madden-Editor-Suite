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

    // The team records are indexed directly - record at index N corresponds to TeamIndex N
    // Iterate through all records and match by index position
    for (let i = 0; i < teamTable.records.length; i++) {
      const teamRecord = teamTable.records[i];
      if (teamRecord.isEmpty) continue;

      // Find the historical team that matches this index
      const team = this.historicalTeams.find(t => t.teamIndex === i);
      if (!team) {
        console.log(`[RetroEditorService] No historical data for team at index ${i}`);
        continue;
      }

      const change = this.getTeamInfoForYear(team, year);
      if (!change) {
        console.log(`[RetroEditorService] No change found for ${team.currentName} in year ${year}`);
        continue;
      }

      // Skip if no changes needed
      if (change.city === team.currentCity && change.name === team.currentName) {
        continue;
      }

      if (change.inactive) {
        console.log(`[RetroEditorService] Team ${team.currentName} is inactive for year ${year}`);
        continue;
      }

      const originalCity = teamRecord.DisplayName || teamRecord.LongName?.split(' ')[0] || team.currentCity;
      const originalName = teamRecord.NickName || teamRecord.ShortName || team.currentName;

      console.log(`[RetroEditorService] Applying change to index ${i}: ${originalCity} ${originalName} -> ${change.city} ${change.name}`);

      // Update team fields - using direct property access
      if (teamRecord.LongName !== undefined && change.city && change.name) {
        teamRecord.LongName = `${change.city} ${change.name}`;
        console.log(`[RetroEditorService]   Set LongName = "${change.city} ${change.name}"`);
      }
      if (teamRecord.DisplayName !== undefined && change.city) {
        teamRecord.DisplayName = change.city;
        console.log(`[RetroEditorService]   Set DisplayName = "${change.city}"`);
      }
      if (teamRecord.ShortName !== undefined && change.name) {
        teamRecord.ShortName = change.name;
        console.log(`[RetroEditorService]   Set ShortName = "${change.name}"`);
      }
      if (teamRecord.NickName !== undefined && change.name) {
        teamRecord.NickName = change.name;
        console.log(`[RetroEditorService]   Set NickName = "${change.name}"`);
      }

      changes.push({
        teamIndex: i,
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
}

// Export singleton instance
export const retroEditorService = new RetroEditorService();
