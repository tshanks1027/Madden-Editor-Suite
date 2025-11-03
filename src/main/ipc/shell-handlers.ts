/**
 * Shell IPC Handlers
 *
 * IPC handlers for shell operations (opening external URLs).
 *
 * Source: Custom implementation following Electron IPC best practices
 */

import { ipcMain, shell } from 'electron';

/**
 * Handle: shell:open-external
 * Opens a URL in the default external browser
 */
ipcMain.handle('shell:open-external', async (_event, url: string) => {
  console.log('[shell-handlers] Opening external URL:', url);

  try {
    // Validate URL format for security
    const urlObject = new URL(url);

    // Only allow http, https protocols for security
    if (!['http:', 'https:'].includes(urlObject.protocol)) {
      throw new Error(`Unsupported protocol: ${urlObject.protocol}`);
    }

    await shell.openExternal(url);
    console.log('[shell-handlers] Successfully opened URL');
    return { success: true };
  } catch (error) {
    console.error('[shell-handlers] Error opening external URL:', error);
    throw error;
  }
});

export default {};
