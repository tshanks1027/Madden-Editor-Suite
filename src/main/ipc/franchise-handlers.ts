/**
 * Franchise File IPC Handlers
 * Handles loading, parsing, and saving franchise files
 */

import { ipcMain, dialog } from 'electron';
import * as path from 'path';

const Franchise = require('madden-franchise');

ipcMain.handle('franchise:select-file', async (event) => {
  const result = await dialog.showOpenDialog({
    title: 'Select Franchise File',
    filters: [
      { name: 'All Files', extensions: ['*'] }
    ],
    properties: ['openFile'],
    modal: true
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return result.filePaths[0];
});

ipcMain.handle('franchise:load-file', async (_event, filePath: string) => {
  console.log('[Franchise] Loading file:', filePath);

  try {
    const franchise = new Franchise(filePath);

    // Open the franchise file
    await new Promise((resolve, reject) => {
      franchise.on('ready', resolve);
      franchise.on('error', reject);
    });

    console.log('[Franchise] File loaded successfully');
    console.log('[Franchise] Game year:', franchise.schema?.meta?.gameYear);
    console.log('[Franchise] Tables count:', franchise.tables?.length || 0);

    // Get basic metadata
    const metadata = {
      filePath,
      fileName: path.basename(filePath),
      schemaVersion: franchise.schema?.meta?.major + '.' + franchise.schema?.meta?.minor,
      gameYear: franchise.schema?.meta?.gameYear,
      tables: franchise.tables ? franchise.tables.map((t: any) => t.name) : []
    };

    return {
      success: true,
      metadata
    };
  } catch (error: any) {
    console.error('[Franchise] Error loading file:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

ipcMain.handle('franchise:get-table-data', async (_event, filePath: string, tableName: string) => {
  console.log('[Franchise] Getting table data:', tableName);

  try {
    const franchise = new Franchise(filePath);

    await new Promise((resolve, reject) => {
      franchise.on('ready', resolve);
      franchise.on('error', reject);
    });

    // Get ALL tables with this name (not just the first one)
    const tables = franchise.getAllTablesByName ? franchise.getAllTablesByName(tableName) : [franchise.getTableByName(tableName)];

    if (!tables || tables.length === 0) {
      throw new Error(`Table ${tableName} not found`);
    }

    console.log('[Franchise] Found', tables.length, 'table(s) with name', tableName);

    let allRecords: any[] = [];

    // Read records from all table instances
    for (const table of tables) {
      if (!table) continue;

      // Read all records
      await table.readRecords();

      // Filter out empty records and extract plain data
      const activeRecords = table.records
        .filter((r: any) => !r.isEmpty)
        .map((record: any) => {
          const data: any = {};
          table.schema.attributes.forEach((attr: any) => {
            data[attr.name] = record[attr.name];
          });
          return data;
        });

      allRecords = allRecords.concat(activeRecords);
    }

    console.log('[Franchise] Retrieved', allRecords.length, 'total active records from', tableName);

    return {
      success: true,
      records: allRecords,
      count: allRecords.length
    };
  } catch (error: any) {
    console.error('[Franchise] Error getting table data:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

ipcMain.handle('franchise:save-file', async (_event, filePath: string, savePath: string) => {
  console.log('[Franchise] Saving file to:', savePath);

  try {
    const franchise = new Franchise(filePath);

    await new Promise((resolve, reject) => {
      franchise.on('ready', resolve);
      franchise.on('error', reject);
    });

    // Save the franchise file
    await new Promise((resolve, reject) => {
      franchise.save(savePath, (err: any) => {
        if (err) reject(err);
        else resolve(true);
      });
    });

    console.log('[Franchise] File saved successfully');

    return {
      success: true
    };
  } catch (error: any) {
    console.error('[Franchise] Error saving file:', error);
    return {
      success: false,
      error: error.message
    };
  }
});
