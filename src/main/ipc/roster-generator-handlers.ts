/**
 * Roster Generator IPC Handlers
 *
 * IPC handlers for roster generation operations.
 * Communicates between renderer process and RosterGeneratorService.
 */

import { ipcMain } from 'electron';
import { rosterGeneratorService, RosterGeneratorOptions } from '../services/RosterGeneratorService';

/**
 * Handle: roster-generator:generate
 * Generate roster with specified options
 */
ipcMain.handle('roster-generator:generate', async (event, options: RosterGeneratorOptions) => {
  console.log('[roster-generator-handlers] ===== GENERATE REQUEST =====');
  console.log('[roster-generator-handlers] Options:', JSON.stringify(options));

  try {
    const result = await rosterGeneratorService.generate(options);

    console.log('[roster-generator-handlers] Generation successful');
    console.log('[roster-generator-handlers] Player count:', result.players.length);
    console.log('[roster-generator-handlers] Metadata:', JSON.stringify(result.metadata));

    return {
      success: true,
      data: result
    };

  } catch (error: any) {
    console.error('[roster-generator-handlers] ===== GENERATE ERROR =====');
    console.error('[roster-generator-handlers] Error:', error);
    console.error('[roster-generator-handlers] Stack:', error.stack);
    console.error('[roster-generator-handlers] ===============================');

    return {
      success: false,
      error: error.message || 'Unknown error generating roster'
    };
  }
});

/**
 * Handle: roster-generator:validate-year
 * Check if year has data available
 */
ipcMain.handle('roster-generator:validate-year', async (event, year: number) => {
  console.log('[roster-generator-handlers] ===== VALIDATE YEAR REQUEST =====');
  console.log('[roster-generator-handlers] Year:', year);

  try {
    const validation = await rosterGeneratorService.validateYear(year);

    if (validation.valid) {
      console.log('[roster-generator-handlers] Year valid, player count:', validation.playerCount);
    } else {
      console.log('[roster-generator-handlers] Year invalid:', validation.error);
    }

    return validation;

  } catch (error: any) {
    console.error('[roster-generator-handlers] ===== VALIDATE ERROR =====');
    console.error('[roster-generator-handlers] Error:', error);
    console.error('[roster-generator-handlers] ===============================');

    return {
      valid: false,
      error: error.message || 'Unknown error validating year'
    };
  }
});

/**
 * Handle: roster-generator:get-available-years
 * Get list of available years
 */
ipcMain.handle('roster-generator:get-available-years', async () => {
  console.log('[roster-generator-handlers] ===== GET AVAILABLE YEARS REQUEST =====');

  try {
    const years = await rosterGeneratorService.getAvailableYears();

    console.log('[roster-generator-handlers] Available years:', years.length);
    console.log('[roster-generator-handlers] Range:', Math.min(...years), '-', Math.max(...years));

    return {
      success: true,
      years: years
    };

  } catch (error: any) {
    console.error('[roster-generator-handlers] ===== GET YEARS ERROR =====');
    console.error('[roster-generator-handlers] Error:', error);
    console.error('[roster-generator-handlers] ===============================');

    return {
      success: false,
      error: error.message || 'Unknown error getting available years'
    };
  }
});

/**
 * Handle: roster-generator:get-stats
 * Get composition stats for generated roster
 */
ipcMain.handle('roster-generator:get-stats', async (event, players: any[]) => {
  console.log('[roster-generator-handlers] ===== GET STATS REQUEST =====');
  console.log('[roster-generator-handlers] Player count:', players.length);

  try {
    // Calculate position breakdown
    const positionBreakdown: Record<string, number> = {};
    players.forEach(player => {
      const pos = player.position || 'Unknown';
      positionBreakdown[pos] = (positionBreakdown[pos] || 0) + 1;
    });

    // Calculate rating distribution
    const ratings = players.map(p => p.POVR || 0);
    const avgRating = ratings.reduce((sum, r) => sum + r, 0) / ratings.length;
    const maxRating = Math.max(...ratings);
    const minRating = Math.min(...ratings);

    const stats = {
      totalPlayers: players.length,
      positionBreakdown: positionBreakdown,
      avgRating: Math.round(avgRating * 10) / 10,
      maxRating: maxRating,
      minRating: minRating
    };

    console.log('[roster-generator-handlers] Stats:', JSON.stringify(stats));

    return {
      success: true,
      stats: stats
    };

  } catch (error: any) {
    console.error('[roster-generator-handlers] ===== GET STATS ERROR =====');
    console.error('[roster-generator-handlers] Error:', error);
    console.error('[roster-generator-handlers] ===============================');

    return {
      success: false,
      error: error.message || 'Unknown error calculating stats'
    };
  }
});

console.log('[roster-generator-handlers] Roster Generator IPC handlers registered');
