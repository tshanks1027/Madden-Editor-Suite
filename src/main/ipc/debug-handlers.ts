/**
 * IPC Handlers for Debug Tools
 */

import { ipcMain } from 'electron';
import { scraperDebugLogger, sessionDebugLogger } from '../utils/DebugLogger';

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

  // Write to session log from renderer
  ipcMain.handle('debug:session-log', async (event, message: string) => {
    try {
      sessionDebugLogger.log(message);
      return { success: true };
    } catch (error: any) {
      console.error('[IPC] Error writing to session log:', error);
      return { success: false, error: error.message };
    }
  });

  // Get session log path
  ipcMain.handle('debug:get-session-log-path', async () => {
    try {
      const logPath = sessionDebugLogger.getLogFilePath();
      return { success: true, path: logPath };
    } catch (error: any) {
      console.error('[IPC] Error getting session log path:', error);
      return { success: false, error: error.message };
    }
  });

  // Clear session log
  ipcMain.handle('debug:clear-session-log', async () => {
    try {
      sessionDebugLogger.clear();
      return { success: true };
    } catch (error: any) {
      console.error('[IPC] Error clearing session log:', error);
      return { success: false, error: error.message };
    }
  });

  console.log('[IPC] Debug handlers registered');
}
