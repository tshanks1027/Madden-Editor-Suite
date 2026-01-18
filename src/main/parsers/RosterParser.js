/**
 * Madden 26 FBCHUNKS Roster File Parser
 *
 * Uses proven code from Head Coach Editor (madden-file-tools package)
 * This is the WORKING implementation that successfully parses Madden roster files.
 *
 * Source: madden-file-tools v2.9.1 (MIT License)
 * GitHub: https://github.com/bep713/madden-file-tools
 */

// Use madden-file-tools - dynamically located based on environment
const path = require('path');

// MaddenRosterHelper is in lib/ (vendored madden-franchise code)
// In build: parsers/ is at .vite/build/parsers/, lib/ is at .vite/build/lib/
const MaddenRosterHelper = require(path.join(__dirname, '..', 'lib', 'helpers', 'MaddenRosterHelper'));

// Generic Face Service for updating BLBM with race-appropriate faces
let genericFaceService = null;
try {
  console.log('[RosterParser] Attempting to load GenericFaceService from:', path.join(__dirname, 'GenericFaceService'));
  const serviceModule = require(path.join(__dirname, 'GenericFaceService'));
  console.log('[RosterParser] Module loaded, serviceModule keys:', Object.keys(serviceModule));
  genericFaceService = serviceModule.genericFaceService;
  console.log('[RosterParser] GenericFaceService loaded:', genericFaceService ? 'SUCCESS' : 'NULL (service object missing)');
} catch (e) {
  console.error('[RosterParser] GenericFaceService FAILED to load:', e.message);
  console.error('[RosterParser] Stack:', e.stack);
}

/**
 * Parse a Madden FBCHUNKS roster file
 * @param {string} filePath - Absolute path to roster file
 * @returns {Promise<Object>} Parsed roster data with players array
 */
async function parseRosterFile(filePath) {
  console.log('[RosterParser] ===== START ROSTER PARSE =====');
  console.log('[RosterParser] File path:', filePath);

  try {
    const helper = new MaddenRosterHelper();

    // Load the roster file using proven MaddenRosterHelper
    console.log('[RosterParser] Loading roster with MaddenRosterHelper...');
    const file = await helper.load(filePath);

    console.log('[RosterParser] Roster loaded successfully');
    console.log('[RosterParser] Found', file.tables.length, 'tables');

    // List all table names
    const tableNames = file.tables.map(t => t.name);
    console.log('[RosterParser] Tables:', tableNames.join(', '));

    // Get player table (PLAY in TDB2 format)
    const playerTable = file.PLAY;

    if (!playerTable) {
      console.error('[RosterParser] Available tables:', tableNames.join(', '));
      throw new Error('PLAY table not found in roster file');
    }

    console.log('[RosterParser] Found PLAY table with', playerTable.records.length, 'players');

    // Extract player data
    const players = [];
    for (const record of playerTable.records) {
      const player = {};

      // Convert TDB2 fields to plain object
      for (const fieldName in record.fields) {
        player[fieldName] = record.fields[fieldName].value;
      }

      players.push(player);
    }

    console.log('[RosterParser] Successfully extracted', players.length, 'players');

    // CRITICAL: Read BTYP from BLBM and update PCBT to show actual in-game body type
    // The game reads body type from BTYP in BLBM, not PCBT in PLAY!
    try {
      const blob = file.BLOB?.records?.[0];
      const blbm = blob?.fields?.['BLBM']?.value;

      if (blbm && blbm._records) {
        console.log('[RosterParser] Syncing PCBT from BTYP (BLBM) - showing actual in-game values');
        console.log(`[RosterParser] BLBM has ${blbm._records.length} records`);
        let syncedCount = 0;
        let skippedNoBTYP = 0;
        let skippedNoChange = 0;
        const BODY_NAMES = ['Standard', 'Thin', 'Muscular', 'Heavy', 'Lean'];

        for (let i = 0; i < players.length && i < blbm._records.length; i++) {
          const blbmRec = blbm._records[i];
          const fields = blbmRec.fields || blbmRec._fields;

          if (!fields || !fields['BTYP']) {
            skippedNoBTYP++;
            continue;
          }

          const btyp = fields['BTYP'].value ?? fields['BTYP']._value;
          const pcbt = players[i].PCBT;

          // Log first 5 players for debugging
          if (i < 5) {
            console.log(`[RosterParser] Player ${i} (${players[i].PFNA} ${players[i].PLNA}): PCBT=${pcbt}(${BODY_NAMES[pcbt] || '?'}), BTYP=${btyp}(${BODY_NAMES[btyp] || '?'})`);
          }

          if (btyp !== undefined && btyp !== null && pcbt !== btyp) {
            players[i].PCBT = btyp;
            syncedCount++;
          } else {
            skippedNoChange++;
          }
        }

        console.log(`[RosterParser] BTYP sync results: ${syncedCount} synced, ${skippedNoBTYP} missing BTYP, ${skippedNoChange} already matched`);

        // Also sync SKNT (skin tone) to PLRC
        let skntSyncedCount = 0;
        let skntSkippedNoField = 0;
        let skntSkippedNoChange = 0;

        for (let i = 0; i < players.length && i < blbm._records.length; i++) {
          const blbmRec = blbm._records[i];
          const fields = blbmRec.fields || blbmRec._fields;

          if (!fields || !fields['SKNT']) {
            skntSkippedNoField++;
            continue;
          }

          const sknt = fields['SKNT'].value ?? fields['SKNT']._value;
          const plrc = players[i].PLRC;

          if (sknt !== undefined && sknt !== null && sknt >= 1 && sknt <= 7) {
            if (plrc !== sknt) {
              players[i].PLRC = sknt;
              skntSyncedCount++;
            } else {
              skntSkippedNoChange++;
            }
          } else {
            // Default PLRC to 4 (middle skin tone) if SKNT is invalid
            if (!plrc || plrc < 1 || plrc > 7) {
              players[i].PLRC = 4;
            }
          }
        }

        console.log(`[RosterParser] SKNT->PLRC sync results: ${skntSyncedCount} synced, ${skntSkippedNoField} missing SKNT, ${skntSkippedNoChange} already matched`);
      } else {
        console.log('[RosterParser] WARNING: No BLBM table found for BTYP sync');
      }
    } catch (btypErr) {
      console.warn('[RosterParser] Failed to sync PCBT from BTYP:', btypErr.message);
      // Non-fatal - continue with PCBT values as-is
    }

    // Log sample player with ALL field names
    if (players.length > 0) {
      const sample = players[0];
      const allFields = Object.keys(sample).sort();

      console.log('[RosterParser] Sample player:', {
        firstName: sample.PFNA,
        lastName: sample.PLNA,
        overall: sample.POVR,
        position: sample.PPOS,
        age: sample.PAGE,
        birthday: sample.PLBD,
        archetype: sample.PLTY,
        PEPS: sample.PEPS,
        PCBT: sample.PCBT  // Body type
      });

      // Debug: Log PCBT values for first 10 players
      console.log('[RosterParser] *** PCBT LOAD DEBUG - First 10 players ***');
      for (let i = 0; i < Math.min(10, players.length); i++) {
        const p = players[i];
        console.log(`  Player ${i}: ${p.PFNA} ${p.PLNA} - PCBT=${p.PCBT} (${['Standard','Thin','Muscular','Heavy','Lean'][p.PCBT] || 'Unknown'})`);
      }

      // Debug: Check for body-type related fields
      const bodyFields = allFields.filter(f =>
        f.includes('PCB') || f.includes('BOD') || f.includes('BTY') ||
        f.includes('WLBS') || f.includes('body') || f.includes('Body')
      );
      console.log('[RosterParser] Body-related fields found:', bodyFields.join(', ') || 'NONE');
      if (bodyFields.length > 0) {
        bodyFields.forEach(f => {
          console.log(`  ${f} = ${sample[f]}`);
        });
      }

      // Extra debug for name fields
      console.log('[RosterParser] 🔍 NAME FIELD DEBUG:');
      console.log(`  PFNA exists: ${sample.hasOwnProperty('PFNA')}, value: "${sample.PFNA}", type: ${typeof sample.PFNA}`);
      console.log(`  PLNA exists: ${sample.hasOwnProperty('PLNA')}, value: "${sample.PLNA}", type: ${typeof sample.PLNA}`);
      console.log(`  First 5 players names:`);
      for (let i = 0; i < Math.min(5, players.length); i++) {
        console.log(`    Player ${i}: "${players[i].PFNA}" "${players[i].PLNA}" (Overall: ${players[i].POVR})`);
      }

      console.log('[RosterParser] Total fields:', allFields.length);

      // Check for birthday/age/archetype fields specifically
      const birthdayFields = allFields.filter(f => f.toLowerCase().includes('birth') || f === 'PLBD' || f === 'PAGE' || f === 'PLTY');
      console.log('[RosterParser] Birthday/Age/Archetype fields found:', birthdayFields.join(', '));

      // Log values for these fields to verify they have data
      if (birthdayFields.length > 0) {
        console.log('[RosterParser] Field values:');
        birthdayFields.forEach(field => {
          console.log(`  ${field} = ${sample[field]} (type: ${typeof sample[field]})`);
        });
      }
    }

    // Load INJY (Injury) table to identify injured players
    // Injuries are stored in separate table, linked by PGID
    let injuredPGIDs = [];
    try {
      const injyTable = file.INJY;
      if (injyTable && injyTable.records) {
        console.log('[RosterParser] Found INJY table with', injyTable.records.length, 'injury records');

        for (const record of injyTable.records) {
          const pgid = record.fields?.PGID?.value;
          if (pgid !== undefined && pgid !== null) {
            injuredPGIDs.push(pgid);
          }
        }

        console.log('[RosterParser] Extracted', injuredPGIDs.length, 'injured player PGIDs');

        // Debug: Show first 5 injured players
        if (injuredPGIDs.length > 0) {
          console.log('[RosterParser] First 5 injured PGIDs:', injuredPGIDs.slice(0, 5).join(', '));
          // Find their names
          for (let i = 0; i < Math.min(5, injuredPGIDs.length); i++) {
            const injuredPlayer = players.find(p => p.PGID === injuredPGIDs[i]);
            if (injuredPlayer) {
              console.log(`  PGID ${injuredPGIDs[i]}: ${injuredPlayer.PFNA} ${injuredPlayer.PLNA}`);
            }
          }
        }
      } else {
        console.log('[RosterParser] No INJY table found - no injuries to track');
      }
    } catch (injyErr) {
      console.warn('[RosterParser] Failed to load INJY table:', injyErr.message);
      // Non-fatal - continue without injury data
    }

    // Store file and helper in a map keyed by file path
    // This allows multiple files to be open and prevents data loss when saving
    if (!global.rosterFiles) {
      global.rosterFiles = new Map();
    }
    global.rosterFiles.set(filePath, { helper, file });

    // Also store in global scope for backward compatibility
    global.rosterFile = file;
    global.rosterHelper = helper;

    return {
      version: 2026, // Madden 26
      playerCount: players.length,
      players: players,
      injuredPGIDs: injuredPGIDs, // Array of injured player PGIDs from INJY table
      teams: [], // TODO: Extract team data from TEAM table
      filePath: filePath // Store file path to retrieve helper/file later
    };

  } catch (error) {
    console.error('[RosterParser] ===== ERROR IN PARSE =====');
    console.error('[RosterParser] Error type:', error.constructor.name);
    console.error('[RosterParser] Error message:', error.message);
    console.error('[RosterParser] Error stack:', error.stack);
    console.error('[RosterParser] ===========================');
    throw new Error(`Failed to parse roster file: ${error.message}`);
  }
}

/**
 * Save roster file
 * @param {string} filePath - Path to save the roster file
 * @param {Array} players - Array of player data
 * @param {Object} originalData - Original parsed data (contains filePath to retrieve helper/file)
 */
async function saveRosterFile(filePath, players, originalData) {
  console.log('[RosterParser] ===== START ROSTER SAVE =====');
  console.log('[RosterParser] Output path:', filePath);
  console.log('[RosterParser] Original data:', originalData ? `filePath: ${originalData.filePath}` : 'none');

  try {
    const sourcePath = originalData?.filePath;

    // CRITICAL FIX: If saving to the same file we loaded from, we MUST reload it fresh
    // to avoid in-memory corruption during the save operation
    const savingToSameFile = (sourcePath === filePath);

    let helper, file;

    if (savingToSameFile) {
      console.log('[RosterParser] ⚠️  CRITICAL: Saving to same file - reloading fresh copy to prevent corruption');
      // Load a fresh copy of the file
      helper = new MaddenRosterHelper();
      file = await helper.load(sourcePath);
      console.log('[RosterParser] Fresh copy loaded successfully');
    } else {
      // Different file - safe to use cached version
      if (sourcePath && global.rosterFiles) {
        const stored = global.rosterFiles.get(sourcePath);
        if (stored) {
          helper = stored.helper;
          file = stored.file;
          console.log('[RosterParser] Retrieved helper/file from stored map for:', sourcePath);
        }
      }

      // Fall back to globals if not found
      if (!helper || !file) {
        helper = global.rosterHelper;
        file = global.rosterFile;
        console.log('[RosterParser] Using global helper/file as fallback');
      }
    }

    if (!helper || !file) {
      throw new Error('No roster file data available - must load before saving');
    }

    // Update player values in the TDB2 file
    const playerTable = file.PLAY;

    console.log('[RosterParser] ===== SAVE DEBUG =====');
    console.log('[RosterParser] Template has', playerTable.records.length, 'record slots');
    console.log('[RosterParser] We have', players.length, 'players to write');
    console.log('[RosterParser] Will update MIN(', players.length, ',', playerTable.records.length, ') records');
    let fieldsUpdated = 0;

    // Lookup maps to convert string display names back to numeric IDs
    const LOOKUP_STRING_TO_ID = {
      PCBT: { 'Standard': 0, 'Thin': 1, 'Muscular': 2, 'Heavy': 3, 'Lean': 4 },
      PHAN: { 'Right': 0, 'Left': 1 },
      PROL: { 'Normal': 0, 'Star': 1, 'Superstar': 2, 'X-Factor': 3 }
    };

    for (let i = 0; i < players.length && i < playerTable.records.length; i++) {
      const record = playerTable.records[i];
      const playerData = players[i];

      // Update each field (exclude PLAYERPIC - it's a virtual field for display only)
      for (const fieldName in playerData) {
        if (fieldName === 'PLAYERPIC') {
          continue; // Skip virtual field
        }
        if (record.fields[fieldName]) {
          const oldValue = record.fields[fieldName].value;
          let newValue = playerData[fieldName];

          // CRITICAL: Convert string display names back to numeric IDs for lookup fields
          if (LOOKUP_STRING_TO_ID[fieldName] && typeof newValue === 'string') {
            const numericId = LOOKUP_STRING_TO_ID[fieldName][newValue];
            if (numericId !== undefined) {
              console.log(`[RosterParser] Converting ${fieldName}: "${newValue}" -> ${numericId}`);
              newValue = numericId;
            } else {
              console.warn(`[RosterParser] WARNING: Unknown ${fieldName} value "${newValue}", keeping as-is`);
            }
          }

          record.fields[fieldName].value = newValue;

          // Log PEPS changes
          if (fieldName === 'PEPS' && oldValue !== newValue) {
            console.log(`[RosterParser] Player ${i}: PEPS changed from "${oldValue}" to "${newValue}"`);
          }
          // Log PGHE changes (face model)
          if (fieldName === 'PGHE' && oldValue !== newValue) {
            console.log(`[RosterParser] Player ${i}: PGHE changed from ${oldValue} to ${newValue}`);
          }
          // Log PHAN changes (handedness) - DEBUG for save issue
          if (fieldName === 'PHAN' && oldValue !== newValue) {
            console.log(`[RosterParser] Player ${i} (${playerData.PFNA} ${playerData.PLNA}): PHAN changed from ${oldValue} to ${newValue}`);
          }
          // Log PROL changes (dev trait) - DEBUG
          if (fieldName === 'PROL' && oldValue !== newValue) {
            console.log(`[RosterParser] Player ${i} (${playerData.PFNA} ${playerData.PLNA}): PROL changed from ${oldValue} to ${newValue}`);
          }
          // Log PCBT changes (body type) - DEBUG
          if (fieldName === 'PCBT') {
            console.log(`[RosterParser] *** PCBT SAVE DEBUG *** Player ${i} (${playerData.PFNA} ${playerData.PLNA}): PCBT file=${oldValue}, incoming=${newValue}, changed=${oldValue !== newValue}`);
          }

          fieldsUpdated++;
        } else if (fieldName === 'PEPS') {
          console.log(`[RosterParser] WARNING: Player ${i} has no PEPS field in record!`);
        } else if (fieldName === 'PHAN') {
          console.log(`[RosterParser] WARNING: Player ${i} has no PHAN field in record! Value would be: ${playerData[fieldName]}`);
        }
      }
    }

    console.log('[RosterParser] Updated', fieldsUpdated, 'field values');
    console.log('[RosterParser] Original record has', Object.keys(playerTable.records[0].fields).length, 'fields - all preserved');

    // Track results for debugging
    let blbmUpdated = 0;
    let btypSynced = 0;
    let genericFaceServiceLoaded = !!genericFaceService;
    let blbmError = null;

    // Update BLBM with race-appropriate generic faces for players without PAM
    console.log('[RosterParser] genericFaceService loaded:', genericFaceService ? 'YES' : 'NULL');
    if (genericFaceService) {
      try {
        console.log('[RosterParser] Updating BLBM generic faces...');

        // DEBUG: Check if assignedGenr values survived IPC
        const playersWithAssignedGenr = players.filter(p => p.assignedGenr);
        const playersWithAssignedSknt = players.filter(p => p.assignedSknt !== undefined);
        console.log(`[RosterParser] DEBUG: ${playersWithAssignedGenr.length} players have assignedGenr, ${playersWithAssignedSknt.length} have assignedSknt`);
        if (playersWithAssignedGenr.length > 0) {
          const sample = playersWithAssignedGenr[0];
          console.log(`[RosterParser] DEBUG Sample: ${sample.PFNA} ${sample.PLNA}, assignedGenr="${sample.assignedGenr}", assignedSknt=${sample.assignedSknt}`);
        } else if (players.length > 0) {
          // Debug: What properties DOES the first player have?
          const first = players[0];
          const props = Object.keys(first).filter(k => k.includes('assigned') || k.includes('genr') || k.includes('sknt') || k.startsWith('_'));
          console.log(`[RosterParser] DEBUG: First player special props: ${JSON.stringify(props)}`);
          console.log(`[RosterParser] DEBUG: First player._genr=${first._genr}, _sknt=${first._sknt}`);
        }

        blbmUpdated = await genericFaceService.updateBLBMForGenericFaces(file, players);
        console.log('[RosterParser] BLBM updates complete:', blbmUpdated, 'players updated');

        // CRITICAL: Sync BTYP (body type) in BLBM for ALL players
        // The game reads body type from BTYP in BLBM, not PCBT in PLAY!
        btypSynced = await genericFaceService.syncBodyTypeForAllPlayers(file, players);
        console.log('[RosterParser] BTYP sync complete:', btypSynced, 'players synced');

        // Sync SKNT (skin tone) in BLBM from PLRC for ALL players
        // The game reads skin tone from SKNT in BLBM
        const skntSynced = await genericFaceService.syncSkinToneForAllPlayers(file, players);
        console.log('[RosterParser] SKNT sync complete:', skntSynced, 'players synced');
      } catch (err) {
        blbmError = err.message;
        console.warn('[RosterParser] BLBM update failed (non-fatal):', err.message);
        // Continue - this is non-fatal
      }
    } else {
      console.error('[RosterParser] *** CRITICAL: GenericFaceService is NULL - BLBM will NOT be updated! ***');
    }

    // Save using MaddenRosterHelper
    await helper.save(filePath);

    console.log('[RosterParser] Roster saved successfully');

    // Run presentationIdFix to fix comm IDs before completing save
    try {
      const { presentationIdFixService } = require('../services/PresentationIdFixService');
      console.log('[RosterParser] Running presentation ID fix...');
      await presentationIdFixService.fixPresentationIds(filePath);
    } catch (fixError) {
      console.warn('[RosterParser] Presentation ID fix failed (non-fatal):', fixError.message);
      // Continue - this is non-fatal
    }

    console.log('[RosterParser] ===========================');

    // Return save results for debugging
    return {
      genericFaceServiceLoaded,
      blbmUpdated,
      btypSynced,
      blbmError
    };

  } catch (error) {
    console.error('[RosterParser] ===== ERROR IN SAVE =====');
    console.error('[RosterParser] Error:', error.message);
    console.error('[RosterParser] ========================');
    throw new Error(`Failed to save roster file: ${error.message}`);
  }
}

module.exports = {
  parseRosterFile,
  saveRosterFile
};
