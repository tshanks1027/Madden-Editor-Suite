/**
 * Frosty Export IPC Handlers
 *
 * Handles IPC communication for FMT export functionality
 */

import { ipcMain, dialog } from 'electron';
import { frostyExportService } from '../services/FrostyExportService';

interface PlayerExportData {
  firstName: string;
  lastName: string;
  pid: string;
  race?: number;
  team?: string;
}

export function registerFrostyHandlers(): void {
  /**
   * Export a single player for FMT import
   */
  ipcMain.handle('frosty:export-player', async (_event, player: PlayerExportData, outputDir: string) => {
    console.log(`[FrostyHandlers] Exporting player: ${player.firstName} ${player.lastName}`);
    return await frostyExportService.exportPlayer(player, outputDir);
  });

  /**
   * Export multiple players for FMT import (batch mode)
   */
  ipcMain.handle('frosty:export-batch', async (_event, players: PlayerExportData[], outputDir: string) => {
    console.log(`[FrostyHandlers] Batch exporting ${players.length} players`);
    return await frostyExportService.exportBatch(players, outputDir);
  });

  /**
   * Get generic face prefix for a race code
   */
  ipcMain.handle('frosty:get-generic-face', async (_event, race: number) => {
    return frostyExportService.getGenericFacePrefix(race);
  });

  /**
   * Open folder dialog for export destination
   */
  ipcMain.handle('frosty:select-output-folder', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Select Export Folder',
      properties: ['openDirectory', 'createDirectory'],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return result.filePaths[0];
  });

  /**
   * Generate portrait name for a player (for preview)
   */
  ipcMain.handle('frosty:generate-portrait-name', async (_event, firstName: string, lastName: string) => {
    const combined = (lastName + firstName).toLowerCase().replace(/[^a-z]/g, '');
    if (combined.length === 12) {
      return combined;
    } else if (combined.length < 12) {
      return combined + 'x'.repeat(12 - combined.length);
    } else {
      return combined.substring(0, 12);
    }
  });

  console.log('[FrostyHandlers] Registered Frosty export handlers');
}
