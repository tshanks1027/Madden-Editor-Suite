/**
 * Retro Editor IPC Handlers
 *
 * IPC handlers for franchise file retro editing operations.
 * Communicates between renderer process and RetroEditorService.
 */

import { ipcMain, dialog } from 'electron';
import { retroEditorService } from '../services/RetroEditorService';

/**
 * Handle: retro:select-file
 * Open file picker for franchise files
 */
ipcMain.handle('retro:select-file', async () => {
  console.log('[retro-editor-handlers] ===== SELECT FILE =====');

  try {
    const result = await dialog.showOpenDialog({
      title: 'Select Madden 26 Franchise File',
      filters: [
        { name: 'All Files', extensions: ['*'] }
      ],
      properties: ['openFile']
    });

    if (result.canceled || result.filePaths.length === 0) {
      console.log('[retro-editor-handlers] File selection cancelled');
      return { success: false, cancelled: true };
    }

    console.log('[retro-editor-handlers] Selected file:', result.filePaths[0]);
    return { success: true, filePath: result.filePaths[0] };

  } catch (error: any) {
    console.error('[retro-editor-handlers] Error selecting file:', error);
    return { success: false, error: error.message };
  }
});

/**
 * Handle: retro:load-file
 * Load and validate franchise file
 */
ipcMain.handle('retro:load-file', async (event, filePath: string) => {
  console.log('[retro-editor-handlers] ===== LOAD FILE =====');
  console.log('[retro-editor-handlers] File path:', filePath);

  try {
    const metadata = await retroEditorService.loadFranchiseFile(filePath);

    if (metadata.valid) {
      console.log('[retro-editor-handlers] File loaded successfully');
      return { success: true, data: metadata };
    } else {
      console.log('[retro-editor-handlers] File validation failed:', metadata.error);
      return { success: false, error: metadata.error };
    }

  } catch (error: any) {
    console.error('[retro-editor-handlers] Error loading file:', error);
    return { success: false, error: error.message };
  }
});

/**
 * Handle: retro:get-available-years
 * Get list of supported years (1966-2025)
 */
ipcMain.handle('retro:get-available-years', async () => {
  console.log('[retro-editor-handlers] ===== GET AVAILABLE YEARS =====');

  try {
    const years = retroEditorService.getAvailableYears();
    console.log('[retro-editor-handlers] Available years:', years.length);
    return { success: true, years };

  } catch (error: any) {
    console.error('[retro-editor-handlers] Error getting years:', error);
    return { success: false, error: error.message };
  }
});

/**
 * Handle: retro:preview-changes
 * Preview changes before applying
 */
ipcMain.handle('retro:preview-changes', async (event, filePath: string, year: number) => {
  console.log('[retro-editor-handlers] ===== PREVIEW CHANGES =====');
  console.log('[retro-editor-handlers] File:', filePath);
  console.log('[retro-editor-handlers] Year:', year);

  try {
    const preview = await retroEditorService.previewChanges(filePath, year);
    console.log('[retro-editor-handlers] Preview generated');
    console.log('[retro-editor-handlers] Season changes:', preview.seasonChanges);
    console.log('[retro-editor-handlers] Team changes:', preview.teamChanges.length);
    console.log('[retro-editor-handlers] Draft changes:', preview.draftChanges);

    return { success: true, data: preview };

  } catch (error: any) {
    console.error('[retro-editor-handlers] Error previewing changes:', error);
    return { success: false, error: error.message };
  }
});

/**
 * Handle: retro:set-season-year
 * Set year, Super Bowl #, calendar year
 */
ipcMain.handle('retro:set-season-year', async (event, filePath: string, year: number) => {
  console.log('[retro-editor-handlers] ===== SET SEASON YEAR =====');
  console.log('[retro-editor-handlers] File:', filePath);
  console.log('[retro-editor-handlers] Year:', year);

  try {
    await retroEditorService.setSeasonYear(filePath, year);
    console.log('[retro-editor-handlers] Season year set successfully');
    return { success: true };

  } catch (error: any) {
    console.error('[retro-editor-handlers] Error setting season year:', error);
    return { success: false, error: error.message };
  }
});

/**
 * Handle: retro:update-team-names
 * Update team names based on year
 */
ipcMain.handle('retro:update-team-names', async (event, filePath: string, year: number) => {
  console.log('[retro-editor-handlers] ===== UPDATE TEAM NAMES =====');
  console.log('[retro-editor-handlers] File:', filePath);
  console.log('[retro-editor-handlers] Year:', year);

  try {
    const changes = await retroEditorService.updateTeamNames(filePath, year);
    console.log('[retro-editor-handlers] Team names updated:', changes.length);
    return { success: true, data: { changes } };

  } catch (error: any) {
    console.error('[retro-editor-handlers] Error updating team names:', error);
    return { success: false, error: error.message };
  }
});

/**
 * Handle: retro:reorder-draft-picks
 * Move expansion teams to end of draft
 */
ipcMain.handle('retro:reorder-draft-picks', async (event, filePath: string, year: number) => {
  console.log('[retro-editor-handlers] ===== REORDER DRAFT PICKS =====');
  console.log('[retro-editor-handlers] File:', filePath);
  console.log('[retro-editor-handlers] Year:', year);

  try {
    const count = await retroEditorService.reorderDraftPicks(filePath, year);
    console.log('[retro-editor-handlers] Draft picks reordered:', count);
    return { success: true, data: { reorderedCount: count } };

  } catch (error: any) {
    console.error('[retro-editor-handlers] Error reordering draft picks:', error);
    return { success: false, error: error.message };
  }
});

/**
 * Handle: retro:get-team-list
 * Get current teams for display
 */
ipcMain.handle('retro:get-team-list', async (event, filePath: string) => {
  console.log('[retro-editor-handlers] ===== GET TEAM LIST =====');
  console.log('[retro-editor-handlers] File:', filePath);

  try {
    const teams = await retroEditorService.getTeamList(filePath);
    console.log('[retro-editor-handlers] Teams retrieved:', teams.length);
    return { success: true, data: { teams } };

  } catch (error: any) {
    console.error('[retro-editor-handlers] Error getting team list:', error);
    return { success: false, error: error.message };
  }
});

/**
 * Handle: retro:save-file
 * Save modified franchise file (overwrite original)
 */
ipcMain.handle('retro:save-file', async (event, filePath: string) => {
  console.log('[retro-editor-handlers] ===== SAVE FILE =====');
  console.log('[retro-editor-handlers] File:', filePath);

  try {
    await retroEditorService.saveFranchiseFile(filePath);
    console.log('[retro-editor-handlers] File saved successfully');
    return { success: true };

  } catch (error: any) {
    console.error('[retro-editor-handlers] Error saving file:', error);
    return { success: false, error: error.message };
  }
});

/**
 * Handle: retro:save-file-as
 * Save modified franchise file to a new location
 */
ipcMain.handle('retro:save-file-as', async (event, originalPath: string) => {
  console.log('[retro-editor-handlers] ===== SAVE FILE AS =====');
  console.log('[retro-editor-handlers] Original file:', originalPath);

  try {
    // Show save dialog - use original filename, user can rename if desired
    const result = await dialog.showSaveDialog({
      title: 'Save Retro Franchise As',
      defaultPath: originalPath,
      filters: [
        { name: 'All Files', extensions: ['*'] }
      ]
    });

    if (result.canceled || !result.filePath) {
      console.log('[retro-editor-handlers] Save As cancelled');
      return { success: false, cancelled: true };
    }

    await retroEditorService.saveFranchiseFileAs(originalPath, result.filePath);
    console.log('[retro-editor-handlers] File saved successfully to:', result.filePath);
    return { success: true, newPath: result.filePath };

  } catch (error: any) {
    console.error('[retro-editor-handlers] Error saving file:', error);
    return { success: false, error: error.message };
  }
});

/**
 * Handle: retro:create-backup
 * Create a backup copy of the franchise file before making changes
 */
ipcMain.handle('retro:create-backup', async (event, filePath: string) => {
  console.log('[retro-editor-handlers] ===== CREATE BACKUP =====');
  console.log('[retro-editor-handlers] File:', filePath);

  try {
    const backupPath = await retroEditorService.createBackup(filePath);
    console.log('[retro-editor-handlers] Backup created:', backupPath);
    return { success: true, backupPath };

  } catch (error: any) {
    console.error('[retro-editor-handlers] Error creating backup:', error);
    return { success: false, error: error.message };
  }
});

/**
 * Handle: retro:close-file
 * Close franchise file and release resources
 */
ipcMain.handle('retro:close-file', async (event, filePath: string) => {
  console.log('[retro-editor-handlers] ===== CLOSE FILE =====');
  console.log('[retro-editor-handlers] File:', filePath);

  try {
    retroEditorService.closeFranchiseFile(filePath);
    console.log('[retro-editor-handlers] File closed');
    return { success: true };

  } catch (error: any) {
    console.error('[retro-editor-handlers] Error closing file:', error);
    return { success: false, error: error.message };
  }
});

/**
 * Handle: retro:apply-all-changes
 * Apply all retro modifications at once (season year, team names, draft picks)
 * Options allow selective application of changes
 */
ipcMain.handle('retro:apply-all-changes', async (event, filePath: string, year: number, options?: { applyTeams?: boolean; applyAbbreviations?: boolean }) => {
  console.log('[retro-editor-handlers] ===== APPLY ALL CHANGES =====');
  console.log('[retro-editor-handlers] File:', filePath);
  console.log('[retro-editor-handlers] Year:', year);
  console.log('[retro-editor-handlers] Options:', options);

  // Default options if not provided
  const applyTeams = options?.applyTeams !== false;
  const applyAbbreviations = options?.applyAbbreviations !== false;

  try {
    // Always apply season year
    await retroEditorService.setSeasonYear(filePath, year);
    console.log('[retro-editor-handlers] 1/3 Season year set');

    let teamChangesCount = 0;
    let draftReordered = false;

    // Apply team names/abbreviations if enabled
    if (applyTeams) {
      const teamChanges = await retroEditorService.updateTeamNames(filePath, year);
      teamChangesCount = teamChanges.length;
      console.log('[retro-editor-handlers] 2/3 Team names updated:', teamChangesCount);

      draftReordered = await retroEditorService.reorderDraftPicks(filePath, year);
      console.log('[retro-editor-handlers] 3/3 Draft picks reordered:', draftReordered);
    } else {
      console.log('[retro-editor-handlers] 2/3 Team names SKIPPED (disabled)');
      console.log('[retro-editor-handlers] 3/3 Draft picks SKIPPED (disabled)');
    }

    console.log('[retro-editor-handlers] All changes applied successfully');

    return {
      success: true,
      data: {
        seasonYearSet: true,
        teamChanges: teamChangesCount,
        draftPicksReordered: draftReordered
      }
    };

  } catch (error: any) {
    console.error('[retro-editor-handlers] Error applying changes:', error);
    return { success: false, error: error.message };
  }
});

/**
 * Handle: retro:move-inactive-players-to-fa
 * Move players from teams that don't exist in the target year to Free Agency
 */
ipcMain.handle('retro:move-inactive-players-to-fa', async (event, filePath: string, year: number) => {
  console.log('[retro-editor-handlers] Move inactive players to FA for year', year);

  try {
    const result = await retroEditorService.moveInactiveTeamPlayersToFA(filePath, year);
    console.log('[retro-editor-handlers] Moved', result.playersMoved, 'players');
    return result;
  } catch (error: any) {
    console.error('[retro-editor-handlers] Error moving inactive players:', error);
    return { success: false, error: error.message };
  }
});

/**
 * Handle: retro:clear-league-history
 * Clear Super Bowl and league history for historical mode
 */
ipcMain.handle('retro:clear-league-history', async (event, filePath: string, year: number) => {
  console.log('[retro-editor-handlers] Clear league history for year', year);

  try {
    const result = await retroEditorService.clearLeagueHistory(filePath, year);
    return result;
  } catch (error: any) {
    console.error('[retro-editor-handlers] Error clearing history:', error);
    return { success: false, error: error.message };
  }
});

/**
 * Handle: retro:debug-team-table
 * Diagnostic: Search ALL tables for NFL team data (NickName like "49ers", "Bears", etc)
 */
ipcMain.handle('retro:debug-team-table', async (event, filePath: string) => {
  console.log('[retro-editor-handlers] ===== DEBUG TEAM TABLE =====');
  console.log('[retro-editor-handlers] File:', filePath);

  try {
    const module = await import('madden-franchise');
    const createFranchise = module.create;
    const franchise = await createFranchise(filePath);

    console.log('[retro-editor-handlers] Total tables:', franchise.tables?.length);

    // NFL team nicknames to search for
    const nflNicknames = ['49ers', 'Bears', 'Bengals', 'Bills', 'Broncos', 'Browns', 'Buccaneers',
      'Cardinals', 'Chargers', 'Chiefs', 'Colts', 'Commanders', 'Cowboys', 'Dolphins', 'Eagles',
      'Falcons', 'Giants', 'Jaguars', 'Jets', 'Lions', 'Packers', 'Panthers', 'Patriots', 'Raiders',
      'Rams', 'Ravens', 'Saints', 'Seahawks', 'Steelers', 'Texans', 'Titans', 'Vikings'];

    // Search ALL tables for ones that have NFL team data
    const tablesWithNFLTeams: any[] = [];
    let bestTeamTable: any = null;
    let bestTeamTableId: number | null = null;

    for (const table of franchise.tables || []) {
      try {
        await table.readRecords();
        if (!table.records || table.records.length < 30) continue; // NFL has 32 teams

        // Check if this table has NickName field with NFL team names
        let matchingNFLTeams = 0;
        const sampleRecords: any[] = [];

        for (let i = 0; i < table.records.length && i < 40; i++) {
          const r = table.records[i];
          if (r.isEmpty) continue;

          let nickName = null;
          let displayName = null;
          let longName = null;
          let teamIndex = null;

          try { nickName = r.NickName; } catch (e) {}
          try { displayName = r.DisplayName; } catch (e) {}
          try { longName = r.LongName; } catch (e) {}
          try { teamIndex = r.TeamIndex; } catch (e) {}

          // Check if NickName matches any NFL team
          if (nickName && typeof nickName === 'string') {
            if (nflNicknames.includes(nickName)) {
              matchingNFLTeams++;
            }
            sampleRecords.push({
              index: i,
              TeamIndex: teamIndex,
              NickName: nickName,
              DisplayName: displayName,
              LongName: longName
            });
          }
        }

        // If we found multiple NFL teams, this is likely the right table
        if (matchingNFLTeams >= 10) {
          const tableInfo = {
            name: table.name,
            uniqueId: table.header?.uniqueId,
            recordCount: table.records.length,
            nonEmptyCount: table.records.filter((r: any) => !r.isEmpty).length,
            matchingNFLTeams,
            sampleRecords: sampleRecords.slice(0, 10)
          };
          tablesWithNFLTeams.push(tableInfo);

          // Keep track of best match (most NFL team matches)
          if (!bestTeamTable || matchingNFLTeams > bestTeamTable.matchingNFLTeams) {
            bestTeamTable = tableInfo;
            bestTeamTableId = table.header?.uniqueId;
          }
        }
      } catch (e) {
        // Skip tables that error
      }
    }

    // Also check getTableByName('Team') directly
    let teamByNameInfo = null;
    try {
      const teamByName = franchise.getTableByName('Team');
      if (teamByName) {
        await teamByName.readRecords();
        const records = teamByName.records.filter((r: any) => !r.isEmpty);
        teamByNameInfo = {
          uniqueId: teamByName.header?.uniqueId,
          recordCount: teamByName.records.length,
          nonEmptyCount: records.length,
          sampleRecords: records.slice(0, 5).map((r: any) => ({
            TeamIndex: r.TeamIndex,
            NickName: r.NickName,
            DisplayName: r.DisplayName,
            LongName: r.LongName
          }))
        };
      }
    } catch (e) {
      teamByNameInfo = { error: String(e) };
    }

    return {
      success: true,
      data: {
        totalTables: franchise.tables?.length || 0,
        tablesWithNFLTeams,
        bestTeamTable,
        bestTeamTableId,
        teamByNameInfo,
        recommendation: bestTeamTableId
          ? `Use unique ID ${bestTeamTableId} for Team table`
          : 'Could not find NFL Team table'
      }
    };

  } catch (error: any) {
    console.error('[retro-editor-handlers] Error debugging team table:', error);
    return { success: false, error: error.message };
  }
});

/**
 * Handle: retro:dump-tables
 * Diagnostic: dump all table names and first few records of key tables
 */
ipcMain.handle('retro:dump-tables', async (event, filePath: string) => {
  console.log('[retro-editor-handlers] ===== DUMP TABLES =====');
  console.log('[retro-editor-handlers] File:', filePath);

  try {
    // Import madden-franchise
    const module = await import('madden-franchise');
    const createFranchise = module.create;

    const franchise = await createFranchise(filePath);

    // Get all table names
    const tableNames = franchise.tables?.map((t: any) => ({
      name: t.name,
      uniqueId: t.header?.uniqueId,
      recordCount: t.header?.recordCount || 0
    })) || [];

    console.log('[retro-editor-handlers] Found', tableNames.length, 'tables');

    // Find key tables for retro editing
    const keyTableNames = ['Coach', 'SeasonGame', 'Schedule', 'Team', 'SeasonInfo', 'Stadium'];
    const keyTables: Record<string, any> = {};

    for (const tableName of keyTableNames) {
      const table = franchise.getTableByName(tableName);
      if (table) {
        await table.readRecords();
        const sampleRecords = table.records.slice(0, 3).map((r: any) => {
          // Get field names from the record
          const fields: Record<string, any> = {};
          for (const key of Object.keys(r)) {
            if (!key.startsWith('_') && typeof r[key] !== 'function') {
              fields[key] = r[key];
            }
          }
          return fields;
        });

        keyTables[tableName] = {
          found: true,
          recordCount: table.records.length,
          sampleRecords,
          fieldNames: sampleRecords.length > 0 ? Object.keys(sampleRecords[0]) : []
        };

        console.log(`[retro-editor-handlers] Table ${tableName}:`, keyTables[tableName].fieldNames.slice(0, 10));
      } else {
        keyTables[tableName] = { found: false };
      }
    }

    return {
      success: true,
      data: {
        totalTables: tableNames.length,
        tableNames: tableNames.slice(0, 50), // First 50 tables
        keyTables
      }
    };

  } catch (error: any) {
    console.error('[retro-editor-handlers] Error dumping tables:', error);
    return { success: false, error: error.message };
  }
});

// ========================================
// SCHEDULE HANDLERS
// ========================================

/**
 * Handle: retro:get-season-info
 * Get era information for a specific year (season length, bye weeks, playoffs)
 */
ipcMain.handle('retro:get-season-info', async (event, year: number) => {
  console.log('[retro-editor-handlers] ===== GET SEASON INFO =====');
  console.log('[retro-editor-handlers] Year:', year);

  try {
    const info = await retroEditorService.getSeasonInfo(year);
    console.log('[retro-editor-handlers] Season info:', info);
    return { success: true, data: info };

  } catch (error: any) {
    console.error('[retro-editor-handlers] Error getting season info:', error);
    return { success: false, error: error.message };
  }
});

/**
 * Handle: retro:has-schedule-data
 * Check if schedule data is available for a year
 */
ipcMain.handle('retro:has-schedule-data', async (event, year: number) => {
  console.log('[retro-editor-handlers] ===== HAS SCHEDULE DATA =====');
  console.log('[retro-editor-handlers] Year:', year);

  try {
    const hasData = await retroEditorService.hasScheduleData(year);
    console.log('[retro-editor-handlers] Has schedule data:', hasData);
    return { success: true, hasData };

  } catch (error: any) {
    console.error('[retro-editor-handlers] Error checking schedule data:', error);
    return { success: false, error: error.message };
  }
});

/**
 * Handle: retro:get-available-schedule-years
 * Get list of years with schedule data available
 */
ipcMain.handle('retro:get-available-schedule-years', async () => {
  console.log('[retro-editor-handlers] ===== GET AVAILABLE SCHEDULE YEARS =====');

  try {
    const years = await retroEditorService.getAvailableScheduleYears();
    console.log('[retro-editor-handlers] Available schedule years:', years.length);
    return { success: true, years };

  } catch (error: any) {
    console.error('[retro-editor-handlers] Error getting available schedule years:', error);
    return { success: false, error: error.message };
  }
});

/**
 * Handle: retro:get-schedule-preview
 * Get preview of schedule changes for a year
 */
ipcMain.handle('retro:get-schedule-preview', async (event, filePath: string, year: number) => {
  console.log('[retro-editor-handlers] ===== GET SCHEDULE PREVIEW =====');
  console.log('[retro-editor-handlers] File:', filePath);
  console.log('[retro-editor-handlers] Year:', year);

  try {
    const preview = await retroEditorService.getSchedulePreview(filePath, year);
    console.log('[retro-editor-handlers] Schedule preview generated');
    console.log('[retro-editor-handlers] Total games:', preview.totalGames);
    console.log('[retro-editor-handlers] Weeks:', Object.keys(preview.gamesByWeek).length);
    return { success: true, data: preview };

  } catch (error: any) {
    console.error('[retro-editor-handlers] Error getting schedule preview:', error);
    return { success: false, error: error.message };
  }
});

/**
 * Handle: retro:apply-schedule
 * Apply historical schedule to franchise file
 */
ipcMain.handle('retro:apply-schedule', async (event, filePath: string, year: number) => {
  console.log('[retro-editor-handlers] ===== APPLY SCHEDULE =====');
  console.log('[retro-editor-handlers] File:', filePath);
  console.log('[retro-editor-handlers] Year:', year);

  try {
    const result = await retroEditorService.applyHistoricalSchedule(filePath, year);
    console.log('[retro-editor-handlers] Schedule applied');
    console.log('[retro-editor-handlers] Games modified:', result.gamesUpdated);
    return { success: true, data: result };

  } catch (error: any) {
    console.error('[retro-editor-handlers] Error applying schedule:', error);
    return { success: false, error: error.message };
  }
});

// ========================================
// COACH HANDLERS
// ========================================

/**
 * Handle: retro:has-coach-data
 * Check if coach data is available for a year
 */
ipcMain.handle('retro:has-coach-data', async (event, year: number) => {
  console.log('[retro-editor-handlers] ===== HAS COACH DATA =====');
  console.log('[retro-editor-handlers] Year:', year);

  try {
    const hasData = await retroEditorService.hasCoachData(year);
    console.log('[retro-editor-handlers] Has coach data:', hasData);
    return { success: true, hasData };

  } catch (error: any) {
    console.error('[retro-editor-handlers] Error checking coach data:', error);
    return { success: false, error: error.message };
  }
});

/**
 * Handle: retro:get-coach-preview
 * Get preview of coach changes for a year
 */
ipcMain.handle('retro:get-coach-preview', async (event, filePath: string, year: number) => {
  console.log('[retro-editor-handlers] ===== GET COACH PREVIEW =====');
  console.log('[retro-editor-handlers] File:', filePath);
  console.log('[retro-editor-handlers] Year:', year);

  try {
    const preview = await retroEditorService.getCoachPreview(filePath, year);
    console.log('[retro-editor-handlers] Coach preview generated');
    console.log('[retro-editor-handlers] Team count:', preview.teamCount);
    return { success: true, data: preview };

  } catch (error: any) {
    console.error('[retro-editor-handlers] Error getting coach preview:', error);
    return { success: false, error: error.message };
  }
});

/**
 * Handle: retro:apply-coaches
 * Apply historical coaches to franchise file
 */
ipcMain.handle('retro:apply-coaches', async (event, filePath: string, year: number) => {
  console.log('[retro-editor-handlers] ===== APPLY COACHES =====');
  console.log('[retro-editor-handlers] File:', filePath);
  console.log('[retro-editor-handlers] Year:', year);

  try {
    const result = await retroEditorService.applyHistoricalCoaches(filePath, year);
    console.log('[retro-editor-handlers] Coaches applied');
    console.log('[retro-editor-handlers] Coaches updated:', result.coachesUpdated);
    return { success: true, data: result };

  } catch (error: any) {
    console.error('[retro-editor-handlers] Error applying coaches:', error);
    return { success: false, error: error.message };
  }
});

// ========================================
// SALARY CAP HANDLERS
// ========================================

/**
 * Handle: retro:get-salary-cap
 * Get salary cap for a specific year
 */
ipcMain.handle('retro:get-salary-cap', async (event, year: number) => {
  console.log('[retro-editor-handlers] ===== GET SALARY CAP =====');
  console.log('[retro-editor-handlers] Year:', year);

  try {
    const capInfo = retroEditorService.getSalaryCapForYear(year);
    console.log('[retro-editor-handlers] Salary cap:', capInfo.value, capInfo.note || '');
    return { success: true, data: capInfo };

  } catch (error: any) {
    console.error('[retro-editor-handlers] Error getting salary cap:', error);
    return { success: false, error: error.message };
  }
});

/**
 * Handle: retro:apply-salary-cap
 * Apply historical salary cap to franchise file
 */
ipcMain.handle('retro:apply-salary-cap', async (event, filePath: string, year: number) => {
  console.log('[retro-editor-handlers] ===== APPLY SALARY CAP =====');
  console.log('[retro-editor-handlers] File:', filePath);
  console.log('[retro-editor-handlers] Year:', year);

  try {
    const result = await retroEditorService.applySalaryCap(filePath, year);
    console.log('[retro-editor-handlers] Salary cap applied');
    console.log('[retro-editor-handlers] Previous:', result.previousCap, 'New:', result.newCap);
    return { success: true, data: result };

  } catch (error: any) {
    console.error('[retro-editor-handlers] Error applying salary cap:', error);
    return { success: false, error: error.message };
  }
});

// ========================================
// STADIUM HANDLERS
// ========================================

/**
 * Handle: retro:get-stadium-preview
 * Get preview of stadium name changes for a year
 */
ipcMain.handle('retro:get-stadium-preview', async (event, filePath: string, year: number) => {
  console.log('[retro-editor-handlers] ===== GET STADIUM PREVIEW =====');
  console.log('[retro-editor-handlers] File:', filePath);
  console.log('[retro-editor-handlers] Year:', year);

  try {
    const preview = await retroEditorService.getStadiumPreview(filePath, year);
    console.log('[retro-editor-handlers] Stadium preview generated');
    console.log('[retro-editor-handlers] Stadium changes:', preview.stadiumChanges.length);
    return { success: true, data: preview };

  } catch (error: any) {
    console.error('[retro-editor-handlers] Error getting stadium preview:', error);
    return { success: false, error: error.message };
  }
});

/**
 * Handle: retro:apply-stadium-names
 * Apply historical stadium names to franchise file
 */
ipcMain.handle('retro:apply-stadium-names', async (event, filePath: string, year: number) => {
  console.log('[retro-editor-handlers] ===== APPLY STADIUM NAMES =====');
  console.log('[retro-editor-handlers] File:', filePath);
  console.log('[retro-editor-handlers] Year:', year);

  try {
    const result = await retroEditorService.applyStadiumNames(filePath, year);
    console.log('[retro-editor-handlers] Stadium names applied');
    console.log('[retro-editor-handlers] Stadiums updated:', result.stadiumsUpdated);
    return { success: true, data: result };

  } catch (error: any) {
    console.error('[retro-editor-handlers] Error applying stadium names:', error);
    return { success: false, error: error.message };
  }
});

// ========================================
// TEAM SCHEMES HANDLERS
// ========================================

/**
 * Handle: retro:get-scheme-preview
 * Get preview of team scheme changes for a year
 */
ipcMain.handle('retro:get-scheme-preview', async (event, filePath: string, year: number) => {
  console.log('[retro-editor-handlers] ===== GET SCHEME PREVIEW =====');
  console.log('[retro-editor-handlers] File:', filePath);
  console.log('[retro-editor-handlers] Year:', year);

  try {
    const preview = await retroEditorService.getSchemePreview(filePath, year);
    console.log('[retro-editor-handlers] Scheme preview generated');
    console.log('[retro-editor-handlers] Scheme changes:', preview.schemeChanges.length);
    return { success: true, data: preview };

  } catch (error: any) {
    console.error('[retro-editor-handlers] Error getting scheme preview:', error);
    return { success: false, error: error.message };
  }
});

/**
 * Handle: retro:apply-team-schemes
 * Apply historical team schemes to franchise file
 */
ipcMain.handle('retro:apply-team-schemes', async (event, filePath: string, year: number) => {
  console.log('[retro-editor-handlers] ===== APPLY TEAM SCHEMES =====');
  console.log('[retro-editor-handlers] File:', filePath);
  console.log('[retro-editor-handlers] Year:', year);

  try {
    const result = await retroEditorService.applyTeamSchemes(filePath, year);
    console.log('[retro-editor-handlers] Team schemes applied');
    console.log('[retro-editor-handlers] Schemes updated:', result.schemesUpdated);
    return { success: true, data: result };

  } catch (error: any) {
    console.error('[retro-editor-handlers] Error applying team schemes:', error);
    return { success: false, error: error.message };
  }
});

// ========================================
// UNIFORM HANDLERS
// ========================================

/**
 * Handle: retro:get-uniforms-for-year
 * Get uniform configuration for all teams for a specific year
 */
ipcMain.handle('retro:get-uniforms-for-year', async (event, year: number) => {
  console.log('[retro-editor-handlers] ===== GET UNIFORMS FOR YEAR =====');
  console.log('[retro-editor-handlers] Year:', year);

  try {
    const uniforms = await retroEditorService.getUniformsForYear(year);
    console.log('[retro-editor-handlers] Uniforms for year:', uniforms.teamCount, 'teams');
    return { success: true, data: uniforms };

  } catch (error: any) {
    console.error('[retro-editor-handlers] Error getting uniforms:', error);
    return { success: false, error: error.message };
  }
});

/**
 * Handle: retro:get-uniform-preview-summary
 * Get simplified uniform preview for UI display
 */
ipcMain.handle('retro:get-uniform-preview-summary', async (event, year: number) => {
  console.log('[retro-editor-handlers] ===== GET UNIFORM PREVIEW SUMMARY =====');
  console.log('[retro-editor-handlers] Year:', year);

  try {
    const summary = await retroEditorService.getUniformPreviewSummary(year);
    console.log('[retro-editor-handlers] Uniform summary:', summary.summary);
    return { success: true, data: summary };

  } catch (error: any) {
    console.error('[retro-editor-handlers] Error getting uniform summary:', error);
    return { success: false, error: error.message };
  }
});

/**
 * Handle: retro:apply-uniforms
 * Apply uniforms for a specific year to the loaded franchise
 */
ipcMain.handle('retro:apply-uniforms', async (event, year: number) => {
  console.log('[retro-editor-handlers] ===== APPLY UNIFORMS =====');
  console.log('[retro-editor-handlers] Year:', year);

  try {
    const result = await retroEditorService.applyUniforms(year);
    console.log('[retro-editor-handlers] Uniforms applied');
    console.log('[retro-editor-handlers] Teams updated:', result.uniformsApplied);
    return { success: true, data: result };

  } catch (error: any) {
    console.error('[retro-editor-handlers] Error applying uniforms:', error);
    return { success: false, error: error.message };
  }
});

/**
 * Handle: retro:get-expansion-event
 * Get expansion/relocation event for a specific year
 */
ipcMain.handle('retro:get-expansion-event', async (event, year: number) => {
  console.log('[retro-editor-handlers] ===== GET EXPANSION EVENT =====');
  console.log('[retro-editor-handlers] Year:', year);

  try {
    const expansionEvent = retroEditorService.getExpansionEventForYear(year);
    if (expansionEvent) {
      console.log('[retro-editor-handlers] Found expansion event:', expansionEvent.name);
    } else {
      console.log('[retro-editor-handlers] No expansion event for year', year);
    }
    return { success: true, event: expansionEvent };

  } catch (error: any) {
    console.error('[retro-editor-handlers] Error getting expansion event:', error);
    return { success: false, error: error.message };
  }
});

/**
 * Handle: retro:get-all-expansion-events
 * Get all expansion/relocation events
 */
ipcMain.handle('retro:get-all-expansion-events', async () => {
  console.log('[retro-editor-handlers] ===== GET ALL EXPANSION EVENTS =====');

  try {
    const events = retroEditorService.getAllExpansionEvents();
    console.log('[retro-editor-handlers] Found', events.length, 'expansion events');
    return { success: true, events };

  } catch (error: any) {
    console.error('[retro-editor-handlers] Error getting expansion events:', error);
    return { success: false, error: error.message };
  }
});

/**
 * Handle: retro:execute-relocation
 * Execute team relocation (move all players from source to destination team)
 */
ipcMain.handle('retro:execute-relocation', async (event, filePath: string, sourceTeamIndex: number, destTeamIndex: number) => {
  console.log('[retro-editor-handlers] ===== EXECUTE RELOCATION =====');
  console.log('[retro-editor-handlers] File:', filePath);
  console.log('[retro-editor-handlers] Source team:', sourceTeamIndex, '→ Dest team:', destTeamIndex);

  try {
    const result = await retroEditorService.executeRelocation(filePath, sourceTeamIndex, destTeamIndex);
    if (result.success) {
      console.log('[retro-editor-handlers] Relocation complete:', result.playersTransferred, 'players moved');
    }
    return result;

  } catch (error: any) {
    console.error('[retro-editor-handlers] Error executing relocation:', error);
    return { success: false, playersTransferred: 0, playerNames: [], error: error.message };
  }
});

/**
 * Handle: retro:prepare-expansion-draft
 * Move existing expansion team players to FA before draft
 */
ipcMain.handle('retro:prepare-expansion-draft', async (event, filePath: string, expansionEvent: any) => {
  console.log('[retro-editor-handlers] ===== PREPARE EXPANSION DRAFT =====');
  console.log('[retro-editor-handlers] File:', filePath);
  console.log('[retro-editor-handlers] Event:', expansionEvent?.name);

  try {
    const result = await retroEditorService.prepareExpansionDraft(filePath, expansionEvent);
    console.log('[retro-editor-handlers] Prepare result:', result);
    return result;
  } catch (error: any) {
    console.error('[retro-editor-handlers] Error preparing expansion draft:', error);
    return { success: false, movedCount: 0, error: error.message };
  }
});

/**
 * Handle: retro:get-eligible-players
 * Get players eligible for expansion draft
 * @param filePath - Path to the franchise file
 * @param expansionEvent - The expansion event details
 * @param rosterPath - Optional path to roster file to read correct OVR values from
 */
ipcMain.handle('retro:get-eligible-players', async (event, filePath: string, expansionEvent: any, rosterPath?: string) => {
  console.log('[retro-editor-handlers] ===== GET ELIGIBLE PLAYERS =====');
  console.log('[retro-editor-handlers] File:', filePath);
  console.log('[retro-editor-handlers] Event:', expansionEvent?.name);
  console.log('[retro-editor-handlers] Roster path:', rosterPath || 'not provided');

  try {
    const result = await retroEditorService.getEligiblePlayersForExpansionDraft(filePath, expansionEvent, rosterPath);
    if (result.success) {
      console.log('[retro-editor-handlers] Found', result.players?.length, 'eligible players');
    }
    return result;

  } catch (error: any) {
    console.error('[retro-editor-handlers] Error getting eligible players:', error);
    return { success: false, error: error.message };
  }
});

/**
 * Handle: retro:auto-protect-players
 * Auto-protect top N players per team
 */
ipcMain.handle('retro:auto-protect-players', async (event, players: any[], maxProtected: number) => {
  console.log('[retro-editor-handlers] ===== AUTO PROTECT PLAYERS =====');
  console.log('[retro-editor-handlers] Players:', players.length, 'Max protected:', maxProtected);

  try {
    const result = retroEditorService.autoProtectPlayers(players, maxProtected);
    const protectedCount = result.filter((p: any) => p.isProtected).length;
    console.log('[retro-editor-handlers] Protected', protectedCount, 'players');
    return { success: true, players: result };

  } catch (error: any) {
    console.error('[retro-editor-handlers] Error auto-protecting players:', error);
    return { success: false, error: error.message };
  }
});

/**
 * Handle: retro:execute-expansion-draft
 * Execute expansion draft with selected players
 * @param filePath - Path to the franchise file
 * @param selections - Array of player selections
 * @param expansionTeamIndices - Optional array of team indices to clear before draft
 */
ipcMain.handle('retro:execute-expansion-draft', async (event, filePath: string, selections: any[], expansionTeamIndices?: number[]) => {
  console.log('[retro-editor-handlers] ===== EXECUTE EXPANSION DRAFT =====');
  console.log('[retro-editor-handlers] File:', filePath);
  console.log('[retro-editor-handlers] Selections:', selections.length);
  if (expansionTeamIndices?.length) {
    console.log('[retro-editor-handlers] Expansion teams to clear:', expansionTeamIndices);
  }

  try {
    const result = await retroEditorService.executeExpansionDraft(filePath, selections, expansionTeamIndices);
    if (result.success) {
      console.log('[retro-editor-handlers] Expansion draft complete:', result.playersSelected, 'players selected');
    }
    return result;

  } catch (error: any) {
    console.error('[retro-editor-handlers] Error executing expansion draft:', error);
    return { success: false, playersSelected: 0, error: error.message };
  }
});

/**
 * Handle: retro:apply-era-contracts
 * Apply era-appropriate contracts to all players
 */
ipcMain.handle('retro:apply-era-contracts', async (event, filePath: string, year: number) => {
  console.log('[retro-editor-handlers] ===== APPLY ERA CONTRACTS =====');
  console.log('[retro-editor-handlers] File:', filePath);
  console.log('[retro-editor-handlers] Year:', year);

  try {
    const result = await retroEditorService.applyEraAppropriateContracts(filePath, year);
    if (result.success) {
      console.log('[retro-editor-handlers] Contracts applied to', result.playersUpdated, 'players');
      console.log('[retro-editor-handlers] Average salary:', result.averageSalary, '(thousands)');
    }
    return result;

  } catch (error: any) {
    console.error('[retro-editor-handlers] Error applying era contracts:', error);
    return { success: false, playersUpdated: 0, averageSalary: 0, warnings: [], error: error.message };
  }
});

/**
 * Handle: retro:set-placeholder-coaches
 * Set placeholder coaches for inactive teams to prevent FA pool issues
 */
ipcMain.handle('retro:set-placeholder-coaches', async (event, filePath: string, year: number) => {
  console.log('[retro-editor-handlers] ===== SET PLACEHOLDER COACHES =====');
  console.log('[retro-editor-handlers] File:', filePath);
  console.log('[retro-editor-handlers] Year:', year);

  try {
    const result = await retroEditorService.setPlaceholderCoachesForInactiveTeams(filePath, year);
    if (result.success) {
      console.log('[retro-editor-handlers] Updated', result.coachesUpdated, 'coaches on inactive teams');
      console.log('[retro-editor-handlers] Inactive teams:', result.inactiveTeams.join(', '));
    }
    return result;

  } catch (error: any) {
    console.error('[retro-editor-handlers] Error setting placeholder coaches:', error);
    return { success: false, coachesUpdated: 0, inactiveTeams: [], warnings: [], error: error.message };
  }
});

/**
 * Handle: retro:replace-fa-coaches
 * Replace free agent coaches with real historical coaches from the database
 */
ipcMain.handle('retro:replace-fa-coaches', async (event, filePath: string, year: number) => {
  console.log('[retro-editor-handlers] ===== REPLACE FA COACHES =====');
  console.log('[retro-editor-handlers] File:', filePath);
  console.log('[retro-editor-handlers] Year:', year);

  try {
    const result = await retroEditorService.replaceFACoachesWithRealCoaches(filePath, year);
    if (result.success) {
      console.log('[retro-editor-handlers] Replaced', result.coachesReplaced, 'FA coaches');
      console.log('[retro-editor-handlers] Available real coaches:', result.availableRealCoaches);
    }
    return result;

  } catch (error: any) {
    console.error('[retro-editor-handlers] Error replacing FA coaches:', error);
    return { success: false, coachesReplaced: 0, faCoachCount: 0, availableRealCoaches: 0, warnings: [], error: error.message };
  }
});

/**
 * Handle: retro:apply-and-save
 * Apply ALL retro changes AND save in ONE atomic operation.
 * This prevents state loss between separate IPC calls.
 */
ipcMain.handle('retro:apply-and-save', async (event, filePath: string, year: number) => {
  console.log('[retro-editor-handlers] ===== APPLY AND SAVE =====');
  console.log('[retro-editor-handlers] File:', filePath);
  console.log('[retro-editor-handlers] Year:', year);

  try {
    const result = await retroEditorService.applyAndSave(filePath, year);
    if (result.success) {
      console.log('[retro-editor-handlers] Apply and save SUCCESS');
      console.log('[retro-editor-handlers] Players moved:', result.playersMoved);
      console.log('[retro-editor-handlers] Super Bowl set:', result.superBowlSet);
    } else {
      console.log('[retro-editor-handlers] Apply and save FAILED:', result.error);
    }
    return result;

  } catch (error: any) {
    console.error('[retro-editor-handlers] Error in apply-and-save:', error);
    return { success: false, playersMoved: 0, superBowlSet: 0, error: error.message };
  }
});

/**
 * Handle: retro:apply-and-save-as
 * Apply ALL retro changes AND save to a NEW location (Save As).
 * Shows a file picker dialog then saves to the chosen location.
 */
ipcMain.handle('retro:apply-and-save-as', async (event, originalPath: string, year: number) => {
  console.log('[retro-editor-handlers] ===== APPLY AND SAVE AS =====');
  console.log('[retro-editor-handlers] Original file:', originalPath);
  console.log('[retro-editor-handlers] Year:', year);

  try {
    // Show save dialog
    const result = await dialog.showSaveDialog({
      title: 'Save Retro Franchise As',
      defaultPath: originalPath,
      filters: [
        { name: 'All Files', extensions: ['*'] }
      ]
    });

    if (result.canceled || !result.filePath) {
      console.log('[retro-editor-handlers] Save As cancelled');
      return { success: false, cancelled: true };
    }

    const saveResult = await retroEditorService.applyAndSaveAs(originalPath, result.filePath, year);
    if (saveResult.success) {
      console.log('[retro-editor-handlers] Apply and save as SUCCESS');
      console.log('[retro-editor-handlers] Players moved:', saveResult.playersMoved);
      console.log('[retro-editor-handlers] Super Bowl set:', saveResult.superBowlSet);
      console.log('[retro-editor-handlers] New path:', saveResult.newPath);
    } else {
      console.log('[retro-editor-handlers] Apply and save as FAILED:', saveResult.error);
    }
    return saveResult;

  } catch (error: any) {
    console.error('[retro-editor-handlers] Error in apply-and-save-as:', error);
    return { success: false, playersMoved: 0, superBowlSet: 0, error: error.message };
  }
});

/**
 * Handle: retro:apply-all-and-save
 * THE CORRECT APPROACH: Gather all wizard data, then make ALL changes at once and save.
 *
 * This is called ONCE at the end of the wizard with all collected data.
 * The renderer collects data during wizard steps but makes NO modifications.
 * All modifications happen here in one atomic operation.
 */
ipcMain.handle('retro:apply-all-and-save', async (event, config: {
  sourcePath: string;
  saveAs: boolean; // true = show save dialog, false = overwrite source
  year: number;
  options: {
    teams?: boolean;
    abbreviations?: boolean;
    schedule?: boolean;
    coaches?: boolean;
    salaryCap?: boolean;
    stadiums?: boolean;
    schemes?: boolean;
    uniforms?: boolean;
    expansion?: boolean;
  };
  expansionEvent?: any;
  expansionDraftSelections?: Array<{ playerRecordIndex: number; newTeamIndex: number }>;
  expansionTeamIndices?: number[]; // Team indices for clearing rosters before expansion draft
}) => {
  console.log('[retro-editor-handlers] ===== APPLY ALL AND SAVE (SINGLE OPERATION) =====');
  console.log('[retro-editor-handlers] Source file:', config.sourcePath);
  console.log('[retro-editor-handlers] Year:', config.year);
  console.log('[retro-editor-handlers] Save as:', config.saveAs);
  console.log('[retro-editor-handlers] Options:', config.options);
  if (config.expansionEvent) {
    console.log('[retro-editor-handlers] Expansion event:', config.expansionEvent.name);
  }
  if (config.expansionDraftSelections?.length) {
    console.log('[retro-editor-handlers] Expansion draft selections:', config.expansionDraftSelections.length);
  }
  if (config.expansionTeamIndices?.length) {
    console.log('[retro-editor-handlers] Expansion team indices:', config.expansionTeamIndices);
  }

  try {
    let targetPath = config.sourcePath;

    // If saveAs is true, show save dialog
    if (config.saveAs) {
      const result = await dialog.showSaveDialog({
        title: 'Save Retro Franchise As',
        defaultPath: config.sourcePath,
        filters: [
          { name: 'All Files', extensions: ['*'] }
        ]
      });

      if (result.canceled || !result.filePath) {
        console.log('[retro-editor-handlers] Save cancelled');
        return { success: false, cancelled: true };
      }

      targetPath = result.filePath;
    }

    // Call the single service method that does everything
    const result = await retroEditorService.applyAllRetroChangesAndSave(
      config.sourcePath,
      targetPath,
      {
        year: config.year,
        options: config.options,
        expansionEvent: config.expansionEvent,
        expansionDraftSelections: config.expansionDraftSelections,
        expansionTeamIndices: config.expansionTeamIndices,
        customSalaryCap: config.customSalaryCap // Custom cap in dollars, or undefined to use historical
      }
    );

    if (result.success) {
      console.log('[retro-editor-handlers] ===== APPLY ALL SUCCESS =====');
      console.log('[retro-editor-handlers] Results:', JSON.stringify(result.results, null, 2));
      if (result.diagnostics) {
        console.log('[retro-editor-handlers] Diagnostics steps:', result.diagnostics.steps);
      }
    } else {
      console.log('[retro-editor-handlers] Apply all FAILED:', result.error);
      if (result.diagnostics) {
        console.log('[retro-editor-handlers] Diagnostics steps:', result.diagnostics.steps);
      }
    }

    return {
      ...result,
      targetPath
    };

  } catch (error: any) {
    console.error('[retro-editor-handlers] Error in apply-all-and-save:', error);
    return { success: false, error: error.message };
  }
});

// ============================================
// Commentary Fix Handlers
// ============================================

/**
 * Get commentary preview - shows players with incorrect commentary IDs
 */
ipcMain.handle('retro:get-commentary-preview', async (event, filePath: string) => {
  try {
    console.log('[retro-editor-handlers] Getting commentary preview');
    return await retroEditorService.getCommentaryPreview(filePath);
  } catch (error: any) {
    console.error('[retro-editor-handlers] Error getting commentary preview:', error);
    return { success: false, playersToFix: [], totalPlayers: 0, error: error.message };
  }
});

/**
 * Apply commentary fix - updates CommentaryId for all players
 */
ipcMain.handle('retro:apply-commentary-fix', async (event, filePath: string) => {
  try {
    console.log('[retro-editor-handlers] Applying commentary fix');
    return await retroEditorService.applyCommentaryFix(filePath);
  } catch (error: any) {
    console.error('[retro-editor-handlers] Error applying commentary fix:', error);
    return { success: false, playersFixed: 0, error: error.message };
  }
});

// ============================================
// Coach Database Handlers
// ============================================

/**
 * Get free agent coaches from the franchise file
 */
ipcMain.handle('retro:get-fa-coaches', async (event, filePath: string) => {
  try {
    console.log('[retro-editor-handlers] Getting FA coaches');
    return await retroEditorService.getFreeAgentCoaches(filePath);
  } catch (error: any) {
    console.error('[retro-editor-handlers] Error getting FA coaches:', error);
    return { success: false, faCoaches: [], error: error.message };
  }
});

/**
 * Search the coach database
 */
ipcMain.handle('retro:search-coach-database', async (event, query: string, year: number, limit?: number) => {
  try {
    console.log(`[retro-editor-handlers] Searching coach database for "${query}" (year=${year})`);
    const result = retroEditorService.searchCoachDatabase(query, year, limit || 20);
    console.log(`[retro-editor-handlers] Search returned ${result.results.length} results`);
    return result;
  } catch (error: any) {
    console.error('[retro-editor-handlers] Error searching coach database:', error);
    return { success: false, results: [], error: error.message };
  }
});

/**
 * Replace an FA coach with a coach from the database
 */
ipcMain.handle('retro:replace-fa-coach', async (event, filePath: string, faCoachIndex: number, dbCoach: any, year: number) => {
  try {
    console.log(`[retro-editor-handlers] Replacing FA coach at index ${faCoachIndex}`);
    return await retroEditorService.replaceCoachWithDatabaseCoach(filePath, faCoachIndex, dbCoach, year);
  } catch (error: any) {
    console.error('[retro-editor-handlers] Error replacing FA coach:', error);
    return { success: false, error: error.message };
  }
});

console.log('[retro-editor-handlers] Retro Editor IPC handlers registered');
