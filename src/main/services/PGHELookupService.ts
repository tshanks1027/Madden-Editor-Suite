/**
 * PGHE Lookup Service
 * Provides access to generic face data from the game's PGHE table.
 *
 * Each generic face has:
 * - PGHE: Face picker index (1-304)
 * - PFCG: Face config code (e.g., "1_B_B_005") - first digit is skin tone
 * - GPAN: Portrait asset name
 * - PSXP: PID - the unique player ID for this generic face
 * - GSLP: Skin tone value
 * - CPVF: Flag
 */

import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

export interface PGHEEntry {
  pghe: number;      // Face picker index
  pfcg: string;      // Face config code (e.g., "1_B_B_005")
  gpan: string;      // Portrait asset name
  gslp: number;      // Skin tone from file
  psxp: number;      // PID - the key field for assignment
  cpvf: number;      // Flag
  skinTone: number;  // Derived from first digit of PFCG
  genr: string;      // Derived: "gen_" + PFCG
}

class PGHELookupService {
  private entries: PGHEEntry[] = [];
  private bySkinTone: Map<number, PGHEEntry[]> = new Map();
  private byPGHE: Map<number, PGHEEntry> = new Map();
  private byPID: Map<number, PGHEEntry> = new Map();
  private verifiedGenrs: Set<string> = new Set();  // Only faces with portraits
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // First, load verified-portrait-complete.json to know which faces have portraits
      const verifiedPaths = [
        path.join(process.cwd(), 'data', 'lookups', 'verified-portrait-complete.json'),
        path.join(app.getAppPath(), 'data', 'lookups', 'verified-portrait-complete.json'),
        path.join(app.getAppPath(), '.vite', 'build', 'data', 'lookups', 'verified-portrait-complete.json'),
      ];

      let verifiedPath = '';
      for (const p of verifiedPaths) {
        if (fs.existsSync(p)) {
          verifiedPath = p;
          break;
        }
      }

      if (verifiedPath) {
        const verifiedContent = fs.readFileSync(verifiedPath, 'utf-8');
        const verifiedData = JSON.parse(verifiedContent);
        // Extract GENR values from verified portraits
        for (const key of Object.keys(verifiedData)) {
          const entry = verifiedData[key];
          if (entry.genr) {
            this.verifiedGenrs.add(entry.genr);
          }
        }
        console.log(`[PGHELookup] Loaded ${this.verifiedGenrs.size} verified portrait GENRs`);
      } else {
        console.warn('[PGHELookup] verified-portrait-complete.json not found - will use all faces');
      }

      // Find CSV file
      const possiblePaths = [
        path.join(process.cwd(), 'data', 'lookups', 'PGHE_lookup.csv'),
        path.join(app.getAppPath(), 'data', 'lookups', 'PGHE_lookup.csv'),
        path.join(app.getAppPath(), '.vite', 'build', 'data', 'lookups', 'PGHE_lookup.csv'),
      ];

      let csvPath = '';
      for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
          csvPath = p;
          break;
        }
      }

      if (!csvPath) {
        console.error('[PGHELookup] CSV file not found');
        return;
      }

      const content = fs.readFileSync(csvPath, 'utf-8');
      const lines = content.split('\n');

      let skippedCount = 0;

      // Parse CSV (skip header)
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Parse: PGHE,PFCG,GPAN,GSLP,PSXP,CPVF
        const parts = line.split(',');
        if (parts.length < 6) continue;

        const pghe = parseInt(parts[0]);
        const pfcg = parts[1].replace(/"/g, '');
        const gpan = parts[2].replace(/"/g, '');
        const gslp = parseInt(parts[3]);
        const psxp = parseInt(parts[4]);
        const cpvf = parseInt(parts[5]);

        // Derive skin tone from first digit of PFCG
        const skinTone = parseInt(pfcg.split('_')[0]) || 1;

        // Derive GENR format
        const genr = `gen_${pfcg}`;

        // CRITICAL: Only include faces that have verified portraits
        if (this.verifiedGenrs.size > 0 && !this.verifiedGenrs.has(genr)) {
          skippedCount++;
          continue;  // Skip faces without portraits
        }

        const entry: PGHEEntry = {
          pghe, pfcg, gpan, gslp, psxp, cpvf, skinTone, genr
        };

        this.entries.push(entry);
        this.byPGHE.set(pghe, entry);
        this.byPID.set(psxp, entry);

        // Group by skin tone
        if (!this.bySkinTone.has(skinTone)) {
          this.bySkinTone.set(skinTone, []);
        }
        this.bySkinTone.get(skinTone)!.push(entry);
      }

      this.initialized = true;
      console.log(`[PGHELookup] Loaded ${this.entries.length} generic faces with verified portraits`);
      console.log(`[PGHELookup] Skipped ${skippedCount} faces without portraits`);
      console.log(`[PGHELookup] Skin tones: ${Array.from(this.bySkinTone.keys()).sort().join(', ')}`);

    } catch (err) {
      console.error('[PGHELookup] Error loading:', err);
    }
  }

  /**
   * Get a random generic face for a given skin tone
   */
  getRandomBySkinTone(skinTone: number): PGHEEntry | null {
    const faces = this.bySkinTone.get(skinTone);
    if (!faces || faces.length === 0) {
      // Try adjacent skin tones
      for (let offset = 1; offset <= 3; offset++) {
        const lower = this.bySkinTone.get(skinTone - offset);
        if (lower && lower.length > 0) {
          return lower[Math.floor(Math.random() * lower.length)];
        }
        const higher = this.bySkinTone.get(skinTone + offset);
        if (higher && higher.length > 0) {
          return higher[Math.floor(Math.random() * higher.length)];
        }
      }
      return null;
    }
    return faces[Math.floor(Math.random() * faces.length)];
  }

  /**
   * Get all faces for a given skin tone
   */
  getAllBySkinTone(skinTone: number): PGHEEntry[] {
    return this.bySkinTone.get(skinTone) || [];
  }

  /**
   * Get face by PGHE index (face picker number)
   */
  getByPGHE(pghe: number): PGHEEntry | null {
    return this.byPGHE.get(pghe) || null;
  }

  /**
   * Get face by PID
   */
  getByPID(pid: number): PGHEEntry | null {
    return this.byPID.get(pid) || null;
  }

  /**
   * Get all entries
   */
  getAll(): PGHEEntry[] {
    return [...this.entries];
  }

  /**
   * Map race value to skin tone (1:1 for now, can be adjusted)
   */
  raceToSkinTone(race: number): number {
    // 1:1 mapping - race 1-7 maps to skin tone 1-7
    if (race >= 1 && race <= 7) {
      return race;
    }
    // Default to middle skin tone for unknown race
    return 4;
  }

  /**
   * Check if a PID is a generic face PID
   */
  isGenericFacePID(pid: number): boolean {
    return this.byPID.has(pid);
  }
}

export const pgheLookupService = new PGHELookupService();
