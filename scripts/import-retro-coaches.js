/**
 * Import Retro Coaches Script
 *
 * Reads all retro coach JSON files (1966-2024) and imports coaches into the database
 * with their year-by-year season stats.
 */

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const RETRO_COACHES_DIR = path.join(__dirname, '..', 'data', 'retro', 'coaches');
const USER_DB_PATH = path.join(process.env.APPDATA || process.env.HOME, 'madden-editor-suite', 'user-database.db');

// Ensure database directory exists
const dbDir = path.dirname(USER_DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

console.log('Database path:', USER_DB_PATH);

// Open database
const db = new Database(USER_DB_PATH);

// Ensure tables exist
db.exec(`
  CREATE TABLE IF NOT EXISTS custom_coaches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    team_index INTEGER,
    position TEXT,
    experience INTEGER,
    age INTEGER,
    career_from INTEGER,
    career_to INTEGER,
    madden_pid INTEGER,
    madden_pam TEXT,
    career_wins INTEGER DEFAULT 0,
    career_losses INTEGER DEFAULT 0,
    career_ties INTEGER DEFAULT 0,
    career_playoff_wins INTEGER DEFAULT 0,
    career_playoff_losses INTEGER DEFAULT 0,
    career_sb_wins INTEGER DEFAULT 0,
    career_sb_losses INTEGER DEFAULT 0,
    source TEXT DEFAULT 'retro',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    edited_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS custom_coach_seasons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    custom_coach_id INTEGER NOT NULL,
    year INTEGER NOT NULL,
    team TEXT,
    team_index INTEGER,
    position TEXT,
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    ties INTEGER DEFAULT 0,
    playoff_wins INTEGER DEFAULT 0,
    playoff_losses INTEGER DEFAULT 0,
    super_bowl_win INTEGER DEFAULT 0,
    years_as_hc INTEGER DEFAULT 0,
    years_with_team INTEGER DEFAULT 0,
    FOREIGN KEY (custom_coach_id) REFERENCES custom_coaches(id) ON DELETE CASCADE,
    UNIQUE(custom_coach_id, year, position)
  );

  CREATE INDEX IF NOT EXISTS idx_custom_coach_seasons_coach ON custom_coach_seasons(custom_coach_id);
  CREATE INDEX IF NOT EXISTS idx_custom_coach_seasons_year ON custom_coach_seasons(year);
`);

// Read all retro coach files
const files = fs.readdirSync(RETRO_COACHES_DIR)
  .filter(f => f.endsWith('.json'))
  .sort((a, b) => parseInt(a) - parseInt(b));

console.log(`Found ${files.length} retro coach files`);

// Build coach database
const coaches = new Map(); // key -> { coach data, seasons: [] }

for (const file of files) {
  const year = parseInt(file.replace('.json', ''));
  const filePath = path.join(RETRO_COACHES_DIR, file);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  for (const team of data.teams || []) {
    const teamAbbr = team.teamAbbr;
    const teamIndex = team.teamIndex;

    // Process Head Coach
    if (team.headCoach && team.headCoach.lastName) {
      const hc = team.headCoach;
      const key = `${hc.lastName}_${hc.firstName || ''}`.toLowerCase();

      if (!coaches.has(key)) {
        coaches.set(key, {
          firstName: hc.firstName || '',
          lastName: hc.lastName,
          seasons: []
        });
      }

      coaches.get(key).seasons.push({
        year,
        team: teamAbbr,
        teamIndex,
        position: 'HC',
        wins: hc.careerWins || 0,
        losses: hc.careerLosses || 0,
        ties: hc.careerTies || 0,
        playoffWins: hc.playoffWins || 0,
        playoffLosses: hc.playoffLosses || 0,
        superBowlWins: hc.superBowlWins || 0,
        yearsAsHC: hc.yearsAsHC || 0,
        yearsWithTeam: hc.yearsWithTeam || 0
      });
    }

    // Process Offensive Coordinator
    if (team.offensiveCoordinator && team.offensiveCoordinator.lastName) {
      const oc = team.offensiveCoordinator;
      const key = `${oc.lastName}_${oc.firstName || ''}`.toLowerCase();

      if (!coaches.has(key)) {
        coaches.set(key, {
          firstName: oc.firstName || '',
          lastName: oc.lastName,
          seasons: []
        });
      }

      coaches.get(key).seasons.push({
        year,
        team: teamAbbr,
        teamIndex,
        position: 'OC',
        wins: 0,
        losses: 0,
        ties: 0,
        playoffWins: 0,
        playoffLosses: 0,
        superBowlWins: 0,
        yearsAsHC: 0,
        yearsWithTeam: 0
      });
    }

    // Process Defensive Coordinator
    if (team.defensiveCoordinator && team.defensiveCoordinator.lastName) {
      const dc = team.defensiveCoordinator;
      const key = `${dc.lastName}_${dc.firstName || ''}`.toLowerCase();

      if (!coaches.has(key)) {
        coaches.set(key, {
          firstName: dc.firstName || '',
          lastName: dc.lastName,
          seasons: []
        });
      }

      coaches.get(key).seasons.push({
        year,
        team: teamAbbr,
        teamIndex,
        position: 'DC',
        wins: 0,
        losses: 0,
        ties: 0,
        playoffWins: 0,
        playoffLosses: 0,
        superBowlWins: 0,
        yearsAsHC: 0,
        yearsWithTeam: 0
      });
    }
  }
}

console.log(`Processed ${coaches.size} unique coaches`);

// Prepare statements
const insertCoach = db.prepare(`
  INSERT OR REPLACE INTO custom_coaches
  (first_name, last_name, career_from, career_to, career_wins, career_losses, career_ties,
   career_playoff_wins, career_playoff_losses, career_sb_wins, source)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'retro')
`);

const insertSeason = db.prepare(`
  INSERT OR REPLACE INTO custom_coach_seasons
  (custom_coach_id, year, team, team_index, position, wins, losses, ties,
   playoff_wins, playoff_losses, super_bowl_win, years_as_hc, years_with_team)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

// Check for existing retro coaches
const existingCount = db.prepare("SELECT COUNT(*) as count FROM custom_coaches WHERE source = 'retro'").get();
if (existingCount.count > 0) {
  console.log(`Found ${existingCount.count} existing retro coaches. Clearing...`);
  db.exec("DELETE FROM custom_coach_seasons WHERE custom_coach_id IN (SELECT id FROM custom_coaches WHERE source = 'retro')");
  db.exec("DELETE FROM custom_coaches WHERE source = 'retro'");
}

// Insert coaches and seasons
const insertAll = db.transaction(() => {
  let coachCount = 0;
  let seasonCount = 0;

  for (const [key, coachData] of coaches) {
    // Sort seasons by year
    coachData.seasons.sort((a, b) => a.year - b.year);

    // Get career span
    const years = coachData.seasons.map(s => s.year);
    const careerFrom = Math.min(...years);
    const careerTo = Math.max(...years);

    // Get final career stats (from most recent HC season)
    const hcSeasons = coachData.seasons.filter(s => s.position === 'HC');
    const finalStats = hcSeasons.length > 0
      ? hcSeasons[hcSeasons.length - 1]
      : { wins: 0, losses: 0, ties: 0, playoffWins: 0, playoffLosses: 0, superBowlWins: 0 };

    // Insert coach
    const result = insertCoach.run(
      coachData.firstName,
      coachData.lastName,
      careerFrom,
      careerTo,
      finalStats.wins,
      finalStats.losses,
      finalStats.ties,
      finalStats.playoffWins,
      finalStats.playoffLosses,
      finalStats.superBowlWins
    );

    const coachId = result.lastInsertRowid;
    coachCount++;

    // Insert seasons
    for (const season of coachData.seasons) {
      insertSeason.run(
        coachId,
        season.year,
        season.team,
        season.teamIndex,
        season.position,
        season.wins,
        season.losses,
        season.ties,
        season.playoffWins,
        season.playoffLosses,
        season.superBowlWins ? 1 : 0,
        season.yearsAsHC,
        season.yearsWithTeam
      );
      seasonCount++;
    }
  }

  return { coachCount, seasonCount };
});

const result = insertAll();
console.log(`\nImport complete!`);
console.log(`  Coaches imported: ${result.coachCount}`);
console.log(`  Season records: ${result.seasonCount}`);

// Show sample data
console.log('\nSample coaches:');
const sampleCoaches = db.prepare(`
  SELECT c.*,
    (SELECT COUNT(*) FROM custom_coach_seasons WHERE custom_coach_id = c.id) as season_count
  FROM custom_coaches c
  WHERE source = 'retro'
  ORDER BY career_wins DESC
  LIMIT 10
`).all();

for (const coach of sampleCoaches) {
  console.log(`  ${coach.first_name} ${coach.last_name}: ${coach.career_from}-${coach.career_to}, ${coach.career_wins}-${coach.career_losses}-${coach.career_ties}, ${coach.season_count} seasons`);
}

db.close();
console.log('\nDone!');
