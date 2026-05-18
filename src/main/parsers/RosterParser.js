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

    // DEBUG: Check first raw record for PLRL field
    const firstRec = playerTable.records[0];
    if (firstRec) {
      const hasPlrl = 'PLRL' in firstRec.fields;
      console.log(`[RosterParser] RAW FILE CHECK: PLRL field exists in schema: ${hasPlrl}`);
      if (hasPlrl) {
        console.log(`[RosterParser] RAW FILE CHECK: First record PLRL = ${firstRec.fields.PLRL?.value}`);
      }
      // List all fields to see what's available
      const fieldNames = Object.keys(firstRec.fields).sort();
      const plFields = fieldNames.filter(f => f.includes('PL'));
      console.log(`[RosterParser] RAW FILE CHECK: PL* fields: ${plFields.join(', ')}`);
    }

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

    // CRITICAL DEBUG: Check PLRL values loaded from file (file-specific issue)
    console.log('[RosterParser] *** PLRL LOAD CHECK - First 5 players from file ***');
    for (let i = 0; i < Math.min(5, players.length); i++) {
      const p = players[i];
      console.log(`  ${i}: ${p.PFNA} ${p.PLNA} - PLRL=${p.PLRL} (type: ${typeof p.PLRL})`);
    }
    // Count players with PLRL=0 vs non-zero
    const plrl0Count = players.filter(p => p.PLRL === 0 || p.PLRL === undefined).length;
    const plrlNonZeroCount = players.filter(p => p.PLRL && p.PLRL > 0).length;
    console.log(`[RosterParser] PLRL stats: ${plrlNonZeroCount} non-zero, ${plrl0Count} zero/undefined`);

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

  // PLRL debug variables (function-scoped for return)
  let incomingPlrlNonZero = 0;
  let finalPlrlNonZero = 0;
  let plrlSamples = [];

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

    // ========== DEBUG: COMPREHENSIVE EQUIPMENT TRACKING ==========
    // Helper function to get ALL equipment slots for a BLBM record
    function getEquipmentSnapshot(blbmRec) {
      const f = blbmRec.fields || blbmRec._fields;
      const lout = f?.LOUT?.value;
      if (!lout || !lout._records) return null;

      const onField = lout._records.find(r => {
        const rf = r.fields || r._fields;
        return rf?.LDTY?.value === 1 || rf?.LDTY?._value === 1;
      });
      if (!onField) return null;

      const pins = (onField.fields || onField._fields)?.PINS?.value;
      if (!pins || !pins._records) return null;

      const equipment = {};
      for (const pinRec of pins._records) {
        const pf = pinRec.fields || pinRec._fields;
        const slot = pf?.SLOT?.value ?? pf?.SLOT?._value;
        const itan = pf?.ITAN?.value ?? pf?.ITAN?._value;
        if (slot !== undefined) {
          equipment[slot] = itan || '';
        }
      }
      return equipment;
    }

    console.log('[RosterParser] ========== EQUIPMENT TRACKING: INITIAL STATE ==========');
    console.log(`[RosterParser] Players array length: ${players.length}`);

    // Get BLBM records
    const debugBlob = file.BLOB?.records?.[0];
    const debugBlbm = debugBlob?.fields?.BLBM?.value;
    const debugBlbmRecords = debugBlbm?._records || [];
    console.log(`[RosterParser] BLBM records count: ${debugBlbmRecords.length}`);

    // Track first 10 BLBM records' equipment throughout save
    // We'll compare this at the end to see what changed
    const trackedEquipment = {};
    console.log('[RosterParser] TRACKING first 10 BLBM records equipment:');
    for (let i = 0; i < Math.min(10, debugBlbmRecords.length); i++) {
      const rec = debugBlbmRecords[i];
      const f = rec.fields || rec._fields;
      const cfnm = f?.CFNM?.value ?? f?.CFNM?._value ?? '';
      const clnm = f?.CLNM?.value ?? f?.CLNM?._value ?? '';
      const blbmIndex = rec.index;
      const equip = getEquipmentSnapshot(rec);

      trackedEquipment[i] = {
        name: `${cfnm} ${clnm}`,
        blbmIndex: blbmIndex,
        initialEquipment: equip ? JSON.stringify(equip) : 'NO_EQUIPMENT'
      };

      // Show visor (slot 2) and jersey style (slot 125) as representative slots
      const visor = equip?.[2] || 'N/A';
      const jersey = equip?.[125] || 'N/A';
      console.log(`  BLBM[${i}] ${cfnm} ${clnm} (index=${blbmIndex}): visor="${visor}", jersey="${jersey}"`);
    }

    // Show what players are in the UI array (first 10)
    console.log('[RosterParser] UI players array (first 10):');
    for (let i = 0; i < Math.min(10, players.length); i++) {
      const p = players[i];
      console.log(`  players[${i}]: ${p.PFNA} ${p.PLNA} POID=${p.POID}, PGID=${p.PGID}`);
    }

    // Find if any player was DELETED (BLBM has more records than players array)
    if (debugBlbmRecords.length > players.length) {
      console.log(`[RosterParser] !!! DELETION DETECTED: ${debugBlbmRecords.length - players.length} fewer players than BLBM records`);
    }

    console.log('[RosterParser] ========== END INITIAL STATE ==========');

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
      // NOTE: PSTM is Sleeve Temperature, NOT stamina! Do not map it.
      // Stamina is PSTA in both internal and TDB2 format.
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

    // CRITICAL FIX: Build a POID -> record index map for stable lookups
    // This ensures we write each player's data to the correct record slot
    // even if players were deleted from the UI array (which shifts indices)
    const poidToRecordIndex = new Map();
    for (let i = 0; i < playerTable.records.length; i++) {
      const poid = playerTable.records[i].fields?.POID?.value;
      if (poid !== undefined) {
        poidToRecordIndex.set(poid, i);
      }
    }
    console.log('[RosterParser] Built POID->record map with', poidToRecordIndex.size, 'entries');

    // DEBUG: Show first few POIDs in the map to verify they match incoming players
    const firstMapEntries = [...poidToRecordIndex.entries()].slice(0, 10);
    console.log('[RosterParser] First 10 POIDs in map:', firstMapEntries.map(e => `${e[0]}→rec[${e[1]}]`).join(', '));

    // DEBUG: Check if incoming players' POIDs are in the map
    console.log('[RosterParser] Checking incoming players POIDs against map:');
    for (let i = 0; i < Math.min(5, players.length); i++) {
      const p = players[i];
      const inMap = poidToRecordIndex.has(p.POID);
      const recordIdx = poidToRecordIndex.get(p.POID);
      console.log(`  ${i}: ${p.PFNA} ${p.PLNA} - POID=${p.POID}, inMap=${inMap}, recordIndex=${recordIdx}`);
    }

    let playersMatched = 0;
    let playersUnmatched = 0;

    // DEBUG: Log PLRL values for first 5 incoming players
    console.log('[RosterParser] *** PLRL SAVE CHECK - First 5 incoming players ***');
    for (let d = 0; d < Math.min(5, players.length); d++) {
      const p = players[d];
      console.log(`  ${d}: ${p.PFNA} ${p.PLNA} - PLRL=${p.PLRL} (type: ${typeof p.PLRL})`);
      // Check if PLRL is an own property
      const hasOwnPlrl = Object.prototype.hasOwnProperty.call(p, 'PLRL');
      console.log(`      hasOwnProperty('PLRL'): ${hasOwnPlrl}, keys include PLRL: ${'PLRL' in p}`);
    }
    // Count players with PLRL=0 vs non-zero in INCOMING data
    const incomingPlrl0 = players.filter(p => p.PLRL === 0 || p.PLRL === undefined).length;
    incomingPlrlNonZero = players.filter(p => p.PLRL && p.PLRL > 0).length;
    console.log(`[RosterParser] INCOMING PLRL stats: ${incomingPlrlNonZero} non-zero, ${incomingPlrl0} zero/undefined`);
    // CRITICAL: If all PLRL=0, the problem is in the frontend, not the save
    if (incomingPlrlNonZero === 0) {
      console.error('[RosterParser] ⚠️ WARNING: ALL incoming PLRL values are 0 or undefined! Check frontend data.');
    }
    // Show players with non-zero PLRL
    if (incomingPlrlNonZero > 0 && incomingPlrlNonZero <= 10) {
      console.log('[RosterParser] Players with non-zero PLRL:');
      players.filter(p => p.PLRL && p.PLRL > 0).forEach((p, idx) => {
        console.log(`  [${idx}] ${p.PFNA} ${p.PLNA} - PLRL=${p.PLRL}, POID=${p.POID}`);
      });
    }

    // Quick check: does the file schema have PLRL field?
    const debugRecord = playerTable.records[0];
    if (debugRecord) {
      console.log('[RosterParser] File schema has PLRL field:', !!debugRecord.fields['PLRL']);
    }

    // CRITICAL DEBUG: Track players with non-zero PLRL and their processing
    const plrlPlayersToTrack = new Map();
    for (let i = 0; i < players.length; i++) {
      if (players[i].PLRL && players[i].PLRL > 0) {
        plrlPlayersToTrack.set(i, { name: `${players[i].PFNA} ${players[i].PLNA}`, plrl: players[i].PLRL, poid: players[i].POID, processed: false, written: false });
      }
    }
    console.log(`[RosterParser] *** TRACKING ${plrlPlayersToTrack.size} players with non-zero PLRL ***`);

    for (let i = 0; i < players.length; i++) {
      const playerData = players[i];
      const isTrackedPlrlPlayer = plrlPlayersToTrack.has(i);

      // Find the correct record by POID (stable identifier)
      const playerPoid = playerData.POID;
      let recordIndex = poidToRecordIndex.get(playerPoid);

      // Fallback to array index if POID not found (shouldn't happen normally)
      if (recordIndex === undefined) {
        console.warn(`[RosterParser] WARNING: No record found for POID ${playerPoid} (${playerData.PFNA} ${playerData.PLNA}), using index ${i}`);
        recordIndex = i;
        playersUnmatched++;
        if (isTrackedPlrlPlayer) {
          console.log(`[RosterParser] *** PLRL PLAYER ${playerData.PFNA} ${playerData.PLNA} has NO POID MATCH, using index ${i} ***`);
        }
      } else {
        playersMatched++;
      }

      if (recordIndex >= playerTable.records.length) {
        console.warn(`[RosterParser] Record index ${recordIndex} exceeds table size, skipping player`);
        if (isTrackedPlrlPlayer) {
          console.error(`[RosterParser] *** PLRL PLAYER ${playerData.PFNA} ${playerData.PLNA} SKIPPED - record index ${recordIndex} out of bounds! ***`);
        }
        continue;
      }

      const record = playerTable.records[recordIndex];

      // CRITICAL DEBUG: For tracked PLRL players, verify the loop will see PLRL
      if (isTrackedPlrlPlayer) {
        const allFieldNames = Object.keys(playerData);
        const hasPlrlField = 'PLRL' in playerData;
        const plrlInKeys = allFieldNames.includes('PLRL');
        console.log(`[RosterParser] *** PLRL TRACE [${playerData.PFNA} ${playerData.PLNA}] ***`);
        console.log(`    playerData.PLRL = ${playerData.PLRL} (type: ${typeof playerData.PLRL})`);
        console.log(`    'PLRL' in playerData: ${hasPlrlField}`);
        console.log(`    PLRL in Object.keys: ${plrlInKeys}`);
        console.log(`    recordIndex: ${recordIndex}, POID: ${playerPoid}`);
        console.log(`    record.fields has PLRL: ${!!record.fields['PLRL']}`);
        plrlPlayersToTrack.get(i).processed = true;
      }

      // Update each field (exclude PLAYERPIC - it's a virtual field for display only)
      let sawPlrlInLoop = false;
      for (const fieldName in playerData) {
        if (fieldName === 'PLAYERPIC') {
          continue; // Skip virtual field
        }

        if (fieldName === 'PLRL' && isTrackedPlrlPlayer) {
          sawPlrlInLoop = true;
          console.log(`[RosterParser] *** PLRL IN LOOP *** Player ${playerData.PFNA} ${playerData.PLNA} - fieldName='PLRL', value=${playerData.PLRL}`);
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

          // CRITICAL DEBUG: For PLRL on tracked players, log the EXACT write operation
          if (fieldName === 'PLRL' && isTrackedPlrlPlayer) {
            console.log(`[RosterParser] *** PLRL WRITE ATTEMPT *** ${playerData.PFNA} ${playerData.PLNA}`);
            console.log(`    targetFieldName: ${targetFieldName}`);
            console.log(`    oldValue: ${oldValue} (type: ${typeof oldValue})`);
            console.log(`    newValue: ${newValue} (type: ${typeof newValue})`);
            console.log(`    BEFORE: record.fields['PLRL'].value = ${record.fields['PLRL']?.value}`);
          }

          record.fields[targetFieldName].value = newValue;

          // CRITICAL DEBUG: Verify write for tracked PLRL players
          if (fieldName === 'PLRL' && isTrackedPlrlPlayer) {
            const afterValue = record.fields['PLRL']?.value;
            console.log(`    AFTER: record.fields['PLRL'].value = ${afterValue}`);
            if (afterValue === newValue) {
              console.log(`    *** PLRL WRITE SUCCESS ***`);
              plrlPlayersToTrack.get(i).written = true;
            } else {
              console.error(`    *** PLRL WRITE FAILED *** Expected ${newValue}, got ${afterValue}`);
            }
          }

          // Log field mapping when it differs
          if (fieldName !== targetFieldName && oldValue !== newValue) {
            console.log(`[RosterParser] Record ${recordIndex}: Mapped ${fieldName} -> ${targetFieldName}: ${oldValue} -> ${newValue}`);
          }

          // Log important visual changes (face, portrait) and PLRL for debugging
          if ((fieldName === 'PEPS' || fieldName === 'PGHE' || fieldName === 'PLPL') && oldValue !== newValue) {
            console.log(`[RosterParser] ${playerData.PFNA} ${playerData.PLNA}: ${fieldName} ${oldValue} -> ${newValue}`);
          }

          // CRITICAL DEBUG: Log PLRL changes to trace save issue
          if (fieldName === 'PLRL' && oldValue !== newValue) {
            console.log(`[RosterParser] *** PLRL WRITE *** ${playerData.PFNA} ${playerData.PLNA}: ${oldValue} -> ${newValue} (record ${recordIndex})`);
          }

          fieldsUpdated++;
        } else if (fieldName === 'PLRL' && isTrackedPlrlPlayer) {
          console.error(`[RosterParser] *** PLRL FIELD NOT FOUND *** ${playerData.PFNA} ${playerData.PLNA}`);
          console.error(`    tdb2FieldName: ${tdb2FieldName}`);
          console.error(`    targetFieldName: ${targetFieldName}`);
          console.error(`    record.fields['PLRL'] exists: ${!!record.fields['PLRL']}`);
        } else if (fieldName === 'PEPS') {
          console.log(`[RosterParser] WARNING: Record ${recordIndex} has no PEPS field!`);
        } else if (fieldName === 'PHAN') {
          console.log(`[RosterParser] WARNING: Record ${recordIndex} has no PHAN field! Value would be: ${playerData[fieldName]}`);
        } else if (fieldName === 'PLRC') {
          console.log(`[RosterParser] WARNING: Record ${recordIndex} has no PLRC field! Value would be: ${playerData[fieldName]}`);
          // List available fields for debugging
          if (recordIndex === 0) {
            console.log(`[RosterParser] Available record fields:`, Object.keys(record.fields).join(', '));
          }
        }
      }

      // Check if PLRL was enumerated in the loop
      if (isTrackedPlrlPlayer && !sawPlrlInLoop) {
        console.error(`[RosterParser] *** PLRL NOT ENUMERATED *** ${playerData.PFNA} ${playerData.PLNA} - PLRL was not seen in for...in loop!`);
        console.error(`    playerData keys: ${Object.keys(playerData).join(', ')}`);
      }
    }

    // Summary of tracked PLRL players
    console.log('[RosterParser] *** PLRL TRACKING SUMMARY ***');
    for (const [idx, info] of plrlPlayersToTrack) {
      console.log(`  [${idx}] ${info.name}: PLRL=${info.plrl}, POID=${info.poid}, processed=${info.processed}, written=${info.written}`);
    }

    // CRITICAL FIX: Force-write PLRL for any tracked players that weren't written
    // This ensures PLRL values persist even if the for...in loop fails to enumerate them
    let plrlForceWritten = 0;
    const plrlDiagnostics = []; // Collect detailed info for browser console

    for (const [idx, info] of plrlPlayersToTrack) {
      const diag = { name: info.name, poid: info.poid, expected: info.plrl, processed: info.processed, writtenInLoop: info.written };

      const recordIndex = poidToRecordIndex.get(info.poid);
      diag.recordIndex = recordIndex;
      diag.poidFound = recordIndex !== undefined;

      if (recordIndex !== undefined && recordIndex < playerTable.records.length) {
        const record = playerTable.records[recordIndex];
        const plrlField = record.fields['PLRL'];
        diag.hasPlrlField = !!plrlField;
        diag.fieldType = plrlField?.type;

        if (plrlField) {
          const beforeValue = plrlField.value;
          diag.beforeWrite = beforeValue;

          // CRITICAL FIX: Write PLRL by directly setting _raw buffer
          // The TDB2Field value setter doesn't work reliably for all field types
          const utilService = require('../lib/services/utilService');
          const newRaw = utilService.writeModifiedLebCompressedInteger(info.plrl);
          plrlField._raw = newRaw;
          plrlField._isChanged = true;
          plrlForceWritten++;
          diag.forceWritten = true;

          // Verify the write
          const afterValue = plrlField.value;
          diag.afterWrite = afterValue;
          diag.success = afterValue === info.plrl;

          if (afterValue !== info.plrl) {
            console.error(`[RosterParser] PLRL write failed for ${info.name}: expected ${info.plrl}, got ${afterValue}`);
          }
        } else {
          diag.error = 'PLRL field not found in record';
          console.error(`[RosterParser] *** PLRL FORCE-WRITE FAILED *** ${info.name}: PLRL field not found in record`);
        }
      } else {
        diag.error = `Record not found (POID=${info.poid}, recordIndex=${recordIndex})`;
        console.error(`[RosterParser] *** PLRL FORCE-WRITE FAILED *** ${info.name}: Record not found (POID=${info.poid}, recordIndex=${recordIndex})`);
      }

      plrlDiagnostics.push(diag);
    }
    if (plrlForceWritten > 0) {
      console.log(`[RosterParser] Force-wrote PLRL for ${plrlForceWritten} players`);
    }

    // Log diagnostics summary
    console.log('[RosterParser] PLRL DIAGNOSTICS:', JSON.stringify(plrlDiagnostics, null, 2));

    console.log('[RosterParser] Updated', fieldsUpdated, 'field values');
    console.log('[RosterParser] POID matching: ', playersMatched, 'matched,', playersUnmatched, 'unmatched');
    console.log('[RosterParser] Original record has', Object.keys(playerTable.records[0].fields).length, 'fields - all preserved');

    // CRITICAL DEBUG: Verify PLRL values were written to file records
    console.log('[RosterParser] *** PLRL POST-WRITE VERIFICATION ***');
    let plrlNonZeroInFile = 0;
    for (let i = 0; i < Math.min(playerTable.records.length, 3400); i++) {
      const rec = playerTable.records[i];
      const plrl = rec.fields['PLRL']?.value;
      if (plrl && plrl > 0) plrlNonZeroInFile++;
    }
    console.log(`[RosterParser] PLRL in file records after write: ${plrlNonZeroInFile} non-zero`);
    if (plrlNonZeroInFile === 0) {
      console.error('[RosterParser] *** CRITICAL: All PLRL values are 0 after write! Save will not preserve PLRL! ***');
    }

    // CRITICAL FIX: Set POID = PGID for all records in file
    // The game links PLAY records to BLBM records by finding BLBM[].index === POID
    // Our BLBM records have .index === PGID, so POID MUST equal PGID for proper visual linkage
    // Without this fix, players get wrong faces because the game can't find their BLBM record
    // NOTE: Iterate ALL file records, not just players.length (which may be smaller after deletions)
    console.log('[RosterParser] *** POID FIX: Setting POID = PGID for proper BLBM linkage ***');
    let poidFixedCount = 0;
    for (let i = 0; i < playerTable.records.length; i++) {
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

    // CRITICAL FIX: For custom portrait PIDs (>= 12000), set PEPS from assignedGenr or BLBM.GENR
    // This ensures modded portraits persist after in-game editing
    // The game checks PEPS - if empty, it regenerates the player's appearance on edit
    // Fix: PEPS = assignedGenr (preferred) or BLBM.GENR, PLPL=100, PGHE=0
    const CUSTOM_PORTRAIT_PID_START = 12000;
    console.log('[RosterParser] *** PORTRAIT FIX: Setting PEPS from GENR for custom portrait PIDs ***');

    // Get BLBM table
    const blobTable = file.BLOB?.records?.[0];
    const blbmField = blobTable?.fields?.BLBM?.value;
    const blbmRecords = blbmField?.records || blbmField?._records || [];

    // Build POID -> player map for correct lookups after deletions
    const poidToPlayer = new Map();
    for (const player of players) {
      if (player.POID !== undefined && player.POID !== null) {
        poidToPlayer.set(player.POID, player);
      }
    }

    let portraitFixedCount = 0;
    // NOTE: Iterate ALL file records, not just players.length (which may be smaller after deletions)
    for (let i = 0; i < playerTable.records.length; i++) {
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
          // CRITICAL FIX: Find player by POID, not by array index!
          // After deletions, players[i] doesn't correspond to record[i]
          const player = poidToPlayer.get(poid);
          const playerAssignedGenr = player?.assignedGenr;
          let genr = null;

          if (playerAssignedGenr && typeof playerAssignedGenr === 'string' && playerAssignedGenr.startsWith('gen_')) {
            genr = playerAssignedGenr;
            console.log(`[RosterParser] Portrait fix: Using assignedGenr="${genr}" for POID ${poid}`);
          } else {
            // Fallback to BLBM.GENR
            const blbmRec = blbmRecords.find(r => r.index === poid);
            if (blbmRec) {
              const bf = blbmRec.fields || blbmRec._fields;
              genr = bf?.GENR?.value ?? bf?.GENR?._value;
            }
          }

          if (genr && genr.length > 0) {
            // Set PEPS = GENR
            pepsField.value = genr;
            if (player) player.PEPS = genr;

            // Set BLBM.ASNM = GENR
            const blbmRec = blbmRecords.find(r => r.index === poid);
            if (blbmRec) {
              const bf = blbmRec.fields || blbmRec._fields;
              if (bf?.ASNM) {
                if (bf.ASNM.value !== undefined) bf.ASNM.value = genr;
                else if (bf.ASNM._value !== undefined) bf.ASNM._value = genr;
              }
            }

            // Set PLPL=100, PGHE=0
            plplField.value = 100;
            pgheField.value = 0;
            if (player) {
              player.PLPL = 100;
              player.PGHE = 0;
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
    console.log(`[RosterParser] Portrait fix complete: ${portraitFixedCount} custom portrait players fixed`);

    // CRITICAL FIX: Disable unused record slots to prevent blank QBs appearing
    // Setting PTEN=0 should disable the player slot. Also distribute positions to avoid QB flood.
    // IMPORTANT: We must identify unused records by POID, not by array index!
    // When a player is deleted, the players array shifts but file records don't.
    // Using array index would incorrectly disable records that are still in use.
    let disabledSlots = 0;
    if (players.length < playerTable.records.length) {
      const slotsToDisable = playerTable.records.length - players.length;
      console.log(`[RosterParser] *** DISABLING ${slotsToDisable} UNUSED SLOTS (by POID matching) ***`);

      // Build set of POIDs that are STILL IN USE (in players array)
      const activePoids = new Set();
      for (const player of players) {
        if (player.POID !== undefined && player.POID !== null) {
          activePoids.add(player.POID);
        }
      }
      console.log(`[RosterParser] Active POIDs count: ${activePoids.size}`);

      // Cycle through non-QB positions for empty slots
      const positions = [19, 20, 21]; // K, P, LS - least visible positions
      let posIndex = 0;

      // Iterate ALL records and disable only those whose POID is NOT in activePoids
      for (let i = 0; i < playerTable.records.length; i++) {
        const record = playerTable.records[i];
        const recordPoid = record.fields['POID']?.value;

        // Skip records that are still in use (their POID is in activePoids)
        if (recordPoid !== undefined && activePoids.has(recordPoid)) {
          continue;
        }

        // This record is NOT in the players array - disable it
        const playerName = `${record.fields['PFNA']?.value || ''} ${record.fields['PLNA']?.value || ''}`.trim();
        if (disabledSlots < 5) {
          console.log(`[RosterParser] Disabling unused record[${i}]: POID=${recordPoid}, name="${playerName}"`);
        }

        // DISABLE the player slot
        if (record.fields['PTEN']) record.fields['PTEN'].value = 0; // Player NOT enabled

        // Clear identity
        if (record.fields['PFNA']) record.fields['PFNA'].value = '';
        if (record.fields['PLNA']) record.fields['PLNA'].value = '';
        if (record.fields['PEPS']) record.fields['PEPS'].value = '';
        if (record.fields['PGID']) record.fields['PGID'].value = 0;
        if (record.fields['PSXP']) record.fields['PSXP'].value = 0;

        // Set to free agent with non-QB position (K/P/LS cycle)
        if (record.fields['TGID']) record.fields['TGID'].value = 1009;
        if (record.fields['PPOS']) record.fields['PPOS'].value = positions[posIndex % positions.length];

        // Zero out ratings
        if (record.fields['POVR']) record.fields['POVR'].value = 0;
        if (record.fields['PSPD']) record.fields['PSPD'].value = 0;
        if (record.fields['PACC']) record.fields['PACC'].value = 0;
        if (record.fields['PSTR']) record.fields['PSTR'].value = 0;
        if (record.fields['PAGI']) record.fields['PAGI'].value = 0;
        if (record.fields['PAWR']) record.fields['PAWR'].value = 0;
        if (record.fields['PJEN']) record.fields['PJEN'].value = 0;
        if (record.fields['PAGE']) record.fields['PAGE'].value = 0;
        if (record.fields['PHGT']) record.fields['PHGT'].value = 0;
        if (record.fields['PWGT']) record.fields['PWGT'].value = 0;
        if (record.fields['PLTY']) record.fields['PLTY'].value = 0;

        disabledSlots++;
        posIndex++;
      }

      console.log(`[RosterParser] Disabled ${disabledSlots} unused slots (PTEN=0, by POID matching)`);
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
        // CRITICAL FIX: Sync player identity fields FIRST!
        // syncPlayerIdentityForAllPlayers copies names from PLAY to BLBM using INDEX matching
        // This MUST happen BEFORE updateBLBMForGenericFaces which uses NAME matching
        // Otherwise the name lookup fails because BLBM still has old/different names
        console.log('[RosterParser] Step 1: Syncing player identity (names) from PLAY to BLBM...');
        const identitySynced = await genericFaceService.syncPlayerIdentityForAllPlayers(file, players);
        console.log('[RosterParser] Player identity sync complete:', identitySynced, 'players synced');

        console.log('[RosterParser] Step 2: Updating BLBM generic faces...');

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
        console.log('[RosterParser] Step 3: Syncing BTYP (body type)...');
        btypSynced = await genericFaceService.syncBodyTypeForAllPlayers(file, players);
        console.log('[RosterParser] BTYP sync complete:', btypSynced, 'players synced');

        // Sync SKNT (skin tone) in BLBM from PLRC for ALL players
        // The game reads skin tone from SKNT in BLBM
        console.log('[RosterParser] Step 4: Syncing SKNT (skin tone)...');
        skntSynced = await genericFaceService.syncSkinToneForAllPlayers(file, players);
        console.log('[RosterParser] SKNT sync complete:', skntSynced, 'players synced');

        // CRITICAL: Sync PLRC (body skin in PLAY) from SKNT (face skin in BLBM)
        // For generic face players, body skin must match face skin!
        // This updates the players array and then writes back to PLAY table
        console.log('[RosterParser] Step 5: Syncing PLRC (body skin) from BLBM.SKNT...');
        const plrcSynced = await genericFaceService.syncBodySkinFromFaceSkin(file, players);
        console.log('[RosterParser] PLRC sync complete:', plrcSynced, 'players synced');

        // Write updated PLRC values back to PLAY table records
        // (The PLAY table was written earlier, so we need to update it again)
        if (plrcSynced > 0 && playerTable?.records) {
          console.log('[RosterParser] Writing PLRC updates back to PLAY table...');
          let plrcWritten = 0;
          let plrcDebugCount = 0;
          // Use POID matching to find correct record (handles player deletions)
          for (let i = 0; i < players.length; i++) {
            const player = players[i];
            const recordIdx = poidToRecordIndex.get(player.POID);
            if (recordIdx === undefined) continue;
            const record = playerTable.records[recordIdx];
            const playerName = `${player.PFNA || ''} ${player.PLNA || ''}`.trim();

            // DEBUG: Log first 5 players to understand the comparison
            if (plrcDebugCount < 5 && playerName) {
              const hasField = !!record.fields?.['PLRC'];
              const hasValue = player.PLRC !== undefined;
              const oldPlrc = record.fields?.['PLRC']?.value;
              console.log(`[RosterParser] PLRC DEBUG [${i}] ${playerName}: hasField=${hasField}, hasValue=${hasValue}, record=${oldPlrc} (type=${typeof oldPlrc}), player=${player.PLRC} (type=${typeof player.PLRC}), equal=${oldPlrc === player.PLRC}`);
              plrcDebugCount++;
            }

            if (record.fields?.['PLRC'] && player.PLRC !== undefined) {
              const oldPlrc = record.fields['PLRC'].value;
              // CRITICAL FIX: Use != instead of !== to handle type coercion (string vs number)
              // Also force write if types differ
              const typesMatch = typeof oldPlrc === typeof player.PLRC;
              const valuesDiffer = oldPlrc != player.PLRC || !typesMatch;
              if (valuesDiffer) {
                record.fields['PLRC'].value = Number(player.PLRC);
                plrcWritten++;
                if (plrcWritten <= 10) {
                  console.log(`[RosterParser] PLRC write: ${playerName} ${oldPlrc} -> ${player.PLRC} (types: ${typeof oldPlrc} vs ${typeof player.PLRC})`);
                }
              }
            }
          }
          console.log(`[RosterParser] Wrote ${plrcWritten} PLRC updates to PLAY table`);
        }
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
          // NOTE: FBCHUNKS JSON objects are in the same order as PLAY table records
          // So we iterate through players and use their POID to find the correct objs index
          for (let i = 0; i < players.length; i++) {
            const player = players[i];
            if (!player) continue;

            // Find the correct file record index via POID
            const recordIdx = poidToRecordIndex.get(player.POID);
            if (recordIdx === undefined || recordIdx >= objs.length) continue;

            const pos = objs[recordIdx];
            const sub = s.slice(pos.start, pos.end);
            let parsed = null;
            try {
              parsed = JSON.parse(sub);
            } catch (e) {
              continue;
            }

            if (parsed && Object.prototype.hasOwnProperty.call(parsed, 'bodyType')) {

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

    // ========== DEBUG: COMPARE EQUIPMENT BEFORE vs AFTER ==========
    console.log('[RosterParser] ========== EQUIPMENT COMPARISON: INITIAL vs FINAL ==========');
    const finalBlob = file.BLOB?.records?.[0];
    const finalBlbm = finalBlob?.fields?.BLBM?.value;
    const finalBlbmRecords = finalBlbm?._records || [];

    let equipmentChanged = 0;
    let equipmentUnchanged = 0;
    let blbmIndexChanged = 0;
    let nameChanged = 0;

    console.log('[RosterParser] Comparing first 10 BLBM records (INITIAL vs FINAL):');
    for (let i = 0; i < Math.min(10, finalBlbmRecords.length); i++) {
      const rec = finalBlbmRecords[i];
      const f = rec.fields || rec._fields;
      const cfnm = f?.CFNM?.value ?? f?.CFNM?._value ?? '';
      const clnm = f?.CLNM?.value ?? f?.CLNM?._value ?? '';
      const blbmIndex = rec.index;
      const finalEquip = getEquipmentSnapshot(rec);
      const finalEquipStr = finalEquip ? JSON.stringify(finalEquip) : 'NO_EQUIPMENT';

      const tracked = trackedEquipment[i];
      const initialEquipStr = tracked?.initialEquipment || 'NOT_TRACKED';
      const initialName = tracked?.name || 'NOT_TRACKED';
      const initialBlbmIndex = tracked?.blbmIndex;

      // Check what changed
      const equipChanged = initialEquipStr !== finalEquipStr;
      const indexChanged = initialBlbmIndex !== blbmIndex;
      const nmChanged = initialName !== `${cfnm} ${clnm}`;

      if (equipChanged) equipmentChanged++;
      else equipmentUnchanged++;
      if (indexChanged) blbmIndexChanged++;
      if (nmChanged) nameChanged++;

      // Get visor (slot 2) for display
      const initialVisor = tracked?.initialEquipment !== 'NO_EQUIPMENT' && tracked?.initialEquipment !== 'NOT_TRACKED'
        ? JSON.parse(tracked.initialEquipment)[2] || 'none' : 'N/A';
      const finalVisor = finalEquip?.[2] || 'none';

      const status = equipChanged ? '!!! CHANGED !!!' : 'unchanged';
      console.log(`  BLBM[${i}]: ${status}`);
      console.log(`    Name: "${initialName}" -> "${cfnm} ${clnm}" ${nmChanged ? '(CHANGED!)' : ''}`);
      console.log(`    Index: ${initialBlbmIndex} -> ${blbmIndex} ${indexChanged ? '(CHANGED!)' : ''}`);
      console.log(`    Visor: "${initialVisor}" -> "${finalVisor}"`);
      if (equipChanged) {
        console.log(`    FULL INITIAL: ${initialEquipStr.substring(0, 200)}`);
        console.log(`    FULL FINAL:   ${finalEquipStr.substring(0, 200)}`);
      }
    }

    console.log(`[RosterParser] SUMMARY: Equipment changed=${equipmentChanged}, unchanged=${equipmentUnchanged}`);
    console.log(`[RosterParser] SUMMARY: BLBM.index changed=${blbmIndexChanged}, names changed=${nameChanged}`);
    console.log('[RosterParser] ========== END EQUIPMENT COMPARISON ==========');

    // CRITICAL: Final PLRL verification before physical save
    // Check the SPECIFIC players that had non-zero PLRL values, not just first 10 records
    finalPlrlNonZero = 0;
    plrlSamples = [];

    // First check the specifically tracked PLRL players
    for (const [idx, info] of plrlPlayersToTrack) {
      const recordIndex = poidToRecordIndex.get(info.poid);
      if (recordIndex !== undefined && recordIndex < playerTable.records.length) {
        const rec = playerTable.records[recordIndex];
        const plrl = rec.fields['PLRL']?.value;
        if (plrl && plrl > 0) {
          finalPlrlNonZero++;
          plrlSamples.push({ name: info.name, expected: info.plrl, actual: plrl, recordIndex });
        } else {
          console.error(`[RosterParser] *** PLRL NOT IN FILE *** ${info.name}: expected ${info.plrl}, got ${plrl} (record ${recordIndex})`);
        }
      }
    }

    console.log(`[RosterParser] *** FINAL PLRL CHECK BEFORE WRITE: ${finalPlrlNonZero}/${plrlPlayersToTrack.size} tracked players have non-zero PLRL in file records ***`);
    if (plrlSamples.length > 0) {
      console.log('[RosterParser] PLRL verified in file records:', JSON.stringify(plrlSamples));
    }

    // If any tracked PLRL values are missing, log the issue
    if (finalPlrlNonZero < plrlPlayersToTrack.size) {
      console.error(`[RosterParser] *** CRITICAL: ${plrlPlayersToTrack.size - finalPlrlNonZero} PLRL values MISSING from file records before save! ***`);
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
            // NOTE: Use POID to find correct record index (handles player deletions)
            let modified = false;
            for (let i = 0; i < players.length; i++) {
              const player = players[i];
              if (!player) continue;

              // Find the correct file record index via POID
              const recordIdx = poidToRecordIndex.get(player.POID);
              if (recordIdx === undefined || recordIdx >= objs.length) continue;

              const item = objs[recordIdx];
              if (Object.prototype.hasOwnProperty.call(item.json, 'bodyType')) {
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
      injuriesCleared,
      equipmentUpdated,
      // PLRL debug info - will show in browser console
      plrlDebug: {
        incomingNonZero: incomingPlrlNonZero,
        finalNonZero: finalPlrlNonZero,
        forceWritten: plrlForceWritten,
        samples: plrlSamples.slice(0, 5),
        diagnostics: plrlDiagnostics // Detailed per-player diagnostics
      }
    };

  } catch (error) {
    console.error('[RosterParser] ===== ERROR IN SAVE =====');
    console.error('[RosterParser] Error:', error.message);
    console.error('[RosterParser] ========================');
    throw new Error(`Failed to save roster file: ${error.message}`);
  }
}

// Complete equipment slot mappings - all 33+ slots discovered in roster files
const EQUIPMENT_SLOTS = {
  // Head/Face
  Visor: 2,
  FacePaint: 51,
  Helmet: 106,
  Facemask: 107,  // Note: This slot needs verification - may need adjustment
  Mouthpiece: 122,
  HelmetFlag: 88,
  Neckpad: 29,
  GuardianCap: 135,

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
    // Standard Visors
    { value: 'GearVisor_None', label: 'None' },
    { value: 'GearVisor_visorClear', label: 'Clear' },
    { value: 'GearVisor_visorDark', label: 'Dark' },
    { value: 'GearVisor_visorDarkLight', label: 'Light Tint' },
    // Oakley Visors
    { value: 'GearVisor_visorOakley_clear', label: 'Oakley Clear' },
    { value: 'GearVisor_visorOakley_Dark', label: 'Oakley Dark' },
    { value: 'GearVisor_visorOakley_DarkLight', label: 'Oakley Light Tint' },
    { value: 'G_Visor_Oakley_Prizm', label: 'Oakley Prizm' },
    { value: 'OakleyPrizm24K_Visor', label: 'Oakley Prizm 24K' },
    { value: 'OakleyPrizm60Gray_Visor', label: 'Oakley Prizm 60 Gray' },
    { value: 'OakleyPrizmBlue_Visor', label: 'Oakley Prizm Blue' },
    { value: 'OakleyPrizmJade_Visor', label: 'Oakley Prizm Jade' },
    { value: 'OakleyPrizmTorch_Visor', label: 'Oakley Prizm Torch' },
    // Nike Visors
    { value: 'G_Visor_99Club_B_GOL', label: 'Nike 99 Club Gold' },
    { value: 'G_Visor_99Club_B_WHI', label: 'Nike 99 Club Black' },
    { value: 'G_Visor_Brotherhood_BLA', label: 'Nike Brotherhood Black' },
    { value: 'G_Visor_Brotherhood_ORA', label: 'Nike Brotherhood Orange' },
    { value: 'G_Visor_ChristianMcCaffery_BLA', label: 'Nike X McCaffrey' },
    { value: 'G_Visor_SaquonBarkley_BLA', label: 'Nike X Saquon Barkley' },
    // Jordan Visors
    { value: 'v_NXJ_Visor_BLA', label: 'Jordan Black' },
    { value: 'v_NXJ_Visor_LBLU', label: 'Jordan Blue' },
    { value: 'v_JPO_Visor_HempBrown', label: 'Jordan Brown' },
    { value: 'v_JPO_Visor_IronGray', label: 'Jordan Gray' },
    { value: 'v_JPO_Visor_WHI', label: 'Jordan Navy' },
    // Special Visors
    { value: 'G_Visor_Tron_B_BLU', label: 'Light Speed Blue' },
    { value: 'G_Visor_Tron_B_PRP', label: 'Light Speed Purple' },
    { value: 'G_Visor_Miami80s_B', label: 'Miami Underground' },
    { value: 'G_Visor_Berlin_B', label: 'Berlin' },
    { value: 'G_Visor_Elites', label: 'Elites' },
    { value: 'G_Visor_Hermes', label: 'Hermes' },
    { value: 'G_Visor_BlackOut_NIN_B', label: 'Black Out' },
    // Gatorade Visors
    { value: 'v_GTD_Grn_Visor', label: 'Gatorade Green' },
    { value: 'v_GTD_Orng_Visor', label: 'Gatorade Orange' },
    { value: 'v_GTD_Red_Visor', label: 'Gatorade Red' },
    { value: 'v_GTD_Combo_Visor', label: 'Gatorade Multicolor' },
    // Player Signature Visors
    { value: 'v_DHEN_Visor', label: 'Derrick Henry' },
    { value: 'v_MVK_Visor', label: 'Michael Vick' },
    { value: 'v_LAWT_Visor', label: 'Lawrence Taylor' },
    { value: 'v_SQN_2021_Visor', label: 'Saquon Barkley' },
    { value: 'v_JCH_Visor_PUR', label: 'Ja\'Marr Chase' },
    { value: 'V_MOSS_Visor_GOL', label: 'Randy Moss' },
    { value: 'v_RYL_Visor_GRE', label: 'Ray Lewis' },
    { value: 'v_ROD_Visor_GRE', label: 'Aaron Rodgers' },
    { value: 'v_OCH_Visor_YEL', label: 'Ochocinco' }
  ],
  FacePaint: [
    { value: 'FaceMarks_None', label: 'None' },
    { value: 'FaceMarks_EyePaint', label: 'Eye Black' },
    { value: 'FaceMarks_EyePaint2', label: 'Eye Black 2' },
    { value: 'FaceMarks_EyePaint3', label: 'Eye Black 3' },
    { value: 'FaceMarks_EyePaintCross', label: 'Eye Black Cross' },
    { value: 'FaceMarks_EyeTape', label: 'Eye Tape' },
    { value: 'FaceMarks_EyeTapeLeft', label: 'Eye Tape Left' },
    { value: 'FaceMarks_EyeTapeRight', label: 'Eye Tape Right' },
    { value: 'FaceMarks_NoseTape', label: 'Nose Tape' },
    { value: 'FaceMarks_NoseEyeTape', label: 'Nose & Eye Tape' },
    { value: 'FaceMarks_NoseTapeEyePaint', label: 'Nose Tape + Eye Black' }
  ],
  Helmet: [
    // Riddell Helmets
    { value: 'GearHelmet_Speed_Flex', label: 'Riddell SpeedFlex' },
    { value: 'GearHelmet_RevolutionSpeed', label: 'Riddell Revolution Speed' },
    { value: 'GearHelmet_Revolution', label: 'Riddell Revolution' },
    { value: 'GearHelmet_Axiom', label: 'Riddell Axiom' },
    { value: 'GearHelmet_Riddell360', label: 'Riddell 360' },
    { value: 'GearHelmet_RiddellTK', label: 'Riddell TK' },
    { value: 'GearHelmet_Standard', label: 'Riddell VSR4' },
    { value: 'GearHelmet_standardBrady', label: 'Riddell VSR4 Softcup' },
    // Schutt Helmets
    { value: 'GearHelmet_Schutt', label: 'Schutt Air Advantage' },
    { value: 'GearHelmet_AirXP', label: 'Schutt Air XP PRO VTD' },
    { value: 'GearHelmet_SchuttF7', label: 'Schutt F7' },
    { value: 'GearHelmet_SchuttF7Pro', label: 'Schutt F7 Pro' },
    { value: 'GearHelmet_SchuttVeng', label: 'Schutt Vengeance Pro' },
    { value: 'GearHelmet_VengeanceZ10', label: 'Schutt Vengeance Z10' },
    // VICIS Helmets
    { value: 'GearHelmet_VicisZero1', label: 'VICIS Zero1' },
    { value: 'GearHelmet_VicisZero2', label: 'VICIS Zero2' },
    { value: 'GearHelmet_VicisZero2Trench', label: 'VICIS Zero2 Trench' },
    // Xenith Helmets
    { value: 'GearHelmet_XenithEpic', label: 'Xenith Epic' },
    { value: 'GearHelmet_XenithOrbit', label: 'Xenith Orbit' },
    { value: 'GearHelmet_XenithShadow', label: 'Xenith Shadow' },
    { value: 'GearHelmet_X2E', label: 'Xenith X2E' },
    // Light/Alternate Helmets
    { value: 'GearHelmet_LightGladiator', label: 'Light Gladiator' },
    { value: 'GearHelmet_LightLS2', label: 'Light LS2' },
    // Special/Seasonal Helmets
    { value: 'GearHelmet_PumpkinDefender', label: 'Pumpkin Defender' },
    { value: 'GearHelmet_PumpkinInvader', label: 'Pumpkin Invader' },
    { value: 'GearHelmet_v_DOD_PumpkinDefender', label: 'Day of the Dead Pumpkin' },
    { value: 'GearHelmet_SnowmanEvader', label: 'Snowman Evader' },
    { value: 'GearHelmet_SnowmanFrontline', label: 'Snowman Frontline' },
    { value: 'GearHelmet_SnowmanInterceptor', label: 'Snowman Interceptor' }
  ],
  Facemask: [
    // Standard Facemasks
    { value: 'GearFaceMask_2Bar', label: '2 Bar' },
    { value: 'GearFaceMask_2BarNose', label: '2 Bar Nose' },
    { value: 'GearFaceMask_2BarQBBull', label: '2 Bar QB Bull' },
    { value: 'GearFaceMask_2BarQBSingle', label: '2 Bar QB Single' },
    { value: 'GearFaceMask_2BarSingle', label: '2 Bar Single' },
    { value: 'GearFaceMask_Standard2BarWR', label: '2 Bar WR' },
    { value: 'GearFaceMask_3Bar', label: '3 Bar' },
    { value: 'GearFaceMask_3BarNose', label: '3 Bar Nose' },
    { value: 'GearFaceMask_3BarQB', label: '3 Bar QB' },
    { value: 'GearFaceMask_3BarQBSingle', label: '3 Bar QB Single' },
    { value: 'GearFaceMask_3BarRB', label: '3 Bar RB' },
    { value: 'GearFaceMask_3BarRBJagged', label: '3 Bar RB Jagged' },
    { value: 'GearFaceMask_3BarSingle', label: '3 Bar Single' },
    // Cage Facemasks
    { value: 'GearFaceMask_FullCage', label: 'Full Cage' },
    { value: 'GearFaceMask_FullCage2', label: 'Full Cage 2' },
    { value: 'GearFaceMask_HalfCage', label: 'Half Cage' },
    { value: 'GearFaceMask_HalfCage2', label: 'Half Cage 2' },
    { value: 'GearFaceMask_HalfCage3', label: 'Half Cage 3' },
    { value: 'GearFaceMask_FlatHalfCage', label: 'Flat Half Cage' },
    // Robot Facemasks
    { value: 'GearFaceMask_Robot', label: 'Robot' },
    { value: 'GearFaceMask_RobotRB', label: 'Robot RB' },
    { value: 'GearFaceMask_FullCageRobot', label: 'Full Cage Robot' },
    // Bulldog Facemasks
    { value: 'GearFaceMask_StdBulldog', label: 'Bulldog' },
    { value: 'GearFaceMask_BullRB', label: 'Bull RB' },
    // Kicker Facemasks
    { value: 'GearFaceMask_Kicker', label: 'Kicker' },
    { value: 'GearFaceMask_LightKicker', label: 'Light Kicker' },
    // Riddell SpeedFlex Facemasks
    { value: 'GearFaceMask_Speedflex2Bar', label: 'SpeedFlex 2 Bar' },
    { value: 'GearFaceMask_Speedflex2BarQB', label: 'SpeedFlex 2 Bar QB' },
    { value: 'GearFaceMask_Speedflex2BarSingle', label: 'SpeedFlex 2 Bar Single' },
    { value: 'GearFaceMask_Speedflex_2_Bar_WR', label: 'SpeedFlex 2 Bar WR' },
    { value: 'GearFaceMask_Speedflex3Bar', label: 'SpeedFlex 3 Bar' },
    { value: 'GearFaceMask_Speedflex3BarLB', label: 'SpeedFlex 3 Bar LB' },
    { value: 'GearFaceMask_Speedflex3BarQB', label: 'SpeedFlex 3 Bar QB' },
    { value: 'GearFaceMask_Speedflex3BarRB', label: 'SpeedFlex 3 Bar RB' },
    { value: 'GearFaceMask_Speedflex3BarSingle', label: 'SpeedFlex 3 Bar Single' },
    { value: 'GearFaceMask_SpeedFlex808', label: 'SpeedFlex 808' },
    { value: 'GearFaceMask_SpeedflexCage', label: 'SpeedFlex Cage' },
    { value: 'GearFaceMask_SpeedflexFullcage', label: 'SpeedFlex Full Cage' },
    { value: 'GearFaceMask_SpeedflexHalfCage', label: 'SpeedFlex Half Cage' },
    { value: 'GearFaceMask_SpeedflexJRCross', label: 'SpeedFlex JR Cross' },
    { value: 'GearFaceMask_SpeedFlexKicker', label: 'SpeedFlex Kicker' },
    { value: 'GearFaceMask_SpeedflexRobot', label: 'SpeedFlex Robot' },
    { value: 'GearFaceMask_SpeedflexRobotRB', label: 'SpeedFlex Robot RB' },
    // Riddell Axiom Facemasks
    { value: 'GearFaceMask_Axiom2BarJagged', label: 'Axiom 2 Bar Jagged' },
    { value: 'GearFaceMask_Axiom2barsingle', label: 'Axiom 2 Bar Single' },
    { value: 'GearFaceMask_Axiom3BarDouble', label: 'Axiom 3 Bar Double' },
    { value: 'GearFaceMask_Axiom3BarJagged', label: 'Axiom 3 Bar Jagged' },
    { value: 'GearFaceMask_Axiom3BarLBSingle', label: 'Axiom 3 Bar LB Single' },
    { value: 'GearFaceMask_Axiom3BarRB', label: 'Axiom 3 Bar RB' },
    { value: 'GearFaceMask_Axiom3BarSingle', label: 'Axiom 3 Bar Single' },
    { value: 'GearFaceMask_Axiom808', label: 'Axiom 808' },
    { value: 'GearFaceMask_AxiomFullcage', label: 'Axiom Fullcage' },
    { value: 'GearFaceMask_AxiomGrid', label: 'Axiom Grid' },
    { value: 'GearFaceMask_AxiomJRCross', label: 'Axiom JR Cross' },
    { value: 'GearFaceMask_AxiomRobot808', label: 'Axiom Robot 808' },
    { value: 'GearFaceMask_AxiomRobotCage', label: 'Axiom Robot Cage' },
    { value: 'GearFaceMask_AxiomRobotJagged', label: 'Axiom Robot Jagged' },
    { value: 'GearFaceMask_AxiomSpyder', label: 'Axiom Spyder' },
    // Riddell Revolution Speed Facemasks
    { value: 'GearFaceMask_revospeed2bar', label: 'Revo Speed 2 Bar' },
    { value: 'GearFaceMask_revospeed2barSingle', label: 'Revo Speed 2 Bar Single' },
    { value: 'GearFaceMask_Revospeed2BarWR', label: 'Revo Speed 2 Bar WR' },
    { value: 'GearFaceMask_Revospeed3bar', label: 'Revo Speed 3 Bar' },
    { value: 'GearFaceMask_revoSpeed3barLb', label: 'Revo Speed 3 Bar LB' },
    { value: 'GearFaceMask_Revospeed3BarQB', label: 'Revo Speed 3 Bar QB' },
    { value: 'GearFaceMask_revoSpeed3barSingle', label: 'Revo Speed 3 Bar Single' },
    { value: 'GearFaceMask_Revospeed808', label: 'Revo Speed 808' },
    { value: 'GearFaceMask_revoSpeedFullCage', label: 'Revo Speed Full Cage' },
    { value: 'GearFaceMask_RevospeedHalfCage', label: 'Revo Speed Half Cage' },
    { value: 'GearFaceMask_revospeedKicker', label: 'Revo Speed Kicker' },
    { value: 'GearFaceMask_revoSpeedRobot', label: 'Revo Speed Robot' },
    { value: 'GearFaceMask_revoSpeedRobotRB', label: 'Revo Speed Robot RB' },
    // Riddell 360 Facemasks
    { value: 'GearFaceMask_Riddell3603BarLB', label: '360 3 Bar LB' },
    { value: 'GearFaceMask_Riddell360FullCage', label: '360 Full Cage' },
    { value: 'GearFaceMask_Riddell360Robot', label: '360 Robot' },
    { value: 'GearFaceMask_Riddell360Robot2', label: '360 Robot 2' },
    // Schutt F7 Facemasks
    { value: 'GearFaceMask_F72Bar', label: 'Schutt F7 2 Bar' },
    { value: 'GearFaceMask_F73Bar', label: 'Schutt F7 3 Bar' },
    { value: 'GearFaceMask_F73BarRB', label: 'Schutt F7 3 Bar RB' },
    { value: 'GearFaceMask_F7808', label: 'Schutt F7 808' },
    { value: 'GearFaceMask_F7FullCage', label: 'Schutt F7 Fullcage' },
    { value: 'GearFaceMask_F7JRCross', label: 'Schutt F7 JR Cross' },
    { value: 'GearFaceMask_F7Kicker', label: 'Schutt F7 Kicker' },
    { value: 'GearFaceMask_F7Robot', label: 'Schutt F7 Robot' },
    { value: 'GearFaceMask_F7RobotRB', label: 'Schutt F7 Robot RB' },
    // Schutt Vengeance Facemasks
    { value: 'GearFaceMask_VengeanceQB', label: 'Vengeance 2 Bar' },
    { value: 'GearFaceMask_Vengeance3Bar', label: 'Vengeance 3 Bar' },
    { value: 'GearFaceMask_Vengeance3BarRB', label: 'Vengeance 3 Bar RB' },
    { value: 'GearFaceMask_VengeanceFullCage', label: 'Vengeance Full Cage' },
    { value: 'GearFaceMask_VengeanceKicker', label: 'Vengeance Kicker' },
    { value: 'GearFaceMask_VengeanceRobot', label: 'Vengeance Robot' },
    { value: 'GearFaceMask_VengeanceZ102Bar', label: 'Vengeance Z10 2 Bar' },
    { value: 'GearFaceMask_VengeanceZ10Cage', label: 'Vengeance Z10 Cage' },
    { value: 'GearFaceMask_VengeanceZ10Robot', label: 'Vengeance Z10 Robot' },
    // VICIS Facemasks
    { value: 'GearFaceMask_VicisZero12Bar', label: 'VICIS 2 Bar' },
    { value: 'GearFaceMask_VicisZero13Bar', label: 'VICIS 3 Bar' },
    { value: 'GearFaceMask_VicisZero13BarLB', label: 'VICIS 3 Bar LB' },
    { value: 'GearFaceMask_VicisZero13BarRB', label: 'VICIS 3 Bar RB' },
    { value: 'GearFaceMask_VicisZero1BullRB', label: 'VICIS Bull RB' },
    { value: 'GearFaceMask_VicisZero1Fullcage', label: 'VICIS Full Cage' },
    { value: 'GearFaceMask_Vicis_Kicker', label: 'VICIS Kicker' },
    { value: 'GearFaceMask_VicisZero1Robot', label: 'VICIS Robot' },
    { value: 'GearFaceMask_VicisZero2BAR', label: 'VICIS Zero2 2 Bar' },
    { value: 'GearFaceMask_VicisZero2Kicker', label: 'VICIS Zero2 Kicker' },
    { value: 'GearFaceMask_VicisZero2Robot', label: 'VICIS Zero2 Robot' },
    // Xenith Facemasks
    { value: 'GearFaceMask_Xenith2Bar', label: 'Xenith 2 Bar' },
    { value: 'GearFaceMask_Xenith3barrb', label: 'Xenith 3 Bar RB' },
    { value: 'GearFaceMask_XenithFullcage', label: 'Xenith Full Cage' },
    { value: 'GearFaceMask_XenithKicker', label: 'Xenith Kicker' },
    { value: 'GearFaceMask_XenithOrbit2Bar', label: 'Xenith Orbit 2 Bar' },
    { value: 'GearFaceMask_XenithOrbit3barrb', label: 'Xenith Orbit 3 Bar RB' },
    { value: 'GearFaceMask_XenithOrbitRobot', label: 'Xenith Orbit Robot' },
    { value: 'GearFaceMask_XenithPredator', label: 'Xenith Predator' },
    { value: 'GearFaceMask_XenithPrism', label: 'Xenith Prism' },
    { value: 'GearFaceMask_Xenith_Prowl', label: 'Xenith Prowl' },
    { value: 'GearFaceMask_XenithRobot', label: 'Xenith Robot' },
    { value: 'GearFaceMask_XenithRobotrb', label: 'Xenith Robot RB' },
    // Vintage Facemasks
    { value: 'GearFaceMask_VintageOneBar', label: 'Vintage One Bar' },
    { value: 'GearFaceMask_VintageTwoBar', label: 'Vintage Two Bar' },
    { value: 'GearFaceMask_VintageHalfCage', label: 'Vintage Half Cage' },
    { value: 'GearFaceMask_VintageKicker', label: 'Vintage Kicker' },
    { value: 'GearFaceMask_VintageStandard', label: 'Vintage Standard' }
  ],
  Mouthpiece: [
    { value: 'GearMouthpiece_None', label: 'None' },
    { value: 'GearMouthpiece_PacifierDual_Black', label: 'Black' },
    { value: 'GearMouthpiece_PacifierDual_White', label: 'White' },
    { value: 'GearMouthpiece_PacifierDual_TeamColor', label: 'Team Color' },
    { value: 'GearMouthpiece_PacifierDual_SecondaryColor', label: 'Secondary Color' }
  ],
  HelmetFlag: [
    { value: 'HelmetFlag_None', label: 'None' },
    { value: 'HelmetFlag_AmericanSamoa', label: 'American Samoa' },
    { value: 'HelmetFlag_Antigua', label: 'Antigua' },
    { value: 'HelmetFlag_Australia', label: 'Australia' },
    { value: 'HelmetFlag_Austria', label: 'Austria' },
    { value: 'HelmetFlag_Bahamas', label: 'Bahamas' },
    { value: 'HelmetFlag_Belize', label: 'Belize' },
    { value: 'HelmetFlag_Brazil', label: 'Brazil' },
    { value: 'HelmetFlag_Burundi', label: 'Burundi' },
    { value: 'HelmetFlag_Cameroon', label: 'Cameroon' },
    { value: 'HelmetFlag_Canada', label: 'Canada' },
    { value: 'HelmetFlag_Chile', label: 'Chile' },
    { value: 'HelmetFlag_China', label: 'China' },
    { value: 'HelmetFlag_Colombia', label: 'Colombia' },
    { value: 'HelmetFlag_Croatia', label: 'Croatia' },
    { value: 'HelmetFlag_Cuba', label: 'Cuba' },
    { value: 'HelmetFlag_DemocraticRepublicofCongo', label: 'DR Congo' },
    { value: 'HelmetFlag_Denmark', label: 'Denmark' },
    { value: 'HelmetFlag_Djibouti', label: 'Djibouti' },
    { value: 'HelmetFlag_DominicanRepublic', label: 'Dominican Republic' },
    { value: 'HelmetFlag_England', label: 'England' },
    { value: 'HelmetFlag_Germany', label: 'Germany' },
    { value: 'HelmetFlag_Ghana', label: 'Ghana' },
    { value: 'HelmetFlag_Greece', label: 'Greece' },
    { value: 'HelmetFlag_Grenada', label: 'Grenada' },
    { value: 'HelmetFlag_Guinea', label: 'Guinea' },
    { value: 'HelmetFlag_Guyana', label: 'Guyana' },
    { value: 'HelmetFlag_Haiti', label: 'Haiti' },
    { value: 'HelmetFlag_Ireland', label: 'Ireland' },
    { value: 'HelmetFlag_Italy', label: 'Italy' },
    { value: 'HelmetFlag_IvoryCoast', label: 'Ivory Coast' },
    { value: 'HelmetFlag_Jamaica', label: 'Jamaica' },
    { value: 'HelmetFlag_Japan', label: 'Japan' },
    { value: 'HelmetFlag_Liberia', label: 'Liberia' },
    { value: 'HelmetFlag_Mali', label: 'Mali' },
    { value: 'HelmetFlag_Martinique', label: 'Martinique' },
    { value: 'HelmetFlag_Mexico', label: 'Mexico' },
    { value: 'HelmetFlag_Netherlands', label: 'Netherlands' },
    { value: 'HelmetFlag_NewZealand', label: 'New Zealand' },
    { value: 'HelmetFlag_Nigeria', label: 'Nigeria' },
    { value: 'HelmetFlag_Panama', label: 'Panama' },
    { value: 'HelmetFlag_Philippines', label: 'Philippines' },
    { value: 'HelmetFlag_Poland', label: 'Poland' },
    { value: 'HelmetFlag_PuertoRico', label: 'Puerto Rico' },
    { value: 'HelmetFlag_Romania', label: 'Romania' },
    { value: 'HelmetFlag_Samoa', label: 'Samoa' },
    { value: 'HelmetFlag_Scotland', label: 'Scotland' },
    { value: 'HelmetFlag_Senegal', label: 'Senegal' },
    { value: 'HelmetFlag_Serbia', label: 'Serbia' },
    { value: 'HelmetFlag_SierraLeone', label: 'Sierra Leone' },
    { value: 'HelmetFlag_SouthAfrica', label: 'South Africa' },
    { value: 'HelmetFlag_SouthKorea', label: 'South Korea' },
    { value: 'HelmetFlag_Spain', label: 'Spain' },
    { value: 'HelmetFlag_StKittsandNevis', label: 'St. Kitts & Nevis' },
    { value: 'HelmetFlag_StVincent', label: 'St. Vincent' },
    { value: 'HelmetFlag_Suriname', label: 'Suriname' },
    { value: 'HelmetFlag_Sweden', label: 'Sweden' },
    { value: 'HelmetFlag_Switzerland', label: 'Switzerland' },
    { value: 'HelmetFlag_Tonga', label: 'Tonga' },
    { value: 'HelmetFlag_TrinidadTobago', label: 'Trinidad & Tobago' },
    { value: 'HelmetFlag_UK', label: 'United Kingdom' },
    { value: 'HelmetFlag_Uganda', label: 'Uganda' },
    { value: 'HelmetFlag_Venezuela', label: 'Venezuela' },
    { value: 'HelmetFlag_Zimbabwe', label: 'Zimbabwe' }
  ],
  Neckpad: [
    { value: 'GearNeckpad_None', label: 'None' },
    { value: 'GearNeckpad_CowboyCollarNeckRoll', label: 'Cowboy Collar' },
    { value: 'GearNeckpad_ButterflyNeckRoll', label: 'Butterfly Neck Roll' }
  ],
  GuardianCap: [
    { value: 'GuardianCap_None', label: 'None' },
    { value: 'GuardianCap_guardianXTsleeve', label: 'Guardian XT' }
  ],

  // Arms - Sleeves (43 options each)
  LeftSleeve: [
    { value: 'ArmSleeve_None', label: 'None' },
    { value: 'GearArmSleeve_Baggy_Black', label: 'Baggy - Black' },
    { value: 'GearArmSleeve_Baggy_White', label: 'Baggy - White' },
    { value: 'GearArmSleeve_Baggy_TeamColor', label: 'Baggy - Team' },
    { value: 'GearArmSleeve_Baggy_SecondaryColor', label: 'Baggy - Secondary' },
    { value: 'GearArmSleeve_Full_sleeveLongUnderarmor_normal_Black', label: 'Full - Black' },
    { value: 'GearArmSleeve_Full_sleeveLongUnderarmor_normal_White', label: 'Full - White' },
    { value: 'GearArmSleeve_Full_sleeveLongUnderarmor_normal_TeamColor', label: 'Full - Team' },
    { value: 'GearArmSleeve_Full_sleeveLongUnderarmor_normal_SecondaryColor', label: 'Full - Secondary' },
    { value: 'GearArmSleeve_Half_sleeveLongUnderarmor_normal_Black', label: 'Half - Black' },
    { value: 'GearArmSleeve_Half_sleeveLongUnderarmor_normal_White', label: 'Half - White' },
    { value: 'GearArmSleeve_Half_sleeveLongUnderarmor_normal_TeamColor', label: 'Half - Team' },
    { value: 'GearArmSleeve_Quarter_sleeveLongUnderarmor_normal_Black', label: 'Quarter - Black' },
    { value: 'GearArmSleeve_Quarter_sleeveLongUnderarmor_normal_White', label: 'Quarter - White' },
    { value: 'GearArmSleeve_Quarter_sleeveLongUnderarmor_normal_TeamColor', label: 'Quarter - Team' },
    { value: 'GearArmSleeve_Quarter_sleeveLongUnderarmor_normal_SecondaryColor', label: 'Quarter - Secondary' },
    { value: 'GearArmSleeve_Shooter_sleeveLongUnderarmor_normal_Black', label: 'Shooter - Black' },
    { value: 'GearArmSleeve_Shooter_sleeveLongUnderarmor_normal_White', label: 'Shooter - White' },
    { value: 'GearArmSleeve_Shooter_sleeveLongUnderarmor_normal_TeamColor', label: 'Shooter - Team' },
    { value: 'GearArmSleeve_Shooter_sleeveLongUnderarmor_normal_SecondaryColor', label: 'Shooter - Secondary' },
    { value: 'GearArmSleeve_NikeProDriFitSleeve_Black', label: 'Nike Pro - Black' },
    { value: 'GearArmSleeve_NikeProDriFitSleeve_White', label: 'Nike Pro - White' },
    { value: 'GearArmSleeve_NikeProDriFitSleeve_TeamColor', label: 'Nike Pro - Team' },
    { value: 'GearArmSleeve_NikeProDriFitSleeve_SecondaryColor', label: 'Nike Pro - Secondary' },
    { value: 'GearArmSleeve_NikePaddedElbowCompressionSleeve_White', label: 'Nike Padded - White' },
    { value: 'GearArmSleeve_NikePaddedElbowCompressionSleeve_SecondaryColor', label: 'Nike Padded - Secondary' },
    { value: 'GearArmSleeve_McDavidPaddedCompressionSleeve_Black', label: 'McDavid Padded - Black' },
    { value: 'GearArmSleeve_McDavidPaddedCompressionSleeve_White', label: 'McDavid Padded - White' },
    { value: 'GearArmSleeve_McDavidPaddedCompressionSleeve_TeamColor', label: 'McDavid Padded - Team' },
    { value: 'GearArmSleeve_McDavidPaddedCompressionSleeve_SecondaryColor', label: 'McDavid Padded - Secondary' },
    { value: 'GearArmSleeve_CompressionRolledUpShirt_Black', label: 'Rolled Up - Black' },
    { value: 'GearArmSleeve_CompressionRolledUpShirt_White', label: 'Rolled Up - White' },
    { value: 'GearArmSleeve_CompressionRolledUpShirt_TeamColor', label: 'Rolled Up - Team' },
    { value: 'GearArmSleeve_Undershirt_sleeveLongUnderarmor_normal_Black', label: 'Undershirt - Black' },
    { value: 'GearArmSleeve_Undershirt_sleeveLongUnderarmor_normal_White', label: 'Undershirt - White' },
    { value: 'GearArmSleeve_Undershirt_sleeveLongUnderarmor_normal_TeamColor', label: 'Undershirt - Team' },
    { value: 'GearArmSleeve_Undershirt_sleeveLongUnderarmor_normal_Secondary', label: 'Undershirt - Secondary' },
    { value: 'GearArmSleeve_Undershirt_armTape_normal_Black', label: 'Tape - Black' },
    { value: 'GearArmSleeve_Undershirt_armTape_normal_OffWhite', label: 'Tape - Off White' },
    { value: 'GearArmSleeve_Undershirt_armTape_normal_TeamColor', label: 'Tape - Team' },
    { value: 'GearArmSleeve_Quarter_armTape_normal_Black', label: 'Quarter Tape - Black' },
    { value: 'GearArmSleeve_Quarter_armTape_normal_OffWhite', label: 'Quarter Tape - Off White' },
    { value: 'GearArmSleeve_Quarter_armTape_normal_TeamColor', label: 'Quarter Tape - Team' }
  ],
  RightSleeve: [
    { value: 'ArmSleeve_None', label: 'None' },
    { value: 'GearArmSleeve_Baggy_Black', label: 'Baggy - Black' },
    { value: 'GearArmSleeve_Baggy_White', label: 'Baggy - White' },
    { value: 'GearArmSleeve_Baggy_TeamColor', label: 'Baggy - Team' },
    { value: 'GearArmSleeve_Baggy_SecondaryColor', label: 'Baggy - Secondary' },
    { value: 'GearArmSleeve_Full_sleeveLongUnderarmor_normal_Black', label: 'Full - Black' },
    { value: 'GearArmSleeve_Full_sleeveLongUnderarmor_normal_White', label: 'Full - White' },
    { value: 'GearArmSleeve_Full_sleeveLongUnderarmor_normal_TeamColor', label: 'Full - Team' },
    { value: 'GearArmSleeve_Full_sleeveLongUnderarmor_normal_SecondaryColor', label: 'Full - Secondary' },
    { value: 'GearArmSleeve_Half_sleeveLongUnderarmor_normal_Black', label: 'Half - Black' },
    { value: 'GearArmSleeve_Half_sleeveLongUnderarmor_normal_White', label: 'Half - White' },
    { value: 'GearArmSleeve_Half_sleeveLongUnderarmor_normal_TeamColor', label: 'Half - Team' },
    { value: 'GearArmSleeve_Quarter_sleeveLongUnderarmor_normal_Black', label: 'Quarter - Black' },
    { value: 'GearArmSleeve_Quarter_sleeveLongUnderarmor_normal_White', label: 'Quarter - White' },
    { value: 'GearArmSleeve_Quarter_sleeveLongUnderarmor_normal_TeamColor', label: 'Quarter - Team' },
    { value: 'GearArmSleeve_Quarter_sleeveLongUnderarmor_normal_SecondaryColor', label: 'Quarter - Secondary' },
    { value: 'GearArmSleeve_Shooter_sleeveLongUnderarmor_normal_Black', label: 'Shooter - Black' },
    { value: 'GearArmSleeve_Shooter_sleeveLongUnderarmor_normal_White', label: 'Shooter - White' },
    { value: 'GearArmSleeve_Shooter_sleeveLongUnderarmor_normal_TeamColor', label: 'Shooter - Team' },
    { value: 'GearArmSleeve_Shooter_sleeveLongUnderarmor_normal_SecondaryColor', label: 'Shooter - Secondary' },
    { value: 'GearArmSleeve_NikeProDriFitSleeve_Black', label: 'Nike Pro - Black' },
    { value: 'GearArmSleeve_NikeProDriFitSleeve_White', label: 'Nike Pro - White' },
    { value: 'GearArmSleeve_NikeProDriFitSleeve_TeamColor', label: 'Nike Pro - Team' },
    { value: 'GearArmSleeve_NikeProDriFitSleeve_SecondaryColor', label: 'Nike Pro - Secondary' },
    { value: 'GearArmSleeve_NikePaddedElbowCompressionSleeve_Black', label: 'Nike Padded - Black' },
    { value: 'GearArmSleeve_NikePaddedElbowCompressionSleeve_White', label: 'Nike Padded - White' },
    { value: 'GearArmSleeve_McDavidPaddedCompressionSleeve_Black', label: 'McDavid Padded - Black' },
    { value: 'GearArmSleeve_McDavidPaddedCompressionSleeve_White', label: 'McDavid Padded - White' },
    { value: 'GearArmSleeve_McDavidPaddedCompressionSleeve_TeamColor', label: 'McDavid Padded - Team' },
    { value: 'GearArmSleeve_McDavidPaddedCompressionSleeve_SecondaryColor', label: 'McDavid Padded - Secondary' },
    { value: 'GearArmSleeve_CompressionRolledUpShirt_Black', label: 'Rolled Up - Black' },
    { value: 'GearArmSleeve_CompressionRolledUpShirt_White', label: 'Rolled Up - White' },
    { value: 'GearArmSleeve_CompressionRolledUpShirt_TeamColor', label: 'Rolled Up - Team' },
    { value: 'GearArmSleeve_Undershirt_sleeveLongUnderarmor_normal_Black', label: 'Undershirt - Black' },
    { value: 'GearArmSleeve_Undershirt_sleeveLongUnderarmor_normal_White', label: 'Undershirt - White' },
    { value: 'GearArmSleeve_Undershirt_sleeveLongUnderarmor_normal_TeamColor', label: 'Undershirt - Team' },
    { value: 'GearArmSleeve_Undershirt_sleeveLongUnderarmor_normal_Secondary', label: 'Undershirt - Secondary' },
    { value: 'GearArmSleeve_Undershirt_armTape_normal_Black', label: 'Tape - Black' },
    { value: 'GearArmSleeve_Undershirt_armTape_normal_OffWhite', label: 'Tape - Off White' },
    { value: 'GearArmSleeve_Undershirt_armTape_normal_TeamColor', label: 'Tape - Team' },
    { value: 'GearArmSleeve_Quarter_armTape_normal_Black', label: 'Quarter Tape - Black' },
    { value: 'GearArmSleeve_Quarter_armTape_normal_OffWhite', label: 'Quarter Tape - Off White' },
    { value: 'GearArmSleeve_Quarter_armTape_normal_TeamColor', label: 'Quarter Tape - Team' }
  ],
  LeftElbow: [
    { value: 'ElbowGear_None', label: 'None' },
    // Elbow Pads
    { value: 'ElbowGear_elbowpad_Black', label: 'Elbow Pad - Black' },
    { value: 'ElbowGear_elbowpad_White', label: 'Elbow Pad - White' },
    { value: 'ElbowGear_elbowpad_TeamColor', label: 'Elbow Pad - Team' },
    { value: 'ElbowGear_elbowpad_Stripe_Black', label: 'Elbow Pad Stripe - Black' },
    { value: 'ElbowGear_elbowpad_Stripe_White', label: 'Elbow Pad Stripe - White' },
    { value: 'ElbowGear_elbowpadRubber_Black', label: 'Rubber Pad - Black' },
    // Sweatbands
    { value: 'ElbowGear_elbowSweatbandThin_Black', label: 'Thin Band - Black' },
    { value: 'ElbowGear_elbowSweatbandThin_White', label: 'Thin Band - White' },
    { value: 'ElbowGear_elbowSweatbandThin_TeamColor', label: 'Thin Band - Team' },
    { value: 'ElbowGear_elbowSweatbandThin_SecondaryColor', label: 'Thin Band - Secondary' },
    { value: 'ElbowGear_elbowSweatbandMedium_Black', label: 'Medium Band - Black' },
    { value: 'ElbowGear_elbowSweatbandMedium_White', label: 'Medium Band - White' },
    { value: 'ElbowGear_elbowSweatbandMedium_TeamColor', label: 'Medium Band - Team' },
    { value: 'ElbowGear_elbowSweatbandMedium_SecondaryColor', label: 'Medium Band - Secondary' },
    { value: 'ElbowGear_elbowSweatbandFull_Black', label: 'Full Band - Black' },
    { value: 'ElbowGear_elbowSweatbandFull_White', label: 'Full Band - White' },
    { value: 'ElbowGear_elbowSweatbandFull_TeamColor', label: 'Full Band - Team' },
    { value: 'ElbowGear_elbowSweatbandFull_SecondaryColor', label: 'Full Band - Secondary' },
    // Braces
    { value: 'ElbowGear_elbowBrace_TeamColor', label: 'Elbow Brace - Team' },
    { value: 'ElbowGear_armBraceSmall', label: 'Arm Brace Small' },
    { value: 'ElbowGear_bicepShoulderStabilizer', label: 'Shoulder Stabilizer' },
    { value: 'ElbowGear_VintageBeastWrap_White', label: 'Vintage Beast Wrap' }
  ],
  RightElbow: [
    { value: 'ElbowGear_None', label: 'None' },
    // Elbow Pads
    { value: 'ElbowGear_elbowpad_Black', label: 'Elbow Pad - Black' },
    { value: 'ElbowGear_elbowpad_White', label: 'Elbow Pad - White' },
    { value: 'ElbowGear_elbowpad_TeamColor', label: 'Elbow Pad - Team' },
    { value: 'ElbowGear_elbowpad_Stripe_Black', label: 'Elbow Pad Stripe - Black' },
    { value: 'ElbowGear_elbowpad_Stripe_White', label: 'Elbow Pad Stripe - White' },
    { value: 'ElbowGear_elbowpadRubber_Black', label: 'Rubber Pad - Black' },
    // Sweatbands
    { value: 'ElbowGear_elbowSweatbandThin_Black', label: 'Thin Band - Black' },
    { value: 'ElbowGear_elbowSweatbandThin_White', label: 'Thin Band - White' },
    { value: 'ElbowGear_elbowSweatbandThin_TeamColor', label: 'Thin Band - Team' },
    { value: 'ElbowGear_elbowSweatbandThin_SecondaryColor', label: 'Thin Band - Secondary' },
    { value: 'ElbowGear_elbowSweatbandMedium_Black', label: 'Medium Band - Black' },
    { value: 'ElbowGear_elbowSweatbandMedium_White', label: 'Medium Band - White' },
    { value: 'ElbowGear_elbowSweatbandMedium_TeamColor', label: 'Medium Band - Team' },
    { value: 'ElbowGear_elbowSweatbandMedium_SecondaryColor', label: 'Medium Band - Secondary' },
    { value: 'ElbowGear_elbowSweatbandFull_Black', label: 'Full Band - Black' },
    { value: 'ElbowGear_elbowSweatbandFull_White', label: 'Full Band - White' },
    { value: 'ElbowGear_elbowSweatbandFull_TeamColor', label: 'Full Band - Team' },
    { value: 'ElbowGear_elbowSweatbandFull_SecondaryColor', label: 'Full Band - Secondary' },
    // Braces
    { value: 'ElbowGear_elbowBrace_TeamColor', label: 'Elbow Brace - Team' },
    { value: 'ElbowGear_armBraceSmall', label: 'Arm Brace Small' },
    { value: 'ElbowGear_bicepShoulderStabilizer', label: 'Shoulder Stabilizer' },
    { value: 'ElbowGear_VintageBeastWrap_White', label: 'Vintage Beast Wrap' }
  ],
  LeftWrist: [
    { value: 'GearWrist_None', label: 'None' },
    { value: 'GearWrist_wristBandNormal_Black', label: 'Band - Black' },
    { value: 'GearWrist_wristBandNormal_White', label: 'Band - White' },
    { value: 'GearWrist_wristBandNormal_TeamColor', label: 'Band - Team' },
    { value: 'GearWrist_wristBandNormal_SecondaryColor', label: 'Band - Secondary' },
    { value: 'GearWrist_wristBandDouble_Black', label: 'Double Band - Black' },
    { value: 'GearWrist_wristBandCoach_Black', label: 'Coach Band - Black' },
    { value: 'GearWrist_wristBandCoach_White', label: 'Coach Band - White' },
    { value: 'GearWrist_wristBandCoach_TeamColor', label: 'Coach Band - Team' },
    { value: 'GearWrist_armgear_playbookWristbandOpen_white', label: 'Playbook Band - White' },
    { value: 'GearWrist_wristTapedLite_Black', label: 'Tape Lite - Black' },
    { value: 'GearWrist_wristTapedLite_White', label: 'Tape Lite - White' },
    { value: 'GearWrist_wristTapedLite_TeamColor', label: 'Tape Lite - Team' },
    { value: 'GearWrist_wristTapedNormal_Black', label: 'Tape - Black' },
    { value: 'GearWrist_wristTapedNormal_White', label: 'Tape - White' },
    { value: 'GearWrist_wristTapedNormal_TeamColor', label: 'Tape - Team' },
    { value: 'GearWrist_wristTapedNormal_SecondaryColor', label: 'Tape - Secondary' },
    { value: 'GearWrist_wristTapedMax_Black', label: 'Tape Max - Black' },
    { value: 'GearWrist_wristTapedMax_White', label: 'Tape Max - White' },
    { value: 'GearWrist_wristTapedMax_TeamColor', label: 'Tape Max - Team' },
    { value: 'GearWrist_gloveTapedNormal_Black', label: 'Glove Tape - Black' },
    { value: 'GearWrist_gloveTapedNormal_White', label: 'Glove Tape - White' },
    { value: 'GearWrist_gloveTapedLarge_Black', label: 'Glove Tape Large - Black' },
    { value: 'GearWrist_gloveTapedLarge_White', label: 'Glove Tape Large - White' },
    { value: 'GearWrist_gloveWristBrace_Black', label: 'Wrist Brace - Black' },
    { value: 'GearWrist_wristbrace_CompressShort_Black', label: 'Compression Short - Black' }
  ],
  RightWrist: [
    { value: 'GearWrist_None', label: 'None' },
    { value: 'GearWrist_wristBandNormal_Black', label: 'Band - Black' },
    { value: 'GearWrist_wristBandNormal_White', label: 'Band - White' },
    { value: 'GearWrist_wristBandNormal_TeamColor', label: 'Band - Team' },
    { value: 'GearWrist_wristBandNormal_SecondaryColor', label: 'Band - Secondary' },
    { value: 'GearWrist_wristBandDouble_Black', label: 'Double Band - Black' },
    { value: 'GearWrist_wristBandDouble_White', label: 'Double Band - White' },
    { value: 'GearWrist_wristBandCoach_Black', label: 'Coach Band - Black' },
    { value: 'GearWrist_armgear_playbookWristbandOpen_white', label: 'Playbook Band - White' },
    { value: 'GearWrist_wristTapedLite_Black', label: 'Tape Lite - Black' },
    { value: 'GearWrist_wristTapedLite_White', label: 'Tape Lite - White' },
    { value: 'GearWrist_wristTapedLite_TeamColor', label: 'Tape Lite - Team' },
    { value: 'GearWrist_wristTapedNormal_Black', label: 'Tape - Black' },
    { value: 'GearWrist_wristTapedNormal_White', label: 'Tape - White' },
    { value: 'GearWrist_wristTapedNormal_TeamColor', label: 'Tape - Team' },
    { value: 'GearWrist_wristTapedNormal_SecondaryColor', label: 'Tape - Secondary' },
    { value: 'GearWrist_wristTapedMax_Black', label: 'Tape Max - Black' },
    { value: 'GearWrist_wristTapedMax_White', label: 'Tape Max - White' },
    { value: 'GearWrist_wristTapedMax_TeamColor', label: 'Tape Max - Team' },
    { value: 'G_WristTaped_Max_TeamColor', label: 'Tape Max Alt - Team' },
    { value: 'GearWrist_gloveTapedNormal_Black', label: 'Glove Tape - Black' },
    { value: 'GearWrist_gloveTapedNormal_White', label: 'Glove Tape - White' },
    { value: 'GearWrist_gloveTapedLarge_Black', label: 'Glove Tape Large - Black' },
    { value: 'GearWrist_gloveTapedLarge_White', label: 'Glove Tape Large - White' },
    { value: 'GearWrist_gloveWristBrace_Black', label: 'Wrist Brace - Black' },
    { value: 'GearWrist_wristbrace_CompressShort_Black', label: 'Compression Short - Black' }
  ],

  // Hands - Gloves (116 options each)
  LeftGlove: [
    { value: 'GearHand_None', label: 'None' },
    // Taped Hands
    { value: 'GearHand_tapedHandFinger_Black', label: 'Taped Fingers - Black' },
    { value: 'GearHand_tapedHandFinger_White', label: 'Taped Fingers - White' },
    { value: 'GearHand_tapedHandFinger_TeamColor', label: 'Taped Fingers - Team' },
    { value: 'GearHand_tapedHandCombo_White', label: 'Taped Combo' },
    { value: 'GearHand_tapedHandMax_White', label: 'Taped Max' },
    { value: 'GearHand_tapedHandNormal_White', label: 'Taped Normal' },
    // Nike Vapor Jet
    { value: 'GearHand_glove_NikeVaporJet8_Black', label: 'Vapor Jet 8 - Black' },
    { value: 'GearHand_glove_NikeVaporJet8_White', label: 'Vapor Jet 8 - White' },
    { value: 'GearHand_glove_NikeVaporJet8_TeamColor', label: 'Vapor Jet 8 - Team' },
    { value: 'GearHand_glove_NikeVaporJet8_SecondaryColor', label: 'Vapor Jet 8 - Secondary' },
    { value: 'GearHand_glove_NikeVaporJet7_Black', label: 'Vapor Jet 7 - Black' },
    { value: 'GearHand_glove_NikeVaporJet7_White', label: 'Vapor Jet 7 - White' },
    { value: 'GearHand_glove_NikeVaporJet7_TeamColor', label: 'Vapor Jet 7 - Team' },
    { value: 'GearHand_glove_NikeVaporJet7_SecondaryColor', label: 'Vapor Jet 7 - Secondary' },
    { value: 'GearHand_glove_NikeVaporJet6_Black', label: 'Vapor Jet 6 - Black' },
    { value: 'GearHand_glove_NikeVaporJet6_White', label: 'Vapor Jet 6 - White' },
    { value: 'GearHand_glove_NikeVaporJet6_TeamColor', label: 'Vapor Jet 6 - Team' },
    { value: 'GearHand_glove_NikeVaporJet6_SecondaryColor', label: 'Vapor Jet 6 - Secondary' },
    { value: 'GearHand_glove_NikeVaporJet5_Black', label: 'Vapor Jet 5 - Black' },
    { value: 'GearHand_glove_NikeVaporJet5_White', label: 'Vapor Jet 5 - White' },
    { value: 'GearHand_glove_NikeVaporJet5_TeamColor', label: 'Vapor Jet 5 - Team' },
    { value: 'GearHand_glove_NikeVaporJet5_SecondaryColor', label: 'Vapor Jet 5 - Secondary' },
    { value: 'GearHand_glove_NikeVaporJet4_Black', label: 'Vapor Jet 4 - Black' },
    { value: 'GearHand_glove_NikeVaporJet4_White', label: 'Vapor Jet 4 - White' },
    { value: 'GearHand_glove_NikeVaporJet4_TeamColor', label: 'Vapor Jet 4 - Team' },
    { value: 'GearHand_glove_NikeVaporJet_White', label: 'Vapor Jet - White' },
    { value: 'GearHand_glove_NikeVaporJet_SecondaryColor', label: 'Vapor Jet - Secondary' },
    // Nike Vapor Knit
    { value: 'GearHand_glove_NikeVaporKnit4_Black', label: 'Vapor Knit 4 - Black' },
    { value: 'GearHand_glove_NikeVaporKnit4_White', label: 'Vapor Knit 4 - White' },
    { value: 'GearHand_glove_NikeVaporKnit4_TeamColor', label: 'Vapor Knit 4 - Team' },
    { value: 'GearHand_glove_NikeVaporKnit4_SecondaryColor', label: 'Vapor Knit 4 - Secondary' },
    { value: 'GearHand_glove_NikeVaporKnit3_Black', label: 'Vapor Knit 3 - Black' },
    { value: 'GearHand_glove_NikeVaporKnit3_White', label: 'Vapor Knit 3 - White' },
    { value: 'GearHand_glove_NikeVaporKnit3_TeamColor', label: 'Vapor Knit 3 - Team' },
    { value: 'GearHand_glove_NikeVaporKnit3_SecondaryColor', label: 'Vapor Knit 3 - Secondary' },
    { value: 'GearHand_glove_NikeVaporKnit2_Black', label: 'Vapor Knit 2 - Black' },
    { value: 'GearHand_glove_NikeVaporKnit2_White', label: 'Vapor Knit 2 - White' },
    { value: 'GearHand_glove_NikeVaporKnit2_TeamColor', label: 'Vapor Knit 2 - Team' },
    { value: 'GearHand_glove_NikeVaporKnit_TeamColor', label: 'Vapor Knit - Team' },
    // Nike Superbad
    { value: 'GearHand_glove_NikeSuperbad7_Black', label: 'Superbad 7 - Black' },
    { value: 'GearHand_glove_NikeSuperbad7_White', label: 'Superbad 7 - White' },
    { value: 'GearHand_glove_NikeSuperbad7_TeamColor', label: 'Superbad 7 - Team' },
    { value: 'GearHand_glove_NikeSuperbad7_SecondaryColor', label: 'Superbad 7 - Secondary' },
    { value: 'GearHand_glove_NikeSuperbad6_Black', label: 'Superbad 6 - Black' },
    { value: 'GearHand_glove_NikeSuperbad6_White', label: 'Superbad 6 - White' },
    { value: 'GearHand_glove_NikeSuperbad6_TeamColor', label: 'Superbad 6 - Team' },
    { value: 'GearHand_glove_NikeSuperbad6_SecondaryColor', label: 'Superbad 6 - Secondary' },
    { value: 'GearHand_glove_NikeSuperBad5_Black', label: 'Superbad 5 - Black' },
    { value: 'GearHand_glove_NikeSuperBad5_White', label: 'Superbad 5 - White' },
    { value: 'GearHand_glove_NikeSuperBad5_TeamColor', label: 'Superbad 5 - Team' },
    { value: 'GearHand_glove_NikeSuperBad5_SecondaryColor', label: 'Superbad 5 - Secondary' },
    { value: 'GearHand_glove_NikeSuperbad5_2019_Black', label: 'Superbad 5 2019 - Black' },
    { value: 'GearHand_glove_NikeSuperbad5_2019_White', label: 'Superbad 5 2019 - White' },
    { value: 'GearHand_glove_NikeSuperbad5_2019_TeamColor', label: 'Superbad 5 2019 - Team' },
    { value: 'GearHand_glove_NikeSuperbad5_2019_SecondaryColor', label: 'Superbad 5 2019 - Secondary' },
    { value: 'GearHand_glove_NikeSuperBad3_Black', label: 'Superbad 3 - Black' },
    { value: 'GearHand_glove_NikeSuperBad3_White', label: 'Superbad 3 - White' },
    { value: 'GearHand_glove_NikeSuperBad3_TeamColor', label: 'Superbad 3 - Team' },
    // Nike D-Tack & HyperBeast
    { value: 'GearHand_glove_NikeDTack_Black', label: 'D-Tack - Black' },
    { value: 'GearHand_glove_NikeDTack_White', label: 'D-Tack - White' },
    { value: 'GearHand_glove_NikeDTack7FG_Black', label: 'D-Tack 7 - Black' },
    { value: 'GearHand_glove_NikeDTack7FG_White', label: 'D-Tack 7 - White' },
    { value: 'GearHand_glove_NikeHyperBeast_Black', label: 'HyperBeast - Black' },
    { value: 'GearHand_glove_NikeHyperBeast_White', label: 'HyperBeast - White' },
    // Jordan
    { value: 'GearHand_glove_JordanVaporJet7_Black', label: 'Jordan Vapor Jet 7 - Black' },
    { value: 'GearHand_glove_JordanVaporJet7_White', label: 'Jordan Vapor Jet 7 - White' },
    { value: 'GearHand_glove_JordanVaporJet7_TeamColor', label: 'Jordan Vapor Jet 7 - Team' },
    { value: 'GearHand_glove_JordanSuperbad6_Black', label: 'Jordan Superbad 6 - Black' },
    { value: 'GearHand_glove_JordanSuperbad6_White', label: 'Jordan Superbad 6 - White' },
    { value: 'GearHand_glove_JordanSuperbad6_TeamColor', label: 'Jordan Superbad 6 - Team' },
    { value: 'GearHand_glove_JordanFlyLock_Black', label: 'Jordan Fly Lock - Black' },
    { value: 'GearHand_glove_JordanFlyLock_White', label: 'Jordan Fly Lock - White' },
    { value: 'GearHand_glove_JordanFlyLock_TeamColor', label: 'Jordan Fly Lock - Team' },
    { value: 'GearHand_glove_JordanFlyLock_SecondaryColor', label: 'Jordan Fly Lock - Secondary' },
    { value: 'GearHand_glove_JordanFlyLock2_White', label: 'Jordan Fly Lock 2 - White' },
    { value: 'GearHand_glove_JordanFlylock2_TeamColor', label: 'Jordan Fly Lock 2 - Team' },
    // Adidas
    { value: 'GearHand_glove_AdidasFreak_Black', label: 'Adidas Freak - Black' },
    { value: 'GearHand_glove_AdidasFreak_White', label: 'Adidas Freak - White' },
    { value: 'GearHand_glove_AdidasFreak_TeamColor', label: 'Adidas Freak - Team' },
    { value: 'GearHand_glove_AdidasFreak_SecondaryColor', label: 'Adidas Freak - Secondary' },
    { value: 'GearHand_glove_AdidasImpact2_Black', label: 'Adidas Impact 2 - Black' },
    { value: 'GearHand_glove_AdidasImpact2_White', label: 'Adidas Impact 2 - White' },
    { value: 'GearHand_glove_AdidasImpact2_TeamColor', label: 'Adidas Impact 2 - Team' },
    { value: 'GearHand_glove_Adizero13_Black', label: 'Adizero 13 - Black' },
    { value: 'GearHand_glove_Adizero13_White', label: 'Adizero 13 - White' },
    { value: 'GearHand_glove_Adizero13_TeamColor', label: 'Adizero 13 - Team' },
    { value: 'GearHand_glove_Adizero13_SecondaryColor', label: 'Adizero 13 - Secondary' },
    { value: 'GearHand_glove_Adizero13MistmatchDSG_Black', label: 'Adizero 13 DSG - Black' },
    { value: 'GearHand_glove_Adizero13MistmatchDSG_White', label: 'Adizero 13 DSG - White' },
    { value: 'GearHand_glove_Adizero13MistmatchDSG_TeamColor', label: 'Adizero 13 DSG - Team' },
    { value: 'GearHand_glove_Adizero15Electric_Black', label: 'Adizero 15 Electric - Black' },
    { value: 'GearHand_glove_Adizero15Electric_White', label: 'Adizero 15 Electric - White' },
    { value: 'GearHand_glove_Adizero15Electric_TeamColor', label: 'Adizero 15 Electric - Team' },
    { value: 'GearHand_glove_Adizero15Electric_SecondaryColor', label: 'Adizero 15 Electric - Secondary' },
    { value: 'GearHand_glove_Adizero15ElectricExoticDSG_White', label: 'Adizero 15 Exotic - White' },
    { value: 'GearHand_glove_Adizero15ElectricExoticDSG_TeamColor', label: 'Adizero 15 Exotic - Team' },
    { value: 'GearHand_glove_Adizero15ElectricExoticDSG_SecondaryColor', label: 'Adizero 15 Exotic - Secondary' },
    // Under Armour
    { value: 'GearHand_glove_UnderArmourF9_Black', label: 'UA F9 - Black' },
    { value: 'GearHand_glove_UnderArmourF9_White', label: 'UA F9 - White' },
    { value: 'GearHand_glove_UnderArmourF9_TeamColor', label: 'UA F9 - Team' },
    { value: 'GearHand_glove_UnderArmourF9_SecondaryColor', label: 'UA F9 - Secondary' },
    { value: 'GearHand_glove_UnderArmourF6_TeamColor', label: 'UA F6 - Team' },
    { value: 'GearHand_glove_UnderArmourF6_SecondaryColor', label: 'UA F6 - Secondary' },
    { value: 'GearHand_glove_UnderArmourCombat_Black', label: 'UA Combat - Black' },
    { value: 'GearHand_glove_UnderArmourCombat_White', label: 'UA Combat - White' },
    { value: 'GearHand_glove_UnderArmourCombat_TeamColor', label: 'UA Combat - Team' },
    { value: 'GearHand_glove_UnderArmourSpotlight2019_White', label: 'UA Spotlight 2019 - White' },
    { value: 'GearHand_glove_UnderArmourSpotlight2019_TeamColor', label: 'UA Spotlight 2019 - Team' },
    { value: 'GearHand_glove_UnderArmourSpotlight2019_SecondaryColor', label: 'UA Spotlight 2019 - Secondary' },
    { value: 'GearHand_glove_UnderArmourInfrared_TeamColor', label: 'UA Infrared - Team' },
    { value: 'GearHand_glove_UnderArmourInfrared_SecondaryColor', label: 'UA Infrared - Secondary' },
    // Cutters
    { value: 'GearHand_glove_GenericCutter_Black', label: 'Cutter - Black' },
    { value: 'GearHand_glove_GenericCutter_White', label: 'Cutter - White' },
    { value: 'GearHand_glove_GenericCutter_TeamColor', label: 'Cutter - Team' },
    { value: 'GearHand_glove_GenericCutter_SecondaryColor', label: 'Cutter - Secondary' }
  ],
  RightGlove: [
    { value: 'GearHand_None', label: 'None' },
    // Taped Hands
    { value: 'GearHand_tapedHandFinger_Black', label: 'Taped Fingers - Black' },
    { value: 'GearHand_tapedHandFinger_White', label: 'Taped Fingers - White' },
    { value: 'GearHand_tapedHandFinger_TeamColor', label: 'Taped Fingers - Team' },
    { value: 'GearHand_tapedHandCombo_White', label: 'Taped Combo' },
    { value: 'GearHand_tapedHandMax_White', label: 'Taped Max' },
    { value: 'GearHand_tapedHandNormal_White', label: 'Taped Normal' },
    // Nike Vapor Jet
    { value: 'GearHand_glove_NikeVaporJet8_Black', label: 'Vapor Jet 8 - Black' },
    { value: 'GearHand_glove_NikeVaporJet8_White', label: 'Vapor Jet 8 - White' },
    { value: 'GearHand_glove_NikeVaporJet8_TeamColor', label: 'Vapor Jet 8 - Team' },
    { value: 'GearHand_glove_NikeVaporJet8_SecondaryColor', label: 'Vapor Jet 8 - Secondary' },
    { value: 'GearHand_glove_NikeVaporJet7_Black', label: 'Vapor Jet 7 - Black' },
    { value: 'GearHand_glove_NikeVaporJet7_White', label: 'Vapor Jet 7 - White' },
    { value: 'GearHand_glove_NikeVaporJet7_TeamColor', label: 'Vapor Jet 7 - Team' },
    { value: 'GearHand_glove_NikeVaporJet7_SecondaryColor', label: 'Vapor Jet 7 - Secondary' },
    { value: 'GearHand_glove_NikeVaporJet6_Black', label: 'Vapor Jet 6 - Black' },
    { value: 'GearHand_glove_NikeVaporJet6_White', label: 'Vapor Jet 6 - White' },
    { value: 'GearHand_glove_NikeVaporJet6_TeamColor', label: 'Vapor Jet 6 - Team' },
    { value: 'GearHand_glove_NikeVaporJet6_SecondaryColor', label: 'Vapor Jet 6 - Secondary' },
    { value: 'GearHand_glove_NikeVaporJet5_Black', label: 'Vapor Jet 5 - Black' },
    { value: 'GearHand_glove_NikeVaporJet5_White', label: 'Vapor Jet 5 - White' },
    { value: 'GearHand_glove_NikeVaporJet5_TeamColor', label: 'Vapor Jet 5 - Team' },
    { value: 'GearHand_glove_NikeVaporJet5_SecondaryColor', label: 'Vapor Jet 5 - Secondary' },
    { value: 'GearHand_glove_NikeVaporJet4_Black', label: 'Vapor Jet 4 - Black' },
    { value: 'GearHand_glove_NikeVaporJet4_White', label: 'Vapor Jet 4 - White' },
    { value: 'GearHand_glove_NikeVaporJet4_TeamColor', label: 'Vapor Jet 4 - Team' },
    { value: 'GearHand_glove_NikeVaporJet_White', label: 'Vapor Jet - White' },
    { value: 'GearHand_glove_NikeVaporJet_SecondaryColor', label: 'Vapor Jet - Secondary' },
    // Nike Vapor Knit
    { value: 'GearHand_glove_NikeVaporKnit4_Black', label: 'Vapor Knit 4 - Black' },
    { value: 'GearHand_glove_NikeVaporKnit4_White', label: 'Vapor Knit 4 - White' },
    { value: 'GearHand_glove_NikeVaporKnit4_TeamColor', label: 'Vapor Knit 4 - Team' },
    { value: 'GearHand_glove_NikeVaporKnit4_SecondaryColor', label: 'Vapor Knit 4 - Secondary' },
    { value: 'GearHand_glove_NikeVaporKnit3_Black', label: 'Vapor Knit 3 - Black' },
    { value: 'GearHand_glove_NikeVaporKnit3_White', label: 'Vapor Knit 3 - White' },
    { value: 'GearHand_glove_NikeVaporKnit3_TeamColor', label: 'Vapor Knit 3 - Team' },
    { value: 'GearHand_glove_NikeVaporKnit3_SecondaryColor', label: 'Vapor Knit 3 - Secondary' },
    { value: 'GearHand_glove_NikeVaporKnit2_Black', label: 'Vapor Knit 2 - Black' },
    { value: 'GearHand_glove_NikeVaporKnit2_White', label: 'Vapor Knit 2 - White' },
    { value: 'GearHand_glove_NikeVaporKnit2_TeamColor', label: 'Vapor Knit 2 - Team' },
    { value: 'GearHand_glove_NikeVaporKnit_TeamColor', label: 'Vapor Knit - Team' },
    // Nike Superbad
    { value: 'GearHand_glove_NikeSuperbad7_Black', label: 'Superbad 7 - Black' },
    { value: 'GearHand_glove_NikeSuperbad7_White', label: 'Superbad 7 - White' },
    { value: 'GearHand_glove_NikeSuperbad7_TeamColor', label: 'Superbad 7 - Team' },
    { value: 'GearHand_glove_NikeSuperbad7_SecondaryColor', label: 'Superbad 7 - Secondary' },
    { value: 'GearHand_glove_NikeSuperbad6_Black', label: 'Superbad 6 - Black' },
    { value: 'GearHand_glove_NikeSuperbad6_White', label: 'Superbad 6 - White' },
    { value: 'GearHand_glove_NikeSuperbad6_TeamColor', label: 'Superbad 6 - Team' },
    { value: 'GearHand_glove_NikeSuperbad6_SecondaryColor', label: 'Superbad 6 - Secondary' },
    { value: 'GearHand_glove_NikeSuperBad5_Black', label: 'Superbad 5 - Black' },
    { value: 'GearHand_glove_NikeSuperBad5_White', label: 'Superbad 5 - White' },
    { value: 'GearHand_glove_NikeSuperBad5_TeamColor', label: 'Superbad 5 - Team' },
    { value: 'GearHand_glove_NikeSuperBad5_SecondaryColor', label: 'Superbad 5 - Secondary' },
    { value: 'GearHand_glove_NikeSuperbad5_2019_Black', label: 'Superbad 5 2019 - Black' },
    { value: 'GearHand_glove_NikeSuperbad5_2019_White', label: 'Superbad 5 2019 - White' },
    { value: 'GearHand_glove_NikeSuperbad5_2019_TeamColor', label: 'Superbad 5 2019 - Team' },
    { value: 'GearHand_glove_NikeSuperbad5_2019_SecondaryColor', label: 'Superbad 5 2019 - Secondary' },
    { value: 'GearHand_glove_NikeSuperBad3_Black', label: 'Superbad 3 - Black' },
    { value: 'GearHand_glove_NikeSuperBad3_White', label: 'Superbad 3 - White' },
    { value: 'GearHand_glove_NikeSuperBad3_TeamColor', label: 'Superbad 3 - Team' },
    // Nike D-Tack & HyperBeast
    { value: 'GearHand_glove_NikeDTack_Black', label: 'D-Tack - Black' },
    { value: 'GearHand_glove_NikeDTack_White', label: 'D-Tack - White' },
    { value: 'GearHand_glove_NikeDTack7FG_Black', label: 'D-Tack 7 - Black' },
    { value: 'GearHand_glove_NikeDTack7FG_White', label: 'D-Tack 7 - White' },
    { value: 'GearHand_glove_NikeHyperBeast_Black', label: 'HyperBeast - Black' },
    { value: 'GearHand_glove_NikeHyperBeast_White', label: 'HyperBeast - White' },
    // Jordan
    { value: 'GearHand_glove_JordanVaporJet7_Black', label: 'Jordan Vapor Jet 7 - Black' },
    { value: 'GearHand_glove_JordanVaporJet7_White', label: 'Jordan Vapor Jet 7 - White' },
    { value: 'GearHand_glove_JordanVaporJet7_TeamColor', label: 'Jordan Vapor Jet 7 - Team' },
    { value: 'GearHand_glove_JordanSuperbad6_Black', label: 'Jordan Superbad 6 - Black' },
    { value: 'GearHand_glove_JordanSuperbad6_White', label: 'Jordan Superbad 6 - White' },
    { value: 'GearHand_glove_JordanSuperbad6_TeamColor', label: 'Jordan Superbad 6 - Team' },
    { value: 'GearHand_glove_JordanFlyLock_Black', label: 'Jordan Fly Lock - Black' },
    { value: 'GearHand_glove_JordanFlyLock_White', label: 'Jordan Fly Lock - White' },
    { value: 'GearHand_glove_JordanFlyLock_TeamColor', label: 'Jordan Fly Lock - Team' },
    { value: 'GearHand_glove_JordanFlyLock_SecondaryColor', label: 'Jordan Fly Lock - Secondary' },
    { value: 'GearHand_glove_JordanFlyLock2_White', label: 'Jordan Fly Lock 2 - White' },
    { value: 'GearHand_glove_JordanFlylock2_TeamColor', label: 'Jordan Fly Lock 2 - Team' },
    // Adidas
    { value: 'GearHand_glove_AdidasFreak_Black', label: 'Adidas Freak - Black' },
    { value: 'GearHand_glove_AdidasFreak_White', label: 'Adidas Freak - White' },
    { value: 'GearHand_glove_AdidasFreak_TeamColor', label: 'Adidas Freak - Team' },
    { value: 'GearHand_glove_AdidasFreak_SecondaryColor', label: 'Adidas Freak - Secondary' },
    { value: 'GearHand_glove_AdidasImpact2_Black', label: 'Adidas Impact 2 - Black' },
    { value: 'GearHand_glove_AdidasImpact2_White', label: 'Adidas Impact 2 - White' },
    { value: 'GearHand_glove_AdidasImpact2_TeamColor', label: 'Adidas Impact 2 - Team' },
    { value: 'GearHand_glove_Adizero13_Black', label: 'Adizero 13 - Black' },
    { value: 'GearHand_glove_Adizero13_White', label: 'Adizero 13 - White' },
    { value: 'GearHand_glove_Adizero13_TeamColor', label: 'Adizero 13 - Team' },
    { value: 'GearHand_glove_Adizero13_SecondaryColor', label: 'Adizero 13 - Secondary' },
    { value: 'GearHand_glove_Adizero13MistmatchDSG_Black', label: 'Adizero 13 DSG - Black' },
    { value: 'GearHand_glove_Adizero13MistmatchDSG_White', label: 'Adizero 13 DSG - White' },
    { value: 'GearHand_glove_Adizero13MistmatchDSG_TeamColor', label: 'Adizero 13 DSG - Team' },
    { value: 'GearHand_glove_Adizero15Electric_Black', label: 'Adizero 15 Electric - Black' },
    { value: 'GearHand_glove_Adizero15Electric_White', label: 'Adizero 15 Electric - White' },
    { value: 'GearHand_glove_Adizero15Electric_TeamColor', label: 'Adizero 15 Electric - Team' },
    { value: 'GearHand_glove_Adizero15Electric_SecondaryColor', label: 'Adizero 15 Electric - Secondary' },
    { value: 'GearHand_glove_Adizero15ElectricExoticDSG_White', label: 'Adizero 15 Exotic - White' },
    { value: 'GearHand_glove_Adizero15ElectricExoticDSG_TeamColor', label: 'Adizero 15 Exotic - Team' },
    { value: 'GearHand_glove_Adizero15ElectricExoticDSG_SecondaryColor', label: 'Adizero 15 Exotic - Secondary' },
    // Under Armour
    { value: 'GearHand_glove_UnderArmourF9_Black', label: 'UA F9 - Black' },
    { value: 'GearHand_glove_UnderArmourF9_White', label: 'UA F9 - White' },
    { value: 'GearHand_glove_UnderArmourF9_TeamColor', label: 'UA F9 - Team' },
    { value: 'GearHand_glove_UnderArmourF9_SecondaryColor', label: 'UA F9 - Secondary' },
    { value: 'GearHand_glove_UnderArmourF6_TeamColor', label: 'UA F6 - Team' },
    { value: 'GearHand_glove_UnderArmourF6_SecondaryColor', label: 'UA F6 - Secondary' },
    { value: 'GearHand_glove_UnderArmourCombat_Black', label: 'UA Combat - Black' },
    { value: 'GearHand_glove_UnderArmourCombat_White', label: 'UA Combat - White' },
    { value: 'GearHand_glove_UnderArmourCombat_TeamColor', label: 'UA Combat - Team' },
    { value: 'GearHand_glove_UnderArmourSpotlight2019_White', label: 'UA Spotlight 2019 - White' },
    { value: 'GearHand_glove_UnderArmourSpotlight2019_TeamColor', label: 'UA Spotlight 2019 - Team' },
    { value: 'GearHand_glove_UnderArmourSpotlight2019_SecondaryColor', label: 'UA Spotlight 2019 - Secondary' },
    { value: 'GearHand_glove_UnderArmourInfrared_TeamColor', label: 'UA Infrared - Team' },
    { value: 'GearHand_glove_UnderArmourInfrared_SecondaryColor', label: 'UA Infrared - Secondary' },
    // Cutters
    { value: 'GearHand_glove_GenericCutter_Black', label: 'Cutter - Black' },
    { value: 'GearHand_glove_GenericCutter_White', label: 'Cutter - White' },
    { value: 'GearHand_glove_GenericCutter_TeamColor', label: 'Cutter - Team' },
    { value: 'GearHand_glove_GenericCutter_SecondaryColor', label: 'Cutter - Secondary' }
  ],

  // Body/Torso
  BackPlate: [
    { value: 'Backplate_None', label: 'None' },
    { value: 'Backplate_Standard', label: 'Standard' }
  ],
  ShoulderPads: [
    { value: 'Small_Pads', label: 'Small' },
    { value: 'Medium_Pads', label: 'Medium' },
    { value: 'Large_Pads', label: 'Large' }
  ],
  Towel: [
    { value: 'Towel_None', label: 'None' },
    { value: 'Towel_North', label: 'Front Center' },
    { value: 'Towel_South', label: 'Back Center' },
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
    { value: 'G_CompressionT_Crew_ShortSleeve_Basic_BLA', label: 'Compression - Black' },
    { value: 'G_CompressionT_Crew_ShortSleeve_Basic_WHI', label: 'Compression - White' },
    { value: 'G_CompressionT_Crew_ShortSleeve_Basic_PRI', label: 'Compression - Team' },
    { value: 'G_CompressionT_Crew_ShortSleeve_Basic_SEC', label: 'Compression - Secondary' }
  ],
  JerseyStyle: [
    { value: 'Gear_JerseyStyle_SleeveStandard', label: 'Standard' },
    { value: 'Gear_JerseyStyle_SleeveTight', label: 'Tight' },
    { value: 'Gear_JerseyStyle_SleeveLong', label: 'Long' }
  ],
  Handwarmer: [
    { value: 'Handwarmer_None', label: 'None' },
    { value: 'Handwarmer_Standard', label: 'Standard' }
  ],
  HandwarmerStyle: [
    { value: 'HandwarmerStyle_None', label: 'None' },
    { value: 'HandwarmerStyle_Front', label: 'Front' },
    { value: 'HandwarmerStyle_Back', label: 'Back' }
  ],

  // Legs/Feet
  LeftSpats: [
    { value: 'GearSpats_none', label: 'None' },
    { value: 'GearSpats_spatThin_Black', label: 'Black' },
    { value: 'GearSpats_spatThin_White', label: 'White' },
    { value: 'GearSpats_spatThin_TeamColor', label: 'Team Color' },
    { value: 'GearSpats_spatThin_SecondaryColor', label: 'Secondary Color' }
  ],
  RightSpats: [
    { value: 'GearSpats_none', label: 'None' },
    { value: 'GearSpats_spatThin_Black', label: 'Black' },
    { value: 'GearSpats_spatThin_White', label: 'White' },
    { value: 'GearSpats_spatThin_TeamColor', label: 'Team Color' },
    { value: 'GearSpats_spatThin_SecondaryColor', label: 'Secondary Color' }
  ],
  LeftShoe: [
    // Vintage/Retro
    { value: 'GearFootwear_shoeLowVintage_nike', label: 'Nike Vintage Low' },
    // Nike Low
    { value: 'GearFootwear_shoe_Low_NikeAlphaMenaceElite', label: 'Alpha Menace Elite Low' },
    { value: 'GearFootwear_shoe_Low_NikeVaporCarbonEliteTD', label: 'Vapor Carbon Elite TD Low' },
    { value: 'GearFootwear_shoe_Low_NikeVaporUntouchable2', label: 'Vapor Untouchable 2 Low' },
    { value: 'GearFootwear_shoe_low_NikeVaporEdge', label: 'Vapor Edge Low' },
    { value: 'GearFootwear_shoe_low_NikeVaporEdgePro3602', label: 'Vapor Edge Pro 360 Low' },
    { value: 'GearFootwear_shoe_low_NikeVaporEdgeSpeed3062', label: 'Vapor Edge Speed 360 Low' },
    { value: 'GearFootwear_shoe_low_NikeVaporSpeed3', label: 'Vapor Speed 3 Low' },
    { value: 'GearFootwear_shoe_low_NikeVaporUntouchablePro', label: 'Vapor Untouchable Pro Low' },
    { value: 'GearFootwear_shoe_low_NikeVaporUntouchablePro3', label: 'Vapor Untouchable Pro 3 Low' },
    { value: 'GearFootwear_shoe_low_NikeAlphaMenaceElite3', label: 'Alpha Menace Elite 3 Low' },
    { value: 'GearFootwear_shoe_low_NikeAlphaMenacePro4', label: 'Alpha Menace Pro 4 Low' },
    { value: 'GearFootwear_shoe_low_NikeEquinox', label: 'Nike Equinox Low' },
    // Nike Mid
    { value: 'GearFootwear_shoe_Mid_NikeAlphaPro34TD', label: 'Alpha Pro 3/4 TD Mid' },
    { value: 'GearFootwear_shoe_Mid_NikeCodeEliteProShark', label: 'Code Elite Pro Shark Mid' },
    { value: 'GearFootwear_shoe_Mid_NikeLunarBeast', label: 'Lunar Beast Mid' },
    { value: 'GearFootwear_shoe_Mid_NikeVaporEdge360Untouchable', label: 'Vapor Edge 360 Mid' },
    { value: 'GearFootwear_shoe_mid_NikeAlphaMenacePro', label: 'Alpha Menace Pro Mid' },
    { value: 'GearFootwear_shoe_mid_NikeAlphaMenacePro2', label: 'Alpha Menace Pro 2 Mid' },
    { value: 'GearFootwear_shoe_mid_NikeAlphaMenacePro3WDP', label: 'Alpha Menace Pro 3 Mid' },
    { value: 'GearFootwear_shoe_mid_NikeAlphaMenaceStrong', label: 'Alpha Menace Strong Mid' },
    { value: 'GearFootwear_shoe_mid_NikeDiamondTURF', label: 'Diamond TURF Mid' },
    { value: 'GearFootwear_shoe_mid_NikeFieldGeneral', label: 'Field General Mid' },
    { value: 'GearFootwear_shoe_mid_NikeForceSavagePro2', label: 'Force Savage Pro 2 Mid' },
    { value: 'GearFootwear_shoe_mid_NikeVaporEdgeDunk', label: 'Vapor Edge Dunk Mid' },
    // Nike High
    { value: 'GearFootwear_shoe_High_NikeForceSavageEliteTDW', label: 'Force Savage Elite TD High' },
    { value: 'GearFootwear_shoe_high_NikeAlphaMenaceElite2', label: 'Alpha Menace Elite 2 High' },
    { value: 'GearFootwear_shoe_high_NikeForceSavageElite2', label: 'Force Savage Elite 2 High' },
    { value: 'GearFootwear_shoe_high_NikeVaporUntouchablePro3', label: 'Vapor Untouchable Pro 3 High' },
    // Jordan Low
    { value: 'GearFootwear_shoe_low_AirJordan1VaporEdge', label: 'Jordan 1 Vapor Edge Low' },
    { value: 'GearFootwear_shoe_low_AirJordanRetro1', label: 'Jordan Retro 1 Low' },
    { value: 'GearFootwear_shoe_low_AirJordanX', label: 'Jordan X Low' },
    { value: 'GearFootwear_shoe_low_AirJordanXI', label: 'Jordan XI Low' },
    { value: 'GearFootwear_shoe_low_Jordan5_99Club', label: 'Jordan 5 99 Club Low' },
    { value: 'GearFootwear_shoe_low_Jordan7', label: 'Jordan 7 Low' },
    // Jordan Mid
    { value: 'GearFootwear_shoe_mid_AirJordan3Cement', label: 'Jordan 3 Cement Mid' },
    { value: 'GearFootwear_shoe_mid_AirJordanRetro1', label: 'Jordan Retro 1 Mid' },
    { value: 'GearFootwear_shoe_mid_AirJordanRetroCement', label: 'Jordan Retro Cement Mid' },
    { value: 'GearFootwear_shoe_mid_AirJordanX', label: 'Jordan X Mid' },
    { value: 'GearFootwear_shoe_mid_Jordan11TD', label: 'Jordan 11 TD Mid' },
    { value: 'GearFootwear_shoe_mid_Jordan7', label: 'Jordan 7 Mid' },
    // Adidas Low
    { value: 'GearFootwear_shoe_low_AdidasAdizero_LTA58', label: 'Adizero LT Low' },
    { value: 'GearFootwear_shoe_low_AdidasFreak22', label: 'Freak 22 Low' },
    { value: 'GearFootwear_shoe_low_AdidasUltraboostMono', label: 'Ultraboost Mono Low' },
    { value: 'GearFootwear_shoe_low_Adidas_AdizeroElectric', label: 'Adizero Electric Low' },
    { value: 'GearFootwear_shoe_low_Adidas_AdizeroElectric1', label: 'Adizero Electric 1 Low' },
    { value: 'GearFootwear_shoe_low_Adidas_AdizeroElectricExoticSpeed', label: 'Adizero Electric Exotic Low' },
    { value: 'GearFootwear_shoe_low_Adidas_AdizeroElectricPlus', label: 'Adizero Electric Plus Low' },
    { value: 'GearFootwear_shoe_low_AdizeroElectric2', label: 'Adizero Electric 2 Low' },
    // Adidas Mid
    { value: 'GearFootwear_shoe_mid_AdidasAdizeroPrimeKnit', label: 'Adizero Primeknit Mid' },
    { value: 'GearFootwear_shoe_mid_AdidasFreak', label: 'Freak Mid' },
    { value: 'GearFootwear_shoe_mid_AdidasFreakUltraCleat', label: 'Freak Ultra Mid' },
    { value: 'GearFootwear_shoe_mid_AdidasNasty', label: 'Nasty Mid' },
    { value: 'GearFootwear_shoe_mid_Adidas_AdizeroImpact2', label: 'Adizero Impact 2 Mid' },
    { value: 'GearFootwear_shoe_mid_Adidas_AdizeroImpactSnake', label: 'Adizero Impact Snake Mid' },
    { value: 'shoe_mid_Adidas_AdizeroImpact', label: 'Adizero Impact Mid' },
    { value: 'shoe_mid_Adidas_AdizeroImpactPlus', label: 'Adizero Impact Plus Mid' },
    { value: 'Shoe_Mid_AdidasSMFreakXCarbon', label: 'Freak X Carbon Mid' },
    // Adidas High
    { value: 'GearFootwear_shoe_high_AdidasFreakInline23', label: 'Freak Inline 23 High' },
    { value: 'GearFootwear_shoe_high_AdidasFreakUltra22', label: 'Freak Ultra 22 High' },
    { value: 'GearFootwear_shoe_high_AdidasFreakUltra23', label: 'Freak Ultra 23 High' },
    { value: 'GearFootwear_shoe_high_Adidas_AdizeroChaos', label: 'Adizero Chaos High' },
    // Under Armour Low
    { value: 'GearFootwear_shoe_Low_UnderArmourSpotlight2018', label: 'UA Spotlight 2018 Low' },
    { value: 'GearFootwear_shoe_low_UnderArmourBlurPro2025', label: 'UA Blur Pro 2025 Low' },
    { value: 'GearFootwear_shoe_low_UnderArmourCloneFlow2025', label: 'UA Clone Flow 2025 Low' },
    { value: 'GearFootwear_shoe_low_UnderArmourSpotlightSuedeRevamp2025', label: 'UA Spotlight Suede 2025 Low' },
    // Under Armour Mid
    { value: 'GearFootwear_shoe_mid_UnderArmourBlurSmoke2024', label: 'UA Blur Smoke 2024 Mid' },
    { value: 'GearFootwear_shoe_mid_UnderArmourC1N2019', label: 'UA C1N 2019 Mid' },
    { value: 'GearFootwear_shoe_mid_UnderArmourSpotlightClone2024', label: 'UA Spotlight Clone 2024 Mid' },
    // Under Armour High
    { value: 'GearFootwear_shoe_high_UnderArmourHammer2024', label: 'UA Hammer 2024 High' },
    { value: 'GearFootwear_shoe_high_UnderArmourHighlight2019', label: 'UA Highlight 2019 High' }
  ],
  RightShoe: [
    // Vintage/Retro
    { value: 'GearFootwear_shoeLowVintage_nike', label: 'Nike Vintage Low' },
    // Nike Low
    { value: 'GearFootwear_shoe_Low_NikeAlphaMenaceElite', label: 'Alpha Menace Elite Low' },
    { value: 'GearFootwear_shoe_Low_NikeVaporCarbonEliteTD', label: 'Vapor Carbon Elite TD Low' },
    { value: 'GearFootwear_shoe_Low_NikeVaporUntouchable2', label: 'Vapor Untouchable 2 Low' },
    { value: 'GearFootwear_shoe_low_NikeVaporEdge', label: 'Vapor Edge Low' },
    { value: 'GearFootwear_shoe_low_NikeVaporEdgePro3602', label: 'Vapor Edge Pro 360 Low' },
    { value: 'GearFootwear_shoe_low_NikeVaporEdgeSpeed3062', label: 'Vapor Edge Speed 360 Low' },
    { value: 'GearFootwear_shoe_low_NikeVaporSpeed3', label: 'Vapor Speed 3 Low' },
    { value: 'GearFootwear_shoe_low_NikeVaporUntouchablePro', label: 'Vapor Untouchable Pro Low' },
    { value: 'GearFootwear_shoe_low_NikeVaporUntouchablePro3', label: 'Vapor Untouchable Pro 3 Low' },
    { value: 'GearFootwear_shoe_low_NikeAlphaMenaceElite3', label: 'Alpha Menace Elite 3 Low' },
    { value: 'GearFootwear_shoe_low_NikeAlphaMenacePro4', label: 'Alpha Menace Pro 4 Low' },
    { value: 'GearFootwear_shoe_low_NikeEquinox', label: 'Nike Equinox Low' },
    // Nike Mid
    { value: 'GearFootwear_shoe_Mid_NikeAlphaPro34TD', label: 'Alpha Pro 3/4 TD Mid' },
    { value: 'GearFootwear_shoe_Mid_NikeCodeEliteProShark', label: 'Code Elite Pro Shark Mid' },
    { value: 'GearFootwear_shoe_Mid_NikeLunarBeast', label: 'Lunar Beast Mid' },
    { value: 'GearFootwear_shoe_Mid_NikeVaporEdge360Untouchable', label: 'Vapor Edge 360 Mid' },
    { value: 'GearFootwear_shoe_mid_NikeAlphaMenacePro', label: 'Alpha Menace Pro Mid' },
    { value: 'GearFootwear_shoe_mid_NikeAlphaMenacePro2', label: 'Alpha Menace Pro 2 Mid' },
    { value: 'GearFootwear_shoe_mid_NikeAlphaMenacePro3WDP', label: 'Alpha Menace Pro 3 Mid' },
    { value: 'GearFootwear_shoe_mid_NikeAlphaMenaceStrong', label: 'Alpha Menace Strong Mid' },
    { value: 'GearFootwear_shoe_mid_NikeDiamondTURF', label: 'Diamond TURF Mid' },
    { value: 'GearFootwear_shoe_mid_NikeFieldGeneral', label: 'Field General Mid' },
    { value: 'GearFootwear_shoe_mid_NikeForceSavagePro2', label: 'Force Savage Pro 2 Mid' },
    { value: 'GearFootwear_shoe_mid_NikeVaporEdgeDunk', label: 'Vapor Edge Dunk Mid' },
    // Nike High
    { value: 'GearFootwear_shoe_High_NikeForceSavageEliteTDW', label: 'Force Savage Elite TD High' },
    { value: 'GearFootwear_shoe_high_NikeAlphaMenaceElite2', label: 'Alpha Menace Elite 2 High' },
    { value: 'GearFootwear_shoe_high_NikeForceSavageElite2', label: 'Force Savage Elite 2 High' },
    { value: 'GearFootwear_shoe_high_NikeVaporUntouchablePro3', label: 'Vapor Untouchable Pro 3 High' },
    // Jordan Low
    { value: 'GearFootwear_shoe_low_AirJordan1VaporEdge', label: 'Jordan 1 Vapor Edge Low' },
    { value: 'GearFootwear_shoe_low_AirJordanRetro1', label: 'Jordan Retro 1 Low' },
    { value: 'GearFootwear_shoe_low_AirJordanX', label: 'Jordan X Low' },
    { value: 'GearFootwear_shoe_low_AirJordanXI', label: 'Jordan XI Low' },
    { value: 'GearFootwear_shoe_low_Jordan5_99Club', label: 'Jordan 5 99 Club Low' },
    { value: 'GearFootwear_shoe_low_Jordan7', label: 'Jordan 7 Low' },
    // Jordan Mid
    { value: 'GearFootwear_shoe_mid_AirJordan3Cement', label: 'Jordan 3 Cement Mid' },
    { value: 'GearFootwear_shoe_mid_AirJordanRetro1', label: 'Jordan Retro 1 Mid' },
    { value: 'GearFootwear_shoe_mid_AirJordanRetroCement', label: 'Jordan Retro Cement Mid' },
    { value: 'GearFootwear_shoe_mid_AirJordanX', label: 'Jordan X Mid' },
    { value: 'GearFootwear_shoe_mid_Jordan11TD', label: 'Jordan 11 TD Mid' },
    { value: 'GearFootwear_shoe_mid_Jordan7', label: 'Jordan 7 Mid' },
    // Adidas Low
    { value: 'GearFootwear_shoe_low_AdidasAdizero_LTA58', label: 'Adizero LT Low' },
    { value: 'GearFootwear_shoe_low_AdidasFreak22', label: 'Freak 22 Low' },
    { value: 'GearFootwear_shoe_low_AdidasUltraboostMono', label: 'Ultraboost Mono Low' },
    { value: 'GearFootwear_shoe_low_Adidas_AdizeroElectric', label: 'Adizero Electric Low' },
    { value: 'GearFootwear_shoe_low_Adidas_AdizeroElectric1', label: 'Adizero Electric 1 Low' },
    { value: 'GearFootwear_shoe_low_Adidas_AdizeroElectricExoticSpeed', label: 'Adizero Electric Exotic Low' },
    { value: 'GearFootwear_shoe_low_Adidas_AdizeroElectricPlus', label: 'Adizero Electric Plus Low' },
    { value: 'GearFootwear_shoe_low_AdizeroElectric2', label: 'Adizero Electric 2 Low' },
    // Adidas Mid
    { value: 'GearFootwear_shoe_mid_AdidasAdizeroPrimeKnit', label: 'Adizero Primeknit Mid' },
    { value: 'GearFootwear_shoe_mid_AdidasFreak', label: 'Freak Mid' },
    { value: 'GearFootwear_shoe_mid_AdidasFreakUltraCleat', label: 'Freak Ultra Mid' },
    { value: 'GearFootwear_shoe_mid_AdidasNasty', label: 'Nasty Mid' },
    { value: 'GearFootwear_shoe_mid_Adidas_AdizeroImpact2', label: 'Adizero Impact 2 Mid' },
    { value: 'GearFootwear_shoe_mid_Adidas_AdizeroImpactSnake', label: 'Adizero Impact Snake Mid' },
    { value: 'shoe_mid_Adidas_AdizeroImpact', label: 'Adizero Impact Mid' },
    { value: 'shoe_mid_Adidas_AdizeroImpactPlus', label: 'Adizero Impact Plus Mid' },
    { value: 'Shoe_Mid_AdidasSMFreakXCarbon', label: 'Freak X Carbon Mid' },
    // Adidas High
    { value: 'GearFootwear_shoe_high_AdidasFreakInline23', label: 'Freak Inline 23 High' },
    { value: 'GearFootwear_shoe_high_AdidasFreakUltra22', label: 'Freak Ultra 22 High' },
    { value: 'GearFootwear_shoe_high_AdidasFreakUltra23', label: 'Freak Ultra 23 High' },
    { value: 'GearFootwear_shoe_high_Adidas_AdizeroChaos', label: 'Adizero Chaos High' },
    // Under Armour Low
    { value: 'GearFootwear_shoe_Low_UnderArmourSpotlight2018', label: 'UA Spotlight 2018 Low' },
    { value: 'GearFootwear_shoe_low_UnderArmourBlurPro2025', label: 'UA Blur Pro 2025 Low' },
    { value: 'GearFootwear_shoe_low_UnderArmourCloneFlow2025', label: 'UA Clone Flow 2025 Low' },
    { value: 'GearFootwear_shoe_low_UnderArmourSpotlightSuedeRevamp2025', label: 'UA Spotlight Suede 2025 Low' },
    // Under Armour Mid
    { value: 'GearFootwear_shoe_mid_UnderArmourBlurSmoke2024', label: 'UA Blur Smoke 2024 Mid' },
    { value: 'GearFootwear_shoe_mid_UnderArmourC1N2019', label: 'UA C1N 2019 Mid' },
    { value: 'GearFootwear_shoe_mid_UnderArmourSpotlightClone2024', label: 'UA Spotlight Clone 2024 Mid' },
    // Under Armour High
    { value: 'GearFootwear_shoe_high_UnderArmourHammer2024', label: 'UA Hammer 2024 High' },
    { value: 'GearFootwear_shoe_high_UnderArmourHighlight2019', label: 'UA Highlight 2019 High' }
  ],
  LeftShoeColor: [
    { value: 'U_GENERIC_SHOESX_WHIWHI', label: 'White/White' },
    { value: 'U_GENERIC_SHOESX_WHIBLA', label: 'White/Black' },
    { value: 'U_GENERIC_SHOESX_WHIPRI', label: 'White/Team' },
    { value: 'U_GENERIC_SHOESX_WHISEC', label: 'White/Secondary' },
    { value: 'U_GENERIC_SHOESX_BLABLA', label: 'Black/Black' },
    { value: 'U_GENERIC_SHOESX_BLAWHI', label: 'Black/White' },
    { value: 'U_GENERIC_SHOESX_BLAPRI', label: 'Black/Team' },
    { value: 'U_GENERIC_SHOESX_BLASEC', label: 'Black/Secondary' }
  ],
  RightShoeColor: [
    { value: 'U_GENERIC_SHOESX_WHIWHI', label: 'White/White' },
    { value: 'U_GENERIC_SHOESX_WHIBLA', label: 'White/Black' },
    { value: 'U_GENERIC_SHOESX_WHIPRI', label: 'White/Team' },
    { value: 'U_GENERIC_SHOESX_WHISEC', label: 'White/Secondary' },
    { value: 'U_GENERIC_SHOESX_BLABLA', label: 'Black/Black' },
    { value: 'U_GENERIC_SHOESX_BLAWHI', label: 'Black/White' },
    { value: 'U_GENERIC_SHOESX_BLAPRI', label: 'Black/Team' },
    { value: 'U_GENERIC_SHOESX_BLASEC', label: 'Black/Secondary' }
  ],
  Socks: [
    { value: 'Gear_Socks_Under', label: 'Under (Hidden)' },
    { value: 'Gear_Socks_Low', label: 'Low' },
    { value: 'Gear_Socks_Mid', label: 'Mid' },
    { value: 'Gear_Socks_High', label: 'High' },
    { value: 'Gear_Socks_Wrinkle_Mid', label: 'Wrinkle Mid' },
    { value: 'Gear_Socks_Wrinkle_High', label: 'Wrinkle High' }
  ],
  KneePad: [
    { value: 'KneePad_None', label: 'None' },
    { value: 'KneePad_Regular', label: 'Regular' },
    { value: 'KneePad_Nike', label: 'Nike' }
  ],
  LeftThighPad: [
    { value: 'ThighPad_None', label: 'None' },
    { value: 'ThighPad_Regular', label: 'Regular' },
    { value: 'ThighPad_Nike', label: 'Nike' }
  ],
  RightThighPad: [
    { value: 'ThighPad_None', label: 'None' },
    { value: 'ThighPad_Regular', label: 'Regular' },
    { value: 'ThighPad_Nike', label: 'Nike' }
  ]
};

/**
 * Get equipment data for a player by POID
 * @param {number} poidOrIndex - The player's POID (preferred) or legacy index
 * @returns {Object} Equipment slot values
 */
function getPlayerEquipment(poidOrIndex) {
  const file = global.rosterFile;
  if (!file) {
    console.error('[RosterParser] No roster file loaded');
    return null;
  }

  // Get player's POID - either directly passed or find from PLAY table
  const playTable = file.tables?.find(t => t.name === 'PLAY') || file.PLAY;

  let poid;

  // First, try to find a PLAY record with this POID directly
  // This handles the case where POID is passed directly
  const directMatch = playTable?.records?.find(r => r.POID === poidOrIndex);
  if (directMatch) {
    poid = poidOrIndex;
    const playerName = `${directMatch.PFNA || ''} ${directMatch.PLNA || ''}`.trim();
    console.log(`[RosterParser] getPlayerEquipment: Found direct POID match: ${poid} (${playerName})`);
  } else {
    // Legacy fallback: treat as array index (but this is unreliable after deletions)
    const playerRec = playTable?.records?.[poidOrIndex];
    if (!playerRec) {
      console.error('[RosterParser] Could not find player with POID or at index', poidOrIndex);
      return null;
    }
    poid = playerRec.POID;
    const playerName = `${playerRec.PFNA || ''} ${playerRec.PLNA || ''}`.trim();
    console.log(`[RosterParser] getPlayerEquipment: Using legacy index ${poidOrIndex}, POID: ${poid} (${playerName})`);
  }

  const blob = file.BLOB?.records?.[0];
  const blbm = blob?.fields?.BLBM?.value;
  if (!blbm || !blbm._records) {
    console.error('[RosterParser] Could not find BLBM records');
    return null;
  }

  // CRITICAL: Find BLBM record by POID, not array index
  // The game links PLAY records to BLBM records by finding BLBM[].index === POID
  const blbmRec = blbm._records.find(r => r.index === poid);
  if (!blbmRec) {
    console.error('[RosterParser] Could not find BLBM record for POID', poid);
    return null;
  }

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
 * Set equipment for a player by POID
 * @param {number} poidOrIndex - The player's POID (preferred) or legacy index
 * @param {Object} equipment - Equipment slot values to set
 * @returns {boolean} Success
 */
function setPlayerEquipment(poidOrIndex, equipment) {
  const file = global.rosterFile;
  if (!file) {
    console.error('[RosterParser] No roster file loaded');
    return false;
  }

  // Get player's POID - either directly passed or find from PLAY table
  const playTable = file.tables?.find(t => t.name === 'PLAY') || file.PLAY;

  let poid;

  // First, try to find a PLAY record with this POID directly
  const directMatch = playTable?.records?.find(r => r.POID === poidOrIndex);
  if (directMatch) {
    poid = poidOrIndex;
    const playerName = `${directMatch.PFNA || ''} ${directMatch.PLNA || ''}`.trim();
    console.log(`[RosterParser] setPlayerEquipment: Found direct POID match: ${poid} (${playerName})`);
  } else {
    // Legacy fallback: treat as array index (unreliable after deletions)
    const playerRec = playTable?.records?.[poidOrIndex];
    if (!playerRec) {
      console.error('[RosterParser] Could not find player with POID or at index', poidOrIndex);
      return false;
    }
    poid = playerRec.POID;
    const playerName = `${playerRec.PFNA || ''} ${playerRec.PLNA || ''}`.trim();
    console.log(`[RosterParser] setPlayerEquipment: Using legacy index ${poidOrIndex}, POID: ${poid} (${playerName})`);
  }

  // CRITICAL: Store equipment changes keyed by POID, not playerIndex
  // This ensures we find the correct BLBM record during save
  pendingEquipmentChanges.set(poid, { ...equipment });
  console.log(`[RosterParser] Queued equipment changes for POID ${poid}:`, equipment);

  // Also apply immediately to global.rosterFile for any code that reads from it
  const blob = file.BLOB?.records?.[0];
  const blbm = blob?.fields?.BLBM?.value;
  if (!blbm || !blbm._records) {
    console.error('[RosterParser] Could not find BLBM records');
    return true; // Still return true since we queued the changes
  }

  // CRITICAL: Find BLBM record by POID, not array index
  const blbmRec = blbm._records.find(r => r.index === poid);
  if (!blbmRec) {
    console.error('[RosterParser] Could not find BLBM record for POID', poid);
    return true; // Still return true since we queued the changes
  }

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

  // pendingEquipmentChanges is now keyed by POID (not playerIndex)
  for (const [poid, equipment] of pendingEquipmentChanges.entries()) {
    // CRITICAL: Find BLBM record by POID, not array index
    // The game links PLAY records to BLBM records by finding BLBM[].index === POID
    const blbmRec = blbm._records.find(r => r.index === poid);
    if (!blbmRec) {
      console.warn(`[RosterParser] Could not find BLBM record for POID ${poid}, skipping`);
      continue;
    }

    const fields = blbmRec.fields || blbmRec._fields;
    const lout = fields?.LOUT?.value;

    if (!lout || !lout._records) {
      console.warn(`[RosterParser] No LOUT data for POID ${poid}`);
      continue;
    }

    // Find PlayerOnField loadout (LDTY=1)
    const playerOnFieldRec = lout._records.find(r => {
      const f = r.fields || r._fields;
      return f?.LDTY?.value === 1 || f?.LDTY?._value === 1;
    });

    if (!playerOnFieldRec) {
      console.warn(`[RosterParser] No PlayerOnField loadout for POID ${poid}`);
      continue;
    }

    const pinsField = (playerOnFieldRec.fields || playerOnFieldRec._fields)?.PINS;
    const pins = pinsField?.value;

    if (!pins || !pins._records) {
      console.warn(`[RosterParser] No PINS data for POID ${poid}`);
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

    console.log(`[RosterParser] Applied ${playerUpdated} equipment slots for POID ${poid}`);
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
