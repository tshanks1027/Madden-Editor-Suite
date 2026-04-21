// Generic Face Service
//
// Handles mapping of player race to appropriate GENR (generic face model)
// and SKNT (skin tone) values in the BLBM table.
//
// Based on research findings:
// - GENR string controls the face model (e.g., "gen_7_B_N_019")
// - SKNT controls skin tone (1=lightest, 7=darkest)
// - Race 7 (Black) -> SKNT 6-7, uses gen_6_* and gen_7_* faces
// - Race 5 (Mixed) -> SKNT 3-5, uses gen_3_* to gen_5_* faces
// - Race 1 (White) -> SKNT 1-2, uses gen_1_* and gen_2_* faces

const path = require('path');
const fs = require('fs');

// Import TDB2Field for creating new BLBM fields (e.g., BTYP when missing)
const TDB2Field = require(path.join(__dirname, '..', 'lib', 'filetypes', 'TDB2', 'TDB2Field'));
const utilService = require(path.join(__dirname, '..', 'lib', 'services', 'utilService'));

// Field type constants (must match TDB2Field.js)
const FIELD_TYPE_INT = 0;

console.log('[GenericFaceService] Module loading...');

// Load GENR catalog for validating face values
let genrCatalog = null;
let validGenrSet = null;

// Verified portrait->GENR mapping (268 faces that work in-game)
let verifiedGenrMapping = null;
let verifiedGenrBySkinTone = null;

// Face picker # -> GENR/SKNT mapping (definitive from ROSTER-GENHEADTEST)
// Face picker 001-264 maps directly to specific GENR codes
let facePickerToGenrMapping = null;
let genrToFacePickerMapping = null;

// GENR -> GNHD mapping (numeric head ID required for face persistence)
// When GNHD is 0 with CNID=0, the game may reset faces after save/reload
let genrToGnhdMapping = null;

function loadFacePickerMapping() {
  if (facePickerToGenrMapping) return facePickerToGenrMapping;

  const possiblePaths = [
    path.join(__dirname, '..', 'data', 'lookups', 'face-picker-to-genr.json'),
    path.join(__dirname, '..', '..', 'data', 'lookups', 'face-picker-to-genr.json'),
    path.join(process.cwd(), 'data', 'lookups', 'face-picker-to-genr.json'),
    path.join(process.cwd(), '.vite', 'build', 'data', 'lookups', 'face-picker-to-genr.json')
  ];

  for (const mappingPath of possiblePaths) {
    if (fs.existsSync(mappingPath)) {
      try {
        facePickerToGenrMapping = JSON.parse(fs.readFileSync(mappingPath, 'utf8'));
        console.log(`[GenericFaceService] Loaded ${Object.keys(facePickerToGenrMapping).length} face picker->GENR mappings`);
        return facePickerToGenrMapping;
      } catch (e) {
        console.error('[GenericFaceService] Error loading face picker mapping:', e.message);
      }
    }
  }
  console.warn('[GenericFaceService] face-picker-to-genr.json not found');
  return null;
}

function loadGenrToFacePickerMapping() {
  if (genrToFacePickerMapping) return genrToFacePickerMapping;

  const possiblePaths = [
    path.join(__dirname, '..', 'data', 'lookups', 'genr-to-face-picker.json'),
    path.join(__dirname, '..', '..', 'data', 'lookups', 'genr-to-face-picker.json'),
    path.join(process.cwd(), 'data', 'lookups', 'genr-to-face-picker.json'),
    path.join(process.cwd(), '.vite', 'build', 'data', 'lookups', 'genr-to-face-picker.json')
  ];

  for (const mappingPath of possiblePaths) {
    if (fs.existsSync(mappingPath)) {
      try {
        genrToFacePickerMapping = JSON.parse(fs.readFileSync(mappingPath, 'utf8'));
        console.log(`[GenericFaceService] Loaded ${Object.keys(genrToFacePickerMapping).length} GENR->face picker mappings`);
        return genrToFacePickerMapping;
      } catch (e) {
        console.error('[GenericFaceService] Error loading GENR->face picker mapping:', e.message);
      }
    }
  }
  console.warn('[GenericFaceService] genr-to-face-picker.json not found');
  return null;
}

/**
 * Load GENR -> GNHD mapping for proper face persistence
 * GNHD (Generic Head Number) is required for faces to persist after save/reload
 */
function loadGenrToGnhdMapping() {
  if (genrToGnhdMapping) return genrToGnhdMapping;

  const possiblePaths = [
    path.join(__dirname, '..', 'data', 'lookups', 'genr-to-gnhd.json'),
    path.join(__dirname, '..', '..', 'data', 'lookups', 'genr-to-gnhd.json'),
    path.join(process.cwd(), 'data', 'lookups', 'genr-to-gnhd.json'),
    path.join(process.cwd(), '.vite', 'build', 'data', 'lookups', 'genr-to-gnhd.json')
  ];

  for (const mappingPath of possiblePaths) {
    if (fs.existsSync(mappingPath)) {
      try {
        genrToGnhdMapping = JSON.parse(fs.readFileSync(mappingPath, 'utf8'));
        console.log(`[GenericFaceService] Loaded ${Object.keys(genrToGnhdMapping).length} GENR->GNHD mappings`);
        return genrToGnhdMapping;
      } catch (e) {
        console.error('[GenericFaceService] Error loading GENR->GNHD mapping:', e.message);
      }
    }
  }
  console.warn('[GenericFaceService] genr-to-gnhd.json not found - faces may not persist after save');
  return null;
}

/**
 * Get GNHD value for a GENR code
 * Returns the numeric GNHD or 0 if not found
 */
function getGnhdForGenr(genr) {
  loadGenrToGnhdMapping();
  if (!genrToGnhdMapping || !genr) return 0;

  const mapping = genrToGnhdMapping[genr];
  if (mapping && typeof mapping === 'object' && mapping.gnhd !== undefined) {
    return mapping.gnhd;
  }
  // Direct numeric value
  if (typeof mapping === 'number') {
    return mapping;
  }
  return 0;
}

/**
 * Get GENR and SKNT for a specific face picker number (001-264)
 * @param facePickerNum - The face picker number (1-264)
 * @returns {genr, sknt} or null if not found
 */
function getGenrForFacePickerNum(facePickerNum) {
  loadFacePickerMapping();
  if (!facePickerToGenrMapping) return null;

  const key = String(facePickerNum);
  const mapping = facePickerToGenrMapping[key];
  return mapping || null;
}

/**
 * Get face picker numbers for a GENR code
 * @param genr - The GENR code (e.g., "gen_7_T_S_004")
 * @returns Array of face picker numbers, or empty array
 */
function getFacePickerNumsForGenr(genr) {
  loadGenrToFacePickerMapping();
  if (!genrToFacePickerMapping || !genr) return [];
  return genrToFacePickerMapping[genr] || [];
}

function loadVerifiedMapping() {
  if (verifiedGenrMapping) return verifiedGenrMapping;

  const possiblePaths = [
    path.join(__dirname, '..', 'data', 'lookups', 'verified-portrait-genr.json'),
    path.join(__dirname, '..', '..', 'data', 'lookups', 'verified-portrait-genr.json'),
    path.join(process.cwd(), 'data', 'lookups', 'verified-portrait-genr.json'),
    path.join(process.cwd(), '.vite', 'build', 'data', 'lookups', 'verified-portrait-genr.json')
  ];

  for (const mappingPath of possiblePaths) {
    if (fs.existsSync(mappingPath)) {
      try {
        verifiedGenrMapping = JSON.parse(fs.readFileSync(mappingPath, 'utf8'));
        console.log(`[GenericFaceService] Loaded ${Object.keys(verifiedGenrMapping).length} verified portrait->GENR mappings`);

        // Group by skin tone for race-based assignment
        verifiedGenrBySkinTone = {};
        for (const v of Object.values(verifiedGenrMapping)) {
          if (!verifiedGenrBySkinTone[v.sknt]) {
            verifiedGenrBySkinTone[v.sknt] = [];
          }
          verifiedGenrBySkinTone[v.sknt].push(v.genr);
        }
        console.log('[GenericFaceService] Grouped verified GENR by skin tone:', Object.keys(verifiedGenrBySkinTone).map(k => `SKNT ${k}: ${verifiedGenrBySkinTone[k].length}`).join(', '));

        return verifiedGenrMapping;
      } catch (e) {
        console.error('[GenericFaceService] Error loading verified mapping:', e.message);
      }
    }
  }
  console.warn('[GenericFaceService] Verified portrait-genr mapping not found, falling back to catalog');
  return null;
}

function loadGenrCatalog() {
  if (genrCatalog) return genrCatalog;

  const possiblePaths = [
    path.join(__dirname, '..', 'data', 'lookups', 'GENR_catalog.json'),
    path.join(__dirname, '..', '..', 'data', 'lookups', 'GENR_catalog.json'),
    path.join(process.cwd(), 'data', 'lookups', 'GENR_catalog.json'),
    path.join(process.cwd(), '.vite', 'build', 'data', 'lookups', 'GENR_catalog.json')
  ];

  for (const catalogPath of possiblePaths) {
    if (fs.existsSync(catalogPath)) {
      try {
        genrCatalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
        console.log('[GenericFaceService] GENR catalog loaded from:', catalogPath);

        // Build set of all valid GENR values (lowercase for case-insensitive comparison)
        validGenrSet = new Set();
        for (let i = 1; i <= 7; i++) {
          const key = `gen_${i}`;
          if (genrCatalog[key]) {
            genrCatalog[key].forEach(g => validGenrSet.add(g.toLowerCase()));
          }
        }
        console.log(`[GenericFaceService] Loaded ${validGenrSet.size} valid GENR values from catalog`);
        return genrCatalog;
      } catch (e) {
        console.error('[GenericFaceService] Error loading GENR catalog:', e.message);
      }
    }
  }
  console.warn('[GenericFaceService] GENR catalog not found, will use hardcoded pools');
  return null;
}

// Check if a GENR value is valid according to the catalog
function isValidGenr(genr) {
  if (!genr) return false;
  loadGenrCatalog();
  if (!validGenrSet) return true; // If no catalog, assume valid
  return validGenrSet.has(genr.toLowerCase());
}

// Get a random valid GENR for a given skin tone
// Prefers verified mapping values (268 faces that work in-game)
function getRandomGenrFromCatalog(sknt) {
  // First try verified mapping (preferred - guaranteed to work in-game)
  loadVerifiedMapping();
  if (verifiedGenrBySkinTone && verifiedGenrBySkinTone[sknt]) {
    const pool = verifiedGenrBySkinTone[sknt];
    if (pool && pool.length > 0) {
      return pool[Math.floor(Math.random() * pool.length)];
    }
  }

  // Fallback to full catalog
  loadGenrCatalog();
  const key = `gen_${sknt}`;
  const pool = genrCatalog?.[key];
  if (pool && pool.length > 0) {
    return pool[Math.floor(Math.random() * pool.length)];
  }
  return null;
}

// Database will be loaded lazily on first use
let db = null;
let dbInitialized = false;

// Real player face pools by race - loaded from PID_Portrait_Mapping.csv
// Each entry is { cnid, asnm } for a real player with a face scan
let realFacePoolByRace = null;

function loadRealFacePool() {
  if (realFacePoolByRace) return realFacePoolByRace;

  realFacePoolByRace = {
    1: [], // White
    2: [], // Light-skinned Black
    3: [], // Medium
    4: [], // Tan
    5: [], // Mixed
    6: [], // Dark
    7: []  // Very dark/Black
  };

  const possiblePaths = [
    path.join(__dirname, '..', 'data', 'lookups', 'PID_Portrait_Mapping.csv'),
    path.join(__dirname, '..', '..', 'data', 'lookups', 'PID_Portrait_Mapping.csv'),
    path.join(process.cwd(), 'data', 'lookups', 'PID_Portrait_Mapping.csv'),
    path.join(process.cwd(), '.vite', 'build', 'data', 'lookups', 'PID_Portrait_Mapping.csv')
  ];

  for (const csvPath of possiblePaths) {
    if (fs.existsSync(csvPath)) {
      try {
        const content = fs.readFileSync(csvPath, 'utf8');
        const lines = content.split('\n');

        // Skip header: PID,Player Name,Type,Portrait,PAM,Race
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;

          const parts = line.split(',');
          if (parts.length < 6) continue;

          const pam = parts[4]; // PAM column
          const race = parseInt(parts[5], 10); // Race column

          if (!pam || pam === '0' || pam === '') continue;
          if (!race || race < 1 || race > 7) continue;

          // Extract CNID from PAM format: "LastnameFirstname_CNID"
          const cnidMatch = pam.match(/_(\d+)$/);
          if (cnidMatch) {
            const cnid = parseInt(cnidMatch[1], 10);
            if (cnid > 0) {
              realFacePoolByRace[race].push({
                cnid: cnid,
                asnm: pam
              });
            }
          }
        }

        console.log('[GenericFaceService] Loaded real face pool from:', csvPath);
        for (let r = 1; r <= 7; r++) {
          console.log(`  Race ${r}: ${realFacePoolByRace[r].length} faces`);
        }
        return realFacePoolByRace;
      } catch (e) {
        console.error('[GenericFaceService] Error loading face pool:', e.message);
      }
    }
  }

  console.warn('[GenericFaceService] Could not load PID_Portrait_Mapping.csv');
  return realFacePoolByRace;
}

// Get a random real player face for a given race
function getRandomRealFace(race) {
  loadRealFacePool();

  // Normalize race to 1-7
  let targetRace = race;
  if (targetRace < 1) targetRace = 1;
  if (targetRace > 7) targetRace = 7;

  const pool = realFacePoolByRace[targetRace];
  if (pool && pool.length > 0) {
    return pool[Math.floor(Math.random() * pool.length)];
  }

  // Fallback to adjacent race pools
  for (let offset = 1; offset <= 3; offset++) {
    const lower = realFacePoolByRace[targetRace - offset];
    if (lower && lower.length > 0) {
      return lower[Math.floor(Math.random() * lower.length)];
    }
    const higher = realFacePoolByRace[targetRace + offset];
    if (higher && higher.length > 0) {
      return higher[Math.floor(Math.random() * higher.length)];
    }
  }

  return null;
}

function initDatabase() {
  if (dbInitialized) return db;
  dbInitialized = true;

  try {
    const Database = require('better-sqlite3');

    // Find database path
    const possiblePaths = [
      path.join(__dirname, '..', 'data', 'players.db'),
      path.join(__dirname, '..', '..', 'data', 'players.db'),
      path.join(process.cwd(), 'data', 'players.db'),
      path.join(process.cwd(), '.vite', 'build', 'data', 'players.db')
    ];

    console.log('[GenericFaceService] Searching for database...');
    console.log('[GenericFaceService] __dirname:', __dirname);

    for (const dbPath of possiblePaths) {
      console.log('[GenericFaceService] Checking:', dbPath, 'exists:', fs.existsSync(dbPath));
      if (fs.existsSync(dbPath)) {
        db = new Database(dbPath, { readonly: true });
        console.log('[GenericFaceService] Database opened from:', dbPath);

        // Verify pid_race table exists
        const tableCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='pid_race'").get();
        if (tableCheck) {
          const count = db.prepare('SELECT COUNT(*) as cnt FROM pid_race').get();
          console.log('[GenericFaceService] pid_race table has', count.cnt, 'entries');
        } else {
          console.log('[GenericFaceService] WARNING: pid_race table not found!');
        }
        break;
      }
    }

    if (!db) {
      console.log('[GenericFaceService] WARNING: Could not find players.db');
    }
  } catch (e) {
    console.error('[GenericFaceService] Database init error:', e.message);
    console.error('[GenericFaceService] Stack:', e.stack);
  }

  return db;
}

// GENR pools organized by skin tone
const GENR_POOLS = {
  1: [
    'gen_1_B_N_010', 'gen_1_B_N_011', 'gen_1_B_B_005', 'gen_1_B_S_001',
    'gen_1_H_B_009', 'gen_1_H_N_010', 'gen_1_M_N_02', 'gen_1_T_N_004'
  ],
  2: [
    'gen_2_B_N_01', 'gen_2_B_N_02', 'gen_2_B_B_002', 'gen_2_B_S_001',
    'gen_2_H_B_002', 'gen_2_H_N_006', 'gen_2_M_B_01', 'gen_2_T_N_01'
  ],
  3: [
    'gen_3_B_N_01', 'gen_3_B_N_02', 'gen_3_B_B_001', 'gen_3_B_S_010',
    'gen_3_H_B_01', 'gen_3_H_N_01', 'gen_3_M_N_01', 'gen_3_T_N_01'
  ],
  4: [
    'gen_4_B_N_01', 'gen_4_B_N_02', 'gen_4_B_B_004', 'gen_4_B_G_003',
    'gen_4_H_N_001', 'gen_4_M_N_01', 'gen_4_T_N_006', 'gen_4_T_G_01'
  ],
  5: [
    'gen_5_B_N_01', 'gen_5_B_N_02', 'gen_5_B_G_01', 'gen_5_B_S_002',
    'gen_5_H_N_01', 'gen_5_M_N_01', 'gen_5_T_G_01', 'gen_5_M_B_001'
  ],
  6: [
    'gen_6_B_N_01', 'gen_6_B_N_02', 'gen_6_B_G_01', 'gen_6_B_S_01',
    'gen_6_H_N_01', 'gen_6_M_N_01', 'gen_6_T_G_005', 'gen_6_H_B_002'
  ],
  7: [
    'gen_7_B_N_019', 'gen_7_B_N_011', 'gen_7_B_N_07', 'gen_7_B_G_004',
    'gen_7_H_N_01', 'gen_7_M_N_001', 'gen_7_T_N_001', 'gen_7_B_B_001'
  ]
};

// Map race values to SKNT ranges
// Race values: 1=White, 2-4=Light/Medium tones, 5=Mixed, 6=Medium-dark, 7=Black
const RACE_TO_SKNT = {
  1: [1, 2],     // White -> lightest tones (SKNT 1-2)
  2: [2, 3],     // Light -> light-medium tones (SKNT 2-3)
  3: [3, 4],     // Light-medium -> medium tones (SKNT 3-4)
  4: [4, 5],     // Medium -> medium tones (SKNT 4-5)
  5: [3, 4, 5],  // Mixed -> middle tones (SKNT 3-5)
  6: [5, 6],     // Medium-dark -> darker tones (SKNT 5-6)
  7: [6, 7]      // Black -> darkest tones (SKNT 6-7)
};

class GenericFaceService {
  constructor() {
    this.initialized = false;
  }

  /**
   * Initialize the service - uses direct database access
   */
  async initialize() {
    if (this.initialized) return;

    // Initialize database on first use
    const database = initDatabase();
    if (database) {
      console.log('[GenericFaceService] Using direct database for race lookups');
    } else {
      console.log('[GenericFaceService] WARNING: No database available - will use fallback race determination');
    }
    this.initialized = true;
  }

  /**
   * Get race for a given PID from the database
   */
  getRaceForPid(pid) {
    // Ensure database is initialized
    const database = initDatabase();
    if (!database) {
      console.warn('[GenericFaceService] Database not available for race lookup');
      return undefined;
    }

    try {
      // Query pid_race table directly
      const row = database.prepare('SELECT race FROM pid_race WHERE pid = ?').get(pid);
      if (row && row.race) {
        console.log(`[GenericFaceService] Database lookup: PID ${pid} -> race ${row.race}`);
        return row.race;
      }

      // Fallback: try players table
      const playerRow = database.prepare('SELECT race FROM players WHERE pid = ?').get(pid);
      if (playerRow && playerRow.race) {
        console.log(`[GenericFaceService] Players table lookup: PID ${pid} -> race ${playerRow.race}`);
        return playerRow.race;
      }

      console.log(`[GenericFaceService] No race found for PID ${pid}`);
      return undefined;
    } catch (e) {
      console.error(`[GenericFaceService] Database error for PID ${pid}:`, e.message);
      return undefined;
    }
  }

  /**
   * Get appropriate SKNT value for a race
   */
  getSkntForRace(race) {
    const skntRange = RACE_TO_SKNT[race];
    if (skntRange && skntRange.length > 0) {
      // Pick a random SKNT from the valid range for variety
      return skntRange[Math.floor(Math.random() * skntRange.length)];
    }
    // Default to middle if race not found
    return 4;
  }

  /**
   * Get appropriate GENR value for a SKNT
   */
  getGenrForSknt(sknt) {
    const pool = GENR_POOLS[sknt];
    if (pool && pool.length > 0) {
      // Pick a random GENR from the pool for variety
      return pool[Math.floor(Math.random() * pool.length)];
    }
    // Default fallback
    return 'gen_4_B_N_01';
  }

  /**
   * Get GENR and SKNT for a player based on their PID
   */
  getGenericFaceForPid(pid) {
    const race = this.getRaceForPid(pid);

    // Default to race 5 (mixed) if not found
    const effectiveRace = race ?? 5;

    const sknt = this.getSkntForRace(effectiveRace);
    const genr = this.getGenrForSknt(sknt);

    return { genr, sknt };
  }

  /**
   * Update BLBM records for players without real PAM
   * CRITICAL: PLAY and BLBM tables are NOT aligned by index!
   * We must find the correct BLBM record by matching player name (CFNM/CLNM = PFNA/PLNA)
   * @param file - The loaded roster file object
   * @param players - Array of player data from PLAY table
   */
  async updateBLBMForGenericFaces(file, players) {
    await this.initialize();

    console.log('[GenericFaceService] ===== BLBM UPDATE START =====');
    const database = initDatabase();
    console.log('[GenericFaceService] Database available:', !!database);

    const blob = file.BLOB?.records?.[0];
    if (!blob) {
      console.log('[GenericFaceService] No BLOB table found');
      console.log('[GenericFaceService] File tables:', Object.keys(file || {}));
      return 0;
    }

    console.log('[GenericFaceService] BLOB found, checking BLBM...');
    console.log('[GenericFaceService] blob.fields keys:', Object.keys(blob.fields || {}));

    const blbm = blob.fields?.['BLBM']?.value;
    if (!blbm || !blbm._records) {
      console.log('[GenericFaceService] No BLBM table found in BLOB');
      console.log('[GenericFaceService] BLBM field:', blob.fields?.['BLBM']);
      console.log('[GenericFaceService] BLBM value:', blbm);
      return 0;
    }

    // Get PLAY table to read PGID values directly (UI may not preserve all fields)
    const playTable = file.PLAY;
    if (!playTable?.records) {
      console.log('[GenericFaceService] WARNING: No PLAY table found - cannot get PGID values');
    } else {
      console.log(`[GenericFaceService] PLAY table has ${playTable.records.length} records`);
    }

    console.log(`[GenericFaceService] BLBM has ${blbm._records.length} records, processing ${players.length} players`);

    // CRITICAL FIX: Build a name-based lookup for BLBM records
    // PLAY and BLBM are NOT aligned by index! We must find by name.
    const blbmByName = new Map();
    for (let bi = 0; bi < blbm._records.length; bi++) {
      const rec = blbm._records[bi];
      const fields = rec.fields || rec._fields;
      const firstName = (fields?.['CFNM']?.value ?? fields?.['CFNM']?._value ?? '').trim();
      const lastName = (fields?.['CLNM']?.value ?? fields?.['CLNM']?._value ?? '').trim();
      const fullName = `${firstName}|${lastName}`.toLowerCase();

      // DEBUG: Log test players found in BLBM
      const blbmName = `${firstName} ${lastName}`.toLowerCase();
      if (blbmName.includes('douglass') || blbmName.includes('concannon') ||
          blbmName === 'ron smith' || blbmName.includes('kent nix')) {
        const sknt = fields?.['SKNT']?.value ?? fields?.['SKNT']?._value;
        const genr = fields?.['GENR']?.value ?? fields?.['GENR']?._value;
        console.log(`[GenericFaceService] TEST: Found BLBM[${bi}] "${firstName} ${lastName}": GENR="${genr}", SKNT=${sknt}`);
      }

      if (!blbmByName.has(fullName)) {
        blbmByName.set(fullName, []);
      }
      blbmByName.get(fullName).push({ index: bi, record: rec });
    }
    console.log(`[GenericFaceService] Built BLBM name lookup with ${blbmByName.size} unique names`);

    // Debug: Log first few PGID values from PLAY table
    if (playTable?.records) {
      console.log('[GenericFaceService] First 5 PGID values from PLAY table:');
      for (let j = 0; j < Math.min(5, playTable.records.length); j++) {
        const rec = playTable.records[j];
        const pgidVal = rec.fields?.['PGID']?.value ?? rec.fields?.['PGID']?._value ?? 'N/A';
        const nameVal = (rec.fields?.['PFNA']?.value || '') + ' ' + (rec.fields?.['PLNA']?.value || '');
        console.log(`  [${j}] ${nameVal.trim()}: PGID=${pgidVal}`);
      }
    }

    // Log first BLBM record structure to understand field names
    if (blbm._records.length > 0) {
      const firstRec = blbm._records[0];
      const fields = firstRec.fields || firstRec._fields;
      console.log('[GenericFaceService] BLBM record structure:', Object.keys(fields || {}));
      console.log('[GenericFaceService] GENR field:', fields?.['GENR']);
      console.log('[GenericFaceService] SKNT field:', fields?.['SKNT']);
    }

    let updatedCount = 0;
    let skippedWithPAM = 0;
    let skippedNotGeneric = 0;
    let blbmNotFound = 0;

    // Process each player - find matching BLBM record by NAME
    for (let i = 0; i < players.length; i++) {
      const player = players[i];

      // Find the BLBM record that matches this player's name
      const playerFirst = (player.PFNA || '').trim();
      const playerLast = (player.PLNA || '').trim();
      const playerFullName = `${playerFirst}|${playerLast}`.toLowerCase();

      // Skip empty player slots
      if (!playerFirst && !playerLast) continue;

      const blbmMatches = blbmByName.get(playerFullName);
      if (!blbmMatches || blbmMatches.length === 0) {
        blbmNotFound++;
        if (blbmNotFound <= 5) {
          console.log(`[GenericFaceService] No BLBM record found for "${playerFirst} ${playerLast}" - will create new mapping`);
        }
        continue; // Skip if no matching BLBM record (might need to be created)
      }

      // Use the first match (most common case is 1:1 name match)
      const { index: blbmIndex, record: blbmRec } = blbmMatches[0];

      if (updatedCount < 5) {
        console.log(`[GenericFaceService] Matched PLAY player "${playerFirst} ${playerLast}" to BLBM[${blbmIndex}]`);
      }

      const peps = player.PEPS; // PAM value
      const psxp = player.PSXP; // PID value
      const plpl = player.PLPL; // Player picture level (0=generic, 100=real)
      const playerName = `${player.PFNA || ''} ${player.PLNA || ''}`.trim();

      // Debug: Log specific players we're interested in (test players for skin tone)
      const isDebugPlayer = playerName.toLowerCase().includes('staubach') ||
                            playerName.toLowerCase().includes('danny white') ||
                            playerName.toLowerCase().includes('aikman') ||
                            playerName.toLowerCase().includes('douglass') ||
                            playerName.toLowerCase().includes('concannon') ||
                            playerName.toLowerCase() === 'ron smith' ||
                            playerName.toLowerCase().includes('kent nix');

      if (isDebugPlayer) {
        console.log(`[GenericFaceService] DEBUG PLAYER: ${playerName}`);
        console.log(`  Index: ${i}, PSXP(PID): ${psxp}, PLPL: ${plpl}, PEPS: "${peps}"`);
      }

      // Process players who need BLBM GENR/SKNT set:
      // 1. Generic faces (PLPL = 0) - always need BLBM set
      // 2. Real PIDs with NO PAM (empty PEPS) - game will use BLBM since no face scan
      // 3. Players with generic portrait names in PEPS
      const isGenericFace = plpl === 0 || plpl === '0';
      const hasEmptyPEPS = !peps || peps === '' || peps === '0' || peps === 0;
      // FIX: Check for both 'gen_' and 'plpo_generic' patterns as generic faces
      const hasGenericPEPS = peps && typeof peps === 'string' && (peps.startsWith('gen_') || peps.includes('generic'));
      const hasRealPAM = peps && typeof peps === 'string' && peps.length > 0 && !peps.startsWith('gen_') && !peps.includes('generic');

      if (isDebugPlayer) {
        console.log(`  isGenericFace: ${isGenericFace}, hasEmptyPEPS: ${hasEmptyPEPS}, hasGenericPEPS: ${hasGenericPEPS}, hasRealPAM: ${hasRealPAM}`);
        // Check both new property names (assignedGenr) and legacy (_genr) for backward compatibility
        console.log(`  assignedGenr: "${player.assignedGenr}", assignedSknt: ${player.assignedSknt}, assignedRace: ${player.assignedRace}`);
      }

      // Skip only if player has real face WITH a real PAM (face scan will be used)
      if (!isGenericFace && hasRealPAM) {
        if (isDebugPlayer) {
          console.log(`  SKIPPED: Has real face with real PAM`);
        }
        skippedWithPAM++;
        continue;
      }

      // Process: generic faces OR real PIDs with no PAM OR players with generic PEPS
      // FIX: Also process players who have generic portrait names in PEPS
      if (!isGenericFace && !hasEmptyPEPS && !hasGenericPEPS) {
        if (isDebugPlayer) {
          console.log(`  SKIPPED: Not generic and has non-empty non-generic PEPS`);
        }
        skippedNotGeneric++;
        continue; // Has a real PAM value - skip
      }

      if (isDebugPlayer) {
        console.log(`  PROCESSING: Will update BLBM for this player`);
      }

      // Get BLBM fields
      const fields = blbmRec.fields || blbmRec._fields;
      if (!fields) continue;

      // Determine race from player data
      // Priority: assignedRace field (1-7 direct from CSV) > PID lookup > existing BLBM SKNT > default
      // NOTE: Check for new property names first, then legacy _race for backward compatibility
      let race;
      let raceSource = '';

      // First: Check for assignedRace field (set by generator from CSV or face picker)
      const playerRace = player.assignedRace ?? player._race;
      if (playerRace !== undefined && playerRace !== null && playerRace !== 0) {
        race = parseInt(playerRace);
        raceSource = 'assignedRace field';
        if (updatedCount < 5 || isDebugPlayer) {
          console.log(`[GenericFaceService] Using assignedRace=${race} for ${playerName}`);
        }
      } else {
        // Fallback: Try to get from PID lookup
        if (isDebugPlayer) {
          console.log(`[GenericFaceService] Looking up race for PID ${psxp}...`);
        }
        race = this.getRaceForPid(psxp);
        raceSource = race ? 'database lookup' : 'failed';

        // If still no race, try to use existing BLBM SKNT as hint
        if (!race) {
          const existingSknt = fields['SKNT']?.value ?? fields['SKNT']?._value;
          if (existingSknt && existingSknt >= 1 && existingSknt <= 7) {
            // SKNT 1-2 = white (race 1), SKNT 6-7 = black (race 7), SKNT 3-5 = mixed (race 5)
            if (existingSknt <= 2) {
              race = 1; // White
            } else if (existingSknt >= 6) {
              race = 7; // Black
            } else {
              race = 5; // Mixed
            }
            raceSource = `existing SKNT=${existingSknt}`;
            if (updatedCount < 5 || isDebugPlayer) {
              console.log(`[GenericFaceService] Using existing SKNT=${existingSknt} -> race=${race}`);
            }
          } else {
            // Last resort: Random based on NFL demographics (70% black, 25% white, 5% other)
            const rand = Math.random();
            race = rand < 0.70 ? 7 : (rand < 0.95 ? 1 : 5);
            raceSource = 'random (70% black default)';
            if (updatedCount < 5 || isDebugPlayer) {
              console.log(`[GenericFaceService] No race info, using random race=${race}`);
            }
          }
        }
      }

      if (isDebugPlayer) {
        console.log(`  Race determined: ${race} from ${raceSource}`);
      }

      // Get GENR and SKNT - priority:
      // 1. assignedGenr/assignedSknt (user explicitly selected via face picker)
      // 2. Existing BLBM GENR/SKNT (preserve previously saved face)
      // 3. PEPS contains generic portrait name (e.g., "plpo_generic_6_B_G_03") -> convert to GENR
      // 4. Derive from race (random) - ONLY if no existing face
      let finalGenr, finalSknt;

      // ZERO: Check existing BLBM GENR first - we may want to preserve it
      const existingGenr = fields['GENR']?.value ?? fields['GENR']?._value;
      const existingSknt = fields['SKNT']?.value ?? fields['SKNT']?._value;
      const hasValidExistingGenr = existingGenr && typeof existingGenr === 'string' &&
                                    existingGenr.startsWith('gen_') && isValidGenr(existingGenr);

      // FIRST: Check for explicit assignedGenr/assignedSknt (user selected via face picker)
      const playerGenr = player.assignedGenr ?? player._genr;
      const playerSknt = player.assignedSknt ?? player._sknt;

      // DEBUG: Log assignedGenr status for first 5 players and debug players
      if (isDebugPlayer || i < 5) {
        console.log(`[GenericFaceService] Player ${i} ${playerName}: assignedGenr="${player.assignedGenr}", assignedSknt=${player.assignedSknt}, _genr="${player._genr}", _sknt=${player._sknt}`);
        console.log(`[GenericFaceService]   -> resolved playerGenr="${playerGenr}", playerSknt=${playerSknt}`);
      }

      if (playerGenr && playerSknt !== undefined && playerSknt !== null) {
        if (isValidGenr(playerGenr)) {
          finalGenr = playerGenr;
          finalSknt = playerSknt;
          if (isDebugPlayer || updatedCount < 5) {
            console.log(`[GenericFaceService] ✓ Using explicit assignedGenr="${finalGenr}", assignedSknt=${finalSknt} for ${playerName}`);
          }
        } else {
          finalSknt = playerSknt;
          finalGenr = getRandomGenrFromCatalog(finalSknt);
          if (!finalGenr) {
            finalGenr = this.getGenrForSknt(finalSknt);
          }
          if (isDebugPlayer || updatedCount < 5) {
            console.log(`[GenericFaceService] ⚠ INVALID assignedGenr="${playerGenr}" - using random: "${finalGenr}" for ${playerName}`);
          }
        }
      }
      // SECOND: Preserve existing BLBM GENR if valid (game already has a face assigned)
      else if (hasValidExistingGenr && existingSknt >= 1 && existingSknt <= 7) {
        finalGenr = existingGenr;
        finalSknt = existingSknt;
        if (isDebugPlayer || updatedCount < 5) {
          console.log(`[GenericFaceService] ✓ Preserving existing BLBM GENR="${finalGenr}", SKNT=${finalSknt} for ${playerName}`);
        }
        // Still need to update GNHD even if preserving GENR
      }
      // THIRD: Check if PEPS contains a generic portrait/GENR value
      else if (hasGenericPEPS && peps) {
        let derivedGenr = peps;
        let derivedSknt = null;

        // Handle different PEPS formats:
        // 1. "plpo_generic_X_Y_Z_NNN" -> convert to "gen_X_Y_Z_NNN"
        // 2. "gen_X_Y_Z_NNN" -> use directly (already a valid GENR)
        if (peps.startsWith('plpo_generic_')) {
          derivedGenr = peps.replace('plpo_generic_', 'gen_');
          const skntMatch = peps.match(/generic_(\d+)/);
          derivedSknt = skntMatch ? parseInt(skntMatch[1]) : null;
        } else if (peps.startsWith('gen_')) {
          // Already a valid GENR format like "gen_7_H_G_009"
          // Extract skin tone from the first number after "gen_"
          const skntMatch = peps.match(/^gen_(\d+)/);
          derivedSknt = skntMatch ? parseInt(skntMatch[1]) : null;
          derivedGenr = peps; // Use as-is
        }

        // Validate the derived GENR
        if (isValidGenr(derivedGenr) && derivedSknt) {
          finalGenr = derivedGenr;
          finalSknt = derivedSknt;
          if (isDebugPlayer || updatedCount < 5) {
            console.log(`[GenericFaceService] ✓ Using PEPS="${peps}" as GENR="${finalGenr}", SKNT=${finalSknt} for ${playerName}`);
          }
        } else if (derivedSknt) {
          // PEPS has skin tone but invalid GENR - keep skin tone, get valid GENR for that tone
          finalSknt = derivedSknt;
          finalGenr = getRandomGenrFromCatalog(finalSknt);
          if (!finalGenr) {
            finalGenr = this.getGenrForSknt(finalSknt);
          }
          if (isDebugPlayer || updatedCount < 5) {
            console.log(`[GenericFaceService] ⚠ PEPS="${peps}" invalid, using random GENR="${finalGenr}" for same SKNT=${finalSknt} for ${playerName}`);
          }
        } else {
          // No valid skin tone found - derive from race
          finalSknt = this.getSkntForRace(race);
          finalGenr = getRandomGenrFromCatalog(finalSknt);
          if (!finalGenr) {
            finalGenr = this.getGenrForSknt(finalSknt);
          }
          if (isDebugPlayer || updatedCount < 5) {
            console.log(`[GenericFaceService] ⚠ PEPS="${peps}" -> no valid SKNT, using race-based: GENR="${finalGenr}", SKNT=${finalSknt} for ${playerName}`);
          }
        }
      }
      // FOURTH: No face found anywhere - derive from race (random selection)
      // This should only happen for brand new players with no face assigned
      else {
        finalSknt = this.getSkntForRace(race);
        finalGenr = getRandomGenrFromCatalog(finalSknt);
        if (!finalGenr) {
          finalGenr = this.getGenrForSknt(finalSknt);
        }
        if (isDebugPlayer || updatedCount < 5) {
          console.log(`[GenericFaceService] ✗ No existing face for ${playerName}, deriving from race=${race} -> GENR=${finalGenr}`);
        }
      }

      if (updatedCount < 10) {
        const playerName = `${player.PFNA || ''} ${player.PLNA || ''}`.trim();
        console.log(`[GenericFaceService] ${playerName}: PID=${psxp}, PLPL=${plpl} -> race=${race} -> GENR=${finalGenr}, SKNT=${finalSknt}`);
      }

      // CRITICAL VALIDATION: Ensure GENR first digit matches SKNT
      // The game extracts skin tone from the first character of GENR (e.g., "gen_7_B_N_019" -> 7)
      // If there's a mismatch, the player's skin color will be inconsistent
      if (finalGenr && finalSknt) {
        const genrMatch = finalGenr.match(/^gen_(\d+)/);
        const genrSkinTone = genrMatch ? parseInt(genrMatch[1]) : null;
        if (genrSkinTone !== null && genrSkinTone !== finalSknt) {
          console.warn(`[GenericFaceService] MISMATCH DETECTED for ${playerName}: GENR skin tone=${genrSkinTone}, SKNT=${finalSknt} - forcing SKNT to match GENR`);
          // Force SKNT to match GENR first digit - the GENR determines visual appearance
          finalSknt = genrSkinTone;
        }
      }

      // Update GENR
      let genrUpdated = false;
      if (fields['GENR']) {
        if (fields['GENR'].value !== undefined) {
          const oldGenr = fields['GENR'].value;
          fields['GENR'].value = finalGenr;
          genrUpdated = true;
          if (isDebugPlayer) {
            console.log(`  GENR: "${oldGenr}" -> "${finalGenr}" (via .value)`);
          }
        } else if (fields['GENR']._value !== undefined) {
          const oldGenr = fields['GENR']._value;
          fields['GENR']._value = finalGenr;
          genrUpdated = true;
          if (isDebugPlayer) {
            console.log(`  GENR: "${oldGenr}" -> "${finalGenr}" (via ._value)`);
          }
        }
      } else if (isDebugPlayer) {
        console.log(`  WARNING: No GENR field found!`);
      }

      // Update SKNT
      let skntUpdated = false;
      if (fields['SKNT']) {
        if (fields['SKNT'].value !== undefined) {
          const oldSknt = fields['SKNT'].value;
          fields['SKNT'].value = finalSknt;
          skntUpdated = true;
          if (isDebugPlayer) {
            console.log(`  SKNT: ${oldSknt} -> ${finalSknt} (via .value)`);
          }
        } else if (fields['SKNT']._value !== undefined) {
          const oldSknt = fields['SKNT']._value;
          fields['SKNT']._value = finalSknt;
          skntUpdated = true;
          if (isDebugPlayer) {
            console.log(`  SKNT: ${oldSknt} -> ${finalSknt} (via ._value)`);
          }
        }
      } else if (isDebugPlayer) {
        console.log(`  WARNING: No SKNT field found!`);
      }

      // GNHD (Generic Head Number) - MUST BE 0 FOR GENERIC FACES!
      // From ROSTER-HEADTEST dump: All 264 working generic faces have GNHD=0
      // Real players have GNHD=non-zero (matches their PID)
      // When GNHD=0 + CNID=0, the game uses GENR to determine the face
      let gnhdUpdated = false;
      const targetGnhd = 0; // ALWAYS 0 for generic faces!
      if (fields['GNHD']) {
        if (fields['GNHD'].value !== undefined) {
          const oldGnhd = fields['GNHD'].value;
          if (oldGnhd !== targetGnhd) {
            fields['GNHD'].value = targetGnhd;
            gnhdUpdated = true;
            if (isDebugPlayer || updatedCount < 5) {
              console.log(`  GNHD: ${oldGnhd} -> ${targetGnhd} (MUST be 0 for generic faces)`);
            }
          }
        } else if (fields['GNHD']._value !== undefined) {
          const oldGnhd = fields['GNHD']._value;
          if (oldGnhd !== targetGnhd) {
            fields['GNHD']._value = targetGnhd;
            gnhdUpdated = true;
            if (isDebugPlayer || updatedCount < 5) {
              console.log(`  GNHD: ${oldGnhd} -> ${targetGnhd} (MUST be 0 for generic faces)`);
            }
          }
        }
      }

      // CRITICAL FIX: For generic faces, CNID MUST be 0!
      // When CNID=0, the game uses the GENR field to determine face appearance.
      // When CNID!=0, the game tries to load a real player face asset (which fails for generic players).
      // ASNM should be empty for generic faces.
      // This was verified by analyzing ROSTER-GENHEADTEST where all 264 working generic faces had CNID=0.
      let cnidUpdated = false;
      let asnmUpdated = false;

      // Set CNID to 0 for generic faces (this is required!)
      if (fields['CNID']) {
        if (fields['CNID'].value !== undefined) {
          const oldCnid = fields['CNID'].value;
          if (oldCnid !== 0) {
            fields['CNID'].value = 0;
            cnidUpdated = true;
            if (isDebugPlayer || updatedCount < 5) {
              console.log(`  CNID: ${oldCnid} -> 0 (CRITICAL: must be 0 for GENR-based faces)`);
            }
          }
        } else if (fields['CNID']._value !== undefined) {
          const oldCnid = fields['CNID']._value;
          if (oldCnid !== 0) {
            fields['CNID']._value = 0;
            cnidUpdated = true;
            if (isDebugPlayer || updatedCount < 5) {
              console.log(`  CNID: ${oldCnid} -> 0 (CRITICAL: must be 0 for GENR-based faces)`);
            }
          }
        }
      }

      // Clear ASNM for generic faces (should be empty when CNID=0)
      if (fields['ASNM']) {
        if (fields['ASNM'].value !== undefined) {
          const oldAsnm = fields['ASNM'].value;
          if (oldAsnm !== '') {
            fields['ASNM'].value = '';
            asnmUpdated = true;
            if (isDebugPlayer || updatedCount < 5) {
              console.log(`  ASNM: "${oldAsnm}" -> "" (empty for generic face)`);
            }
          }
        } else if (fields['ASNM']._value !== undefined) {
          const oldAsnm = fields['ASNM']._value;
          if (oldAsnm !== '') {
            fields['ASNM']._value = '';
            asnmUpdated = true;
            if (isDebugPlayer || updatedCount < 5) {
              console.log(`  ASNM: "${oldAsnm}" -> "" (empty for generic face)`);
            }
          }
        }
      }

      // CRITICAL: Update BTYP (body type) in BLBM - this is what the game actually uses!
      // PCBT in PLAY table is NOT read by the game for body type
      // BTYP values: 0=Standard, 1=Thin, 2=Muscular, 3=Heavy, 4=Lean
      let btypUpdated = false;
      const pcbt = player.PCBT; // Declare outside block so it's available for WLBS logging too
      if (fields['BTYP']) {
        if (pcbt !== undefined && pcbt !== null) {
          if (fields['BTYP'].value !== undefined) {
            const oldBtyp = fields['BTYP'].value;
            if (oldBtyp !== pcbt) {
              fields['BTYP'].value = pcbt;
              btypUpdated = true;
              if (isDebugPlayer || updatedCount < 5) {
                console.log(`  BTYP: ${oldBtyp} -> ${pcbt} (synced from PCBT)`);
              }
            }
          } else if (fields['BTYP']._value !== undefined) {
            const oldBtyp = fields['BTYP']._value;
            if (oldBtyp !== pcbt) {
              fields['BTYP']._value = pcbt;
              btypUpdated = true;
              if (isDebugPlayer || updatedCount < 5) {
                console.log(`  BTYP: ${oldBtyp} -> ${pcbt} (synced from PCBT)`);
              }
            }
          }
        }
      }

      // Also update WLBS (body weight/size visual) - WLBS is the actual weight in pounds
      // WLBS controls the body size appearance in-game
      // PWGT is stored as (actual_weight - 160), so actual weight = PWGT + 160
      let wlbsUpdated = false;
      if (fields['WLBS']) {
        // Calculate actual weight from PWGT
        const pwgt = player.PWGT;
        let targetWlbs = null;

        if (pwgt !== undefined && pwgt !== null) {
          // Convert PWGT offset back to actual weight
          targetWlbs = pwgt + 160;
        } else {
          // Default to 200 lbs if no weight data
          targetWlbs = 200;
        }

        if (targetWlbs !== null) {
          if (fields['WLBS'].value !== undefined) {
            const oldWlbs = fields['WLBS'].value;
            if (oldWlbs !== targetWlbs) {
              fields['WLBS'].value = targetWlbs;
              wlbsUpdated = true;
              if (isDebugPlayer || updatedCount < 5) {
                console.log(`  WLBS: ${oldWlbs} -> ${targetWlbs} (PCBT=${pcbt})`);
              }
            }
          } else if (fields['WLBS']._value !== undefined) {
            const oldWlbs = fields['WLBS']._value;
            if (oldWlbs !== targetWlbs) {
              fields['WLBS']._value = targetWlbs;
              wlbsUpdated = true;
              if (isDebugPlayer || updatedCount < 5) {
                console.log(`  WLBS: ${oldWlbs} -> ${targetWlbs} (PCBT=${pcbt})`);
              }
            }
          }
        }
      }

      if (isDebugPlayer) {
        console.log(`  BLBM UPDATE COMPLETE: GENR=${genrUpdated}, SKNT=${skntUpdated}, GNHD=${gnhdUpdated}, CNID=${cnidUpdated}, ASNM=${asnmUpdated}, WLBS=${wlbsUpdated}`);
      }

      updatedCount++;

      if (updatedCount <= 5) {
        console.log(`[GenericFaceService] Updated ${playerName} (index ${i}): GENR=${finalGenr}, SKNT=${finalSknt}, GNHD=${targetGnhd}, CNID=0`);
      }
    }

    console.log(`[GenericFaceService] ===== BLBM UPDATE COMPLETE =====`);
    console.log(`[GenericFaceService] Updated ${updatedCount} generic face players (CNID=0, ASNM=empty)`);
    console.log(`[GenericFaceService] Skipped with PAM: ${skippedWithPAM}, Skipped not generic: ${skippedNotGeneric}`);
    console.log(`[GenericFaceService] BLBM not found by name: ${blbmNotFound}`);

    return updatedCount;
  }

  /**
   * Sync BTYP (body type) in BLBM for ALL players from PCBT in PLAY
   * This ensures the game reads the correct body type (game uses BTYP, not PCBT)
   * CRITICAL: Uses name-based matching since PLAY and BLBM are NOT aligned by index!
   * @param file - The loaded roster file object
   * @param players - Array of player data from PLAY table
   * @returns Number of players updated
   */
  async syncBodyTypeForAllPlayers(file, players) {
    console.log('[GenericFaceService] ===== BTYP SYNC START (ALL PLAYERS) =====');

    const blob = file.BLOB?.records?.[0];
    if (!blob) {
      console.log('[GenericFaceService] No BLOB table found');
      return 0;
    }

    const blbm = blob.fields?.['BLBM']?.value;
    if (!blbm || !blbm._records) {
      console.log('[GenericFaceService] No BLBM table found in BLOB');
      return 0;
    }

    // CRITICAL FIX: Build name-based lookup (PLAY and BLBM are NOT aligned by index!)
    const blbmByName = new Map();
    for (let bi = 0; bi < blbm._records.length; bi++) {
      const rec = blbm._records[bi];
      const fields = rec.fields || rec._fields;
      const firstName = (fields?.['CFNM']?.value ?? fields?.['CFNM']?._value ?? '').trim();
      const lastName = (fields?.['CLNM']?.value ?? fields?.['CLNM']?._value ?? '').trim();
      const fullName = `${firstName}|${lastName}`.toLowerCase();
      if (!blbmByName.has(fullName)) {
        blbmByName.set(fullName, []);
      }
      blbmByName.get(fullName).push({ index: bi, record: rec });
    }

    console.log(`[GenericFaceService] Syncing BTYP for ${players.length} players (BLBM lookup: ${blbmByName.size} names)`);

    let updatedCount = 0;
    let notFoundCount = 0;

    for (let i = 0; i < players.length; i++) {
      const player = players[i];
      const playerFirst = (player.PFNA || '').trim();
      const playerLast = (player.PLNA || '').trim();
      const playerFullName = `${playerFirst}|${playerLast}`.toLowerCase();

      // Skip empty slots
      if (!playerFirst && !playerLast) continue;

      // Find matching BLBM record by name
      const blbmMatches = blbmByName.get(playerFullName);
      if (!blbmMatches || blbmMatches.length === 0) {
        notFoundCount++;
        continue;
      }

      const { record: blbmRec } = blbmMatches[0];
      const fields = blbmRec.fields || blbmRec._fields;

      if (!fields) continue;

      const pcbt = player.PCBT;
      if (pcbt === undefined || pcbt === null) continue;

      let updated = false;
      const playerName = `${playerFirst} ${playerLast}`.trim();

      // Update BTYP to match PCBT (create field if it doesn't exist)
      if (fields['BTYP']) {
        const currentBtyp = fields['BTYP'].value;
        if (currentBtyp !== pcbt) {
          fields['BTYP'].value = pcbt;
          updated = true;
        }
      } else if (pcbt !== 0) {
        // BTYP field doesn't exist - need to CREATE it for non-Standard body types
        // Players without BTYP default to Standard (0) in-game, so only add if non-standard
        try {
          const newField = new TDB2Field();
          newField.key = 'BTYP';
          newField.type = FIELD_TYPE_INT;
          newField.rawKey = Buffer.from([...utilService.compress6BitString('BTYP'), FIELD_TYPE_INT]);
          newField.value = pcbt;
          newField._isChanged = true;

          // Add to the record's fields
          fields['BTYP'] = newField;
          updated = true;

          if (updatedCount < 10) {
            console.log(`[GenericFaceService] ${playerName}: CREATED BTYP field with value ${pcbt}`);
          }
        } catch (e) {
          console.error(`[GenericFaceService] Failed to create BTYP field for ${playerName}:`, e.message);
        }
      }

      // CRITICAL: Update WLBS (weight/body size) - this controls the in-game body visual!
      // WLBS should be the actual weight (PWGT + 160)
      if (fields['WLBS']) {
        // PWGT is stored as (actual_weight - 160), so actual weight = PWGT + 160
        const pwgt = player.PWGT;
        if (pwgt !== undefined && pwgt !== null) {
          const actualWeight = pwgt + 160; // Convert to real weight
          const currentWlbs = fields['WLBS'].value;

          if (currentWlbs !== actualWeight) {
            fields['WLBS'].value = actualWeight;
            updated = true;
            if (updatedCount < 10) {
              console.log(`[GenericFaceService] ${playerName}: WLBS ${currentWlbs} -> ${actualWeight} (PWGT=${pwgt})`);
            }
          }
        }
      }

      // CRITICAL: Update ITAN in LOUT→PINS→SLOT=129 - this controls the actual 3D body mesh!
      // Body type names: Standard_BodyType, Thin_BodyType, Muscular_BodyType, Heavy_BodyType, Lean_BodyType
      const BODY_TYPE_NAMES = ['Standard', 'Thin', 'Muscular', 'Heavy', 'Lean'];
      const bodyTypeName = BODY_TYPE_NAMES[pcbt] || 'Standard';
      const targetITAN = `${bodyTypeName}_BodyType`;

      try {
        const lout = fields['LOUT']?.value;
        if (lout && lout._records) {
          // Find LOUT record with body type PINS (typically LDTY=0)
          for (const loutRec of lout._records) {
            const loutFields = loutRec?.fields || loutRec?._fields;
            const pins = loutFields?.PINS?.value;

            if (pins && pins._records) {
              // Find PINS record with SLOT=129 (body type slot)
              for (const pinRec of pins._records) {
                const pinFields = pinRec?.fields || pinRec?._fields;
                const slot = pinFields?.SLOT?.value ?? pinFields?.SLOT?._value;

                if (slot === 129) {
                  const currentITAN = pinFields?.ITAN?.value ?? pinFields?.ITAN?._value;

                  if (currentITAN !== targetITAN) {
                    // Update ITAN to new body type
                    if (pinFields?.ITAN) {
                      pinFields.ITAN.value = targetITAN;
                      pinFields.ITAN._isChanged = true;
                      updated = true;

                      if (updatedCount < 10) {
                        console.log(`[GenericFaceService] ${playerName}: ITAN ${currentITAN} -> ${targetITAN}`);
                      }
                    }
                  }
                  break; // Found SLOT=129, done with this player
                }
              }
            }
          }
        }
      } catch (e) {
        console.error(`[GenericFaceService] Failed to update ITAN for ${playerName}:`, e.message);
      }

      if (updated) {
        updatedCount++;
      }
    }

    console.log(`[GenericFaceService] ===== BTYP SYNC COMPLETE: ${updatedCount} players updated, ${notFoundCount} not found in BLBM =====`);
    return updatedCount;
  }

  /**
   * Sync SKNT (skin tone) in BLBM for ALL players
   * For GENERIC faces (PLPL=0): SKNT MUST match GENR first digit
   * For REAL faces (PLPL=100): SKNT can come from PLRC
   * CRITICAL: Uses name-based matching since PLAY and BLBM are NOT aligned by index!
   * @param file - The loaded roster file object
   * @param players - Array of player data from PLAY table
   * @returns Number of players updated
   */
  async syncSkinToneForAllPlayers(file, players) {
    console.log('[GenericFaceService] ===== SKNT SYNC START (ALL PLAYERS) =====');

    const blob = file.BLOB?.records?.[0];
    if (!blob) {
      console.log('[GenericFaceService] No BLOB table found');
      return 0;
    }

    const blbm = blob.fields?.['BLBM']?.value;
    if (!blbm || !blbm._records) {
      console.log('[GenericFaceService] No BLBM table found in BLOB');
      return 0;
    }

    // CRITICAL FIX: Build name-based lookup (PLAY and BLBM are NOT aligned by index!)
    const blbmByName = new Map();
    for (let bi = 0; bi < blbm._records.length; bi++) {
      const rec = blbm._records[bi];
      const fields = rec.fields || rec._fields;
      const firstName = (fields?.['CFNM']?.value ?? fields?.['CFNM']?._value ?? '').trim();
      const lastName = (fields?.['CLNM']?.value ?? fields?.['CLNM']?._value ?? '').trim();
      const fullName = `${firstName}|${lastName}`.toLowerCase();
      if (!blbmByName.has(fullName)) {
        blbmByName.set(fullName, []);
      }
      blbmByName.get(fullName).push({ index: bi, record: rec });
    }

    console.log(`[GenericFaceService] Syncing SKNT for ${players.length} players (BLBM lookup: ${blbmByName.size} names)`);

    let updatedCount = 0;
    let genericFixed = 0;
    let notFoundCount = 0;

    for (let i = 0; i < players.length; i++) {
      const player = players[i];
      const playerFirst = (player.PFNA || '').trim();
      const playerLast = (player.PLNA || '').trim();
      const playerFullName = `${playerFirst}|${playerLast}`.toLowerCase();

      // Skip empty slots
      if (!playerFirst && !playerLast) continue;

      // Find matching BLBM record by name
      const blbmMatches = blbmByName.get(playerFullName);
      if (!blbmMatches || blbmMatches.length === 0) {
        notFoundCount++;
        continue;
      }

      const { record: blbmRec } = blbmMatches[0];
      const fields = blbmRec.fields || blbmRec._fields;

      if (!fields) continue;

      const playerName = `${playerFirst} ${playerLast}`.trim();

      // Determine target SKNT
      // CRITICAL FIX: Check GENR FIRST, before checking PLPL!
      // If GENR has a valid value, SKNT MUST match it regardless of PLPL.
      // This fixes the issue where historical players may have PLPL!=0 but still use generic faces.
      let targetSknt = null;
      let skntSource = null;

      // FIRST: Check if GENR field has a valid value - this is authoritative!
      const genr = fields['GENR']?.value ?? fields['GENR']?._value;
      if (genr && typeof genr === 'string' && genr.startsWith('gen_')) {
        const genrMatch = genr.match(/^gen_(\d+)/);
        if (genrMatch) {
          targetSknt = parseInt(genrMatch[1]);
          skntSource = 'GENR';
        }
      }

      // SECOND: If no GENR, check PEPS for generic face backup value
      if (targetSknt === null) {
        const peps = player.PEPS;
        if (peps && typeof peps === 'string' && peps.startsWith('gen_')) {
          const pepsMatch = peps.match(/^gen_(\d+)/);
          if (pepsMatch) {
            targetSknt = parseInt(pepsMatch[1]);
            skntSource = 'PEPS';
          }
        }
      }

      // THIRD: For real faces (no GENR), use PLRC
      // Only use PLRC if there's no valid GENR - GENR is authoritative for skin tone
      if (targetSknt === null) {
        const plrc = player.PLRC;
        if (plrc !== undefined && plrc !== null && plrc >= 1 && plrc <= 7) {
          targetSknt = plrc;
          skntSource = 'PLRC';
        }
      }

      // Skip if no valid target SKNT
      if (targetSknt === null || targetSknt < 1 || targetSknt > 7) continue;

      // Update SKNT (if SKNT field exists)
      if (fields['SKNT']) {
        const currentSknt = fields['SKNT'].value ?? fields['SKNT']._value;
        if (currentSknt !== targetSknt) {
          if (fields['SKNT'].value !== undefined) {
            fields['SKNT'].value = targetSknt;
          } else if (fields['SKNT']._value !== undefined) {
            fields['SKNT']._value = targetSknt;
          }
          updatedCount++;
          if (skntSource === 'GENR' || skntSource === 'PEPS') genericFixed++;
          if (updatedCount <= 10) {
            console.log(`[GenericFaceService] ${playerName}: SKNT ${currentSknt} -> ${targetSknt} (from-${skntSource})`);
          }
        }
      }
    }

    console.log(`[GenericFaceService] ===== SKNT SYNC COMPLETE: ${updatedCount} players updated (${genericFixed} generic faces fixed from GENR), ${notFoundCount} not found in BLBM =====`);
    return updatedCount;
  }

  /**
   * Sync PLRC (body skin in PLAY) from SKNT (face skin in BLBM) for generic face players
   * CRITICAL: PLRC controls body/arm skin, SKNT controls face skin
   * For generic faces, these MUST match or you get body/face skin mismatch!
   * @param file - The loaded roster file object
   * @param players - Array of player data from PLAY table (will be modified in place)
   * @returns Number of players updated
   */
  async syncBodySkinFromFaceSkin(file, players) {
    console.log('[GenericFaceService] ===== PLRC SYNC FROM BLBM.SKNT START =====');

    const blob = file.BLOB?.records?.[0];
    if (!blob) {
      console.log('[GenericFaceService] No BLOB table found');
      return 0;
    }

    const blbm = blob.fields?.['BLBM']?.value;
    if (!blbm || !blbm._records) {
      console.log('[GenericFaceService] No BLBM table found in BLOB');
      return 0;
    }

    // Build name-based lookup for BLBM records
    const blbmByName = new Map();
    for (let bi = 0; bi < blbm._records.length; bi++) {
      const rec = blbm._records[bi];
      const fields = rec.fields || rec._fields;
      const firstName = (fields?.['CFNM']?.value ?? fields?.['CFNM']?._value ?? '').trim();
      const lastName = (fields?.['CLNM']?.value ?? fields?.['CLNM']?._value ?? '').trim();
      const fullName = `${firstName}|${lastName}`.toLowerCase();
      if (!blbmByName.has(fullName)) {
        blbmByName.set(fullName, []);
      }
      blbmByName.get(fullName).push({ index: bi, record: rec });
    }

    console.log(`[GenericFaceService] Syncing PLRC for ${players.length} players (BLBM lookup: ${blbmByName.size} names)`);

    let updatedCount = 0;
    let notFoundCount = 0;

    for (let i = 0; i < players.length; i++) {
      const player = players[i];
      const playerFirst = (player.PFNA || '').trim();
      const playerLast = (player.PLNA || '').trim();
      const playerFullName = `${playerFirst}|${playerLast}`.toLowerCase();

      // Skip empty slots
      if (!playerFirst && !playerLast) continue;

      // Only sync for generic face players (PLPL = 0)
      const plpl = player.PLPL;
      const isGenericFace = plpl === 0 || plpl === '0';
      if (!isGenericFace) continue;

      // Find matching BLBM record by name
      const blbmMatches = blbmByName.get(playerFullName);
      if (!blbmMatches || blbmMatches.length === 0) {
        notFoundCount++;
        continue;
      }

      const { record: blbmRec } = blbmMatches[0];
      const fields = blbmRec.fields || blbmRec._fields;
      if (!fields) continue;

      const playerName = `${playerFirst} ${playerLast}`.trim();

      // DEBUG: Log for test players (Bears QBs from 1970s)
      const isTestPlayer = playerName.toLowerCase().includes('douglass') ||
                           playerName.toLowerCase().includes('concannon') ||
                           playerName.toLowerCase() === 'ron smith' ||
                           playerName.toLowerCase().includes('kent nix');

      // Get SKNT from BLBM (this is the correct skin tone from GENR)
      let targetPlrc = null;

      // First try SKNT
      const sknt = fields['SKNT']?.value ?? fields['SKNT']?._value;
      const genr = fields['GENR']?.value ?? fields['GENR']?._value;

      if (isTestPlayer) {
        console.log(`[GenericFaceService] TEST PLAYER ${playerName}: BLBM.SKNT=${sknt}, BLBM.GENR="${genr}", player.PLRC=${player.PLRC}, player.assignedSknt=${player.assignedSknt}`);
      }

      if (sknt !== undefined && sknt !== null && sknt >= 1 && sknt <= 7) {
        targetPlrc = sknt;
      }

      // Fallback: Extract from GENR if SKNT not available
      if (targetPlrc === null) {
        if (genr && typeof genr === 'string' && genr.startsWith('gen_')) {
          const genrMatch = genr.match(/^gen_(\d+)/);
          if (genrMatch) {
            targetPlrc = parseInt(genrMatch[1]);
          }
        }
      }

      // Skip if no valid target
      if (targetPlrc === null || targetPlrc < 1 || targetPlrc > 7) {
        if (isTestPlayer) {
          console.log(`[GenericFaceService] TEST PLAYER ${playerName}: SKIPPED - no valid targetPlrc (${targetPlrc})`);
        }
        continue;
      }

      // Update PLRC in the players array (this will be written to PLAY table)
      const currentPlrc = player.PLRC;
      if (currentPlrc !== targetPlrc) {
        player.PLRC = targetPlrc;
        updatedCount++;
        if (updatedCount <= 10 || isTestPlayer) {
          console.log(`[GenericFaceService] ${playerName}: PLRC ${currentPlrc} -> ${targetPlrc} (from BLBM.SKNT=${sknt})`);
        }
      } else if (isTestPlayer) {
        console.log(`[GenericFaceService] TEST PLAYER ${playerName}: PLRC already matches (${currentPlrc} == ${targetPlrc})`);
      }
    }

    console.log(`[GenericFaceService] ===== PLRC SYNC COMPLETE: ${updatedCount} generic face players updated, ${notFoundCount} not found in BLBM =====`);
    return updatedCount;
  }

  /**
   * Sync player identity fields from PLAY to BLBM for ALL players
   * CRITICAL: BLBM records must have correct player data (name, jersey, height)
   * Otherwise the game shows wrong faces because BLBM data doesn't match the player
   * @param file - The loaded roster file object
   * @param players - Array of player data from PLAY table
   * @returns Number of players updated
   */
  async syncPlayerIdentityForAllPlayers(file, players) {
    console.log('[GenericFaceService] ===== PLAYER IDENTITY SYNC START (ALL PLAYERS) =====');

    const blob = file.BLOB?.records?.[0];
    if (!blob) {
      console.log('[GenericFaceService] No BLOB table found');
      return 0;
    }

    const blbm = blob.fields?.['BLBM']?.value;
    if (!blbm || !blbm._records) {
      console.log('[GenericFaceService] No BLBM table found in BLOB');
      return 0;
    }

    console.log(`[GenericFaceService] Syncing player identity for ${Math.min(players.length, blbm._records.length)} players`);

    let updatedCount = 0;

    for (let i = 0; i < players.length && i < blbm._records.length; i++) {
      const player = players[i];
      const blbmRec = blbm._records[i];
      const fields = blbmRec.fields || blbmRec._fields;

      if (!fields) continue;

      let updated = false;
      let nameChanged = false; // Track if player name changed (for GENR invalidation)
      const firstName = player.PFNA || '';
      const lastName = player.PLNA || '';
      const jerseyNum = player.PJEN;
      const heightInches = player.PHGT;
      const peps = player.PEPS || '';

      // CRITICAL FIX: Update BLBM record's .index to match player's PGID
      // The game links PLAY records to BLBM records by finding BLBM[].index === POID
      // POID is set to PGID in RosterParser, so BLBM.index MUST equal PGID
      // Without this, faces get assigned to wrong players because the game's lookup fails!
      const pgid = player.PGID;
      if (pgid !== undefined && pgid !== null && pgid > 0) {
        const oldIndex = blbmRec.index;
        if (oldIndex !== pgid) {
          blbmRec.index = pgid;
          updated = true;
          if (i < 10) {
            console.log(`[GenericFaceService] BLBM[${i}].index: ${oldIndex} -> ${pgid} (for ${firstName} ${lastName})`);
          }
        }
      }

      // Get current BLBM names before syncing
      const currentCfnm = fields['CFNM']?.value ?? fields['CFNM']?._value ?? '';
      const currentClnm = fields['CLNM']?.value ?? fields['CLNM']?._value ?? '';

      // Sync CFNM (first name in BLBM)
      if (fields['CFNM']) {
        if (currentCfnm !== firstName) {
          if (fields['CFNM'].value !== undefined) {
            fields['CFNM'].value = firstName;
          } else if (fields['CFNM']._value !== undefined) {
            fields['CFNM']._value = firstName;
          }
          updated = true;
          nameChanged = true;
        }
      }

      // Sync CLNM (last name in BLBM)
      if (fields['CLNM']) {
        if (currentClnm !== lastName) {
          if (fields['CLNM'].value !== undefined) {
            fields['CLNM'].value = lastName;
          } else if (fields['CLNM']._value !== undefined) {
            fields['CLNM']._value = lastName;
          }
          updated = true;
          nameChanged = true;
        }
      }

      // CRITICAL: If name changed, clear GENR so updateBLBMForGenericFaces will derive a new one
      // This prevents inheriting the previous player's face when indices shift
      if (nameChanged && fields['GENR']) {
        const oldGenr = fields['GENR'].value ?? fields['GENR']._value;
        if (oldGenr && oldGenr !== '') {
          if (fields['GENR'].value !== undefined) {
            fields['GENR'].value = '';
          } else if (fields['GENR']._value !== undefined) {
            fields['GENR']._value = '';
          }
          if (i < 10) {
            console.log(`[GenericFaceService] Name changed at index ${i}: "${currentCfnm} ${currentClnm}" -> "${firstName} ${lastName}", cleared GENR="${oldGenr}"`);
          }
        }
      }

      // Sync CJNO (jersey number in BLBM)
      if (fields['CJNO'] && jerseyNum !== undefined && jerseyNum !== null) {
        const currentCjno = fields['CJNO'].value ?? fields['CJNO']._value;
        if (currentCjno !== jerseyNum) {
          if (fields['CJNO'].value !== undefined) {
            fields['CJNO'].value = jerseyNum;
          } else if (fields['CJNO']._value !== undefined) {
            fields['CJNO']._value = jerseyNum;
          }
          updated = true;
        }
      }

      // Sync HINC (height in BLBM)
      if (fields['HINC'] && heightInches !== undefined && heightInches !== null) {
        const currentHinc = fields['HINC'].value ?? fields['HINC']._value;
        if (currentHinc !== heightInches) {
          if (fields['HINC'].value !== undefined) {
            fields['HINC'].value = heightInches;
          } else if (fields['HINC']._value !== undefined) {
            fields['HINC']._value = heightInches;
          }
          updated = true;
        }
      }

      // Sync ASNM (asset name) - should match PEPS for consistent appearance
      // For generic faces, ASNM should be empty (CNID=0 uses GENR instead)
      // For real faces, ASNM should match PEPS
      if (fields['ASNM']) {
        const plpl = player.PLPL;
        const isGenericFace = plpl === 0 || plpl === '0';
        const targetAsnm = isGenericFace ? '' : peps;

        const currentAsnm = fields['ASNM'].value ?? fields['ASNM']._value;
        if (currentAsnm !== targetAsnm) {
          if (fields['ASNM'].value !== undefined) {
            fields['ASNM'].value = targetAsnm;
          } else if (fields['ASNM']._value !== undefined) {
            fields['ASNM']._value = targetAsnm;
          }
          updated = true;
        }
      }

      // Clear stale fields that game may have set
      // CJOV, CTAG, PSDB, USKT should be cleared/zeroed
      const clearFields = ['CJOV', 'CTAG'];
      for (const fieldName of clearFields) {
        if (fields[fieldName]) {
          const currentVal = fields[fieldName].value ?? fields[fieldName]._value;
          if (currentVal !== '' && currentVal !== undefined) {
            if (fields[fieldName].value !== undefined) {
              fields[fieldName].value = '';
            } else if (fields[fieldName]._value !== undefined) {
              fields[fieldName]._value = '';
            }
            updated = true;
          }
        }
      }

      const zeroFields = ['PSDB', 'USKT'];
      for (const fieldName of zeroFields) {
        if (fields[fieldName]) {
          const currentVal = fields[fieldName].value ?? fields[fieldName]._value;
          if (currentVal !== 0 && currentVal !== undefined) {
            if (fields[fieldName].value !== undefined) {
              fields[fieldName].value = 0;
            } else if (fields[fieldName]._value !== undefined) {
              fields[fieldName]._value = 0;
            }
            updated = true;
          }
        }
      }

      if (updated) {
        updatedCount++;
        if (updatedCount <= 10) {
          console.log(`[GenericFaceService] Synced identity for ${firstName} ${lastName} (index ${i}): jersey=${jerseyNum}, height=${heightInches}`);
        }
      }
    }

    console.log(`[GenericFaceService] ===== PLAYER IDENTITY SYNC COMPLETE: ${updatedCount} players updated =====`);
    return updatedCount;
  }
}

const genericFaceService = new GenericFaceService();

module.exports = {
  genericFaceService,
  getGenrForFacePickerNum,
  getFacePickerNumsForGenr,
  getGnhdForGenr
};
