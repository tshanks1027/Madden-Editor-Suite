/**
 * Roster Generator IPC Handlers
 *
 * IPC handlers for roster generation operations.
 * Communicates between renderer process and RosterGeneratorService.
 */

console.log('[roster-generator-handlers] ===== LOADING HANDLER FILE =====');

import { ipcMain } from 'electron';
import { rosterGeneratorService, RosterGeneratorOptions } from '../services/RosterGeneratorService';

console.log('[roster-generator-handlers] Imports successful');

// Position code to name mapping (from position_lookup.csv)
const POSITION_MAP: Record<number, string> = {
  0: 'QB', 1: 'HB', 2: 'FB', 3: 'WR', 4: 'TE',
  5: 'LT', 6: 'LG', 7: 'C', 8: 'RG', 9: 'RT',
  10: 'LEDG', 11: 'REDG', 12: 'DT',
  13: 'SAM', 14: 'MIKE', 15: 'WILL',
  16: 'CB', 17: 'FS', 18: 'SS',
  19: 'K', 20: 'P', 21: 'LS'
};

// Team ID to name mapping (from team_lookup.csv - IDs are 1-32, not 0-31!)
const TEAM_MAP: Record<number, string> = {
  1: 'Bears', 2: 'Bengals', 3: 'Bills', 4: 'Broncos',
  5: 'Browns', 6: 'Buccs', 7: 'Cards', 8: 'Chargers',
  9: 'Chiefs',  // Note: team_lookup.csv has "Cheifs" (misspelled) but display as Chiefs
  10: 'Colts', 11: 'Cowboys', 12: 'Dolphins', 13: 'Eagles', 14: 'Falcons',
  15: '49ers', 16: 'Giants', 17: 'Jags', 18: 'Jets', 19: 'Lions',
  20: 'Packers', 21: 'Panthers', 22: 'Pats', 23: 'Raiders', 24: 'Rams',
  25: 'Ravens', 26: 'Commanders', 27: 'Saints', 28: 'Seahawks', 29: 'Steelers',
  30: 'Titans', 31: 'Vikings', 32: 'Texans',
  1009: 'Free Agent'
};

/**
 * Handle: roster-generator:generate
 * Generate roster with specified options
 */
ipcMain.handle('roster-generator:generate', async (event, options: RosterGeneratorOptions) => {
  // WRITE TO FILE TO PROVE WE'RE HERE
  const fs = require('fs');
  const path = require('path');
  const { app } = require('electron');
  const logPath = path.join(app.getPath('userData'), 'BACKEND_CALLED.txt');
  fs.writeFileSync(logPath, `BACKEND WAS CALLED AT ${new Date().toISOString()}\nOptions: ${JSON.stringify(options)}\n`);

  console.log('[roster-generator-handlers] ===== GENERATE REQUEST RECEIVED =====');
  console.log('[roster-generator-handlers] Handler is being called!');
  console.log('[roster-generator-handlers] Options:', JSON.stringify(options));
  console.log('[roster-generator-handlers] ===============================');

  try {
    console.log('[roster-generator-handlers] Calling rosterGeneratorService.generate()...');
    const result = await rosterGeneratorService.generate(options);

    console.log('[roster-generator-handlers] Generation successful');
    console.log('[roster-generator-handlers] Player count:', result.players.length);
    console.log('[roster-generator-handlers] Metadata:', JSON.stringify(result.metadata));

    // Enrich players with display names for frontend
    const enrichedPlayers = result.players.map(player => ({
      ...player,
      _position: POSITION_MAP[player.PPOS] || 'Unknown',
      _sourceTeam: TEAM_MAP[player.TGID] || 'Unknown'
    }));

    // DEBUG: Log first 5 players with RATINGS to verify data flow
    console.log('[roster-generator-handlers] === DEBUGGING RATINGS ===');
    console.log('[roster-generator-handlers] First 5 players WITH RATINGS:');
    enrichedPlayers.slice(0, 5).forEach((p, i) => {
      console.log(`  ${i + 1}. ${p.PFNA} ${p.PLNA} - TGID: ${p.TGID} → _sourceTeam: ${p._sourceTeam}`);
      console.log(`      RATINGS: POVR=${p.POVR}, PSPD=${p.PSPD}, PACC=${p.PACC}, PAWR=${p.PAWR}, PAGI=${p.PAGI}`);
    });
    console.log('[roster-generator-handlers] =============================');

    console.log('[roster-generator-handlers] Enriched players with _position and _sourceTeam fields');

    return {
      success: true,
      data: {
        ...result,
        players: enrichedPlayers
      }
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

/**
 * Handle: roster-generator:save
 * Save generated roster to file
 */
ipcMain.handle('roster-generator:save', async (event, players: any[], templatePath: string, outputPath: string) => {
  console.log('[roster-generator-handlers] ===== IPC SAVE REQUEST =====');
  console.log('[roster-generator-handlers] Player count:', players.length);
  console.log('[roster-generator-handlers] Template:', templatePath);
  console.log('[roster-generator-handlers] Output:', outputPath);

  try {
    // If templatePath is just 'ROSTER-Official', resolve to full path
    let resolvedTemplatePath = templatePath;
    if (templatePath === 'ROSTER-Official' || !templatePath) {
      const { app } = require('electron');
      const path = require('path');
      const fs = require('fs');
      // Check multiple paths for packaged vs dev builds
      const possiblePaths = [
        path.join(app.getAppPath(), '.vite', 'build', 'data', 'Templates', 'ROSTER-Official'),
        path.join(app.getAppPath(), 'data', 'Templates', 'ROSTER-Official'),
        path.join(process.cwd(), 'data', 'Templates', 'ROSTER-Official'),
      ];
      resolvedTemplatePath = possiblePaths.find(p => fs.existsSync(p)) || possiblePaths[0];
      console.log('[roster-generator-handlers] Resolved template path:', resolvedTemplatePath);
    }

    const success = await rosterGeneratorService.saveRoster(
      players,
      resolvedTemplatePath,
      outputPath
    );

    console.log('[roster-generator-handlers] Save successful');

    return {
      success: true
    };

  } catch (error: any) {
    console.error('[roster-generator-handlers] ===== IPC SAVE ERROR =====');
    console.error('[roster-generator-handlers] Error:', error);
    console.error('[roster-generator-handlers] Stack:', error.stack);
    console.error('[roster-generator-handlers] ===================================');

    return {
      success: false,
      error: error.message || 'Unknown error saving roster'
    };
  }
});

console.log('[roster-generator-handlers] Roster Generator IPC handlers registered');
