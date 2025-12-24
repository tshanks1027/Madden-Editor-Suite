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
    // Debug log to file
    const debugLog = (msg: string) => {
      try {
        const logPath = path.join(process.cwd(), 'portrait-service-debug.log');
        fs.appendFileSync(logPath, `${new Date().toISOString()} ${msg}\n`);
      } catch (e) {
        // Ignore file write errors
      }
    };

    debugLog('[Constructor] Starting PortraitSpriteService constructor');
    debugLog(`[Constructor] process.cwd() = ${process.cwd()}`);
    debugLog(`[Constructor] app.getAppPath() = ${app.getAppPath()}`);
    debugLog(`[Constructor] __dirname = ${__dirname}`);

    // Sprite sheets directory - check multiple locations
    const possibleSpritesPaths = [
      path.join(process.cwd(), 'data', 'portrait-sprites'),
      path.join(app.getAppPath(), 'data', 'portrait-sprites'),
      path.join(app.getAppPath(), '..', '..', 'data', 'portrait-sprites'), // For unpacked ASAR
      path.join(__dirname, '..', '..', 'data', 'portrait-sprites'),
    ];

    debugLog('[Constructor] Checking sprite paths:');
    possibleSpritesPaths.forEach((p, i) => {
      const exists = fs.existsSync(p);
      debugLog(`[Constructor]   ${i}: ${p} - exists: ${exists}`);
    });

    this.spritesDir = possibleSpritesPaths.find(p => fs.existsSync(p)) || possibleSpritesPaths[0];
    debugLog(`[Constructor] Selected sprites dir: ${this.spritesDir}`);

    // Atlas file path
    const possibleAtlasPaths = [
      path.join(process.cwd(), 'data', 'portrait-atlas.json'),
      path.join(app.getAppPath(), 'data', 'portrait-atlas.json'),
      path.join(app.getAppPath(), '..', '..', 'data', 'portrait-atlas.json'),
      path.join(__dirname, '..', '..', 'data', 'portrait-atlas.json'),
    ];

    debugLog('[Constructor] Checking atlas paths:');
    possibleAtlasPaths.forEach((p, i) => {
      const exists = fs.existsSync(p);
      debugLog(`[Constructor]   ${i}: ${p} - exists: ${exists}`);
    });

    this.atlasPath = possibleAtlasPaths.find(p => fs.existsSync(p)) || possibleAtlasPaths[0];
    debugLog(`[Constructor] Selected atlas path: ${this.atlasPath}`);

    // PID Portrait Mapping CSV path
    const possibleMappingPaths = [
      path.join(process.cwd(), 'data', 'lookups', 'PID_Portrait_Mapping.csv'),
      path.join(app.getAppPath(), 'data', 'lookups', 'PID_Portrait_Mapping.csv'),
      path.join(app.getAppPath(), '..', '..', 'data', 'lookups', 'PID_Portrait_Mapping.csv'),
      path.join(__dirname, '..', '..', 'data', 'lookups', 'PID_Portrait_Mapping.csv'),
    ];

    debugLog('[Constructor] Checking mapping paths:');
    possibleMappingPaths.forEach((p, i) => {
      const exists = fs.existsSync(p);
      debugLog(`[Constructor]   ${i}: ${p} - exists: ${exists}`);
    });

    this.pidMappingPath = possibleMappingPaths.find(p => fs.existsSync(p)) || possibleMappingPaths[0];
    debugLog(`[Constructor] Selected mapping path: ${this.pidMappingPath}`);

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
    const debugLog = (msg: string) => {
      try {
        const logPath = path.join(process.cwd(), 'portrait-service-debug.log');
        fs.appendFileSync(logPath, `${new Date().toISOString()} ${msg}\n`);
      } catch (e) {
        // Ignore
      }
    };

    debugLog('[Initialize] Called - initialized status: ' + this.initialized);

    if (this.initialized) {
      debugLog('[Initialize] Already initialized, returning');
      return;
    }

    console.log('[PortraitSpriteService] Initializing sprite service...');
    debugLog('[Initialize] Starting initialization');
    debugLog('[Initialize] Atlas path: ' + this.atlasPath);
    debugLog('[Initialize] Atlas exists: ' + fs.existsSync(this.atlasPath));

    // Load atlas JSON
    if (!fs.existsSync(this.atlasPath)) {
      console.error('[PortraitSpriteService] Atlas file not found:', this.atlasPath);
      debugLog('[Initialize] ERROR: Atlas file not found');
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

      // Load PGHE generic face PIDs
      await this.loadPGHEMapping();

      this.initialized = true;
      console.log('[PortraitSpriteService] Portrait map initialized with', this.portraitMap.size, 'keys');
      console.log('[PortraitSpriteService] PID map initialized with', this.pidMap.size, 'entries');

      // DEBUG: Show sample generic keys in the map
      const genericKeys = Array.from(this.portraitMap.keys()).filter(k => k.includes('generic')).slice(0, 10);
      console.log('[DEBUG Service] Sample generic keys in map:', genericKeys);
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
        if (parts.length < 4) continue;

        const pid = parseInt(parts[0].trim());
        const portrait = parts[3].trim();

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
   * Load PGHE generic face PIDs from PGHE_lookup.csv
   * Maps each generic face's PID (PSXP) to its portrait
   */
  private async loadPGHEMapping(): Promise<void> {
    // Find PGHE_lookup.csv
    const possiblePaths = [
      path.join(process.cwd(), 'data', 'lookups', 'PGHE_lookup.csv'),
      path.join(app.getAppPath(), 'data', 'lookups', 'PGHE_lookup.csv'),
      path.join(app.getAppPath(), '..', '..', 'data', 'lookups', 'PGHE_lookup.csv'),
      path.join(__dirname, '..', '..', 'data', 'lookups', 'PGHE_lookup.csv'),
    ];

    const pghePath = possiblePaths.find(p => fs.existsSync(p));
    if (!pghePath) {
      console.log('[PortraitSpriteService] PGHE_lookup.csv not found, skipping generic face PID mapping');
      return;
    }

    try {
      const csvContent = fs.readFileSync(pghePath, 'utf8');
      const lines = csvContent.split('\n');

      console.log(`[PortraitSpriteService] Loading PGHE mappings from ${pghePath}`);

      let mappedCount = 0;
      let skippedCount = 0;

      // Skip header: PGHE,PFCG,GPAN,GSLP,PSXP,CPVF
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const parts = line.split(',');
        if (parts.length < 5) continue;

        // PGHE,PFCG,GPAN,GSLP,PSXP,CPVF
        const pfcg = parts[1].replace(/"/g, ''); // Face config code e.g., "1_B_B_005"
        const psxp = parseInt(parts[4]); // PID

        if (isNaN(psxp) || psxp <= 0) {
          skippedCount++;
          continue;
        }

        // Convert PFCG to portrait key: "1_B_B_005" -> "plpo_generic_1_B_B_005"
        const portraitKey = `plpo_generic_${pfcg}`.toLowerCase();

        // Look up in portrait map
        let entry = this.portraitMap.get(portraitKey);

        // Try with _morphed suffix
        if (!entry) {
          entry = this.portraitMap.get(portraitKey + '_morphed');
        }

        if (entry) {
          this.pidMap.set(psxp, entry);
          mappedCount++;
        } else {
          // Not all generic faces may be in the atlas - this is fine
          skippedCount++;
        }
      }

      console.log(`[PortraitSpriteService] Mapped ${mappedCount} PGHE PIDs to portraits, skipped ${skippedCount}`);
    } catch (err) {
      console.error('[PortraitSpriteService] Error loading PGHE mapping:', err);
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
    const debugLog = (msg: string) => {
      try {
        const logPath = path.join(process.cwd(), 'portrait-service-debug.log');
        fs.appendFileSync(logPath, `${new Date().toISOString()} ${msg}\n`);
      } catch (e) {
        // Ignore
      }
    };

    debugLog(`[GetByPID] Called with PID ${pid}`);
    debugLog(`[GetByPID] Initialized: ${this.initialized}, Has Atlas: ${!!this.atlas}, PID Map Size: ${this.pidMap.size}`);

    if (!this.initialized || !this.atlas) {
      console.warn('[PortraitSpriteService] Service not initialized');
      debugLog('[GetByPID] Service not initialized, returning null');
      return null;
    }

    const entry = this.pidMap.get(pid);
    debugLog(`[GetByPID] PID Map lookup result: ${entry ? entry.id : 'NOT FOUND'}`);

    if (!entry) {
      debugLog(`[GetByPID] No entry found for PID ${pid}`);
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
