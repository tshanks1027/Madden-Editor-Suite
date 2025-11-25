/**
 * IPC Handlers for PresentationIdFix Service
 */

import { ipcMain } from 'electron';
import { presentationIdFixService } from '../services/PresentationIdFixService';

/**
 * Handle: presentation-id-fix:get-enabled
 * Get whether presentation ID fix is enabled
 */
ipcMain.handle('presentation-id-fix:get-enabled', async (event) => {
  try {
    return presentationIdFixService.isEnabled();
  } catch (error: any) {
    console.error('Error getting presentation ID fix enabled status:', error);
    return false;
  }
});

/**
 * Handle: presentation-id-fix:set-enabled
 * Set whether presentation ID fix is enabled
 */
ipcMain.handle('presentation-id-fix:set-enabled', async (event, enabled: boolean) => {
  try {
    presentationIdFixService.setEnabled(enabled);
    console.log(`[PresentationIdFix] Feature ${enabled ? 'enabled' : 'disabled'}`);
    return true;
  } catch (error: any) {
    console.error('Error setting presentation ID fix enabled status:', error);
    return false;
  }
});

/**
 * Handle: presentation-id-fix:get-exe-path
 * Get the path to the presentationIdFix executable
 */
ipcMain.handle('presentation-id-fix:get-exe-path', async (event) => {
  try {
    return presentationIdFixService.getExePath();
  } catch (error: any) {
    console.error('Error getting presentation ID fix exe path:', error);
    return '';
  }
});

/**
 * Handle: presentation-id-fix:set-exe-path
 * Set the path to the presentationIdFix executable
 */
ipcMain.handle('presentation-id-fix:set-exe-path', async (event, exePath: string) => {
  try {
    presentationIdFixService.setExePath(exePath);
    console.log(`[PresentationIdFix] Exe path set to: ${exePath}`);
    return true;
  } catch (error: any) {
    console.error('Error setting presentation ID fix exe path:', error);
    return false;
  }
});

/**
 * Handle: presentation-id-fix:exe-exists
 * Check if the presentationIdFix executable exists
 */
ipcMain.handle('presentation-id-fix:exe-exists', async (event) => {
  try {
    return presentationIdFixService.exeExists();
  } catch (error: any) {
    console.error('Error checking presentation ID fix exe exists:', error);
    return false;
  }
});

/**
 * Handle: presentation-id-fix:test
 * Test the presentationIdFix executable
 */
ipcMain.handle('presentation-id-fix:test', async (event, testFilePath?: string) => {
  try {
    return await presentationIdFixService.testExe(testFilePath);
  } catch (error: any) {
    console.error('Error testing presentation ID fix exe:', error);
    return false;
  }
});

console.log('[IPC] Presentation ID Fix handlers registered');
