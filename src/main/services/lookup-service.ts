import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

export interface LookupEntry {
  id: number;
  name: string;
}

export interface FullDataEntry {
  pid: number;           // PhotoID
  lastName: string;
  firstName: string;
  college: string;
  round: string;
  pick: string;
  draftClass: string;
  position: string;
  pam: string;           // Player Assets ID
  commID: string;
  presID: string;
  plpo: string;          // PLPO portrait key
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
  pid: number;
  displayName: string; // Generated from firstName + lastName
}

export interface LookupCache {
  [fileName: string]: Map<number, string>;
}

export class LookupService {
  private cache: LookupCache = {};
  private reverseCache: { [fileName: string]: Map<string, number> } = {};
  private pamCache: Map<string, PAMEntry> = new Map(); // PAM name → PAMEntry
  private pamByPIDCache: Map<number, PAMEntry[]> = new Map(); // PID → PAMEntry[]
  private fullDataCache: Map<number, FullDataEntry> = new Map(); // PID → FullDataEntry
  private coachCache: Map<number, CoachLookupEntry> = new Map(); // PID → CoachLookupEntry
  private coachByPAMCache: Map<string, CoachLookupEntry> = new Map(); // PAM → CoachLookupEntry

  constructor() {
    this.initializeLookups();
  }

  private resolveDataPath(...segments: string[]): string {
    if (app.isPackaged) {
      // In packaged app, __dirname is already .vite/build
      // lookup files are at .vite/build/data/lookups
      return path.join(__dirname, 'data', 'lookups', ...segments);
    }
    // In development, lookup files are in data/lookups (relative to project root)
    return path.join(__dirname, '..', '..', 'data', 'lookups', ...segments);
  }

  private async initializeLookups(): Promise<void> {
    try {
      // ONLY load Madden code lookups + ALL_PLAYER_LOOKUP for ALL player data + Coach lookup
      const lookupFiles = [
        'position_lookup.csv',        // Madden position codes
        'team_lookup.csv',            // Madden team codes
        'college_lookup.csv',         // Madden college codes
        'state_lookup.csv',           // Madden state codes
        'ALL_PLAYER_LOOKUP.csv',      // ALL PLAYER DATA - 27,680 players with EVERYTHING
        'Coach_lookup.csv'            // Coach portraits and PAM mappings
      ];

      for (const fileName of lookupFiles) {
        await this.loadLookupFile(fileName);
      }

      console.log('Lookup service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize lookup service:', error);
    }
  }

  private async loadLookupFile(fileName: string): Promise<void> {
    try {
      // Special handling for PAM_lookup.csv
      if (fileName === 'PAM_lookup.csv') {
        await this.loadPAMLookupFile(fileName);
        return;
      }

      // Special handling for Coach_lookup.csv
      if (fileName === 'Coach_lookup.csv') {
        await this.loadCoachLookupFile(fileName);
        return;
      }

      // Special handling for ALL_PLAYER_LOOKUP.csv (the ONE source for all player data)
      if (fileName === 'ALL_PLAYER_LOOKUP.csv') {
        await this.loadFullDataLookupFile(fileName);
        return;
      }

      const filePath = this.resolveDataPath(fileName);

      if (!fs.existsSync(filePath)) {
        console.warn(`Lookup file not found: ${filePath}`);
        return;
      }

      const csvContent = fs.readFileSync(filePath, 'utf-8');
      const lines = csvContent.trim().split('\n');

      if (lines.length < 2) {
        console.warn(`Invalid lookup file format: ${fileName}`);
        return;
      }

      // Parse header to determine column names
      const header = lines[0].split(',');
      const idColumn = header[0]; // e.g., 'PPOS', 'TGID', 'PCOL'
      const nameColumn = header[1]; // e.g., 'PositionName', 'TeamName', 'CollegeName'

      // Initialize maps
      this.cache[fileName] = new Map<number, string>();
      this.reverseCache[fileName] = new Map<string, number>();

      // Parse data rows
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const [idStr, name] = line.split(',');
        const id = parseInt(idStr);

        if (!isNaN(id) && name) {
          // Remove quotes if present
          const cleanName = name.replace(/^"(.*)"$/, '$1');

          // Store both forward and reverse mappings
          this.cache[fileName].set(id, cleanName);
          this.reverseCache[fileName].set(cleanName, id);
        }
      }

      console.log(`Loaded ${this.cache[fileName].size} entries from ${fileName}`);
    } catch (error) {
      console.error(`Error loading lookup file ${fileName}:`, error);
    }
  }

  private async loadPAMLookupFile(fileName: string): Promise<void> {
    try {
      const filePath = this.resolveDataPath(fileName);

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

      // Clear existing PAM caches
      this.pamCache.clear();
      this.pamByPIDCache.clear();

      // Parse PAM data (skip header)
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Format: PAM,PID,Type,Ethnicity,Generation,FaceShape,Description
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

        // Store in PAM cache (by PAM name)
        this.pamCache.set(pamEntry.pam, pamEntry);

        // Store in PID cache (for reverse lookup)
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
      const filePath = this.resolveDataPath(fileName);

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

      // Clear existing coach caches
      this.coachCache.clear();
      this.coachByPAMCache.clear();

      // Parse coach data (format: LastName,FirstName,PAM,PID)
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const parts = line.split(',');
        if (parts.length < 4) continue;

        const lastName = parts[0].trim();
        const firstName = parts[1].trim();
        const pam = parts[2].trim();
        const pid = parseInt(parts[3].trim());

        if (isNaN(pid)) continue;

        const displayName = firstName && lastName ? `${firstName} ${lastName}` : (firstName || lastName || `Coach ${pid}`);

        const coachEntry: CoachLookupEntry = {
          lastName,
          firstName,
          pam,
          pid,
          displayName
        };

        // Store in PID cache
        this.coachCache.set(pid, coachEntry);

        // Store in PAM cache (if PAM is present)
        if (pam) {
          this.coachByPAMCache.set(pam, coachEntry);
        }
      }

      console.log(`Loaded ${this.coachCache.size} coach entries from ${fileName}`);

      // Also load PAM names from coach portrait files in "Coach and Owners" directory
      await this.loadCoachPortraitPAMs();

    } catch (error) {
      console.error(`Error loading Coach lookup file ${fileName}:`, error);
    }
  }

  private async loadCoachPortraitPAMs(): Promise<void> {
    try {
      const path = await import('path');

      // Path to coach portraits directory
      const portraitsDir = app.isPackaged
        ? path.join(process.resourcesPath, 'app', 'data', 'Coach info', 'Coach and Owners')
        : path.join(__dirname, '../../data/Coach info/Coach and Owners');

      if (!fs.existsSync(portraitsDir)) {
        console.warn(`Coach portraits directory not found: ${portraitsDir}`);
        return;
      }

      // Read all portrait files
      const files = fs.readdirSync(portraitsDir);
      let addedCount = 0;

      for (const file of files) {
        // Match pattern: mapo_coachportraits_LastNameFirstName.png
        const match = file.match(/^mapo_coachportraits_(.+)\.png$/);
        if (!match) continue;

        const namePart = match[1]; // e.g., "BowlesTodd", "CampbellDan"

        // Parse name - find where last name ends and first name begins
        // Most names follow pattern: uppercase letter for last name, then uppercase for first name
        const nameMatch = namePart.match(/^([A-Z][a-z]+)([A-Z][a-z]+)$/);
        if (!nameMatch) continue;

        const lastName = nameMatch[1];
        const firstName = nameMatch[2];
        const displayName = `${firstName} ${lastName}`;
        const pamValue = `mapo_coachportraits_${namePart}`;

        // Check if we already have this PAM in the cache
        if (!this.coachByPAMCache.has(pamValue)) {
          // Add as a new entry with a high PID (to avoid conflicts with real PIDs)
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
      const filePath = this.resolveDataPath(fileName);

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

      // Clear existing cache
      this.fullDataCache.clear();

      // Parse FullData entries (skip header)
      // Format: Last Name,First Name,College/Univ,Round,Pick,Draft Class,Position,Jersey,PhotoID,Player Assets ID,CommID,PLPO,...
      console.log(`[lookup-service] Parsing ${lines.length - 1} lines from ${fileName}`);

      let entriesWithPLPO = 0;
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Proper CSV parsing that handles quoted fields with commas
        const parts = this.parseCSVLine(line);
        if (parts.length < 12) {
          if (i < 5) console.log(`[lookup-service] Line ${i}: Only ${parts.length} parts, skipping`);
          continue; // Need at least 12 columns including PLPO
        }

        const entry: FullDataEntry = {
          lastName: parts[0].trim(),
          firstName: parts[1].trim(),
          college: parts[2].trim(),
          round: parts[3].trim(),
          pick: parts[4].trim(),
          draftClass: parts[5].trim(),
          position: parts[6].trim(),
          pid: parseInt(parts[8].trim()),  // PhotoID is column 8 (after Jersey column 7)
          pam: parts[9].trim(),            // Player Assets ID
          commID: parts[10].trim(),
          presID: parts[10].trim(),        // Use same as CommID since PresID not in this file
          plpo: parts[11].trim()
        };

        // Debug first 3 entries
        if (i <= 3) {
          console.log(`[lookup-service] Line ${i}: PID=${entry.pid}, Name=${entry.firstName} ${entry.lastName}, PLPO="${entry.plpo}", Parts=${parts.length}`);
        }

        if (entry.plpo) entriesWithPLPO++;

        // Store by PID
        if (!isNaN(entry.pid)) {
          this.fullDataCache.set(entry.pid, entry);
        }
      }

      console.log(`[lookup-service] Loaded ${this.fullDataCache.size} FullData entries from ${fileName}, ${entriesWithPLPO} have PLPO`);
    } catch (error) {
      console.error(`Error loading FullData lookup file ${fileName}:`, error);
    }
  }

  // Parse a CSV line properly handling quoted fields with commas
  private parseCSVLine(line: string): string[] {
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

  // Convert numeric ID to display name
  public getDisplayName(fileName: string, id: number): string {
    const lookup = this.cache[fileName];
    if (!lookup) {
      console.warn(`Lookup file not found: ${fileName}`);
      return id.toString();
    }

    return lookup.get(id) || id.toString();
  }

  // Convert display name to numeric ID
  public getNumericId(fileName: string, displayName: string): number {
    const lookup = this.reverseCache[fileName];
    if (!lookup) {
      console.warn(`Reverse lookup file not found: ${fileName}`);
      return 0;
    }

    return lookup.get(displayName) || 0;
  }

  // Get all options for a dropdown
  public getDropdownOptions(fileName: string): any[] {
    // Special handling for ALL_PLAYER_LOOKUP.csv - return full entries with PLPO
    if (fileName === 'ALL_PLAYER_LOOKUP.csv') {
      return this.getFullDataOptions();
    }

    const lookup = this.cache[fileName];
    if (!lookup) {
      return [];
    }

    const options: LookupEntry[] = [];
    lookup.forEach((name, id) => {
      options.push({ id, name });
    });

    // Sort by name for better UX
    return options.sort((a, b) => a.name.localeCompare(b.name));
  }

  // Get MASTER_PLAYER_LOOKUP.csv options with all fields including PLPO
  public getFullDataOptions(): Array<{id: number, name: string, plpo: string, entry: FullDataEntry}> {
    const options: Array<{id: number, name: string, plpo: string, entry: FullDataEntry}> = [];

    this.fullDataCache.forEach((entry, pid) => {
      const displayName = `${entry.firstName} ${entry.lastName}`;
      options.push({
        id: pid,
        name: displayName,
        plpo: entry.plpo,
        entry: entry
      });
    });

    return options.sort((a, b) => a.id - b.id);
  }

  // Get PID options from MASTER_PLAYER_LOOKUP.csv (no longer separate PID_lookup.csv)
  public getPIDOptions(): LookupEntry[] {
    const options: LookupEntry[] = [];

    this.fullDataCache.forEach((entry, pid) => {
      const displayName = `${entry.firstName} ${entry.lastName}`;
      options.push({ id: pid, name: displayName });
    });

    return options.sort((a, b) => a.id - b.id);
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
}

// Export singleton instance
export const lookupService = new LookupService();