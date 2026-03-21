/**
 * File IPC Handlers
 *
 * IPC handlers for file operations (open, save, backup).
 * Handles native file dialogs and file system operations.
 *
 * Source: Custom implementation following Electron IPC best practices
 */

import { ipcMain, dialog, BrowserWindow } from 'electron';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * Handle: file:open-dialog
 * Open native file picker dialog
 */
ipcMain.handle('file:open-dialog', async (event, filters?: any[]) => {
  console.log('[file-handlers] ===== OPEN DIALOG REQUEST =====');

  try {
    // Get the window that sent the request to use as parent
    const win = BrowserWindow.fromWebContents(event.sender);
    console.log('[file-handlers] Window retrieved:', !!win);

    if (!win) {
      throw new Error('Could not get browser window from event sender');
    }

    console.log('[file-handlers] Showing open dialog...');

    let result;
    try {
      // Try minimal dialog options first
      result = await dialog.showOpenDialog({
        properties: ['openFile']
      });
      console.log('[file-handlers] Dialog closed successfully');
    } catch (dialogError: any) {
      console.error('[file-handlers] ===== DIALOG ERROR =====');
      console.error('[file-handlers] Error:', dialogError);
      console.error('[file-handlers] Message:', dialogError.message);
      console.error('[file-handlers] Stack:', dialogError.stack);
      console.error('[file-handlers] ===========================');
      throw dialogError;
    }

    console.log('[file-handlers] Dialog result - canceled:', result.canceled);

    if (result.canceled || result.filePaths.length === 0) {
      return {
        success: false,
        canceled: true
      };
    }

    const filePath = result.filePaths[0];
    console.log('[file-handlers] File selected:', filePath);

    return {
      success: true,
      filePath: filePath
    };

  } catch (error: any) {
    console.error('[file-handlers] Error opening file dialog:', error);

    return {
      success: false,
      error: error.message || 'Failed to open file dialog'
    };
  }
});

/**
 * Handle: file:save-dialog
 * Open native save file dialog
 */
ipcMain.handle('file:save-dialog', async (event, defaultPath?: string) => {
  try {
    // Don't pass window on Windows - causes crash
    const result = await dialog.showSaveDialog({
      defaultPath: defaultPath,
      filters: [
        { name: 'All Files', extensions: ['*'] }
      ]
    });

    if (result.canceled || !result.filePath) {
      return {
        success: false,
        canceled: true
      };
    }

    console.log('[file-handlers] Save location selected:', result.filePath);

    return {
      success: true,
      filePath: result.filePath
    };

  } catch (error: any) {
    console.error('[file-handlers] Error opening save dialog:', error);

    return {
      success: false,
      error: error.message || 'Failed to open save dialog'
    };
  }
});

/**
 * Handle: file:create-backup
 * Create a backup copy of a file before saving
 */
ipcMain.handle('file:create-backup', async (event, filePath: string) => {
  try {
    console.log('[file-handlers] Creating backup of:', filePath);

    // Check if file exists
    try {
      await fs.access(filePath);
    } catch {
      console.log('[file-handlers] File does not exist yet, skipping backup');
      return {
        success: true,
        skipped: true
      };
    }

    // Create backup filename
    const dir = path.dirname(filePath);
    const ext = path.extname(filePath);
    const base = path.basename(filePath, ext);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const backupPath = path.join(dir, `${base}.backup.${timestamp}${ext}`);

    // Copy file to backup
    await fs.copyFile(filePath, backupPath);

    console.log('[file-handlers] Backup created:', backupPath);

    return {
      success: true,
      backupPath: backupPath
    };

  } catch (error: any) {
    console.error('[file-handlers] Error creating backup:', error);

    return {
      success: false,
      error: error.message || 'Failed to create backup'
    };
  }
});

/**
 * Handle: file:read
 * Read a file's contents
 */
ipcMain.handle('file:read', async (event, filePath: string) => {
  try {
    const data = await fs.readFile(filePath);

    return {
      success: true,
      data: data
    };

  } catch (error: any) {
    console.error('[file-handlers] Error reading file:', error);

    return {
      success: false,
      error: error.message || 'Failed to read file'
    };
  }
});

/**
 * Handle: file:write
 * Write data to a file
 */
ipcMain.handle('file:write', async (event, filePath: string, data: Buffer | string) => {
  try {
    await fs.writeFile(filePath, data);

    console.log('[file-handlers] File written:', filePath);

    return {
      success: true
    };

  } catch (error: any) {
    console.error('[file-handlers] Error writing file:', error);

    return {
      success: false,
      error: error.message || 'Failed to write file'
    };
  }
});

/**
 * Handle: file:exists
 * Check if a file exists
 */
ipcMain.handle('file:exists', async (event, filePath: string) => {
  try {
    await fs.access(filePath);
    return {
      success: true,
      exists: true
    };
  } catch {
    return {
      success: true,
      exists: false
    };
  }
});

/**
 * Handle: file:get-data-path
 * Get the absolute path to a file in the data directory
 */
ipcMain.handle('file:get-data-path', async (event, relativePath: string) => {
  try {
    const { app } = require('electron');
    const path = require('path');

    // Check multiple locations (dev vs packaged)
    const possiblePaths = [
      path.join(app.getAppPath(), 'data', relativePath),
      path.join(app.getAppPath(), '..', '..', 'data', relativePath),
      path.join(process.cwd(), 'data', relativePath)
    ];

    for (const testPath of possiblePaths) {
      try {
        await fs.access(testPath);
        return testPath.replace(/\\/g, '/'); // Normalize for file:// URLs
      } catch {
        // Try next path
      }
    }

    // Return first path as fallback
    return possiblePaths[0].replace(/\\/g, '/');
  } catch (error: any) {
    console.error('[file-handlers] Error getting data path:', error);
    return '';
  }
});

console.log('[file-handlers] File IPC handlers registered');
