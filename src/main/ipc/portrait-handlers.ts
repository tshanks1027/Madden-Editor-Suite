/**
 * Portrait IPC Handlers
 *
 * IPC handlers for portrait/face image operations.
 * Provides access to player portrait images from Frosty exports.
 */

import { ipcMain } from 'electron';
import { portraitService } from '../services/PortraitService';
import fs from 'fs';

/**
 * Handle: portrait:initialize
 * Initialize the portrait service and cache
 */
ipcMain.handle('portrait:initialize', async (event) => {
  try {
    await portraitService.initialize();
    return { success: true, count: portraitService.getPortraitCount() };
  } catch (error: any) {
    console.error('Error initializing portrait service:', error);
    return { success: false, error: error.message };
  }
});

/**
 * Handle: portrait:get-by-player-name
 * Get portrait path by player first and last name
 */
ipcMain.handle('portrait:get-by-player-name', async (event, firstName: string, lastName: string) => {
  try {
    return portraitService.getPortraitByPlayerName(firstName, lastName);
  } catch (error) {
    console.error('Error getting portrait by player name:', error);
    return null;
  }
});

/**
 * Handle: portrait:get-by-plpo
 * Get portrait path by PLPO name
 */
ipcMain.handle('portrait:get-by-plpo', async (event, plpoName: string) => {
  try {
    return portraitService.getPortraitByPLPO(plpoName);
  } catch (error) {
    console.error('Error getting portrait by PLPO:', error);
    return null;
  }
});

/**
 * Handle: portrait:search
 * Search portraits by query string
 */
ipcMain.handle('portrait:search', async (event, query: string, limit?: number) => {
  try {
    return portraitService.searchPortraits(query, limit);
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
    return portraitService.getAllPortraitNames();
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
    return portraitService.hasPortrait(plpoName);
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
    return portraitService.getPortraitCount();
  } catch (error) {
    console.error('Error getting portrait count:', error);
    return 0;
  }
});

/**
 * Handle: portrait:get-image-data
 * Get portrait image as base64 data URL
 */
ipcMain.handle('portrait:get-image-data', async (event, plpoName: string) => {
  try {
    const portraitPath = portraitService.getPortraitByPLPO(plpoName);

    if (!portraitPath || !fs.existsSync(portraitPath)) {
      return null;
    }

    // Read image file and convert to base64 data URL
    const imageBuffer = fs.readFileSync(portraitPath);
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
 * Get portrait path by PAM code (maps to PLPO)
 */
ipcMain.handle('portrait:get-by-pam', async (event, pamCode: string) => {
  try {
    // Convert PAM code to PLPO format
    // PAM: gen_1_B_B_005 → PLPO: plpo_generic_1_B_B_005
    const plpoName = pamCode.replace('gen_', 'plpo_generic_');
    return portraitService.getPortraitByPLPO(plpoName);
  } catch (error) {
    console.error('Error getting portrait by PAM:', error);
    return null;
  }
});

/**
 * Handle: portrait:get-image-data-by-plpo
 * Get portrait image data by PLPO name
 */
ipcMain.handle('portrait:get-image-data-by-plpo', async (event, plpoName: string) => {
  try {
    const portraitPath = portraitService.getPortraitByPLPO(plpoName);

    if (!portraitPath || !fs.existsSync(portraitPath)) {
      return null;
    }

    // Read image file and convert to base64 data URL
    const imageBuffer = fs.readFileSync(portraitPath);
    const base64Image = imageBuffer.toString('base64');
    const dataUrl = `data:image/png;base64,${base64Image}`;

    return dataUrl;
  } catch (error) {
    console.error('Error getting portrait image data by PLPO:', error);
    return null;
  }
});

/**
 * Handle: portrait:get-image-data-by-pam
 * Get portrait image data by PAM code
 */
ipcMain.handle('portrait:get-image-data-by-pam', async (event, pamCode: string) => {
  try {
    // Convert PAM code to PLPO format
    const plpoName = pamCode.replace('gen_', 'plpo_generic_');
    const portraitPath = portraitService.getPortraitByPLPO(plpoName);

    if (!portraitPath || !fs.existsSync(portraitPath)) {
      return null;
    }

    // Read image file and convert to base64 data URL
    const imageBuffer = fs.readFileSync(portraitPath);
    const base64Image = imageBuffer.toString('base64');
    const dataUrl = `data:image/png;base64,${base64Image}`;

    return dataUrl;
  } catch (error) {
    console.error('Error getting portrait image data by PAM:', error);
    return null;
  }
});

console.log('[portrait-handlers] Portrait IPC handlers registered');
