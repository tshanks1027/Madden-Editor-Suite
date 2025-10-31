/**
 * Portrait Sprite Service
 *
 * Manages player face portrait images using sprite sheets.
 * Similar to MyFranchise's approach for optimal package size.
 */

import fs from 'fs';
import path from 'path';
import { app } from 'electron';

interface AtlasEntry {
  id: string;
  filename: string;
  category: string;
  sheet: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Atlas {
  version: string;
  config: {
    portraitWidth: number;
    portraitHeight: number;
    gridColumns: number;
    gridRows: number;
  };
  sheets: number;
  portraits: AtlasEntry[];
}

export interface SpritePortraitInfo {
  sheetPath: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export class PortraitSpriteService {
  private atlas: Atlas | null = null;
  private portraitMap: Map<string, AtlasEntry> = new Map();
  private pidMap: Map<number, AtlasEntry> = new Map(); // PID -> AtlasEntry mapping
  private spritesDir: string;
  private atlasPath: string;
  private pidMappingPath: string;
  private initialized: boolean = false;

  constructor() {
    // Sprite sheets directory - check multiple locations
    const possibleSpritesPaths = [
      path.join(process.cwd(), 'data', 'portrait-sprites'),
      path.join(app.getAppPath(), 'data', 'portrait-sprites'),
      path.join(app.getAppPath(), '..', '..', 'data', 'portrait-sprites'), // For unpacked ASAR
      path.join(__dirname, '..', '..', 'data', 'portrait-sprites'),
    ];

    this.spritesDir = possibleSpritesPaths.find(p => fs.existsSync(p)) || possibleSpritesPaths[0];

    // Atlas file path
    const possibleAtlasPaths = [
      path.join(process.cwd(), 'data', 'portrait-atlas.json'),
      path.join(app.getAppPath(), 'data', 'portrait-atlas.json'),
      path.join(app.getAppPath(), '..', '..', 'data', 'portrait-atlas.json'),
      path.join(__dirname, '..', '..', 'data', 'portrait-atlas.json'),
    ];

    this.atlasPath = possibleAtlasPaths.find(p => fs.existsSync(p)) || possibleAtlasPaths[0];

    // PID Portrait Mapping CSV path
    const possibleMappingPaths = [
      path.join(process.cwd(), 'data', 'lookups', 'PID_Portrait_Mapping.csv'),
      path.join(app.getAppPath(), 'data', 'lookups', 'PID_Portrait_Mapping.csv'),
      path.join(app.getAppPath(), '..', '..', 'data', 'lookups', 'PID_Portrait_Mapping.csv'),
      path.join(__dirname, '..', '..', 'data', 'lookups', 'PID_Portrait_Mapping.csv'),
    ];

    this.pidMappingPath = possibleMappingPaths.find(p => fs.existsSync(p)) || possibleMappingPaths[0];

    console.log('[PortraitSpriteService] Sprites directory:', this.spritesDir);
    console.log('[PortraitSpriteService] Sprites directory exists:', fs.existsSync(this.spritesDir));
    console.log('[PortraitSpriteService] Atlas path:', this.atlasPath);
    console.log('[PortraitSpriteService] Atlas file exists:', fs.existsSync(this.atlasPath));
    console.log('[PortraitSpriteService] PID Mapping path:', this.pidMappingPath);
    console.log('[PortraitSpriteService] PID Mapping file exists:', fs.existsSync(this.pidMappingPath));
  }

  /**
   * Initialize sprite service and load atlas
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    console.log('[PortraitSpriteService] Initializing sprite service...');

    // Load atlas JSON
    if (!fs.existsSync(this.atlasPath)) {
      console.error('[PortraitSpriteService] Atlas file not found:', this.atlasPath);
      return;
    }

    try {
      const atlasData = fs.readFileSync(this.atlasPath, 'utf8');
      this.atlas = JSON.parse(atlasData);

      if (!this.atlas) {
        console.error('[PortraitSpriteService] Failed to parse atlas JSON');
        return;
      }

      console.log(`[PortraitSpriteService] Loaded atlas with ${this.atlas.portraits.length} portraits across ${this.atlas.sheets} sheets`);

      // Build portrait lookup map
      for (const entry of this.atlas.portraits) {
        // Store by ID (e.g., "HarrisNajee")
        this.portraitMap.set(entry.id.toLowerCase(), entry);

        // Also store by full filename (e.g., "plpo_HarrisNajee")
        const fullKey = `plpo_${entry.id}`.toLowerCase();
        this.portraitMap.set(fullKey, entry);

        // Handle legends with prefix
        if (entry.category === 'legends') {
          const legendKey = `plpo_legends_${entry.id}`.toLowerCase();
          this.portraitMap.set(legendKey, entry);
        }

        // Handle generic with morphed suffix
        if (entry.category === 'generic') {
          const morphedKey = `plpo_generic_${entry.id}_morphed`.toLowerCase();
          this.portraitMap.set(morphedKey, entry);
        }
      }

      // Load PID Portrait Mapping CSV
      await this.loadPIDMapping();

      this.initialized = true;
      console.log('[PortraitSpriteService] Portrait map initialized with', this.portraitMap.size, 'keys');
      console.log('[PortraitSpriteService] PID map initialized with', this.pidMap.size, 'entries');
    } catch (err) {
      console.error('[PortraitSpriteService] Error loading atlas:', err);
    }
  }

  /**
   * Load PID Portrait Mapping CSV and build PID -> AtlasEntry map
   */
  private async loadPIDMapping(): Promise<void> {
    if (!fs.existsSync(this.pidMappingPath)) {
      console.error('[PortraitSpriteService] PID Mapping file not found:', this.pidMappingPath);
      return;
    }

    try {
      const csvContent = fs.readFileSync(this.pidMappingPath, 'utf8');
      const lines = csvContent.split('\n');

      console.log(`[PortraitSpriteService] Loading PID mappings from ${this.pidMappingPath}`);

      let mappedCount = 0;
      let skippedCount = 0;

      // Skip header line, start at index 1
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const parts = line.split(',');
        if (parts.length < 3) continue;

        const pid = parseInt(parts[0].trim());
        const portrait = parts[2].trim();

        if (isNaN(pid) && pid !== 0) {
          skippedCount++;
          continue;
        }

        if (!portrait) {
          skippedCount++;
          continue;
        }

        // Look up the portrait in the existing portraitMap
        const key = portrait.toLowerCase().replace('.dds', '').replace('.png', '');
        let entry = this.portraitMap.get(key);

        // Try with _morphed suffix for generic faces
        if (!entry && portrait.startsWith('plpo_generic_')) {
          entry = this.portraitMap.get(key + '_morphed');
        }

        if (entry) {
          this.pidMap.set(pid, entry);
          mappedCount++;
        } else {
          console.warn(`[PortraitSpriteService] Portrait not found in atlas for PID ${pid}: ${portrait}`);
          skippedCount++;
        }
      }

      console.log(`[PortraitSpriteService] Mapped ${mappedCount} PIDs to portraits, skipped ${skippedCount}`);
    } catch (err) {
      console.error('[PortraitSpriteService] Error loading PID mapping:', err);
    }
  }

  /**
   * Get sprite portrait info by player name
   * @param firstName Player first name
   * @param lastName Player last name
   * @returns Sprite sheet info or null
   */
  public getPortraitByPlayerName(firstName: string, lastName: string): SpritePortraitInfo | null {
    if (!this.initialized || !this.atlas) {
      console.warn('[PortraitSpriteService] Service not initialized');
      return null;
    }

    // Construct lookup key: LastNameFirstName
    const key = `${lastName}${firstName}`.toLowerCase();
    const entry = this.portraitMap.get(key);

    if (!entry) {
      return null;
    }

    return {
      sheetPath: path.join(this.spritesDir, `portraits-sheet-${entry.sheet}.png`),
      x: entry.x,
      y: entry.y,
      width: entry.width,
      height: entry.height
    };
  }

  /**
   * Get sprite portrait info by PLPO name
   * @param plpoName Name like "plpo_AdamsDavante"
   * @returns Sprite sheet info or null
   */
  public getPortraitByPLPO(plpoName: string): SpritePortraitInfo | null {
    if (!this.initialized || !this.atlas) {
      console.warn('[PortraitSpriteService] Service not initialized');
      return null;
    }

    const key = plpoName.toLowerCase().replace('.dds', '').replace('.png', '');
    let entry = this.portraitMap.get(key);

    // Try various lookup strategies (same as original service)
    if (!entry && key.startsWith('plpo_')) {
      // Try with legends prefix
      const legendKey = key.replace('plpo_', 'plpo_legends_');
      entry = this.portraitMap.get(legendKey);

      // Try with _profile suffix
      if (!entry) {
        entry = this.portraitMap.get(legendKey + '_profile');
      }
    }

    // Try with _morphed suffix for generic
    if (!entry && key.startsWith('plpo_generic_')) {
      entry = this.portraitMap.get(key + '_morphed');
    }

    if (!entry) {
      return null;
    }

    return {
      sheetPath: path.join(this.spritesDir, `portraits-sheet-${entry.sheet}.png`),
      x: entry.x,
      y: entry.y,
      width: entry.width,
      height: entry.height
    };
  }

  /**
   * Get sprite portrait info by PID
   * @param pid Player ID (Photo ID)
   * @returns Sprite sheet info or null
   */
  public getPortraitByPID(pid: number): SpritePortraitInfo | null {
    if (!this.initialized || !this.atlas) {
      console.warn('[PortraitSpriteService] Service not initialized');
      return null;
    }

    const entry = this.pidMap.get(pid);

    if (!entry) {
      return null;
    }

    return {
      sheetPath: path.join(this.spritesDir, `portraits-sheet-${entry.sheet}.png`),
      x: entry.x,
      y: entry.y,
      width: entry.width,
      height: entry.height
    };
  }

  /**
   * Search portraits by query string
   * @param query Search query
   * @param limit Maximum results
   * @returns Array of {name, sheetPath, x, y, width, height}
   */
  public searchPortraits(query: string, limit: number = 50): Array<{name: string} & SpritePortraitInfo> {
    if (!this.initialized || !this.atlas) {
      return [];
    }

    const lowerQuery = query.toLowerCase();
    const results: Array<{name: string} & SpritePortraitInfo> = [];

    for (const [key, entry] of this.portraitMap.entries()) {
      if (key.includes(lowerQuery)) {
        results.push({
          name: entry.id,
          sheetPath: path.join(this.spritesDir, `portraits-sheet-${entry.sheet}.png`),
          x: entry.x,
          y: entry.y,
          width: entry.width,
          height: entry.height
        });

        if (results.length >= limit) {
          break;
        }
      }
    }

    return results;
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
    return this.portraitMap.has(key);
  }

  /**
   * Get portrait count
   * @returns Number of portraits
   */
  public getPortraitCount(): number {
    return this.portraitMap.size;
  }

  /**
   * Get all portrait names
   * @returns Array of portrait names
   */
  public getAllPortraitNames(): string[] {
    if (!this.initialized || !this.atlas) {
      return [];
    }

    return this.atlas.portraits.map(p => p.id);
  }
}

// Singleton instance
export const portraitSpriteService = new PortraitSpriteService();
