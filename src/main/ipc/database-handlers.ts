/**
 * Database IPC Handlers
 *
 * IPC handlers for user database operations.
 * Provides access to edit/create player data in the user overlay database.
 */

import { ipcMain, BrowserWindow } from 'electron';
import {
  userDatabaseService,
  PlayerEdit,
  AppearanceEdit,
  SeasonEdit,
  CustomPlayer,
  CustomPlayerSeason
} from '../services/UserDatabaseService';
import { lookupService } from '../services/lookup-service';
import { ArchetypeService } from '../services/utils/archetypeService';
import { ArchetypeSyncService } from '../services/ArchetypeSyncService';
import {
  draftClassDatabaseService,
  PushAnalysisResult,
  FieldResolution,
  PushExecutionResult
} from '../services/DraftClassDatabaseService';
import {
  rosterDatabaseService,
  RosterPushAnalysisResult,
  FieldResolution as RosterFieldResolution,
  RosterPushExecutionResult
} from '../services/RosterDatabaseService';
import Database from 'better-sqlite3';
import { app } from 'electron';
import * as path from 'path';
import { ovrWeightsCalculator } from '../services/rating-modes/OVRWeightsCalculator';

// =============================================
// SHARED HELPER: Get merged player PID
// This ensures list and card show the same PID
// =============================================

/**
 * Get the effective PID for a player, checking all sources
 * Priority: appearance edit > custom portrait > bundled dev > original
 *
 * @deprecated Use getEffectivePidFast with pre-loaded maps for bulk operations
 */
function getEffectivePid(internalId: number, originalPid: number | undefined): number {
  // 1. Check appearance edits
  const appearanceEdit = userDatabaseService.getAppearanceEdit(internalId);
  if (appearanceEdit?.maddenPid != null) {
    return appearanceEdit.maddenPid;
  }

  // 2. Check custom portraits table (where portrait manager saves assignments)
  const customPortraitPid = userDatabaseService.getCustomPortraitByPlayerId(internalId);
  if (customPortraitPid != null) {
    return customPortraitPid;
  }

  // 3. Check bundled developer portraits
  if (!originalPid) {
    const bundledPid = lookupService.getBundledDeveloperPortrait(internalId);
    if (bundledPid) {
      return bundledPid;
    }
  }

  // 4. Return original
  return originalPid || 0;
}

/**
 * Fast version of getEffectivePid using pre-loaded Maps (for bulk operations)
 * Pre-load maps once, then call this for each player - O(1) lookups instead of O(n) queries
 */
function getEffectivePidFast(
  internalId: number,
  originalPid: number | undefined,
  appearanceEditPids: Map<number, number>,
  customPortraitPids: Map<number, number>
): number {
  // 1. Check appearance edits (from pre-loaded map)
  const editPid = appearanceEditPids.get(internalId);
  if (editPid != null) {
    return editPid;
  }

  // 2. Check custom portraits (from pre-loaded map)
  const customPid = customPortraitPids.get(internalId);
  if (customPid != null) {
    return customPid;
  }

  // 3. Check bundled developer portraits (already in-memory lookup)
  if (!originalPid) {
    const bundledPid = lookupService.getBundledDeveloperPortrait(internalId);
    if (bundledPid) {
      return bundledPid;
    }
  }

  // 4. Return original
  return originalPid || 0;
}

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

/**
 * Handle: database:delete-player-season
 * Delete a specific season for a player (original player - deletes from season_edits)
 */
ipcMain.handle('database:delete-player-season', async (event, playerId: number, year: number) => {
  try {
    await userDatabaseService.waitForReady();
    const deleted = userDatabaseService.deletePlayerSeason(playerId, year);
    return { success: true, deleted };
  } catch (error) {
    console.error('[database-handlers] Error deleting player season:', error);
    return { success: false, error: String(error) };
  }
});

/**
 * Handle: database:delete-custom-player-season
 * Delete a specific season for a custom player
 */
ipcMain.handle('database:delete-custom-player-season', async (event, customPlayerId: number, year: number) => {
  try {
    await userDatabaseService.waitForReady();
    const deleted = userDatabaseService.deleteCustomPlayerSeason(customPlayerId, year);
    return { success: true, deleted };
  } catch (error) {
    console.error('[database-handlers] Error deleting custom player season:', error);
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
 * Supports options.incrementAge to increment age by 1 for each successive year.
 */
ipcMain.handle('database:save-season-edit-all-years', async (event, originalPlayerId: number, edits: Partial<SeasonEdit>, options?: { incrementAge?: boolean }) => {
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

    // Check if we need to increment age each year
    const shouldIncrementAge = options?.incrementAge && edits.age !== undefined;
    const baseAge = edits.age as number;

    console.log(`[database-handlers] Applying edits to ${years.length} seasons (${years[0]}-${years[years.length - 1]}) for player ${originalPlayerId}:`, edits);
    if (shouldIncrementAge) {
      console.log(`[database-handlers] Age will increment each year starting from ${baseAge}`);
    }

    // Apply the edits to each year
    for (let i = 0; i < years.length; i++) {
      const year = years[i];

      // Create a copy of edits for this year
      const yearEdits = { ...edits };

      // Increment age if option is enabled
      if (shouldIncrementAge) {
        yearEdits.age = baseAge + i;
      }

      userDatabaseService.saveSeasonEdit(originalPlayerId, year, yearEdits);
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

/**
 * Handle: database:save-custom-player-season-all-years
 * Apply partial edits to ALL years in a custom player's career span.
 * Uses career span (draftClass/careerFrom to careerTo).
 * Supports options.incrementAge to increment age by 1 for each successive year.
 */
ipcMain.handle('database:save-custom-player-season-all-years', async (event, customPlayerId: number, edits: Partial<CustomPlayerSeason>, options?: { incrementAge?: boolean }) => {
  try {
    console.log('[database-handlers] ===== SAVE CUSTOM PLAYER SEASON ALL YEARS =====');
    console.log('[database-handlers] customPlayerId:', customPlayerId);
    console.log('[database-handlers] edits received:', JSON.stringify(edits, null, 2));
    console.log('[database-handlers] options:', options);

    await userDatabaseService.waitForReady();

    // Get custom player info to determine career span
    const customPlayer = userDatabaseService.getCustomPlayer(customPlayerId);

    if (!customPlayer) {
      console.log('[database-handlers] ERROR: Custom player not found:', customPlayerId);
      return { success: false, error: 'Custom player not found' };
    }

    console.log('[database-handlers] Custom player found:', customPlayer.firstName, customPlayer.lastName);
    console.log('[database-handlers] draftClass:', customPlayer.draftClass, 'careerFrom:', customPlayer.careerFrom, 'careerTo:', customPlayer.careerTo);

    // Determine career span
    const draftYear = customPlayer.draftClass;
    const careerFrom = customPlayer.careerFrom;
    const careerTo = customPlayer.careerTo;

    // Calculate start year (earliest of draft or career from)
    let startYear = draftYear;
    if (!startYear) {
      startYear = careerFrom;
    } else if (careerFrom && careerFrom < startYear) {
      startYear = careerFrom;
    }

    // Calculate end year
    let endYear = careerTo;
    if (!endYear) {
      endYear = new Date().getFullYear();
    }

    console.log('[database-handlers] Calculated startYear:', startYear, 'endYear:', endYear);

    // Build year range
    const years: number[] = [];
    if (startYear && endYear) {
      for (let year = startYear; year <= endYear; year++) {
        years.push(year);
      }
    }

    if (years.length === 0) {
      // Fallback to years with existing data
      console.log('[database-handlers] No year range from career info, checking existing seasons');
      const existingSeasons = userDatabaseService.getCustomPlayerSeasons(customPlayerId);
      console.log('[database-handlers] Existing seasons:', existingSeasons?.length || 0);
      if (existingSeasons && existingSeasons.length > 0) {
        years.push(...existingSeasons.map(s => s.year));
      }
    }

    if (years.length === 0) {
      console.log('[database-handlers] WARNING: No years found for custom player:', customPlayerId);
      console.log('[database-handlers] This player has no draftClass, careerFrom, careerTo, or existing seasons');
      return { success: true, updatedYears: [], message: 'No years to update - player has no career range defined' };
    }

    console.log('[database-handlers] Years to update:', years.length, 'range:', years[0], '-', years[years.length - 1]);

    // Check if we need to increment age each year
    const shouldIncrementAge = options?.incrementAge && edits.age !== undefined;
    const baseAge = edits.age as number;

    console.log(`[database-handlers] Applying edits to ${years.length} custom player seasons (${years[0]}-${years[years.length - 1]}) for player ${customPlayerId}:`, edits);
    if (shouldIncrementAge) {
      console.log(`[database-handlers] Age will increment each year starting from ${baseAge}`);
    }

    // Apply the edits to each year using PARTIAL UPDATE (not INSERT OR REPLACE)
    // This preserves existing values for fields not being updated
    for (let i = 0; i < years.length; i++) {
      const year = years[i];
      // If incrementing age, adjust for each year
      const yearEdits = shouldIncrementAge
        ? { ...edits, age: baseAge + i }
        : edits;

      // Use updateCustomPlayerSeason for partial updates - preserves existing values
      userDatabaseService.updateCustomPlayerSeason(customPlayerId, year, yearEdits);
    }

    console.log(`[database-handlers] Updated ${years.length} custom player seasons (partial update)`);
    return { success: true, updatedYears: years };
  } catch (error) {
    console.error('[database-handlers] Error saving custom player seasons to all years:', error);
    return { success: false, error: String(error) };
  }
});

// =============================================
// HIDE/UNHIDE PLAYER OPERATIONS
// =============================================

/**
 * Handle: database:hide-player
 * Hide an original database player from search results
 */
ipcMain.handle('database:hide-player', async (event, playerId: number) => {
  try {
    await userDatabaseService.waitForReady();
    userDatabaseService.hidePlayer(playerId);

    // Verify the player is actually hidden
    const hiddenPlayers = userDatabaseService.getHiddenPlayers();
    const isNowHidden = hiddenPlayers.includes(playerId);
    console.log(`[database-handlers] hide-player: Verified player ${playerId} hidden=${isNowHidden}, total hidden: ${hiddenPlayers.length}`);

    if (!isNowHidden) {
      console.error(`[database-handlers] ERROR: Player ${playerId} was not stored in hidden_players!`);
      return { success: false, error: 'Player not stored in hidden list' };
    }

    return { success: true };
  } catch (error) {
    console.error('[database-handlers] Error hiding player:', error);
    return { success: false, error: String(error) };
  }
});

/**
 * Handle: database:unhide-player
 * Restore a hidden player
 */
ipcMain.handle('database:unhide-player', async (event, playerId: number) => {
  try {
    await userDatabaseService.waitForReady();
    userDatabaseService.unhidePlayer(playerId);
    return { success: true };
  } catch (error) {
    console.error('[database-handlers] Error unhiding player:', error);
    return { success: false, error: String(error) };
  }
});

/**
 * Handle: database:get-hidden-players
 * Get list of hidden player IDs
 */
ipcMain.handle('database:get-hidden-players', async () => {
  try {
    await userDatabaseService.waitForReady();
    return { success: true, playerIds: userDatabaseService.getHiddenPlayers() };
  } catch (error) {
    console.error('[database-handlers] Error getting hidden players:', error);
    return { success: false, error: String(error) };
  }
});

/**
 * Handle: database:get-hidden-players-details
 * Get detailed list of hidden players including names and source (user vs bundled)
 */
ipcMain.handle('database:get-hidden-players-details', async () => {
  try {
    await userDatabaseService.waitForReady();

    // Get user-hidden and bundled-hidden separately
    const userHidden = userDatabaseService.getUserHiddenPlayers();
    const bundledHidden = lookupService.getBundledHiddenPlayers();

    // Get players who have been unhidden by user (override for bundled)
    const userUnhiddenIds = new Set<number>();
    for (const pid of bundledHidden) {
      if (userDatabaseService.hasUserUnhidden(pid)) {
        userUnhiddenIds.add(pid);
      }
    }

    // Build result with player details
    const hiddenPlayers: {
      internalId: number;
      firstName: string;
      lastName: string;
      source: 'user' | 'bundled';
      draftClass?: number;
    }[] = [];

    // Add user-hidden players
    for (const pid of userHidden) {
      const player = lookupService.getPlayerByInternalId(pid);
      if (player) {
        hiddenPlayers.push({
          internalId: pid,
          firstName: player.firstName || '',
          lastName: player.lastName || '',
          source: 'user',
          draftClass: player.draftClass
        });
      } else {
        // Player not found in lookup - might be PID-only entry
        hiddenPlayers.push({
          internalId: pid,
          firstName: '',
          lastName: `(ID: ${pid})`,
          source: 'user'
        });
      }
    }

    // Add bundled-hidden players (excluding those user has unhidden)
    for (const pid of bundledHidden) {
      if (userUnhiddenIds.has(pid)) continue; // User has overridden

      // Don't add duplicates (if somehow both user and bundled hidden)
      if (userHidden.includes(pid)) continue;

      const player = lookupService.getPlayerByInternalId(pid);
      if (player) {
        hiddenPlayers.push({
          internalId: pid,
          firstName: player.firstName || '',
          lastName: player.lastName || '',
          source: 'bundled',
          draftClass: player.draftClass
        });
      } else {
        hiddenPlayers.push({
          internalId: pid,
          firstName: '',
          lastName: `(ID: ${pid})`,
          source: 'bundled'
        });
      }
    }

    // Sort by name
    hiddenPlayers.sort((a, b) => {
      const nameA = `${a.lastName} ${a.firstName}`.toLowerCase();
      const nameB = `${b.lastName} ${b.firstName}`.toLowerCase();
      return nameA.localeCompare(nameB);
    });

    return { success: true, players: hiddenPlayers };
  } catch (error) {
    console.error('[database-handlers] Error getting hidden players details:', error);
    return { success: false, error: String(error) };
  }
});

/**
 * Handle: database:is-player-hidden
 * Check if a player is hidden
 */
ipcMain.handle('database:is-player-hidden', async (event, playerId: number) => {
  try {
    await userDatabaseService.waitForReady();
    return { success: true, hidden: userDatabaseService.isPlayerHidden(playerId) };
  } catch (error) {
    console.error('[database-handlers] Error checking hidden status:', error);
    return { success: false, error: String(error) };
  }
});

/**
 * Handle: database:hide-all-blank-players
 * Hide all players with empty/blank names at once
 */
ipcMain.handle('database:hide-all-blank-players', async () => {
  try {
    await userDatabaseService.waitForReady();

    // Get all players from lookup service
    const allPlayers = lookupService.getAllPlayers();

    // Find all players with blank/empty names
    const blankPlayerIds: number[] = [];
    for (const player of allPlayers) {
      const firstName = (player.firstName || '').trim();
      const lastName = (player.lastName || '').trim();

      // Consider blank if both names are empty OR if display name is just "Blank"
      const displayName = `${firstName} ${lastName}`.trim();
      if (!firstName && !lastName) {
        blankPlayerIds.push(player.internalId);
      } else if (displayName.toLowerCase() === 'blank') {
        blankPlayerIds.push(player.internalId);
      }
    }

    console.log(`[database-handlers] Found ${blankPlayerIds.length} blank players to hide`);

    if (blankPlayerIds.length === 0) {
      return { success: true, hiddenCount: 0, message: 'No blank players found' };
    }

    // Bulk hide all blank players
    const hiddenCount = userDatabaseService.hideMultiplePlayers(blankPlayerIds);

    console.log(`[database-handlers] Successfully hidden ${hiddenCount} blank players`);
    return { success: true, hiddenCount, message: `Hidden ${hiddenCount} blank players` };
  } catch (error) {
    console.error('[database-handlers] Error hiding blank players:', error);
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

    console.log('[database-handlers] get-merged-player: Loading internalId:', internalId);

    // Get original player data
    const original = lookupService.getPlayerByInternalId(internalId);
    if (!original) {
      return { success: false, error: 'Player not found' };
    }
    console.log('[database-handlers] get-merged-player: Original player:', original.firstName, original.lastName);

    // Get user edits
    const playerEdit = userDatabaseService.getPlayerEdit(internalId);
    const appearanceEdit = userDatabaseService.getAppearanceEdit(internalId);
    console.log('[database-handlers] get-merged-player: playerEdit:', JSON.stringify(playerEdit, null, 2));
    console.log('[database-handlers] get-merged-player: appearanceEdit:', JSON.stringify(appearanceEdit, null, 2));

    // Auto-fill commID from commentary lookup if not already set
    // Use the merged lastName (playerEdit overrides original)
    const effectiveLastName = playerEdit?.lastName || original.lastName;
    let autoFilledCommID: string | undefined;
    if (!original.commID && !appearanceEdit?.maddenCommid && effectiveLastName) {
      const commId = lookupService.getCommentaryId(effectiveLastName);
      if (commId !== null) {
        autoFilledCommID = String(commId);
        console.log(`[database-handlers] Auto-filled commID for ${effectiveLastName}: ${commId}`);
      }
    }

    // Get effective PID using shared helper (same logic as list)
    const resolvedPid = getEffectivePid(internalId, original.pid);

    // Merge edits over original data
    const merged = {
      ...original,
      // Include id for custom portrait lookup (aliased from internalId)
      id: internalId,
      // Override PID with resolved value
      pid: resolvedPid,
      // Apply player edits (only non-null values)
      ...(playerEdit?.firstName && { firstName: playerEdit.firstName }),
      ...(playerEdit?.lastName && { lastName: playerEdit.lastName }),
      ...(playerEdit?.collegeId !== undefined && { college: String(playerEdit.collegeId) }),
      ...(playerEdit?.race !== undefined && { race: playerEdit.race }),
      ...(playerEdit?.height !== undefined && { height: playerEdit.height }),
      ...(playerEdit?.weight !== undefined && { weight: playerEdit.weight }),
      ...(playerEdit?.bodyType !== undefined && { bodyType: playerEdit.bodyType }),
      ...(playerEdit?.handedness !== undefined && { handedness: playerEdit.handedness }),
      ...(playerEdit?.hometown && { hometown: playerEdit.hometown }),
      ...(playerEdit?.homeState && { homeState: playerEdit.homeState }),
      ...(playerEdit?.draftClass !== undefined && { draftClass: String(playerEdit.draftClass) }),
      ...(playerEdit?.draftRound && { round: playerEdit.draftRound }),
      ...(playerEdit?.draftPick !== undefined && { pick: String(playerEdit.draftPick) }),
      ...(playerEdit?.careerFrom !== undefined && { careerFrom: playerEdit.careerFrom }),
      ...(playerEdit?.careerTo !== undefined && { careerTo: playerEdit.careerTo }),
      ...(appearanceEdit?.maddenPam && { pam: appearanceEdit.maddenPam }),
      ...(appearanceEdit?.maddenPlpo && { plpo: appearanceEdit.maddenPlpo }),
      // commID priority: user edit > auto-filled from lookup > original
      ...(appearanceEdit?.maddenCommid && { commID: appearanceEdit.maddenCommid }),
      ...(!appearanceEdit?.maddenCommid && autoFilledCommID && { commID: autoFilledCommID }),
      // Apply PGHE matched set for generic faces
      ...(appearanceEdit?.maddenPghe !== undefined && { pghe: appearanceEdit.maddenPghe }),
      ...(appearanceEdit?.maddenPfcg && { pfcg: appearanceEdit.maddenPfcg }),
      ...(appearanceEdit?.maddenGpan && { gpan: appearanceEdit.maddenGpan }),
      ...(appearanceEdit?.maddenGslp !== undefined && { gslp: appearanceEdit.maddenGslp }),
      ...(appearanceEdit?.maddenCpvf !== undefined && { cpvf: appearanceEdit.maddenCpvf }),
      ...(appearanceEdit?.maddenSkinTone !== undefined && { skinTone: appearanceEdit.maddenSkinTone }),
      // Mark as edited
      hasEdits: !!(playerEdit || appearanceEdit),
      // Track if using bundled developer portrait (check if PID came from bundled portraits)
      hasBundledDevPortrait: !appearanceEdit?.maddenPid && !userDatabaseService.getCustomPortraitByPlayerId(internalId) && resolvedPid === lookupService.getBundledDeveloperPortrait(internalId)
    };

    console.log('[database-handlers] get-merged-player: Final merged bodyType:', merged.bodyType, 'handedness:', merged.handedness);
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
    console.log(`[database-handlers] get-merged-player-season called: internalId=${internalId}, year=${year}`);

    await userDatabaseService.waitForReady();
    await lookupService.waitForReady();

    // Get original player first to get the PID
    const player = lookupService.getPlayerByInternalId(internalId);
    console.log(`[database-handlers] Player lookup result:`, player ? `${player.firstName} ${player.lastName}` : 'NOT FOUND');
    if (!player) {
      return { success: false, error: 'Player not found' };
    }

    // Check if seasons have been cleared for this player
    const seasonsCleared = userDatabaseService.areSeasonsCleared(internalId);
    console.log(`[database-handlers] Seasons cleared for player: ${seasonsCleared}`);

    // Get original season data from lookup service (only if not cleared)
    // Use internalId directly - works for ALL players including roster-only players without PIDs
    const originalSeason = seasonsCleared ? null : lookupService.getPlayerSeasonByInternalId(internalId, year);
    console.log(`[database-handlers] Original season data:`, originalSeason ? { team: originalSeason.team, position: originalSeason.position, POVR: originalSeason.ratings?.POVR } : 'NULL');

    // Get user edits for this season
    const seasonEdit = userDatabaseService.getSeasonEdit(internalId, year);
    console.log(`[database-handlers] Season edit:`, seasonEdit ? 'EXISTS' : 'NULL');

    if (!originalSeason && !seasonEdit) {
      console.log(`[database-handlers] No season data found for internalId=${internalId}, year=${year}`);
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
ipcMain.handle('database:search-players', async (event, query: string, options?: { limit?: number; position?: string; draftYearFrom?: number; draftYearTo?: number; team?: string; hof?: string; pid?: number; college?: string; emptyField?: string; positions?: string[] }) => {
  try {
    await lookupService.waitForReady();
    await userDatabaseService.waitForReady();

    // Pre-load ALL edit data for fast bulk lookups (load once, use for all players)
    const appearanceEditPids = userDatabaseService.getAllAppearanceEditPids();
    const customPortraitPids = userDatabaseService.getAllCustomPortraitAssignments();
    const allPlayerEdits = userDatabaseService.getAllPlayerEdits();
    const allAppearanceEdits = userDatabaseService.getAllAppearanceEdits();

    // Get hidden players list
    const hiddenPlayerIds = new Set(userDatabaseService.getHiddenPlayers());

    let results = lookupService.searchPlayers(query, options?.limit || 100);

    // Filter out hidden players
    if (hiddenPlayerIds.size > 0) {
      results = results.filter(p => !hiddenPlayerIds.has(p.internalId));
    }

    // Apply HOF filter early (before other filters) for better performance
    if (options?.hof === 'hof') {
      results = results.filter(p => p.isHOF === true);
    } else if (options?.hof === 'non-hof') {
      results = results.filter(p => !p.isHOF);
    }

    // Apply additional filters
    if (options?.position) {
      // Map raw positions (LB, LOLB, MLB, etc.) to Madden positions (SAM, Mike, WILL, etc.) before comparing
      results = results.filter(p => {
        const mappedPos = mapToMaddenPosition(p.position || '');
        return mappedPos.name === options.position;
      });
    }

    // Support filtering by multiple positions (for position groups like offense/defense/special)
    if (options?.positions && Array.isArray(options.positions) && options.positions.length > 0) {
      const positionsUpper = options.positions.map((pos: string) => pos.toUpperCase());
      results = results.filter(p => {
        const mappedPos = mapToMaddenPosition(p.position || '');
        return positionsUpper.includes(mappedPos.name.toUpperCase());
      });
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

    // NOTE: PID filter is applied AFTER getEffectivePid() mapping below
    // to correctly search custom portrait PIDs, not just original PIDs

    // Apply college filter (server-side for accurate search) - EXACT match for dropdown
    if (options?.college) {
      const collegeLower = options.college.toLowerCase().trim();
      results = results.filter(p =>
        p.college && p.college.toLowerCase().trim() === collegeLower
      );
    }

    // Apply "find empty" filter - find players missing specific data
    if (options?.emptyField) {
      const field = options.emptyField;
      results = results.filter(p => {
        switch (field) {
          case 'position':
            return !p.position || p.position.trim() === '';
          case 'college':
            return !p.college || p.college.trim() === '';
          case 'height':
            return !p.height || p.height === 0;
          case 'weight':
            return !p.weight || p.weight === 0;
          case 'draftYear':
            return !p.draftClass || p.draftClass.trim() === '';
          case 'pid':
            return !p.pid || p.pid === 0;
          default:
            return true;
        }
      });
    }

    // Map to a simpler format for the browser, applying user edit overlays
    const players = results.map(p => {
      // Check for user edits (overlay) using pre-loaded maps (O(1) lookup)
      const playerEdit = allPlayerEdits.get(p.internalId);
      const appearanceEdit = allAppearanceEdits.get(p.internalId);

      // Get college name - either from edit overlay or original data
      let college = p.college;
      if (playerEdit?.collegeId !== undefined && playerEdit.collegeId !== null) {
        // Convert college ID to name using lookup
        const collegeName = lookupService.getDisplayName('college_lookup.csv', playerEdit.collegeId);
        if (collegeName && collegeName !== String(playerEdit.collegeId)) {
          college = collegeName;
        }
      }

      // Get effective PID using fast bulk lookup (pre-loaded maps)
      const pid = getEffectivePidFast(p.internalId, p.pid, appearanceEditPids, customPortraitPids);

      return {
        internalId: p.internalId,
        pid: pid,
        photoId: pid, // Also set photoId for client-side compatibility
        firstName: playerEdit?.firstName ?? p.firstName,
        lastName: playerEdit?.lastName ?? p.lastName,
        position: playerEdit?.position ?? p.position,
        college: college,
        draftClass: playerEdit?.draftClass !== undefined ? String(playerEdit.draftClass) : p.draftClass,
        draftRound: playerEdit?.draftRound ?? p.round,
        draftPick: playerEdit?.draftPick ?? p.pick,
        careerFrom: playerEdit?.careerFrom ?? p.careerFrom,
        careerTo: playerEdit?.careerTo ?? p.careerTo,
        isHof: p.isHOF || false,
        isCustom: false,
        hasEdits: !!playerEdit || !!appearanceEdit // Flag includes appearance edits
      };
    });

    // Also search custom players
    const customPlayers = userDatabaseService.searchCustomPlayers(query, options?.limit || 100);
    let filteredCustom = customPlayers;

    // Apply filters to custom players
    if (options?.position) {
      // Map raw positions to Madden positions before comparing
      filteredCustom = filteredCustom.filter(p => {
        const mappedPos = mapToMaddenPosition(p.position || '');
        return mappedPos.name === options.position;
      });
    }
    // Support filtering by multiple positions (for position groups)
    if (options?.positions && Array.isArray(options.positions) && options.positions.length > 0) {
      const positionsUpper = options.positions.map((pos: string) => pos.toUpperCase());
      filteredCustom = filteredCustom.filter(p => {
        const mappedPos = mapToMaddenPosition(p.position || '');
        return positionsUpper.includes(mappedPos.name.toUpperCase());
      });
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
    const customMapped = filteredCustom.map(p => {
      // Resolve college name from collegeId
      let collegeName = '';
      if (p.collegeId !== undefined && p.collegeId !== null) {
        collegeName = lookupService.getDisplayName('college_lookup.csv', p.collegeId) || '';
        // If lookup returns the ID as string, clear it
        if (collegeName === String(p.collegeId)) {
          collegeName = '';
        }
      }

      // Get effective PID using fast bulk lookup (pre-loaded maps)
      const pid = getEffectivePidFast(p.id, p.maddenPid || 0, appearanceEditPids, customPortraitPids);

      return {
        internalId: p.id,
        pid: pid,
        firstName: p.firstName,
        lastName: p.lastName,
        position: p.position || '',
        college: collegeName,
        draftClass: p.draftClass ? String(p.draftClass) : '',
        draftRound: p.draftRound || '',
        draftPick: p.draftPick || 0,
        careerFrom: p.careerFrom || 0,
        careerTo: p.careerTo || 0,
        isHof: false,
        isCustom: true
      };
    });

    // Combine results - custom players first
    const allPlayers = [...customMapped, ...players];

    // Deduplicate players by name + draftClass (handles AFL/NFL duplicate drafts from 1960s)
    // Keep the first occurrence (custom players take priority, then order by internalId)
    const seenPlayers = new Map<string, typeof allPlayers[0]>();
    const deduplicatedPlayers = allPlayers.filter(p => {
      // Create unique key: lowercase lastName + firstName + draftClass
      const key = `${(p.lastName || '').toLowerCase()}_${(p.firstName || '').toLowerCase()}_${p.draftClass || ''}`;

      if (seenPlayers.has(key)) {
        // Already seen - skip this duplicate
        const existing = seenPlayers.get(key)!;
        console.log(`[database-handlers] Skipping duplicate: ${p.firstName} ${p.lastName} (${p.position}) - keeping ${existing.position}`);
        return false;
      }

      seenPlayers.set(key, p);
      return true;
    });

    // Apply PID filter AFTER effective PIDs are resolved (so custom portrait PIDs are searchable)
    let finalPlayers = deduplicatedPlayers;
    if (options?.pid !== undefined && options.pid !== null) {
      const searchPid = options.pid;
      finalPlayers = deduplicatedPlayers.filter(p => p.pid === searchPid);
      console.log(`[database-handlers] PID filter: searching for ${searchPid}, found ${finalPlayers.length} matches`);
    }

    // Sort alphabetically by lastName, then firstName (custom players sorted in with database players)
    finalPlayers.sort((a, b) => {
      const lastNameCompare = (a.lastName || '').toLowerCase().localeCompare((b.lastName || '').toLowerCase());
      if (lastNameCompare !== 0) return lastNameCompare;
      return (a.firstName || '').toLowerCase().localeCompare((b.firstName || '').toLowerCase());
    });

    console.log(`[database-handlers] searchPlayers - Found ${players.length} database + ${customMapped.length} custom, ${allPlayers.length - deduplicatedPlayers.length} duplicates removed, returning ${finalPlayers.length} matching "${query}"`);
    return { success: true, players: finalPlayers };
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
  hof?: string;
  pid?: number;
  college?: string;
  emptyField?: string;
  positions?: string[];
}) => {
  try {
    await lookupService.waitForReady();
    await userDatabaseService.waitForReady();

    // Pre-load ALL edit data for fast bulk lookups (load once, use for all players)
    const appearanceEditPids = userDatabaseService.getAllAppearanceEditPids();
    const customPortraitPids = userDatabaseService.getAllCustomPortraitAssignments();
    const allPlayerEdits = userDatabaseService.getAllPlayerEdits();
    const allAppearanceEdits = userDatabaseService.getAllAppearanceEdits();

    const offset = options?.offset || 0;
    const limit = options?.limit || 50;

    // Get hidden players list for filtering
    const hiddenList = userDatabaseService.getHiddenPlayers();
    console.log(`[database-handlers] Hidden players from DB:`, hiddenList);
    const hiddenPlayerIds = new Set(hiddenList);

    // Get all custom players first
    let customPlayers = userDatabaseService.getAllCustomPlayers();

    // Apply filters to custom players (HOF is always false for custom players)
    if (options?.hof === 'hof') {
      // If filtering for HOF only, exclude all custom players since they can't be HOF
      customPlayers = [];
    }

    // Apply other filters to custom players
    if (options?.position) {
      customPlayers = customPlayers.filter(p => {
        const mappedPos = mapToMaddenPosition(p.position || '');
        return mappedPos.name === options.position;
      });
    }
    // Support filtering by multiple positions (for position groups)
    if (options?.positions && Array.isArray(options.positions) && options.positions.length > 0) {
      const positionsUpper = options.positions.map((pos: string) => pos.toUpperCase());
      customPlayers = customPlayers.filter(p => {
        const mappedPos = mapToMaddenPosition(p.position || '');
        return positionsUpper.includes(mappedPos.name.toUpperCase());
      });
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

    // Apply PID filter to custom players
    if (options?.pid !== undefined && options.pid !== null) {
      const searchPid = options.pid;
      customPlayers = customPlayers.filter(p => p.maddenPid === searchPid);
    }

    // Apply college filter to custom players (need to resolve collegeId to name first) - EXACT match
    if (options?.college) {
      const collegeLower = options.college.toLowerCase().trim();
      customPlayers = customPlayers.filter(p => {
        if (p.collegeId !== undefined && p.collegeId !== null) {
          const collegeName = lookupService.getDisplayName('college_lookup.csv', p.collegeId) || '';
          return collegeName.toLowerCase().trim() === collegeLower;
        }
        return false;
      });
    }

    // Apply "find empty" filter to custom players
    if (options?.emptyField) {
      const field = options.emptyField;
      customPlayers = customPlayers.filter(p => {
        switch (field) {
          case 'position':
            return !p.position || p.position.trim() === '';
          case 'college':
            return p.collegeId === undefined || p.collegeId === null;
          case 'height':
            return !p.height || p.height === 0;
          case 'weight':
            return !p.weight || p.weight === 0;
          case 'draftYear':
            return !p.draftClass || p.draftClass === 0;
          case 'pid':
            return !p.maddenPid || p.maddenPid === 0;
          default:
            return true;
        }
      });
    }

    // Map custom players to common format
    const customMapped = customPlayers.map(p => {
      // Resolve college name from collegeId
      let collegeName = '';
      if (p.collegeId !== undefined && p.collegeId !== null) {
        collegeName = lookupService.getDisplayName('college_lookup.csv', p.collegeId) || '';
        // If lookup returns the ID as string, clear it
        if (collegeName === String(p.collegeId)) {
          collegeName = '';
        }
      }

      // Get effective PID using fast bulk lookup (pre-loaded maps)
      const pid = getEffectivePidFast(p.id, p.maddenPid || 0, appearanceEditPids, customPortraitPids);

      return {
        internalId: p.id,
        pid: pid,
        firstName: p.firstName,
        lastName: p.lastName,
        position: p.position || '',
        college: collegeName,
        draftClass: p.draftClass ? String(p.draftClass) : '',
        draftRound: p.draftRound || '',
        draftPick: p.draftPick || 0,
        careerFrom: p.careerFrom || 0,
        careerTo: p.careerTo || 0,
        isHof: false,
        isCustom: true
      };
    });

    // Get all players from the cache (this is already loaded in memory)
    let allPlayers = lookupService.getAllPlayers();
    console.log(`[database-handlers] getAllPlayers - Total players in cache: ${allPlayers.length}, custom: ${customMapped.length}`);

    // Filter out hidden players (user has hidden from search results)
    console.log(`[database-handlers] HIDDEN CHECK - size: ${hiddenPlayerIds.size}, IDs:`, Array.from(hiddenPlayerIds));
    if (hiddenPlayerIds.size > 0) {
      const beforeFilter = allPlayers.length;
      // Check each player and log if they're being filtered
      allPlayers = allPlayers.filter(p => {
        const isHidden = hiddenPlayerIds.has(p.internalId);
        if (isHidden) {
          console.log(`[database-handlers] REMOVING hidden player: internalId=${p.internalId}, name=${p.firstName} ${p.lastName}`);
        }
        return !isHidden;
      });
      console.log(`[database-handlers] Filtered out ${beforeFilter - allPlayers.length} hidden players, remaining: ${allPlayers.length}`);
    }

    // Apply server-side filters BEFORE pagination
    // Apply HOF filter first (most restrictive)
    if (options?.hof === 'hof') {
      allPlayers = allPlayers.filter(p => p.isHOF === true);
      console.log(`[database-handlers] After HOF filter: ${allPlayers.length} players`);
    } else if (options?.hof === 'non-hof') {
      allPlayers = allPlayers.filter(p => !p.isHOF);
    }

    if (options?.position) {
      // Map raw positions (LB, LOLB, MLB, etc.) to Madden positions (SAM, Mike, WILL, etc.) before comparing
      allPlayers = allPlayers.filter(p => {
        const mappedPos = mapToMaddenPosition(p.position || '');
        return mappedPos.name === options.position;
      });
    }

    // Support filtering by multiple positions (for position groups)
    if (options?.positions && Array.isArray(options.positions) && options.positions.length > 0) {
      const positionsUpper = options.positions.map((pos: string) => pos.toUpperCase());
      allPlayers = allPlayers.filter(p => {
        const mappedPos = mapToMaddenPosition(p.position || '');
        return positionsUpper.includes(mappedPos.name.toUpperCase());
      });
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

    // NOTE: PID filter is applied AFTER getEffectivePid() mapping below
    // to correctly search custom portrait PIDs, not just original PIDs

    // Apply college filter (server-side for accurate search) - EXACT match for dropdown
    if (options?.college) {
      const collegeLower = options.college.toLowerCase().trim();
      allPlayers = allPlayers.filter(p =>
        p.college && p.college.toLowerCase().trim() === collegeLower
      );
      console.log(`[database-handlers] After college filter (${options.college}): ${allPlayers.length} players`);
    }

    // Apply "find empty" filter - find players missing specific data
    if (options?.emptyField) {
      const field = options.emptyField;
      allPlayers = allPlayers.filter(p => {
        switch (field) {
          case 'position':
            return !p.position || p.position.trim() === '';
          case 'college':
            return !p.college || p.college.trim() === '';
          case 'height':
            return !p.height || p.height === 0;
          case 'weight':
            return !p.weight || p.weight === 0;
          case 'draftYear':
            return !p.draftClass || p.draftClass.trim() === '';
          case 'pid':
            return !p.pid || p.pid === 0;
          default:
            return true;
        }
      });
      console.log(`[database-handlers] After emptyField filter (${field}): ${allPlayers.length} players`);
    }

    // Map database players to common format, applying user edit overlays
    const dbMapped = allPlayers.map(p => {
      // Check for user edits (overlay) using pre-loaded maps (O(1) lookup)
      const playerEdit = allPlayerEdits.get(p.internalId);
      const appearanceEdit = allAppearanceEdits.get(p.internalId);

      // Get college name - either from edit overlay or original data
      let college = p.college;
      if (playerEdit?.collegeId !== undefined && playerEdit.collegeId !== null) {
        // Convert college ID to name using lookup
        const collegeName = lookupService.getDisplayName('college_lookup.csv', playerEdit.collegeId);
        if (collegeName && collegeName !== String(playerEdit.collegeId)) {
          college = collegeName;
        }
      }

      // Get effective PID using fast bulk lookup (pre-loaded maps)
      const pid = getEffectivePidFast(p.internalId, p.pid, appearanceEditPids, customPortraitPids);

      return {
        internalId: p.internalId,
        pid: pid,
        photoId: pid, // Also set photoId for client-side compatibility
        firstName: playerEdit?.firstName ?? p.firstName,
        lastName: playerEdit?.lastName ?? p.lastName,
        position: playerEdit?.position ?? p.position,
        college: college,
        draftClass: playerEdit?.draftClass !== undefined ? String(playerEdit.draftClass) : p.draftClass,
        draftRound: playerEdit?.draftRound ?? p.round,
        draftPick: playerEdit?.draftPick ?? p.pick,
        careerFrom: playerEdit?.careerFrom ?? p.careerFrom,
        careerTo: playerEdit?.careerTo ?? p.careerTo,
        isHof: p.isHOF || false,
        isCustom: false,
        hasEdits: !!playerEdit || !!appearanceEdit
      };
    });

    // Combine: custom players first, then database players
    const combined = [...customMapped, ...dbMapped];

    // Deduplicate players by name + draftClass (handles AFL/NFL duplicate drafts from 1960s)
    // Keep the first occurrence (custom players take priority)
    const seenPlayers = new Map<string, typeof combined[0]>();
    const deduplicated = combined.filter(p => {
      const key = `${(p.lastName || '').toLowerCase()}_${(p.firstName || '').toLowerCase()}_${p.draftClass || ''}`;
      if (seenPlayers.has(key)) {
        return false;
      }
      seenPlayers.set(key, p);
      return true;
    });

    // Get total AFTER filtering and deduplication but BEFORE pagination
    const duplicatesRemoved = combined.length - deduplicated.length;

    // Apply PID filter AFTER effective PIDs are resolved (so custom portrait PIDs are searchable)
    let finalList = deduplicated;
    if (options?.pid !== undefined && options.pid !== null) {
      const searchPid = options.pid;
      finalList = deduplicated.filter(p => p.pid === searchPid);
      console.log(`[database-handlers] PID filter: searching for ${searchPid}, found ${finalList.length} matches`);
    }

    // Sort alphabetically by lastName, then firstName (custom players sorted in with database players)
    finalList.sort((a, b) => {
      const lastNameCompare = (a.lastName || '').toLowerCase().localeCompare((b.lastName || '').toLowerCase());
      if (lastNameCompare !== 0) return lastNameCompare;
      return (a.firstName || '').toLowerCase().localeCompare((b.firstName || '').toLowerCase());
    });

    const total = finalList.length;

    // Apply pagination
    const paginated = finalList.slice(offset, offset + limit);

    console.log(`[database-handlers] getAllPlayers - Returning ${paginated.length} players (filtered total: ${total}, ${duplicatesRemoved} duplicates removed)`);

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

/**
 * Map generic/historical positions to Madden positions
 * Distributes linebackers between SAM, Mike, WILL based on their specific type
 */
function mapToMaddenPosition(genericPosition: string): { name: string; code: number } {
  const pos = genericPosition.toUpperCase().trim();

  // Direct Madden position matches
  const directMap: Record<string, { name: string; code: number }> = {
    'QB': { name: 'QB', code: 0 },
    'HB': { name: 'HB', code: 1 },
    'RB': { name: 'HB', code: 1 },
    'FB': { name: 'FB', code: 2 },
    'WR': { name: 'WR', code: 3 },
    'TE': { name: 'TE', code: 4 },
    'LT': { name: 'LT', code: 5 },
    'LG': { name: 'LG', code: 6 },
    'C': { name: 'C', code: 7 },
    'RG': { name: 'RG', code: 8 },
    'RT': { name: 'RT', code: 9 },
    'LEDG': { name: 'LEDG', code: 10 },
    'REDG': { name: 'REDG', code: 11 },
    'LE': { name: 'LEDG', code: 10 },
    'RE': { name: 'REDG', code: 11 },
    'DE': { name: 'LEDG', code: 10 },
    'DT': { name: 'DT', code: 12 },
    'NT': { name: 'DT', code: 12 },
    'SAM': { name: 'SAM', code: 13 },
    'MIKE': { name: 'Mike', code: 14 },
    'WILL': { name: 'WILL', code: 15 },
    'CB': { name: 'CB', code: 16 },
    'FS': { name: 'FS', code: 17 },
    'SS': { name: 'SS', code: 18 },
    'S': { name: 'SS', code: 18 },
    'K': { name: 'K', code: 19 },
    'P': { name: 'P', code: 20 },
    'LS': { name: 'LS', code: 21 },
  };

  if (directMap[pos]) {
    return directMap[pos];
  }

  // Linebacker position mapping - distribute to SAM, Mike, WILL
  // Standard NFL alignment: SAM = Strongside (right), WILL = Weakside (left), Mike = Middle
  // LOLB = Left Outside LB -> WILL (weak side)
  // ROLB = Right Outside LB -> SAM (strong side)
  // OLB = Outside LB -> WILL (default outside)
  // MLB/ILB = Middle/Inside LB -> Mike
  // Generic LB -> Mike (most common)
  if (pos === 'LOLB' || pos === 'LLB') {
    return { name: 'WILL', code: 15 };  // Left = Weakside
  }
  if (pos === 'ROLB' || pos === 'RLB') {
    return { name: 'SAM', code: 13 };   // Right = Strongside
  }
  if (pos === 'OLB') {
    return { name: 'WILL', code: 15 };  // Default outside to weakside
  }
  if (pos === 'MLB' || pos === 'ILB' || pos === 'LILB' || pos === 'RILB') {
    return { name: 'Mike', code: 14 };
  }
  if (pos === 'LB') {
    return { name: 'Mike', code: 14 };  // Generic LB -> Middle
  }

  // Handle compound positions (C/LB, FB/LB, HB/LB)
  if (pos.includes('/LB')) {
    const primary = pos.split('/')[0];
    if (directMap[primary]) {
      return directMap[primary];
    }
    return { name: 'Mike', code: 14 }; // Default hybrid to Mike
  }

  // Offensive/Defensive line generic
  if (pos === 'OL' || pos === 'OT' || pos === 'T') {
    return { name: 'LT', code: 5 };
  }
  if (pos === 'OG' || pos === 'G') {
    return { name: 'LG', code: 6 };
  }
  if (pos === 'DL') {
    return { name: 'DT', code: 12 };
  }
  if (pos === 'DB') {
    return { name: 'CB', code: 16 };
  }

  // Default fallback
  console.warn(`[database-handlers] Unknown position "${genericPosition}", defaulting to QB`);
  return { name: 'QB', code: 0 };
}

// Default archetypes by position (first/primary archetype for each position)
// Archetype IDs from archetypeService.ts:
// C Archetypes: 27-30 (C Pass Protector, C Power, C Well-Rounded, C Agile)
// OT Archetypes: 31-34 (OT Pass Protector, OT Power, OT Well-Rounded, OT Agile)
// G Archetypes: 35-38 (G Pass Protector, G Well-Rounded, G Power, G Agile)
// DE Archetypes: 39-42
// DT Archetypes: 43-46
// OLB Archetypes: 47-50
// MLB Archetypes: 51-53
// CB Archetypes: 54-57
// S Archetypes: 58-60
const DEFAULT_ARCHETYPES: Record<string, number> = {
  'QB': 0,    // Field General
  'HB': 6,    // Elusive Back
  'FB': 8,    // Power Blocking
  'WR': 15,   // Playmaker
  'TE': 22,   // Blocking (was 20)
  'LT': 31,   // OT Pass Protector (was 27 = C Pass Protector - WRONG!)
  'LG': 35,   // G Pass Protector (was 31 = OT Pass Protector - WRONG!)
  'C': 27,    // C Pass Protector (was 35 = G Pass Protector - WRONG!)
  'RG': 35,   // G Pass Protector (was 31 - WRONG!)
  'RT': 31,   // OT Pass Protector (was 27 - WRONG!)
  'LEDG': 39, // DE Smaller Speed Rusher (was 45 = DT Speed Rusher - WRONG!)
  'REDG': 39, // DE Smaller Speed Rusher (was 45 - WRONG!)
  'DT': 43,   // DT Nose Tackle (was 42 - close but not exact)
  'SAM': 47,  // OLB Speed Rusher (was 49 = OLB Pass Coverage)
  'Mike': 51, // MLB Field General (was 53 = Run Stopper)
  'WILL': 49, // OLB Pass Coverage
  'CB': 54,   // CB Man-to-Man (was 57 = Hybrid Corner)
  'FS': 58,   // S Zone (was 61 = K Accurate - WRONG!)
  'SS': 60,   // S Run Support (was 65 - wrong range)
  'K': 61,    // KP Accurate (was 69 - out of range)
  'P': 62,    // KP Power (was 71 - out of range)
  'LS': 65    // LS Power (was 73 - out of range)
};

// Race-appropriate generic PAM names by skin tone
const GENERIC_PAM_BY_RACE: Record<number, string[]> = {
  1: ['gen_1_B_N_010', 'gen_1_B_N_011', 'gen_1_M_N_02', 'gen_2_B_N_01', 'gen_2_B_N_02'],  // White
  5: ['gen_3_B_N_01', 'gen_4_B_N_01', 'gen_4_B_N_02', 'gen_5_B_N_01'],  // Mixed
  7: ['gen_6_B_N_01', 'gen_6_B_N_02', 'gen_7_B_N_019', 'gen_7_B_N_011', 'gen_7_B_N_07']  // Black
};

// Race-appropriate generic PIDs that have actual portraits in PID_Portrait_Mapping.csv
// These PIDs show actual generic faces instead of blank silhouettes
const GENERIC_PID_BY_RACE: Record<number, number[]> = {
  1: [731, 2547, 2583, 2586, 2587, 2589, 2591, 2717],  // White
  5: [961, 2131, 2270],  // Mixed
  7: [719, 721, 725, 727, 730, 2271, 2325, 2373, 2546]  // Black
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
 * Get a race-appropriate generic PID that has an actual portrait
 */
function getGenericPID(race: number | undefined): number {
  // Default to mixed race (5) if unknown
  const effectiveRace = race === 1 ? 1 : race === 7 ? 7 : 5;
  const pool = GENERIC_PID_BY_RACE[effectiveRace] || GENERIC_PID_BY_RACE[5];
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * Get skin tone (1-7) from race for draft class visuals
 * Race mapping: 1=White, 5=Mixed, 7=Black
 * SkinTone: 1-2=light, 3-5=medium, 6-7=dark
 */
function getSkinToneFromRace(race: number | undefined): number {
  if (race === 1) {
    // White -> light skin (1-2)
    return Math.random() < 0.5 ? 1 : 2;
  } else if (race === 7) {
    // Black -> dark skin (6-7)
    return Math.random() < 0.5 ? 6 : 7;
  } else {
    // Mixed/other -> medium skin (3-5)
    return 3 + Math.floor(Math.random() * 3);
  }
}

/**
 * Get dev trait from season data
 * Returns 0=Normal, 1=Star, 2=Superstar, 3=X-Factor
 */
function getDevTraitFromSeasonData(seasonData: any): number {
  if (!seasonData) return 0;

  // Check for devTrait field (try multiple possible property names)
  const devTrait = seasonData.devTrait ?? seasonData.dev_trait ?? seasonData.development;

  // Handle undefined, null, or empty string - all default to Normal
  if (devTrait === undefined || devTrait === null || devTrait === '') return 0;

  // Handle string values
  if (typeof devTrait === 'string') {
    const lower = devTrait.toLowerCase().trim();
    if (lower === 'x-factor' || lower === 'xfactor' || lower === 'x factor') return 3;
    if (lower === 'superstar' || lower === 'ss') return 2;
    if (lower === 'star') return 1;
    if (lower === 'normal' || lower === 'n') return 0;
    const parsed = parseInt(devTrait, 10);
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 3) return parsed;
  }

  // Handle number values
  if (typeof devTrait === 'number' && devTrait >= 0 && devTrait <= 3) {
    return devTrait;
  }

  return 0;
}

/**
 * Determine body type for draft class based on position and weight/height
 * Returns Madden body type STRING: "Thin", "Muscular", "Heavy"
 */
function getDraftBodyType(position: string, weight: number, height: number): string {
  const pos = position.toUpperCase();
  const w = weight || 200;
  const h = height || 73;

  // Calculate BMI
  const bmi = (w / (h * h)) * 703;

  // HB and QB should ALWAYS be Muscular - never Heavy
  if (['HB', 'QB'].includes(pos)) {
    return 'Muscular';
  } else if (['WR', 'CB', 'FS'].includes(pos)) {
    return bmi < 24 ? 'Thin' : 'Muscular';
  } else if (['FB', 'SAM', 'MIKE', 'WILL', 'SS', 'TE'].includes(pos)) {
    return bmi < 28 ? 'Muscular' : 'Heavy';
  } else if (['LT', 'LG', 'C', 'RG', 'RT', 'LEDG', 'REDG', 'DT'].includes(pos)) {
    return 'Heavy';
  } else {
    return 'Muscular';
  }
}

/**
 * Get body type code for roster (PCBT field)
 * Returns numeric code: 0=Standard, 1=Thin, 2=Muscular, 3=Heavy
 */
function getRosterBodyType(position: string, weight: number, height: number): number {
  const bodyType = getDraftBodyType(position, weight, height);
  switch (bodyType) {
    case 'Thin': return 1;
    case 'Muscular': return 2;
    case 'Heavy': return 3;
    default: return 0; // Standard
  }
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
    await userDatabaseService.waitForReady();

    // Get player base data
    const originalPlayer = lookupService.getPlayerByInternalId(internalId);
    if (!originalPlayer) {
      return { success: false, error: 'Player not found' };
    }

    // Get user edits and merge with original data
    const playerEdit = userDatabaseService.getPlayerEdit(internalId);

    // Convert homeState ID to name if user edited it (stored as ID)
    let rosterEditedHomeStateName: string | undefined;
    if (playerEdit?.homeState) {
      const statesLookup = await lookupService.getDropdownOptions('state_lookup.csv');
      const stateId = typeof playerEdit.homeState === 'string' ? parseInt(playerEdit.homeState, 10) : playerEdit.homeState;
      const stateEntry = statesLookup.find(s => s.id === stateId);
      rosterEditedHomeStateName = stateEntry?.name || String(playerEdit.homeState);
      console.log(`[database-handlers] Roster: Converted homeState ID ${playerEdit.homeState} to name "${rosterEditedHomeStateName}"`);
    }

    const player = {
      ...originalPlayer,
      // Apply user edits if they exist
      ...(playerEdit?.firstName && { firstName: playerEdit.firstName }),
      ...(playerEdit?.lastName && { lastName: playerEdit.lastName }),
      ...(playerEdit?.college && { college: playerEdit.college }),
      ...(rosterEditedHomeStateName && { homeState: rosterEditedHomeStateName }),
      ...(playerEdit?.race !== undefined && { race: playerEdit.race }),
      ...(playerEdit?.height !== undefined && { height: playerEdit.height }),
      ...(playerEdit?.weight !== undefined && { weight: playerEdit.weight }),
      ...(playerEdit?.hometown && { hometown: playerEdit.hometown }),
    };

    // Get season data for the specified year
    // IMPORTANT: Check user edits first, then fall back to original database data
    const seasons = lookupService.getPlayerSeasons(internalId);
    const originalRosterSeasonData = seasons.find(s => s.year === year);
    const userRosterSeasonEdit = userDatabaseService.getSeasonEdit(internalId, year);

    // Merge user edits with original data (user edits take priority)
    let seasonData: any = null;
    if (userRosterSeasonEdit || originalRosterSeasonData) {
      seasonData = {
        year,
        team: userRosterSeasonEdit?.team ?? originalRosterSeasonData?.team ?? '',
        jersey: userRosterSeasonEdit?.jersey ?? originalRosterSeasonData?.jersey ?? 0,
        age: userRosterSeasonEdit?.age ?? originalRosterSeasonData?.age ?? 22,
        position: userRosterSeasonEdit?.position ?? originalRosterSeasonData?.position ?? '',
        archetype: userRosterSeasonEdit?.archetype ?? originalRosterSeasonData?.archetype ?? 0,
        devTrait: userRosterSeasonEdit?.devTrait ?? originalRosterSeasonData?.devTrait ?? 'normal',
        overall: userRosterSeasonEdit?.ratings?.POVR ?? originalRosterSeasonData?.ratings?.POVR ?? 70,
        ratings: {
          // Merge ratings: user edit ratings override original ratings
          ...(originalRosterSeasonData?.ratings || {}),
          ...(userRosterSeasonEdit?.ratings || {})
        }
      };
      console.log(`[database-handlers] Roster merged ratings: PSPD=${seasonData.ratings.PSPD}, PACC=${seasonData.ratings.PACC}, POVR=${seasonData.ratings.POVR}`);
    }

    // Get college ID from lookup - use 0 (None) if not found
    const colleges = lookupService.getDropdownOptions('college_lookup.csv');
    let collegeId = 0;
    let rosterCollegeName = '';
    if (player.college && player.college.trim()) {
      const playerCollegeLower = player.college.toLowerCase();
      // Try exact match first
      let collegeEntry = colleges.find(c => c.name.toLowerCase() === playerCollegeLower);
      // If not found, try partial match
      if (!collegeEntry) {
        collegeEntry = colleges.find(c => playerCollegeLower.includes(c.name.toLowerCase()) || c.name.toLowerCase().includes(playerCollegeLower));
      }
      if (collegeEntry) {
        collegeId = collegeEntry.id;
        rosterCollegeName = collegeEntry.name;
      } else {
        rosterCollegeName = player.college.trim();
        console.log(`[database-handlers] Roster college not found in lookup: "${player.college}"`);
      }
    }

    // Get state ID from lookup
    // IMPORTANT: Default to undefined, NOT 0 - because state ID 0 = Alabama in Madden
    const states = await lookupService.getDropdownOptions('state_lookup.csv');
    let rosterHomeStateId: number | undefined = undefined;
    if (player.homeState && player.homeState.trim()) {
      const stateEntry = states.find(s => s.name.toLowerCase() === player.homeState!.toLowerCase());
      if (stateEntry) {
        rosterHomeStateId = stateEntry.id;
      }
    }

    // Get position - use database position or season position
    // Use mapToMaddenPosition to convert generic positions (LB, MLB, OLB, etc.) to Madden positions
    const rawPosition = seasonData?.position || player.position || 'QB';
    const mappedPosition = mapToMaddenPosition(rawPosition);
    const positionName = mappedPosition.name;
    const positionId = mappedPosition.code;
    console.log(`[database-handlers] Position mapped: "${rawPosition}" -> "${positionName}" (code ${positionId})`);

    // Calculate height in inches - default to position-appropriate height
    let heightInches = player.height || 72;
    if (!player.height) {
      // Position-based default heights
      const defaultHeights: Record<string, number> = {
        'QB': 75, 'HB': 71, 'FB': 72, 'WR': 73, 'TE': 77,
        'LT': 78, 'LG': 76, 'C': 75, 'RG': 76, 'RT': 78,
        'LEDG': 76, 'REDG': 76, 'DT': 75, 'SAM': 74, 'Mike': 74, 'WILL': 74,
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
    // FIX: Ensure we get a valid number - careerFrom may be string or number,
    // draftClass may be string or empty - handle all cases
    const careerFromNum = typeof player.careerFrom === 'number' ? player.careerFrom :
                          (typeof player.careerFrom === 'string' ? parseInt(player.careerFrom, 10) : NaN);
    const draftClassNum = player.draftClass ? parseInt(String(player.draftClass), 10) : NaN;
    const careerStart = (!isNaN(careerFromNum) && careerFromNum > 1900) ? careerFromNum :
                        (!isNaN(draftClassNum) && draftClassNum > 1900) ? draftClassNum : year;
    const yearsPro = Math.max(0, year - careerStart);

    // Calculate age: if season has valid age use it, otherwise estimate from draft/career
    // IMPORTANT: Must validate age is a number within Madden's valid range (18-45)
    // The roster field PAGE has min:18, max:45 validation
    let age = seasonData?.age;
    if (!age || typeof age !== 'number' || isNaN(age) || age < 18 || age > 45) {
      // Assume 22 at draft/career start (average draft age)
      age = 22 + yearsPro;
    }
    // Always clamp to valid range for Madden roster validation
    age = Math.max(18, Math.min(45, age));

    console.log(`[database-handlers] Age calc for ${player.firstName} ${player.lastName}: year=${year}, careerFrom=${player.careerFrom}(${careerFromNum}), draftClass=${player.draftClass}(${draftClassNum}), careerStart=${careerStart}, yearsPro=${yearsPro}, age=${age}`);

    // Check for stored PGHE data from database appearance edits
    // This allows users to assign specific generic faces in the database player card
    let rosterStoredPgheData: { pghe: number; pfcg: string; psxp: number; skinTone: number; genr: string } | null = null;
    let rosterAppearanceEdit: ReturnType<typeof userDatabaseService.getAppearanceEdit> = undefined;

    try {
      rosterAppearanceEdit = userDatabaseService.getAppearanceEdit(internalId);

      // Check if appearance edit has VALID generic face data
      // IMPORTANT: PGHE=0 is NOT valid, must be > 0 to be a real face index
      // Also check for valid PFCG or gen_ PAM
      const hasStoredGenericFace = rosterAppearanceEdit && (
        (rosterAppearanceEdit.maddenPghe !== undefined && rosterAppearanceEdit.maddenPghe > 0) ||
        (rosterAppearanceEdit.maddenPfcg && rosterAppearanceEdit.maddenPfcg.trim() !== '') ||
        (rosterAppearanceEdit.maddenPam && rosterAppearanceEdit.maddenPam.startsWith('gen_'))
      );

      if (hasStoredGenericFace) {
        rosterStoredPgheData = {
          pghe: rosterAppearanceEdit.maddenPghe ?? 0,
          pfcg: rosterAppearanceEdit.maddenPfcg || '',
          psxp: rosterAppearanceEdit.maddenPid || 0,
          skinTone: rosterAppearanceEdit.maddenSkinTone || (rosterAppearanceEdit.maddenPfcg ? parseInt(rosterAppearanceEdit.maddenPfcg.charAt(0)) : 4) || 4,
          genr: rosterAppearanceEdit.maddenPam || (rosterAppearanceEdit.maddenPfcg ? `gen_${rosterAppearanceEdit.maddenPfcg}` : '')
        };
        console.log(`[database-handlers] Found VALID stored PGHE data for roster ${player.firstName} ${player.lastName}: PGHE=${rosterStoredPgheData.pghe}, PID=${rosterStoredPgheData.psxp}, skinTone=${rosterStoredPgheData.skinTone}, genr=${rosterStoredPgheData.genr}`);
      } else if (rosterAppearanceEdit) {
        console.log(`[database-handlers] Appearance edit exists but has no valid face data for roster ${player.firstName} ${player.lastName} - will use random generic face`);
      }
    } catch (pgheError) {
      console.warn(`[database-handlers] Could not get PGHE data for ${player.firstName} ${player.lastName}:`, pgheError);
      // Continue without PGHE data - player will get random generic face
    }

    // Determine PID and PAM - ALWAYS assign values, never leave blank
    let pid: number;
    let pam: string;
    let effectiveRace = player.race;
    let rosterPgheIndex: number | undefined; // Track PGHE index for roster player

    // Check if player has valid PID and PAM
    const hasValidPID = !isEmptyPID(player.pid);
    const hasValidPAM = !isEmptyPAM(player.pam);

    if (hasValidPAM && typeof player.pam === 'string' && !player.pam.startsWith('gen_')) {
      // Player has a real face scan PAM
      pam = player.pam;
      pid = hasValidPID ? player.pid : 0;
    } else if (rosterStoredPgheData) {
      // Player has stored PGHE data from database - use it instead of random
      pid = rosterStoredPgheData.psxp;
      pam = rosterStoredPgheData.genr; // Roster uses PEPS=GENR for generic faces
      effectiveRace = rosterStoredPgheData.skinTone;
      rosterPgheIndex = rosterStoredPgheData.pghe;
      console.log(`[database-handlers] Using stored PGHE face for roster ${player.firstName} ${player.lastName}: PID=${pid}, PAM=${pam}, PGHE=${rosterPgheIndex}, skinTone=${effectiveRace}`);
    } else {
      // Player needs generic face - determine race if unknown
      if (effectiveRace === undefined || effectiveRace === null) {
        // Try to look up race by PID
        if (player.pid && player.pid > 0) {
          effectiveRace = lookupService.getRaceByPID(player.pid);
        }
        // If still unknown, check career years for historical context
        // NFL was segregated until 1946 - players before then were white
        if (effectiveRace === undefined || effectiveRace === null) {
          // Use already-parsed careerStart from age calculation (guaranteed to be a valid number)
          console.log(`[database-handlers] Race check: careerStart=${careerStart}, player.careerFrom=${player.careerFrom}, player.draftClass=${player.draftClass}`);
          if (careerStart && careerStart > 1900 && careerStart < 1946) {
            // Pre-integration era - NFL was all white
            effectiveRace = 1; // White
            console.log(`[database-handlers] Pre-1946 player, defaulting to white for roster ${player.firstName} ${player.lastName} (career start: ${careerStart})`);
          } else {
            // Modern era - use NFL demographics (70% Black, 25% White, 5% Mixed)
            const rand = Math.random();
            effectiveRace = rand < 0.70 ? 7 : (rand < 0.95 ? 1 : 5);
          }
        }
        console.log(`[database-handlers] Assigned race ${effectiveRace} for ${player.firstName} ${player.lastName}`);
      }
      // ROSTER RULES: Blank PAM, use a generic PID that has an actual portrait
      // This shows a real generic face instead of a blank silhouette
      pam = '';
      pid = getGenericPID(effectiveRace);
    }

    console.log(`[database-handlers] PID/PAM for ${player.firstName} ${player.lastName}: PID=${pid}, PAM='${pam}', race=${effectiveRace}, pgheIndex=${rosterPgheIndex ?? 'N/A'}`);

    // Get default archetype for position if not in season data
    const defaultArchetype = DEFAULT_ARCHETYPES[positionName] || 0;

    // Get commentary ID - priority: user edit > original CSV > lookup by name
    // rosterAppearanceEdit was already retrieved above for PGHE data
    let rosterCommId = 0;

    if (rosterAppearanceEdit?.maddenCommid) {
      rosterCommId = parseInt(rosterAppearanceEdit.maddenCommid) || 0;
      if (rosterCommId) {
        console.log(`[database-handlers] Using user-edited PCMT for ${player.lastName}: ${rosterCommId}`);
      }
    }

    // Fall back to original CSV data
    if (!rosterCommId && player.commID) {
      rosterCommId = parseInt(player.commID) || 0;
    }

    // Fall back to lookup by last name
    if (!rosterCommId && player.lastName) {
      const lookedUpCommId = lookupService.getCommentaryId(player.lastName);
      if (lookedUpCommId !== null) {
        rosterCommId = lookedUpCommId;
        console.log(`[database-handlers] Auto-filled PCMT for roster ${player.lastName}: ${rosterCommId}`);
      }
    }

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
      PLTY: 0, // Archetype - will be set below (PLTY is what franchise reads!)

      // PGHE face picker index (if user assigned specific generic face in database)
      ...(rosterPgheIndex !== undefined && { PGHE: rosterPgheIndex }),

      // Additional required fields
      PCBT: getRosterBodyType(positionName, weight, heightInches), // Body type based on position/size
      PHLM: 0, // Helmet style
      PVSL: 0, // Visor style
      PHSN: rosterHomeStateId, // Home state
      PLBD: 0, // Birthday (will calculate if needed)
      PCMT: rosterCommId, // Commentary ID - auto-filled from lookup
      POID: rosterCommId, // Presentation ID - same as PCMT
      PHAN: 0, // Handedness (0=Right, 1=Left)

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
      PROL: 0,
    };

    // Add ratings from season data if available, otherwise use position-appropriate defaults
    // NOTE: The database stores ratings using Madden field codes (PSPD, PACC, etc.)
    // NOT human-readable names (speed, acceleration, etc.)
    if (seasonData && seasonData.ratings) {
      const r = seasonData.ratings;
      rosterPlayer.POVR = r.POVR || seasonData.overall || 70;
      rosterPlayer.PSPD = r.PSPD || 70;
      rosterPlayer.PACC = r.PACC || 70;
      rosterPlayer.PSTR = r.PSTR || 70;
      rosterPlayer.PAGI = r.PAGI || 70;
      rosterPlayer.PAWR = r.PAWR || 70;
      rosterPlayer.PCTH = r.PCTH || 70;
      rosterPlayer.PCAR = r.PCAR || 70;
      rosterPlayer.PTHP = r.PTHP || 70;
      rosterPlayer.PKPR = r.PKPW || 70; // PKPW in db = PKPR in roster (kick power)
      rosterPlayer.PKAC = r.PKAC || 70;
      rosterPlayer.PRBK = r.PRBK || 70;
      rosterPlayer.PPBK = r.PPBK || 70;
      rosterPlayer.PTAK = r.PTAK || 70;
      rosterPlayer.PBKT = r.PBTK || 70; // PBTK in db = PBKT in roster (break tackle)
      rosterPlayer.PJMP = r.PJMP || r.PJUM || 70; // PJUM or PJMP
      rosterPlayer.PSTA = r.PSTA || 85;
      rosterPlayer.PINJ = r.PINJ || 85;
      rosterPlayer.PTGH = r.PTGH || 70;
      rosterPlayer.PLPU = r.PPUR || 70; // PPUR in db = PLPU (pursuit)
      rosterPlayer.PLPR = r.PPRC || 70; // PPRC in db = PLPR (play recognition)
      rosterPlayer.PLMC = r.PMCV || 70; // PMCV in db = PLMC (man coverage)
      rosterPlayer.PLZC = r.PZCV || 70; // PZCV in db = PLZC (zone coverage)
      rosterPlayer.PLPE = r.PPRS || 70; // PPRS in db = PLPE (press)
      rosterPlayer.PLHT = r.PHTP || 70; // PHTP in db = PLHT (hit power)
      rosterPlayer.PBSG = r.PBSH || 70; // PBSH in db = PBSG (block shedding)
      rosterPlayer.PLPM = r.PPWM || 70; // PPWM in db = PLPM (power moves)
      rosterPlayer.PFMS = r.PFNM || 70; // PFNM in db = PFMS (finesse moves)
      rosterPlayer.PTAS = r.PTAS || 70;
      rosterPlayer.PTAM = r.PTAM || 70;
      rosterPlayer.PTAD = r.PTAD || 70;
      rosterPlayer.PPLA = r.PPLA || 70;
      rosterPlayer.PTOR = r.PTOR || 70;
      rosterPlayer.PTUP = r.PTUP || 70;
      rosterPlayer.PBCV = r.PBCV || 70;
      rosterPlayer.PLJM = r.PJUM || 70; // PJUM in db = PLJM (juke move)
      rosterPlayer.PLSM = r.PSPM || 70; // PSPM in db = PLSM (spin move)
      rosterPlayer.PLSA = r.PSTF || 70; // PSTF in db = PLSA (stiff arm)
      rosterPlayer.PLTR = r.PLTR || r.PTRK || 70; // PTRK or PLTR (trucking)
      rosterPlayer.PELU = r.PCOD || 70; // PCOD in db = PELU (change of direction)
      rosterPlayer.PLRL = r.PREL || 70; // PREL in db = PLRL (release)
      rosterPlayer.SRRN = r.PSRR || 70; // PSRR in db = SRRN (short route running)
      rosterPlayer.PMRR = r.PMRR || 70;
      rosterPlayer.PDRR = r.PDRR || 70;
      rosterPlayer.PLCI = r.PCIT || 70; // PCIT in db = PLCI (catch in traffic)
      rosterPlayer.PLSC = r.PSPC || 70; // PSPC in db = PLSC (spectacular catch)
      rosterPlayer.PLIB = r.PIBL || 70; // PIBL in db = PLIB (impact blocking)
      rosterPlayer.PLBK = r.PLDB || 70; // PLDB in db = PLBK (lead block)
      rosterPlayer.PPBF = r.PPBF || 70;
      rosterPlayer.PPBS = r.PPBP || 70; // PPBP in db = PPBS (pass block power/strength)
      rosterPlayer.PRBF = r.PRBF || 70;
      rosterPlayer.PRBS = r.PRBP || 70; // PRBP in db = PRBS (run block power/strength)
      rosterPlayer.PBSK = r.PBRS || 70; // PBRS in db = PBSK (break sack)
      rosterPlayer.PKRT = r.PKRT || 70;

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
      rosterPlayer.PLTY = archetypeId;  // PLTY is what franchise reads!

      // Parse dev trait from season data
      if (seasonData.devTrait !== undefined && seasonData.devTrait !== null) {
        if (typeof seasonData.devTrait === 'number') {
          rosterPlayer.PROL = seasonData.devTrait;
        } else if (typeof seasonData.devTrait === 'string') {
          const devMap: Record<string, number> = {
            'normal': 0, 'star': 1, 'superstar': 2, 'x-factor': 3, 'xfactor': 3
          };
          rosterPlayer.PROL = devMap[seasonData.devTrait.toLowerCase()] ?? 0;
        }
      }
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
      rosterPlayer.PLTY = defaultArchetype;  // PLTY is what franchise reads!
    }

    // Set ARCHETYPE display name from PLTY ID
    rosterPlayer.ARCHETYPE = ArchetypeService.getArchetypeName(rosterPlayer.PLTY, positionName);

    // Store race for BLBM face generation
    rosterPlayer._race = effectiveRace || 5; // Use effective race for BLBM GENR/SKNT assignment

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

    // Sync archetype based on player attributes - ensures PLTY matches what Madden will auto-assign
    const syncedPlayer = ArchetypeSyncService.syncArchetypeFromAttributes(rosterPlayer, positionName);
    syncedPlayer.ARCHETYPE = ArchetypeService.getArchetypeName(syncedPlayer.PLTY, positionName);

    // Recalculate POVR using proper Madden formula to ensure it matches game calculation
    if (ovrWeightsCalculator.isInitialized()) {
      const calculatedOvr = ovrWeightsCalculator.calculateOVR(syncedPlayer, positionName, syncedPlayer.PLTY);
      // Floor of 40 for database players (quality control)
      syncedPlayer.POVR = Math.max(40, Math.min(99, calculatedOvr));
      console.log(`[database-handlers] Roster POVR recalculated via OVRWeightsCalculator: ${syncedPlayer.POVR}`);
    }

    return {
      success: true,
      player: syncedPlayer,
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
    await userDatabaseService.waitForReady();

    // Get player base data
    const originalPlayer = lookupService.getPlayerByInternalId(internalId);
    if (!originalPlayer) {
      return { success: false, error: 'Player not found' };
    }

    // Get user edits and merge with original data
    const playerEdit = userDatabaseService.getPlayerEdit(internalId);

    // Convert homeState ID to name if user edited it (stored as ID)
    let draftEditedHomeStateName: string | undefined;
    if (playerEdit?.homeState) {
      const statesLookup = await lookupService.getDropdownOptions('state_lookup.csv');
      const stateId = typeof playerEdit.homeState === 'string' ? parseInt(playerEdit.homeState, 10) : playerEdit.homeState;
      const stateEntry = statesLookup.find(s => s.id === stateId);
      draftEditedHomeStateName = stateEntry?.name || String(playerEdit.homeState);
      console.log(`[database-handlers] Draft: Converted homeState ID ${playerEdit.homeState} to name "${draftEditedHomeStateName}"`);
    }

    const player = {
      ...originalPlayer,
      // Apply user edits if they exist
      ...(playerEdit?.firstName && { firstName: playerEdit.firstName }),
      ...(playerEdit?.lastName && { lastName: playerEdit.lastName }),
      ...(playerEdit?.college && { college: playerEdit.college }),
      ...(draftEditedHomeStateName && { homeState: draftEditedHomeStateName }),
      ...(playerEdit?.race !== undefined && { race: playerEdit.race }),
      ...(playerEdit?.height !== undefined && { height: playerEdit.height }),
      ...(playerEdit?.weight !== undefined && { weight: playerEdit.weight }),
      ...(playerEdit?.hometown && { hometown: playerEdit.hometown }),
    };

    // DEBUG: Log raw player data from database
    console.log(`[database-handlers] RAW player data from database for internalId=${internalId}:`);
    console.log(`  firstName: "${player.firstName}", lastName: "${player.lastName}"`);
    console.log(`  college: "${player.college}", homeState: "${player.homeState}" (edit: "${playerEdit?.homeState}")`);
    console.log(`  position: "${player.position}", pid: ${player.pid}, pam: "${player.pam}"`);
    console.log(`  race: ${player.race}, round: "${player.round}", pick: "${player.pick}"`);
    console.log(`  careerFrom: ${player.careerFrom}, careerTo: ${player.careerTo}, draftClass: "${player.draftClass}"`);

    // Get season data for the specified year
    // IMPORTANT: Check user edits first, then fall back to original database data
    const seasons = lookupService.getPlayerSeasons(internalId);
    const originalSeasonData = seasons.find(s => s.year === year);
    const userSeasonEdit = userDatabaseService.getSeasonEdit(internalId, year);

    // Merge user edits with original data (user edits take priority)
    let seasonData: any = null;
    if (userSeasonEdit || originalSeasonData) {
      seasonData = {
        year,
        team: userSeasonEdit?.team ?? originalSeasonData?.team ?? '',
        jersey: userSeasonEdit?.jersey ?? originalSeasonData?.jersey ?? 0,
        age: userSeasonEdit?.age ?? originalSeasonData?.age ?? 22,
        position: userSeasonEdit?.position ?? originalSeasonData?.position ?? '',
        archetype: userSeasonEdit?.archetype ?? originalSeasonData?.archetype ?? 0,
        devTrait: userSeasonEdit?.devTrait ?? originalSeasonData?.devTrait ?? 'normal',
        ratings: {
          // Merge ratings: user edit ratings override original ratings
          ...(originalSeasonData?.ratings || {}),
          ...(userSeasonEdit?.ratings || {})
        }
      };
    }
    console.log(`[database-handlers] Season data for year ${year}: original=${!!originalSeasonData}, userEdit=${!!userSeasonEdit}`);
    if (seasonData?.ratings) {
      console.log(`[database-handlers] Merged ratings: PSPD=${seasonData.ratings.PSPD}, PACC=${seasonData.ratings.PACC}, POVR=${seasonData.ratings.POVR}`);
    }

    // Get college ID from lookup - use 0 (None) if not found
    const colleges = await lookupService.getDropdownOptions('college_lookup.csv');
    let collegeId = 0;
    let collegeName = '';
    if (player.college && player.college.trim()) {
      const playerCollegeLower = player.college.toLowerCase();
      // Try exact match first
      let collegeEntry = colleges.find(c => c.name.toLowerCase() === playerCollegeLower);
      // If not found, try partial match (e.g., "University of Alabama" -> "Alabama")
      if (!collegeEntry) {
        collegeEntry = colleges.find(c => playerCollegeLower.includes(c.name.toLowerCase()) || c.name.toLowerCase().includes(playerCollegeLower));
      }
      if (collegeEntry) {
        collegeId = collegeEntry.id;
        collegeName = collegeEntry.name;
      } else {
        // Keep the original college name even if not in lookup
        collegeName = player.college.trim();
        console.log(`[database-handlers] College not found in lookup: "${player.college}"`);
      }
    }

    // Get position - ALWAYS prefer player.position from database over seasonData.position
    // Season data may be from wrong player due to name-only matching in database creation
    // Map to Madden position (handles linebacker variations like LB, LOLB, MLB, etc.)
    const rawPosition = player.position || seasonData?.position || 'QB';
    const mappedPosition = mapToMaddenPosition(rawPosition);
    const positionName = mappedPosition.name;
    const positionId = mappedPosition.code;
    console.log(`[database-handlers] Position: raw="${rawPosition}", mapped="${positionName}" (player.position="${player.position}", seasonData.position="${seasonData?.position}")`);

    // Check if season data position matches player position - if not, season data may be wrong
    const seasonPositionMatches = seasonData && mapToMaddenPosition(seasonData.position || '').name === positionName;

    // Get state ID from lookup
    // IMPORTANT: Default to undefined, NOT 0 - because state ID 0 = Alabama in Madden
    const states = await lookupService.getDropdownOptions('state_lookup.csv');
    let homeStateId: number | undefined = undefined;
    let homeStateName = '';
    if (player.homeState && player.homeState.trim()) {
      const stateEntry = states.find(s => s.name.toLowerCase() === player.homeState!.toLowerCase());
      if (stateEntry) {
        homeStateId = stateEntry.id;
        homeStateName = stateEntry.name;
      } else {
        homeStateName = player.homeState.trim();
      }
    }

    // DEBUG: Log lookup results
    console.log(`[database-handlers] Lookup results:`);
    console.log(`  college: ID=${collegeId}, name="${collegeName}" (from DB: "${player.college}")`);
    console.log(`  homeState: ID=${homeStateId}, name="${homeStateName}" (from DB: "${player.homeState}")`);

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
    // FIX: Ensure we get a valid number - careerFrom may be string or number,
    // draftClass may be string or empty - handle all cases
    const draftCareerFromNum = typeof player.careerFrom === 'number' ? player.careerFrom :
                          (typeof player.careerFrom === 'string' ? parseInt(player.careerFrom, 10) : NaN);
    const draftDraftClassNum = player.draftClass ? parseInt(String(player.draftClass), 10) : NaN;
    const draftCareerStart = (!isNaN(draftCareerFromNum) && draftCareerFromNum > 1900) ? draftCareerFromNum :
                        (!isNaN(draftDraftClassNum) && draftDraftClassNum > 1900) ? draftDraftClassNum : year;
    const yearsPro = Math.max(0, year - draftCareerStart);
    let age = seasonData?.age;
    if (!age || typeof age !== 'number' || isNaN(age) || age < 18 || age > 45) {
      age = 22 + yearsPro;
    }
    // Always clamp to valid range
    age = Math.max(18, Math.min(45, age));

    console.log(`[database-handlers] Draft age calc for ${player.firstName} ${player.lastName}: year=${year}, careerFrom=${player.careerFrom}(${draftCareerFromNum}), draftClass=${player.draftClass}(${draftDraftClassNum}), careerStart=${draftCareerStart}, yearsPro=${yearsPro}, age=${age}`);

    // Check for stored PGHE data from database appearance edits
    // This allows users to assign specific generic faces in the database player card
    let storedPgheData: { pghe: number; pfcg: string; psxp: number; skinTone: number; genr: string } | null = null;
    let draftAppearanceEdit: ReturnType<typeof userDatabaseService.getAppearanceEdit> = undefined;

    try {
      draftAppearanceEdit = userDatabaseService.getAppearanceEdit(internalId);
      const appearanceEdit = draftAppearanceEdit; // Alias for backward compat

      // Check if appearance edit has VALID generic face data
      // IMPORTANT: PGHE=0 is NOT valid, must be > 0 to be a real face index
      // Also check for valid PFCG or gen_ PAM
      const hasDraftStoredGenericFace = appearanceEdit && (
        (appearanceEdit.maddenPghe !== undefined && appearanceEdit.maddenPghe > 0) ||
        (appearanceEdit.maddenPfcg && appearanceEdit.maddenPfcg.trim() !== '') ||
        (appearanceEdit.maddenPam && appearanceEdit.maddenPam.startsWith('gen_'))
      );

      if (hasDraftStoredGenericFace) {
        storedPgheData = {
          pghe: appearanceEdit.maddenPghe ?? 0,
          pfcg: appearanceEdit.maddenPfcg || '',
          psxp: appearanceEdit.maddenPid || 0,
          skinTone: appearanceEdit.maddenSkinTone || (appearanceEdit.maddenPfcg ? parseInt(appearanceEdit.maddenPfcg.charAt(0)) : 4) || 4,
          genr: appearanceEdit.maddenPam || (appearanceEdit.maddenPfcg ? `gen_${appearanceEdit.maddenPfcg}` : '')
        };
        console.log(`[database-handlers] Found VALID stored PGHE data for draft ${player.firstName} ${player.lastName}: PGHE=${storedPgheData.pghe}, PID=${storedPgheData.psxp}, skinTone=${storedPgheData.skinTone}, genr=${storedPgheData.genr}`);
      } else if (appearanceEdit) {
        console.log(`[database-handlers] Appearance edit exists but has no valid face data for ${player.firstName} ${player.lastName} - will use random generic face`);
      }
    } catch (pgheError) {
      console.warn(`[database-handlers] Could not get PGHE data for draft ${player.firstName} ${player.lastName}:`, pgheError);
      // Continue without PGHE data - player will get random generic face
    }

    // Determine PID and PAM - ALWAYS assign values, never leave blank
    let pid: number;
    let pam: string;
    let effectiveRace = player.race;
    let pgheIndex: number | undefined; // Track PGHE index for prospect

    // Check if player has valid PID and PAM
    const hasValidPID = !isEmptyPID(player.pid);
    const hasValidPAM = !isEmptyPAM(player.pam);

    if (hasValidPAM && typeof player.pam === 'string' && !player.pam.startsWith('gen_')) {
      // Player has a real face scan PAM
      pam = player.pam;
      pid = hasValidPID ? player.pid : 0;
    } else if (storedPgheData) {
      // Player has stored PGHE data from database - use it instead of random
      pid = storedPgheData.psxp;
      pam = ''; // Draft class uses blank PAM, face determined by PGHE/skinTone
      effectiveRace = storedPgheData.skinTone;
      pgheIndex = storedPgheData.pghe;
      console.log(`[database-handlers] Using stored PGHE face for ${player.firstName} ${player.lastName}: PID=${pid}, PGHE=${pgheIndex}, skinTone=${effectiveRace}`);
    } else {
      // Player needs generic face - determine race if unknown
      if (effectiveRace === undefined || effectiveRace === null) {
        // Try to look up race by PID
        if (player.pid && player.pid > 0) {
          effectiveRace = lookupService.getRaceByPID(player.pid);
        }
        // If still unknown, check career years for historical context
        // NFL was segregated until 1946 - players before then were white
        if (effectiveRace === undefined || effectiveRace === null) {
          // Use already-parsed career start from age calculation (draftCareerStart is reliable)
          console.log(`[database-handlers] Race check: draftCareerStart=${draftCareerStart}, player.careerFrom=${player.careerFrom}, player.draftClass=${player.draftClass}`);
          if (draftCareerStart && draftCareerStart > 1900 && draftCareerStart < 1946) {
            // Pre-integration era - NFL was all white
            effectiveRace = 1; // White
            console.log(`[database-handlers] Pre-1946 player, defaulting to white for ${player.firstName} ${player.lastName} (career start: ${draftCareerStart})`);
          } else {
            // Modern era - use NFL demographics (70% Black, 25% White, 5% Mixed)
            const rand = Math.random();
            effectiveRace = rand < 0.70 ? 7 : (rand < 0.95 ? 1 : 5);
          }
        }
        console.log(`[database-handlers] Assigned race ${effectiveRace} for draft prospect ${player.firstName} ${player.lastName}`);
      }
      // Set generic PAM so portrait shows (grid uses PEPS/PAM for portrait lookup)
      // Also get a generic PID for the draft file format
      pam = getGenericPAM(effectiveRace);
      pid = getGenericPID(effectiveRace);
      console.log(`[database-handlers] Assigned generic face: PAM='${pam}', PID=${pid}, race=${effectiveRace}`);
    }

    console.log(`[database-handlers] Draft PID/PAM for ${player.firstName} ${player.lastName}: PID=${pid}, PAM='${pam}', race=${effectiveRace}, pgheIndex=${pgheIndex ?? 'N/A'}`);

    // Get default archetype for position
    const defaultArchetype = DEFAULT_ARCHETYPES[positionName] || 0;

    // Parse archetype from season data ONLY if season position matches player position
    // If positions don't match, the season data is likely from a different player
    let archetypeId = defaultArchetype;
    if (seasonPositionMatches && seasonData?.archetype !== undefined && seasonData?.archetype !== null) {
      if (typeof seasonData.archetype === 'number') {
        archetypeId = seasonData.archetype;
      } else if (typeof seasonData.archetype === 'string') {
        const parsed = parseInt(seasonData.archetype, 10);
        archetypeId = isNaN(parsed) ? defaultArchetype : parsed;
      }
      console.log(`[database-handlers] Using season archetype ${archetypeId} (positions match)`);
    } else if (seasonData && !seasonPositionMatches) {
      console.log(`[database-handlers] Ignoring season archetype - position mismatch (player=${positionName}, season=${seasonData.position})`);
    }

    // Get archetype name from ID and position
    const archetypeName = ArchetypeService.getArchetypeName(archetypeId, positionName);
    console.log(`[database-handlers] Archetype: ID=${archetypeId}, name="${archetypeName}" (position=${positionName}, default=${defaultArchetype})`);

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

      // Race/skin tone - needed for grid display and face assignment
      race: effectiveRace,
      skinTone: storedPgheData ? storedPgheData.skinTone : getSkinToneFromRace(effectiveRace),

      // Player pic - 'Generic Face' for generic players, PAM for real players
      playerPic: (pam && !pam.startsWith('gen_')) ? pam : 'Generic Face',

      // Basic info - include both IDs and names for grid compatibility
      homeState: homeStateId,
      homeStateName: homeStateName,
      college: collegeId,
      collegeName: collegeName,
      age: age,
      heightInches: heightInches,
      weight: weight,

      // Position and role - include both ID and name
      position: positionId,
      positionName: positionName,
      archetype: archetypeId,
      archetypeName: archetypeName,
      jerseyNum: seasonData?.jersey || player.jersey || Math.floor(Math.random() * 99) + 1,

      // Draft info (from historical data)
      draftable: 1,
      draftPick: draftPick,
      draftRound: draftRound,

      // Development trait - check season data for dev trait, default to Normal
      // Look for devTrait in season data (may be stored as number or string)
      devTrait: getDevTraitFromSeasonData(seasonData),

      // Commentary ID for in-game announcer names
      // Priority: user edit > original CSV > lookup by name
      commentaryId: (() => {
        // First check user appearance edit
        if (draftAppearanceEdit?.maddenCommid) {
          const userCommId = parseInt(draftAppearanceEdit.maddenCommid) || 0;
          if (userCommId) {
            console.log(`[database-handlers] Using user-edited commentaryId for draft ${player.lastName}: ${userCommId}`);
            return userCommId;
          }
        }
        // Fall back to original CSV
        let commId = parseInt(player.commID) || 0;
        // Fall back to lookup by name
        if (!commId && player.lastName) {
          const lookedUp = lookupService.getCommentaryId(player.lastName);
          if (lookedUp !== null) {
            console.log(`[database-handlers] Auto-filled commentaryId for draft ${player.lastName}: ${lookedUp}`);
            commId = lookedUp;
          }
        }
        return commId;
      })(),

      // PGHE face picker index (if user assigned specific generic face in database)
      ...(pgheIndex !== undefined && { PGHE: pgheIndex }),

      // Visuals structure for M26
      visuals: {
        bodyType: getDraftBodyType(positionName, weight, heightInches),
        assetName: pam && !pam.startsWith('gen_') ? pam : null,
        genericHeadName: storedPgheData ? storedPgheData.genr : (pam.startsWith('gen_') ? pam : null),
        skinTone: storedPgheData ? storedPgheData.skinTone : getSkinToneFromRace(effectiveRace)
      }
    };

    // NOTE: devTrait is already set via getDevTraitFromSeasonData() above (line 1909)
    // No need to parse again here

    // Add ratings from season data if available, otherwise use defaults
    // NOTE: Database stores ratings with Madden field names (PSPD, PACC, etc.)
    if (seasonData && seasonData.ratings) {
      const r = seasonData.ratings;
      prospect.overall = r.POVR || 70;
      prospect.speed = r.PSPD || 70;
      prospect.acceleration = r.PACC || 70;
      prospect.strength = r.PSTR || 70;
      prospect.agility = r.PAGI || 70;
      prospect.awareness = r.PAWR || 70;
      prospect.jumping = r.PJMP || 70;
      prospect.stamina = r.PSTA || 85;
      prospect.changeOfDirection = r.PCOD || 70;
      prospect.toughness = r.PTGH || 70;
      prospect.injury = r.PINJ || 85;

      // Ball carrier
      prospect.carrying = r.PCAR || 70;
      prospect.ballCarrierVision = r.PBCV || 70;
      prospect.breakTackle = r.PBTK || 70;
      prospect.trucking = r.PTRK || 70;
      prospect.stiffArm = r.PSTF || 70;
      prospect.spinMove = r.PSPM || 70;
      prospect.jukeMove = r.PJUM || 70;

      // Receiving
      prospect.catching = r.PCTH || 70;
      prospect.catchInTraffic = r.PCIT || 70;
      prospect.spectacularCatch = r.PSPC || 70;
      prospect.shortRouteRunning = r.PSRR || 70;
      prospect.mediumRouteRunning = r.PMRR || 70;
      prospect.deepRouteRunning = r.PDRR || 70;
      prospect.release = r.PREL || 70;

      // Throwing
      prospect.throwPower = r.PTHP || 70;
      prospect.throwAccuracyShort = r.PTAS || 70;
      prospect.throwAccuracyMid = r.PTAM || 70;
      prospect.throwAccuracyDeep = r.PTAD || 70;
      prospect.throwOnTheRun = r.PTOR || 70;
      prospect.throwUnderPressure = r.PTUP || 70;
      prospect.playAction = r.PPLA || 70;
      prospect.breakSack = r.PBRS || 70;

      // Blocking
      prospect.passBlock = r.PPBK || 70;
      prospect.passBlockPower = r.PPBP || 70;
      prospect.passBlockFinesse = r.PPBF || 70;
      prospect.runBlock = r.PRBK || 70;
      prospect.runBlockPower = r.PRBP || 70;
      prospect.runBlockFinesse = r.PRBF || 70;
      prospect.leadBlock = r.PLDB || 70;
      prospect.impactBlocking = r.PIBL || 70;

      // Defense
      prospect.tackle = r.PTAK || 70;
      prospect.hitPower = r.PHTP || 70;
      prospect.powerMoves = r.PPWM || 70;
      prospect.finesseMoves = r.PFNM || 70;
      prospect.blockShedding = r.PBSH || 70;
      prospect.pursuit = r.PPUR || 70;
      prospect.playRecognition = r.PPRC || 70;
      prospect.manCoverage = r.PMCV || 70;
      prospect.zoneCoverage = r.PZCV || 70;
      prospect.pressCoverage = r.PPRS || 70;

      // Special teams
      prospect.kickPower = r.PKPW || 70;
      prospect.kickAccuracy = r.PKAC || 70;
      prospect.kickReturn = r.PKRT || 70;
      prospect.longSnap = 70;

      console.log(`[database-handlers] Loaded ratings from DB: SPD=${prospect.speed}, ACC=${prospect.acceleration}, STR=${prospect.strength}, OVR=${prospect.overall}`);
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

    // Sync archetype based on player attributes - ensures archetype matches what Madden will auto-assign
    const syncedProspect = ArchetypeSyncService.syncArchetypeFromAttributes(prospect, prospect.positionName || 'HB');
    syncedProspect.archetypeName = ArchetypeService.getArchetypeName(syncedProspect.archetype, prospect.positionName || 'HB');

    // Recalculate overall using proper Madden formula to ensure it matches game calculation
    if (ovrWeightsCalculator.isInitialized()) {
      // Convert prospect human-readable names to Madden field codes for OVR calculation
      const ovrAttributes: Record<string, number> = {
        PSPD: syncedProspect.speed || 70, PACC: syncedProspect.acceleration || 70,
        PAGI: syncedProspect.agility || 70, PSTR: syncedProspect.strength || 70,
        PAWR: syncedProspect.awareness || 70, PJMP: syncedProspect.jumping || 70,
        PSTA: syncedProspect.stamina || 85, PELU: syncedProspect.changeOfDirection || 70,
        PTGH: syncedProspect.toughness || 70, PINJ: syncedProspect.injury || 85,
        PCAR: syncedProspect.carrying || 70, PBCV: syncedProspect.ballCarrierVision || 70,
        PBKT: syncedProspect.breakTackle || 70, PLTR: syncedProspect.trucking || 70,
        PLSA: syncedProspect.stiffArm || 70, PLSM: syncedProspect.spinMove || 70,
        PLJM: syncedProspect.jukeMove || 70, PCTH: syncedProspect.catching || 70,
        PLCI: syncedProspect.catchInTraffic || 70, PLSC: syncedProspect.spectacularCatch || 70,
        SRRN: syncedProspect.shortRouteRunning || 70, PMRR: syncedProspect.mediumRouteRunning || 70,
        PDRR: syncedProspect.deepRouteRunning || 70, PLRL: syncedProspect.release || 70,
        PTHP: syncedProspect.throwPower || 70, PTAS: syncedProspect.throwAccuracyShort || 70,
        PTAM: syncedProspect.throwAccuracyMid || 70, PTAD: syncedProspect.throwAccuracyDeep || 70,
        PTOR: syncedProspect.throwOnTheRun || 70, PTUP: syncedProspect.throwUnderPressure || 70,
        PPLA: syncedProspect.playAction || 70, PBSK: syncedProspect.breakSack || 70,
        PPBK: syncedProspect.passBlock || 70, PPBS: syncedProspect.passBlockPower || 70,
        PPBF: syncedProspect.passBlockFinesse || 70, PRBK: syncedProspect.runBlock || 70,
        PRBS: syncedProspect.runBlockPower || 70, PRBF: syncedProspect.runBlockFinesse || 70,
        PLBK: syncedProspect.leadBlock || 70, PLIB: syncedProspect.impactBlocking || 70,
        PTAK: syncedProspect.tackle || 70, PLHT: syncedProspect.hitPower || 70,
        PLPM: syncedProspect.powerMoves || 70, PFMS: syncedProspect.finesseMoves || 70,
        PBSG: syncedProspect.blockShedding || 70, PLPU: syncedProspect.pursuit || 70,
        PLPR: syncedProspect.playRecognition || 70, PLMC: syncedProspect.manCoverage || 70,
        PLZC: syncedProspect.zoneCoverage || 70, PLPE: syncedProspect.pressCoverage || 70,
        PKPW: syncedProspect.kickPower || 70, PKAC: syncedProspect.kickAccuracy || 70,
        PKRT: syncedProspect.kickReturn || 70
      };
      const calculatedOvr = ovrWeightsCalculator.calculateOVR(ovrAttributes, prospect.positionName || 'HB', syncedProspect.archetype, true);
      // Floor of 40 for database players (quality control)
      syncedProspect.overall = Math.max(40, Math.min(99, calculatedOvr));
      console.log(`[database-handlers] Draft OVR recalculated via OVRWeightsCalculator: ${syncedProspect.overall}`);
    }

    // Debug log what we're returning
    console.log(`[database-handlers] FINAL prospect data for ${player.firstName} ${player.lastName}:`);
    console.log(`  college: ${prospect.college} (ID), collegeName: "${prospect.collegeName}"`);
    console.log(`  homeState: ${prospect.homeState} (ID), homeStateName: "${prospect.homeStateName}"`);
    console.log(`  position: ${prospect.position} (ID), positionName: "${prospect.positionName}"`);
    console.log(`  archetype: ${prospect.archetype} (ID), archetypeName: "${prospect.archetypeName}"`);
    console.log(`  devTrait: ${prospect.devTrait}`);
    console.log(`  PID: ${prospect.PID}, PEPS: "${prospect.PEPS}"`);
    console.log(`  visuals: skinTone=${prospect.visuals?.skinTone}, genericHeadName="${prospect.visuals?.genericHeadName}"`);

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
    // FIX: Handle pre-1970 players that may have careerFrom/careerTo or draftClass
    if (availableYears.length === 0) {
      // Try to get career span
      const careerFromNum = typeof player.careerFrom === 'number' ? player.careerFrom :
                            (typeof player.careerFrom === 'string' ? parseInt(player.careerFrom, 10) : NaN);
      const careerToNum = typeof player.careerTo === 'number' ? player.careerTo :
                          (typeof player.careerTo === 'string' ? parseInt(player.careerTo, 10) : NaN);
      const draftClassNum = player.draftClass ? parseInt(String(player.draftClass), 10) : NaN;

      if (!isNaN(careerFromNum) && careerFromNum > 1900 && !isNaN(careerToNum) && careerToNum > 1900) {
        // Have full career span
        for (let y = careerToNum; y >= careerFromNum; y--) {
          availableYears.push(y);
        }
      } else if (!isNaN(draftClassNum) && draftClassNum > 1900) {
        // Only have draft year - assume 10-year career starting at draft
        const startYear = draftClassNum;
        const endYear = startYear + 10;
        for (let y = endYear; y >= startYear; y--) {
          availableYears.push(y);
        }
        console.log(`[database-handlers] Created years from draftClass ${draftClassNum}: ${availableYears.length} years`);
      } else if (!isNaN(careerFromNum) && careerFromNum > 1900) {
        // Only have career start - assume 10-year career
        const startYear = careerFromNum;
        const endYear = startYear + 10;
        for (let y = endYear; y >= startYear; y--) {
          availableYears.push(y);
        }
        console.log(`[database-handlers] Created years from careerFrom ${careerFromNum}: ${availableYears.length} years`);
      }
    }

    // Final fallback - use current year if still empty
    if (availableYears.length === 0) {
      console.warn(`[database-handlers] No years found for ${player.firstName} ${player.lastName}, using current year`);
      availableYears.push(new Date().getFullYear());
    }

    return {
      success: true,
      years: availableYears,
      defaultYear: availableYears[0],
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

/**
 * Handle: database:save-player-bio
 * Save bio/appearance info from roster/draft class editor
 * Matches player by name + draft year, then saves to appropriate tables
 */
ipcMain.handle('database:save-player-bio', async (event, playerData: {
  firstName: string;
  lastName: string;
  draftYear: number;
  pid?: number;
  pam?: string;
  race?: number;
  bodyType?: string;
  handedness?: number;
  height?: number;
  weight?: number;
  college?: number;
  homeState?: number;
}) => {
  console.log('[database-handlers] save-player-bio: IPC HANDLER CALLED');
  console.log('[database-handlers] save-player-bio: Received data:', JSON.stringify(playerData, null, 2));

  try {
    console.log('[database-handlers] save-player-bio: Waiting for services...');
    await userDatabaseService.waitForReady();
    await lookupService.waitForReady();
    console.log('[database-handlers] save-player-bio: Services ready');

    console.log(`[database-handlers] save-player-bio: Looking for ${playerData.firstName} ${playerData.lastName} (${playerData.draftYear})`);
    console.log(`[database-handlers] save-player-bio: Data received:`, JSON.stringify(playerData, null, 2));

    // Find player by name + draft year
    const player = lookupService.findPlayerByNameAndYear(
      playerData.firstName,
      playerData.lastName,
      playerData.draftYear
    );

    if (!player) {
      console.log(`[database-handlers] save-player-bio: Player not found`);
      return { success: false, error: `Player "${playerData.firstName} ${playerData.lastName}" from ${playerData.draftYear} not found in database` };
    }

    console.log(`[database-handlers] save-player-bio: Found player with internalId=${player.internalId}`);

    // Save appearance data (PID, PAM) if provided
    if (playerData.pid !== undefined || playerData.pam !== undefined) {
      userDatabaseService.saveAppearanceEdit(player.internalId, {
        maddenPid: playerData.pid,
        maddenPam: playerData.pam
      });
      console.log(`[database-handlers] save-player-bio: Saved appearance (PID=${playerData.pid}, PAM=${playerData.pam})`);
    }

    // Save bio data if any provided
    const hasBioData = playerData.race !== undefined || playerData.bodyType !== undefined ||
                       playerData.handedness !== undefined || playerData.height !== undefined ||
                       playerData.weight !== undefined || playerData.college !== undefined ||
                       playerData.homeState !== undefined;
    if (hasBioData) {
      const bioToSave = {
        race: playerData.race,
        bodyType: playerData.bodyType,
        handedness: playerData.handedness,
        height: playerData.height,
        weight: playerData.weight,
        collegeId: playerData.college,
        homeState: playerData.homeState !== undefined ? String(playerData.homeState) : undefined
      };
      console.log(`[database-handlers] save-player-bio: Saving bio data:`, JSON.stringify(bioToSave, null, 2));
      userDatabaseService.savePlayerEdit(player.internalId, bioToSave);
      console.log(`[database-handlers] save-player-bio: Bio data saved successfully`);
    }

    console.log(`[database-handlers] save-player-bio: SUCCESS - returning { success: true, playerId: ${player.internalId} }`);
    return { success: true, playerId: player.internalId };
  } catch (error) {
    console.error('[database-handlers] Error saving player bio:', error);
    return { success: false, error: String(error) };
  }
});

/**
 * Handle: database:debug-warren-moon
 * Debug handler to test Warren Moon's lookup specifically
 */
ipcMain.handle('database:debug-warren-moon', async () => {
  try {
    await lookupService.waitForReady();
    await userDatabaseService.waitForReady();

    const results: any = {};

    // Search for Warren Moon
    const searchResults = lookupService.searchPlayers('Warren Moon', 5);
    results.searchResults = searchResults.map(p => ({
      internalId: p.internalId,
      firstName: p.firstName,
      lastName: p.lastName,
      position: p.position,
      pid: p.pid
    }));

    // Find Warren Moon specifically
    const warrenMoon = searchResults.find(p =>
      p.firstName === 'Warren' && p.lastName === 'Moon' && p.position === 'QB'
    );

    if (warrenMoon) {
      results.warrenMoonId = warrenMoon.internalId;

      // Get season years
      const years = lookupService.getPlayerSeasonYears(warrenMoon.internalId);
      results.seasonYears = years;

      // Get 1992 season data
      const season1992 = lookupService.getPlayerSeasonByInternalId(warrenMoon.internalId, 1992);
      results.season1992 = season1992 ? {
        playerId: season1992.playerId,
        year: season1992.year,
        team: season1992.team,
        position: season1992.position,
        jersey: season1992.jersey,
        age: season1992.age,
        POVR: season1992.ratings?.POVR
      } : null;

      // Check if seasons are cleared
      results.seasonsCleared = userDatabaseService.areSeasonsCleared(warrenMoon.internalId);
    }

    console.log('[database-handlers] debug-warren-moon result:', JSON.stringify(results, null, 2));
    return { success: true, data: results };
  } catch (error) {
    console.error('[database-handlers] debug-warren-moon error:', error);
    return { success: false, error: String(error) };
  }
});

// =============================================
// INTER-WINDOW COMMUNICATION
// =============================================

/**
 * Handle: database:send-player-to-main
 * Send a player from the database browser to the main editor window
 * This enables the bulk add feature when database browser is a separate window
 */
ipcMain.handle('database:send-player-to-main', async (event, internalId: number, target: 'roster' | 'draft', options?: { teamId?: number; year?: number | null }) => {
  try {
    console.log(`[database-handlers] Sending player ${internalId} (type: ${typeof internalId}) to ${target} with options:`, options);

    // Validate internalId
    if (internalId === undefined || internalId === null) {
      console.error('[database-handlers] ERROR: Received undefined/null internalId from database browser!');
      return { success: false, error: 'Invalid player ID: no ID provided' };
    }

    // Ensure it's a valid number
    const numericId = Number(internalId);
    if (isNaN(numericId) || numericId <= 0) {
      console.error('[database-handlers] ERROR: Invalid internalId received:', internalId, '-> numericId:', numericId);
      return { success: false, error: `Invalid player ID: ${internalId}` };
    }

    // Find the main window (the one that's not the database browser)
    const allWindows = BrowserWindow.getAllWindows();
    const senderWindow = BrowserWindow.fromWebContents(event.sender);

    // Find the main window - it's the one with index.html loaded (not database-browser.html)
    const mainWindow = allWindows.find(win => {
      const url = win.webContents.getURL();
      return win !== senderWindow && (url.includes('index.html') || (!url.includes('database-browser') && !url.includes('franchise-editor')));
    });

    if (!mainWindow) {
      console.warn('[database-handlers] Main window not found');
      return { success: false, error: 'Main editor window not found. Please open the editor first.' };
    }

    // Send the player to the main window using validated numeric ID
    console.log(`[database-handlers] Forwarding validated player ID ${numericId} to main window`);
    mainWindow.webContents.send('database:player-from-browser', numericId, target, options);

    return { success: true };
  } catch (error) {
    console.error('[database-handlers] Error sending player to main:', error);
    return { success: false, error: String(error) };
  }
});

// =============================================
// DRAFT CLASS PUSH OPERATIONS
// =============================================

/**
 * Handle: database:analyze-draft-class-push
 * Analyze a draft class for pushing to the database
 * Returns categorized prospects (new/existing) and conflicts
 */
ipcMain.handle('database:analyze-draft-class-push', async (event, prospects: any[], draftYear: number) => {
  try {
    console.log(`[database-handlers] Analyzing draft class push: ${prospects.length} prospects for year ${draftYear}`);
    await userDatabaseService.waitForReady();
    const analysis = await draftClassDatabaseService.analyzeForPush(prospects, draftYear);
    return { success: true, analysis };
  } catch (error) {
    console.error('[database-handlers] Error analyzing draft class push:', error);
    return { success: false, error: String(error) };
  }
});

/**
 * Handle: database:execute-draft-class-push
 * Execute the push of draft class data to the database
 * Uses analysis results and user-resolved conflicts
 */
ipcMain.handle('database:execute-draft-class-push', async (
  event,
  analysis: PushAnalysisResult,
  resolutions: FieldResolution[],
  options?: {
    overwriteExistingSeasons?: boolean;
    fillEmptyBioFields?: boolean;
    pushMode?: 'all' | 'ratings';
    bioFieldOptions?: Record<string, boolean>;
  }
) => {
  try {
    console.log(`[database-handlers] Executing draft class push for year ${analysis.draftYear}`);
    console.log(`[database-handlers] Push mode: ${options?.pushMode}, bio options:`, options?.bioFieldOptions);
    await userDatabaseService.waitForReady();
    const result = await draftClassDatabaseService.executePush(analysis, resolutions, options);
    return { success: true, result };
  } catch (error) {
    console.error('[database-handlers] Error executing draft class push:', error);
    return { success: false, error: String(error) };
  }
});

// =============================================
// ROSTER PUSH OPERATIONS
// =============================================

/**
 * Handle: database:analyze-roster-push
 * Analyze a roster for pushing to the database
 * Returns categorized players (new/existing) and conflicts
 */
ipcMain.handle('database:analyze-roster-push', async (event, players: any[], seasonYear: number) => {
  try {
    console.log(`[database-handlers] Analyzing roster push: ${players.length} players for year ${seasonYear}`);
    await userDatabaseService.waitForReady();
    const analysis = await rosterDatabaseService.analyzeForPush(players, seasonYear);
    return { success: true, analysis };
  } catch (error) {
    console.error('[database-handlers] Error analyzing roster push:', error);
    return { success: false, error: String(error) };
  }
});

/**
 * Handle: database:execute-roster-push
 * Execute the push of roster data to the database
 * Uses analysis results and user-resolved conflicts
 */
ipcMain.handle('database:execute-roster-push', async (
  event,
  analysis: RosterPushAnalysisResult,
  resolutions: RosterFieldResolution[],
  options?: { overwriteExistingSeasons?: boolean; fillEmptyBioFields?: boolean }
) => {
  try {
    console.log(`[database-handlers] Executing roster push for year ${analysis.seasonYear}`);
    await userDatabaseService.waitForReady();
    const result = await rosterDatabaseService.executePush(analysis, resolutions, options);
    return { success: true, result };
  } catch (error) {
    console.error('[database-handlers] Error executing roster push:', error);
    return { success: false, error: String(error) };
  }
});

// =============================================
// CAREER STATS OPERATIONS (PFR Scraped Data)
// =============================================

// Career stats database connection (lazy initialized)
let careerStatsDb: Database.Database | null = null;

function getCareerStatsDb(): Database.Database | null {
  if (careerStatsDb) return careerStatsDb;

  try {
    // Find the career stats database
    const possiblePaths = [
      path.join(app.getAppPath(), 'data', 'player-career-stats.db'),
      path.join(__dirname, '..', '..', 'data', 'player-career-stats.db'),
      path.join(process.cwd(), 'data', 'player-career-stats.db'),
    ];

    const fs = require('fs');
    let dbPath: string | null = null;

    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        dbPath = p;
        break;
      }
    }

    if (!dbPath) {
      console.warn('[database-handlers] Career stats database not found');
      return null;
    }

    console.log('[database-handlers] Opening career stats database:', dbPath);
    careerStatsDb = new Database(dbPath, { readonly: true });
    return careerStatsDb;
  } catch (error) {
    console.error('[database-handlers] Error opening career stats database:', error);
    return null;
  }
}

/**
 * Handle: database:get-career-stats
 * Get all career stats for a player by name from the PFR scraped database
 * Optional draftYear parameter helps disambiguate players with the same name
 */
ipcMain.handle('database:get-career-stats', async (event, firstName: string, lastName: string, draftYear?: number) => {
  try {
    const db = getCareerStatsDb();
    if (!db) {
      return { success: false, error: 'Career stats database not available' };
    }

    console.log(`[database-handlers] Getting career stats for ${firstName} ${lastName}${draftYear ? ` (draft ${draftYear})` : ''}`);

    // First find the player's PFR ID
    // If draftYear is provided, use it to disambiguate players with the same name
    // (e.g., Chris Johnson WR 2005 vs Chris Johnson RB 2008)
    let player: any;
    if (draftYear) {
      // Use from_year to match draft year (from_year is typically their first NFL season)
      const playerQuery = db.prepare(`
        SELECT pfr_id, position, from_year, to_year, is_hof
        FROM players
        WHERE first_name = ? AND last_name = ?
        AND (from_year = ? OR from_year = ? OR from_year = ?)
        LIMIT 1
      `);
      // Check draft year and adjacent years since from_year may differ slightly
      player = playerQuery.get(firstName, lastName, draftYear, draftYear - 1, draftYear + 1) as any;

      // If no match with draft year, fall back to name-only search
      if (!player) {
        console.log(`[database-handlers] No match with draft year ${draftYear}, falling back to name search`);
        const fallbackQuery = db.prepare(`
          SELECT pfr_id, position, from_year, to_year, is_hof
          FROM players
          WHERE first_name = ? AND last_name = ?
          LIMIT 1
        `);
        player = fallbackQuery.get(firstName, lastName) as any;
      }
    } else {
      const playerQuery = db.prepare(`
        SELECT pfr_id, position, from_year, to_year, is_hof
        FROM players
        WHERE first_name = ? AND last_name = ?
        LIMIT 1
      `);
      player = playerQuery.get(firstName, lastName) as any;
    }

    if (!player) {
      console.log(`[database-handlers] No career stats found for ${firstName} ${lastName}`);
      return { success: true, stats: [], player: null };
    }

    // Get all season stats for this player
    const statsQuery = db.prepare(`
      SELECT
        year, team, games, games_started,
        pass_cmp, pass_att, pass_yds, pass_td, pass_int, pass_rating,
        rush_att, rush_yds, rush_td,
        rec, rec_yds, rec_td,
        tackles, sacks, def_int, ff, fr
      FROM player_season_stats
      WHERE pfr_id = ?
      ORDER BY year ASC
    `);
    const stats = statsQuery.all(player.pfr_id) as any[];

    console.log(`[database-handlers] Found ${stats.length} seasons for ${firstName} ${lastName}`);

    return {
      success: true,
      stats,
      player: {
        pfrId: player.pfr_id,
        position: player.position,
        fromYear: player.from_year,
        toYear: player.to_year,
        isHof: player.is_hof === 1
      }
    };
  } catch (error) {
    console.error('[database-handlers] Error getting career stats:', error);
    return { success: false, error: String(error) };
  }
});

/**
 * Handle: database:get-career-stats-by-year
 * Get career stats for a specific year from the PFR scraped database
 */
ipcMain.handle('database:get-career-stats-by-year', async (event, firstName: string, lastName: string, year: number) => {
  try {
    const db = getCareerStatsDb();
    if (!db) {
      return { success: false, error: 'Career stats database not available' };
    }

    console.log(`[database-handlers] Getting career stats for ${firstName} ${lastName} year ${year}`);

    // First find the player's PFR ID
    const playerQuery = db.prepare(`
      SELECT pfr_id FROM players
      WHERE first_name = ? AND last_name = ?
      LIMIT 1
    `);
    const player = playerQuery.get(firstName, lastName) as any;

    if (!player) {
      return { success: true, stats: null };
    }

    // Get stats for this specific year
    const statsQuery = db.prepare(`
      SELECT
        year, team, games, games_started,
        pass_cmp, pass_att, pass_yds, pass_td, pass_int, pass_rating,
        rush_att, rush_yds, rush_td,
        rec, rec_yds, rec_td,
        tackles, sacks, def_int, ff, fr
      FROM player_season_stats
      WHERE pfr_id = ? AND year = ?
      LIMIT 1
    `);
    const stats = statsQuery.get(player.pfr_id, year) as any;

    return { success: true, stats };
  } catch (error) {
    console.error('[database-handlers] Error getting career stats by year:', error);
    return { success: false, error: String(error) };
  }
});

/**
 * Handle: database:calculate-rating-from-stats
 * Calculate Madden ratings based on career stats for a given position
 * This is a simplified formula - can be expanded based on position
 */
ipcMain.handle('database:calculate-rating-from-stats', async (event, stats: any, position: string) => {
  try {
    if (!stats) {
      return { success: false, error: 'No stats provided' };
    }

    console.log(`[database-handlers] Calculating ratings from stats for position ${position}`);

    const pos = position?.toUpperCase() || '';
    const ratings: Record<string, number> = {};

    // Base overall calculation depends on position
    if (pos === 'QB') {
      // QB ratings based on passing stats
      const passRating = stats.pass_rating || 0;
      const passYards = stats.pass_yds || 0;
      const passTD = stats.pass_td || 0;
      const passInt = stats.pass_int || 0;
      const games = stats.games || 1;

      // Throw Power: Based on yards per game
      const yardsPerGame = passYards / games;
      ratings.PTHP = Math.min(99, Math.max(60, Math.round(70 + yardsPerGame / 25)));

      // Throw Accuracy Short/Medium/Deep - scaled from passer rating
      const accBase = Math.min(99, Math.max(50, Math.round(passRating * 0.9)));
      ratings.PTAS = Math.min(99, accBase + 5);  // Short accuracy slightly higher
      ratings.PTAM = accBase;
      ratings.PTAD = Math.max(50, accBase - 8);  // Deep accuracy slightly lower

      // Throw Under Pressure - based on TD/INT ratio
      const tdIntRatio = passInt > 0 ? passTD / passInt : passTD;
      ratings.PTUP = Math.min(99, Math.max(50, Math.round(50 + tdIntRatio * 8)));

      // Throw on Run
      ratings.PTOR = Math.min(95, Math.max(55, Math.round(60 + passRating / 5)));

      // Overall estimate
      ratings.POVR = Math.min(99, Math.max(40, Math.round(
        (ratings.PTHP * 0.15) +
        (ratings.PTAS * 0.25) +
        (ratings.PTAM * 0.25) +
        (ratings.PTAD * 0.15) +
        (ratings.PTUP * 0.1) +
        (ratings.PTOR * 0.1)
      )));

    } else if (pos === 'HB' || pos === 'RB' || pos === 'FB') {
      // RB ratings based on rushing/receiving stats
      const rushYards = stats.rush_yds || 0;
      const rushAtt = stats.rush_att || 1;
      const rushTD = stats.rush_td || 0;
      const rec = stats.rec || 0;
      const recYds = stats.rec_yds || 0;
      const games = stats.games || 1;

      const ypc = rushYards / rushAtt;
      const yardsPerGame = rushYards / games;

      // Speed: Based on yards per carry and big play potential
      ratings.PSPD = Math.min(99, Math.max(70, Math.round(75 + ypc * 3)));

      // Acceleration
      ratings.PACC = Math.min(99, Math.max(70, Math.round(73 + ypc * 3.5)));

      // Agility
      ratings.PAGI = Math.min(99, Math.max(65, Math.round(70 + ypc * 4)));

      // Carrying
      ratings.PCAR = Math.min(99, Math.max(65, Math.round(75 + rushTD / 2)));

      // Break Tackle
      ratings.PBKT = Math.min(99, Math.max(60, Math.round(65 + yardsPerGame / 8)));

      // Catching (if they have receptions)
      if (rec > 0) {
        ratings.PCTH = Math.min(99, Math.max(50, Math.round(60 + rec / 2)));
      }

      // Overall estimate
      ratings.POVR = Math.min(99, Math.max(40, Math.round(
        (ratings.PSPD * 0.2) +
        (ratings.PACC * 0.15) +
        (ratings.PAGI * 0.15) +
        (ratings.PCAR * 0.25) +
        (ratings.PBKT * 0.15) +
        ((ratings.PCTH || 60) * 0.1)
      )));

    } else if (pos === 'WR' || pos === 'TE') {
      // WR/TE ratings based on receiving stats
      const rec = stats.rec || 0;
      const recYds = stats.rec_yds || 0;
      const recTD = stats.rec_td || 0;
      const games = stats.games || 1;

      const ypr = rec > 0 ? recYds / rec : 0;
      const recPerGame = rec / games;

      // Catching
      ratings.PCTH = Math.min(99, Math.max(60, Math.round(70 + recPerGame * 2)));

      // Catch in Traffic
      ratings.PCIT = Math.min(99, Math.max(55, Math.round(65 + recTD / 2)));

      // Spectacular Catch
      ratings.PSPC = Math.min(99, Math.max(50, Math.round(60 + ypr / 2)));

      // Short Route Running
      ratings.PSRR = Math.min(99, Math.max(60, Math.round(65 + recPerGame * 2.5)));

      // Medium Route Running
      ratings.PMRR = Math.min(99, Math.max(55, Math.round(60 + recPerGame * 2)));

      // Deep Route Running
      ratings.PDRR = Math.min(99, Math.max(50, Math.round(55 + ypr / 1.5)));

      // Release
      ratings.PREL = Math.min(99, Math.max(55, Math.round(65 + recPerGame * 2)));

      // Overall estimate
      ratings.POVR = Math.min(99, Math.max(40, Math.round(
        (ratings.PCTH * 0.25) +
        (ratings.PCIT * 0.15) +
        (ratings.PSPC * 0.1) +
        (ratings.PSRR * 0.15) +
        (ratings.PMRR * 0.15) +
        (ratings.PDRR * 0.1) +
        (ratings.PREL * 0.1)
      )));

    } else if (pos.includes('LB') || pos === 'SAM' || pos === 'MIKE' || pos === 'WILL') {
      // Linebacker ratings
      const tackles = stats.tackles || 0;
      const sacks = stats.sacks || 0;
      const defInt = stats.def_int || 0;
      const ff = stats.ff || 0;
      const games = stats.games || 1;

      const tacklesPerGame = tackles / games;

      // Tackle
      ratings.PTAK = Math.min(99, Math.max(65, Math.round(70 + tacklesPerGame * 1.5)));

      // Hit Power
      ratings.PHTP = Math.min(99, Math.max(60, Math.round(65 + ff * 3 + sacks * 2)));

      // Block Shedding
      ratings.PBSH = Math.min(99, Math.max(55, Math.round(60 + tacklesPerGame)));

      // Power/Finesse Moves (for pass rushers)
      ratings.PPWM = Math.min(99, Math.max(50, Math.round(55 + sacks * 3)));
      ratings.PFNM = Math.min(99, Math.max(50, Math.round(55 + sacks * 2.5)));

      // Zone Coverage
      ratings.PZCV = Math.min(99, Math.max(50, Math.round(55 + defInt * 5)));

      // Overall estimate
      ratings.POVR = Math.min(99, Math.max(40, Math.round(
        (ratings.PTAK * 0.25) +
        (ratings.PHTP * 0.15) +
        (ratings.PBSH * 0.2) +
        (ratings.PPWM * 0.1) +
        (ratings.PFNM * 0.1) +
        (ratings.PZCV * 0.2)
      )));

    } else if (pos === 'CB' || pos === 'FS' || pos === 'SS' || pos === 'S' || pos === 'DB') {
      // Defensive back ratings
      const tackles = stats.tackles || 0;
      const defInt = stats.def_int || 0;
      const ff = stats.ff || 0;
      const games = stats.games || 1;

      const tacklesPerGame = tackles / games;

      // Man Coverage
      ratings.PMCV = Math.min(99, Math.max(55, Math.round(65 + defInt * 4)));

      // Zone Coverage
      ratings.PZCV = Math.min(99, Math.max(55, Math.round(65 + defInt * 3.5)));

      // Press
      ratings.PPRS = Math.min(99, Math.max(50, Math.round(60 + tacklesPerGame)));

      // Tackle
      ratings.PTAK = Math.min(99, Math.max(55, Math.round(60 + tacklesPerGame * 1.2)));

      // Hit Power
      ratings.PHTP = Math.min(99, Math.max(45, Math.round(55 + ff * 5)));

      // Overall estimate
      ratings.POVR = Math.min(99, Math.max(40, Math.round(
        (ratings.PMCV * 0.3) +
        (ratings.PZCV * 0.25) +
        (ratings.PPRS * 0.15) +
        (ratings.PTAK * 0.2) +
        (ratings.PHTP * 0.1)
      )));

    } else if (pos === 'DE' || pos === 'LEDG' || pos === 'REDG' || pos === 'DT' || pos === 'NT') {
      // Defensive line ratings
      const tackles = stats.tackles || 0;
      const sacks = stats.sacks || 0;
      const ff = stats.ff || 0;
      const games = stats.games || 1;

      const tacklesPerGame = tackles / games;
      const sacksPerGame = sacks / games;

      // Power Move
      ratings.PPWM = Math.min(99, Math.max(55, Math.round(60 + sacks * 2)));

      // Finesse Move
      ratings.PFNM = Math.min(99, Math.max(50, Math.round(55 + sacksPerGame * 8)));

      // Block Shedding
      ratings.PBSH = Math.min(99, Math.max(55, Math.round(60 + tacklesPerGame * 1.5)));

      // Tackle
      ratings.PTAK = Math.min(99, Math.max(60, Math.round(65 + tacklesPerGame)));

      // Hit Power
      ratings.PHTP = Math.min(99, Math.max(55, Math.round(60 + ff * 4 + sacks)));

      // Overall estimate
      ratings.POVR = Math.min(99, Math.max(40, Math.round(
        (ratings.PPWM * 0.25) +
        (ratings.PFNM * 0.2) +
        (ratings.PBSH * 0.2) +
        (ratings.PTAK * 0.2) +
        (ratings.PHTP * 0.15)
      )));

    } else {
      // Generic fallback - just calculate a basic overall
      const games = stats.games || 1;
      ratings.POVR = Math.min(99, Math.max(40, Math.round(60 + (stats.games_started || 0) / games * 15)));
    }

    // Use OVRWeightsCalculator for proper POVR calculation (matches game formula)
    if (ovrWeightsCalculator.isInitialized()) {
      const calculatedOvr = ovrWeightsCalculator.calculateOVR(ratings, position);
      // Floor of 40 for database-generated players (quality control)
      ratings.POVR = Math.max(40, Math.min(99, calculatedOvr));
      console.log(`[database-handlers] OVR recalculated via OVRWeightsCalculator: ${ratings.POVR}`);
    }

    console.log(`[database-handlers] Calculated ratings:`, ratings);

    return { success: true, ratings };
  } catch (error) {
    console.error('[database-handlers] Error calculating rating from stats:', error);
    return { success: false, error: String(error) };
  }
});

console.log('[database-handlers] Registered all database IPC handlers');
