/**
 * Portrait IPC Handlers
 *
 * IPC handlers for portrait/face image operations.
 * Provides access to player portrait images from sprite sheets.
 */

import { ipcMain, BrowserWindow, dialog } from 'electron';
import fs from 'fs';
import path from 'path';

import sharp from 'sharp';

import { portraitSpriteService } from '../services/PortraitSpriteService';
import { coachPortraitService } from '../services/CoachPortraitService';
import { customPortraitService } from '../services/CustomPortraitService';

// Custom portrait PID range starts at 12000
const CUSTOM_PORTRAIT_PID_START = 12000;

// Debug: Test if this module loads
try {
  const testLogPath = path.join(process.cwd(), 'portrait-handlers-loaded.log');
  fs.appendFileSync(testLogPath, `${new Date().toISOString()} portrait-handlers.ts loaded\n`);
  fs.appendFileSync(testLogPath, `${new Date().toISOString()} portraitSpriteService: ${portraitSpriteService ? 'EXISTS' : 'NULL'}\n`);
} catch (e) {
  console.error('Failed to write portrait-handlers debug log:', e);
}

/**
 * Handle: portrait:initialize
 * Initialize the portrait sprite service and cache
 */
ipcMain.handle('portrait:initialize', async (event) => {
  try {
    await portraitSpriteService.initialize();
    return { success: true, count: portraitSpriteService.getPortraitCount() };
  } catch (error: any) {
    console.error('Error initializing portrait sprite service:', error);
    return { success: false, error: error.message };
  }
});

/**
 * Handle: portrait:get-by-player-name
 * Get portrait sprite info by player first and last name
 */
ipcMain.handle('portrait:get-by-player-name', async (event, firstName: string, lastName: string) => {
  try {
    return portraitSpriteService.getPortraitByPlayerName(firstName, lastName);
  } catch (error) {
    console.error('Error getting portrait by player name:', error);
    return null;
  }
});

/**
 * Handle: portrait:get-by-plpo
 * Get portrait sprite info by PLPO name
 */
ipcMain.handle('portrait:get-by-plpo', async (event, plpoName: string) => {
  try {
    return portraitSpriteService.getPortraitByPLPO(plpoName);
  } catch (error) {
    console.error('Error getting portrait by PLPO:', error);
    return null;
  }
});

/**
 * Handle: portrait:get-by-pid
 * Get portrait sprite info by PID
 * Returns sprite info for standard portraits, or { isCustom: true } for custom portraits (PID >= 12000)
 */
ipcMain.handle('portrait:get-by-pid', async (event, pid: number) => {
  try {
    // Ensure PID is a number (Maps use strict equality, "361" !== 361)
    const numericPid = typeof pid === 'string' ? parseInt(pid, 10) : Number(pid);
    if (isNaN(numericPid) || numericPid <= 0) {
      return null;
    }

    // Check if this is a custom portrait
    if (numericPid >= CUSTOM_PORTRAIT_PID_START) {
      const hasCustom = customPortraitService.hasPortrait(numericPid);
      if (hasCustom) {
        return { isCustom: true, pid: numericPid };
      }
      return null;
    }
    return portraitSpriteService.getPortraitByPID(numericPid);
  } catch (error) {
    console.error('Error getting portrait by PID:', error);
    return null;
  }
});

/**
 * Handle: portrait:search
 * Search portraits by query string
 */
ipcMain.handle('portrait:search', async (event, query: string, limit?: number) => {
  try {
    return portraitSpriteService.searchPortraits(query, limit);
  } catch (error) {
    console.error('Error searching portraits:', error);
    return [];
  }
});

/**
 * Handle: portrait:get-all-names
 * Get all portrait names for autocomplete
 */
ipcMain.handle('portrait:get-all-names', async (event) => {
  try {
    return portraitSpriteService.getAllPortraitNames();
  } catch (error) {
    console.error('Error getting all portrait names:', error);
    return [];
  }
});

/**
 * Handle: portrait:has-portrait
 * Check if portrait exists
 */
ipcMain.handle('portrait:has-portrait', async (event, plpoName: string) => {
  try {
    return portraitSpriteService.hasPortrait(plpoName);
  } catch (error) {
    console.error('Error checking portrait:', error);
    return false;
  }
});

/**
 * Handle: portrait:get-count
 * Get total portrait count
 */
ipcMain.handle('portrait:get-count', async (event) => {
  try {
    return portraitSpriteService.getPortraitCount();
  } catch (error) {
    console.error('Error getting portrait count:', error);
    return 0;
  }
});

/**
 * Handle: portrait:get-image-data
 * Get portrait image as base64 data URL (extracted from sprite sheet)
 */
ipcMain.handle('portrait:get-image-data', async (event, plpoName: string) => {
  try {
    const spriteInfo = portraitSpriteService.getPortraitByPLPO(plpoName);

    if (!spriteInfo) {
      return null;
    }

    // Extract portrait region from sprite sheet using Sharp
    const imageBuffer = await sharp(spriteInfo.sheetPath)
      .extract({
        left: spriteInfo.x,
        top: spriteInfo.y,
        width: spriteInfo.width,
        height: spriteInfo.height
      })
      .png()
      .toBuffer();

    const base64Image = imageBuffer.toString('base64');
    const dataUrl = `data:image/png;base64,${base64Image}`;

    return dataUrl;
  } catch (error) {
    console.error('Error getting portrait image data:', error);
    return null;
  }
});

/**
 * Handle: portrait:get-by-pam
 * Get portrait sprite info by PAM code (maps to PLPO)
 */
ipcMain.handle('portrait:get-by-pam', async (event, pamCode: string) => {
  try {
    // Convert PAM/PEPS code to PLPO format for sprite lookup
    // New PFCG format: gen_5_M_M_005 → plpo_generic_5_M_M_005 (keeps the PFCG code)
    let plpoName = pamCode;

    if (pamCode.startsWith('gen_')) {
      // Remove 'gen_' prefix and add 'plpo_generic_' prefix
      // gen_5_M_M_005 → plpo_generic_5_M_M_005
      const pfcgCode = pamCode.substring(4); // Remove 'gen_'
      plpoName = `plpo_generic_${pfcgCode}`;
    }

    return portraitSpriteService.getPortraitByPLPO(plpoName);
  } catch (error) {
    console.error('Error getting portrait by PAM:', error);
    return null;
  }
});

/**
 * Handle: portrait:get-image-data-by-plpo
 * Get portrait image data by PLPO name (extracted from sprite sheet)
 */
ipcMain.handle('portrait:get-image-data-by-plpo', async (event, plpoName: string) => {
  try {
    // Convert PEPS/GENR format to PLPO format for sprite lookup
    // New PFCG format: plpo_gen_5_M_M_005 → plpo_generic_5_M_M_005
    // Also handles: gen_5_M_M_005 → plpo_generic_5_M_M_005
    let finalPlpoName = plpoName;

    if (plpoName.startsWith('plpo_gen_')) {
      // plpo_gen_5_M_M_005 → plpo_generic_5_M_M_005
      finalPlpoName = plpoName.replace('plpo_gen_', 'plpo_generic_');
      console.log(`[Portrait PLPO] Converting ${plpoName} → ${finalPlpoName}`);
    } else if (plpoName.startsWith('gen_')) {
      // gen_5_M_M_005 → plpo_generic_5_M_M_005
      const pfcgCode = plpoName.substring(4); // Remove 'gen_'
      finalPlpoName = `plpo_generic_${pfcgCode}`;
      console.log(`[Portrait PLPO] Converting ${plpoName} → ${finalPlpoName}`);
    }

    let spriteInfo = portraitSpriteService.getPortraitByPLPO(finalPlpoName);

    // Fallback: try with _morphed suffix if not found (legacy support)
    if (!spriteInfo) {
      const morphedName = `${finalPlpoName}_morphed`;
      spriteInfo = portraitSpriteService.getPortraitByPLPO(morphedName);
      if (spriteInfo) {
        console.log(`[Portrait PLPO] Found via morphed fallback: ${morphedName}`);
        finalPlpoName = morphedName;
      }
    }

    if (!spriteInfo) {
      return null;
    }

    // Extract portrait region from sprite sheet using Sharp
    const imageBuffer = await sharp(spriteInfo.sheetPath)
      .extract({
        left: spriteInfo.x,
        top: spriteInfo.y,
        width: spriteInfo.width,
        height: spriteInfo.height
      })
      .png()
      .toBuffer();

    const base64Image = imageBuffer.toString('base64');
    const dataUrl = `data:image/png;base64,${base64Image}`;

    return dataUrl;
  } catch (error) {
    console.error('Error getting portrait image data by PLPO:', error);
    return null;
  }
});

/**
 * Handle: portrait:get-image-data-by-pid
 * Get portrait image data by PID (extracted from sprite sheet or custom portraits)
 */
ipcMain.handle('portrait:get-image-data-by-pid', async (event, pid: number) => {
  try {
    // Ensure PID is a number (Maps use strict equality, "361" !== 361)
    const numericPid = typeof pid === 'string' ? parseInt(pid, 10) : Number(pid);
    console.log(`[portrait-handlers] get-image-data-by-pid called with PID: ${pid} (numeric: ${numericPid})`);

    if (isNaN(numericPid) || numericPid <= 0) {
      console.log(`[portrait-handlers] Invalid PID: ${pid}`);
      return null;
    }

    // Check if this is a custom portrait (PID >= 12000)
    if (numericPid >= CUSTOM_PORTRAIT_PID_START) {
      console.log(`[portrait-handlers] PID ${numericPid} is in custom portrait range, checking custom portraits...`);
      const customDataUrl = await customPortraitService.getPortraitDataUrl(numericPid);
      if (customDataUrl) {
        console.log(`[portrait-handlers] Found custom portrait for PID ${numericPid}`);
        return customDataUrl;
      }
      console.log(`[portrait-handlers] No custom portrait found for PID ${numericPid}`);
      return null;
    }

    // Standard portrait lookup from sprite sheets
    const spriteInfo = portraitSpriteService.getPortraitByPID(numericPid);

    if (!spriteInfo) {
      console.log(`[portrait-handlers] No sprite info found for PID: ${numericPid}`);
      return null;
    }
    console.log(`[portrait-handlers] Found sprite info for PID ${numericPid}:`, spriteInfo.sheetPath, `x=${spriteInfo.x}, y=${spriteInfo.y}`);

    // Check if sprite sheet exists
    if (!fs.existsSync(spriteInfo.sheetPath)) {
      console.error(`[portrait-handlers] Sprite sheet not found: ${spriteInfo.sheetPath}`);
      return null;
    }

    // Extract portrait region from sprite sheet using Sharp
    const imageBuffer = await sharp(spriteInfo.sheetPath)
      .extract({
        left: spriteInfo.x,
        top: spriteInfo.y,
        width: spriteInfo.width,
        height: spriteInfo.height
      })
      .png()
      .toBuffer();

    const base64Image = imageBuffer.toString('base64');
    const dataUrl = `data:image/png;base64,${base64Image}`;
    console.log(`[portrait-handlers] Successfully extracted portrait for PID ${numericPid}, data URL length: ${dataUrl.length}`);

    return dataUrl;
  } catch (error) {
    console.error('Error getting portrait image data by PID:', error);
    return null;
  }
});

/**
 * Handle: portrait:get-image-data-by-pam
 * Get portrait image data by PAM code (extracted from sprite sheet)
 */
ipcMain.handle('portrait:get-image-data-by-pam', async (event, pamCode: string) => {
  try {
    // Skip invalid PAM codes
    if (!pamCode || pamCode === '0' || pamCode === '0.0') {
      return null;
    }

    // Convert PAM/PEPS code to PLPO format that matches the portrait atlas
    // Atlas format: plpo_generic_X_Y_Z_NN (preserves all parts)
    // Example: gen_4_B_MS_01 → plpo_generic_4_B_MS_01
    let plpoName = pamCode;

    console.log(`[Portrait PAM] Input pamCode: "${pamCode}"`);

    let spriteInfo = null;

    if (pamCode.startsWith('gen_')) {
      // Generic face: just replace gen_ with plpo_generic_
      plpoName = pamCode.replace('gen_', 'plpo_generic_');
      console.log(`[Portrait PAM] Generic face converted to: "${plpoName}"`);
      spriteInfo = portraitSpriteService.getPortraitByPLPO(plpoName);
    } else {
      // Check if it's a player name with PID suffix (e.g., taylorLawrence_10891)
      const pidMatch = pamCode.match(/_(\d+)$/);
      if (pidMatch) {
        const pid = parseInt(pidMatch[1], 10);
        console.log(`[Portrait PAM] Extracted PID ${pid} from "${pamCode}"`);
        // Try to get portrait by PID first
        spriteInfo = portraitSpriteService.getPortraitByPID(pid);
        if (spriteInfo) {
          console.log(`[Portrait PAM] Found portrait by PID ${pid}`);
        }
      }

      // If PID lookup failed, try by name
      if (!spriteInfo) {
        const nameOnly = pamCode.replace(/_\d+$/, '');
        plpoName = `plpo_${nameOnly}`;
        console.log(`[Portrait PAM] Player name converted to: "${plpoName}"`);
        spriteInfo = portraitSpriteService.getPortraitByPLPO(plpoName);

        // Try legends format
        if (!spriteInfo) {
          const legendsName = `plpo_legends_${nameOnly}`;
          console.log(`[Portrait PAM] Trying legends format: "${legendsName}"`);
          spriteInfo = portraitSpriteService.getPortraitByPLPO(legendsName);
        }
      }
    }

    console.log(`[Portrait PAM] Final lookup result: ${spriteInfo ? 'FOUND' : 'NOT FOUND'}`);

    // Fallback: try with _morphed suffix if not found (some atlas entries have this)
    if (!spriteInfo && !plpoName.endsWith('_morphed')) {
      const withMorphed = `${plpoName}_morphed`;
      console.log(`[Portrait PAM] Trying fallback with _morphed: "${withMorphed}"`);
      spriteInfo = portraitSpriteService.getPortraitByPLPO(withMorphed);
      if (spriteInfo) {
        console.log(`[Portrait PAM] Found with _morphed suffix`);
      }
    }

    if (!spriteInfo) {
      return null;
    }

    // Extract portrait region from sprite sheet using Sharp
    const imageBuffer = await sharp(spriteInfo.sheetPath)
      .extract({
        left: spriteInfo.x,
        top: spriteInfo.y,
        width: spriteInfo.width,
        height: spriteInfo.height
      })
      .png()
      .toBuffer();

    const base64Image = imageBuffer.toString('base64');
    const dataUrl = `data:image/png;base64,${base64Image}`;

    return dataUrl;
  } catch (error) {
    console.error('Error getting portrait image data by PAM:', error);
    return null;
  }
});

/**
 * ======= COACH PORTRAIT HANDLERS =======
 */

/**
 * Handle: coach-portrait:initialize
 * Initialize the coach portrait sprite service
 */
ipcMain.handle('coach-portrait:initialize', async (event) => {
  try {
    await coachPortraitService.initialize();
    return { success: true, count: coachPortraitService.getStatus().portraitCount };
  } catch (error: any) {
    console.error('Error initializing coach portrait service:', error);
    return { success: false, error: error.message };
  }
});

/**
 * Handle: coach-portrait:get-by-pid
 * Get coach portrait sprite info by PID
 */
ipcMain.handle('coach-portrait:get-by-pid', async (event, pid: number) => {
  try {
    // Ensure PID is numeric (Maps use strict equality)
    const numericPid = typeof pid === 'string' ? parseInt(pid, 10) : Number(pid);
    if (isNaN(numericPid) || numericPid <= 0) {
      return null;
    }
    return coachPortraitService.getPortraitByPID(numericPid);
  } catch (error) {
    console.error('Error getting coach portrait by PID:', error);
    return null;
  }
});

/**
 * Handle: coach-portrait:has-portrait
 * Check if coach portrait exists for given PID
 */
ipcMain.handle('coach-portrait:has-portrait', async (event, pid: number) => {
  try {
    // Ensure PID is numeric (Maps use strict equality)
    const numericPid = typeof pid === 'string' ? parseInt(pid, 10) : Number(pid);
    if (isNaN(numericPid) || numericPid <= 0) {
      return false;
    }
    return coachPortraitService.hasPortrait(numericPid);
  } catch (error) {
    console.error('Error checking coach portrait:', error);
    return false;
  }
});

/**
 * Handle: coach-portrait:get-image-data-by-pid
 * Get coach portrait image data by PID (extracted from sprite sheet)
 */
ipcMain.handle('coach-portrait:get-image-data-by-pid', async (event, pid: number) => {
  try {
    // Ensure PID is a number (Maps use strict equality)
    const numericPid = typeof pid === 'string' ? parseInt(pid, 10) : Number(pid);
    if (isNaN(numericPid) || numericPid <= 0) {
      return null;
    }

    const spriteInfo = coachPortraitService.getPortraitByPID(numericPid);

    if (!spriteInfo) {
      return null;
    }

    // Extract portrait region from sprite sheet using Sharp
    const imageBuffer = await sharp(spriteInfo.sheetPath)
      .extract({
        left: spriteInfo.x,
        top: spriteInfo.y,
        width: spriteInfo.width,
        height: spriteInfo.height
      })
      .png()
      .toBuffer();

    const base64Image = imageBuffer.toString('base64');
    const dataUrl = `data:image/png;base64,${base64Image}`;

    return dataUrl;
  } catch (error) {
    console.error('Error getting coach portrait image data by PID:', error);
    return null;
  }
});

/**
 * Handle: coach-portrait:export-batch-dds
 * Export multiple coach portraits as DDS files
 */
ipcMain.handle('coach-portrait:export-batch-dds', async (event, pids: number[]) => {
  const window = BrowserWindow.fromWebContents(event.sender);

  const result = await dialog.showOpenDialog(window!, {
    title: 'Select Export Folder for Coach Portraits',
    properties: ['openDirectory', 'createDirectory']
  });

  if (result.canceled || result.filePaths.length === 0) {
    return { success: false, canceled: true };
  }

  const outputPath = result.filePaths[0];
  const results = {
    success: true,
    exported: 0,
    failed: 0,
    errors: [] as string[]
  };

  for (const pid of pids) {
    // Ensure PID is numeric
    const numericPid = typeof pid === 'string' ? parseInt(pid, 10) : Number(pid);
    if (isNaN(numericPid) || numericPid <= 0) {
      results.failed++;
      results.errors.push(`Invalid coach PID: ${pid}`);
      continue;
    }
    const exportResult = await coachPortraitService.exportPortraitAsDDS(numericPid, outputPath);
    if (exportResult.success) {
      results.exported++;
    } else {
      results.failed++;
      results.errors.push(exportResult.error || `Failed to export coach PID ${pid}`);
    }
  }

  results.success = results.failed === 0;
  return results;
});

/**
 * Handle: coach-portrait:search-with-images
 * Search coach portraits by name and return with base64 thumbnails
 */
ipcMain.handle('coach-portrait:search-with-images', async (event, query: string, limit = 100) => {
  try {
    // Get all available coach PIDs from the sprite service
    const availablePids = coachPortraitService.getAvailablePIDs();

    // Get portraits with images for all available PIDs (we'll filter by name on the result)
    const pidsToLoad = availablePids.slice(0, limit * 2); // Load more to account for filtering
    const portraits = await coachPortraitService.getPortraitsWithImages(pidsToLoad);

    // Return portraits with PID info - the UI will match with coach names
    return {
      success: true,
      portraits: portraits.map(p => ({
        pid: p.pid,
        name: `Coach ${p.pid}`, // Default name, UI can override with coach database
        imageData: p.imageData
      }))
    };
  } catch (error: any) {
    console.error('Error searching coach portraits:', error);
    return { success: false, error: error.message, portraits: [] };
  }
});

/**
 * Handle: coach-portrait:get-all-with-images
 * Get all coach portraits with base64 thumbnails
 */
ipcMain.handle('coach-portrait:get-all-with-images', async (event, limit = 500) => {
  try {
    const status = coachPortraitService.getStatus();
    console.log('[coach-portrait:get-all-with-images] Service status:', status);

    const availablePids = coachPortraitService.getAvailablePIDs().slice(0, limit);
    console.log(`[coach-portrait:get-all-with-images] Loading ${availablePids.length} portraits`);

    const portraits = await coachPortraitService.getPortraitsWithImages(availablePids);
    console.log(`[coach-portrait:get-all-with-images] Loaded ${portraits.length} portraits successfully`);

    return {
      success: true,
      portraits
    };
  } catch (error: any) {
    console.error('Error getting all coach portraits:', error);
    return { success: false, error: error.message, portraits: [] };
  }
});

/**
 * Handle: portrait:export-dds-by-pid
 * Export a sprite sheet portrait as DDS file (extracts + upscales to 512x512)
 */
ipcMain.handle('portrait:export-dds-by-pid', async (event, pid: number) => {
  // Ensure PID is numeric
  const numericPid = typeof pid === 'string' ? parseInt(pid, 10) : Number(pid);
  if (isNaN(numericPid) || numericPid <= 0) {
    return { success: false, error: `Invalid PID: ${pid}` };
  }

  const window = BrowserWindow.fromWebContents(event.sender);

  const result = await dialog.showOpenDialog(window!, {
    title: 'Select Export Folder',
    properties: ['openDirectory', 'createDirectory']
  });

  if (result.canceled || result.filePaths.length === 0) {
    return { success: false, canceled: true };
  }

  return await portraitSpriteService.exportPortraitAsDDS(numericPid, result.filePaths[0]);
});

/**
 * Handle: portrait:export-dds-by-pid-to-path
 * Export a sprite sheet portrait as DDS file to a specific path
 */
ipcMain.handle('portrait:export-dds-by-pid-to-path', async (event, pid: number, outputPath: string) => {
  // Ensure PID is numeric
  const numericPid = typeof pid === 'string' ? parseInt(pid, 10) : Number(pid);
  if (isNaN(numericPid) || numericPid <= 0) {
    return { success: false, error: `Invalid PID: ${pid}` };
  }
  return await portraitSpriteService.exportPortraitAsDDS(numericPid, outputPath);
});

/**
 * Handle: portrait:export-batch-dds
 * Export multiple sprite sheet portraits as DDS files
 */
ipcMain.handle('portrait:export-batch-dds', async (event, pids: number[]) => {
  const window = BrowserWindow.fromWebContents(event.sender);

  const result = await dialog.showOpenDialog(window!, {
    title: 'Select Export Folder',
    properties: ['openDirectory', 'createDirectory']
  });

  if (result.canceled || result.filePaths.length === 0) {
    return { success: false, canceled: true };
  }

  const outputPath = result.filePaths[0];
  const errors: string[] = [];
  let exported = 0;
  let failed = 0;

  for (const pid of pids) {
    // Ensure PID is numeric
    const numericPid = typeof pid === 'string' ? parseInt(pid, 10) : Number(pid);
    if (isNaN(numericPid) || numericPid <= 0) {
      failed++;
      errors.push(`Invalid PID: ${pid}`);
      continue;
    }
    const exportResult = await portraitSpriteService.exportPortraitAsDDS(numericPid, outputPath);
    if (exportResult.success) {
      exported++;
    } else {
      failed++;
      errors.push(`PID ${numericPid}: ${exportResult.error}`);
    }
  }

  return { success: failed === 0, exported, failed, errors };
});

/**
 * Handle: portrait:get-all-pids
 * Get all PIDs that have sprite sheet portraits
 */
ipcMain.handle('portrait:get-all-pids', async () => {
  try {
    // Get all PIDs from the PID map
    const pids = portraitSpriteService.getAllPids();
    return { success: true, pids };
  } catch (error: any) {
    console.error('Error getting all PIDs:', error);
    return { success: false, error: error.message, pids: [] };
  }
});

/**
 * Handle: portrait:search-with-images
 * Search sprite sheet portraits and return with base64 thumbnails and PIDs
 */
ipcMain.handle('portrait:search-with-images', async (event, query: string, limit = 100) => {
  try {
    const results = portraitSpriteService.searchPortraitsWithPid(query, limit);
    const withImages = [];

    for (const result of results) {
      try {
        // Extract thumbnail from sprite sheet
        const imageBuffer = await sharp(result.sheetPath)
          .extract({
            left: result.x,
            top: result.y,
            width: result.width,
            height: result.height
          })
          .png()
          .toBuffer();

        const base64Image = imageBuffer.toString('base64');
        withImages.push({
          name: result.name,
          pid: result.pid,
          imageData: `data:image/png;base64,${base64Image}`
        });
      } catch (err) {
        console.error(`Error extracting thumbnail for ${result.name}:`, err);
      }
    }

    return { success: true, portraits: withImages };
  } catch (error: any) {
    console.error('Error searching portraits with images:', error);
    return { success: false, error: error.message, portraits: [] };
  }
});

/**
 * Handle: gear:get-image
 * Get a gear image as base64 data URL
 */
ipcMain.handle('gear:get-image', async (event, imageName: string) => {
  try {
    const { app } = require('electron');

    // Try multiple paths for gear sprites (same pattern as PortraitSpriteService)
    const possiblePaths = [
      path.join(app.getAppPath(), '.vite', 'build', 'data', 'gear-sprites', imageName),  // Packaged build
      path.join(process.cwd(), 'data', 'gear-sprites', imageName),
      path.join(app.getAppPath(), 'data', 'gear-sprites', imageName),
      path.join(app.getAppPath(), '..', '..', 'data', 'gear-sprites', imageName),
    ];

    let imagePath = '';
    for (const testPath of possiblePaths) {
      if (fs.existsSync(testPath)) {
        imagePath = testPath;
        break;
      }
    }

    if (!imagePath) {
      console.log(`[gear:get-image] Image not found, tried: ${possiblePaths[0]}`);
      return { success: false, error: 'Image not found' };
    }

    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');

    return {
      success: true,
      imageData: `data:image/png;base64,${base64Image}`
    };
  } catch (error: any) {
    console.error('Error getting gear image:', error);
    return { success: false, error: error.message };
  }
});

/**
 * Handle: gear:get-atlas
 * Get the gear atlas JSON
 */
ipcMain.handle('gear:get-atlas', async (event) => {
  try {
    const { app } = require('electron');

    // Try multiple paths for gear atlas (same pattern as PortraitSpriteService)
    const possiblePaths = [
      path.join(app.getAppPath(), '.vite', 'build', 'data', 'gear-atlas.json'),  // Packaged build
      path.join(process.cwd(), 'data', 'gear-atlas.json'),
      path.join(app.getAppPath(), 'data', 'gear-atlas.json'),
      path.join(app.getAppPath(), '..', '..', 'data', 'gear-atlas.json'),
    ];

    let atlasPath = '';
    for (const testPath of possiblePaths) {
      if (fs.existsSync(testPath)) {
        atlasPath = testPath;
        break;
      }
    }

    if (!atlasPath) {
      console.log(`[gear:get-atlas] Atlas not found, tried: ${possiblePaths[0]}`);
      return { success: false, error: 'Gear atlas not found' };
    }

    const atlasData = fs.readFileSync(atlasPath, 'utf8');
    return {
      success: true,
      atlas: JSON.parse(atlasData)
    };
  } catch (error: any) {
    console.error('Error getting gear atlas:', error);
    return { success: false, error: error.message };
  }
});

console.log('[portrait-handlers] Portrait IPC handlers registered');
