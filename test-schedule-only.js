// Test ONLY schedule changes - no other modifications
// This isolates whether schedule modification causes the crash
const fs = require('fs');
const path = require('path');

const originalPath = 'C:/Users/tshan/Documents/Madden NFL 26/saves/CAREER-REAL';
const testPath = path.dirname(originalPath) + '/TEST-SCHEDULE-ONLY';

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

async function test() {
  // Copy fresh file
  fs.copyFileSync(originalPath, testPath);
  console.log('Created test file:', testPath);

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

  // Count games by week type BEFORE
  console.log('\n=== BEFORE MODIFICATION ===');
  const weekTypeCounts = {};
  const gamesByWeek = new Map();

  for (const rec of gameTable.records) {
    if (rec.isEmpty) continue;
    const weekType = rec.SeasonWeekType || rec.Field_53;
    const typeKey = String(weekType);
    weekTypeCounts[typeKey] = (weekTypeCounts[typeKey] || 0) + 1;

    // Only collect RegularSeason games
    const isRegularSeason = weekType === 1 || weekType === 'RegularSeason';
    if (isRegularSeason) {
      const weekNum = rec.SeasonWeek !== undefined ? rec.SeasonWeek : rec.Field_52;
      if (!gamesByWeek.has(weekNum)) {
        gamesByWeek.set(weekNum, []);
      }
      gamesByWeek.get(weekNum).push(rec);
    }
  }
  console.log('Games by week type:', weekTypeCounts);
  console.log('Regular season weeks:', [...gamesByWeek.keys()].sort((a, b) => a - b));

  // Load a simple 1995 schedule (or create fake one for testing)
  // For testing, just swap teams in first few games of week 0
  console.log('\n=== MODIFYING SCHEDULE ===');

  // Get week 0 games (first week of regular season in Madden's 0-indexed weeks)
  const week0Games = gamesByWeek.get(0) || [];
  console.log('Week 0 games:', week0Games.length);

  let gamesModified = 0;

  // Modify just the first 5 games - swap home and away
  for (let i = 0; i < Math.min(5, week0Games.length); i++) {
    const game = week0Games[i];
    const oldHome = game.HomeTeam;
    const oldAway = game.AwayTeam;

    // Just swap home and away
    console.log(`Game ${i}: Swapping home/away`);
    console.log(`  Before: Home=${oldHome.slice(-8)}, Away=${oldAway.slice(-8)}`);

    game.HomeTeam = oldAway;
    game.AwayTeam = oldHome;

    console.log(`  After: Home=${game.HomeTeam.slice(-8)}, Away=${game.AwayTeam.slice(-8)}`);
    gamesModified++;
  }

  console.log(`Modified ${gamesModified} games (home/away swap)`);

  // Also test marking a game as OffSeason (this is what we do for extra weeks)
  console.log('\n=== MARKING LAST WEEK AS OFFSEASON ===');
  const maxWeek = Math.max(...gamesByWeek.keys());
  const lastWeekGames = gamesByWeek.get(maxWeek) || [];
  console.log(`Week ${maxWeek} has ${lastWeekGames.length} games`);

  let offseasonMarked = 0;
  for (const game of lastWeekGames) {
    try {
      // Try setting SeasonWeekType to OffSeason
      game.SeasonWeekType = 'OffSeason';
      game.HomeTeam = '00000000000000000000000000000000';
      game.AwayTeam = '00000000000000000000000000000000';
      game.GameStatus = 'Unplayed';
      offseasonMarked++;
    } catch (e) {
      console.log('Error marking game as OffSeason:', e.message);
    }
  }
  console.log(`Marked ${offseasonMarked} games as OffSeason`);

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

  const weekTypeCountsAfter = {};
  for (const rec of gameTable2.records) {
    if (rec.isEmpty) continue;
    const weekType = rec.SeasonWeekType || rec.Field_53;
    const typeKey = String(weekType);
    weekTypeCountsAfter[typeKey] = (weekTypeCountsAfter[typeKey] || 0) + 1;
  }
  console.log('Games by week type after:', weekTypeCountsAfter);

  console.log('\n✅ Test complete');
  console.log('Test file:', testPath);
  console.log('>>> Load this file in Madden and try to sim - if it crashes, schedule modification is the issue');
}

test().catch(console.error);
