/**
 * IPC Handlers for Custom Coach Portrait Management
 *
 * Handles communication between renderer and main process for:
 * - Importing coach portrait images
 * - Getting portrait data for display
 * - Exporting portraits as DDS files
 * - Managing portrait metadata
 */

import { ipcMain, dialog, BrowserWindow } from 'electron';
import { customCoachPortraitService } from '../services/CustomCoachPortraitService';

export function registerCustomCoachPortraitHandlers(): void {
  console.log('[CustomCoachPortraitHandlers] Registering handlers...');

  /**
   * Import a coach portrait from a file path
   */
  ipcMain.handle('custom-coach-portrait:import', async (_, filePath: string, metadata?: { coachName?: string; year?: number }) => {
    console.log('[CustomCoachPortraitHandlers] Importing portrait:', filePath);
    const result = await customCoachPortraitService.importPortrait(filePath, metadata);
    return result;
  });

  /**
   * Import coach portrait with file picker dialog
   */
  ipcMain.handle('custom-coach-portrait:import-dialog', async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);

    const result = await dialog.showOpenDialog(window!, {
      title: 'Import Coach Portrait',
      filters: [
        { name: 'Images', extensions: ['png', 'jpg', 'jpeg'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      properties: ['openFile']
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, canceled: true };
    }

    const importResult = await customCoachPortraitService.importPortrait(result.filePaths[0]);
    return importResult;
  });

  /**
   * Import multiple coach portraits with file picker dialog
   */
  ipcMain.handle('custom-coach-portrait:import-multiple-dialog', async (event, metadata?: { year?: number }) => {
    const window = BrowserWindow.fromWebContents(event.sender);

    const result = await dialog.showOpenDialog(window!, {
      title: 'Import Coach Portraits',
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
      const importResult = await customCoachPortraitService.importPortrait(filePath, metadata);
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
  ipcMain.handle('custom-coach-portrait:get', async (_, pid: number) => {
    const dataUrl = await customCoachPortraitService.getPortraitDataUrl(pid);
    return dataUrl;
  });

  /**
   * Get all custom coach portraits (metadata only)
   */
  ipcMain.handle('custom-coach-portrait:list', async () => {
    const portraits = customCoachPortraitService.getAllPortraits();
    return portraits;
  });

  /**
   * Get coach portraits by year
   */
  ipcMain.handle('custom-coach-portrait:list-by-year', async (_, year: number) => {
    const portraits = customCoachPortraitService.getPortraitsByYear(year);
    return portraits;
  });

  /**
   * Delete a coach portrait
   */
  ipcMain.handle('custom-coach-portrait:delete', async (_, pid: number) => {
    customCoachPortraitService.deletePortrait(pid);
    return { success: true };
  });

  /**
   * Update coach portrait metadata
   */
  ipcMain.handle('custom-coach-portrait:update-metadata', async (_, pid: number, metadata: { coachName?: string; databaseCoachId?: number; year?: number }) => {
    customCoachPortraitService.updateMetadata(pid, metadata);
    return { success: true };
  });

  /**
   * Export single coach portrait as DDS
   */
  ipcMain.handle('custom-coach-portrait:export-dds', async (event, pid: number) => {
    const window = BrowserWindow.fromWebContents(event.sender);

    const result = await dialog.showOpenDialog(window!, {
      title: 'Select Export Folder',
      properties: ['openDirectory', 'createDirectory']
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, canceled: true };
    }

    const exportResult = await customCoachPortraitService.exportAsDds(pid, result.filePaths[0]);
    return exportResult;
  });

  /**
   * Export multiple coach portraits as DDS files
   */
  ipcMain.handle('custom-coach-portrait:export-batch', async (event, pids: number[]) => {
    const window = BrowserWindow.fromWebContents(event.sender);

    const result = await dialog.showOpenDialog(window!, {
      title: 'Select Export Folder',
      properties: ['openDirectory', 'createDirectory']
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, canceled: true };
    }

    const exportResult = await customCoachPortraitService.exportBatch(pids, result.filePaths[0]);
    return exportResult;
  });

  /**
   * Export all coach portraits
   */
  ipcMain.handle('custom-coach-portrait:export-all', async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);

    const result = await dialog.showOpenDialog(window!, {
      title: 'Select Export Folder',
      properties: ['openDirectory', 'createDirectory']
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, canceled: true };
    }

    const portraits = customCoachPortraitService.getAllPortraits();
    const pids = portraits.map(p => p.pid);
    const exportResult = await customCoachPortraitService.exportBatch(pids, result.filePaths[0]);
    return exportResult;
  });

  /**
   * Get next available PID
   */
  ipcMain.handle('custom-coach-portrait:get-next-pid', async () => {
    const pid = customCoachPortraitService.getNextPid();
    return pid;
  });

  /**
   * Check if portrait exists
   */
  ipcMain.handle('custom-coach-portrait:has', async (_, pid: number) => {
    const exists = customCoachPortraitService.hasPortrait(pid);
    return exists;
  });

  /**
   * Get portrait count
   */
  ipcMain.handle('custom-coach-portrait:count', async () => {
    const count = customCoachPortraitService.getPortraitCount();
    return count;
  });

  /**
   * Get custom coach portrait PID by database coach ID
   */
  ipcMain.handle('custom-coach-portrait:get-by-coach-id', async (_, coachId: number) => {
    try {
      const pid = customCoachPortraitService.getPortraitByCoachId(coachId);
      return pid;
    } catch (error) {
      console.error('[CustomCoachPortraitHandlers] Error getting portrait by coach ID:', error);
      return null;
    }
  });

  /**
   * Get available years that have custom coach portraits
   */
  ipcMain.handle('custom-coach-portrait:get-available-years', async () => {
    return customCoachPortraitService.getAvailableYears();
  });

  console.log('[CustomCoachPortraitHandlers] Handlers registered');
}
