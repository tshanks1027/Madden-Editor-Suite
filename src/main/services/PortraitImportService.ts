/**
 * PortraitImportService
 *
 * Imports portrait images and links them to historical players.
 * Manages the assignment of historical players to recyclable PLPO slots.
 *
 * Workflow:
 * 1. Import portrait images from user's folder
 * 2. Match images to historical players (by filename)
 * 3. Assign each player to a recyclable PLPO slot
 * 4. Store assignments for persistence
 * 5. Export generates correctly-named DDS files for Frosty
 */

import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { recyclablePIDService } from './RecyclablePIDService';
import { portraitAssignmentService } from './PortraitAssignmentService';

export interface PortraitImport {
  historicalPlayer: string;       // "Ki-Jana Carter"
  year: number;                   // 1995
  type: 'draft' | 'roster';       // draft class or roster
  sourceImagePath: string;        // Original PNG/DDS location
  assignedPLPO: string;           // "plpo_CarterTory" (recyclable slot)
  assignedPID: number;            // Numeric PID of the recyclable slot
  race: number;                   // Player's race for matching
  raceMatch: boolean;             // Whether race matches the assigned slot
  position?: string;              // Player's position
}

export interface ImportResult {
  success: boolean;
  imported: PortraitImport[];
  errors: string[];
  summary: {
    totalImages: number;
    matched: number;
    unmatched: number;
    assigned: number;
    raceMatches: number;
  };
}

export interface MatchResult {
  imagePath: string;
  imageName: string;
  matchedPlayer: string | null;
  confidence: 'high' | 'medium' | 'low' | 'none';
}

class PortraitImportService {
  private assignments: Map<string, PortraitImport[]> = new Map(); // Key: "year-type"
  private initialized = false;

  /**
   * Initialize the service
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    await recyclablePIDService.initialize();
    await portraitAssignmentService.initialize();

    // Load any saved assignments from disk
    await this.loadSavedAssignments();

    this.initialized = true;
    console.log('[PortraitImportService] Initialized');
  }

  /**
   * Import portraits from a folder
   */
  async importFromFolder(
    folderPath: string,
    year: number,
    type: 'draft' | 'roster'
  ): Promise<ImportResult> {
    await this.initialize();

    const result: ImportResult = {
      success: true,
      imported: [],
      errors: [],
      summary: {
        totalImages: 0,
        matched: 0,
        unmatched: 0,
        assigned: 0,
        raceMatches: 0
      }
    };

    // Check if folder exists
    if (!fs.existsSync(folderPath)) {
      result.success = false;
      result.errors.push(`Folder not found: ${folderPath}`);
      return result;
    }

    // Get image files
    const files = fs.readdirSync(folderPath);
    const imageFiles = files.filter(f =>
      f.toLowerCase().endsWith('.dds') ||
      f.toLowerCase().endsWith('.png') ||
      f.toLowerCase().endsWith('.jpg')
    );

    result.summary.totalImages = imageFiles.length;

    if (imageFiles.length === 0) {
      result.errors.push('No image files found in folder');
      return result;
    }

    // Get historical players for this year
    const players = type === 'draft'
      ? this.getDraftClassPlayers(year)
      : this.getRosterPlayers(year);

    console.log(`[PortraitImportService] Found ${imageFiles.length} images, ${players.length} players for ${year} ${type}`);

    // Match images to players
    const matches = this.matchImagesToPlayers(imageFiles, players);

    // Get recyclable slots
    const usedPLPOs = new Set<string>();
    const recyclables = recyclablePIDService.getRecyclableWithPLPO();

    // Group recyclables by race for better matching
    const recyclablesByRace = new Map<number, typeof recyclables>();
    for (const r of recyclables) {
      if (!recyclablesByRace.has(r.race)) {
        recyclablesByRace.set(r.race, []);
      }
      recyclablesByRace.get(r.race)!.push(r);
    }

    // Process matches and assign PLPO slots
    for (const match of matches) {
      if (!match.matchedPlayer) {
        result.summary.unmatched++;
        continue;
      }

      result.summary.matched++;

      // Find player data for race matching
      const playerData = players.find(p =>
        `${p.firstName} ${p.lastName}` === match.matchedPlayer ||
        `${p.lastName}, ${p.firstName}` === match.matchedPlayer
      );

      const playerRace = playerData?.race ?? 0;

      // Try to find a race-matched recyclable slot
      let assignedRecyclable = null;
      const raceMatched = recyclablesByRace.get(playerRace) || [];

      // First try race match
      for (const r of raceMatched) {
        if (!usedPLPOs.has(r.plpo)) {
          assignedRecyclable = r;
          break;
        }
      }

      // If no race match, use any available
      if (!assignedRecyclable) {
        for (const r of recyclables) {
          if (!usedPLPOs.has(r.plpo)) {
            assignedRecyclable = r;
            break;
          }
        }
      }

      if (assignedRecyclable) {
        usedPLPOs.add(assignedRecyclable.plpo);

        const importEntry: PortraitImport = {
          historicalPlayer: match.matchedPlayer,
          year,
          type,
          sourceImagePath: path.join(folderPath, match.imagePath),
          assignedPLPO: assignedRecyclable.plpo,
          assignedPID: assignedRecyclable.pid,
          race: playerRace,
          raceMatch: assignedRecyclable.race === playerRace,
          position: playerData?.position
        };

        result.imported.push(importEntry);
        result.summary.assigned++;
        if (importEntry.raceMatch) {
          result.summary.raceMatches++;
        }
      } else {
        result.errors.push(`No available PLPO slot for ${match.matchedPlayer}`);
      }
    }

    // Store assignments
    const key = `${year}-${type}`;
    this.assignments.set(key, result.imported);
    await this.saveAssignments();

    console.log(`[PortraitImportService] Imported ${result.summary.assigned} portraits for ${year} ${type}`);
    return result;
  }

  /**
   * Match image filenames to player names
   */
  matchImagesToPlayers(
    imageFiles: string[],
    players: Array<{ firstName: string; lastName: string; race?: number; position?: string }>
  ): MatchResult[] {
    const results: MatchResult[] = [];

    for (const imageFile of imageFiles) {
      // Extract name from filename (remove extension and prefix)
      const baseName = path.basename(imageFile, path.extname(imageFile));

      // Try various name formats
      let matchedPlayer: string | null = null;
      let confidence: 'high' | 'medium' | 'low' | 'none' = 'none';

      // Format 1: LastName_FirstName or LastNameFirstName
      const normalized = baseName.toLowerCase().replace(/[^a-z]/g, '');

      for (const player of players) {
        const playerFullLower = `${player.lastName}${player.firstName}`.toLowerCase().replace(/[^a-z]/g, '');
        const playerFirstLast = `${player.firstName}${player.lastName}`.toLowerCase().replace(/[^a-z]/g, '');

        if (normalized === playerFullLower || normalized === playerFirstLast) {
          matchedPlayer = `${player.firstName} ${player.lastName}`;
          confidence = 'high';
          break;
        }

        // Partial match
        if (normalized.includes(player.lastName.toLowerCase()) &&
            normalized.includes(player.firstName.toLowerCase())) {
          matchedPlayer = `${player.firstName} ${player.lastName}`;
          confidence = 'medium';
        }
      }

      results.push({
        imagePath: imageFile,
        imageName: baseName,
        matchedPlayer,
        confidence
      });
    }

    return results;
  }

  /**
   * Get players for a draft class year
   */
  private getDraftClassPlayers(year: number): Array<{
    firstName: string;
    lastName: string;
    race: number;
    position: string;
  }> {
    // Players whose career started this year
    const allPlayers = portraitAssignmentService.getPlayersForYear(year);
    return allPlayers
      .filter(p => p.fromYear === year)
      .map(p => ({
        firstName: p.firstName,
        lastName: p.lastName,
        race: p.race,
        position: p.position
      }));
  }

  /**
   * Get players for a roster year
   */
  private getRosterPlayers(year: number): Array<{
    firstName: string;
    lastName: string;
    race: number;
    position: string;
  }> {
    // All players active in this year
    const allPlayers = portraitAssignmentService.getPlayersForYear(year);
    return allPlayers.map(p => ({
      firstName: p.firstName,
      lastName: p.lastName,
      race: p.race,
      position: p.position
    }));
  }

  /**
   * Get assignments for a year
   */
  getAssignments(year: number, type?: 'draft' | 'roster'): PortraitImport[] {
    if (type) {
      return this.assignments.get(`${year}-${type}`) || [];
    }

    // Return both draft and roster
    const draft = this.assignments.get(`${year}-draft`) || [];
    const roster = this.assignments.get(`${year}-roster`) || [];
    return [...draft, ...roster];
  }

  /**
   * Update a single assignment's PLPO slot
   */
  assignToSlot(
    historicalPlayer: string,
    year: number,
    type: 'draft' | 'roster',
    newPLPO: string
  ): boolean {
    const key = `${year}-${type}`;
    const assignments = this.assignments.get(key);
    if (!assignments) return false;

    const assignment = assignments.find(a => a.historicalPlayer === historicalPlayer);
    if (!assignment) return false;

    // Find the recyclable entry for the new PLPO
    const recyclable = recyclablePIDService.findByPLPO(newPLPO);
    if (!recyclable) return false;

    // Check if PLPO is already in use
    const inUse = assignments.some(a =>
      a.assignedPLPO === newPLPO && a.historicalPlayer !== historicalPlayer
    );
    if (inUse) return false;

    // Update assignment
    assignment.assignedPLPO = recyclable.portrait || newPLPO;
    assignment.assignedPID = recyclable.pid;
    assignment.raceMatch = recyclable.race === assignment.race;

    this.saveAssignments();
    return true;
  }

  /**
   * Swap assignments between two players
   */
  swapAssignments(
    player1: string,
    player2: string,
    year: number,
    type: 'draft' | 'roster'
  ): boolean {
    const key = `${year}-${type}`;
    const assignments = this.assignments.get(key);
    if (!assignments) return false;

    const a1 = assignments.find(a => a.historicalPlayer === player1);
    const a2 = assignments.find(a => a.historicalPlayer === player2);
    if (!a1 || !a2) return false;

    // Swap PLPO and PID
    const tempPLPO = a1.assignedPLPO;
    const tempPID = a1.assignedPID;
    const tempRaceMatch = a1.raceMatch;

    a1.assignedPLPO = a2.assignedPLPO;
    a1.assignedPID = a2.assignedPID;
    a1.raceMatch = a2.race === a1.race;

    a2.assignedPLPO = tempPLPO;
    a2.assignedPID = tempPID;
    a2.raceMatch = a1.race === a2.race;

    this.saveAssignments();
    return true;
  }

  /**
   * Auto-assign by race (optimize race matching)
   */
  autoAssignByRace(year: number, type: 'draft' | 'roster'): number {
    const key = `${year}-${type}`;
    const assignments = this.assignments.get(key);
    if (!assignments || assignments.length === 0) return 0;

    // Get all recyclables
    const recyclables = recyclablePIDService.getRecyclableWithPLPO();

    // Group assignments and recyclables by race
    const assignmentsByRace = new Map<number, PortraitImport[]>();
    const recyclablesByRace = new Map<number, typeof recyclables>();

    for (const a of assignments) {
      if (!assignmentsByRace.has(a.race)) {
        assignmentsByRace.set(a.race, []);
      }
      assignmentsByRace.get(a.race)!.push(a);
    }

    for (const r of recyclables) {
      if (!recyclablesByRace.has(r.race)) {
        recyclablesByRace.set(r.race, []);
      }
      recyclablesByRace.get(r.race)!.push(r);
    }

    // Collect currently used PLPOs
    const usedPLPOs = new Set(assignments.map(a => a.assignedPLPO));
    let improved = 0;

    // For each assignment, try to find a better race match
    for (const assignment of assignments) {
      if (assignment.raceMatch) continue; // Already matched

      const sameRaceRecyclables = recyclablesByRace.get(assignment.race) || [];

      // Find an available recyclable with matching race
      for (const r of sameRaceRecyclables) {
        if (!usedPLPOs.has(r.plpo)) {
          // Found a better match - swap
          const oldPLPO = assignment.assignedPLPO;
          assignment.assignedPLPO = r.plpo;
          assignment.assignedPID = r.pid;
          assignment.raceMatch = true;

          usedPLPOs.delete(oldPLPO);
          usedPLPOs.add(r.plpo);
          improved++;
          break;
        }
      }
    }

    if (improved > 0) {
      this.saveAssignments();
    }

    return improved;
  }

  /**
   * Get available (unused) recyclable slots
   */
  getAvailableSlots(year: number, type: 'draft' | 'roster', race?: number): Array<{
    plpo: string;
    pid: number;
    race: number;
    playerName: string;
  }> {
    const key = `${year}-${type}`;
    const assignments = this.assignments.get(key) || [];
    const usedPLPOs = new Set(assignments.map(a => a.assignedPLPO));

    const recyclables = recyclablePIDService.getRecyclableWithPLPO();
    let available = recyclables.filter(r => !usedPLPOs.has(r.plpo));

    if (race !== undefined) {
      available = available.filter(r => r.race === race);
    }

    return available.map(r => ({
      plpo: r.plpo,
      pid: r.pid,
      race: r.race,
      playerName: r.playerName
    }));
  }

  /**
   * Save assignments to disk
   */
  private async saveAssignments(): Promise<void> {
    const dataDir = this.getDataPath('portrait-assignments');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const data: Record<string, PortraitImport[]> = {};
    for (const [key, assignments] of this.assignments) {
      data[key] = assignments;
    }

    const filePath = path.join(dataDir, 'assignments.json');
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    console.log(`[PortraitImportService] Saved ${this.assignments.size} assignment sets`);
  }

  /**
   * Load saved assignments from disk
   */
  private async loadSavedAssignments(): Promise<void> {
    const filePath = this.getDataPath('portrait-assignments', 'assignments.json');
    if (!fs.existsSync(filePath)) {
      console.log('[PortraitImportService] No saved assignments found');
      return;
    }

    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const data = JSON.parse(content) as Record<string, PortraitImport[]>;

      for (const [key, assignments] of Object.entries(data)) {
        this.assignments.set(key, assignments);
      }

      console.log(`[PortraitImportService] Loaded ${this.assignments.size} assignment sets`);
    } catch (error) {
      console.error('[PortraitImportService] Error loading saved assignments:', error);
    }
  }

  /**
   * Get data directory path
   */
  private getDataPath(...segments: string[]): string {
    const possiblePaths = [
      path.join(process.cwd(), 'data', ...segments),
      path.join(app.getAppPath(), 'data', ...segments),
      path.join(app.getAppPath(), '..', '..', 'data', ...segments),
    ];

    for (const p of possiblePaths) {
      const dir = path.dirname(p);
      if (fs.existsSync(dir)) {
        return p;
      }
    }

    return possiblePaths[0];
  }

  /**
   * Get service status
   */
  getStatus(): {
    initialized: boolean;
    assignmentSets: number;
    totalAssignments: number;
  } {
    let total = 0;
    for (const assignments of this.assignments.values()) {
      total += assignments.length;
    }

    return {
      initialized: this.initialized,
      assignmentSets: this.assignments.size,
      totalAssignments: total
    };
  }

  /**
   * Clear assignments for a year
   */
  clearAssignments(year: number, type?: 'draft' | 'roster'): void {
    if (type) {
      this.assignments.delete(`${year}-${type}`);
    } else {
      this.assignments.delete(`${year}-draft`);
      this.assignments.delete(`${year}-roster`);
    }
    this.saveAssignments();
  }
}

// Singleton instance
export const portraitImportService = new PortraitImportService();
