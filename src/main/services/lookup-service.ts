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

export interface LookupCache {
  [fileName: string]: Map<number, string>;
}

export class LookupService {
  private cache: LookupCache = {};
  private reverseCache: { [fileName: string]: Map<string, number> } = {};
  private pamCache: Map<string, PAMEntry> = new Map(); // PAM name → PAMEntry
  private pamByPIDCache: Map<number, PAMEntry[]> = new Map(); // PID → PAMEntry[]
  private fullDataCache: Map<number, FullDataEntry> = new Map(); // PID → FullDataEntry

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
      // ONLY load Madden code lookups + MASTER_PLAYER_LOOKUP for ALL player data
      const lookupFiles = [
        'position_lookup.csv',        // Madden position codes
        'team_lookup.csv',            // Madden team codes
        'college_lookup.csv',         // Madden college codes
        'state_lookup.csv',           // Madden state codes
        'MASTER_PLAYER_LOOKUP.csv'    // ALL PLAYER DATA - 27,680 players with EVERYTHING
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

      // Special handling for MASTER_PLAYER_LOOKUP.csv (the ONE source for all player data)
      if (fileName === 'MASTER_PLAYER_LOOKUP.csv') {
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
      // Format: Last Name,First Name,College/Univ,Round,Pick,Draft Class,Position,PhotoID,Player Assets ID,CommID,PresID,PLPO
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const parts = line.split(',');
        if (parts.length < 12) continue; // Need at least 12 columns including PLPO

        const entry: FullDataEntry = {
          lastName: parts[0].trim(),
          firstName: parts[1].trim(),
          college: parts[2].trim(),
          round: parts[3].trim(),
          pick: parts[4].trim(),
          draftClass: parts[5].trim(),
          position: parts[6].trim(),
          pid: parseInt(parts[7].trim()),
          pam: parts[8].trim(),
          commID: parts[9].trim(),
          presID: parts[10].trim(),
          plpo: parts[11].trim()
        };

        // Store by PID
        if (!isNaN(entry.pid)) {
          this.fullDataCache.set(entry.pid, entry);
        }
      }

      console.log(`Loaded ${this.fullDataCache.size} FullData entries from ${fileName}`);
    } catch (error) {
      console.error(`Error loading FullData lookup file ${fileName}:`, error);
    }
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
    // Special handling for MASTER_PLAYER_LOOKUP.csv - return full entries with PLPO
    if (fileName === 'MASTER_PLAYER_LOOKUP.csv') {
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
}

// Export singleton instance
export const lookupService = new LookupService();