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

// CRITICAL: Track pending equipment changes that need to be applied during save
// This is necessary because saveRosterFile reloads the file fresh, discarding any
// in-memory modifications made by setPlayerEquipment
const pendingEquipmentChanges = new Map(); // Map<playerIndex, equipmentData>
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

  // Clear any pending equipment changes from previous sessions
  // to prevent stale data from being applied to the new file
  if (pendingEquipmentChanges.size > 0) {
    console.log(`[RosterParser] Clearing ${pendingEquipmentChanges.size} stale pending equipment changes`);
    pendingEquipmentChanges.clear();
  }

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

    // Extract player data - just read what's in the file, no syncing
    // CRITICAL: Skip empty/unused record slots (they have no name or POVR=0)
    const players = [];
    let skippedEmpty = 0;
    for (const record of playerTable.records) {
      const player = {};

      // Convert TDB2 fields to plain object
      for (const fieldName in record.fields) {
        player[fieldName] = record.fields[fieldName].value;
      }

      // Skip empty player slots (no name, or name is empty, or POVR is 0 with no name)
      const firstName = (player.PFNA || '').trim();
      const lastName = (player.PLNA || '').trim();
      const hasName = firstName.length > 0 || lastName.length > 0;
      const hasValidPOVR = player.POVR && player.POVR > 0;

      // A player slot is empty if it has no name AND no valid overall rating
      if (!hasName && !hasValidPOVR) {
        skippedEmpty++;
        continue;
      }

      players.push(player);
    }

    console.log('[RosterParser] Successfully extracted', players.length, 'players');
    if (skippedEmpty > 0) {
      console.log(`[RosterParser] Skipped ${skippedEmpty} empty record slots`);
    }

    // DEBUG: Check if PKPR field exists in the roster
    const firstPlayer = players[0];
    if (firstPlayer) {
      const allFields = Object.keys(firstPlayer);
      const hasKickFields = allFields.filter(f => f.includes('PK') || f.includes('kick'));
      console.log('[RosterParser] KICKING DEBUG - First player kick fields:', hasKickFields.join(', ') || 'NONE FOUND');
      console.log('[RosterParser] KICKING DEBUG - PKPR value:', firstPlayer.PKPR);
      console.log('[RosterParser] KICKING DEBUG - PKAC value:', firstPlayer.PKAC);
      // Find kickers
      const kickers = players.filter(p => p.PPOS === 19); // K = position 19
      if (kickers.length > 0) {
        console.log('[RosterParser] KICKING DEBUG - Found', kickers.length, 'kickers');
        console.log('[RosterParser] KICKING DEBUG - First kicker PKPR:', kickers[0].PKPR, 'PKAC:', kickers[0].PKAC);
      }
    }

    // CRITICAL DEBUG: Check for duplicate players in the RAW file data
    console.log('[RosterParser] *** DUPLICATE CHECK ON RAW FILE DATA ***');

    // Check for duplicate PGIDs (should be unique identifiers)
    const pgidCounts = new Map();
    players.forEach((p, idx) => {
      if (p.PGID !== undefined && p.PGID !== null) {
        if (!pgidCounts.has(p.PGID)) pgidCounts.set(p.PGID, []);
        pgidCounts.get(p.PGID).push({ idx, name: `${p.PFNA} ${p.PLNA}`, team: p.TGID });
      }
    });
    const duplicatePGIDs = [...pgidCounts.entries()].filter(([k, v]) => v.length > 1);
    console.log(`[RosterParser] DUPLICATE PGIDs IN FILE: ${duplicatePGIDs.length}`);
    if (duplicatePGIDs.length > 0) {
      console.log('[RosterParser] ⚠️ CRITICAL: FILE HAS DUPLICATE PGIDs (record identifiers)!');
      duplicatePGIDs.slice(0, 10).forEach(([pgid, entries]) => {
        console.log(`  PGID ${pgid}: ${entries.length} records`);
        entries.forEach(e => console.log(`    Row ${e.idx}: ${e.name} (Team ${e.team})`));
      });
    }

    // Check for duplicate names
    const nameTeamCounts = new Map();
    players.forEach((p, idx) => {
      const key = `${p.PFNA}|${p.PLNA}|${p.TGID}`;
      if (!nameTeamCounts.has(key)) nameTeamCounts.set(key, []);
      nameTeamCounts.get(key).push({ idx, pgid: p.PGID, pid: p.PSXP });
    });
    const duplicates = [...nameTeamCounts.entries()].filter(([k, v]) => v.length > 1);
    console.log(`[RosterParser] DUPLICATE NAMES IN FILE: ${duplicates.length} players appear multiple times`);
    if (duplicates.length > 0) {
      console.log('[RosterParser] ⚠️ WARNING: FILE CONTAINS DUPLICATE NAME ENTRIES!');
      duplicates.slice(0, 10).forEach(([key, entries]) => {
        const [fn, ln, tgid] = key.split('|');
        console.log(`  "${fn} ${ln}" (Team ${tgid}): ${entries.length} copies`);
        entries.forEach(e => console.log(`    Row ${e.idx}: PGID=${e.pgid}, PID=${e.pid}`));
      });
    }

    // Check consecutive identical rows
    let consecutiveDupes = 0;
    for (let i = 1; i < players.length; i++) {
      const prev = players[i-1];
      const curr = players[i];
      if (prev.PFNA === curr.PFNA && prev.PLNA === curr.PLNA && prev.PSXP === curr.PSXP && prev.TGID === curr.TGID) {
        consecutiveDupes++;
        if (consecutiveDupes <= 5) {
          console.log(`[RosterParser] CONSECUTIVE DUPE rows ${i-1}/${i}: ${curr.PFNA} ${curr.PLNA}`);
        }
      }
    }
    console.log(`[RosterParser] Total consecutive duplicates in raw file: ${consecutiveDupes}`);

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
        archetype: sample.PLTY,  // PLHY is the archetype field (not PLTY)
        PEPS: sample.PEPS,
        PCBT: sample.PCBT  // Body type
      });

      // DEBUG: Check if bio fields exist in roster file
      console.log('[RosterParser] *** BIO FIELDS FROM ROSTER FILE ***');
      console.log(`  PHGT (height): ${sample.PHGT} (exists: ${sample.hasOwnProperty('PHGT')})`);
      console.log(`  PWGT (weight): ${sample.PWGT} (exists: ${sample.hasOwnProperty('PWGT')})`);
      console.log(`  PHSN (homeState): ${sample.PHSN} (exists: ${sample.hasOwnProperty('PHSN')})`);
      console.log(`  PCOL (college): ${sample.PCOL} (exists: ${sample.hasOwnProperty('PCOL')})`);
      console.log(`  PHTN (hometown): ${sample.PHTN} (exists: ${sample.hasOwnProperty('PHTN')})`);
      console.log(`  PLRC (race): ${sample.PLRC} (exists: ${sample.hasOwnProperty('PLRC')})`);
      console.log(`  All fields (${allFields.length}): ${allFields.join(', ')}`);

      // Check if height/weight/state fields exist under different names
      const heightLikeFields = allFields.filter(f => f.includes('HGT') || f.includes('HEIGHT') || f.includes('hgt'));
      const weightLikeFields = allFields.filter(f => f.includes('WGT') || f.includes('WEIGHT') || f.includes('wgt'));
      const stateLikeFields = allFields.filter(f => f.includes('HSN') || f.includes('STATE') || f.includes('state'));
      console.log(`  Height-like fields: ${heightLikeFields.join(', ') || 'NONE'}`);
      console.log(`  Weight-like fields: ${weightLikeFields.join(', ') || 'NONE'}`);
      console.log(`  State-like fields: ${stateLikeFields.join(', ') || 'NONE'}`);

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
      // PLTY is the archetype field that franchise reads
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
          // Only include non-zero PGIDs (0 means empty injury slot)
          if (pgid !== undefined && pgid !== null && pgid > 0) {
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

    // CRITICAL: Populate PLRC from BLBM's SKNT if not present in PLAY table
    // The PLAY table in some templates may not have PLRC, but BLBM always has SKNT
    const needsPlrcFallback = players.length > 0 && players[0].PLRC === undefined;
    if (needsPlrcFallback) {
      console.log('[RosterParser] PLRC not in PLAY table - loading from BLBM.SKNT as fallback');
      try {
        const blob = file.BLOB?.records?.[0];
        const blbm = blob?.fields?.['BLBM']?.value;
        if (blbm && blbm._records) {
          let populatedCount = 0;
          for (let i = 0; i < players.length && i < blbm._records.length; i++) {
            const blbmRec = blbm._records[i];
            const fields = blbmRec.fields || blbmRec._fields;
            if (fields && fields['SKNT']) {
              const sknt = fields['SKNT'].value ?? fields['SKNT']._value;
              if (sknt !== undefined && sknt >= 1 && sknt <= 7) {
                players[i].PLRC = sknt;
                populatedCount++;
              }
            }
          }
          console.log(`[RosterParser] Populated PLRC from SKNT for ${populatedCount} players`);
        } else {
          console.log('[RosterParser] Could not find BLBM table to populate PLRC');
        }
      } catch (blbmErr) {
        console.warn('[RosterParser] Failed to populate PLRC from BLBM:', blbmErr.message);
      }
    }

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
 * @param {Object} options - Save options
 * @param {boolean} options.clearInjuries - If true, clears all INJY table records
 */
async function saveRosterFile(filePath, players, originalData, options = {}) {
  console.log('[RosterParser] ===== START ROSTER SAVE =====');
  console.log('[RosterParser] Output path:', filePath);
  console.log('[RosterParser] Original data:', originalData ? `filePath: ${originalData.filePath}` : 'none');
  console.log('[RosterParser] Options:', JSON.stringify(options));

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

    // CRITICAL: Apply any pending equipment changes to the file
    // This is necessary because equipment changes are queued separately and
    // we just reloaded a fresh copy of the file (discarding in-memory changes)
    const equipmentUpdated = applyPendingEquipmentChanges(file);
    if (equipmentUpdated > 0) {
      console.log(`[RosterParser] Applied ${equipmentUpdated} pending equipment changes before save`);
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
      PROL: { 'Normal': 0, 'Star': 1, 'Superstar': 2, 'X-Factor': 3, 'Hidden': 4 }
    };

    // Map internal field names to TDB2 roster file field names
    // Some services use different field codes internally than the roster file format
    const INTERNAL_TO_TDB2_FIELD_MAP = {
      'PKPW': 'PKPR',  // Kick power: internal=PKPW, TDB2=PKPR
      'PSTM': 'PSTA',  // Stamina: internal=PSTM, TDB2=PSTA
      'PBTK': 'PBKT',  // Break tackle: internal=PBTK, TDB2=PBKT
      'PTRK': 'PLTR',  // Trucking: internal=PTRK, TDB2=PLTR
      'PCOD': 'PELU',  // Change of direction: internal=PCOD, TDB2=PELU
      'PSFA': 'PLSA',  // Stiff arm: internal=PSFA, TDB2=PLSA
      'PSPN': 'PLSM',  // Spin move: internal=PSPN, TDB2=PLSM
      'PJKM': 'PLJM',  // Juke move: internal=PJKM, TDB2=PLJM
      'PPWR': 'PTHP',  // Throw power: internal=PPWR, TDB2=PTHP
      'PSPC': 'PLSC',  // Spectacular catch: internal=PSPC, TDB2=PLSC
      'PCIT': 'PLCI',  // Catch in traffic: internal=PCIT, TDB2=PLCI
      'PSRR': 'SRRN',  // Short route running: internal=PSRR, TDB2=SRRN
      'PREL': 'PLRL',  // Release: internal=PREL, TDB2=PLRL
      'PIBK': 'PLIB',  // Impact blocking: internal=PIBK, TDB2=PLIB
      'PRNS': 'PRBF',  // Run block finesse: internal=PRNS, TDB2=PRBF
      'PPBP': 'PPBS',  // Pass block power: internal=PPBP, TDB2=PPBS
      'PHIT': 'PLHT',  // Hit power: internal=PHIT, TDB2=PLHT
      'PPRS': 'PLPE',  // Press: internal=PPRS, TDB2=PLPE
      'PFMV': 'PFMS',  // Finesse moves: internal=PFMV, TDB2=PFMS
      'PPWM': 'PLPM',  // Power moves: internal=PPWM, TDB2=PLPM
      'PBSH': 'PBSG',  // Block shedding: internal=PBSH, TDB2=PBSG
      'PPRC': 'PLPR',  // Play recognition: internal=PPRC, TDB2=PLPR
      'PPUR': 'PLPU',  // Pursuit: internal=PPUR, TDB2=PLPU
      'PMCV': 'PLMC',  // Man coverage: internal=PMCV, TDB2=PLMC
      'PZCV': 'PLZC',  // Zone coverage: internal=PZCV, TDB2=PLZC
    };

    // DEBUG: Check if PKPR exists in template
    const firstRecord = playerTable.records[0];
    if (firstRecord) {
      const templateFields = Object.keys(firstRecord.fields);
      const templateKickFields = templateFields.filter(f => f.includes('PK') || f.includes('kick'));
      console.log('[RosterParser] SAVE DEBUG - Template kick fields:', templateKickFields.join(', ') || 'NONE');
      console.log('[RosterParser] SAVE DEBUG - Template has PKPR field:', !!firstRecord.fields.PKPR);
    }

    // DEBUG: Check kickers being saved
    const kickersToSave = players.filter(p => p.PPOS === 19);
    if (kickersToSave.length > 0) {
      const k = kickersToSave[0];
      console.log('[RosterParser] SAVE DEBUG - First kicker to save:', k.PFNA, k.PLNA);
      console.log('[RosterParser] SAVE DEBUG - Kicker PKPR:', k.PKPR, 'PKPW:', k.PKPW, 'PKAC:', k.PKAC);
      console.log('[RosterParser] SAVE DEBUG - Will map PKPW to PKPR for save');
    }

    for (let i = 0; i < players.length && i < playerTable.records.length; i++) {
      const record = playerTable.records[i];
      const playerData = players[i];

      // Update each field (exclude PLAYERPIC - it's a virtual field for display only)
      for (const fieldName in playerData) {
        if (fieldName === 'PLAYERPIC') {
          continue; // Skip virtual field
        }

        // Map internal field name to TDB2 field name if needed
        // This handles cases where services use different codes than the roster file format
        const tdb2FieldName = INTERNAL_TO_TDB2_FIELD_MAP[fieldName] || fieldName;

        // Try mapped field name first, then original name as fallback
        const targetFieldName = record.fields[tdb2FieldName] ? tdb2FieldName :
                                record.fields[fieldName] ? fieldName : null;

        if (targetFieldName && record.fields[targetFieldName]) {
          const oldValue = record.fields[targetFieldName].value;
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

          record.fields[targetFieldName].value = newValue;

          // Log field mapping when it differs
          if (fieldName !== targetFieldName && oldValue !== newValue) {
            console.log(`[RosterParser] Player ${i}: Mapped ${fieldName} -> ${targetFieldName}: ${oldValue} -> ${newValue}`);
          }

          // Log PEPS changes
          if (targetFieldName === 'PEPS' && oldValue !== newValue) {
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
          // Log PLPL changes (generic/real face indicator) - DEBUG for PAM-only mode
          if (fieldName === 'PLPL' && oldValue !== newValue) {
            console.log(`[RosterParser] Player ${i} (${playerData.PFNA} ${playerData.PLNA}): PLPL changed from ${oldValue} to ${newValue}`);
          }

          fieldsUpdated++;
        } else if (fieldName === 'PEPS') {
          console.log(`[RosterParser] WARNING: Player ${i} has no PEPS field in record!`);
        } else if (fieldName === 'PHAN') {
          console.log(`[RosterParser] WARNING: Player ${i} has no PHAN field in record! Value would be: ${playerData[fieldName]}`);
        } else if (fieldName === 'PLRC') {
          console.log(`[RosterParser] WARNING: Player ${i} has no PLRC field in record! Value would be: ${playerData[fieldName]}`);
          // List available fields for debugging
          if (i === 0) {
            console.log(`[RosterParser] Available record fields:`, Object.keys(record.fields).join(', '));
          }
        }
      }
    }

    console.log('[RosterParser] Updated', fieldsUpdated, 'field values');
    console.log('[RosterParser] Original record has', Object.keys(playerTable.records[0].fields).length, 'fields - all preserved');

    // CRITICAL FIX: Set POID = PGID for all players
    // The game links PLAY records to BLBM records by finding BLBM[].index === POID
    // Our BLBM records have .index === PGID, so POID MUST equal PGID for proper visual linkage
    // Without this fix, players get wrong faces because the game can't find their BLBM record
    console.log('[RosterParser] *** POID FIX: Setting POID = PGID for proper BLBM linkage ***');
    let poidFixedCount = 0;
    for (let i = 0; i < players.length && i < playerTable.records.length; i++) {
      const record = playerTable.records[i];
      const poidField = record.fields['POID'];
      const pgidField = record.fields['PGID'];

      if (poidField && pgidField) {
        const currentPoid = poidField.value;
        const pgid = pgidField.value;

        if (currentPoid !== pgid && pgid !== undefined && pgid !== null && pgid > 0) {
          poidField.value = pgid;
          poidFixedCount++;

          // Log first few fixes for debugging
          if (poidFixedCount <= 5) {
            const playerName = `${record.fields['PFNA']?.value || ''} ${record.fields['PLNA']?.value || ''}`.trim();
            console.log(`[RosterParser] POID fix ${poidFixedCount}: ${playerName} - POID ${currentPoid} -> ${pgid}`);
          }
        }
      }
    }
    console.log(`[RosterParser] POID fix complete: ${poidFixedCount} players updated (POID now equals PGID)`);

    // CRITICAL FIX: For custom portrait PIDs (>= 12000), set PEPS from BLBM.GENR
    // This ensures modded portraits persist after in-game editing
    // The game checks PEPS - if empty, it regenerates the player's appearance on edit
    // Fix: PEPS = BLBM.GENR, BLBM.ASNM = BLBM.GENR, PLPL=100, PGHE=0
    const CUSTOM_PORTRAIT_PID_START = 12000;
    console.log('[RosterParser] *** PORTRAIT FIX: Setting PEPS from GENR for custom portrait PIDs ***');

    // Get BLBM table
    const blobTable = file.BLOB?.records?.[0];
    const blbmField = blobTable?.fields?.BLBM?.value;
    const blbmRecords = blbmField?.records || blbmField?._records || [];

    let portraitFixedCount = 0;
    for (let i = 0; i < players.length && i < playerTable.records.length; i++) {
      const record = playerTable.records[i];
      const psxpField = record.fields['PSXP'];
      const pepsField = record.fields['PEPS'];
      const plplField = record.fields['PLPL'];
      const pgheField = record.fields['PGHE'];
      const poidField = record.fields['POID'];

      if (psxpField && pepsField && plplField && pgheField && poidField) {
        const psxp = psxpField.value;
        const currentPeps = pepsField.value || '';
        const poid = poidField.value;

        // If this is a custom portrait PID with empty PEPS, fix it
        if (psxp >= CUSTOM_PORTRAIT_PID_START && (!currentPeps || currentPeps.length === 0)) {
          // Find BLBM record by POID
          const blbmRec = blbmRecords.find(r => r.index === poid);

          if (blbmRec) {
            const bf = blbmRec.fields || blbmRec._fields;
            const genr = bf?.GENR?.value ?? bf?.GENR?._value;

            if (genr && genr.length > 0) {
              // Set PEPS = GENR
              pepsField.value = genr;
              if (players[i]) players[i].PEPS = genr;

              // Set BLBM.ASNM = GENR
              if (bf?.ASNM) {
                if (bf.ASNM.value !== undefined) bf.ASNM.value = genr;
                else if (bf.ASNM._value !== undefined) bf.ASNM._value = genr;
              }

              // Set PLPL=100, PGHE=0
              plplField.value = 100;
              pgheField.value = 0;
              if (players[i]) {
                players[i].PLPL = 100;
                players[i].PGHE = 0;
              }

              portraitFixedCount++;
              if (portraitFixedCount <= 5) {
                const playerName = `${record.fields['PFNA']?.value || ''} ${record.fields['PLNA']?.value || ''}`.trim();
                console.log(`[RosterParser] Portrait fix ${portraitFixedCount}: ${playerName} - PEPS="${genr}", PLPL=100, PGHE=0`);
              }
            }
          }
        }
      }
    }
    console.log(`[RosterParser] Portrait fix complete: ${portraitFixedCount} custom portrait players fixed`);

    // CRITICAL FIX: Clear unused record slots beyond players.length
    // This prevents "ghost" duplicates from remaining in the file when players are removed
    let clearedSlots = 0;
    if (players.length < playerTable.records.length) {
      console.log(`[RosterParser] *** CLEARING ${playerTable.records.length - players.length} UNUSED RECORD SLOTS ***`);
      for (let i = players.length; i < playerTable.records.length; i++) {
        const record = playerTable.records[i];
        // Clear player identity fields to make this an "empty" slot
        if (record.fields['PFNA']) record.fields['PFNA'].value = '';
        if (record.fields['PLNA']) record.fields['PLNA'].value = '';
        if (record.fields['PGID']) record.fields['PGID'].value = 0;
        if (record.fields['TGID']) record.fields['TGID'].value = 1009; // Free agent team
        if (record.fields['PSXP']) record.fields['PSXP'].value = 0; // Clear PID
        if (record.fields['PEPS']) record.fields['PEPS'].value = ''; // Clear PAM
        if (record.fields['POVR']) record.fields['POVR'].value = 0; // Clear overall
        if (record.fields['PPOS']) record.fields['PPOS'].value = 0; // Clear position
        if (record.fields['PAGE']) record.fields['PAGE'].value = 0; // Clear age
        clearedSlots++;
      }
      console.log(`[RosterParser] Cleared ${clearedSlots} unused record slots`);
    }

    // Track results for debugging
    let blbmUpdated = 0;
    let btypSynced = 0;
    let skntSynced = 0;
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
        skntSynced = await genericFaceService.syncSkinToneForAllPlayers(file, players);
        console.log('[RosterParser] SKNT sync complete:', skntSynced, 'players synced');

        // CRITICAL: Sync player identity fields (name, jersey, height) from PLAY to BLBM
        // Without this, BLBM records may contain stale data from template (wrong player!)
        const identitySynced = await genericFaceService.syncPlayerIdentityForAllPlayers(file, players);
        console.log('[RosterParser] Player identity sync complete:', identitySynced, 'players synced');
      } catch (err) {
        blbmError = err.message;
        console.warn('[RosterParser] BLBM update failed (non-fatal):', err.message);
        // Continue - this is non-fatal
      }
    } else {
      console.error('[RosterParser] *** CRITICAL: GenericFaceService is NULL - BLBM will NOT be updated! ***');
    }

    // Clear injuries if requested
    let injuriesCleared = 0;
    if (options.clearInjuries) {
      console.log('[RosterParser] Clearing INJY table (injuries)...');
      const injyTable = file.INJY;
      if (injyTable && injyTable.records) {
        for (const record of injyTable.records) {
          // Clear all injury fields
          if (record.fields['PGID']?.value) {
            record.fields['PGID'].value = 0;
            injuriesCleared++;
          }
          if (record.fields['TGID']) record.fields['TGID'].value = 0;
          if (record.fields['INJL']) record.fields['INJL'].value = 0;
          if (record.fields['INJR']) record.fields['INJR'].value = 0;
          if (record.fields['INJS']) record.fields['INJS'].value = 0;
          if (record.fields['INJT']) record.fields['INJT'].value = 0;
          if (record.fields['INIR']) record.fields['INIR'].value = 0;
          if (record.fields['INSI']) record.fields['INSI'].value = 0;
          if (record.fields['INTW']) record.fields['INTW'].value = 0;
        }
        console.log(`[RosterParser] Cleared ${injuriesCleared} injury records`);
      } else {
        console.log('[RosterParser] No INJY table found to clear');
      }
    }

    // Before saving, attempt to sync the FBCHUNKS appearance JSON (in headerBuffer)
    // so the editor preview (which reads the FBCHUNKS visuals) matches BLBM values
    try {
      if (helper && helper._headerBuffer && players && players.length > 0) {
        console.log('[RosterParser] Attempting to sync FBCHUNKS visuals JSON in headerBuffer...');
        let hb = helper._headerBuffer;
        let s = hb.toString('utf8');

        // Find JSON object spans by scanning for balanced braces (ignore strings)
        let objs = [];
        let inStr = false;
        let esc = false;
        let depth = 0;
        let start = -1;
        for (let i = 0; i < s.length; i++) {
          const ch = s[i];
          if (ch === '"' && !esc) inStr = !inStr;
          if (inStr && ch === '\\') esc = !esc; else esc = false;
          if (!inStr) {
            if (ch === '{') {
              if (depth === 0) start = i;
              depth++;
            } else if (ch === '}') {
              depth--;
              if (depth === 0 && start !== -1) {
                objs.push({ start: start, end: i + 1 });
                start = -1;
              }
            }
          }
        }

        if (objs.length > 0) {
          // Update each JSON object that contains a bodyType property
          for (let idx = 0; idx < objs.length && idx < players.length; idx++) {
            const pos = objs[idx];
            const sub = s.slice(pos.start, pos.end);
            let parsed = null;
            try {
              parsed = JSON.parse(sub);
            } catch (e) {
              continue;
            }

            if (parsed && Object.prototype.hasOwnProperty.call(parsed, 'bodyType')) {
              const player = players[idx];
              if (!player) continue;

              // Sync bodyType from PLAY.PCBT
              parsed.bodyType = player.PCBT;

              // Sync weight/size fields if present (try common keys)
              const pwgt = player.PWGT;
              const actualWeight = (pwgt !== undefined && pwgt !== null) ? (pwgt + 160) : null;
              if (actualWeight !== null) {
                if (Object.prototype.hasOwnProperty.call(parsed, 'weight')) parsed.weight = actualWeight;
                if (Object.prototype.hasOwnProperty.call(parsed, 'WLBS')) parsed.WLBS = actualWeight;
                if (Object.prototype.hasOwnProperty.call(parsed, 'wlbs')) parsed.wlbs = actualWeight;
                if (Object.prototype.hasOwnProperty.call(parsed, 'size')) parsed.size = actualWeight;
              }

              // CRITICAL: Also update loadoutElements with slotType "characterbodytype"
              // The game reads body type from BOTH the top-level bodyType AND the loadout element
              // PCBT values: 0=Standard, 1=Thin, 2=Muscular, 3=Heavy, 4=Lean
              const BODY_TYPE_ASSET_NAMES_HDR = ['standard_bodytype', 'thin_bodytype', 'muscular_bodytype', 'heavy_bodytype', 'lean_bodytype'];
              const bodyTypeAssetHdr = BODY_TYPE_ASSET_NAMES_HDR[player.PCBT] || 'standard_bodytype';
              if (parsed.loadouts && Array.isArray(parsed.loadouts)) {
                for (const loadout of parsed.loadouts) {
                  if (loadout.loadoutElements && Array.isArray(loadout.loadoutElements)) {
                    for (const element of loadout.loadoutElements) {
                      if (element.slotType && element.slotType.toLowerCase() === 'characterbodytype') {
                        element.itemAssetName = bodyTypeAssetHdr;
                      }
                    }
                  }
                }
              }

              // CRITICAL: Sync skinTone from PLRC (race value 1-7)
              // The game reads skinTone from CharacterVisuals JSON when editing a player
              const plrc = player.PLRC;
              if (plrc !== undefined && plrc !== null && plrc >= 1 && plrc <= 7) {
                if (Object.prototype.hasOwnProperty.call(parsed, 'skinTone')) {
                  parsed.skinTone = plrc;
                }
              }

              // Sync genericHeadName if player has PEPS (PAM/GENR value)
              const peps = player.PEPS;
              if (peps && typeof peps === 'string' && peps.startsWith('gen_')) {
                if (Object.prototype.hasOwnProperty.call(parsed, 'genericHeadName')) {
                  parsed.genericHeadName = peps;
                }
              }

              const newStr = JSON.stringify(parsed);
              const origLen = pos.end - pos.start;
              if (newStr.length <= origLen) {
                // Replace in-place and pad with spaces to preserve header length
                s = s.slice(0, pos.start) + newStr + ' '.repeat(origLen - newStr.length) + s.slice(pos.end);
              } else {
                console.warn('[RosterParser] FBCHUNKS visuals JSON for index', idx, 'would grow; skipping update to avoid header size change');
              }
            }
          }

          // Write back modified headerBuffer only if length preserved
          const newBuf = Buffer.from(s, 'utf8');
          if (newBuf.length === hb.length) {
            helper._headerBuffer = newBuf;
            console.log('[RosterParser] FBCHUNKS visuals JSON sync complete (headerBuffer updated)');
          } else {
            console.warn('[RosterParser] Modified header length differs; not replacing helper._headerBuffer');
          }
        } else {
          console.log('[RosterParser] No JSON objects found in headerBuffer to sync');
        }
      }
    } catch (e) {
      console.warn('[RosterParser] Failed to sync FBCHUNKS visuals JSON:', e.message);
    }

    // Save using MaddenRosterHelper
    await helper.save(filePath);

    console.log('[RosterParser] Roster saved successfully');

    // Post-save: scan the written file for embedded FBCHUNKS blocks and
    // attempt a safe update: decompress, modify appearance JSON, recompress,
    // and replace the payload only when the recompressed bytes fit the
    // original compressed space. Uses the helper's header buffer to update
    // header values consistently with the writer.
    try {
      const fs = require('fs');
      const zlib = require('zlib');
      const CRC = require('../lib/services/CRC');
      const utilService = require('../lib/services/utilService');

      let fileBuf = fs.readFileSync(filePath);
      const sig = Buffer.from('FBCHUNKS');
      const matches = [];
      for (let i = 0; i < fileBuf.length - sig.length; i++) {
        if (fileBuf.slice(i, i + sig.length).equals(sig)) matches.push(i);
      }

      if (matches.length === 0) {
        console.log('[RosterParser] No FBCHUNKS signature found in saved file');
      } else {
        console.log('[RosterParser] Found', matches.length, 'FBCHUNKS block(s) in saved file - attempting in-file sync');

        let anyModified = false;

        for (const pos of matches) {
          try {
            // Determine dataStart from year field (matches MaddenRosterHelper behavior)
            const year = fileBuf.readUInt16LE(pos + 0x16);
            const dataStart = (year >= 2021) ? 0x4A : 0x3E;
            const payloadStart = pos + dataStart;
            const origCompressed = fileBuf.slice(payloadStart);

            // Try to inflate the remainder of file starting at payloadStart
            let inflated;
            try {
              inflated = zlib.inflateSync(origCompressed);
            } catch (e) {
              // If inflate fails, skip this block
              console.warn('[RosterParser] Could not inflate FBCHUNKS payload at', pos, '-', e.message);
              continue;
            }

            const s = inflated.toString('utf8');

            // Extract JSON objects from inflated string
            let objs = [];
            let inStr = false, esc = false, depth = 0, start = -1;
            for (let i = 0; i < s.length; i++) {
              const ch = s[i];
              if (ch === '"' && !esc) inStr = !inStr;
              if (inStr && ch === '\\') esc = !esc; else esc = false;
              if (!inStr) {
                if (ch === '{') { if (depth === 0) start = i; depth++; }
                else if (ch === '}') { depth--; if (depth === 0 && start !== -1) { const sub = s.slice(start, i + 1); try { objs.push({ start, end: i + 1, json: JSON.parse(sub) }); } catch (e) {} start = -1; } }
              }
            }

            if (objs.length === 0) continue;

            // Update appearance objects matching players[]
            let modified = false;
            for (let idx = 0; idx < objs.length && idx < players.length; idx++) {
              const item = objs[idx];
              if (Object.prototype.hasOwnProperty.call(item.json, 'bodyType')) {
                const player = players[idx];
                if (!player) continue;
                item.json.bodyType = player.PCBT;
                const pwgt = player.PWGT;
                const actualWeight = (pwgt !== undefined && pwgt !== null) ? (pwgt + 160) : null;
                if (actualWeight !== null) {
                  if (Object.prototype.hasOwnProperty.call(item.json, 'weight')) item.json.weight = actualWeight;
                  if (Object.prototype.hasOwnProperty.call(item.json, 'WLBS')) item.json.WLBS = actualWeight;
                  if (Object.prototype.hasOwnProperty.call(item.json, 'wlbs')) item.json.wlbs = actualWeight;
                  if (Object.prototype.hasOwnProperty.call(item.json, 'size')) item.json.size = actualWeight;
                }

                // CRITICAL: Also update loadoutElements with slotType "characterbodytype"
                // The game reads body type from BOTH the top-level bodyType AND the loadout element
                // PCBT values: 0=Standard, 1=Thin, 2=Muscular, 3=Heavy, 4=Lean
                const BODY_TYPE_ASSET_NAMES = ['standard_bodytype', 'thin_bodytype', 'muscular_bodytype', 'heavy_bodytype', 'lean_bodytype'];
                const bodyTypeAsset = BODY_TYPE_ASSET_NAMES[player.PCBT] || 'standard_bodytype';
                if (item.json.loadouts && Array.isArray(item.json.loadouts)) {
                  for (const loadout of item.json.loadouts) {
                    if (loadout.loadoutElements && Array.isArray(loadout.loadoutElements)) {
                      for (const element of loadout.loadoutElements) {
                        if (element.slotType && element.slotType.toLowerCase() === 'characterbodytype') {
                          element.itemAssetName = bodyTypeAsset;
                        }
                      }
                    }
                  }
                }

                // CRITICAL: Sync skinTone from PLRC (race value 1-7)
                // The game reads skinTone from CharacterVisuals JSON when editing a player
                // This must match SKNT in BLBM for consistent appearance
                const plrc = player.PLRC;
                if (plrc !== undefined && plrc !== null && plrc >= 1 && plrc <= 7) {
                  if (Object.prototype.hasOwnProperty.call(item.json, 'skinTone')) {
                    item.json.skinTone = plrc;
                  }
                }

                // Sync genericHeadName if player has PEPS (PAM/GENR value)
                // For generic faces, PEPS contains the GENR value like "gen_7_B_N_019"
                const peps = player.PEPS;
                if (peps && typeof peps === 'string' && peps.startsWith('gen_')) {
                  if (Object.prototype.hasOwnProperty.call(item.json, 'genericHeadName')) {
                    item.json.genericHeadName = peps;
                  }
                  // Also extract and sync genericHead number if present
                  // genericHead is typically 3000+ range IDs
                }

                modified = true;
              }
            }

            if (!modified) continue;

            // Re-serialize inflated payload: we will replace only the JSON spans
            // For safety, rebuild as concatenated JSON objects (common format)
            const newInflatedStr = objs.map(o => JSON.stringify(o.json)).join('\n');
            const newInflatedBuf = Buffer.from(newInflatedStr, 'utf8');

            // Compress using same algorithm as helper.save
            const newCompressed = zlib.deflateSync(newInflatedBuf, { level: 9 });

            if (newCompressed.length <= origCompressed.length) {
              // Update helper header buffer values so file remains consistent
              const headerBuf = helper._headerBuffer ? Buffer.from(helper._headerBuffer) : fileBuf.slice(pos, pos + dataStart);

              // Write uncompressed size at 0x12 (matches MaddenRosterHelper.save)
              headerBuf.writeUInt32LE(newInflatedBuf.length, 0x12);

              // Compute CRC using CRC service to match writer
              const crcObj = new CRC();
              const crcVal = utilService.toUint32(utilService.toUint32(~crcObj.crc32_be(0, newInflatedBuf, newInflatedBuf.length)) ^ 0xFFFFFFFF);
              headerBuf.writeUInt32LE(crcVal, 0x1A);

              // Build new file buffer and write
              const newFileBuf = Buffer.concat([fileBuf.slice(0, pos), headerBuf, newCompressed]);
              fs.writeFileSync(filePath, newFileBuf);
              // refresh fileBuf for subsequent blocks
              fileBuf = fs.readFileSync(filePath);
              anyModified = true;
              console.log('[RosterParser] Updated FBCHUNKS block at', pos, '- replaced compressed payload');
            } else {
              console.warn('[RosterParser] Recompressed payload larger than original; skipping update for block at', pos);
            }
          } catch (innerErr) {
            console.warn('[RosterParser] Error processing FBCHUNKS block at', pos, '-', innerErr.message);
            continue;
          }
        }

        if (!anyModified) console.log('[RosterParser] No FBCHUNKS blocks were modified');
      }
    } catch (fbErr) {
      console.warn('[RosterParser] Post-save FBCHUNKS sync failed (non-fatal):', fbErr.message);
    }

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
      skntSynced,
      blbmError,
      injuriesCleared
    };

  } catch (error) {
    console.error('[RosterParser] ===== ERROR IN SAVE =====');
    console.error('[RosterParser] Error:', error.message);
    console.error('[RosterParser] ========================');
    throw new Error(`Failed to save roster file: ${error.message}`);
  }
}

// Complete equipment slot mappings - all 33 slots discovered in roster files
const EQUIPMENT_SLOTS = {
  // Head/Face
  Visor: 2,
  FacePaint: 51,
  Helmet: 106,
  Mouthpiece: 122,
  HelmetFlag: 88,
  Neckpad: 29,

  // Arms
  LeftSleeve: 110,
  RightSleeve: 111,
  LeftElbow: 116,
  RightElbow: 117,
  LeftWrist: 120,
  RightWrist: 121,

  // Hands
  LeftGlove: 114,
  RightGlove: 115,

  // Body/Torso
  BackPlate: 12,
  ShoulderPads: 25,
  Towel: 26,
  FlakJacket: 30,
  Undershirt: 108,
  JerseyStyle: 125,
  Handwarmer: 127,
  HandwarmerStyle: 101,

  // Legs/Feet
  LeftSpats: 9,
  RightSpats: 54,
  LeftShoe: 10,
  RightShoe: 11,
  LeftShoeColor: 95,
  RightShoeColor: 96,
  Socks: 109,
  KneePad: 118,
  LeftThighPad: 142,
  RightThighPad: 143
};

// Equipment options for each slot - extracted from official roster
const EQUIPMENT_OPTIONS = {
  // Head/Face
  Visor: [
    { value: 'GearVisor_None', label: 'None' },
    { value: 'GearVisor_visorClear', label: 'Clear' },
    { value: 'GearVisor_visorOakley_clear', label: 'Oakley Clear' },
    { value: 'GearVisor_visorOakley_DarkLight', label: 'Oakley Light Tint' },
    { value: 'GearVisor_visorOakley_Dark', label: 'Oakley Dark' },
    { value: 'GearVisor_visorOakley_Prizm', label: 'Oakley Prizm' }
  ],
  FacePaint: [
    { value: 'FaceMarks_None', label: 'None' },
    { value: 'FaceMarks_EyePaint', label: 'Eye Black' },
    { value: 'FaceMarks_EyePaint2', label: 'Eye Black 2' },
    { value: 'FaceMarks_EyePaint3', label: 'Eye Black 3' },
    { value: 'FaceMarks_NoseTape', label: 'Nose Tape' },
    { value: 'FaceMarks_NoseEyeTape', label: 'Nose & Eye Tape' }
  ],
  Helmet: [
    { value: 'GearHelmet_Speed_Flex', label: 'Riddell SpeedFlex' },
    { value: 'GearHelmet_RevolutionSpeed', label: 'Riddell Revolution' },
    { value: 'GearHelmet_SchuttF7', label: 'Schutt F7' },
    { value: 'GearHelmet_AirXP', label: 'Schutt Air XP' },
    { value: 'GearHelmet_Axiom', label: 'Riddell Axiom' },
    { value: 'GearHelmet_VicisZero2', label: 'VICIS Zero2' },
    { value: 'GearHelmet_VicisZero2Trench', label: 'VICIS Zero2 Trench' },
    { value: 'GearHelmet_LightGladiator', label: 'Light Gladiator' }
  ],
  Mouthpiece: [
    { value: 'GearMouthpiece_None', label: 'None' },
    { value: 'GearMouthpiece_PacifierDual_Black', label: 'Black' },
    { value: 'GearMouthpiece_PacifierDual_White', label: 'White' },
    { value: 'GearMouthpiece_PacifierDual_TeamColor', label: 'Team Color' },
    { value: 'GearMouthpiece_PacifierDual_SecondaryColor', label: 'Secondary Color' }
  ],
  HelmetFlag: [
    { value: '', label: 'None' },
    { value: 'HelmetFlag_Australia', label: 'Australia' },
    { value: 'HelmetFlag_Brazil', label: 'Brazil' },
    { value: 'HelmetFlag_Cameroon', label: 'Cameroon' },
    { value: 'HelmetFlag_Canada', label: 'Canada' },
    { value: 'HelmetFlag_Ghana', label: 'Ghana' },
    { value: 'HelmetFlag_Jamaica', label: 'Jamaica' },
    { value: 'HelmetFlag_Liberia', label: 'Liberia' },
    { value: 'HelmetFlag_Mali', label: 'Mali' },
    { value: 'HelmetFlag_Mexico', label: 'Mexico' },
    { value: 'HelmetFlag_Nigeria', label: 'Nigeria' },
    { value: 'HelmetFlag_Panama', label: 'Panama' },
    { value: 'HelmetFlag_Samoa', label: 'Samoa' },
    { value: 'HelmetFlag_Scotland', label: 'Scotland' },
    { value: 'HelmetFlag_SouthKorea', label: 'South Korea' },
    { value: 'HelmetFlag_Tonga', label: 'Tonga' }
  ],
  Neckpad: [
    { value: 'GearNeckpad_None', label: 'None' },
    { value: 'GearNeckpad_CowboyCollarNeckRoll', label: 'Cowboy Collar' }
  ],

  // Arms - Sleeves
  LeftSleeve: [
    { value: 'ArmSleeve_None', label: 'None' },
    { value: 'GearArmSleeve_Full_sleeveLongUnderarmor_normal_Black', label: 'Full - Black' },
    { value: 'GearArmSleeve_Full_sleeveLongUnderarmor_normal_White', label: 'Full - White' },
    { value: 'GearArmSleeve_Full_sleeveLongUnderarmor_normal_TeamColor', label: 'Full - Team' },
    { value: 'GearArmSleeve_Half_sleeveLongUnderarmor_normal_Black', label: 'Half - Black' },
    { value: 'GearArmSleeve_Half_sleeveLongUnderarmor_normal_TeamColor', label: 'Half - Team' },
    { value: 'GearArmSleeve_Quarter_sleeveLongUnderarmor_normal_Black', label: 'Quarter - Black' },
    { value: 'GearArmSleeve_Quarter_sleeveLongUnderarmor_normal_White', label: 'Quarter - White' },
    { value: 'GearArmSleeve_Quarter_sleeveLongUnderarmor_normal_TeamColor', label: 'Quarter - Team' },
    { value: 'GearArmSleeve_Shooter_sleeveLongUnderarmor_normal_Black', label: 'Shooter - Black' },
    { value: 'GearArmSleeve_Shooter_sleeveLongUnderarmor_normal_White', label: 'Shooter - White' },
    { value: 'GearArmSleeve_Shooter_sleeveLongUnderarmor_normal_TeamColor', label: 'Shooter - Team' },
    { value: 'GearArmSleeve_Shooter_sleeveLongUnderarmor_normal_SecondaryColor', label: 'Shooter - Secondary' },
    { value: 'GearArmSleeve_NikeProDriFitSleeve_Black', label: 'Nike Pro - Black' },
    { value: 'GearArmSleeve_NikeProDriFitSleeve_White', label: 'Nike Pro - White' },
    { value: 'GearArmSleeve_NikeProDriFitSleeve_TeamColor', label: 'Nike Pro - Team' },
    { value: 'GearArmSleeve_McDavidPaddedCompressionSleeve_TeamColor', label: 'McDavid Padded - Team' },
    { value: 'GearArmSleeve_CompressionRolledUpShirt_Black', label: 'Rolled Up - Black' },
    { value: 'GearArmSleeve_CompressionRolledUpShirt_White', label: 'Rolled Up - White' },
    { value: 'GearArmSleeve_CompressionRolledUpShirt_TeamColor', label: 'Rolled Up - Team' },
    { value: 'GearArmSleeve_Undershirt_sleeveLongUnderarmor_normal_White', label: 'Undershirt - White' },
    { value: 'GearArmSleeve_Undershirt_sleeveLongUnderarmor_normal_TeamColor', label: 'Undershirt - Team' },
    { value: 'GearArmSleeve_Undershirt_armTape_normal_Black', label: 'Tape - Black' },
    { value: 'GearArmSleeve_Undershirt_armTape_normal_OffWhite', label: 'Tape - Off White' },
    { value: 'GearArmSleeve_Undershirt_armTape_normal_TeamColor', label: 'Tape - Team' },
    { value: 'GearArmSleeve_Quarter_armTape_normal_OffWhite', label: 'Quarter Tape - Off White' }
  ],
  RightSleeve: [
    { value: 'ArmSleeve_None', label: 'None' },
    { value: 'GearArmSleeve_Full_sleeveLongUnderarmor_normal_Black', label: 'Full - Black' },
    { value: 'GearArmSleeve_Full_sleeveLongUnderarmor_normal_White', label: 'Full - White' },
    { value: 'GearArmSleeve_Full_sleeveLongUnderarmor_normal_TeamColor', label: 'Full - Team' },
    { value: 'GearArmSleeve_Half_sleeveLongUnderarmor_normal_Black', label: 'Half - Black' },
    { value: 'GearArmSleeve_Half_sleeveLongUnderarmor_normal_TeamColor', label: 'Half - Team' },
    { value: 'GearArmSleeve_Quarter_sleeveLongUnderarmor_normal_Black', label: 'Quarter - Black' },
    { value: 'GearArmSleeve_Quarter_sleeveLongUnderarmor_normal_White', label: 'Quarter - White' },
    { value: 'GearArmSleeve_Quarter_sleeveLongUnderarmor_normal_TeamColor', label: 'Quarter - Team' },
    { value: 'GearArmSleeve_Shooter_sleeveLongUnderarmor_normal_Black', label: 'Shooter - Black' },
    { value: 'GearArmSleeve_Shooter_sleeveLongUnderarmor_normal_White', label: 'Shooter - White' },
    { value: 'GearArmSleeve_Shooter_sleeveLongUnderarmor_normal_TeamColor', label: 'Shooter - Team' },
    { value: 'GearArmSleeve_NikeProDriFitSleeve_Black', label: 'Nike Pro - Black' },
    { value: 'GearArmSleeve_NikeProDriFitSleeve_White', label: 'Nike Pro - White' },
    { value: 'GearArmSleeve_NikeProDriFitSleeve_TeamColor', label: 'Nike Pro - Team' },
    { value: 'GearArmSleeve_McDavidPaddedCompressionSleeve_TeamColor', label: 'McDavid Padded - Team' },
    { value: 'GearArmSleeve_CompressionRolledUpShirt_Black', label: 'Rolled Up - Black' },
    { value: 'GearArmSleeve_CompressionRolledUpShirt_White', label: 'Rolled Up - White' },
    { value: 'GearArmSleeve_CompressionRolledUpShirt_TeamColor', label: 'Rolled Up - Team' },
    { value: 'GearArmSleeve_Undershirt_sleeveLongUnderarmor_normal_TeamColor', label: 'Undershirt - Team' },
    { value: 'GearArmSleeve_Undershirt_armTape_normal_Black', label: 'Tape - Black' },
    { value: 'GearArmSleeve_Undershirt_armTape_normal_OffWhite', label: 'Tape - Off White' },
    { value: 'GearArmSleeve_Undershirt_armTape_normal_TeamColor', label: 'Tape - Team' },
    { value: 'GearArmSleeve_Quarter_armTape_normal_OffWhite', label: 'Quarter Tape - Off White' }
  ],
  LeftElbow: [
    { value: 'ElbowGear_None', label: 'None' },
    { value: 'ElbowGear_elbowSweatbandThin_White', label: 'Thin Band - White' },
    { value: 'ElbowGear_elbowSweatbandThin_TeamColor', label: 'Thin Band - Team' },
    { value: 'ElbowGear_elbowSweatbandMedium_White', label: 'Medium Band - White' },
    { value: 'ElbowGear_elbowSweatbandFull_White', label: 'Full Band - White' },
    { value: 'ElbowGear_elbowSweatbandFull_TeamColor', label: 'Full Band - Team' },
    { value: 'ElbowGear_elbowBrace_TeamColor', label: 'Brace - Team' },
    { value: 'ElbowGear_elbowpadRubber_Black', label: 'Rubber Pad - Black' },
    { value: 'ElbowGear_bicepShoulderStabilizer', label: 'Shoulder Stabilizer' }
  ],
  RightElbow: [
    { value: 'ElbowGear_None', label: 'None' },
    { value: 'ElbowGear_elbowSweatbandThin_White', label: 'Thin Band - White' },
    { value: 'ElbowGear_elbowSweatbandThin_TeamColor', label: 'Thin Band - Team' },
    { value: 'ElbowGear_elbowSweatbandMedium_White', label: 'Medium Band - White' },
    { value: 'ElbowGear_elbowSweatbandFull_White', label: 'Full Band - White' },
    { value: 'ElbowGear_elbowSweatbandFull_Black', label: 'Full Band - Black' },
    { value: 'ElbowGear_elbowSweatbandFull_TeamColor', label: 'Full Band - Team' },
    { value: 'ElbowGear_elbowpadRubber_Black', label: 'Rubber Pad - Black' },
    { value: 'ElbowGear_armBraceSmall', label: 'Arm Brace Small' },
    { value: 'ElbowGear_bicepShoulderStabilizer', label: 'Shoulder Stabilizer' }
  ],
  LeftWrist: [
    { value: 'GearWrist_None', label: 'None' },
    { value: 'GearWrist_wristBandNormal_White', label: 'Band - White' },
    { value: 'GearWrist_wristBandNormal_TeamColor', label: 'Band - Team' },
    { value: 'GearWrist_wristBandCoach_White', label: 'Coach Band - White' },
    { value: 'GearWrist_wristBandCoach_Black', label: 'Coach Band - Black' },
    { value: 'GearWrist_wristTapedLite_White', label: 'Tape Lite - White' },
    { value: 'GearWrist_wristTapedLite_Black', label: 'Tape Lite - Black' },
    { value: 'GearWrist_wristTapedNormal_White', label: 'Tape - White' },
    { value: 'GearWrist_wristTapedNormal_Black', label: 'Tape - Black' },
    { value: 'GearWrist_wristTapedNormal_TeamColor', label: 'Tape - Team' },
    { value: 'GearWrist_wristTapedMax_Black', label: 'Tape Max - Black' },
    { value: 'GearWrist_wristTapedMax_TeamColor', label: 'Tape Max - Team' },
    { value: 'GearWrist_gloveTapedNormal_White', label: 'Glove Tape - White' },
    { value: 'GearWrist_gloveTapedLarge_White', label: 'Glove Tape Large - White' },
    { value: 'GearWrist_gloveTapedLarge_Black', label: 'Glove Tape Large - Black' },
    { value: 'GearWrist_gloveWristBrace_Black', label: 'Wrist Brace - Black' },
    { value: 'GearWrist_wristbrace_CompressShort_Black', label: 'Compression Short - Black' }
  ],
  RightWrist: [
    { value: 'GearWrist_None', label: 'None' },
    { value: 'GearWrist_wristBandNormal_White', label: 'Band - White' },
    { value: 'GearWrist_wristBandNormal_Black', label: 'Band - Black' },
    { value: 'GearWrist_wristBandNormal_TeamColor', label: 'Band - Team' },
    { value: 'GearWrist_wristTapedLite_White', label: 'Tape Lite - White' },
    { value: 'GearWrist_wristTapedLite_Black', label: 'Tape Lite - Black' },
    { value: 'GearWrist_wristTapedNormal_White', label: 'Tape - White' },
    { value: 'GearWrist_wristTapedNormal_Black', label: 'Tape - Black' },
    { value: 'GearWrist_wristTapedNormal_TeamColor', label: 'Tape - Team' },
    { value: 'GearWrist_wristTapedMax_Black', label: 'Tape Max - Black' },
    { value: 'GearWrist_wristTapedMax_TeamColor', label: 'Tape Max - Team' },
    { value: 'GearWrist_gloveTapedNormal_White', label: 'Glove Tape - White' },
    { value: 'GearWrist_gloveTapedLarge_White', label: 'Glove Tape Large - White' },
    { value: 'GearWrist_gloveTapedLarge_Black', label: 'Glove Tape Large - Black' },
    { value: 'GearWrist_gloveWristBrace_Black', label: 'Wrist Brace - Black' },
    { value: 'GearWrist_wristbrace_CompressShort_Black', label: 'Compression Short - Black' }
  ],

  // Hands - Gloves
  LeftGlove: [
    { value: 'GearHand_None', label: 'None' },
    { value: 'GearHand_tapedHandFinger_White', label: 'Taped Fingers' },
    { value: 'GearHand_tapedHandCombo_White', label: 'Taped Combo' },
    { value: 'GearHand_glove_NikeVaporJet8_Black', label: 'Vapor Jet 8 - Black' },
    { value: 'GearHand_glove_NikeVaporJet8_White', label: 'Vapor Jet 8 - White' },
    { value: 'GearHand_glove_NikeVaporJet8_TeamColor', label: 'Vapor Jet 8 - Team' },
    { value: 'GearHand_glove_NikeVaporJet8_SecondaryColor', label: 'Vapor Jet 8 - Secondary' },
    { value: 'GearHand_glove_NikeVaporJet7_Black', label: 'Vapor Jet 7 - Black' },
    { value: 'GearHand_glove_NikeVaporJet7_White', label: 'Vapor Jet 7 - White' },
    { value: 'GearHand_glove_NikeVaporJet7_TeamColor', label: 'Vapor Jet 7 - Team' },
    { value: 'GearHand_glove_NikeVaporJet7_SecondaryColor', label: 'Vapor Jet 7 - Secondary' },
    { value: 'GearHand_glove_NikeVaporJet6_Black', label: 'Vapor Jet 6 - Black' },
    { value: 'GearHand_glove_NikeVaporJet6_TeamColor', label: 'Vapor Jet 6 - Team' },
    { value: 'GearHand_glove_NikeVaporJet5_White', label: 'Vapor Jet 5 - White' },
    { value: 'GearHand_glove_NikeVaporJet5_TeamColor', label: 'Vapor Jet 5 - Team' },
    { value: 'GearHand_glove_NikeVaporJet4_Black', label: 'Vapor Jet 4 - Black' },
    { value: 'GearHand_glove_NikeVaporKnit4_Black', label: 'Vapor Knit 4 - Black' },
    { value: 'GearHand_glove_NikeVaporKnit4_White', label: 'Vapor Knit 4 - White' },
    { value: 'GearHand_glove_NikeVaporKnit3_TeamColor', label: 'Vapor Knit 3 - Team' },
    { value: 'GearHand_glove_NikeSuperbad7_Black', label: 'Superbad 7 - Black' },
    { value: 'GearHand_glove_NikeSuperbad7_White', label: 'Superbad 7 - White' },
    { value: 'GearHand_glove_NikeSuperbad7_TeamColor', label: 'Superbad 7 - Team' },
    { value: 'GearHand_glove_NikeSuperbad6_Black', label: 'Superbad 6 - Black' },
    { value: 'GearHand_glove_NikeSuperbad6_White', label: 'Superbad 6 - White' },
    { value: 'GearHand_glove_NikeSuperbad6_TeamColor', label: 'Superbad 6 - Team' },
    { value: 'GearHand_glove_NikeSuperbad6_SecondaryColor', label: 'Superbad 6 - Secondary' },
    { value: 'GearHand_glove_NikeSuperBad5_White', label: 'Superbad 5 - White' },
    { value: 'GearHand_glove_NikeSuperBad5_TeamColor', label: 'Superbad 5 - Team' },
    { value: 'GearHand_glove_NikeSuperbad5_2019_TeamColor', label: 'Superbad 5 2019 - Team' },
    { value: 'GearHand_glove_JordanSuperbad6_White', label: 'Jordan Superbad 6 - White' },
    { value: 'GearHand_glove_NikeDTack_Black', label: 'D-Tack - Black' },
    { value: 'GearHand_glove_NikeDTack_White', label: 'D-Tack - White' },
    { value: 'GearHand_glove_NikeDTack7FG_Black', label: 'D-Tack 7 - Black' },
    { value: 'GearHand_glove_NikeDTack7FG_White', label: 'D-Tack 7 - White' },
    { value: 'GearHand_glove_NikeHyperBeast_Black', label: 'HyperBeast - Black' },
    { value: 'GearHand_glove_NikeHyperBeast_White', label: 'HyperBeast - White' },
    { value: 'GearHand_glove_AdidasFreak_Black', label: 'Adidas Freak - Black' },
    { value: 'GearHand_glove_AdidasFreak_White', label: 'Adidas Freak - White' },
    { value: 'GearHand_glove_Adizero13_White', label: 'Adizero 13 - White' },
    { value: 'GearHand_glove_Adizero13_TeamColor', label: 'Adizero 13 - Team' },
    { value: 'GearHand_glove_Adizero13_SecondaryColor', label: 'Adizero 13 - Secondary' },
    { value: 'GearHand_glove_GenericCutter_TeamColor', label: 'Cutter - Team' },
    { value: 'GearHand_glove_GenericCutter_SecondaryColor', label: 'Cutter - Secondary' }
  ],
  RightGlove: [
    { value: 'GearHand_None', label: 'None' },
    { value: 'GearHand_tapedHandFinger_White', label: 'Taped Fingers' },
    { value: 'GearHand_tapedHandCombo_White', label: 'Taped Combo' },
    { value: 'GearHand_glove_NikeVaporJet8_Black', label: 'Vapor Jet 8 - Black' },
    { value: 'GearHand_glove_NikeVaporJet8_White', label: 'Vapor Jet 8 - White' },
    { value: 'GearHand_glove_NikeVaporJet8_TeamColor', label: 'Vapor Jet 8 - Team' },
    { value: 'GearHand_glove_NikeVaporJet8_SecondaryColor', label: 'Vapor Jet 8 - Secondary' },
    { value: 'GearHand_glove_NikeVaporJet7_Black', label: 'Vapor Jet 7 - Black' },
    { value: 'GearHand_glove_NikeVaporJet7_White', label: 'Vapor Jet 7 - White' },
    { value: 'GearHand_glove_NikeVaporJet7_TeamColor', label: 'Vapor Jet 7 - Team' },
    { value: 'GearHand_glove_NikeVaporJet7_SecondaryColor', label: 'Vapor Jet 7 - Secondary' },
    { value: 'GearHand_glove_NikeVaporJet6_Black', label: 'Vapor Jet 6 - Black' },
    { value: 'GearHand_glove_NikeVaporJet6_TeamColor', label: 'Vapor Jet 6 - Team' },
    { value: 'GearHand_glove_NikeVaporJet5_White', label: 'Vapor Jet 5 - White' },
    { value: 'GearHand_glove_NikeVaporJet5_TeamColor', label: 'Vapor Jet 5 - Team' },
    { value: 'GearHand_glove_NikeVaporJet4_Black', label: 'Vapor Jet 4 - Black' },
    { value: 'GearHand_glove_NikeVaporKnit4_Black', label: 'Vapor Knit 4 - Black' },
    { value: 'GearHand_glove_NikeVaporKnit4_White', label: 'Vapor Knit 4 - White' },
    { value: 'GearHand_glove_NikeVaporKnit3_TeamColor', label: 'Vapor Knit 3 - Team' },
    { value: 'GearHand_glove_NikeSuperbad7_Black', label: 'Superbad 7 - Black' },
    { value: 'GearHand_glove_NikeSuperbad7_White', label: 'Superbad 7 - White' },
    { value: 'GearHand_glove_NikeSuperbad7_TeamColor', label: 'Superbad 7 - Team' },
    { value: 'GearHand_glove_NikeSuperbad6_Black', label: 'Superbad 6 - Black' },
    { value: 'GearHand_glove_NikeSuperbad6_White', label: 'Superbad 6 - White' },
    { value: 'GearHand_glove_NikeSuperbad6_TeamColor', label: 'Superbad 6 - Team' },
    { value: 'GearHand_glove_NikeSuperbad6_SecondaryColor', label: 'Superbad 6 - Secondary' },
    { value: 'GearHand_glove_NikeSuperBad5_White', label: 'Superbad 5 - White' },
    { value: 'GearHand_glove_NikeSuperBad5_TeamColor', label: 'Superbad 5 - Team' },
    { value: 'GearHand_glove_NikeSuperbad5_2019_TeamColor', label: 'Superbad 5 2019 - Team' },
    { value: 'GearHand_glove_JordanSuperbad6_White', label: 'Jordan Superbad 6 - White' },
    { value: 'GearHand_glove_NikeDTack_Black', label: 'D-Tack - Black' },
    { value: 'GearHand_glove_NikeDTack_White', label: 'D-Tack - White' },
    { value: 'GearHand_glove_NikeDTack7FG_Black', label: 'D-Tack 7 - Black' },
    { value: 'GearHand_glove_NikeDTack7FG_White', label: 'D-Tack 7 - White' },
    { value: 'GearHand_glove_NikeHyperBeast_Black', label: 'HyperBeast - Black' },
    { value: 'GearHand_glove_NikeHyperBeast_White', label: 'HyperBeast - White' },
    { value: 'GearHand_glove_AdidasFreak_Black', label: 'Adidas Freak - Black' },
    { value: 'GearHand_glove_AdidasFreak_White', label: 'Adidas Freak - White' },
    { value: 'GearHand_glove_Adizero13_White', label: 'Adizero 13 - White' },
    { value: 'GearHand_glove_Adizero13_TeamColor', label: 'Adizero 13 - Team' },
    { value: 'GearHand_glove_Adizero13_SecondaryColor', label: 'Adizero 13 - Secondary' },
    { value: 'GearHand_glove_GenericCutter_TeamColor', label: 'Cutter - Team' },
    { value: 'GearHand_glove_GenericCutter_SecondaryColor', label: 'Cutter - Secondary' }
  ],

  // Body/Torso
  BackPlate: [
    { value: '', label: 'None' },
    { value: 'Backplate_Standard', label: 'Standard' }
  ],
  ShoulderPads: [
    { value: 'Small_Pads', label: 'Small Pads' }
  ],
  Towel: [
    { value: 'Towel_None', label: 'None' },
    { value: 'Towel_South', label: 'Center' },
    { value: 'Towel_East', label: 'Right' },
    { value: 'Towel_West', label: 'Left' },
    { value: 'Towel_NorthEast', label: 'Front Right' },
    { value: 'Towel_NorthWest', label: 'Front Left' },
    { value: 'Towel_SouthEast', label: 'Back Right' },
    { value: 'Towel_SouthWest', label: 'Back Left' }
  ],
  FlakJacket: [
    { value: '', label: 'None' },
    { value: 'Flakjacket_On', label: 'On' }
  ],
  Undershirt: [
    { value: 'Undershirt_None', label: 'None' },
    { value: 'Undershirt_Untucked', label: 'Untucked' },
    { value: 'G_CompressionT_Crew_ShortSleeve_Basic_WHI', label: 'Compression - White' },
    { value: 'G_CompressionT_Crew_ShortSleeve_Basic_PRI', label: 'Compression - Team' }
  ],
  JerseyStyle: [
    { value: 'Gear_JerseyStyle_SleeveStandard', label: 'Standard' },
    { value: 'Gear_JerseyStyle_SleeveTight', label: 'Tight' }
  ],
  Handwarmer: [
    { value: 'Handwarmer_None', label: 'None' },
    { value: 'Handwarmer_Standard', label: 'Standard' }
  ],
  HandwarmerStyle: [
    { value: 'HandwarmerStyle_Front', label: 'Front' },
    { value: 'HandwarmerStyle_Back', label: 'Back' }
  ],

  // Legs/Feet
  LeftSpats: [
    { value: 'GearSpats_none', label: 'None' },
    { value: 'GearSpats_spatThin_White', label: 'White' },
    { value: 'GearSpats_spatThin_Black', label: 'Black' }
  ],
  RightSpats: [
    { value: 'GearSpats_none', label: 'None' },
    { value: 'GearSpats_spatThin_White', label: 'White' },
    { value: 'GearSpats_spatThin_Black', label: 'Black' }
  ],
  LeftShoe: [
    { value: 'GearFootwear_shoe_low_NikeVaporEdge', label: 'Nike Vapor Edge Low' },
    { value: 'GearFootwear_shoe_low_NikeVaporEdgePro3602', label: 'Nike Vapor Edge Pro 360' },
    { value: 'GearFootwear_shoe_low_NikeVaporEdgeSpeed3062', label: 'Nike Vapor Edge Speed 360' },
    { value: 'GearFootwear_shoe_low_NikeVaporUntouchablePro', label: 'Nike Vapor Untouchable Pro' },
    { value: 'GearFootwear_shoe_low_NikeVaporUntouchablePro3', label: 'Nike Vapor Untouchable Pro 3' },
    { value: 'GearFootwear_shoe_low_NikeAlphaMenaceElite3', label: 'Nike Alpha Menace Elite 3' },
    { value: 'GearFootwear_shoe_low_NikeAlphaMenacePro4', label: 'Nike Alpha Menace Pro 4' },
    { value: 'GearFootwear_shoe_low_NikeEquinox', label: 'Nike Equinox' },
    { value: 'GearFootwear_shoe_low_AirJordanRetro1', label: 'Air Jordan Retro 1 Low' },
    { value: 'GearFootwear_shoe_low_AdidasAdizero_LTA58', label: 'Adidas Adizero' },
    { value: 'GearFootwear_shoe_low_Adidas_AdizeroElectric', label: 'Adidas Adizero Electric' },
    { value: 'GearFootwear_shoe_low_AdizeroElectric2', label: 'Adidas Adizero Electric 2' },
    { value: 'GearFootwear_shoe_low_UnderArmourBlurPro2025', label: 'Under Armour Blur Pro' },
    { value: 'GearFootwear_shoe_mid_NikeAlphaMenacePro2', label: 'Nike Alpha Menace Pro 2 Mid' },
    { value: 'GearFootwear_shoe_mid_NikeAlphaMenacePro3WDP', label: 'Nike Alpha Menace Pro 3 Mid' },
    { value: 'GearFootwear_shoe_mid_NikeAlphaMenaceStrong', label: 'Nike Alpha Menace Strong Mid' },
    { value: 'GearFootwear_shoe_mid_NikeFieldGeneral', label: 'Nike Field General Mid' },
    { value: 'GearFootwear_shoe_mid_NikeForceSavagePro2', label: 'Nike Force Savage Pro 2 Mid' },
    { value: 'GearFootwear_shoe_mid_AirJordanRetro1', label: 'Air Jordan Retro 1 Mid' },
    { value: 'GearFootwear_shoe_mid_AirJordanRetroCement', label: 'Air Jordan Retro Cement Mid' },
    { value: 'GearFootwear_shoe_mid_Jordan11TD', label: 'Jordan 11 TD Mid' },
    { value: 'GearFootwear_shoe_mid_AdidasAdizeroPrimeKnit', label: 'Adidas Adizero Primeknit Mid' },
    { value: 'GearFootwear_shoe_mid_UnderArmourBlurSmoke2024', label: 'Under Armour Blur Smoke Mid' },
    { value: 'GearFootwear_shoe_high_NikeAlphaMenaceElite2', label: 'Nike Alpha Menace Elite 2 High' },
    { value: 'GearFootwear_shoe_high_AdidasFreakUltra22', label: 'Adidas Freak Ultra 22 High' },
    { value: 'GearFootwear_shoe_Low_NikeAlphaMenaceElite', label: 'Nike Alpha Menace Elite' },
    { value: 'GearFootwear_shoe_Low_NikeVaporCarbonEliteTD', label: 'Nike Vapor Carbon Elite TD' },
    { value: 'GearFootwear_shoe_Mid_NikeAlphaPro34TD', label: 'Nike Alpha Pro 3/4 TD' },
    { value: 'GearFootwear_shoe_Mid_NikeCodeEliteProShark', label: 'Nike Code Elite Pro Shark' },
    { value: 'GearFootwear_shoe_Mid_NikeVaporEdge360Untouchable', label: 'Nike Vapor Edge 360' }
  ],
  RightShoe: [
    { value: 'GearFootwear_shoe_low_NikeVaporEdge', label: 'Nike Vapor Edge Low' },
    { value: 'GearFootwear_shoe_low_NikeVaporEdgePro3602', label: 'Nike Vapor Edge Pro 360' },
    { value: 'GearFootwear_shoe_low_NikeVaporEdgeSpeed3062', label: 'Nike Vapor Edge Speed 360' },
    { value: 'GearFootwear_shoe_low_NikeVaporUntouchablePro', label: 'Nike Vapor Untouchable Pro' },
    { value: 'GearFootwear_shoe_low_NikeVaporUntouchablePro3', label: 'Nike Vapor Untouchable Pro 3' },
    { value: 'GearFootwear_shoe_low_NikeAlphaMenaceElite3', label: 'Nike Alpha Menace Elite 3' },
    { value: 'GearFootwear_shoe_low_NikeAlphaMenacePro4', label: 'Nike Alpha Menace Pro 4' },
    { value: 'GearFootwear_shoe_low_NikeEquinox', label: 'Nike Equinox' },
    { value: 'GearFootwear_shoe_low_AirJordanRetro1', label: 'Air Jordan Retro 1 Low' },
    { value: 'GearFootwear_shoe_low_AdidasAdizero_LTA58', label: 'Adidas Adizero' },
    { value: 'GearFootwear_shoe_low_Adidas_AdizeroElectric', label: 'Adidas Adizero Electric' },
    { value: 'GearFootwear_shoe_low_AdizeroElectric2', label: 'Adidas Adizero Electric 2' },
    { value: 'GearFootwear_shoe_low_UnderArmourBlurPro2025', label: 'Under Armour Blur Pro' },
    { value: 'GearFootwear_shoe_mid_NikeAlphaMenacePro2', label: 'Nike Alpha Menace Pro 2 Mid' },
    { value: 'GearFootwear_shoe_mid_NikeAlphaMenacePro3WDP', label: 'Nike Alpha Menace Pro 3 Mid' },
    { value: 'GearFootwear_shoe_mid_NikeAlphaMenaceStrong', label: 'Nike Alpha Menace Strong Mid' },
    { value: 'GearFootwear_shoe_mid_NikeFieldGeneral', label: 'Nike Field General Mid' },
    { value: 'GearFootwear_shoe_mid_NikeForceSavagePro2', label: 'Nike Force Savage Pro 2 Mid' },
    { value: 'GearFootwear_shoe_mid_AirJordanRetro1', label: 'Air Jordan Retro 1 Mid' },
    { value: 'GearFootwear_shoe_mid_AirJordanRetroCement', label: 'Air Jordan Retro Cement Mid' },
    { value: 'GearFootwear_shoe_mid_Jordan11TD', label: 'Jordan 11 TD Mid' },
    { value: 'GearFootwear_shoe_mid_AdidasAdizeroPrimeKnit', label: 'Adidas Adizero Primeknit Mid' },
    { value: 'GearFootwear_shoe_mid_UnderArmourBlurSmoke2024', label: 'Under Armour Blur Smoke Mid' },
    { value: 'GearFootwear_shoe_high_NikeAlphaMenaceElite2', label: 'Nike Alpha Menace Elite 2 High' },
    { value: 'GearFootwear_shoe_high_AdidasFreakUltra22', label: 'Adidas Freak Ultra 22 High' },
    { value: 'GearFootwear_shoeLowVintage_nike', label: 'Nike Vintage Low' },
    { value: 'GearFootwear_shoe_Low_NikeAlphaMenaceElite', label: 'Nike Alpha Menace Elite' },
    { value: 'GearFootwear_shoe_Low_NikeVaporCarbonEliteTD', label: 'Nike Vapor Carbon Elite TD' },
    { value: 'GearFootwear_shoe_Mid_NikeAlphaPro34TD', label: 'Nike Alpha Pro 3/4 TD' },
    { value: 'GearFootwear_shoe_Mid_NikeCodeEliteProShark', label: 'Nike Code Elite Pro Shark' },
    { value: 'GearFootwear_shoe_Mid_NikeVaporEdge360Untouchable', label: 'Nike Vapor Edge 360' }
  ],
  LeftShoeColor: [
    { value: 'U_GENERIC_SHOESX_WHIWHI', label: 'White/White' },
    { value: 'U_GENERIC_SHOESX_WHIBLA', label: 'White/Black' },
    { value: 'U_GENERIC_SHOESX_WHIPRI', label: 'White/Team' },
    { value: 'U_GENERIC_SHOESX_WHISEC', label: 'White/Secondary' },
    { value: 'U_GENERIC_SHOESX_BLABLA', label: 'Black/Black' },
    { value: 'U_GENERIC_SHOESX_BLAWHI', label: 'Black/White' },
    { value: 'U_GENERIC_SHOESX_BLAPRI', label: 'Black/Team' }
  ],
  RightShoeColor: [
    { value: 'U_GENERIC_SHOESX_WHIWHI', label: 'White/White' },
    { value: 'U_GENERIC_SHOESX_WHIBLA', label: 'White/Black' },
    { value: 'U_GENERIC_SHOESX_WHIPRI', label: 'White/Team' },
    { value: 'U_GENERIC_SHOESX_WHISEC', label: 'White/Secondary' },
    { value: 'U_GENERIC_SHOESX_BLABLA', label: 'Black/Black' },
    { value: 'U_GENERIC_SHOESX_BLAWHI', label: 'Black/White' },
    { value: 'U_GENERIC_SHOESX_BLAPRI', label: 'Black/Team' }
  ],
  Socks: [
    { value: 'Gear_Socks_Under', label: 'Under (Hidden)' },
    { value: 'Gear_Socks_Low', label: 'Low' },
    { value: 'Gear_Socks_Mid', label: 'Mid' },
    { value: 'Gear_Socks_High', label: 'High' }
  ],
  KneePad: [
    { value: 'KneePad_Regular', label: 'Regular' },
    { value: 'KneePad_Nike', label: 'Nike' }
  ],
  LeftThighPad: [
    { value: 'ThighPad_Regular', label: 'Regular' },
    { value: 'ThighPad_Nike', label: 'Nike' }
  ],
  RightThighPad: [
    { value: 'ThighPad_Regular', label: 'Regular' },
    { value: 'ThighPad_Nike', label: 'Nike' }
  ]
};

/**
 * Get equipment data for a player by index
 * @param {number} playerIndex - The player index in the roster
 * @returns {Object} Equipment slot values
 */
function getPlayerEquipment(playerIndex) {
  const file = global.rosterFile;
  if (!file) {
    console.error('[RosterParser] No roster file loaded');
    return null;
  }

  const blob = file.BLOB?.records?.[0];
  const blbm = blob?.fields?.BLBM?.value;
  if (!blbm || !blbm._records || playerIndex >= blbm._records.length) {
    console.error('[RosterParser] Could not find BLBM record for player', playerIndex);
    return null;
  }

  const blbmRec = blbm._records[playerIndex];
  const fields = blbmRec.fields || blbmRec._fields;
  const lout = fields?.LOUT?.value;

  if (!lout || !lout._records) {
    console.log('[RosterParser] No LOUT data for player', playerIndex);
    return {};
  }

  const equipment = {};

  // Find PlayerOnField loadout (LDTY=1)
  const playerOnFieldRec = lout._records.find(r => {
    const f = r.fields || r._fields;
    return f?.LDTY?.value === 1 || f?.LDTY?._value === 1;
  });

  if (!playerOnFieldRec) {
    console.log('[RosterParser] No PlayerOnField loadout for player', playerIndex);
    return equipment;
  }

  const pinsField = (playerOnFieldRec.fields || playerOnFieldRec._fields)?.PINS;
  const pins = pinsField?.value;

  if (!pins || !pins._records) {
    return equipment;
  }

  // Map slot numbers back to equipment keys
  const slotToKey = {};
  for (const [key, slot] of Object.entries(EQUIPMENT_SLOTS)) {
    slotToKey[slot] = key;
  }

  // Extract equipment values
  for (const pinRec of pins._records) {
    const pf = pinRec.fields || pinRec._fields;
    const slot = pf?.SLOT?.value ?? pf?.SLOT?._value;
    const itan = pf?.ITAN?.value ?? pf?.ITAN?._value;

    if (slotToKey[slot]) {
      equipment[slotToKey[slot]] = itan || '';
    }
  }

  return equipment;
}

/**
 * Set equipment for a player by index
 * @param {number} playerIndex - The player index in the roster
 * @param {Object} equipment - Equipment slot values to set
 * @returns {boolean} Success
 */
function setPlayerEquipment(playerIndex, equipment) {
  // CRITICAL: Store the equipment changes for later application during save
  // This is necessary because saveRosterFile reloads the file fresh, which
  // would discard any in-memory modifications made to global.rosterFile
  pendingEquipmentChanges.set(playerIndex, { ...equipment });
  console.log(`[RosterParser] Queued equipment changes for player ${playerIndex}:`, equipment);

  // Also apply immediately to global.rosterFile for any code that reads from it
  const file = global.rosterFile;
  if (!file) {
    console.error('[RosterParser] No roster file loaded');
    return true; // Still return true since we queued the changes
  }

  const blob = file.BLOB?.records?.[0];
  const blbm = blob?.fields?.BLBM?.value;
  if (!blbm || !blbm._records || playerIndex >= blbm._records.length) {
    console.error('[RosterParser] Could not find BLBM record for player', playerIndex);
    return true; // Still return true since we queued the changes
  }

  const blbmRec = blbm._records[playerIndex];
  const fields = blbmRec.fields || blbmRec._fields;
  const lout = fields?.LOUT?.value;

  if (!lout || !lout._records) {
    console.log('[RosterParser] No LOUT data for player', playerIndex);
    return true; // Still return true since we queued the changes
  }

  // Find PlayerOnField loadout (LDTY=1)
  const playerOnFieldRec = lout._records.find(r => {
    const f = r.fields || r._fields;
    return f?.LDTY?.value === 1 || f?.LDTY?._value === 1;
  });

  if (!playerOnFieldRec) {
    console.log('[RosterParser] No PlayerOnField loadout for player', playerIndex);
    return true; // Still return true since we queued the changes
  }

  const pinsField = (playerOnFieldRec.fields || playerOnFieldRec._fields)?.PINS;
  const pins = pinsField?.value;

  if (!pins || !pins._records) {
    return true; // Still return true since we queued the changes
  }

  let updated = 0;

  // Update equipment values
  for (const [key, assetName] of Object.entries(equipment)) {
    const slotNum = EQUIPMENT_SLOTS[key];
    if (slotNum === undefined) continue;

    // Find existing pin record for this slot
    for (const pinRec of pins._records) {
      const pf = pinRec.fields || pinRec._fields;
      const slot = pf?.SLOT?.value ?? pf?.SLOT?._value;

      if (slot === slotNum) {
        // Update the asset name
        if (pf?.ITAN?.value !== undefined) {
          pf.ITAN.value = assetName || '';
        } else if (pf?.ITAN?._value !== undefined) {
          pf.ITAN._value = assetName || '';
        }
        if (pf?.ITAN) pf.ITAN._isChanged = true;
        updated++;
        break;
      }
    }
  }

  console.log(`[RosterParser] Applied ${updated} equipment slots for player ${playerIndex} (in memory)`);
  return true;
}

/**
 * Apply pending equipment changes to a file object
 * Called during saveRosterFile to ensure equipment changes are persisted
 * @param {Object} file - The roster file object
 */
function applyPendingEquipmentChanges(file) {
  if (pendingEquipmentChanges.size === 0) {
    console.log('[RosterParser] No pending equipment changes to apply');
    return 0;
  }

  console.log(`[RosterParser] Applying ${pendingEquipmentChanges.size} pending equipment changes`);

  const blob = file.BLOB?.records?.[0];
  const blbm = blob?.fields?.BLBM?.value;
  if (!blbm || !blbm._records) {
    console.error('[RosterParser] Could not find BLBM records for equipment changes');
    return 0;
  }

  let totalUpdated = 0;

  for (const [playerIndex, equipment] of pendingEquipmentChanges.entries()) {
    if (playerIndex >= blbm._records.length) {
      console.warn(`[RosterParser] Player index ${playerIndex} out of bounds, skipping`);
      continue;
    }

    const blbmRec = blbm._records[playerIndex];
    const fields = blbmRec.fields || blbmRec._fields;
    const lout = fields?.LOUT?.value;

    if (!lout || !lout._records) {
      console.warn(`[RosterParser] No LOUT data for player ${playerIndex}`);
      continue;
    }

    // Find PlayerOnField loadout (LDTY=1)
    const playerOnFieldRec = lout._records.find(r => {
      const f = r.fields || r._fields;
      return f?.LDTY?.value === 1 || f?.LDTY?._value === 1;
    });

    if (!playerOnFieldRec) {
      console.warn(`[RosterParser] No PlayerOnField loadout for player ${playerIndex}`);
      continue;
    }

    const pinsField = (playerOnFieldRec.fields || playerOnFieldRec._fields)?.PINS;
    const pins = pinsField?.value;

    if (!pins || !pins._records) {
      console.warn(`[RosterParser] No PINS data for player ${playerIndex}`);
      continue;
    }

    let playerUpdated = 0;

    for (const [key, assetName] of Object.entries(equipment)) {
      const slotNum = EQUIPMENT_SLOTS[key];
      if (slotNum === undefined) continue;

      for (const pinRec of pins._records) {
        const pf = pinRec.fields || pinRec._fields;
        const slot = pf?.SLOT?.value ?? pf?.SLOT?._value;

        if (slot === slotNum) {
          if (pf?.ITAN?.value !== undefined) {
            pf.ITAN.value = assetName || '';
          } else if (pf?.ITAN?._value !== undefined) {
            pf.ITAN._value = assetName || '';
          }
          if (pf?.ITAN) pf.ITAN._isChanged = true;
          playerUpdated++;
          break;
        }
      }
    }

    console.log(`[RosterParser] Applied ${playerUpdated} equipment slots for player ${playerIndex}`);
    totalUpdated += playerUpdated;
  }

  // Clear pending changes after applying
  pendingEquipmentChanges.clear();
  console.log(`[RosterParser] Applied ${totalUpdated} total equipment changes`);

  return totalUpdated;
}

module.exports = {
  parseRosterFile,
  saveRosterFile,
  getPlayerEquipment,
  setPlayerEquipment,
  EQUIPMENT_SLOTS,
  EQUIPMENT_OPTIONS
};
