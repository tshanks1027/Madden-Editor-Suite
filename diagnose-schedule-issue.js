// Diagnose the schedule team mapping issue
// Read the saved franchise file and see what teams are assigned to games

const TABLE_IDS = {
  teamTable: 637929298,
  gameTable: 2816609684
};

async function diagnoseSchedule() {
  const module = await import('madden-franchise');

  // Use the file that was saved with the schedule applied
  // (Change this path to match the actual saved file)
  const franchise = await module.create('C:\\Users\\tshan\\OneDrive\\Documents\\Madden NFL 26\\Saves\\CAREER-NOV23-05h38m58p-AUTOSAVE', {
    schemaDirectory: 'C:\\Users\\tshan\\AppData\\Local\\Programs\\MyFranchise'
  });

  // Read Team table
  const teamTable = franchise.getTableByUniqueId(TABLE_IDS.teamTable);
  await teamTable.readRecords();

  // Build RecordIndex → Team info mapping
  const recordIndexToTeam = new Map();
  const teamIndexToRecordIndex = new Map();

  console.log('=== Team Table Analysis ===\n');
  console.log('RecordIndex | TeamIndex | ShortName | LongName');
  console.log('------------|-----------|-----------|----------');

  for (const team of teamTable.records) {
    if (team.isEmpty) continue;
    const teamIndex = team.TeamIndex;
    if (teamIndex === undefined || teamIndex >= 32) continue;

    recordIndexToTeam.set(team.index, {
      teamIndex,
      shortName: team.ShortName,
      longName: team.LongName,
      displayName: team.DisplayName
    });
    teamIndexToRecordIndex.set(teamIndex, team.index);

    console.log(`     ${team.index.toString().padStart(2)}      |     ${teamIndex.toString().padStart(2)}    | ${(team.ShortName || '').padEnd(9)} | ${team.LongName}`);
  }

  // Read SeasonGame table
  const gameTable = franchise.getTableByUniqueId(TABLE_IDS.gameTable);
  await gameTable.readRecords();

  console.log('\n=== Week 1 Games in Franchise File ===\n');

  let gameCount = 0;
  for (const record of gameTable.records) {
    if (record.isEmpty) continue;

    const weekType = record.SeasonWeekType;
    // RegularSeason = 1
    if (weekType !== 1) continue;

    const weekNum = record.SeasonWeek;
    if (weekNum !== 1) continue;

    const homeTeamRef = record.HomeTeam;
    const awayTeamRef = record.AwayTeam;

    // Parse record index from binary reference (last 8 bits)
    const homeRecordIndex = homeTeamRef ? parseInt(homeTeamRef.slice(-8), 2) : -1;
    const awayRecordIndex = awayTeamRef ? parseInt(awayTeamRef.slice(-8), 2) : -1;

    const homeTeam = recordIndexToTeam.get(homeRecordIndex);
    const awayTeam = recordIndexToTeam.get(awayRecordIndex);

    console.log(`Game ${++gameCount}:`);
    console.log(`  HomeTeam binary ref: ${homeTeamRef}`);
    console.log(`  HomeTeam RecordIndex: ${homeRecordIndex} => ${homeTeam?.shortName || 'UNKNOWN'} (TeamIndex: ${homeTeam?.teamIndex})`);
    console.log(`  AwayTeam binary ref: ${awayTeamRef}`);
    console.log(`  AwayTeam RecordIndex: ${awayRecordIndex} => ${awayTeam?.shortName || 'UNKNOWN'} (TeamIndex: ${awayTeam?.teamIndex})`);
    console.log(`  Matchup: ${awayTeam?.shortName || '?'} @ ${homeTeam?.shortName || '?'}`);
    console.log('');

    if (gameCount >= 10) break;
  }

  // Now let's compare to what the schedule JSON says
  const fs = require('fs');
  const path = require('path');
  const schedule2024 = JSON.parse(fs.readFileSync(
    path.join(__dirname, 'data', 'retro', 'schedules', '2024.json'),
    'utf-8'
  ));

  console.log('\n=== Expected Week 1 Games from 2024.json ===\n');

  const week1Games = schedule2024.games.filter(g => g.week === 1);
  for (let i = 0; i < Math.min(10, week1Games.length); i++) {
    const game = week1Games[i];
    const expectedHomeRecordIndex = teamIndexToRecordIndex.get(game.homeTeamIndex);
    const expectedAwayRecordIndex = teamIndexToRecordIndex.get(game.awayTeamIndex);

    console.log(`Game ${i + 1}: ${game.awayTeam} @ ${game.homeTeam}`);
    console.log(`  HomeTeamIndex: ${game.homeTeamIndex} => RecordIndex: ${expectedHomeRecordIndex}`);
    console.log(`  AwayTeamIndex: ${game.awayTeamIndex} => RecordIndex: ${expectedAwayRecordIndex}`);
    console.log('');
  }
}

diagnoseSchedule().catch(console.error);
