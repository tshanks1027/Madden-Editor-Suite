/**
 * Portrait Service
 *
 * Manages player face portrait images.
 * Provides portrait lookup by player name and PAM code.
 */

import fs from 'fs';
import path from 'path';
import { app } from 'electron';

export class PortraitService {
  private portraitCache: Map<string, string> = new Map();
  private genericDir: string;
  private legendsDir: string;
  private playersDir: string;
  private initialized: boolean = false;

  constructor() {
    // Generic portraits directory - check multiple locations
    const possibleGenericPaths = [
      path.join(process.cwd(), 'data', 'portraits', 'generic'),
      path.join(app.getAppPath(), 'data', 'portraits', 'generic'),
      path.join(__dirname, '..', '..', 'data', 'portraits', 'generic'),
    ];

    this.genericDir = possibleGenericPaths.find(p => fs.existsSync(p)) || possibleGenericPaths[0];

    // Legends portraits directory
    const possibleLegendsPaths = [
      path.join(process.cwd(), 'data', 'portraits', 'legends'),
      path.join(app.getAppPath(), 'data', 'portraits', 'legends'),
      path.join(__dirname, '..', '..', 'data', 'portraits', 'legends'),
    ];

    this.legendsDir = possibleLegendsPaths.find(p => fs.existsSync(p)) || possibleLegendsPaths[0];

    // Players portraits directory - check external Madden Files location first
    const possiblePlayersPaths = [
      'C:\\Users\\tshan\\OneDrive\\Documents\\Madden Files\\Portraits\\Madden 26',
      path.join(process.cwd(), 'data', 'portraits', 'players'),
      path.join(app.getAppPath(), 'data', 'portraits', 'players'),
      path.join(__dirname, '..', '..', 'data', 'portraits', 'players'),
    ];

    this.playersDir = possiblePlayersPaths.find(p => fs.existsSync(p)) || possiblePlayersPaths[0];

    console.log('[PortraitService] Generic portraits directory:', this.genericDir);
    console.log('[PortraitService] Generic directory exists:', fs.existsSync(this.genericDir));
    console.log('[PortraitService] Legends portraits directory:', this.legendsDir);
    console.log('[PortraitService] Legends directory exists:', fs.existsSync(this.legendsDir));
    console.log('[PortraitService] Players portraits directory:', this.playersDir);
    console.log('[PortraitService] Players directory exists:', fs.existsSync(this.playersDir));
  }

  /**
   * Initialize portrait cache
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    console.log('[PortraitService] Initializing portrait cache...');

    // Load generic portraits
    if (fs.existsSync(this.genericDir)) {
      const genericFiles = fs.readdirSync(this.genericDir).filter(f => f.endsWith('.png'));
      console.log(`[PortraitService] Found ${genericFiles.length} generic portrait images`);

      for (const file of genericFiles) {
        const key = file.replace('.png', '').toLowerCase();
        this.portraitCache.set(key, path.join(this.genericDir, file));
      }
    } else {
      console.warn('[PortraitService] Generic portraits directory not found:', this.genericDir);
    }

    // Load legends portraits
    if (fs.existsSync(this.legendsDir)) {
      const legendsFiles = fs.readdirSync(this.legendsDir).filter(f => f.endsWith('.png'));
      console.log(`[PortraitService] Found ${legendsFiles.length} legends portrait images`);

      for (const file of legendsFiles) {
        const key = file.replace('.png', '').toLowerCase();
        this.portraitCache.set(key, path.join(this.legendsDir, file));
      }
    } else {
      console.warn('[PortraitService] Legends portraits directory not found:', this.legendsDir);
    }

    // Load player portraits
    if (fs.existsSync(this.playersDir)) {
      const playersFiles = fs.readdirSync(this.playersDir).filter(f => f.endsWith('.png'));
      console.log(`[PortraitService] Found ${playersFiles.length} player portrait images`);

      for (const file of playersFiles) {
        const key = file.replace('.png', '').toLowerCase();
        this.portraitCache.set(key, path.join(this.playersDir, file));
      }
    } else {
      console.warn('[PortraitService] Players portraits directory not found:', this.playersDir);
    }

    this.initialized = true;
    console.log('[PortraitService] Portrait cache initialized with', this.portraitCache.size, 'portraits');
  }

  /**
   * Get portrait path by player name
   * @param firstName Player first name
   * @param lastName Player last name
   * @returns Full path to portrait PNG, or null if not found
   */
  public getPortraitByPlayerName(firstName: string, lastName: string): string | null {
    if (!this.initialized) {
      console.warn('[PortraitService] Service not initialized');
      return null;
    }

    // Construct filename: plpo_LastNameFirstName.png
    const key = `plpo_${lastName}${firstName}`.toLowerCase();
    return this.portraitCache.get(key) || null;
  }

  /**
   * Get portrait path by PLPO name (from Frosty)
   * @param plpoName Name like "plpo_AdamsDavante"
   * @returns Full path to portrait PNG, or null if not found
   */
  public getPortraitByPLPO(plpoName: string): string | null {
    if (!this.initialized) {
      console.warn('[PortraitService] Service not initialized');
      return null;
    }

    const key = plpoName.toLowerCase().replace('.dds', '').replace('.png', '');

    // Try regular lookup first
    let portraitPath = this.portraitCache.get(key);

    // If not found, try with 'legends_' prefix for legend players
    if (!portraitPath && key.startsWith('plpo_')) {
      const legendKey = key.replace('plpo_', 'plpo_legends_');
      console.log(`[PortraitService] Regular lookup failed for ${key}, trying legend key: ${legendKey}`);
      portraitPath = this.portraitCache.get(legendKey);

      if (portraitPath) {
        console.log(`[PortraitService] Found legend portrait: ${legendKey} -> ${portraitPath}`);
      }
    }

    return portraitPath || null;
  }

  /**
   * Search portraits by query string
   * @param query Search query
   * @param limit Maximum results to return
   * @returns Array of {name, path} objects
   */
  public searchPortraits(query: string, limit: number = 50): Array<{name: string, path: string}> {
    if (!this.initialized) {
      console.warn('[PortraitService] Service not initialized');
      return [];
    }

    const lowerQuery = query.toLowerCase();
    const results: Array<{name: string, path: string}> = [];

    for (const [name, portraitPath] of this.portraitCache.entries()) {
      if (name.includes(lowerQuery)) {
        results.push({
          name: name.replace('plpo_', ''),
          path: portraitPath
        });

        if (results.length >= limit) {
          break;
        }
      }
    }

    return results;
  }

  /**
   * Get all portrait names (for autocomplete)
   * @returns Array of portrait names
   */
  public getAllPortraitNames(): string[] {
    if (!this.initialized) {
      return [];
    }

    return Array.from(this.portraitCache.keys()).map(key => key.replace('plpo_', ''));
  }

  /**
   * Check if portrait exists
   * @param plpoName PLPO name
   * @returns True if portrait exists
   */
  public hasPortrait(plpoName: string): boolean {
    if (!this.initialized) {
      return false;
    }

    const key = plpoName.toLowerCase().replace('.dds', '').replace('.png', '');
    return this.portraitCache.has(key);
  }

  /**
   * Get portrait count
   * @returns Number of portraits in cache
   */
  public getPortraitCount(): number {
    return this.portraitCache.size;
  }
}

// Singleton instance
export const portraitService = new PortraitService();
