// Test script to verify schedule insertion into franchise file
// This tests the applyHistoricalSchedule logic without the full Electron app

const path = require('path');
const fs = require('fs');

const TABLE_IDS = {
  seasonInfoTable: 3123991521,
  teamTable: 637929298,
  gameTable: 2816609684
};

async function testScheduleInsertion(filePath, year) {
  console.log(`\n========================================`);
  console.log(`Testing schedule insertion for year ${year}`);
  console.log(`Franchise file: ${filePath}`);
  console.log(`========================================\n`);

  // Load the franchise file
  const module = await import('madden-franchise');
  const createFranchise = module.create;

  const franchise = await createFranchise(filePath);
  console.log('Franchise file loaded successfully');

  // Load schedule data
  const schedulePath = path.join(__dirname, 'data', 'retro', 'schedules', `${year}.json`);
  if (!fs.existsSync(schedulePath)) {
    console.error(`Schedule file not found: ${schedulePath}`);
    return;
  }

  const schedule = JSON.parse(fs.readFileSync(schedulePath, 'utf-8'));
  console.log(`Loaded schedule for ${year}: ${schedule.games.length} total games`);

  // Get the Team table and build TeamIndex → RecordIndex mapping
  let teamTable = franchise.getTableByUniqueId(TABLE_IDS.teamTable);
  if (!teamTable) {
    teamTable = franchise.getTableByName('Team');
  }
  await teamTable.readRecords();

  const teamIndexToRecordIndex = new Map();
  const recordIndexToTeamName = new Map();
  for (const team of teamTable.records) {
    if (team.isEmpty) continue;
    const teamIndex = team.TeamIndex;
    if (teamIndex !== undefined && teamIndex < 32) {
      teamIndexToRecordIndex.set(teamIndex, team.index);
      recordIndexToTeamName.set(team.index, team.ShortName);
    }
  }
  console.log(`Built team mapping for ${teamIndexToRecordIndex.size} teams`);

  // Get the SeasonGame table
  let gameTable = franchise.getTableByUniqueId(TABLE_IDS.gameTable);
  if (!gameTable) {
    gameTable = franchise.getTableByName('SeasonGame');
  }
  await gameTable.readRecords();
  console.log(`Found ${gameTable.records.length} game records`);

  // Find the reference prefix from an existing game record
  let teamRefPrefix = '001011100011101000000000';
  for (const record of gameTable.records) {
    if (record.isEmpty) continue;
    const homeTeam = record.HomeTeam;
    if (homeTeam && homeTeam !== '00000000000000000000000000000000' && homeTeam.length === 32) {
      teamRefPrefix = homeTeam.slice(0, 24);
      console.log(`Extracted team reference prefix: ${teamRefPrefix}`);
      break;
    }
  }

  // Helper function to create team reference
  const createTeamRef = (teamIndex) => {
    const recordIndex = teamIndexToRecordIndex.get(teamIndex);
    if (recordIndex === undefined) {
      console.warn(`No record index for TeamIndex ${teamIndex}`);
      return '00000000000000000000000000000000';
    }
    return teamRefPrefix + recordIndex.toString(2).padStart(8, '0');
  };

  // Group schedule games by week (regular season only)
  const gamesByWeek = new Map();
  for (const game of schedule.games) {
    if (game.weekType !== 'regular') continue;
    if (!gamesByWeek.has(game.week)) {
      gamesByWeek.set(game.week, []);
    }
    gamesByWeek.get(game.week).push(game);
  }
  console.log(`Schedule has ${gamesByWeek.size} weeks of regular season games`);

  // Group franchise game records by week (regular season only)
  const franchiseGamesByWeek = new Map();
  for (const record of gameTable.records) {
    if (record.isEmpty) continue;
    const weekType = record.SeasonWeekType;
    if (weekType !== 'RegularSeason') continue;
    const weekNum = record.SeasonWeek;
    if (weekNum === undefined || weekNum === null) continue;

    if (!franchiseGamesByWeek.has(weekNum)) {
      franchiseGamesByWeek.set(weekNum, []);
    }
    franchiseGamesByWeek.get(weekNum).push(record);
  }
  console.log(`Franchise file has ${franchiseGamesByWeek.size} weeks of regular season game slots`);

  // Show current Week 1 games BEFORE update
  console.log('\n--- Week 1 games BEFORE update ---');
  const week1Games = franchiseGamesByWeek.get(1) || [];
  for (let i = 0; i < Math.min(3, week1Games.length); i++) {
    const game = week1Games[i];
    const homeRecordIdx = parseInt(game.HomeTeam?.slice(-8) || '0', 2);
    const awayRecordIdx = parseInt(game.AwayTeam?.slice(-8) || '0', 2);
    console.log(`  Game ${i+1}: ${recordIndexToTeamName.get(awayRecordIdx) || 'N/A'} @ ${recordIndexToTeamName.get(homeRecordIdx) || 'N/A'}`);
  }

  // Apply schedule (test mode - just update Week 1)
  console.log('\n--- Applying Week 1 schedule ---');
  const historicalWeek1 = gamesByWeek.get(1);
  if (historicalWeek1 && week1Games.length > 0) {
    const gamesToUpdate = Math.min(week1Games.length, historicalWeek1.length);
    console.log(`Updating ${gamesToUpdate} games for Week 1`);

    for (let i = 0; i < gamesToUpdate; i++) {
      const franchiseRecord = week1Games[i];
      const historicalGame = historicalWeek1[i];

      const homeTeamRef = createTeamRef(historicalGame.homeTeamIndex);
      const awayTeamRef = createTeamRef(historicalGame.awayTeamIndex);

      // Update the record
      franchiseRecord.HomeTeam = homeTeamRef;
      franchiseRecord.AwayTeam = awayTeamRef;

      if (i < 5) {
        console.log(`  Updated Game ${i+1}: ${historicalGame.awayTeam} @ ${historicalGame.homeTeam}`);
        console.log(`    HomeTeam ref: ${homeTeamRef} (TeamIndex ${historicalGame.homeTeamIndex})`);
        console.log(`    AwayTeam ref: ${awayTeamRef} (TeamIndex ${historicalGame.awayTeamIndex})`);
      }
    }
  }

  // Show Week 1 games AFTER update
  console.log('\n--- Week 1 games AFTER update ---');
  for (let i = 0; i < Math.min(5, week1Games.length); i++) {
    const game = week1Games[i];
    const homeRecordIdx = parseInt(game.HomeTeam?.slice(-8) || '0', 2);
    const awayRecordIdx = parseInt(game.AwayTeam?.slice(-8) || '0', 2);
    const homeName = recordIndexToTeamName.get(homeRecordIdx) || 'N/A';
    const awayName = recordIndexToTeamName.get(awayRecordIdx) || 'N/A';
    const expectedHome = historicalWeek1?.[i]?.homeTeam || 'N/A';
    const expectedAway = historicalWeek1?.[i]?.awayTeam || 'N/A';
    console.log(`  Game ${i+1}: ${awayName} @ ${homeName}`);
    console.log(`    Expected: ${expectedAway} @ ${expectedHome}`);
    console.log(`    Match: ${homeName.includes(expectedHome.split(' ').pop()) && awayName.includes(expectedAway.split(' ').pop()) ? 'YES' : 'CHECK MAPPING'}`);
  }

  // Don't save changes in test mode
  console.log('\n[TEST MODE] Changes NOT saved to file');
}

// Run
const args = process.argv.slice(2);
if (args.length < 2) {
  console.log('Usage: node test-schedule-insertion.js <franchise-file-path> <year>');
  console.log('Example: node test-schedule-insertion.js path/to/franchise 2024');
  process.exit(1);
}

testScheduleInsertion(args[0], parseInt(args[1])).catch(console.error);
