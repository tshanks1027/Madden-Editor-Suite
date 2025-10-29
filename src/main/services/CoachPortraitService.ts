/**
 * Coach Portrait Service
 *
 * Manages coach portrait images using sprite sheets.
 * Similar to PortraitSpriteService but specifically for coach portraits.
 */

import fs from 'fs';
import path from 'path';
import { app } from 'electron';

interface CoachAtlasEntry {
  pid: number;
  filename: string;
  sheet: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface CoachAtlas {
  version: string;
  type: string;
  config: {
    portraitWidth: number;
    portraitHeight: number;
    gridColumns: number;
    gridRows: number;
  };
  sheets: number;
  coaches: CoachAtlasEntry[];
}

export interface CoachSpriteInfo {
  sheetPath: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export class CoachPortraitService {
  private atlas: CoachAtlas | null = null;
  private portraitMap: Map<number, CoachAtlasEntry> = new Map();
  private spritesDir: string;
  private atlasPath: string;
  private initialized: boolean = false;

  constructor() {
    // Sprite sheets directory - check multiple locations
    const possibleSpritesPaths = [
      path.join(process.cwd(), 'data', 'coach-sprites'),
      path.join(app.getAppPath(), 'data', 'coach-sprites'),
      path.join(app.getAppPath(), '..', '..', 'data', 'coach-sprites'), // For unpacked ASAR
      path.join(__dirname, '..', '..', 'data', 'coach-sprites'),
    ];

    this.spritesDir = possibleSpritesPaths.find(p => fs.existsSync(p)) || possibleSpritesPaths[0];

    // Atlas file path
    const possibleAtlasPaths = [
      path.join(process.cwd(), 'data', 'coach-atlas.json'),
      path.join(app.getAppPath(), 'data', 'coach-atlas.json'),
      path.join(app.getAppPath(), '..', '..', 'data', 'coach-atlas.json'),
      path.join(__dirname, '..', '..', 'data', 'coach-atlas.json'),
    ];

    this.atlasPath = possibleAtlasPaths.find(p => fs.existsSync(p)) || possibleAtlasPaths[0];

    console.log('[CoachPortraitService] Sprites directory:', this.spritesDir);
    console.log('[CoachPortraitService] Sprites directory exists:', fs.existsSync(this.spritesDir));
    console.log('[CoachPortraitService] Atlas path:', this.atlasPath);
    console.log('[CoachPortraitService] Atlas file exists:', fs.existsSync(this.atlasPath));
  }

  /**
   * Initialize coach portrait service and load atlas
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    console.log('[CoachPortraitService] Initializing coach portrait service...');

    // Load atlas JSON
    if (!fs.existsSync(this.atlasPath)) {
      console.error('[CoachPortraitService] Atlas file not found:', this.atlasPath);
      return;
    }

    try {
      const atlasData = fs.readFileSync(this.atlasPath, 'utf8');
      this.atlas = JSON.parse(atlasData);

      if (!this.atlas) {
        console.error('[CoachPortraitService] Failed to parse atlas JSON');
        return;
      }

      console.log(`[CoachPortraitService] Loaded atlas with ${this.atlas.coaches.length} coach portraits across ${this.atlas.sheets} sheets`);

      // Build coach portrait lookup map (PID → entry)
      for (const entry of this.atlas.coaches) {
        this.portraitMap.set(entry.pid, entry);
      }

      this.initialized = true;
      console.log('[CoachPortraitService] Coach portrait map initialized with', this.portraitMap.size, 'entries');
    } catch (err) {
      console.error('[CoachPortraitService] Error loading atlas:', err);
    }
  }

  /**
   * Get sprite portrait info by coach PID
   * @param pid Coach Portrait ID
   * @returns Sprite sheet info or null
   */
  public getPortraitByPID(pid: number): CoachSpriteInfo | null {
    if (!this.initialized || !this.atlas) {
      console.warn('[CoachPortraitService] Service not initialized');
      return null;
    }

    const entry = this.portraitMap.get(pid);

    if (!entry) {
      return null;
    }

    return {
      sheetPath: path.join(this.spritesDir, `coach-sheet-${entry.sheet}.png`),
      x: entry.x,
      y: entry.y,
      width: entry.width,
      height: entry.height
    };
  }

  /**
   * Check if coach portrait exists for given PID
   * @param pid Coach Portrait ID
   * @returns True if portrait exists
   */
  public hasPortrait(pid: number): boolean {
    return this.portraitMap.has(pid);
  }

  /**
   * Get all available coach PIDs
   * @returns Array of coach PIDs with portraits
   */
  public getAvailablePIDs(): number[] {
    return Array.from(this.portraitMap.keys());
  }

  /**
   * Get service status
   * @returns Initialization status and stats
   */
  public getStatus() {
    return {
      initialized: this.initialized,
      spritesDir: this.spritesDir,
      atlasPath: this.atlasPath,
      portraitCount: this.portraitMap.size,
      sheets: this.atlas?.sheets || 0
    };
  }
}

// Export singleton instance
export const coachPortraitService = new CoachPortraitService();
