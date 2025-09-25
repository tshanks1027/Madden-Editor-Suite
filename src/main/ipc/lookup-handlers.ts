import { ipcMain } from 'electron';
import { lookupService, LookupEntry } from '../services/lookup-service';

export function registerLookupHandlers(): void {
  // Get display name from numeric ID
  ipcMain.handle('lookup:get-display-name', async (event, fileName: string, id: number) => {
    try {
      return lookupService.getDisplayName(fileName, id);
    } catch (error) {
      console.error('Error getting display name:', error);
      return id.toString();
    }
  });

  // Get numeric ID from display name
  ipcMain.handle('lookup:get-numeric-id', async (event, fileName: string, displayName: string) => {
    try {
      return lookupService.getNumericId(fileName, displayName);
    } catch (error) {
      console.error('Error getting numeric ID:', error);
      return 0;
    }
  });

  // Get dropdown options for AG-Grid
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

  // Check if lookup service is ready
  ipcMain.handle('lookup:is-ready', async (event) => {
    return lookupService.isReady();
  });

  // Reload lookup files (for development)
  ipcMain.handle('lookup:reload', async (event) => {
    try {
      await lookupService.reload();
      return { success: true };
    } catch (error) {
      console.error('Error reloading lookups:', error);
      return { success: false, error: error.message };
    }
  });

  // Get lookup service status/debugging info
  ipcMain.handle('lookup:get-status', async (event) => {
    try {
      return {
        ready: lookupService.isReady(),
        loadedFiles: lookupService.getLoadedFiles(),
        cacheStats: lookupService.getCacheStats()
      };
    } catch (error) {
      console.error('Error getting lookup status:', error);
      return { ready: false, error: error.message };
    }
  });

  // Helper for position-specific field filtering
  ipcMain.handle('lookup:get-position-fields', async (event, position: string) => {
    try {
      // This would integrate with your roster field definitions
      // to return only fields relevant to the selected position
      const { getFieldsByPosition } = await import('../../shared/types/roster-fields');
      return getFieldsByPosition(position);
    } catch (error) {
      console.error('Error getting position fields:', error);
      return [];
    }
  });
}

// Helper functions for frontend
export interface LookupAPI {
  getDisplayName: (fileName: string, id: number) => Promise<string>;
  getNumericId: (fileName: string, displayName: string) => Promise<number>;
  getDropdownOptions: (fileName: string) => Promise<LookupEntry[]>;
  isReady: () => Promise<boolean>;
  reload: () => Promise<{ success: boolean; error?: string }>;
  getStatus: () => Promise<{
    ready: boolean;
    loadedFiles?: string[];
    cacheStats?: { [key: string]: number };
    error?: string;
  }>;
  getPositionFields: (position: string) => Promise<any[]>;
}