/**
 * Roster Generator Service
 *
 * Generates complete Madden rosters from the SQLite database (players.db).
 * Supports single year rosters and all-time/decade rosters combining best players.
 *
 * Key Features:
 * - Single Year Mode: All players from specific year + 5-year free agent backfill
 * - All-Time Mode: Best players from year range with position limits
 * - PID-based deduplication (keeps highest POVR version)
 * - Real Madden ratings from database with 30-50 variance for missing values
 * - Generic PID/PAM assignment for players without portraits
 * - Archetype numeric validation (0-67)
 * - Template buffer integrity for M26 saves
 *
 * DATA SOURCE: Uses lookupService which reads from data/players.db SQLite database
 */

import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import Papa from 'papaparse';
import { lookupService } from './lookup-service';
import { draftClassService } from './DraftClassService';
import { pgheLookupService } from './PGHELookupService';
import { userDatabaseService } from './UserDatabaseService';
import { contractService } from './ContractService';
import { ArchetypeSyncService } from './ArchetypeSyncService';
import { ovrWeightsCalculator } from './rating-modes/OVRWeightsCalculator';

// Map database field codes to OVR calculator field codes
// CRITICAL: This MUST match the mapping in database-player-card.js exactly
// This ensures ONE calculation produces the same result everywhere
const DB_TO_OVR_FIELD_MAP: { [key: string]: string } = {
  'PSPD': 'PSPD', 'PACC': 'PACC', 'PSTR': 'PSTR', 'PAGI': 'PAGI', 'PJMP': 'PJMP',
  'PSTM': 'PSTA', 'PSTA': 'PSTA', 'PINJ': 'PINJ', 'PTGH': 'PTGH', 'PAWR': 'PAWR',
  'PCOD': 'PELU', 'PELU': 'PELU', 'PBCV': 'PBCV',
  'PBTK': 'PBKT', 'PBKT': 'PBKT', 'PTRK': 'PLTR', 'PLTR': 'PLTR',
  'PSFA': 'PLSA', 'PLSA': 'PLSA', 'PSPN': 'PLSM', 'PLSM': 'PLSM',
  'PJKM': 'PLJM', 'PLJM': 'PLJM', 'PCAR': 'PCAR',
  'PTAS': 'PTAS', 'PTAM': 'PTAM', 'PTAD': 'PTAD',
  'PTOR': 'PTOR', 'PTUP': 'PTUP', 'PPWR': 'PTHP', 'PTHP': 'PTHP',
  'PCTH': 'PCTH', 'PSPC': 'PLSC', 'PLSC': 'PLSC', 'PCIT': 'PLCI', 'PLCI': 'PLCI',
  'PSRR': 'SRRN', 'SRRN': 'SRRN', 'PMRR': 'PMRR', 'PDRR': 'PDRR',
  'PREL': 'PLRL', 'PLRL': 'PLRL',
  'PRBK': 'PRBK', 'PPBK': 'PPBK', 'PIBK': 'PLIB', 'PLIB': 'PLIB', 'PLBK': 'PLBK',
  'PFMS': 'PFMS', 'PRNS': 'PRBS', 'PRBS': 'PRBS',
  'PPBS': 'PPBF', 'PPBF': 'PPBF', 'PPBP': 'PPBS',
  'PRBF': 'PRBF', 'PTAK': 'PTAK',
  'PHIT': 'PLHT', 'PLHT': 'PLHT',
  'PFMV': 'PFMS', 'PPWM': 'PLPM', 'PLPM': 'PLPM',
  'PBSH': 'PBSG', 'PBSG': 'PBSG',
  'PPUR': 'PLPU', 'PLPU': 'PLPU',  // PPUR in old CSV = Pursuit, maps to PLPU
  'PPRC': 'PLPR', 'PLPR': 'PLPR',  // PPRC in old CSV = Play Recognition, maps to PLPR
  'PPLA': 'PPLA',  // Play Action stays as Play Action (QB attribute)
  'PMCV': 'PLMC', 'PLMC': 'PLMC', 'PZCV': 'PLZC', 'PLZC': 'PLZC',
  'PPRS': 'PLPE', 'PLPE': 'PLPE', 'PBSK': 'PBSK',
  'PKAC': 'PKAC', 'PKPR': 'PKPR', 'PKRT': 'PKRT'
};

// Helper function to map database ratings to OVR calculator format
function mapRatingsForOVR(ratings: { [key: string]: number }): { [key: string]: number } {
  const mapped: { [key: string]: number } = {};
  for (const [dbField, value] of Object.entries(ratings)) {
    const ovrField = DB_TO_OVR_FIELD_MAP[dbField] || dbField;
    if (value !== null && value !== undefined && !isNaN(value)) {
      mapped[ovrField] = value;
    }
  }
  return mapped;
}

export interface RosterPlayer {
  // Basic Info (lowercase format)
  firstName: string;
  lastName: string;
  position: string;
  jerseyNum: number;
  age: number;
  heightInches: number;
  weight: number;
  team: string;

  // Basic Info (UPPERCASE Madden field codes)
  PFNA?: string;  // First Name
  PLNA?: string;  // Last Name
  PPOS?: number;  // Position code
  PJEN?: number;  // Jersey number
  PAGE?: number;  // Age
  PHGT?: number;  // Height in inches
  PWGT?: number;  // Weight (stored as actual - 159)
  TGID?: number;  // Team ID
  PCBT?: number;  // Body type
  PHAN?: number;  // Handedness

  // IDs (mixed formats)
  PID: number;
  PAM: string;
  PEPS: string;
  POID: number;  // Presentation ID for in-game commentary
  PSXP?: number; // Player ID (PID) - Madden field code
  PLPL?: number; // Player Asset (PAM) - 0 for generic, 100 for real
  PCMT?: number; // Commentary ID
  PGHE?: number; // Generic head equipment
  PLAYERPIC?: string; // Player Pic display name
  PLRC?: number; // Race

  // College & Home
  college: number;
  homeState: number;
  PCOL?: number;  // College ID (Madden field code)
  PHSN?: number;  // Home State ID (Madden field code)
  PHTN?: string;  // Hometown (Madden field code)

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
  _race?: number;  // Race value (1-7) for BLBM GENR/SKNT assignment
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
  HB: 4,    // CSV uses HB not RB
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

  // Linebackers - MUST MATCH CSV CAPITALIZATION
  SAM: 2,   // Strongside (CSV uses all caps)
  MIKE: 3,  // Middle (CSV uses all caps)
  WILL: 2,  // Weakside (CSV uses all caps)

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
  'PTAM', 'PTAD', 'PPLA', 'PTOR', 'PKRT',
  'PPBS', 'PRBS',  // CRITICAL: PassBlockStrength and RunBlockStrength - needed for OVR calculation!
  'PBSK',          // Break Sack
  'PLTR', 'PELU', 'PLSA', 'PLSM', 'PLJM', 'PLIB', 'PLBK',  // Roster field codes
  'PLPM', 'PFMS', 'PBSG', 'PLPU', 'PLPR', 'PLMC', 'PLZC',  // Defense roster codes
  'PLSC', 'PLCI', 'SRRN', 'PLHT', 'PLPE', 'PLRL'           // Receiving/coverage roster codes
];

export class RosterGeneratorService {
  private rosterData: Map<number, any[]> = new Map();
  private templateData: any = null;
  private initialized: boolean = false;
  private genericPIDs: number[] = [];
  private genericPIDSet: Set<number> = new Set(); // Fast lookup for generic face PIDs
  private validPIDs: Set<number> = new Set(); // ALL valid PIDs from PID_Portrait_Mapping.csv
  private pidToPAM: Map<number, string> = new Map(); // PID → PAM mapping from PID_Portrait_Mapping.csv
  private pidToPortrait: Map<number, string> = new Map(); // PID → Portrait name (for race filtering)
  // NEW: Generic faces grouped by race for proper skin-tone matching
  private genericFacesByRace: Map<number, { pid: number; pam: string; pghe: number }[]> = new Map();
  private pidToPGHE: Map<number, number> = new Map(); // PID → PGHE mapping
  private pidToRace: Map<number, number> = new Map(); // PID → Race mapping from PID_Portrait_Mapping.csv
  private realFirstNames: string[] = [];
  private realLastNames: string[] = [];
  private pamRaceMapping: { white: string[]; hispanic: string[]; black: string[] } | null = null;
  private hofLookup: Map<string, boolean> = new Map(); // firstName|lastName -> isHOF
  private pidToCommID: Map<number, number> = new Map(); // PID → CommID (POID) mapping from ALL_PLAYER_LOOKUP.csv
  private missedLookupCount: number = 0; // Track failed player lookups for debugging
  private homeLocationLookup: Map<string, { hometown: string; homeState: string }> = new Map(); // firstName|lastName -> hometown/homeState from ALL_PLAYER_LOOKUP.csv
  private customPortraitAssignments: Map<number, number> = new Map(); // databasePlayerId → customPID (from user assignments)
  private nameToInternalId: Map<string, number> = new Map(); // firstName|lastName -> internalId (for custom portrait lookup)

  /**
   * Initialize service: Load roster data from database and template
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      console.log('[RosterGeneratorService] Already initialized');
      return;
    }

    console.log('[RosterGeneratorService] ===== INITIALIZING =====');

    // Wait for lookupService to be ready (database loaded)
    console.log('[RosterGeneratorService] Waiting for lookup service...');
    await lookupService.waitForReady();
    console.log('[RosterGeneratorService] Lookup service ready');

    // Get available years from database
    const availableYears = lookupService.getAvailableRosterYears();
    console.log('[RosterGeneratorService] Database has data for', availableYears.length, 'years');
    if (availableYears.length > 0) {
      console.log('[RosterGeneratorService] Year range:', Math.min(...availableYears), '-', Math.max(...availableYears));
    }

    // NOTE: We no longer pre-load all data into memory
    // Instead, we query the database on-demand in generateSingleYear/generateAllTime
    // This is more memory efficient and ensures we always get fresh data

    // Load template
    const templatePath = path.join(app.getAppPath(), 'data', 'Templates', 'ROSTER-Official');
    console.log('[RosterGeneratorService] Loading template from:', templatePath);

    if (!fs.existsSync(templatePath)) {
      throw new Error(`ROSTER-Official template not found at: ${templatePath}`);
    }

    try {
      console.log('[RosterGeneratorService] Calling draftClassService.loadDraftClass...');
      this.templateData = await draftClassService.loadDraftClass(templatePath);
      console.log('[RosterGeneratorService] loadDraftClass returned, checking data...');
      console.log('[RosterGeneratorService] templateData type:', typeof this.templateData);
      console.log('[RosterGeneratorService] templateData.data type:', typeof this.templateData?.data);
      console.log('[RosterGeneratorService] Template loaded, version:', this.templateData?.data?._version || 'UNKNOWN');
      console.log('[RosterGeneratorService] Template buffer size:', this.templateData?.data?._originalBuffer?.length || 0);
    } catch (loadError: any) {
      console.error('[RosterGeneratorService] TEMPLATE LOAD ERROR:', loadError.message);
      console.error('[RosterGeneratorService] Stack:', loadError.stack);
      throw new Error(`Failed to load template: ${loadError.message}`);
    }

    // Initialize PGHE lookup service for generic face assignment
    try {
      await pgheLookupService.initialize();
      console.log('[RosterGeneratorService] PGHE lookup service initialized');
    } catch (err) {
      console.warn('[RosterGeneratorService] PGHE lookup service initialization failed:', err);
    }

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

      // Extract ALL valid PIDs and PAM mappings from the mapping file
      // Also build race-based generic face lookup for proper skin-tone matching
      const genericFacesByRaceTemp: Map<number, { pid: number; pam: string; pghe: number }[]> = new Map();

      // Helper to parse skin tone from portrait name - FIRST DIGIT is skin tone (1-7)
      // Portrait format: plpo_generic_X_Y_Z_NNN where X is skin tone (1=lightest, 7=darkest)
      const parseSkinToneFromPortrait = (portrait: string): { skinTone: number; headName: string } | null => {
        // Extract the head name after "plpo_generic_"
        if (!portrait.startsWith('plpo_generic_')) return null;
        const headName = portrait.substring('plpo_generic_'.length); // e.g., "7_M_G_005"
        const firstChar = headName.charAt(0);
        const skinTone = parseInt(firstChar);
        if (isNaN(skinTone) || skinTone < 1 || skinTone > 7) return null;
        return { skinTone, headName };
      };

      // REMOVED: generatePAMFromPortrait was incorrectly converting PLPO to PAM
      // PLPO format: plpo_generic_SKINTONE_... (first digit = skin tone 1-7)
      // PAM format: gen_GENERATION_BODYCODE_... (first digit = generation 1-3, BODYCODE = B/H/M/T for race)
      // These encode different information and cannot be directly converted!
      // Instead, use generateGenericHeadName(race) which selects from pam-race-mapping.json

      pidMappingParsed.data.forEach((row: any) => {
        const pid = parseInt(row.PID);
        if (!isNaN(pid)) {
          this.validPIDs.add(pid);

          // Store PAM mapping if present (column 5: PAM)
          const pam = row.PAM;
          if (pam && typeof pam === 'string' && pam.trim().length > 0) {
            this.pidToPAM.set(pid, pam.trim());
          }

          // Store Portrait name for race filtering (column 4: Portrait)
          const portrait = row.Portrait;
          if (portrait && typeof portrait === 'string') {
            this.pidToPortrait.set(pid, portrait.trim());
          }

          // Store PGHE mapping if present (column 7: PGHE) - may not exist in original CSV
          const pghe = parseInt(row.PGHE);
          if (!isNaN(pghe)) {
            this.pidToPGHE.set(pid, pghe);
          }

          // Store Race mapping from CSV (column 6: Race)
          const race = parseInt(row.Race);
          if (!isNaN(race)) {
            this.pidToRace.set(pid, race);
          }

          // For generic faces, only cache existing PAM from CSV - do NOT generate from PLPO
          // PAM selection will be done at runtime using generateGenericHeadName(race)
          if (row.Type === 'generic' && portrait) {
            // Only cache if CSV already has a valid PAM
            if (pam && typeof pam === 'string' && pam.trim().length > 0 && !this.pidToPAM.has(pid)) {
              this.pidToPAM.set(pid, pam.trim());
            }
            // NOTE: We no longer build genericFacesByRace from PLPO portrait names
            // because PLPO skin tone (1-7) does NOT map to PAM format.
          }
        }
      });

      // Store the race-based mapping
      this.genericFacesByRace = genericFacesByRaceTemp;

      // Extract generic PIDs specifically for random assignment
      this.genericPIDs = pidMappingParsed.data
        .filter((row: any) => row.Type === 'generic')
        .map((row: any) => parseInt(row.PID))
        .filter((pid: number) => !isNaN(pid));

      // Build Set for O(1) lookup of generic PIDs
      this.genericPIDSet = new Set(this.genericPIDs);

      console.log('[RosterGeneratorService] Loaded', this.validPIDs.size, 'total valid PIDs');
      console.log('[RosterGeneratorService] Loaded', this.pidToPAM.size, 'PID → PAM mappings');
      console.log('[RosterGeneratorService] Loaded', this.pidToPortrait.size, 'PID → Portrait mappings');
      console.log('[RosterGeneratorService] Loaded', this.pidToPGHE.size, 'PID → PGHE mappings');
      console.log('[RosterGeneratorService] Loaded', this.pidToRace.size, 'PID → Race mappings');
      console.log('[RosterGeneratorService] Loaded', this.genericPIDs.length, 'generic PIDs for random assignment');

      // Log generic faces by race
      console.log('[RosterGeneratorService] Generic faces by race:');
      this.genericFacesByRace.forEach((faces, race) => {
        console.log(`  Race ${race}: ${faces.length} faces`);
      });

      // Debug: Check some generic portraits
      const sampleGenericPIDs = this.genericPIDs.slice(0, 5);
      console.log('[RosterGeneratorService] Sample generic PIDs and portraits:');
      sampleGenericPIDs.forEach(pid => {
        console.log(`  PID ${pid}: ${this.pidToPortrait.get(pid)}, PGHE: ${this.pidToPGHE.get(pid)}`);
      });
    } else {
      console.warn('[RosterGeneratorService] PID_Portrait_Mapping.csv not found, using fallback generic PIDs');
      // Fallback to basic set if file not found
      this.genericPIDs = [
        719, 721, 725, 727, 730, 731, 961, 2131, 2270, 2271,
        2325, 2373, 2546, 2547, 2583, 2586, 2587, 2589, 2591,
        2717, 2718, 2719, 2720, 2721, 2743, 2745, 2748, 2749,
        2751, 2753
      ];
      // Build Set for O(1) lookup
      this.genericPIDSet = new Set(this.genericPIDs);
      // Also populate validPIDs with fallback set
      this.genericPIDs.forEach(pid => this.validPIDs.add(pid));
    }

    // Load PAM race mapping for proper skin-tone matching
    const pamRaceMappingPath = path.join(app.getAppPath(), 'data', 'lookups', 'pam-race-mapping.json');
    console.log('[RosterGeneratorService] Loading PAM race mapping from:', pamRaceMappingPath);

    if (fs.existsSync(pamRaceMappingPath)) {
      const pamRaceMappingContent = fs.readFileSync(pamRaceMappingPath, 'utf8');
      this.pamRaceMapping = JSON.parse(pamRaceMappingContent);
      console.log('[RosterGeneratorService] Loaded PAM race mapping:',
        `${this.pamRaceMapping?.white?.length || 0} white,`,
        `${this.pamRaceMapping?.hispanic?.length || 0} hispanic,`,
        `${this.pamRaceMapping?.black?.length || 0} black`);
    } else {
      console.warn('[RosterGeneratorService] pam-race-mapping.json not found, will use fallback generation');
    }

    // Load player names, HOF status, and home locations from database via lookupService
    console.log('[RosterGeneratorService] Loading player data from database...');

    // Get unique first and last names from database
    this.realFirstNames = lookupService.getUniqueFirstNames();
    this.realLastNames = lookupService.getUniqueLastNames();

    // Load all player data for HOF status, CommID, and home locations
    const allPlayers = lookupService.getAllPlayers();
    let hofCount = 0;

    for (const player of allPlayers) {
      const firstName = player.firstName?.trim() || '';
      const lastName = player.lastName?.trim() || '';

      if (firstName && lastName) {
        const key = `${firstName}|${lastName}`;

        // HOF status
        if (player.isHOF) {
          this.hofLookup.set(key, true);
          hofCount++;
        }

        // CommID (POID) mapping by PID
        if (player.pid && player.pid > 0 && player.commID) {
          const commIdNum = parseInt(player.commID);
          if (!isNaN(commIdNum) && commIdNum > 0) {
            this.pidToCommID.set(player.pid, commIdNum);
          }
        }

        // Home location lookup
        if (player.hometown || player.homeState) {
          this.homeLocationLookup.set(key, {
            hometown: player.hometown || '',
            homeState: player.homeState || ''
          });
        }

        // Name → InternalId lookup (for custom portrait matching)
        // Only store first occurrence to avoid collisions with different players of same name
        if (player.internalId && !this.nameToInternalId.has(key)) {
          this.nameToInternalId.set(key, player.internalId);
        }
      }
    }

    console.log('[RosterGeneratorService] Loaded', this.realFirstNames.length, 'unique first names');
    console.log('[RosterGeneratorService] Loaded', this.realLastNames.length, 'unique last names');
    console.log('[RosterGeneratorService] Loaded', hofCount, 'Hall of Fame players');
    console.log('[RosterGeneratorService] Loaded', this.pidToCommID.size, 'PID → CommID mappings');
    console.log('[RosterGeneratorService] Loaded', this.homeLocationLookup.size, 'home location mappings');
    console.log('[RosterGeneratorService] Loaded', this.nameToInternalId.size, 'name → internalId mappings');

    // Load custom portrait assignments from user database
    try {
      await userDatabaseService.waitForReady();

      // Migrate existing portrait assignments that are missing database_player_id
      const needsMigration = userDatabaseService.getPortraitsNeedingMigration();
      if (needsMigration.length > 0) {
        console.log(`[RosterGeneratorService] Migrating ${needsMigration.length} portrait assignments...`);
        let migratedCount = 0;
        for (const { pid, playerName } of needsMigration) {
          // Parse player name (format: "FirstName LastName")
          const parts = playerName.split(' ');
          if (parts.length >= 2) {
            const firstName = parts[0];
            const lastName = parts.slice(1).join(' ');
            const key = `${firstName}|${lastName}`;
            const internalId = this.nameToInternalId.get(key);
            if (internalId) {
              userDatabaseService.migratePortraitAssignment(pid, internalId);
              migratedCount++;
              console.log(`[RosterGeneratorService] Migrated "${playerName}" (PID ${pid}) -> internal ID ${internalId}`);
            } else {
              console.warn(`[RosterGeneratorService] Could not find database player for "${playerName}"`);
            }
          }
        }
        console.log(`[RosterGeneratorService] Migration complete: ${migratedCount}/${needsMigration.length} portraits linked`);
      }

      this.customPortraitAssignments = userDatabaseService.getAllCustomPortraitAssignments();
      console.log('[RosterGeneratorService] Loaded', this.customPortraitAssignments.size, 'custom portrait assignments');
    } catch (error) {
      console.warn('[RosterGeneratorService] Failed to load custom portrait assignments:', error);
    }

    // =============================================
    // LOAD CUSTOM PLAYERS FROM USER DATABASE
    // =============================================
    // Custom players are the user's additions - they should be the PRIMARY data source
    // Custom player data OVERRIDES bundled database data for the same player
    console.log('[RosterGeneratorService] Loading custom players from user database...');

    try {
      const customPlayerSeasons = userDatabaseService.getAllCustomPlayerSeasonsWithPlayer();
      console.log('[RosterGeneratorService] Found', customPlayerSeasons.length, 'custom player seasons');

      // Track custom players added to each year for debugging
      const customPlayersPerYear: Map<number, number> = new Map();

      for (const cps of customPlayerSeasons) {
        const year = cps.year;
        if (!year) continue;

        // Convert custom player season to CSV-like row format
        // This matches the format expected by convertCsvRowToRosterPlayer
        const csvLikeRow: any = {
          Year: year,
          Season_Team: cps.team || 'FA',  // Free Agent if no team
          Player_Name: `${cps.firstName} ${cps.lastName}`,
          First_Name: cps.firstName,
          Last_Name: cps.lastName,
          Position: cps.position || 'QB',  // Default position
          Jersey: cps.jersey || 0,
          Age: cps.age || 25,
          PID: cps.maddenPid || 0,
          PAM: cps.maddenPam || '',
          College: cps.collegeId || 0,  // Will be processed as numeric ID
          Height: cps.height || 72,
          Weight: cps.weight || 200,
          POVR: cps.ratings?.POVR || 70,
          Archetype: cps.archetype || '',
          Race: cps.race || 1,
          BirthDate: '',
          YearsPro: cps.year && cps.draftClass ? year - cps.draftClass : 1,
          Handedness: cps.handedness || 0,
          Dev_Trait: 0,
          // Flag this as a custom player for priority handling
          _isCustomPlayer: true,
          _customPlayerId: cps.customPlayerId
        };

        // Copy all rating fields from custom player
        for (const field of RATING_FIELDS) {
          if (cps.ratings && cps.ratings[field] !== undefined) {
            csvLikeRow[field] = cps.ratings[field];
          }
        }

        // Add to rosterData for this year
        if (!this.rosterData.has(year)) {
          this.rosterData.set(year, []);
        }
        this.rosterData.get(year)!.push(csvLikeRow);

        // Track for logging
        customPlayersPerYear.set(year, (customPlayersPerYear.get(year) || 0) + 1);

        // Add custom player to lookup maps (OVERRIDE bundled data)
        const key = `${cps.firstName}|${cps.lastName}`;

        // Add to nameToInternalId with custom ID range (offset by 1,000,000 to avoid collisions)
        const customInternalId = 1000000 + cps.customPlayerId;
        this.nameToInternalId.set(key, customInternalId);  // OVERRIDE bundled entry

        // Add PID/CommID mapping if custom player has them set
        if (cps.maddenPid && cps.maddenPid > 0) {
          // Add to validPIDs so it won't be rejected
          this.validPIDs.add(cps.maddenPid);

          // Add PID → CommID mapping
          if (cps.maddenCommid) {
            const commIdNum = parseInt(cps.maddenCommid);
            if (!isNaN(commIdNum) && commIdNum > 0) {
              this.pidToCommID.set(cps.maddenPid, commIdNum);
            }
          }

          // Add PID → PAM mapping
          if (cps.maddenPam) {
            this.pidToPAM.set(cps.maddenPid, cps.maddenPam);
          }
        }

        // Add home location mapping (OVERRIDE bundled)
        if (cps.hometown || cps.homeState) {
          this.homeLocationLookup.set(key, {
            hometown: cps.hometown || '',
            homeState: cps.homeState || ''
          });
        }
      }

      // Log summary of custom players added
      if (customPlayersPerYear.size > 0) {
        console.log('[RosterGeneratorService] Custom players added by year:');
        for (const [year, count] of Array.from(customPlayersPerYear.entries()).sort((a, b) => a[0] - b[0])) {
          console.log(`  ${year}: ${count} players`);
        }
        console.log('[RosterGeneratorService] Total custom player seasons:', customPlayerSeasons.length);
        console.log('[RosterGeneratorService] nameToInternalId now has', this.nameToInternalId.size, 'entries');
      }
    } catch (error) {
      console.error('[RosterGeneratorService] Failed to load custom players:', error);
    }

    this.initialized = true;
    console.log('[RosterGeneratorService] ===== INITIALIZATION COMPLETE =====');
  }

  /**
   * Generate roster based on options
   */
  async generate(options: RosterGeneratorOptions): Promise<GeneratedRoster> {
    try {
      console.log('[RosterGeneratorService] ===== GENERATE ROSTER START =====');

      if (!this.initialized) {
        console.log('[RosterGeneratorService] Not initialized, calling initialize()...');
        await this.initialize();
        console.log('[RosterGeneratorService] Initialization complete');
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

    // Safely access templateData
    console.log('[RosterGeneratorService] Accessing templateData...');
    console.log('[RosterGeneratorService] templateData exists:', !!this.templateData);
    console.log('[RosterGeneratorService] templateData.data exists:', !!this.templateData?.data);

    const originalBuffer = this.templateData?.data?._originalBuffer;
    console.log('[RosterGeneratorService] originalBuffer exists:', !!originalBuffer);

    return {
      players,
      metadata,
      _originalBuffer: originalBuffer,
      _version: 'M26'
    };
    } catch (error: any) {
      console.error('[RosterGeneratorService] ===== GENERATE ERROR =====');
      console.error('[RosterGeneratorService] Error message:', error.message);
      console.error('[RosterGeneratorService] Error stack:', error.stack);
      console.error('[RosterGeneratorService] ================================');
      throw error;
    }
  }

  /**
   * Generate single year roster
   * Now queries database directly via lookupService instead of reading from CSV
   * Also merges any custom players added by the user
   */
  private async generateSingleYear(year: number): Promise<{ players: RosterPlayer[], metadata: any }> {
    console.log('[RosterGeneratorService] ===== GENERATING SINGLE YEAR =====');
    console.log('[RosterGeneratorService] Requested year:', year);

    // Show all years that have edits in user-edits.db
    const yearsSummary = userDatabaseService.getSeasonEditYearsSummary();
    console.log('[RosterGeneratorService] Years with edits in user-edits.db:', yearsSummary.map(y => `${y.year}(${y.count})`).join(', ') || 'NONE');

    // Query database for all players in this year
    const dbPlayers = lookupService.getAllPlayerSeasonsForYear(year);
    console.log(`[RosterGeneratorService] Loaded ${dbPlayers.length} players for year ${year}`);

    // BULK LOAD all user edits for this year (single query, O(1) lookup per player)
    const userEditsMap = userDatabaseService.getAllSeasonEditsForYear(year);
    console.log(`[RosterGeneratorService] User edits found for year ${year}: ${userEditsMap.size}`);

    // BULK LOAD appearance edits (PID, PAM, PGHE, etc.) - these are NOT year-specific
    const appearanceEditsMap = userDatabaseService.getAllAppearanceEdits();
    console.log(`[RosterGeneratorService] Appearance edits found: ${appearanceEditsMap.size}`);

    // DEBUG: Show sample player IDs from both sources to diagnose mismatch
    if (userEditsMap.size > 0 && dbPlayers.length > 0) {
      const sampleEditIds = Array.from(userEditsMap.keys()).slice(0, 5);
      const samplePlayerIds = dbPlayers.slice(0, 5).map(p => p.playerId);
      console.log('[RosterGeneratorService] DEBUG - Sample edit IDs:', sampleEditIds);
      console.log('[RosterGeneratorService] DEBUG - Sample player IDs from DB:', samplePlayerIds);

      // Check for specific players that should be edited
      for (const [editId, userEdit] of Array.from(userEditsMap.entries()).slice(0, 3)) {
        const matchingPlayer = dbPlayers.find(p => p.playerId === editId);
        if (matchingPlayer) {
          console.log(`[RosterGeneratorService] MATCH: Edit ID ${editId} -> ${matchingPlayer.firstName} ${matchingPlayer.lastName}, POVR in edit: ${userEdit.ratings.POVR}, pos in edit: ${userEdit.position || 'N/A'}, POVR in DB: ${matchingPlayer.ratings?.POVR}`);
        } else {
          console.log(`[RosterGeneratorService] NO MATCH: Edit ID ${editId} not found in dbPlayers`);
        }
      }
    }

    // Build a name-based index for user edits (fallback when ID doesn't match)
    const userEditsByName = new Map<string, any>();
    for (const [editId, edit] of userEditsMap.entries()) {
      // We need to look up the player name from the bundled database
      const player = lookupService.getPlayerByInternalId(editId);
      if (player) {
        const nameKey = `${player.firstName}|${player.lastName}`.toLowerCase();
        userEditsByName.set(nameKey, { edit, playerId: editId });
      }
    }
    console.log(`[RosterGeneratorService] Built name-based index with ${userEditsByName.size} entries for fallback lookup`);

    // Merge user edits into players BEFORE any sorting/selection
    // User edits override BOTH ratings AND position/team/archetype
    let mergeCount = 0;
    let fallbackMergeCount = 0;
    for (const player of dbPlayers) {
      let userEdit = null;

      // Try direct ID match first
      if (player.playerId && userEditsMap.has(player.playerId)) {
        userEdit = userEditsMap.get(player.playerId)!;
      } else {
        // Fallback: Try name-based lookup
        const nameKey = `${player.firstName}|${player.lastName}`.toLowerCase();
        const fallback = userEditsByName.get(nameKey);
        if (fallback) {
          userEdit = fallback.edit;
          fallbackMergeCount++;
          if (fallbackMergeCount <= 3) {
            console.log(`[RosterGeneratorService] FALLBACK MATCH: ${player.firstName} ${player.lastName} - DB playerId=${player.playerId}, edit playerId=${fallback.playerId}`);
          }
        }
      }

      if (userEdit) {
        const beforePOVR = player.ratings?.POVR;
        const beforePosition = player.position;

        // Override bundled ratings with user-edited values
        for (const [field, value] of Object.entries(userEdit.ratings)) {
          if (value !== null && value !== undefined) {
            player.ratings[field] = value as number;
          }
        }

        // CRITICAL: Override position/team/archetype from user edits
        // This ensures user edit positions (LG, LEDG, etc.) override bundled DB positions
        if (userEdit.position) {
          player.position = userEdit.position;
        }
        if (userEdit.team) {
          player.team = userEdit.team;
        }
        if (userEdit.archetype) {
          player.archetype = userEdit.archetype;
        }

        mergeCount++;
        // Log the merge for first few players
        if (mergeCount <= 5) {
          console.log(`[RosterGeneratorService] MERGED: ${player.firstName} ${player.lastName} (ID ${player.playerId}), POVR: ${beforePOVR} -> ${player.ratings.POVR}, Position: ${beforePosition} -> ${player.position}`);
        }
      }
    }
    console.log(`[RosterGeneratorService] Merged user edits into ${mergeCount} players (${fallbackMergeCount} via name fallback)`);

    // Build name-based index for appearance edits
    const appearanceEditsByName = new Map<string, any>();
    for (const [editId, edit] of appearanceEditsMap.entries()) {
      const player = lookupService.getPlayerByInternalId(editId);
      if (player) {
        const nameKey = `${player.firstName}|${player.lastName}`.toLowerCase();
        appearanceEditsByName.set(nameKey, edit);
      }
    }

    // Merge appearance edits (PID, PAM, PGHE, etc.) into players
    let appearanceMergeCount = 0;
    for (const player of dbPlayers) {
      let appearanceEdit = null;

      // Try direct ID match first
      if (player.playerId && appearanceEditsMap.has(player.playerId)) {
        appearanceEdit = appearanceEditsMap.get(player.playerId)!;
      } else {
        // Fallback: Try name-based lookup
        const nameKey = `${player.firstName}|${player.lastName}`.toLowerCase();
        appearanceEdit = appearanceEditsByName.get(nameKey);
      }

      if (appearanceEdit) {
        if (appearanceEdit.maddenPid !== undefined) player.maddenPid = appearanceEdit.maddenPid;
        if (appearanceEdit.maddenPam !== undefined) player.maddenPam = appearanceEdit.maddenPam;
        if (appearanceEdit.maddenPlpo !== undefined) player.maddenPlpo = appearanceEdit.maddenPlpo;
        if (appearanceEdit.maddenPghe !== undefined) player.maddenPghe = appearanceEdit.maddenPghe;
        if (appearanceEdit.maddenPfcg !== undefined) player.maddenPfcg = appearanceEdit.maddenPfcg;
        if (appearanceEdit.maddenGpan !== undefined) player.maddenGpan = appearanceEdit.maddenGpan;
        if (appearanceEdit.maddenGslp !== undefined) player.maddenGslp = appearanceEdit.maddenGslp;
        if (appearanceEdit.maddenCpvf !== undefined) player.maddenCpvf = appearanceEdit.maddenCpvf;
        if (appearanceEdit.maddenSkinTone !== undefined) player.maddenSkinTone = appearanceEdit.maddenSkinTone;
        if (appearanceEdit.isGenericFace !== undefined) player.isGenericFace = appearanceEdit.isGenericFace;

        // FIX: Add portrait manager PIDs to validPIDs so they don't get rejected
        if (appearanceEdit.maddenPid && appearanceEdit.maddenPid > 0) {
          this.validPIDs.add(appearanceEdit.maddenPid);
        }

        appearanceMergeCount++;
        if (appearanceMergeCount <= 5) {
          console.log(`[RosterGeneratorService] APPEARANCE MERGED: ${player.firstName} ${player.lastName} (ID ${player.playerId}), PID=${player.maddenPid}, PAM=${player.maddenPam}, isGenericFace=${player.isGenericFace}`);
        }
      }
    }
    console.log(`[RosterGeneratorService] Merged appearance edits into ${appearanceMergeCount} players (added PIDs to validPIDs)`);

    // BULK LOAD player edits (bio fields: height, weight, college, homeState, etc.) - NOT year-specific
    const bioEditsMap = userDatabaseService.getAllPlayerEdits();
    console.log(`[RosterGeneratorService] Bio edits found: ${bioEditsMap.size}`);

    // Build name-based index for bio edits
    const bioEditsByName = new Map<string, any>();
    for (const [editId, edit] of bioEditsMap.entries()) {
      const player = lookupService.getPlayerByInternalId(editId);
      if (player) {
        const nameKey = `${player.firstName}|${player.lastName}`.toLowerCase();
        bioEditsByName.set(nameKey, edit);
      }
    }

    // Merge bio edits into players
    let bioMergeCount = 0;
    for (const player of dbPlayers) {
      let bioEdit = null;

      // Try direct ID match first
      if (player.playerId && bioEditsMap.has(player.playerId)) {
        bioEdit = bioEditsMap.get(player.playerId)!;
      } else {
        // Fallback: Try name-based lookup
        const nameKey = `${player.firstName}|${player.lastName}`.toLowerCase();
        bioEdit = bioEditsByName.get(nameKey);
      }

      if (bioEdit) {
        // Apply bio edits to player
        if (bioEdit.height !== undefined) player.height = bioEdit.height;
        if (bioEdit.weight !== undefined) player.weight = bioEdit.weight;
        if (bioEdit.collegeId !== undefined) player.college = lookupService.getDisplayName('college_lookup.csv', bioEdit.collegeId) || player.college;
        if (bioEdit.homeState !== undefined) player.homeState = bioEdit.homeState;
        if (bioEdit.hometown !== undefined) player.hometown = bioEdit.hometown;
        if (bioEdit.race !== undefined) player.race = bioEdit.race;
        if (bioEdit.bodyType !== undefined) (player as any).bodyType = bioEdit.bodyType;
        if (bioEdit.handedness !== undefined) (player as any).handedness = bioEdit.handedness;

        bioMergeCount++;
        if (bioMergeCount <= 3) {
          console.log(`[RosterGeneratorService] BIO MERGED: ${player.firstName} ${player.lastName} (ID ${player.playerId}), height=${bioEdit.height}, weight=${bioEdit.weight}, college=${bioEdit.collegeId}, homeState=${bioEdit.homeState}`);
        }
      }
    }
    console.log(`[RosterGeneratorService] Merged bio edits into ${bioMergeCount} players`);

    // Also get custom players for this year (stored in this.rosterData during init)
    const customPlayers = this.rosterData.get(year) || [];

    // Build set of custom player names for override priority
    const customPlayerNames = new Set(
      customPlayers.map((p: any) => `${p.First_Name}|${p.Last_Name}`)
    );

    // Filter out database players that have custom overrides
    const filteredDbPlayers = dbPlayers.filter(p =>
      !customPlayerNames.has(`${p.firstName}|${p.lastName}`)
    );

    console.log('[RosterGeneratorService] Found', dbPlayers.length, 'database players for year', year);
    console.log('[RosterGeneratorService] Found', customPlayers.length, 'custom players for year', year);
    console.log('[RosterGeneratorService] After merge:', filteredDbPlayers.length, 'db +', customPlayers.length, 'custom');

    // Log first 3 players to verify correct year data
    if (filteredDbPlayers.length > 0) {
      console.log('[RosterGeneratorService] Sample players from database:');
      filteredDbPlayers.slice(0, 3).forEach((p, i) => {
        console.log(`  Player ${i + 1}: ${p.firstName} ${p.lastName} - Team: ${p.team}, PID: ${p.maddenPid}, College: ${p.college}, Home: ${p.hometown}, ${p.homeState}`);
      });
    }

    // Group players by team - handle both database and custom formats
    const teamPlayers = new Map<string, any[]>();

    // Add database players
    filteredDbPlayers.forEach(player => {
      const team = player.team || 'FA';
      if (!teamPlayers.has(team)) {
        teamPlayers.set(team, []);
      }
      teamPlayers.get(team)!.push({ ...player, _source: 'db' });
    });

    // Add custom players (they use CSV format with Season_Team)
    customPlayers.forEach((player: any) => {
      const team = player.Season_Team || 'FA';
      if (!teamPlayers.has(team)) {
        teamPlayers.set(team, []);
      }
      teamPlayers.get(team)!.push({ ...player, _source: 'custom' });
    });

    console.log('[RosterGeneratorService] Found', teamPlayers.size, 'teams');
    console.log('[RosterGeneratorService] Teams:', Array.from(teamPlayers.keys()).slice(0, 10).join(', '), '...');

    // Helper to get POVR from either format
    const getPOVR = (p: any) => {
      if (p._source === 'custom') {
        return p.POVR || 0;
      }
      return p.ratings?.POVR || 0;
    };

    // Build roster: top 55 players per team by POVR
    const roster: any[] = [];
    let totalTeams = 0;

    teamPlayers.forEach((players, team) => {
      // Sort by POVR and take top 55
      const teamRoster = players
        .sort((a, b) => getPOVR(b) - getPOVR(a))
        .slice(0, 55);

      roster.push(...teamRoster);
      totalTeams++;
      console.log(`[RosterGeneratorService] ${team}: ${teamRoster.length} players`);
    });

    console.log('[RosterGeneratorService] Total players across', totalTeams, 'teams:', roster.length);

    // Enrich all players - use correct method based on source
    const enrichedPlayers = await Promise.all(
      roster.map(p => {
        if (p._source === 'custom') {
          // Custom players use CSV format
          return this.enrichPlayer(p, year);
        } else {
          // Database players use new format
          return this.enrichPlayerFromDb(p, year);
        }
      })
    );

    console.log('[RosterGeneratorService] Final roster size:', enrichedPlayers.length);

    // Log first 3 enriched players to verify field mapping
    if (enrichedPlayers.length > 0) {
      console.log('[RosterGeneratorService] Sample enriched players:');
      enrichedPlayers.slice(0, 3).forEach((p: any, i) => {
        console.log(`  Player ${i + 1}: ${p.PFNA} ${p.PLNA} - Team ID: ${p.TGID}, PID: ${p.PSXP}, PEPS: "${p.PEPS}", PLPL: ${p.PLPL}, College: ${p.PCOL}, Archetype: ${p.PLTY}`);
      });
    }

    // Count and log generic face players with their PEPS values
    const genericFacePlayers = enrichedPlayers.filter((p: any) => p.PLPL === 0);
    console.log(`[RosterGeneratorService] Found ${genericFacePlayers.length} generic face players (PLPL=0)`);

    // CRITICAL DEBUG: Write to file so we can see the actual values
    const fs = require('fs');
    const path = require('path');
    const { app } = require('electron');
    const pepsDebugPath = path.join(app.getPath('userData'), 'PEPS_DEBUG.txt');
    const debugLines = [
      `\n=== PEPS DEBUG ${new Date().toISOString()} ===`,
      `Total players: ${enrichedPlayers.length}`,
      `Generic face players (PLPL=0): ${genericFacePlayers.length}`,
      `\nSample generic face players:`
    ];

    if (genericFacePlayers.length > 0) {
      const sampleGeneric = genericFacePlayers.slice(0, 10);
      console.log('[RosterGeneratorService] Sample generic face players:');
      sampleGeneric.forEach((p: any, i) => {
        const line = `  Generic ${i + 1}: ${p.PFNA} ${p.PLNA} - PID: ${p.PSXP}, PEPS: "${p.PEPS}", PSKI: ${p.PSKI}, PLPL: ${p.PLPL}`;
        console.log(line);
        debugLines.push(line);
      });
    }

    // Also sample some real face players
    const realFacePlayers = enrichedPlayers.filter((p: any) => p.PLPL === 100);
    debugLines.push(`\nReal face players (PLPL=100): ${realFacePlayers.length}`);
    if (realFacePlayers.length > 0) {
      debugLines.push(`\nSample real face players:`);
      realFacePlayers.slice(0, 5).forEach((p: any, i) => {
        debugLines.push(`  Real ${i + 1}: ${p.PFNA} ${p.PLNA} - PID: ${p.PSXP}, PEPS: "${p.PEPS}"`);
      });
    }

    fs.writeFileSync(pepsDebugPath, debugLines.join('\n'));
    console.log(`[RosterGeneratorService] PEPS debug written to: ${pepsDebugPath}`);

    // Add free agents to fill template (from 5 years before)
    console.log('[RosterGeneratorService] Adding free agents to fill template...');
    const fullRoster = await this.addFreeAgents(year, enrichedPlayers);
    console.log('[RosterGeneratorService] Final roster with free agents:', fullRoster.length);

    return {
      players: fullRoster,
      metadata: {
        mode: 'single-year',
        year: year,
        teams: totalTeams,
        generatedAt: new Date().toISOString(),
        playerCount: fullRoster.length
      }
    };
  }

  /**
   * Generate all-time roster from year range
   * Now queries database directly via lookupService
   *
   * Algorithm:
   * 1. Collect all players from year range, deduplicate by PID keeping BEST year
   * 2. Build 32 team rosters (57-60 players each) from players' best teams
   * 3. Collect free agents from 5 years BEFORE start year with LAST year stats
   * 4. Fill template to 3000 total slots
   * 5. Validate NO DUPLICATES anywhere
   */
  private async generateAllTime(startYear: number, endYear: number): Promise<{ players: RosterPlayer[], metadata: any }> {
    console.log('[RosterGeneratorService] ===== GENERATING ALL-TIME ROSTER =====');
    console.log('[RosterGeneratorService] Year range:', startYear, '-', endYear);

    // PHASE 1: Global Player Collection & Deduplication
    console.log('\n[Phase 1] Collecting and deduplicating players from database...');

    const allDbPlayers: any[] = [];
    const allCustomPlayers: any[] = [];

    for (let y = startYear; y <= endYear; y++) {
      // Query database for each year
      const yearPlayers = lookupService.getAllPlayerSeasonsForYear(y);

      // BULK LOAD user edits for this year
      const userEditsMap = userDatabaseService.getAllSeasonEditsForYear(y);

      // BULK LOAD appearance edits (PID, PAM, PGHE, etc.)
      const appearanceEditsMap = userDatabaseService.getAllAppearanceEdits();

      // Merge user edits into players (ratings AND position/team/archetype)
      for (const player of yearPlayers) {
        if (player.playerId && userEditsMap.has(player.playerId)) {
          const userEdit = userEditsMap.get(player.playerId)!;
          // Apply ratings
          for (const [field, value] of Object.entries(userEdit.ratings)) {
            if (value !== null && value !== undefined) {
              player.ratings[field] = value;
            }
          }
          // Apply position/team/archetype overrides
          if (userEdit.position) player.position = userEdit.position;
          if (userEdit.team) player.team = userEdit.team;
          if (userEdit.archetype) player.archetype = userEdit.archetype;
        }

        // Merge appearance edits (PID, PAM, PLPO, PGHE, etc.)
        if (player.playerId && appearanceEditsMap.has(player.playerId)) {
          const appearanceEdit = appearanceEditsMap.get(player.playerId)!;
          if (appearanceEdit.maddenPid !== undefined) player.maddenPid = appearanceEdit.maddenPid;
          if (appearanceEdit.maddenPam !== undefined) player.maddenPam = appearanceEdit.maddenPam;
          if (appearanceEdit.maddenPlpo !== undefined) player.maddenPlpo = appearanceEdit.maddenPlpo;
          if (appearanceEdit.maddenPghe !== undefined) player.maddenPghe = appearanceEdit.maddenPghe;
          if (appearanceEdit.maddenPfcg !== undefined) player.maddenPfcg = appearanceEdit.maddenPfcg;
          if (appearanceEdit.maddenGpan !== undefined) player.maddenGpan = appearanceEdit.maddenGpan;
          if (appearanceEdit.maddenGslp !== undefined) player.maddenGslp = appearanceEdit.maddenGslp;
          if (appearanceEdit.maddenCpvf !== undefined) player.maddenCpvf = appearanceEdit.maddenCpvf;
          if (appearanceEdit.maddenSkinTone !== undefined) player.maddenSkinTone = appearanceEdit.maddenSkinTone;
          if (appearanceEdit.isGenericFace !== undefined) player.isGenericFace = appearanceEdit.isGenericFace;
          // FIX: Add portrait manager PIDs to validPIDs
          if (appearanceEdit.maddenPid && appearanceEdit.maddenPid > 0) {
            this.validPIDs.add(appearanceEdit.maddenPid);
          }
        }
      }

      allDbPlayers.push(...yearPlayers.map(p => ({ ...p, _year: y, _source: 'db' })));

      // Also get custom players for this year
      const customPlayers = this.rosterData.get(y) || [];
      allCustomPlayers.push(...customPlayers.map((p: any) => ({ ...p, _year: y, _source: 'custom' })));
    }

    // Build set of custom player names for override priority
    const customPlayerNames = new Set(
      allCustomPlayers.map((p: any) => `${p.First_Name}|${p.Last_Name}`)
    );

    // Filter out database players that have custom overrides
    const filteredDbPlayers = allDbPlayers.filter(p =>
      !customPlayerNames.has(`${p.firstName}|${p.lastName}`)
    );

    const allPlayers = [...filteredDbPlayers, ...allCustomPlayers];

    if (allPlayers.length === 0) {
      throw new Error(`No players found in year range ${startYear}-${endYear}`);
    }

    console.log('[Phase 1] Found', allDbPlayers.length, 'database player-years');
    console.log('[Phase 1] Found', allCustomPlayers.length, 'custom player-years');
    console.log('[Phase 1] Total after merge:', allPlayers.length, 'player-years in range');

    // Enrich all players - use correct method based on source
    const enrichedAll = await Promise.all(
      allPlayers.map(p => {
        if (p._source === 'custom') {
          return this.enrichPlayer(p, p._year);
        } else {
          return this.enrichPlayerFromDb(p, p._year);
        }
      })
    );

    // Deduplicate by firstName + lastName ONLY - keep BEST year (highest POVR)
    // This prevents same player from appearing multiple times due to position changes
    const deduplicatedPlayers = new Map<string, RosterPlayer>();
    enrichedAll.forEach(p => {
      // Use name only for deduplication - position changes across years shouldn't create duplicates
      const key = `${p.PFNA}|${p.PLNA}`;
      const existing = deduplicatedPlayers.get(key);
      // Keep player with highest POVR - their best season goes to their best team
      const pPOVR = p.POVR || 0;
      const existingPOVR = existing ? (existing.POVR || 0) : 0;
      if (!existing || pPOVR > existingPOVR) {
        deduplicatedPlayers.set(key, p);
      }
    });

    console.log('[Phase 1] Deduplicated:', enrichedAll.length, '→', deduplicatedPlayers.size, 'unique players');

    // DEBUG: Log key players to verify they're being kept correctly
    const keyPlayersToCheck = ['Joe|Montana', 'Adrian|Peterson', 'Steve|Young', 'Jerry|Rice', 'Tom|Brady'];
    keyPlayersToCheck.forEach(keyName => {
      deduplicatedPlayers.forEach((player, key) => {
        if (key.startsWith(keyName)) {
          console.log(`[Phase 1] KEY PLAYER: ${player.PFNA} ${player.PLNA} (${key})`);
          console.log(`  - POVR: ${player.POVR}, Team ID: ${player.TGID}, Position: ${player.PPOS}`);
        }
      });
    });

    // Group players by their best-year team
    const playersByTeam = new Map<number, RosterPlayer[]>();
    let playersWithTeam0 = 0;
    deduplicatedPlayers.forEach(player => {
      const teamId = player.TGID;
      if (teamId === 0) {
        playersWithTeam0++;
        // Log first few with TGID=0
        if (playersWithTeam0 <= 5) {
          console.log(`[Phase 1] ⚠️ Player with TGID=0: ${player.PFNA} ${player.PLNA} - POVR: ${player.POVR}`);
        }
      }
      if (!playersByTeam.has(teamId)) {
        playersByTeam.set(teamId, []);
      }
      playersByTeam.get(teamId)!.push(player);
    });

    if (playersWithTeam0 > 0) {
      console.log(`[Phase 1] ⚠️ WARNING: ${playersWithTeam0} players have TGID=0 (will not be assigned to any team!)`);
    }
    console.log('[Phase 1] Players grouped into', playersByTeam.size, 'teams');
    console.log('[Phase 1] Team IDs found:', Array.from(playersByTeam.keys()).sort((a, b) => a - b).join(', '));

    // PHASE 2: Build 32 Team Rosters
    console.log('\n[Phase 2] Building 32 team rosters (57-60 players each)...');

    const teamRosters: RosterPlayer[] = [];

    // team_lookup.csv uses IDs 1-32 (not 0-31!), so loop 1-32
    for (let teamId = 1; teamId <= 32; teamId++) {
      const teamPlayers = playersByTeam.get(teamId) || [];
      console.log(`[Team ${teamId}] Building roster from ${teamPlayers.length} available players`);

      const teamRoster = await this.buildTeamRoster(teamPlayers, teamId);

      teamRosters.push(...teamRoster);
      console.log(`[Team ${teamId}] Final roster: ${teamRoster.length} players`);
    }

    console.log('[Phase 2] Total team roster size:', teamRosters.length);

    // PHASE 3: Free Agent Pool - players from year range who didn't make team rosters
    console.log('\n[Phase 3] Collecting free agents from leftover players in year range...');

    // Get names of players who made team rosters (name only - position changes shouldn't matter)
    const teamRosterNames = new Set(teamRosters.map(p => `${p.PFNA}|${p.PLNA}`));

    // Leftover players are those in deduplicatedPlayers but not on team rosters
    const leftoverPlayers = Array.from(deduplicatedPlayers.values())
      .filter(p => !teamRosterNames.has(`${p.PFNA}|${p.PLNA}`));

    console.log('[Phase 3] Leftover players from year range:', leftoverPlayers.length);

    // Sort by POVR and take what we need to fill to 3000
    const targetSize = this.getTemplateRosterSize();
    const needed = targetSize - teamRosters.length;

    const freeAgents = leftoverPlayers
      .sort((a, b) => b.POVR - a.POVR)
      .slice(0, needed)
      .map(p => ({ ...p, TGID: 1009 })); // Assign to Free Agent team

    console.log('[Phase 3] Free agents added:', freeAgents.length);

    // PHASE 4: Combine and Fill Template
    const finalRoster = [...teamRosters, ...freeAgents];
    console.log('\n[Phase 4] Final roster size:', finalRoster.length);

    // PHASE 5: Validation
    console.log('\n[Phase 5] Validating roster...');
    this.validateNoDuplicates(finalRoster);
    console.log('[Phase 5] ✓ No duplicates found');
    console.log('[Phase 5] ✓ Roster generation complete');

    return {
      players: finalRoster,
      metadata: {
        mode: 'all-time',
        startYear: startYear,
        endYear: endYear,
        generatedAt: new Date().toISOString(),
        playerCount: finalRoster.length,
        teamPlayers: teamRosters.length,
        freeAgents: freeAgents.length
      }
    };
  }

  /**
   * Get random state (0-50)
   */
  private getRandomState(): number {
    return Math.floor(Math.random() * 51); // 0-50 (Alabama to Non-US)
  }

  /**
   * Get random college (1-264, skip 0=Blank and 265=No College)
   */
  private getRandomCollege(): number {
    // Return random college ID between 1 and 264 (skip 0=Blank)
    return Math.floor(Math.random() * 264) + 1; // 1-264
  }

  /**
   * Get position-specific physical attributes (height in inches, weight in pounds)
   */
  private getPositionPhysicals(position: string): { height: number, weight: number } {
    const ranges: Record<string, { minHeight: number, maxHeight: number, minWeight: number, maxWeight: number }> = {
      'QB': { minHeight: 73, maxHeight: 78, minWeight: 205, maxWeight: 235 },
      'HB': { minHeight: 68, maxHeight: 73, minWeight: 190, maxWeight: 225 },
      'FB': { minHeight: 71, maxHeight: 75, minWeight: 235, maxWeight: 260 },
      'WR': { minHeight: 70, maxHeight: 77, minWeight: 180, maxWeight: 220 },
      'TE': { minHeight: 74, maxHeight: 79, minWeight: 240, maxWeight: 270 },
      'LT': { minHeight: 75, maxHeight: 80, minWeight: 295, maxWeight: 340 },
      'LG': { minHeight: 74, maxHeight: 78, minWeight: 300, maxWeight: 335 },
      'C': { minHeight: 73, maxHeight: 77, minWeight: 290, maxWeight: 320 },
      'RG': { minHeight: 74, maxHeight: 78, minWeight: 300, maxWeight: 335 },
      'RT': { minHeight: 75, maxHeight: 80, minWeight: 295, maxWeight: 340 },
      'DT': { minHeight: 73, maxHeight: 78, minWeight: 285, maxWeight: 330 },
      'LEDG': { minHeight: 73, maxHeight: 78, minWeight: 250, maxWeight: 285 },
      'REDG': { minHeight: 73, maxHeight: 78, minWeight: 250, maxWeight: 285 },
      'SAM': { minHeight: 72, maxHeight: 76, minWeight: 230, maxWeight: 260 },
      'MIKE': { minHeight: 72, maxHeight: 76, minWeight: 230, maxWeight: 260 },
      'WILL': { minHeight: 72, maxHeight: 76, minWeight: 225, maxWeight: 255 },
      'CB': { minHeight: 69, maxHeight: 74, minWeight: 180, maxWeight: 210 },
      'FS': { minHeight: 70, maxHeight: 75, minWeight: 195, maxWeight: 220 },
      'SS': { minHeight: 70, maxHeight: 74, minWeight: 200, maxWeight: 225 },
      'K': { minHeight: 70, maxHeight: 75, minWeight: 175, maxWeight: 215 },
      'P': { minHeight: 71, maxHeight: 76, minWeight: 185, maxWeight: 225 },
      'LS': { minHeight: 72, maxHeight: 77, minWeight: 230, maxWeight: 265 }
    };

    const range = ranges[position] || { minHeight: 72, maxHeight: 76, minWeight: 200, maxWeight: 240 };
    const height = Math.floor(Math.random() * (range.maxHeight - range.minHeight + 1)) + range.minHeight;
    const weight = Math.floor(Math.random() * (range.maxWeight - range.minWeight + 1)) + range.minWeight;
    return { height, weight };
  }

  /**
   * Generate random player names from ALL_PLAYER_LOOKUP.csv data
   */
  private generateRandomName(): { firstName: string, lastName: string } {
    // Use real names loaded from ALL_PLAYER_LOOKUP.csv
    const firstName = this.realFirstNames[Math.floor(Math.random() * this.realFirstNames.length)];
    const lastName = this.realLastNames[Math.floor(Math.random() * this.realLastNames.length)];

    return { firstName, lastName };
  }

  /**
   * Generate random low OVR players for teams that didn't exist in year range
   * Uses generic faces from PID_Portrait_Mapping.csv
   */
  private async generateRandomPlayers(teamId: number, count: number): Promise<RosterPlayer[]> {
    const players: RosterPlayer[] = [];

    // Generate players following position distribution
    const positionsToFill: { position: string, posCode: number, count: number }[] = [
      { position: 'QB', posCode: 0, count: 3 },
      { position: 'HB', posCode: 1, count: 4 },
      { position: 'FB', posCode: 2, count: 1 },
      { position: 'WR', posCode: 3, count: 5 },
      { position: 'TE', posCode: 4, count: 3 },
      { position: 'LT', posCode: 5, count: 2 },
      { position: 'LG', posCode: 6, count: 2 },
      { position: 'C', posCode: 7, count: 2 },
      { position: 'RG', posCode: 8, count: 2 },
      { position: 'RT', posCode: 9, count: 2 },
      { position: 'LEDG', posCode: 10, count: 2 },
      { position: 'REDG', posCode: 11, count: 3 },
      { position: 'DT', posCode: 12, count: 3 },
      { position: 'SAM', posCode: 13, count: 2 },
      { position: 'MIKE', posCode: 14, count: 3 },
      { position: 'WILL', posCode: 15, count: 2 },
      { position: 'CB', posCode: 16, count: 5 },
      { position: 'FS', posCode: 17, count: 2 },
      { position: 'SS', posCode: 18, count: 2 },
      { position: 'K', posCode: 19, count: 1 },
      { position: 'P', posCode: 20, count: 1 }
    ];

    let playerIndex = 1;

    for (const { position, posCode, count: posCount } of positionsToFill) {
      for (let i = 0; i < posCount && players.length < count; i++) {
        // Random race for this player
        const fillerRace = Math.floor(Math.random() * 7) + 1; // Random race 1-7

        // Assign generic face that matches race
        const genericFace = this.selectGenericFaceByRace(fillerRace);
        // DON'T SET PSKI - BLBM GENR/SKNT controls face appearance

        // Generate random low OVR (50-65)
        const ovr = Math.floor(Math.random() * 16) + 50;

        // Random age 23-27
        const age = Math.floor(Math.random() * 5) + 23;

        // Generate positional ratings based on OVR
        const baseRating = ovr - 5;
        const variance = 10;

        // Generate random name
        const { firstName, lastName } = this.generateRandomName();

        // Get position-specific physical attributes
        const { height, weight } = this.getPositionPhysicals(position);

        // Get random college and state
        const college = this.getRandomCollege();
        const state = this.getRandomState();

        const player: RosterPlayer = {
          PFNA: firstName,
          PLNA: lastName,
          PPOS: posCode,
          PJEN: Math.floor(Math.random() * 99) + 1,
          PAGE: age,
          PHGT: height,
          PWGT: weight - 159, // Madden stores weight as (actual - 159)
          TGID: teamId,
          PSXP: genericFace.pid,
          PLPL: 0, // Generic face marker
          PEPS: genericFace.pam, // GENR from PGHE lookup - matched set with PSXP and PGHE
          POID: 0, // Filler players have no Presentation ID
          PCMT: lookupService.getCommentaryId(lastName) || 0, // Commentary ID - looked up by last name
          // DON'T SET PSKI - BLBM handles it
          PGHE: genericFace.pghe,
          // CRITICAL: PLRC must match GENR first digit for consistent skin tone
          PLRC: parseInt(genericFace.pam.match(/^gen_(\d+)/)?.[1] || '1') || fillerRace,
          _race: fillerRace, // Race for BLBM GENR/SKNT assignment
          PCOL: college,
          PHSN: state,
          POVR: ovr,
          PSPD: baseRating + Math.floor(Math.random() * variance),
          PACC: baseRating + Math.floor(Math.random() * variance),
          PSTR: baseRating + Math.floor(Math.random() * variance),
          PAGI: baseRating + Math.floor(Math.random() * variance),
          PAWR: baseRating + Math.floor(Math.random() * variance),
          PCTH: baseRating + Math.floor(Math.random() * variance),
          PCAR: baseRating + Math.floor(Math.random() * variance),
          PTHP: baseRating + Math.floor(Math.random() * variance),
          PKPW: baseRating + Math.floor(Math.random() * variance),
          PKAC: baseRating + Math.floor(Math.random() * variance),
          PRBK: baseRating + Math.floor(Math.random() * variance),
          PPBK: baseRating + Math.floor(Math.random() * variance),
          PTAK: baseRating + Math.floor(Math.random() * variance),
          PBTK: baseRating + Math.floor(Math.random() * variance),
          PJMP: baseRating + Math.floor(Math.random() * variance),
          PINJ: 90,
          PSTA: 90,
          PTGH: 85,
          PTRK: baseRating + Math.floor(Math.random() * variance),
          PCOD: baseRating + Math.floor(Math.random() * variance),
          PBCV: baseRating + Math.floor(Math.random() * variance),
          PSTF: baseRating + Math.floor(Math.random() * variance),
          PSPM: baseRating + Math.floor(Math.random() * variance),
          PJUM: baseRating + Math.floor(Math.random() * variance),
          PIBL: baseRating + Math.floor(Math.random() * variance),
          PRBP: baseRating + Math.floor(Math.random() * variance),
          PRBF: baseRating + Math.floor(Math.random() * variance),
          PPBP: baseRating + Math.floor(Math.random() * variance),
          PPBF: baseRating + Math.floor(Math.random() * variance),
          PLDB: baseRating + Math.floor(Math.random() * variance),
          PBRS: baseRating + Math.floor(Math.random() * variance),
          PTUP: baseRating + Math.floor(Math.random() * variance),
          PPWM: baseRating + Math.floor(Math.random() * variance),
          PFNM: baseRating + Math.floor(Math.random() * variance),
          PBSH: baseRating + Math.floor(Math.random() * variance),
          PPUR: baseRating + Math.floor(Math.random() * variance),
          PPRC: baseRating + Math.floor(Math.random() * variance),
          PMCV: baseRating + Math.floor(Math.random() * variance),
          PZCV: baseRating + Math.floor(Math.random() * variance),
          PSPC: baseRating + Math.floor(Math.random() * variance),
          PCIT: baseRating + Math.floor(Math.random() * variance),
          PSRR: baseRating + Math.floor(Math.random() * variance),
          PMRR: baseRating + Math.floor(Math.random() * variance),
          PDRR: baseRating + Math.floor(Math.random() * variance),
          PHTP: baseRating + Math.floor(Math.random() * variance),
          PPRS: baseRating + Math.floor(Math.random() * variance),
          PREL: baseRating + Math.floor(Math.random() * variance),
          PTAS: baseRating + Math.floor(Math.random() * variance),
          PTAM: baseRating + Math.floor(Math.random() * variance),
          PTAD: baseRating + Math.floor(Math.random() * variance),
          PPLA: baseRating + Math.floor(Math.random() * variance),
          PTOR: 50,
          PKRT: baseRating + Math.floor(Math.random() * variance),
          PHAN: 0, // Right-handed (0=Right, 1=Left)
          PPTI: this.getDefaultArchetype(position),
          PROL: 0, // Dev trait: Normal (0=Normal, 1=Star, 2=Superstar, 3=X-Factor)
          PBTY: 'Athletic',
          PYRS: 0,
          PFHO: 0,
          PHTC: 0,
          PYER: 2024
        } as RosterPlayer;

        // CRITICAL: Sync archetype based on player attributes
        // This ensures PLTY matches the correct archetype for the position
        const syncedPlayer = ArchetypeSyncService.syncArchetypeFromAttributes(player, position);
        players.push(syncedPlayer);
        playerIndex++;
      }
    }

    return players;
  }

  /**
   * Build roster for a single team (57-60 players)
   *
   * 1. Fill position limits (47 players)
   * 2. Add depth/ST players (10-13 more)
   * 3. Total: 57-60 players
   */
  private async buildTeamRoster(teamPlayers: RosterPlayer[], teamId: number): Promise<RosterPlayer[]> {
    const roster: RosterPlayer[] = [];
    const usedPIDs = new Set<number>();

    // Step 1: Fill position limits (47 total)
    // HOF players get priority over non-HOF players at same position
    Object.entries(POSITION_LIMITS).forEach(([position, limit]) => {
      const posPlayers = teamPlayers
        .filter(p => (p as any)._position === position && !usedPIDs.has(p.PSXP))
        .sort((a, b) => {
          // HOF players get priority
          const aHOF = (a as any)._isHOF ? 1 : 0;
          const bHOF = (b as any)._isHOF ? 1 : 0;
          if (bHOF !== aHOF) return bHOF - aHOF;
          // Then sort by OVR
          return b.POVR - a.POVR;
        })
        .slice(0, limit);

      posPlayers.forEach(p => {
        roster.push(p);
        usedPIDs.add(p.PSXP);
      });
    });

    // Log HOF players placed on this team
    const hofOnTeam = roster.filter(p => (p as any)._isHOF);
    if (hofOnTeam.length > 0) {
      console.log(`[Team ${teamId}] HOF players on roster: ${hofOnTeam.map(p => `${p.PFNA} ${p.PLNA} (${(p as any)._position}, OVR ${p.POVR})`).join(', ')}`);
    }
    console.log(`[Team ${teamId}] Position limits filled: ${roster.length} players`);

    // Step 2: Add depth players to reach 57-60
    // HOF players still get priority for depth spots
    const targetSize = 60; // Aim for 60 per team
    const remaining = teamPlayers
      .filter(p => !usedPIDs.has(p.PSXP))
      .sort((a, b) => {
        // HOF players get priority
        const aHOF = (a as any)._isHOF ? 1 : 0;
        const bHOF = (b as any)._isHOF ? 1 : 0;
        if (bHOF !== aHOF) return bHOF - aHOF;
        // Then sort by OVR
        return b.POVR - a.POVR;
      });

    const neededDepth = targetSize - roster.length;
    const depthPlayers = remaining.slice(0, neededDepth);

    depthPlayers.forEach(p => {
      roster.push(p);
      usedPIDs.add(p.PSXP);
    });

    console.log(`[Team ${teamId}] Added ${depthPlayers.length} depth players`);

    // If team still short of 57, generate random low OVR players
    if (roster.length < 57) {
      console.log(`[Team ${teamId}] Only ${roster.length} players - filling with randomly generated low OVR players`);
      const randomPlayers = await this.generateRandomPlayers(teamId, 60 - roster.length);
      roster.push(...randomPlayers);
      console.log(`[Team ${teamId}] Added ${randomPlayers.length} random players`);
    }

    return roster;
  }

  /**
   * Collect free agents from 5 years BEFORE start year with LAST year stats
   */
  private async collectFreeAgents(startYear: number, teamRosters: RosterPlayer[]): Promise<RosterPlayer[]> {
    const freeAgentsByKey = new Map<string, RosterPlayer>();

    // Build set of players already on team rosters (firstName|lastName only - ignore position)
    const rosterPlayerNames = new Set(
      teamRosters.map(p => `${p.PFNA}|${p.PLNA}`)
    );

    // Scan 5 years BEFORE the selected range - query database
    // BULK LOAD appearance edits ONCE (not per-year)
    const appearanceEditsMapFA = userDatabaseService.getAllAppearanceEdits();

    for (let y = startYear - 5; y < startYear; y++) {
      const yearPlayers = lookupService.getAllPlayerSeasonsForYear(y);

      // BULK LOAD user edits for this year
      const userEditsMap = userDatabaseService.getAllSeasonEditsForYear(y);

      // Merge user edits into players (ratings AND position/team/archetype)
      for (const player of yearPlayers) {
        if (player.playerId && userEditsMap.has(player.playerId)) {
          const userEdit = userEditsMap.get(player.playerId)!;
          // Apply ratings
          for (const [field, value] of Object.entries(userEdit.ratings)) {
            if (value !== null && value !== undefined) {
              player.ratings[field] = value;
            }
          }
          // Apply position/team/archetype overrides
          if (userEdit.position) player.position = userEdit.position;
          if (userEdit.team) player.team = userEdit.team;
          if (userEdit.archetype) player.archetype = userEdit.archetype;
        }

        // Merge appearance edits (PID, PAM, PLPO, PGHE, etc.)
        if (player.playerId && appearanceEditsMapFA.has(player.playerId)) {
          const appearanceEdit = appearanceEditsMapFA.get(player.playerId)!;
          if (appearanceEdit.maddenPid !== undefined) player.maddenPid = appearanceEdit.maddenPid;
          if (appearanceEdit.maddenPam !== undefined) player.maddenPam = appearanceEdit.maddenPam;
          if (appearanceEdit.maddenPlpo !== undefined) player.maddenPlpo = appearanceEdit.maddenPlpo;
          if (appearanceEdit.maddenPghe !== undefined) player.maddenPghe = appearanceEdit.maddenPghe;
          if (appearanceEdit.maddenPfcg !== undefined) player.maddenPfcg = appearanceEdit.maddenPfcg;
          if (appearanceEdit.maddenGpan !== undefined) player.maddenGpan = appearanceEdit.maddenGpan;
          if (appearanceEdit.maddenGslp !== undefined) player.maddenGslp = appearanceEdit.maddenGslp;
          if (appearanceEdit.maddenCpvf !== undefined) player.maddenCpvf = appearanceEdit.maddenCpvf;
          if (appearanceEdit.maddenSkinTone !== undefined) player.maddenSkinTone = appearanceEdit.maddenSkinTone;
          if (appearanceEdit.isGenericFace !== undefined) player.isGenericFace = appearanceEdit.isGenericFace;
          // FIX: Add portrait manager PIDs to validPIDs
          if (appearanceEdit.maddenPid && appearanceEdit.maddenPid > 0) {
            this.validPIDs.add(appearanceEdit.maddenPid);
          }
        }
      }

      for (const dbRow of yearPlayers) {
        const enriched = await this.enrichPlayerFromDb(dbRow, y);

        // Skip if already on a team roster (same name, any position)
        const nameKey = `${enriched.PFNA}|${enriched.PLNA}`;
        if (rosterPlayerNames.has(nameKey)) {
          continue;
        }

        // Keep LAST year (most recent) for each free agent player
        // Use their final season stats and age
        const existing = freeAgentsByKey.get(nameKey);
        const enrichedYear = (enriched as any)._year || 0;
        const existingYear = existing ? ((existing as any)._year || 0) : 0;
        if (!existing || enrichedYear > existingYear) {
          freeAgentsByKey.set(nameKey, enriched);
        }
      }
    }

    // Convert to array and sort by POVR (from their last year)
    const freeAgents = Array.from(freeAgentsByKey.values())
      .sort((a, b) => b.POVR - a.POVR);

    // Fill to template size
    const targetSize = this.getTemplateRosterSize();
    const currentSize = teamRosters.length;
    const needed = targetSize - currentSize;

    console.log(`[collectFreeAgents] Need ${needed} free agents to reach ${targetSize}`);

    // Assign all free agents to team ID 1009 (Free Agent)
    const finalFreeAgents = freeAgents.slice(0, needed).map(fa => ({
      ...fa,
      TGID: 1009  // Free Agent team ID
    }));

    return finalFreeAgents;
  }

  /**
   * Validate no duplicate players in roster (for debugging only)
   * NOTE: Duplicates are logged as warnings but do NOT fail the roster
   */
  private validateNoDuplicates(roster: RosterPlayer[]): void {
    // Check for duplicate real players (same firstName + lastName - position changes don't matter)
    // Generic face PIDs can repeat - that's normal
    const playerKeys = new Map<string, RosterPlayer[]>();

    roster.forEach(player => {
      // Use name only - same player with different positions is still a duplicate
      const key = `${player.PFNA}|${player.PLNA}`;
      const existing = playerKeys.get(key) || [];
      existing.push(player);
      playerKeys.set(key, existing);
    });

    const duplicates = Array.from(playerKeys.entries())
      .filter(([key, players]) => players.length > 1);

    if (duplicates.length > 0) {
      console.warn('[validateNoDuplicates] ⚠️  DUPLICATE PLAYERS FOUND (for debugging):');
      duplicates.forEach(([key, players]) => {
        console.warn(`  "${players[0].PFNA} ${players[0].PLNA}": appears ${players.length} times at positions: ${players.map(p => p.PPOS).join(', ')}`);
        players.forEach((p, i) => {
          console.warn(`    ${i + 1}. Team ${p.TGID}, Position ${p.PPOS}, OVR ${p.POVR}, PID ${p.PSXP}`);
        });
      });
      console.warn(`[validateNoDuplicates] Total duplicates: ${duplicates.length} (these should have been deduplicated earlier)`);
    } else {
      console.log('[validateNoDuplicates] ✓ No duplicate players found');
    }
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
   * IMPORTANT: Free agents use LAST year stats, not best year!
   */
  private async addFreeAgents(year: number, currentRoster: RosterPlayer[]): Promise<RosterPlayer[]> {
    console.log('\n========== FREE AGENT BACKFILL ==========');
    console.log('[RosterGeneratorService] Target year:', year);
    console.log('[RosterGeneratorService] Current roster size:', currentRoster.length);

    // Use NAME-based deduplication since PIDs may all be 0
    const currentPlayerNames = new Set(currentRoster.map(p => `${p.PFNA}|${p.PLNA}`));
    const freeAgentRawByName = new Map<string, any>();

    // Look back 5 years - query database directly
    console.log('[RosterGeneratorService] Searching for free agents in years', year - 5, 'to', year - 1, '...');

    // BULK LOAD appearance edits ONCE (not per-year)
    const appearanceEditsMapFA2 = userDatabaseService.getAllAppearanceEdits();

    for (let y = year - 5; y < year; y++) {
      const yearPlayers = lookupService.getAllPlayerSeasonsForYear(y);
      console.log(`[RosterGeneratorService]   Year ${y}: ${yearPlayers.length} players in database`);

      // BULK LOAD user edits for this year
      const userEditsMap = userDatabaseService.getAllSeasonEditsForYear(y);

      // Merge user edits into players (ratings AND position/team/archetype)
      for (const player of yearPlayers) {
        if (player.playerId && userEditsMap.has(player.playerId)) {
          const userEdit = userEditsMap.get(player.playerId)!;
          // Apply ratings
          for (const [field, value] of Object.entries(userEdit.ratings)) {
            if (value !== null && value !== undefined) {
              player.ratings[field] = value;
            }
          }
          // Apply position/team/archetype overrides
          if (userEdit.position) player.position = userEdit.position;
          if (userEdit.team) player.team = userEdit.team;
          if (userEdit.archetype) player.archetype = userEdit.archetype;
        }

        // Merge appearance edits (PID, PAM, PLPO, PGHE, etc.)
        if (player.playerId && appearanceEditsMapFA2.has(player.playerId)) {
          const appearanceEdit = appearanceEditsMapFA2.get(player.playerId)!;
          if (appearanceEdit.maddenPid !== undefined) player.maddenPid = appearanceEdit.maddenPid;
          if (appearanceEdit.maddenPam !== undefined) player.maddenPam = appearanceEdit.maddenPam;
          if (appearanceEdit.maddenPlpo !== undefined) player.maddenPlpo = appearanceEdit.maddenPlpo;
          if (appearanceEdit.maddenPghe !== undefined) player.maddenPghe = appearanceEdit.maddenPghe;
          if (appearanceEdit.maddenPfcg !== undefined) player.maddenPfcg = appearanceEdit.maddenPfcg;
          if (appearanceEdit.maddenGpan !== undefined) player.maddenGpan = appearanceEdit.maddenGpan;
          if (appearanceEdit.maddenGslp !== undefined) player.maddenGslp = appearanceEdit.maddenGslp;
          if (appearanceEdit.maddenCpvf !== undefined) player.maddenCpvf = appearanceEdit.maddenCpvf;
          if (appearanceEdit.maddenSkinTone !== undefined) player.maddenSkinTone = appearanceEdit.maddenSkinTone;
          if (appearanceEdit.isGenericFace !== undefined) player.isGenericFace = appearanceEdit.isGenericFace;
          // FIX: Add portrait manager PIDs to validPIDs
          if (appearanceEdit.maddenPid && appearanceEdit.maddenPid > 0) {
            this.validPIDs.add(appearanceEdit.maddenPid);
          }
        }
      }

      // Filter FIRST before enriching
      yearPlayers.forEach((p: any) => {
        const firstName = p.firstName || '';
        const lastName = p.lastName || '';
        const nameKey = `${firstName}|${lastName}`;

        if (nameKey && nameKey !== '|' && !currentPlayerNames.has(nameKey)) {
          const existing = freeAgentRawByName.get(nameKey);
          const pYear = y;
          const existingYear = existing ? (existing._year || 0) : 0;

          // Keep the player from the LAST year (most recent)
          if (!existing || pYear > existingYear) {
            freeAgentRawByName.set(nameKey, { ...p, _year: pYear });
          }
        }
      });
    }

    console.log('[RosterGeneratorService] ✓ Found', freeAgentRawByName.size, 'unique free agents from 5-year lookback');

    const targetSize = this.getTemplateRosterSize();
    const needed = targetSize - currentRoster.length;

    console.log('[RosterGeneratorService] Target roster size:', targetSize);
    console.log('[RosterGeneratorService] Players needed:', needed);

    if (needed <= 0) {
      console.log('[RosterGeneratorService] ✓ Roster already at target size - no free agents needed');
      console.log('==========================================\n');
      return currentRoster.slice(0, targetSize);
    }

    // Sort raw data by POVR and take only what we need
    const sortedRaw = Array.from(freeAgentRawByName.values())
      .sort((a, b) => (b.ratings?.POVR || 0) - (a.ratings?.POVR || 0))
      .slice(0, needed);

    console.log('[RosterGeneratorService] ⚙ Enriching', sortedRaw.length, 'free agents from database...');

    // NOW enrich only the players we're actually going to use
    const enrichedFAs = await Promise.all(
      sortedRaw.map(async (p: any) => {
        const enriched = await this.enrichPlayerFromDb(p, p._year || year);
        // CRITICAL: Set TGID to 1009 (Free Agents) AFTER enriching
        enriched.TGID = 1009;
        return enriched;
      })
    );

    console.log('[RosterGeneratorService] ✓ Added', enrichedFAs.length, 'free agents from historical data');

    // DEBUG: Check PPOS values on enriched free agents
    if (enrichedFAs.length > 0) {
      console.log('[RosterGeneratorService] Sample enriched FA PPOS values:');
      enrichedFAs.slice(0, 3).forEach((p: any, i) => {
        console.log(`  FA ${i + 1}: ${p.PFNA} ${p.PLNA} - PPOS: ${p.PPOS} (type: ${typeof p.PPOS})`);
      });
    }

    // If still not enough, generate random low-tier players to fill template
    const finalRoster = [...currentRoster, ...enrichedFAs];
    const stillNeeded = targetSize - finalRoster.length;

    if (stillNeeded > 0) {
      console.log('[RosterGeneratorService] ⚠ Still need', stillNeeded, 'more players to reach target');
      console.log('[RosterGeneratorService] ⚙ Generating', stillNeeded, 'random low-tier players (40-55 OVR)...');

      for (let i = 0; i < stillNeeded; i++) {
        const randomPlayer = await this.generateRandomPlayer(year);
        finalRoster.push(randomPlayer);
      }

      console.log('[RosterGeneratorService] ✓ Generated', stillNeeded, 'random low-tier players');
    } else {
      console.log('[RosterGeneratorService] ✓ Roster complete - no random generation needed');
    }

    console.log('[RosterGeneratorService] ========================================');
    console.log('[RosterGeneratorService] FINAL ROSTER COMPOSITION:');
    console.log('[RosterGeneratorService]   Real players (from year data):', currentRoster.length);
    console.log('[RosterGeneratorService]   Free agents (from 5-year lookback):', enrichedFAs.length);
    console.log('[RosterGeneratorService]   Random generated players:', stillNeeded > 0 ? stillNeeded : 0);
    console.log('[RosterGeneratorService]   TOTAL:', finalRoster.length, '/', targetSize);
    console.log('[RosterGeneratorService] ========================================\n');

    return finalRoster;
  }

  /**
   * Generate a random low-tier player to fill template slots
   * Used when not enough real free agents exist
   */
  async generateRandomPlayer(year: number): Promise<RosterPlayer> {
    // Random position (weighted towards common positions)
    const positions = [0, 1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
    const positionCode = positions[Math.floor(Math.random() * positions.length)];

    // Random name from common names
    const firstNames = ['John', 'Mike', 'Chris', 'Dave', 'Tom', 'Dan', 'Jim', 'Steve', 'Mark', 'Paul'];
    const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Davis', 'Miller', 'Wilson', 'Moore', 'Taylor'];
    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];

    // Low-tier stats (40-55 OVR range)
    const baseRating = 40 + Math.floor(Math.random() * 16); // 40-55

    // Map position code to name
    const positionMap: Record<number, string> = {
      0: 'QB', 1: 'HB', 2: 'FB', 3: 'WR', 4: 'TE',
      5: 'LT', 6: 'LG', 7: 'C', 8: 'RG', 9: 'RT',
      10: 'LEDG', 11: 'REDG', 12: 'DT',
      13: 'SAM', 14: 'MIKE', 15: 'WILL',
      16: 'CB', 17: 'FS', 18: 'SS',
      19: 'K', 20: 'P', 21: 'LS'
    };

    // Select a complete generic face (PID, PAM, PGHE) that matches race
    const positionName = positionMap[positionCode] || 'WR';
    const fillerRace = Math.floor(Math.random() * 7) + 1; // Random race 1-7
    const genericFace = this.selectGenericFaceByRace(fillerRace);
    // DON'T SET PSKI - BLBM GENR/SKNT controls face appearance

    const player = {
      firstName: firstName,
      lastName: lastName,
      position: positionName,
      jerseyNum: Math.floor(Math.random() * 99) + 1,
      age: 23 + Math.floor(Math.random() * 5), // 23-27
      heightInches: 70 + Math.floor(Math.random() * 10), // 70-79 inches
      weight: 180 + Math.floor(Math.random() * 80), // 180-259 lbs
      team: 'FA',

      // IDs - For generic faces: PLPL=0 (number), use GENR from PGHE lookup
      PID: genericFace.pid,
      PAM: 0,  // Generic faces use 0 (number) for PLPL
      PEPS: genericFace.pam,  // GENR from PGHE lookup - matched set with pid and pghe
      POID: 0,  // Filler players have no Presentation ID
      PCMT: lookupService.getCommentaryId(lastName) || 0,  // Commentary ID - looked up by last name

      // College & Home - Skip ID 0 (Blank), use 1-264 (real colleges)
      college: Math.floor(Math.random() * 264) + 1,  // 1-264 (skip 0=Blank, 265=No College)
      homeState: Math.floor(Math.random() * 50),

      // Ratings (all fields with baseRating ± 5 variance)
      POVR: baseRating,
      PSPD: Math.max(30, Math.min(99, baseRating + Math.floor(Math.random() * 11) - 5)),
      PACC: Math.max(30, Math.min(99, baseRating + Math.floor(Math.random() * 11) - 5)),
      PSTR: Math.max(30, Math.min(99, baseRating + Math.floor(Math.random() * 11) - 5)),
      PAGI: Math.max(30, Math.min(99, baseRating + Math.floor(Math.random() * 11) - 5)),
      PAWR: Math.max(30, Math.min(99, baseRating + Math.floor(Math.random() * 11) - 5)),
      PCTH: Math.max(30, Math.min(99, baseRating + Math.floor(Math.random() * 11) - 5)),
      PCAR: Math.max(30, Math.min(99, baseRating + Math.floor(Math.random() * 11) - 5)),
      PTHP: Math.max(30, Math.min(99, baseRating + Math.floor(Math.random() * 11) - 5)),
      PKPW: Math.max(30, Math.min(99, baseRating + Math.floor(Math.random() * 11) - 5)),
      PKAC: Math.max(30, Math.min(99, baseRating + Math.floor(Math.random() * 11) - 5)),
      PRBK: Math.max(30, Math.min(99, baseRating + Math.floor(Math.random() * 11) - 5)),
      PPBK: Math.max(30, Math.min(99, baseRating + Math.floor(Math.random() * 11) - 5)),
      PTAK: Math.max(30, Math.min(99, baseRating + Math.floor(Math.random() * 11) - 5)),
      PBTK: Math.max(30, Math.min(99, baseRating + Math.floor(Math.random() * 11) - 5)),
      PJMP: Math.max(30, Math.min(99, baseRating + Math.floor(Math.random() * 11) - 5)),
      PINJ: Math.max(30, Math.min(99, baseRating + Math.floor(Math.random() * 11) - 5)),
      PSTA: Math.max(30, Math.min(99, baseRating + Math.floor(Math.random() * 11) - 5)),
      PTGH: Math.max(30, Math.min(99, baseRating + Math.floor(Math.random() * 11) - 5)),
      PTRK: Math.max(30, Math.min(99, baseRating + Math.floor(Math.random() * 11) - 5)),
      PCOD: Math.max(30, Math.min(99, baseRating + Math.floor(Math.random() * 11) - 5)),
      PBCV: Math.max(30, Math.min(99, baseRating + Math.floor(Math.random() * 11) - 5)),
      PSTF: Math.max(30, Math.min(99, baseRating + Math.floor(Math.random() * 11) - 5)),
      PSPM: Math.max(30, Math.min(99, baseRating + Math.floor(Math.random() * 11) - 5)),
      PJUM: Math.max(30, Math.min(99, baseRating + Math.floor(Math.random() * 11) - 5)),
      PIBL: Math.max(30, Math.min(99, baseRating + Math.floor(Math.random() * 11) - 5)),
      PRBP: Math.max(30, Math.min(99, baseRating + Math.floor(Math.random() * 11) - 5)),
      PRBF: Math.max(30, Math.min(99, baseRating + Math.floor(Math.random() * 11) - 5)),
      PPBP: Math.max(30, Math.min(99, baseRating + Math.floor(Math.random() * 11) - 5)),
      PPBF: Math.max(30, Math.min(99, baseRating + Math.floor(Math.random() * 11) - 5)),
      PLDB: Math.max(30, Math.min(99, baseRating + Math.floor(Math.random() * 11) - 5)),
      PBRS: Math.max(30, Math.min(99, baseRating + Math.floor(Math.random() * 11) - 5)),
      PTUP: Math.max(30, Math.min(99, baseRating + Math.floor(Math.random() * 11) - 5)),
      PPWM: Math.max(30, Math.min(99, baseRating + Math.floor(Math.random() * 11) - 5)),
      PFNM: Math.max(30, Math.min(99, baseRating + Math.floor(Math.random() * 11) - 5)),
      PBSH: Math.max(30, Math.min(99, baseRating + Math.floor(Math.random() * 11) - 5)),
      PPUR: Math.max(30, Math.min(99, baseRating + Math.floor(Math.random() * 11) - 5)),
      PPRC: Math.max(30, Math.min(99, baseRating + Math.floor(Math.random() * 11) - 5)),
      PMCV: Math.max(30, Math.min(99, baseRating + Math.floor(Math.random() * 11) - 5)),
      PZCV: Math.max(30, Math.min(99, baseRating + Math.floor(Math.random() * 11) - 5)),
      PSPC: Math.max(30, Math.min(99, baseRating + Math.floor(Math.random() * 11) - 5)),
      PCIT: Math.max(30, Math.min(99, baseRating + Math.floor(Math.random() * 11) - 5)),
      PSRR: Math.max(30, Math.min(99, baseRating + Math.floor(Math.random() * 11) - 5)),
      PMRR: Math.max(30, Math.min(99, baseRating + Math.floor(Math.random() * 11) - 5)),
      PDRR: Math.max(30, Math.min(99, baseRating + Math.floor(Math.random() * 11) - 5)),
      PHTP: Math.max(30, Math.min(99, baseRating + Math.floor(Math.random() * 11) - 5)),
      PPRS: Math.max(30, Math.min(99, baseRating + Math.floor(Math.random() * 11) - 5)),
      PREL: Math.max(30, Math.min(99, baseRating + Math.floor(Math.random() * 11) - 5)),
      PTAS: Math.max(30, Math.min(99, baseRating + Math.floor(Math.random() * 11) - 5)),
      PTAM: Math.max(30, Math.min(99, baseRating + Math.floor(Math.random() * 11) - 5)),
      PTAD: Math.max(30, Math.min(99, baseRating + Math.floor(Math.random() * 11) - 5)),
      PPLA: Math.max(30, Math.min(99, baseRating + Math.floor(Math.random() * 11) - 5)),
      PTOR: Math.max(30, Math.min(99, baseRating + Math.floor(Math.random() * 11) - 5)),
      PKRT: Math.max(30, Math.min(99, baseRating + Math.floor(Math.random() * 11) - 5)),

      // Metadata
      TGID: 1009, // Free Agent team ID
      PFNA: firstName,
      PLNA: lastName,
      PPOS: positionCode,
      PAGE: 23 + Math.floor(Math.random() * 5),
      PSXP: genericFace.pid, // PID from race-matched generic face
      PHGT: 70 + Math.floor(Math.random() * 10),
      PWGT: 180 + Math.floor(Math.random() * 80),
      PCOL: Math.floor(Math.random() * 264) + 1,  // 1-264 (skip 0=Blank, 265=No College)
      PHSN: Math.floor(Math.random() * 50),
      PJEN: Math.floor(Math.random() * 99) + 1,
      PLTY: this.getDefaultArchetype(positionName), // Default archetype for position - will be synced below
      PYRP: Math.floor(Math.random() * 3) + 1, // Years Pro: 1-3 (rookie/young players)
      PCBT: this.determineFillerPCBT(positionCode), // Body type based on position (numeric)
      PTAR: this.determineFillerPTAR(positionCode), // Body type based on position (string)
      PGHE: genericFace.pghe, // Generic head ID from race-matched face
      // DON'T SET PSKI - BLBM handles it
      PLPL: 0, // Generic face marker (number, not string)
      // CRITICAL: PLRC must match GENR first digit for consistent skin tone
      PLRC: parseInt(genericFace.pam.match(/^gen_(\d+)/)?.[1] || '1') || fillerRace,
      _race: fillerRace, // Store race for BLBM GENR/SKNT assignment

      // Contract fields (Free Agent - minimum 1-year contract)
      // Use minimum salary - will be scaled appropriately when loaded into a roster
      // Default to very low value (~$100K = 10 in $10K units) - historical minimum
      PCON: 1,   // 1 year contract
      PCYL: 1,   // 1 year left
      PSBO: 0,   // No signing bonus
      PCSA: 10,  // Cap salary = $100K (historical minimum)
      PSA0: 10,  // Year 0 salary = $100K
      PSA1: 0, PSA2: 0, PSA3: 0, PSA4: 0, PSA5: 0, PSA6: 0,
      PSB0: 0, PSB1: 0, PSB2: 0, PSB3: 0, PSB4: 0, PSB5: 0, PSB6: 0,
    } as RosterPlayer;

    // CRITICAL: Sync archetype based on player attributes
    // This ensures PLTY matches the correct archetype for the position and attributes
    const syncedPlayer = ArchetypeSyncService.syncArchetypeFromAttributes(player, positionName);
    return syncedPlayer;
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
    // Strip pro-football-reference disambiguation markers (‡, †, *) from names FIRST
    const cleanFirstName = (csvRow.First_Name || '').replace(/[‡†*]+\d*/g, '').trim();
    const cleanLastName = (csvRow.Last_Name || '').replace(/[‡†*]+\d*/g, '').trim();

    // Map position string to position code (QB=0, HB=1, etc.) - DO THIS FIRST
    const positionCode = await this.lookupPositionCode(csvRow.Position);

    // Get mapped position name for archetype lookup
    const positionName = await this.getPositionName(positionCode);

    // Parse archetype to numeric (0-67) - use MAPPED position name
    const archetype = await this.parseArchetype(csvRow.Archetype, positionName);

    // Map team string to team code
    const teamCode = await this.lookupTeamCode(csvRow.Season_Team);

    // DEBUG: Log team lookup for key players
    if (csvRow.Last_Name === 'Montana' || csvRow.Last_Name === 'Unitas') {
      console.log(`[TEAM DEBUG] ${csvRow.First_Name} ${csvRow.Last_Name}: Season_Team="${csvRow.Season_Team}" -> teamCode=${teamCode} (year=${csvRow.Season || 'unknown'})`);
    }

    // Fill missing ratings from CSV
    const ratings = this.fillMissingRatings(csvRow);

    // Get player internal ID for user edit lookup (needed before PID handling)
    // CRITICAL: Use multiple lookup methods to find the player
    // Method 1: Direct name key lookup (fastest)
    const playerNameKey = `${cleanFirstName}|${cleanLastName}`;
    let playerInternalId = this.nameToInternalId.get(playerNameKey);

    // Method 2: If direct lookup fails, try case-insensitive lookup
    if (!playerInternalId) {
      const lowerKey = playerNameKey.toLowerCase();
      for (const [key, id] of this.nameToInternalId.entries()) {
        if (key.toLowerCase() === lowerKey) {
          playerInternalId = id;
          console.log(`[RosterGeneratorService] Found player via case-insensitive match: ${cleanFirstName} ${cleanLastName} -> ID ${id}`);
          break;
        }
      }
    }

    // Method 3: If still not found, try the database lookup service (handles fuzzy matching)
    if (!playerInternalId) {
      const bundledPlayer = lookupService.findPlayerByNameActiveInYear(cleanFirstName, cleanLastName, year);
      if (bundledPlayer?.internalId) {
        playerInternalId = bundledPlayer.internalId;
        console.log(`[RosterGeneratorService] Found player via DB lookup: ${cleanFirstName} ${cleanLastName} -> ID ${playerInternalId}`);
      }
    }

    // Debug: Log when player not found at all (for first 5 misses per generation)
    if (!playerInternalId && this.missedLookupCount < 5) {
      console.log(`[RosterGeneratorService] WARNING: Could not find internal ID for ${cleanFirstName} ${cleanLastName} (year ${year})`);
      this.missedLookupCount++;
    }

    // CRITICAL: Merge user-edited ratings from database
    // This ensures generators pull ratings that users have edited in the database browser
    if (playerInternalId) {
      const userSeasonEdit = userDatabaseService.getSeasonEdit(playerInternalId, year);
      if (userSeasonEdit?.ratings) {
        console.log(`[RosterGeneratorService] Merging user edits for ${csvRow.First_Name} ${csvRow.Last_Name} (year ${year}):`, Object.keys(userSeasonEdit.ratings));
        // Merge user edits into ratings - user edits override CSV values
        for (const [field, value] of Object.entries(userSeasonEdit.ratings)) {
          if (value !== null && value !== undefined) {
            (ratings as any)[field] = value;
          }
        }
      }
    }

    // CRITICAL: Get user bio edits and appearance edits for this player
    // This ensures bio fields (height, weight, college, homeState, etc.) and PID/PAM pushed from roster editor are used
    let userBioEdits: any = null;
    let userAppearanceEdits: any = null;
    if (playerInternalId) {
      userBioEdits = userDatabaseService.getPlayerEdit(playerInternalId);
      userAppearanceEdits = userDatabaseService.getAppearanceEdit(playerInternalId);
      if (userBioEdits || userAppearanceEdits) {
        console.log(`[RosterGeneratorService] Found user edits for ${csvRow.First_Name} ${csvRow.Last_Name}: bio=${!!userBioEdits}, appearance=${!!userAppearanceEdits}`);
        if (userBioEdits) {
          console.log(`  Bio edits: height=${userBioEdits.height}, weight=${userBioEdits.weight}, college=${userBioEdits.collegeId}, homeState=${userBioEdits.homeState}, handedness=${userBioEdits.handedness}`);
        }
        if (userAppearanceEdits) {
          console.log(`  Appearance edits: PID=${userAppearanceEdits.maddenPid}, PAM=${userAppearanceEdits.maddenPam}`);
        }
      }
    }

    // Handle PID/PAM - validate PID exists in portrait mapping before using it
    // CRITICAL: Check user appearance edits FIRST, then fall back to CSV
    let playerPID = userAppearanceEdits?.maddenPid ?? (parseInt(csvRow.PID) || 0);
    let playerPAM = userAppearanceEdits?.maddenPam ?? String(csvRow.PAM || '');
    // CRITICAL: Use user-edited race if available
    const csvRace = userBioEdits?.race ?? (parseInt(csvRow.Race) || 1); // Get race from user edits or CSV

    // Check for custom portrait assignment FIRST (user-uploaded portraits, PID 12000+)
    // Look up custom portrait by exact database player ID (most reliable method)
    const customPortraitPID = playerInternalId
      ? userDatabaseService.getCustomPortraitByPlayerId(playerInternalId)
      : undefined;

    if (customPortraitPID) {
      // Player has a custom portrait assigned - use it!
      playerPID = customPortraitPID;
      console.log(`[RosterGeneratorService] ✅ Using custom portrait PID ${customPortraitPID} for ${csvRow.First_Name} ${csvRow.Last_Name} (ID:${playerInternalId})`);
      // Custom portraits are treated as real faces (PLPL=100), skip all generic face logic below
    }

    // CRITICAL: Only use PID from CSV if it exists in PID_Portrait_Mapping.csv AND matches the race
    // Skip this validation if we're using a custom portrait (PID 12000+)
    if (playerPID !== 0 && playerPID < 12000) {
      if (!this.validPIDs.has(playerPID)) {
        console.warn(`[RosterGeneratorService] Invalid PID ${playerPID} for ${csvRow.First_Name} ${csvRow.Last_Name} - assigning generic face`);
        playerPID = 0; // Force reassignment to generic face
      } else {
        // Check if PID's race matches CSV race (for generic faces only)
        const portrait = this.pidToPortrait.get(playerPID);
        const isGenericPortrait = portrait && portrait.includes('plpo_generic_');

        // Only check race mismatch for generic faces - legends keep their PID
        if (isGenericPortrait) {
          // Use the pidToRace map (from CSV Race column) for accurate comparison
          const pidRace = this.pidToRace.get(playerPID);
          if (pidRace !== undefined && pidRace !== csvRace) {
            console.warn(`[RosterGeneratorService] Race mismatch for ${csvRow.First_Name} ${csvRow.Last_Name}: CSV race=${csvRace}, PID ${playerPID} race=${pidRace} - reassigning`);
            playerPID = 0; // Force reassignment with correct race
          }
        }
      }
    }

    // Variables for generic face handling
    let isGenericFace = false;
    let pgheValue = 0;
    // DON'T track pskiValue - BLBM GENR/SKNT controls face appearance
    let plplValue: number = 100; // Default to real face (100)
    let pepsValue: string = ''; // Will be set below based on face type
    let playerPicValue: string = ''; // Display name for Player Pic column

    if (playerPID === 0) {
      // Assign generic face for players without valid portraits
      // Use the new selectGenericFaceByRace which returns matching PID, PAM (GENR), and PGHE
      isGenericFace = true;
      const genericFace = this.selectGenericFaceByRace(csvRace);
      playerPID = genericFace.pid;
      plplValue = 0; // Generic face flag
      pepsValue = genericFace.pam; // GENR from PGHE lookup - matched set with pid and pghe
      pgheValue = genericFace.pghe;
      // DON'T SET PSKI - BLBM GENR/SKNT controls face appearance
      console.log(`[PEPS DEBUG] ${csvRow.First_Name} ${csvRow.Last_Name}: Generic face - PID=${playerPID}, PEPS="${pepsValue}", PGHE=${pgheValue}, race=${csvRace}`);
    } else {
      // Player has valid PID - check if they have a real portrait
      const mappedPAM = this.pidToPAM.get(playerPID);
      const mappedPortrait = this.pidToPortrait.get(playerPID);

      // Custom portraits (PID 12000+) are always treated as real faces
      const isCustomPortrait = playerPID >= 12000;

      // Check portrait type to determine face handling:
      // - Custom portrait (PID 12000+) = Real face (PLPL=100)
      // - plpo_legends_* = Legend portrait (real face, PLPL=100)
      // - plpo_generic_* = Generic face (PLPL=0)
      // - Other non-generic portrait = Real face (PLPL=100)
      // - Player-format PAM (not gen_*) = Real face (PLPL=100)
      const isLegendPortrait = mappedPortrait && mappedPortrait.includes('legends');
      const isGenericPortrait = mappedPortrait && mappedPortrait.includes('generic');
      const isRealFacePAM = mappedPAM && !mappedPAM.startsWith('gen_');

      // Real face = custom portrait OR legend portrait OR non-generic portrait OR player-format PAM
      const isRealFace = isCustomPortrait || isLegendPortrait || (!isGenericPortrait && mappedPortrait) || isRealFacePAM;

      if (isRealFace) {
        // Real face (legend, player scan, or custom portrait) - keep PID, set PLPL=100
        plplValue = 100;
        if (isCustomPortrait) {
          // Custom portrait - PAM is empty, Player Pic shows "Last, First"
          pepsValue = ''; // No PAM for custom portraits
          playerPicValue = `${cleanLastName}, ${cleanFirstName}`;
          console.log(`[PEPS DEBUG] ${cleanFirstName} ${cleanLastName}: Custom portrait PID ${playerPID}, PEPS="" (no PAM), PlayerPic="${playerPicValue}"`);
        } else {
          // Standard portrait - use mapped PAM, Player Pic from portrait name
          pepsValue = mappedPAM || '';
          playerPicValue = mappedPortrait || '';
          console.log(`[PEPS DEBUG] ${csvRow.First_Name} ${csvRow.Last_Name}: Real face PID ${playerPID}, Portrait="${mappedPortrait}", PEPS="${pepsValue}"`);
        }
      } else if (isGenericPortrait) {
        // Generic face portrait - select matched PGHE set for this player
        isGenericFace = true;
        plplValue = 0;
        const genericFace = this.selectGenericFaceByRace(csvRace);
        playerPID = genericFace.pid;  // Use matched PID from PGHE lookup
        pepsValue = genericFace.pam;  // GENR from PGHE lookup - matched set
        pgheValue = genericFace.pghe;
        // DON'T SET PSKI - BLBM GENR/SKNT controls face appearance
        console.log(`[PEPS DEBUG] ${csvRow.First_Name} ${csvRow.Last_Name}: Generic portrait - PID=${playerPID}, PEPS="${pepsValue}", PGHE=${pgheValue}, race=${csvRace}`);
      } else {
        // No portrait at all - need to assign generic face
        // BUT FIRST check if player has valid PID in validPIDs - if so, keep it!
        if (this.validPIDs.has(playerPID)) {
          // Player has valid PID but no portrait data - keep PID, use as real face
          plplValue = 100;
          pepsValue = mappedPAM || '';
          console.log(`[PEPS DEBUG] ${csvRow.First_Name} ${csvRow.Last_Name}: Valid PID ${playerPID} with no portrait, keeping as real face`);
        } else {
          // Truly no valid portrait - select a generic face by race
          isGenericFace = true;
          plplValue = 0;
          const genericFace = this.selectGenericFaceByRace(csvRace);
          playerPID = genericFace.pid;
          pepsValue = genericFace.pam; // GENR from PGHE lookup - matched set with pid and pghe
          pgheValue = genericFace.pghe;
          // DON'T SET PSKI - BLBM GENR/SKNT controls face appearance
          console.log(`[PEPS DEBUG] ${csvRow.First_Name} ${csvRow.Last_Name}: No portrait, generic face - PID=${playerPID}, PEPS="${pepsValue}", PGHE=${pgheValue}, race=${csvRace}`);
        }
      }
    }

    // Calculate years pro based on draft year and target roster year
    const draftYear = parseFloat(csvRow.Draft_Year);
    let yearsPro = 0;
    if (!isNaN(draftYear) && draftYear > 0) {
      yearsPro = Math.max(0, year - Math.floor(draftYear));
    } else {
      // Fall back to CSV value if no draft year
      yearsPro = parseInt(csvRow.Years_Pro ?? csvRow.YearsPro ?? 0) || 0;
    }

    // CRITICAL: Apply user bio edits - these override CSV values when user has edited in roster editor
    // Height: userBioEdits stores actual height in inches
    const finalHeight = userBioEdits?.height ?? (parseInt(csvRow.Height) || 72);
    // Weight: userBioEdits stores actual weight in lbs, need to convert to Madden format (actual - 159)
    const finalWeight = userBioEdits?.weight
      ? Math.max(1, userBioEdits.weight - 159)
      : Math.max(1, (parseInt(csvRow.Weight) || 200) - 159);
    // College: userBioEdits stores collegeId as numeric ID, CSV stores as string name
    const finalCollege = userBioEdits?.collegeId ?? await this.lookupCollege(csvRow.College);
    // HomeState: userBioEdits stores as string name, need to convert to numeric ID
    const csvHomeState = this.homeLocationLookup.get(`${csvRow.First_Name}|${csvRow.Last_Name}`)?.homeState || '';
    const finalHomeState = userBioEdits?.homeState
      ? await this.lookupStateByName(userBioEdits.homeState)
      : await this.lookupStateByName(csvHomeState);
    // Hometown: userBioEdits stores as string
    const csvHometown = this.homeLocationLookup.get(`${csvRow.First_Name}|${csvRow.Last_Name}`)?.hometown || '';
    const finalHometown = userBioEdits?.hometown ?? csvHometown;
    // Handedness: userBioEdits stores as numeric (0=Right, 1=Left)
    const finalHandedness = userBioEdits?.handedness ?? (parseInt(csvRow.Handedness) || 0);
    // BodyType: userBioEdits stores as numeric, or use position-based determination
    const finalBodyType = userBioEdits?.bodyType ?? this.determinePCBT(csvRow);

    // Map CSV field names to UPPERCASE roster editor field codes
    const player: any = {
      // Basic Info (use UPPERCASE field codes that app.js expects!)
      PFNA: cleanFirstName,  // First name (stripped of ‡†* markers at top of function)
      PLNA: cleanLastName,   // Last name (stripped of ‡†* markers at top of function)
      PPOS: positionCode,              // Position code (numeric)
      PJEN: parseInt(csvRow.Jersey) || 0,  // Jersey number
      PAGE: parseInt(csvRow.Age) || 25,     // Age
      PHGT: finalHeight,  // Height in inches (from user edits or CSV)
      PWGT: finalWeight,  // Weight stored as offset (from user edits or CSV)
      TGID: teamCode,                  // Team ID (numeric)
      PCBT: finalBodyType,  // Body type (from user edits or position-based)
      PHAN: finalHandedness, // Handedness (from user edits or CSV)
      // CRITICAL: PLRC must match the skin tone of the assigned face
      // For generic faces (PEPS starts with "gen_"), extract from first digit (e.g., "gen_7_..." -> 7)
      // For real faces, use csvRace (which already considers user edits)
      PLRC: (pepsValue && pepsValue.startsWith('gen_'))
        ? (parseInt(pepsValue.match(/^gen_(\d+)/)?.[1] || '1') || csvRace)
        : csvRace,

      // IDs - Use processed PID/PAM (generic if original was 0)
      PSXP: playerPID,       // Player ID (PID) - from user edits or CSV
      PLPL: plplValue,        // Player Asset (PAM) - 0 for generic, 100 for real face
      PEPS: pepsValue,        // PAM code - blank for custom portraits
      PLAYERPIC: playerPicValue, // Player Pic display name (format: "Last, First" for custom portraits)
      POID: this.pidToCommID.get(playerPID) || 0, // Presentation ID for in-game commentary
      PCMT: lookupService.getCommentaryId(cleanLastName) || 0, // Commentary ID - looked up by clean last name

      // College & Home - Use user edits if available, otherwise CSV/lookup data
      PCOL: finalCollege,
      PHSN: finalHomeState,
      PHTN: finalHometown,

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
      PBKT: parseInt(ratings.PBKT) || parseInt(ratings.PBTK) || 50,  // Break Tackle - roster uses PBKT!
      PJMP: parseInt(ratings.PJMP) || 50,
      PINJ: parseInt(ratings.PINJ) || 50,
      PSTA: parseInt(ratings.PSTA) || 50,
      PTGH: parseInt(ratings.PTGH) || 50,
      // Use Madden-named columns directly (now exist in CSV after update)
      PLTR: parseInt(ratings.PLTR) || parseInt(ratings.PTRK) || 50,  // Trucking
      PELU: parseInt(ratings.PELU) || parseInt(ratings.PCOD) || 50,  // Change of Direction
      PBCV: parseInt(ratings.PBCV) || 50,
      PLSA: parseInt(ratings.PLSA) || parseInt(ratings.PSFA) || parseInt(ratings.PSTF) || 50,  // Stiff Arm (db: PSFA)
      PLSM: parseInt(ratings.PLSM) || parseInt(ratings.PSPN) || parseInt(ratings.PSPM) || 50,  // Spin Move (db: PSPN)
      PLJM: parseInt(ratings.PLJM) || parseInt(ratings.PJKM) || parseInt(ratings.PJUM) || 50,  // Juke Move (db: PJKM)
      PLIB: parseInt(ratings.PLIB) || parseInt(ratings.PIBK) || parseInt(ratings.PIBL) || 50,  // Impact Blocking (db: PIBK)
      PRBP: parseInt(ratings.PRBP) || parseInt(ratings.PRBK) || 50,  // Run Block Power - fallback to PRBK
      PRBF: parseInt(ratings.PRBF) || parseInt(ratings.PRBK) || 50,  // Run Block Finesse - fallback to PRBK
      PPBP: parseInt(ratings.PPBP) || parseInt(ratings.PPBK) || 50,  // Pass Block Power - fallback to PPBK
      PPBF: parseInt(ratings.PPBF) || parseInt(ratings.PPBK) || 50,  // Pass Block Finesse - fallback to PPBK
      PLBK: parseInt(ratings.PLBK) || parseInt(ratings.PLDB) || 50,  // Lead Block
      PBRS: parseInt(ratings.PBRS) || 50,
      PTUP: parseInt(ratings.PTUP) || 50,
      PLPM: parseInt(ratings.PLPM) || parseInt(ratings.PPWM) || 50,  // Power Moves (db: PPWM)
      PFMS: parseInt(ratings.PFMS) || parseInt(ratings.PFMV) || parseInt(ratings.PFNM) || 50,  // Finesse Moves (db: PFMV)
      PBSG: parseInt(ratings.PBSG) || parseInt(ratings.PBSH) || 50,  // Block Shedding (db: PBSH)
      PLPU: parseInt(ratings.PLPU) || parseInt(ratings.PPUR) || 50,  // Pursuit (db: PLPU, old CSV: PPUR)
      PLPR: parseInt(ratings.PLPR) || parseInt(ratings.PPRC) || 50,  // Play Recognition (db: PLPR, old CSV: PPRC)
      PLMC: parseInt(ratings.PLMC) || parseInt(ratings.PMCV) || 50,  // Man Coverage (db: PMCV)
      PLZC: parseInt(ratings.PLZC) || parseInt(ratings.PZCV) || 50,  // Zone Coverage (db: PZCV)
      PLSC: parseInt(ratings.PLSC) || parseInt(ratings.PSPC) || 50,  // Spectacular Catch (db: PSPC)
      PLCI: parseInt(ratings.PLCI) || parseInt(ratings.PCIT) || 50,  // Catch in Traffic (db: PCIT)
      SRRN: parseInt(ratings.SRRN) || parseInt(ratings.PSRR) || 50,  // Short Route Running (db: PSRR)
      PMRR: parseInt(ratings.PMRR) || 50,
      PDRR: parseInt(ratings.PDRR) || 50,
      PLHT: parseInt(ratings.PLHT) || parseInt(ratings.PHIT) || parseInt(ratings.PHTP) || 50,  // Hit Power (db: PHIT)
      PLPE: parseInt(ratings.PLPE) || parseInt(ratings.PPRS) || 50,  // Press (db: PPRS)
      PLRL: parseInt(ratings.PLRL) || parseInt(ratings.PREL) || 50,  // Release (db: PREL)
      PPBS: parseInt(ratings.PPBS) || parseInt(ratings.PPBP) || parseInt(ratings.PPBK) || 50,  // Pass Block Strength - map from PPBP, fallback to PPBK
      PRBS: parseInt(ratings.PRBS) || parseInt(ratings.PRBP) || parseInt(ratings.PRBK) || 50,  // Run Block Strength - map from PRBP, fallback to PRBK
      PTAS: parseInt(ratings.PTAS) || 50,
      PTAM: parseInt(ratings.PTAM) || 50,
      PTAD: parseInt(ratings.PTAD) || 50,
      PPLA: parseInt(ratings.PPLA) || 50,  // Play Action (QB attribute)
      PTOR: parseInt(ratings.PTOR) || 50,
      PKRT: parseInt(ratings.PKRT) || 50,
      PBSK: parseInt(ratings.PBSK) || 50,  // Break Sack

      // Metadata
      PLTY: parseInt(archetype) || 0,  // Archetype ID - PLTY is what franchise reads!
      PTAR: this.determineBodyType(csvRow),  // Body type (PTAR is actually body type, not archetype!)
      PYRP: yearsPro,  // Years pro - calculated from draft year
      PROL: this.determineDevTrait(parseInt(ratings.POVR) || 50),  // Dev trait (0=Normal, 1=Star, 2=Superstar, 3=X-Factor)
      // DON'T SET PSKI for generic faces - BLBM GENR/SKNT controls face appearance
      // Only set PGHE for generic faces
      PGHE: pgheValue,  // Generic head ID (only used for generic faces, 1-290)

      // Contract fields - generated using ContractService
      ...this.generatePlayerContract(csvRow.Position || 'HB', parseInt(ratings.POVR) || 50, year, yearsPro, parseInt(csvRow.Age) || 25),

      // Source data (for internal tracking - keep original string values for filtering)
      _year: year,
      _sourceTeam: csvRow.Season_Team || '',
      _position: csvRow.Position || '',  // Store position string for filtering
      _race: csvRace,  // Race value (1-7) for BLBM GENR/SKNT assignment
      _isHOF: this.hofLookup.get(`${csvRow.First_Name}|${csvRow.Last_Name}`) || false  // Hall of Fame status
    };

    // Sync archetype based on player attributes - ensures PLTY matches what Madden will auto-assign
    const syncedPlayer = ArchetypeSyncService.syncArchetypeFromAttributes(player, positionName);

    // CRITICAL: Recalculate POVR using the correct M26 formula (sum of weights / 11)
    // This ensures roster POVR matches what Madden calculates during franchise import
    if (ovrWeightsCalculator.isInitialized()) {
      const attributes: Record<string, number> = {
        PSPD: syncedPlayer.PSPD,
        PACC: syncedPlayer.PACC,
        PAGI: syncedPlayer.PAGI,
        PSTR: syncedPlayer.PSTR,
        PAWR: syncedPlayer.PAWR,
        PCAR: syncedPlayer.PCAR,
        PBCV: syncedPlayer.PBCV,
        PBKT: syncedPlayer.PBKT,
        PLTR: syncedPlayer.PLTR,
        PLSA: syncedPlayer.PLSA,
        PLSM: syncedPlayer.PLSM,
        PLJM: syncedPlayer.PLJM,
        PCTH: syncedPlayer.PCTH,
        PLCI: syncedPlayer.PLCI,
        PLSC: syncedPlayer.PLSC,
        PELU: syncedPlayer.PELU,
        PJMP: syncedPlayer.PJMP,
        PSTA: syncedPlayer.PSTA,
        PTGH: syncedPlayer.PTGH,
        PINJ: syncedPlayer.PINJ,
        SRRN: syncedPlayer.SRRN,
        PMRR: syncedPlayer.PMRR,
        PDRR: syncedPlayer.PDRR,
        PTHP: syncedPlayer.PTHP,
        PTAS: syncedPlayer.PTAS,
        PTAM: syncedPlayer.PTAM,
        PTAD: syncedPlayer.PTAD,
        PTOR: syncedPlayer.PTOR,
        PTUP: syncedPlayer.PTUP,
        PPLA: syncedPlayer.PPLA,
        PBSK: syncedPlayer.PBSK,
        PBSG: syncedPlayer.PBSG,
        PLPM: syncedPlayer.PLPM,
        PFMS: syncedPlayer.PFMS,
        PTAK: syncedPlayer.PTAK,
        PLHT: syncedPlayer.PLHT,
        PLPU: syncedPlayer.PLPU,
        PLPR: syncedPlayer.PLPR,
        PLMC: syncedPlayer.PLMC,
        PLZC: syncedPlayer.PLZC,
        PLPE: syncedPlayer.PLPE,
        PPBK: syncedPlayer.PPBK,
        PPBS: syncedPlayer.PPBS,
        PPBF: syncedPlayer.PPBF,
        PRBK: syncedPlayer.PRBK,
        PRBS: syncedPlayer.PRBS,
        PRBF: syncedPlayer.PRBF,
        PLIB: syncedPlayer.PLIB,
        PLBK: syncedPlayer.PLBK,
        PKPW: syncedPlayer.PKPW,
        PKAC: syncedPlayer.PKAC,
        PLRL: syncedPlayer.PLRL,
        PKRT: syncedPlayer.PKRT,
      };

      // Pass PLTY (numeric archetype ID) to calculator for proper OVR formula
      const calculatedOvr = ovrWeightsCalculator.calculateOVR(
        attributes,
        positionName,
        syncedPlayer.PLTY // Pass the archetype ID for proper conversion
      );

      // OVR floor of 55 - if below, BOOST RATINGS to achieve 55 (don't just clamp display)
      const OVR_FLOOR = 55;
      if (calculatedOvr < OVR_FLOOR) {
        // Use weight-proportional adjustment to boost ratings to achieve floor OVR
        const adjustment = ovrWeightsCalculator.calculateAdjustmentsForTargetOVR(
          attributes,
          OVR_FLOOR,
          positionName,
          syncedPlayer.PLTY
        );

        if (adjustment && adjustment.adjustments) {
          // Apply the rating boosts
          for (const [fieldCode, adj] of Object.entries(adjustment.adjustments)) {
            if ((syncedPlayer as any)[fieldCode] !== undefined) {
              (syncedPlayer as any)[fieldCode] = Math.max(40, Math.min(99, adj.suggested));
            }
          }
          syncedPlayer.POVR = adjustment.newOVR;
        } else {
          // Fallback: just set to floor
          syncedPlayer.POVR = OVR_FLOOR;
        }
      } else {
        syncedPlayer.POVR = Math.min(99, calculatedOvr);
      }
    }

    return syncedPlayer;
  }

  /**
   * Enrich player data from DATABASE row (new method - replaces CSV-based enrichPlayer)
   * Gets ALL data from database: bio, ratings, appearance, home location
   */
  private async enrichPlayerFromDb(dbRow: any, year: number): Promise<RosterPlayer> {
    // Database already has clean names
    const cleanFirstName = (dbRow.firstName || '').trim();
    const cleanLastName = (dbRow.lastName || '').trim();

    // Map position string to position code (QB=0, HB=1, etc.)
    const positionCode = await this.lookupPositionCode(dbRow.position);
    const positionName = await this.getPositionName(positionCode);

    // Parse archetype to numeric (0-67)
    const archetype = await this.parseArchetype(dbRow.archetype, positionName);

    // Map team string to team code
    const teamCode = await this.lookupTeamCode(dbRow.team);

    // Get ratings from database - fill missing values
    // Note: User edits are already merged into dbRow.ratings BEFORE this method is called
    const ratings = this.fillMissingRatingsFromDb(dbRow.ratings || {});

    // Handle PID/PAM from database
    // Priority: dbRow.maddenPid (already merged with appearance edits) > customPortraitPID > 0
    let playerPID = dbRow.maddenPid || 0;
    let playerPAM = dbRow.maddenPam || '';
    const dbRace = dbRow.race || 1;
    const playerInternalId = dbRow.playerId;

    // Only check for custom portrait if no PID from appearance edits/database
    // This ensures user-assigned generic faces take priority over old custom portrait assignments
    if (!playerPID) {
      const customPortraitPID = playerInternalId
        ? userDatabaseService.getCustomPortraitByPlayerId(playerInternalId)
        : null;

      if (customPortraitPID) {
        playerPID = customPortraitPID;
      }
    }

    // Variables for generic face handling
    let isGenericFace = false;
    let pgheValue = 0;
    let plplValue: number = 100;
    let pepsValue: string = '';
    let playerPicValue: string = '';

    // PID determines everything - photo, Player Pic, and PAM should all match
    // Check if PID is in the list of known generic face PIDs
    const isGenericPID = this.genericPIDSet.has(playerPID);
    const isCustomPortraitPID = playerPID >= 12000;

    // DEBUG: Check specific PIDs
    if (playerPID === 4058 || playerPID === 4074 || playerPID === 4060) {
      console.log(`[enrichPlayerFromDb DEBUG] ${cleanFirstName} ${cleanLastName}: PID=${playerPID}, isGenericPID=${isGenericPID}, genericPIDSet.size=${this.genericPIDSet.size}, has4058=${this.genericPIDSet.has(4058)}`);
    }

    if (playerPID === 0 || (!isCustomPortraitPID && !this.validPIDs.has(playerPID))) {
      // No valid PID - assign a generic face
      isGenericFace = true;
      const genericFace = this.selectGenericFaceByRace(dbRace);
      playerPID = genericFace.pid;
      plplValue = 0;
      pepsValue = genericFace.pam;
      pgheValue = genericFace.pghe;
      playerPicValue = 'Face, Generic';
    } else if (isGenericPID) {
      // PID is a known generic face PID - all columns should show "generic"
      isGenericFace = true;
      plplValue = 0;
      // Priority: playerPAM (from database) > pgheLookupService > pidToPAM fallback
      if (playerPAM) {
        pepsValue = playerPAM;
        pgheValue = this.pidToPGHE.get(playerPID) || 0;
        console.log(`[PAM DEBUG] ${cleanFirstName} ${cleanLastName}: Using DB PAM="${playerPAM}" for generic PID ${playerPID}`);
      } else {
        // Look up from PGHE service which has complete PID → GENR mappings
        const pgheEntry = pgheLookupService.getByPID(playerPID);
        if (pgheEntry) {
          pepsValue = pgheEntry.genr;
          pgheValue = pgheEntry.pghe;
          console.log(`[PAM DEBUG] ${cleanFirstName} ${cleanLastName}: PGHE lookup for PID ${playerPID} -> GENR="${pgheEntry.genr}"`);
        } else {
          // Fallback to cached mappings
          pepsValue = this.pidToPAM.get(playerPID) || '';
          pgheValue = this.pidToPGHE.get(playerPID) || 0;
          console.log(`[PAM DEBUG] ${cleanFirstName} ${cleanLastName}: Fallback for PID ${playerPID} -> PEPS="${pepsValue}" (pidToPAM)`);
        }
      }
      playerPicValue = 'Face, Generic';
    } else if (isCustomPortraitPID) {
      // Custom portrait (PID >= 12000) - BUT check if database has generic face PAM
      // Some generic faces may have PIDs >= 12000 that aren't in genericPIDSet
      if (playerPAM && playerPAM.startsWith('gen_')) {
        // Database has a generic face PAM - preserve it
        isGenericFace = true;
        plplValue = 0;
        pepsValue = playerPAM;
        pgheValue = this.pidToPGHE.get(playerPID) || 0;
        playerPicValue = 'Face, Generic';
        console.log(`[PAM DEBUG] ${cleanFirstName} ${cleanLastName}: Custom PID ${playerPID} has generic PAM="${playerPAM}", treating as generic face`);
      } else {
        // True custom portrait - use player's name
        plplValue = 100;
        pepsValue = '';
        playerPicValue = `${cleanLastName}, ${cleanFirstName}`;
      }
    } else {
      // Real player PID - look up the mapped portrait name
      const mappedPAM = this.pidToPAM.get(playerPID);
      const mappedPortrait = this.pidToPortrait.get(playerPID);

      if (mappedPortrait) {
        plplValue = 100;
        // Use mapped PAM, fallback to database PAM if available
        pepsValue = mappedPAM || playerPAM || '';
        playerPicValue = mappedPortrait;
      } else {
        // No portrait mapping found - keep PID, use as real face
        plplValue = 100;
        // Use mapped PAM, fallback to database PAM if available
        pepsValue = mappedPAM || playerPAM || '';
      }
    }

    // Calculate years pro from draft class
    const draftYear = dbRow.draftClass;
    let yearsPro = 0;
    if (draftYear && draftYear > 0) {
      yearsPro = Math.max(0, year - draftYear);
    }

    // Get college ID from college name
    const collegeId = await this.lookupCollege(dbRow.college);

    // Get state ID from state name - database now provides this directly!
    const stateId = await this.lookupStateByName(dbRow.homeState || '');

    // Commentary ID lookup
    const commId = dbRow.maddenCommid ? parseInt(dbRow.maddenCommid) : 0;

    // Map to roster format
    const player: any = {
      // Basic Info
      PFNA: cleanFirstName,
      PLNA: cleanLastName,
      PPOS: positionCode,
      PJEN: dbRow.jersey || 0,
      PAGE: dbRow.age || 25,
      PHGT: dbRow.height || 72,
      PWGT: Math.max(1, (dbRow.weight || 200) - 159),
      TGID: teamCode,
      PCBT: this.determinePCBTFromDb(dbRow),
      PHAN: dbRow.handedness ?? 0,  // Handedness: 0=Right, 1=Left (default to right-handed)

      // IDs
      PSXP: playerPID,
      PLPL: plplValue,
      PEPS: pepsValue,
      PLAYERPIC: playerPicValue,
      POID: commId || this.pidToCommID.get(playerPID) || 0,
      PCMT: lookupService.getCommentaryId(cleanLastName) || 0,

      // College & Home - DIRECTLY from database!
      PCOL: collegeId,
      PHSN: stateId,
      PHTN: dbRow.hometown || '',

      // Ratings from database
      POVR: ratings.POVR || 50,
      PSPD: ratings.PSPD || 50,
      PACC: ratings.PACC || 50,
      PSTR: ratings.PSTR || 50,
      PAGI: ratings.PAGI || 50,
      PAWR: ratings.PAWR || 50,
      PCTH: ratings.PCTH || 50,
      PCAR: ratings.PCAR || 50,
      PTHP: ratings.PTHP || 50,
      PKPW: ratings.PKPW || 50,
      PKAC: ratings.PKAC || 50,
      PRBK: ratings.PRBK || 50,
      PPBK: ratings.PPBK || 50,
      PTAK: ratings.PTAK || 50,
      PBKT: ratings.PBKT || ratings.PBTK || 50,  // Break Tackle - roster uses PBKT!
      PJMP: ratings.PJMP || 50,
      PINJ: ratings.PINJ || 50,
      PSTA: ratings.PSTA || 50,
      PTGH: ratings.PTGH || 50,
      PLTR: ratings.PLTR || ratings.PTRK || 50,
      PELU: ratings.PELU || ratings.PCOD || 50,
      PBCV: ratings.PBCV || 50,
      PLSA: ratings.PLSA || ratings.PSFA || ratings.PSTF || 50,  // Stiff Arm (db: PSFA)
      PLSM: ratings.PLSM || ratings.PSPN || ratings.PSPM || 50,  // Spin Move (db: PSPN)
      PLJM: ratings.PLJM || ratings.PJKM || ratings.PJUM || 50,  // Juke Move (db: PJKM)
      PLIB: ratings.PLIB || ratings.PIBK || ratings.PIBL || 50,  // Impact Blocking (db: PIBK)
      PRBP: ratings.PRBP || ratings.PRBK || 50,  // Run Block Power - fallback to PRBK
      PRBF: ratings.PRBF || ratings.PRBK || 50,  // Run Block Finesse - fallback to PRBK
      PPBP: ratings.PPBP || ratings.PPBK || 50,  // Pass Block Power - fallback to PPBK
      PPBF: ratings.PPBF || ratings.PPBK || 50,  // Pass Block Finesse - fallback to PPBK
      PLBK: ratings.PLBK || ratings.PLDB || 50,
      PBRS: ratings.PBRS || 50,
      PTUP: ratings.PTUP || 50,
      PLPM: ratings.PLPM || ratings.PPWM || 50,  // Power Moves (db: PPWM)
      PFMS: ratings.PFMS || ratings.PFMV || ratings.PFNM || 50,  // Finesse Moves (db: PFMV)
      PBSG: ratings.PBSG || ratings.PBSH || 50,  // Block Shedding (db: PBSH)
      PLPU: ratings.PLPU || ratings.PPUR || 50,  // Pursuit (db: PLPU, old CSV: PPUR)
      PLPR: ratings.PLPR || ratings.PPRC || 50,  // Play Recognition (db: PLPR, old CSV: PPRC)
      PLMC: ratings.PLMC || ratings.PMCV || 50,  // Man Coverage (db: PMCV)
      PLZC: ratings.PLZC || ratings.PZCV || 50,  // Zone Coverage (db: PZCV)
      PLSC: ratings.PLSC || ratings.PSPC || 50,  // Spectacular Catch (db: PSPC)
      PLCI: ratings.PLCI || ratings.PCIT || 50,  // Catch in Traffic (db: PCIT)
      SRRN: ratings.SRRN || ratings.PSRR || 50,  // Short Route Running (db: PSRR)
      PMRR: ratings.PMRR || 50,
      PDRR: ratings.PDRR || 50,
      PLHT: ratings.PLHT || ratings.PHIT || ratings.PHTP || 50,  // Hit Power (db: PHIT)
      PLPE: ratings.PLPE || ratings.PPRS || 50,  // Press (db: PPRS)
      PLRL: ratings.PLRL || ratings.PREL || 50,  // Release (db: PREL)
      PPBS: ratings.PPBS || ratings.PPBP || ratings.PPBK || 50,  // Map from PPBP, fallback to PPBK
      PRBS: ratings.PRBS || ratings.PRBP || ratings.PRBK || 50,  // Map from PRBP, fallback to PRBK
      PTAS: ratings.PTAS || 50,
      PTAM: ratings.PTAM || 50,
      PTAD: ratings.PTAD || 50,
      PPLA: ratings.PPLA || 50,  // Play Action (QB attribute)
      PTOR: ratings.PTOR || 50,
      PKRT: ratings.PKRT || 50,
      PBSK: ratings.PBSK || 50,

      // Metadata
      PLTY: parseInt(archetype) || 0,  // Archetype ID - PLTY is what franchise reads!
      PTAR: this.determineBodyTypeFromDb(dbRow),
      PYRP: yearsPro,
      PROL: this.determineDevTrait(ratings.POVR || 50),
      PGHE: pgheValue,
      // CRITICAL: PLRC must match GENR first digit for consistent skin tone
      // For generic faces (PEPS starts with "gen_"), extract from first digit
      // For real faces, use dbRace
      PLRC: (pepsValue && pepsValue.startsWith('gen_'))
        ? (parseInt(pepsValue.match(/^gen_(\d+)/)?.[1] || '1') || dbRace)
        : dbRace,

      // Contract
      ...this.generatePlayerContract(dbRow.position || 'HB', ratings.POVR || 50, year, yearsPro, dbRow.age || 25),

      // Source data
      _year: year,
      _sourceTeam: dbRow.team || '',
      _position: dbRow.position || '',
      _race: dbRace,
      _isHOF: dbRow.isHof || false
    };

    // Sync archetype based on player attributes
    // This predicts what Madden will auto-assign
    const syncedPlayer = ArchetypeSyncService.syncArchetypeFromAttributes(player, positionName);

    // CRITICAL: Recalculate POVR using the correct M26 formula
    // Madden RECALCULATES OVR from ratings when importing roster to franchise
    // So we MUST calculate POVR to match what Madden will show, not use stored value
    if (ovrWeightsCalculator.isInitialized()) {
      const attributes: Record<string, number> = {
        PSPD: syncedPlayer.PSPD,
        PACC: syncedPlayer.PACC,
        PAGI: syncedPlayer.PAGI,
        PSTR: syncedPlayer.PSTR,
        PAWR: syncedPlayer.PAWR,
        PCAR: syncedPlayer.PCAR,
        PBCV: syncedPlayer.PBCV,
        PBKT: syncedPlayer.PBKT,
        PLTR: syncedPlayer.PLTR,
        PLSA: syncedPlayer.PLSA,
        PLSM: syncedPlayer.PLSM,
        PLJM: syncedPlayer.PLJM,
        PCTH: syncedPlayer.PCTH,
        PLCI: syncedPlayer.PLCI,
        PLSC: syncedPlayer.PLSC,
        PELU: syncedPlayer.PELU,
        PJMP: syncedPlayer.PJMP,
        PSTA: syncedPlayer.PSTA,
        PTGH: syncedPlayer.PTGH,
        PINJ: syncedPlayer.PINJ,
        SRRN: syncedPlayer.SRRN,
        PMRR: syncedPlayer.PMRR,
        PDRR: syncedPlayer.PDRR,
        PTHP: syncedPlayer.PTHP,
        PTAS: syncedPlayer.PTAS,
        PTAM: syncedPlayer.PTAM,
        PTAD: syncedPlayer.PTAD,
        PTOR: syncedPlayer.PTOR,
        PTUP: syncedPlayer.PTUP,
        PPLA: syncedPlayer.PPLA,
        PBSK: syncedPlayer.PBSK,
        PBSG: syncedPlayer.PBSG,
        PLPM: syncedPlayer.PLPM,
        PFMS: syncedPlayer.PFMS,
        PTAK: syncedPlayer.PTAK,
        PLHT: syncedPlayer.PLHT,
        PLPU: syncedPlayer.PLPU,
        PLPR: syncedPlayer.PLPR,
        PLMC: syncedPlayer.PLMC,
        PLZC: syncedPlayer.PLZC,
        PLPE: syncedPlayer.PLPE,
        PPBK: syncedPlayer.PPBK,
        PPBS: syncedPlayer.PPBS,
        PPBF: syncedPlayer.PPBF,
        PRBK: syncedPlayer.PRBK,
        PRBS: syncedPlayer.PRBS,
        PRBF: syncedPlayer.PRBF,
        PLIB: syncedPlayer.PLIB,
        PLBK: syncedPlayer.PLBK,
        PKPW: syncedPlayer.PKPW,
        PKAC: syncedPlayer.PKAC,
        PLRL: syncedPlayer.PLRL,
        PKRT: syncedPlayer.PKRT,
      };

      // Pass PLTY (numeric archetype ID) to calculator for proper OVR formula
      const calculatedOvr = ovrWeightsCalculator.calculateOVR(
        attributes,
        positionName,
        syncedPlayer.PLTY // Pass the archetype ID for proper conversion
      );

      // OVR floor of 55 - if below, BOOST RATINGS to achieve 55 (don't just clamp display)
      const OVR_FLOOR = 55;
      if (calculatedOvr < OVR_FLOOR) {
        // Use weight-proportional adjustment to boost ratings to achieve floor OVR
        const adjustment = ovrWeightsCalculator.calculateAdjustmentsForTargetOVR(
          attributes,
          OVR_FLOOR,
          positionName,
          syncedPlayer.PLTY
        );

        if (adjustment && adjustment.adjustments) {
          // Apply the rating boosts
          for (const [fieldCode, adj] of Object.entries(adjustment.adjustments)) {
            if ((syncedPlayer as any)[fieldCode] !== undefined) {
              (syncedPlayer as any)[fieldCode] = Math.max(40, Math.min(99, adj.suggested));
            }
          }
          syncedPlayer.POVR = adjustment.newOVR;
        } else {
          // Fallback: just set to floor
          syncedPlayer.POVR = OVR_FLOOR;
        }
      } else {
        syncedPlayer.POVR = Math.min(99, calculatedOvr);
      }
    }

    return syncedPlayer;
  }

  /**
   * Fill missing ratings from database row
   * Clamps all ratings to minimum 40 (Madden's floor)
   */
  private fillMissingRatingsFromDb(ratings: { [key: string]: number }): { [key: string]: number } {
    const MIN_RATING = 40;  // Madden minimum rating floor
    const MAX_RATING = 99;

    // POVR: use value if valid, otherwise default to 50, clamp to 40-99
    const rawPOVR = ratings.POVR;
    const povr = (rawPOVR && rawPOVR > 0) ? Math.max(MIN_RATING, Math.min(MAX_RATING, rawPOVR)) : 50;
    const filled: { [key: string]: number } = { POVR: povr };

    RATING_FIELDS.forEach(field => {
      const value = ratings[field];
      if (value === null || value === undefined || value === 0) {
        // Apply 40-60 range with variance for missing values
        filled[field] = Math.round(40 + Math.random() * 20);
      } else {
        // Clamp existing values to 40-99 range
        filled[field] = Math.max(MIN_RATING, Math.min(MAX_RATING, value));
      }
    });

    return filled;
  }

  /**
   * Determine PCBT (body type display) from database row
   */
  private determinePCBTFromDb(dbRow: any): number {
    const weight = dbRow.weight || 200;
    const height = dbRow.height || 72;
    const bmi = (weight / (height * height)) * 703;

    if (bmi < 24) return 1;      // Thin
    if (bmi < 28) return 0;      // Standard
    if (bmi < 32) return 2;      // Muscular
    if (bmi < 36) return 3;      // Heavy
    return 4;                     // Extra Heavy
  }

  /**
   * Determine body type code from database row
   */
  private determineBodyTypeFromDb(dbRow: any): number {
    const weight = dbRow.weight || 200;
    if (weight < 180) return 0;       // Thin
    if (weight < 220) return 1;       // Normal
    if (weight < 260) return 2;       // Muscular
    if (weight < 300) return 3;       // Heavy
    return 4;                          // Extra Heavy
  }

  /**
   * Generate contract fields for a player using ContractService
   * Returns object with PCON, PCYL, PSA0-6, PSB0-6, PSBO, PCSA
   */
  private generatePlayerContract(position: string, overall: number, year: number, yearsPro: number, age: number): {
    PCON: number; PCYL: number; PSBO: number; PCSA: number;
    PSA0: number; PSA1: number; PSA2: number; PSA3: number; PSA4: number; PSA5: number; PSA6: number;
    PSB0: number; PSB1: number; PSB2: number; PSB3: number; PSB4: number; PSB5: number; PSB6: number;
  } {
    // Generate contract using ContractService with HISTORICAL cap values
    // useHistoricalCap=true means salaries are scaled to the actual cap for that year
    // This ensures 1995 rosters have 1995-appropriate salaries (~$700K average, not ~$4.8M)
    const contract = contractService.generateContract(position, overall, year, yearsPro, age, undefined, undefined, true);

    // Map to roster fields
    // PCON = contract length (1-7)
    // PCYL = years left on contract
    // PSA0-6 = yearly salaries in $10K units (divide by 10 since ContractService uses thousands)
    // PSB0-6 = prorated signing bonus per year in $10K units
    // PSBO = total signing bonus in $10K units
    // PCSA = current year cap hit = PSA[year] + PSB[year]

    const yearsLeft = contract.length - contract.contractYear;
    const pcon = contract.length;
    const pcyl = yearsLeft;

    // Convert thousands to $10K units (divide by 10)
    const psa0 = Math.round((contract.yearlySalaries[0] || 0) / 10);
    const psa1 = Math.round((contract.yearlySalaries[1] || 0) / 10);
    const psa2 = Math.round((contract.yearlySalaries[2] || 0) / 10);
    const psa3 = Math.round((contract.yearlySalaries[3] || 0) / 10);
    const psa4 = Math.round((contract.yearlySalaries[4] || 0) / 10);
    const psa5 = Math.round((contract.yearlySalaries[5] || 0) / 10);
    const psa6 = Math.round((contract.yearlySalaries[6] || 0) / 10);

    // Prorate signing bonus across contract years
    const totalBonus = Math.round(contract.bonus / 10); // Convert to $10K units
    const proratedBonus = pcon > 0 ? Math.round(totalBonus / pcon) : 0;

    const psb0 = pcon > 0 ? proratedBonus : 0;
    const psb1 = pcon > 1 ? proratedBonus : 0;
    const psb2 = pcon > 2 ? proratedBonus : 0;
    const psb3 = pcon > 3 ? proratedBonus : 0;
    const psb4 = pcon > 4 ? proratedBonus : 0;
    const psb5 = pcon > 5 ? proratedBonus : 0;
    const psb6 = pcon > 6 ? proratedBonus : 0;

    // Calculate PCSA: current year cap hit = PSA[current year] + PSB[current year]
    // Current year index = PCON - PCYL
    const currentYearIndex = pcon - pcyl;
    const salaries = [psa0, psa1, psa2, psa3, psa4, psa5, psa6];
    const bonuses = [psb0, psb1, psb2, psb3, psb4, psb5, psb6];
    const pcsa = (salaries[currentYearIndex] || 0) + (bonuses[currentYearIndex] || 0);

    return {
      PCON: pcon,
      PCYL: pcyl,
      PSBO: totalBonus,
      PCSA: pcsa,
      PSA0: psa0, PSA1: psa1, PSA2: psa2, PSA3: psa3, PSA4: psa4, PSA5: psa5, PSA6: psa6,
      PSB0: psb0, PSB1: psb1, PSB2: psb2, PSB3: psb3, PSB4: psb4, PSB5: psb5, PSB6: psb6
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
    // CSV format is "QB_Scrambler", "MLB_FieldGeneral", "HB_ElusiveBack"
    // Need to convert to "QB Scrambler" format (space instead of underscore)
    if (typeof archetypeValue === 'string' && archetypeValue.trim() !== '') {
      try {
        // Convert "MLB_FieldGeneral" → "MLB Field General"
        let archetypeName = archetypeValue.trim().replace(/_/g, ' ');

        // Special case: "MantoMan" → "Man-to-Man" (before camelCase splitting)
        archetypeName = archetypeName.replace(/MantoMan/g, 'Man-to-Man');

        // Add spaces before capital letters in the second part
        // "MLBFieldGeneral" → "MLB Field General"
        archetypeName = archetypeName.replace(/([a-z])([A-Z])/g, '$1 $2');

        // CRITICAL: Validate archetype matches position
        // Extract position prefix from archetype (e.g., "MLB" from "MLB Field General")
        const archetypePrefix = archetypeName.split(' ')[0].toUpperCase();
        const positionUpper = position.toUpperCase();

        // Map position abbreviations to archetype prefixes
        const positionToArchetypePrefix: Record<string, string> = {
          'QB': 'QB', 'HB': 'HB', 'FB': 'FB', 'WR': 'WR', 'TE': 'TE',
          'LT': 'OT', 'RT': 'OT', 'LG': 'G', 'RG': 'G', 'C': 'C',
          'LEDG': 'DE', 'REDG': 'DE', 'DT': 'DT',
          'SAM': 'OLB', 'WILL': 'OLB', 'MIKE': 'MLB',
          'CB': 'CB', 'FS': 'S', 'SS': 'S',
          'K': 'KP', 'P': 'KP', 'LS': 'LS'
        };

        const expectedPrefix = positionToArchetypePrefix[positionUpper] || positionUpper;

        // DEBUG: Write to file
        const fs = require('fs');
        const path = require('path');
        const { app } = require('electron');
        const debugPath = path.join(app.getPath('userData'), 'ARCHETYPE_DEBUG.txt');
        fs.appendFileSync(debugPath, `\nCSV: "${archetypeValue}" → Converted: "${archetypeName}" (pos: ${position})\n`);
        fs.appendFileSync(debugPath, `Position: ${position} → Expected prefix: ${expectedPrefix}, Got: ${archetypePrefix}\n`);

        // If archetype doesn't match position, use default
        if (archetypePrefix !== expectedPrefix) {
          fs.appendFileSync(debugPath, `MISMATCH! Using default archetype for ${position}\n`);
          console.warn(`[RosterGeneratorService] Archetype mismatch: ${archetypeValue} for position ${position} - using default`);
          return this.getDefaultArchetype(position);
        }

        const archetypeId = ArchetypeService.getArchetypeId(archetypeName, position);
        fs.appendFileSync(debugPath, `Result ID: ${archetypeId}\n`);

        if (archetypeId !== 0 || archetypeName === 'QB Field General') {
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
    // Handle null/undefined position
    if (!position || position === '') {
      return 0; // Default to QB Field General
    }

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
      'MIKE': 51,   // MLB Field General
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
   * @param position - Player position
   * @param race - Race code (1=white, 2=?, 3=?, 4=?, 5=?, 6=black, 7=?)
   */
  private async assignGenericPID(position: string, race: number = 1): Promise<number> {
    // Use loaded generic PIDs (5600+ faces)
    if (this.genericPIDs.length === 0) {
      console.warn('[RosterGeneratorService] No generic PIDs loaded, returning default');
      return 719; // Fallback to a known generic PID
    }

    // DEBUG: Write to file for visibility
    const fs = require('fs');
    const path = require('path');
    const { app } = require('electron');
    const debugPath = path.join(app.getPath('userData'), 'RACE_DEBUG.txt');
    const debugMsg = `\n=== assignGenericPID called ===\nPosition: ${position}\nRace: ${race}\nTotal generic PIDs: ${this.genericPIDs.length}\nFirst 3 generic PIDs: ${this.genericPIDs.slice(0, 3).map(pid => `${pid}:${this.pidToPortrait.get(pid)}`).join(', ')}\n`;
    fs.appendFileSync(debugPath, debugMsg);

    // Filter PIDs by race using PID_Portrait_Mapping
    // Generic faces are named like "plpo_generic_1_001" where 1 is the race code
    const raceFilteredPIDs = [];
    for (const pid of this.genericPIDs) {
      const portraitInfo = this.pidToPortrait.get(pid);
      if (portraitInfo && portraitInfo.includes(`plpo_generic_${race}_`)) {
        raceFilteredPIDs.push(pid);
      }
    }

    fs.appendFileSync(debugPath, `Filtered to ${raceFilteredPIDs.length} PIDs for race ${race}\n`);
    if (raceFilteredPIDs.length > 0) {
      fs.appendFileSync(debugPath, `Sample: ${raceFilteredPIDs.slice(0, 3).map(pid => `${pid}:${this.pidToPortrait.get(pid)}`).join(', ')}\n`);
    }

    // If no faces found for this race, fall back to all generic faces
    const pidsToUse = raceFilteredPIDs.length > 0 ? raceFilteredPIDs : this.genericPIDs;
    fs.appendFileSync(debugPath, `Using ${pidsToUse.length} PIDs (${raceFilteredPIDs.length > 0 ? 'race-filtered' : 'FALLBACK - NO RACE MATCH!'})\n`);

    // Randomly select a generic face
    const randomIndex = Math.floor(Math.random() * pidsToUse.length);
    const selectedPID = pidsToUse[randomIndex];
    fs.appendFileSync(debugPath, `Selected: PID ${selectedPID}, portrait: ${this.pidToPortrait.get(selectedPID)}\n`);
    return selectedPID;
  }

  /**
   * Assign PGHE (generic head ID) based on race
   * PGHE values 1-290 control which generic face mesh is used
   * Based on analysis of official EA roster template
   */
  private assignGenericPGHE(race: number): number {
    // PGHE ranges that work well for each skin tone (from official roster analysis)
    // Many PGHEs overlap and work for multiple races - the PSKI field controls body skin
    const blackPGHEs = [6, 42, 57, 64, 79, 89, 101, 102, 108, 114, 131, 138, 143, 148, 160, 161, 164, 190, 209, 210, 211, 224, 230, 255, 257, 267, 274, 280];
    const whitePGHEs = [11, 12, 18, 24, 50, 54, 55, 56, 85, 90, 146, 154, 155, 158, 176, 202, 212, 227, 239, 243, 245, 253, 256, 264, 290];
    // Shared PGHEs work for either race (most common)
    const sharedPGHEs = [1, 7, 21, 25, 27, 34, 36, 53, 59, 62, 67, 77, 84, 93, 99, 100, 109, 119, 120, 128, 132, 139, 142, 147, 157, 162, 183, 188, 200, 232, 246, 247, 261, 271, 273, 278, 282, 286, 287, 288];

    let pgheList: number[];

    // Map race to appropriate PGHE pool
    switch (race) {
      case 1: // Caucasian - use white or shared
        pgheList = [...whitePGHEs, ...sharedPGHEs];
        break;
      case 2: // African American Medium
      case 3: // African American Light
      case 4: // African American Dark
      case 7: // Default (Black)
        pgheList = [...blackPGHEs, ...sharedPGHEs];
        break;
      case 5: // Hispanic/Latino
      case 6: // Mixed/Multi-Racial
        pgheList = sharedPGHEs; // Use shared pool for mixed
        break;
      default:
        pgheList = sharedPGHEs;
    }

    // Random selection from appropriate pool
    return pgheList[Math.floor(Math.random() * pgheList.length)];
  }

  /**
   * Map CSV race code to Madden PSKI value
   * PSKI controls body skin tone for GENERIC faces (PLPL=0):
   * Verified from official EA roster (M26):
   * - Kyle McCord, Quinn Ewers, Graham Mertz, Jaxson Dart (white) = PSKI 2
   * - Cam Ward, Ashton Jeanty, Jalen Milroe, Quinshon Judkins (black) = PSKI 1
   * - 0 = Mixed/default
   * - 1 = Black/darker skin
   * - 2 = White/lighter skin
   */
  /**
   * Map race to PSKI (body skin tone)
   * PSKI must match the face's skin tone to avoid mismatched head/body
   */
  private mapRaceToPSKI(race: number): number {
    switch (race) {
      case 1: // Caucasian
        return 2; // White body (PSKI 2)
      case 2: // African American Medium
      case 3: // African American Light
      case 4: // African American Dark
      case 7: // Default (Black)
        return 1; // Black body (PSKI 1)
      case 5: // Hispanic/Latino
      case 6: // Mixed/Multi-Racial
        return 0; // Mixed/default (PSKI 0)
      default:
        return 1; // Default to black (NFL demographics)
    }
  }

  /**
   * Derive PSKI from PAM string to ensure body matches face
   * PAM format: gen_X_Y_Z_NNN where X is skin tone (1-7)
   * Returns: PSKI value (1=black, 2=white, 0=mixed)
   */
  private getPSKIFromPAM(pam: string): number {
    if (!pam || !pam.startsWith('gen_')) return 1; // Default to black
    const skinTone = parseInt(pam.charAt(4)); // First digit after "gen_"
    if (isNaN(skinTone)) return 1;

    // Map skin tone to PSKI
    if (skinTone <= 2) return 2; // Light skin -> white body
    if (skinTone >= 5) return 1; // Dark skin -> black body
    return 0; // Medium skin -> mixed body
  }

  /**
   * Map CSV race to skin tone (1-7) used in generic head names
   * Skin tone is the FIRST DIGIT of head name (1=lightest, 7=darkest)
   * CSV race: 1=Caucasian, 2-4,7=Black variants, 5=Hispanic, 6=Mixed
   */
  private mapCsvRaceToSkinTone(csvRace: number): number {
    switch (csvRace) {
      case 1: // Caucasian -> lightest skin tones
        return Math.random() < 0.5 ? 1 : 2;
      case 2: // African American Medium
        return 5;
      case 3: // African American Light
        return 4;
      case 4: // African American Dark
        return 7;
      case 7: // Default (Black) -> darkest skin tones
        return Math.random() < 0.5 ? 6 : 7;
      case 5: // Hispanic/Latino -> medium skin tones
        return Math.random() < 0.5 ? 3 : 4;
      case 6: // Mixed/Multi-Racial -> medium range
        return Math.random() < 0.33 ? 3 : (Math.random() < 0.5 ? 4 : 5);
      default:
        return 6; // Default to darker
    }
  }

  /**
   * Select a random generic face that matches the player's race
   * Uses PGHE lookup from game's streameddata.DB for proper face assignments.
   * Each generic face has its own unique PID (PSXP) that the game uses to look up the face.
   * Returns PID, GENR (PAM), and PGHE index.
   */
  private selectGenericFaceByRace(race: number): { pid: number; pam: string; pghe: number } {
    // Use PGHE service to get a random face for this race
    // Race 1-7 maps directly to skin tone 1-7
    const skinTone = pgheLookupService.raceToSkinTone(race);
    const pgheEntry = pgheLookupService.getRandomBySkinTone(skinTone);

    if (pgheEntry) {
      console.log(`[RosterGeneratorService] Selected PGHE face for race ${race}: PID=${pgheEntry.psxp}, GENR=${pgheEntry.genr}, PGHE=${pgheEntry.pghe}`);
      return {
        pid: pgheEntry.psxp,  // The unique PID for this generic face
        pam: pgheEntry.genr,  // The GENR value (e.g., "gen_7_B_N_019")
        pghe: pgheEntry.pghe  // The face picker index
      };
    }

    // Fallback if PGHE service not available
    console.warn(`[RosterGeneratorService] PGHE lookup failed for race ${race}, using fallback`);
    const pam = this.generateGenericHeadName(race);
    const pghe = this.assignGenericPGHE(race);
    const pid = this.genericPIDs.length > 0
      ? this.genericPIDs[Math.floor(Math.random() * this.genericPIDs.length)]
      : 719;

    return { pid, pam, pghe };
  }

  /**
   * Assign generic PAM for player without portrait
   * Generate proper Madden genericHeadName format: gen_X_YY_ZZ_NNN
   * Where: X=race (1-7), YY=body type code, ZZ=face variant, NNN=number
   * Example valid formats: gen_1_B_N_010, gen_7_B_G_005, gen_7_M_MB_009
   */
  private async assignGenericPAM(position: string, race?: number): Promise<string> {
    return this.generateGenericHeadName(race || 1);
  }

  /**
   * Generate a valid Madden genericHeadName by selecting from actual PAM assets.
   *
   * Uses pam-race-mapping.json which contains real PAM names extracted from game files.
   * This ensures the PAM will actually work in-game with proper skin tone matching.
   *
   * IMPORTANT: Body code determines skin tone for arms/body:
   * - M, T = Mixed/Tan (white/light skin)
   * - H = Hispanic
   * - B, BM, BMH = Black
   *
   * Race mapping (from ROSTER_lookup):
   * 1 = Caucasian -> white PAMs (M or T body codes)
   * 2 = African American Medium -> black PAMs (B body codes)
   * 3 = African American Light -> black PAMs (BM body codes)
   * 4 = African American Dark -> black PAMs (B body codes)
   * 5 = Hispanic/Latino -> hispanic PAMs (H body codes)
   * 6 = Mixed/Multi-Racial -> white or hispanic PAMs (M or BM body codes)
   * 7 = Default (Black) -> black PAMs (B body codes)
   */
  private generateGenericHeadName(race: number): string {
    // If we have the PAM mapping loaded, use it for accurate PAM selection
    if (this.pamRaceMapping) {
      let pamList: string[];

      switch (race) {
        case 1: // Caucasian - white skin
          pamList = this.pamRaceMapping.white;
          break;
        case 5: // Hispanic/Latino
          pamList = this.pamRaceMapping.hispanic;
          break;
        case 6: // Mixed/Multi-Racial - could be either
          // Randomly choose between white and hispanic for mixed race
          pamList = Math.random() < 0.5 ? this.pamRaceMapping.white : this.pamRaceMapping.hispanic;
          break;
        case 2: // African American Medium
        case 3: // African American Light
        case 4: // African American Dark
        case 7: // Default Black
        default:
          pamList = this.pamRaceMapping.black;
          break;
      }

      if (pamList && pamList.length > 0) {
        return pamList[Math.floor(Math.random() * pamList.length)];
      }
    }

    // Fallback: Generate PAM name if mapping not available
    // Select body code based on race to match skin tone
    let bodyCodes: string[];
    switch (race) {
      case 1: // Caucasian - white skin
        bodyCodes = ['M', 'T'];
        break;
      case 5: // Hispanic/Latino
        bodyCodes = ['H'];
        break;
      case 6: // Mixed/Multi-Racial
        bodyCodes = ['M', 'BM'];
        break;
      case 2: // African American Medium
      case 3: // African American Light
      case 4: // African American Dark
      case 7: // Default Black
      default:
        bodyCodes = ['B', 'BM', 'BMH'];
        break;
    }

    // Valid face codes from working files
    const faceCodes = ['B', 'BD', 'G', 'GM', 'MB', 'N', 'S'];

    const bodyCode = bodyCodes[Math.floor(Math.random() * bodyCodes.length)];
    const faceCode = faceCodes[Math.floor(Math.random() * faceCodes.length)];

    // Generate number - working files use both 2 and 3 digit formats
    const useThreeDigit = Math.random() < 0.5;
    const maxNum = useThreeDigit ? 15 : 20;
    const num = Math.floor(Math.random() * maxNum) + 1;
    const numStr = useThreeDigit ? String(num).padStart(3, '0') : String(num).padStart(2, '0');

    return `gen_${race}_${bodyCode}_${faceCode}_${numStr}`;
  }

  /**
   * Lookup college ID from name
   * Handles abbreviated names from CSV (e.g., "Appalach. St." -> "Appalachian State")
   */
  private async lookupCollege(collegeName: string | number | null | undefined): Promise<number> {
    // Handle null/undefined/empty
    if (collegeName === null || collegeName === undefined || collegeName === '') {
      return 0; // N/A - No college specified
    }

    // If it's already a number, it's a college ID - return it directly
    if (typeof collegeName === 'number') {
      return collegeName;
    }

    // Convert to string and trim
    const cleanName = String(collegeName).trim();
    if (cleanName === '') {
      return 0;
    }

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

      console.warn(`[RosterGeneratorService] College not found in lookup: "${collegeName}", using N/A (0)`);
      return 0; // N/A - College not in list
    } catch (error) {
      console.warn('[RosterGeneratorService] College lookup failed:', collegeName, error);
      return 0; // N/A on error
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
   * Lookup state ID directly by state name
   * Takes a state name like "Tennessee" and returns the PHSN ID (41)
   */
  private async lookupStateByName(stateName: string | number | null | undefined): Promise<number> {
    // Handle null/undefined/empty
    if (stateName === null || stateName === undefined || stateName === '') {
      return 50; // Non-US (default for missing data)
    }

    // If it's already a number, it's a state ID - return it directly
    if (typeof stateName === 'number') {
      return stateName;
    }

    // Convert to string and handle empty
    const cleanName = String(stateName).trim();
    if (cleanName === '') {
      return 50;
    }

    try {
      const options = await lookupService.getDropdownOptions('state_lookup.csv');
      // Case-insensitive match
      const match = options.find((opt: any) =>
        opt.name.toLowerCase() === cleanName.toLowerCase()
      );
      if (match) {
        return match.id;
      }
    } catch (error) {
      console.warn('[RosterGeneratorService] State lookup by name failed:', stateName, error);
    }

    // Default to Non-US if no mapping found
    return 50;
  }

  /**
   * Get position name from position code (reverse lookup)
   */
  private async getPositionName(positionCode: number): Promise<string> {
    try {
      const options = await lookupService.getDropdownOptions('position_lookup.csv');
      const match = options.find((opt: any) => opt.id === positionCode);
      return match ? match.name : 'QB'; // Fallback to QB
    } catch (error) {
      console.warn('[RosterGeneratorService] Position name lookup failed for code:', positionCode);
      return 'QB';
    }
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
      'MIKE': 'Mike',    // Middle - MUST match position_lookup.csv exactly (capital M)
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
      return 1009; // Default to Free Agent
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
      'NE': 'Pats',
      'NWE': 'Pats',
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

      // Historical team codes (from ROSTER_lookup.csv)
      'OTI': 'Titans',      // Houston Oilers → Tennessee Titans
      'CLT': 'Colts',       // Baltimore/Indianapolis Colts
      'CRD': 'Cards',       // Phoenix/Arizona Cardinals
      'RAI': 'Raiders',     // Oakland/LA Raiders
      'RAV': 'Ravens',      // Baltimore Ravens

      // Historical team names (full and short)
      'Oilers': 'Titans',           // Houston Oilers → Tennessee Titans
      'Houston Oilers': 'Titans',   // Houston Oilers → Tennessee Titans
      'Phoenix Cardinals': 'Cards', // Phoenix Cardinals → Arizona Cardinals
      'St. Louis Cardinals': 'Cards', // St. Louis Cardinals → Arizona Cardinals
      'Baltimore Colts': 'Colts',   // Baltimore Colts → Indianapolis Colts
      'Los Angeles Raiders': 'Raiders', // LA Raiders → Las Vegas Raiders
      'St. Louis Rams': 'Rams',     // St. Louis Rams → Los Angeles Rams

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
      'New England Patriots': 'Pats',
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
      'Patriots': 'Pats',
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

      // DEBUG: Log 49ers lookups
      const is49ers = cleanName === '49ers' || cleanName.includes('49');
      if (is49ers) {
        console.log(`[TEAM LOOKUP DEBUG] Looking up "${cleanName}"...`);
      }

      // Try mapping first (handles all variations)
      const mappedName = TEAM_NAME_MAP[cleanName] || TEAM_NAME_MAP[cleanName.toUpperCase()];
      if (is49ers) {
        console.log(`[TEAM LOOKUP DEBUG] mappedName = "${mappedName}"`);
      }

      if (mappedName) {
        const teamId = lookupService.getNumericId('team_lookup.csv', mappedName);
        if (is49ers) {
          console.log(`[TEAM LOOKUP DEBUG] lookupService.getNumericId('team_lookup.csv', '${mappedName}') = ${teamId}`);
        }
        // getNumericId returns 0 when not found, but valid team IDs are 1-32 and 1009
        if (teamId > 0) {
          return teamId;
        }
      }

      // Try direct lookup as fallback
      const teamId = lookupService.getNumericId('team_lookup.csv', cleanName);
      if (is49ers) {
        console.log(`[TEAM LOOKUP DEBUG] Direct lookup: getNumericId('team_lookup.csv', '${cleanName}') = ${teamId}`);
      }
      // getNumericId returns 0 when not found, but valid team IDs are 1-32 and 1009
      if (teamId > 0) {
        return teamId;
      }
    } catch (error) {
      console.warn('[RosterGeneratorService] Team lookup failed for:', teamName, error);
    }

    console.warn(`[RosterGeneratorService] Unknown team name: "${teamName}" - defaulting to Free Agents (mapped="${TEAM_NAME_MAP[teamName.trim()] || TEAM_NAME_MAP[teamName.trim().toUpperCase()]}")`);
    return 1009; // Free Agents (ID 1009, not 32 which is Texans!)
  }

  /**
   * Determine PCBT (body type code) for roster files
   * Returns numeric code: 0=Standard, 1=Thin, 2=Muscular, 3=Heavy, 4=Extra Heavy
   * Based on EA's official roster file body type distribution
   */
  private determinePCBT(csvRow: any): number {
    const weight = parseInt(csvRow.Weight) || 200;
    const position = (csvRow.Position || '').toUpperCase();

    // Offensive Line - Heavy (3) for most, Extra Heavy (4) for 330+ lbs
    if (['LT', 'LG', 'C', 'RG', 'RT'].includes(position)) {
      return weight >= 330 ? 4 : 3; // Extra Heavy for massive OL, otherwise Heavy
    }

    // Defensive Tackle - Heavy (3) for most, Extra Heavy (4) for 330+ lbs
    if (position === 'DT') {
      return weight >= 330 ? 4 : 3;
    }

    // Edge Rushers - Muscular (2)
    if (['LEDG', 'REDG', 'LE', 'RE', 'DE'].includes(position)) {
      return 2; // Muscular
    }

    // Tight End - Muscular (2) for bigger TEs, Standard (0) for others
    if (position === 'TE') {
      return weight >= 260 ? 2 : 0;
    }

    // Fullback - Heavy (3) or Muscular (2) based on weight
    if (position === 'FB') {
      return weight >= 250 ? 3 : 2;
    }

    // Kicker/Punter - Thin (1)
    if (position === 'K' || position === 'P') {
      return 1; // Thin
    }

    // All other positions (QB, WR, HB, CB, FS, SS, LB, LS): Standard (0)
    return 0;
  }

  /**
   * Determine PCBT (body type code) for filler players based on position code
   * Returns numeric code: 0=Standard, 1=Thin, 2=Muscular, 3=Heavy, 4=Extra Heavy
   * Position codes: QB=0, HB=1, FB=2, WR=3, TE=4, LT=5, LG=6, C=7, RG=8, RT=9, LE=10, RE=11, DT=12, LOLB=13, MLB=14, ROLB=15, CB=16, FS=17, SS=18, K=19, P=20
   */
  private determineFillerPCBT(positionCode: number): number {
    // Offensive Line (LT=5, LG=6, C=7, RG=8, RT=9) - Heavy (3)
    if (positionCode >= 5 && positionCode <= 9) {
      return 3; // Heavy
    }

    // Defensive Tackle (DT=12) - Heavy (3)
    if (positionCode === 12) {
      return 3; // Heavy
    }

    // Edge Rushers (LE=10, RE=11) - Muscular (2)
    if (positionCode === 10 || positionCode === 11) {
      return 2; // Muscular
    }

    // Tight End (TE=4) - Muscular (2)
    if (positionCode === 4) {
      return 2; // Muscular
    }

    // Fullback (FB=2) - Muscular (2)
    if (positionCode === 2) {
      return 2; // Muscular
    }

    // Kicker/Punter (K=19, P=20) - Thin (1)
    if (positionCode === 19 || positionCode === 20) {
      return 1; // Thin
    }

    // All other positions: Standard (0)
    return 0;
  }

  /**
   * Determine PTAR (body type string) for filler players based on position code
   * Returns string: "Thin", "Muscular", or "Heavy"
   * NEVER returns null - null causes Madden to default to incorrect body types
   * Position codes: QB=0, HB=1, FB=2, WR=3, TE=4, LT=5, LG=6, C=7, RG=8, RT=9, LE=10, RE=11, DT=12, LOLB=13, MLB=14, ROLB=15, CB=16, FS=17, SS=18, K=19, P=20
   */
  private determineFillerPTAR(positionCode: number): string {
    // Offensive Line (LT=5, LG=6, C=7, RG=8, RT=9) - Heavy
    if (positionCode >= 5 && positionCode <= 9) {
      return 'Heavy';
    }

    // Defensive Tackle (DT=12) - Heavy
    if (positionCode === 12) {
      return 'Heavy';
    }

    // Edge Rushers (LE=10, RE=11) - Muscular
    if (positionCode === 10 || positionCode === 11) {
      return 'Muscular';
    }

    // Tight End (TE=4) - Muscular
    if (positionCode === 4) {
      return 'Muscular';
    }

    // Fullback (FB=2) - Muscular
    if (positionCode === 2) {
      return 'Muscular';
    }

    // Kicker/Punter (K=19, P=20) - Thin
    if (positionCode === 19 || positionCode === 20) {
      return 'Thin';
    }

    // QB (0) - Muscular (not fat!)
    if (positionCode === 0) {
      return 'Muscular';
    }

    // HB (1), WR (3), CB (16), FS (17), SS (18), Linebackers (13, 14, 15) - Muscular
    // These positions should NEVER be fat
    return 'Muscular';
  }

  /**
   * Determine body type based on position and weight/height using BMI
   * Returns Madden body type STRING: "Thin", "Muscular", or "Heavy"
   * NEVER returns null - null causes Madden to default to incorrect body types (fat players)
   * Based on CreatorService BMI-based logic for realistic body proportions
   */
  private determineBodyType(csvRow: any): string {
    const weight = parseInt(csvRow.Weight) || 200;
    const position = (csvRow.Position || '').toUpperCase();
    const height = parseInt(csvRow.Height) || 73; // Default 6'1"

    // Calculate BMI for proportional body type assignment
    const bmi = (weight / (height * height)) * 703;

    // Offensive Line - ALWAYS Heavy
    if (['LT', 'LG', 'C', 'RG', 'RT'].includes(position)) {
      return 'Heavy';
    }

    // Defensive Tackle - Heavy
    if (position === 'DT') {
      return 'Heavy';
    }

    // Edge Rushers (LEDG/REDG, LE/RE) - Muscular
    if (['LEDG', 'REDG', 'LE', 'RE', 'DE'].includes(position)) {
      return 'Muscular';
    }

    // Kicker/Punter - Thin
    if (position === 'K' || position === 'P') {
      return 'Thin';
    }

    // QB - Muscular (not Heavy, not Thin)
    if (position === 'QB') {
      return 'Muscular';
    }

    // WR, CB, FS - Thin for lean players, Muscular for bigger ones
    if (['WR', 'CB', 'FS'].includes(position)) {
      return bmi < 24 ? 'Thin' : 'Muscular';
    }

    // HB, FB, SS, TE, Linebackers - Muscular for skill players, Heavy for bigger ones
    if (['HB', 'FB', 'SS', 'TE', 'SAM', 'MIKE', 'WILL', 'MLB', 'LOLB', 'ROLB'].includes(position)) {
      return bmi < 26 ? 'Muscular' : 'Heavy';
    }

    // Default: Muscular (safe default that looks normal in-game)
    return 'Muscular';
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
    // FORCE roster size to 3000 - the template is used for structure only, not size
    // The draft class template has ~402 prospects, but we need to generate a full roster with FAs
    console.log('[RosterGeneratorService] Using roster size: 3000 (full roster with FA pool)');
    return 3000;
  }

  /**
   * Validate year availability
   */
  async validateYear(year: number): Promise<{ valid: boolean, error?: string, playerCount?: number }> {
    if (!this.initialized) {
      await this.initialize();
    }

    // Query database for this year
    const players = lookupService.getAllPlayerSeasonsForYear(year);
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
   * Get available years - now queries database
   */
  async getAvailableYears(): Promise<number[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    return lookupService.getAvailableRosterYears();
  }

  /**
   * Save generated roster to file
   * @param players - Array of players to save
   * @param templatePath - Path to template roster file
   * @param outputPath - Output file path
   */
  async saveRoster(
    players: RosterPlayer[],
    templatePath: string,
    outputPath: string
  ): Promise<boolean> {
    try {
      console.log(`[RosterGeneratorService] Saving roster to: ${outputPath}`);
      console.log(`[RosterGeneratorService] Template: ${templatePath}`);
      console.log(`[RosterGeneratorService] Players: ${players.length}`);

      // Step 1: Copy template to output path
      console.log(`[RosterGeneratorService] Copying template to output path...`);
      await fs.promises.copyFile(templatePath, outputPath);
      console.log(`[RosterGeneratorService] Template copied successfully`);

      // Step 2: Load the copied file
      console.log(`[RosterGeneratorService] Loading copied roster...`);
      const RosterParser = require(path.join(__dirname, 'parsers', 'RosterParser.js'));
      const { parseRosterFile, saveRosterFile } = RosterParser;

      const rosterData = await parseRosterFile(outputPath);
      const templateSize = rosterData.playerCount;
      console.log(`[RosterGeneratorService] ===== PADDING DEBUG =====`);
      console.log(`[RosterGeneratorService] Template has ${templateSize} slots, we generated ${players.length} players`);

      // PAD to match template size (generate random players for missing slots)
      let finalPlayers = [...players];
      if (finalPlayers.length < templateSize) {
        console.log(`[RosterGeneratorService] Padding ${templateSize - finalPlayers.length} random players to match template size...`);
        while (finalPlayers.length < templateSize) {
          const randomPlayer = await this.generateRandomPlayer(2024);
          console.log(`[RosterGeneratorService] Generated padding player ${finalPlayers.length + 1}: ${randomPlayer.PFNA} ${randomPlayer.PLNA}`);
          finalPlayers.push(randomPlayer);
        }
        console.log(`[RosterGeneratorService] ✓ Padded to ${finalPlayers.length} total players`);
      } else {
        console.log(`[RosterGeneratorService] No padding needed - already have enough players`);
      }

      console.log(`[RosterGeneratorService] About to write ${finalPlayers.length} players to file with ${templateSize} slots`);
      console.log(`[RosterGeneratorService] ===== END PADDING DEBUG =====`);

      // Step 4: Save back to the same file
      await saveRosterFile(outputPath, finalPlayers, rosterData);

      console.log(`[RosterGeneratorService] ✓ Roster saved successfully as Madden 26 file`);
      console.log(`[RosterGeneratorService] File: ${outputPath}`);

      return true;

    } catch (error: any) {
      console.error('[RosterGeneratorService] Error saving roster:', error);
      throw new Error(`Failed to save roster: ${error.message}`);
    }
  }
}

// Singleton instance
export const rosterGeneratorService = new RosterGeneratorService();
