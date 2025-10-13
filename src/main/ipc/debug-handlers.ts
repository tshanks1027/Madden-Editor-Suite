/**
 * IPC Handlers for Debug Tools
 */

import { ipcMain } from 'electron';
import { scraperDebugLogger } from '../utils/DebugLogger';

/**
 * Register debug IPC handlers
 */
export function registerDebugHandlers(): void {
  // Get debug log contents
  ipcMain.handle('debug:get-log', async () => {
    try {
      const logContents = scraperDebugLogger.read();
      return { success: true, contents: logContents };
    } catch (error: any) {
      console.error('[IPC] Error reading debug log:', error);
      return { success: false, error: error.message };
    }
  });

  // Get debug log file path
  ipcMain.handle('debug:get-log-path', async () => {
    try {
      const logPath = scraperDebugLogger.getLogFilePath();
      return { success: true, path: logPath };
    } catch (error: any) {
      console.error('[IPC] Error getting debug log path:', error);
      return { success: false, error: error.message };
    }
  });

  // Clear debug log
  ipcMain.handle('debug:clear-log', async () => {
    try {
      scraperDebugLogger.clear();
      return { success: true };
    } catch (error: any) {
      console.error('[IPC] Error clearing debug log:', error);
      return { success: false, error: error.message };
    }
  });

  console.log('[IPC] Debug handlers registered');
}
