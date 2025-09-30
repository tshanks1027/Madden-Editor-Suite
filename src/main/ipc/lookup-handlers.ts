/**
 * Lookup IPC Handlers
 *
 * IPC handlers for lookup system operations.
 * Provides access to CSV lookup data (positions, teams, colleges, etc.)
 *
 * Source: Restored from git history (commit 7301aeb)
 */

import { ipcMain } from 'electron';
import { lookupService } from '../services/lookup-service';

/**
 * Handle: lookup:get-display-name
 * Get display name from numeric ID
 */
ipcMain.handle('lookup:get-display-name', async (event, fileName: string, id: number) => {
  try {
    return lookupService.getDisplayName(fileName, id);
  } catch (error) {
    console.error('Error getting display name:', error);
    return id.toString();
  }
});

/**
 * Handle: lookup:get-numeric-id
 * Get numeric ID from display name
 */
ipcMain.handle('lookup:get-numeric-id', async (event, fileName: string, displayName: string) => {
  try {
    return lookupService.getNumericId(fileName, displayName);
  } catch (error) {
    console.error('Error getting numeric ID:', error);
    return 0;
  }
});

/**
 * Handle: lookup:get-dropdown-options
 * Get dropdown options for data grid
 */
ipcMain.handle('lookup:get-dropdown-options', async (event, fileName: string) => {
  try {
    if (fileName === 'PID_lookup.csv') {
      return lookupService.getPIDOptions();
    }
    return lookupService.getDropdownOptions(fileName);
  } catch (error) {
    console.error('Error getting dropdown options:', error);
    return [];
  }
});

/**
 * Handle: lookup:is-ready
 * Check if lookup service is ready
 */
ipcMain.handle('lookup:is-ready', async (event) => {
  return lookupService.isReady();
});

/**
 * Handle: lookup:reload
 * Reload lookup files (for development)
 */
ipcMain.handle('lookup:reload', async (event) => {
  try {
    await lookupService.reload();
    return { success: true };
  } catch (error: any) {
    console.error('Error reloading lookups:', error);
    return { success: false, error: error.message };
  }
});

/**
 * Handle: lookup:get-status
 * Get lookup service status/debugging info
 */
ipcMain.handle('lookup:get-status', async (event) => {
  try {
    return {
      ready: lookupService.isReady(),
      loadedFiles: lookupService.getLoadedFiles(),
      cacheStats: lookupService.getCacheStats()
    };
  } catch (error: any) {
    console.error('Error getting lookup status:', error);
    return { ready: false, error: error.message };
  }
});

console.log('[lookup-handlers] Lookup IPC handlers registered');
