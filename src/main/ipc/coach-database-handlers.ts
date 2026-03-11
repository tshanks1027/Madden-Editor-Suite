/**
 * Coach Database IPC Handlers
 *
 * IPC handlers for coach database operations.
 * Provides access to edit/create coach data in the user overlay database.
 */

import { ipcMain } from 'electron';
import {
  userDatabaseService,
  CoachEdit,
  CoachAppearanceEdit,
  CoachSeasonEdit,
  CustomCoach,
  CustomCoachSeason
} from '../services/UserDatabaseService';
import { lookupService, CoachLookupEntry } from '../services/lookup-service';

// =============================================
// COACH EDIT OPERATIONS
// =============================================

/**
 * Handle: coach-database:save-coach-edit
 * Save edits to an existing coach from the original database
 */
ipcMain.handle('coach-database:save-coach-edit', async (event, originalId: number, edits: Partial<CoachEdit>) => {
  try {
    await userDatabaseService.waitForReady();
    userDatabaseService.saveCoachEdit(originalId, edits);
    return { success: true };
  } catch (error) {
    console.error('[coach-database-handlers] Error saving coach edit:', error);
    return { success: false, error: String(error) };
  }
});

/**
 * Handle: coach-database:get-coach-edit
 * Get edits for a coach (returns null if no edits exist)
 */
ipcMain.handle('coach-database:get-coach-edit', async (event, originalId: number) => {
  try {
    await userDatabaseService.waitForReady();
    return { success: true, data: userDatabaseService.getCoachEdit(originalId) };
  } catch (error) {
    console.error('[coach-database-handlers] Error getting coach edit:', error);
    return { success: false, error: String(error) };
  }
});

/**
 * Handle: coach-database:has-coach-edit
 * Check if a coach has any edits
 */
ipcMain.handle('coach-database:has-coach-edit', async (event, originalId: number) => {
  try {
    await userDatabaseService.waitForReady();
    return { success: true, hasEdit: userDatabaseService.hasCoachEdit(originalId) };
  } catch (error) {
    console.error('[coach-database-handlers] Error checking coach edit:', error);
    return { success: false, error: String(error) };
  }
});

/**
 * Handle: coach-database:reset-coach
 * Reset all edits for a single coach
 */
ipcMain.handle('coach-database:reset-coach', async (event, originalId: number) => {
  try {
    await userDatabaseService.waitForReady();
    userDatabaseService.resetCoach(originalId);
    return { success: true };
  } catch (error) {
    console.error('[coach-database-handlers] Error resetting coach:', error);
    return { success: false, error: String(error) };
  }
});

// =============================================
// COACH APPEARANCE EDIT OPERATIONS
// =============================================

/**
 * Handle: coach-database:save-appearance-edit
 * Save appearance edits (PID, PAM) for a coach
 */
ipcMain.handle('coach-database:save-appearance-edit', async (event, originalCoachId: number, edits: Partial<CoachAppearanceEdit>) => {
  try {
    await userDatabaseService.waitForReady();
    userDatabaseService.saveCoachAppearanceEdit(originalCoachId, edits);
    return { success: true };
  } catch (error) {
    console.error('[coach-database-handlers] Error saving appearance edit:', error);
    return { success: false, error: String(error) };
  }
});

/**
 * Handle: coach-database:get-appearance-edit
 * Get appearance edits for a coach
 */
ipcMain.handle('coach-database:get-appearance-edit', async (event, originalCoachId: number) => {
  try {
    await userDatabaseService.waitForReady();
    return { success: true, data: userDatabaseService.getCoachAppearanceEdit(originalCoachId) };
  } catch (error) {
    console.error('[coach-database-handlers] Error getting appearance edit:', error);
    return { success: false, error: String(error) };
  }
});

// =============================================
// COACH SEASON EDIT OPERATIONS
// =============================================

/**
 * Handle: coach-database:save-season-edit
 * Save edits for a coach's specific season
 */
ipcMain.handle('coach-database:save-season-edit', async (event, originalCoachId: number, year: number, edits: Partial<CoachSeasonEdit>) => {
  try {
    await userDatabaseService.waitForReady();
    userDatabaseService.saveCoachSeasonEdit(originalCoachId, year, edits);
    return { success: true };
  } catch (error) {
    console.error('[coach-database-handlers] Error saving season edit:', error);
    return { success: false, error: String(error) };
  }
});

/**
 * Handle: coach-database:get-season-edit
 * Get edits for a coach's specific season
 */
ipcMain.handle('coach-database:get-season-edit', async (event, originalCoachId: number, year: number) => {
  try {
    await userDatabaseService.waitForReady();
    return { success: true, data: userDatabaseService.getCoachSeasonEdit(originalCoachId, year) };
  } catch (error) {
    console.error('[coach-database-handlers] Error getting season edit:', error);
    return { success: false, error: String(error) };
  }
});

/**
 * Handle: coach-database:get-season-edits-for-coach
 * Get all season edits for a coach
 */
ipcMain.handle('coach-database:get-season-edits-for-coach', async (event, originalCoachId: number) => {
  try {
    await userDatabaseService.waitForReady();
    return { success: true, data: userDatabaseService.getCoachSeasonEditsForCoach(originalCoachId) };
  } catch (error) {
    console.error('[coach-database-handlers] Error getting season edits:', error);
    return { success: false, error: String(error) };
  }
});

/**
 * Handle: coach-database:save-season-edit-all-years
 * Apply partial edits to ALL years in the coach's career span.
 */
ipcMain.handle('coach-database:save-season-edit-all-years', async (event, originalCoachId: number, edits: Partial<CoachSeasonEdit>, options?: { careerFrom?: number, careerTo?: number }) => {
  try {
    await userDatabaseService.waitForReady();

    // Get coach info from lookup service
    const coach = lookupService.getCoachByPID(originalCoachId);
    if (!coach) {
      console.log('[coach-database-handlers] Coach not found in lookup:', originalCoachId);
      return { success: false, error: 'Coach not found' };
    }

    // Determine year range from options or from existing season edits
    let startYear = options?.careerFrom;
    let endYear = options?.careerTo;

    if (!startYear || !endYear) {
      // Try to get from existing season edits
      const existingSeasons = userDatabaseService.getCoachSeasonEditsForCoach(originalCoachId);
      if (existingSeasons && existingSeasons.length > 0) {
        const years = existingSeasons.map(s => s.year);
        if (!startYear) startYear = Math.min(...years);
        if (!endYear) endYear = Math.max(...years);
      }
    }

    // If still no range, use current year only
    if (!startYear) startYear = new Date().getFullYear();
    if (!endYear) endYear = new Date().getFullYear();

    // Build year range
    const years: number[] = [];
    for (let year = startYear; year <= endYear; year++) {
      years.push(year);
    }

    if (years.length === 0) {
      return { success: true, updatedYears: [], message: 'No years to update' };
    }

    console.log(`[coach-database-handlers] Applying edits to ${years.length} coach seasons (${years[0]}-${years[years.length - 1]}) for coach ${originalCoachId}`);

    // Apply the edits to each year
    for (const year of years) {
      userDatabaseService.saveCoachSeasonEdit(originalCoachId, year, edits);
    }

    return { success: true, updatedYears: years };
  } catch (error) {
    console.error('[coach-database-handlers] Error saving coach seasons to all years:', error);
    return { success: false, error: String(error) };
  }
});

// =============================================
// CUSTOM COACH OPERATIONS
// =============================================

/**
 * Handle: coach-database:create-custom-coach
 * Create a new custom coach
 */
ipcMain.handle('coach-database:create-custom-coach', async (event, coach: Omit<CustomCoach, 'id' | 'createdAt' | 'editedAt'>) => {
  try {
    await userDatabaseService.waitForReady();
    const id = userDatabaseService.createCustomCoach(coach);
    return { success: true, id };
  } catch (error) {
    console.error('[coach-database-handlers] Error creating custom coach:', error);
    return { success: false, error: String(error) };
  }
});

/**
 * Handle: coach-database:update-custom-coach
 * Update an existing custom coach
 */
ipcMain.handle('coach-database:update-custom-coach', async (event, id: number, updates: Partial<CustomCoach>) => {
  try {
    await userDatabaseService.waitForReady();
    userDatabaseService.updateCustomCoach(id, updates);
    return { success: true };
  } catch (error) {
    console.error('[coach-database-handlers] Error updating custom coach:', error);
    return { success: false, error: String(error) };
  }
});

/**
 * Handle: coach-database:get-custom-coach
 * Get a custom coach by ID including all seasons
 */
ipcMain.handle('coach-database:get-custom-coach', async (event, id: number) => {
  try {
    await userDatabaseService.waitForReady();
    const coach = userDatabaseService.getCustomCoach(id);
    if (coach) {
      // Also fetch all seasons for this coach
      const seasons = userDatabaseService.getCustomCoachSeasons(id);
      return { success: true, data: { ...coach, seasons: seasons || [] } };
    }
    return { success: true, data: null };
  } catch (error) {
    console.error('[coach-database-handlers] Error getting custom coach:', error);
    return { success: false, error: String(error) };
  }
});

/**
 * Handle: coach-database:get-all-custom-coaches
 * Get all custom coaches
 */
ipcMain.handle('coach-database:get-all-custom-coaches', async (event) => {
  try {
    await userDatabaseService.waitForReady();
    return { success: true, data: userDatabaseService.getAllCustomCoaches() };
  } catch (error) {
    console.error('[coach-database-handlers] Error getting all custom coaches:', error);
    return { success: false, error: String(error) };
  }
});

/**
 * Handle: coach-database:delete-custom-coach
 * Delete a custom coach
 */
ipcMain.handle('coach-database:delete-custom-coach', async (event, id: number) => {
  try {
    await userDatabaseService.waitForReady();
    userDatabaseService.deleteCustomCoach(id);
    return { success: true };
  } catch (error) {
    console.error('[coach-database-handlers] Error deleting custom coach:', error);
    return { success: false, error: String(error) };
  }
});

/**
 * Handle: coach-database:search-custom-coaches
 * Search custom coaches by name
 */
ipcMain.handle('coach-database:search-custom-coaches', async (event, query: string, limit?: number) => {
  try {
    await userDatabaseService.waitForReady();
    return { success: true, data: userDatabaseService.searchCustomCoaches(query, limit) };
  } catch (error) {
    console.error('[coach-database-handlers] Error searching custom coaches:', error);
    return { success: false, error: String(error) };
  }
});

// =============================================
// CUSTOM COACH SEASON OPERATIONS
// =============================================

/**
 * Handle: coach-database:save-custom-coach-season
 * Save a season for a custom coach
 */
ipcMain.handle('coach-database:save-custom-coach-season', async (event, customCoachId: number, year: number, season: Partial<CustomCoachSeason>) => {
  try {
    await userDatabaseService.waitForReady();
    userDatabaseService.saveCustomCoachSeason(customCoachId, year, season);
    return { success: true };
  } catch (error) {
    console.error('[coach-database-handlers] Error saving custom coach season:', error);
    return { success: false, error: String(error) };
  }
});

/**
 * Handle: coach-database:get-custom-coach-season
 * Get a season for a custom coach
 */
ipcMain.handle('coach-database:get-custom-coach-season', async (event, customCoachId: number, year: number) => {
  try {
    await userDatabaseService.waitForReady();
    return { success: true, data: userDatabaseService.getCustomCoachSeason(customCoachId, year) };
  } catch (error) {
    console.error('[coach-database-handlers] Error getting custom coach season:', error);
    return { success: false, error: String(error) };
  }
});

/**
 * Handle: coach-database:get-custom-coach-seasons
 * Get all seasons for a custom coach
 */
ipcMain.handle('coach-database:get-custom-coach-seasons', async (event, customCoachId: number) => {
  try {
    await userDatabaseService.waitForReady();
    return { success: true, data: userDatabaseService.getCustomCoachSeasons(customCoachId) };
  } catch (error) {
    console.error('[coach-database-handlers] Error getting custom coach seasons:', error);
    return { success: false, error: String(error) };
  }
});

/**
 * Handle: coach-database:save-custom-coach-season-all-years
 * Apply partial edits to ALL years in a custom coach's career span.
 */
ipcMain.handle('coach-database:save-custom-coach-season-all-years', async (event, customCoachId: number, edits: Partial<CustomCoachSeason>) => {
  try {
    await userDatabaseService.waitForReady();

    // Get custom coach info to determine career span
    const customCoach = userDatabaseService.getCustomCoach(customCoachId);

    if (!customCoach) {
      return { success: false, error: 'Custom coach not found' };
    }

    // Determine career span
    const careerFrom = customCoach.careerFrom;
    const careerTo = customCoach.careerTo;

    let startYear = careerFrom;
    let endYear = careerTo;

    if (!startYear) {
      startYear = new Date().getFullYear();
    }
    if (!endYear) {
      endYear = new Date().getFullYear();
    }

    // Build year range
    const years: number[] = [];
    for (let year = startYear; year <= endYear; year++) {
      years.push(year);
    }

    if (years.length === 0) {
      // Fallback to years with existing data
      const existingSeasons = userDatabaseService.getCustomCoachSeasons(customCoachId);
      if (existingSeasons && existingSeasons.length > 0) {
        years.push(...existingSeasons.map(s => s.year));
      }
    }

    if (years.length === 0) {
      return { success: true, updatedYears: [], message: 'No years to update - coach has no career range defined' };
    }

    console.log(`[coach-database-handlers] Applying edits to ${years.length} custom coach seasons (${years[0]}-${years[years.length - 1]}) for coach ${customCoachId}`);

    // Apply the edits to each year
    for (const year of years) {
      userDatabaseService.saveCustomCoachSeason(customCoachId, year, edits);
    }

    return { success: true, updatedYears: years };
  } catch (error) {
    console.error('[coach-database-handlers] Error saving custom coach seasons to all years:', error);
    return { success: false, error: String(error) };
  }
});

// =============================================
// HIDE/UNHIDE COACH OPERATIONS
// =============================================

/**
 * Handle: coach-database:hide-coach
 * Hide an original database coach from search results
 */
ipcMain.handle('coach-database:hide-coach', async (event, coachId: number) => {
  try {
    await userDatabaseService.waitForReady();
    userDatabaseService.hideCoach(coachId);

    // Verify the coach is actually hidden
    const hiddenCoaches = userDatabaseService.getHiddenCoachIds();
    const isNowHidden = hiddenCoaches.includes(coachId);
    console.log(`[coach-database-handlers] hide-coach: Verified coach ${coachId} hidden=${isNowHidden}, total hidden: ${hiddenCoaches.length}`);

    if (!isNowHidden) {
      console.error(`[coach-database-handlers] ERROR: Coach ${coachId} was not stored in hidden_coaches!`);
      return { success: false, error: 'Coach not stored in hidden list' };
    }

    return { success: true };
  } catch (error) {
    console.error('[coach-database-handlers] Error hiding coach:', error);
    return { success: false, error: String(error) };
  }
});

/**
 * Handle: coach-database:unhide-coach
 * Restore a hidden coach
 */
ipcMain.handle('coach-database:unhide-coach', async (event, coachId: number) => {
  try {
    await userDatabaseService.waitForReady();
    userDatabaseService.unhideCoach(coachId);
    return { success: true };
  } catch (error) {
    console.error('[coach-database-handlers] Error unhiding coach:', error);
    return { success: false, error: String(error) };
  }
});

/**
 * Handle: coach-database:get-hidden-coaches
 * Get list of hidden coach IDs
 */
ipcMain.handle('coach-database:get-hidden-coaches', async () => {
  try {
    await userDatabaseService.waitForReady();
    return { success: true, coachIds: userDatabaseService.getHiddenCoachIds() };
  } catch (error) {
    console.error('[coach-database-handlers] Error getting hidden coaches:', error);
    return { success: false, error: String(error) };
  }
});

/**
 * Handle: coach-database:is-coach-hidden
 * Check if a coach is hidden
 */
ipcMain.handle('coach-database:is-coach-hidden', async (event, coachId: number) => {
  try {
    await userDatabaseService.waitForReady();
    return { success: true, hidden: userDatabaseService.isCoachHidden(coachId) };
  } catch (error) {
    console.error('[coach-database-handlers] Error checking hidden status:', error);
    return { success: false, error: String(error) };
  }
});

// =============================================
// RESET OPERATIONS
// =============================================

/**
 * Handle: coach-database:reset-all-edits
 * Reset all coach edits (but keep custom coaches)
 */
ipcMain.handle('coach-database:reset-all-edits', async (event) => {
  try {
    await userDatabaseService.waitForReady();
    userDatabaseService.resetAllCoachEdits();
    return { success: true };
  } catch (error) {
    console.error('[coach-database-handlers] Error resetting all coach edits:', error);
    return { success: false, error: String(error) };
  }
});

/**
 * Handle: coach-database:reset-all-custom
 * Delete all custom coaches
 */
ipcMain.handle('coach-database:reset-all-custom', async (event) => {
  try {
    await userDatabaseService.waitForReady();
    userDatabaseService.resetAllCustomCoaches();
    return { success: true };
  } catch (error) {
    console.error('[coach-database-handlers] Error resetting all custom coaches:', error);
    return { success: false, error: String(error) };
  }
});

// =============================================
// STATISTICS & UTILITIES
// =============================================

/**
 * Handle: coach-database:get-stats
 * Get coach database statistics
 */
ipcMain.handle('coach-database:get-stats', async (event) => {
  try {
    await userDatabaseService.waitForReady();
    return { success: true, data: userDatabaseService.getCoachDatabaseStats() };
  } catch (error) {
    console.error('[coach-database-handlers] Error getting stats:', error);
    return { success: false, error: String(error) };
  }
});

// =============================================
// MERGED DATA ACCESS (Original + User Edits)
// =============================================

/**
 * Handle: coach-database:get-merged-coach
 * Get coach data with user edits merged in
 */
ipcMain.handle('coach-database:get-merged-coach', async (event, coachId: number) => {
  try {
    await userDatabaseService.waitForReady();
    await lookupService.waitForReady();

    console.log('[coach-database-handlers] get-merged-coach: Loading coachId:', coachId);

    // Get original coach data from lookup service
    const original = lookupService.getCoachByPID(coachId);
    if (!original) {
      return { success: false, error: 'Coach not found' };
    }
    console.log('[coach-database-handlers] get-merged-coach: Original coach:', original.firstName, original.lastName);

    // Get user edits
    const coachEdit = userDatabaseService.getCoachEdit(coachId);
    const appearanceEdit = userDatabaseService.getCoachAppearanceEdit(coachId);

    // Merge edits over original data
    const merged = {
      pid: original.pid,
      firstName: coachEdit?.firstName ?? original.firstName,
      lastName: coachEdit?.lastName ?? original.lastName,
      pam: appearanceEdit?.maddenPam ?? original.pam,
      maddenPid: appearanceEdit?.maddenPid,  // Custom portrait PID if assigned
      maddenPam: appearanceEdit?.maddenPam ?? original.pam,
      displayName: original.displayName,
      // Additional fields from edits
      teamIndex: coachEdit?.teamIndex,
      position: coachEdit?.position,
      experience: coachEdit?.experience,
      age: coachEdit?.age,
      // Mark if has any edits
      hasEdits: !!(coachEdit || appearanceEdit)
    };

    // Update display name if name was edited
    if (coachEdit?.firstName || coachEdit?.lastName) {
      merged.displayName = `${merged.firstName} ${merged.lastName}`;
    }

    return { success: true, coach: merged };
  } catch (error) {
    console.error('[coach-database-handlers] Error getting merged coach:', error);
    return { success: false, error: String(error) };
  }
});

/**
 * Handle: coach-database:get-merged-coach-season
 * Get coach season data with user edits merged in
 */
ipcMain.handle('coach-database:get-merged-coach-season', async (event, coachId: number, year: number) => {
  try {
    await userDatabaseService.waitForReady();

    // Get season edits
    const seasonEdit = userDatabaseService.getCoachSeasonEdit(coachId, year);

    // For coaches, we don't have base season data from CSV, so just return the edit
    // (or empty object if no edit)
    const season = seasonEdit || {
      originalCoachId: coachId,
      year: year,
      team: undefined,
      position: undefined,
      wins: undefined,
      losses: undefined,
      ties: undefined,
      playoffWins: undefined,
      superBowlWins: undefined
    };

    return { success: true, season };
  } catch (error) {
    console.error('[coach-database-handlers] Error getting merged coach season:', error);
    return { success: false, error: String(error) };
  }
});

// =============================================
// SEARCH & BROWSE OPERATIONS
// =============================================

/**
 * Handle: coach-database:search-coaches
 * Search all coaches (original + custom) by name, filtering by position and hidden status
 */
ipcMain.handle('coach-database:search-coaches', async (event, options: {
  query?: string;
  position?: string; // HC, OC, DC
  includeHidden?: boolean;
  limit?: number;
  offset?: number;
}) => {
  try {
    await userDatabaseService.waitForReady();
    await lookupService.waitForReady();

    const query = (options.query || '').toLowerCase().trim();
    const position = options.position;
    const includeHidden = options.includeHidden || false;
    const limit = options.limit || 50;
    const offset = options.offset || 0;

    // Pre-load all edit data for fast bulk lookups (load once, use for all coaches)
    const allCoachEdits = userDatabaseService.getAllCoachEdits();
    const allCoachAppearanceEdits = userDatabaseService.getAllCoachAppearanceEdits();

    // Get hidden coaches list
    const hiddenCoachIds = includeHidden ? [] : userDatabaseService.getHiddenCoachIds();

    // Get all original coaches from lookup service
    const allOriginalCoaches = lookupService.getAllCoaches();

    // Get all custom coaches
    const allCustomCoaches = userDatabaseService.getAllCustomCoaches();

    // Combine and filter results
    interface CoachResult {
      id: number;
      firstName: string;
      lastName: string;
      displayName: string;
      pam: string;
      maddenPid?: number;  // Custom portrait PID if assigned
      position?: string;
      teamIndex?: number;
      isCustom: boolean;
      hasEdits: boolean;
    }

    const results: CoachResult[] = [];

    // Add original coaches
    for (const coach of allOriginalCoaches) {
      // Skip hidden coaches
      if (hiddenCoachIds.includes(coach.pid)) {
        continue;
      }

      // Skip owners (PID 100-148) and generic faces (PID >= 149) from search
      // Real coaches have PIDs 0-99, these should be in face picker only
      if (coach.pid >= 100) {
        continue;
      }

      // Get any edits (O(1) lookup from pre-loaded maps)
      const coachEdit = allCoachEdits.get(coach.pid);
      const appearanceEdit = allCoachAppearanceEdits.get(coach.pid);

      const firstName = coachEdit?.firstName ?? coach.firstName;
      const lastName = coachEdit?.lastName ?? coach.lastName;
      const displayName = `${firstName} ${lastName}`;
      const coachPosition = coachEdit?.position;

      // Filter by query
      if (query && !displayName.toLowerCase().includes(query)) {
        continue;
      }

      // Filter by position
      if (position && coachPosition !== position) {
        continue;
      }

      results.push({
        id: coach.pid,
        firstName,
        lastName,
        displayName,
        pam: appearanceEdit?.maddenPam ?? coach.pam,
        maddenPid: appearanceEdit?.maddenPid,  // Custom portrait PID if assigned
        position: coachPosition,
        teamIndex: coachEdit?.teamIndex,
        isCustom: false,
        hasEdits: !!(coachEdit || appearanceEdit)
      });
    }

    // Add custom coaches
    for (const coach of allCustomCoaches) {
      const displayName = `${coach.firstName} ${coach.lastName}`;

      // Filter by query
      if (query && !displayName.toLowerCase().includes(query)) {
        continue;
      }

      // Filter by position
      if (position && coach.position !== position) {
        continue;
      }

      results.push({
        id: coach.id!,
        firstName: coach.firstName,
        lastName: coach.lastName,
        displayName,
        pam: coach.maddenPam || '',
        maddenPid: coach.maddenPid,  // Custom portrait PID if assigned
        position: coach.position,
        teamIndex: coach.teamIndex,
        isCustom: true,
        hasEdits: false // Custom coaches are always "edited"
      });
    }

    // Sort by display name
    results.sort((a, b) => a.displayName.localeCompare(b.displayName));

    // Apply pagination
    const totalCount = results.length;
    const paginatedResults = results.slice(offset, offset + limit);

    return {
      success: true,
      data: {
        coaches: paginatedResults,
        totalCount,
        offset,
        limit
      }
    };
  } catch (error) {
    console.error('[coach-database-handlers] Error searching coaches:', error);
    return { success: false, error: String(error) };
  }
});

/**
 * Handle: coach-database:get-all-coaches
 * Get all coaches (for dropdown lists, etc.)
 */
ipcMain.handle('coach-database:get-all-coaches', async () => {
  try {
    await lookupService.waitForReady();
    return { success: true, data: lookupService.getAllCoaches() };
  } catch (error) {
    console.error('[coach-database-handlers] Error getting all coaches:', error);
    return { success: false, error: String(error) };
  }
});

/**
 * Handle: coach-database:get-coach-by-name
 * Get a coach by name (for retro editor integration)
 */
ipcMain.handle('coach-database:get-coach-by-name', async (event, lastName: string, firstName: string) => {
  try {
    await userDatabaseService.waitForReady();
    await lookupService.waitForReady();

    // First check user database for custom or edited coach
    const userCoach = userDatabaseService.getCoachByName(lastName, firstName);
    if (userCoach) {
      return { success: true, coach: userCoach };
    }

    // Fall back to lookup service
    const lookupCoach = lookupService.getCoachByName(lastName, firstName);
    if (lookupCoach) {
      return {
        success: true,
        coach: {
          pid: lookupCoach.pid,
          firstName: lookupCoach.firstName,
          lastName: lookupCoach.lastName,
          pam: lookupCoach.pam,
          displayName: lookupCoach.displayName
        }
      };
    }

    return { success: false, error: 'Coach not found' };
  } catch (error) {
    console.error('[coach-database-handlers] Error getting coach by name:', error);
    return { success: false, error: String(error) };
  }
});

// =============================================
// COACH APPEARANCE OPTIONS (GenericHeadAssetName)
// =============================================

/**
 * Handle: coach-database:get-head-asset-options
 * Get all available GenericHeadAssetName options for coach appearance
 */
ipcMain.handle('coach-database:get-head-asset-options', async () => {
  try {
    const fs = await import('fs');
    const path = await import('path');
    const { app } = await import('electron');

    // Find the coach-appearance.json file
    let lookupDir: string;
    if (app.isPackaged) {
      lookupDir = path.join(process.resourcesPath, 'data', 'lookups');
    } else {
      lookupDir = path.join(app.getAppPath(), 'data', 'lookups');
    }

    const filePath = path.join(lookupDir, 'coach-appearance.json');

    if (!fs.existsSync(filePath)) {
      console.warn('[coach-database-handlers] coach-appearance.json not found at:', filePath);
      return { success: false, error: 'Coach appearance file not found' };
    }

    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(fileContent);
    const headAssets = data.GenericHeadAssetName || {};

    // Convert to array format for dropdown
    const options = Object.entries(headAssets).map(([name, id]) => ({
      name: name,
      id: id as number,
      // Categorize by type
      category: name.startsWith('coachhead_') ? 'Generic' :
                name.includes('_F_') ? 'Female' :
                name.includes('_M_') ? 'Male Generic' :
                'Named'
    }));

    // Sort: Named first, then by category
    options.sort((a, b) => {
      if (a.category === 'Named' && b.category !== 'Named') return -1;
      if (a.category !== 'Named' && b.category === 'Named') return 1;
      return a.name.localeCompare(b.name);
    });

    return { success: true, data: options };
  } catch (error) {
    console.error('[coach-database-handlers] Error loading head asset options:', error);
    return { success: false, error: String(error) };
  }
});

// =============================================
// RETRO COACH DATA LOADING
// =============================================

/**
 * Handle: coach-database:get-retro-coach-data
 * Load historical coach data for a specific year from retro files
 */
ipcMain.handle('coach-database:get-retro-coach-data', async (event, year: number) => {
  try {
    const fs = await import('fs');
    const path = await import('path');
    const { app } = await import('electron');

    // Find the retro coaches directory
    let retroDir: string;
    if (app.isPackaged) {
      retroDir = path.join(process.resourcesPath, 'data', 'retro', 'coaches');
    } else {
      retroDir = path.join(app.getAppPath(), 'data', 'retro', 'coaches');
    }

    const filePath = path.join(retroDir, `${year}.json`);

    if (!fs.existsSync(filePath)) {
      return { success: false, error: `No retro data for year ${year}` };
    }

    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(fileContent);

    return { success: true, data };
  } catch (error) {
    console.error('[coach-database-handlers] Error loading retro coach data:', error);
    return { success: false, error: String(error) };
  }
});

/**
 * Handle: coach-database:get-available-retro-years
 * Get list of years that have retro coach data available
 */
ipcMain.handle('coach-database:get-available-retro-years', async () => {
  try {
    const fs = await import('fs');
    const path = await import('path');
    const { app } = await import('electron');

    // Find the retro coaches directory
    let retroDir: string;
    if (app.isPackaged) {
      retroDir = path.join(process.resourcesPath, 'data', 'retro', 'coaches');
    } else {
      retroDir = path.join(app.getAppPath(), 'data', 'retro', 'coaches');
    }

    if (!fs.existsSync(retroDir)) {
      return { success: true, years: [] };
    }

    const files = fs.readdirSync(retroDir);
    const years = files
      .filter(f => f.endsWith('.json') && /^\d{4}\.json$/.test(f))
      .map(f => parseInt(f.replace('.json', '')))
      .sort((a, b) => b - a); // Most recent first

    return { success: true, years };
  } catch (error) {
    console.error('[coach-database-handlers] Error getting available retro years:', error);
    return { success: false, error: String(error) };
  }
});

// =============================================
// COACH PAM OPTIONS (for PAM-only picker)
// =============================================

/**
 * Handle: coach-database:get-pam-options
 * Get all unique coach PAM values from Coach_lookup.csv for PAM-only selection
 * Returns PAM values with their associated PIDs for portrait preview
 */
ipcMain.handle('coach-database:get-pam-options', async () => {
  try {
    await lookupService.waitForReady();

    const allCoaches = lookupService.getAllCoaches();

    // Build unique PAM values with their associated PIDs
    const pamMap = new Map<string, { pam: string; pid: number; name: string; category: string }>();

    for (const coach of allCoaches) {
      const pam = coach.pam;
      if (!pam || pam.trim() === '') continue; // Skip empty PAM values

      // Categorize PAM values
      let category = 'Generic';
      if (pam.endsWith('_C_PRO') && pam !== '_C_PRO') {
        // Named coach PAM like "EberflusMatt_C_PRO"
        category = 'Named';
      } else if (pam === '_C_PRO') {
        category = 'Generic Coach';
      }

      // Use first occurrence (keep coach with actual portrait if possible)
      if (!pamMap.has(pam)) {
        pamMap.set(pam, {
          pam: pam,
          pid: coach.pid,
          name: coach.displayName || `${coach.firstName} ${coach.lastName}`.trim(),
          category: category
        });
      }
    }

    // Convert to array and sort
    const options = Array.from(pamMap.values()).sort((a, b) => {
      // Sort: Named first, then Generic Coach, then others
      const categoryOrder: { [key: string]: number } = { 'Named': 0, 'Generic Coach': 1, 'Generic': 2 };
      const orderA = categoryOrder[a.category] ?? 3;
      const orderB = categoryOrder[b.category] ?? 3;

      if (orderA !== orderB) return orderA - orderB;
      return a.name.localeCompare(b.name);
    });

    console.log(`[coach-database-handlers] Loaded ${options.length} unique coach PAM values`);
    return { success: true, data: options };
  } catch (error) {
    console.error('[coach-database-handlers] Error loading PAM options:', error);
    return { success: false, error: String(error) };
  }
});

// =============================================
// GENERIC COACH PORTRAITS (for portrait picker)
// =============================================

/**
 * Handle: coach-database:get-generic-portraits
 * Get generic coach portraits grouped by race from coach-portrait-mapping.json
 */
ipcMain.handle('coach-database:get-generic-portraits', async () => {
  try {
    const fs = await import('fs');
    const path = await import('path');
    const { app } = await import('electron');

    // Resolve path to mapping file
    const appPath = app.getAppPath();
    let mappingPath: string;

    if (app.isPackaged) {
      mappingPath = path.join(appPath, '.vite', 'build', 'data', 'lookups', 'coach-portrait-mapping.json');
    } else {
      mappingPath = path.join(appPath, 'data', 'lookups', 'coach-portrait-mapping.json');
    }

    if (!fs.existsSync(mappingPath)) {
      console.warn('[coach-database-handlers] coach-portrait-mapping.json not found at:', mappingPath);
      return { success: false, error: 'Generic portrait mapping not found' };
    }

    const mappingData = JSON.parse(fs.readFileSync(mappingPath, 'utf8'));

    // Return race-coded portraits grouped by race
    const result = {
      White: mappingData.raceCodedPortraits?.White || [],
      Black: mappingData.raceCodedPortraits?.Black || [],
      Hispanic: mappingData.raceCodedPortraits?.Hispanic || [],
      Asian: mappingData.raceCodedPortraits?.Asian || []
    };

    const totalCount = result.White.length + result.Black.length + result.Hispanic.length + result.Asian.length;
    console.log(`[coach-database-handlers] Loaded ${totalCount} generic portraits (W:${result.White.length}, B:${result.Black.length}, H:${result.Hispanic.length}, A:${result.Asian.length})`);

    return { success: true, data: result };
  } catch (error) {
    console.error('[coach-database-handlers] Error loading generic portraits:', error);
    return { success: false, error: String(error) };
  }
});

// =============================================
// RETRO COACH IMPORT
// =============================================

/**
 * Handle: coach-database:import-retro-coaches
 * Import all retro coaches from the retro-coaches-database.json file
 */
ipcMain.handle('coach-database:import-retro-coaches', async () => {
  try {
    const fs = await import('fs');
    const path = await import('path');
    const { app } = await import('electron');

    await userDatabaseService.waitForReady();

    const appPath = app.getAppPath();
    let jsonPath: string;

    if (app.isPackaged) {
      jsonPath = path.join(appPath, '.vite', 'build', 'data', 'lookups', 'retro-coaches-database.json');
    } else {
      jsonPath = path.join(appPath, 'data', 'lookups', 'retro-coaches-database.json');
    }

    if (!fs.existsSync(jsonPath)) {
      console.warn('[coach-database-handlers] retro-coaches-database.json not found at:', jsonPath);
      return { success: false, error: 'Retro coaches database not found' };
    }

    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    console.log(`[coach-database-handlers] Importing ${data.totalCoaches} coaches with ${data.totalSeasons} seasons...`);

    let coachesImported = 0;
    let seasonsImported = 0;
    let coachesSkipped = 0;

    for (const coach of data.coaches) {
      // Check if coach already exists as custom coach
      const existing = userDatabaseService.searchCustomCoaches(
        `${coach.firstName} ${coach.lastName}`,
        1
      );

      if (existing.length > 0) {
        // Coach exists, update seasons only
        const existingCoach = existing[0];
        for (const season of coach.seasons) {
          userDatabaseService.saveCustomCoachSeason(existingCoach.id, season.year, {
            team: season.team,
            position: season.position,
            wins: season.careerWins,
            losses: season.careerLosses,
            ties: season.careerTies,
            playoffWins: season.playoffWins,
            superBowlWins: season.superBowlWins
          });
          seasonsImported++;
        }
        coachesSkipped++;
        continue;
      }

      // Create new custom coach
      const coachId = userDatabaseService.createCustomCoach({
        firstName: coach.firstName,
        lastName: coach.lastName,
        careerFrom: coach.careerFrom,
        careerTo: coach.careerTo,
        careerWins: coach.careerWins,
        careerLosses: coach.careerLosses,
        careerTies: coach.careerTies,
        careerPlayoffWins: coach.playoffWins,
        careerSBWins: coach.superBowlWins,
        source: 'retro'
      });

      // Add seasons
      for (const season of coach.seasons) {
        userDatabaseService.saveCustomCoachSeason(coachId, season.year, {
          team: season.team,
          position: season.position,
          wins: season.careerWins,
          losses: season.careerLosses,
          ties: season.careerTies,
          playoffWins: season.playoffWins,
          superBowlWins: season.superBowlWins
        });
        seasonsImported++;
      }

      coachesImported++;
    }

    console.log(`[coach-database-handlers] Import complete: ${coachesImported} coaches, ${seasonsImported} seasons (${coachesSkipped} skipped)`);

    return {
      success: true,
      imported: coachesImported,
      seasons: seasonsImported,
      skipped: coachesSkipped
    };
  } catch (error) {
    console.error('[coach-database-handlers] Error importing retro coaches:', error);
    return { success: false, error: String(error) };
  }
});

/**
 * Handle: coach-database:clear-all-coaches
 * Clear all custom coaches from the database (for testing)
 */
ipcMain.handle('coach-database:clear-all-coaches', async () => {
  try {
    await userDatabaseService.waitForReady();

    // Get count before clearing
    const allCustom = userDatabaseService.getAllCustomCoaches();
    const count = allCustom.length;

    // Clear all custom coaches
    userDatabaseService.clearAllCustomCoaches();

    console.log(`[coach-database-handlers] Cleared ${count} custom coaches`);

    return { success: true, cleared: count };
  } catch (error) {
    console.error('[coach-database-handlers] Error clearing coaches:', error);
    return { success: false, error: String(error) };
  }
});

/**
 * Handle: coach-database:get-retro-import-status
 * Check if retro coaches have been imported
 */
ipcMain.handle('coach-database:get-retro-import-status', async () => {
  try {
    await userDatabaseService.waitForReady();

    // Count custom coaches with source='retro'
    const allCustom = userDatabaseService.getAllCustomCoaches();
    const retroCoaches = allCustom.filter((c: any) => c.source === 'retro');

    return {
      success: true,
      imported: retroCoaches.length > 0,
      count: retroCoaches.length
    };
  } catch (error) {
    console.error('[coach-database-handlers] Error checking retro import status:', error);
    return { success: false, error: String(error) };
  }
});

console.log('[coach-database-handlers] Registered coach database IPC handlers');
