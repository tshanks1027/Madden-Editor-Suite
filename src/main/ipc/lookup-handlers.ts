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
      // Include ALL players for name lookup (even without PIDs)
      // Players without PIDs will have value: 0, allowing name search but indicating no PID
      return options
        .filter(opt => opt.entry)
        .map(opt => ({
          value: opt.entry.pid || 0,  // Use actual PID, or 0 if not assigned
          label: `${opt.entry.lastName}, ${opt.entry.firstName}`,  // "LastName, FirstName" format
          plpo: opt.plpo || '',
          hasPid: opt.entry.pid > 0  // Flag to indicate if player has a valid PID
        }));
    } else {
      // All other lookups (position, team, college, state) remain the same
      options = lookupService.getDropdownOptions(fileName);
      console.log(`[lookup-handlers] getDropdownOptions('${fileName}') returned ${options?.length || 0} items`);
      if (fileName === 'college_lookup.csv' && options?.length > 0) {
        console.log(`[lookup-handlers] Sample college raw data:`, JSON.stringify(options.slice(0, 3)));
        console.log(`[lookup-handlers] First college keys:`, Object.keys(options[0] || {}));
      }
      // Transform {id, name} to {value, label} for renderer
      const result = options.map(opt => ({ value: opt.id, label: opt.name }));
      if (fileName === 'college_lookup.csv' && result?.length > 0) {
        console.log(`[lookup-handlers] Transformed college data:`, JSON.stringify(result.slice(0, 3)));
      }
      return result;
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
    const stats = lookupService.getCacheStats();
    console.log('[lookup-handlers] Cache stats:', stats);
    return {
      ready: lookupService.isReady(),
      loadedFiles: lookupService.getLoadedFiles(),
      cacheStats: stats
    };
  } catch (error: any) {
    console.error('Error getting lookup status:', error);
    return { ready: false, error: error.message };
  }
});

/**
 * Handle: lookup:debug-colleges
 * Debug endpoint to check college data specifically
 */
ipcMain.handle('lookup:debug-colleges', async () => {
  try {
    await lookupService.waitForReady();
    const options = lookupService.getDropdownOptions('college_lookup.csv');
    console.log('[lookup-handlers] DEBUG colleges - count:', options?.length || 0);
    console.log('[lookup-handlers] DEBUG colleges - first 5:', options?.slice(0, 5));
    return {
      count: options?.length || 0,
      sample: options?.slice(0, 10) || []
    };
  } catch (error: any) {
    console.error('[lookup-handlers] DEBUG colleges error:', error);
    return { error: error.message };
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

/**
 * Handle: lookup:get-valid-genr-set
 * Get set of valid GENR values from the GENR catalog
 * Used by face picker to filter faces that actually exist in the game
 */
ipcMain.handle('lookup:get-valid-genr-set', async () => {
  try {
    const fs = require('fs');
    const path = require('path');

    const possiblePaths = [
      path.join(__dirname, '..', 'data', 'lookups', 'GENR_catalog.json'),
      path.join(__dirname, '..', '..', 'data', 'lookups', 'GENR_catalog.json'),
      path.join(process.cwd(), 'data', 'lookups', 'GENR_catalog.json'),
      path.join(process.cwd(), '.vite', 'build', 'data', 'lookups', 'GENR_catalog.json')
    ];

    for (const catalogPath of possiblePaths) {
      if (fs.existsSync(catalogPath)) {
        const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
        const validGenrList: string[] = [];

        // Collect all GENR values from catalog (lowercase for case-insensitive matching)
        for (let i = 1; i <= 7; i++) {
          const key = `gen_${i}`;
          if (catalog[key]) {
            catalog[key].forEach((g: string) => validGenrList.push(g.toLowerCase()));
          }
        }

        console.log(`[lookup-handlers] Loaded ${validGenrList.length} valid GENR values from catalog`);
        return validGenrList;
      }
    }

    console.warn('[lookup-handlers] GENR catalog not found');
    return [];
  } catch (error) {
    console.error('Error loading GENR catalog:', error);
    return [];
  }
});

/**
 * Handle: lookup:get-verified-portrait-genr-mapping
 * Get the verified portrait->GENR mapping (268 faces that work correctly in-game)
 * Returns map of portrait name -> { genr, sknt }
 */
ipcMain.handle('lookup:get-verified-portrait-genr-mapping', async () => {
  try {
    const fs = require('fs');
    const path = require('path');
    const { app } = require('electron');

    const possiblePaths = [
      path.join(app.getAppPath(), 'data', 'lookups', 'verified-portrait-genr.json'),
      path.join(__dirname, '..', 'data', 'lookups', 'verified-portrait-genr.json'),
      path.join(__dirname, '..', '..', 'data', 'lookups', 'verified-portrait-genr.json'),
      path.join(process.cwd(), 'data', 'lookups', 'verified-portrait-genr.json'),
      path.join(process.cwd(), '.vite', 'build', 'data', 'lookups', 'verified-portrait-genr.json')
    ];

    for (const mappingPath of possiblePaths) {
      if (fs.existsSync(mappingPath)) {
        const mapping = JSON.parse(fs.readFileSync(mappingPath, 'utf8'));
        console.log(`[lookup-handlers] Loaded ${Object.keys(mapping).length} verified portrait->GENR mappings`);
        return mapping;
      }
    }

    console.warn('[lookup-handlers] Verified portrait-genr mapping not found');
    return {};
  } catch (error) {
    console.error('Error loading verified portrait-genr mapping:', error);
    return {};
  }
});

/**
 * Handle: lookup:get-face-picker-mapping
 * Get the face picker # -> GENR/SKNT mapping (264 faces from ROSTER-GENHEADTEST)
 * Returns map of face picker number -> { genr, sknt }
 */
ipcMain.handle('lookup:get-face-picker-mapping', async () => {
  try {
    const fs = require('fs');
    const path = require('path');
    const { app } = require('electron');

    const possiblePaths = [
      path.join(app.getAppPath(), 'data', 'lookups', 'face-picker-to-genr.json'),
      path.join(__dirname, '..', 'data', 'lookups', 'face-picker-to-genr.json'),
      path.join(__dirname, '..', '..', 'data', 'lookups', 'face-picker-to-genr.json'),
      path.join(process.cwd(), 'data', 'lookups', 'face-picker-to-genr.json'),
      path.join(process.cwd(), '.vite', 'build', 'data', 'lookups', 'face-picker-to-genr.json')
    ];

    for (const mappingPath of possiblePaths) {
      if (fs.existsSync(mappingPath)) {
        const mapping = JSON.parse(fs.readFileSync(mappingPath, 'utf8'));
        console.log(`[lookup-handlers] Loaded ${Object.keys(mapping).length} face picker->GENR mappings`);
        return mapping;
      }
    }

    console.warn('[lookup-handlers] Face picker mapping not found');
    return {};
  } catch (error) {
    console.error('Error loading face picker mapping:', error);
    return {};
  }
});

console.log('[lookup-handlers] Lookup IPC handlers registered');
