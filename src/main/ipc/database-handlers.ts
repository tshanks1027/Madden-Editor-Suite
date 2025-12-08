/**
 * Database IPC Handlers
 *
 * IPC handlers for user database operations.
 * Provides access to edit/create player data in the user overlay database.
 */

import { ipcMain } from 'electron';
import {
  userDatabaseService,
  PlayerEdit,
  AppearanceEdit,
  SeasonEdit,
  CustomPlayer,
  CustomPlayerSeason
} from '../services/UserDatabaseService';
import { lookupService } from '../services/lookup-service';

// =============================================
// PLAYER EDIT OPERATIONS
// =============================================

/**
 * Handle: database:save-player-edit
 * Save edits to an existing player from the original database
 */
ipcMain.handle('database:save-player-edit', async (event, originalId: number, edits: Partial<PlayerEdit>) => {
  try {
    await userDatabaseService.waitForReady();
    userDatabaseService.savePlayerEdit(originalId, edits);
    return { success: true };
  } catch (error) {
    console.error('[database-handlers] Error saving player edit:', error);
    return { success: false, error: String(error) };
  }
});

/**
 * Handle: database:get-player-edit
 * Get edits for a player (returns null if no edits exist)
 */
ipcMain.handle('database:get-player-edit', async (event, originalId: number) => {
  try {
    await userDatabaseService.waitForReady();
    return { success: true, data: userDatabaseService.getPlayerEdit(originalId) };
  } catch (error) {
    console.error('[database-handlers] Error getting player edit:', error);
    return { success: false, error: String(error) };
  }
});

/**
 * Handle: database:has-player-edit
 * Check if a player has any edits
 */
ipcMain.handle('database:has-player-edit', async (event, originalId: number) => {
  try {
    await userDatabaseService.waitForReady();
    return { success: true, hasEdit: userDatabaseService.hasPlayerEdit(originalId) };
  } catch (error) {
    console.error('[database-handlers] Error checking player edit:', error);
    return { success: false, error: String(error) };
  }
});

/**
 * Handle: database:reset-player
 * Reset all edits for a single player
 */
ipcMain.handle('database:reset-player', async (event, originalId: number) => {
  try {
    await userDatabaseService.waitForReady();
    userDatabaseService.resetPlayer(originalId);
    return { success: true };
  } catch (error) {
    console.error('[database-handlers] Error resetting player:', error);
    return { success: false, error: String(error) };
  }
});

/**
 * Handle: database:clear-player-seasons
 * Clear all season data for a player (fixes wrongly-assigned seasons)
 */
ipcMain.handle('database:clear-player-seasons', async (event, playerId: number) => {
  try {
    await userDatabaseService.waitForReady();
    const deletedCount = userDatabaseService.clearPlayerSeasons(playerId);
    return { success: true, deletedCount };
  } catch (error) {
    console.error('[database-handlers] Error clearing player seasons:', error);
    return { success: false, error: String(error) };
  }
});

// =============================================
// APPEARANCE EDIT OPERATIONS
// =============================================

/**
 * Handle: database:save-appearance-edit
 * Save appearance edits (PID, PAM, PLPO) for a player
 */
ipcMain.handle('database:save-appearance-edit', async (event, originalPlayerId: number, edits: Partial<AppearanceEdit>) => {
  try {
    await userDatabaseService.waitForReady();
    userDatabaseService.saveAppearanceEdit(originalPlayerId, edits);
    return { success: true };
  } catch (error) {
    console.error('[database-handlers] Error saving appearance edit:', error);
    return { success: false, error: String(error) };
  }
});

/**
 * Handle: database:get-appearance-edit
 * Get appearance edits for a player
 */
ipcMain.handle('database:get-appearance-edit', async (event, originalPlayerId: number) => {
  try {
    await userDatabaseService.waitForReady();
    return { success: true, data: userDatabaseService.getAppearanceEdit(originalPlayerId) };
  } catch (error) {
    console.error('[database-handlers] Error getting appearance edit:', error);
    return { success: false, error: String(error) };
  }
});

// =============================================
// SEASON EDIT OPERATIONS
// =============================================

/**
 * Handle: database:save-season-edit
 * Save rating edits for a player's specific season
 */
ipcMain.handle('database:save-season-edit', async (event, originalPlayerId: number, year: number, edits: Partial<SeasonEdit>) => {
  try {
    await userDatabaseService.waitForReady();
    userDatabaseService.saveSeasonEdit(originalPlayerId, year, edits);
    return { success: true };
  } catch (error) {
    console.error('[database-handlers] Error saving season edit:', error);
    return { success: false, error: String(error) };
  }
});

/**
 * Handle: database:get-season-edit
 * Get rating edits for a player's specific season
 */
ipcMain.handle('database:get-season-edit', async (event, originalPlayerId: number, year: number) => {
  try {
    await userDatabaseService.waitForReady();
    return { success: true, data: userDatabaseService.getSeasonEdit(originalPlayerId, year) };
  } catch (error) {
    console.error('[database-handlers] Error getting season edit:', error);
    return { success: false, error: String(error) };
  }
});

/**
 * Handle: database:get-season-edits-for-player
 * Get all season edits for a player
 */
ipcMain.handle('database:get-season-edits-for-player', async (event, originalPlayerId: number) => {
  try {
    await userDatabaseService.waitForReady();
    return { success: true, data: userDatabaseService.getSeasonEditsForPlayer(originalPlayerId) };
  } catch (error) {
    console.error('[database-handlers] Error getting season edits:', error);
    return { success: false, error: String(error) };
  }
});

/**
 * Handle: database:save-season-edit-all-years
 * Apply partial edits to ALL years in the player's career span.
 * Uses career span (draftClass/careerFrom to careerTo) not just years with existing data.
 */
ipcMain.handle('database:save-season-edit-all-years', async (event, originalPlayerId: number, edits: Partial<SeasonEdit>) => {
  try {
    await userDatabaseService.waitForReady();
    await lookupService.waitForReady();

    // Get player info to determine career span
    const playerInfo = lookupService.getPlayerByInternalId(originalPlayerId);

    if (!playerInfo) {
      console.log('[database-handlers] Player not found:', originalPlayerId);
      return { success: false, error: 'Player not found' };
    }

    // Determine career span - same logic as frontend
    const draftYear = playerInfo.draftClass ? parseInt(String(playerInfo.draftClass)) : null;
    const careerFrom = playerInfo.careerFrom ? parseInt(String(playerInfo.careerFrom)) : null;
    const careerTo = playerInfo.careerTo ? parseInt(String(playerInfo.careerTo)) : null;

    // Calculate start year (earliest of draft or career from)
    let startYear = draftYear;
    if (!startYear || isNaN(startYear)) {
      startYear = careerFrom;
    } else if (careerFrom && !isNaN(careerFrom) && careerFrom < startYear) {
      startYear = careerFrom;
    }

    // Calculate end year
    let endYear = careerTo;
    if (!endYear || isNaN(endYear)) {
      endYear = new Date().getFullYear();
    }

    // Build year range
    const years: number[] = [];
    if (startYear && endYear && !isNaN(startYear) && !isNaN(endYear)) {
      for (let year = startYear; year <= endYear; year++) {
        years.push(year);
      }
    }

    if (years.length === 0) {
      // Fallback to years with existing data
      const existingYears = lookupService.getPlayerSeasonYears(originalPlayerId);
      years.push(...(existingYears || []));
    }

    if (years.length === 0) {
      console.log('[database-handlers] No years found for player:', originalPlayerId);
      return { success: true, updatedYears: [] };
    }

    console.log(`[database-handlers] Applying edits to ${years.length} seasons (${years[0]}-${years[years.length - 1]}) for player ${originalPlayerId}:`, edits);

    // Apply the edits to each year
    for (const year of years) {
      userDatabaseService.saveSeasonEdit(originalPlayerId, year, edits);
    }

    return { success: true, updatedYears: years };
  } catch (error) {
    console.error('[database-handlers] Error saving season edits to all years:', error);
    return { success: false, error: String(error) };
  }
});

// =============================================
// CUSTOM PLAYER OPERATIONS
// =============================================

/**
 * Handle: database:create-custom-player
 * Create a new custom player
 */
ipcMain.handle('database:create-custom-player', async (event, player: CustomPlayer) => {
  try {
    await userDatabaseService.waitForReady();
    const id = userDatabaseService.createCustomPlayer(player);
    return { success: true, id };
  } catch (error) {
    console.error('[database-handlers] Error creating custom player:', error);
    return { success: false, error: String(error) };
  }
});

/**
 * Handle: database:update-custom-player
 * Update an existing custom player
 */
ipcMain.handle('database:update-custom-player', async (event, id: number, updates: Partial<CustomPlayer>) => {
  try {
    await userDatabaseService.waitForReady();
    userDatabaseService.updateCustomPlayer(id, updates);
    return { success: true };
  } catch (error) {
    console.error('[database-handlers] Error updating custom player:', error);
    return { success: false, error: String(error) };
  }
});

/**
 * Handle: database:get-custom-player
 * Get a custom player by ID
 */
ipcMain.handle('database:get-custom-player', async (event, id: number) => {
  try {
    await userDatabaseService.waitForReady();
    return { success: true, data: userDatabaseService.getCustomPlayer(id) };
  } catch (error) {
    console.error('[database-handlers] Error getting custom player:', error);
    return { success: false, error: String(error) };
  }
});

/**
 * Handle: database:get-all-custom-players
 * Get all custom players
 */
ipcMain.handle('database:get-all-custom-players', async (event) => {
  try {
    await userDatabaseService.waitForReady();
    return { success: true, data: userDatabaseService.getAllCustomPlayers() };
  } catch (error) {
    console.error('[database-handlers] Error getting all custom players:', error);
    return { success: false, error: String(error) };
  }
});

/**
 * Handle: database:delete-custom-player
 * Delete a custom player
 */
ipcMain.handle('database:delete-custom-player', async (event, id: number) => {
  try {
    await userDatabaseService.waitForReady();
    userDatabaseService.deleteCustomPlayer(id);
    return { success: true };
  } catch (error) {
    console.error('[database-handlers] Error deleting custom player:', error);
    return { success: false, error: String(error) };
  }
});

/**
 * Handle: database:search-custom-players
 * Search custom players by name
 */
ipcMain.handle('database:search-custom-players', async (event, query: string, limit?: number) => {
  try {
    await userDatabaseService.waitForReady();
    return { success: true, data: userDatabaseService.searchCustomPlayers(query, limit) };
  } catch (error) {
    console.error('[database-handlers] Error searching custom players:', error);
    return { success: false, error: String(error) };
  }
});

// =============================================
// CUSTOM PLAYER SEASON OPERATIONS
// =============================================

/**
 * Handle: database:save-custom-player-season
 * Save a season for a custom player
 */
ipcMain.handle('database:save-custom-player-season', async (event, customPlayerId: number, year: number, season: Partial<CustomPlayerSeason>) => {
  try {
    await userDatabaseService.waitForReady();
    userDatabaseService.saveCustomPlayerSeason(customPlayerId, year, season);
    return { success: true };
  } catch (error) {
    console.error('[database-handlers] Error saving custom player season:', error);
    return { success: false, error: String(error) };
  }
});

/**
 * Handle: database:get-custom-player-season
 * Get a season for a custom player
 */
ipcMain.handle('database:get-custom-player-season', async (event, customPlayerId: number, year: number) => {
  try {
    await userDatabaseService.waitForReady();
    return { success: true, data: userDatabaseService.getCustomPlayerSeason(customPlayerId, year) };
  } catch (error) {
    console.error('[database-handlers] Error getting custom player season:', error);
    return { success: false, error: String(error) };
  }
});

/**
 * Handle: database:get-custom-player-seasons
 * Get all seasons for a custom player
 */
ipcMain.handle('database:get-custom-player-seasons', async (event, customPlayerId: number) => {
  try {
    await userDatabaseService.waitForReady();
    return { success: true, data: userDatabaseService.getCustomPlayerSeasons(customPlayerId) };
  } catch (error) {
    console.error('[database-handlers] Error getting custom player seasons:', error);
    return { success: false, error: String(error) };
  }
});

// =============================================
// RESET OPERATIONS
// =============================================

/**
 * Handle: database:reset-all-edits
 * Reset all player edits (keeps custom players)
 */
ipcMain.handle('database:reset-all-edits', async (event) => {
  try {
    await userDatabaseService.waitForReady();
    userDatabaseService.resetAllEdits();
    return { success: true };
  } catch (error) {
    console.error('[database-handlers] Error resetting all edits:', error);
    return { success: false, error: String(error) };
  }
});

/**
 * Handle: database:reset-all-custom-players
 * Delete all custom players
 */
ipcMain.handle('database:reset-all-custom-players', async (event) => {
  try {
    await userDatabaseService.waitForReady();
    userDatabaseService.resetAllCustomPlayers();
    return { success: true };
  } catch (error) {
    console.error('[database-handlers] Error resetting all custom players:', error);
    return { success: false, error: String(error) };
  }
});

/**
 * Handle: database:reset-all
 * Full database reset (edits + custom players)
 */
ipcMain.handle('database:reset-all', async (event) => {
  try {
    await userDatabaseService.waitForReady();
    userDatabaseService.resetAll();
    return { success: true };
  } catch (error) {
    console.error('[database-handlers] Error resetting all:', error);
    return { success: false, error: String(error) };
  }
});

// =============================================
// BACKUP & RESTORE
// =============================================

/**
 * Handle: database:create-backup
 * Create a backup of the user database
 */
ipcMain.handle('database:create-backup', async (event) => {
  try {
    await userDatabaseService.waitForReady();
    const backupPath = userDatabaseService.createBackup();
    return { success: true, backupPath };
  } catch (error) {
    console.error('[database-handlers] Error creating backup:', error);
    return { success: false, error: String(error) };
  }
});

/**
 * Handle: database:restore-backup
 * Restore from a backup
 */
ipcMain.handle('database:restore-backup', async (event, backupPath: string) => {
  try {
    await userDatabaseService.waitForReady();
    userDatabaseService.restoreBackup(backupPath);
    return { success: true };
  } catch (error) {
    console.error('[database-handlers] Error restoring backup:', error);
    return { success: false, error: String(error) };
  }
});

/**
 * Handle: database:get-backup-list
 * Get list of available backups
 */
ipcMain.handle('database:get-backup-list', async (event) => {
  try {
    await userDatabaseService.waitForReady();
    return { success: true, backups: userDatabaseService.getBackupList() };
  } catch (error) {
    console.error('[database-handlers] Error getting backup list:', error);
    return { success: false, error: String(error) };
  }
});

// =============================================
// STATISTICS & UTILITIES
// =============================================

/**
 * Handle: database:get-stats
 * Get database statistics
 */
ipcMain.handle('database:get-stats', async (event) => {
  try {
    await userDatabaseService.waitForReady();
    return { success: true, data: userDatabaseService.getStats() };
  } catch (error) {
    console.error('[database-handlers] Error getting stats:', error);
    return { success: false, error: String(error) };
  }
});

/**
 * Handle: database:get-edited-player-ids
 * Get list of all player IDs that have edits
 */
ipcMain.handle('database:get-edited-player-ids', async (event) => {
  try {
    await userDatabaseService.waitForReady();
    return { success: true, data: userDatabaseService.getEditedPlayerIds() };
  } catch (error) {
    console.error('[database-handlers] Error getting edited player IDs:', error);
    return { success: false, error: String(error) };
  }
});

/**
 * Handle: database:is-ready
 * Check if user database service is ready
 */
ipcMain.handle('database:is-ready', async (event) => {
  return userDatabaseService.isReady();
});

// =============================================
// MERGED DATA ACCESS (Original + User Edits)
// =============================================

/**
 * Handle: database:get-merged-player
 * Get player data with user edits merged in
 */
ipcMain.handle('database:get-merged-player', async (event, internalId: number) => {
  try {
    await userDatabaseService.waitForReady();
    await lookupService.waitForReady();

    // Get original player data
    const original = lookupService.getPlayerByInternalId(internalId);
    if (!original) {
      return { success: false, error: 'Player not found' };
    }

    // Get user edits
    const playerEdit = userDatabaseService.getPlayerEdit(internalId);
    const appearanceEdit = userDatabaseService.getAppearanceEdit(internalId);

    // Merge edits over original data
    const merged = {
      ...original,
      // Apply player edits (only non-null values)
      ...(playerEdit?.firstName && { firstName: playerEdit.firstName }),
      ...(playerEdit?.lastName && { lastName: playerEdit.lastName }),
      ...(playerEdit?.collegeId !== undefined && { college: String(playerEdit.collegeId) }),
      ...(playerEdit?.race !== undefined && { race: playerEdit.race }),
      ...(playerEdit?.height !== undefined && { height: playerEdit.height }),
      ...(playerEdit?.weight !== undefined && { weight: playerEdit.weight }),
      ...(playerEdit?.hometown && { hometown: playerEdit.hometown }),
      ...(playerEdit?.homeState && { homeState: playerEdit.homeState }),
      ...(playerEdit?.draftClass !== undefined && { draftClass: String(playerEdit.draftClass) }),
      ...(playerEdit?.draftRound && { round: playerEdit.draftRound }),
      ...(playerEdit?.draftPick !== undefined && { pick: String(playerEdit.draftPick) }),
      ...(playerEdit?.careerFrom !== undefined && { careerFrom: playerEdit.careerFrom }),
      ...(playerEdit?.careerTo !== undefined && { careerTo: playerEdit.careerTo }),
      // Apply appearance edits
      ...(appearanceEdit?.maddenPid !== undefined && { pid: appearanceEdit.maddenPid }),
      ...(appearanceEdit?.maddenPam && { pam: appearanceEdit.maddenPam }),
      ...(appearanceEdit?.maddenPlpo && { plpo: appearanceEdit.maddenPlpo }),
      ...(appearanceEdit?.maddenCommid && { commID: appearanceEdit.maddenCommid }),
      // Mark as edited
      hasEdits: !!(playerEdit || appearanceEdit)
    };

    return { success: true, player: merged };
  } catch (error) {
    console.error('[database-handlers] Error getting merged player:', error);
    return { success: false, error: String(error) };
  }
});

/**
 * Handle: database:get-merged-player-season
 * Get player season data with user edits merged in
 */
ipcMain.handle('database:get-merged-player-season', async (event, internalId: number, year: number) => {
  try {
    await userDatabaseService.waitForReady();
    await lookupService.waitForReady();

    // Get original player first to get the PID
    const player = lookupService.getPlayerByInternalId(internalId);
    if (!player) {
      return { success: false, error: 'Player not found' };
    }

    // Check if seasons have been cleared for this player
    const seasonsCleared = userDatabaseService.areSeasonsCleared(internalId);

    // Get original season data from lookup service (only if not cleared)
    const originalSeason = seasonsCleared ? null : lookupService.getPlayerRatingsForYear(player.pid, year);

    // Get user edits for this season
    const seasonEdit = userDatabaseService.getSeasonEdit(internalId, year);

    if (!originalSeason && !seasonEdit) {
      return { success: false, error: 'No season data found' };
    }

    // Build merged season
    const merged = {
      playerId: internalId,
      year,
      team: seasonEdit?.team ?? originalSeason?.team,
      jersey: seasonEdit?.jersey ?? originalSeason?.jersey,
      age: seasonEdit?.age ?? originalSeason?.age,
      position: seasonEdit?.position ?? originalSeason?.position,
      archetype: seasonEdit?.archetype ?? originalSeason?.archetype,
      ratings: {
        ...(originalSeason?.ratings || {}),
        ...(seasonEdit?.ratings || {})
      },
      hasEdits: !!seasonEdit
    };

    return { success: true, season: merged };
  } catch (error) {
    console.error('[database-handlers] Error getting merged player season:', error);
    return { success: false, error: String(error) };
  }
});

/**
 * Handle: database:get-player-season-years
 * Get years where player has season data in the database
 */
ipcMain.handle('database:get-player-season-years', async (event, internalId: number) => {
  try {
    await lookupService.waitForReady();
    await userDatabaseService.waitForReady();

    // Check if seasons have been cleared for this player
    if (userDatabaseService.areSeasonsCleared(internalId)) {
      console.log(`[database-handlers] Player ${internalId} has cleared seasons, returning empty list`);
      return { success: true, years: [] };
    }

    const years = lookupService.getPlayerSeasonYears(internalId);

    return { success: true, years };
  } catch (error) {
    console.error('[database-handlers] Error getting player season years:', error);
    return { success: false, error: String(error) };
  }
});

// =============================================
// SEARCH OPERATIONS
// =============================================

/**
 * Handle: database:search-players
 * Search for players by name or other criteria
 */
ipcMain.handle('database:search-players', async (event, query: string, options?: { limit?: number; position?: string; draftYearFrom?: number; draftYearTo?: number; team?: string }) => {
  try {
    await lookupService.waitForReady();

    let results = lookupService.searchPlayers(query, options?.limit || 100);

    // Apply additional filters
    if (options?.position) {
      results = results.filter(p => p.position === options.position);
    }

    if (options?.draftYearFrom) {
      results = results.filter(p => {
        const year = parseInt(p.draftClass || '0', 10);
        return year >= options.draftYearFrom!;
      });
    }

    if (options?.draftYearTo) {
      results = results.filter(p => {
        const year = parseInt(p.draftClass || '9999', 10);
        return year <= options.draftYearTo!;
      });
    }

    // Apply team filter - check if player played for this team in any season
    if (options?.team) {
      const teamName = options.team.toLowerCase();
      results = results.filter(p => {
        const seasons = lookupService.getPlayerSeasons(p.internalId);
        return seasons.some(s => s.team && s.team.toLowerCase().includes(teamName));
      });
    }

    // Map to a simpler format for the browser
    const players = results.map(p => ({
      internalId: p.internalId,
      pid: p.pid,
      firstName: p.firstName,
      lastName: p.lastName,
      position: p.position,
      college: p.college,
      draftClass: p.draftClass,
      draftRound: p.round,
      draftPick: p.pick,
      careerFrom: p.careerFrom,
      careerTo: p.careerTo,
      isHof: p.isHOF || false,
      isCustom: false
    }));

    // Also search custom players
    const customPlayers = userDatabaseService.searchCustomPlayers(query, options?.limit || 100);
    let filteredCustom = customPlayers;

    // Apply filters to custom players
    if (options?.position) {
      filteredCustom = filteredCustom.filter(p => p.position === options.position);
    }
    if (options?.draftYearFrom) {
      filteredCustom = filteredCustom.filter(p => {
        const year = p.draftClass || 0;
        return year >= options.draftYearFrom!;
      });
    }
    if (options?.draftYearTo) {
      filteredCustom = filteredCustom.filter(p => {
        const year = p.draftClass || 9999;
        return year <= options.draftYearTo!;
      });
    }

    // Map custom players to same format
    const customMapped = filteredCustom.map(p => ({
      internalId: p.id,
      pid: p.maddenPid || 0,
      firstName: p.firstName,
      lastName: p.lastName,
      position: p.position || '',
      college: '', // Custom players don't have college name resolved
      draftClass: p.draftClass ? String(p.draftClass) : '',
      draftRound: p.draftRound || '',
      draftPick: p.draftPick || 0,
      careerFrom: p.careerFrom || 0,
      careerTo: p.careerTo || 0,
      isHof: false,
      isCustom: true
    }));

    // Combine results - custom players first
    const allPlayers = [...customMapped, ...players];

    console.log(`[database-handlers] searchPlayers - Found ${players.length} database + ${customMapped.length} custom matching "${query}"`);
    return { success: true, players: allPlayers };
  } catch (error) {
    console.error('[database-handlers] Error searching players:', error);
    return { success: false, error: String(error) };
  }
});

/**
 * Handle: database:get-all-players
 * Get all players from the database with server-side filtering
 */
ipcMain.handle('database:get-all-players', async (event, options?: {
  offset?: number;
  limit?: number;
  position?: string;
  draftYearFrom?: number;
  draftYearTo?: number;
  team?: string;
}) => {
  try {
    await lookupService.waitForReady();

    const offset = options?.offset || 0;
    const limit = options?.limit || 50;

    // Get all custom players first
    let customPlayers = userDatabaseService.getAllCustomPlayers();

    // Apply filters to custom players
    if (options?.position) {
      customPlayers = customPlayers.filter(p => p.position === options.position);
    }
    if (options?.draftYearFrom) {
      customPlayers = customPlayers.filter(p => {
        const year = p.draftClass || 0;
        return year >= options.draftYearFrom!;
      });
    }
    if (options?.draftYearTo) {
      customPlayers = customPlayers.filter(p => {
        const year = p.draftClass || 9999;
        return year <= options.draftYearTo!;
      });
    }

    // Map custom players to common format
    const customMapped = customPlayers.map(p => ({
      internalId: p.id,
      pid: p.maddenPid || 0,
      firstName: p.firstName,
      lastName: p.lastName,
      position: p.position || '',
      college: '',
      draftClass: p.draftClass ? String(p.draftClass) : '',
      draftRound: p.draftRound || '',
      draftPick: p.draftPick || 0,
      careerFrom: p.careerFrom || 0,
      careerTo: p.careerTo || 0,
      isHof: false,
      isCustom: true
    }));

    // Get all players from the cache (this is already loaded in memory)
    let allPlayers = lookupService.getAllPlayers();
    console.log(`[database-handlers] getAllPlayers - Total players in cache: ${allPlayers.length}, custom: ${customMapped.length}`);

    // Apply server-side filters BEFORE pagination
    if (options?.position) {
      allPlayers = allPlayers.filter(p => p.position === options.position);
    }

    if (options?.draftYearFrom) {
      allPlayers = allPlayers.filter(p => {
        const year = parseInt(p.draftClass || '0', 10);
        return year >= options.draftYearFrom!;
      });
    }

    if (options?.draftYearTo) {
      allPlayers = allPlayers.filter(p => {
        const year = parseInt(p.draftClass || '9999', 10);
        return year <= options.draftYearTo!;
      });
    }

    // Apply team filter - check if player played for this team in any season
    if (options?.team) {
      const teamName = options.team.toLowerCase();
      allPlayers = allPlayers.filter(p => {
        const seasons = lookupService.getPlayerSeasons(p.internalId);
        return seasons.some(s => s.team && s.team.toLowerCase().includes(teamName));
      });
    }

    // Map database players to common format
    const dbMapped = allPlayers.map(p => ({
      internalId: p.internalId,
      pid: p.pid,
      firstName: p.firstName,
      lastName: p.lastName,
      position: p.position,
      college: p.college,
      draftClass: p.draftClass,
      draftRound: p.round,
      draftPick: p.pick,
      careerFrom: p.careerFrom,
      careerTo: p.careerTo,
      isHof: p.isHOF || false,
      isCustom: false
    }));

    // Combine: custom players first, then database players
    const combined = [...customMapped, ...dbMapped];

    // Get total AFTER filtering but BEFORE pagination
    const total = combined.length;

    // Apply pagination
    const paginated = combined.slice(offset, offset + limit);

    console.log(`[database-handlers] getAllPlayers - Returning ${paginated.length} players (filtered total: ${total})`);

    return {
      success: true,
      players: paginated,
      total,
      offset,
      limit
    };
  } catch (error) {
    console.error('[database-handlers] Error getting all players:', error);
    return { success: false, error: String(error) };
  }
});

// =============================================
// PLAYER TRANSFER OPERATIONS (ROSTER/DRAFT)
// =============================================

// Default archetypes by position (first/primary archetype for each position)
const DEFAULT_ARCHETYPES: Record<string, number> = {
  'QB': 0,    // Field General
  'HB': 6,    // Elusive Back
  'FB': 8,    // Power Blocking
  'WR': 15,   // Playmaker
  'TE': 20,   // Physical
  'LT': 27,   // Pass Protector
  'LG': 31,   // Pass Protector
  'C': 35,    // Pass Protector
  'RG': 31,   // Pass Protector
  'RT': 27,   // Pass Protector
  'LEDG': 45, // Speed Rusher
  'REDG': 45, // Speed Rusher
  'DT': 42,   // Run Stopper
  'SAM': 49,  // Speed
  'MIKE': 53, // Field General
  'WILL': 49, // Speed
  'CB': 57,   // Man to Man
  'FS': 61,   // Zone
  'SS': 65,   // Run Support
  'K': 69,    // Accurate
  'P': 71,    // Power
  'LS': 73    // Field General (Long Snapper)
};

// Race-appropriate generic PAM names by skin tone
const GENERIC_PAM_BY_RACE: Record<number, string[]> = {
  1: ['gen_1_B_N_010', 'gen_1_B_N_011', 'gen_1_M_N_02', 'gen_2_B_N_01', 'gen_2_B_N_02'],  // White
  5: ['gen_3_B_N_01', 'gen_4_B_N_01', 'gen_4_B_N_02', 'gen_5_B_N_01'],  // Mixed
  7: ['gen_6_B_N_01', 'gen_6_B_N_02', 'gen_7_B_N_019', 'gen_7_B_N_011', 'gen_7_B_N_07']  // Black
};

/**
 * Get a race-appropriate generic PAM for a player
 */
function getGenericPAM(race: number | undefined): string {
  // Default to mixed race (5) if unknown
  const effectiveRace = race === 1 ? 1 : race === 7 ? 7 : 5;
  const pool = GENERIC_PAM_BY_RACE[effectiveRace] || GENERIC_PAM_BY_RACE[5];
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * Check if a PAM value is empty/invalid and needs a generic assigned
 */
function isEmptyPAM(pam: any): boolean {
  if (pam === null || pam === undefined) return true;
  if (typeof pam === 'number') return pam === 0;
  const str = String(pam).trim().toLowerCase();
  return str === '' || str === '0' || str === '0.0' || str === 'null' || str === 'undefined' || str === 'nan';
}

/**
 * Check if a PID value is empty/invalid
 */
function isEmptyPID(pid: any): boolean {
  if (pid === null || pid === undefined) return true;
  if (typeof pid === 'number') return pid <= 0 || isNaN(pid);
  const num = parseInt(String(pid), 10);
  return isNaN(num) || num <= 0;
}

/**
 * Handle: database:get-player-for-roster
 * Get player data formatted for roster editor with ratings for a specific year
 */
ipcMain.handle('database:get-player-for-roster', async (event, internalId: number, year: number) => {
  try {
    await lookupService.waitForReady();

    // Get player base data
    const player = lookupService.getPlayerByInternalId(internalId);
    if (!player) {
      return { success: false, error: 'Player not found' };
    }

    // Get season data for the specified year
    const seasons = lookupService.getPlayerSeasons(internalId);
    const seasonData = seasons.find(s => s.year === year);

    // Get college ID from lookup - use 0 (None) if not found
    const colleges = lookupService.getDropdownOptions('college_lookup.csv');
    let collegeId = 0;
    if (player.college && player.college.trim()) {
      const collegeEntry = colleges.find(c => c.name.toLowerCase() === player.college.toLowerCase());
      collegeId = collegeEntry ? collegeEntry.id : 0;
    }

    // Get position - use database position or season position
    const positionName = seasonData?.position || player.position || 'QB';
    const positions = lookupService.getDropdownOptions('position_lookup.csv');
    const posEntry = positions.find(p => p.name === positionName);
    const positionId = posEntry ? posEntry.id : 0;

    // Calculate height in inches - default to position-appropriate height
    let heightInches = player.height || 72;
    if (!player.height) {
      // Position-based default heights
      const defaultHeights: Record<string, number> = {
        'QB': 75, 'HB': 71, 'FB': 72, 'WR': 73, 'TE': 77,
        'LT': 78, 'LG': 76, 'C': 75, 'RG': 76, 'RT': 78,
        'LEDG': 76, 'REDG': 76, 'DT': 75, 'SAM': 74, 'MIKE': 74, 'WILL': 74,
        'CB': 71, 'FS': 72, 'SS': 72, 'K': 72, 'P': 74
      };
      heightInches = defaultHeights[positionName] || 72;
    }

    // Calculate weight (roster stores offset from 160) - default to position-appropriate weight
    let weight = player.weight || 200;
    if (!player.weight) {
      const defaultWeights: Record<string, number> = {
        'QB': 220, 'HB': 210, 'FB': 245, 'WR': 195, 'TE': 250,
        'LT': 310, 'LG': 315, 'C': 305, 'RG': 315, 'RT': 310,
        'LEDG': 265, 'REDG': 265, 'DT': 305, 'SAM': 240, 'MIKE': 245, 'WILL': 235,
        'CB': 190, 'FS': 205, 'SS': 210, 'K': 200, 'P': 210
      };
      weight = defaultWeights[positionName] || 200;
    }
    const weightOffset = weight - 160;

    // Calculate years pro based on career start
    const careerStart = player.careerFrom || parseInt(player.draftClass) || year;
    const yearsPro = Math.max(0, year - careerStart);

    // Calculate age: if season has valid age use it, otherwise estimate from draft/career
    // IMPORTANT: Must validate age is a number within Madden's valid range (18-45)
    // The roster field PAGE has min:18, max:45 validation
    let age = seasonData?.age;
    if (!age || typeof age !== 'number' || isNaN(age) || age < 18 || age > 45) {
      // Assume 22 at draft/career start
      age = 22 + yearsPro;
    }
    // Always clamp to valid range for Madden roster validation
    age = Math.max(18, Math.min(45, age));

    // Determine PID and PAM - ALWAYS assign values, never leave blank
    let pid: number;
    let pam: string;

    // Check if player has valid PID and PAM
    const hasValidPID = !isEmptyPID(player.pid);
    const hasValidPAM = !isEmptyPAM(player.pam);

    if (hasValidPAM && typeof player.pam === 'string' && !player.pam.startsWith('gen_')) {
      // Player has a real face scan PAM
      pam = player.pam;
      pid = hasValidPID ? player.pid : 0;
    } else {
      // Player needs generic face - assign race-appropriate PAM
      pam = getGenericPAM(player.race);
      pid = 0; // PID 0 tells Madden to use generic face from BLBM table
    }

    console.log(`[database-handlers] PID/PAM for ${player.firstName} ${player.lastName}: PID=${pid}, PAM=${pam}, race=${player.race}`);

    // Get default archetype for position if not in season data
    const defaultArchetype = DEFAULT_ARCHETYPES[positionName] || 0;

    // Build roster player object with Madden field codes
    const rosterPlayer: Record<string, any> = {
      // Bio fields - ALL REQUIRED
      PFNA: player.firstName || 'John',
      PLNA: player.lastName || 'Doe',
      PSXP: pid,
      PEPS: pam,
      PPOS: positionId,
      PCOL: collegeId,
      PHGT: heightInches,
      PWGT: weightOffset,
      PJEN: seasonData?.jersey || player.jersey || Math.floor(Math.random() * 99) + 1,
      PAGE: age,
      PYRP: yearsPro,
      TGID: 1009, // Free Agent team by default
      PLPL: pid > 0 && pam && !pam.startsWith('gen_') ? 100 : 0, // 100=real face, 0=generic
      PLTY: 0, // Will be set below

      // Additional required fields
      PCBT: 0, // Body type (0=default)
      PHLM: 0, // Helmet style
      PVSL: 0, // Visor style
      PHSN: 0, // Home state
      PLBD: 0, // Birthday (will calculate if needed)

      // Contract defaults
      PCON: 4, // 4 year contract
      PCYL: 4, // 4 years left
      PSA0: 100, // $1M salary
      PSA1: 100,
      PSA2: 100,
      PSA3: 100,
      PSA4: 0,
      PSA5: 0,
      PSA6: 0,
      PSBO: 0, // No signing bonus

      // Development trait (0=normal, 1=star, 2=superstar, 3=x-factor)
      PDEV: 0,
    };

    // Add ratings from season data if available, otherwise use position-appropriate defaults
    if (seasonData && seasonData.ratings) {
      rosterPlayer.POVR = seasonData.overall || seasonData.ratings.overall || 70;
      rosterPlayer.PSPD = seasonData.ratings.speed || seasonData.speed || 70;
      rosterPlayer.PACC = seasonData.ratings.acceleration || seasonData.acceleration || 70;
      rosterPlayer.PSTR = seasonData.ratings.strength || seasonData.strength || 70;
      rosterPlayer.PAGI = seasonData.ratings.agility || seasonData.agility || 70;
      rosterPlayer.PAWR = seasonData.ratings.awareness || seasonData.awareness || 70;
      rosterPlayer.PCTH = seasonData.ratings.catching || 70;
      rosterPlayer.PCAR = seasonData.ratings.carrying || 70;
      rosterPlayer.PTHP = seasonData.ratings.throwPower || 70;
      rosterPlayer.PKPR = seasonData.ratings.kickPower || 70;
      rosterPlayer.PKAC = seasonData.ratings.kickAccuracy || 70;
      rosterPlayer.PRBK = seasonData.ratings.runBlock || 70;
      rosterPlayer.PPBK = seasonData.ratings.passBlock || 70;
      rosterPlayer.PTAK = seasonData.ratings.tackle || 70;
      rosterPlayer.PBKT = seasonData.ratings.breakTackle || 70;
      rosterPlayer.PJMP = seasonData.ratings.jumping || 70;
      rosterPlayer.PSTA = seasonData.ratings.stamina || 85;
      rosterPlayer.PINJ = seasonData.ratings.injury || 85;
      rosterPlayer.PTGH = seasonData.ratings.toughness || 70;
      rosterPlayer.PLPU = seasonData.ratings.pursuit || 70;
      rosterPlayer.PLPR = seasonData.ratings.playRecognition || 70;
      rosterPlayer.PLMC = seasonData.ratings.manCoverage || 70;
      rosterPlayer.PLZC = seasonData.ratings.zoneCoverage || 70;
      rosterPlayer.PLPE = seasonData.ratings.press || 70;
      rosterPlayer.PLHT = seasonData.ratings.hitPower || 70;
      rosterPlayer.PBSG = seasonData.ratings.blockShed || seasonData.ratings.blockShedding || 70;
      rosterPlayer.PLPM = seasonData.ratings.powerMoves || 70;
      rosterPlayer.PFMS = seasonData.ratings.finesseMoves || 70;
      rosterPlayer.PTAS = seasonData.ratings.throwAccuracyShort || 70;
      rosterPlayer.PTAM = seasonData.ratings.throwAccuracyMid || 70;
      rosterPlayer.PTAD = seasonData.ratings.throwAccuracyDeep || 70;
      rosterPlayer.PPLA = seasonData.ratings.playAction || 70;
      rosterPlayer.PTOR = seasonData.ratings.throwOnTheRun || 70;
      rosterPlayer.PTUP = seasonData.ratings.throwUnderPressure || 70;
      rosterPlayer.PBCV = seasonData.ratings.ballCarrierVision || 70;
      rosterPlayer.PLJM = seasonData.ratings.jukeMove || 70;
      rosterPlayer.PLSM = seasonData.ratings.spinMove || 70;
      rosterPlayer.PLSA = seasonData.ratings.stiffArm || 70;
      rosterPlayer.PLTR = seasonData.ratings.trucking || 70;
      rosterPlayer.PELU = seasonData.ratings.changeOfDirection || 70;
      rosterPlayer.PLRL = seasonData.ratings.release || 70;
      rosterPlayer.SRRN = seasonData.ratings.shortRouteRunning || 70;
      rosterPlayer.PMRR = seasonData.ratings.mediumRouteRunning || 70;
      rosterPlayer.PDRR = seasonData.ratings.deepRouteRunning || 70;
      rosterPlayer.PLCI = seasonData.ratings.catchInTraffic || 70;
      rosterPlayer.PLSC = seasonData.ratings.spectacularCatch || 70;
      rosterPlayer.PLIB = seasonData.ratings.impactBlocking || 70;
      rosterPlayer.PLBK = seasonData.ratings.leadBlock || 70;
      rosterPlayer.PPBF = seasonData.ratings.passBlockFinesse || 70;
      rosterPlayer.PPBS = seasonData.ratings.passBlockStrength || seasonData.ratings.passBlockPower || 70;
      rosterPlayer.PRBF = seasonData.ratings.runBlockFinesse || 70;
      rosterPlayer.PRBS = seasonData.ratings.runBlockStrength || seasonData.ratings.runBlockPower || 70;
      rosterPlayer.PBSK = seasonData.ratings.breakSack || 70;
      rosterPlayer.PKRT = seasonData.ratings.kickReturn || 70;

      // Parse archetype - it may be stored as string or number
      let archetypeId = defaultArchetype;
      if (seasonData.archetype !== undefined && seasonData.archetype !== null) {
        if (typeof seasonData.archetype === 'number') {
          archetypeId = seasonData.archetype;
        } else if (typeof seasonData.archetype === 'string') {
          const parsed = parseInt(seasonData.archetype, 10);
          archetypeId = isNaN(parsed) ? defaultArchetype : parsed;
        }
      }
      rosterPlayer.PLTY = archetypeId;
    } else {
      // Default ratings if no season data - all 70 except stamina/injury at 85
      const defaultRating = 70;
      const ratingFields = [
        'POVR', 'PSPD', 'PACC', 'PSTR', 'PAGI', 'PAWR', 'PCTH', 'PCAR',
        'PTHP', 'PKPR', 'PKAC', 'PRBK', 'PPBK', 'PTAK', 'PBKT', 'PJMP',
        'PTGH', 'PLPU', 'PLPR', 'PLMC', 'PLZC', 'PLPE',
        'PLHT', 'PBSG', 'PLPM', 'PFMS', 'PTAS', 'PTAM', 'PTAD', 'PPLA',
        'PTOR', 'PTUP', 'PBCV', 'PLJM', 'PLSM', 'PLSA', 'PLTR', 'PELU',
        'PLRL', 'SRRN', 'PMRR', 'PDRR', 'PLCI', 'PLSC', 'PLIB', 'PLBK',
        'PPBF', 'PPBS', 'PRBF', 'PRBS', 'PBSK', 'PKRT'
      ];
      ratingFields.forEach(f => rosterPlayer[f] = defaultRating);
      rosterPlayer.PSTA = 85; // Stamina
      rosterPlayer.PINJ = 85; // Injury
      rosterPlayer.PLTY = defaultArchetype;
    }

    // Store race for BLBM face generation
    rosterPlayer._race = player.race || 5; // Mixed race default

    // Get available years for this player
    let availableYears = seasons.map(s => s.year).sort((a, b) => b - a);

    // If no seasons, create years from career span
    if (availableYears.length === 0 && player.careerFrom && player.careerTo) {
      for (let y = player.careerTo; y >= player.careerFrom; y--) {
        availableYears.push(y);
      }
    }

    // If still no years, use the requested year
    if (availableYears.length === 0) {
      availableYears = [year];
    }

    return {
      success: true,
      player: rosterPlayer,
      playerName: `${player.firstName} ${player.lastName}`,
      availableYears,
      selectedYear: year
    };
  } catch (error) {
    console.error('[database-handlers] Error getting player for roster:', error);
    return { success: false, error: String(error) };
  }
});

/**
 * Handle: database:get-player-for-draft
 * Get player data formatted for M26 draft class prospect format
 */
ipcMain.handle('database:get-player-for-draft', async (event, internalId: number, year: number) => {
  try {
    await lookupService.waitForReady();

    // Get player base data
    const player = lookupService.getPlayerByInternalId(internalId);
    if (!player) {
      return { success: false, error: 'Player not found' };
    }

    // Get season data for the specified year
    const seasons = lookupService.getPlayerSeasons(internalId);
    const seasonData = seasons.find(s => s.year === year);

    // Get college ID from lookup - use 0 (None) if not found
    const colleges = await lookupService.getDropdownOptions('college_lookup.csv');
    let collegeId = 0;
    if (player.college && player.college.trim()) {
      const collegeEntry = colleges.find(c => c.name.toLowerCase() === player.college.toLowerCase());
      collegeId = collegeEntry ? collegeEntry.id : 0;
    }

    // Get position - use database position or season position
    const positionName = seasonData?.position || player.position || 'QB';
    const positions = await lookupService.getDropdownOptions('position_lookup.csv');
    const posEntry = positions.find(p => p.name === positionName);
    const positionId = posEntry ? posEntry.id : 0;

    // Get state ID from lookup
    const states = await lookupService.getDropdownOptions('state_lookup.csv');
    let homeStateId = 0;
    if (player.homeState && player.homeState.trim()) {
      const stateEntry = states.find(s => s.name.toLowerCase() === player.homeState!.toLowerCase());
      homeStateId = stateEntry ? stateEntry.id : 0;
    }

    // Calculate height in inches - default to position-appropriate height
    let heightInches = player.height || 72;
    if (!player.height) {
      const defaultHeights: Record<string, number> = {
        'QB': 75, 'HB': 71, 'FB': 72, 'WR': 73, 'TE': 77,
        'LT': 78, 'LG': 76, 'C': 75, 'RG': 76, 'RT': 78,
        'LEDG': 76, 'REDG': 76, 'DT': 75, 'SAM': 74, 'MIKE': 74, 'WILL': 74,
        'CB': 71, 'FS': 72, 'SS': 72, 'K': 72, 'P': 74
      };
      heightInches = defaultHeights[positionName] || 72;
    }

    // Calculate weight - default to position-appropriate weight
    let weight = player.weight || 200;
    if (!player.weight) {
      const defaultWeights: Record<string, number> = {
        'QB': 220, 'HB': 210, 'FB': 245, 'WR': 195, 'TE': 250,
        'LT': 310, 'LG': 315, 'C': 305, 'RG': 315, 'RT': 310,
        'LEDG': 265, 'REDG': 265, 'DT': 305, 'SAM': 240, 'MIKE': 245, 'WILL': 235,
        'CB': 190, 'FS': 205, 'SS': 210, 'K': 200, 'P': 210
      };
      weight = defaultWeights[positionName] || 200;
    }

    // Calculate age - for draft prospects, typically 21-23
    // IMPORTANT: Must validate age is a number within valid range
    const careerStart = player.careerFrom || parseInt(player.draftClass) || year;
    const yearsPro = Math.max(0, year - careerStart);
    let age = seasonData?.age;
    if (!age || typeof age !== 'number' || isNaN(age) || age < 18 || age > 45) {
      age = 22 + yearsPro;
    }
    // Always clamp to valid range
    age = Math.max(18, Math.min(45, age));

    // Determine PID and PAM - ALWAYS assign values, never leave blank
    let pid: number;
    let pam: string;

    // Check if player has valid PID and PAM
    const hasValidPID = !isEmptyPID(player.pid);
    const hasValidPAM = !isEmptyPAM(player.pam);

    if (hasValidPAM && typeof player.pam === 'string' && !player.pam.startsWith('gen_')) {
      // Player has a real face scan PAM
      pam = player.pam;
      pid = hasValidPID ? player.pid : 0;
    } else {
      // Player needs generic face - assign race-appropriate PAM
      pam = getGenericPAM(player.race);
      pid = 0; // PID 0 tells Madden to use generic face from BLBM table
    }

    console.log(`[database-handlers] Draft PID/PAM for ${player.firstName} ${player.lastName}: PID=${pid}, PAM=${pam}, race=${player.race}`);

    // Get default archetype for position
    const defaultArchetype = DEFAULT_ARCHETYPES[positionName] || 0;

    // Parse archetype from season data or use default
    let archetypeId = defaultArchetype;
    if (seasonData?.archetype !== undefined && seasonData?.archetype !== null) {
      if (typeof seasonData.archetype === 'number') {
        archetypeId = seasonData.archetype;
      } else if (typeof seasonData.archetype === 'string') {
        const parsed = parseInt(seasonData.archetype, 10);
        archetypeId = isNaN(parsed) ? defaultArchetype : parsed;
      }
    }

    // Determine draft round/pick from player data
    let draftRound = 1;
    let draftPick = 1;
    if (player.round) {
      const parsed = parseInt(String(player.round), 10);
      if (!isNaN(parsed) && parsed >= 1 && parsed <= 7) {
        draftRound = parsed;
      } else if (String(player.round).toLowerCase().includes('udfa') || parsed > 7) {
        draftRound = 8; // UDFA
      }
    }
    if (player.pick) {
      const parsed = parseInt(String(player.pick), 10);
      if (!isNaN(parsed) && parsed >= 1) {
        draftPick = parsed;
      }
    }

    // Build M26 prospect object
    const prospect: Record<string, any> = {
      // Identity
      firstName: player.firstName || 'John',
      lastName: player.lastName || 'Doe',
      PID: pid,
      PEPS: pam,

      // Basic info
      homeState: homeStateId,
      college: collegeId,
      age: age,
      heightInches: heightInches,
      weight: weight,

      // Position and role
      position: positionId,
      archetype: archetypeId,
      jerseyNum: seasonData?.jersey || player.jersey || Math.floor(Math.random() * 99) + 1,

      // Draft info (from historical data)
      draftable: 1,
      draftPick: draftPick,
      draftRound: draftRound,

      // Development (0=Normal, 1=Star, 2=Superstar, 3=X-Factor)
      devTrait: 0,

      // Visuals structure for M26
      visuals: {
        bodyType: 'Standard',
        assetName: pam && !pam.startsWith('gen_') ? pam : null,
        genericHeadName: pam.startsWith('gen_') ? pam : null
      }
    };

    // Parse dev trait from season data
    if (seasonData?.devTrait !== undefined) {
      if (typeof seasonData.devTrait === 'number') {
        prospect.devTrait = seasonData.devTrait;
      } else if (typeof seasonData.devTrait === 'string') {
        const devMap: Record<string, number> = {
          'normal': 0, 'star': 1, 'superstar': 2, 'x-factor': 3, 'xfactor': 3
        };
        prospect.devTrait = devMap[seasonData.devTrait.toLowerCase()] || 0;
      }
    }

    // Add ratings from season data if available, otherwise use defaults
    if (seasonData && seasonData.ratings) {
      prospect.overall = seasonData.overall || seasonData.ratings.overall || 70;
      prospect.speed = seasonData.ratings.speed || 70;
      prospect.acceleration = seasonData.ratings.acceleration || 70;
      prospect.strength = seasonData.ratings.strength || 70;
      prospect.agility = seasonData.ratings.agility || 70;
      prospect.awareness = seasonData.ratings.awareness || 70;
      prospect.jumping = seasonData.ratings.jumping || 70;
      prospect.stamina = seasonData.ratings.stamina || 85;
      prospect.changeOfDirection = seasonData.ratings.changeOfDirection || 70;
      prospect.toughness = seasonData.ratings.toughness || 70;
      prospect.injury = seasonData.ratings.injury || 85;

      // Ball carrier
      prospect.carrying = seasonData.ratings.carrying || 70;
      prospect.ballCarrierVision = seasonData.ratings.ballCarrierVision || 70;
      prospect.breakTackle = seasonData.ratings.breakTackle || 70;
      prospect.trucking = seasonData.ratings.trucking || 70;
      prospect.stiffArm = seasonData.ratings.stiffArm || 70;
      prospect.spinMove = seasonData.ratings.spinMove || 70;
      prospect.jukeMove = seasonData.ratings.jukeMove || 70;

      // Receiving
      prospect.catching = seasonData.ratings.catching || 70;
      prospect.catchInTraffic = seasonData.ratings.catchInTraffic || 70;
      prospect.spectacularCatch = seasonData.ratings.spectacularCatch || 70;
      prospect.shortRouteRunning = seasonData.ratings.shortRouteRunning || 70;
      prospect.mediumRouteRunning = seasonData.ratings.mediumRouteRunning || 70;
      prospect.deepRouteRunning = seasonData.ratings.deepRouteRunning || 70;
      prospect.release = seasonData.ratings.release || 70;

      // Throwing
      prospect.throwPower = seasonData.ratings.throwPower || 70;
      prospect.throwAccuracyShort = seasonData.ratings.throwAccuracyShort || 70;
      prospect.throwAccuracyMid = seasonData.ratings.throwAccuracyMid || 70;
      prospect.throwAccuracyDeep = seasonData.ratings.throwAccuracyDeep || 70;
      prospect.throwOnTheRun = seasonData.ratings.throwOnTheRun || 70;
      prospect.throwUnderPressure = seasonData.ratings.throwUnderPressure || 70;
      prospect.playAction = seasonData.ratings.playAction || 70;
      prospect.breakSack = seasonData.ratings.breakSack || 70;

      // Blocking
      prospect.passBlock = seasonData.ratings.passBlock || 70;
      prospect.passBlockPower = seasonData.ratings.passBlockPower || seasonData.ratings.passBlockStrength || 70;
      prospect.passBlockFinesse = seasonData.ratings.passBlockFinesse || 70;
      prospect.runBlock = seasonData.ratings.runBlock || 70;
      prospect.runBlockPower = seasonData.ratings.runBlockPower || seasonData.ratings.runBlockStrength || 70;
      prospect.runBlockFinesse = seasonData.ratings.runBlockFinesse || 70;
      prospect.leadBlock = seasonData.ratings.leadBlock || 70;
      prospect.impactBlocking = seasonData.ratings.impactBlocking || 70;

      // Defense
      prospect.tackle = seasonData.ratings.tackle || 70;
      prospect.hitPower = seasonData.ratings.hitPower || 70;
      prospect.powerMoves = seasonData.ratings.powerMoves || 70;
      prospect.finesseMoves = seasonData.ratings.finesseMoves || 70;
      prospect.blockShedding = seasonData.ratings.blockShedding || seasonData.ratings.blockShed || 70;
      prospect.pursuit = seasonData.ratings.pursuit || 70;
      prospect.playRecognition = seasonData.ratings.playRecognition || 70;
      prospect.manCoverage = seasonData.ratings.manCoverage || 70;
      prospect.zoneCoverage = seasonData.ratings.zoneCoverage || 70;
      prospect.pressCoverage = seasonData.ratings.pressCoverage || seasonData.ratings.press || 70;

      // Special teams
      prospect.kickPower = seasonData.ratings.kickPower || 70;
      prospect.kickAccuracy = seasonData.ratings.kickAccuracy || 70;
      prospect.kickReturn = seasonData.ratings.kickReturn || 70;
      prospect.longSnap = 70;
    } else {
      // Default ratings if no season data
      const defaultRating = 70;
      const ratingFields = [
        'overall', 'speed', 'acceleration', 'strength', 'agility', 'awareness',
        'jumping', 'changeOfDirection', 'toughness',
        'carrying', 'ballCarrierVision', 'breakTackle', 'trucking', 'stiffArm', 'spinMove', 'jukeMove',
        'catching', 'catchInTraffic', 'spectacularCatch', 'shortRouteRunning', 'mediumRouteRunning', 'deepRouteRunning', 'release',
        'throwPower', 'throwAccuracyShort', 'throwAccuracyMid', 'throwAccuracyDeep', 'throwOnTheRun', 'throwUnderPressure', 'playAction', 'breakSack',
        'passBlock', 'passBlockPower', 'passBlockFinesse', 'runBlock', 'runBlockPower', 'runBlockFinesse', 'leadBlock', 'impactBlocking',
        'tackle', 'hitPower', 'powerMoves', 'finesseMoves', 'blockShedding', 'pursuit', 'playRecognition', 'manCoverage', 'zoneCoverage', 'pressCoverage',
        'kickPower', 'kickAccuracy', 'kickReturn', 'longSnap'
      ];
      ratingFields.forEach(f => prospect[f] = defaultRating);
      prospect.stamina = 85;
      prospect.injury = 85;
    }

    // Get available years for this player
    let availableYears = seasons.map(s => s.year).sort((a, b) => b - a);

    // If no seasons, create years from career span
    if (availableYears.length === 0 && player.careerFrom && player.careerTo) {
      for (let y = player.careerTo; y >= player.careerFrom; y--) {
        availableYears.push(y);
      }
    }

    // If still no years, use the requested year
    if (availableYears.length === 0) {
      availableYears = [year];
    }

    // Calculate suggested draft slot based on historical data
    const suggestedSlot = calculateDraftSlot(draftRound, draftPick);

    return {
      success: true,
      prospect,
      playerName: `${player.firstName} ${player.lastName}`,
      availableYears,
      selectedYear: year,
      suggestedSlot,
      draftInfo: {
        round: draftRound,
        pick: draftPick,
        year: player.draftClass || year
      }
    };
  } catch (error) {
    console.error('[database-handlers] Error getting player for draft:', error);
    return { success: false, error: String(error) };
  }
});

/**
 * Calculate draft slot from round and pick
 * Returns 0-indexed slot in 402-prospect array
 */
function calculateDraftSlot(round: number | string | undefined, pick: number | string | undefined): number {
  // Parse round
  let roundNum = 1;
  if (round !== undefined && round !== null) {
    if (typeof round === 'number') {
      roundNum = round;
    } else {
      const parsed = parseInt(String(round), 10);
      roundNum = isNaN(parsed) ? 8 : parsed; // UDFA if not parseable
    }
  }

  // UDFA - place after round 7 (slot 224+)
  if (roundNum > 7 || roundNum < 1) {
    return 224;
  }

  // Parse pick
  let pickNum = 1;
  if (pick !== undefined && pick !== null) {
    if (typeof pick === 'number') {
      pickNum = pick;
    } else {
      const parsed = parseInt(String(pick), 10);
      pickNum = isNaN(parsed) ? 1 : parsed;
    }
  }

  // Normal draft: (round - 1) * 32 + (pick - 1)
  const r = Math.max(1, Math.min(7, roundNum));
  const p = Math.max(1, Math.min(32, pickNum));
  return (r - 1) * 32 + (p - 1);
}

/**
 * Handle: database:get-players-for-fill
 * Get players for bulk fill operation with deduplication and position limits
 */
ipcMain.handle('database:get-players-for-fill', async (
  event,
  options: {
    target: 'roster' | 'draft';
    yearFrom: number;
    yearTo: number;
    excludeKeys: string[];  // "firstName|lastName|position" keys to exclude
    positionNeeds: Record<string, number>;  // { QB: 2, HB: 3, ... } how many of each position needed
  }
) => {
  try {
    await lookupService.waitForReady();

    const { target, yearFrom, yearTo, excludeKeys, positionNeeds } = options;

    console.log(`[database-handlers] get-players-for-fill: ${target}, years ${yearFrom}-${yearTo}`);
    console.log(`[database-handlers] Exclude keys: ${excludeKeys.length}, Position needs:`, positionNeeds);

    // Get all players from database
    const allPlayers = lookupService.getAllPlayers();

    // Filter by draft year range
    const filtered = allPlayers.filter(p => {
      const draftYear = parseInt(p.draftClass || '0', 10);
      return draftYear >= yearFrom && draftYear <= yearTo;
    });

    console.log(`[database-handlers] Players in year range: ${filtered.length}`);

    // Build deduplication map: key -> best player (highest POVR)
    // Key format: "firstName|lastName|position" (lowercase, trimmed)
    const dedupMap = new Map<string, {
      player: typeof filtered[0];
      povr: number;
      year: number;
    }>();

    for (const player of filtered) {
      const fn = (player.firstName || '').toLowerCase().trim();
      const ln = (player.lastName || '').toLowerCase().trim();
      const pos = (player.position || '').toUpperCase().trim();
      const key = `${fn}|${ln}|${pos}`;

      // Skip if in exclude list
      if (excludeKeys.includes(key)) {
        continue;
      }

      // Get best season for this player
      const seasons = lookupService.getPlayerSeasons(player.internalId);
      const seasonInRange = seasons.filter(s => s.year >= yearFrom && s.year <= yearTo);

      if (seasonInRange.length === 0) continue;

      // Find best OVR season
      let bestSeason = seasonInRange[0];
      for (const s of seasonInRange) {
        if ((s.overall || 0) > (bestSeason.overall || 0)) {
          bestSeason = s;
        }
      }

      const povr = bestSeason.overall || 70;
      const year = bestSeason.year;

      // Check if we already have this player - keep higher POVR
      const existing = dedupMap.get(key);
      if (!existing || povr > existing.povr) {
        dedupMap.set(key, { player, povr, year });
      }
    }

    console.log(`[database-handlers] Unique players after dedup: ${dedupMap.size}`);

    // Convert to array and sort by POVR (highest first)
    const candidates = Array.from(dedupMap.values())
      .sort((a, b) => b.povr - a.povr);

    // Apply position limits
    const positionCounts: Record<string, number> = {};
    const selectedPlayers: Array<{
      internalId: number;
      firstName: string;
      lastName: string;
      position: string;
      povr: number;
      year: number;
      draftRound?: number;
      draftPick?: number;
    }> = [];

    for (const { player, povr, year } of candidates) {
      const pos = (player.position || '').toUpperCase().trim();
      if (!pos) continue;

      // Check if we still need this position
      const needed = positionNeeds[pos] || 0;
      const current = positionCounts[pos] || 0;

      if (current < needed) {
        positionCounts[pos] = current + 1;
        selectedPlayers.push({
          internalId: player.internalId,
          firstName: player.firstName || '',
          lastName: player.lastName || '',
          position: pos,
          povr,
          year,
          draftRound: player.draftRound,
          draftPick: player.draftPick
        });
      }
    }

    console.log(`[database-handlers] Selected ${selectedPlayers.length} players for fill`);

    // Calculate what's still needed
    const stillNeeded: Record<string, number> = {};
    for (const [pos, need] of Object.entries(positionNeeds)) {
      const have = positionCounts[pos] || 0;
      if (have < need) {
        stillNeeded[pos] = need - have;
      }
    }

    return {
      success: true,
      players: selectedPlayers,
      totalFound: dedupMap.size,
      positionCounts,
      stillNeeded
    };
  } catch (error) {
    console.error('[database-handlers] Error getting players for fill:', error);
    return { success: false, error: String(error) };
  }
});

/**
 * Handle: database:get-player-available-years
 * Get available years for a player (for year selector dropdown)
 */
ipcMain.handle('database:get-player-available-years', async (event, internalId: number) => {
  try {
    await lookupService.waitForReady();

    const player = lookupService.getPlayerByInternalId(internalId);
    if (!player) {
      return { success: false, error: 'Player not found' };
    }

    const seasons = lookupService.getPlayerSeasons(internalId);
    const availableYears = seasons.map(s => s.year).sort((a, b) => b - a);

    // If no seasons in database, use career range
    if (availableYears.length === 0 && player.careerFrom && player.careerTo) {
      for (let y = player.careerTo; y >= player.careerFrom; y--) {
        availableYears.push(y);
      }
    }

    return {
      success: true,
      years: availableYears,
      defaultYear: availableYears[0] || new Date().getFullYear(),
      playerName: `${player.firstName} ${player.lastName}`
    };
  } catch (error) {
    console.error('[database-handlers] Error getting player available years:', error);
    return { success: false, error: String(error) };
  }
});

// =============================================
// CSV IMPORT OPERATIONS
// =============================================

/**
 * CSV column mapping for ALL_PLAYER_LOOKUP.csv format
 */
const CSV_COLUMNS = [
  'lastName', 'firstName', 'college', 'round', 'pick', 'draftClass', 'position',
  'jersey', 'photoId', 'pam', 'commId', 'plpo', 'height', 'weight',
  'from', 'to', 'ap1', 'pb', 'st', 'wav', 'league', 'race',
  'homeState', 'wikiUrl', 'pfrUrl', 'isHof'
];

/**
 * Parse CSV content into rows
 */
function parseCSV(content: string): string[][] {
  const rows: string[][] = [];
  const lines = content.split(/\r?\n/);

  for (const line of lines) {
    if (!line.trim()) continue;

    const row: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        row.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    row.push(current.trim());
    rows.push(row);
  }

  return rows;
}

/**
 * Convert CSV row to CustomPlayer object
 */
function rowToCustomPlayer(row: string[], collegeMap: Map<string, number>): CustomPlayer | null {
  if (row.length < 7) return null;

  const firstName = row[1]?.trim();
  const lastName = row[0]?.trim();

  if (!firstName || !lastName) return null;

  // Map college name to ID
  const collegeName = row[2]?.trim() || '';
  const collegeId = collegeMap.get(collegeName.toLowerCase()) || undefined;

  // Parse race (0=White, 1=Black, 2=Asian, 3=Hispanic, 4=Other)
  let race: number | undefined = undefined;
  const raceStr = row[21]?.trim()?.toLowerCase();
  if (raceStr === 'white' || raceStr === '0') race = 0;
  else if (raceStr === 'black' || raceStr === '1') race = 1;
  else if (raceStr === 'asian' || raceStr === '2') race = 2;
  else if (raceStr === 'hispanic' || raceStr === '3') race = 3;
  else if (raceStr === 'other' || raceStr === '4') race = 4;

  return {
    firstName,
    lastName,
    collegeId,
    race,
    height: parseInt(row[12]) || undefined,
    weight: parseInt(row[13]) || undefined,
    draftClass: parseInt(row[5]) || undefined,
    draftRound: row[3]?.trim() || undefined,
    draftPick: parseInt(row[4]) || undefined,
    careerFrom: parseInt(row[14]) || undefined,
    careerTo: parseInt(row[15]) || undefined,
    maddenPid: parseInt(row[8]) || undefined,
    maddenPam: row[9]?.trim() || undefined,
    maddenPlpo: row[11]?.trim() || undefined,
    maddenCommid: row[10]?.trim() || undefined
  };
}

/**
 * Handle: database:validate-csv
 * Parse and validate CSV content for import
 */
ipcMain.handle('database:validate-csv', async (event, csvContent: string) => {
  try {
    const rows = parseCSV(csvContent);

    if (rows.length === 0) {
      return { success: false, error: 'CSV file is empty' };
    }

    // Check if first row is header
    const firstRow = rows[0];
    const isHeader = firstRow[0]?.toLowerCase().includes('name') ||
                     firstRow[0]?.toLowerCase() === 'last name' ||
                     firstRow[1]?.toLowerCase().includes('first');

    const dataRows = isHeader ? rows.slice(1) : rows;

    // Get college mapping
    await lookupService.waitForReady();
    const colleges = await lookupService.getDropdownOptions('college_lookup.csv');
    const collegeMap = new Map<string, number>();
    for (const c of colleges) {
      collegeMap.set(c.name.toLowerCase(), c.id);
    }

    const validPlayers: Array<{ player: CustomPlayer; row: number }> = [];
    const errors: string[] = [];

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const rowNum = isHeader ? i + 2 : i + 1; // 1-based, account for header

      const player = rowToCustomPlayer(row, collegeMap);
      if (player) {
        validPlayers.push({ player, row: rowNum });
      } else {
        const name = `${row[1] || ''} ${row[0] || ''}`.trim() || 'Unknown';
        errors.push(`Row ${rowNum}: Invalid data for "${name}" - missing required fields`);
      }
    }

    // Return preview (first 10 players)
    const preview = validPlayers.slice(0, 10).map(({ player, row }) => ({
      row,
      name: `${player.firstName} ${player.lastName}`,
      position: dataRows[row - (isHeader ? 2 : 1)][6] || 'N/A',
      college: dataRows[row - (isHeader ? 2 : 1)][2] || 'N/A',
      draftClass: player.draftClass || 'N/A'
    }));

    return {
      success: true,
      totalRows: dataRows.length,
      validCount: validPlayers.length,
      errorCount: errors.length,
      preview,
      errors: errors.slice(0, 10) // First 10 errors
    };
  } catch (error) {
    console.error('[database-handlers] Error validating CSV:', error);
    return { success: false, error: String(error) };
  }
});

/**
 * Handle: database:import-csv
 * Import players from CSV content as custom players
 */
ipcMain.handle('database:import-csv', async (event, csvContent: string) => {
  try {
    await userDatabaseService.waitForReady();
    await lookupService.waitForReady();

    const rows = parseCSV(csvContent);

    if (rows.length === 0) {
      return { success: false, imported: 0, skipped: 0, errors: ['CSV file is empty'] };
    }

    // Check if first row is header
    const firstRow = rows[0];
    const isHeader = firstRow[0]?.toLowerCase().includes('name') ||
                     firstRow[0]?.toLowerCase() === 'last name' ||
                     firstRow[1]?.toLowerCase().includes('first');

    const dataRows = isHeader ? rows.slice(1) : rows;

    // Get college mapping
    const colleges = await lookupService.getDropdownOptions('college_lookup.csv');
    const collegeMap = new Map<string, number>();
    for (const c of colleges) {
      collegeMap.set(c.name.toLowerCase(), c.id);
    }

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const rowNum = isHeader ? i + 2 : i + 1;

      try {
        const player = rowToCustomPlayer(row, collegeMap);
        if (player) {
          userDatabaseService.createCustomPlayer(player);
          imported++;
        } else {
          skipped++;
          const name = `${row[1] || ''} ${row[0] || ''}`.trim() || 'Unknown';
          errors.push(`Row ${rowNum}: Skipped "${name}" - missing required fields`);
        }
      } catch (err) {
        skipped++;
        const name = `${row[1] || ''} ${row[0] || ''}`.trim() || 'Unknown';
        errors.push(`Row ${rowNum}: Error importing "${name}" - ${String(err)}`);
      }
    }

    console.log(`[database-handlers] CSV import complete: ${imported} imported, ${skipped} skipped`);

    return {
      success: true,
      imported,
      skipped,
      errors: errors.slice(0, 20) // First 20 errors
    };
  } catch (error) {
    console.error('[database-handlers] Error importing CSV:', error);
    return { success: false, imported: 0, skipped: 0, errors: [String(error)] };
  }
});

/**
 * Handle: database:select-csv-file
 * Open file dialog to select a CSV file
 */
ipcMain.handle('database:select-csv-file', async () => {
  try {
    const { dialog } = require('electron');
    const result = await dialog.showOpenDialog({
      title: 'Select CSV File to Import',
      filters: [
        { name: 'CSV Files', extensions: ['csv'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      properties: ['openFile']
    });

    if (result.canceled || !result.filePaths.length) {
      return { success: false, canceled: true };
    }

    const fs = require('fs');
    const content = fs.readFileSync(result.filePaths[0], 'utf-8');

    return {
      success: true,
      filePath: result.filePaths[0],
      content
    };
  } catch (error) {
    console.error('[database-handlers] Error selecting CSV file:', error);
    return { success: false, error: String(error) };
  }
});

console.log('[database-handlers] Registered all database IPC handlers');
