// Test the Week 0 fix for schedule application

const fs = require('fs');
const path = require('path');

const TABLE_IDS = {
  teamTable: 637929298,
  gameTable: 2816609684,
};

async function testWeek0Fix() {
  const module = await import('madden-franchise');

  // Create a test copy
  const originalPath = 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden NFL 26\\Saves\\CAREER-NOV23-05h38m58p-AUTOSAVE';
  const testPath = originalPath + '-WEEK0-TEST';
  fs.copyFileSync(originalPath, testPath);

  const franchise = await module.create(testPath, {
    schemaDirectory: 'C:\\Users\\tshan\\AppData\\Local\\Programs\\MyFranchise'
  });

  // Get team table
  const teamTable = franchise.getTableByUniqueId(TABLE_IDS.teamTable);
  await teamTable.readRecords();

  const teamIndexToRecordIndex = new Map();
  const recordIndexToTeam = new Map();

  for (const team of teamTable.records) {
    if (team.isEmpty) continue;
    const teamIndex = team.TeamIndex;
    if (teamIndex !== undefined && teamIndex < 32) {
      teamIndexToRecordIndex.set(teamIndex, team.index);
      recordIndexToTeam.set(team.index, team.ShortName);
    }
  }

  // Load 1980 schedule (14-game weeks)
  const schedulePath = path.join(__dirname, 'data', 'retro', 'schedules', '1980.json');
  const schedule = JSON.parse(fs.readFileSync(schedulePath, 'utf-8'));

  // Group by week
  const gamesByWeek = new Map();
  for (const game of schedule.games) {
    if (game.weekType !== 'regular') continue;
    if (!gamesByWeek.has(game.week)) {
      gamesByWeek.set(game.week, []);
    }
    gamesByWeek.get(game.week).push(game);
  }

  console.log('=== 1980 Schedule Summary ===\n');
  console.log(`Total weeks: ${gamesByWeek.size}`);
  for (const [week, games] of gamesByWeek) {
    console.log(`  Week ${week}: ${games.length} games`);
  }

  // Get game table
  let gameTable = franchise.getTableByUniqueId(TABLE_IDS.gameTable);
  if (!gameTable) {
    gameTable = franchise.getTableByName('SeasonGame');
  }
  await gameTable.readRecords();

  // Find team ref prefix
  let teamRefPrefix = '001011100011101000000000';
  for (const record of gameTable.records) {
    if (record.isEmpty) continue;
    const homeTeam = record.HomeTeam;
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

  // Group franchise games by week
  const franchiseGamesByWeek = new Map();
  for (const record of gameTable.records) {
    if (record.isEmpty) continue;
    if (record.SeasonWeekType !== 1 && record.SeasonWeekType !== 'RegularSeason') continue;

    const weekNum = record.SeasonWeek;
    if (!franchiseGamesByWeek.has(weekNum)) {
      franchiseGamesByWeek.set(weekNum, []);
    }
    franchiseGamesByWeek.get(weekNum).push(record);
  }

  console.log('\n=== Franchise Game Slots ===\n');
  for (const [week, games] of franchiseGamesByWeek) {
    console.log(`  Week ${week}: ${games.length} slots`);
  }

  // Apply schedule using new logic
  console.log('\n=== Applying Schedule with Week 0 Fix ===\n');

  let gamesUpdated = 0;

  // Handle Week 0 first (fill with Week 1 games)
  const week0Slots = franchiseGamesByWeek.get(0) || [];
  const week1Games = gamesByWeek.get(1) || [];

  console.log(`Week 0: ${week0Slots.length} slots, using ${Math.min(week0Slots.length, week1Games.length)} Week 1 games`);

  for (let i = 0; i < week0Slots.length && i < week1Games.length; i++) {
    const slot = week0Slots[i];
    const game = week1Games[i];

    slot.HomeTeam = createTeamRef(game.homeTeamIndex);
    slot.AwayTeam = createTeamRef(game.awayTeamIndex);
    gamesUpdated++;
  }

  // Handle Week 1+ (direct mapping)
  for (const [maddenWeek, slots] of franchiseGamesByWeek) {
    if (maddenWeek === 0) continue;

    const histGames = gamesByWeek.get(maddenWeek);
    if (!histGames) {
      console.log(`Week ${maddenWeek}: No historical games`);
      continue;
    }

    const count = Math.min(slots.length, histGames.length);
    console.log(`Week ${maddenWeek}: ${slots.length} slots, ${histGames.length} historical games, updating ${count}`);

    for (let i = 0; i < count; i++) {
      const slot = slots[i];
      const game = histGames[i];

      slot.HomeTeam = createTeamRef(game.homeTeamIndex);
      slot.AwayTeam = createTeamRef(game.awayTeamIndex);
      gamesUpdated++;
    }
  }

  console.log(`\nTotal games updated: ${gamesUpdated}`);

  // Save
  console.log(`\nSaving to ${testPath}...`);
  await franchise.save(testPath);
  console.log('Saved!');

  // Verify
  console.log('\n=== Verifying Week 0, 1, 2 ===\n');

  const verifyFranchise = await module.create(testPath, {
    schemaDirectory: 'C:\\Users\\tshan\\AppData\\Local\\Programs\\MyFranchise'
  });

  const verifyTeamTable = verifyFranchise.getTableByUniqueId(TABLE_IDS.teamTable);
  await verifyTeamTable.readRecords();

  const verifyRecordToTeam = new Map();
  for (const team of verifyTeamTable.records) {
    if (team.isEmpty) continue;
    if (team.TeamIndex !== undefined && team.TeamIndex < 32) {
      verifyRecordToTeam.set(team.index, team.ShortName);
    }
  }

  let verifyGameTable = verifyFranchise.getTableByUniqueId(TABLE_IDS.gameTable);
  if (!verifyGameTable) {
    verifyGameTable = verifyFranchise.getTableByName('SeasonGame');
  }
  await verifyGameTable.readRecords();

  for (const targetWeek of [0, 1, 2]) {
    console.log(`Week ${targetWeek} games after save:`);
    let count = 0;
    for (const record of verifyGameTable.records) {
      if (record.isEmpty) continue;
      if (record.SeasonWeek !== targetWeek) continue;
      if (record.SeasonWeekType !== 1 && record.SeasonWeekType !== 'RegularSeason') continue;

      count++;
      const homeRI = parseInt(record.HomeTeam.slice(-8), 2);
      const awayRI = parseInt(record.AwayTeam.slice(-8), 2);
      const home = verifyRecordToTeam.get(homeRI) || '?';
      const away = verifyRecordToTeam.get(awayRI) || '?';

      if (count <= 5) {
        console.log(`  ${count}. ${away} @ ${home}`);
      }
    }
    console.log(`  ... (${count} total games)\n`);
  }
}

testWeek0Fix().catch(console.error);
