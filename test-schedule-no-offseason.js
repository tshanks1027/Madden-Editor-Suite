// Test schedule WITHOUT marking extra weeks as OffSeason
// Instead, just leave extra weeks as-is (don't touch them)
const fs = require('fs');
const path = require('path');

const originalPath = 'C:/Users/tshan/Documents/Madden NFL 26/saves/CAREER-REAL';
const testPath = path.dirname(originalPath) + '/CAREER-SCHEDULE-NO-OFFSEASON';
const YEAR = 1995;

const TABLE_IDS = {
  teamTable: 637929298,
  gameTable: 2816609684,
};

function getGameField(record, fieldName) {
  const fieldMap = {
    SeasonWeek: 'Field_52',
    SeasonWeekType: 'Field_53',
  };
  try {
    const value = record[fieldName];
    if (value !== undefined) return value;
    const generic = fieldMap[fieldName];
    if (generic && record[generic] !== undefined) return record[generic];
  } catch (e) {}
  return undefined;
}

async function loadSchedule(year) {
  const schedulePath = path.join(__dirname, 'data', 'retro', 'schedules', `${year}.json`);
  if (!fs.existsSync(schedulePath)) return null;
  return JSON.parse(fs.readFileSync(schedulePath, 'utf-8'));
}

async function test() {
  fs.copyFileSync(originalPath, testPath);
  console.log('Created test file:', testPath);

  const schedule = await loadSchedule(YEAR);
  if (!schedule) {
    console.log('No schedule for year', YEAR);
    return;
  }
  console.log('Loaded schedule:', schedule.games.length, 'games');

  const FranchiseModule = await import('madden-franchise');
  const franchise = await FranchiseModule.create(testPath);

  // Get team table
  let teamTable = franchise.getTableByUniqueId(TABLE_IDS.teamTable);
  if (!teamTable) teamTable = franchise.getTableByName('Team');
  await teamTable.readRecords();

  const teamIndexToRecordIndex = new Map();
  for (const team of teamTable.records) {
    if (team.isEmpty) continue;
    const teamIndex = team.TeamIndex;
    if (teamIndex !== undefined && teamIndex < 32) {
      teamIndexToRecordIndex.set(teamIndex, team.index);
    }
  }

  // Get game table
  let gameTable = franchise.getTableByName('SeasonGame');
  if (!gameTable) gameTable = franchise.getTableByUniqueId(TABLE_IDS.gameTable);
  await gameTable.readRecords();

  // Find team ref prefix
  let teamRefPrefix = '001011100011101000000000';
  for (const rec of gameTable.records) {
    if (rec.isEmpty) continue;
    const homeTeam = rec.HomeTeam;
    if (homeTeam && homeTeam !== '00000000000000000000000000000000' && homeTeam.length === 32) {
      teamRefPrefix = homeTeam.slice(0, 24);
      break;
    }
  }

  const createTeamRef = (teamIndex) => {
    const recordIndex = teamIndexToRecordIndex.get(teamIndex);
    if (recordIndex === undefined) return '00000000000000000000000000000000';
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

  // Group franchise games by week
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

  const maxHistoricalWeek = Math.max(...gamesByWeek.keys());
  console.log('Max historical week:', maxHistoricalWeek);
  console.log('Franchise weeks:', [...franchiseGamesByWeek.keys()].sort((a, b) => a - b));

  let gamesUpdated = 0;
  let gamesSkipped = 0;

  console.log('\n=== APPLYING SCHEDULE (NO OFFSEASON MARKING) ===');

  for (const [maddenWeekNum, franchiseGames] of franchiseGamesByWeek) {
    const historicalWeekNum = maddenWeekNum + 1;
    const historicalGames = gamesByWeek.get(historicalWeekNum);

    if (!historicalGames || historicalGames.length === 0) {
      // NO HISTORICAL GAMES - but DON'T mark as OffSeason!
      // Just leave these games untouched
      if (historicalWeekNum > maxHistoricalWeek) {
        console.log(`Week ${maddenWeekNum}: SKIPPING ${franchiseGames.length} games (beyond historical season - leaving as-is)`);
        gamesSkipped += franchiseGames.length;
      }
      continue;
    }

    // Assign games to slots
    const gamesThisWeek = Math.min(franchiseGames.length, historicalGames.length);
    for (let i = 0; i < gamesThisWeek; i++) {
      const franchiseRecord = franchiseGames[i];
      const historicalGame = historicalGames[i];

      const homeTeamRef = createTeamRef(historicalGame.homeTeamIndex);
      const awayTeamRef = createTeamRef(historicalGame.awayTeamIndex);

      franchiseRecord.HomeTeam = homeTeamRef;
      franchiseRecord.AwayTeam = awayTeamRef;
      franchiseRecord.GameStatus = 'Unplayed';
      gamesUpdated++;

      if (gamesUpdated <= 3) {
        console.log(`Week ${maddenWeekNum}: ${historicalGame.awayTeam} @ ${historicalGame.homeTeam}`);
      }
    }

    // Handle extra slots - DON'T mark as OffSeason, just skip them
    if (franchiseGames.length > historicalGames.length) {
      const extraCount = franchiseGames.length - historicalGames.length;
      console.log(`Week ${maddenWeekNum}: SKIPPING ${extraCount} extra slots (leaving as-is)`);
      gamesSkipped += extraCount;
    }
  }

  console.log(`\nUpdated ${gamesUpdated} games`);
  console.log(`Skipped ${gamesSkipped} games (left untouched)`);

  // Save
  console.log('\n=== SAVING ===');
  await franchise.save(testPath);
  console.log('File saved');

  // Verify
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
  console.log('>>> This file does NOT mark any games as OffSeason');
  console.log('>>> Load in Madden and sim to see if it works');
}

test().catch(console.error);
