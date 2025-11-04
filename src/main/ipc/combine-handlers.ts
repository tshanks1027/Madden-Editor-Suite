/**
 * IPC Handlers for Combine Data Operations
 *
 * Handles communication between renderer and main process for NFL Combine data operations.
 */

import { ipcMain } from 'electron';
import { combineDataService } from '../services/CombineDataService';
import { mainDebugLogger } from '../utils/DebugLogger';

export function registerCombineHandlers(): void {
  /**
   * Fetch combine data for a specific year
   */
  ipcMain.handle('combine:fetch-year', async (_event, year: number) => {
    try {
      mainDebugLogger.info(`IPC: Fetching combine data for year ${year}`);
      const data = await combineDataService.fetchCombineDataByYear(year);
      return { success: true, data };
    } catch (error) {
      mainDebugLogger.error('IPC: Error fetching combine data for year:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  /**
   * Fetch combine data for a range of years
   */
  ipcMain.handle('combine:fetch-range', async (_event, startYear: number, endYear: number) => {
    try {
      mainDebugLogger.info(`IPC: Fetching combine data from ${startYear} to ${endYear}`);
      const data = await combineDataService.fetchCombineDataRange(startYear, endYear);
      return { success: true, data };
    } catch (error) {
      mainDebugLogger.error('IPC: Error fetching combine data range:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  /**
   * Populate ALL_PLAYER_LOOKUP.csv with 40 times
   */
  ipcMain.handle('combine:populate-40-times', async () => {
    try {
      mainDebugLogger.info('IPC: Starting 40 time population');
      const result = await combineDataService.populateAllPlayer40Times();
      return { success: true, ...result };
    } catch (error) {
      mainDebugLogger.error('IPC: Error populating 40 times:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  /**
   * Update player lookup with specific combine data
   */
  ipcMain.handle('combine:update-lookup', async (_event, combineData) => {
    try {
      mainDebugLogger.info('IPC: Updating player lookup with combine data');
      await combineDataService.updatePlayerLookupWith40Times(combineData);
      return { success: true };
    } catch (error) {
      mainDebugLogger.error('IPC: Error updating lookup:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  mainDebugLogger.info('Combine IPC handlers registered');
}
