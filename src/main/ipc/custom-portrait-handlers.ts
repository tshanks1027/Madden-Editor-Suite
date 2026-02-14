/**
 * IPC Handlers for Custom Portrait Management
 *
 * Handles communication between renderer and main process for:
 * - Importing portrait images
 * - Getting portrait data for display
 * - Exporting portraits as DDS files
 * - Managing portrait metadata
 */

import { ipcMain, dialog, BrowserWindow } from 'electron';
import path from 'path';
import { customPortraitService } from '../services/CustomPortraitService';

export function registerCustomPortraitHandlers(): void {
  console.log('[CustomPortraitHandlers] Registering handlers...');

  /**
   * Import a portrait from a file path
   */
  ipcMain.handle('custom-portrait:import', async (_, filePath: string, metadata?: { playerName?: string; year?: number }) => {
    console.log('[CustomPortraitHandlers] Importing portrait:', filePath);
    const result = await customPortraitService.importPortrait(filePath, metadata);
    return result;
  });

  /**
   * Import portrait with file picker dialog
   */
  ipcMain.handle('custom-portrait:import-dialog', async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);

    const result = await dialog.showOpenDialog(window!, {
      title: 'Import Portrait',
      filters: [
        { name: 'Images', extensions: ['png', 'jpg', 'jpeg'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      properties: ['openFile']
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, canceled: true };
    }

    // Extract year from filename if present
    const filePath = result.filePaths[0];
    const filename = path.basename(filePath);
    const yearMatch = filename.match(/\b(19[6-9]\d|20[0-2]\d)\b/);
    const metadata = yearMatch ? { year: parseInt(yearMatch[1], 10) } : undefined;

    const importResult = await customPortraitService.importPortrait(filePath, metadata);
    return importResult;
  });

  /**
   * Import multiple portraits with file picker dialog
   */
  ipcMain.handle('custom-portrait:import-multiple-dialog', async (event, metadata?: { year?: number }) => {
    const window = BrowserWindow.fromWebContents(event.sender);

    const result = await dialog.showOpenDialog(window!, {
      title: 'Import Portraits',
      filters: [
        { name: 'Images', extensions: ['png', 'jpg', 'jpeg'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      properties: ['openFile', 'multiSelections']
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, canceled: true, imported: 0 };
    }

    const results: { pid: number; filename: string }[] = [];
    const errors: string[] = [];

    for (const filePath of result.filePaths) {
      // Extract year from filename if not provided in metadata
      // Look for 4-digit years like 1976, 2024 in the filename
      let fileMetadata = { ...metadata };
      if (!fileMetadata.year) {
        const filename = path.basename(filePath);
        const yearMatch = filename.match(/\b(19[6-9]\d|20[0-2]\d)\b/);
        if (yearMatch) {
          fileMetadata.year = parseInt(yearMatch[1], 10);
        }
      }

      const importResult = await customPortraitService.importPortrait(filePath, fileMetadata);
      if (importResult.success && importResult.pid) {
        results.push({ pid: importResult.pid, filename: filePath });
      } else {
        errors.push(`${filePath}: ${importResult.error}`);
      }
    }

    return {
      success: errors.length === 0,
      imported: results.length,
      results,
      errors
    };
  });

  /**
   * Get portrait data URL for display (base64 PNG)
   */
  ipcMain.handle('custom-portrait:get', async (_, pid: number) => {
    const dataUrl = await customPortraitService.getPortraitDataUrl(pid);
    return dataUrl;
  });

  /**
   * Get all custom portraits (metadata only)
   */
  ipcMain.handle('custom-portrait:list', async () => {
    const portraits = customPortraitService.getAllPortraits();
    return portraits;
  });

  /**
   * Get portraits by year
   */
  ipcMain.handle('custom-portrait:list-by-year', async (_, year: number) => {
    const portraits = customPortraitService.getPortraitsByYear(year);
    return portraits;
  });

  /**
   * Delete a portrait
   */
  ipcMain.handle('custom-portrait:delete', async (_, pid: number) => {
    customPortraitService.deletePortrait(pid);
    return { success: true };
  });

  /**
   * Update portrait metadata
   */
  ipcMain.handle('custom-portrait:update-metadata', async (_, pid: number, metadata: { playerName?: string; databasePlayerId?: number; year?: number }) => {
    customPortraitService.updateMetadata(pid, metadata);
    return { success: true };
  });

  /**
   * Export single portrait as DDS
   */
  ipcMain.handle('custom-portrait:export-dds', async (event, pid: number) => {
    const window = BrowserWindow.fromWebContents(event.sender);

    const result = await dialog.showOpenDialog(window!, {
      title: 'Select Export Folder',
      properties: ['openDirectory', 'createDirectory']
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, canceled: true };
    }

    const exportResult = await customPortraitService.exportAsDds(pid, result.filePaths[0]);
    return exportResult;
  });

  /**
   * Export single portrait to specific path
   */
  ipcMain.handle('custom-portrait:export-dds-to-path', async (_, pid: number, outputPath: string) => {
    const result = await customPortraitService.exportAsDds(pid, outputPath);
    return result;
  });

  /**
   * Export multiple portraits as DDS files
   */
  ipcMain.handle('custom-portrait:export-batch', async (event, pids: number[]) => {
    const window = BrowserWindow.fromWebContents(event.sender);

    const result = await dialog.showOpenDialog(window!, {
      title: 'Select Export Folder',
      properties: ['openDirectory', 'createDirectory']
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, canceled: true };
    }

    const exportResult = await customPortraitService.exportBatch(pids, result.filePaths[0]);
    return exportResult;
  });

  /**
   * Export all portraits for a year
   */
  ipcMain.handle('custom-portrait:export-by-year', async (event, year: number) => {
    const window = BrowserWindow.fromWebContents(event.sender);

    const result = await dialog.showOpenDialog(window!, {
      title: 'Select Export Folder',
      properties: ['openDirectory', 'createDirectory']
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, canceled: true };
    }

    const exportResult = await customPortraitService.exportByYear(year, result.filePaths[0]);
    return exportResult;
  });

  /**
   * Export all portraits
   */
  ipcMain.handle('custom-portrait:export-all', async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);

    const result = await dialog.showOpenDialog(window!, {
      title: 'Select Export Folder',
      properties: ['openDirectory', 'createDirectory']
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, canceled: true };
    }

    const portraits = customPortraitService.getAllPortraits();
    const pids = portraits.map(p => p.pid);
    const exportResult = await customPortraitService.exportBatch(pids, result.filePaths[0]);
    return exportResult;
  });

  /**
   * Get next available PID
   */
  ipcMain.handle('custom-portrait:get-next-pid', async () => {
    const pid = customPortraitService.getNextPid();
    return pid;
  });

  /**
   * Check if portrait exists
   */
  ipcMain.handle('custom-portrait:has', async (_, pid: number) => {
    const exists = customPortraitService.hasPortrait(pid);
    return exists;
  });

  /**
   * Get portrait count
   */
  ipcMain.handle('custom-portrait:count', async () => {
    const count = customPortraitService.getPortraitCount();
    return count;
  });

  /**
   * Get custom portrait PID by database player ID
   * Returns the PID if a custom portrait is assigned to this player, null otherwise
   */
  ipcMain.handle('custom-portrait:get-by-player-id', async (_, playerId: number) => {
    try {
      const pid = customPortraitService.getPortraitByPlayerId(playerId);
      return pid;
    } catch (error) {
      console.error('[CustomPortraitHandlers] Error getting portrait by player ID:', error);
      return null;
    }
  });

  /**
   * Get custom portrait PID by player name
   * Searches for portraits with matching player_name (case-insensitive)
   * Used by generators to find custom portraits when loading historical players
   */
  ipcMain.handle('custom-portrait:get-by-name', async (_, firstName: string, lastName: string) => {
    try {
      const pid = customPortraitService.getPortraitByName(firstName, lastName);
      return pid;
    } catch (error) {
      console.error('[CustomPortraitHandlers] Error getting portrait by name:', error);
      return null;
    }
  });

  /**
   * Generate sprite sheets from custom portraits
   * Creates PNG sprite sheets and atlas JSON for distribution
   */
  ipcMain.handle('custom-portrait:generate-sprite-sheets', async (event, options?: { year?: number; prefix?: string }) => {
    const window = BrowserWindow.fromWebContents(event.sender);

    const result = await dialog.showOpenDialog(window!, {
      title: 'Select Output Folder for Sprite Sheets',
      properties: ['openDirectory', 'createDirectory']
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, canceled: true };
    }

    const generateResult = await customPortraitService.generateSpriteSheets(result.filePaths[0], options);
    return generateResult;
  });

  /**
   * Get available years that have custom portraits
   */
  ipcMain.handle('custom-portrait:get-available-years', async () => {
    return customPortraitService.getAvailableYears();
  });

  console.log('[CustomPortraitHandlers] Handlers registered');
}
