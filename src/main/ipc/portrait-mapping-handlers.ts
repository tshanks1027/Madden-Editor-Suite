/**
 * IPC handlers for portrait mapping service
 *
 * Provides APIs for:
 * - Generating portrait mappings for a year
 * - Getting recyclable PID counts
 * - Checking mapping status
 */

import { ipcMain, dialog, BrowserWindow } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { recyclablePIDService } from '../services/RecyclablePIDService';
import { portraitAssignmentService } from '../services/PortraitAssignmentService';
import { portraitImportService } from '../services/PortraitImportService';
import { frostyPortraitExportService } from '../services/FrostyPortraitExportService';

interface PortraitMapping {
  historicalPlayer: string;
  position: string;
  race: number;
  type: 'REAL' | 'RECYCLABLE' | 'UNASSIGNED';
  recyclablePLPO: string | null;
  ddsFilename: string | null;
  recycledFrom: string | null;
}

interface MappingResult {
  year: number;
  draftClass?: PortraitMapping[];
  roster?: PortraitMapping[];
  summary: {
    totalPlayers: number;
    realPortraits: number;
    recyclableAssigned: number;
    unassigned: number;
    recyclableRemaining: number;
  };
}

/**
 * Get data directory path
 */
function getDataPath(...segments: string[]): string {
  const possiblePaths = [
    path.join(process.cwd(), 'data', ...segments),
    path.join(app.getAppPath(), 'data', ...segments),
    path.join(app.getAppPath(), '..', '..', 'data', ...segments),
    path.join(__dirname, '..', '..', '..', 'data', ...segments),
    path.join(__dirname, '..', '..', 'data', ...segments),
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }

  // Return first path for creation
  return possiblePaths[0];
}

/**
 * Load ALL_PLAYER_LOOKUP.csv
 */
function loadPlayerData(): Array<{
  lastName: string;
  firstName: string;
  position: string;
  pid: number | null;
  plpo: string;
  fromYear: number;
  toYear: number;
  race: number;
}> {
  const csvPath = getDataPath('lookups', 'ALL_PLAYER_LOOKUP.csv');
  if (!fs.existsSync(csvPath)) {
    console.error('[PortraitMappingHandlers] Could not find ALL_PLAYER_LOOKUP.csv');
    return [];
  }

  const content = fs.readFileSync(csvPath, 'utf8');
  const lines = content.split('\n');
  const players: Array<{
    lastName: string;
    firstName: string;
    position: string;
    pid: number | null;
    plpo: string;
    fromYear: number;
    toYear: number;
    race: number;
  }> = [];

  function parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') inQuotes = !inQuotes;
      else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  }

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const parts = parseCSVLine(line);
    if (parts.length < 22) continue;

    const fromYear = parseInt(parts[14], 10) || 0;
    const toYear = parseInt(parts[15], 10) || fromYear;
    if (fromYear === 0) continue;

    const pidStr = parts[8];
    const pid = pidStr ? parseInt(pidStr, 10) : null;

    players.push({
      lastName: parts[0] || '',
      firstName: parts[1] || '',
      position: parts[6] || '',
      pid: isNaN(pid!) ? null : pid,
      plpo: parts[11] || '',
      fromYear,
      toYear,
      race: parseInt(parts[21], 10) || 0
    });
  }

  return players;
}

/**
 * Generate portrait mapping for a year
 */
async function generatePortraitMapping(
  year: number,
  mode: 'draft' | 'roster' | 'both'
): Promise<MappingResult> {
  // Initialize services
  await recyclablePIDService.initialize();

  // Load player data
  const allPlayers = loadPlayerData();

  // Get recyclable entries with PLPO
  const recyclableEntries = recyclablePIDService.getRecyclableWithPLPO();

  // Sort: players first, then legends
  recyclableEntries.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'player' ? -1 : 1;
    return (a.plpo || '').localeCompare(b.plpo || '');
  });

  const usedPIDs = new Set<number>();

  function generateMappingForPlayers(players: typeof allPlayers): PortraitMapping[] {
    const mapping: PortraitMapping[] = [];

    // Sort by race for better matching
    players.sort((a, b) => {
      if (a.race !== b.race) return b.race - a.race;
      return `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`);
    });

    for (const player of players) {
      const fullName = `${player.firstName} ${player.lastName}`;

      // Check if has real portrait
      if (player.pid !== null && !recyclablePIDService.isRecyclable(player.pid)) {
        mapping.push({
          historicalPlayer: fullName,
          position: player.position,
          race: player.race,
          type: 'REAL',
          recyclablePLPO: player.plpo || null,
          ddsFilename: player.plpo ? `${player.plpo}.dds` : null,
          recycledFrom: 'Has own portrait'
        });
        continue;
      }

      // Find available recyclable
      const available = recyclableEntries.filter(r => !usedPIDs.has(r.pid));
      let match = available.find(r => r.race === player.race);
      if (!match && available.length > 0) {
        match = available[0];
      }

      if (match) {
        usedPIDs.add(match.pid);
        mapping.push({
          historicalPlayer: fullName,
          position: player.position,
          race: player.race,
          type: 'RECYCLABLE',
          recyclablePLPO: match.plpo,
          ddsFilename: match.ddsFilename,
          recycledFrom: match.playerName
        });
      } else {
        mapping.push({
          historicalPlayer: fullName,
          position: player.position,
          race: player.race,
          type: 'UNASSIGNED',
          recyclablePLPO: null,
          ddsFilename: null,
          recycledFrom: 'No slots available'
        });
      }
    }

    return mapping;
  }

  let draftClass: PortraitMapping[] | undefined;
  let roster: PortraitMapping[] | undefined;

  if (mode === 'draft' || mode === 'both') {
    const draftPlayers = allPlayers.filter(p => p.fromYear === year);
    draftClass = generateMappingForPlayers(draftPlayers);
  }

  if (mode === 'roster' || mode === 'both') {
    if (mode === 'both') usedPIDs.clear();
    const rosterPlayers = allPlayers.filter(p => p.fromYear <= year && p.toYear >= year);
    roster = generateMappingForPlayers(rosterPlayers);
  }

  const allMappings = [...(draftClass || []), ...(roster || [])];
  const realCount = allMappings.filter(m => m.type === 'REAL').length;
  const recyclableCount = allMappings.filter(m => m.type === 'RECYCLABLE').length;
  const unassignedCount = allMappings.filter(m => m.type === 'UNASSIGNED').length;

  return {
    year,
    draftClass,
    roster,
    summary: {
      totalPlayers: allMappings.length,
      realPortraits: realCount,
      recyclableAssigned: recyclableCount,
      unassigned: unassignedCount,
      recyclableRemaining: recyclablePIDService.getRecyclableCount() - usedPIDs.size
    }
  };
}

/**
 * Save mapping to files
 */
function saveMappingToFiles(result: MappingResult): { jsonPath: string; csvPath: string } {
  const outputDir = getDataPath('portrait-mappings');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Save JSON
  const jsonPath = path.join(outputDir, `${result.year}-portrait-mapping.json`);
  const jsonOutput = {
    year: result.year,
    generatedAt: new Date().toISOString(),
    summary: result.summary,
    draftClass: result.draftClass,
    roster: result.roster
  };
  fs.writeFileSync(jsonPath, JSON.stringify(jsonOutput, null, 2));

  // Save CSV
  const csvPath = path.join(outputDir, `${result.year}-portrait-mapping.csv`);
  const csvLines = ['Historical Player,Position,Race,Type,DDS Filename,Recycled From'];
  const allMappings = [...(result.draftClass || []), ...(result.roster || [])];

  const seen = new Set<string>();
  for (const m of allMappings) {
    if (seen.has(m.historicalPlayer)) continue;
    seen.add(m.historicalPlayer);

    csvLines.push([
      m.historicalPlayer,
      m.position,
      m.race,
      m.type,
      m.ddsFilename || '',
      m.recycledFrom || ''
    ].join(','));
  }

  fs.writeFileSync(csvPath, csvLines.join('\n'));

  return { jsonPath, csvPath };
}

/**
 * Register IPC handlers
 */
export function registerPortraitMappingHandlers(): void {
  // Initialize recyclable service
  ipcMain.handle('portrait-mapping:init', async () => {
    await recyclablePIDService.initialize();
    return recyclablePIDService.getStatus();
  });

  // Get recyclable count
  ipcMain.handle('portrait-mapping:getRecyclableCount', async () => {
    await recyclablePIDService.initialize();
    return {
      total: recyclablePIDService.getStatus().total,
      recyclable: recyclablePIDService.getRecyclableCount(),
      byType: {
        legends: recyclablePIDService.getRecyclableByType('legend').length,
        players: recyclablePIDService.getRecyclableByType('player').length
      }
    };
  });

  // Generate mapping for year
  ipcMain.handle('portrait-mapping:generate', async (_, year: number, mode: 'draft' | 'roster' | 'both') => {
    try {
      const result = await generatePortraitMapping(year, mode);
      const { jsonPath, csvPath } = saveMappingToFiles(result);

      return {
        success: true,
        result: result.summary,
        files: { jsonPath, csvPath }
      };
    } catch (error) {
      console.error('[PortraitMappingHandlers] Error generating mapping:', error);
      return {
        success: false,
        error: String(error)
      };
    }
  });

  // Get existing mapping for year
  ipcMain.handle('portrait-mapping:get', async (_, year: number) => {
    const jsonPath = getDataPath('portrait-mappings', `${year}-portrait-mapping.json`);
    if (!fs.existsSync(jsonPath)) {
      return { success: false, error: 'No mapping found for year' };
    }

    try {
      const content = fs.readFileSync(jsonPath, 'utf8');
      return {
        success: true,
        mapping: JSON.parse(content)
      };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  });

  // Get available years (years with mappings already generated)
  ipcMain.handle('portrait-mapping:getAvailableYears', async () => {
    const mappingDir = getDataPath('portrait-mappings');
    if (!fs.existsSync(mappingDir)) {
      return { success: true, years: [] };
    }

    const files = fs.readdirSync(mappingDir);
    const years = files
      .filter(f => f.endsWith('-portrait-mapping.json'))
      .map(f => parseInt(f.split('-')[0], 10))
      .filter(y => !isNaN(y))
      .sort((a, b) => a - b);

    return { success: true, years };
  });

  // ============================================
  // Portrait Import/Export Handlers
  // ============================================

  // Initialize portrait import service
  ipcMain.handle('portrait-import:init', async () => {
    await portraitImportService.initialize();
    return portraitImportService.getStatus();
  });

  // Import portraits from folder
  ipcMain.handle('portrait-import:importFromFolder', async (event, year: number, type: 'draft' | 'roster') => {
    try {
      // Show folder selection dialog
      const window = BrowserWindow.fromWebContents(event.sender);
      const result = await dialog.showOpenDialog(window!, {
        title: `Select Portrait Folder for ${year} ${type}`,
        properties: ['openDirectory'],
        defaultPath: `C:\\Users\\tshan\\Documents\\Portraits\\Player\\${year}${type === 'roster' ? 'R' : ''}`
      });

      if (result.canceled || !result.filePaths[0]) {
        return { success: false, canceled: true };
      }

      const folderPath = result.filePaths[0];
      const importResult = await portraitImportService.importFromFolder(folderPath, year, type);

      return {
        success: importResult.success,
        imported: importResult.imported.length,
        summary: importResult.summary,
        errors: importResult.errors
      };
    } catch (error) {
      console.error('[PortraitMappingHandlers] Import error:', error);
      return { success: false, error: String(error) };
    }
  });

  // Import from specific folder path (no dialog)
  ipcMain.handle('portrait-import:importFromPath', async (_, folderPath: string, year: number, type: 'draft' | 'roster') => {
    try {
      const importResult = await portraitImportService.importFromFolder(folderPath, year, type);
      return {
        success: importResult.success,
        imported: importResult.imported.length,
        summary: importResult.summary,
        errors: importResult.errors
      };
    } catch (error) {
      console.error('[PortraitMappingHandlers] Import error:', error);
      return { success: false, error: String(error) };
    }
  });

  // Get assignments for a year
  ipcMain.handle('portrait-import:getAssignments', async (_, year: number, type?: 'draft' | 'roster') => {
    await portraitImportService.initialize();
    const assignments = portraitImportService.getAssignments(year, type);
    return {
      success: true,
      count: assignments.length,
      assignments: assignments.map(a => ({
        historicalPlayer: a.historicalPlayer,
        assignedPLPO: a.assignedPLPO,
        assignedPID: a.assignedPID,
        race: a.race,
        raceMatch: a.raceMatch,
        position: a.position,
        sourceExists: fs.existsSync(a.sourceImagePath)
      }))
    };
  });

  // Update a single assignment
  ipcMain.handle('portrait-import:assignToSlot', async (_, historicalPlayer: string, year: number, type: 'draft' | 'roster', newPLPO: string) => {
    const success = portraitImportService.assignToSlot(historicalPlayer, year, type, newPLPO);
    return { success };
  });

  // Swap two assignments
  ipcMain.handle('portrait-import:swapAssignments', async (_, player1: string, player2: string, year: number, type: 'draft' | 'roster') => {
    const success = portraitImportService.swapAssignments(player1, player2, year, type);
    return { success };
  });

  // Auto-assign by race
  ipcMain.handle('portrait-import:autoAssignByRace', async (_, year: number, type: 'draft' | 'roster') => {
    const improved = portraitImportService.autoAssignByRace(year, type);
    return { success: true, improved };
  });

  // Get available slots
  ipcMain.handle('portrait-import:getAvailableSlots', async (_, year: number, type: 'draft' | 'roster', race?: number) => {
    await portraitImportService.initialize();
    const slots = portraitImportService.getAvailableSlots(year, type, race);
    return { success: true, slots };
  });

  // Clear assignments
  ipcMain.handle('portrait-import:clearAssignments', async (_, year: number, type?: 'draft' | 'roster') => {
    portraitImportService.clearAssignments(year, type);
    return { success: true };
  });

  // Export for Frosty
  ipcMain.handle('portrait-export:exportForFrosty', async (event, year: number, type?: 'draft' | 'roster') => {
    try {
      // Show folder selection dialog for output
      const window = BrowserWindow.fromWebContents(event.sender);
      const result = await dialog.showOpenDialog(window!, {
        title: `Select Output Folder for ${year} Portraits`,
        properties: ['openDirectory', 'createDirectory'],
        defaultPath: `C:\\Users\\tshan\\Documents\\Portraits\\Export`
      });

      if (result.canceled || !result.filePaths[0]) {
        return { success: false, canceled: true };
      }

      // Create year-specific subfolder
      const outputPath = path.join(result.filePaths[0], `${year}-${type || 'portraits'}`);
      const exportResult = await frostyPortraitExportService.exportForYear(year, outputPath, type);

      return {
        success: exportResult.success,
        outputPath: exportResult.outputPath,
        exportedCount: exportResult.exportedCount,
        errors: exportResult.errors
      };
    } catch (error) {
      console.error('[PortraitMappingHandlers] Export error:', error);
      return { success: false, error: String(error) };
    }
  });

  // Export to specific path (no dialog)
  ipcMain.handle('portrait-export:exportToPath', async (_, year: number, outputPath: string, type?: 'draft' | 'roster') => {
    try {
      const exportResult = await frostyPortraitExportService.exportForYear(year, outputPath, type);
      return {
        success: exportResult.success,
        outputPath: exportResult.outputPath,
        exportedCount: exportResult.exportedCount,
        errors: exportResult.errors
      };
    } catch (error) {
      console.error('[PortraitMappingHandlers] Export error:', error);
      return { success: false, error: String(error) };
    }
  });

  // Get export preview
  ipcMain.handle('portrait-export:getPreview', async (_, year: number, type?: 'draft' | 'roster') => {
    const preview = frostyPortraitExportService.getExportPreview(year, type);
    return { success: true, ...preview };
  });

  // Get manifest only
  ipcMain.handle('portrait-export:getManifest', async (_, year: number, type?: 'draft' | 'roster') => {
    const manifest = frostyPortraitExportService.createManifest(year, type);
    return { success: true, manifest };
  });

  console.log('[PortraitMappingHandlers] Registered');
}
