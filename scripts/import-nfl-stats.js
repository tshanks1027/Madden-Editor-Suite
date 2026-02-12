/**
 * Import NFL Stats from XLS files into career stats database
 *
 * Source: C:/Users/tshan/Documents/Docs/NFL Stats
 * Files: {year}Pass.xls, {year}Run.xls, {year}Rec.xls, {year}Def.xls, etc.
 *
 * Uses sql.js (pure JS SQLite) to avoid native module issues
 */

const XLSX = require('xlsx');
const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const STATS_FOLDER = 'C:/Users/tshan/Documents/Docs/NFL Stats';
const DB_PATH = path.join(__dirname, '..', 'data', 'player-career-stats.db');

// Years to import (1960-2025)
const START_YEAR = 1960;
const END_YEAR = 2025;

// Team abbreviation mapping (PFR -> standard)
const TEAM_MAP = {
    'ARI': 'ARI', 'ATL': 'ATL', 'BAL': 'BAL', 'BUF': 'BUF',
    'CAR': 'CAR', 'CHI': 'CHI', 'CIN': 'CIN', 'CLE': 'CLE',
    'DAL': 'DAL', 'DEN': 'DEN', 'DET': 'DET', 'GNB': 'GB', 'GB': 'GB',
    'HOU': 'HOU', 'HTX': 'HOU', 'IND': 'IND', 'JAX': 'JAX',
    'KAN': 'KC', 'KC': 'KC', 'KCC': 'KC',
    'LAC': 'LAC', 'LAR': 'LAR', 'LVR': 'LV', 'MIA': 'MIA',
    'MIN': 'MIN', 'NWE': 'NE', 'NE': 'NE', 'NEP': 'NE',
    'NOR': 'NO', 'NO': 'NO', 'NYG': 'NYG', 'NYJ': 'NYJ',
    'OAK': 'OAK', 'PHI': 'PHI', 'PIT': 'PIT', 'SEA': 'SEA',
    'SFO': 'SF', 'SF': 'SF', 'STL': 'STL', 'TAM': 'TB', 'TB': 'TB',
    'TEN': 'TEN', 'WAS': 'WAS', 'WSH': 'WAS',
    // Historical teams
    'SDG': 'SD', 'SD': 'SD', 'RAM': 'LAR', 'PHO': 'ARI', 'STC': 'STL',
    'CRD': 'ARI', 'BOS': 'NE', 'HST': 'HOU', 'OIL': 'TEN', 'CLT': 'IND',
    // 2TM means played for multiple teams
    '2TM': '2TM', '3TM': '3TM', '4TM': '4TM'
};

function normalizeTeam(team) {
    if (!team) return null;
    const upper = team.toUpperCase();
    return TEAM_MAP[upper] || upper;
}

function parseName(fullName) {
    if (!fullName || typeof fullName !== 'string') return { first: '', last: '' };

    // Remove asterisks and plus signs (HOF markers, etc.)
    const cleaned = fullName.replace(/[*+]/g, '').trim();

    const parts = cleaned.split(' ');
    if (parts.length === 1) {
        return { first: '', last: parts[0] };
    }

    const first = parts[0];
    const last = parts.slice(1).join(' ');
    return { first, last };
}

function readXlsFile(filePath) {
    if (!fs.existsSync(filePath)) return null;

    try {
        const workbook = XLSX.readFile(filePath);
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        // Find the actual header row (skip category headers like "Rushing")
        let headerRowIndex = 0;
        for (let i = 0; i < Math.min(5, data.length); i++) {
            if (data[i] && data[i].includes('Player')) {
                headerRowIndex = i;
                break;
            }
        }

        const headers = data[headerRowIndex];
        const rows = data.slice(headerRowIndex + 1);

        return rows.map(row => {
            const obj = {};
            headers.forEach((header, idx) => {
                if (header) {
                    obj[header] = row[idx];
                }
            });
            return obj;
        }).filter(row => row.Player && row.Player.length > 0);
    } catch (error) {
        console.error(`Error reading ${filePath}:`, error.message);
        return null;
    }
}

function importYear(db, year, playerCache) {
    console.log(`\nImporting year ${year}...`);

    const stats = {};  // playerKey -> stats

    // Helper to get or create player stats object
    function getPlayerStats(name, team, age, pos, games, gamesStarted) {
        const { first, last } = parseName(name);
        if (!last) return null;

        const key = `${first}|${last}|${year}`;

        if (!stats[key]) {
            stats[key] = {
                firstName: first,
                lastName: last,
                year: year,
                team: normalizeTeam(team),
                age: parseInt(age) || null,
                position: pos || null,
                games: parseInt(games) || 0,
                gamesStarted: parseInt(gamesStarted) || 0,
                // Passing
                passCmp: 0, passAtt: 0, passYds: 0, passTd: 0, passInt: 0, passRating: 0,
                // Rushing
                rushAtt: 0, rushYds: 0, rushTd: 0,
                // Receiving
                rec: 0, recYds: 0, recTd: 0,
                // Defense
                tackles: 0, sacks: 0, defInt: 0, ff: 0, fr: 0,
                // Kicking
                fgm: 0, fga: 0, xpm: 0, xpa: 0,
                // Punting
                punts: 0, puntYds: 0, puntAvg: 0,
                // Returns
                krRet: 0, krYds: 0, krTd: 0, prRet: 0, prYds: 0, prTd: 0
            };
        }

        // Update games if higher
        const g = parseInt(games) || 0;
        const gs = parseInt(gamesStarted) || 0;
        if (g > stats[key].games) stats[key].games = g;
        if (gs > stats[key].gamesStarted) stats[key].gamesStarted = gs;

        // Update team if not set
        if (!stats[key].team && team) stats[key].team = normalizeTeam(team);
        if (!stats[key].position && pos) stats[key].position = pos;
        if (!stats[key].age && age) stats[key].age = parseInt(age) || null;

        return stats[key];
    }

    // Import passing stats
    const passFile = path.join(STATS_FOLDER, `${year}Pass.xls`);
    const passData = readXlsFile(passFile);
    if (passData) {
        for (const row of passData) {
            const s = getPlayerStats(row.Player, row.Team, row.Age, row.Pos, row.G, row.GS);
            if (s) {
                s.passCmp = parseInt(row.Cmp) || 0;
                s.passAtt = parseInt(row.Att) || 0;
                s.passYds = parseInt(row.Yds) || 0;
                s.passTd = parseInt(row.TD) || 0;
                s.passInt = parseInt(row.Int) || 0;
                s.passRating = parseFloat(row.Rate) || 0;
            }
        }
        console.log(`  - Passing: ${passData.length} players`);
    }

    // Import rushing stats
    const runFile = path.join(STATS_FOLDER, `${year}Run.xls`);
    const runData = readXlsFile(runFile);
    if (runData) {
        for (const row of runData) {
            const s = getPlayerStats(row.Player, row.Team, row.Age, row.Pos, row.G, row.GS);
            if (s) {
                s.rushAtt = parseInt(row.Att) || 0;
                s.rushYds = parseInt(row.Yds) || 0;
                s.rushTd = parseInt(row.TD) || 0;
            }
        }
        console.log(`  - Rushing: ${runData.length} players`);
    }

    // Import receiving stats
    const recFile = path.join(STATS_FOLDER, `${year}Rec.xls`);
    const recData = readXlsFile(recFile);
    if (recData) {
        for (const row of recData) {
            const s = getPlayerStats(row.Player, row.Team, row.Age, row.Pos, row.G, row.GS);
            if (s) {
                s.rec = parseInt(row.Rec) || 0;
                s.recYds = parseInt(row.Yds) || 0;
                s.recTd = parseInt(row.TD) || 0;
            }
        }
        console.log(`  - Receiving: ${recData.length} players`);
    }

    // Import defensive stats
    const defFile = path.join(STATS_FOLDER, `${year}Def.xls`);
    const defData = readXlsFile(defFile);
    if (defData) {
        for (const row of defData) {
            const s = getPlayerStats(row.Player, row.Team, row.Age, row.Pos, row.G, row.GS);
            if (s) {
                s.defInt = parseInt(row.Int) || 0;
                s.ff = parseInt(row.FF) || parseInt(row.Fmb) || 0;
                s.fr = parseInt(row.FR) || 0;
                s.sacks = parseFloat(row.Sk) || 0;
                s.tackles = parseInt(row.Tkl) || parseInt(row['Solo']) || 0;
            }
        }
        console.log(`  - Defense: ${defData.length} players`);
    }

    // Import kicking stats
    const kickFile = path.join(STATS_FOLDER, `${year}Kick.xls`);
    const kickData = readXlsFile(kickFile);
    if (kickData) {
        for (const row of kickData) {
            const s = getPlayerStats(row.Player, row.Team, row.Age, row.Pos, row.G, row.GS);
            if (s) {
                s.fgm = parseInt(row.FGM) || parseInt(row.FG) || 0;
                s.fga = parseInt(row.FGA) || 0;
                s.xpm = parseInt(row.XPM) || parseInt(row.XP) || 0;
                s.xpa = parseInt(row.XPA) || 0;
            }
        }
        console.log(`  - Kicking: ${kickData.length} players`);
    }

    // Import punting stats
    const puntFile = path.join(STATS_FOLDER, `${year}Punt.xls`);
    const puntData = readXlsFile(puntFile);
    if (puntData) {
        for (const row of puntData) {
            const s = getPlayerStats(row.Player, row.Team, row.Age, row.Pos, row.G, row.GS);
            if (s) {
                s.punts = parseInt(row.Pnt) || parseInt(row.Punts) || 0;
                s.puntYds = parseInt(row.Yds) || 0;
                s.puntAvg = parseFloat(row['Y/P']) || parseFloat(row.Avg) || 0;
            }
        }
        console.log(`  - Punting: ${puntData.length} players`);
    }

    // Import return stats
    const retFile = path.join(STATS_FOLDER, `${year}Ret.xls`);
    const retData = readXlsFile(retFile);
    if (retData) {
        for (const row of retData) {
            const s = getPlayerStats(row.Player, row.Team, row.Age, row.Pos, row.G, row.GS);
            if (s) {
                // Kick returns
                s.krRet = parseInt(row['KR']) || parseInt(row['Rt']) || 0;
                s.krYds = parseInt(row['KRYds']) || 0;
                s.krTd = parseInt(row['KRTD']) || parseInt(row['TD']) || 0;
                // Punt returns
                s.prRet = parseInt(row['PR']) || 0;
                s.prYds = parseInt(row['PRYds']) || 0;
                s.prTd = parseInt(row['PRTD']) || 0;
            }
        }
        console.log(`  - Returns: ${retData.length} players`);
    }

    // Also check for AFL stats (1960-1969)
    if (year >= 1960 && year <= 1969) {
        const aflPassFile = path.join(STATS_FOLDER, `${year}AFLPass.xls`);
        const aflPassData = readXlsFile(aflPassFile);
        if (aflPassData) {
            for (const row of aflPassData) {
                const s = getPlayerStats(row.Player, row.Team, row.Age, row.Pos, row.G, row.GS);
                if (s) {
                    s.passCmp = Math.max(s.passCmp, parseInt(row.Cmp) || 0);
                    s.passAtt = Math.max(s.passAtt, parseInt(row.Att) || 0);
                    s.passYds = Math.max(s.passYds, parseInt(row.Yds) || 0);
                    s.passTd = Math.max(s.passTd, parseInt(row.TD) || 0);
                    s.passInt = Math.max(s.passInt, parseInt(row.Int) || 0);
                }
            }
            console.log(`  - AFL Passing: ${aflPassData.length} players`);
        }

        // AFL Rush
        const aflRunFile = path.join(STATS_FOLDER, `${year}AFLRun.xls`);
        const aflRunData = readXlsFile(aflRunFile);
        if (!aflRunData) {
            const aflRushFile = path.join(STATS_FOLDER, `${year}AFLRush.xls`);
            const aflRushData = readXlsFile(aflRushFile);
            if (aflRushData) {
                for (const row of aflRushData) {
                    const s = getPlayerStats(row.Player, row.Team, row.Age, row.Pos, row.G, row.GS);
                    if (s) {
                        s.rushAtt = Math.max(s.rushAtt, parseInt(row.Att) || 0);
                        s.rushYds = Math.max(s.rushYds, parseInt(row.Yds) || 0);
                        s.rushTd = Math.max(s.rushTd, parseInt(row.TD) || 0);
                    }
                }
                console.log(`  - AFL Rushing: ${aflRushData.length} players`);
            }
        }

        // AFL Rec
        const aflRecFile = path.join(STATS_FOLDER, `${year}AFLRec.xls`);
        const aflRecData = readXlsFile(aflRecFile);
        if (aflRecData) {
            for (const row of aflRecData) {
                const s = getPlayerStats(row.Player, row.Team, row.Age, row.Pos, row.G, row.GS);
                if (s) {
                    s.rec = Math.max(s.rec, parseInt(row.Rec) || 0);
                    s.recYds = Math.max(s.recYds, parseInt(row.Yds) || 0);
                    s.recTd = Math.max(s.recTd, parseInt(row.TD) || 0);
                }
            }
            console.log(`  - AFL Receiving: ${aflRecData.length} players`);
        }

        // AFL Def
        const aflDefFile = path.join(STATS_FOLDER, `${year}AFLDef.xls`);
        const aflDefData = readXlsFile(aflDefFile);
        if (aflDefData) {
            for (const row of aflDefData) {
                const s = getPlayerStats(row.Player, row.Team, row.Age, row.Pos, row.G, row.GS);
                if (s) {
                    s.defInt = Math.max(s.defInt, parseInt(row.Int) || 0);
                    s.ff = Math.max(s.ff, parseInt(row.FF) || parseInt(row.Fmb) || 0);
                    s.fr = Math.max(s.fr, parseInt(row.FR) || 0);
                    s.sacks = Math.max(s.sacks, parseFloat(row.Sk) || 0);
                }
            }
            console.log(`  - AFL Defense: ${aflDefData.length} players`);
        }
    }

    // Insert into database
    const playerCount = Object.keys(stats).length;
    console.log(`  Total unique players for ${year}: ${playerCount}`);

    let inserted = 0;
    let updated = 0;

    for (const s of Object.values(stats)) {
        const playerKey = `${s.firstName}|${s.lastName}`;

        // Find or create player
        let pfrId = playerCache.get(playerKey);

        if (pfrId) {
            // Update year range
            db.run('UPDATE players SET from_year = MIN(from_year, ?), to_year = MAX(to_year, ?) WHERE pfr_id = ?',
                [year, year, pfrId]);
            updated++;
        } else {
            // Insert new player
            db.run(`INSERT INTO players (first_name, last_name, position, from_year, to_year, scrape_status)
                    VALUES (?, ?, ?, ?, ?, 'imported')`,
                [s.firstName, s.lastName, s.position, year, year]);

            // Get the inserted ID
            const result = db.exec('SELECT last_insert_rowid() as id');
            pfrId = result[0].values[0][0];
            playerCache.set(playerKey, pfrId);
            inserted++;
        }

        // Insert or replace season stats
        db.run(`INSERT OR REPLACE INTO player_season_stats (
            pfr_id, year, team, games, games_started,
            pass_cmp, pass_att, pass_yds, pass_td, pass_int, pass_rating,
            rush_att, rush_yds, rush_td,
            rec, rec_yds, rec_td,
            tackles, sacks, def_int, ff, fr
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [pfrId, s.year, s.team, s.games, s.gamesStarted,
             s.passCmp, s.passAtt, s.passYds, s.passTd, s.passInt, s.passRating,
             s.rushAtt, s.rushYds, s.rushTd,
             s.rec, s.recYds, s.recTd,
             s.tackles, s.sacks, s.defInt, s.ff, s.fr]);
    }

    console.log(`  Inserted ${inserted} new players, updated ${updated} existing`);
}

async function main() {
    console.log('NFL Stats Importer');
    console.log('==================');
    console.log(`Database: ${DB_PATH}`);
    console.log(`Stats folder: ${STATS_FOLDER}`);

    // Initialize sql.js
    const SQL = await initSqlJs();

    // Load existing database or create new one
    let db;
    if (fs.existsSync(DB_PATH)) {
        console.log('Loading existing database...');
        const fileBuffer = fs.readFileSync(DB_PATH);
        db = new SQL.Database(fileBuffer);
    } else {
        console.log('Creating new database...');
        db = new SQL.Database();
    }

    // Ensure tables exist
    db.run(`
        CREATE TABLE IF NOT EXISTS players (
            pfr_id INTEGER PRIMARY KEY AUTOINCREMENT,
            first_name TEXT NOT NULL,
            last_name TEXT NOT NULL,
            position TEXT,
            from_year INTEGER,
            to_year INTEGER,
            is_hof INTEGER DEFAULT 0,
            scrape_status TEXT DEFAULT 'imported'
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS player_season_stats (
            pfr_id INTEGER NOT NULL,
            year INTEGER NOT NULL,
            team TEXT,
            games INTEGER DEFAULT 0,
            games_started INTEGER DEFAULT 0,
            pass_cmp INTEGER DEFAULT 0,
            pass_att INTEGER DEFAULT 0,
            pass_yds INTEGER DEFAULT 0,
            pass_td INTEGER DEFAULT 0,
            pass_int INTEGER DEFAULT 0,
            pass_rating REAL DEFAULT 0,
            rush_att INTEGER DEFAULT 0,
            rush_yds INTEGER DEFAULT 0,
            rush_td INTEGER DEFAULT 0,
            rec INTEGER DEFAULT 0,
            rec_yds INTEGER DEFAULT 0,
            rec_td INTEGER DEFAULT 0,
            tackles INTEGER DEFAULT 0,
            sacks REAL DEFAULT 0,
            def_int INTEGER DEFAULT 0,
            ff INTEGER DEFAULT 0,
            fr INTEGER DEFAULT 0,
            PRIMARY KEY (pfr_id, year),
            FOREIGN KEY (pfr_id) REFERENCES players(pfr_id)
        )
    `);

    db.run('CREATE INDEX IF NOT EXISTS idx_players_name ON players(first_name, last_name)');
    db.run('CREATE INDEX IF NOT EXISTS idx_stats_year ON player_season_stats(year)');

    // Build player cache from existing data
    const playerCache = new Map();
    const existingPlayers = db.exec('SELECT pfr_id, first_name, last_name FROM players');
    if (existingPlayers.length > 0) {
        for (const row of existingPlayers[0].values) {
            playerCache.set(`${row[1]}|${row[2]}`, row[0]);
        }
    }
    console.log(`Loaded ${playerCache.size} existing players into cache`);

    // Import each year
    for (let year = START_YEAR; year <= END_YEAR; year++) {
        // Check if at least one file exists for this year
        const passFile = path.join(STATS_FOLDER, `${year}Pass.xls`);
        if (fs.existsSync(passFile)) {
            importYear(db, year, playerCache);
        } else {
            console.log(`\nSkipping ${year} - no files found`);
        }
    }

    // Show summary
    const playerCountResult = db.exec('SELECT COUNT(*) as count FROM players');
    const statsCountResult = db.exec('SELECT COUNT(*) as count FROM player_season_stats');
    const yearRangeResult = db.exec('SELECT MIN(year) as min_year, MAX(year) as max_year FROM player_season_stats');

    const playerCount = playerCountResult[0].values[0][0];
    const statsCount = statsCountResult[0].values[0][0];
    const minYear = yearRangeResult[0].values[0][0];
    const maxYear = yearRangeResult[0].values[0][1];

    console.log('\n==================');
    console.log('Import Complete!');
    console.log(`Total players: ${playerCount}`);
    console.log(`Total season records: ${statsCount}`);
    console.log(`Year range: ${minYear} - ${maxYear}`);

    // Save database
    console.log('\nSaving database...');
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
    console.log('Database saved!');

    db.close();
}

main().catch(console.error);
