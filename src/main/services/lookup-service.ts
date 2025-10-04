import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

export interface LookupEntry {
  id: number;
  name: string;
}

export interface LookupCache {
  [fileName: string]: Map<number, string>;
}

export class LookupService {
  private cache: LookupCache = {};
  private reverseCache: { [fileName: string]: Map<string, number> } = {};

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
      const lookupFiles = [
        'position_lookup.csv',
        'team_lookup.csv',
        'college_lookup.csv',
        'state_lookup.csv',
        'PID_lookup.csv'
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
  public getDropdownOptions(fileName: string): LookupEntry[] {
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

  // Special handling for PID lookup which has player names
  public getPIDOptions(): LookupEntry[] {
    const lookup = this.cache['PID_lookup.csv'];
    if (!lookup) {
      return [];
    }

    const options: LookupEntry[] = [];
    lookup.forEach((playerName, portraitId) => {
      // For PID, we want to show "Portrait ID - Player Name"
      const displayName = portraitId === 0 ? 'Blank' : `${portraitId} - ${playerName}`;
      options.push({ id: portraitId, name: displayName });
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
}

// Export singleton instance
export const lookupService = new LookupService();