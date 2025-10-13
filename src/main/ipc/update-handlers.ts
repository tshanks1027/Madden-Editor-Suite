/**
 * IPC Handlers for Update Checking
 */

import { ipcMain } from 'electron';
import { updateChecker } from '../services/UpdateChecker';

export function registerUpdateHandlers(): void {
  // Manual update check
  ipcMain.handle('check-for-updates', async () => {
    try {
      const updateInfo = await updateChecker.checkForUpdates();
      return { success: true, data: updateInfo };
    } catch (error: any) {
      console.error('[update-handlers] Failed to check for updates:', error);
      return { success: false, error: error.message };
    }
  });

  console.log('[update-handlers] Update handlers registered');
}
