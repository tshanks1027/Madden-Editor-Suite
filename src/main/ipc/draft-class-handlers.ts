/**
 * Draft Class IPC Handlers
 *
 * IPC handlers for draft class file operations.
 * Communicates between renderer process and DraftClassService.
 *
 * Source: Following pattern from parser-handlers.ts and lookup-handlers.ts
 */

import { ipcMain } from 'electron';
import { draftClassService } from '../services/DraftClassService';

/**
 * Handle: draft-class:load
 * Load and parse a draft class file
 */
ipcMain.handle('draft-class:load', async (event, filePath: string) => {
  console.log('[draft-class-handlers] ===== IPC LOAD REQUEST =====');
  console.log('[draft-class-handlers] File path received:', filePath);

  try {
    const result = await draftClassService.loadDraftClass(filePath);
    console.log('[draft-class-handlers] Load successful, prospect count:', result.data.prospects.length);

    return {
      success: true,
      data: result.data
    };

  } catch (error: any) {
    console.error('[draft-class-handlers] ===== IPC LOAD ERROR =====');
    console.error('[draft-class-handlers] Error:', error);
    console.error('[draft-class-handlers] Stack:', error.stack);
    console.error('[draft-class-handlers] ===============================');

    return {
      success: false,
      error: error.message || 'Unknown error loading draft class'
    };
  }
});

/**
 * Handle: draft-class:save
 * Save modified draft class file
 */
ipcMain.handle('draft-class:save', async (event, filePath: string, draftClassData: any) => {
  console.log('[draft-class-handlers] ===== IPC SAVE REQUEST =====');
  console.log('[draft-class-handlers] File path:', filePath);
  console.log('[draft-class-handlers] Prospect count:', draftClassData.prospects.length);

  try {
    const success = await draftClassService.saveDraftClass(filePath, draftClassData);

    console.log('[draft-class-handlers] Save successful');

    return {
      success: true
    };

  } catch (error: any) {
    console.error('[draft-class-handlers] ===== IPC SAVE ERROR =====');
    console.error('[draft-class-handlers] Error:', error);
    console.error('[draft-class-handlers] Stack:', error.stack);
    console.error('[draft-class-handlers] ===============================');

    return {
      success: false,
      error: error.message || 'Unknown error saving draft class'
    };
  }
});

/**
 * Handle: draft-class:export-json
 * Export draft class to JSON file
 */
ipcMain.handle('draft-class:export-json', async (event, filePath: string, outputPath: string) => {
  console.log('[draft-class-handlers] ===== IPC EXPORT JSON REQUEST =====');
  console.log('[draft-class-handlers] Source:', filePath);
  console.log('[draft-class-handlers] Output:', outputPath);

  try {
    const success = await draftClassService.exportToJSON(filePath, outputPath);

    console.log('[draft-class-handlers] Export successful');

    return {
      success: true
    };

  } catch (error: any) {
    console.error('[draft-class-handlers] ===== IPC EXPORT ERROR =====');
    console.error('[draft-class-handlers] Error:', error);
    console.error('[draft-class-handlers] Stack:', error.stack);
    console.error('[draft-class-handlers] ===============================');

    return {
      success: false,
      error: error.message || 'Unknown error exporting draft class'
    };
  }
});

/**
 * Handle: draft-class:validate
 * Validate draft class file format
 */
ipcMain.handle('draft-class:validate', async (event, filePath: string) => {
  console.log('[draft-class-handlers] ===== IPC VALIDATE REQUEST =====');
  console.log('[draft-class-handlers] File path:', filePath);

  try {
    const validation = await draftClassService.validateDraftClass(filePath);

    if (validation.valid) {
      console.log('[draft-class-handlers] Validation passed');
    } else {
      console.log('[draft-class-handlers] Validation failed:', validation.error);
    }

    return validation;

  } catch (error: any) {
    console.error('[draft-class-handlers] ===== IPC VALIDATE ERROR =====');
    console.error('[draft-class-handlers] Error:', error);
    console.error('[draft-class-handlers] ===============================');

    return {
      valid: false,
      error: error.message || 'Unknown error validating draft class'
    };
  }
});

/**
 * Handle: draft-class:get-info
 * Get draft class file metadata
 */
ipcMain.handle('draft-class:get-info', async (event, filePath: string) => {
  console.log('[draft-class-handlers] ===== IPC GET INFO REQUEST =====');
  console.log('[draft-class-handlers] File path:', filePath);

  try {
    const info = await draftClassService.getDraftClassInfo(filePath);

    if (info.valid) {
      console.log('[draft-class-handlers] Info retrieved successfully');
      console.log('[draft-class-handlers] Prospects:', info.prospectCount);
    } else {
      console.log('[draft-class-handlers] Failed to get info:', info.error);
    }

    return info;

  } catch (error: any) {
    console.error('[draft-class-handlers] ===== IPC GET INFO ERROR =====');
    console.error('[draft-class-handlers] Error:', error);
    console.error('[draft-class-handlers] ===============================');

    return {
      valid: false,
      error: error.message || 'Unknown error getting draft class info'
    };
  }
});

console.log('[draft-class-handlers] Draft Class IPC handlers registered');
