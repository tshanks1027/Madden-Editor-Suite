/**
 * Database Migration Script
 * Creates SQLite database and migrates data from CSV files
 *
 * Run with: node scripts/create-database.js
 */

const Database = require('better-sqlite3');
const Papa = require('papaparse');
const fs = require('fs');
const path = require('path');

// Paths
const DATA_DIR = path.join(__dirname, '..', 'data', 'lookups');
const DB_PATH = path.join(__dirname, '..', 'data', 'players.db');

// Delete existing database if it exists
if (fs.existsSync(DB_PATH)) {
  fs.unlinkSync(DB_PATH);
  console.log('Deleted existing database');
}

// Create database
const db = new Database(DB_PATH);
console.log(`Creating database at: ${DB_PATH}`);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// ============================================
// SCHEMA CREATION
// ============================================

console.log('\n=== Creating Schema ===');

// States table (Madden's PHSN)
db.exec(`
  CREATE TABLE states (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    madden_id INTEGER UNIQUE NOT NULL,
    name TEXT NOT NULL
  )
`);
console.log('Created: states');

// Positions table (Madden's PPOS)
db.exec(`
  CREATE TABLE positions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    madden_id INTEGER UNIQUE NOT NULL,
    name TEXT NOT NULL
  )
`);
console.log('Created: positions');

// Colleges table (Madden's PCOL)
db.exec(`
  CREATE TABLE colleges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    madden_id INTEGER UNIQUE NOT NULL,
    name TEXT NOT NULL
  )
`);
console.log('Created: colleges');

// Teams table (Madden's TGID)
db.exec(`
  CREATE TABLE teams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    madden_id INTEGER UNIQUE NOT NULL,
    name TEXT NOT NULL
  )
`);
console.log('Created: teams');

// Players table (OUR master player table)
db.exec(`
  CREATE TABLE players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    college_id INTEGER,
    home_state_id INTEGER,
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
db.exec(`
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
db.exec(`
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
db.exec(`
  CREATE TABLE pid_race (
    pid INTEGER PRIMARY KEY,
    race INTEGER NOT NULL,
    type TEXT,
    name TEXT
  )
`);
console.log('Created: pid_race');

// Create indexes for fast lookups
db.exec(`
  CREATE INDEX idx_players_name ON players(last_name, first_name);
  CREATE INDEX idx_players_draft ON players(draft_class);
  CREATE INDEX idx_player_seasons_year ON player_seasons(year);
  CREATE INDEX idx_player_seasons_player ON player_seasons(player_id);
  CREATE INDEX idx_player_appearance_pid ON player_appearance(madden_pid);
`);
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
const insertState = db.prepare('INSERT INTO states (madden_id, name) VALUES (?, ?)');
const stateMap = new Map(); // madden_id -> our id
for (const row of states) {
  const maddenId = parseInt(row.PHSN);
  const result = insertState.run(maddenId, row.StateName);
  stateMap.set(maddenId, result.lastInsertRowid);
}
console.log(`Imported ${states.length} states`);

// 2. Import positions
console.log('\nImporting positions...');
const positions = parseCSV('position_lookup.csv');
const insertPosition = db.prepare('INSERT INTO positions (madden_id, name) VALUES (?, ?)');
const positionMap = new Map();
for (const row of positions) {
  const maddenId = parseInt(row.PPOS);
  const result = insertPosition.run(maddenId, row.PositionName);
  positionMap.set(row.PositionName, result.lastInsertRowid);
}
console.log(`Imported ${positions.length} positions`);

// 3. Import colleges
console.log('\nImporting colleges...');
const colleges = parseCSV('college_lookup.csv');
const insertCollege = db.prepare('INSERT INTO colleges (madden_id, name) VALUES (?, ?)');
const collegeMap = new Map(); // name -> our id
for (const row of colleges) {
  const maddenId = parseInt(row.PCOL);
  const result = insertCollege.run(maddenId, row.CollegeName);
  collegeMap.set(row.CollegeName.toLowerCase(), result.lastInsertRowid);
}
console.log(`Imported ${colleges.length} colleges`);

// 4. Import teams
console.log('\nImporting teams...');
const teams = parseCSV('team_lookup.csv');
const insertTeam = db.prepare('INSERT INTO teams (madden_id, name) VALUES (?, ?)');
for (const row of teams) {
  insertTeam.run(parseInt(row.TGID), row.TeamName);
}
console.log(`Imported ${teams.length} teams`);

// 5. Import players from ALL_PLAYER_LOOKUP.csv
console.log('\nImporting players from ALL_PLAYER_LOOKUP.csv...');
const allPlayers = parseCSV('ALL_PLAYER_LOOKUP.csv');

const insertPlayer = db.prepare(`
  INSERT INTO players (
    first_name, last_name, college_id, race, height, weight,
    draft_class, draft_round, draft_pick, career_from, career_to,
    position, wav, ap1, pb, starts, is_hof, league
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertAppearance = db.prepare(`
  INSERT INTO player_appearance (player_id, madden_pid, madden_pam, madden_plpo, madden_commid)
  VALUES (?, ?, ?, ?, ?)
`);

// Track players by name+draft_class for later matching
const playerLookup = new Map(); // "firstname|lastname|draftclass" -> player_id

let importedPlayers = 0;
const insertMany = db.transaction(() => {
  for (const row of allPlayers) {
    const firstName = row['First Name'] || '';
    const lastName = row['Last Name'] || '';
    if (!firstName && !lastName) continue;

    // Find college ID
    const collegeName = (row['College/Univ'] || '').toLowerCase();
    const collegeId = collegeMap.get(collegeName) || null;

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

    // Insert player
    const result = insertPlayer.run(
      firstName, lastName, collegeId, race, height, weight,
      draftClass, draftRound, draftPick, careerFrom, careerTo,
      position, wav, ap1, pb, starts, isHof, league
    );

    const playerId = result.lastInsertRowid;

    // Insert appearance data (Madden IDs)
    const maddenPid = parseInt(row['PhotoID']) || null;
    const maddenPam = row['Player Assets ID'] || null;
    const maddenPlpo = row['PLPO'] || null;
    const maddenCommid = row['CommID'] || null;

    if (maddenPid || maddenPam || maddenPlpo) {
      insertAppearance.run(playerId, maddenPid, maddenPam, maddenPlpo, maddenCommid);
    }

    // Store lookup key
    const key = `${firstName.toLowerCase()}|${lastName.toLowerCase()}|${draftClass}`;
    playerLookup.set(key, playerId);

    importedPlayers++;
  }
});
insertMany();
console.log(`Imported ${importedPlayers} players`);

// 6. Import player seasons from ROSTER_lookup.csv
console.log('\nImporting player seasons from ROSTER_lookup.csv...');
const rosterData = parseCSV('ROSTER_lookup.csv');

const insertSeason = db.prepare(`
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
`);

let importedSeasons = 0;
let unmatchedSeasons = 0;

const insertSeasons = db.transaction(() => {
  for (const row of rosterData) {
    const firstName = (row['First_Name'] || '').toLowerCase();
    const lastName = (row['Last_Name'] || '').toLowerCase();
    const year = parseInt(row['Year']);
    const draftYear = parseInt(row['Draft_Year']) || null;

    // Try to find player in our database
    let playerId = null;

    // Try with draft year first
    if (draftYear) {
      const key = `${firstName}|${lastName}|${draftYear}`;
      playerId = playerLookup.get(key);
    }

    // If not found and we don't have draft year, search by name only
    if (!playerId) {
      // Search through all keys for matching name
      for (const [key, id] of playerLookup.entries()) {
        const [fn, ln] = key.split('|');
        if (fn === firstName && ln === lastName) {
          playerId = id;
          break;
        }
      }
    }

    if (!playerId) {
      unmatchedSeasons++;
      continue;
    }

    // Parse all the rating fields
    const values = [
      playerId,
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
    ];

    insertSeason.run(...values);
    importedSeasons++;
  }
});
insertSeasons();
console.log(`Imported ${importedSeasons} player seasons`);
console.log(`Unmatched seasons (player not found): ${unmatchedSeasons}`);

// 7. Import PID Race mappings from PID_Portrait_Mapping.csv
console.log('\nImporting PID race mappings from PID_Portrait_Mapping.csv...');
const pidPortraitData = parseCSV('PID_Portrait_Mapping.csv');

const insertPidRace = db.prepare(`
  INSERT OR REPLACE INTO pid_race (pid, race, type, name) VALUES (?, ?, ?, ?)
`);

let importedPidRaces = 0;
const insertPidRaces = db.transaction(() => {
  for (const row of pidPortraitData) {
    const pid = parseInt(row['PID']);
    const race = parseInt(row['Race']);
    const type = row['Type'] || null;
    const name = row['Player Name'] || null;

    if (!isNaN(pid) && !isNaN(race) && race > 0) {
      insertPidRace.run(pid, race, type, name);
      importedPidRaces++;
    }
  }
});
insertPidRaces();
console.log(`Imported ${importedPidRaces} PID race mappings`);

// ============================================
// VERIFICATION
// ============================================

console.log('\n=== Verification ===');

const playerCount = db.prepare('SELECT COUNT(*) as count FROM players').get();
const seasonCount = db.prepare('SELECT COUNT(*) as count FROM player_seasons').get();
const appearanceCount = db.prepare('SELECT COUNT(*) as count FROM player_appearance').get();
const pidRaceCount = db.prepare('SELECT COUNT(*) as count FROM pid_race').get();

console.log(`Total players: ${playerCount.count}`);
console.log(`Total player seasons: ${seasonCount.count}`);
console.log(`Total appearance records: ${appearanceCount.count}`);
console.log(`Total PID race mappings: ${pidRaceCount.count}`);

// Test query: Find Tom Brady
console.log('\n--- Test: Find Tom Brady ---');
const brady = db.prepare(`
  SELECT p.id, p.first_name, p.last_name, p.draft_class,
         pa.madden_pid, pa.madden_pam,
         c.name as college
  FROM players p
  LEFT JOIN player_appearance pa ON pa.player_id = p.id
  LEFT JOIN colleges c ON c.id = p.college_id
  WHERE p.last_name = 'Brady' AND p.first_name = 'Tom'
`).get();

if (brady) {
  console.log(`Found: ${brady.first_name} ${brady.last_name}`);
  console.log(`  Our ID: ${brady.id}`);
  console.log(`  Madden PID: ${brady.madden_pid}`);
  console.log(`  Madden PAM: ${brady.madden_pam}`);
  console.log(`  College: ${brady.college}`);
  console.log(`  Draft Class: ${brady.draft_class}`);

  // Get his seasons
  const seasons = db.prepare(`
    SELECT year, team, POVR, position
    FROM player_seasons
    WHERE player_id = ?
    ORDER BY year
  `).all(brady.id);
  console.log(`  Seasons: ${seasons.length}`);
  if (seasons.length > 0) {
    console.log(`  First season: ${seasons[0].year} ${seasons[0].team} OVR:${seasons[0].POVR}`);
    console.log(`  Last season: ${seasons[seasons.length-1].year} ${seasons[seasons.length-1].team} OVR:${seasons[seasons.length-1].POVR}`);
  }
} else {
  console.log('Tom Brady not found');
}

// Test query: Find Roger Staubach
console.log('\n--- Test: Find Roger Staubach ---');
const staubach = db.prepare(`
  SELECT p.id, p.first_name, p.last_name, p.draft_class,
         pa.madden_pid, pa.madden_pam,
         c.name as college
  FROM players p
  LEFT JOIN player_appearance pa ON pa.player_id = p.id
  LEFT JOIN colleges c ON c.id = p.college_id
  WHERE p.last_name = 'Staubach' AND p.first_name = 'Roger'
`).get();

if (staubach) {
  console.log(`Found: ${staubach.first_name} ${staubach.last_name}`);
  console.log(`  Our ID: ${staubach.id}`);
  console.log(`  Madden PID: ${staubach.madden_pid}`);
  console.log(`  College: ${staubach.college}`);
} else {
  console.log('Roger Staubach not found');
}

db.close();
console.log('\n=== Migration Complete ===');
console.log(`Database saved to: ${DB_PATH}`);
