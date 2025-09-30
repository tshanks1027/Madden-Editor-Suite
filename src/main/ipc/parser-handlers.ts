/**
 * Parser IPC Handlers
 *
 * IPC handlers for roster file parsing operations.
 * Communicates between renderer process and RosterParser.
 *
 * Source: Custom implementation following Electron IPC best practices
 */

import { ipcMain } from 'electron';
import path from 'path';

// Use require with proper path resolution for the parser
const RosterParser = require(path.join(__dirname, 'parsers', 'RosterParser.js'));
const { parseRosterFile, saveRosterFile } = RosterParser;

/**
 * Handle: parser:parse-roster-file
 * Parse a Madden roster file and return player data
 */
ipcMain.handle('parser:parse-roster-file', async (event, filePath: string) => {
  console.log('[parser-handlers] ===== IPC PARSE REQUEST =====');
  console.log('[parser-handlers] File path received:', filePath);

  try {
    console.log('[parser-handlers] Calling parseRosterFile()...');
    const result = await parseRosterFile(filePath);
    console.log('[parser-handlers] Parse successful, player count:', result.playerCount);

    return {
      success: true,
      data: result
    };

  } catch (error: any) {
    console.error('[parser-handlers] ===== IPC PARSE ERROR =====');
    console.error('[parser-handlers] Error:', error);
    console.error('[parser-handlers] Stack:', error.stack);
    console.error('[parser-handlers] ===============================');

    return {
      success: false,
      error: error.message || 'Unknown error parsing roster file'
    };
  }
});

/**
 * Handle: parser:save-roster-file
 * Save modified player data back to roster file
 */
ipcMain.handle('parser:save-roster-file', async (event, filePath: string, players: any[], originalData: any) => {
  try {
    console.log('[parser-handlers] Saving roster file:', filePath);
    console.log('[parser-handlers] Player count:', players.length);

    // Save the file
    await saveRosterFile(filePath, players, originalData);

    console.log('[parser-handlers] Save successful');

    return {
      success: true
    };

  } catch (error: any) {
    console.error('[parser-handlers] Save error:', error);

    return {
      success: false,
      error: error.message || 'Unknown error saving roster file'
    };
  }
});

console.log('[parser-handlers] Parser IPC handlers registered');
