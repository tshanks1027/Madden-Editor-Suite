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

console.log('[GenericFaceService] Module loading...');

// Database will be loaded lazily on first use
let db = null;
let dbInitialized = false;

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

    console.log(`[GenericFaceService] BLBM has ${blbm._records.length} records, processing ${players.length} players`);

    // Log first BLBM record structure to understand field names
    if (blbm._records.length > 0) {
      const firstRec = blbm._records[0];
      const fields = firstRec.fields || firstRec._fields;
      console.log('[GenericFaceService] BLBM record structure:', Object.keys(fields || {}));
      console.log('[GenericFaceService] GENR field:', fields?.['GENR']);
      console.log('[GenericFaceService] SKNT field:', fields?.['SKNT']);
    }

    let updatedCount = 0;
    let skippedNoRace = 0;
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
      const isGenericFace = plpl === 0 || plpl === '0';
      const hasEmptyPEPS = !peps || peps === '' || peps === '0' || peps === 0;
      const hasRealPAM = peps && typeof peps === 'string' && peps.length > 0 && !peps.startsWith('gen_');

      if (isDebugPlayer) {
        console.log(`  isGenericFace: ${isGenericFace}, hasEmptyPEPS: ${hasEmptyPEPS}, hasRealPAM: ${hasRealPAM}`);
      }

      // Skip only if player has real face WITH a real PAM (face scan will be used)
      if (!isGenericFace && hasRealPAM) {
        if (isDebugPlayer) {
          console.log(`  SKIPPED: Has real face with real PAM`);
        }
        skippedWithPAM++;
        continue;
      }

      // Process: generic faces OR real PIDs with no PAM
      if (!isGenericFace && !hasEmptyPEPS) {
        if (isDebugPlayer) {
          console.log(`  SKIPPED: Not generic and has non-empty PEPS`);
        }
        skippedNotGeneric++;
        continue; // Has some PAM value that's not empty - skip
      }

      if (isDebugPlayer) {
        console.log(`  PROCESSING: Will update BLBM for this player`);
      }

      // Get BLBM fields
      const fields = blbmRec.fields || blbmRec._fields;
      if (!fields) continue;

      // Determine race from player data
      // Priority: _race field (1-7 direct from CSV) > PID lookup > existing BLBM SKNT > default
      let race;
      let raceSource = '';

      // First: Check for _race field (set by generator from CSV)
      if (player._race !== undefined && player._race !== null && player._race !== 0) {
        race = parseInt(player._race);
        raceSource = '_race field';
        if (updatedCount < 5 || isDebugPlayer) {
          console.log(`[GenericFaceService] Using _race=${race} for ${playerName}`);
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

      // Get GENR and SKNT based on race
      const sknt = this.getSkntForRace(race);
      const genr = this.getGenrForSknt(sknt);

      let finalGenr = genr;
      let finalSknt = sknt;

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

      if (isDebugPlayer) {
        console.log(`  BLBM UPDATE COMPLETE: GENR updated=${genrUpdated}, SKNT updated=${skntUpdated}`);
      }

      updatedCount++;

      if (updatedCount <= 5) {
        console.log(`[GenericFaceService] Updated ${playerName} (index ${i}): GENR=${finalGenr}, SKNT=${finalSknt}`);
      }
    }

    console.log(`[GenericFaceService] ===== BLBM UPDATE COMPLETE =====`);
    console.log(`[GenericFaceService] Updated ${updatedCount} players`);
    console.log(`[GenericFaceService] Skipped with PAM: ${skippedWithPAM}, Skipped not generic: ${skippedNotGeneric}`);
    return updatedCount;
  }
}

const genericFaceService = new GenericFaceService();

module.exports = { genericFaceService };
