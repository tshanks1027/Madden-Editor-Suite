// Test the REAL schedule application using ScheduleService
// This simulates exactly what the retro editor does
const fs = require('fs');
const path = require('path');

const originalPath = 'C:/Users/tshan/Documents/Madden NFL 26/saves/CAREER-REAL';
const testPath = path.dirname(originalPath) + '/TEST-REAL-SCHEDULE';
const YEAR = 1995;

const TABLE_IDS = {
  teamTable: 637929298,
  gameTable: 2816609684,
  seasonInfoTable: 3123991521,
};

const SEASON_WEEK_TYPES = {
  PreSeason: 0,
  RegularSeason: 1,
  WildCard: 2,
  Divisional: 3,
  Conference: 4,
  SuperBowl: 5,
  ProBowl: 6,
  PostSeason: 7,
  OffSeason: 8,
};

function getGameField(record, fieldName) {
  const fieldMap = {
    SeasonWeek: 'Field_52',
    SeasonWeekType: 'Field_53',
    GameStatus: 'Field_18',
  };
  try {
    const value = record[fieldName];
    if (value !== undefined) return value;
    const generic = fieldMap[fieldName];
    if (generic && record[generic] !== undefined) return record[generic];
  } catch (e) {}
  return undefined;
}

function setGameField(record, fieldName, value) {
  const fieldMap = {
    SeasonWeekType: 'Field_53',
  };

  if (fieldName === 'SeasonWeekType') {
    // Convert numeric to string
    const weekTypeMap = {
      0: 'PreSeason',
      1: 'RegularSeason',
      8: 'OffSeason',
    };
    const strValue = typeof value === 'number' ? (weekTypeMap[value] || 'PreSeason') : value;

    try {
      record[fieldName] = strValue;
      return;
    } catch (e) {}

    try {
      record[fieldMap[fieldName]] = strValue;
      return;
    } catch (e) {}
  }

  try {
    record[fieldName] = value;
  } catch (e) {
    try {
      record[fieldMap[fieldName]] = value;
    } catch (e2) {}
  }
}

async function loadSchedule(year) {
  // Load the schedule JSON directly
  const schedulePath = path.join(__dirname, 'data', 'retro', 'schedules', `${year}.json`);
  if (!fs.existsSync(schedulePath)) {
    console.log('No schedule file for year:', year);
    return null;
  }
  return JSON.parse(fs.readFileSync(schedulePath, 'utf-8'));
}

async function test() {
  // Copy fresh file
  fs.copyFileSync(originalPath, testPath);
  console.log('Created test file:', testPath);

  const schedule = await loadSchedule(YEAR);
  if (!schedule) {
    console.log('No schedule for year', YEAR);
    return;
  }
  console.log('Loaded schedule:', schedule.games.length, 'games');
  console.log('Regular season weeks:', schedule.regularSeasonWeeks);

  const FranchiseModule = await import('madden-franchise');
  const franchise = await FranchiseModule.create(testPath);

  // Get team table for reference format
  let teamTable = franchise.getTableByUniqueId(TABLE_IDS.teamTable);
  if (!teamTable) teamTable = franchise.getTableByName('Team');
  await teamTable.readRecords();

  // Build TeamIndex -> RecordIndex mapping
  const teamIndexToRecordIndex = new Map();
  for (const team of teamTable.records) {
    if (team.isEmpty) continue;
    const teamIndex = team.TeamIndex;
    if (teamIndex !== undefined && teamIndex < 32) {
      teamIndexToRecordIndex.set(teamIndex, team.index);
    }
  }
  console.log('Built team mapping for', teamIndexToRecordIndex.size, 'teams');

  // Get game table
  let gameTable = franchise.getTableByName('SeasonGame');
  if (!gameTable) gameTable = franchise.getTableByUniqueId(TABLE_IDS.gameTable);
  await gameTable.readRecords();
  console.log('Loaded', gameTable.records.length, 'game records');

  // Find reference prefix from existing game
  let teamRefPrefix = '001011100011101000000000'; // Default
  for (const rec of gameTable.records) {
    if (rec.isEmpty) continue;
    const homeTeam = rec.HomeTeam;
    if (homeTeam && homeTeam !== '00000000000000000000000000000000' && homeTeam.length === 32) {
      teamRefPrefix = homeTeam.slice(0, 24);
      console.log('Found team ref prefix:', teamRefPrefix);
      break;
    }
  }

  // Helper to create team reference
  const createTeamRef = (teamIndex) => {
    const recordIndex = teamIndexToRecordIndex.get(teamIndex);
    if (recordIndex === undefined) {
      console.warn('No record index for TeamIndex', teamIndex);
      return '00000000000000000000000000000000';
    }
    return teamRefPrefix + recordIndex.toString(2).padStart(8, '0');
  };

  // Group schedule games by week
  const gamesByWeek = new Map();
  for (const game of schedule.games) {
    if (game.weekType !== 'regular') continue;
    if (!gamesByWeek.has(game.week)) {
      gamesByWeek.set(game.week, []);
    }
    gamesByWeek.get(game.week).push(game);
  }
  console.log('Historical schedule weeks:', [...gamesByWeek.keys()].sort((a, b) => a - b));

  // Group franchise game records by week
  const franchiseGamesByWeek = new Map();
  for (const record of gameTable.records) {
    if (record.isEmpty) continue;
    const weekType = getGameField(record, 'SeasonWeekType');
    const isRegularSeason = weekType === 1 || weekType === 'RegularSeason';
    if (!isRegularSeason) continue;

    const weekNum = getGameField(record, 'SeasonWeek');
    if (weekNum === undefined || weekNum === null) continue;

    if (!franchiseGamesByWeek.has(weekNum)) {
      franchiseGamesByWeek.set(weekNum, []);
    }
    franchiseGamesByWeek.get(weekNum).push(record);
  }
  console.log('Franchise weeks:', [...franchiseGamesByWeek.keys()].sort((a, b) => a - b));

  // Get max historical week
  const maxHistoricalWeek = Math.max(...gamesByWeek.keys());
  console.log('Max historical week:', maxHistoricalWeek);

  let gamesUpdated = 0;
  const warnings = [];

  // Apply schedule
  console.log('\n=== APPLYING SCHEDULE ===');

  for (const [maddenWeekNum, franchiseGames] of franchiseGamesByWeek) {
    // Map Madden week to historical week (shift by +1)
    const historicalWeekNum = maddenWeekNum + 1;
    const historicalGames = gamesByWeek.get(historicalWeekNum);

    if (!historicalGames || historicalGames.length === 0) {
      // No historical games for this week
      if (historicalWeekNum > maxHistoricalWeek) {
        console.log(`Week ${maddenWeekNum}: Marking ${franchiseGames.length} games as OffSeason (beyond historical season)`);
        for (const rec of franchiseGames) {
          try {
            setGameField(rec, 'SeasonWeekType', 'OffSeason');
            rec.HomeTeam = '00000000000000000000000000000000';
            rec.AwayTeam = '00000000000000000000000000000000';
            rec.GameStatus = 'Unplayed';
            gamesUpdated++;
          } catch (e) {
            console.error('Error marking game as OffSeason:', e.message);
          }
        }
      }
      continue;
    }

    // Assign games to slots
    const gamesThisWeek = Math.min(franchiseGames.length, historicalGames.length);
    for (let i = 0; i < gamesThisWeek; i++) {
      try {
        const franchiseRecord = franchiseGames[i];
        const historicalGame = historicalGames[i];

        const homeTeamRef = createTeamRef(historicalGame.homeTeamIndex);
        const awayTeamRef = createTeamRef(historicalGame.awayTeamIndex);

        franchiseRecord.HomeTeam = homeTeamRef;
        franchiseRecord.AwayTeam = awayTeamRef;
        franchiseRecord.GameStatus = 'Unplayed';
        gamesUpdated++;

        if (gamesUpdated <= 5) {
          console.log(`Week ${maddenWeekNum}: ${historicalGame.awayTeam} @ ${historicalGame.homeTeam}`);
        }
      } catch (e) {
        console.error('Error setting game:', e.message);
      }
    }

    // Handle extra slots
    if (franchiseGames.length > historicalGames.length) {
      const extraCount = franchiseGames.length - historicalGames.length;
      console.log(`Week ${maddenWeekNum}: Marking ${extraCount} extra slots as OffSeason`);
      for (let i = historicalGames.length; i < franchiseGames.length; i++) {
        try {
          const rec = franchiseGames[i];
          setGameField(rec, 'SeasonWeekType', 'OffSeason');
          rec.HomeTeam = '00000000000000000000000000000000';
          rec.AwayTeam = '00000000000000000000000000000000';
          rec.GameStatus = 'Unplayed';
          gamesUpdated++;
        } catch (e) {
          console.error('Error marking extra slot:', e.message);
        }
      }
    }
  }

  console.log(`\nUpdated ${gamesUpdated} games`);

  // Save
  console.log('\n=== SAVING ===');
  await franchise.save(testPath);
  console.log('File saved');

  // Reload and verify
  console.log('\n=== VERIFYING ===');
  const franchise2 = await FranchiseModule.create(testPath);
  const gameTable2 = franchise2.getTableByName('SeasonGame') ||
                     franchise2.getTableByUniqueId(TABLE_IDS.gameTable);
  await gameTable2.readRecords();

  const weekTypeCounts = {};
  for (const rec of gameTable2.records) {
    if (rec.isEmpty) continue;
    const weekType = getGameField(rec, 'SeasonWeekType');
    const typeKey = String(weekType);
    weekTypeCounts[typeKey] = (weekTypeCounts[typeKey] || 0) + 1;
  }
  console.log('Games by week type after:', weekTypeCounts);

  console.log('\n✅ Test complete');
  console.log('Test file:', testPath);
  console.log('>>> Load this file in Madden and try to sim a week');
  console.log('>>> If it crashes, the full schedule application is the issue');
}

test().catch(console.error);
