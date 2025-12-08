/**
 * Lookup IPC Handlers
 *
 * IPC handlers for lookup system operations.
 * Provides access to CSV lookup data (positions, teams, colleges, etc.)
 *
 * Source: Restored from git history (commit 7301aeb)
 */

import { ipcMain } from 'electron';
import { lookupService } from '../services/lookup-service';

/**
 * Handle: lookup:get-display-name
 * Get display name from numeric ID
 */
ipcMain.handle('lookup:get-display-name', async (event, fileName: string, id: number) => {
  try {
    return lookupService.getDisplayName(fileName, id);
  } catch (error) {
    console.error('Error getting display name:', error);
    return id.toString();
  }
});

/**
 * Handle: lookup:get-numeric-id
 * Get numeric ID from display name
 */
ipcMain.handle('lookup:get-numeric-id', async (event, fileName: string, displayName: string) => {
  try {
    return lookupService.getNumericId(fileName, displayName);
  } catch (error) {
    console.error('Error getting numeric ID:', error);
    return 0;
  }
});

/**
 * Handle: lookup:get-dropdown-options
 * Get dropdown options for data grid
 */
ipcMain.handle('lookup:get-dropdown-options', async (event, fileName: string) => {
  try {
    let options;
    // ALLDATA_Lookup.csv is the ONE source for all player data (20,634 players with ALL data)
    // Map frontend request to actual loaded file
    if (fileName === 'ALLDATA_Lookup.csv') {
      options = lookupService.getDropdownOptions('ALL_PLAYER_LOOKUP.csv');
      // Transform to include all fields
      // IMPORTANT: Use entry.pid (actual PhotoID) instead of id (internal row ID)
      // Only include entries with valid PIDs (not 0) for the PID lookup
      return options
        .filter(opt => opt.entry && opt.entry.pid > 0)
        .map(opt => ({
          value: opt.entry.pid,  // Use actual PID, not internal row ID
          label: `${opt.entry.lastName}, ${opt.entry.firstName}`,  // "LastName, FirstName" format
          plpo: opt.plpo || ''
        }));
    } else {
      // All other lookups (position, team, college, state) remain the same
      options = lookupService.getDropdownOptions(fileName);
      // Transform {id, name} to {value, label} for renderer
      return options.map(opt => ({ value: opt.id, label: opt.name }));
    }
  } catch (error) {
    console.error('Error getting dropdown options:', error);
    return [];
  }
});

/**
 * Handle: lookup:is-ready
 * Check if lookup service is ready
 */
ipcMain.handle('lookup:is-ready', async (event) => {
  return lookupService.isReady();
});

/**
 * Handle: lookup:reload
 * Reload lookup files (for development)
 */
ipcMain.handle('lookup:reload', async (event) => {
  try {
    await lookupService.reload();
    return { success: true };
  } catch (error: any) {
    console.error('Error reloading lookups:', error);
    return { success: false, error: error.message };
  }
});

/**
 * Handle: lookup:get-pid-portrait-mapping
 * Load PID -> Portrait PLPO mappings from PID_Portrait_Mapping.csv
 */
ipcMain.handle('lookup:get-pid-portrait-mapping', async (event) => {
  try {
    const fs = await import('fs');
    const path = await import('path');
    const { app } = await import('electron');

    // Use app.getAppPath() for both dev and packaged builds
    const dataPath = path.join(app.getAppPath(), 'data', 'lookups', 'PID_Portrait_Mapping.csv');

    console.log('[PID Portrait Mapping] Loading from:', dataPath);

    const content = fs.readFileSync(dataPath, 'utf-8');
    const lines = content.split('\n');

    const mappings: Array<{pid: number, name: string, type: string, portrait: string, pam?: string}> = [];

    // Parse CSV (skip header line)
    // Format: PID,Player Name,Type,Portrait,PAM
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const parts = line.split(',');
      if (parts.length < 4) continue;

      const pid = parseInt(parts[0].trim());
      const name = parts[1].trim();
      const type = parts[2].trim();
      const portrait = parts[3].trim();
      const pam = parts.length >= 5 ? parts[4].trim() : undefined;

      if (!isNaN(pid) && portrait) {
        mappings.push({ pid, name, type, portrait, pam });
      }
    }

    console.log(`[PID Portrait Mapping] Loaded ${mappings.length} mappings`);
    return mappings;
  } catch (error) {
    console.error('Error loading PID_Portrait_Mapping.csv:', error);
    return [];
  }
});

/**
 * Handle: lookup:get-status
 * Get lookup service status/debugging info
 */
ipcMain.handle('lookup:get-status', async (event) => {
  try {
    return {
      ready: lookupService.isReady(),
      loadedFiles: lookupService.getLoadedFiles(),
      cacheStats: lookupService.getCacheStats()
    };
  } catch (error: any) {
    console.error('Error getting lookup status:', error);
    return { ready: false, error: error.message };
  }
});

/**
 * Handle: lookup:get-pam-entry
 * Get PAM entry by PAM name
 */
ipcMain.handle('lookup:get-pam-entry', async (event, pamName: string) => {
  try {
    return lookupService.getPAMEntry(pamName);
  } catch (error) {
    console.error('Error getting PAM entry:', error);
    return undefined;
  }
});

/**
 * Handle: lookup:get-pams-by-pid
 * Get all PAMs associated with a PID
 */
ipcMain.handle('lookup:get-pams-by-pid', async (event, pid: number) => {
  try {
    return lookupService.getPAMsByPID(pid);
  } catch (error) {
    console.error('Error getting PAMs by PID:', error);
    return [];
  }
});

/**
 * Handle: lookup:get-all-pams
 * Get all PAM entries
 */
ipcMain.handle('lookup:get-all-pams', async (event) => {
  try {
    return lookupService.getAllPAMs();
  } catch (error) {
    console.error('Error getting all PAMs:', error);
    return [];
  }
});

/**
 * Handle: lookup:get-pam-options
 * Get formatted PAM options for dropdowns
 */
ipcMain.handle('lookup:get-pam-options', async (event) => {
  try {
    const options = lookupService.getPAMOptions();
    // Transform to {value, label} format for renderer
    return options.map(opt => ({ value: opt.value, label: opt.name, metadata: opt.metadata }));
  } catch (error) {
    console.error('Error getting PAM options:', error);
    return [];
  }
});

/**
 * Handle: lookup:search-pams
 * Search PAMs by query string
 */
ipcMain.handle('lookup:search-pams', async (event, query: string) => {
  try {
    return lookupService.searchPAMs(query);
  } catch (error) {
    console.error('Error searching PAMs:', error);
    return [];
  }
});

/**
 * Handle: lookup:get-pams-by-ethnicity
 * Get PAMs filtered by ethnicity
 */
ipcMain.handle('lookup:get-pams-by-ethnicity', async (event, ethnicity: string) => {
  try {
    return lookupService.getPAMsByEthnicity(ethnicity);
  } catch (error) {
    console.error('Error getting PAMs by ethnicity:', error);
    return [];
  }
});

/**
 * Handle: lookup:get-pams-by-generation
 * Get PAMs filtered by generation
 */
ipcMain.handle('lookup:get-pams-by-generation', async (event, generation: number) => {
  try {
    return lookupService.getPAMsByGeneration(generation);
  } catch (error) {
    console.error('Error getting PAMs by generation:', error);
    return [];
  }
});

/**
 * Handle: lookup:get-coach-pam-options
 * Get all coach PAM options for dropdown
 */
ipcMain.handle('lookup:get-coach-pam-options', async (event) => {
  try {
    return lookupService.getCoachPAMOptions();
  } catch (error) {
    console.error('Error getting coach PAM options:', error);
    return [];
  }
});

/**
 * Handle: lookup:get-coach-by-pid
 * Get coach entry by PID
 */
ipcMain.handle('lookup:get-coach-by-pid', async (event, pid: number) => {
  try {
    return lookupService.getCoachByPID(pid);
  } catch (error) {
    console.error('Error getting coach by PID:', error);
    return null;
  }
});

/**
 * Handle: lookup:get-coach-pid-from-pam
 * Get coach PID from PAM
 */
ipcMain.handle('lookup:get-coach-pid-from-pam', async (event, pam: string) => {
  try {
    return lookupService.getCoachPIDFromPAM(pam);
  } catch (error) {
    console.error('Error getting coach PID from PAM:', error);
    return null;
  }
});

/**
 * Handle: lookup:get-coach-pam-from-pid
 * Get coach PAM from PID
 */
ipcMain.handle('lookup:get-coach-pam-from-pid', async (event, pid: number) => {
  try {
    return lookupService.getCoachPAMFromPID(pid);
  } catch (error) {
    console.error('Error getting coach PAM from PID:', error);
    return null;
  }
});

/**
 * Handle: lookup:get-coach-lookup
 * Get all coach lookup data (LastName, FirstName, PAM, PID)
 */
ipcMain.handle('lookup:get-coach-lookup', async (event) => {
  try {
    const fs = await import('fs');
    const path = await import('path');
    const { app } = await import('electron');

    // Use app.getAppPath() for both dev and packaged builds
    const dataPath = path.join(app.getAppPath(), 'data', 'lookups', 'Coach_lookup.csv');

    console.log('[Coach Lookup] Loading from:', dataPath);

    const content = fs.readFileSync(dataPath, 'utf-8');
    const lines = content.split('\n');

    const coaches: Array<{LastName: string, FirstName: string, PAM: string, PID: number}> = [];

    // Parse CSV (no header line)
    // Format: LastName,FirstName,PAM,PID
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const parts = line.split(',');
      if (parts.length < 4) continue;

      const lastName = parts[0].trim();
      const firstName = parts[1].trim();
      const pam = parts[2].trim();
      const pid = parseInt(parts[3].trim());

      if (!isNaN(pid)) {
        coaches.push({ LastName: lastName, FirstName: firstName, PAM: pam, PID: pid });
      }
    }

    console.log(`[Coach Lookup] Loaded ${coaches.length} coaches from lookup`);
    return { success: true, coaches };
  } catch (error: any) {
    console.error('Error loading coach lookup:', error);
    return { success: false, error: error.message, coaches: [] };
  }
});

/**
 * Handle: lookup:get-race-by-pid
 * Get race value for a PID from the database
 */
ipcMain.handle('lookup:get-race-by-pid', async (event, pid: number) => {
  try {
    const race = lookupService.getRaceByPID(pid);
    return race !== undefined ? race : null;
  } catch (error) {
    console.error('Error getting race by PID:', error);
    return null;
  }
});

console.log('[lookup-handlers] Lookup IPC handlers registered');
