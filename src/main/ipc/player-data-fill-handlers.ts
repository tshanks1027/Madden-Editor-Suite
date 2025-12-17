/**
 * Player Data Fill IPC Handlers
 *
 * IPC handlers for player data fill operations.
 * Provides ability to scrape Pro-Football-Reference and fill missing player data.
 */

import { ipcMain, BrowserWindow } from 'electron';
import { playerDataFillService, FillResult, PreviewResult, BatchFillOptions, BatchFillResult, PlayerMissingData } from '../services/PlayerDataFillService';

/**
 * Set the main window reference for progress events
 */
export function setMainWindowForFill(window: BrowserWindow): void {
  playerDataFillService.setMainWindow(window);
}

/**
 * Handle: player-fill:preview
 * Preview what data would be filled for a player (dry run)
 */
ipcMain.handle('player-fill:preview', async (event, playerId: number, playerInfo?: {
  firstName: string;
  lastName: string;
  hometown?: string;
  homeState?: string;
  height?: number;
  weight?: number;
  college?: string;
  draftYear?: number;
  draftRound?: string;
  draftPick?: number;
  careerFrom?: number;
  careerTo?: number;
}): Promise<PreviewResult> => {
  try {
    console.log(`[IPC] player-fill:preview for player ${playerId}`, playerInfo ? `(${playerInfo.firstName} ${playerInfo.lastName})` : '');
    return await playerDataFillService.previewFill(playerId, playerInfo);
  } catch (error: any) {
    console.error('[IPC] player-fill:preview error:', error);
    return {
      playerId,
      playerName: playerInfo ? `${playerInfo.firstName} ${playerInfo.lastName}` : 'Unknown',
      found: false,
      currentData: {},
      error: error.message || 'Failed to preview player data'
    };
  }
});

/**
 * Handle: player-fill:fill-single
 * Fill missing data for a single player
 */
ipcMain.handle('player-fill:fill-single', async (event, playerId: number, playerInfo?: {
  firstName: string;
  lastName: string;
  hometown?: string;
  homeState?: string;
  height?: number;
  weight?: number;
  college?: string;
  draftYear?: number;
  draftRound?: string;
  draftPick?: number;
  careerFrom?: number;
  careerTo?: number;
}): Promise<FillResult> => {
  try {
    console.log(`[IPC] player-fill:fill-single for player ${playerId}`, playerInfo ? `(${playerInfo.firstName} ${playerInfo.lastName})` : '');
    return await playerDataFillService.fillSinglePlayer(playerId, playerInfo);
  } catch (error: any) {
    console.error('[IPC] player-fill:fill-single error:', error);
    return {
      success: false,
      playerId,
      playerName: playerInfo ? `${playerInfo.firstName} ${playerInfo.lastName}` : 'Unknown',
      fieldsUpdated: [],
      seasonsUpdated: 0,
      error: error.message || 'Failed to fill player data'
    };
  }
});

/**
 * Handle: player-fill:scan-missing
 * Scan database for players with missing data
 */
ipcMain.handle('player-fill:scan-missing', async (event, limit?: number): Promise<PlayerMissingData[]> => {
  try {
    console.log(`[IPC] player-fill:scan-missing with limit ${limit}`);
    return await playerDataFillService.scanPlayersWithMissingData(limit);
  } catch (error: any) {
    console.error('[IPC] player-fill:scan-missing error:', error);
    return [];
  }
});

/**
 * Handle: player-fill:batch-fill
 * Batch fill missing data for multiple players
 */
ipcMain.handle('player-fill:batch-fill', async (event, options: BatchFillOptions): Promise<BatchFillResult> => {
  try {
    console.log(`[IPC] player-fill:batch-fill with options:`, options);
    return await playerDataFillService.fillMissingDataBatch(options);
  } catch (error: any) {
    console.error('[IPC] player-fill:batch-fill error:', error);
    return {
      total: 0,
      success: 0,
      failed: 0,
      skipped: 0,
      results: []
    };
  }
});

/**
 * Handle: player-fill:cancel-batch
 * Cancel ongoing batch operation
 */
ipcMain.handle('player-fill:cancel-batch', async (event): Promise<void> => {
  try {
    console.log(`[IPC] player-fill:cancel-batch`);
    playerDataFillService.cancelBatch();
  } catch (error: any) {
    console.error('[IPC] player-fill:cancel-batch error:', error);
  }
});
