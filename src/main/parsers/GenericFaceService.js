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

// Get electron app for path resolution in packaged builds
let app = null;
try {
  app = require('electron').app;
} catch (e) {
  // Not in electron context
}

// Helper to get app path (works in both dev and packaged builds)
function getAppBasePath() {
  if (app) {
    return app.getAppPath();
  }
  return process.cwd();
}

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

function loadFacePickerMapping() {
  if (facePickerToGenrMapping) return facePickerToGenrMapping;

  const appBase = getAppBasePath();
  const possiblePaths = [
    path.join(appBase, 'data', 'lookups', 'face-picker-to-genr.json'),
    path.join(appBase, '..', '..', 'data', 'lookups', 'face-picker-to-genr.json'),
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

  const appBase = getAppBasePath();
  const possiblePaths = [
    path.join(appBase, 'data', 'lookups', 'genr-to-face-picker.json'),
    path.join(appBase, '..', '..', 'data', 'lookups', 'genr-to-face-picker.json'),
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

  const appBase = getAppBasePath();
  const possiblePaths = [
    path.join(appBase, 'data', 'lookups', 'verified-portrait-genr.json'),
    path.join(appBase, '..', '..', 'data', 'lookups', 'verified-portrait-genr.json'),
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

  const appBase = getAppBasePath();
  const possiblePaths = [
    path.join(appBase, 'data', 'lookups', 'GENR_catalog.json'),
    path.join(appBase, '..', '..', 'data', 'lookups', 'GENR_catalog.json'),
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

  const appBase = getAppBasePath();
  const possiblePaths = [
    path.join(appBase, 'data', 'lookups', 'PID_Portrait_Mapping.csv'),
    path.join(appBase, '..', '..', 'data', 'lookups', 'PID_Portrait_Mapping.csv'),
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
    const appBase = getAppBasePath();
    const possiblePaths = [
      path.join(appBase, 'data', 'players.db'),
      path.join(appBase, '..', '..', 'data', 'players.db'),
      path.join(__dirname, '..', 'data', 'players.db'),
      path.join(__dirname, '..', '..', 'data', 'players.db'),
      path.join(process.cwd(), 'data', 'players.db'),
      path.join(process.cwd(), '.vite', 'build', 'data', 'players.db')
    ];

    console.log('[GenericFaceService] Searching for database...');
    console.log('[GenericFaceService] __dirname:', __dirname);
    console.log('[GenericFaceService] appBasePath:', appBase);

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
   * BLBM and PLAY tables are aligned by index - same position = same player
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

    // Process each player BY INDEX - BLBM[i] corresponds to PLAY[i]
    for (let i = 0; i < players.length && i < blbm._records.length; i++) {
      const player = players[i];
      const blbmRec = blbm._records[i];

      const peps = player.PEPS; // PAM value
      const psxp = player.PSXP; // PID value
      const plpl = player.PLPL; // Player picture level (0=generic, 100=real)
      const playerName = `${player.PFNA || ''} ${player.PLNA || ''}`.trim();

      // Debug: Log specific players we're interested in
      const isDebugPlayer = playerName.toLowerCase().includes('staubach') ||
                            playerName.toLowerCase().includes('danny white') ||
                            playerName.toLowerCase().includes('aikman');

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
      // 1. PEPS contains generic portrait name (e.g., "plpo_generic_6_B_G_03") -> convert to GENR
      // 2. assignedGenr/_genr properties (legacy)
      // 3. Derive from race (random)
      let finalGenr, finalSknt;

      // FIRST: Check if PEPS contains a generic portrait/GENR value
      if (hasGenericPEPS && peps) {
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
      // SECOND: Check for explicit assignedGenr/assignedSknt or legacy _genr/_sknt
      else {
        const playerGenr = player.assignedGenr ?? player._genr;
        const playerSknt = player.assignedSknt ?? player._sknt;

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
        } else {
          // THIRD: No explicit values - derive from race (random selection)
          finalSknt = this.getSkntForRace(race);
          finalGenr = getRandomGenrFromCatalog(finalSknt);
          if (!finalGenr) {
            finalGenr = this.getGenrForSknt(finalSknt);
          }
          if (isDebugPlayer || updatedCount < 5) {
            console.log(`[GenericFaceService] ✗ No PEPS/assignedGenr for ${playerName}, deriving from race=${race} -> GENR=${finalGenr}`);
          }
        }
      }

      if (updatedCount < 10) {
        const playerName = `${player.PFNA || ''} ${player.PLNA || ''}`.trim();
        console.log(`[GenericFaceService] ${playerName}: PID=${psxp}, PLPL=${plpl} -> race=${race} -> GENR=${finalGenr}, SKNT=${finalSknt}`);
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

      // GNHD (Generic Head Number) should be 0 when CNID=0
      // When CNID=0, the game uses GENR to determine face, not GNHD
      // Verified by ROSTER-GENHEADTEST: all 264 faces had GNHD=0
      let gnhdUpdated = false;
      if (fields['GNHD']) {
        if (fields['GNHD'].value !== undefined) {
          const oldGnhd = fields['GNHD'].value;
          if (oldGnhd !== 0) {
            fields['GNHD'].value = 0;
            gnhdUpdated = true;
            if (isDebugPlayer || updatedCount < 5) {
              console.log(`  GNHD: ${oldGnhd} -> 0 (must be 0 when CNID=0)`);
            }
          }
        } else if (fields['GNHD']._value !== undefined) {
          const oldGnhd = fields['GNHD']._value;
          if (oldGnhd !== 0) {
            fields['GNHD']._value = 0;
            gnhdUpdated = true;
            if (isDebugPlayer || updatedCount < 5) {
              console.log(`  GNHD: ${oldGnhd} -> 0 (must be 0 when CNID=0)`);
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
      if (fields['BTYP']) {
        const pcbt = player.PCBT;
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

      // Also update WLBS (body weight/size visual) based on PCBT
      // WLBS controls the body size appearance in-game
      // PCBT values: 0=Standard, 1=Thin, 2=Muscular, 3=Heavy, 4=Lean
      let wlbsUpdated = false;
      if (fields['WLBS']) {
        const pcbt = player.PCBT;
        let targetWlbs = null;

        // Map PCBT to WLBS ranges (based on official roster analysis)
        // Lower WLBS = thinner body, Higher WLBS = heavier body
        switch (pcbt) {
          case 0: // Standard - use player weight or default
            targetWlbs = player.PWGT ? Math.round(player.PWGT * 1.5) + 100 : 150;
            break;
          case 1: // Thin
            targetWlbs = 80;
            break;
          case 2: // Muscular
            targetWlbs = 200;
            break;
          case 3: // Heavy
            targetWlbs = 280;
            break;
          case 4: // Lean - athletic slim build, between Thin and Muscular
            targetWlbs = 120;
            break;
          default:
            targetWlbs = null;
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
        console.log(`[GenericFaceService] Updated ${playerName} (index ${i}): GENR=${finalGenr}, SKNT=${finalSknt}, CNID=0`);
      }
    }

    console.log(`[GenericFaceService] ===== BLBM UPDATE COMPLETE =====`);
    console.log(`[GenericFaceService] Updated ${updatedCount} generic face players (CNID=0, ASNM=empty)`);
    console.log(`[GenericFaceService] Skipped with PAM: ${skippedWithPAM}, Skipped not generic: ${skippedNotGeneric}`);

    return updatedCount;
  }

  /**
   * Sync BTYP (body type) in BLBM for ALL players from PCBT in PLAY
   * This ensures the game reads the correct body type (game uses BTYP, not PCBT)
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

    console.log(`[GenericFaceService] Syncing BTYP for ${Math.min(players.length, blbm._records.length)} players`);

    let updatedCount = 0;

    for (let i = 0; i < players.length && i < blbm._records.length; i++) {
      const player = players[i];
      const blbmRec = blbm._records[i];
      const fields = blbmRec.fields || blbmRec._fields;

      if (!fields) continue;

      const pcbt = player.PCBT;
      if (pcbt === undefined || pcbt === null) continue;

      let updated = false;
      const playerName = `${player.PFNA || ''} ${player.PLNA || ''}`.trim();

      // Update BTYP to match PCBT (if BTYP field exists)
      if (fields['BTYP']) {
        const currentBtyp = fields['BTYP'].value;
        if (currentBtyp !== pcbt) {
          fields['BTYP'].value = pcbt;
          updated = true;
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

      if (updated) {
        updatedCount++;
      }
    }

    console.log(`[GenericFaceService] ===== BTYP SYNC COMPLETE: ${updatedCount} players updated =====`);
    return updatedCount;
  }

  /**
   * Sync SKNT (skin tone) in BLBM for ALL players from PLRC in PLAY
   * This ensures the game reads the correct skin tone (game uses SKNT in BLBM)
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

    console.log(`[GenericFaceService] Syncing SKNT for ${Math.min(players.length, blbm._records.length)} players`);

    let updatedCount = 0;

    for (let i = 0; i < players.length && i < blbm._records.length; i++) {
      const player = players[i];
      const blbmRec = blbm._records[i];
      const fields = blbmRec.fields || blbmRec._fields;

      if (!fields) continue;

      const plrc = player.PLRC;
      // Validate PLRC is in range 1-7
      if (plrc === undefined || plrc === null || plrc < 1 || plrc > 7) continue;

      const playerName = `${player.PFNA || ''} ${player.PLNA || ''}`.trim();

      // Update SKNT to match PLRC (if SKNT field exists)
      if (fields['SKNT']) {
        const currentSknt = fields['SKNT'].value ?? fields['SKNT']._value;
        if (currentSknt !== plrc) {
          if (fields['SKNT'].value !== undefined) {
            fields['SKNT'].value = plrc;
          } else if (fields['SKNT']._value !== undefined) {
            fields['SKNT']._value = plrc;
          }
          updatedCount++;
          if (updatedCount <= 10) {
            console.log(`[GenericFaceService] ${playerName}: SKNT ${currentSknt} -> ${plrc}`);
          }
        }
      }
    }

    console.log(`[GenericFaceService] ===== SKNT SYNC COMPLETE: ${updatedCount} players updated =====`);
    return updatedCount;
  }
}

const genericFaceService = new GenericFaceService();

module.exports = {
  genericFaceService,
  getGenrForFacePickerNum,
  getFacePickerNumsForGenr
};
