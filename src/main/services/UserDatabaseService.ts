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

// All rating fields from the database schema
const RATING_FIELDS = [
  'POVR', 'PSPD', 'PACC', 'PSTR', 'PAGI', 'PAWR', 'PCTH', 'PCAR', 'PTHP', 'PKPW',
  'PKAC', 'PRBK', 'PPBK', 'PTAK', 'PBTK', 'PJMP', 'PINJ', 'PSTA', 'PTGH', 'PTRK',
  'PCOD', 'PBCV', 'PSTF', 'PSPM', 'PJUM', 'PIBL', 'PRBP', 'PRBF', 'PPBP', 'PPBF',
  'PLDB', 'PBRS', 'PTUP', 'PPWM', 'PFNM', 'PBSH', 'PPUR', 'PPRC', 'PMCV', 'PZCV',
  'PSPC', 'PCIT', 'PSRR', 'PMRR', 'PDRR', 'PHTP', 'PPRS', 'PREL', 'PTAS', 'PTAM',
  'PTAD', 'PPLA', 'PTOR', 'PKRT', 'PLTR', 'PELU', 'PLSA', 'PLSM', 'PLJM', 'PLIB',
  'PLBK', 'PLPM', 'PFMS', 'PBSG', 'PLPU', 'PLPR', 'PLMC', 'PLZC', 'PLSC', 'PLCI',
  'SRRN', 'PLHT', 'PLPE', 'PLRL', 'PBSK', 'PPBS', 'PRBS'
];

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
  editedAt?: string;
}

export interface AppearanceEdit {
  originalPlayerId: number;
  maddenPid?: number;
  maddenPam?: string;
  maddenPlpo?: string;
  maddenCommid?: string;
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

class UserDatabaseService {
  private editsDb: Database.Database | null = null;
  private customDb: Database.Database | null = null;
  private userDataPath: string;
  private backupPath: string;
  private initialized: boolean = false;
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

  private async initializeEditsDatabase(): Promise<void> {
    const dbPath = path.join(this.userDataPath, 'user-edits.db');
    this.editsDb = new Database(dbPath);
    console.log(`[UserDatabaseService] Opened edits database: ${dbPath}`);

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

    this.editsDb.exec(`
      CREATE TABLE IF NOT EXISTS appearance_edits (
        original_player_id INTEGER PRIMARY KEY,
        madden_pid INTEGER,
        madden_pam TEXT,
        madden_plpo TEXT,
        madden_commid TEXT,
        edited_at TEXT DEFAULT (datetime('now'))
      )
    `);

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

    // Table to track players whose original seasons have been cleared
    // Used to fix wrongly-assigned seasons from name collisions
    this.editsDb.exec(`
      CREATE TABLE IF NOT EXISTS cleared_seasons (
        original_player_id INTEGER PRIMARY KEY,
        cleared_at TEXT DEFAULT (datetime('now'))
      )
    `);

    console.log('[UserDatabaseService] Edits database schema ready');
  }

  private async initializeCustomDatabase(): Promise<void> {
    const dbPath = path.join(this.userDataPath, 'custom-players.db');
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

    // Create indexes
    this.customDb.exec(`
      CREATE INDEX IF NOT EXISTS idx_custom_players_name ON custom_players(last_name, first_name);
      CREATE INDEX IF NOT EXISTS idx_custom_seasons_player ON custom_player_seasons(custom_player_id);
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

      if (updates.length > 0) {
        updates.push("edited_at = datetime('now')");
        values.push(originalId);
        this.editsDb.prepare(`UPDATE player_edits SET ${updates.join(', ')} WHERE original_id = ?`).run(...values);
      }
    } else {
      // Insert new edit
      this.editsDb.prepare(`
        INSERT INTO player_edits (original_id, first_name, last_name, college_id, race, height, weight,
                                   hometown, home_state, draft_class, draft_round, draft_pick, career_from, career_to)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        edits.careerTo ?? null
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
      editedAt: row.edited_at as string | undefined
    };
  }

  public hasPlayerEdit(originalId: number): boolean {
    if (!this.editsDb) return false;
    const row = this.editsDb.prepare('SELECT 1 FROM player_edits WHERE original_id = ?').get(originalId);
    return !!row;
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

    this.editsDb.prepare(`
      INSERT OR REPLACE INTO appearance_edits (original_player_id, madden_pid, madden_pam, madden_plpo, madden_commid)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      originalPlayerId,
      edits.maddenPid ?? null,
      edits.maddenPam ?? null,
      edits.maddenPlpo ?? null,
      edits.maddenCommid ?? null
    );

    console.log(`[UserDatabaseService] Saved appearance edit for player_id=${originalPlayerId}`);
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
      editedAt: row.edited_at as string | undefined
    };
  }

  // =============================================
  // SEASON EDIT OPERATIONS
  // =============================================

  public saveSeasonEdit(originalPlayerId: number, year: number, edits: Partial<SeasonEdit>): void {
    if (!this.editsDb) throw new Error('Edits database not initialized');

    // Build dynamic insert/update
    const columns = ['original_player_id', 'year', 'team', 'jersey', 'age', 'position', 'archetype'];
    const values: unknown[] = [originalPlayerId, year, edits.team ?? null, edits.jersey ?? null,
                                edits.age ?? null, edits.position ?? null, edits.archetype ?? null];

    // Add rating fields - check both edits.ratings.FIELD and edits.FIELD (frontend sends flat)
    for (const field of RATING_FIELDS) {
      columns.push(field);
      // Frontend sends ratings as flat properties (edits.POVR), but type expects nested (edits.ratings.POVR)
      values.push(edits.ratings?.[field] ?? (edits as Record<string, unknown>)[field] ?? null);
    }

    const placeholders = columns.map(() => '?').join(', ');

    this.editsDb.prepare(`
      INSERT OR REPLACE INTO season_edits (${columns.join(', ')})
      VALUES (${placeholders})
    `).run(...values);

    console.log(`[UserDatabaseService] Saved season edit for player_id=${originalPlayerId}, year=${year}`);
  }

  public getSeasonEdit(originalPlayerId: number, year: number): SeasonEdit | null {
    if (!this.editsDb) return null;

    const row = this.editsDb.prepare('SELECT * FROM season_edits WHERE original_player_id = ? AND year = ?')
      .get(originalPlayerId, year) as Record<string, unknown> | undefined;
    if (!row) return null;

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
                                   madden_pid, madden_pam, madden_plpo, madden_commid)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      player.maddenCommid ?? null
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

    for (const field of RATING_FIELDS) {
      columns.push(field);
      values.push(season.ratings?.[field] ?? null);
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

  public searchCustomPlayers(query: string, limit: number = 50): CustomPlayer[] {
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
}

// Export singleton instance
export const userDatabaseService = new UserDatabaseService();
