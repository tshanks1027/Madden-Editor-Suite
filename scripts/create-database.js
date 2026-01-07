/**
 * Database Migration Script
 * Creates SQLite database and migrates data from CSV files
 *
 * Uses sql.js (pure JavaScript) to avoid native module conflicts with Electron
 * Run with: node scripts/create-database.js
 */

const initSqlJs = require('sql.js');
const Papa = require('papaparse');
const fs = require('fs');
const path = require('path');

// Paths
const DATA_DIR = path.join(__dirname, '..', 'data', 'lookups');
const DB_PATH = path.join(__dirname, '..', 'data', 'players.db');

async function createDatabase() {
  // Delete existing database if it exists
  if (fs.existsSync(DB_PATH)) {
    fs.unlinkSync(DB_PATH);
    console.log('Deleted existing database');
  }

  // Initialize sql.js
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  console.log(`Creating database at: ${DB_PATH}`);

  // Enable foreign keys
  db.run('PRAGMA foreign_keys = ON');

  // ============================================
  // SCHEMA CREATION
  // ============================================

  console.log('\n=== Creating Schema ===');

  // States table (Madden's PHSN)
  db.run(`
    CREATE TABLE states (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      madden_id INTEGER UNIQUE NOT NULL,
      name TEXT NOT NULL
    )
  `);
  console.log('Created: states');

  // Positions table (Madden's PPOS)
  db.run(`
    CREATE TABLE positions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      madden_id INTEGER UNIQUE NOT NULL,
      name TEXT NOT NULL
    )
  `);
  console.log('Created: positions');

  // Colleges table (Madden's PCOL)
  db.run(`
    CREATE TABLE colleges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      madden_id INTEGER UNIQUE NOT NULL,
      name TEXT NOT NULL
    )
  `);
  console.log('Created: colleges');

  // Teams table (Madden's TGID)
  db.run(`
    CREATE TABLE teams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      madden_id INTEGER UNIQUE NOT NULL,
      name TEXT NOT NULL
    )
  `);
  console.log('Created: teams');

  // Players table (OUR master player table)
  // IMPORTANT: Store BOTH foreign key IDs AND raw names so data is never lost
  db.run(`
    CREATE TABLE players (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      college_id INTEGER,
      college_name TEXT,
      home_state_id INTEGER,
      home_state_name TEXT,
      hometown TEXT,
      race INTEGER,
      height INTEGER,
      weight INTEGER,
      draft_class INTEGER,
      draft_round TEXT,
      draft_pick INTEGER,
      career_from INTEGER,
      career_to INTEGER,
      position TEXT,
      wav REAL,
      ap1 INTEGER,
      pb INTEGER,
      starts INTEGER,
      is_hof INTEGER DEFAULT 0,
      league TEXT,
      FOREIGN KEY (college_id) REFERENCES colleges(id),
      FOREIGN KEY (home_state_id) REFERENCES states(id)
    )
  `);
  console.log('Created: players');

  // Player appearance table (Madden IDs separate from our ID)
  db.run(`
    CREATE TABLE player_appearance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      player_id INTEGER NOT NULL,
      madden_pid INTEGER,
      madden_pam TEXT,
      madden_plpo TEXT,
      madden_commid TEXT,
      portrait_type TEXT,
      FOREIGN KEY (player_id) REFERENCES players(id)
    )
  `);
  console.log('Created: player_appearance');

  // Player seasons table (yearly ratings)
  db.run(`
    CREATE TABLE player_seasons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      player_id INTEGER NOT NULL,
      year INTEGER NOT NULL,
      team TEXT,
      jersey INTEGER,
      age INTEGER,
      position TEXT,
      archetype TEXT,
      games INTEGER,
      games_started INTEGER,
      av INTEGER,
      dev_trait TEXT,

      -- Ratings (all the Madden rating fields)
      POVR INTEGER, PSPD INTEGER, PACC INTEGER, PSTR INTEGER, PAGI INTEGER,
      PAWR INTEGER, PCTH INTEGER, PCAR INTEGER, PTHP INTEGER, PKPW INTEGER,
      PKAC INTEGER, PRBK INTEGER, PPBK INTEGER, PTAK INTEGER, PBTK INTEGER,
      PJMP INTEGER, PINJ INTEGER, PSTA INTEGER, PTGH INTEGER, PTRK INTEGER,
      PCOD INTEGER, PBCV INTEGER, PSTF INTEGER, PSPM INTEGER, PJUM INTEGER,
      PIBL INTEGER, PRBP INTEGER, PRBF INTEGER, PPBP INTEGER, PPBF INTEGER,
      PLDB INTEGER, PBRS INTEGER, PTUP INTEGER, PPWM INTEGER, PFNM INTEGER,
      PBSH INTEGER, PPUR INTEGER, PPRC INTEGER, PMCV INTEGER, PZCV INTEGER,
      PSPC INTEGER, PCIT INTEGER, PSRR INTEGER, PMRR INTEGER, PDRR INTEGER,
      PHTP INTEGER, PPRS INTEGER, PREL INTEGER, PTAS INTEGER, PTAM INTEGER,
      PTAD INTEGER, PPLA INTEGER, PTOR INTEGER, PKRT INTEGER, PLTR INTEGER,
      PELU INTEGER, PLSA INTEGER, PLSM INTEGER, PLJM INTEGER, PLIB INTEGER,
      PLBK INTEGER, PLPM INTEGER, PFMS INTEGER, PBSG INTEGER, PLPU INTEGER,
      PLPR INTEGER, PLMC INTEGER, PLZC INTEGER, PLSC INTEGER, PLCI INTEGER,
      SRRN INTEGER, PLHT INTEGER, PLPE INTEGER, PLRL INTEGER, PBSK INTEGER,
      PPBS INTEGER, PRBS INTEGER,

      FOREIGN KEY (player_id) REFERENCES players(id),
      UNIQUE(player_id, year)
    )
  `);
  console.log('Created: player_seasons');

  // PID Race table (direct PID → Race mapping for all PIDs including generics)
  db.run(`
    CREATE TABLE pid_race (
      pid INTEGER PRIMARY KEY,
      race INTEGER NOT NULL,
      type TEXT,
      name TEXT
    )
  `);
  console.log('Created: pid_race');

  // Create indexes for fast lookups
  db.run(`CREATE INDEX idx_players_name ON players(last_name, first_name)`);
  db.run(`CREATE INDEX idx_players_draft ON players(draft_class)`);
  db.run(`CREATE INDEX idx_player_seasons_year ON player_seasons(year)`);
  db.run(`CREATE INDEX idx_player_seasons_player ON player_seasons(player_id)`);
  db.run(`CREATE INDEX idx_player_appearance_pid ON player_appearance(madden_pid)`);
  console.log('Created indexes');

  // ============================================
  // DATA MIGRATION
  // ============================================

  console.log('\n=== Migrating Data ===');

  // Helper to parse CSV
  function parseCSV(filename) {
    const filePath = path.join(DATA_DIR, filename);
    if (!fs.existsSync(filePath)) {
      console.warn(`File not found: ${filename}`);
      return [];
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    const result = Papa.parse(content, { header: true, skipEmptyLines: true });
    return result.data;
  }

  // 1. Import states
  console.log('\nImporting states...');
  const states = parseCSV('state_lookup.csv');
  const stateMap = new Map(); // madden_id -> our id
  const stateNameMap = new Map(); // state name (lowercase) -> our id
  let stateId = 1;
  for (const row of states) {
    const maddenId = parseInt(row.PHSN);
    db.run('INSERT INTO states (id, madden_id, name) VALUES (?, ?, ?)', [stateId, maddenId, row.StateName]);
    stateMap.set(maddenId, stateId);
    stateNameMap.set(row.StateName.toLowerCase(), stateId);
    stateId++;
  }
  console.log(`Imported ${states.length} states`);

  // 2. Import positions
  console.log('\nImporting positions...');
  const positions = parseCSV('position_lookup.csv');
  const positionMap = new Map();
  let posId = 1;
  for (const row of positions) {
    const maddenId = parseInt(row.PPOS);
    db.run('INSERT INTO positions (id, madden_id, name) VALUES (?, ?, ?)', [posId, maddenId, row.PositionName]);
    positionMap.set(row.PositionName, posId);
    posId++;
  }
  console.log(`Imported ${positions.length} positions`);

  // 3. Import colleges
  console.log('\nImporting colleges...');
  const colleges = parseCSV('college_lookup.csv');
  const collegeMap = new Map(); // name -> our id
  let colId = 1;
  for (const row of colleges) {
    const maddenId = parseInt(row.PCOL);
    db.run('INSERT INTO colleges (id, madden_id, name) VALUES (?, ?, ?)', [colId, maddenId, row.CollegeName]);
    collegeMap.set(row.CollegeName.toLowerCase(), colId);
    colId++;
  }
  console.log(`Imported ${colleges.length} colleges`);

  // 4. Import teams
  console.log('\nImporting teams...');
  const teams = parseCSV('team_lookup.csv');
  let teamId = 1;
  for (const row of teams) {
    db.run('INSERT INTO teams (id, madden_id, name) VALUES (?, ?, ?)', [teamId, parseInt(row.TGID), row.TeamName]);
    teamId++;
  }
  console.log(`Imported ${teams.length} teams`);

  // 5. Import players from ALL_PLAYER_LOOKUP.csv
  console.log('\nImporting players from ALL_PLAYER_LOOKUP.csv...');
  const allPlayers = parseCSV('ALL_PLAYER_LOOKUP.csv');

  // Track players by name+draft_class for later matching
  const playerLookup = new Map(); // "firstname|lastname|draftclass" -> player_id

  let importedPlayers = 0;
  let playerId = 1;

  for (const row of allPlayers) {
    const firstName = row['First Name'] || '';
    const lastName = row['Last Name'] || '';
    if (!firstName && !lastName) continue;

    // Find college ID - store raw name separately from lowercase lookup key
    const collegeNameRaw = row['College/Univ'] || '';
    const collegeNameLower = collegeNameRaw.toLowerCase();
    const collegeId = collegeMap.get(collegeNameLower) || null;

    // Parse numeric fields
    const height = parseInt(row['Height']) || null;
    const weight = parseInt(row['Weight']) || null;
    const draftClass = parseInt(row['Draft Class']) || null;
    const draftRound = row['Round'] || null;
    const draftPick = parseInt(row['Pick']) || null;
    const careerFrom = parseInt(row['From']) || null;
    const careerTo = parseInt(row['To']) || null;
    const wav = parseFloat(row['wAV']) || null;
    const ap1 = parseInt(row['AP1']) || 0;
    const pb = parseInt(row['PB']) || 0;
    const starts = parseInt(row['St']) || 0;
    const isHof = row['isHOF'] === 'TRUE' ? 1 : 0;
    const league = row['League'] || null;
    const race = parseInt(row['Race']) || null;
    const position = row['Position'] || null;

    // Parse Home State - format is "City, State" or just state name
    // Store BOTH the foreign key ID AND the raw state name
    let homeStateId = null;
    let homeStateName = null;
    let hometown = null;
    const homeStateRaw = row['Home State'] || '';
    if (homeStateRaw) {
      // Try to extract city and state from "City, State" format
      const parts = homeStateRaw.split(',');
      if (parts.length > 1) {
        // Has comma - extract city and state
        hometown = parts.slice(0, -1).join(',').trim(); // Everything before the last comma
        const stateName = parts[parts.length - 1].trim();
        homeStateName = stateName; // Store raw state name
        homeStateId = stateNameMap.get(stateName.toLowerCase()) || null;
      } else {
        // No comma - might be just state name, check if it's a state
        const possibleState = homeStateRaw.trim();
        homeStateId = stateNameMap.get(possibleState.toLowerCase()) || null;
        if (homeStateId) {
          // It's a state - store as state name
          homeStateName = possibleState;
        } else {
          // Not a state - treat as hometown
          hometown = possibleState;
        }
      }
    }

    // Insert player - include raw names so data is never lost even if FK lookup fails
    db.run(`
      INSERT INTO players (
        id, first_name, last_name, college_id, college_name, home_state_id, home_state_name, hometown, race, height, weight,
        draft_class, draft_round, draft_pick, career_from, career_to,
        position, wav, ap1, pb, starts, is_hof, league
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      playerId, firstName, lastName, collegeId, collegeNameRaw, homeStateId, homeStateName, hometown, race, height, weight,
      draftClass, draftRound, draftPick, careerFrom, careerTo,
      position, wav, ap1, pb, starts, isHof, league
    ]);

    // Insert appearance data (Madden IDs)
    const maddenPid = parseInt(row['PhotoID']) || null;
    const maddenPam = row['Player Assets ID'] || null;
    const maddenPlpo = row['PLPO'] || null;
    const maddenCommid = row['CommID'] || null;

    if (maddenPid || maddenPam || maddenPlpo) {
      db.run(`
        INSERT INTO player_appearance (player_id, madden_pid, madden_pam, madden_plpo, madden_commid)
        VALUES (?, ?, ?, ?, ?)
      `, [playerId, maddenPid, maddenPam, maddenPlpo, maddenCommid]);
    }

    // Store lookup key
    const key = `${firstName.toLowerCase()}|${lastName.toLowerCase()}|${draftClass}`;
    playerLookup.set(key, playerId);

    playerId++;
    importedPlayers++;
  }
  console.log(`Imported ${importedPlayers} players`);

  // 6. Import player seasons from ROSTER_lookup.csv
  console.log('\nImporting player seasons from ROSTER_lookup.csv...');
  const rosterData = parseCSV('ROSTER_lookup.csv');

  let importedSeasons = 0;
  let unmatchedSeasons = 0;

  for (const row of rosterData) {
    const firstName = (row['First_Name'] || '').toLowerCase();
    const lastName = (row['Last_Name'] || '').toLowerCase();
    const year = parseInt(row['Year']);
    const draftYear = parseInt(row['Draft_Year']) || null;

    // Try to find player in our database
    let matchedPlayerId = null;

    // Try with draft year first
    if (draftYear) {
      const key = `${firstName}|${lastName}|${draftYear}`;
      matchedPlayerId = playerLookup.get(key);
    }

    // If not found and we don't have draft year, search by name only
    if (!matchedPlayerId) {
      // Search through all keys for matching name
      for (const [key, id] of playerLookup.entries()) {
        const [fn, ln] = key.split('|');
        if (fn === firstName && ln === lastName) {
          matchedPlayerId = id;
          break;
        }
      }
    }

    if (!matchedPlayerId) {
      unmatchedSeasons++;
      continue;
    }

    // Parse all the rating fields
    db.run(`
      INSERT OR REPLACE INTO player_seasons (
        player_id, year, team, jersey, age, position, archetype,
        games, games_started, av, dev_trait,
        POVR, PSPD, PACC, PSTR, PAGI, PAWR, PCTH, PCAR, PTHP, PKPW,
        PKAC, PRBK, PPBK, PTAK, PBTK, PJMP, PINJ, PSTA, PTGH, PTRK,
        PCOD, PBCV, PSTF, PSPM, PJUM, PIBL, PRBP, PRBF, PPBP, PPBF,
        PLDB, PBRS, PTUP, PPWM, PFNM, PBSH, PPUR, PPRC, PMCV, PZCV,
        PSPC, PCIT, PSRR, PMRR, PDRR, PHTP, PPRS, PREL, PTAS, PTAM,
        PTAD, PPLA, PTOR, PKRT, PLTR, PELU, PLSA, PLSM, PLJM, PLIB,
        PLBK, PLPM, PFMS, PBSG, PLPU, PLPR, PLMC, PLZC, PLSC, PLCI,
        SRRN, PLHT, PLPE, PLRL, PBSK, PPBS, PRBS
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?
      )
    `, [
      matchedPlayerId,
      year,
      row['Season_Team'] || null,
      parseInt(row['Jersey']) || null,
      parseInt(row['Age']) || null,
      row['Position'] || null,
      row['Archetype'] || null,
      parseInt(row['Games']) || null,
      parseInt(row['Games_Started']) || null,
      parseInt(row['AV']) || null,
      row['Dev_Trait'] || null,
      // Ratings
      parseInt(row['POVR']) || null,
      parseInt(row['PSPD']) || null,
      parseInt(row['PACC']) || null,
      parseInt(row['PSTR']) || null,
      parseInt(row['PAGI']) || null,
      parseInt(row['PAWR']) || null,
      parseInt(row['PCTH']) || null,
      parseInt(row['PCAR']) || null,
      parseInt(row['PTHP']) || null,
      parseInt(row['PKPW']) || null,
      parseInt(row['PKAC']) || null,
      parseInt(row['PRBK']) || null,
      parseInt(row['PPBK']) || null,
      parseInt(row['PTAK']) || null,
      parseInt(row['PBTK']) || null,
      parseInt(row['PJMP']) || null,
      parseInt(row['PINJ']) || null,
      parseInt(row['PSTA']) || null,
      parseInt(row['PTGH']) || null,
      parseInt(row['PTRK']) || null,
      parseInt(row['PCOD']) || null,
      parseInt(row['PBCV']) || null,
      parseInt(row['PSTF']) || null,
      parseInt(row['PSPM']) || null,
      parseInt(row['PJUM']) || null,
      parseInt(row['PIBL']) || null,
      parseInt(row['PRBP']) || null,
      parseInt(row['PRBF']) || null,
      parseInt(row['PPBP']) || null,
      parseInt(row['PPBF']) || null,
      parseInt(row['PLDB']) || null,
      parseInt(row['PBRS']) || null,
      parseInt(row['PTUP']) || null,
      parseInt(row['PPWM']) || null,
      parseInt(row['PFNM']) || null,
      parseInt(row['PBSH']) || null,
      parseInt(row['PPUR']) || null,
      parseInt(row['PPRC']) || null,
      parseInt(row['PMCV']) || null,
      parseInt(row['PZCV']) || null,
      parseInt(row['PSPC']) || null,
      parseInt(row['PCIT']) || null,
      parseInt(row['PSRR']) || null,
      parseInt(row['PMRR']) || null,
      parseInt(row['PDRR']) || null,
      parseInt(row['PHTP']) || null,
      parseInt(row['PPRS']) || null,
      parseInt(row['PREL']) || null,
      parseInt(row['PTAS']) || null,
      parseInt(row['PTAM']) || null,
      parseInt(row['PTAD']) || null,
      parseInt(row['PPLA']) || null,
      parseInt(row['PTOR']) || null,
      parseInt(row['PKRT']) || null,
      parseInt(row['PLTR']) || null,
      parseInt(row['PELU']) || null,
      parseInt(row['PLSA']) || null,
      parseInt(row['PLSM']) || null,
      parseInt(row['PLJM']) || null,
      parseInt(row['PLIB']) || null,
      parseInt(row['PLBK']) || null,
      parseInt(row['PLPM']) || null,
      parseInt(row['PFMS']) || null,
      parseInt(row['PBSG']) || null,
      parseInt(row['PLPU']) || null,
      parseInt(row['PLPR']) || null,
      parseInt(row['PLMC']) || null,
      parseInt(row['PLZC']) || null,
      parseInt(row['PLSC']) || null,
      parseInt(row['PLCI']) || null,
      parseInt(row['SRRN']) || null,
      parseInt(row['PLHT']) || null,
      parseInt(row['PLPE']) || null,
      parseInt(row['PLRL']) || null,
      parseInt(row['PBSK']) || null,
      parseInt(row['PPBS']) || null,
      parseInt(row['PRBS']) || null
    ]);
    importedSeasons++;
  }
  console.log(`Imported ${importedSeasons} player seasons`);
  console.log(`Unmatched seasons (player not found): ${unmatchedSeasons}`);

  // 7. Populate missing Commentary IDs from commentary_lookup.csv
  console.log('\nPopulating missing commentary IDs from commentary_lookup.csv...');
  const commentaryData = parseCSV('commentary_lookup.csv');

  // Build name -> ID map (lowercase for matching)
  const commentaryMap = new Map();
  for (const row of commentaryData) {
    const name = (row.name || '').toLowerCase().trim();
    const id = parseInt(row.id);
    if (name && !isNaN(id)) {
      commentaryMap.set(name, id);
    }
  }
  console.log(`Loaded ${commentaryMap.size} commentary name mappings`);

  // Find players with missing commentary IDs
  const playersNeedingCommId = db.exec(`
    SELECT p.id, p.last_name, pa.id as pa_id, pa.madden_commid
    FROM players p
    LEFT JOIN player_appearance pa ON pa.player_id = p.id
    WHERE (pa.madden_commid IS NULL OR pa.madden_commid = '' OR pa.madden_commid = '0')
  `);

  let updatedCommIds = 0;
  if (playersNeedingCommId.length > 0 && playersNeedingCommId[0].values) {
    for (const row of playersNeedingCommId[0].values) {
      const [playerId, lastName, paId, existingCommId] = row;
      if (!lastName) continue;

      // Try exact match first (including suffix like "Jr.", "II")
      let commId = commentaryMap.get(lastName.toLowerCase().trim());

      // If no match, try stripping common suffixes
      if (!commId) {
        const baseName = lastName.replace(/\s+(Jr\.?|Sr\.?|II|III|IV|V)$/i, '').trim();
        if (baseName !== lastName) {
          commId = commentaryMap.get(baseName.toLowerCase());
        }
      }

      if (commId) {
        if (paId) {
          // Update existing appearance record
          db.run('UPDATE player_appearance SET madden_commid = ? WHERE id = ?', [commId.toString(), paId]);
        } else {
          // Create new appearance record
          db.run('INSERT INTO player_appearance (player_id, madden_commid) VALUES (?, ?)', [playerId, commId.toString()]);
        }
        updatedCommIds++;
      }
    }
  }
  console.log(`Updated ${updatedCommIds} players with commentary IDs`);

  // 8. Import PID Race mappings from PID_Portrait_Mapping.csv
  console.log('\nImporting PID race mappings from PID_Portrait_Mapping.csv...');
  const pidPortraitData = parseCSV('PID_Portrait_Mapping.csv');

  let importedPidRaces = 0;
  for (const row of pidPortraitData) {
    const pid = parseInt(row['PID']);
    const race = parseInt(row['Race']);
    const type = row['Type'] || null;
    const name = row['Player Name'] || null;

    if (!isNaN(pid) && !isNaN(race) && race > 0) {
      db.run('INSERT OR REPLACE INTO pid_race (pid, race, type, name) VALUES (?, ?, ?, ?)', [pid, race, type, name]);
      importedPidRaces++;
    }
  }
  console.log(`Imported ${importedPidRaces} PID race mappings`);

  // ============================================
  // SAVE DATABASE
  // ============================================

  console.log('\n=== Saving Database ===');
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
  db.close();

  // ============================================
  // VERIFICATION
  // ============================================

  console.log('\n=== Verification ===');

  // Re-open for verification
  const verifyDb = new SQL.Database(buffer);

  const playerCount = verifyDb.exec('SELECT COUNT(*) as count FROM players')[0].values[0][0];
  const seasonCount = verifyDb.exec('SELECT COUNT(*) as count FROM player_seasons')[0].values[0][0];
  const appearanceCount = verifyDb.exec('SELECT COUNT(*) as count FROM player_appearance')[0].values[0][0];
  const pidRaceCount = verifyDb.exec('SELECT COUNT(*) as count FROM pid_race')[0].values[0][0];

  console.log(`Total players: ${playerCount}`);
  console.log(`Total player seasons: ${seasonCount}`);
  console.log(`Total appearance records: ${appearanceCount}`);
  console.log(`Total PID race mappings: ${pidRaceCount}`);

  // Test query: Find Tom Brady
  console.log('\n--- Test: Find Tom Brady ---');
  const bradyResult = verifyDb.exec(`
    SELECT p.id, p.first_name, p.last_name, p.draft_class, p.college_name,
           pa.madden_pid, pa.madden_pam
    FROM players p
    LEFT JOIN player_appearance pa ON pa.player_id = p.id
    WHERE p.last_name = 'Brady' AND p.first_name = 'Tom'
  `);

  if (bradyResult.length > 0 && bradyResult[0].values.length > 0) {
    const brady = bradyResult[0].values[0];
    console.log(`Found: ${brady[1]} ${brady[2]}`);
    console.log(`  Our ID: ${brady[0]}`);
    console.log(`  Madden PID: ${brady[5]}`);
    console.log(`  Madden PAM: ${brady[6]}`);
    console.log(`  College: ${brady[4]}`);
    console.log(`  Draft Class: ${brady[3]}`);
  } else {
    console.log('Tom Brady not found');
  }

  // Test query: Find Joe Stydahar (test college_name storage)
  console.log('\n--- Test: Find Joe Stydahar ---');
  const stydaharResult = verifyDb.exec(`
    SELECT p.id, p.first_name, p.last_name, p.draft_class, p.college_name, p.college_id, p.position
    FROM players p
    WHERE p.last_name = 'Stydahar' AND p.first_name = 'Joe'
  `);

  if (stydaharResult.length > 0 && stydaharResult[0].values.length > 0) {
    const stydahar = stydaharResult[0].values[0];
    console.log(`Found: ${stydahar[1]} ${stydahar[2]}`);
    console.log(`  Our ID: ${stydahar[0]}`);
    console.log(`  College Name (raw): ${stydahar[4]}`);
    console.log(`  College ID: ${stydahar[5]}`);
    console.log(`  Position: ${stydahar[6]}`);
  } else {
    console.log('Joe Stydahar not found');
  }

  verifyDb.close();

  console.log('\n=== Migration Complete ===');
  console.log(`Database saved to: ${DB_PATH}`);
}

// Run the migration
createDatabase().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
