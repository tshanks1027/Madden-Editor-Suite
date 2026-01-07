/**
 * RecyclablePIDService
 *
 * Identifies and manages recyclable portrait slots (PIDs) for throwback mod creation.
 * PIDs marked with (R) suffix in PID_Portrait_Mapping.csv are "recyclable" - they're either
 * duplicate entries or players who didn't last long in the league.
 *
 * These recyclable PIDs can be safely overwritten when creating historical rosters
 * without affecting the base game experience.
 */

import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

interface RecyclablePID {
  pid: number;
  playerName: string;
  type: 'legend' | 'player';
  portrait: string;
  pam: string;
  race: number;
}

class RecyclablePIDService {
  private recyclablePIDs: Map<number, RecyclablePID> = new Map();
  private allPIDs: Map<number, RecyclablePID> = new Map();
  private initialized = false;

  /**
   * Initialize the service by parsing PID_Portrait_Mapping.csv
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    const csvPath = this.findDataFile('lookups/PID_Portrait_Mapping.csv');
    if (!csvPath) {
      console.error('[RecyclablePIDService] Could not find PID_Portrait_Mapping.csv');
      return;
    }

    console.log('[RecyclablePIDService] Loading from:', csvPath);

    try {
      const content = fs.readFileSync(csvPath, 'utf8');
      const lines = content.split('\n');

      // Skip header
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const parts = line.split(',');
        if (parts.length < 6) continue;

        const pid = parseInt(parts[0], 10);
        if (isNaN(pid)) continue;

        const playerName = parts[1] || '';
        const type = (parts[2] || 'player') as 'legend' | 'player';
        const portrait = parts[3] || '';
        const pam = parts[4] || '';
        const race = parseInt(parts[5], 10) || 0;

        const entry: RecyclablePID = {
          pid,
          playerName,
          type,
          portrait,
          pam,
          race
        };

        // Store all PIDs
        this.allPIDs.set(pid, entry);

        // Check for (R) suffix indicating recyclable
        if (playerName.includes('(R)')) {
          this.recyclablePIDs.set(pid, entry);
        }
      }

      this.initialized = true;
      console.log(`[RecyclablePIDService] Loaded ${this.allPIDs.size} total PIDs`);
      console.log(`[RecyclablePIDService] Found ${this.recyclablePIDs.size} recyclable PIDs`);

    } catch (error) {
      console.error('[RecyclablePIDService] Error loading CSV:', error);
    }
  }

  /**
   * Find data file in multiple possible locations
   */
  private findDataFile(relativePath: string): string | null {
    const possiblePaths = [
      path.join(process.cwd(), 'data', relativePath),
      path.join(app.getAppPath(), 'data', relativePath),
      path.join(app.getAppPath(), '..', '..', 'data', relativePath),
      path.join(__dirname, '..', '..', '..', 'data', relativePath),
      path.join(__dirname, '..', '..', 'data', relativePath),
    ];

    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        return p;
      }
    }

    return null;
  }

  /**
   * Get all recyclable PIDs (those marked with (R))
   */
  getRecyclablePIDs(): Set<number> {
    return new Set(this.recyclablePIDs.keys());
  }

  /**
   * Get recyclable PID entries with full details
   */
  getRecyclablePIDEntries(): RecyclablePID[] {
    return Array.from(this.recyclablePIDs.values());
  }

  /**
   * Get count of recyclable slots available
   */
  getRecyclableCount(): number {
    return this.recyclablePIDs.size;
  }

  /**
   * Check if a specific PID is recyclable
   */
  isRecyclable(pid: number): boolean {
    return this.recyclablePIDs.has(pid);
  }

  /**
   * Get details for a specific PID
   */
  getPIDDetails(pid: number): RecyclablePID | undefined {
    return this.allPIDs.get(pid);
  }

  /**
   * Get recyclable PIDs by type (legend or player)
   */
  getRecyclableByType(type: 'legend' | 'player'): RecyclablePID[] {
    return Array.from(this.recyclablePIDs.values()).filter(p => p.type === type);
  }

  /**
   * Get recyclable PIDs by race for matching with historical players
   */
  getRecyclableByRace(race: number): RecyclablePID[] {
    return Array.from(this.recyclablePIDs.values()).filter(p => p.race === race);
  }

  /**
   * Allocate a recyclable PID for a historical player
   * Prefers matching by race when possible
   * Returns undefined if no recyclable PIDs are available
   */
  allocateRecyclablePID(preferredRace?: number, usedPIDs?: Set<number>): RecyclablePID | undefined {
    const available = Array.from(this.recyclablePIDs.values())
      .filter(p => !usedPIDs || !usedPIDs.has(p.pid));

    if (available.length === 0) return undefined;

    // Try to match by race if specified
    if (preferredRace !== undefined) {
      const raceMatched = available.find(p => p.race === preferredRace);
      if (raceMatched) return raceMatched;
    }

    // Return first available
    return available[0];
  }

  /**
   * Get DDS filename for a recyclable entry
   * Returns format like "plpo_CarterTory.dds"
   */
  getDDSFilename(entry: RecyclablePID): string {
    // Use the portrait field which contains the PLPO
    const plpo = entry.portrait || this.generatePLPO(entry.playerName);
    return `${plpo}.dds`;
  }

  /**
   * Generate PLPO from player name if not in CSV
   * Format: plpo_{LastName}{FirstName}
   */
  private generatePLPO(playerName: string): string {
    // Remove (R) suffix and clean up
    const clean = playerName.replace(/\s*\(R\)\s*$/, '').trim();
    const parts = clean.split(' ');
    if (parts.length < 2) return `plpo_${clean.replace(/\s+/g, '')}`;

    const firstName = parts[0].replace(/[^a-zA-Z]/g, '');
    const lastName = parts.slice(1).join('').replace(/[^a-zA-Z]/g, '');
    return `plpo_${lastName}${firstName}`;
  }

  /**
   * Get recyclable entries with PLPO for DDS file naming
   * Returns entries sorted by PLPO for consistent assignment
   */
  getRecyclableWithPLPO(): Array<RecyclablePID & { plpo: string; ddsFilename: string }> {
    return Array.from(this.recyclablePIDs.values())
      .map(entry => ({
        ...entry,
        plpo: entry.portrait || this.generatePLPO(entry.playerName),
        ddsFilename: this.getDDSFilename(entry)
      }))
      .sort((a, b) => a.plpo.localeCompare(b.plpo));
  }

  /**
   * Find recyclable entry by PLPO
   */
  findByPLPO(plpo: string): RecyclablePID | undefined {
    return Array.from(this.recyclablePIDs.values())
      .find(entry => entry.portrait === plpo || entry.portrait === plpo.replace('.dds', ''));
  }

  /**
   * Get service status
   */
  getStatus(): { initialized: boolean; total: number; recyclable: number } {
    return {
      initialized: this.initialized,
      total: this.allPIDs.size,
      recyclable: this.recyclablePIDs.size
    };
  }
}

// Singleton instance
export const recyclablePIDService = new RecyclablePIDService();
