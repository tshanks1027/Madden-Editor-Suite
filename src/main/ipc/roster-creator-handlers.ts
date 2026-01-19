/**
 * Roster Creator IPC Handlers
 *
 * IPC handlers for roster creator operations.
 * Handles communication between renderer process and RosterCreatorService.
 *
 * Source: Following pattern from draft-class-handlers.ts
 */

import { ipcMain, BrowserWindow } from 'electron';
import { rosterCreatorService } from '../services/RosterCreatorService';

/**
 * Handle: roster-creator:generate
 * Generate a historical roster for a given year
 */
ipcMain.handle('roster-creator:generate', async (event, year: number, templatePath: string, ratingMode: string = 'semi-historical') => {
  console.log('[roster-creator-handlers] ===== IPC GENERATE REQUEST =====');
  console.log('[roster-creator-handlers] Year:', year);
  console.log('[roster-creator-handlers] Template:', templatePath);
  console.log('[roster-creator-handlers] Rating Mode:', ratingMode);

  try {
    // Get the browser window to send progress updates
    const browserWindow = BrowserWindow.fromWebContents(event.sender);

    // Validate year
    if (!rosterCreatorService.validateYear(year)) {
      throw new Error(`Invalid year: ${year}. Must be between 1920-2025`);
    }

    // Generate roster with progress callback
    const players = await rosterCreatorService.generateHistoricalRoster(
      year,
      templatePath,
      ratingMode,
      (progress, message) => {
        // Send progress update to renderer
        if (browserWindow) {
          browserWindow.webContents.send('roster-creator:progress', {
            progress,
            message
          });
        }
        console.log(`[roster-creator-handlers] Progress: ${progress}% - ${message}`);
      }
    );

    // Get roster statistics
    const stats = rosterCreatorService.getRosterStats(players);

    console.log('[roster-creator-handlers] Generation successful');
    console.log(`[roster-creator-handlers] - Total players: ${players.length}`);
    console.log(`[roster-creator-handlers] - HOF players: ${stats.hofPlayers}`);
    console.log(`[roster-creator-handlers] - Average OVR: ${stats.averageOVR}`);

    // DEBUG: Log first 5 players' PEPS/PAM values
    console.log('[roster-creator-handlers] ===== PEPS/PAM DEBUG =====');
    players.slice(0, 5).forEach((p: any, i: number) => {
      console.log(`[roster-creator-handlers] Player ${i + 1}: ${p.PFNA} ${p.PLNA} - PEPS="${p.PEPS}", PLPL=${p.PLPL}, PGHE=${p.PGHE}, PSKI=${p.PSKI}`);
    });
    console.log('[roster-creator-handlers] ===========================');

    // DEBUG: Team distribution - count players per TGID
    const teamDistribution: { [key: number]: number } = {};
    players.forEach((p: any) => {
      const tgid = p.TGID || 0;
      teamDistribution[tgid] = (teamDistribution[tgid] || 0) + 1;
    });
    console.log('[roster-creator-handlers] ===== TEAM DISTRIBUTION =====');
    Object.entries(teamDistribution)
      .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
      .forEach(([tgid, count]) => {
        console.log(`[roster-creator-handlers] TGID ${tgid}: ${count} players`);
      });
    // Specifically check for Titans (TGID=30)
    const titansCount = teamDistribution[30] || 0;
    console.log(`[roster-creator-handlers] *** TITANS (TGID=30): ${titansCount} players ***`);
    if (titansCount === 0) {
      console.error('[roster-creator-handlers] ⚠️ WARNING: NO TITANS/OILERS PLAYERS!');
    }
    console.log('[roster-creator-handlers] =============================');

    return {
      success: true,
      players,
      stats,
      teamDistribution // Include in response for renderer debugging
    };

  } catch (error: any) {
    console.error('[roster-creator-handlers] ===== IPC GENERATE ERROR =====');
    console.error('[roster-creator-handlers] Error:', error);
    console.error('[roster-creator-handlers] Stack:', error.stack);
    console.error('[roster-creator-handlers] ====================================');

    return {
      success: false,
      error: error.message || 'Unknown error generating roster'
    };
  }
});

/**
 * Handle: roster-creator:save
 * Save generated roster to file
 */
ipcMain.handle('roster-creator:save', async (event, players: any[], templatePath: string, outputPath: string) => {
  console.log('[roster-creator-handlers] ===== IPC SAVE REQUEST =====');
  console.log('[roster-creator-handlers] Player count:', players.length);
  console.log('[roster-creator-handlers] Template:', templatePath);
  console.log('[roster-creator-handlers] Output:', outputPath);

  try {
    // If templatePath is just 'ROSTER-Official', resolve to full path
    let resolvedTemplatePath = templatePath;
    if (templatePath === 'ROSTER-Official' || !templatePath) {
      const { app } = require('electron');
      const path = require('path');
      resolvedTemplatePath = path.join(app.getAppPath(), 'data', 'Templates', 'ROSTER-Official');
      console.log('[roster-creator-handlers] Resolved template path:', resolvedTemplatePath);
    }

    const success = await rosterCreatorService.saveRoster(
      players,
      resolvedTemplatePath,
      outputPath
    );

    console.log('[roster-creator-handlers] Save successful');

    return {
      success: true
    };

  } catch (error: any) {
    console.error('[roster-creator-handlers] ===== IPC SAVE ERROR =====');
    console.error('[roster-creator-handlers] Error:', error);
    console.error('[roster-creator-handlers] Stack:', error.stack);
    console.error('[roster-creator-handlers] ===================================');

    return {
      success: false,
      error: error.message || 'Unknown error saving roster'
    };
  }
});

/**
 * Handle: roster-creator:validate-year
 * Validate if year is in valid range
 */
ipcMain.handle('roster-creator:validate-year', async (event, year: number) => {
  console.log('[roster-creator-handlers] Validating year:', year);

  const isValid = rosterCreatorService.validateYear(year);

  return {
    valid: isValid,
    message: isValid ? `Year ${year} is valid` : `Year must be between 1920-2025`
  };
});

/**
 * Handle: roster-creator:get-stats
 * Get statistics for a generated roster
 */
ipcMain.handle('roster-creator:get-stats', async (event, players: any[]) => {
  console.log('[roster-creator-handlers] Getting stats for', players.length, 'players');

  try {
    const stats = rosterCreatorService.getRosterStats(players);

    return {
      success: true,
      stats
    };

  } catch (error: any) {
    console.error('[roster-creator-handlers] Error getting stats:', error);

    return {
      success: false,
      error: error.message
    };
  }
});

console.log('[roster-creator-handlers] Roster Creator IPC handlers registered');
