import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

import Database from 'better-sqlite3';

export interface LookupEntry {
  id: number;
  name: string;
}

export interface FullDataEntry {
  internalId: number;    // Internal database ID (unique per player)
  pid: number;           // PhotoID (may be shared across same-name players - needs cleanup)
  lastName: string;
  firstName: string;
  college: string;
  round: string;
  pick: string;
  draftClass: string;
  careerFrom?: number;   // Year career started
  careerTo?: number;     // Year career ended
  position: string;
  jersey?: number;       // Most recent jersey number
  pam: string;           // Player Assets ID
  commID: string;
  presID: string;
  plpo: string;          // PLPO portrait key
  race?: number;         // Race field from database
  isHOF?: boolean;       // Hall of Fame status
  height?: number;       // Height in inches
  weight?: number;       // Weight in pounds
  hometown?: string;     // Hometown city
  homeState?: string;    // Home state name
  wav?: number;          // Weighted Approximate Value
  ap1?: number;          // All-Pro 1st team selections
  pb?: number;           // Pro Bowl selections
  starts?: number;       // Career starts
}

export interface PAMEntry {
  pam: string;
  pid: number;
  type: 'generic' | 'player' | 'legend';
  ethnicity?: string;
  generation?: number;
  faceShape?: string;
  description?: string;
}

export interface CoachLookupEntry {
  lastName: string;
  firstName: string;
  pam: string;
  pid: number | null; // null for PAM-only coaches (no portrait PID yet)
  displayName: string; // Generated from firstName + lastName
}

export interface LookupCache {
  [fileName: string]: Map<number, string>;
}

export interface PlayerSeasonEntry {
  playerId: number;
  year: number;
  team: string;
  jersey: number;
  age: number;
  position: string;
  archetype: string;
  games: number;
  gamesStarted: number;
  av: number;
  devTrait: string;
  ratings: { [key: string]: number };
}

export class LookupService {
  private db: Database.Database | null = null;
  private cache: LookupCache = {};
  private reverseCache: { [fileName: string]: Map<string, number> } = {};
  private pamCache: Map<string, PAMEntry> = new Map(); // PAM name → PAMEntry
  private pamByPIDCache: Map<number, PAMEntry[]> = new Map(); // PID → PAMEntry[]
  private fullDataCache: Map<number, FullDataEntry> = new Map(); // internalId → FullDataEntry
  private pidToInternalIdMap: Map<number, number[]> = new Map(); // PID → array of internalIds (handles duplicates)
  private coachCache: Map<number, CoachLookupEntry> = new Map(); // PID → CoachLookupEntry
  private coachByPAMCache: Map<string, CoachLookupEntry> = new Map(); // PAM → CoachLookupEntry
  private commentaryCache: Map<string, number> = new Map(); // lastName (lowercase) → commentary ID
  private initPromise: Promise<void>;
  private initialized = false;

  constructor() {
    this.initPromise = this.initializeLookups();
  }

  // Wait for the service to be fully initialized (database loaded)
  public async waitForReady(): Promise<void> {
    await this.initPromise;
  }

  private resolveDataPath(...segments: string[]): string {
    // In packaged builds, data is in .vite/build/data
    // In dev mode, data is in the project root data folder
    const possiblePaths = [
      path.join(__dirname, 'data', ...segments),  // Packaged: __dirname is .vite/build, data is in .vite/build/data
      path.join(app.getAppPath(), '.vite', 'build', 'data', ...segments),  // Packaged build
      path.join(process.resourcesPath || '', 'app', '.vite', 'build', 'data', ...segments),  // Packaged with resourcesPath (installed app)
      path.join(app.getAppPath(), 'data', ...segments),                     // Dev mode
      path.join(process.cwd(), 'data', ...segments),                        // Fallback to cwd
    ];

    for (const p of possiblePaths) {
      if (fs.existsSync(p) || fs.existsSync(path.dirname(p))) {
        return p;
      }
    }

    // Default to packaged path
    return possiblePaths[0];
  }

  private async initializeLookups(): Promise<void> {
    try {
      // Initialize SQLite database
      const dbPath = this.resolveDataPath('players.db');
      console.log(`[lookup-service] Attempting to open database at: ${dbPath}`);
      console.log(`[lookup-service] app.getAppPath(): ${app.getAppPath()}`);
      console.log(`[lookup-service] Database file exists: ${fs.existsSync(dbPath)}`);

      if (fs.existsSync(dbPath)) {
        this.db = new Database(dbPath, { readonly: true });
        console.log(`[lookup-service] SQLite database opened successfully: ${dbPath}`);

        // Load lookup tables from database
        this.loadLookupsFromDatabase();

        // Fallback to CSV for any lookup tables that are empty in database
        console.log(`[lookup-service] College cache check - exists: ${!!this.cache['college_lookup.csv']}, size: ${this.cache['college_lookup.csv']?.size || 0}`);
        if (!this.cache['college_lookup.csv'] || this.cache['college_lookup.csv'].size === 0) {
          console.log('[lookup-service] Loading colleges from CSV fallback...');
          await this.loadLookupFile('college_lookup.csv');
          console.log(`[lookup-service] After CSV load - college cache size: ${this.cache['college_lookup.csv']?.size || 0}`);
        }

        // Load archetypes from CSV (not in database)
        await this.loadLookupFile('archetype_lookup.csv');

        // Load player data from database
        this.loadPlayersFromDatabase();

        // Merge in PIDs from PID_lookup.csv (fills in missing PIDs)
        await this.mergePIDLookupData();
      } else {
        console.warn(`[lookup-service] Database not found at ${dbPath}, falling back to CSV`);
        // Fallback to CSV loading
        await this.loadLookupsFromCSV();
      }

      // Load coach data from CoachPAM_lookup.csv (has real coach PAMs + PIDs)
      await this.loadCoachLookupFile('CoachPAM_lookup.csv');

      // Load commentary ID lookup data
      await this.loadCommentaryLookup();

      this.initialized = true;
      console.log('Lookup service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize lookup service:', error);
      // Fallback to CSV on error
      await this.loadLookupsFromCSV();
      this.initialized = true;
    }
  }

  private loadLookupsFromDatabase(): void {
    if (!this.db) return;

    // Load positions
    const positions = this.db.prepare('SELECT madden_id, name FROM positions').all() as { madden_id: number; name: string }[];
    this.cache['position_lookup.csv'] = new Map();
    this.reverseCache['position_lookup.csv'] = new Map();
    for (const row of positions) {
      this.cache['position_lookup.csv'].set(row.madden_id, row.name);
      this.reverseCache['position_lookup.csv'].set(row.name, row.madden_id);
    }
    console.log(`[lookup-service] Loaded ${positions.length} positions from database`);

    // Load teams
    const teams = this.db.prepare('SELECT madden_id, name FROM teams').all() as { madden_id: number; name: string }[];
    this.cache['team_lookup.csv'] = new Map();
    this.reverseCache['team_lookup.csv'] = new Map();
    for (const row of teams) {
      this.cache['team_lookup.csv'].set(row.madden_id, row.name);
      this.reverseCache['team_lookup.csv'].set(row.name, row.madden_id);
    }
    console.log(`[lookup-service] Loaded ${teams.length} teams from database`);

    // Load colleges
    try {
      const colleges = this.db.prepare('SELECT madden_id, name FROM colleges').all() as { madden_id: number; name: string }[];
      console.log(`[lookup-service] Raw college query returned ${colleges.length} rows`);
      if (colleges.length > 0) {
        console.log(`[lookup-service] First 3 college rows:`, colleges.slice(0, 3));
      }
      this.cache['college_lookup.csv'] = new Map();
      this.reverseCache['college_lookup.csv'] = new Map();
      if (colleges.length > 0) {
        for (const row of colleges) {
          this.cache['college_lookup.csv'].set(row.madden_id, row.name);
          this.reverseCache['college_lookup.csv'].set(row.name, row.madden_id);
        }
        console.log(`[lookup-service] Loaded ${colleges.length} colleges from database`);
        // Verify cache contents
        const cacheEntries = Array.from(this.cache['college_lookup.csv'].entries()).slice(0, 3);
        console.log(`[lookup-service] College cache sample:`, cacheEntries);
      } else {
        console.log(`[lookup-service] No colleges in database (0 rows), will load from CSV`);
      }
    } catch (dbError: any) {
      console.error(`[lookup-service] Error loading colleges from database:`, dbError.message);
      console.log(`[lookup-service] Will load colleges from CSV fallback`);
      // Ensure cache exists for fallback check
      this.cache['college_lookup.csv'] = new Map();
      this.reverseCache['college_lookup.csv'] = new Map();
    }

    // Load states
    const states = this.db.prepare('SELECT madden_id, name FROM states').all() as { madden_id: number; name: string }[];
    this.cache['state_lookup.csv'] = new Map();
    this.reverseCache['state_lookup.csv'] = new Map();
    for (const row of states) {
      this.cache['state_lookup.csv'].set(row.madden_id, row.name);
      this.reverseCache['state_lookup.csv'].set(row.name, row.madden_id);
    }
    console.log(`[lookup-service] Loaded ${states.length} states from database`);
  }

  private loadPlayersFromDatabase(): void {
    if (!this.db) return;

    // Load ALL players with their appearance data, career years, and position
    // IMPORTANT: Use p.position (from original CSV data) to avoid cross-player data pollution
    // The create-database.js script has a bug where seasons can get assigned to wrong players
    // with the same name if draft year doesn't match. Using p.position ensures each player
    // displays their correct position from the source data.
    // Use p.college_name and p.home_state_name directly (raw values stored in players table)
    // instead of JOINs which fail when foreign key IDs are NULL
    const players = this.db.prepare(`
      SELECT
        p.id, p.first_name, p.last_name, p.race, p.draft_class, p.draft_round, p.draft_pick,
        p.career_from, p.career_to, p.is_hof,
        p.height, p.weight, p.hometown, p.wav, p.ap1, p.pb, p.starts,
        COALESCE(p.college_name, c.name) as college_name,
        COALESCE(p.home_state_name, s.name) as state_name,
        pa.madden_pid, pa.madden_pam, pa.madden_plpo, pa.madden_commid,
        p.position as position,
        (SELECT ps.jersey FROM player_seasons ps WHERE ps.player_id = p.id ORDER BY ps.year DESC LIMIT 1) as jersey
      FROM players p
      LEFT JOIN colleges c ON c.id = p.college_id
      LEFT JOIN states s ON s.madden_id = p.home_state_id
      LEFT JOIN player_appearance pa ON pa.player_id = p.id
    `).all() as Array<{
      id: number;
      first_name: string;
      last_name: string;
      race: number | null;
      draft_class: number | null;
      draft_round: string | null;
      draft_pick: number | null;
      career_from: number | null;
      career_to: number | null;
      is_hof: number | null;
      height: number | null;
      weight: number | null;
      hometown: string | null;
      wav: number | null;
      ap1: number | null;
      pb: number | null;
      starts: number | null;
      college_name: string | null;
      state_name: string | null;
      madden_pid: number | null;
      madden_pam: string | null;
      madden_plpo: string | null;
      madden_commid: string | null;
      position: string | null;
      jersey: number | null;
    }>;

    this.fullDataCache.clear();
    this.pidToInternalIdMap.clear();
    let entriesWithPID = 0;
    let entriesWithPLPO = 0;
    let entriesWithPosition = 0;

    for (const row of players) {
      // Use internal database ID as the key - each player is unique
      const entry: FullDataEntry = {
        internalId: row.id,
        pid: row.madden_pid ?? 0, // 0 if no PID assigned
        firstName: row.first_name,
        lastName: row.last_name,
        college: row.college_name || '',
        round: row.draft_round || '',
        pick: row.draft_pick?.toString() || '',
        draftClass: row.draft_class?.toString() || '',
        careerFrom: row.career_from || undefined,
        careerTo: row.career_to || undefined,
        position: row.position || '', // Position from most recent season
        jersey: row.jersey || undefined, // Jersey from most recent season
        pam: row.madden_pam || '',
        commID: row.madden_commid || '',
        presID: row.madden_commid || '',
        plpo: row.madden_plpo || '',
        race: row.race || undefined,
        isHOF: row.is_hof === 1,
        height: row.height || undefined,
        weight: row.weight || undefined,
        hometown: row.hometown || undefined,
        homeState: row.state_name || undefined,
        wav: row.wav || undefined,
        ap1: row.ap1 || undefined,
        pb: row.pb || undefined,
        starts: row.starts || undefined
      };

      // Log sample data for first few players to verify height/weight/state loading
      if (this.fullDataCache.size < 3) {
        console.log(`[lookup-service] Sample player #${this.fullDataCache.size + 1}: ${entry.firstName} ${entry.lastName} - college: "${entry.college}", height: ${entry.height}, weight: ${entry.weight}, hometown: "${entry.hometown}", homeState: "${entry.homeState}"`);
      }

      if (row.madden_pid) {
        entriesWithPID++;
        // Build PID -> internalIds lookup (handles duplicates)
        if (!this.pidToInternalIdMap.has(row.madden_pid)) {
          this.pidToInternalIdMap.set(row.madden_pid, []);
        }
        this.pidToInternalIdMap.get(row.madden_pid)!.push(row.id);
      }
      if (entry.plpo) entriesWithPLPO++;
      if (entry.position) entriesWithPosition++;

      // Key by internal ID - every player gets their own entry
      this.fullDataCache.set(row.id, entry);
    }

    console.log(`[lookup-service] Loaded ${this.fullDataCache.size} players from database (${entriesWithPID} with PID, ${entriesWithPLPO} with PLPO, ${entriesWithPosition} with position)`);
  }

  // Fallback CSV loading methods
  private async loadLookupsFromCSV(): Promise<void> {
    const lookupFiles = [
      'position_lookup.csv',
      'team_lookup.csv',
      'college_lookup.csv',
      'state_lookup.csv',
      'archetype_lookup.csv',
      'ALL_PLAYER_LOOKUP.csv'
    ];

    for (const fileName of lookupFiles) {
      await this.loadLookupFile(fileName);
    }

    // After loading ALL_PLAYER_LOOKUP, merge in PIDs from PID_lookup.csv
    await this.mergePIDLookupData();
  }

  // Merge PID data from PID_lookup.csv into fullDataCache
  private async mergePIDLookupData(): Promise<void> {
    try {
      const filePath = this.resolveDataPath('lookups', 'PID_lookup.csv');

      if (!fs.existsSync(filePath)) {
        console.warn('[lookup-service] PID_lookup.csv not found, skipping merge');
        return;
      }

      const csvContent = fs.readFileSync(filePath, 'utf-8');
      const lines = csvContent.trim().split('\n');

      if (lines.length < 2) {
        console.warn('[lookup-service] PID_lookup.csv is empty');
        return;
      }

      console.log(`[lookup-service] Merging PIDs from PID_lookup.csv (${lines.length - 1} entries)`);

      let addedCount = 0;
      let updatedCount = 0;
      let skippedCount = 0;

      // Build a map of existing names (lowercase) to their entries for matching
      const nameToEntryMap = new Map<string, FullDataEntry>();
      this.fullDataCache.forEach((entry) => {
        const fullName = `${entry.firstName} ${entry.lastName}`.toLowerCase().trim();
        const lastFirst = `${entry.lastName}, ${entry.firstName}`.toLowerCase().trim();
        if (!nameToEntryMap.has(fullName)) {
          nameToEntryMap.set(fullName, entry);
        }
        if (!nameToEntryMap.has(lastFirst)) {
          nameToEntryMap.set(lastFirst, entry);
        }
      });

      // Parse PID_lookup.csv (format: PSXP,Player Pic)
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const parts = line.split(',');
        if (parts.length < 2) continue;

        const pid = parseInt(parts[0].trim());
        const playerName = parts[1].trim();

        if (!pid || pid <= 0 || !playerName) continue;

        // Try to find existing entry by name
        const nameLower = playerName.toLowerCase();
        const existingEntry = nameToEntryMap.get(nameLower);

        if (existingEntry) {
          // Update existing entry with PID if it doesn't have one
          if (!existingEntry.pid || existingEntry.pid === 0) {
            existingEntry.pid = pid;
            // Update the pidToInternalIdMap
            if (!this.pidToInternalIdMap.has(pid)) {
              this.pidToInternalIdMap.set(pid, []);
            }
            this.pidToInternalIdMap.get(pid)!.push(existingEntry.internalId);
            updatedCount++;
          } else {
            skippedCount++;
          }
        } else {
          // Add new entry for player only in PID_lookup
          const newInternalId = 100000 + i; // Use high IDs to avoid conflicts

          // Parse name - could be "First Last" or "First Last (R)" for rookies
          const cleanName = playerName.replace(/\s*\(R\)\s*$/, '').trim();
          const nameParts = cleanName.split(' ');
          const firstName = nameParts[0] || '';
          const lastName = nameParts.slice(1).join(' ') || '';

          const newEntry: FullDataEntry = {
            internalId: newInternalId,
            lastName: lastName,
            firstName: firstName,
            college: '',
            round: '',
            pick: '',
            draftClass: '',
            position: '',
            pid: pid,
            pam: '',
            commID: '',
            presID: '',
            plpo: ''
          };

          this.fullDataCache.set(newInternalId, newEntry);
          if (!this.pidToInternalIdMap.has(pid)) {
            this.pidToInternalIdMap.set(pid, []);
          }
          this.pidToInternalIdMap.get(pid)!.push(newInternalId);
          addedCount++;
        }
      }

      console.log(`[lookup-service] PID merge complete: ${updatedCount} updated, ${addedCount} added, ${skippedCount} already had PID`);
      console.log(`[lookup-service] Total entries in fullDataCache: ${this.fullDataCache.size}`);
    } catch (error) {
      console.error('[lookup-service] Error merging PID_lookup.csv:', error);
    }
  }

  private async loadLookupFile(fileName: string): Promise<void> {
    try {
      // Special handling for PAM_lookup.csv
      if (fileName === 'PAM_lookup.csv') {
        await this.loadPAMLookupFile(fileName);
        return;
      }

      // Special handling for Coach lookup files
      if (fileName === 'Coach_lookup.csv' || fileName === 'CoachPAM_lookup.csv') {
        await this.loadCoachLookupFile(fileName);
        return;
      }

      // Special handling for ALL_PLAYER_LOOKUP.csv (the ONE source for all player data)
      if (fileName === 'ALL_PLAYER_LOOKUP.csv') {
        await this.loadFullDataLookupFile(fileName);
        return;
      }

      const filePath = this.resolveDataPath('lookups', fileName);
      console.log(`[lookup-service] Loading CSV file: ${filePath}`);

      if (!fs.existsSync(filePath)) {
        console.warn(`[lookup-service] Lookup file not found: ${filePath}`);
        return;
      }

      const csvContent = fs.readFileSync(filePath, 'utf-8');
      const lines = csvContent.trim().split('\n');
      console.log(`[lookup-service] CSV ${fileName} has ${lines.length} lines`);

      if (lines.length < 2) {
        console.warn(`[lookup-service] Invalid lookup file format: ${fileName}`);
        return;
      }

      // Initialize maps
      this.cache[fileName] = new Map<number, string>();
      this.reverseCache[fileName] = new Map<string, number>();

      // Parse data rows
      let parsedCount = 0;
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const [idStr, name] = line.split(',');
        const id = parseInt(idStr);

        if (!isNaN(id) && name) {
          const cleanName = name.replace(/^"(.*)"$/, '$1');
          this.cache[fileName].set(id, cleanName);
          this.reverseCache[fileName].set(cleanName, id);
          parsedCount++;
        }
      }

      console.log(`[lookup-service] Loaded ${this.cache[fileName].size} entries from ${fileName} (parsed ${parsedCount} valid rows)`);
    } catch (error) {
      console.error(`Error loading lookup file ${fileName}:`, error);
    }
  }

  private async loadPAMLookupFile(fileName: string): Promise<void> {
    try {
      const filePath = this.resolveDataPath('lookups', fileName);

      if (!fs.existsSync(filePath)) {
        console.warn(`PAM lookup file not found: ${filePath}`);
        return;
      }

      const csvContent = fs.readFileSync(filePath, 'utf-8');
      const lines = csvContent.trim().split('\n');

      if (lines.length < 2) {
        console.warn(`Invalid PAM lookup file format: ${fileName}`);
        return;
      }

      this.pamCache.clear();
      this.pamByPIDCache.clear();

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const parts = line.split(',');
        if (parts.length < 3) continue;

        const pamEntry: PAMEntry = {
          pam: parts[0].trim(),
          pid: parseInt(parts[1].trim()),
          type: parts[2].trim() as 'generic' | 'player' | 'legend',
          ethnicity: parts[3]?.trim(),
          generation: parts[4] ? parseInt(parts[4].trim()) : undefined,
          faceShape: parts[5]?.trim(),
          description: parts[6]?.trim()
        };

        this.pamCache.set(pamEntry.pam, pamEntry);

        if (!this.pamByPIDCache.has(pamEntry.pid)) {
          this.pamByPIDCache.set(pamEntry.pid, []);
        }
        this.pamByPIDCache.get(pamEntry.pid)!.push(pamEntry);
      }

      console.log(`Loaded ${this.pamCache.size} PAM entries from ${fileName}`);
    } catch (error) {
      console.error(`Error loading PAM lookup file ${fileName}:`, error);
    }
  }

  private async loadCoachLookupFile(fileName: string): Promise<void> {
    try {
      const filePath = this.resolveDataPath('lookups', fileName);

      if (!fs.existsSync(filePath)) {
        console.warn(`Coach lookup file not found: ${filePath}`);
        return;
      }

      const csvContent = fs.readFileSync(filePath, 'utf-8');
      const lines = csvContent.trim().split('\n');

      if (lines.length < 1) {
        console.warn(`Invalid Coach lookup file format: ${fileName}`);
        return;
      }

      this.coachCache.clear();
      this.coachByPAMCache.clear();

      let pamOnlyIndex = -1; // Use negative indices for PAM-only coaches
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const parts = line.split(',');
        if (parts.length < 3) continue; // Need at least lastName, firstName, pam

        const lastName = parts[0].trim();
        const firstName = parts[1].trim();
        const pam = parts[2].trim();
        const pidStr = parts.length > 3 ? parts[3].trim() : '';
        const pid = pidStr ? parseInt(pidStr) : NaN;

        // Skip entries with no PAM and no PID (owners without portraits)
        if (!pam && isNaN(pid)) continue;

        const displayName = firstName && lastName ? `${firstName} ${lastName}` : (firstName || lastName || (isNaN(pid) ? `Coach (PAM)` : `Coach ${pid}`));

        const coachEntry: CoachLookupEntry = {
          lastName,
          firstName,
          pam,
          pid: isNaN(pid) ? null : pid, // null for PAM-only coaches
          displayName
        };

        // Use PID as key if available, otherwise use negative index for PAM-only
        if (!isNaN(pid)) {
          this.coachCache.set(pid, coachEntry);
        } else if (pam) {
          // PAM-only coach - use negative index as key
          this.coachCache.set(pamOnlyIndex, coachEntry);
          pamOnlyIndex--;
        }

        if (pam) {
          this.coachByPAMCache.set(pam, coachEntry);
        }
      }

      console.log(`Loaded ${this.coachCache.size} coach entries from ${fileName}`);
      await this.loadCoachPortraitPAMs();

    } catch (error) {
      console.error(`Error loading Coach lookup file ${fileName}:`, error);
    }
  }

  private async loadCoachPortraitPAMs(): Promise<void> {
    try {
      const portraitsDir = app.isPackaged
        ? path.join(process.resourcesPath, 'app', 'data', 'Coach info', 'Coach and Owners')
        : path.join(__dirname, '../../data/Coach info/Coach and Owners');

      if (!fs.existsSync(portraitsDir)) {
        console.warn(`Coach portraits directory not found: ${portraitsDir}`);
        return;
      }

      const files = fs.readdirSync(portraitsDir);
      let addedCount = 0;

      for (const file of files) {
        const match = file.match(/^mapo_coachportraits_(.+)\.png$/);
        if (!match) continue;

        const namePart = match[1];
        const nameMatch = namePart.match(/^([A-Z][a-z]+)([A-Z][a-z]+)$/);
        if (!nameMatch) continue;

        const lastName = nameMatch[1];
        const firstName = nameMatch[2];
        const displayName = `${firstName} ${lastName}`;
        const pamValue = `mapo_coachportraits_${namePart}`;

        if (!this.coachByPAMCache.has(pamValue)) {
          const pseudoPID = 1000000 + addedCount;

          const coachEntry: CoachLookupEntry = {
            lastName,
            firstName,
            pam: pamValue,
            pid: pseudoPID,
            displayName
          };

          this.coachCache.set(pseudoPID, coachEntry);
          this.coachByPAMCache.set(pamValue, coachEntry);
          addedCount++;
        }
      }

      console.log(`Added ${addedCount} coach PAM entries from portrait files`);
    } catch (error) {
      console.error('Error loading coach portrait PAMs:', error);
    }
  }

  private async loadFullDataLookupFile(fileName: string): Promise<void> {
    try {
      const filePath = this.resolveDataPath('lookups', fileName);

      if (!fs.existsSync(filePath)) {
        console.warn(`FullData lookup file not found: ${filePath}`);
        return;
      }

      const csvContent = fs.readFileSync(filePath, 'utf-8');
      const lines = csvContent.trim().split('\n');

      if (lines.length < 2) {
        console.warn(`Invalid FullData lookup file format: ${fileName}`);
        return;
      }

      this.fullDataCache.clear();
      this.pidToInternalIdMap.clear();
      console.log(`[lookup-service] Parsing ${lines.length - 1} lines from ${fileName}`);

      let entriesWithPLPO = 0;
      let entriesWithPID = 0;
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const parts = this.parseCSVLine(line);
        if (parts.length < 12) {
          if (i < 5) console.log(`[lookup-service] Line ${i}: Only ${parts.length} parts, skipping`);
          continue;
        }

        // Use line number as internal ID for CSV fallback
        const internalId = i;
        const pid = parseInt(parts[8].trim()) || 0;
        const careerFrom = parts.length > 14 ? parseInt(parts[14].trim()) || undefined : undefined;
        const careerTo = parts.length > 15 ? parseInt(parts[15].trim()) || undefined : undefined;

        // Parse height (column 12), weight (column 13), homeState (column 22)
        const height = parts.length > 12 ? parseInt(parts[12].trim()) || undefined : undefined;
        const weight = parts.length > 13 ? parseInt(parts[13].trim()) || undefined : undefined;
        const homeState = parts.length > 22 ? parts[22].trim() || undefined : undefined;
        const race = parts.length > 21 ? parseInt(parts[21].trim()) || undefined : undefined;
        const isHOF = parts.length > 25 ? parts[25].trim().toUpperCase() === 'TRUE' : false;
        const wav = parts.length > 19 ? parseInt(parts[19].trim()) || undefined : undefined;
        const ap1 = parts.length > 16 ? parseInt(parts[16].trim()) || undefined : undefined;
        const pb = parts.length > 17 ? parseInt(parts[17].trim()) || undefined : undefined;
        const starts = parts.length > 18 ? parseInt(parts[18].trim()) || undefined : undefined;

        const entry: FullDataEntry = {
          internalId: internalId,
          lastName: parts[0].trim(),
          firstName: parts[1].trim(),
          college: parts[2].trim(),
          round: parts[3].trim(),
          pick: parts[4].trim(),
          draftClass: parts[5].trim(),
          careerFrom: careerFrom,
          careerTo: careerTo,
          position: parts[6].trim(),
          pid: pid,
          pam: parts[9].trim(),
          commID: parts[10].trim(),
          presID: parts[10].trim(),
          plpo: parts[11].trim(),
          height: height,
          weight: weight,
          homeState: homeState,
          race: race,
          isHOF: isHOF,
          wav: wav,
          ap1: ap1,
          pb: pb,
          starts: starts
        };

        if (i <= 3) {
          console.log(`[lookup-service] CSV Line ${i}: ${entry.firstName} ${entry.lastName} - college: "${entry.college}", height: ${entry.height}, weight: ${entry.weight}, homeState: "${entry.homeState}"`);
        }

        if (entry.plpo) entriesWithPLPO++;
        if (pid > 0) {
          entriesWithPID++;
          // Build PID -> internalIds lookup
          if (!this.pidToInternalIdMap.has(pid)) {
            this.pidToInternalIdMap.set(pid, []);
          }
          this.pidToInternalIdMap.get(pid)!.push(internalId);
        }

        // Key by internal ID (line number) - every player gets their own entry
        this.fullDataCache.set(internalId, entry);
      }

      console.log(`[lookup-service] Loaded ${this.fullDataCache.size} FullData entries from ${fileName} (${entriesWithPID} with PID, ${entriesWithPLPO} with PLPO)`);
    } catch (error) {
      console.error(`Error loading FullData lookup file ${fileName}:`, error);
    }
  }

  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }

    result.push(current);
    return result;
  }

  // ========== NEW DATABASE QUERY METHODS ==========

  // Get player seasons/ratings from database
  public getPlayerSeasons(playerId: number): PlayerSeasonEntry[] {
    if (!this.db) return [];

    const seasons = this.db.prepare(`
      SELECT * FROM player_seasons WHERE player_id = ? ORDER BY year
    `).all(playerId) as any[];

    return seasons.map(row => ({
      playerId: row.player_id,
      year: row.year,
      team: row.team || '',
      jersey: row.jersey || 0,
      age: row.age || 0,
      position: row.position || '',
      archetype: row.archetype || '',
      games: row.games || 0,
      gamesStarted: row.games_started || 0,
      av: row.av || 0,
      devTrait: row.dev_trait || '',
      ratings: {
        // Original field names from database
        POVR: row.POVR, PSPD: row.PSPD, PACC: row.PACC, PSTR: row.PSTR, PAGI: row.PAGI,
        PAWR: row.PAWR, PCTH: row.PCTH, PCAR: row.PCAR, PTHP: row.PTHP, PKPW: row.PKPW,
        PKAC: row.PKAC, PRBK: row.PRBK, PPBK: row.PPBK, PTAK: row.PTAK, PBTK: row.PBTK,
        PJMP: row.PJMP, PINJ: row.PINJ, PSTA: row.PSTA, PTGH: row.PTGH, PTRK: row.PTRK,
        PCOD: row.PCOD, PBCV: row.PBCV, PSTF: row.PSTF, PSPM: row.PSPM, PJUM: row.PJUM,
        PIBL: row.PIBL, PRBP: row.PRBP, PRBF: row.PRBF, PPBP: row.PPBP, PPBF: row.PPBF,
        PLDB: row.PLDB, PBRS: row.PBRS, PTUP: row.PTUP, PPWM: row.PPWM, PFNM: row.PFNM,
        PBSH: row.PBSH, PPUR: row.PPUR, PPRC: row.PPRC, PMCV: row.PMCV, PZCV: row.PZCV,
        PSPC: row.PSPC, PCIT: row.PCIT, PSRR: row.PSRR, PMRR: row.PMRR, PDRR: row.PDRR,
        PHTP: row.PHTP, PPRS: row.PPRS, PREL: row.PREL, PTAS: row.PTAS, PTAM: row.PTAM,
        PTAD: row.PTAD, PPLA: row.PPLA, PTOR: row.PTOR, PKRT: row.PKRT, PLTR: row.PLTR,
        PELU: row.PELU,
        // OVR Calculator field aliases (these are used by OVRWeightsCalculator)
        PLPU: row.PPUR,   // Pursuit (OVR calc) = PPUR (db)
        PLPR: row.PPRC,   // Play Recognition (OVR calc) = PPRC (db)
        PLHT: row.PHTP,   // Hit Power (OVR calc) = PHTP (db)
        PLPM: row.PPWM,   // Power Moves (OVR calc) = PPWM (db)
        PFMS: row.PFNM,   // Finesse Moves (OVR calc) = PFNM (db)
        PBSG: row.PBSH,   // Block Shedding (OVR calc) = PBSH (db)
        // M26 field name aliases (frontend uses these)
        PPWR: row.PTHP,   // Throw Power (M26) = PTHP (old)
        PSTM: row.PSTA,   // Stamina (M26) = PSTA (old)
        PSFA: row.PSTF,   // Stiff Arm (M26) = PSTF (old)
        PSPN: row.PSPM,   // Spin Move (M26) = PSPM (old)
        PJKM: row.PJUM,   // Juke Move (M26) = PJUM (old)
        PIBK: row.PIBL,   // Impact Blocking (M26) = PIBL (old)
        PHIT: row.PHTP,   // Hit Power (M26) = PHTP (old)
        PFMV: row.PFNM,   // Finesse Moves (M26) = PFNM (old)
        PRNS: row.PRBP,   // Run Block Power (M26) = PRBP (old)
        PKPR: row.PKPW    // Kick Power (M26) = PKPW (old)
      }
    }));
  }

  // Get player ratings for a specific year
  public getPlayerRatingsForYear(maddenPid: number, year: number): PlayerSeasonEntry | null {
    if (!this.db) return null;

    // First find the internal player_id from madden_pid
    const appearance = this.db.prepare(`
      SELECT player_id FROM player_appearance WHERE madden_pid = ?
    `).get(maddenPid) as { player_id: number } | undefined;

    if (!appearance) return null;

    const row = this.db.prepare(`
      SELECT * FROM player_seasons WHERE player_id = ? AND year = ?
    `).get(appearance.player_id, year) as any;

    if (!row) return null;

    return {
      playerId: row.player_id,
      year: row.year,
      team: row.team || '',
      jersey: row.jersey || 0,
      age: row.age || 0,
      position: row.position || '',
      archetype: row.archetype || '',
      games: row.games || 0,
      gamesStarted: row.games_started || 0,
      av: row.av || 0,
      devTrait: row.dev_trait || '',
      ratings: {
        // Original field names from database
        POVR: row.POVR, PSPD: row.PSPD, PACC: row.PACC, PSTR: row.PSTR, PAGI: row.PAGI,
        PAWR: row.PAWR, PCTH: row.PCTH, PCAR: row.PCAR, PTHP: row.PTHP, PKPW: row.PKPW,
        PKAC: row.PKAC, PRBK: row.PRBK, PPBK: row.PPBK, PTAK: row.PTAK, PBTK: row.PBTK,
        PJMP: row.PJMP, PINJ: row.PINJ, PSTA: row.PSTA, PTGH: row.PTGH, PTRK: row.PTRK,
        PCOD: row.PCOD, PBCV: row.PBCV, PSTF: row.PSTF, PSPM: row.PSPM, PJUM: row.PJUM,
        PIBL: row.PIBL, PRBP: row.PRBP, PRBF: row.PRBF, PPBP: row.PPBP, PPBF: row.PPBF,
        PLDB: row.PLDB, PBRS: row.PBRS, PTUP: row.PTUP, PPWM: row.PPWM, PFNM: row.PFNM,
        PBSH: row.PBSH, PPUR: row.PPUR, PPRC: row.PPRC, PMCV: row.PMCV, PZCV: row.PZCV,
        PSPC: row.PSPC, PCIT: row.PCIT, PSRR: row.PSRR, PMRR: row.PMRR, PDRR: row.PDRR,
        PHTP: row.PHTP, PPRS: row.PPRS, PREL: row.PREL, PTAS: row.PTAS, PTAM: row.PTAM,
        PTAD: row.PTAD, PPLA: row.PPLA, PTOR: row.PTOR, PKRT: row.PKRT, PLTR: row.PLTR,
        PELU: row.PELU,
        // OVR Calculator field aliases (these are used by OVRWeightsCalculator)
        PLPU: row.PPUR,   // Pursuit (OVR calc) = PPUR (db)
        PLPR: row.PPRC,   // Play Recognition (OVR calc) = PPRC (db)
        PLHT: row.PHTP,   // Hit Power (OVR calc) = PHTP (db)
        PLPM: row.PPWM,   // Power Moves (OVR calc) = PPWM (db)
        PFMS: row.PFNM,   // Finesse Moves (OVR calc) = PFNM (db)
        PBSG: row.PBSH,   // Block Shedding (OVR calc) = PBSH (db)
        // M26 field name aliases (frontend uses these)
        PPWR: row.PTHP,   // Throw Power (M26) = PTHP (old)
        PSTM: row.PSTA,   // Stamina (M26) = PSTA (old)
        PSFA: row.PSTF,   // Stiff Arm (M26) = PSTF (old)
        PSPN: row.PSPM,   // Spin Move (M26) = PSPM (old)
        PJKM: row.PJUM,   // Juke Move (M26) = PJUM (old)
        PIBK: row.PIBL,   // Impact Blocking (M26) = PIBL (old)
        PHIT: row.PHTP,   // Hit Power (M26) = PHTP (old)
        PFMV: row.PFNM,   // Finesse Moves (M26) = PFNM (old)
        PRNS: row.PRBP,   // Run Block Power (M26) = PRBP (old)
        PKPR: row.PKPW    // Kick Power (M26) = PKPW (old)
      }
    };
  }

  // Get years where player has season data in the database
  public getPlayerSeasonYears(internalId: number): number[] {
    if (!this.db) return [];

    const rows = this.db.prepare(`
      SELECT DISTINCT ps.year
      FROM player_seasons ps
      WHERE ps.player_id = ?
      ORDER BY ps.year ASC
    `).all(internalId) as { year: number }[];

    return rows.map(r => r.year);
  }

  // Get player season data by internal player_id (NOT madden_pid)
  // This works for ALL players including roster-only players without PIDs
  public getPlayerSeasonByInternalId(internalId: number, year: number): PlayerSeasonEntry | null {
    console.log(`[lookup-service] getPlayerSeasonByInternalId called: internalId=${internalId}, year=${year}, db=${this.db ? 'READY' : 'NULL'}`);

    if (!this.db) {
      console.log('[lookup-service] Database not initialized!');
      return null;
    }

    const row = this.db.prepare(`
      SELECT * FROM player_seasons WHERE player_id = ? AND year = ?
    `).get(internalId, year) as any;

    console.log(`[lookup-service] Query result:`, row ? `Found team=${row.team}, POVR=${row.POVR}` : 'NO ROW');

    if (!row) return null;

    return {
      playerId: row.player_id,
      year: row.year,
      team: row.team || '',
      jersey: row.jersey || 0,
      age: row.age || 0,
      position: row.position || '',
      archetype: row.archetype || '',
      games: row.games || 0,
      gamesStarted: row.games_started || 0,
      av: row.av || 0,
      devTrait: row.dev_trait || '',
      ratings: {
        POVR: row.POVR, PSPD: row.PSPD, PACC: row.PACC, PSTR: row.PSTR, PAGI: row.PAGI,
        PAWR: row.PAWR, PCTH: row.PCTH, PCAR: row.PCAR, PTHP: row.PTHP, PKPW: row.PKPW,
        PKAC: row.PKAC, PRBK: row.PRBK, PPBK: row.PPBK, PTAK: row.PTAK, PBTK: row.PBTK,
        PJMP: row.PJMP, PINJ: row.PINJ, PSTA: row.PSTA, PTGH: row.PTGH, PTRK: row.PTRK,
        PCOD: row.PCOD, PBCV: row.PBCV, PSTF: row.PSTF, PSPM: row.PSPM, PJUM: row.PJUM,
        PIBL: row.PIBL, PRBP: row.PRBP, PRBF: row.PRBF, PPBP: row.PPBP, PPBF: row.PPBF,
        PLDB: row.PLDB, PBRS: row.PBRS, PTUP: row.PTUP, PPWM: row.PPWM, PFNM: row.PFNM,
        PBSH: row.PBSH, PPUR: row.PPUR, PPRC: row.PPRC, PMCV: row.PMCV, PZCV: row.PZCV,
        PSPC: row.PSPC, PCIT: row.PCIT, PSRR: row.PSRR, PMRR: row.PMRR, PDRR: row.PDRR,
        PHTP: row.PHTP, PPRS: row.PPRS, PREL: row.PREL, PTAS: row.PTAS, PTAM: row.PTAM,
        PTAD: row.PTAD, PPLA: row.PPLA, PTOR: row.PTOR, PKRT: row.PKRT, PLTR: row.PLTR,
        PELU: row.PELU
      }
    };
  }

  // PID-only entries have internalId >= 100000 (created from PID_lookup.csv with no matching player)
  // These should be excluded from normal search results
  private static readonly PID_ONLY_THRESHOLD = 100000;

  // Check if an entry is a PID-only placeholder (not a real player)
  public isPIDOnlyEntry(internalId: number): boolean {
    return internalId >= LookupService.PID_ONLY_THRESHOLD;
  }

  // Search players by name - returns all players matching query
  public searchPlayers(query: string, limit = 50): FullDataEntry[] {
    // Always use cache for search - it has all players loaded with all fields
    const results: FullDataEntry[] = [];
    const lowerQuery = query.toLowerCase().trim();

    // Normalize query: remove punctuation for flexible matching
    // This helps match "O'Connor" with "O Connor" or "OConnor"
    // Also handles "R.J." matching "RJ" and suffixes like "Jr." or "III"
    const normalizeForMatch = (str: string) => str.replace(/[.''\-]/g, '').replace(/\s+/g, ' ').trim();
    const normalizedQuery = normalizeForMatch(lowerQuery);
    const queryParts = lowerQuery.split(/\s+/); // Split by whitespace for multi-word queries
    const normalizedQueryParts = normalizedQuery.split(/\s+/);

    for (const entry of this.fullDataCache.values()) {
      // Skip PID-only entries (these are placeholders, not real players)
      if (entry.internalId >= LookupService.PID_ONLY_THRESHOLD) {
        continue;
      }

      // Skip placeholder entries (blank names, position+jersey patterns like "FS #26")
      if (this.isPlaceholderEntry(entry.firstName, entry.lastName)) {
        continue;
      }

      const firstName = entry.firstName.toLowerCase();
      const lastName = entry.lastName.toLowerCase();
      const fullName = `${firstName} ${lastName}`;

      // Also create normalized versions for flexible matching
      const normalizedFirst = normalizeForMatch(firstName);
      const normalizedLast = normalizeForMatch(lastName);
      const normalizedFullName = `${normalizedFirst} ${normalizedLast}`;

      let matches = false;

      if (queryParts.length === 1) {
        // Single word: check first name OR last name (both original and normalized)
        matches = firstName.includes(lowerQuery) || lastName.includes(lowerQuery) ||
          normalizedFirst.includes(normalizedQuery) || normalizedLast.includes(normalizedQuery);
      } else {
        // Multi-word query: check full name OR all parts must match somewhere
        if (fullName.includes(lowerQuery) || normalizedFullName.includes(normalizedQuery)) {
          matches = true;
        } else {
          // Check if all query parts are found in either first or last name (try both original and normalized)
          matches = queryParts.every(part =>
            firstName.includes(part) || lastName.includes(part)
          ) || normalizedQueryParts.every(part =>
            normalizedFirst.includes(part) || normalizedLast.includes(part)
          );
        }
      }

      if (matches) {
        results.push(entry);
        if (results.length >= limit) break;
      }
    }
    return results;
  }

  // Get players by draft class - returns all players from that draft year
  public getPlayersByDraftClass(draftYear: number): FullDataEntry[] {
    // Always use cache - it has all players with all fields
    return Array.from(this.fullDataCache.values())
      .filter(e => {
        // Skip PID-only entries
        if (e.internalId >= LookupService.PID_ONLY_THRESHOLD) return false;
        // Skip placeholder entries (blank names, position+jersey patterns)
        if (this.isPlaceholderEntry(e.firstName, e.lastName)) return false;
        return e.draftClass === draftYear.toString();
      })
      .sort((a, b) => {
        // Sort by round then pick
        const roundA = parseInt(a.round) || 99;
        const roundB = parseInt(b.round) || 99;
        if (roundA !== roundB) return roundA - roundB;
        const pickA = parseInt(a.pick) || 999;
        const pickB = parseInt(b.pick) || 999;
        return pickA - pickB;
      });
  }

  /**
   * Get players who retired (career ended) within a specific year range
   * Used for free agent backfill - finds recently retired players
   * @param fromYear Start of retirement year range (inclusive)
   * @param toYear End of retirement year range (inclusive)
   */
  public getPlayersRetiredInRange(fromYear: number, toYear: number): FullDataEntry[] {
    return Array.from(this.fullDataCache.values())
      .filter(e => {
        // Skip PID-only entries
        if (e.internalId >= LookupService.PID_ONLY_THRESHOLD) return false;
        // Skip placeholder entries
        if (this.isPlaceholderEntry(e.firstName, e.lastName)) return false;
        // Must have career end year
        if (!e.careerTo) return false;
        // Career ended within the specified range
        return e.careerTo >= fromYear && e.careerTo <= toYear;
      })
      .sort((a, b) => {
        // Sort by career end year (most recent first), then by name
        const yearDiff = (b.careerTo || 0) - (a.careerTo || 0);
        if (yearDiff !== 0) return yearDiff;
        return `${a.lastName}${a.firstName}`.localeCompare(`${b.lastName}${b.firstName}`);
      });
  }

  // Check if using database
  public isUsingDatabase(): boolean {
    return this.db !== null;
  }

  // Convert numeric ID to display name
  public getDisplayName(fileName: string, id: number): string {
    const lookup = this.cache[fileName];
    if (!lookup) {
      console.warn(`Lookup file not found: ${fileName}`);
      return id != null ? String(id) : '';
    }

    return lookup.get(id) || (id != null ? String(id) : '');
  }

  // Convert display name to numeric ID
  public getNumericId(fileName: string, displayName: string): number {
    const lookup = this.reverseCache[fileName];
    if (!lookup) {
      console.warn(`Reverse lookup file not found: ${fileName}`);
      return 0;
    }

    const result = lookup.get(displayName) || 0;

    // DEBUG: Log team lookups for 49ers
    if (fileName === 'team_lookup.csv' && (displayName === '49ers' || displayName.includes('49'))) {
      console.log(`[lookup-service DEBUG] getNumericId('${fileName}', '${displayName}') = ${result}`);
      console.log(`[lookup-service DEBUG] reverseCache has ${lookup.size} entries`);
      console.log(`[lookup-service DEBUG] Sample keys: ${Array.from(lookup.keys()).slice(0, 10).join(', ')}`);
    }

    return result;
  }

  // Get all options for a dropdown
  public getDropdownOptions(fileName: string): any[] {
    // Special handling for ALL_PLAYER_LOOKUP.csv - return full entries with PLPO
    if (fileName === 'ALL_PLAYER_LOOKUP.csv') {
      return this.getFullDataOptions();
    }

    const lookup = this.cache[fileName];
    if (!lookup) {
      console.log(`[lookup-service] getDropdownOptions('${fileName}') - cache not found`);
      return [];
    }

    console.log(`[lookup-service] getDropdownOptions('${fileName}') - cache size: ${lookup.size}`);

    const options: LookupEntry[] = [];
    lookup.forEach((name, id) => {
      // Filter out entries with empty names (some college IDs have no name in the lookup)
      if (name && name.trim()) {
        options.push({ id, name: name.trim() });
      }
    });

    console.log(`[lookup-service] getDropdownOptions('${fileName}') - valid options: ${options.length}`);

    // Sort by name for better UX
    return options.sort((a, b) => a.name.localeCompare(b.name));
  }

  // Get all player options with all fields including PLPO
  public getFullDataOptions(): Array<{id: number, name: string, plpo: string, entry: FullDataEntry}> {
    const options: Array<{id: number, name: string, plpo: string, entry: FullDataEntry}> = [];

    this.fullDataCache.forEach((entry, internalId) => {
      const displayName = `${entry.firstName} ${entry.lastName}`;
      options.push({
        id: internalId, // Use internal ID as the unique identifier
        name: displayName,
        plpo: entry.plpo,
        entry: entry
      });
    });

    return options.sort((a, b) => a.name.localeCompare(b.name));
  }

  // Get PID options - only players with actual PIDs
  public getPIDOptions(): LookupEntry[] {
    const options: LookupEntry[] = [];

    this.fullDataCache.forEach((entry, internalId) => {
      if (entry.pid > 0) { // Only include players with actual PIDs
        const displayName = `${entry.firstName} ${entry.lastName}`;
        options.push({ id: entry.pid, name: displayName });
      }
    });

    return options.sort((a, b) => a.id - b.id);
  }

  // Get player by internal ID
  public getPlayerByInternalId(internalId: number): FullDataEntry | undefined {
    return this.fullDataCache.get(internalId);
  }

  // Position abbreviations that might appear as fake "first names"
  private static readonly POSITION_ABBREVIATIONS = new Set([
    'QB', 'HB', 'FB', 'WR', 'TE', 'LT', 'LG', 'C', 'RG', 'RT',
    'LE', 'RE', 'DT', 'LOLB', 'MLB', 'ROLB', 'CB', 'FS', 'SS', 'K', 'P', 'LS',
    'OL', 'DL', 'LB', 'DB', 'EDGE', 'LEDG', 'REDG', 'SAM', 'MIKE', 'WILL'
  ]);

  // Check if a name looks like a placeholder (position + jersey number)
  private isPlaceholderEntry(firstName: string | undefined, lastName: string | undefined): boolean {
    const fn = (firstName || '').trim().toUpperCase();
    const ln = (lastName || '').trim();

    // Both empty = placeholder
    if (!fn && !ln) return true;

    // Last name is just a number or starts with # = placeholder
    if (/^#?\d+$/.test(ln)) return true;

    // First name is a position abbreviation AND last name is empty or number = placeholder
    if (LookupService.POSITION_ABBREVIATIONS.has(fn) && (!ln || /^#?\d+$/.test(ln))) return true;

    return false;
  }

  // Get all players from the cache (excludes PID-only entries and blank name placeholders)
  public getAllPlayers(): FullDataEntry[] {
    return Array.from(this.fullDataCache.values()).filter(e => {
      // Skip PID-only entries
      if (e.internalId >= LookupService.PID_ONLY_THRESHOLD) return false;
      // Skip placeholder entries (blank names, position+jersey patterns)
      if (this.isPlaceholderEntry(e.firstName, e.lastName)) return false;
      return true;
    });
  }

  // Get player(s) by PID - returns array since PIDs may be duplicated
  public getPlayersByPID(pid: number): FullDataEntry[] {
    const internalIds = this.pidToInternalIdMap.get(pid);
    if (!internalIds) return [];
    return internalIds.map(id => this.fullDataCache.get(id)).filter(e => e !== undefined) as FullDataEntry[];
  }

  // Get race for a PID (returns race from pid_race table, or undefined if not found)
  // This works for ALL PIDs including generic face PIDs
  public getRaceByPID(pid: number): number | undefined {
    console.log(`[LookupService] getRaceByPID called for PID ${pid}, db available: ${!!this.db}`);

    // First try the dedicated pid_race table (has ALL PIDs including generics)
    if (this.db) {
      try {
        // Check if pid_race table exists
        const tableCheck = this.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='pid_race'").get();
        console.log(`[LookupService] pid_race table exists: ${!!tableCheck}`);

        if (tableCheck) {
          const row = this.db.prepare('SELECT race FROM pid_race WHERE pid = ?').get(pid) as { race: number } | undefined;
          console.log(`[LookupService] pid_race query result for PID ${pid}:`, row);
          if (row && row.race) {
            console.log(`[LookupService] Returning race ${row.race} for PID ${pid}`);
            return row.race;
          }
        }
      } catch (e: any) {
        console.error(`[LookupService] Error querying pid_race:`, e.message);
      }
    } else {
      console.log('[LookupService] Database not available!');
    }

    // Fallback to player data (for real players not in pid_race table)
    console.log(`[LookupService] Falling back to player data for PID ${pid}`);
    const players = this.getPlayersByPID(pid);
    if (players.length === 0) {
      console.log(`[LookupService] No player found for PID ${pid}, returning undefined`);
      return undefined;
    }
    console.log(`[LookupService] Found player with race ${players[0].race}`);
    return players[0].race;
  }

  // Get the best matching player by PID for a given year (uses career dates)
  public getPlayerByPIDForYear(pid: number, year: number): FullDataEntry | undefined {
    const players = this.getPlayersByPID(pid);
    if (players.length === 0) return undefined;
    if (players.length === 1) return players[0];

    // Find the player whose career spans the given year
    for (const player of players) {
      const from = player.careerFrom || 0;
      const to = player.careerTo || 9999;
      if (year >= from && year <= to) {
        return player;
      }
    }

    // Fallback to first match if no career match
    return players[0];
  }

  // Check if lookup service is ready
  public isReady(): boolean {
    return Object.keys(this.cache).length > 0;
  }

  // Reload all lookup files (useful for development)
  public async reload(): Promise<void> {
    this.cache = {};
    this.reverseCache = {};
    await this.initializeLookups();
  }

  // Get lookup file info for debugging
  public getLoadedFiles(): string[] {
    return Object.keys(this.cache);
  }

  public getCacheStats(): { [fileName: string]: number } {
    const stats: { [fileName: string]: number } = {};
    Object.keys(this.cache).forEach(fileName => {
      stats[fileName] = this.cache[fileName].size;
    });
    return stats;
  }

  // PAM-specific lookup methods
  public getPAMEntry(pamName: string): PAMEntry | undefined {
    return this.pamCache.get(pamName);
  }

  public getPAMsByPID(pid: number): PAMEntry[] {
    return this.pamByPIDCache.get(pid) || [];
  }

  public getAllPAMs(): PAMEntry[] {
    return Array.from(this.pamCache.values());
  }

  public getPAMsByEthnicity(ethnicity: string): PAMEntry[] {
    return Array.from(this.pamCache.values()).filter(pam => pam.ethnicity === ethnicity);
  }

  public getPAMsByGeneration(generation: number): PAMEntry[] {
    return Array.from(this.pamCache.values()).filter(pam => pam.generation === generation);
  }

  public searchPAMs(query: string): PAMEntry[] {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.pamCache.values()).filter(pam =>
      pam.pam.toLowerCase().includes(lowerQuery) ||
      pam.description?.toLowerCase().includes(lowerQuery)
    );
  }

  public getPAMOptions(): Array<{name: string, value: string, metadata: PAMEntry}> {
    return Array.from(this.pamCache.values()).map(pam => ({
      name: pam.description || pam.pam,
      value: pam.pam,
      metadata: pam
    }));
  }

  // Coach lookup methods
  public getCoachByPID(pid: number): CoachLookupEntry | undefined {
    return this.coachCache.get(pid);
  }

  public getCoachByPAM(pam: string): CoachLookupEntry | undefined {
    return this.coachByPAMCache.get(pam);
  }

  public getAllCoaches(): CoachLookupEntry[] {
    return Array.from(this.coachCache.values());
  }

  public getCoachPAMOptions(): Array<{name: string, value: string, pid: number}> {
    return Array.from(this.coachCache.values())
      .filter(coach => coach.pam) // Only coaches with PAM
      .map(coach => ({
        name: coach.displayName,
        value: coach.pam,
        pid: coach.pid
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  public getCoachPIDFromPAM(pam: string): number | undefined {
    return this.coachByPAMCache.get(pam)?.pid;
  }

  public getCoachPAMFromPID(pid: number): string | undefined {
    return this.coachCache.get(pid)?.pam;
  }

  // Find player by name and year (for saving bio data from roster editor)
  // Matches by name AND checks if the year falls within the player's career span
  // This allows editing a player in any year of their career, not just their draft year
  public findPlayerByNameAndYear(firstName: string, lastName: string, year: number): FullDataEntry | null {
    const normalizedFirst = firstName.toLowerCase().trim();
    const normalizedLast = lastName.toLowerCase().trim();

    // First pass: look for exact name match where year is within career span
    for (const [id, entry] of this.fullDataCache) {
      if (entry.firstName.toLowerCase() === normalizedFirst &&
          entry.lastName.toLowerCase() === normalizedLast) {
        // Check if year is within player's career span
        const careerFrom = parseInt(entry.careerFrom) || 0;
        const careerTo = parseInt(entry.careerTo) || 9999;
        const draftClass = parseInt(entry.draftClass) || 0;

        // Match if: year equals draft class, OR year is within career span
        if (draftClass === year || (year >= careerFrom && year <= careerTo)) {
          return entry;
        }
      }
    }

    // Second pass: if no career match, try exact name match with draft class
    // (for players where we might not have career span data)
    for (const [id, entry] of this.fullDataCache) {
      if (entry.firstName.toLowerCase() === normalizedFirst &&
          entry.lastName.toLowerCase() === normalizedLast &&
          entry.draftClass === String(year)) {
        return entry;
      }
    }

    // Third pass: just match by name (if only one player with that name)
    const nameMatches: FullDataEntry[] = [];
    for (const [id, entry] of this.fullDataCache) {
      if (entry.firstName.toLowerCase() === normalizedFirst &&
          entry.lastName.toLowerCase() === normalizedLast) {
        nameMatches.push(entry);
      }
    }
    if (nameMatches.length === 1) {
      console.log(`[LookupService] findPlayerByNameAndYear: Found unique name match for ${firstName} ${lastName} (year ${year} outside career span)`);
      return nameMatches[0];
    }

    return null;
  }

  // Normalize a name for matching: lowercase, remove suffixes, extra spaces, punctuation
  private normalizeName(name: string): string {
    if (!name) return '';
    return name
      .toLowerCase()
      .trim()
      // Remove common suffixes
      .replace(/\s+(jr\.?|sr\.?|ii|iii|iv|v)$/i, '')
      // Remove periods and extra spaces
      .replace(/\./g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Find player by name who was active during a given season year (career span includes the year)
  // For historical/custom rosters, we prioritize matching by name over strict career span checks
  public findPlayerByNameActiveInYear(firstName: string, lastName: string, seasonYear: number): FullDataEntry | null {
    const normalizedFirst = this.normalizeName(firstName);
    const normalizedLast = this.normalizeName(lastName);

    let bestMatch: FullDataEntry | null = null;
    let bestMatchScore = 0; // Higher is better: 2 = within career, 1 = name match only

    // First pass: exact match after normalization
    for (const [id, entry] of this.fullDataCache) {
      const entryFirst = this.normalizeName(entry.firstName);
      const entryLast = this.normalizeName(entry.lastName);

      if (entryFirst === normalizedFirst && entryLast === normalizedLast) {
        // Check if career span includes this year
        const from = entry.careerFrom || 0;
        const to = entry.careerTo || 9999;
        const withinCareer = seasonYear >= from && seasonYear <= to;

        if (withinCareer) {
          // Perfect match - within career span
          return entry;
        } else if (bestMatchScore < 1) {
          // Name matches but outside career span - keep as fallback
          bestMatch = entry;
          bestMatchScore = 1;
        }
      }
    }

    // Second pass: try matching with first initial only (e.g., "D. McNabb" vs "Donovan McNabb")
    if (normalizedFirst.length === 1) {
      for (const [id, entry] of this.fullDataCache) {
        const entryFirst = this.normalizeName(entry.firstName);
        const entryLast = this.normalizeName(entry.lastName);

        if (entryFirst.startsWith(normalizedFirst) && entryLast === normalizedLast) {
          const from = entry.careerFrom || 0;
          const to = entry.careerTo || 9999;
          const withinCareer = seasonYear >= from && seasonYear <= to;

          if (withinCareer) {
            return entry;
          } else if (bestMatchScore < 1) {
            bestMatch = entry;
            bestMatchScore = 1;
          }
        }
      }
    }

    // Return best match even if outside career span (for custom/historical rosters)
    if (bestMatch) {
      console.log(`[lookup-service] Name match for "${firstName} ${lastName}" found but outside career span (year ${seasonYear}, career ${bestMatch.careerFrom}-${bestMatch.careerTo})`);
    }
    return bestMatch;
  }

  // Look up a coach by name (for retro editor - check if coach has a portrait in game)
  public getCoachByName(lastName: string, firstName: string): CoachLookupEntry | undefined {
    const lastNameLower = lastName.toLowerCase();
    const firstNameLower = firstName.toLowerCase();

    // Search through all coaches for a match
    for (const coach of this.coachCache.values()) {
      if (coach.lastName.toLowerCase() === lastNameLower &&
          coach.firstName.toLowerCase() === firstNameLower) {
        return coach;
      }
    }
    return undefined;
  }

  // ========== ROSTER GENERATOR METHODS ==========

  // Get all player seasons for a specific year (replaces ROSTER_lookup.csv loading)
  // Returns COMPLETE player data from database - bio, season stats, ratings, appearance
  public getAllPlayerSeasonsForYear(year: number): Array<{
    playerId: number;
    firstName: string;
    lastName: string;
    team: string;
    jersey: number;
    age: number;
    position: string;
    archetype: string;
    games: number;
    gamesStarted: number;
    av: number;
    devTrait: string;
    // Appearance IDs
    maddenPid: number;
    maddenPam: string;
    maddenPlpo: string;
    maddenCommid: string;
    // Extended appearance fields (set by user edits)
    maddenPghe?: number;
    maddenPfcg?: string;
    maddenGpan?: string;
    maddenGslp?: number;
    maddenCpvf?: number;
    maddenSkinTone?: number;
    isGenericFace?: boolean;
    // Bio data
    college: string;
    race: number | null;
    height: number | null;
    weight: number | null;
    hometown: string;
    homeState: string;
    // Draft info
    draftClass: number | null;
    draftRound: string;
    draftPick: number | null;
    // Career info
    careerFrom: number | null;
    careerTo: number | null;
    isHof: boolean;
    // All ratings
    ratings: { [key: string]: number };
  }> {
    if (!this.db) return [];

    const rows = this.db.prepare(`
      SELECT
        ps.*,
        p.first_name, p.last_name, p.race, p.height, p.weight,
        p.hometown, p.home_state_name,
        p.draft_class, p.draft_round, p.draft_pick,
        p.career_from, p.career_to, p.is_hof,
        COALESCE(p.college_name, c.name) as college_name,
        pa.madden_pid, pa.madden_pam, pa.madden_plpo, pa.madden_commid
      FROM player_seasons ps
      JOIN players p ON p.id = ps.player_id
      LEFT JOIN colleges c ON c.id = p.college_id
      LEFT JOIN player_appearance pa ON pa.player_id = p.id
      WHERE ps.year = ?
    `).all(year) as any[];

    return rows.map(row => ({
      playerId: row.player_id,
      firstName: row.first_name,
      lastName: row.last_name,
      team: row.team || '',
      jersey: row.jersey || 0,
      age: row.age || 0,
      position: row.position || '',
      archetype: row.archetype || '',
      games: row.games || 0,
      gamesStarted: row.games_started || 0,
      av: row.av || 0,
      devTrait: row.dev_trait || '',
      // Appearance IDs
      maddenPid: row.madden_pid || 0,
      maddenPam: row.madden_pam || '',
      maddenPlpo: row.madden_plpo || '',
      maddenCommid: row.madden_commid || '',
      // Bio data
      college: row.college_name || '',
      race: row.race,
      height: row.height,
      weight: row.weight,
      hometown: row.hometown || '',
      homeState: row.home_state_name || '',
      // Draft info
      draftClass: row.draft_class,
      draftRound: row.draft_round || '',
      draftPick: row.draft_pick,
      // Career info
      careerFrom: row.career_from,
      careerTo: row.career_to,
      isHof: row.is_hof === 1,
      // All ratings
      ratings: {
        POVR: row.POVR, PSPD: row.PSPD, PACC: row.PACC, PSTR: row.PSTR, PAGI: row.PAGI,
        PAWR: row.PAWR, PCTH: row.PCTH, PCAR: row.PCAR, PTHP: row.PTHP, PKPW: row.PKPW,
        PKAC: row.PKAC, PRBK: row.PRBK, PPBK: row.PPBK, PTAK: row.PTAK, PBTK: row.PBTK,
        PJMP: row.PJMP, PINJ: row.PINJ, PSTA: row.PSTA, PTGH: row.PTGH, PTRK: row.PTRK,
        PCOD: row.PCOD, PBCV: row.PBCV, PSTF: row.PSTF, PSPM: row.PSPM, PJUM: row.PJUM,
        PIBL: row.PIBL, PRBP: row.PRBP, PRBF: row.PRBF, PPBP: row.PPBP, PPBF: row.PPBF,
        PLDB: row.PLDB, PBRS: row.PBRS, PTUP: row.PTUP, PPWM: row.PPWM, PFNM: row.PFNM,
        PBSH: row.PBSH, PPUR: row.PPUR, PPRC: row.PPRC, PMCV: row.PMCV, PZCV: row.PZCV,
        PSPC: row.PSPC, PCIT: row.PCIT, PSRR: row.PSRR, PMRR: row.PMRR, PDRR: row.PDRR,
        PHTP: row.PHTP, PPRS: row.PPRS, PREL: row.PREL, PTAS: row.PTAS, PTAM: row.PTAM,
        PTAD: row.PTAD, PPLA: row.PPLA, PTOR: row.PTOR, PKRT: row.PKRT,
        // M26 field aliases
        PLTR: row.PLTR, PELU: row.PELU, PLSA: row.PLSA, PLSM: row.PLSM, PLJM: row.PLJM,
        PLIB: row.PLIB, PLBK: row.PLBK, PLPM: row.PLPM, PFMS: row.PFMS, PBSG: row.PBSG,
        PLPU: row.PLPU, PLPR: row.PLPR, PLMC: row.PLMC, PLZC: row.PLZC, PLSC: row.PLSC,
        PLCI: row.PLCI, SRRN: row.SRRN, PLHT: row.PLHT, PLPE: row.PLPE, PLRL: row.PLRL,
        PBSK: row.PBSK, PPBS: row.PPBS, PRBS: row.PRBS
      }
    }));
  }

  // Get available years that have roster data
  public getAvailableRosterYears(): number[] {
    if (!this.db) return [];

    const rows = this.db.prepare(`
      SELECT DISTINCT year FROM player_seasons ORDER BY year
    `).all() as { year: number }[];

    return rows.map(r => r.year);
  }

  // Get unique first names from all players
  public getUniqueFirstNames(): string[] {
    if (!this.db) {
      const names = new Set<string>();
      this.fullDataCache.forEach(entry => {
        if (entry.firstName) names.add(entry.firstName);
      });
      return Array.from(names).sort();
    }

    const rows = this.db.prepare(`
      SELECT DISTINCT first_name FROM players WHERE first_name IS NOT NULL AND first_name != '' ORDER BY first_name
    `).all() as { first_name: string }[];

    return rows.map(r => r.first_name);
  }

  // Get unique last names from all players
  public getUniqueLastNames(): string[] {
    if (!this.db) {
      const names = new Set<string>();
      this.fullDataCache.forEach(entry => {
        if (entry.lastName) names.add(entry.lastName);
      });
      return Array.from(names).sort();
    }

    const rows = this.db.prepare(`
      SELECT DISTINCT last_name FROM players WHERE last_name IS NOT NULL AND last_name != '' ORDER BY last_name
    `).all() as { last_name: string }[];

    return rows.map(r => r.last_name);
  }

  // Get the year range available in the database
  public getRosterYearRange(): { minYear: number; maxYear: number } | null {
    if (!this.db) return null;

    const row = this.db.prepare(`
      SELECT MIN(year) as minYear, MAX(year) as maxYear FROM player_seasons
    `).get() as { minYear: number; maxYear: number } | undefined;

    if (!row || !row.minYear || !row.maxYear) return null;
    return { minYear: row.minYear, maxYear: row.maxYear };
  }

  // ========== COMMENTARY ID METHODS ==========

  /**
   * Load commentary lookup data from CSV
   * Maps last names to in-game commentary IDs
   */
  private async loadCommentaryLookup(): Promise<void> {
    try {
      const filePath = this.resolveDataPath('lookups', 'commentary_lookup.csv');
      if (!fs.existsSync(filePath)) {
        console.warn('[lookup-service] commentary_lookup.csv not found');
        return;
      }

      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n').filter(line => line.trim());

      // Skip header
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Parse CSV line (handle quoted names)
        let id: number;
        let name: string;

        if (line.startsWith('"') || line.includes(',"')) {
          // Handle quoted values
          const match = line.match(/^(\d+),(.+)$/);
          if (match) {
            id = parseInt(match[1]);
            name = match[2].replace(/^"|"$/g, '').trim();
          } else {
            continue;
          }
        } else {
          const parts = line.split(',');
          if (parts.length < 2) continue;
          id = parseInt(parts[0]);
          name = parts.slice(1).join(',').trim();
        }

        if (!isNaN(id) && name) {
          this.commentaryCache.set(name.toLowerCase(), id);
        }
      }

      console.log(`[lookup-service] Loaded ${this.commentaryCache.size} commentary name mappings`);

      // Debug: log a few samples
      const samples = Array.from(this.commentaryCache.entries()).slice(0, 5);
      console.log('[lookup-service] Sample commentary entries:', samples);
    } catch (error) {
      console.error('[lookup-service] Error loading commentary lookup:', error);
    }
  }

  /**
   * Get commentary ID for a last name
   * Tries exact match first, then strips suffixes (Jr., II, etc.)
   * @param lastName - Player's last name
   * @returns Commentary ID or null if not found
   */
  public getCommentaryId(lastName: string): number | null {
    if (!lastName) return null;

    const normalizedName = lastName.toLowerCase().trim();

    // Debug: log cache size on first call
    if (this.commentaryCache.size === 0) {
      console.warn('[lookup-service] getCommentaryId called but commentaryCache is EMPTY!');
    }

    // Try exact match first (handles "Smith Jr." if it exists in data)
    let id = this.commentaryCache.get(normalizedName);
    if (id !== undefined) return id;

    // Try stripping common suffixes
    const suffixPattern = /\s+(jr\.?|sr\.?|ii|iii|iv|v)$/i;
    if (suffixPattern.test(normalizedName)) {
      const baseName = normalizedName.replace(suffixPattern, '').trim();
      id = this.commentaryCache.get(baseName);
      if (id !== undefined) return id;
    }

    return null;
  }

  /**
   * Get all commentary entries (for debugging/display)
   */
  public getAllCommentaryEntries(): Array<{ name: string; id: number }> {
    return Array.from(this.commentaryCache.entries()).map(([name, id]) => ({
      name,
      id
    }));
  }

  // ========== BUNDLED HIDDEN PLAYERS ==========

  /**
   * Check if a player is in the bundled hidden list
   * These are players hidden by the developer, not by the user
   * @param playerId The internal player ID
   * @returns true if player is in bundled hidden list
   */
  public isBundledHiddenPlayer(playerId: number): boolean {
    if (!this.db) return false;
    try {
      // Check if the bundled_hidden_players table exists
      const tableExists = this.db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='bundled_hidden_players'"
      ).get();
      if (!tableExists) return false;

      const row = this.db.prepare(
        'SELECT 1 FROM bundled_hidden_players WHERE player_id = ?'
      ).get(playerId);
      return !!row;
    } catch (e) {
      // Table may not exist in older database versions
      return false;
    }
  }

  /**
   * Get all bundled hidden player IDs
   * @returns Array of player IDs that are hidden in the bundled database
   */
  public getBundledHiddenPlayers(): number[] {
    if (!this.db) return [];
    try {
      const tableExists = this.db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='bundled_hidden_players'"
      ).get();
      if (!tableExists) return [];

      const rows = this.db.prepare(
        'SELECT player_id FROM bundled_hidden_players'
      ).all() as { player_id: number }[];
      return rows.map(r => r.player_id);
    } catch (e) {
      return [];
    }
  }

  // ========== BUNDLED DEVELOPER PORTRAITS ==========

  /**
   * Get bundled developer portrait PID for a player
   * Developer portraits use PIDs in range 11000-11999
   * @param playerId Internal player ID
   * @returns PID if player has bundled developer portrait, null otherwise
   */
  public getBundledDeveloperPortrait(playerId: number): number | null {
    if (!this.db) return null;
    try {
      const tableExists = this.db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='bundled_developer_portraits'"
      ).get();
      if (!tableExists) return null;

      const row = this.db.prepare(
        'SELECT pid FROM bundled_developer_portraits WHERE player_id = ?'
      ).get(playerId) as { pid: number } | undefined;
      return row?.pid ?? null;
    } catch (e) {
      return null;
    }
  }

  /**
   * Get all bundled developer portraits
   * @returns Array of {playerId, pid, playerName}
   */
  public getAllBundledDeveloperPortraits(): { playerId: number; pid: number; playerName: string | null }[] {
    if (!this.db) return [];
    try {
      const tableExists = this.db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='bundled_developer_portraits'"
      ).get();
      if (!tableExists) return [];

      const rows = this.db.prepare(
        'SELECT player_id, pid, player_name FROM bundled_developer_portraits'
      ).all() as { player_id: number; pid: number; player_name: string | null }[];
      return rows.map(r => ({
        playerId: r.player_id,
        pid: r.pid,
        playerName: r.player_name
      }));
    } catch (e) {
      return [];
    }
  }

  /**
   * Check if a player has a bundled developer portrait
   * @param playerId Internal player ID
   * @returns true if player has bundled developer portrait
   */
  public hasBundledDeveloperPortrait(playerId: number): boolean {
    return this.getBundledDeveloperPortrait(playerId) !== null;
  }

  // ========== BUNDLED CUSTOM PORTRAITS ==========

  /**
   * Get bundled custom portrait by PID
   * Custom portraits use PIDs in range 12000+
   * @param pid Portrait ID
   * @returns Portrait data with image_data blob, or null
   */
  public getBundledCustomPortrait(pid: number): { pid: number; playerName: string | null; imageData: Buffer } | null {
    if (!this.db) {
      console.log('[LookupService] getBundledCustomPortrait: Database not initialized');
      return null;
    }
    try {
      const tableExists = this.db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='bundled_custom_portraits'"
      ).get();
      if (!tableExists) {
        console.log('[LookupService] getBundledCustomPortrait: bundled_custom_portraits table does not exist');
        return null;
      }

      const row = this.db.prepare(
        'SELECT pid, player_name, image_data FROM bundled_custom_portraits WHERE pid = ?'
      ).get(pid) as { pid: number; player_name: string | null; image_data: Buffer } | undefined;

      if (!row) {
        console.log(`[LookupService] getBundledCustomPortrait: No row found for PID ${pid}`);
        return null;
      }

      console.log(`[LookupService] getBundledCustomPortrait: Found portrait for PID ${pid}, imageData size: ${row.image_data?.length || 0}`);
      return {
        pid: row.pid,
        playerName: row.player_name,
        imageData: row.image_data
      };
    } catch (e) {
      console.error('[LookupService] Error getting bundled custom portrait:', e);
      return null;
    }
  }

  /**
   * Get all bundled custom portraits (metadata only, no image data)
   * @returns Array of {pid, playerName}
   */
  public getAllBundledCustomPortraits(): { pid: number; playerName: string | null }[] {
    if (!this.db) return [];
    try {
      const tableExists = this.db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='bundled_custom_portraits'"
      ).get();
      if (!tableExists) return [];

      const rows = this.db.prepare(
        'SELECT pid, player_name FROM bundled_custom_portraits ORDER BY pid'
      ).all() as { pid: number; player_name: string | null }[];

      return rows.map(r => ({
        pid: r.pid,
        playerName: r.player_name
      }));
    } catch (e) {
      console.error('[LookupService] Error getting bundled custom portraits:', e);
      return [];
    }
  }

  /**
   * Check if a bundled custom portrait exists
   * @param pid Portrait ID
   * @returns true if bundled custom portrait exists
   */
  public hasBundledCustomPortrait(pid: number): boolean {
    if (!this.db) return false;
    try {
      const tableExists = this.db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='bundled_custom_portraits'"
      ).get();
      if (!tableExists) return false;

      const row = this.db.prepare(
        'SELECT 1 FROM bundled_custom_portraits WHERE pid = ?'
      ).get(pid);
      return !!row;
    } catch (e) {
      return false;
    }
  }

  /**
   * Get bundled custom portrait count
   */
  public getBundledCustomPortraitCount(): number {
    if (!this.db) return 0;
    try {
      const tableExists = this.db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='bundled_custom_portraits'"
      ).get();
      if (!tableExists) return 0;

      const row = this.db.prepare(
        'SELECT COUNT(*) as count FROM bundled_custom_portraits'
      ).get() as { count: number };
      return row.count;
    } catch (e) {
      return 0;
    }
  }
}

// Export singleton instance
export const lookupService = new LookupService();