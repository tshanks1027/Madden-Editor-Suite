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

module.exports = {
  parseRosterFile,
  saveRosterFile
};
