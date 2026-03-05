/**
 * Player Data Service
 *
 * Centralized service for loading and caching player data from CSV files.
 * Provides access to:
 * - Historical NFL draft data (1936-2025) from ALL_PLAYER_LOOKUP.csv
 * - Future college prospects (2026+) from FutureDraft_Lookup_MERGED.csv
 * - Rookie stats and career data from ROSTER_lookup.csv
 */

import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

// ===========================
// INTERFACES
// ===========================

/**
 * Player record from ALL_PLAYER_LOOKUP.csv (Historical NFL 1936-2025)
 */
export interface HistoricalPlayer {
  lastName: string;
  firstName: string;
  college: string;
  round: string;                // e.g., "1", "2", "UD" for undrafted
  pick: string;                 // e.g., "1", "15", "UD"
  draftClass: number;           // Year drafted (1936-2025)
  position: string;             // e.g., "QB", "HB", "WR"
  jersey?: string;
  photoID?: number;             // PID
  playerAssetsID?: string;      // PAM
  commID?: string;
  plpo?: string;                // Portrait key
  height?: number;              // Inches
  weight?: number;              // Pounds
  from?: number;                // Career start year
  to?: number;                  // Career end year
  ap1?: number;                 // All-Pro First Team selections
  pb?: number;                  // Pro Bowl selections
  st?: number;                  // Seasons
  wAV?: number;                 // Weighted Approximate Value
  league?: string;              // "NFL" or "AFL"
  race?: string;
  hometown?: string;            // City from "City, State" format
  homeState?: string;           // State from "City, State" format
  wikiImageURL?: string;
  pfrImageURL?: string;
  isHOF?: boolean;              // Hall of Fame
  archetype?: string;           // Will be assigned by ArchetypeAssigner
  archetypeDetailed?: number;   // Will be assigned by ArchetypeAssigner
}

/**
 * Future prospect from FutureDraft_Lookup_MERGED.csv (2026+)
 */
export interface FutureProspect {
  lastName: string;
  firstName: string;
  college: string;
  rank?: number;                // Overall draft rank
  draftClass: number;           // Year (2026+)
  position: string;
  jersey?: number;
  height?: number;              // Inches
  weight?: number;              // Pounds
  class?: string;               // Fr., So., Jr., Sr.
  wAV?: number;                 // Projected value (50-70 range)
  hometown?: string;
  homestate?: string;
  race?: string;
  photo?: string;
  archetype?: string;           // Simplified archetype (e.g., "Run Stopper")
  archetypeDetailed?: string;   // Full archetype (e.g., "MLB Run Stopper")
}

/**
 * Rookie stats from ROSTER_lookup.csv (player-year data)
 */
export interface RookieStats {
  year: number;
  seasonTeam?: string;
  playerName: string;
  firstName: string;
  lastName: string;
  position: string;
  jersey?: number;
  age?: number;
  pid?: number;
  pam?: string;
  college?: string;
  height?: number;
  weight?: number;
  povr?: number;                // Overall rating
  av?: number;                  // Approximate Value (rookie year performance)
  archetype?: string;           // Simplified archetype
  // All Madden ratings (99 attributes)
  pspd?: number;                // Speed
  pacc?: number;                // Acceleration
  pstr?: number;                // Strength
  pagi?: number;                // Agility
  pawr?: number;                // Awareness
  pcth?: number;                // Catching
  pcar?: number;                // Carrying
  pthp?: number;                // Throw Power
  pkpw?: number;                // Kick Power
  pkac?: number;                // Kick Accuracy
  pkrt?: number;                // Kick Return
  prbk?: number;                // Run Block
  ppbk?: number;                // Pass Block
  ptak?: number;                // Tackling
  pbtk?: number;                // Block Shedding
  pjmp?: number;                // Jumping
  pinj?: number;                // Injury
  psta?: number;                // Stamina
  ptgh?: number;                // Toughness
  ptrk?: number;                // Trucking
  pcod?: number;                // ???
  pbcv?: number;                // Ball Carrier Vision
  pstf?: number;                // Stiff Arm
  pspm?: number;                // Spin Move
  pjum?: number;                // Juke Move
  pibl?: number;                // Impact Blocking
  prbp?: number;                // Run Block Power
  prbf?: number;                // Run Block Finesse
  ppbp?: number;                // Pass Block Power
  ppbf?: number;                // Pass Block Finesse
  pldb?: number;                // Lead Block
  pbrs?: number;                // Break Sack
  ptup?: number;                // Throw Under Pressure
  ppwm?: number;                // Power Moves
  pfnm?: number;                // Finesse Moves
  pbsh?: number;                // Block Shed
  ppur?: number;                // Pursuit
  pprc?: number;                // Play Recognition
  pmcv?: number;                // Man Coverage
  pzcv?: number;                // Zone Coverage
  pspc?: number;                // Spectacular Catch
  pcit?: number;                // Catch in Traffic
  psrr?: number;                // Short Route Running
  pmrr?: number;                // Medium Route Running
  pdrr?: number;                // Deep Route Running
  phtp?: number;                // Hit Power
  pprs?: number;                // Press
  prel?: number;                // Release
  ptas?: number;                // Throw Accuracy Short
  ptam?: number;                // Throw Accuracy Mid
  ptad?: number;                // Throw Accuracy Deep
  ppla?: number;                // Play Action
  ptor?: number;                // Throw on Run
  birthDate?: string;
  yearsPro?: string;            // "Rook" or number
  handedness?: string;
  fortyYd?: number;             // 40-yard dash time
  vertical?: number;
  bench?: number;
  broadJump?: number;
  threeCone?: number;
  shuttle?: number;
  draftYear?: number;
  games?: number;
  gamesStarted?: number;
  av?: number;                  // Approximate Value (single season)
  devTrait?: string;            // "Normal", "Star", "Superstar", "X-Factor"
  archetypeDetailed?: number;   // Numeric archetype ID (0-67)
}

/**
 * Union type for any player record
 */
export type PlayerRecord = HistoricalPlayer | FutureProspect;

// ===========================
// SERVICE
// ===========================

export class PlayerDataService {
  private historicalPlayersCache: Map<number, HistoricalPlayer[]> = new Map();
  private futureProspectsCache: Map<number, FutureProspect[]> = new Map();
  private rosterLookupCache: Map<string, RookieStats[]> = new Map(); // Key: "PlayerName_Year"
  private teamYearCache: Map<string, RookieStats[]> = new Map(); // Key: "Team_Year" e.g. "Oilers_1992"
  private allHistoricalPlayers: HistoricalPlayer[] = [];
  private allFutureProspects: FutureProspect[] = [];
  private isInitialized: boolean = false;

  // Map PFR team abbreviations to team names in ROSTER_lookup.csv
  private static readonly TEAM_NAME_MAP: { [key: string]: string } = {
    'oti': 'Oilers',     // Houston Oilers (1960-1996) -> Tennessee Titans
    'crd': 'Cardinals',  // Arizona Cardinals
    'atl': 'Falcons',
    'rav': 'Ravens',
    'buf': 'Bills',
    'car': 'Panthers',
    'chi': 'Bears',
    'cin': 'Bengals',
    'cle': 'Browns',
    'dal': 'Cowboys',
    'den': 'Broncos',
    'det': 'Lions',
    'gnb': 'Packers',
    'htx': 'Texans',     // Houston Texans (2002+)
    'clt': 'Colts',
    'jax': 'Jaguars',
    'kan': 'Chiefs',
    'sdg': 'Chargers',
    'ram': 'Rams',
    'rai': 'Raiders',
    'mia': 'Dolphins',
    'min': 'Vikings',
    'nwe': 'Patriots',
    'nor': 'Saints',
    'nyg': 'Giants',
    'nyj': 'Jets',
    'phi': 'Eagles',
    'pit': 'Steelers',
    'sea': 'Seahawks',
    'sfo': '49ers',
    'tam': 'Buccaneers',
    'was': 'Commanders', // Also handles 'Redskins' via getTeamNameVariants
  };

  constructor() {
    // Do NOT initialize here - initialization is async and must be awaited
    // Initialize on first use instead (lazy initialization)
  }

  /**
   * Normalize player name for consistent lookups
   * Removes periods, extra whitespace, and converts to lowercase
   */
  private normalizeName(name: string): string {
    return name
      .replace(/\./g, '')  // Remove all periods
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim()
      .toLowerCase();
  }

  /**
   * Resolve file path for packaged vs dev environment
   */
  private resolveDataPath(...segments: string[]): string {
    // In packaged app, files are in .vite/build/data/lookups/
    // In dev mode, files are directly in data/lookups/
    const basePath = app.isPackaged
      ? path.join(app.getAppPath(), '.vite', 'build', 'data', 'lookups')
      : path.join(app.getAppPath(), 'data', 'lookups');
    const resolvedPath = path.join(basePath, ...segments);
    console.log(`[PlayerDataService] Resolved path (packaged=${app.isPackaged}): ${resolvedPath}`);
    return resolvedPath;
  }

  /**
   * Parse CSV line handling quoted fields with commas
   */
  private parseCSVLine(line: string | undefined | null): string[] {
    if (!line) {
      console.warn('[PlayerDataService] parseCSVLine called with undefined/null line');
      return [];
    }

    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Escaped quote
          current += '"';
          i++; // Skip next quote
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        // Field separator
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }

    // Add last field
    result.push(current);

    return result;
  }

  /**
   * Parse "City, State" format into hometown and homeState
   * Examples: "Chattanooga, Tennessee" -> { hometown: "Chattanooga", homeState: "Tennessee" }
   *           "Tennessee" -> { homeState: "Tennessee" }
   */
  private parseHomeLocation(homeLocation: string): { hometown?: string; homeState?: string } {
    if (!homeLocation || !homeLocation.trim()) {
      return {};
    }

    const trimmed = homeLocation.trim();

    if (trimmed.includes(',')) {
      // "City, State" format
      const parts = trimmed.split(',');
      const hometown = parts.slice(0, -1).join(',').trim(); // Everything before last comma
      const homeState = parts[parts.length - 1].trim(); // Last part is state
      return { hometown, homeState };
    } else {
      // Just state name
      return { homeState: trimmed };
    }
  }

  /**
   * Initialize all data caches
   * Can be called externally to preload data before heavy operations
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      console.log('[PlayerDataService] Initializing...');

      // Load all 3 CSV files
      await this.loadHistoricalPlayers();
      await this.loadFutureProspects();
      await this.loadRosterLookup();

      this.isInitialized = true;
      console.log('[PlayerDataService] Initialization complete');
      console.log(`  - Historical players: ${this.allHistoricalPlayers.length}`);
      console.log(`  - Future prospects: ${this.allFutureProspects.length}`);
      console.log(`  - Roster lookup entries: ${this.rosterLookupCache.size}`);
    } catch (error) {
      console.error('[PlayerDataService] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Load ALL_PLAYER_LOOKUP.csv (31,882 historical players 1936-2025)
   */
  private async loadHistoricalPlayers(): Promise<void> {
    const filePath = this.resolveDataPath('ALL_PLAYER_LOOKUP.csv');

    if (!fs.existsSync(filePath)) {
      throw new Error(`Historical player lookup file not found: ${filePath}`);
    }

    const csvContent = fs.readFileSync(filePath, 'utf-8');

    if (!csvContent) {
      throw new Error('ALL_PLAYER_LOOKUP.csv is empty or could not be read');
    }

    const lines = csvContent.trim().split('\n');

    if (lines.length < 2) {
      throw new Error('Invalid ALL_PLAYER_LOOKUP.csv format');
    }

    // Parse header
    const header = this.parseCSVLine(lines[0]);
    console.log(`[PlayerDataService] ALL_PLAYER_LOOKUP.csv columns:`, header);

    // Parse data rows
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const parts = this.parseCSVLine(line);
      if (parts.length < 26) continue; // Need at least 26 columns

      const player: HistoricalPlayer = {
        lastName: parts[0].trim(),
        firstName: parts[1].trim(),
        college: parts[2].trim(),
        round: parts[3].trim(),
        pick: parts[4].trim(),
        draftClass: parseInt(parts[5].trim()),
        position: parts[6].trim(),
        jersey: parts[7].trim(),
        photoID: parts[8] ? parseInt(parts[8].trim()) : undefined,
        playerAssetsID: parts[9].trim(),
        commID: parts[10].trim(),
        plpo: parts[11].trim(),
        height: parts[12] ? parseFloat(parts[12].trim()) : undefined,
        weight: parts[13] ? parseFloat(parts[13].trim()) : undefined,
        from: parts[14] ? parseFloat(parts[14].trim()) : undefined,
        to: parts[15] ? parseFloat(parts[15].trim()) : undefined,
        ap1: parts[16] ? parseFloat(parts[16].trim()) : undefined,
        pb: parts[17] ? parseFloat(parts[17].trim()) : undefined,
        st: parts[18] ? parseFloat(parts[18].trim()) : undefined,
        wAV: parts[19] ? parseFloat(parts[19].trim()) : undefined,
        league: parts[20].trim(),
        race: parts[21].trim(),
        // Parse "City, State" format from column 22
        ...this.parseHomeLocation(parts[22].trim()),
        wikiImageURL: parts[23].trim(),
        pfrImageURL: parts[24].trim(),
        isHOF: parts[25].trim().toLowerCase() === 'true'
      };

      // DEBUG: Log first Joe Burrow found
      if (player.firstName === 'Joe' && player.lastName === 'Burrow') {
        console.log('[PlayerDataService] ✓ LOADED Joe Burrow from CSV:');
        console.log(`  Position: "${player.position}"`);
        console.log(`  Jersey: "${player.jersey}"`);
        console.log(`  PhotoID: ${player.photoID}`);
        console.log(`  PlayerAssetsID: "${player.playerAssetsID}"`);
        console.log(`  Hometown: "${player.hometown}", HomeState: "${player.homeState}"`);
        console.log(`  Draft Class: ${player.draftClass}`);
      }

      this.allHistoricalPlayers.push(player);

      // Cache by year
      if (!isNaN(player.draftClass)) {
        if (!this.historicalPlayersCache.has(player.draftClass)) {
          this.historicalPlayersCache.set(player.draftClass, []);
        }
        this.historicalPlayersCache.get(player.draftClass)!.push(player);
      }
    }

    console.log(`[PlayerDataService] Loaded ${this.allHistoricalPlayers.length} historical players`);
  }

  /**
   * Load FutureDraft_Lookup_MERGED.csv (16,332 prospects 2026+)
   */
  private async loadFutureProspects(): Promise<void> {
    const filePath = this.resolveDataPath('FutureDraft_Lookup_MERGED.csv');

    if (!fs.existsSync(filePath)) {
      throw new Error(`Future draft lookup file not found: ${filePath}`);
    }

    const csvContent = fs.readFileSync(filePath, 'utf-8');

    if (!csvContent) {
      throw new Error('FutureDraft_Lookup_MERGED.csv is empty or could not be read');
    }

    const lines = csvContent.trim().split('\n');

    if (lines.length < 2) {
      throw new Error('Invalid FutureDraft_Lookup_MERGED.csv format');
    }

    // Parse header
    const header = this.parseCSVLine(lines[0]);
    console.log(`[PlayerDataService] FutureDraft_Lookup_MERGED.csv columns:`, header);

    // Parse data rows
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const parts = this.parseCSVLine(line);
      if (parts.length < 17) continue; // Need at least 17 columns

      const prospect: FutureProspect = {
        lastName: parts[0].trim(),
        firstName: parts[1].trim(),
        college: parts[2].trim(),
        rank: parts[3] ? parseFloat(parts[3].trim()) : undefined,
        draftClass: parseInt(parts[4].trim()),
        position: parts[5].trim(),
        jersey: parts[6] ? parseInt(parts[6].trim()) : undefined,
        height: parts[7] ? parseFloat(parts[7].trim()) : undefined,
        weight: parts[8] ? parseFloat(parts[8].trim()) : undefined,
        class: parts[9].trim(),
        wAV: parts[10] ? parseFloat(parts[10].trim()) : undefined,
        hometown: parts[11].trim(),
        homestate: parts[12].trim(),
        race: parts[13].trim(),
        photo: parts[14].trim(),
        archetype: parts[15].trim(),
        archetypeDetailed: parts[16].trim()
      };

      this.allFutureProspects.push(prospect);

      // Cache by year
      if (!isNaN(prospect.draftClass)) {
        if (!this.futureProspectsCache.has(prospect.draftClass)) {
          this.futureProspectsCache.set(prospect.draftClass, []);
        }
        this.futureProspectsCache.get(prospect.draftClass)!.push(prospect);
      }
    }

    console.log(`[PlayerDataService] Loaded ${this.allFutureProspects.length} future prospects`);
  }

  /**
   * Load ROSTER_lookup.csv (93,646 player-year entries 1970-2024)
   */
  private async loadRosterLookup(): Promise<void> {
    const filePath = this.resolveDataPath('ROSTER_lookup.csv');

    console.log(`[PlayerDataService] ======= LOADING ROSTER_LOOKUP.CSV =======`);
    console.log(`[PlayerDataService] Attempting to load from: ${filePath}`);
    console.log(`[PlayerDataService] app.getAppPath(): ${app.getAppPath()}`);

    if (!fs.existsSync(filePath)) {
      console.error(`[PlayerDataService] ❌ ROSTER_lookup.csv NOT FOUND at ${filePath}`);
      console.error(`[PlayerDataService] This is the reason ROSTER_lookup data is not available!`);
      return; // Not fatal - can continue without rookie stats
    }

    console.log(`[PlayerDataService] ✅ ROSTER_lookup.csv EXISTS at ${filePath}`);

    const csvContent = fs.readFileSync(filePath, 'utf-8');

    if (!csvContent) {
      console.warn('[PlayerDataService] ROSTER_lookup.csv is empty or could not be read');
      return; // Not fatal - can continue without rookie stats
    }

    const lines = csvContent.trim().split('\n');

    if (lines.length < 2) {
      console.warn('[PlayerDataService] Invalid ROSTER_lookup.csv format');
      return;
    }

    // Parse header
    const header = this.parseCSVLine(lines[0]);
    console.log(`[PlayerDataService] ROSTER_lookup.csv columns (first 20):`, header.slice(0, 20));

    // Parse data rows (limit logging to first 5 for performance)
    let parsedCount = 0;
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const parts = this.parseCSVLine(line);
      if (parts.length < 70) continue; // Need most columns for ratings

      const stats: RookieStats = {
        year: parseInt(parts[0].trim()),
        seasonTeam: parts[1].trim(),
        playerName: parts[2].trim(),
        firstName: parts[3].trim(),
        lastName: parts[4].trim(),
        position: parts[5].trim(),
        jersey: parts[6] ? parseInt(parts[6].trim()) : undefined,
        age: parts[7] ? parseInt(parts[7].trim()) : undefined,
        pid: parts[8] ? parseInt(parts[8].trim()) : undefined,
        pam: parts[9].trim(),
        college: parts[10].trim(),
        height: parts[11] ? parseFloat(parts[11].trim()) : undefined,
        weight: parts[12] ? parseFloat(parts[12].trim()) : undefined,
        povr: parts[13] ? parseInt(parts[13].trim()) : undefined,
        archetype: parts[14].trim(),
        pspd: parts[15] ? parseInt(parts[15].trim()) : undefined,
        pacc: parts[16] ? parseInt(parts[16].trim()) : undefined,
        pstr: parts[17] ? parseInt(parts[17].trim()) : undefined,
        pagi: parts[18] ? parseInt(parts[18].trim()) : undefined,
        pawr: parts[19] ? parseInt(parts[19].trim()) : undefined,
        pcth: parts[20] ? parseInt(parts[20].trim()) : undefined,
        pcar: parts[21] ? parseInt(parts[21].trim()) : undefined,
        pthp: parts[22] ? parseInt(parts[22].trim()) : undefined,
        pkpw: parts[23] ? parseInt(parts[23].trim()) : undefined,
        pkac: parts[24] ? parseInt(parts[24].trim()) : undefined,
        prbk: parts[25] ? parseInt(parts[25].trim()) : undefined,
        ppbk: parts[26] ? parseInt(parts[26].trim()) : undefined,
        ptak: parts[27] ? parseInt(parts[27].trim()) : undefined,
        pbtk: parts[28] ? parseInt(parts[28].trim()) : undefined,
        pjmp: parts[29] ? parseInt(parts[29].trim()) : undefined,
        pinj: parts[30] ? parseInt(parts[30].trim()) : undefined,
        psta: parts[31] ? parseInt(parts[31].trim()) : undefined,
        ptgh: parts[32] ? parseInt(parts[32].trim()) : undefined,
        ptrk: parts[33] ? parseInt(parts[33].trim()) : undefined,
        pcod: parts[34] ? parseInt(parts[34].trim()) : undefined,
        pbcv: parts[35] ? parseInt(parts[35].trim()) : undefined,
        pstf: parts[36] ? parseInt(parts[36].trim()) : undefined,
        pspm: parts[37] ? parseInt(parts[37].trim()) : undefined,
        pjum: parts[38] ? parseInt(parts[38].trim()) : undefined,
        pibl: parts[39] ? parseInt(parts[39].trim()) : undefined,
        prbp: parts[40] ? parseInt(parts[40].trim()) : undefined,
        prbf: parts[41] ? parseInt(parts[41].trim()) : undefined,
        ppbp: parts[42] ? parseInt(parts[42].trim()) : undefined,
        ppbf: parts[43] ? parseInt(parts[43].trim()) : undefined,
        pldb: parts[44] ? parseInt(parts[44].trim()) : undefined,
        pbrs: parts[45] ? parseInt(parts[45].trim()) : undefined,
        ptup: parts[46] ? parseInt(parts[46].trim()) : undefined,
        ppwm: parts[47] ? parseInt(parts[47].trim()) : undefined,
        pfnm: parts[48] ? parseInt(parts[48].trim()) : undefined,
        pbsh: parts[49] ? parseInt(parts[49].trim()) : undefined,
        ppur: parts[50] ? parseInt(parts[50].trim()) : undefined,
        pprc: parts[51] ? parseInt(parts[51].trim()) : undefined,
        pmcv: parts[52] ? parseInt(parts[52].trim()) : undefined,
        pzcv: parts[53] ? parseInt(parts[53].trim()) : undefined,
        pspc: parts[54] ? parseInt(parts[54].trim()) : undefined,
        pcit: parts[55] ? parseInt(parts[55].trim()) : undefined,
        psrr: parts[56] ? parseInt(parts[56].trim()) : undefined,
        pmrr: parts[57] ? parseInt(parts[57].trim()) : undefined,
        pdrr: parts[58] ? parseInt(parts[58].trim()) : undefined,
        phtp: parts[59] ? parseInt(parts[59].trim()) : undefined,
        pprs: parts[60] ? parseInt(parts[60].trim()) : undefined,
        prel: parts[61] ? parseInt(parts[61].trim()) : undefined,
        ptas: parts[62] ? parseInt(parts[62].trim()) : undefined,  // Throw Accuracy Short
        ptam: parts[63] ? parseInt(parts[63].trim()) : undefined,  // Throw Accuracy Mid
        ptad: parts[64] ? parseInt(parts[64].trim()) : undefined,  // Throw Accuracy Deep
        ppla: parts[65] ? parseInt(parts[65].trim()) : undefined,  // Play Action
        ptor: parts[66] ? parseInt(parts[66].trim()) : undefined,  // Throw on Run
        // Non-rating fields
        birthDate: parts[67] ? parts[67].trim() : undefined,
        yearsPro: parts[68] ? parts[68].trim() : undefined,
        handedness: parts[69] ? parts[69].trim() : undefined,
        fortyYd: parts[70] ? parseFloat(parts[70].trim()) : undefined,
        vertical: parts[71] ? parseFloat(parts[71].trim()) : undefined,
        bench: parts[72] ? parseInt(parts[72].trim()) : undefined,
        broadJump: parts[73] ? parseFloat(parts[73].trim()) : undefined,
        threeCone: parts[74] ? parseFloat(parts[74].trim()) : undefined,
        shuttle: parts[75] ? parseFloat(parts[75].trim()) : undefined,
        draftYear: parts[76] ? parseInt(parts[76].trim()) : undefined,
        games: parts[77] ? parseInt(parts[77].trim()) : undefined,
        gamesStarted: parts[78] ? parseInt(parts[78].trim()) : undefined,
        av: parts[79] ? parseInt(parts[79].trim()) : undefined,  // Approximate Value
        devTrait: parts[80] ? parts[80].trim() : undefined,
        archetypeDetailed: parts[81] ? parseInt(parts[81].trim()) : undefined
      };

      // Cache by "PlayerName_Year" key for fast rookie lookup
      // Normalize the name to handle period/whitespace/case variations
      const normalizedName = this.normalizeName(stats.playerName);
      const key = `${normalizedName}_${stats.year}`;

      // Debug logging for specific players
      if (stats.playerName === 'Joe Burrow' || (stats.year === 2021 && parsedCount < 5)) {
        console.log(`[PlayerDataService] Cache entry:`, {
          playerName: stats.playerName,
          year: stats.year,
          yearType: typeof stats.year,
          rawYear: parts[0],
          key: key,
          povr: stats.povr,
          archetype: stats.archetype,
          archetypeColumn: parts[14]
        });
      }

      if (!this.rosterLookupCache.has(key)) {
        this.rosterLookupCache.set(key, []);
      }
      this.rosterLookupCache.get(key)!.push(stats);

      // Also cache by team+year for getPlayersByTeamYear()
      if (stats.seasonTeam && stats.year) {
        const teamYearKey = `${stats.seasonTeam}_${stats.year}`;
        if (!this.teamYearCache.has(teamYearKey)) {
          this.teamYearCache.set(teamYearKey, []);
        }
        this.teamYearCache.get(teamYearKey)!.push(stats);
      }

      parsedCount++;
    }

    console.log(`[PlayerDataService] Loaded ${parsedCount} roster lookup entries`);
    console.log(`[PlayerDataService] Cache has ${this.rosterLookupCache.size} unique player-year keys`);
    console.log(`[PlayerDataService] Cache has ${this.teamYearCache.size} unique team-year keys`);

    // DEBUG: Check for 1992 teams specifically
    const teams1992 = Array.from(this.teamYearCache.keys()).filter(k => k.endsWith('_1992'));
    console.log(`[PlayerDataService] ======= 1992 TEAMS IN CACHE =======`);
    console.log(`[PlayerDataService] Found ${teams1992.length} teams for 1992`);
    teams1992.forEach(key => {
      const count = this.teamYearCache.get(key)?.length || 0;
      console.log(`[PlayerDataService]   ${key}: ${count} players`);
    });

    // Specifically verify Oilers_1992
    const oilers1992 = this.teamYearCache.get('Oilers_1992');
    if (oilers1992 && oilers1992.length > 0) {
      console.log(`[PlayerDataService] ✅ Oilers_1992 FOUND with ${oilers1992.length} players`);
      const warrenMoon = oilers1992.find(p => p.lastName === 'Moon' && p.firstName === 'Warren');
      if (warrenMoon) {
        console.log(`[PlayerDataService] ✅ Warren Moon FOUND in Oilers_1992: ${JSON.stringify({name: warrenMoon.playerName, pos: warrenMoon.position, age: warrenMoon.age})}`);
      } else {
        console.log(`[PlayerDataService] ❌ Warren Moon NOT FOUND in Oilers_1992`);
      }
    } else {
      console.log(`[PlayerDataService] ❌ Oilers_1992 NOT FOUND in cache!`);
    }
    console.log(`[PlayerDataService] ======================================`);

    // Write debug info to file for easy access
    try {
      const debugPath = path.join(app.getPath('temp'), 'roster-lookup-debug.log');
      const debugInfo = [
        `=== ROSTER_LOOKUP DEBUG LOG - ${new Date().toISOString()} ===`,
        `CSV path: ${filePath}`,
        `File exists: ${fs.existsSync(filePath)}`,
        `app.getAppPath(): ${app.getAppPath()}`,
        `Parsed entries: ${parsedCount}`,
        `teamYearCache.size: ${this.teamYearCache.size}`,
        `Teams for 1992: ${teams1992.join(', ')}`,
        `Oilers_1992 count: ${oilers1992 ? oilers1992.length : 0}`,
        oilers1992 && oilers1992.length > 0
          ? `Warren Moon found: ${!!oilers1992.find(p => p.lastName === 'Moon' && p.firstName === 'Warren')}`
          : 'Warren Moon: N/A (no Oilers data)',
        ''
      ].join('\n');
      fs.writeFileSync(debugPath, debugInfo);
      console.log(`[PlayerDataService] Debug log written to: ${debugPath}`);
    } catch (err) {
      console.error(`[PlayerDataService] Failed to write debug log:`, err);
    }

    // Verify Andrew Luck 2013 is in the cache
    const testKey = 'andrew luck_2013';
    const testData = this.rosterLookupCache.get(testKey);
    if (testData && testData.length > 0) {
      console.log(`[PlayerDataService] ✅ TEST: Found "${testKey}" in cache with OVR=${testData[0].povr}`);
    } else {
      console.log(`[PlayerDataService] ❌ TEST: "${testKey}" NOT FOUND in cache`);
      // Show some sample keys
      const sampleKeys = Array.from(this.rosterLookupCache.keys()).slice(0, 10);
      console.log(`[PlayerDataService]   Sample keys: ${sampleKeys.join(', ')}`);
    }
  }

  // ===========================
  // PUBLIC API METHODS
  // ===========================

  /**
   * Get all players for a specific year (1936-2025 historical or 2026+ future)
   */
  public async getPlayersByYear(year: number): Promise<PlayerRecord[]> {
    await this.initialize();

    if (year >= 2026) {
      // Return a COPY of the array to prevent mutations affecting the cache
      const players = this.futureProspectsCache.get(year) || [];
      return [...players];
    } else {
      // Return a COPY of the array to prevent mutations affecting the cache
      const players = this.historicalPlayersCache.get(year) || [];
      return [...players];
    }
  }

  /**
   * Get all players from a decade (e.g., "1970s" = 1970-1979)
   */
  public async getPlayersByDecade(startYear: number): Promise<HistoricalPlayer[]> {
    await this.initialize();

    const endYear = startYear + 9;
    const players: HistoricalPlayer[] = [];

    for (let year = startYear; year <= endYear; year++) {
      const yearPlayers = this.historicalPlayersCache.get(year) || [];
      players.push(...yearPlayers);
    }

    return players;
  }

  /**
   * Get rookie stats for a player by name and draft year
   * NOTE: Draft year is converted to rookie season year (draft year + 1)
   * Example: 2020 draft class plays in 2020-2021 season, so we look up 2021 rosters
   */
  public async getRookieStats(playerName: string, draftYear: number): Promise<RookieStats | null> {
    await this.initialize();

    // Convert draft year to rookie season year (draft year + 1)
    const rookieSeasonYear = draftYear + 1;

    // Normalize the search name to match how cache keys were built
    const normalizedName = this.normalizeName(playerName);
    const key = `${normalizedName}_${rookieSeasonYear}`;
    const stats = this.rosterLookupCache.get(key);

    // Debug ALL lookups to understand what's happening
    const isDebugPlayer = playerName.includes('Luck') || playerName.includes('Burrow') || playerName.includes('Young') || playerName.includes('Wills') || playerName.includes('Wirfs');

    // Always log to console for first few lookups and debug players
    if (isDebugPlayer || this.rosterLookupCache.size < 10) {
      console.log(`[PlayerDataService] getRookieStats lookup: "${playerName}"`);
      console.log(`[PlayerDataService]   Normalized: "${normalizedName}"`);
      console.log(`[PlayerDataService]   Draft Year: ${draftYear} -> Rookie Season: ${rookieSeasonYear}`);
      console.log(`[PlayerDataService]   Lookup Key: "${key}"`);
      console.log(`[PlayerDataService]   Cache size: ${this.rosterLookupCache.size}`);
      console.log(`[PlayerDataService]   Found in cache: ${stats ? 'YES (' + stats.length + ' entries)' : 'NO'}`);
      if (stats && stats.length > 0) {
        console.log(`[PlayerDataService]   Returning stats - Position: ${stats[0].position}, OVR: ${stats[0].povr}`);
      } else {
        // Try to find similar keys for debugging
        const lastName = normalizedName.split(' ')[1] || '';
        const similarKeys = Array.from(this.rosterLookupCache.keys())
          .filter(k => k.includes(lastName))
          .slice(0, 10);
        console.log(`[PlayerDataService]   Similar keys with "${lastName}":`, similarKeys);

        // Also try the exact key we're looking for
        const hasExactKey = this.rosterLookupCache.has(key);
        console.log(`[PlayerDataService]   Has exact key "${key}": ${hasExactKey}`);
      }
    }

    return stats && stats.length > 0 ? stats[0] : null;
  }

  /**
   * Get all roster lookup data (for comparable player matching)
   * Returns all player-year entries from ROSTER_lookup.csv
   */
  public async getAllRosterLookupData(): Promise<RookieStats[]> {
    await this.initialize();

    const allStats: RookieStats[] = [];

    // Flatten all entries from the cache
    for (const statsArray of this.rosterLookupCache.values()) {
      allStats.push(...statsArray);
    }

    console.log(`[PlayerDataService] getAllRosterLookupData: Returning ${allStats.length} player-year entries`);
    return allStats;
  }

  /**
   * Get all available years in historical data
   */
  public async getAllYears(): Promise<number[]> {
    await this.initialize();

    const years = Array.from(this.historicalPlayersCache.keys()).sort((a, b) => a - b);
    return years;
  }

  /**
   * Get decades for decade class selector
   */
  public async getDecadeYears(): Promise<{ label: string, years: number[] }[]> {
    await this.initialize();

    const decades: { label: string, years: number[] }[] = [];
    const allYears = await this.getAllYears();

    // Group into decades
    for (let decadeStart = 1930; decadeStart <= 2020; decadeStart += 10) {
      const decadeYears = allYears.filter(y => y >= decadeStart && y < decadeStart + 10);
      if (decadeYears.length > 0) {
        decades.push({
          label: `${decadeStart}s`,
          years: decadeYears
        });
      }
    }

    return decades;
  }

  /**
   * Get team name variants for historical teams
   * Handles name changes like Redskins -> Commanders, Oilers -> Titans
   */
  private getTeamNameVariants(teamName: string): string[] {
    const variants: string[] = [teamName];

    // Handle historical name changes
    if (teamName === 'Commanders') {
      variants.push('Redskins', 'Washington');
    } else if (teamName === 'Redskins') {
      variants.push('Commanders', 'Washington');
    } else if (teamName === 'Titans') {
      variants.push('Oilers');
    } else if (teamName === 'Oilers') {
      variants.push('Titans');
    } else if (teamName === 'Raiders') {
      variants.push('Oakland Raiders', 'Las Vegas Raiders', 'LA Raiders');
    } else if (teamName === 'Chargers') {
      variants.push('San Diego Chargers', 'Los Angeles Chargers');
    } else if (teamName === 'Rams') {
      variants.push('St. Louis Rams', 'Los Angeles Rams');
    } else if (teamName === 'Cardinals') {
      variants.push('Phoenix Cardinals', 'St. Louis Cardinals', 'Arizona Cardinals');
    }

    return variants;
  }

  /**
   * Get all players for a specific team and year from ROSTER_lookup.csv
   * @param teamAbbr - PFR team abbreviation (e.g., 'oti' for Titans/Oilers)
   * @param year - Season year
   * @returns Array of RookieStats for players on that team in that year
   */
  public async getPlayersByTeamYear(teamAbbr: string, year: number): Promise<RookieStats[]> {
    await this.initialize();

    console.log(`[PlayerDataService] getPlayersByTeamYear called: teamAbbr='${teamAbbr}', year=${year}`);
    console.log(`[PlayerDataService]   teamYearCache.size = ${this.teamYearCache.size}`);

    // Get team name from abbreviation
    const teamName = PlayerDataService.TEAM_NAME_MAP[teamAbbr.toLowerCase()];
    if (!teamName) {
      console.warn(`[PlayerDataService] ❌ Unknown team abbreviation: ${teamAbbr}`);
      return [];
    }

    console.log(`[PlayerDataService]   Mapped '${teamAbbr}' -> '${teamName}'`);

    // Try all name variants for historical teams
    const variants = this.getTeamNameVariants(teamName);
    console.log(`[PlayerDataService]   Variants to try: ${variants.join(', ')}`);

    for (const variant of variants) {
      const key = `${variant}_${year}`;
      const players = this.teamYearCache.get(key);
      console.log(`[PlayerDataService]   Checking key '${key}': ${players ? players.length + ' players' : 'NOT FOUND'}`);
      if (players && players.length > 0) {
        console.log(`[PlayerDataService] ✅ getPlayersByTeamYear: Found ${players.length} players for ${variant} in ${year}`);
        return [...players]; // Return copy to prevent mutations
      }
    }

    console.log(`[PlayerDataService] ❌ getPlayersByTeamYear: No players found for ${teamAbbr} (${teamName}) in ${year}`);
    console.log(`[PlayerDataService]   Tried variants: ${variants.join(', ')}`);

    // Debug: Show available team-year keys for this year
    const keysForYear = Array.from(this.teamYearCache.keys())
      .filter(k => k.endsWith(`_${year}`))
      .slice(0, 10);
    console.log(`[PlayerDataService]   Available teams in ${year}: ${keysForYear.map(k => k.split('_')[0]).join(', ')}`);

    return [];
  }

  /**
   * Get all available teams for a specific year from ROSTER_lookup.csv
   * @param year - Season year
   * @returns Array of team names available in that year
   */
  public async getAvailableTeamsForYear(year: number): Promise<string[]> {
    await this.initialize();

    const teams: string[] = [];

    for (const key of this.teamYearCache.keys()) {
      if (key.endsWith(`_${year}`)) {
        const teamName = key.replace(`_${year}`, '');
        teams.push(teamName);
      }
    }

    return teams.sort();
  }

  /**
   * Check if service is ready
   */
  public isReady(): boolean {
    return this.isInitialized;
  }
}

// Export singleton instance
export const playerDataService = new PlayerDataService();
