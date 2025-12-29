/**
 * Portrait IPC Handlers
 *
 * IPC handlers for portrait/face image operations.
 * Provides access to player portrait images from sprite sheets.
 */

import { ipcMain } from 'electron';
import { portraitSpriteService } from '../services/PortraitSpriteService';
import { coachPortraitService } from '../services/CoachPortraitService';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

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
 */
ipcMain.handle('portrait:get-by-pid', async (event, pid: number) => {
  try {
    return portraitSpriteService.getPortraitByPID(pid);
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
    // Convert PAM/PEPS code to PLPO format
    // Format: gen_5_M_M_005 → plpo_generic_5_005_morphed
    let plpoName = pamCode;

    if (pamCode.startsWith('gen_')) {
      const parts = pamCode.split('_');
      if (parts.length >= 5) {
        // Extract: gen_5_M_M_005 → ethnicity=5, faceNum=005
        const ethnicity = parts[1];
        // Parse as int then format to exactly 3 digits (handles 01, 003, 0011)
        const faceNum = String(parseInt(parts[4], 10)).padStart(3, '0');
        plpoName = `plpo_generic_${ethnicity}_${faceNum}_morphed`;
      } else {
        // Fallback for simpler format
        plpoName = pamCode.replace('gen_', 'plpo_generic_');
      }
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
    // Convert PEPS format to proper PLPO format
    // Format: plpo_gen_5_M_M_005 → plpo_generic_5_M_M_005 (preserving gender codes)
    let finalPlpoName = plpoName;

    if (plpoName.startsWith('plpo_gen_')) {
      // Strip plpo_ prefix temporarily
      const withoutPrefix = plpoName.substring(5); // Remove "plpo_"
      const parts = withoutPrefix.split('_');

      if (parts.length >= 5 && parts[0] === 'gen') {
        // Extract: gen_5_M_M_005 → ethnicity=5, genderCode=M, genderVariant=M, faceNum=005
        const ethnicity = parts[1];
        const genderCode = parts[2];
        const genderVariant = parts[3];
        const faceNum = parts[4]; // Keep original format - do NOT pad (atlas has variable length)
        finalPlpoName = `plpo_generic_${ethnicity}_${genderCode}_${genderVariant}_${faceNum}`;
        console.log(`[Portrait PLPO] Converting ${plpoName} → ${finalPlpoName}`);
      }
    }

    let spriteInfo = portraitSpriteService.getPortraitByPLPO(finalPlpoName);

    // Fallback: try with _morphed suffix if not found
    if (!spriteInfo && plpoName.startsWith('plpo_gen_')) {
      const morphedName = `${finalPlpoName}_morphed`;
      console.log(`[Portrait PLPO] Trying fallback: ${morphedName}`);
      spriteInfo = portraitSpriteService.getPortraitByPLPO(morphedName);
      if (spriteInfo) {
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
 * Get portrait image data by PID (extracted from sprite sheet)
 */
ipcMain.handle('portrait:get-image-data-by-pid', async (event, pid: number) => {
  try {
    const spriteInfo = portraitSpriteService.getPortraitByPID(pid);

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
    return coachPortraitService.getPortraitByPID(pid);
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
    return coachPortraitService.hasPortrait(pid);
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
    const spriteInfo = coachPortraitService.getPortraitByPID(pid);

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

console.log('[portrait-handlers] Portrait IPC handlers registered');
