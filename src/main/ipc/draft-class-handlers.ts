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
ipcMain.handle('draft-class:save', async (event, savePath: string, draftClassData: any) => {
  console.log('[draft-class-handlers] ===== IPC SAVE REQUEST =====');
  console.log('[draft-class-handlers] Save path:', savePath);
  console.log('[draft-class-handlers] Prospect count:', draftClassData.prospects.length);
  console.log('[draft-class-handlers] Version:', draftClassData._version);

  // Debug: Log first 5 prospects RECEIVED from frontend to trace genericHeadName
  const fs = require('fs');
  const os = require('os');
  const path = require('path');
  const traceFile = path.join(os.tmpdir(), 'draft-save-trace.txt');
  const traceLines: string[] = [];
  traceLines.push(`\n${'='.repeat(80)}`);
  traceLines.push(`DRAFT SAVE TRACE - ${new Date().toISOString()}`);
  traceLines.push(`${'='.repeat(80)}`);
  traceLines.push(`Save path: ${savePath}`);
  traceLines.push(`Prospect count: ${draftClassData.prospects.length}`);
  traceLines.push(`Version: ${draftClassData._version}`);

  for (let i = 0; i < Math.min(5, draftClassData.prospects.length); i++) {
    const p = draftClassData.prospects[i];
    traceLines.push(`\n--- Prospect ${i + 1}: ${p.firstName} ${p.lastName} ---`);
    traceLines.push(`  PEPS: "${p.PEPS}" (type: ${typeof p.PEPS})`);
    traceLines.push(`  assignedGenr: "${p.assignedGenr}" (type: ${typeof p.assignedGenr})`);
    traceLines.push(`  Has visuals: ${!!p.visuals}`);
    if (p.visuals) {
      traceLines.push(`  visuals.genericHeadName: "${p.visuals.genericHeadName}" (type: ${typeof p.visuals.genericHeadName})`);
      traceLines.push(`  visuals.skinTone: ${p.visuals.skinTone}`);
      traceLines.push(`  visuals.bodyType: ${p.visuals.bodyType}`);
    } else {
      traceLines.push(`  *** VISUALS IS UNDEFINED - THIS IS THE BUG! ***`);
    }
  }

  fs.writeFileSync(traceFile, traceLines.join('\n'));
  console.log('[draft-class-handlers] Trace written to:', traceFile);

  // Also log to console
  if (draftClassData.prospects.length > 0) {
    console.log('[draft-class-handlers] First prospect RECEIVED from frontend:');
    console.log('  firstName:', draftClassData.prospects[0].firstName);
    console.log('  lastName:', draftClassData.prospects[0].lastName);
    console.log('  PEPS:', draftClassData.prospects[0].PEPS);
    console.log('  bodyType:', draftClassData.prospects[0].bodyType);
    console.log('  Has visuals?:', !!draftClassData.prospects[0].visuals);
    if (draftClassData.prospects[0].visuals) {
      console.log('  visuals.genericHeadName:', draftClassData.prospects[0].visuals.genericHeadName);
    }
  }

  try {
    // Use the draft class data passed from frontend (already contains header, buffer, prospects)
    // No need to reload from disk - this prevents data loss when saving over same file
    const success = await draftClassService.saveDraftClass(savePath, draftClassData);

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

/**
 * Handle: draft-class:convert-m25-to-m26
 * Convert M25 draft class to M26 format
 */
ipcMain.handle('draft-class:convert-m25-to-m26', async (event, inputPath: string, outputPath: string, templatePath: string) => {
  console.log('[draft-class-handlers] ===== IPC CONVERT M25 TO M26 REQUEST =====');
  console.log('[draft-class-handlers] Input:', inputPath);
  console.log('[draft-class-handlers] Output:', outputPath);
  console.log('[draft-class-handlers] Template:', templatePath);

  try {
    const result = await draftClassService.convertM25toM26(inputPath, outputPath, templatePath);

    if (result.success) {
      console.log('[draft-class-handlers] Conversion successful');
    } else {
      console.log('[draft-class-handlers] Conversion failed:', result.error);
    }

    return result;

  } catch (error: any) {
    console.error('[draft-class-handlers] ===== IPC CONVERT ERROR =====');
    console.error('[draft-class-handlers] Error:', error);
    console.error('[draft-class-handlers] ===============================');

    return {
      success: false,
      error: error.message || 'Unknown error converting draft class'
    };
  }
});

/**
 * Handle: draft-class:load-template
 * Load the default M26 template file from data/Templates/
 */
ipcMain.handle('draft-class:load-template', async () => {
  console.log('[draft-class-handlers] ===== IPC LOAD TEMPLATE REQUEST =====');

  try {
    const { app } = require('electron');
    const path = require('path');
    const fs = require('fs');

    // Get the template file path
    // Both dev and prod use the same relative path from appPath
    // In development: <appPath>/.vite/build/data/Templates/CAREERDRAFT-2026Template
    // In production: resources/app/.vite/build/data/Templates/CAREERDRAFT-2026Template
    const appPath = app.getAppPath();
    const templatePath = path.join(appPath, '.vite', 'build', 'data', 'Templates', 'CAREERDRAFT-2026Template');

    console.log('[draft-class-handlers] Template path:', templatePath);
    console.log('[draft-class-handlers] Template exists:', fs.existsSync(templatePath));

    if (!fs.existsSync(templatePath)) {
      throw new Error(`Template file not found at: ${templatePath}`);
    }

    // Load the template using the draft class service
    const templateData = await draftClassService.loadDraftClass(templatePath);

    console.log('[draft-class-handlers] Template loaded successfully');
    console.log('[draft-class-handlers] Template version:', templateData.data._version);
    console.log('[draft-class-handlers] Template buffer size:', templateData.data._originalBuffer?.length || 0);

    return templateData;

  } catch (error: any) {
    console.error('[draft-class-handlers] ===== IPC LOAD TEMPLATE ERROR =====');
    console.error('[draft-class-handlers] Error:', error);
    console.error('[draft-class-handlers] ===============================');

    return {
      success: false,
      error: error.message || 'Unknown error loading template'
    };
  }
});

console.log('[draft-class-handlers] Draft Class IPC handlers registered');
