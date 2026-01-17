// Verify the schedule mapping process step by step
const fs = require('fs');
const path = require('path');

async function verify() {
  const module = await import('madden-franchise');

  const filePath = 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden NFL 26\\Saves\\CAREER-NOV23-05h38m58p-AUTOSAVE';
  const franchise = await module.create(filePath, {
    schemaDirectory: 'C:\\Users\\tshan\\AppData\\Local\\Programs\\MyFranchise'
  });

  // Get Team table
  const teamTable = franchise.getTableByUniqueId(637929298);
  await teamTable.readRecords();

  // Build TeamIndex → RecordIndex mapping
  const teamIndexToRecordIndex = new Map();
  const recordIndexToTeam = new Map();

  for (const team of teamTable.records) {
    if (team.isEmpty) continue;
    const teamIndex = team.TeamIndex;
    if (teamIndex !== undefined && teamIndex < 32) {
      teamIndexToRecordIndex.set(teamIndex, team.index);
      recordIndexToTeam.set(team.index, {
        name: team.ShortName,
        teamIndex: teamIndex
      });
    }
  }

  console.log('=== TeamIndex to RecordIndex Mapping ===\n');
  const sortedEntries = [...teamIndexToRecordIndex.entries()].sort((a, b) => a[0] - b[0]);
  for (const [teamIndex, recordIndex] of sortedEntries) {
    const team = recordIndexToTeam.get(recordIndex);
    console.log(`TeamIndex ${teamIndex} -> RecordIndex ${recordIndex} (${team?.name})`);
  }

  // Load 1980 schedule and show Week 1 games
  const schedulePath = path.join(__dirname, 'data', 'retro', 'schedules', '1980.json');
  const schedule = JSON.parse(fs.readFileSync(schedulePath, 'utf-8'));

  console.log('\n=== 1980 Week 1 Games (from JSON) ===\n');
  const week1Games = schedule.games.filter(g => g.week === 1 && g.weekType === 'regular');

  for (const game of week1Games.slice(0, 14)) {
    const homeRecordIndex = teamIndexToRecordIndex.get(game.homeTeamIndex);
    const awayRecordIndex = teamIndexToRecordIndex.get(game.awayTeamIndex);
    const home = recordIndexToTeam.get(homeRecordIndex);
    const away = recordIndexToTeam.get(awayRecordIndex);

    console.log(`${game.awayTeam} @ ${game.homeTeam}`);
    console.log(`  AwayTeamIndex: ${game.awayTeamIndex} -> RecordIndex: ${awayRecordIndex} (${away?.name})`);
    console.log(`  HomeTeamIndex: ${game.homeTeamIndex} -> RecordIndex: ${homeRecordIndex} (${home?.name})`);

    if (away?.name !== game.awayTeam.split(' ').pop()) {
      console.log('  !!! MISMATCH on Away team');
    }
    if (home?.name !== game.homeTeam.split(' ').pop()) {
      console.log('  !!! MISMATCH on Home team');
    }
    console.log('');
  }

  // Check Browns specifically
  console.log('=== Browns Verification ===');
  console.log('Browns teamIndex in schedule: 4');
  console.log('Browns recordIndex from mapping:', teamIndexToRecordIndex.get(4));
  console.log('Team at that recordIndex:', recordIndexToTeam.get(teamIndexToRecordIndex.get(4)));

  console.log('\n=== Giants Verification ===');
  console.log('Giants teamIndex in schedule: 15');
  console.log('Giants recordIndex from mapping:', teamIndexToRecordIndex.get(15));
  console.log('Team at that recordIndex:', recordIndexToTeam.get(teamIndexToRecordIndex.get(15)));
}

verify().catch(console.error);
