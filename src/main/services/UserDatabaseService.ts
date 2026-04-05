/**
 * User Database Service
 *
 * Manages user edits to the player database using an overlay pattern.
 * User edits are stored separately from the original database, allowing:
 * - Original data to remain intact for reset
 * - User edits to persist across app updates (via backup/restore)
 * - Merge at runtime for seamless display
 */

import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

import Database from 'better-sqlite3';

import { lookupService } from './lookup-service';

// All rating fields from the database schema
// These MUST match the Madden 26 TDB2 roster file field codes exactly
// Reference: madden-franchise-utils/franchiseToRoster/lookupFiles/directTransferFields.json
const RATING_FIELDS = [
  // Core ratings
  'POVR',  // Overall
  // Physical
  'PSPD',  // Speed
  'PACC',  // Acceleration
  'PSTR',  // Strength
  'PAGI',  // Agility
  'PJMP',  // Jumping
  'PSTA',  // Stamina (NOT PSTM - that's sleeve temperature!)
  'PINJ',  // Injury
  'PTGH',  // Toughness
  'PAWR',  // Awareness
  'PELU',  // Change of Direction (M26 roster code)
  // Running
  'PBCV',  // Ball Carrier Vision
  'PBKT',  // Break Tackle (M26 roster code)
  'PLTR',  // Trucking (M26 roster code)
  'PLSA',  // Stiff Arm (M26 roster code)
  'PLSM',  // Spin Move (M26 roster code)
  'PLJM',  // Juke Move (M26 roster code)
  'PCAR',  // Carrying
  // Passing
  'PTHA',  // Throw Accuracy
  'PTAS',  // Throw Accuracy Short
  'PTAM',  // Throw Accuracy Mid
  'PTAD',  // Throw Accuracy Deep
  'PTOR',  // Throw on the Run
  'PTUP',  // Throw Under Pressure
  'PTHP',  // Throw Power (M26 roster code)
  'PPLA',  // Play Action
  // Receiving
  'PCTH',  // Catching
  'PLSC',  // Spectacular Catch (M26 roster code)
  'PLCI',  // Catch in Traffic (M26 roster code)
  'SRRN',  // Short Route Running (M26 roster code)
  'PMRR',  // Medium Route Running
  'PDRR',  // Deep Route Running
  'PLRL',  // Release (M26 roster code)
  // Blocking
  'PRBK',  // Run Block
  'PPBK',  // Pass Block
  'PLIB',  // Impact Blocking (M26 roster code)
  'PLBK',  // Lead Block
  'PRBF',  // Run Block Finesse (M26 roster code)
  'PPBS',  // Pass Block Power (M26 roster code)
  'PRBS',  // Run Block Power
  'PPBF',  // Pass Block Finesse
  // Defense
  'PTAK',  // Tackle
  'PLHT',  // Hit Power (M26 roster code)
  'PLPE',  // Press (M26 roster code)
  'PFMS',  // Finesse Moves (M26 roster code)
  'PLPM',  // Power Moves (M26 roster code)
  'PBSG',  // Block Shedding (M26 roster code)
  'PLPR',  // Play Recognition (M26 roster code)
  'PLPU',  // Pursuit (M26 roster code)
  // Coverage
  'PLMC',  // Man Coverage (M26 roster code)
  'PLZC',  // Zone Coverage (M26 roster code)
  // Kicking
  'PKAC',  // Kick Accuracy
  'PKPR',  // Kick Power (M26 roster code - NOT PKPW!)
  'PKRT',  // Kick Return
  // Special
  'PIMP',  // Long Snap
  'PBSK'   // Break Sack
];

// Legacy field name mappings for database migration
// Maps old wrong names to correct M26 roster names
const LEGACY_TO_M26_FIELD_MAP: Record<string, string> = {
  'PKPW': 'PKPR',  // Kick Power
  'PSTM': 'PSTA',  // Stamina (PSTM was sleeve temp, wrong!)
  'PBTK': 'PBKT',  // Break Tackle
  'PTRK': 'PLTR',  // Trucking
  'PCOD': 'PELU',  // Change of Direction
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
  'PFMV': 'PFMS',  // Finesse Moves
  'PPWM': 'PLPM',  // Power Moves
  'PBSH': 'PBSG',  // Block Shedding
  'PPRC': 'PLPR',  // Play Recognition
  'PPUR': 'PLPU',  // Pursuit
  'PMCV': 'PLMC',  // Man Coverage
  'PZCV': 'PLZC',  // Zone Coverage
};

export interface PlayerEdit {
  originalId: number;
  firstName?: string;
  lastName?: string;
  collegeId?: number;
  race?: number;
  height?: number;
  weight?: number;
  hometown?: string;
  homeState?: string;
  draftClass?: number;
  draftRound?: string;
  draftPick?: number;
  careerFrom?: number;
  careerTo?: number;
  bodyType?: string;
  handedness?: number;
  isHof?: boolean;
  editedAt?: string;
}

export interface AppearanceEdit {
  originalPlayerId: number;
  maddenPid?: number;
  maddenPam?: string;
  maddenPlpo?: string;
  maddenCommid?: string;
  // PGHE matched set fields for generic faces
  maddenPghe?: number;       // PGHE index (face picker index, 1-294)
  maddenPfcg?: string;       // PFCG code (e.g., "1_B_B_005")
  maddenGpan?: string;       // GPAN portrait asset name
  maddenGslp?: number;       // GSLP skin tone value from file
  maddenCpvf?: number;       // CPVF flag (0 or 1)
  maddenSkinTone?: number;   // Derived skin tone (1-7)
  editedAt?: string;
}

export interface SeasonEdit {
  id?: number;
  originalPlayerId: number;
  year: number;
  team?: string;
  jersey?: number;
  age?: number;
  position?: string;
  archetype?: string;
  ratings?: { [key: string]: number };
  editedAt?: string;
}

// Equipment slot fields (matching EQUIPMENT_OPTIONS in RosterParser.js)
const EQUIPMENT_SLOTS = [
  'Helmet', 'Facemask', 'Visor', 'FacePaint', 'Mouthpiece', 'Neckpad', 'HelmetFlag', 'GuardianCap',
  'LeftSleeve', 'RightSleeve', 'LeftElbow', 'RightElbow', 'LeftWrist', 'RightWrist',
  'LeftGlove', 'RightGlove',
  'Undershirt', 'JerseyStyle', 'BackPlate', 'FlakJacket', 'Towel', 'Handwarmer',
  'LeftShoe', 'RightShoe', 'LeftShoeColor', 'RightShoeColor', 'LeftSpats', 'RightSpats',
  'Socks', 'KneePad', 'LeftThighPad', 'RightThighPad', 'ShoulderPads'
];

export interface EquipmentEdit {
  id?: number;
  originalPlayerId: number;
  year: number;
  equipment: { [slot: string]: string };
  editedAt?: string;
}

export interface TraitEdit {
  id?: number;
  originalPlayerId: number;
  year: number;
  traits: { [traitName: string]: boolean | number };
  editedAt?: string;
}

export interface CustomPlayer {
  id?: number;
  firstName: string;
  lastName: string;
  collegeId?: number;
  race?: number;
  height?: number;
  weight?: number;
  hometown?: string;
  homeState?: string;
  position?: string;
  draftClass?: number;
  draftRound?: string;
  draftPick?: number;
  careerFrom?: number;
  careerTo?: number;
  maddenPid?: number;
  maddenPam?: string;
  maddenPlpo?: string;
  maddenCommid?: string;
  bodyType?: number;
  handedness?: number;
  has3DModel?: boolean;
  createdAt?: string;
  editedAt?: string;
}

export interface CustomPlayerSeason {
  id?: number;
  customPlayerId: number;
  year: number;
  team?: string;
  jersey?: number;
  age?: number;
  position?: string;
  archetype?: string;
  ratings?: { [key: string]: number };
}

export interface CustomPortrait {
  pid: number;                    // 12000+ range
  imageData: Buffer;              // PNG image bytes (512x512)
  originalFilename?: string;      // Source filename
  playerName?: string;            // Optional: associated player name
  databasePlayerId?: number;      // Optional: linked database player internal ID
  year?: number;                  // Optional: for year grouping
  createdAt?: string;
}

export interface CustomCoachPortrait {
  pid: number;                    // 50000+ range for coaches
  imageData: Buffer;              // PNG image bytes (512x512)
  originalFilename?: string;      // Source filename
  coachName?: string;             // Optional: associated coach name
  databaseCoachId?: number;       // Optional: linked database coach internal ID
  year?: number;                  // Optional: for year grouping
  createdAt?: string;
}

export interface ImportResult {
  success: boolean;
  imported: number;
  skipped: number;
  errors: string[];
}

export interface DatabaseStats {
  editedPlayers: number;
  customPlayers: number;
  editedSeasons: number;
  customSeasons: number;
}

// =============================================
// COACH INTERFACES
// =============================================

export interface CoachEdit {
  originalId: number;           // PID from Coach_lookup.csv
  firstName?: string;
  lastName?: string;
  teamIndex?: number;
  position?: string;            // HC, OC, DC
  experience?: number;
  age?: number;
  editedAt?: string;
}

export interface CoachAppearanceEdit {
  originalCoachId: number;
  maddenPid?: number;
  maddenPam?: string;
  headAsset?: string;  // GenericHeadAssetName from coachAppearance.json
  editedAt?: string;
}

export interface CoachSeasonEdit {
  id?: number;
  originalCoachId: number;
  year: number;
  team?: string;
  position?: string;
  wins?: number;
  losses?: number;
  ties?: number;
  playoffWins?: number;
  superBowlWins?: number;
  editedAt?: string;
}

export interface CustomCoach {
  id?: number;
  firstName: string;
  lastName: string;
  teamIndex?: number;
  position?: string;
  experience?: number;
  age?: number;
  careerFrom?: number;
  careerTo?: number;
  maddenPid?: number;
  maddenPam?: string;
  headAsset?: string;  // GenericHeadAssetName from coachAppearance.json
  createdAt?: string;
  editedAt?: string;
}

export interface CustomCoachSeason {
  id?: number;
  customCoachId: number;
  year: number;
  team?: string;
  position?: string;
  wins?: number;
  losses?: number;
  ties?: number;
  playoffWins?: number;
  superBowlWins?: number;
}

export interface CoachDatabaseStats {
  editedCoaches: number;
  customCoaches: number;
  editedSeasons: number;
  customSeasons: number;
}

class UserDatabaseService {
  private editsDb: Database.Database | null = null;
  private customDb: Database.Database | null = null;
  private userDataPath: string;
  private backupPath: string;
  private initialized = false;
  private initPromise: Promise<void>;

  constructor() {
    // Store user data in app's data folder (survives updates with backup/restore)
    this.userDataPath = this.resolveUserDataPath();
    this.backupPath = path.join(this.userDataPath, 'backup');
    this.initPromise = this.initialize();
  }

  private resolveUserDataPath(): string {
    // Use app.getPath('userData') which is the proper writable location:
    // - Windows: C:\Users\<username>\AppData\Roaming\<app-name>
    // - macOS: ~/Library/Application Support/<app-name>
    // - Linux: ~/.config/<app-name>
    // This location persists across app updates and is always writable
    return path.join(app.getPath('userData'), 'user-database');
  }

  public async waitForReady(): Promise<void> {
    await this.initPromise;
  }

  public isReady(): boolean {
    return this.initialized;
  }

  private async initialize(): Promise<void> {
    try {
      // Ensure directories exist
      if (!fs.existsSync(this.userDataPath)) {
        fs.mkdirSync(this.userDataPath, { recursive: true });
        console.log(`[UserDatabaseService] Created user data directory: ${this.userDataPath}`);
      }

      if (!fs.existsSync(this.backupPath)) {
        fs.mkdirSync(this.backupPath, { recursive: true });
      }

      // Copy bundled base databases on first run (if they exist and user hasn't customized yet)
      await this.copyBundledDatabases();

      // Initialize databases
      await this.initializeEditsDatabase();
      await this.initializeCustomDatabase();

      this.initialized = true;
      console.log('[UserDatabaseService] Initialized successfully');
    } catch (error) {
      console.error('[UserDatabaseService] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Copy bundled base databases from the app package to userData on first run.
   * This allows custom portraits and edits to be bundled with the installer.
   */
  private async copyBundledDatabases(): Promise<void> {
    // Determine bundled database location based on packaged vs dev mode
    // __dirname in packaged app is .vite/build, so data is at __dirname/data
    const possibleBundledPaths = app.isPackaged
      ? [
          path.join(__dirname, 'data', 'user-database'),  // Packaged: __dirname is .vite/build
          path.join(app.getAppPath(), '.vite', 'build', 'data', 'user-database'),
          path.join(process.resourcesPath || '', 'app', '.vite', 'build', 'data', 'user-database'),
        ]
      : [
          path.join(app.getAppPath(), 'data', 'user-database'),
          path.join(process.cwd(), 'data', 'user-database'),
        ];

    const bundledPath = possibleBundledPaths.find(p => fs.existsSync(p));

    if (!bundledPath) {
      console.log('[UserDatabaseService] No bundled user-database found, skipping copy');
      return;
    }

    const dbFiles = ['user-edits.db', 'custom-players.db'];

    for (const dbFile of dbFiles) {
      const srcPath = path.join(bundledPath, dbFile);
      const destPath = path.join(this.userDataPath, dbFile);

      // Always copy bundled database (overwrite existing)
      if (fs.existsSync(srcPath)) {
        try {
          const srcStats = fs.statSync(srcPath);
          const destExists = fs.existsSync(destPath);
          const destStats = destExists ? fs.statSync(destPath) : null;

          // Copy if dest doesn't exist OR bundled is larger (has more data)
          if (!destExists || srcStats.size > (destStats?.size || 0)) {
            fs.copyFileSync(srcPath, destPath);
            console.log(`[UserDatabaseService] Copied bundled ${dbFile} to user data (${srcStats.size} bytes)`);
          } else {
            console.log(`[UserDatabaseService] ${dbFile} already exists with equal/more data, keeping existing`);
          }
        } catch (err) {
          console.error(`[UserDatabaseService] Failed to copy ${dbFile}:`, err);
        }
      }
    }
  }

  private async initializeEditsDatabase(): Promise<void> {
    const dbPath = path.join(this.userDataPath, 'user-edits.db');
    const dbExists = fs.existsSync(dbPath);
    console.log(`[UserDatabaseService] Opening edits database: ${dbPath}, exists=${dbExists}`);
    this.editsDb = new Database(dbPath);
    console.log(`[UserDatabaseService] Opened edits database: ${dbPath}`);

    // Debug: Check if player_archetypes table exists and has data
    try {
      const tableCheck = this.editsDb.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='player_archetypes'").get();
      console.log(`[UserDatabaseService] player_archetypes table exists: ${!!tableCheck}`);
      if (tableCheck) {
        const countRow = this.editsDb.prepare('SELECT COUNT(*) as count FROM player_archetypes').get() as { count: number };
        console.log(`[UserDatabaseService] player_archetypes has ${countRow.count} rows`);
      }
    } catch (e) {
      console.log(`[UserDatabaseService] Could not check player_archetypes table (might not exist yet)`);
    }

    // Create tables if they don't exist
    this.editsDb.exec(`
      CREATE TABLE IF NOT EXISTS player_edits (
        original_id INTEGER PRIMARY KEY,
        first_name TEXT,
        last_name TEXT,
        college_id INTEGER,
        race INTEGER,
        height INTEGER,
        weight INTEGER,
        hometown TEXT,
        home_state TEXT,
        draft_class INTEGER,
        draft_round TEXT,
        draft_pick INTEGER,
        career_from INTEGER,
        career_to INTEGER,
        edited_at TEXT DEFAULT (datetime('now'))
      )
    `);

    // Migration: add hometown and home_state columns if they don't exist
    try {
      this.editsDb.exec(`ALTER TABLE player_edits ADD COLUMN hometown TEXT`);
    } catch {
      // Column already exists
    }
    try {
      this.editsDb.exec(`ALTER TABLE player_edits ADD COLUMN home_state TEXT`);
    } catch {
      // Column already exists
    }
    // Migration: add body_type and handedness columns for bio saving
    try {
      this.editsDb.exec(`ALTER TABLE player_edits ADD COLUMN body_type TEXT`);
    } catch {
      // Column already exists
    }
    try {
      this.editsDb.exec(`ALTER TABLE player_edits ADD COLUMN handedness INTEGER`);
    } catch {
      // Column already exists
    }
    // Migration: add is_hof column for Hall of Fame status
    try {
      this.editsDb.exec(`ALTER TABLE player_edits ADD COLUMN is_hof INTEGER DEFAULT 0`);
    } catch {
      // Column already exists
    }

    this.editsDb.exec(`
      CREATE TABLE IF NOT EXISTS appearance_edits (
        original_player_id INTEGER PRIMARY KEY,
        madden_pid INTEGER,
        madden_pam TEXT,
        madden_plpo TEXT,
        madden_commid TEXT,
        madden_pghe INTEGER,
        madden_pfcg TEXT,
        madden_gpan TEXT,
        madden_gslp INTEGER,
        madden_cpvf INTEGER,
        madden_skin_tone INTEGER,
        edited_at TEXT DEFAULT (datetime('now'))
      )
    `);

    // Migration: add PGHE columns for generic face support
    try { this.editsDb.exec(`ALTER TABLE appearance_edits ADD COLUMN madden_pghe INTEGER`); } catch { /* Column already exists */ }
    try { this.editsDb.exec(`ALTER TABLE appearance_edits ADD COLUMN madden_pfcg TEXT`); } catch { /* Column already exists */ }
    try { this.editsDb.exec(`ALTER TABLE appearance_edits ADD COLUMN madden_gpan TEXT`); } catch { /* Column already exists */ }
    try { this.editsDb.exec(`ALTER TABLE appearance_edits ADD COLUMN madden_gslp INTEGER`); } catch { /* Column already exists */ }
    try { this.editsDb.exec(`ALTER TABLE appearance_edits ADD COLUMN madden_cpvf INTEGER`); } catch { /* Column already exists */ }
    try { this.editsDb.exec(`ALTER TABLE appearance_edits ADD COLUMN madden_skin_tone INTEGER`); } catch { /* Column already exists */ }

    // Build season_edits table with all rating fields
    const ratingColumns = RATING_FIELDS.map(f => `${f} INTEGER`).join(', ');
    this.editsDb.exec(`
      CREATE TABLE IF NOT EXISTS season_edits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        original_player_id INTEGER NOT NULL,
        year INTEGER NOT NULL,
        team TEXT,
        jersey INTEGER,
        age INTEGER,
        position TEXT,
        archetype TEXT,
        ${ratingColumns},
        edited_at TEXT DEFAULT (datetime('now')),
        UNIQUE(original_player_id, year)
      )
    `);

    // Migration: add any missing rating columns to season_edits
    // This handles the case where the table was created with old field names
    for (const field of RATING_FIELDS) {
      try {
        this.editsDb.exec(`ALTER TABLE season_edits ADD COLUMN ${field} INTEGER`);
      } catch {
        /* Column already exists - that's fine */
      }
    }

    // Migration: copy data from legacy field names to correct M26 field names
    // This ensures existing user data isn't lost when we switch to correct names
    console.log('[UserDatabaseService] Migrating legacy field names to M26 roster names...');
    let migratedFields = 0;
    for (const [legacyField, m26Field] of Object.entries(LEGACY_TO_M26_FIELD_MAP)) {
      try {
        // Check if legacy column exists and has data
        const checkSql = `SELECT COUNT(*) as count FROM season_edits WHERE ${legacyField} IS NOT NULL AND ${legacyField} > 0`;
        const result = this.editsDb.prepare(checkSql).get() as { count: number } | undefined;
        if (result && result.count > 0) {
          // Copy data from legacy column to M26 column (only where M26 is null/0)
          const migrateSql = `UPDATE season_edits SET ${m26Field} = ${legacyField} WHERE (${m26Field} IS NULL OR ${m26Field} = 0) AND ${legacyField} IS NOT NULL AND ${legacyField} > 0`;
          const updateResult = this.editsDb.prepare(migrateSql).run();
          if (updateResult.changes > 0) {
            console.log(`[UserDatabaseService] Migrated ${updateResult.changes} rows: ${legacyField} -> ${m26Field}`);
            migratedFields++;
          }
        }
      } catch (e) {
        // Legacy column doesn't exist - that's fine, no migration needed
      }
    }
    if (migratedFields > 0) {
      console.log(`[UserDatabaseService] Field migration complete: ${migratedFields} legacy fields migrated`);
    }

    // Table to track players whose original seasons have been cleared
    // Used to fix wrongly-assigned seasons from name collisions
    this.editsDb.exec(`
      CREATE TABLE IF NOT EXISTS cleared_seasons (
        original_player_id INTEGER PRIMARY KEY,
        cleared_at TEXT DEFAULT (datetime('now'))
      )
    `);

    // Table to track hidden players (user wants them removed from search results)
    this.editsDb.exec(`
      CREATE TABLE IF NOT EXISTS hidden_players (
        original_player_id INTEGER PRIMARY KEY,
        hidden_at TEXT DEFAULT (datetime('now'))
      )
    `);

    // Table to track user overrides for bundled hidden players
    // If a player is hidden in bundled DB but user wants to see them, they go here
    this.editsDb.exec(`
      CREATE TABLE IF NOT EXISTS user_unhidden_players (
        original_player_id INTEGER PRIMARY KEY,
        unhidden_at TEXT DEFAULT (datetime('now'))
      )
    `);

    // Table to store player-level archetype (constant across all seasons)
    // Archetypes rarely change for a player, so we store at player level
    // This ensures consistent OVR calculation everywhere
    this.editsDb.exec(`
      CREATE TABLE IF NOT EXISTS player_archetypes (
        player_id INTEGER PRIMARY KEY,
        archetype TEXT NOT NULL,
        archetype_id INTEGER,
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `);

    // Equipment edits table - stores equipment selections per player per year
    // Equipment values are stored as JSON since there are 33 slots
    this.editsDb.exec(`
      CREATE TABLE IF NOT EXISTS equipment_edits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        original_player_id INTEGER NOT NULL,
        year INTEGER NOT NULL,
        equipment_json TEXT NOT NULL,
        edited_at TEXT DEFAULT (datetime('now')),
        UNIQUE(original_player_id, year)
      )
    `);

    // Trait edits per player per year (stored as JSON like equipment)
    this.editsDb.exec(`
      CREATE TABLE IF NOT EXISTS trait_edits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        original_player_id INTEGER NOT NULL,
        year INTEGER NOT NULL,
        traits_json TEXT NOT NULL,
        edited_at TEXT DEFAULT (datetime('now')),
        UNIQUE(original_player_id, year)
      )
    `);

    // =============================================
    // COACH EDIT TABLES
    // =============================================

    // Coach edits (overlay for Coach_lookup.csv entries)
    this.editsDb.exec(`
      CREATE TABLE IF NOT EXISTS coach_edits (
        original_id INTEGER PRIMARY KEY,
        first_name TEXT,
        last_name TEXT,
        team_index INTEGER,
        position TEXT,
        experience INTEGER,
        age INTEGER,
        edited_at TEXT DEFAULT (datetime('now'))
      )
    `);

    // Coach appearance edits
    this.editsDb.exec(`
      CREATE TABLE IF NOT EXISTS coach_appearance_edits (
        original_coach_id INTEGER PRIMARY KEY,
        madden_pid INTEGER,
        madden_pam TEXT,
        head_asset TEXT,
        edited_at TEXT DEFAULT (datetime('now'))
      )
    `);

    // Migration: Add head_asset column if it doesn't exist
    try {
      this.editsDb.exec('ALTER TABLE coach_appearance_edits ADD COLUMN head_asset TEXT');
    } catch (e) {
      // Column already exists, ignore
    }

    // Coach season edits
    this.editsDb.exec(`
      CREATE TABLE IF NOT EXISTS coach_season_edits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        original_coach_id INTEGER NOT NULL,
        year INTEGER NOT NULL,
        team TEXT,
        position TEXT,
        wins INTEGER,
        losses INTEGER,
        ties INTEGER,
        playoff_wins INTEGER,
        super_bowl_wins INTEGER,
        edited_at TEXT DEFAULT (datetime('now')),
        UNIQUE(original_coach_id, year)
      )
    `);

    // Hidden coaches
    this.editsDb.exec(`
      CREATE TABLE IF NOT EXISTS hidden_coaches (
        original_coach_id INTEGER PRIMARY KEY,
        hidden_at TEXT DEFAULT (datetime('now'))
      )
    `);

    console.log('[UserDatabaseService] Edits database schema ready');
  }

  private async initializeCustomDatabase(): Promise<void> {
    const dbPath = path.join(this.userDataPath, 'custom-players.db');

    // If custom-players.db doesn't exist in AppData, check for bundled version
    if (!fs.existsSync(dbPath)) {
      const bundledPaths = [
        path.join(app.getAppPath(), '.vite', 'build', 'data', 'custom-players.db'),
        path.join(app.getAppPath(), 'data', 'custom-players.db'),
        path.join(process.cwd(), 'data', 'custom-players.db'),
      ];

      for (const bundledPath of bundledPaths) {
        if (fs.existsSync(bundledPath)) {
          console.log(`[UserDatabaseService] Copying bundled custom-players.db from ${bundledPath}`);
          fs.copyFileSync(bundledPath, dbPath);
          break;
        }
      }
    }

    this.customDb = new Database(dbPath);
    console.log(`[UserDatabaseService] Opened custom players database: ${dbPath}`);

    // Create tables if they don't exist
    this.customDb.exec(`
      CREATE TABLE IF NOT EXISTS custom_players (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        college_id INTEGER,
        race INTEGER,
        height INTEGER,
        weight INTEGER,
        hometown TEXT,
        home_state TEXT,
        position TEXT,
        draft_class INTEGER,
        draft_round TEXT,
        draft_pick INTEGER,
        career_from INTEGER,
        career_to INTEGER,
        madden_pid INTEGER,
        madden_pam TEXT,
        madden_plpo TEXT,
        madden_commid TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        edited_at TEXT DEFAULT (datetime('now'))
      )
    `);

    // Migration: add hometown, home_state, and position columns if they don't exist
    try {
      this.customDb.exec(`ALTER TABLE custom_players ADD COLUMN hometown TEXT`);
    } catch { /* Column already exists */ }
    try {
      this.customDb.exec(`ALTER TABLE custom_players ADD COLUMN home_state TEXT`);
    } catch { /* Column already exists */ }
    try {
      this.customDb.exec(`ALTER TABLE custom_players ADD COLUMN position TEXT`);
    } catch { /* Column already exists */ }
    // Migration: add body_type and handedness columns for bio saving
    try {
      this.customDb.exec(`ALTER TABLE custom_players ADD COLUMN body_type INTEGER`);
    } catch { /* Column already exists */ }
    try {
      this.customDb.exec(`ALTER TABLE custom_players ADD COLUMN handedness INTEGER`);
    } catch { /* Column already exists */ }
    // Migration: add has_3d_model column (indicates real face scan exists)
    try {
      this.customDb.exec(`ALTER TABLE custom_players ADD COLUMN has_3d_model INTEGER DEFAULT 0`);
    } catch { /* Column already exists */ }

    // Build custom_player_seasons table with all rating fields
    const ratingColumns = RATING_FIELDS.map(f => `${f} INTEGER`).join(', ');
    this.customDb.exec(`
      CREATE TABLE IF NOT EXISTS custom_player_seasons (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        custom_player_id INTEGER NOT NULL,
        year INTEGER NOT NULL,
        team TEXT,
        jersey INTEGER,
        age INTEGER,
        position TEXT,
        archetype TEXT,
        ${ratingColumns},
        FOREIGN KEY (custom_player_id) REFERENCES custom_players(id) ON DELETE CASCADE,
        UNIQUE(custom_player_id, year)
      )
    `);

    // Migration: add any missing rating columns to custom_player_seasons
    for (const field of RATING_FIELDS) {
      try {
        this.customDb.exec(`ALTER TABLE custom_player_seasons ADD COLUMN ${field} INTEGER`);
      } catch {
        /* Column already exists - that's fine */
      }
    }

    // Migration: copy data from legacy field names to correct M26 field names (custom players)
    for (const [legacyField, m26Field] of Object.entries(LEGACY_TO_M26_FIELD_MAP)) {
      try {
        const checkSql = `SELECT COUNT(*) as count FROM custom_player_seasons WHERE ${legacyField} IS NOT NULL AND ${legacyField} > 0`;
        const result = this.customDb.prepare(checkSql).get() as { count: number } | undefined;
        if (result && result.count > 0) {
          const migrateSql = `UPDATE custom_player_seasons SET ${m26Field} = ${legacyField} WHERE (${m26Field} IS NULL OR ${m26Field} = 0) AND ${legacyField} IS NOT NULL AND ${legacyField} > 0`;
          const updateResult = this.customDb.prepare(migrateSql).run();
          if (updateResult.changes > 0) {
            console.log(`[UserDatabaseService] Custom players: Migrated ${updateResult.changes} rows: ${legacyField} -> ${m26Field}`);
          }
        }
      } catch {
        // Legacy column doesn't exist
      }
    }

    // Create indexes
    this.customDb.exec(`
      CREATE INDEX IF NOT EXISTS idx_custom_players_name ON custom_players(last_name, first_name);
      CREATE INDEX IF NOT EXISTS idx_custom_seasons_player ON custom_player_seasons(custom_player_id);
    `);

    // Custom portraits table for user-uploaded portraits (PID 12000+)
    this.customDb.exec(`
      CREATE TABLE IF NOT EXISTS custom_portraits (
        pid INTEGER PRIMARY KEY,
        image_data BLOB NOT NULL,
        original_filename TEXT,
        player_name TEXT,
        database_player_id INTEGER,
        year INTEGER,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);

    // Migration: add database_player_id column if it doesn't exist
    try {
      this.customDb.exec(`ALTER TABLE custom_portraits ADD COLUMN database_player_id INTEGER`);
    } catch { /* Column already exists */ }

    this.customDb.exec(`
      CREATE INDEX IF NOT EXISTS idx_custom_portraits_year ON custom_portraits(year);
      CREATE INDEX IF NOT EXISTS idx_custom_portraits_player ON custom_portraits(database_player_id);
    `);

    // =============================================
    // CUSTOM COACH TABLES
    // =============================================

    // Custom coaches (user-created coaches)
    this.customDb.exec(`
      CREATE TABLE IF NOT EXISTS custom_coaches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        team_index INTEGER,
        position TEXT,
        experience INTEGER,
        age INTEGER,
        career_from INTEGER,
        career_to INTEGER,
        madden_pid INTEGER,
        madden_pam TEXT,
        head_asset TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        edited_at TEXT DEFAULT (datetime('now'))
      )
    `);

    // Migration: Add head_asset column if it doesn't exist
    try {
      this.customDb.exec('ALTER TABLE custom_coaches ADD COLUMN head_asset TEXT');
    } catch (e) {
      // Column already exists, ignore
    }

    // Migration: Add source column for tracking where coaches came from
    try {
      this.customDb.exec("ALTER TABLE custom_coaches ADD COLUMN source TEXT DEFAULT 'manual'");
    } catch (e) {
      // Column already exists, ignore
    }

    // Migration: Add career stats columns
    const careerStatsColumns = [
      'career_wins INTEGER DEFAULT 0',
      'career_losses INTEGER DEFAULT 0',
      'career_ties INTEGER DEFAULT 0',
      'career_playoff_wins INTEGER DEFAULT 0',
      'career_playoff_losses INTEGER DEFAULT 0',
      'career_sb_wins INTEGER DEFAULT 0',
      'career_sb_losses INTEGER DEFAULT 0'
    ];
    for (const col of careerStatsColumns) {
      try {
        this.customDb.exec(`ALTER TABLE custom_coaches ADD COLUMN ${col}`);
      } catch (e) {
        // Column already exists, ignore
      }
    }

    // Custom coach seasons
    this.customDb.exec(`
      CREATE TABLE IF NOT EXISTS custom_coach_seasons (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        custom_coach_id INTEGER NOT NULL,
        year INTEGER NOT NULL,
        team TEXT,
        position TEXT,
        wins INTEGER,
        losses INTEGER,
        ties INTEGER,
        playoff_wins INTEGER,
        super_bowl_wins INTEGER,
        FOREIGN KEY (custom_coach_id) REFERENCES custom_coaches(id) ON DELETE CASCADE,
        UNIQUE(custom_coach_id, year)
      )
    `);

    // Indexes for custom coaches
    this.customDb.exec(`
      CREATE INDEX IF NOT EXISTS idx_custom_coaches_name ON custom_coaches(last_name, first_name);
      CREATE INDEX IF NOT EXISTS idx_custom_coach_seasons_coach ON custom_coach_seasons(custom_coach_id);
    `);

    // Custom coach portraits table for user-uploaded coach portraits (PID 50000+)
    this.customDb.exec(`
      CREATE TABLE IF NOT EXISTS custom_coach_portraits (
        pid INTEGER PRIMARY KEY,
        image_data BLOB NOT NULL,
        original_filename TEXT,
        coach_name TEXT,
        database_coach_id INTEGER,
        year INTEGER,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);

    this.customDb.exec(`
      CREATE INDEX IF NOT EXISTS idx_custom_coach_portraits_year ON custom_coach_portraits(year);
      CREATE INDEX IF NOT EXISTS idx_custom_coach_portraits_coach ON custom_coach_portraits(database_coach_id);
    `);

    console.log('[UserDatabaseService] Custom players database schema ready');
  }

  // =============================================
  // PLAYER EDIT OPERATIONS
  // =============================================

  public savePlayerEdit(originalId: number, edits: Partial<PlayerEdit>): void {
    if (!this.editsDb) throw new Error('Edits database not initialized');

    console.log('[UserDatabaseService] savePlayerEdit called:', { originalId, edits });

    const existing = this.getPlayerEdit(originalId);

    if (existing) {
      // Update existing edit
      const updates: string[] = [];
      const values: unknown[] = [];

      if (edits.firstName !== undefined) { updates.push('first_name = ?'); values.push(edits.firstName); }
      if (edits.lastName !== undefined) { updates.push('last_name = ?'); values.push(edits.lastName); }
      if (edits.collegeId !== undefined) { updates.push('college_id = ?'); values.push(edits.collegeId); }
      if (edits.race !== undefined) { updates.push('race = ?'); values.push(edits.race); }
      if (edits.height !== undefined) { updates.push('height = ?'); values.push(edits.height); }
      if (edits.weight !== undefined) { updates.push('weight = ?'); values.push(edits.weight); }
      if (edits.hometown !== undefined) { updates.push('hometown = ?'); values.push(edits.hometown); }
      if (edits.homeState !== undefined) { updates.push('home_state = ?'); values.push(edits.homeState); }
      if (edits.draftClass !== undefined) { updates.push('draft_class = ?'); values.push(edits.draftClass); }
      if (edits.draftRound !== undefined) { updates.push('draft_round = ?'); values.push(edits.draftRound); }
      if (edits.draftPick !== undefined) { updates.push('draft_pick = ?'); values.push(edits.draftPick); }
      if (edits.careerFrom !== undefined) { updates.push('career_from = ?'); values.push(edits.careerFrom); }
      if (edits.careerTo !== undefined) { updates.push('career_to = ?'); values.push(edits.careerTo); }
      if (edits.bodyType !== undefined) { updates.push('body_type = ?'); values.push(edits.bodyType); }
      if (edits.handedness !== undefined) { updates.push('handedness = ?'); values.push(edits.handedness); }
      if (edits.isHof !== undefined) { updates.push('is_hof = ?'); values.push(edits.isHof ? 1 : 0); }

      if (updates.length > 0) {
        updates.push("edited_at = datetime('now')");
        values.push(originalId);
        this.editsDb.prepare(`UPDATE player_edits SET ${updates.join(', ')} WHERE original_id = ?`).run(...values);
      }
    } else {
      // Insert new edit
      this.editsDb.prepare(`
        INSERT INTO player_edits (original_id, first_name, last_name, college_id, race, height, weight,
                                   hometown, home_state, draft_class, draft_round, draft_pick, career_from, career_to,
                                   body_type, handedness, is_hof)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        originalId,
        edits.firstName ?? null,
        edits.lastName ?? null,
        edits.collegeId ?? null,
        edits.race ?? null,
        edits.height ?? null,
        edits.weight ?? null,
        edits.hometown ?? null,
        edits.homeState ?? null,
        edits.draftClass ?? null,
        edits.draftRound ?? null,
        edits.draftPick ?? null,
        edits.careerFrom ?? null,
        edits.careerTo ?? null,
        edits.bodyType ?? null,
        edits.handedness ?? null,
        edits.isHof !== undefined ? (edits.isHof ? 1 : 0) : null
      );
    }

    console.log(`[UserDatabaseService] Saved player edit for original_id=${originalId}`);
  }

  public getPlayerEdit(originalId: number): PlayerEdit | null {
    if (!this.editsDb) return null;

    const row = this.editsDb.prepare('SELECT * FROM player_edits WHERE original_id = ?').get(originalId) as Record<string, unknown> | undefined;
    if (!row) return null;

    return {
      originalId: row.original_id as number,
      firstName: row.first_name as string | undefined,
      lastName: row.last_name as string | undefined,
      collegeId: row.college_id as number | undefined,
      race: row.race as number | undefined,
      height: row.height as number | undefined,
      weight: row.weight as number | undefined,
      hometown: row.hometown as string | undefined,
      homeState: row.home_state as string | undefined,
      draftClass: row.draft_class as number | undefined,
      draftRound: row.draft_round as string | undefined,
      draftPick: row.draft_pick as number | undefined,
      careerFrom: row.career_from as number | undefined,
      careerTo: row.career_to as number | undefined,
      bodyType: row.body_type as string | undefined,
      handedness: row.handedness as number | undefined,
      isHof: row.is_hof === 1 ? true : (row.is_hof === 0 ? false : undefined),
      editedAt: row.edited_at as string | undefined
    };
  }

  public hasPlayerEdit(originalId: number): boolean {
    if (!this.editsDb) return false;
    const row = this.editsDb.prepare('SELECT 1 FROM player_edits WHERE original_id = ?').get(originalId);
    return !!row;
  }

  /**
   * Get all player edits as a Map for fast bulk lookups
   * Returns Map of originalId -> PlayerEdit
   */
  public getAllPlayerEdits(): Map<number, PlayerEdit> {
    const map = new Map<number, PlayerEdit>();
    if (!this.editsDb) return map;

    const rows = this.editsDb.prepare('SELECT * FROM player_edits').all() as Record<string, unknown>[];
    for (const row of rows) {
      map.set(row.original_id as number, {
        originalId: row.original_id as number,
        firstName: row.first_name as string | undefined,
        lastName: row.last_name as string | undefined,
        collegeId: row.college_id as number | undefined,
        race: row.race as number | undefined,
        height: row.height as number | undefined,
        weight: row.weight as number | undefined,
        hometown: row.hometown as string | undefined,
        homeState: row.home_state as string | undefined,
        draftClass: row.draft_class as number | undefined,
        draftRound: row.draft_round as string | undefined,
        draftPick: row.draft_pick as number | undefined,
        careerFrom: row.career_from as number | undefined,
        careerTo: row.career_to as number | undefined,
        bodyType: row.body_type as string | undefined,
        handedness: row.handedness as number | undefined,
        isHof: row.is_hof === 1 ? true : (row.is_hof === 0 ? false : undefined),
        editedAt: row.edited_at as string | undefined
      });
    }
    return map;
  }

  /**
   * Get all appearance edits as a Map for fast bulk lookups
   * Returns Map of originalPlayerId -> AppearanceEdit
   */
  public getAllAppearanceEdits(): Map<number, AppearanceEdit> {
    const map = new Map<number, AppearanceEdit>();
    if (!this.editsDb) {
      console.log('[UserDatabaseService] getAllAppearanceEdits: editsDb is null');
      return map;
    }

    const rows = this.editsDb.prepare('SELECT * FROM appearance_edits').all() as Record<string, unknown>[];
    console.log(`[UserDatabaseService] getAllAppearanceEdits: Found ${rows.length} rows in appearance_edits table`);

    // DEBUG: Show first 5 rows from database
    for (let i = 0; i < Math.min(5, rows.length); i++) {
      const row = rows[i];
      console.log(`[UserDatabaseService] Row ${i}: original_player_id=${row.original_player_id}, madden_pid=${row.madden_pid}, madden_pam=${row.madden_pam}`);
    }

    for (const row of rows) {
      map.set(row.original_player_id as number, {
        originalPlayerId: row.original_player_id as number,
        maddenPid: row.madden_pid as number | undefined,
        maddenPam: row.madden_pam as string | undefined,
        maddenPlpo: row.madden_plpo as string | undefined,
        maddenCommid: row.madden_commid as string | undefined,
        maddenPghe: row.madden_pghe as number | undefined,
        maddenPfcg: row.madden_pfcg as string | undefined,
        maddenGpan: row.madden_gpan as string | undefined,
        maddenGslp: row.madden_gslp as number | undefined,
        maddenCpvf: row.madden_cpvf as number | undefined,
        maddenSkinTone: row.madden_skin_tone as number | undefined,
        editedAt: row.edited_at as string | undefined
      });
    }
    return map;
  }

  public resetPlayer(originalId: number): void {
    if (!this.editsDb) return;

    this.editsDb.prepare('DELETE FROM player_edits WHERE original_id = ?').run(originalId);
    this.editsDb.prepare('DELETE FROM appearance_edits WHERE original_player_id = ?').run(originalId);
    this.editsDb.prepare('DELETE FROM season_edits WHERE original_player_id = ?').run(originalId);
    this.editsDb.prepare('DELETE FROM cleared_seasons WHERE original_player_id = ?').run(originalId);

    console.log(`[UserDatabaseService] Reset all edits for original_id=${originalId}`);
  }

  /**
   * Clear all seasons for a player (marks them as cleared so they won't be returned)
   * This is used to fix wrongly-assigned seasons from name collisions
   */
  public clearPlayerSeasons(originalId: number): number {
    if (!this.editsDb) throw new Error('Edits database not initialized');

    // Delete any user-added season edits
    const deleteResult = this.editsDb.prepare('DELETE FROM season_edits WHERE original_player_id = ?').run(originalId);

    // Mark original seasons as cleared
    this.editsDb.prepare(`
      INSERT OR REPLACE INTO cleared_seasons (original_player_id) VALUES (?)
    `).run(originalId);

    console.log(`[UserDatabaseService] Cleared seasons for original_id=${originalId}, deleted ${deleteResult.changes} edits`);
    return deleteResult.changes;
  }

  /**
   * Delete a specific season for a player (edited/added seasons only)
   * @param originalPlayerId The player's original ID
   * @param year The year to delete
   * @returns true if a record was deleted
   */
  public deletePlayerSeason(originalPlayerId: number, year: number): boolean {
    if (!this.editsDb) throw new Error('Edits database not initialized');

    const result = this.editsDb.prepare(
      'DELETE FROM season_edits WHERE original_player_id = ? AND year = ?'
    ).run(originalPlayerId, year);

    console.log(`[UserDatabaseService] Deleted season ${year} for player_id=${originalPlayerId}, affected=${result.changes}`);
    return result.changes > 0;
  }

  /**
   * Check if a player's original seasons have been cleared
   */
  public areSeasonsCleared(originalId: number): boolean {
    if (!this.editsDb) return false;
    const row = this.editsDb.prepare('SELECT 1 FROM cleared_seasons WHERE original_player_id = ?').get(originalId);
    return !!row;
  }

  // =============================================
  // APPEARANCE EDIT OPERATIONS
  // =============================================

  public saveAppearanceEdit(originalPlayerId: number, edits: Partial<AppearanceEdit>): void {
    if (!this.editsDb) throw new Error('Edits database not initialized');

    // Get existing values first to merge (don't wipe out existing data)
    const existing = this.getAppearanceEdit(originalPlayerId);

    // Merge existing values with new edits - new values take precedence, but undefined doesn't overwrite
    const merged = {
      maddenPid: edits.maddenPid !== undefined ? edits.maddenPid : (existing?.maddenPid ?? null),
      maddenPam: edits.maddenPam !== undefined ? edits.maddenPam : (existing?.maddenPam ?? null),
      maddenPlpo: edits.maddenPlpo !== undefined ? edits.maddenPlpo : (existing?.maddenPlpo ?? null),
      maddenCommid: edits.maddenCommid !== undefined ? edits.maddenCommid : (existing?.maddenCommid ?? null),
      maddenPghe: edits.maddenPghe !== undefined ? edits.maddenPghe : (existing?.maddenPghe ?? null),
      maddenPfcg: edits.maddenPfcg !== undefined ? edits.maddenPfcg : (existing?.maddenPfcg ?? null),
      maddenGpan: edits.maddenGpan !== undefined ? edits.maddenGpan : (existing?.maddenGpan ?? null),
      maddenGslp: edits.maddenGslp !== undefined ? edits.maddenGslp : (existing?.maddenGslp ?? null),
      maddenCpvf: edits.maddenCpvf !== undefined ? edits.maddenCpvf : (existing?.maddenCpvf ?? null),
      maddenSkinTone: edits.maddenSkinTone !== undefined ? edits.maddenSkinTone : (existing?.maddenSkinTone ?? null),
    };

    this.editsDb.prepare(`
      INSERT OR REPLACE INTO appearance_edits (
        original_player_id, madden_pid, madden_pam, madden_plpo, madden_commid,
        madden_pghe, madden_pfcg, madden_gpan, madden_gslp, madden_cpvf, madden_skin_tone
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      originalPlayerId,
      merged.maddenPid,
      merged.maddenPam,
      merged.maddenPlpo,
      merged.maddenCommid,
      merged.maddenPghe,
      merged.maddenPfcg,
      merged.maddenGpan,
      merged.maddenGslp,
      merged.maddenCpvf,
      merged.maddenSkinTone
    );

    console.log(`[UserDatabaseService] Saved appearance edit for player_id=${originalPlayerId} (PAM=${merged.maddenPam ?? 'null'}, PGHE=${merged.maddenPghe ?? 'null'})`);
  }

  public getAppearanceEdit(originalPlayerId: number): AppearanceEdit | null {
    if (!this.editsDb) return null;

    const row = this.editsDb.prepare('SELECT * FROM appearance_edits WHERE original_player_id = ?').get(originalPlayerId) as Record<string, unknown> | undefined;
    if (!row) return null;

    return {
      originalPlayerId: row.original_player_id as number,
      maddenPid: row.madden_pid as number | undefined,
      maddenPam: row.madden_pam as string | undefined,
      maddenPlpo: row.madden_plpo as string | undefined,
      maddenCommid: row.madden_commid as string | undefined,
      maddenPghe: row.madden_pghe as number | undefined,
      maddenPfcg: row.madden_pfcg as string | undefined,
      maddenGpan: row.madden_gpan as string | undefined,
      maddenGslp: row.madden_gslp as number | undefined,
      maddenCpvf: row.madden_cpvf as number | undefined,
      maddenSkinTone: row.madden_skin_tone as number | undefined,
      editedAt: row.edited_at as string | undefined
    };
  }

  /**
   * Get all appearance edit PIDs mapped to player IDs (bulk load for performance)
   * Returns Map of originalPlayerId -> maddenPid for players that have PID edits
   */
  public getAllAppearanceEditPids(): Map<number, number> {
    if (!this.editsDb) return new Map();

    const rows = this.editsDb.prepare(`
      SELECT original_player_id, madden_pid
      FROM appearance_edits
      WHERE madden_pid IS NOT NULL
    `).all() as { original_player_id: number; madden_pid: number }[];

    const map = new Map<number, number>();
    for (const row of rows) {
      map.set(row.original_player_id, row.madden_pid);
    }
    return map;
  }

  // =============================================
  // SEASON EDIT OPERATIONS
  // =============================================

  public saveSeasonEdit(originalPlayerId: number, year: number, edits: Partial<SeasonEdit>): void {
    if (!this.editsDb) throw new Error('Edits database not initialized');

    console.log(`[UserDatabaseService] saveSeasonEdit called: player=${originalPlayerId}, year=${year}`);
    console.log(`[UserDatabaseService] Incoming edits keys:`, Object.keys(edits));
    console.log(`[UserDatabaseService] Incoming edits.ratings:`, edits.ratings);

    // Log flat rating fields (how frontend sends them)
    const flatRatings: Record<string, unknown> = {};
    for (const field of RATING_FIELDS) {
      const val = (edits as Record<string, unknown>)[field];
      if (val !== undefined) {
        flatRatings[field] = val;
      }
    }
    console.log(`[UserDatabaseService] Flat rating fields found:`, flatRatings);

    // Check if a record already exists for this player/year
    const existingRow = this.editsDb.prepare('SELECT id FROM season_edits WHERE original_player_id = ? AND year = ?')
      .get(originalPlayerId, year);

    if (existingRow) {
      // UPDATE only the fields that are provided in edits (don't overwrite other fields with null)
      const setClauses: string[] = [];
      const values: unknown[] = [];

      // Check each base field
      if (edits.team !== undefined) { setClauses.push('team = ?'); values.push(edits.team); }
      if (edits.jersey !== undefined) { setClauses.push('jersey = ?'); values.push(edits.jersey); }
      if (edits.age !== undefined) { setClauses.push('age = ?'); values.push(edits.age); }
      if (edits.position !== undefined) { setClauses.push('position = ?'); values.push(edits.position); }
      if (edits.archetype !== undefined) { setClauses.push('archetype = ?'); values.push(edits.archetype); }

      // Check rating fields - frontend sends as flat properties (edits.POVR)
      for (const field of RATING_FIELDS) {
        const val = edits.ratings?.[field] ?? (edits as Record<string, unknown>)[field];
        if (val !== undefined) {
          setClauses.push(`${field} = ?`);
          values.push(val);
        }
      }

      console.log(`[UserDatabaseService] UPDATE - setClauses:`, setClauses);
      if (setClauses.length > 0) {
        values.push(originalPlayerId, year);
        this.editsDb.prepare(`
          UPDATE season_edits SET ${setClauses.join(', ')}
          WHERE original_player_id = ? AND year = ?
        `).run(...values);
        console.log(`[UserDatabaseService] Updated ${setClauses.length} fields for player_id=${originalPlayerId}, year=${year}`);
      } else {
        console.log(`[UserDatabaseService] No fields to update!`);
      }
    } else {
      // INSERT new record - include all provided fields
      const columns = ['original_player_id', 'year'];
      const values: unknown[] = [originalPlayerId, year];

      // Add base fields if provided
      if (edits.team !== undefined) { columns.push('team'); values.push(edits.team); }
      if (edits.jersey !== undefined) { columns.push('jersey'); values.push(edits.jersey); }
      if (edits.age !== undefined) { columns.push('age'); values.push(edits.age); }
      if (edits.position !== undefined) { columns.push('position'); values.push(edits.position); }
      if (edits.archetype !== undefined) { columns.push('archetype'); values.push(edits.archetype); }

      // Add rating fields if provided
      for (const field of RATING_FIELDS) {
        const val = edits.ratings?.[field] ?? (edits as Record<string, unknown>)[field];
        if (val !== undefined) {
          columns.push(field);
          values.push(val);
        }
      }

      const placeholders = columns.map(() => '?').join(', ');
      this.editsDb.prepare(`
        INSERT INTO season_edits (${columns.join(', ')})
        VALUES (${placeholders})
      `).run(...values);
      console.log(`[UserDatabaseService] Inserted season edit for player_id=${originalPlayerId}, year=${year}`);
    }
  }

  public getSeasonEdit(originalPlayerId: number, year: number): SeasonEdit | null {
    if (!this.editsDb) return null;

    const row = this.editsDb.prepare('SELECT * FROM season_edits WHERE original_player_id = ? AND year = ?')
      .get(originalPlayerId, year) as Record<string, unknown> | undefined;

    console.log(`[UserDatabaseService] getSeasonEdit: player=${originalPlayerId}, year=${year}, found=${!!row}`);
    if (!row) return null;

    // Log all columns in the row
    console.log(`[UserDatabaseService] Row columns:`, Object.keys(row));

    const ratings: { [key: string]: number } = {};
    for (const field of RATING_FIELDS) {
      if (row[field] !== null && row[field] !== undefined) {
        ratings[field] = row[field] as number;
      }
    }

    console.log(`[UserDatabaseService] Ratings loaded from row:`, ratings);

    return {
      id: row.id as number,
      originalPlayerId: row.original_player_id as number,
      year: row.year as number,
      team: row.team as string | undefined,
      jersey: row.jersey as number | undefined,
      age: row.age as number | undefined,
      position: row.position as string | undefined,
      archetype: row.archetype as string | undefined,
      ratings,
      editedAt: row.edited_at as string | undefined
    };
  }

  public getSeasonEditsForPlayer(originalPlayerId: number): SeasonEdit[] {
    if (!this.editsDb) return [];

    const rows = this.editsDb.prepare('SELECT * FROM season_edits WHERE original_player_id = ? ORDER BY year')
      .all(originalPlayerId) as Record<string, unknown>[];

    return rows.map(row => {
      const ratings: { [key: string]: number } = {};
      for (const field of RATING_FIELDS) {
        if (row[field] !== null && row[field] !== undefined) {
          ratings[field] = row[field] as number;
        }
      }

      return {
        id: row.id as number,
        originalPlayerId: row.original_player_id as number,
        year: row.year as number,
        team: row.team as string | undefined,
        jersey: row.jersey as number | undefined,
        age: row.age as number | undefined,
        position: row.position as string | undefined,
        archetype: row.archetype as string | undefined,
        ratings,
        editedAt: row.edited_at as string | undefined
      };
    });
  }

  /**
   * Get a summary of all years that have season edits
   * Returns array of {year, count} objects
   */
  public getSeasonEditYearsSummary(): Array<{ year: number; count: number }> {
    if (!this.editsDb) return [];

    const rows = this.editsDb.prepare(`
      SELECT year, COUNT(*) as count
      FROM season_edits
      GROUP BY year
      ORDER BY year
    `).all() as Array<{ year: number; count: number }>;

    return rows;
  }

  /**
   * Get all season edits for a specific year
   * Returns a Map of originalPlayerId -> SeasonEdit for fast lookup
   */
  public getAllSeasonEditsForYear(year: number): Map<number, SeasonEdit> {
    if (!this.editsDb) return new Map();

    const rows = this.editsDb.prepare('SELECT * FROM season_edits WHERE year = ?')
      .all(year) as Record<string, unknown>[];

    const editsMap = new Map<number, SeasonEdit>();

    for (const row of rows) {
      const ratings: { [key: string]: number } = {};
      for (const field of RATING_FIELDS) {
        if (row[field] !== null && row[field] !== undefined) {
          ratings[field] = row[field] as number;
        }
      }

      const edit: SeasonEdit = {
        id: row.id as number,
        originalPlayerId: row.original_player_id as number,
        year: row.year as number,
        team: row.team as string | undefined,
        jersey: row.jersey as number | undefined,
        age: row.age as number | undefined,
        position: row.position as string | undefined,
        archetype: row.archetype as string | undefined,
        ratings,
        editedAt: row.edited_at as string | undefined
      };

      editsMap.set(edit.originalPlayerId, edit);
    }

    return editsMap;
  }

  // =============================================
  // EQUIPMENT EDIT OPERATIONS
  // Equipment edits stored per player per year
  // =============================================

  /**
   * Save equipment edits for a player in a specific year
   */
  public saveEquipmentEdit(originalPlayerId: number, year: number, equipment: { [slot: string]: string }): void {
    if (!this.editsDb) throw new Error('Edits database not initialized');

    console.log(`[UserDatabaseService] saveEquipmentEdit: player=${originalPlayerId}, year=${year}, slots=${Object.keys(equipment).length}`);

    // Only save non-empty equipment values
    const filteredEquipment: { [slot: string]: string } = {};
    for (const [slot, value] of Object.entries(equipment)) {
      if (value && value.trim() !== '' && !value.includes('None')) {
        filteredEquipment[slot] = value;
      }
    }

    if (Object.keys(filteredEquipment).length === 0) {
      // Delete existing record if no equipment to save
      this.editsDb.prepare('DELETE FROM equipment_edits WHERE original_player_id = ? AND year = ?')
        .run(originalPlayerId, year);
      console.log(`[UserDatabaseService] Deleted empty equipment edit for player_id=${originalPlayerId}, year=${year}`);
      return;
    }

    const equipmentJson = JSON.stringify(filteredEquipment);

    // Check if record exists
    const existingRow = this.editsDb.prepare('SELECT id FROM equipment_edits WHERE original_player_id = ? AND year = ?')
      .get(originalPlayerId, year);

    if (existingRow) {
      this.editsDb.prepare(`
        UPDATE equipment_edits SET equipment_json = ?, edited_at = datetime('now')
        WHERE original_player_id = ? AND year = ?
      `).run(equipmentJson, originalPlayerId, year);
      console.log(`[UserDatabaseService] Updated equipment for player_id=${originalPlayerId}, year=${year}`);
    } else {
      this.editsDb.prepare(`
        INSERT INTO equipment_edits (original_player_id, year, equipment_json)
        VALUES (?, ?, ?)
      `).run(originalPlayerId, year, equipmentJson);
      console.log(`[UserDatabaseService] Inserted equipment for player_id=${originalPlayerId}, year=${year}`);
    }
  }

  /**
   * Get equipment edits for a specific player and year
   */
  public getEquipmentEdit(originalPlayerId: number, year: number): EquipmentEdit | null {
    if (!this.editsDb) return null;

    const row = this.editsDb.prepare('SELECT * FROM equipment_edits WHERE original_player_id = ? AND year = ?')
      .get(originalPlayerId, year) as { id: number; original_player_id: number; year: number; equipment_json: string; edited_at: string } | undefined;

    if (!row) return null;

    try {
      const equipment = JSON.parse(row.equipment_json);
      return {
        id: row.id,
        originalPlayerId: row.original_player_id,
        year: row.year,
        equipment,
        editedAt: row.edited_at
      };
    } catch (e) {
      console.error(`[UserDatabaseService] Failed to parse equipment JSON for player ${originalPlayerId}:`, e);
      return null;
    }
  }

  /**
   * Get all equipment edits for a player (all years)
   */
  public getEquipmentEditsForPlayer(originalPlayerId: number): EquipmentEdit[] {
    if (!this.editsDb) return [];

    const rows = this.editsDb.prepare('SELECT * FROM equipment_edits WHERE original_player_id = ? ORDER BY year')
      .all(originalPlayerId) as Array<{ id: number; original_player_id: number; year: number; equipment_json: string; edited_at: string }>;

    return rows.map(row => {
      try {
        const equipment = JSON.parse(row.equipment_json);
        return {
          id: row.id,
          originalPlayerId: row.original_player_id,
          year: row.year,
          equipment,
          editedAt: row.edited_at
        };
      } catch {
        return {
          id: row.id,
          originalPlayerId: row.original_player_id,
          year: row.year,
          equipment: {},
          editedAt: row.edited_at
        };
      }
    });
  }

  /**
   * Get all equipment edits for a specific year
   * Returns a Map of originalPlayerId -> EquipmentEdit for fast lookup
   */
  public getAllEquipmentEditsForYear(year: number): Map<number, EquipmentEdit> {
    if (!this.editsDb) return new Map();

    const rows = this.editsDb.prepare('SELECT * FROM equipment_edits WHERE year = ?')
      .all(year) as Array<{ id: number; original_player_id: number; year: number; equipment_json: string; edited_at: string }>;

    const editsMap = new Map<number, EquipmentEdit>();

    for (const row of rows) {
      try {
        const equipment = JSON.parse(row.equipment_json);
        editsMap.set(row.original_player_id, {
          id: row.id,
          originalPlayerId: row.original_player_id,
          year: row.year,
          equipment,
          editedAt: row.edited_at
        });
      } catch {
        // Skip invalid JSON entries
      }
    }

    return editsMap;
  }

  // =============================================
  // TRAIT EDIT OPERATIONS
  // Traits stored per player per year (like equipment)
  // =============================================

  /**
   * Save trait edits for a player for a specific year
   * Traits are stored as JSON to handle the many trait fields
   */
  public saveTraitEdit(originalPlayerId: number, year: number, traits: { [traitName: string]: boolean | number }): void {
    if (!this.editsDb) throw new Error('Edits database not initialized');

    console.log(`[UserDatabaseService] saveTraitEdit: player=${originalPlayerId}, year=${year}, traits=${Object.keys(traits).length}`);

    // Filter out empty/falsy traits to save space
    const filteredTraits: { [key: string]: boolean | number } = {};
    for (const [key, value] of Object.entries(traits)) {
      if (value !== undefined && value !== null && value !== false && value !== 0) {
        filteredTraits[key] = value;
      }
    }

    // If no traits, delete the row if it exists
    if (Object.keys(filteredTraits).length === 0) {
      this.editsDb.prepare('DELETE FROM trait_edits WHERE original_player_id = ? AND year = ?')
        .run(originalPlayerId, year);
      console.log(`[UserDatabaseService] Deleted empty trait edit for player=${originalPlayerId}, year=${year}`);
      return;
    }

    const traitsJson = JSON.stringify(filteredTraits);

    const existingRow = this.editsDb.prepare('SELECT id FROM trait_edits WHERE original_player_id = ? AND year = ?')
      .get(originalPlayerId, year) as { id: number } | undefined;

    if (existingRow) {
      this.editsDb.prepare(`
        UPDATE trait_edits SET traits_json = ?, edited_at = datetime('now')
        WHERE original_player_id = ? AND year = ?
      `).run(traitsJson, originalPlayerId, year);
    } else {
      this.editsDb.prepare(`
        INSERT INTO trait_edits (original_player_id, year, traits_json)
        VALUES (?, ?, ?)
      `).run(originalPlayerId, year, traitsJson);
    }

    console.log(`[UserDatabaseService] Saved trait edit for player=${originalPlayerId}, year=${year}`);
  }

  /**
   * Get trait edits for a player for a specific year
   */
  public getTraitEdit(originalPlayerId: number, year: number): TraitEdit | null {
    if (!this.editsDb) return null;

    const row = this.editsDb.prepare('SELECT * FROM trait_edits WHERE original_player_id = ? AND year = ?')
      .get(originalPlayerId, year) as { id: number; original_player_id: number; year: number; traits_json: string; edited_at: string } | undefined;

    if (!row) return null;

    try {
      const traits = JSON.parse(row.traits_json);
      return {
        id: row.id,
        originalPlayerId: row.original_player_id,
        year: row.year,
        traits,
        editedAt: row.edited_at
      };
    } catch {
      return null;
    }
  }

  /**
   * Get all trait edits for a player (all years)
   */
  public getTraitEditsForPlayer(originalPlayerId: number): TraitEdit[] {
    if (!this.editsDb) return [];

    const rows = this.editsDb.prepare('SELECT * FROM trait_edits WHERE original_player_id = ? ORDER BY year')
      .all(originalPlayerId) as Array<{ id: number; original_player_id: number; year: number; traits_json: string; edited_at: string }>;

    return rows.map(row => {
      try {
        const traits = JSON.parse(row.traits_json);
        return {
          id: row.id,
          originalPlayerId: row.original_player_id,
          year: row.year,
          traits,
          editedAt: row.edited_at
        };
      } catch {
        return {
          id: row.id,
          originalPlayerId: row.original_player_id,
          year: row.year,
          traits: {},
          editedAt: row.edited_at
        };
      }
    });
  }

  /**
   * Get all trait edits for a specific year
   * Returns a Map of originalPlayerId -> TraitEdit for fast lookup
   */
  public getAllTraitEditsForYear(year: number): Map<number, TraitEdit> {
    if (!this.editsDb) return new Map();

    const rows = this.editsDb.prepare('SELECT * FROM trait_edits WHERE year = ?')
      .all(year) as Array<{ id: number; original_player_id: number; year: number; traits_json: string; edited_at: string }>;

    const editsMap = new Map<number, TraitEdit>();

    for (const row of rows) {
      try {
        const traits = JSON.parse(row.traits_json);
        editsMap.set(row.original_player_id, {
          id: row.id,
          originalPlayerId: row.original_player_id,
          year: row.year,
          traits,
          editedAt: row.edited_at
        });
      } catch {
        // Skip invalid JSON entries
      }
    }

    return editsMap;
  }

  // =============================================
  // PLAYER ARCHETYPE OPERATIONS
  // Player-level archetype storage (constant across all seasons)
  // =============================================

  /**
   * Save player archetype at the player level (not per-season)
   * This ensures consistent OVR calculation everywhere
   */
  public savePlayerArchetype(playerId: number, archetype: string, archetypeId?: number): void {
    if (!this.editsDb) throw new Error('Edits database not initialized');

    console.log(`[UserDatabaseService] savePlayerArchetype called: playerId=${playerId}, archetype="${archetype}", archetypeId=${archetypeId}`);
    console.log(`[UserDatabaseService] Database path: ${path.join(this.userDataPath, 'user-edits.db')}`);

    this.editsDb.prepare(`
      INSERT INTO player_archetypes (player_id, archetype, archetype_id, updated_at)
      VALUES (?, ?, ?, datetime('now'))
      ON CONFLICT(player_id) DO UPDATE SET
        archetype = excluded.archetype,
        archetype_id = excluded.archetype_id,
        updated_at = datetime('now')
    `).run(playerId, archetype, archetypeId ?? null);

    // Verify it was saved
    const verifyRow = this.editsDb.prepare('SELECT * FROM player_archetypes WHERE player_id = ?').get(playerId);
    console.log(`[UserDatabaseService] Verified saved archetype:`, verifyRow);

    console.log(`[UserDatabaseService] Saved player archetype: playerId=${playerId}, archetype=${archetype}, archetypeId=${archetypeId}`);
  }

  /**
   * Get player archetype at the player level
   * Returns null if not set (player uses default/calculated archetype)
   */
  public getPlayerArchetype(playerId: number): { archetype: string; archetypeId: number | null } | null {
    if (!this.editsDb) {
      console.log(`[UserDatabaseService] getPlayerArchetype: editsDb not initialized`);
      return null;
    }

    console.log(`[UserDatabaseService] getPlayerArchetype called: playerId=${playerId}`);
    console.log(`[UserDatabaseService] Database path: ${path.join(this.userDataPath, 'user-edits.db')}`);

    // Debug: count how many archetypes are in the table
    const countRow = this.editsDb.prepare('SELECT COUNT(*) as count FROM player_archetypes').get() as { count: number };
    console.log(`[UserDatabaseService] Total archetypes in table: ${countRow.count}`);

    const row = this.editsDb.prepare(`
      SELECT archetype, archetype_id FROM player_archetypes WHERE player_id = ?
    `).get(playerId) as { archetype: string; archetype_id: number | null } | undefined;

    console.log(`[UserDatabaseService] getPlayerArchetype result for playerId=${playerId}:`, row || 'null');

    if (!row) return null;

    return {
      archetype: row.archetype,
      archetypeId: row.archetype_id
    };
  }

  /**
   * Get all player archetypes as a Map for fast lookup
   */
  public getAllPlayerArchetypes(): Map<number, { archetype: string; archetypeId: number | null }> {
    if (!this.editsDb) return new Map();

    const rows = this.editsDb.prepare(`
      SELECT player_id, archetype, archetype_id FROM player_archetypes
    `).all() as Array<{ player_id: number; archetype: string; archetype_id: number | null }>;

    const map = new Map<number, { archetype: string; archetypeId: number | null }>();
    for (const row of rows) {
      map.set(row.player_id, {
        archetype: row.archetype,
        archetypeId: row.archetype_id
      });
    }

    return map;
  }

  /**
   * Delete player archetype (revert to default/calculated)
   */
  public deletePlayerArchetype(playerId: number): void {
    if (!this.editsDb) return;

    this.editsDb.prepare('DELETE FROM player_archetypes WHERE player_id = ?').run(playerId);
    console.log(`[UserDatabaseService] Deleted player archetype: playerId=${playerId}`);
  }

  // =============================================
  // CUSTOM PLAYER OPERATIONS
  // =============================================

  public createCustomPlayer(player: CustomPlayer): number {
    if (!this.customDb) throw new Error('Custom database not initialized');

    console.log('[UserDatabaseService] createCustomPlayer:', player);

    const result = this.customDb.prepare(`
      INSERT INTO custom_players (first_name, last_name, college_id, race, height, weight,
                                   hometown, home_state, position,
                                   draft_class, draft_round, draft_pick, career_from, career_to,
                                   madden_pid, madden_pam, madden_plpo, madden_commid,
                                   body_type, handedness, has_3d_model)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      player.firstName,
      player.lastName,
      player.collegeId ?? null,
      player.race ?? null,
      player.height ?? null,
      player.weight ?? null,
      player.hometown ?? null,
      player.homeState ?? null,
      player.position ?? null,
      player.draftClass ?? null,
      player.draftRound ?? null,
      player.draftPick ?? null,
      player.careerFrom ?? null,
      player.careerTo ?? null,
      player.maddenPid ?? null,
      player.maddenPam ?? null,
      player.maddenPlpo ?? null,
      player.maddenCommid ?? null,
      player.bodyType ?? null,
      player.handedness ?? null,
      player.has3DModel ? 1 : 0
    );

    console.log(`[UserDatabaseService] Created custom player: ${player.firstName} ${player.lastName}, id=${result.lastInsertRowid}`);
    return Number(result.lastInsertRowid);
  }

  public updateCustomPlayer(id: number, updates: Partial<CustomPlayer>): void {
    if (!this.customDb) throw new Error('Custom database not initialized');

    const updateFields: string[] = [];
    const values: unknown[] = [];

    if (updates.firstName !== undefined) { updateFields.push('first_name = ?'); values.push(updates.firstName); }
    if (updates.lastName !== undefined) { updateFields.push('last_name = ?'); values.push(updates.lastName); }
    if (updates.collegeId !== undefined) { updateFields.push('college_id = ?'); values.push(updates.collegeId); }
    if (updates.race !== undefined) { updateFields.push('race = ?'); values.push(updates.race); }
    if (updates.height !== undefined) { updateFields.push('height = ?'); values.push(updates.height); }
    if (updates.weight !== undefined) { updateFields.push('weight = ?'); values.push(updates.weight); }
    if (updates.hometown !== undefined) { updateFields.push('hometown = ?'); values.push(updates.hometown); }
    if (updates.homeState !== undefined) { updateFields.push('home_state = ?'); values.push(updates.homeState); }
    if (updates.position !== undefined) { updateFields.push('position = ?'); values.push(updates.position); }
    if (updates.draftClass !== undefined) { updateFields.push('draft_class = ?'); values.push(updates.draftClass); }
    if (updates.draftRound !== undefined) { updateFields.push('draft_round = ?'); values.push(updates.draftRound); }
    if (updates.draftPick !== undefined) { updateFields.push('draft_pick = ?'); values.push(updates.draftPick); }
    if (updates.careerFrom !== undefined) { updateFields.push('career_from = ?'); values.push(updates.careerFrom); }
    if (updates.careerTo !== undefined) { updateFields.push('career_to = ?'); values.push(updates.careerTo); }
    if (updates.maddenPid !== undefined) { updateFields.push('madden_pid = ?'); values.push(updates.maddenPid); }
    if (updates.maddenPam !== undefined) { updateFields.push('madden_pam = ?'); values.push(updates.maddenPam); }
    if (updates.maddenPlpo !== undefined) { updateFields.push('madden_plpo = ?'); values.push(updates.maddenPlpo); }
    if (updates.maddenCommid !== undefined) { updateFields.push('madden_commid = ?'); values.push(updates.maddenCommid); }
    if (updates.bodyType !== undefined) { updateFields.push('body_type = ?'); values.push(updates.bodyType); }
    if (updates.handedness !== undefined) { updateFields.push('handedness = ?'); values.push(updates.handedness); }
    if (updates.has3DModel !== undefined) { updateFields.push('has_3d_model = ?'); values.push(updates.has3DModel ? 1 : 0); }

    if (updateFields.length > 0) {
      updateFields.push("edited_at = datetime('now')");
      values.push(id);
      this.customDb.prepare(`UPDATE custom_players SET ${updateFields.join(', ')} WHERE id = ?`).run(...values);
      console.log(`[UserDatabaseService] Updated custom player id=${id}`);
    }
  }

  public getCustomPlayer(id: number): CustomPlayer | null {
    if (!this.customDb) return null;

    const row = this.customDb.prepare('SELECT * FROM custom_players WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!row) return null;

    return {
      id: row.id as number,
      firstName: row.first_name as string,
      lastName: row.last_name as string,
      collegeId: row.college_id as number | undefined,
      race: row.race as number | undefined,
      height: row.height as number | undefined,
      weight: row.weight as number | undefined,
      hometown: row.hometown as string | undefined,
      homeState: row.home_state as string | undefined,
      position: row.position as string | undefined,
      draftClass: row.draft_class as number | undefined,
      draftRound: row.draft_round as string | undefined,
      draftPick: row.draft_pick as number | undefined,
      careerFrom: row.career_from as number | undefined,
      careerTo: row.career_to as number | undefined,
      maddenPid: row.madden_pid as number | undefined,
      maddenPam: row.madden_pam as string | undefined,
      maddenPlpo: row.madden_plpo as string | undefined,
      maddenCommid: row.madden_commid as string | undefined,
      bodyType: row.body_type as number | undefined,
      handedness: row.handedness as number | undefined,
      has3DModel: row.has_3d_model === 1,
      createdAt: row.created_at as string | undefined,
      editedAt: row.edited_at as string | undefined
    };
  }

  public getAllCustomPlayers(): CustomPlayer[] {
    if (!this.customDb) return [];

    const rows = this.customDb.prepare('SELECT * FROM custom_players ORDER BY last_name, first_name').all() as Record<string, unknown>[];

    return rows.map(row => ({
      id: row.id as number,
      firstName: row.first_name as string,
      lastName: row.last_name as string,
      collegeId: row.college_id as number | undefined,
      race: row.race as number | undefined,
      height: row.height as number | undefined,
      weight: row.weight as number | undefined,
      hometown: row.hometown as string | undefined,
      homeState: row.home_state as string | undefined,
      position: row.position as string | undefined,
      draftClass: row.draft_class as number | undefined,
      draftRound: row.draft_round as string | undefined,
      draftPick: row.draft_pick as number | undefined,
      careerFrom: row.career_from as number | undefined,
      careerTo: row.career_to as number | undefined,
      maddenPid: row.madden_pid as number | undefined,
      maddenPam: row.madden_pam as string | undefined,
      maddenPlpo: row.madden_plpo as string | undefined,
      maddenCommid: row.madden_commid as string | undefined,
      bodyType: row.body_type as number | undefined,
      handedness: row.handedness as number | undefined,
      has3DModel: row.has_3d_model === 1,
      createdAt: row.created_at as string | undefined,
      editedAt: row.edited_at as string | undefined
    }));
  }

  public deleteCustomPlayer(id: number): void {
    if (!this.customDb) return;

    // Seasons are deleted via CASCADE
    this.customDb.prepare('DELETE FROM custom_players WHERE id = ?').run(id);
    console.log(`[UserDatabaseService] Deleted custom player id=${id}`);
  }

  // =============================================
  // CUSTOM PLAYER SEASON OPERATIONS
  // =============================================

  public saveCustomPlayerSeason(customPlayerId: number, year: number, season: Partial<CustomPlayerSeason>): void {
    if (!this.customDb) throw new Error('Custom database not initialized');

    const columns = ['custom_player_id', 'year', 'team', 'jersey', 'age', 'position', 'archetype'];
    const values: unknown[] = [customPlayerId, year, season.team ?? null, season.jersey ?? null,
                                season.age ?? null, season.position ?? null, season.archetype ?? null];

    // Support both nested (season.ratings.POVR) and flat (season.POVR) formats
    const seasonAny = season as Record<string, unknown>;
    for (const field of RATING_FIELDS) {
      columns.push(field);
      // Check nested ratings first, then flat format
      const value = season.ratings?.[field] ?? seasonAny[field] ?? null;
      values.push(value);
    }

    const placeholders = columns.map(() => '?').join(', ');

    this.customDb.prepare(`
      INSERT OR REPLACE INTO custom_player_seasons (${columns.join(', ')})
      VALUES (${placeholders})
    `).run(...values);

    console.log(`[UserDatabaseService] Saved custom player season: player_id=${customPlayerId}, year=${year}`);
  }

  public getCustomPlayerSeason(customPlayerId: number, year: number): CustomPlayerSeason | null {
    if (!this.customDb) return null;

    const row = this.customDb.prepare('SELECT * FROM custom_player_seasons WHERE custom_player_id = ? AND year = ?')
      .get(customPlayerId, year) as Record<string, unknown> | undefined;
    if (!row) return null;

    const ratings: { [key: string]: number } = {};
    for (const field of RATING_FIELDS) {
      if (row[field] !== null && row[field] !== undefined) {
        ratings[field] = row[field] as number;
      }
    }

    return {
      id: row.id as number,
      customPlayerId: row.custom_player_id as number,
      year: row.year as number,
      team: row.team as string | undefined,
      jersey: row.jersey as number | undefined,
      age: row.age as number | undefined,
      position: row.position as string | undefined,
      archetype: row.archetype as string | undefined,
      ratings
    };
  }

  public getCustomPlayerSeasons(customPlayerId: number): CustomPlayerSeason[] {
    if (!this.customDb) return [];

    const rows = this.customDb.prepare('SELECT * FROM custom_player_seasons WHERE custom_player_id = ? ORDER BY year')
      .all(customPlayerId) as Record<string, unknown>[];

    return rows.map(row => {
      const ratings: { [key: string]: number } = {};
      for (const field of RATING_FIELDS) {
        if (row[field] !== null && row[field] !== undefined) {
          ratings[field] = row[field] as number;
        }
      }

      return {
        id: row.id as number,
        customPlayerId: row.custom_player_id as number,
        year: row.year as number,
        team: row.team as string | undefined,
        jersey: row.jersey as number | undefined,
        age: row.age as number | undefined,
        position: row.position as string | undefined,
        archetype: row.archetype as string | undefined,
        ratings
      };
    });
  }

  /**
   * Get all custom player seasons with player data joined.
   * Returns an array of objects combining custom player info with their season data.
   * Used by RosterGeneratorService to include custom players in generated rosters.
   */
  public getAllCustomPlayerSeasonsWithPlayer(): Array<{
    customPlayerId: number;
    firstName: string;
    lastName: string;
    collegeId?: number;
    race?: number;
    height?: number;
    weight?: number;
    hometown?: string;
    homeState?: string;
    draftClass?: number;
    draftRound?: string;
    draftPick?: number;
    careerFrom?: number;
    careerTo?: number;
    maddenPid?: number;
    maddenPam?: string;
    maddenPlpo?: string;
    maddenCommid?: string;
    bodyType?: number;
    handedness?: number;
    has3DModel?: boolean;
    year: number;
    team?: string;
    jersey?: number;
    age?: number;
    position?: string;
    archetype?: string;
    ratings: { [key: string]: number };
  }> {
    if (!this.customDb) return [];

    const rows = this.customDb.prepare(`
      SELECT
        p.id as player_id,
        p.first_name, p.last_name, p.college_id, p.race, p.height, p.weight,
        p.hometown, p.home_state, p.draft_class, p.draft_round, p.draft_pick,
        p.career_from, p.career_to, p.madden_pid, p.madden_pam, p.madden_plpo,
        p.madden_commid, p.body_type, p.handedness, p.has_3d_model,
        s.year, s.team, s.jersey, s.age, s.position, s.archetype,
        ${RATING_FIELDS.map(f => `s.${f}`).join(', ')}
      FROM custom_players p
      JOIN custom_player_seasons s ON p.id = s.custom_player_id
      ORDER BY s.year, p.last_name, p.first_name
    `).all() as Record<string, unknown>[];

    return rows.map(row => {
      const ratings: { [key: string]: number } = {};
      for (const field of RATING_FIELDS) {
        if (row[field] !== null && row[field] !== undefined) {
          ratings[field] = row[field] as number;
        }
      }

      return {
        customPlayerId: row.player_id as number,
        firstName: row.first_name as string,
        lastName: row.last_name as string,
        collegeId: row.college_id as number | undefined,
        race: row.race as number | undefined,
        height: row.height as number | undefined,
        weight: row.weight as number | undefined,
        hometown: row.hometown as string | undefined,
        homeState: row.home_state as string | undefined,
        draftClass: row.draft_class as number | undefined,
        draftRound: row.draft_round as string | undefined,
        draftPick: row.draft_pick as number | undefined,
        careerFrom: row.career_from as number | undefined,
        careerTo: row.career_to as number | undefined,
        maddenPid: row.madden_pid as number | undefined,
        maddenPam: row.madden_pam as string | undefined,
        maddenPlpo: row.madden_plpo as string | undefined,
        maddenCommid: row.madden_commid as string | undefined,
        bodyType: row.body_type as number | undefined,
        handedness: row.handedness as number | undefined,
        has3DModel: row.has_3d_model === 1,
        year: row.year as number,
        team: row.team as string | undefined,
        jersey: row.jersey as number | undefined,
        age: row.age as number | undefined,
        position: row.position as string | undefined,
        archetype: row.archetype as string | undefined,
        ratings
      };
    });
  }

  /**
   * Partial update for custom player season - only updates provided fields.
   * Unlike saveCustomPlayerSeason (INSERT OR REPLACE), this preserves existing values.
   * If the season doesn't exist, it creates it with the provided values.
   */
  public updateCustomPlayerSeason(customPlayerId: number, year: number, edits: Partial<CustomPlayerSeason>): void {
    if (!this.customDb) throw new Error('Custom database not initialized');

    // Check if season exists
    const existingRow = this.customDb.prepare(
      'SELECT id FROM custom_player_seasons WHERE custom_player_id = ? AND year = ?'
    ).get(customPlayerId, year) as { id: number } | undefined;

    if (!existingRow) {
      // Season doesn't exist, use saveCustomPlayerSeason to create it
      console.log(`[UserDatabaseService] Season doesn't exist for player ${customPlayerId} year ${year}, creating new`);
      this.saveCustomPlayerSeason(customPlayerId, year, edits);
      return;
    }

    // Build UPDATE query with only the provided fields
    const setClauses: string[] = [];
    const values: unknown[] = [];

    // Handle season info fields
    const editsAny = edits as Record<string, unknown>;
    const infoFields = ['team', 'jersey', 'age', 'position', 'archetype'];
    for (const field of infoFields) {
      if (editsAny[field] !== undefined) {
        setClauses.push(`${field} = ?`);
        values.push(editsAny[field]);
      }
    }

    // Handle rating fields - check both flat format (edits.POVR) and nested (edits.ratings.POVR)
    for (const field of RATING_FIELDS) {
      // Check flat format first (how frontend sends it)
      let value = editsAny[field];
      // Then check nested ratings format
      if (value === undefined && edits.ratings?.[field] !== undefined) {
        value = edits.ratings[field];
      }

      if (value !== undefined) {
        setClauses.push(`${field} = ?`);
        values.push(value);
      }
    }

    if (setClauses.length === 0) {
      console.log(`[UserDatabaseService] No fields to update for player ${customPlayerId} year ${year}`);
      return;
    }

    // Add WHERE clause values
    values.push(customPlayerId, year);

    const sql = `UPDATE custom_player_seasons SET ${setClauses.join(', ')} WHERE custom_player_id = ? AND year = ?`;

    console.log(`[UserDatabaseService] Partial update for player ${customPlayerId} year ${year}: updating ${setClauses.length} fields`);
    console.log(`[UserDatabaseService] Update SQL: ${sql}`);
    console.log(`[UserDatabaseService] Update values:`, values);

    this.customDb.prepare(sql).run(...values);
  }

  /**
   * Delete a specific season for a custom player
   * @param customPlayerId The custom player's ID
   * @param year The year to delete
   * @returns true if a record was deleted
   */
  public deleteCustomPlayerSeason(customPlayerId: number, year: number): boolean {
    if (!this.customDb) throw new Error('Custom database not initialized');

    const result = this.customDb.prepare(
      'DELETE FROM custom_player_seasons WHERE custom_player_id = ? AND year = ?'
    ).run(customPlayerId, year);

    console.log(`[UserDatabaseService] Deleted custom player season ${year} for player_id=${customPlayerId}, affected=${result.changes}`);
    return result.changes > 0;
  }

  // =============================================
  // RESET OPERATIONS
  // =============================================

  public resetAllEdits(): void {
    if (!this.editsDb) return;

    this.editsDb.exec('DELETE FROM player_edits');
    this.editsDb.exec('DELETE FROM appearance_edits');
    this.editsDb.exec('DELETE FROM season_edits');

    console.log('[UserDatabaseService] Reset all player edits');
  }

  public resetAllCustomPlayers(): void {
    if (!this.customDb) return;

    this.customDb.exec('DELETE FROM custom_player_seasons');
    this.customDb.exec('DELETE FROM custom_players');

    console.log('[UserDatabaseService] Reset all custom players');
  }

  public resetAll(): void {
    this.resetAllEdits();
    this.resetAllCustomPlayers();
    console.log('[UserDatabaseService] Full database reset complete');
  }

  // =============================================
  // HIDE/UNHIDE PLAYER OPERATIONS
  // =============================================

  /**
   * Hide a player from search results
   * Also removes from user_unhidden_players if they were there
   */
  public hidePlayer(playerId: number): void {
    if (!this.editsDb) throw new Error('Edits database not initialized');
    this.editsDb.prepare('INSERT OR REPLACE INTO hidden_players (original_player_id) VALUES (?)').run(playerId);
    // Remove from unhidden list if present (user changed their mind)
    this.editsDb.prepare('DELETE FROM user_unhidden_players WHERE original_player_id = ?').run(playerId);
    console.log(`[UserDatabaseService] Hidden player id=${playerId}`);
  }

  /**
   * Unhide a player (restore to search results)
   * If player is bundled-hidden, adds to user_unhidden_players to override
   */
  public unhidePlayer(playerId: number): void {
    if (!this.editsDb) throw new Error('Edits database not initialized');
    // Remove from user's hidden list
    this.editsDb.prepare('DELETE FROM hidden_players WHERE original_player_id = ?').run(playerId);

    // If this player is bundled-hidden, add to user_unhidden to override
    if (lookupService.isBundledHiddenPlayer(playerId)) {
      this.editsDb.prepare('INSERT OR REPLACE INTO user_unhidden_players (original_player_id) VALUES (?)').run(playerId);
      console.log(`[UserDatabaseService] Unhidden bundled-hidden player id=${playerId} (added to user overrides)`);
    } else {
      console.log(`[UserDatabaseService] Unhidden player id=${playerId}`);
    }
  }

  /**
   * Check if a player is hidden
   * A player is hidden if:
   * 1. User has explicitly hidden them, OR
   * 2. They are bundled-hidden AND user hasn't explicitly unhidden them
   */
  public isPlayerHidden(playerId: number): boolean {
    if (!this.editsDb) return false;

    // Check if user has explicitly hidden this player
    const userHidden = this.editsDb.prepare('SELECT 1 FROM hidden_players WHERE original_player_id = ?').get(playerId);
    if (userHidden) return true;

    // Check if player is bundled-hidden
    const bundledHidden = lookupService.isBundledHiddenPlayer(playerId);
    if (bundledHidden) {
      // Check if user has explicitly unhidden this player (override)
      const userUnhidden = this.editsDb.prepare('SELECT 1 FROM user_unhidden_players WHERE original_player_id = ?').get(playerId);
      if (userUnhidden) return false; // User override - not hidden
      return true; // Bundled hidden, no user override - hidden
    }

    return false;
  }

  /**
   * Check if a player is hidden by the bundled database (developer-hidden)
   * This is separate from user-hidden for UI purposes
   */
  public isBundledHiddenPlayer(playerId: number): boolean {
    return lookupService.isBundledHiddenPlayer(playerId);
  }

  /**
   * Check if user has explicitly unhidden a bundled-hidden player
   */
  public hasUserUnhidden(playerId: number): boolean {
    if (!this.editsDb) return false;
    const row = this.editsDb.prepare('SELECT 1 FROM user_unhidden_players WHERE original_player_id = ?').get(playerId);
    return !!row;
  }

  /**
   * Get list of all hidden player IDs (combines user + bundled hidden)
   */
  public getHiddenPlayers(): number[] {
    if (!this.editsDb) return [];

    // Get user-hidden players
    const userHiddenRows = this.editsDb.prepare('SELECT original_player_id FROM hidden_players').all() as { original_player_id: number }[];
    const userHidden = new Set(userHiddenRows.map(r => r.original_player_id));

    // Get bundled-hidden players
    const bundledHidden = lookupService.getBundledHiddenPlayers();

    // Get user-unhidden players (overrides for bundled)
    const userUnhiddenRows = this.editsDb.prepare('SELECT original_player_id FROM user_unhidden_players').all() as { original_player_id: number }[];
    const userUnhidden = new Set(userUnhiddenRows.map(r => r.original_player_id));

    // Combine: user-hidden + (bundled-hidden minus user-unhidden)
    const allHidden = new Set(userHidden);
    for (const pid of bundledHidden) {
      if (!userUnhidden.has(pid)) {
        allHidden.add(pid);
      }
    }

    return Array.from(allHidden);
  }

  /**
   * Get list of user-hidden player IDs only (not including bundled)
   */
  public getUserHiddenPlayers(): number[] {
    if (!this.editsDb) return [];
    const rows = this.editsDb.prepare('SELECT original_player_id FROM hidden_players').all() as { original_player_id: number }[];
    return rows.map(r => r.original_player_id);
  }

  /**
   * Clear all user-hidden players (restore all user hides)
   * Note: This doesn't affect bundled-hidden players
   */
  public clearHiddenPlayers(): void {
    if (!this.editsDb) throw new Error('Edits database not initialized');
    this.editsDb.exec('DELETE FROM hidden_players');
    console.log('[UserDatabaseService] Cleared all user-hidden players');
  }

  /**
   * Clear all user unhidden overrides (bundled-hidden players become hidden again)
   */
  public clearUserUnhiddenPlayers(): void {
    if (!this.editsDb) throw new Error('Edits database not initialized');
    this.editsDb.exec('DELETE FROM user_unhidden_players');
    console.log('[UserDatabaseService] Cleared all user unhidden overrides');
  }

  /**
   * Hide multiple players at once (bulk operation)
   * Returns the number of players hidden
   */
  public hideMultiplePlayers(playerIds: number[]): number {
    if (!this.editsDb) throw new Error('Edits database not initialized');
    if (playerIds.length === 0) return 0;

    const stmt = this.editsDb.prepare('INSERT OR IGNORE INTO hidden_players (original_player_id) VALUES (?)');
    const removeStmt = this.editsDb.prepare('DELETE FROM user_unhidden_players WHERE original_player_id = ?');
    const insertMany = this.editsDb.transaction((ids: number[]) => {
      let count = 0;
      for (const id of ids) {
        const result = stmt.run(id);
        if (result.changes > 0) count++;
        // Also remove from unhidden list
        removeStmt.run(id);
      }
      return count;
    });

    const hiddenCount = insertMany(playerIds);
    console.log(`[UserDatabaseService] Bulk hidden ${hiddenCount} players (${playerIds.length} requested)`);
    return hiddenCount;
  }

  // =============================================
  // BACKUP & RESTORE
  // =============================================

  public createBackup(): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(this.backupPath, timestamp);

    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    // Close databases for safe copy
    if (this.editsDb) {
      const editsPath = path.join(this.userDataPath, 'user-edits.db');
      const editsBackup = path.join(backupDir, 'user-edits.db');
      fs.copyFileSync(editsPath, editsBackup);
    }

    if (this.customDb) {
      const customPath = path.join(this.userDataPath, 'custom-players.db');
      const customBackup = path.join(backupDir, 'custom-players.db');
      fs.copyFileSync(customPath, customBackup);
    }

    console.log(`[UserDatabaseService] Backup created: ${backupDir}`);
    return backupDir;
  }

  public restoreBackup(backupDir: string): void {
    // Close current databases
    if (this.editsDb) {
      this.editsDb.close();
      this.editsDb = null;
    }
    if (this.customDb) {
      this.customDb.close();
      this.customDb = null;
    }

    // Restore files
    const editsBackup = path.join(backupDir, 'user-edits.db');
    const customBackup = path.join(backupDir, 'custom-players.db');

    if (fs.existsSync(editsBackup)) {
      fs.copyFileSync(editsBackup, path.join(this.userDataPath, 'user-edits.db'));
    }

    if (fs.existsSync(customBackup)) {
      fs.copyFileSync(customBackup, path.join(this.userDataPath, 'custom-players.db'));
    }

    // Reinitialize
    this.initializeEditsDatabase();
    this.initializeCustomDatabase();

    console.log(`[UserDatabaseService] Backup restored from: ${backupDir}`);
  }

  public getBackupList(): string[] {
    if (!fs.existsSync(this.backupPath)) return [];

    return fs.readdirSync(this.backupPath)
      .filter(name => fs.statSync(path.join(this.backupPath, name)).isDirectory())
      .sort()
      .reverse(); // Most recent first
  }

  // =============================================
  // STATISTICS
  // =============================================

  public getStats(): DatabaseStats {
    let editedPlayers = 0;
    let customPlayers = 0;
    let editedSeasons = 0;
    let customSeasons = 0;

    if (this.editsDb) {
      const playerEdits = this.editsDb.prepare('SELECT COUNT(*) as count FROM player_edits').get() as { count: number };
      const appearanceEdits = this.editsDb.prepare('SELECT COUNT(DISTINCT original_player_id) as count FROM appearance_edits').get() as { count: number };
      const seasonEditsPlayers = this.editsDb.prepare('SELECT COUNT(DISTINCT original_player_id) as count FROM season_edits').get() as { count: number };
      editedPlayers = Math.max(playerEdits.count, appearanceEdits.count, seasonEditsPlayers.count);

      const seasonEditsCount = this.editsDb.prepare('SELECT COUNT(*) as count FROM season_edits').get() as { count: number };
      editedSeasons = seasonEditsCount.count;
    }

    if (this.customDb) {
      const customCount = this.customDb.prepare('SELECT COUNT(*) as count FROM custom_players').get() as { count: number };
      customPlayers = customCount.count;

      const customSeasonsCount = this.customDb.prepare('SELECT COUNT(*) as count FROM custom_player_seasons').get() as { count: number };
      customSeasons = customSeasonsCount.count;
    }

    return { editedPlayers, customPlayers, editedSeasons, customSeasons };
  }

  // =============================================
  // SEARCH (for Player Browser)
  // =============================================

  /**
   * Get all custom players by draft class year
   * Used by FutureDraftService to load players from database instead of CSV
   */
  public getCustomPlayersByDraftYear(year: number): CustomPlayer[] {
    if (!this.customDb) return [];

    const rows = this.customDb.prepare(`
      SELECT * FROM custom_players
      WHERE draft_class = ?
      ORDER BY draft_round, draft_pick, last_name, first_name
    `).all(year) as Record<string, unknown>[];

    return rows.map(row => ({
      id: row.id as number,
      firstName: row.first_name as string,
      lastName: row.last_name as string,
      collegeId: row.college_id as number | undefined,
      race: row.race as number | undefined,
      height: row.height as number | undefined,
      weight: row.weight as number | undefined,
      hometown: row.hometown as string | undefined,
      homeState: row.home_state as string | undefined,
      position: row.position as string | undefined,
      draftClass: row.draft_class as number | undefined,
      draftRound: row.draft_round as string | undefined,
      draftPick: row.draft_pick as number | undefined,
      careerFrom: row.career_from as number | undefined,
      careerTo: row.career_to as number | undefined,
      maddenPid: row.madden_pid as number | undefined,
      maddenPam: row.madden_pam as string | undefined,
      maddenPlpo: row.madden_plpo as string | undefined,
      maddenCommid: row.madden_commid as string | undefined,
      bodyType: row.body_type as number | undefined,
      handedness: row.handedness as number | undefined,
      createdAt: row.created_at as string | undefined,
      editedAt: row.edited_at as string | undefined
    }));
  }

  public searchCustomPlayers(query: string, limit = 50): CustomPlayer[] {
    if (!this.customDb) return [];

    const searchPattern = `%${query}%`;
    const rows = this.customDb.prepare(`
      SELECT * FROM custom_players
      WHERE first_name LIKE ? OR last_name LIKE ? OR (first_name || ' ' || last_name) LIKE ?
      ORDER BY last_name, first_name
      LIMIT ?
    `).all(searchPattern, searchPattern, searchPattern, limit) as Record<string, unknown>[];

    return rows.map(row => ({
      id: row.id as number,
      firstName: row.first_name as string,
      lastName: row.last_name as string,
      collegeId: row.college_id as number | undefined,
      race: row.race as number | undefined,
      height: row.height as number | undefined,
      weight: row.weight as number | undefined,
      hometown: row.hometown as string | undefined,
      homeState: row.home_state as string | undefined,
      position: row.position as string | undefined,
      draftClass: row.draft_class as number | undefined,
      draftRound: row.draft_round as string | undefined,
      draftPick: row.draft_pick as number | undefined,
      careerFrom: row.career_from as number | undefined,
      careerTo: row.career_to as number | undefined,
      maddenPid: row.madden_pid as number | undefined,
      maddenPam: row.madden_pam as string | undefined,
      maddenPlpo: row.madden_plpo as string | undefined,
      maddenCommid: row.madden_commid as string | undefined,
      createdAt: row.created_at as string | undefined,
      editedAt: row.edited_at as string | undefined
    }));
  }

  // Get all edited player IDs (for marking in UI)
  public getEditedPlayerIds(): number[] {
    if (!this.editsDb) return [];

    const playerEdits = this.editsDb.prepare('SELECT original_id FROM player_edits').all() as { original_id: number }[];
    const appearanceEdits = this.editsDb.prepare('SELECT original_player_id FROM appearance_edits').all() as { original_player_id: number }[];
    const seasonEdits = this.editsDb.prepare('SELECT DISTINCT original_player_id FROM season_edits').all() as { original_player_id: number }[];

    const ids = new Set<number>();
    playerEdits.forEach(r => ids.add(r.original_id));
    appearanceEdits.forEach(r => ids.add(r.original_player_id));
    seasonEdits.forEach(r => ids.add(r.original_player_id));

    return Array.from(ids);
  }

  // =============================================
  // CUSTOM PORTRAIT OPERATIONS (PID 12000+)
  // =============================================

  private static readonly CUSTOM_PID_START = 12000;

  /**
   * Get next available PID for custom portraits (starting at 12000)
   */
  public getNextAvailablePid(): number {
    if (!this.customDb) throw new Error('Custom database not initialized');

    const row = this.customDb.prepare('SELECT MAX(pid) as max_pid FROM custom_portraits').get() as { max_pid: number | null };
    const maxPid = row?.max_pid ?? (UserDatabaseService.CUSTOM_PID_START - 1);
    return Math.max(maxPid + 1, UserDatabaseService.CUSTOM_PID_START);
  }

  /**
   * Save a custom portrait to the database
   */
  public saveCustomPortrait(
    pid: number,
    imageData: Buffer,
    metadata?: { originalFilename?: string; playerName?: string; databasePlayerId?: number; year?: number }
  ): void {
    if (!this.customDb) throw new Error('Custom database not initialized');

    this.customDb.prepare(`
      INSERT OR REPLACE INTO custom_portraits (pid, image_data, original_filename, player_name, database_player_id, year)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      pid,
      imageData,
      metadata?.originalFilename ?? null,
      metadata?.playerName ?? null,
      metadata?.databasePlayerId ?? null,
      metadata?.year ?? null
    );

    console.log(`[UserDatabaseService] Saved custom portrait PID=${pid}${metadata?.databasePlayerId ? ` (player ID: ${metadata.databasePlayerId})` : ''}`);
  }

  /**
   * Get a custom portrait by PID
   */
  public getCustomPortrait(pid: number): CustomPortrait | null {
    if (!this.customDb) return null;

    const row = this.customDb.prepare('SELECT * FROM custom_portraits WHERE pid = ?').get(pid) as Record<string, unknown> | undefined;
    if (!row) return null;

    return {
      pid: row.pid as number,
      imageData: row.image_data as Buffer,
      originalFilename: row.original_filename as string | undefined,
      playerName: row.player_name as string | undefined,
      databasePlayerId: row.database_player_id as number | undefined,
      year: row.year as number | undefined,
      createdAt: row.created_at as string | undefined
    };
  }

  /**
   * Get custom portrait PID by database player ID
   * Used by generators to find custom portraits for specific players
   */
  public getCustomPortraitByPlayerId(databasePlayerId: number): number | null {
    if (!this.customDb) return null;

    const row = this.customDb.prepare('SELECT pid FROM custom_portraits WHERE database_player_id = ?').get(databasePlayerId) as { pid: number } | undefined;
    return row?.pid ?? null;
  }

  /**
   * Get custom portrait PID by player name
   * Searches for portraits with matching player_name (case-insensitive)
   * Used by generators to find custom portraits when loading historical players
   *
   * @param firstName Player first name
   * @param lastName Player last name
   * @returns Custom portrait PID (12000+) if found, null otherwise
   */
  public getCustomPortraitByName(firstName: string, lastName: string): number | null {
    if (!this.customDb) return null;

    const fullName = `${firstName} ${lastName}`;

    // Try exact match first (case-insensitive)
    const exactRow = this.customDb.prepare(`
      SELECT pid FROM custom_portraits
      WHERE LOWER(player_name) = LOWER(?)
    `).get(fullName) as { pid: number } | undefined;

    if (exactRow) {
      return exactRow.pid;
    }

    // Try partial match (last name only, for "Budde" matching "Ed Budde")
    const partialRow = this.customDb.prepare(`
      SELECT pid FROM custom_portraits
      WHERE LOWER(player_name) LIKE LOWER(?)
    `).get(`%${lastName}`) as { pid: number } | undefined;

    return partialRow?.pid ?? null;
  }

  /**
   * Get all custom portraits (metadata only, no image data for list view)
   */
  public getAllCustomPortraits(): Omit<CustomPortrait, 'imageData'>[] {
    if (!this.customDb) return [];

    const rows = this.customDb.prepare(`
      SELECT pid, original_filename, player_name, database_player_id, year, created_at
      FROM custom_portraits
      ORDER BY pid
    `).all() as Record<string, unknown>[];

    return rows.map(row => ({
      pid: row.pid as number,
      originalFilename: row.original_filename as string | undefined,
      playerName: row.player_name as string | undefined,
      databasePlayerId: row.database_player_id as number | undefined,
      year: row.year as number | undefined,
      createdAt: row.created_at as string | undefined
    }));
  }

  /**
   * Get custom portraits by year
   */
  public getCustomPortraitsByYear(year: number): Omit<CustomPortrait, 'imageData'>[] {
    if (!this.customDb) return [];

    const rows = this.customDb.prepare(`
      SELECT pid, original_filename, player_name, database_player_id, year, created_at
      FROM custom_portraits
      WHERE year = ?
      ORDER BY pid
    `).all(year) as Record<string, unknown>[];

    return rows.map(row => ({
      pid: row.pid as number,
      originalFilename: row.original_filename as string | undefined,
      playerName: row.player_name as string | undefined,
      databasePlayerId: row.database_player_id as number | undefined,
      year: row.year as number | undefined,
      createdAt: row.created_at as string | undefined
    }));
  }

  /**
   * Delete a custom portrait
   */
  public deleteCustomPortrait(pid: number): void {
    if (!this.customDb) return;

    this.customDb.prepare('DELETE FROM custom_portraits WHERE pid = ?').run(pid);
    console.log(`[UserDatabaseService] Deleted custom portrait PID=${pid}`);
  }

  /**
   * Check if a custom portrait exists
   */
  public hasCustomPortrait(pid: number): boolean {
    if (!this.customDb) return false;
    const row = this.customDb.prepare('SELECT 1 FROM custom_portraits WHERE pid = ?').get(pid);
    return !!row;
  }

  /**
   * Get count of custom portraits
   */
  public getCustomPortraitCount(): number {
    if (!this.customDb) return 0;
    const row = this.customDb.prepare('SELECT COUNT(*) as count FROM custom_portraits').get() as { count: number };
    return row.count;
  }

  /**
   * Update custom portrait metadata (not image)
   */
  public updateCustomPortraitMetadata(
    pid: number,
    metadata: { playerName?: string; databasePlayerId?: number; year?: number }
  ): void {
    if (!this.customDb) throw new Error('Custom database not initialized');

    const updates: string[] = [];
    const values: unknown[] = [];

    if (metadata.playerName !== undefined) {
      updates.push('player_name = ?');
      values.push(metadata.playerName);
    }
    if (metadata.databasePlayerId !== undefined) {
      updates.push('database_player_id = ?');
      values.push(metadata.databasePlayerId);
    }
    if (metadata.year !== undefined) {
      updates.push('year = ?');
      values.push(metadata.year);
    }

    if (updates.length > 0) {
      values.push(pid);
      this.customDb.prepare(`UPDATE custom_portraits SET ${updates.join(', ')} WHERE pid = ?`).run(...values);
      console.log(`[UserDatabaseService] Updated custom portrait metadata PID=${pid}${metadata.databasePlayerId ? ` (player ID: ${metadata.databasePlayerId})` : ''}`);
    }
  }

  /**
   * Get all assigned custom portrait PIDs mapped to database player IDs
   * Used by generators to look up all custom portraits in one call
   */
  public getAllCustomPortraitAssignments(): Map<number, number> {
    if (!this.customDb) return new Map();

    const rows = this.customDb.prepare(`
      SELECT database_player_id, pid
      FROM custom_portraits
      WHERE database_player_id IS NOT NULL
    `).all() as { database_player_id: number; pid: number }[];

    const map = new Map<number, number>();
    for (const row of rows) {
      map.set(row.database_player_id, row.pid);
    }
    return map;
  }

  /**
   * Get portraits that have a player_name but no database_player_id
   * These need migration to link to database IDs
   */
  public getPortraitsNeedingMigration(): { pid: number; playerName: string }[] {
    if (!this.customDb) return [];

    const rows = this.customDb.prepare(`
      SELECT pid, player_name
      FROM custom_portraits
      WHERE player_name IS NOT NULL AND database_player_id IS NULL
    `).all() as { pid: number; player_name: string }[];

    return rows.map(r => ({ pid: r.pid, playerName: r.player_name }));
  }

  /**
   * Migrate a portrait assignment to link with database player ID
   */
  public migratePortraitAssignment(pid: number, databasePlayerId: number): void {
    if (!this.customDb) return;

    this.customDb.prepare(`
      UPDATE custom_portraits SET database_player_id = ? WHERE pid = ?
    `).run(databasePlayerId, pid);

    console.log(`[UserDatabaseService] Migrated portrait PID ${pid} to database player ID ${databasePlayerId}`);
  }

  // =============================================
  // CUSTOM COACH PORTRAIT OPERATIONS
  // =============================================

  /**
   * Get next available coach portrait PID (50000+)
   */
  public getNextAvailableCoachPid(): number {
    if (!this.customDb) return 50000;

    const row = this.customDb.prepare('SELECT MAX(pid) as max_pid FROM custom_coach_portraits').get() as { max_pid: number | null };
    return Math.max(50000, (row?.max_pid ?? 49999) + 1);
  }

  /**
   * Save a custom coach portrait
   */
  public saveCustomCoachPortrait(
    pid: number,
    imageData: Buffer,
    metadata?: { originalFilename?: string; coachName?: string; databaseCoachId?: number; year?: number }
  ): void {
    if (!this.customDb) throw new Error('Custom database not initialized');

    this.customDb.prepare(`
      INSERT OR REPLACE INTO custom_coach_portraits (pid, image_data, original_filename, coach_name, database_coach_id, year)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      pid,
      imageData,
      metadata?.originalFilename ?? null,
      metadata?.coachName ?? null,
      metadata?.databaseCoachId ?? null,
      metadata?.year ?? null
    );

    console.log(`[UserDatabaseService] Saved custom coach portrait: PID ${pid}`);
  }

  /**
   * Get a custom coach portrait by PID
   */
  public getCustomCoachPortrait(pid: number): CustomCoachPortrait | null {
    if (!this.customDb) return null;

    const row = this.customDb.prepare('SELECT * FROM custom_coach_portraits WHERE pid = ?').get(pid) as Record<string, unknown> | undefined;

    if (!row) return null;

    return {
      pid: row.pid as number,
      imageData: row.image_data as Buffer,
      originalFilename: row.original_filename as string | undefined,
      coachName: row.coach_name as string | undefined,
      databaseCoachId: row.database_coach_id as number | undefined,
      year: row.year as number | undefined,
      createdAt: row.created_at as string | undefined
    };
  }

  /**
   * Get custom coach portrait by database coach ID
   */
  public getCustomCoachPortraitByCoachId(databaseCoachId: number): number | null {
    if (!this.customDb) return null;

    const row = this.customDb.prepare('SELECT pid FROM custom_coach_portraits WHERE database_coach_id = ?').get(databaseCoachId) as { pid: number } | undefined;
    return row?.pid ?? null;
  }

  /**
   * Get all custom coach portraits (metadata only)
   */
  public getAllCustomCoachPortraits(): Omit<CustomCoachPortrait, 'imageData'>[] {
    if (!this.customDb) return [];

    const rows = this.customDb.prepare(`
      SELECT pid, original_filename, coach_name, database_coach_id, year, created_at
      FROM custom_coach_portraits
      ORDER BY created_at DESC
    `).all() as Record<string, unknown>[];

    return rows.map(row => ({
      pid: row.pid as number,
      originalFilename: row.original_filename as string | undefined,
      coachName: row.coach_name as string | undefined,
      databaseCoachId: row.database_coach_id as number | undefined,
      year: row.year as number | undefined,
      createdAt: row.created_at as string | undefined
    }));
  }

  /**
   * Get custom coach portraits by year
   */
  public getCustomCoachPortraitsByYear(year: number): Omit<CustomCoachPortrait, 'imageData'>[] {
    if (!this.customDb) return [];

    const rows = this.customDb.prepare(`
      SELECT pid, original_filename, coach_name, database_coach_id, year, created_at
      FROM custom_coach_portraits
      WHERE year = ?
      ORDER BY created_at DESC
    `).all(year) as Record<string, unknown>[];

    return rows.map(row => ({
      pid: row.pid as number,
      originalFilename: row.original_filename as string | undefined,
      coachName: row.coach_name as string | undefined,
      databaseCoachId: row.database_coach_id as number | undefined,
      year: row.year as number | undefined,
      createdAt: row.created_at as string | undefined
    }));
  }

  /**
   * Delete a custom coach portrait
   */
  public deleteCustomCoachPortrait(pid: number): void {
    if (!this.customDb) return;

    this.customDb.prepare('DELETE FROM custom_coach_portraits WHERE pid = ?').run(pid);
    console.log(`[UserDatabaseService] Deleted custom coach portrait: PID ${pid}`);
  }

  /**
   * Check if custom coach portrait exists
   */
  public hasCustomCoachPortrait(pid: number): boolean {
    if (!this.customDb) return false;
    const row = this.customDb.prepare('SELECT 1 FROM custom_coach_portraits WHERE pid = ?').get(pid);
    return !!row;
  }

  /**
   * Get custom coach portrait count
   */
  public getCustomCoachPortraitCount(): number {
    if (!this.customDb) return 0;
    const row = this.customDb.prepare('SELECT COUNT(*) as count FROM custom_coach_portraits').get() as { count: number };
    return row.count;
  }

  /**
   * Update custom coach portrait metadata
   */
  public updateCustomCoachPortraitMetadata(
    pid: number,
    metadata: { coachName?: string; databaseCoachId?: number; year?: number }
  ): void {
    if (!this.customDb) return;

    const updates: string[] = [];
    const values: unknown[] = [];

    if (metadata.coachName !== undefined) {
      updates.push('coach_name = ?');
      values.push(metadata.coachName);
    }
    if (metadata.databaseCoachId !== undefined) {
      updates.push('database_coach_id = ?');
      values.push(metadata.databaseCoachId);
    }
    if (metadata.year !== undefined) {
      updates.push('year = ?');
      values.push(metadata.year);
    }

    if (updates.length > 0) {
      values.push(pid);
      this.customDb.prepare(`UPDATE custom_coach_portraits SET ${updates.join(', ')} WHERE pid = ?`).run(...values);
    }
  }

  /**
   * Get all custom coach portrait assignments (database_coach_id -> pid map)
   */
  public getAllCustomCoachPortraitAssignments(): Map<number, number> {
    if (!this.customDb) return new Map();

    const rows = this.customDb.prepare(`
      SELECT database_coach_id, pid
      FROM custom_coach_portraits
      WHERE database_coach_id IS NOT NULL
    `).all() as { database_coach_id: number; pid: number }[];

    const map = new Map<number, number>();
    for (const row of rows) {
      map.set(row.database_coach_id, row.pid);
    }
    return map;
  }

  /**
   * Get available years for custom coach portraits
   */
  public getCustomCoachPortraitYears(): number[] {
    if (!this.customDb) return [];

    const rows = this.customDb.prepare(`
      SELECT DISTINCT year FROM custom_coach_portraits WHERE year IS NOT NULL ORDER BY year DESC
    `).all() as { year: number }[];

    return rows.map(r => r.year);
  }

  // =============================================
  // COACH EDIT OPERATIONS
  // =============================================

  public saveCoachEdit(originalId: number, edits: Partial<CoachEdit>): void {
    if (!this.editsDb) throw new Error('Edits database not initialized');

    const existing = this.getCoachEdit(originalId);

    if (existing) {
      const updates: string[] = [];
      const values: unknown[] = [];

      if (edits.firstName !== undefined) { updates.push('first_name = ?'); values.push(edits.firstName); }
      if (edits.lastName !== undefined) { updates.push('last_name = ?'); values.push(edits.lastName); }
      if (edits.teamIndex !== undefined) { updates.push('team_index = ?'); values.push(edits.teamIndex); }
      if (edits.position !== undefined) { updates.push('position = ?'); values.push(edits.position); }
      if (edits.experience !== undefined) { updates.push('experience = ?'); values.push(edits.experience); }
      if (edits.age !== undefined) { updates.push('age = ?'); values.push(edits.age); }

      if (updates.length > 0) {
        updates.push("edited_at = datetime('now')");
        values.push(originalId);
        this.editsDb.prepare(`UPDATE coach_edits SET ${updates.join(', ')} WHERE original_id = ?`).run(...values);
      }
    } else {
      this.editsDb.prepare(`
        INSERT INTO coach_edits (original_id, first_name, last_name, team_index, position, experience, age)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        originalId,
        edits.firstName ?? null,
        edits.lastName ?? null,
        edits.teamIndex ?? null,
        edits.position ?? null,
        edits.experience ?? null,
        edits.age ?? null
      );
    }
  }

  public getCoachEdit(originalId: number): CoachEdit | null {
    if (!this.editsDb) return null;

    const row = this.editsDb.prepare('SELECT * FROM coach_edits WHERE original_id = ?').get(originalId) as Record<string, unknown> | undefined;
    if (!row) return null;

    return {
      originalId: row.original_id as number,
      firstName: row.first_name as string | undefined,
      lastName: row.last_name as string | undefined,
      teamIndex: row.team_index as number | undefined,
      position: row.position as string | undefined,
      experience: row.experience as number | undefined,
      age: row.age as number | undefined,
      editedAt: row.edited_at as string | undefined
    };
  }

  public hasCoachEdit(originalId: number): boolean {
    if (!this.editsDb) return false;
    const row = this.editsDb.prepare('SELECT 1 FROM coach_edits WHERE original_id = ?').get(originalId);
    return !!row;
  }

  /**
   * Get all coach edits as a Map for fast bulk lookups
   */
  public getAllCoachEdits(): Map<number, CoachEdit> {
    const map = new Map<number, CoachEdit>();
    if (!this.editsDb) return map;

    const rows = this.editsDb.prepare('SELECT * FROM coach_edits').all() as Record<string, unknown>[];
    for (const row of rows) {
      map.set(row.original_id as number, {
        originalId: row.original_id as number,
        firstName: row.first_name as string | undefined,
        lastName: row.last_name as string | undefined,
        teamIndex: row.team_index as number | undefined,
        position: row.position as string | undefined,
        experience: row.experience as number | undefined,
        age: row.age as number | undefined,
        editedAt: row.edited_at as string | undefined
      });
    }
    return map;
  }

  /**
   * Get all coach appearance edits as a Map for fast bulk lookups
   */
  public getAllCoachAppearanceEdits(): Map<number, CoachAppearanceEdit> {
    const map = new Map<number, CoachAppearanceEdit>();
    if (!this.editsDb) return map;

    const rows = this.editsDb.prepare('SELECT * FROM coach_appearance_edits').all() as Record<string, unknown>[];
    for (const row of rows) {
      map.set(row.original_coach_id as number, {
        originalCoachId: row.original_coach_id as number,
        maddenPid: row.madden_pid as number | undefined,
        maddenPam: row.madden_pam as string | undefined,
        headAsset: row.head_asset as string | undefined,
        editedAt: row.edited_at as string | undefined
      });
    }
    return map;
  }

  public resetCoach(originalId: number): void {
    if (!this.editsDb) return;
    this.editsDb.prepare('DELETE FROM coach_edits WHERE original_id = ?').run(originalId);
    this.editsDb.prepare('DELETE FROM coach_appearance_edits WHERE original_coach_id = ?').run(originalId);
    this.editsDb.prepare('DELETE FROM coach_season_edits WHERE original_coach_id = ?').run(originalId);
    console.log(`[UserDatabaseService] Reset coach edits for original_id=${originalId}`);
  }

  // =============================================
  // COACH APPEARANCE EDIT OPERATIONS
  // =============================================

  public saveCoachAppearanceEdit(originalCoachId: number, edits: Partial<CoachAppearanceEdit>): void {
    if (!this.editsDb) throw new Error('Edits database not initialized');

    this.editsDb.prepare(`
      INSERT OR REPLACE INTO coach_appearance_edits (original_coach_id, madden_pid, madden_pam, head_asset)
      VALUES (?, ?, ?, ?)
    `).run(
      originalCoachId,
      edits.maddenPid ?? null,
      edits.maddenPam ?? null,
      edits.headAsset ?? null
    );
  }

  public getCoachAppearanceEdit(originalCoachId: number): CoachAppearanceEdit | null {
    if (!this.editsDb) return null;

    const row = this.editsDb.prepare('SELECT * FROM coach_appearance_edits WHERE original_coach_id = ?')
      .get(originalCoachId) as Record<string, unknown> | undefined;
    if (!row) return null;

    return {
      originalCoachId: row.original_coach_id as number,
      maddenPid: row.madden_pid as number | undefined,
      maddenPam: row.madden_pam as string | undefined,
      headAsset: row.head_asset as string | undefined,
      editedAt: row.edited_at as string | undefined
    };
  }

  /**
   * Get all coach appearance edit PIDs mapped to coach IDs (bulk load for performance)
   * Returns Map of originalCoachId -> maddenPid for coaches that have PID edits
   */
  public getAllCoachAppearanceEditPids(): Map<number, number> {
    if (!this.editsDb) return new Map();

    const rows = this.editsDb.prepare(`
      SELECT original_coach_id, madden_pid
      FROM coach_appearance_edits
      WHERE madden_pid IS NOT NULL
    `).all() as { original_coach_id: number; madden_pid: number }[];

    const map = new Map<number, number>();
    for (const row of rows) {
      map.set(row.original_coach_id, row.madden_pid);
    }
    return map;
  }

  // =============================================
  // COACH SEASON EDIT OPERATIONS
  // =============================================

  public saveCoachSeasonEdit(originalCoachId: number, year: number, edits: Partial<CoachSeasonEdit>): void {
    if (!this.editsDb) throw new Error('Edits database not initialized');

    this.editsDb.prepare(`
      INSERT OR REPLACE INTO coach_season_edits
      (original_coach_id, year, team, position, wins, losses, ties, playoff_wins, super_bowl_wins)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      originalCoachId,
      year,
      edits.team ?? null,
      edits.position ?? null,
      edits.wins ?? null,
      edits.losses ?? null,
      edits.ties ?? null,
      edits.playoffWins ?? null,
      edits.superBowlWins ?? null
    );
  }

  public getCoachSeasonEdit(originalCoachId: number, year: number): CoachSeasonEdit | null {
    if (!this.editsDb) return null;

    const row = this.editsDb.prepare(
      'SELECT * FROM coach_season_edits WHERE original_coach_id = ? AND year = ?'
    ).get(originalCoachId, year) as Record<string, unknown> | undefined;
    if (!row) return null;

    return {
      id: row.id as number,
      originalCoachId: row.original_coach_id as number,
      year: row.year as number,
      team: row.team as string | undefined,
      position: row.position as string | undefined,
      wins: row.wins as number | undefined,
      losses: row.losses as number | undefined,
      ties: row.ties as number | undefined,
      playoffWins: row.playoff_wins as number | undefined,
      superBowlWins: row.super_bowl_wins as number | undefined,
      editedAt: row.edited_at as string | undefined
    };
  }

  public getCoachSeasonEditsForCoach(originalCoachId: number): CoachSeasonEdit[] {
    if (!this.editsDb) return [];

    const rows = this.editsDb.prepare(
      'SELECT * FROM coach_season_edits WHERE original_coach_id = ? ORDER BY year'
    ).all(originalCoachId) as Record<string, unknown>[];

    return rows.map(row => ({
      id: row.id as number,
      originalCoachId: row.original_coach_id as number,
      year: row.year as number,
      team: row.team as string | undefined,
      position: row.position as string | undefined,
      wins: row.wins as number | undefined,
      losses: row.losses as number | undefined,
      ties: row.ties as number | undefined,
      playoffWins: row.playoff_wins as number | undefined,
      superBowlWins: row.super_bowl_wins as number | undefined,
      editedAt: row.edited_at as string | undefined
    }));
  }

  // =============================================
  // CUSTOM COACH OPERATIONS
  // =============================================

  public createCustomCoach(coach: Omit<CustomCoach, 'id' | 'createdAt' | 'editedAt'> & { source?: string }): number {
    if (!this.customDb) throw new Error('Custom database not initialized');

    const result = this.customDb.prepare(`
      INSERT INTO custom_coaches (first_name, last_name, team_index, position, experience, age,
                                   career_from, career_to, madden_pid, madden_pam, head_asset,
                                   career_wins, career_losses, career_ties, career_playoff_wins,
                                   career_playoff_losses, career_sb_wins, career_sb_losses, source)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      coach.firstName,
      coach.lastName,
      coach.teamIndex ?? null,
      coach.position ?? null,
      coach.experience ?? null,
      coach.age ?? null,
      coach.careerFrom ?? null,
      coach.careerTo ?? null,
      coach.maddenPid ?? null,
      coach.maddenPam ?? null,
      coach.headAsset ?? null,
      (coach as any).careerWins ?? 0,
      (coach as any).careerLosses ?? 0,
      (coach as any).careerTies ?? 0,
      (coach as any).careerPlayoffWins ?? 0,
      (coach as any).careerPlayoffLosses ?? 0,
      (coach as any).careerSBWins ?? 0,
      (coach as any).careerSBLosses ?? 0,
      (coach as any).source ?? 'manual'
    );

    console.log(`[UserDatabaseService] Created custom coach: ${coach.firstName} ${coach.lastName}, id=${result.lastInsertRowid}`);
    return result.lastInsertRowid as number;
  }

  public updateCustomCoach(id: number, updates: Partial<CustomCoach>): void {
    if (!this.customDb) throw new Error('Custom database not initialized');

    const updateFields: string[] = [];
    const values: unknown[] = [];

    if (updates.firstName !== undefined) { updateFields.push('first_name = ?'); values.push(updates.firstName); }
    if (updates.lastName !== undefined) { updateFields.push('last_name = ?'); values.push(updates.lastName); }
    if (updates.teamIndex !== undefined) { updateFields.push('team_index = ?'); values.push(updates.teamIndex); }
    if (updates.position !== undefined) { updateFields.push('position = ?'); values.push(updates.position); }
    if (updates.experience !== undefined) { updateFields.push('experience = ?'); values.push(updates.experience); }
    if (updates.age !== undefined) { updateFields.push('age = ?'); values.push(updates.age); }
    if (updates.careerFrom !== undefined) { updateFields.push('career_from = ?'); values.push(updates.careerFrom); }
    if (updates.careerTo !== undefined) { updateFields.push('career_to = ?'); values.push(updates.careerTo); }
    if (updates.maddenPid !== undefined) { updateFields.push('madden_pid = ?'); values.push(updates.maddenPid); }
    if (updates.maddenPam !== undefined) { updateFields.push('madden_pam = ?'); values.push(updates.maddenPam); }
    if (updates.headAsset !== undefined) { updateFields.push('head_asset = ?'); values.push(updates.headAsset); }

    if (updateFields.length > 0) {
      updateFields.push("edited_at = datetime('now')");
      values.push(id);
      this.customDb.prepare(`UPDATE custom_coaches SET ${updateFields.join(', ')} WHERE id = ?`).run(...values);
    }
  }

  public getCustomCoach(id: number): CustomCoach | null {
    if (!this.customDb) return null;

    const row = this.customDb.prepare('SELECT * FROM custom_coaches WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!row) return null;

    return {
      id: row.id as number,
      firstName: row.first_name as string,
      lastName: row.last_name as string,
      teamIndex: row.team_index as number | undefined,
      position: row.position as string | undefined,
      experience: row.experience as number | undefined,
      age: row.age as number | undefined,
      careerFrom: row.career_from as number | undefined,
      careerTo: row.career_to as number | undefined,
      maddenPid: row.madden_pid as number | undefined,
      maddenPam: row.madden_pam as string | undefined,
      headAsset: row.head_asset as string | undefined,
      createdAt: row.created_at as string | undefined,
      editedAt: row.edited_at as string | undefined
    };
  }

  public getAllCustomCoaches(): CustomCoach[] {
    if (!this.customDb) return [];

    const rows = this.customDb.prepare('SELECT * FROM custom_coaches ORDER BY last_name, first_name')
      .all() as Record<string, unknown>[];

    return rows.map(row => ({
      id: row.id as number,
      firstName: row.first_name as string,
      lastName: row.last_name as string,
      teamIndex: row.team_index as number | undefined,
      position: row.position as string | undefined,
      experience: row.experience as number | undefined,
      age: row.age as number | undefined,
      careerFrom: row.career_from as number | undefined,
      careerTo: row.career_to as number | undefined,
      maddenPid: row.madden_pid as number | undefined,
      maddenPam: row.madden_pam as string | undefined,
      headAsset: row.head_asset as string | undefined,
      createdAt: row.created_at as string | undefined,
      editedAt: row.edited_at as string | undefined
    }));
  }

  public deleteCustomCoach(id: number): void {
    if (!this.customDb) return;
    // Seasons are deleted via CASCADE
    this.customDb.prepare('DELETE FROM custom_coaches WHERE id = ?').run(id);
    console.log(`[UserDatabaseService] Deleted custom coach id=${id}`);
  }

  public clearAllCustomCoaches(): void {
    if (!this.customDb) return;
    // Clear seasons first, then coaches
    this.customDb.prepare('DELETE FROM custom_coach_seasons').run();
    this.customDb.prepare('DELETE FROM custom_coaches').run();
    console.log(`[UserDatabaseService] Cleared all custom coaches and seasons`);
  }

  /**
   * Migrate stranded coach portrait assignments from coach_appearance_edits to custom_coaches
   * This fixes portraits that were incorrectly saved to the appearance edits table
   * instead of directly to the custom coach record.
   */
  public migrateStrandedCoachPortraits(): { migrated: number; errors: string[] } {
    const result = { migrated: 0, errors: [] as string[] };

    if (!this.editsDb || !this.customDb) {
      result.errors.push('Databases not initialized');
      return result;
    }

    try {
      // Get all custom coach IDs
      const customCoaches = this.getAllCustomCoaches();
      const customCoachIds = new Set(customCoaches.map(c => c.id));
      console.log(`[UserDatabaseService] Found ${customCoachIds.size} custom coaches`);

      // Get all coach appearance edits
      const appearanceEdits = this.getAllCoachAppearanceEdits();
      console.log(`[UserDatabaseService] Found ${appearanceEdits.size} appearance edits`);

      // Find stranded edits (edits for custom coaches)
      for (const [coachId, edit] of appearanceEdits) {
        if (customCoachIds.has(coachId) && edit.maddenPid !== undefined && edit.maddenPid !== null) {
          console.log(`[UserDatabaseService] Migrating portrait PID ${edit.maddenPid} to custom coach ${coachId}`);

          try {
            // Update the custom coach with the portrait data
            this.updateCustomCoach(coachId, {
              maddenPid: edit.maddenPid,
              maddenPam: edit.maddenPam
            });

            // Delete the stranded appearance edit
            this.editsDb.prepare('DELETE FROM coach_appearance_edits WHERE original_coach_id = ?').run(coachId);

            result.migrated++;
          } catch (err) {
            result.errors.push(`Failed to migrate coach ${coachId}: ${(err as Error).message}`);
          }
        }
      }

      console.log(`[UserDatabaseService] Migration complete: ${result.migrated} portraits migrated`);
    } catch (err) {
      result.errors.push(`Migration failed: ${(err as Error).message}`);
    }

    return result;
  }

  public searchCustomCoaches(query: string, limit = 50): CustomCoach[] {
    if (!this.customDb) return [];

    const searchTerm = `%${query}%`;
    const rows = this.customDb.prepare(`
      SELECT * FROM custom_coaches
      WHERE first_name LIKE ? OR last_name LIKE ?
      ORDER BY last_name, first_name
      LIMIT ?
    `).all(searchTerm, searchTerm, limit) as Record<string, unknown>[];

    return rows.map(row => ({
      id: row.id as number,
      firstName: row.first_name as string,
      lastName: row.last_name as string,
      teamIndex: row.team_index as number | undefined,
      position: row.position as string | undefined,
      experience: row.experience as number | undefined,
      age: row.age as number | undefined,
      careerFrom: row.career_from as number | undefined,
      careerTo: row.career_to as number | undefined,
      maddenPid: row.madden_pid as number | undefined,
      maddenPam: row.madden_pam as string | undefined,
      createdAt: row.created_at as string | undefined,
      editedAt: row.edited_at as string | undefined
    }));
  }

  /**
   * Get coach PID/PAM and year-specific stats by exact name match - used by Retro Editor
   * Searches custom_coaches table for a coach with matching first/last name
   * If year is provided, also fetches season stats for that year
   * Returns { pid, pam, seasonStats? } if found, null otherwise
   */
  public getCoachByNameForRetro(firstName: string, lastName: string, year?: number): {
    pid: number | null;
    pam: string;
    seasonStats?: {
      team: string;
      position: string;
      careerWins: number;
      careerLosses: number;
      careerTies: number;
      playoffWins: number;
      superBowlWins: number;
    };
  } | null {
    if (!this.customDb) return null;

    // Case-insensitive exact match - get coach ID and appearance data
    const coachRow = this.customDb.prepare(`
      SELECT id, madden_pid, madden_pam FROM custom_coaches
      WHERE LOWER(first_name) = LOWER(?) AND LOWER(last_name) = LOWER(?)
      LIMIT 1
    `).get(firstName, lastName) as { id: number; madden_pid: number | null; madden_pam: string | null } | undefined;

    if (!coachRow) {
      return null;
    }

    const result: {
      pid: number | null;
      pam: string;
      seasonStats?: {
        team: string;
        position: string;
        careerWins: number;
        careerLosses: number;
        careerTies: number;
        playoffWins: number;
        superBowlWins: number;
      };
    } = {
      pid: coachRow.madden_pid,
      pam: coachRow.madden_pam || ''
    };

    // If year provided, get season stats for that year
    if (year) {
      const seasonRow = this.customDb.prepare(`
        SELECT team, position, wins, losses, ties, playoff_wins, super_bowl_wins
        FROM custom_coach_seasons
        WHERE custom_coach_id = ? AND year = ?
      `).get(coachRow.id, year) as {
        team: string | null;
        position: string | null;
        wins: number | null;
        losses: number | null;
        ties: number | null;
        playoff_wins: number | null;
        super_bowl_wins: number | null;
      } | undefined;

      if (seasonRow) {
        result.seasonStats = {
          team: seasonRow.team || '',
          position: seasonRow.position || 'HC',
          careerWins: seasonRow.wins || 0,
          careerLosses: seasonRow.losses || 0,
          careerTies: seasonRow.ties || 0,
          playoffWins: seasonRow.playoff_wins || 0,
          superBowlWins: seasonRow.super_bowl_wins || 0
        };
      }
    }

    return result;
  }

  // =============================================
  // CUSTOM COACH SEASON OPERATIONS
  // =============================================

  public saveCustomCoachSeason(customCoachId: number, year: number, season: Partial<CustomCoachSeason>): void {
    if (!this.customDb) throw new Error('Custom database not initialized');

    this.customDb.prepare(`
      INSERT OR REPLACE INTO custom_coach_seasons
      (custom_coach_id, year, team, position, wins, losses, ties, playoff_wins, super_bowl_wins)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      customCoachId,
      year,
      season.team ?? null,
      season.position ?? null,
      season.wins ?? null,
      season.losses ?? null,
      season.ties ?? null,
      season.playoffWins ?? null,
      season.superBowlWins ?? null
    );
  }

  public getCustomCoachSeason(customCoachId: number, year: number): CustomCoachSeason | null {
    if (!this.customDb) return null;

    const row = this.customDb.prepare(
      'SELECT * FROM custom_coach_seasons WHERE custom_coach_id = ? AND year = ?'
    ).get(customCoachId, year) as Record<string, unknown> | undefined;
    if (!row) return null;

    return {
      id: row.id as number,
      customCoachId: row.custom_coach_id as number,
      year: row.year as number,
      team: row.team as string | undefined,
      position: row.position as string | undefined,
      wins: row.wins as number | undefined,
      losses: row.losses as number | undefined,
      ties: row.ties as number | undefined,
      playoffWins: row.playoff_wins as number | undefined,
      superBowlWins: row.super_bowl_wins as number | undefined
    };
  }

  public getCustomCoachSeasons(customCoachId: number): CustomCoachSeason[] {
    if (!this.customDb) return [];

    const rows = this.customDb.prepare(
      'SELECT * FROM custom_coach_seasons WHERE custom_coach_id = ? ORDER BY year'
    ).all(customCoachId) as Record<string, unknown>[];

    return rows.map(row => ({
      id: row.id as number,
      customCoachId: row.custom_coach_id as number,
      year: row.year as number,
      team: row.team as string | undefined,
      position: row.position as string | undefined,
      wins: row.wins as number | undefined,
      losses: row.losses as number | undefined,
      ties: row.ties as number | undefined,
      playoffWins: row.playoff_wins as number | undefined,
      superBowlWins: row.super_bowl_wins as number | undefined
    }));
  }

  // =============================================
  // COACH HIDE/UNHIDE OPERATIONS
  // =============================================

  public hideCoach(coachId: number): void {
    if (!this.editsDb) throw new Error('Edits database not initialized');
    this.editsDb.prepare('INSERT OR IGNORE INTO hidden_coaches (original_coach_id) VALUES (?)').run(coachId);
  }

  public unhideCoach(coachId: number): void {
    if (!this.editsDb) return;
    this.editsDb.prepare('DELETE FROM hidden_coaches WHERE original_coach_id = ?').run(coachId);
  }

  public isCoachHidden(coachId: number): boolean {
    if (!this.editsDb) return false;
    const row = this.editsDb.prepare('SELECT 1 FROM hidden_coaches WHERE original_coach_id = ?').get(coachId);
    return !!row;
  }

  public getHiddenCoachIds(): number[] {
    if (!this.editsDb) return [];
    const rows = this.editsDb.prepare('SELECT original_coach_id FROM hidden_coaches').all() as { original_coach_id: number }[];
    return rows.map(r => r.original_coach_id);
  }

  // =============================================
  // COACH RESET OPERATIONS
  // =============================================

  public resetAllCoachEdits(): void {
    if (!this.editsDb) return;
    this.editsDb.exec('DELETE FROM coach_edits');
    this.editsDb.exec('DELETE FROM coach_appearance_edits');
    this.editsDb.exec('DELETE FROM coach_season_edits');
    console.log('[UserDatabaseService] Reset all coach edits');
  }

  public resetAllCustomCoaches(): void {
    if (!this.customDb) return;
    this.customDb.exec('DELETE FROM custom_coach_seasons');
    this.customDb.exec('DELETE FROM custom_coaches');
    console.log('[UserDatabaseService] Reset all custom coaches');
  }

  // =============================================
  // COACH STATISTICS
  // =============================================

  public getCoachDatabaseStats(): CoachDatabaseStats {
    const stats: CoachDatabaseStats = {
      editedCoaches: 0,
      customCoaches: 0,
      editedSeasons: 0,
      customSeasons: 0
    };

    if (this.editsDb) {
      const editedRow = this.editsDb.prepare('SELECT COUNT(*) as count FROM coach_edits').get() as { count: number };
      stats.editedCoaches = editedRow.count;

      const seasonRow = this.editsDb.prepare('SELECT COUNT(*) as count FROM coach_season_edits').get() as { count: number };
      stats.editedSeasons = seasonRow.count;
    }

    if (this.customDb) {
      const customRow = this.customDb.prepare('SELECT COUNT(*) as count FROM custom_coaches').get() as { count: number };
      stats.customCoaches = customRow.count;

      const customSeasonRow = this.customDb.prepare('SELECT COUNT(*) as count FROM custom_coach_seasons').get() as { count: number };
      stats.customSeasons = customSeasonRow.count;
    }

    return stats;
  }

  /**
   * Get coach by name for retro editor integration
   * Checks custom coaches and edited coaches
   */
  public getCoachByName(lastName: string, firstName: string): CustomCoach | CoachEdit | null {
    // First check custom coaches
    if (this.customDb) {
      const customRow = this.customDb.prepare(
        'SELECT * FROM custom_coaches WHERE last_name = ? AND first_name = ?'
      ).get(lastName, firstName) as Record<string, unknown> | undefined;

      if (customRow) {
        return {
          id: customRow.id as number,
          firstName: customRow.first_name as string,
          lastName: customRow.last_name as string,
          teamIndex: customRow.team_index as number | undefined,
          position: customRow.position as string | undefined,
          experience: customRow.experience as number | undefined,
          age: customRow.age as number | undefined,
          careerFrom: customRow.career_from as number | undefined,
          careerTo: customRow.career_to as number | undefined,
          maddenPid: customRow.madden_pid as number | undefined,
          maddenPam: customRow.madden_pam as string | undefined,
          createdAt: customRow.created_at as string | undefined,
          editedAt: customRow.edited_at as string | undefined
        };
      }
    }

    // Then check edited coaches
    if (this.editsDb) {
      const editRow = this.editsDb.prepare(
        'SELECT * FROM coach_edits WHERE last_name = ? AND first_name = ?'
      ).get(lastName, firstName) as Record<string, unknown> | undefined;

      if (editRow) {
        return {
          originalId: editRow.original_id as number,
          firstName: editRow.first_name as string | undefined,
          lastName: editRow.last_name as string | undefined,
          teamIndex: editRow.team_index as number | undefined,
          position: editRow.position as string | undefined,
          experience: editRow.experience as number | undefined,
          age: editRow.age as number | undefined,
          editedAt: editRow.edited_at as string | undefined
        };
      }
    }

    return null;
  }

  /**
   * Search custom coaches for Retro Editor
   * Searches by partial name match and filters by year (career_from <= year)
   */
  public searchCustomCoachesForRetro(query: string, year: number, limit = 20): Array<{
    id: number;
    firstName: string;
    lastName: string;
    position: string;
    careerFrom: number;
    careerTo: number;
    careerWins: number;
    careerLosses: number;
    source: 'custom';
  }> {
    if (!this.customDb) {
      console.log('[UserDatabaseService] Custom DB not initialized for coach search');
      return [];
    }

    const queryLower = query.toLowerCase().trim();
    if (!queryLower) return [];

    console.log(`[UserDatabaseService] Searching custom coaches for "${query}", year=${year}`);

    try {
      // Search custom_coaches with partial name match and year filter
      // Note: foreign key is custom_coach_id, not coach_id
      const rows = this.customDb.prepare(`
        SELECT
          c.id,
          c.first_name,
          c.last_name,
          c.position,
          c.career_from,
          c.career_to,
          COALESCE(c.career_wins, 0) as career_wins,
          COALESCE(c.career_losses, 0) as career_losses
        FROM custom_coaches c
        WHERE (
          LOWER(c.first_name) LIKE ? OR
          LOWER(c.last_name) LIKE ? OR
          LOWER(c.first_name || ' ' || c.last_name) LIKE ?
        )
        AND (c.career_from IS NULL OR c.career_from <= ?)
        ORDER BY c.last_name, c.first_name
        LIMIT ?
      `).all(`%${queryLower}%`, `%${queryLower}%`, `%${queryLower}%`, year, limit) as Record<string, unknown>[];

      console.log(`[UserDatabaseService] Found ${rows.length} custom coaches matching "${query}"`);

      return rows.map(row => ({
        id: row.id as number,
        firstName: row.first_name as string,
        lastName: row.last_name as string,
        position: (row.position as string) || 'HC',
        careerFrom: (row.career_from as number) || 0,
        careerTo: (row.career_to as number) || 0,
        careerWins: (row.career_wins as number) || 0,
        careerLosses: (row.career_losses as number) || 0,
        source: 'custom' as const
      }));
    } catch (err) {
      console.error(`[UserDatabaseService] Error searching custom coaches:`, err);
      return [];
    }
  }
}

// Export singleton instance
export const userDatabaseService = new UserDatabaseService();
