// Analyze the exact week structure in detail

const TABLE_IDS = {
  teamTable: 637929298,
  gameTable: 2816609684,
};

async function analyze() {
  const module = await import('madden-franchise');

  const filePath = 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden NFL 26\\Saves\\CAREER-NOV23-05h38m58p-AUTOSAVE';
  const franchise = await module.create(filePath, {
    schemaDirectory: 'C:\\Users\\tshan\\AppData\\Local\\Programs\\MyFranchise'
  });

  const teamTable = franchise.getTableByUniqueId(TABLE_IDS.teamTable);
  await teamTable.readRecords();

  const recordIndexToTeam = new Map();
  for (const team of teamTable.records) {
    if (team.isEmpty) continue;
    if (team.TeamIndex !== undefined && team.TeamIndex < 32) {
      recordIndexToTeam.set(team.index, team.ShortName);
    }
  }

  let gameTable = franchise.getTableByUniqueId(TABLE_IDS.gameTable);
  if (!gameTable) {
    gameTable = franchise.getTableByName('SeasonGame');
  }
  await gameTable.readRecords();

  // Show ALL Week 0 and Week 1 RegularSeason games
  console.log('=== Week 0 RegularSeason Games ===\n');
  let count0 = 0;
  for (const record of gameTable.records) {
    if (record.isEmpty) continue;
    if (record.SeasonWeek !== 0) continue;
    if (record.SeasonWeekType !== 1 && record.SeasonWeekType !== 'RegularSeason') continue;

    count0++;
    const homeRI = record.HomeTeam ? parseInt(record.HomeTeam.slice(-8), 2) : -1;
    const awayRI = record.AwayTeam ? parseInt(record.AwayTeam.slice(-8), 2) : -1;
    const home = recordIndexToTeam.get(homeRI) || '?';
    const away = recordIndexToTeam.get(awayRI) || '?';
    console.log(`${count0.toString().padStart(2)}. ${away.padEnd(4)} @ ${home}`);
  }
  console.log(`\nTotal Week 0 RegularSeason: ${count0}`);

  console.log('\n=== Week 1 RegularSeason Games ===\n');
  let count1 = 0;
  for (const record of gameTable.records) {
    if (record.isEmpty) continue;
    if (record.SeasonWeek !== 1) continue;
    if (record.SeasonWeekType !== 1 && record.SeasonWeekType !== 'RegularSeason') continue;

    count1++;
    const homeRI = record.HomeTeam ? parseInt(record.HomeTeam.slice(-8), 2) : -1;
    const awayRI = record.AwayTeam ? parseInt(record.AwayTeam.slice(-8), 2) : -1;
    const home = recordIndexToTeam.get(homeRI) || '?';
    const away = recordIndexToTeam.get(awayRI) || '?';
    console.log(`${count1.toString().padStart(2)}. ${away.padEnd(4)} @ ${home}`);
  }
  console.log(`\nTotal Week 1 RegularSeason: ${count1}`);

  console.log('\n=== Week 2 RegularSeason Games ===\n');
  let count2 = 0;
  for (const record of gameTable.records) {
    if (record.isEmpty) continue;
    if (record.SeasonWeek !== 2) continue;
    if (record.SeasonWeekType !== 1 && record.SeasonWeekType !== 'RegularSeason') continue;

    count2++;
    const homeRI = record.HomeTeam ? parseInt(record.HomeTeam.slice(-8), 2) : -1;
    const awayRI = record.AwayTeam ? parseInt(record.AwayTeam.slice(-8), 2) : -1;
    const home = recordIndexToTeam.get(homeRI) || '?';
    const away = recordIndexToTeam.get(awayRI) || '?';
    console.log(`${count2.toString().padStart(2)}. ${away.padEnd(4)} @ ${home}`);
  }
  console.log(`\nTotal Week 2 RegularSeason: ${count2}`);

  // Summary
  console.log('\n=== Summary ===');
  console.log(`Week 0 RegularSeason: ${count0} games`);
  console.log(`Week 1 RegularSeason: ${count1} games`);
  console.log(`Week 2 RegularSeason: ${count2} games`);
  console.log(`Total for "NFL Week 1": ${count0 + count1} games (if combined)`);
}

analyze().catch(console.error);
