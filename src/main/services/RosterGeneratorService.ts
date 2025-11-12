/**
 * Roster Generator Service
 *
 * Generates complete Madden rosters from ROSTER_lookup.csv historical player data.
 * Supports single year rosters and all-time/decade rosters combining best players.
 *
 * Key Features:
 * - Single Year Mode: All players from specific year + 5-year free agent backfill
 * - All-Time Mode: Best players from year range with position limits
 * - PID-based deduplication (keeps highest POVR version)
 * - Real Madden ratings from CSV with 30-50 variance for missing values
 * - Generic PID/PAM assignment for players without portraits
 * - Archetype numeric validation (0-67)
 * - Template buffer integrity for M26 saves
 */

import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import Papa from 'papaparse';
import { lookupService } from './lookup-service';
import { draftClassService } from './DraftClassService';

export interface RosterPlayer {
  // Basic Info
  firstName: string;
  lastName: string;
  position: string;
  jerseyNum: number;
  age: number;
  heightInches: number;
  weight: number;
  team: string;

  // IDs
  PID: number;
  PAM: string;
  PEPS: string;

  // College & Home
  college: number;
  homeState: number;

  // Ratings
  POVR: number;
  PSPD: number;  // Speed
  PACC: number;  // Acceleration
  PSTR: number;  // Strength
  PAGI: number;  // Agility
  PAWR: number;  // Awareness
  PCTH: number;  // Catching
  PCAR: number;  // Carrying
  PTHP: number;  // Throw Power
  PKPW: number;  // Kick Power
  PKAC: number;  // Kick Accuracy
  PRBK: number;  // Run Block
  PPBK: number;  // Pass Block
  PTAK: number;  // Tackle
  PBTK: number;  // Block Shedding
  PJMP: number;  // Jumping
  PINJ: number;  // Injury
  PSTA: number;  // Stamina
  PTGH: number;  // Toughness
  PTRK: number;  // Trucking
  PCOD: number;  // Carrying
  PBCV: number;  // Ball Carrier Vision
  PSTF: number;  // Stiff Arm
  PSPM: number;  // Spin Move
  PJUM: number;  // Juke Move
  PIBL: number;  // Impact Blocking
  PRBP: number;  // Run Block Power
  PRBF: number;  // Run Block Finesse
  PPBP: number;  // Pass Block Power
  PPBF: number;  // Pass Block Finesse
  PLDB: number;  // Lead Block
  PBRS: number;  // Break Sack
  PTUP: number;  // Throw Under Pressure
  PPWM: number;  // Play Action
  PFNM: number;  // Finesse Move
  PBSH: number;  // Block Shedding
  PPUR: number;  // Pursuit
  PPRC: number;  // Play Recognition
  PMCV: number;  // Man Coverage
  PZCV: number;  // Zone Coverage
  PSPC: number;  // Spectacular Catch
  PCIT: number;  // Catch in Traffic
  PSRR: number;  // Short Route Running
  PMRR: number;  // Medium Route Running
  PDRR: number;  // Deep Route Running
  PHTP: number;  // Hit Power
  PPRS: number;  // Press
  PREL: number;  // Release
  PTAS: number;  // Throw Accuracy Short
  PTAM: number;  // Throw Accuracy Mid
  PTAD: number;  // Throw Accuracy Deep
  PPLA: number;  // Play Action
  PTOR: number;  // Throw on Run
  PKRT: number;  // Kick Return

  // Metadata
  archetype: number;  // MUST be numeric 0-67
  bodyType: string;
  yearsPro: number;
  devTrait: number;
  birthDate: string;
  handedness: string;

  // Source data
  _year: number;
  _sourceTeam: string;
}

export interface RosterGeneratorOptions {
  mode: 'single-year' | 'all-time' | 'all-decade';
  year?: number;           // For single-year mode
  startYear?: number;      // For all-time mode
  endYear?: number;        // For all-time mode
}

export interface GeneratedRoster {
  players: RosterPlayer[];
  metadata: {
    mode: string;
    year?: number;
    startYear?: number;
    endYear?: number;
    generatedAt: string;
    playerCount: number;
  };
  _originalBuffer: Buffer;
  _version: string;
}

/**
 * Position limits for realistic roster composition
 */
const POSITION_LIMITS: Record<string, number> = {
  // Offense
  QB: 3,
  RB: 4,
  FB: 1,
  WR: 5,
  TE: 3,

  // Offensive Line
  LT: 2,
  LG: 2,
  C: 2,
  RG: 2,
  RT: 2,

  // Defensive Line
  LEDG: 2,  // Left Edge (not LE)
  REDG: 3,  // Right Edge (not RE)
  DT: 3,

  // Linebackers
  Will: 2,  // Weakside (not LOLB)
  MLB: 3,
  Sam: 2,   // Strongside (not ROLB)

  // Secondary
  CB: 5,
  FS: 2,
  SS: 2,

  // Special Teams
  K: 1,
  P: 1
};

/**
 * Rating fields that need to be filled if missing/zero
 */
const RATING_FIELDS = [
  'PSPD', 'PACC', 'PSTR', 'PAGI', 'PAWR', 'PCTH', 'PCAR', 'PTHP',
  'PKPW', 'PKAC', 'PRBK', 'PPBK', 'PTAK', 'PBTK', 'PJMP', 'PINJ',
  'PSTA', 'PTGH', 'PTRK', 'PCOD', 'PBCV', 'PSTF', 'PSPM', 'PJUM',
  'PIBL', 'PRBP', 'PRBF', 'PPBP', 'PPBF', 'PLDB', 'PBRS', 'PTUP',
  'PPWM', 'PFNM', 'PBSH', 'PPUR', 'PPRC', 'PMCV', 'PZCV', 'PSPC',
  'PCIT', 'PSRR', 'PMRR', 'PDRR', 'PHTP', 'PPRS', 'PREL', 'PTAS',
  'PTAM', 'PTAD', 'PPLA', 'PTOR', 'PKRT'
];

export class RosterGeneratorService {
  private rosterData: Map<number, any[]> = new Map();
  private templateData: any = null;
  private initialized: boolean = false;
  private genericPIDs: number[] = [];

  /**
   * Initialize service: Load ROSTER_lookup.csv and template
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      console.log('[RosterGeneratorService] Already initialized');
      return;
    }

    console.log('[RosterGeneratorService] ===== INITIALIZING =====');

    // Load CSV data
    const csvPath = path.join(app.getAppPath(), 'data', 'lookups', 'ROSTER_lookup.csv');
    console.log('[RosterGeneratorService] Loading CSV from:', csvPath);

    if (!fs.existsSync(csvPath)) {
      throw new Error(`ROSTER_lookup.csv not found at: ${csvPath}`);
    }

    const csvContent = fs.readFileSync(csvPath, 'utf8');
    const parsed = Papa.parse(csvContent, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true
    });

    console.log('[RosterGeneratorService] Parsed', parsed.data.length, 'rows');

    // Group by year
    parsed.data.forEach((row: any) => {
      const year = Math.floor(row.Year);
      if (!this.rosterData.has(year)) {
        this.rosterData.set(year, []);
      }
      this.rosterData.get(year)!.push(row);
    });

    console.log('[RosterGeneratorService] Loaded data for', this.rosterData.size, 'years');
    console.log('[RosterGeneratorService] Year range:', Math.min(...this.rosterData.keys()), '-', Math.max(...this.rosterData.keys()));

    // Load template
    const templatePath = path.join(app.getAppPath(), 'data', 'Templates', 'ROSTER-Official');
    console.log('[RosterGeneratorService] Loading template from:', templatePath);

    if (!fs.existsSync(templatePath)) {
      throw new Error(`ROSTER-Official template not found at: ${templatePath}`);
    }

    this.templateData = await draftClassService.loadDraftClass(templatePath);
    console.log('[RosterGeneratorService] Template loaded, version:', this.templateData.data._version);
    console.log('[RosterGeneratorService] Template buffer size:', this.templateData.data._originalBuffer?.length || 0);

    // Load generic PIDs from PID_Portrait_Mapping.csv
    const pidMappingPath = path.join(app.getAppPath(), 'data', 'lookups', 'PID_Portrait_Mapping.csv');
    console.log('[RosterGeneratorService] Loading generic PIDs from:', pidMappingPath);

    if (fs.existsSync(pidMappingPath)) {
      const pidMappingContent = fs.readFileSync(pidMappingPath, 'utf8');
      const pidMappingParsed = Papa.parse(pidMappingContent, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: true
      });

      // Extract all PIDs where Type === 'generic'
      this.genericPIDs = pidMappingParsed.data
        .filter((row: any) => row.Type === 'generic')
        .map((row: any) => parseInt(row.PID))
        .filter((pid: number) => !isNaN(pid));

      console.log('[RosterGeneratorService] Loaded', this.genericPIDs.length, 'generic PIDs');
    } else {
      console.warn('[RosterGeneratorService] PID_Portrait_Mapping.csv not found, using fallback generic PIDs');
      // Fallback to basic set if file not found
      this.genericPIDs = [
        719, 721, 725, 727, 730, 731, 961, 2131, 2270, 2271,
        2325, 2373, 2546, 2547, 2583, 2586, 2587, 2589, 2591,
        2717, 2718, 2719, 2720, 2721, 2743, 2745, 2748, 2749,
        2751, 2753
      ];
    }

    this.initialized = true;
    console.log('[RosterGeneratorService] ===== INITIALIZATION COMPLETE =====');
  }

  /**
   * Generate roster based on options
   */
  async generate(options: RosterGeneratorOptions): Promise<GeneratedRoster> {
    if (!this.initialized) {
      await this.initialize();
    }

    console.log('[RosterGeneratorService] ===== GENERATE ROSTER =====');
    console.log('[RosterGeneratorService] Mode:', options.mode);
    console.log('[RosterGeneratorService] Options:', JSON.stringify(options));

    let players: RosterPlayer[];
    let metadata: any;

    if (options.mode === 'single-year') {
      if (!options.year) {
        throw new Error('Year is required for single-year mode');
      }
      const result = await this.generateSingleYear(options.year);
      players = result.players;
      metadata = result.metadata;
    } else if (options.mode === 'all-time') {
      if (!options.startYear || !options.endYear) {
        throw new Error('Start year and end year are required for all-time mode');
      }
      const result = await this.generateAllTime(options.startYear, options.endYear);
      players = result.players;
      metadata = result.metadata;
    } else {
      throw new Error(`Unsupported mode: ${options.mode}`);
    }

    console.log('[RosterGeneratorService] Generated', players.length, 'players');

    return {
      players,
      metadata,
      _originalBuffer: this.templateData.data._originalBuffer,
      _version: 'M26'
    };
  }

  /**
   * Generate single year roster
   */
  private async generateSingleYear(year: number): Promise<{ players: RosterPlayer[], metadata: any }> {
    console.log('[RosterGeneratorService] ===== GENERATING SINGLE YEAR =====');
    console.log('[RosterGeneratorService] Requested year:', year);

    const yearPlayers = this.rosterData.get(year) || [];
    if (yearPlayers.length === 0) {
      throw new Error(`No players found for year ${year}`);
    }

    console.log('[RosterGeneratorService] Found', yearPlayers.length, 'players for year', year);

    // Log first 3 players to verify correct year data
    if (yearPlayers.length > 0) {
      console.log('[RosterGeneratorService] Sample players from CSV:');
      yearPlayers.slice(0, 3).forEach((p, i) => {
        console.log(`  Player ${i + 1}: ${p.First_Name} ${p.Last_Name} - Year: ${p.Year}, Team: ${p.Season_Team}, PID: ${p.PID}, College: ${p.College}`);
      });
    }

    // Group players by team
    const teamPlayers = new Map<string, any[]>();
    yearPlayers.forEach(player => {
      const team = player.Season_Team || 'FA';
      if (!teamPlayers.has(team)) {
        teamPlayers.set(team, []);
      }
      teamPlayers.get(team)!.push(player);
    });

    console.log('[RosterGeneratorService] Found', teamPlayers.size, 'teams');
    console.log('[RosterGeneratorService] Teams:', Array.from(teamPlayers.keys()).slice(0, 10).join(', '), '...');

    // Build roster: top 55 players per team by POVR
    const roster: any[] = [];
    let totalTeams = 0;

    teamPlayers.forEach((players, team) => {
      // Sort by POVR and take top 55
      const teamRoster = players
        .sort((a, b) => (b.POVR || 0) - (a.POVR || 0))
        .slice(0, 55);

      roster.push(...teamRoster);
      totalTeams++;
      console.log(`[RosterGeneratorService] ${team}: ${teamRoster.length} players`);
    });

    console.log('[RosterGeneratorService] Total players across', totalTeams, 'teams:', roster.length);

    // Enrich all players
    const enrichedPlayers = await Promise.all(
      roster.map(p => this.enrichPlayer(p, year))
    );

    console.log('[RosterGeneratorService] Final roster size:', enrichedPlayers.length);

    // Log first 3 enriched players to verify field mapping
    if (enrichedPlayers.length > 0) {
      console.log('[RosterGeneratorService] Sample enriched players:');
      enrichedPlayers.slice(0, 3).forEach((p: any, i) => {
        console.log(`  Player ${i + 1}: ${p.PFNA} ${p.PLNA} - Team ID: ${p.TGID}, PID: ${p.PSXP}, College: ${p.PCOL}, State: ${p.PHSN}, Archetype: ${p.PLTY}`);
      });
    }

    return {
      players: enrichedPlayers,
      metadata: {
        mode: 'single-year',
        year: year,
        teams: totalTeams,
        generatedAt: new Date().toISOString(),
        playerCount: enrichedPlayers.length
      }
    };
  }

  /**
   * Generate all-time roster from year range
   */
  private async generateAllTime(startYear: number, endYear: number): Promise<{ players: RosterPlayer[], metadata: any }> {
    console.log('[RosterGeneratorService] Generating all-time roster for', startYear, '-', endYear);

    const allPlayers: any[] = [];

    // Collect all players from range
    for (let y = startYear; y <= endYear; y++) {
      const yearPlayers = this.rosterData.get(y) || [];
      allPlayers.push(...yearPlayers.map(p => ({ ...p, _year: y })));
    }

    if (allPlayers.length === 0) {
      throw new Error(`No players found in year range ${startYear}-${endYear}`);
    }

    console.log('[RosterGeneratorService] Found', allPlayers.length, 'total players in range');

    // Enrich all players
    const enrichedPlayers = await Promise.all(
      allPlayers.map(p => this.enrichPlayer(p, p._year))
    );

    // Select best by position with deduplication
    const selectedPlayers = this.selectBestByPosition(enrichedPlayers);
    console.log('[RosterGeneratorService] Selected', selectedPlayers.length, 'players after position limits');

    // Add KR specialist
    const withKR = this.addKRSpecialist(selectedPlayers, enrichedPlayers);
    console.log('[RosterGeneratorService] Added KR specialist, size:', withKR.length);

    // Add 3-4 best remaining
    const roster = this.addBestRemaining(withKR, enrichedPlayers, 3, 4);
    console.log('[RosterGeneratorService] Final roster size:', roster.length);

    return {
      players: roster,
      metadata: {
        mode: 'all-time',
        startYear: startYear,
        endYear: endYear,
        generatedAt: new Date().toISOString(),
        playerCount: roster.length
      }
    };
  }

  /**
   * Select best players by position with PID deduplication
   */
  private selectBestByPosition(players: RosterPlayer[]): RosterPlayer[] {
    console.log('[RosterGeneratorService] Selecting best by position...');

    // Step 1: Deduplicate by PID (keep highest POVR)
    const uniquePlayers = new Map<number, RosterPlayer>();
    players.forEach(p => {
      const existing = uniquePlayers.get(p.PSXP);
      if (!existing || p.POVR > existing.POVR) {
        uniquePlayers.set(p.PSXP, p);
      }
    });

    console.log('[RosterGeneratorService] Deduplicated:', players.length, '→', uniquePlayers.size);

    // Step 2: Apply position limits
    const roster: RosterPlayer[] = [];
    const deduped = Array.from(uniquePlayers.values());

    Object.entries(POSITION_LIMITS).forEach(([pos, limit]) => {
      const posPlayers = deduped
        .filter(p => (p as any)._position === pos)
        .sort((a, b) => b.POVR - a.POVR)
        .slice(0, limit);

      if (posPlayers.length > 0) {
        console.log(`[RosterGeneratorService]   ${pos}: ${posPlayers.length} players (limit ${limit})`);
      }

      roster.push(...posPlayers);
    });

    return roster;
  }

  /**
   * Add free agents to reach template size (single year mode)
   */
  private async addFreeAgents(year: number, currentRoster: RosterPlayer[]): Promise<RosterPlayer[]> {
    console.log('[RosterGeneratorService] Adding free agents...');

    const currentPIDs = new Set(currentRoster.map(p => p.PSXP));
    const freeAgents: RosterPlayer[] = [];

    // Look back 5 years
    for (let y = year - 5; y < year; y++) {
      const yearPlayers = this.rosterData.get(y) || [];
      const candidates = await Promise.all(
        yearPlayers.map(async (p: any) => {
          const enriched = await this.enrichPlayer(p, y);
          return enriched;
        })
      );

      const qualified = candidates.filter(p =>
        !currentPIDs.has(p.PSXP) &&
        p.PAGE < 40 &&
        p.POVR >= 65
      );

      freeAgents.push(...qualified);
    }

    console.log('[RosterGeneratorService] Found', freeAgents.length, 'free agent candidates');

    const targetSize = this.getTemplateRosterSize();
    const needed = targetSize - currentRoster.length;

    console.log('[RosterGeneratorService] Target size:', targetSize, '| Current:', currentRoster.length, '| Need:', needed);

    if (needed <= 0) {
      return currentRoster.slice(0, targetSize);
    }

    const bestFAs = freeAgents
      .sort((a, b) => b.POVR - a.POVR)
      .slice(0, needed);

    console.log('[RosterGeneratorService] Adding', bestFAs.length, 'free agents');

    return [...currentRoster, ...bestFAs];
  }

  /**
   * Add KR specialist (highest KR rating)
   */
  private addKRSpecialist(roster: RosterPlayer[], allPlayers: RosterPlayer[]): RosterPlayer[] {
    const usedPIDs = new Set(roster.map(p => p.PSXP));

    const krSpecialist = allPlayers
      .filter(p => !usedPIDs.has(p.PSXP) && p.PKRT > 0)
      .sort((a, b) => b.PKRT - a.PKRT)[0];

    if (krSpecialist) {
      console.log('[RosterGeneratorService] KR specialist:', krSpecialist.PFNA, krSpecialist.PLNA, '(KR:', krSpecialist.PKRT, ')');
      return [...roster, krSpecialist];
    }

    console.log('[RosterGeneratorService] No KR specialist found');
    return roster;
  }

  /**
   * Add 3-4 best remaining players by POVR
   */
  private addBestRemaining(roster: RosterPlayer[], allPlayers: RosterPlayer[], min: number, max: number): RosterPlayer[] {
    const usedPIDs = new Set(roster.map(p => p.PSXP));
    const targetSize = this.getTemplateRosterSize();
    const remaining = targetSize - roster.length;
    const count = Math.min(remaining, Math.max(min, Math.min(max, remaining)));

    const bestRemaining = allPlayers
      .filter(p => !usedPIDs.has(p.PSXP))
      .sort((a, b) => b.POVR - a.POVR)
      .slice(0, count);

    console.log('[RosterGeneratorService] Adding', bestRemaining.length, 'best remaining players');

    return [...roster, ...bestRemaining];
  }

  /**
   * Enrich player data from CSV row
   * The CSV already has most fields - we just need to map them to roster format
   */
  private async enrichPlayer(csvRow: any, year: number): Promise<RosterPlayer> {
    // Parse archetype to numeric (0-67)
    const archetype = await this.parseArchetype(csvRow.Archetype, csvRow.Position);

    // Map position string to position code (QB=0, HB=1, etc.)
    const positionCode = await this.lookupPositionCode(csvRow.Position);

    // Map team string to team code
    const teamCode = await this.lookupTeamCode(csvRow.Season_Team);

    // Fill missing ratings from CSV
    const ratings = this.fillMissingRatings(csvRow);

    // Handle PID/PAM - assign generic faces if PID is 0
    let playerPID = parseInt(csvRow.PID) || 0;
    let playerPAM = String(csvRow.PAM || '');

    if (playerPID === 0) {
      // Assign generic face for players without portraits
      playerPID = await this.assignGenericPID(csvRow.Position);
      playerPAM = ''; // Generic faces don't need PAM
    }

    // Map CSV field names to UPPERCASE roster editor field codes
    return {
      // Basic Info (use UPPERCASE field codes that app.js expects!)
      PFNA: csvRow.First_Name || '',  // First name
      PLNA: csvRow.Last_Name || '',   // Last name
      PPOS: positionCode,              // Position code (numeric)
      PJEN: parseInt(csvRow.Jersey) || 0,  // Jersey number
      PAGE: parseInt(csvRow.Age) || 25,     // Age
      PHGT: parseInt(csvRow.Height) || 72,  // Height in inches
      PWGT: Math.max(1, (parseInt(csvRow.Weight) || 200) - 159), // Weight stored as offset: real_weight - 159 (so 200lbs = 41)
      TGID: teamCode,                  // Team ID (numeric)

      // IDs - Use processed PID/PAM (generic if original was 0)
      PSXP: playerPID,       // Player ID (PID) - Generic face if CSV had 0
      PLPL: playerPAM,        // Player Asset (PAM) - Empty for generic faces
      PEPS: playerPAM,        // Equipment - same as PAM

      // College & Home - LOOKUP from CSV strings
      PCOL: await this.lookupCollege(csvRow.College), // College is string, needs lookup
      PHSN: await this.lookupState(csvRow.College), // Infer state from college

      // Ratings (all numeric - already using correct field codes)
      POVR: parseInt(ratings.POVR) || 50,
      PSPD: parseInt(ratings.PSPD) || 50,
      PACC: parseInt(ratings.PACC) || 50,
      PSTR: parseInt(ratings.PSTR) || 50,
      PAGI: parseInt(ratings.PAGI) || 50,
      PAWR: parseInt(ratings.PAWR) || 50,
      PCTH: parseInt(ratings.PCTH) || 50,
      PCAR: parseInt(ratings.PCAR) || 50,
      PTHP: parseInt(ratings.PTHP) || 50,
      PKPW: parseInt(ratings.PKPW) || 50,
      PKAC: parseInt(ratings.PKAC) || 50,
      PRBK: parseInt(ratings.PRBK) || 50,
      PPBK: parseInt(ratings.PPBK) || 50,
      PTAK: parseInt(ratings.PTAK) || 50,
      PBTK: parseInt(ratings.PBTK) || 50,
      PJMP: parseInt(ratings.PJMP) || 50,
      PINJ: parseInt(ratings.PINJ) || 50,
      PSTA: parseInt(ratings.PSTA) || 50,
      PTGH: parseInt(ratings.PTGH) || 50,
      PTRK: parseInt(ratings.PTRK) || 50,
      PCOD: parseInt(ratings.PCOD) || 50,
      PBCV: parseInt(ratings.PBCV) || 50,
      PSTF: parseInt(ratings.PSTF) || 50,
      PSPM: parseInt(ratings.PSPM) || 50,
      PJUM: parseInt(ratings.PJUM) || 50,
      PIBL: parseInt(ratings.PIBL) || 50,
      PRBP: parseInt(ratings.PRBP) || 50,
      PRBF: parseInt(ratings.PRBF) || 50,
      PPBP: parseInt(ratings.PPBP) || 50,
      PPBF: parseInt(ratings.PPBF) || 50,
      PLDB: parseInt(ratings.PLDB) || 50,
      PBRS: parseInt(ratings.PBRS) || 50,
      PTUP: parseInt(ratings.PTUP) || 50,
      PPWM: parseInt(ratings.PPWM) || 50,
      PFNM: parseInt(ratings.PFNM) || 50,
      PBSH: parseInt(ratings.PBSH) || 50,
      PPUR: parseInt(ratings.PPUR) || 50,
      PPRC: parseInt(ratings.PPRC) || 50,
      PMCV: parseInt(ratings.PMCV) || 50,
      PZCV: parseInt(ratings.PZCV) || 50,
      PSPC: parseInt(ratings.PSPC) || 50,
      PCIT: parseInt(ratings.PCIT) || 50,
      PSRR: parseInt(ratings.PSRR) || 50,
      PMRR: parseInt(ratings.PMRR) || 50,
      PDRR: parseInt(ratings.PDRR) || 50,
      PHTP: parseInt(ratings.PHTP) || 50,
      PPRS: parseInt(ratings.PPRS) || 50,
      PREL: parseInt(ratings.PREL) || 50,
      PTAS: parseInt(ratings.PTAS) || 50,
      PTAM: parseInt(ratings.PTAM) || 50,
      PTAD: parseInt(ratings.PTAD) || 50,
      PPLA: parseInt(ratings.PPLA) || 50,
      PTOR: parseInt(ratings.PTOR) || 50,
      PKRT: parseInt(ratings.PKRT) || 50,

      // Metadata
      PLTY: parseInt(archetype) || 0,  // Archetype ID (PLTY, not PTAR!)
      PTAR: this.determineBodyType(csvRow),  // Body type (PTAR is actually body type, not archetype!)
      PYRP: parseInt(csvRow.Years_Pro ?? csvRow.YearsPro ?? 0),  // Years pro (CSV has both columns)
      PDEV: this.determineDevTrait(parseInt(ratings.POVR) || 50),  // Dev trait

      // Source data (for internal tracking - keep original string values for filtering)
      _year: year,
      _sourceTeam: csvRow.Season_Team || '',
      _position: csvRow.Position || ''  // Store position string for filtering
    };
  }

  /**
   * Fill missing or zero ratings with 30-50 range + variance
   */
  private fillMissingRatings(csvRow: any): any {
    const ratings: any = { POVR: csvRow.POVR || 50 };

    RATING_FIELDS.forEach(field => {
      const value = csvRow[field];

      if (value === null || value === undefined || value === 0 || value === '') {
        // Apply 30-50 range with variance
        const base = 30;
        const range = 20;
        const variance = Math.random() * range;
        ratings[field] = Math.round(base + variance);
      } else {
        ratings[field] = value;
      }
    });

    return ratings;
  }

  /**
   * Parse archetype to numeric using M26 GLOBAL archetype IDs (0-67)
   * Maps archetype names from CSV to the global M26 archetype system
   */
  private async parseArchetype(archetypeValue: any, position: string): Promise<number> {
    // Import ArchetypeService dynamically
    const { ArchetypeService } = await import('./utils/archetypeService');

    // If already numeric, validate range (0-67 for M26)
    if (typeof archetypeValue === 'number') {
      if (archetypeValue >= 0 && archetypeValue <= 67) {
        // Verify it's valid for the position
        if (ArchetypeService.isValidArchetypeIdForPosition(archetypeValue, position)) {
          return archetypeValue;
        }
      }
      console.warn('[RosterGeneratorService] Invalid archetype number:', archetypeValue, '- using position default');
      return this.getDefaultArchetype(position);
    }

    // If string, try to map it using ArchetypeService
    // The CSV contains simplified names like "Field General", "Elusive Back", etc.
    // ArchetypeService.getArchetypeId() can handle both simplified and full names
    if (typeof archetypeValue === 'string' && archetypeValue.trim() !== '') {
      try {
        const archetypeId = ArchetypeService.getArchetypeId(archetypeValue.trim(), position);
        if (archetypeId !== 0 || archetypeValue.trim() === 'QB Field General') {
          return archetypeId;
        }
      } catch (error) {
        console.warn('[RosterGeneratorService] Archetype lookup failed for:', archetypeValue, error);
      }
    }

    // Fallback to position default
    return this.getDefaultArchetype(position);
  }

  /**
   * Get default archetype for a position (fallback when no archetype data in CSV)
   * Uses GLOBAL archetype IDs 0-67 from M26 archetype system
   * IMPORTANT: These are the actual M26 file format IDs, NOT the simplified archetype_lookup.csv IDs
   */
  private getDefaultArchetype(position: string): number {
    const defaults: Record<string, number> = {
      // Offense - QB (0-4)
      'QB': 0,      // QB Field General

      // Offense - HB (5-11)
      'HB': 6,      // HB Elusive Back
      'FB': 12,     // FB Blocking

      // Offense - WR (14-21)
      'WR': 15,     // WR Playmaker

      // Offense - TE (22-26)
      'TE': 23,     // TE Vertical Threat

      // Offense - OL
      'LT': 31,     // OT Pass Protector
      'LG': 35,     // G Pass Protector
      'C': 27,      // C Pass Protector
      'RG': 35,     // G Pass Protector
      'RT': 31,     // OT Pass Protector

      // Defense - DL (39-46)
      'LEDG': 39,   // DE Smaller Speed Rusher
      'REDG': 39,   // DE Smaller Speed Rusher
      'LE': 39,     // DE Smaller Speed Rusher
      'RE': 39,     // DE Smaller Speed Rusher
      'DE': 39,     // DE Smaller Speed Rusher
      'DT': 46,     // DT Power Rusher

      // Defense - LB (47-53)
      'LOLB': 47,   // OLB Speed Rusher
      'ROLB': 47,   // OLB Speed Rusher
      'OLB': 47,    // OLB Speed Rusher
      'MLB': 51,    // MLB Field General
      'WILL': 49,   // OLB Pass Coverage
      'Mike': 51,   // MLB Field General
      'SAM': 50,    // OLB Run Stopper
      'LLB': 47,    // OLB Speed Rusher
      'RLB': 47,    // OLB Speed Rusher
      'ILB': 51,    // MLB Field General
      'LB': 51,     // MLB Field General

      // Defense - Secondary (54-60)
      'CB': 54,     // CB Man-to-Man
      'FS': 58,     // S Zone
      'SS': 58,     // S Zone
      'S': 58,      // S Zone
      'DB': 54,     // CB Man-to-Man

      // Special Teams (61-66)
      'K': 61,      // KP Accurate
      'P': 61,      // KP Accurate
      'KR': 63,     // KR Balanced
      'PR': 64,     // PR Balanced
      'LS': 66      // LS Accurate
    };

    const archetypeId = defaults[position];
    if (archetypeId !== undefined) {
      return archetypeId;
    }

    // Fallback by position group
    if (position.includes('OL') || position.includes('G') || position.includes('T')) {
      return 35; // G Pass Protector
    } else if (position.includes('LB')) {
      return 51; // MLB Field General
    } else if (position.includes('DT') || position.includes('DE') || position.includes('EDG')) {
      return 39; // DE Smaller Speed Rusher
    } else if (position.includes('CB') || position.includes('S')) {
      return 54; // CB Man-to-Man
    }

    // Ultimate fallback - QB Field General
    return 0;
  }

  /**
   * Assign generic PID for player without portrait
   */
  private async assignGenericPID(position: string): Promise<number> {
    // Use loaded generic PIDs (5600+ faces)
    if (this.genericPIDs.length === 0) {
      console.warn('[RosterGeneratorService] No generic PIDs loaded, returning default');
      return 719; // Fallback to a known generic PID
    }

    // Randomly select a generic face
    const randomIndex = Math.floor(Math.random() * this.genericPIDs.length);
    return this.genericPIDs[randomIndex];
  }

  /**
   * Assign generic PAM for player without portrait
   */
  private async assignGenericPAM(position: string): Promise<string> {
    // Generic players don't need PAM (handled by PID)
    return '';
  }

  /**
   * Lookup college ID from name
   * Handles abbreviated names from CSV (e.g., "Appalach. St." -> "Appalachian State")
   */
  private async lookupCollege(collegeName: string): Promise<number> {
    if (!collegeName || collegeName.trim() === '') {
      return 265; // No College
    }

    const cleanName = collegeName.trim();

    try {
      // First try direct lookup using lookupService
      const collegeId = lookupService.getNumericId('college_lookup.csv', cleanName);
      if (collegeId !== -1) {
        return collegeId;
      }

      // If direct lookup fails, try fuzzy matching for abbreviated names
      const options = await lookupService.getDropdownOptions('college_lookup.csv');

      // Try case-insensitive exact match
      let match = options.find((opt: any) => opt.name.toLowerCase() === cleanName.toLowerCase());
      if (match) {
        return match.id;
      }

      // Try fuzzy matching for common abbreviations
      const abbreviationMap: Record<string, string> = {
        'Appalach. St.': 'Appalachian State',
        'App State': 'Appalachian State',
        'Bowling Green': 'Bowling Green State',
        'Central Mich.': 'Central Michigan',
        'E. Carolina': 'East Carolina',
        'E. Illinois': 'Eastern Illinois',
        'E. Kentucky': 'Eastern Kentucky',
        'E. Michigan': 'Eastern Michigan',
        'E. Washington': 'Eastern Washington',
        'Fla. Atlantic': 'Florida Atlantic',
        'Fla. Intl': 'Florida International',
        'Ga. Southern': 'Georgia Southern',
        'LA Monroe': 'Louisiana Monroe',
        'LA Tech': 'Louisiana Tech',
        'LA-Lafayette': 'Louisiana-Lafayette',
        'Mass.': 'Massachusetts',
        'McNeese St.': 'McNeese State',
        'Miss. State': 'Mississippi State',
        'N.C. State': 'North Carolina State',
        'N. Carolina': 'North Carolina',
        'N. Illinois': 'Northern Illinois',
        'N. Iowa': 'Northern Iowa',
        'San Diego St.': 'San Diego State',
        'S. Carolina': 'South Carolina',
        'S. Illinois': 'Southern Illinois',
        'S. Methodist': 'Southern Methodist',
        'S. Mississippi': 'Southern Mississippi',
        'Southern Miss': 'Southern Mississippi',
        'TCU': 'Texas Christian',
        'Texas-San Antonio': 'UT-San Antonio',
        'Tx Southern': 'Texas Southern',
        'UL Monroe': 'Louisiana Monroe',
        'ULL': 'Louisiana-Lafayette',
        'ULM': 'Louisiana Monroe',
        'UNLV': 'Nevada-Las Vegas',
        'USC': 'Southern California',
        'UTEP': 'Texas-El Paso',
        'W. Carolina': 'Western Carolina',
        'W. Illinois': 'Western Illinois',
        'W. Kentucky': 'Western Kentucky',
        'W. Michigan': 'Western Michigan',
        'Wash. State': 'Washington State'
      };

      const mappedName = abbreviationMap[cleanName];
      if (mappedName) {
        match = options.find((opt: any) => opt.name.toLowerCase() === mappedName.toLowerCase());
        if (match) {
          return match.id;
        }
      }

      // Try partial matching (contains)
      match = options.find((opt: any) =>
        opt.name.toLowerCase().includes(cleanName.toLowerCase()) ||
        cleanName.toLowerCase().includes(opt.name.toLowerCase())
      );
      if (match) {
        return match.id;
      }

      console.warn(`[RosterGeneratorService] College not found in lookup: "${collegeName}"`);
      return 265; // No College
    } catch (error) {
      console.warn('[RosterGeneratorService] College lookup failed:', collegeName, error);
      return 265;
    }
  }

  /**
   * Lookup home state based on college (simplified mapping)
   * Maps college name to a reasonable home state
   */
  private async lookupState(collegeName: string): Promise<number> {
    if (!collegeName || collegeName === '') {
      return 5; // California (default)
    }

    // Simple college-to-state mapping (partial, expand as needed)
    const COLLEGE_STATE_MAP: Record<string, string> = {
      // Major conferences
      'Alabama': 'Alabama',
      'Auburn': 'Alabama',
      'Florida': 'Florida',
      'Florida State': 'Florida',
      'Miami': 'Florida',
      'Georgia': 'Georgia',
      'Georgia Tech': 'Georgia',
      'LSU': 'Louisiana',
      'Texas': 'Texas',
      'Texas A&M': 'Texas',
      'Oklahoma': 'Oklahoma',
      'USC': 'California',
      'UCLA': 'California',
      'Stanford': 'California',
      'California': 'California',
      'Ohio State': 'Ohio',
      'Michigan': 'Michigan',
      'Penn State': 'Pennsylvania',
      'Notre Dame': 'Indiana',
      'Clemson': 'South Carolina',
      'Tennessee': 'Tennessee',
      'Kentucky': 'Kentucky',
      'Louisville': 'Kentucky',
      'Virginia': 'Virginia',
      'Virginia Tech': 'Virginia',
      'North Carolina': 'North Carolina',
      'Duke': 'North Carolina',
      'Oregon': 'Oregon',
      'Washington': 'Washington',
      'Wisconsin': 'Wisconsin',
      'Iowa': 'Iowa',
      'Nebraska': 'Nebraska',
      'Kansas': 'Kansas',
      'Kansas State': 'Kansas',
      'Colorado': 'Colorado',
      'Arizona': 'Arizona',
      'Arizona State': 'Arizona',
      'Utah': 'Utah'
    };

    const stateName = COLLEGE_STATE_MAP[collegeName];
    if (stateName) {
      try {
        const options = await lookupService.getDropdownOptions('state_lookup.csv');
        const match = options.find((opt: any) => opt.name === stateName);
        if (match) {
          return match.id;
        }
      } catch (error) {
        console.warn('[RosterGeneratorService] State lookup failed:', stateName, error);
      }
    }

    // Default to California if no mapping found
    return 5;
  }

  /**
   * Lookup position code from position string (handles old position names)
   */
  private async lookupPositionCode(positionName: string): Promise<number> {
    if (!positionName || positionName === '') {
      return 0; // Default to QB
    }

    // Map old/alternate position names to M26 positions
    const POSITION_MAP: Record<string, string> = {
      // Offense
      'QB': 'QB',
      'HB': 'HB',
      'RB': 'HB',
      'FB': 'FB',
      'WR': 'WR',
      'FL': 'WR',  // Flanker
      'SE': 'WR',  // Split End
      'TE': 'TE',
      'LT': 'LT',
      'LG': 'LG',
      'C': 'C',
      'RG': 'RG',
      'RT': 'RT',
      'G': 'LG',   // Generic Guard
      'T': 'LT',   // Generic Tackle

      // Defense - Edge
      'LEDG': 'LEDG',
      'REDG': 'REDG',
      'LDE': 'LEDG',  // Left Defensive End
      'RDE': 'REDG',  // Right Defensive End
      'DE': 'LEDG',   // Generic DE
      'LE': 'LEDG',
      'RE': 'REDG',

      // Defense - DT
      'DT': 'DT',
      'LDT': 'DT',
      'RDT': 'DT',
      'NT': 'DT',    // Nose Tackle
      'MG': 'DT',    // Middle Guard

      // Defense - LB
      'SAM': 'SAM',      // Strongside
      'Mike': 'Mike',    // Middle
      'WILL': 'WILL',    // Weakside
      'MLB': 'Mike',     // Middle Linebacker
      'LOLB': 'WILL',    // Left Outside = Weakside
      'ROLB': 'SAM',     // Right Outside = Strongside
      'LLB': 'WILL',     // Left Linebacker
      'RLB': 'SAM',      // Right Linebacker
      'LB': 'Mike',      // Generic LB
      'OLB': 'WILL',     // Generic Outside LB
      'ILB': 'Mike',     // Inside LB

      // Defense - Secondary
      'CB': 'CB',
      'LCB': 'CB',   // Left Cornerback
      'RCB': 'CB',   // Right Cornerback
      'DB': 'CB',    // Generic Defensive Back
      'FS': 'FS',
      'SS': 'SS',
      'S': 'FS',     // Generic Safety

      // Special Teams
      'K': 'K',
      'P': 'P',
      'KR': 'HB',    // Kick Returner -> HB
      'PR': 'WR',    // Punt Returner -> WR
      'LS': 'C'      // Long Snapper -> C
    };

    // Normalize position (take first position if slash-separated)
    const normalized = positionName.split('/')[0].trim();
    const mappedPosition = POSITION_MAP[normalized] || normalized;

    try {
      const options = await lookupService.getDropdownOptions('position_lookup.csv');
      const match = options.find((opt: any) => opt.name === mappedPosition);

      if (!match) {
        console.warn('[RosterGeneratorService] Unknown position:', positionName, '-> normalized:', normalized, '-> mapped:', mappedPosition);
        return 0; // Default to QB
      }

      return match.id;
    } catch (error) {
      console.warn('[RosterGeneratorService] Position lookup failed:', positionName, error);
      return 0;
    }
  }

  /**
   * Lookup team code from team name using team_lookup.csv
   */
  private async lookupTeamCode(teamName: string): Promise<number> {
    if (!teamName || teamName === '') {
      return 32; // Default to Texans
    }

    // Map CSV team names to team_lookup.csv names
    // CSV has mix of abbreviations, full names, and short names
    const TEAM_NAME_MAP: Record<string, string> = {
      // Abbreviations
      'ARI': 'Cards',
      'ATL': 'Falcons',
      'BAL': 'Ravens',
      'BUF': 'Bills',
      'CAR': 'Panthers',
      'CHI': 'Bears',
      'CIN': 'Bengals',
      'CLE': 'Browns',
      'DAL': 'Cowboys',
      'DEN': 'Broncos',
      'DET': 'Lions',
      'GB': 'Packers',
      'GNB': 'Packers',
      'HOU': 'Texans',
      'IND': 'Colts',
      'JAC': 'Jags',
      'JAX': 'Jags',
      'KC': 'Cheifs',
      'KAN': 'Cheifs',
      'LAC': 'Chargers',
      'LAR': 'Rams',
      'LA': 'Rams',
      'LV': 'Raiders',
      'OAK': 'Raiders',
      'MIA': 'Dolphins',
      'MIN': 'Vikings',
      'NE': 'Patriots',
      'NWE': 'Patriots',
      'NO': 'Saints',
      'NOR': 'Saints',
      'NYG': 'Giants',
      'NYJ': 'Jets',
      'PHI': 'Eagles',
      'PIT': 'Steelers',
      'SD': 'Chargers',
      'SDG': 'Chargers',
      'SF': '49ers',
      'SFO': '49ers',
      'SEA': 'Seahawks',
      'TB': 'Buccs',
      'TAM': 'Buccs',
      'TEN': 'Titans',
      'WAS': 'Commanders',
      'WSH': 'Commanders',

      // Full names with city
      'Arizona Cardinals': 'Cards',
      'Arizona Cardinals (1)': 'Cards',
      'Atlanta Falcons': 'Falcons',
      'Baltimore Ravens': 'Ravens',
      'Buffalo Bills': 'Bills',
      'Buffalo Bills (Madden Nfl 2005)': 'Bills',
      'Carolina Panthers': 'Panthers',
      'Chicago Bears': 'Bears',
      'Cincinnati Bengals': 'Bengals',
      'Cleveland Browns': 'Browns',
      'Dallas Cowboys': 'Cowboys',
      'Denver Broncos': 'Broncos',
      'Detroit Lions': 'Lions',
      'Green Bay Packers': 'Packers',
      'Houston Texans': 'Texans',
      'Indianapolis Colts': 'Colts',
      'Jacksonville Jaguars': 'Jags',
      'Kansas City Chiefs': 'Cheifs',
      'Las Vegas Raiders': 'Raiders',
      'Los Angeles Chargers': 'Chargers',
      'Los Angeles Rams': 'Rams',
      'Miami Dolphins': 'Dolphins',
      'Minnesota Vikings': 'Vikings',
      'New England Patriots': 'Patriots',
      'New Orleans Saints': 'Saints',
      'New York Giants': 'Giants',
      'New York Jets': 'Jets',
      'Oakland Raiders': 'Raiders',
      'Philadelphia Eagles': 'Eagles',
      'Pittsburgh Steelers': 'Steelers',
      'San Diego Chargers': 'Chargers',
      'San Francisco 49ers': '49ers',
      'Seattle Seahawks': 'Seahawks',
      'Tampa Bay Buccaneers': 'Buccs',
      'Tennessee Titans': 'Titans',
      'Washington Commanders': 'Commanders',
      'Washington Redskins': 'Commanders',

      // Short names (just team name)
      'Cardinals': 'Cards',
      'Falcons': 'Falcons',
      'Ravens': 'Ravens',
      'Bills': 'Bills',
      'Panthers': 'Panthers',
      'Bears': 'Bears',
      'Bengals': 'Bengals',
      'Browns': 'Browns',
      'Cowboys': 'Cowboys',
      'Broncos': 'Broncos',
      'Lions': 'Lions',
      'Packers': 'Packers',
      'Texans': 'Texans',
      'Colts': 'Colts',
      'Jaguars': 'Jags',
      'Jags': 'Jags',
      'Chiefs': 'Cheifs',
      'Cheifs': 'Cheifs',  // Handle misspelling
      'Raiders': 'Raiders',
      'Chargers': 'Chargers',
      'Rams': 'Rams',
      'Dolphins': 'Dolphins',
      'Vikings': 'Vikings',
      'Patriots': 'Patriots',
      'Saints': 'Saints',
      'Giants': 'Giants',
      'Jets': 'Jets',
      'Eagles': 'Eagles',
      'Steelers': 'Steelers',
      '49ers': '49ers',
      'Seahawks': 'Seahawks',
      'Buccaneers': 'Buccs',
      'Buccs': 'Buccs',
      'Titans': 'Titans',
      'Commanders': 'Commanders',
      'Redskins': 'Commanders'
    };

    try {
      const cleanName = teamName.trim();

      // Try mapping first (handles all variations)
      const mappedName = TEAM_NAME_MAP[cleanName] || TEAM_NAME_MAP[cleanName.toUpperCase()];
      if (mappedName) {
        const teamId = lookupService.getNumericId('team_lookup.csv', mappedName);
        if (teamId !== -1) {
          return teamId;
        }
      }

      // Try direct lookup as fallback
      const teamId = lookupService.getNumericId('team_lookup.csv', cleanName);
      if (teamId !== -1) {
        return teamId;
      }
    } catch (error) {
      console.warn('[RosterGeneratorService] Team lookup failed for:', teamName, error);
    }

    console.warn(`[RosterGeneratorService] Unknown team name: "${teamName}" - defaulting to Free Agents`);
    return 32; // Free Agents if not found
  }

  /**
   * Determine body type based on position and weight
   */
  private determineBodyType(csvRow: any): string {
    const weight = csvRow.Weight || 200;
    const position = csvRow.Position || '';

    // Simplified body type logic
    if (['QB', 'WR', 'CB', 'FS', 'SS'].includes(position)) {
      return weight < 200 ? 'Lean' : 'Athletic';
    } else if (['RB', 'LB', 'MLB', 'Will', 'Sam'].includes(position)) {
      return weight < 220 ? 'Athletic' : 'Stocky';
    } else {
      return weight < 280 ? 'Stocky' : 'Heavy';
    }
  }

  /**
   * Determine dev trait based on POVR
   */
  private determineDevTrait(povr: number): number {
    if (povr >= 90) return 3; // X-Factor
    if (povr >= 85) return 2; // Superstar
    if (povr >= 80) return 1; // Star
    return 0; // Normal
  }

  /**
   * Get template roster size
   */
  private getTemplateRosterSize(): number {
    // Try to get actual size from loaded template
    if (this.templateData && this.templateData.data && this.templateData.data.prospects) {
      const templateSize = this.templateData.data.prospects.length;
      console.log('[RosterGeneratorService] Template has', templateSize, 'player slots');
      return templateSize;
    }

    // Fallback to typical roster size
    console.log('[RosterGeneratorService] Using fallback roster size: 3000');
    return 3000; // Typical full roster with FA pool
  }

  /**
   * Validate year availability
   */
  async validateYear(year: number): Promise<{ valid: boolean, error?: string, playerCount?: number }> {
    if (!this.initialized) {
      await this.initialize();
    }

    const players = this.rosterData.get(year);
    if (!players || players.length === 0) {
      return {
        valid: false,
        error: `No players found for year ${year}`
      };
    }

    return {
      valid: true,
      playerCount: players.length
    };
  }

  /**
   * Get available years
   */
  async getAvailableYears(): Promise<number[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    return Array.from(this.rosterData.keys()).sort((a, b) => a - b);
  }
}

// Singleton instance
export const rosterGeneratorService = new RosterGeneratorService();
