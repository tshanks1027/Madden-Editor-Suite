const { FranchiseFile } = require('madden-franchise');

async function check() {
  const franchise = new FranchiseFile('C:/Users/tshan/OneDrive/Documents/2011 Throwback/2011 Throwback V0.9/2011 Throwback V0.9/CAREER-2011THROWBACKV09');
  await franchise.parse();

  const gameTable = franchise.getTableByName('SeasonGame');
  console.log('Game table found:', !!gameTable);
  console.log('Game table header records:', gameTable?.header?.recordCount);

  await gameTable.readRecords();

  console.log('Total records after read:', gameTable.records.length);

  // Debug first few records
  if (gameTable.records.length > 0) {
    const first = gameTable.records[0];
    console.log('First record keys:', Object.keys(first).filter(k => !k.startsWith('_')).slice(0, 20));
  }

  // Collect unique week/type combinations
  const combos = new Map();

  for (const game of gameTable.records) {
    if (game.isEmpty) continue;

    const week = game.SeasonWeek;
    const weekType = game.SeasonWeekType;

    const key = `${week}|${weekType}`;
    if (!combos.has(key)) {
      combos.set(key, { week, weekType, count: 0, sample: game });
    }
    combos.get(key).count++;
  }

  // Sort by week
  const sorted = [...combos.values()].sort((a, b) => a.week - b.week);

  console.log('\nUnique Week/Type combinations:');
  for (const combo of sorted) {
    console.log(`  Week ${combo.week}, Type=${combo.weekType}: ${combo.count} games`);
  }

  // Check the enum values from schema
  console.log('\n\nChecking SeasonWeekType enum:');
  const enums = franchise.schemaList ? franchise.schemaList.enums : null;
  if (enums) {
    for (const e of enums) {
      if (e.name === 'SeasonWeekType') {
        console.log('Found SeasonWeekType enum:');
        for (const member of e.members || []) {
          console.log(`  ${member.name} = ${member.value}`);
        }
      }
    }
  }
}

check().catch(console.error);
