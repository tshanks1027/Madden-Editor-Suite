/**
 * PortraitAssignmentService
 *
 * Assigns portrait slots (PIDs) to players for a specific historical year.
 * Uses recyclable PIDs for players needing generic faces while avoiding
 * PIDs reserved for future draft classes.
 *
 * Priority:
 * 1. Real player PIDs (legends with actual portraits)
 * 2. Recyclable (R) PIDs for generic faces, matching by race when possible
 * 3. Never use PIDs appearing in future draft classes
 */

import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { recyclablePIDService } from './RecyclablePIDService';

interface PlayerData {
  lastName: string;
  firstName: string;
  college: string;
  position: string;
  pid: number | null;
  pam: string;
  race: number;
  fromYear: number;
  toYear: number;
  plpo: string;
}

interface PortraitAssignment {
  player: PlayerData;
  assignedPID: number;
  assignmentType: 'real' | 'recyclable';
  recycledFrom?: string; // Original player name for recyclable PIDs
}

interface AssignmentReport {
  year: number;
  totalPlayers: number;
  realPortraits: number;
  recyclableAssigned: number;
  unassigned: number;
  recyclableRemaining: number;
}

class PortraitAssignmentService {
  private allPlayers: PlayerData[] = [];
  private initialized = false;

  /**
   * Initialize by loading player career data
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Initialize recyclable PID service first
    await recyclablePIDService.initialize();

    const csvPath = this.findDataFile('lookups/ALL_PLAYER_LOOKUP.csv');
    if (!csvPath) {
      console.error('[PortraitAssignmentService] Could not find ALL_PLAYER_LOOKUP.csv');
      return;
    }

    console.log('[PortraitAssignmentService] Loading from:', csvPath);

    try {
      const content = fs.readFileSync(csvPath, 'utf8');
      const lines = content.split('\n');

      // Skip header
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Parse CSV properly (handling potential commas in fields)
        const parts = this.parseCSVLine(line);
        if (parts.length < 22) continue;

        const lastName = parts[0] || '';
        const firstName = parts[1] || '';
        const college = parts[2] || '';
        const position = parts[6] || '';
        const pidStr = parts[8];
        const pam = parts[9] || '';
        const plpo = parts[11] || '';
        const fromStr = parts[14];
        const toStr = parts[15];
        const raceStr = parts[21];

        const pid = pidStr ? parseInt(pidStr, 10) : null;
        const fromYear = parseInt(fromStr, 10) || 0;
        const toYear = parseInt(toStr, 10) || fromYear; // If no end year, assume same as start
        const race = parseInt(raceStr, 10) || 0;

        if (fromYear === 0) continue; // Skip entries without valid career data

        this.allPlayers.push({
          lastName,
          firstName,
          college,
          position,
          pid: isNaN(pid!) ? null : pid,
          pam,
          race,
          fromYear,
          toYear,
          plpo
        });
      }

      this.initialized = true;
      console.log(`[PortraitAssignmentService] Loaded ${this.allPlayers.length} players`);

    } catch (error) {
      console.error('[PortraitAssignmentService] Error loading CSV:', error);
    }
  }

  /**
   * Parse a CSV line handling quoted fields
   */
  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());

    return result;
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
   * Get all players active in a specific year
   */
  getPlayersForYear(year: number): PlayerData[] {
    return this.allPlayers.filter(p => p.fromYear <= year && p.toYear >= year);
  }

  /**
   * Get players who have their own PID (real portraits)
   */
  getPlayersWithRealPortraits(year: number): PlayerData[] {
    return this.getPlayersForYear(year).filter(p => p.pid !== null && !recyclablePIDService.isRecyclable(p.pid));
  }

  /**
   * Get players who need generic faces (no PID or recyclable PID)
   */
  getPlayersNeedingGenericFaces(year: number): PlayerData[] {
    return this.getPlayersForYear(year).filter(p => p.pid === null || recyclablePIDService.isRecyclable(p.pid));
  }

  /**
   * Assign portraits to all players for a specific year
   */
  assignPortraits(year: number): PortraitAssignment[] {
    const assignments: PortraitAssignment[] = [];
    const usedPIDs = new Set<number>();
    const players = this.getPlayersForYear(year);

    // First pass: Assign real portraits
    for (const player of players) {
      if (player.pid !== null && !recyclablePIDService.isRecyclable(player.pid)) {
        assignments.push({
          player,
          assignedPID: player.pid,
          assignmentType: 'real'
        });
        usedPIDs.add(player.pid);
      }
    }

    // Second pass: Assign recyclable PIDs to players needing generic faces
    const needsGeneric = players.filter(p => p.pid === null || recyclablePIDService.isRecyclable(p.pid));

    for (const player of needsGeneric) {
      const recyclable = recyclablePIDService.allocateRecyclablePID(player.race, usedPIDs);

      if (recyclable) {
        assignments.push({
          player,
          assignedPID: recyclable.pid,
          assignmentType: 'recyclable',
          recycledFrom: recyclable.playerName
        });
        usedPIDs.add(recyclable.pid);
      }
    }

    return assignments;
  }

  /**
   * Get assignment report for a year
   */
  getAssignmentReport(year: number): AssignmentReport {
    const players = this.getPlayersForYear(year);
    const assignments = this.assignPortraits(year);

    const realPortraits = assignments.filter(a => a.assignmentType === 'real').length;
    const recyclableAssigned = assignments.filter(a => a.assignmentType === 'recyclable').length;
    const totalAssigned = realPortraits + recyclableAssigned;

    return {
      year,
      totalPlayers: players.length,
      realPortraits,
      recyclableAssigned,
      unassigned: players.length - totalAssigned,
      recyclableRemaining: recyclablePIDService.getRecyclableCount() - recyclableAssigned
    };
  }

  /**
   * Get available years based on player data
   */
  getAvailableYears(): number[] {
    const years = new Set<number>();
    for (const player of this.allPlayers) {
      for (let y = player.fromYear; y <= player.toYear; y++) {
        if (y >= 1920 && y <= 2025) { // Reasonable NFL year range
          years.add(y);
        }
      }
    }
    return Array.from(years).sort((a, b) => a - b);
  }

  /**
   * Get service status
   */
  getStatus(): { initialized: boolean; totalPlayers: number; recyclableAvailable: number } {
    return {
      initialized: this.initialized,
      totalPlayers: this.allPlayers.length,
      recyclableAvailable: recyclablePIDService.getRecyclableCount()
    };
  }
}

// Singleton instance
export const portraitAssignmentService = new PortraitAssignmentService();
