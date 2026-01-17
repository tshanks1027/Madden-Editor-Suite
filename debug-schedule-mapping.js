// Debug schedule mapping - understand what's happening with team mapping

const fs = require('fs');
const path = require('path');

const TABLE_IDS = {
  teamTable: 637929298,
  gameTable: 2816609684
};

async function debugScheduleMapping() {
  const module = await import('madden-franchise');
  const franchise = await module.create('C:\\Users\\tshan\\OneDrive\\Documents\\Madden NFL 26\\Saves\\CAREER-NOV23-05h38m58p-AUTOSAVE', {
    schemaDirectory: 'C:\\Users\\tshan\\AppData\\Local\\Programs\\MyFranchise'
  });

  const teamTable = franchise.getTableByUniqueId(TABLE_IDS.teamTable);
  await teamTable.readRecords();

  console.log('=== TeamIndex to RecordIndex Mapping ===\n');

  // Build mapping
  const teamIndexToRecordIndex = new Map();
  const recordIndexToTeam = new Map();

  for (const team of teamTable.records) {
    if (team.isEmpty) continue;
    const teamIndex = team.TeamIndex;
    if (teamIndex !== undefined && teamIndex < 32) {
      teamIndexToRecordIndex.set(teamIndex, team.index);
      recordIndexToTeam.set(team.index, {
        teamIndex,
        shortName: team.ShortName,
        longName: team.LongName
      });
      console.log(`TeamIndex ${teamIndex.toString().padStart(2)} => RecordIndex ${team.index.toString().padStart(2)} (${team.ShortName} - ${team.LongName})`);
    }
  }

  // Now read a schedule file and check the team indices
  const schedule2024 = JSON.parse(fs.readFileSync(
    path.join(__dirname, 'data', 'retro', 'schedules', '2024.json'),
    'utf-8'
  ));

  console.log('\n=== First 5 Games from 2024 Schedule ===\n');

  for (let i = 0; i < 5; i++) {
    const game = schedule2024.games[i];
    console.log(`Game ${i + 1}: ${game.awayTeam} @ ${game.homeTeam}`);
    console.log(`  HomeTeamIndex: ${game.homeTeamIndex} => RecordIndex: ${teamIndexToRecordIndex.get(game.homeTeamIndex)}`);
    console.log(`  AwayTeamIndex: ${game.awayTeamIndex} => RecordIndex: ${teamIndexToRecordIndex.get(game.awayTeamIndex)}`);

    // Verify the team at that record index
    const homeTeamData = recordIndexToTeam.get(teamIndexToRecordIndex.get(game.homeTeamIndex));
    const awayTeamData = recordIndexToTeam.get(teamIndexToRecordIndex.get(game.awayTeamIndex));
    console.log(`  Home team at that index: ${homeTeamData?.shortName} - ${homeTeamData?.longName}`);
    console.log(`  Away team at that index: ${awayTeamData?.shortName} - ${awayTeamData?.longName}`);
    console.log('');
  }

  // Now let's read the game table and see what the current state is
  const gameTable = franchise.getTableByUniqueId(TABLE_IDS.gameTable);
  await gameTable.readRecords();

  console.log('\n=== First 5 Regular Season Games in Franchise File ===\n');

  let gameCount = 0;
  for (const record of gameTable.records) {
    if (record.isEmpty) continue;

    const weekType = record.SeasonWeekType;
    // RegularSeason = 1 in M26
    if (weekType !== 1) continue;

    const weekNum = record.SeasonWeek;
    if (weekNum !== 1) continue; // Only week 1 games

    const homeTeamRef = record.HomeTeam;
    const awayTeamRef = record.AwayTeam;

    // Parse record index from binary reference (last 8 bits)
    const homeRecordIndex = homeTeamRef ? parseInt(homeTeamRef.slice(-8), 2) : -1;
    const awayRecordIndex = awayTeamRef ? parseInt(awayTeamRef.slice(-8), 2) : -1;

    const homeTeamData = recordIndexToTeam.get(homeRecordIndex);
    const awayTeamData = recordIndexToTeam.get(awayRecordIndex);

    console.log(`Game slot - Week ${weekNum}:`);
    console.log(`  HomeTeam ref: ${homeTeamRef}`);
    console.log(`  HomeTeam RecordIndex: ${homeRecordIndex} => ${homeTeamData?.shortName || 'UNKNOWN'} (${homeTeamData?.longName || '?'})`);
    console.log(`  AwayTeam ref: ${awayTeamRef}`);
    console.log(`  AwayTeam RecordIndex: ${awayRecordIndex} => ${awayTeamData?.shortName || 'UNKNOWN'} (${awayTeamData?.longName || '?'})`);
    console.log('');

    gameCount++;
    if (gameCount >= 5) break;
  }
}

debugScheduleMapping().catch(console.error);
