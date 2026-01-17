/**
 * Portrait Sprite Service
 *
 * Manages player face portrait images using sprite sheets.
 * Similar to MyFranchise's approach for optimal package size.
 */

import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import sharp from 'sharp';

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
  private devSpritesDir: string; // Developer portraits sprite sheets
  private devAtlasPath: string;  // Developer portraits atlas
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

    // Developer portraits sprite sheets and atlas (PIDs 11000-11999)
    const possibleDevSpritesPaths = [
      path.join(process.cwd(), 'data', 'developer-sprites'),
      path.join(app.getAppPath(), 'data', 'developer-sprites'),
      path.join(app.getAppPath(), '..', '..', 'data', 'developer-sprites'),
      path.join(__dirname, '..', '..', 'data', 'developer-sprites'),
    ];

    const possibleDevAtlasPaths = [
      path.join(process.cwd(), 'data', 'developer-portrait-atlas.json'),
      path.join(app.getAppPath(), 'data', 'developer-portrait-atlas.json'),
      path.join(app.getAppPath(), '..', '..', 'data', 'developer-portrait-atlas.json'),
      path.join(__dirname, '..', '..', 'data', 'developer-portrait-atlas.json'),
    ];

    this.devSpritesDir = possibleDevSpritesPaths.find(p => fs.existsSync(p)) || possibleDevSpritesPaths[0];
    this.devAtlasPath = possibleDevAtlasPaths.find(p => fs.existsSync(p)) || possibleDevAtlasPaths[0];

    console.log('[PortraitSpriteService] Sprites directory:', this.spritesDir);
    console.log('[PortraitSpriteService] Sprites directory exists:', fs.existsSync(this.spritesDir));
    console.log('[PortraitSpriteService] Atlas path:', this.atlasPath);
    console.log('[PortraitSpriteService] Atlas file exists:', fs.existsSync(this.atlasPath));
    console.log('[PortraitSpriteService] PID Mapping path:', this.pidMappingPath);
    console.log('[PortraitSpriteService] PID Mapping file exists:', fs.existsSync(this.pidMappingPath));
    console.log('[PortraitSpriteService] Developer sprites dir:', this.devSpritesDir);
    console.log('[PortraitSpriteService] Developer atlas path:', this.devAtlasPath);
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

      // Load developer portraits (PIDs 11000-11999)
      await this.loadDeveloperPortraits();

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
   * Load developer portraits from developer-portrait-atlas.json
   * Developer portraits use PIDs in range 11000-11999
   */
  private async loadDeveloperPortraits(): Promise<void> {
    if (!fs.existsSync(this.devAtlasPath)) {
      console.log('[PortraitSpriteService] No developer portrait atlas found (this is normal if no developer portraits have been added)');
      return;
    }

    try {
      const devAtlasData = fs.readFileSync(this.devAtlasPath, 'utf8');
      const devAtlas = JSON.parse(devAtlasData);

      if (!devAtlas.portraits || devAtlas.portraits.length === 0) {
        console.log('[PortraitSpriteService] Developer portrait atlas is empty');
        return;
      }

      console.log(`[PortraitSpriteService] Loading ${devAtlas.portraits.length} developer portraits...`);

      let mappedCount = 0;

      for (const entry of devAtlas.portraits) {
        if (!entry.pid || entry.sheet < 0) {
          console.warn(`[PortraitSpriteService] Skipping invalid developer portrait entry: ${JSON.stringify(entry)}`);
          continue;
        }

        // Create an atlas entry with dev sprite path info
        // We mark it with category 'developer' to identify it later
        const atlasEntry: AtlasEntry = {
          id: entry.id,
          filename: entry.filename,
          category: 'developer',
          sheet: entry.sheet,
          x: entry.x,
          y: entry.y,
          width: entry.width,
          height: entry.height
        };

        // Store in PID map
        this.pidMap.set(entry.pid, atlasEntry);

        // Also store in portrait map by ID
        const key = entry.id.toLowerCase();
        this.portraitMap.set(key, atlasEntry);

        mappedCount++;
      }

      console.log(`[PortraitSpriteService] Loaded ${mappedCount} developer portraits`);
    } catch (err) {
      console.error('[PortraitSpriteService] Error loading developer portraits:', err);
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
    console.log(`[PortraitSpriteService] getPortraitByPID(${pid}) - initialized=${this.initialized}, pidMap.size=${this.pidMap.size}`);

    if (!this.initialized || !this.atlas) {
      console.warn('[PortraitSpriteService] Service not initialized');
      debugLog('[GetByPID] Service not initialized, returning null');
      return null;
    }

    const entry = this.pidMap.get(pid);
    debugLog(`[GetByPID] PID Map lookup result: ${entry ? entry.id : 'NOT FOUND'}`);
    console.log(`[PortraitSpriteService] PID ${pid} -> ${entry ? entry.id : 'NOT FOUND'}`);

    if (!entry) {
      debugLog(`[GetByPID] No entry found for PID ${pid}`);
      return null;
    }

    // Use correct sprite directory based on portrait category
    const isDevPortrait = entry.category === 'developer';
    const spritesDirectory = isDevPortrait ? this.devSpritesDir : this.spritesDir;
    const sheetPrefix = isDevPortrait ? 'developer-sheet' : 'portraits-sheet';

    return {
      sheetPath: path.join(spritesDirectory, `${sheetPrefix}-${entry.sheet}.png`),
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
   * Search portraits by query string, including PID
   * @param query Search query
   * @param limit Maximum results
   * @returns Array of {name, pid, sheetPath, x, y, width, height}
   */
  public searchPortraitsWithPid(query: string, limit: number = 50): Array<{name: string; pid: number | null} & SpritePortraitInfo> {
    if (!this.initialized || !this.atlas) {
      return [];
    }

    const lowerQuery = query.toLowerCase();
    const results: Array<{name: string; pid: number | null} & SpritePortraitInfo> = [];
    const seenNames = new Set<string>();

    // First, search through PID map to get portraits with PIDs
    for (const [pid, entry] of this.pidMap.entries()) {
      if (entry.id.toLowerCase().includes(lowerQuery)) {
        if (!seenNames.has(entry.id)) {
          seenNames.add(entry.id);
          results.push({
            name: entry.id,
            pid: pid,
            sheetPath: path.join(this.spritesDir, `portraits-sheet-${entry.sheet}.png`),
            x: entry.x,
            y: entry.y,
            width: entry.width,
            height: entry.height
          });

          if (results.length >= limit) {
            return results;
          }
        }
      }
    }

    // Then search portrait map for any that weren't found via PID
    for (const [key, entry] of this.portraitMap.entries()) {
      if (key.includes(lowerQuery) && !seenNames.has(entry.id)) {
        seenNames.add(entry.id);
        results.push({
          name: entry.id,
          pid: null, // No PID mapping for this portrait
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

  /**
   * Get all PIDs that have sprite sheet portraits
   * @returns Array of PIDs
   */
  public getAllPids(): number[] {
    if (!this.initialized) {
      return [];
    }

    return Array.from(this.pidMap.keys());
  }

  /**
   * Extract a portrait from sprite sheet and return as PNG buffer
   * @param pid Player ID
   * @param upscale Whether to upscale from 256 to 512 (default true)
   * @returns PNG buffer or null
   */
  public async extractPortraitByPID(pid: number, upscale: boolean = true): Promise<Buffer | null> {
    const info = this.getPortraitByPID(pid);
    if (!info) {
      console.log(`[PortraitSpriteService] No portrait found for PID ${pid}`);
      return null;
    }

    return this.extractFromSpriteSheet(info, upscale);
  }

  /**
   * Extract a portrait from sprite sheet using PLPO name
   * @param plpoName PLPO name
   * @param upscale Whether to upscale from 256 to 512 (default true)
   * @returns PNG buffer or null
   */
  public async extractPortraitByPLPO(plpoName: string, upscale: boolean = true): Promise<Buffer | null> {
    const info = this.getPortraitByPLPO(plpoName);
    if (!info) {
      console.log(`[PortraitSpriteService] No portrait found for PLPO ${plpoName}`);
      return null;
    }

    return this.extractFromSpriteSheet(info, upscale);
  }

  /**
   * Extract portrait from sprite sheet
   */
  private async extractFromSpriteSheet(info: SpritePortraitInfo, upscale: boolean): Promise<Buffer | null> {
    try {
      if (!fs.existsSync(info.sheetPath)) {
        console.error(`[PortraitSpriteService] Sprite sheet not found: ${info.sheetPath}`);
        return null;
      }

      // Extract region from sprite sheet
      let image = sharp(info.sheetPath).extract({
        left: info.x,
        top: info.y,
        width: info.width,
        height: info.height
      });

      // Upscale to 512x512 if requested (for DDS export)
      if (upscale && (info.width !== 512 || info.height !== 512)) {
        image = image.resize(512, 512, {
          kernel: sharp.kernel.lanczos3 // High quality upscaling
        });
      }

      return await image.png().toBuffer();
    } catch (err) {
      console.error('[PortraitSpriteService] Error extracting portrait:', err);
      return null;
    }
  }

  /**
   * Export a sprite sheet portrait as DDS file
   * @param pid Player ID
   * @param outputPath Output directory
   * @returns Result with file path or error
   */
  public async exportPortraitAsDDS(pid: number, outputPath: string): Promise<{ success: boolean; filePath?: string; error?: string }> {
    try {
      // Extract and upscale portrait
      const pngBuffer = await this.extractPortraitByPID(pid, true);
      if (!pngBuffer) {
        return { success: false, error: `Portrait not found for PID ${pid}` };
      }

      // Get raw RGBA pixels
      const { data: rgbaData, info } = await sharp(pngBuffer)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

      console.log(`[PortraitSpriteService] Exporting PID ${pid}: ${info.width}x${info.height}`);

      // Compress to DXT5
      const dxt5Data = this.compressToDxt5(rgbaData, info.width, info.height);

      // Build DDS file
      const ddsBuffer = this.buildDdsFile(dxt5Data, info.width, info.height);

      // Ensure output directory exists
      if (!fs.existsSync(outputPath)) {
        fs.mkdirSync(outputPath, { recursive: true });
      }

      // Write file
      const filename = `${pid}.dds`;
      const filePath = path.join(outputPath, filename);
      fs.writeFileSync(filePath, ddsBuffer);

      console.log(`[PortraitSpriteService] Exported DDS: ${filePath}`);
      return { success: true, filePath };
    } catch (err) {
      console.error('[PortraitSpriteService] DDS export failed:', err);
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  // DDS compression methods (same as CustomPortraitService)
  private compressToDxt5(rgbaData: Buffer, width: number, height: number): Buffer {
    const blocksX = width / 4;
    const blocksY = height / 4;
    const dxtData = Buffer.alloc(blocksX * blocksY * 16);

    for (let by = 0; by < blocksY; by++) {
      for (let bx = 0; bx < blocksX; bx++) {
        const blockOffset = (by * blocksX + bx) * 16;
        const block = this.extractBlock(rgbaData, width, bx * 4, by * 4);
        const compressedBlock = this.compressBlockDxt5(block);
        compressedBlock.copy(dxtData, blockOffset);
      }
    }

    return dxtData;
  }

  private extractBlock(rgbaData: Buffer, width: number, x: number, y: number): Buffer {
    const block = Buffer.alloc(64);
    for (let py = 0; py < 4; py++) {
      for (let px = 0; px < 4; px++) {
        const srcOffset = ((y + py) * width + (x + px)) * 4;
        const dstOffset = (py * 4 + px) * 4;
        block[dstOffset + 0] = rgbaData[srcOffset + 0];
        block[dstOffset + 1] = rgbaData[srcOffset + 1];
        block[dstOffset + 2] = rgbaData[srcOffset + 2];
        block[dstOffset + 3] = rgbaData[srcOffset + 3];
      }
    }
    return block;
  }

  private compressBlockDxt5(block: Buffer): Buffer {
    const output = Buffer.alloc(16);
    const alphas: number[] = [];
    for (let i = 0; i < 16; i++) {
      alphas.push(block[i * 4 + 3]);
    }
    this.compressAlphaBlock(alphas, output, 0);

    const colors: { r: number; g: number; b: number }[] = [];
    for (let i = 0; i < 16; i++) {
      colors.push({ r: block[i * 4 + 0], g: block[i * 4 + 1], b: block[i * 4 + 2] });
    }
    this.compressColorBlock(colors, output, 8);
    return output;
  }

  private compressAlphaBlock(alphas: number[], output: Buffer, offset: number): void {
    let minAlpha = 255, maxAlpha = 0;
    for (const a of alphas) {
      minAlpha = Math.min(minAlpha, a);
      maxAlpha = Math.max(maxAlpha, a);
    }
    output[offset + 0] = maxAlpha;
    output[offset + 1] = minAlpha;

    const alphaPalette: number[] = [maxAlpha, minAlpha];
    if (maxAlpha > minAlpha) {
      for (let i = 1; i <= 6; i++) {
        alphaPalette.push(Math.round(((7 - i) * maxAlpha + i * minAlpha) / 7));
      }
    } else {
      for (let i = 1; i <= 4; i++) {
        alphaPalette.push(Math.round(((5 - i) * maxAlpha + i * minAlpha) / 5));
      }
      alphaPalette.push(0);
      alphaPalette.push(255);
    }

    let indexBits = BigInt(0);
    for (let i = 0; i < 16; i++) {
      let bestIndex = 0, bestDist = 256;
      for (let j = 0; j < 8; j++) {
        const dist = Math.abs(alphas[i] - alphaPalette[j]);
        if (dist < bestDist) { bestDist = dist; bestIndex = j; }
      }
      indexBits |= BigInt(bestIndex) << BigInt(i * 3);
    }
    for (let i = 0; i < 6; i++) {
      output[offset + 2 + i] = Number((indexBits >> BigInt(i * 8)) & BigInt(0xFF));
    }
  }

  private compressColorBlock(colors: { r: number; g: number; b: number }[], output: Buffer, offset: number): void {
    let minColor = colors[0], maxColor = colors[0];
    let minLum = this.luminance(minColor), maxLum = this.luminance(maxColor);
    for (const c of colors) {
      const lum = this.luminance(c);
      if (lum < minLum) { minLum = lum; minColor = c; }
      if (lum > maxLum) { maxLum = lum; maxColor = c; }
    }

    const color0 = this.rgb888To565(maxColor.r, maxColor.g, maxColor.b);
    const color1 = this.rgb888To565(minColor.r, minColor.g, minColor.b);
    const [c0, c1] = color0 > color1 ? [color0, color1] : [color1, color0];
    const [col0, col1] = color0 > color1 ? [maxColor, minColor] : [minColor, maxColor];

    output.writeUInt16LE(c0, offset + 0);
    output.writeUInt16LE(c1, offset + 2);

    const palette = [
      col0, col1,
      { r: Math.round((2 * col0.r + col1.r) / 3), g: Math.round((2 * col0.g + col1.g) / 3), b: Math.round((2 * col0.b + col1.b) / 3) },
      { r: Math.round((col0.r + 2 * col1.r) / 3), g: Math.round((col0.g + 2 * col1.g) / 3), b: Math.round((col0.b + 2 * col1.b) / 3) }
    ];

    const indexBytes = [0, 0, 0, 0];
    for (let i = 0; i < 16; i++) {
      let bestIndex = 0, bestDist = Infinity;
      for (let j = 0; j < 4; j++) {
        const dist = this.colorDistanceSq(colors[i], palette[j]);
        if (dist < bestDist) { bestDist = dist; bestIndex = j; }
      }
      indexBytes[Math.floor(i / 4)] |= bestIndex << ((i % 4) * 2);
    }
    output[offset + 4] = indexBytes[0];
    output[offset + 5] = indexBytes[1];
    output[offset + 6] = indexBytes[2];
    output[offset + 7] = indexBytes[3];
  }

  private luminance(c: { r: number; g: number; b: number }): number {
    return 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;
  }

  private rgb888To565(r: number, g: number, b: number): number {
    return ((r >> 3) << 11) | ((g >> 2) << 5) | (b >> 3);
  }

  private colorDistanceSq(a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number }): number {
    return (a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2;
  }

  private buildDdsFile(dxtData: Buffer, width: number, height: number): Buffer {
    const headerSize = 128;
    const ddsFile = Buffer.alloc(headerSize + dxtData.length);

    ddsFile.writeUInt32LE(0x20534444, 0); // DDS magic
    ddsFile.writeUInt32LE(124, 4); // Header size
    ddsFile.writeUInt32LE(0x1 | 0x2 | 0x4 | 0x1000 | 0x80000, 8); // Flags
    ddsFile.writeUInt32LE(height, 12);
    ddsFile.writeUInt32LE(width, 16);
    ddsFile.writeUInt32LE(dxtData.length, 20); // LinearSize
    ddsFile.writeUInt32LE(0, 24); // Depth
    ddsFile.writeUInt32LE(1, 28); // MipMapCount
    ddsFile.writeUInt32LE(32, 76); // Pixel format size
    ddsFile.writeUInt32LE(0x4, 80); // DDPF_FOURCC
    ddsFile.writeUInt32LE(0x35545844, 84); // DXT5
    ddsFile.writeUInt32LE(0x1000, 108); // Caps

    dxtData.copy(ddsFile, headerSize);
    return ddsFile;
  }
}

// Singleton instance
export const portraitSpriteService = new PortraitSpriteService();
