const { FranchiseFile } = require('madden-franchise');

async function test() {
  const filePath = 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/CAREER-2004TEST';

  console.log('Loading franchise file...');
  const franchise = new FranchiseFile(filePath);
  await franchise.parse();

  // Get SeasonGame table - try by unique ID first (4082915817)
  let gameTable = franchise.getTableByUniqueId(4082915817);
  if (!gameTable) {
    gameTable = franchise.getTableByName('SeasonGame');
  }

  console.log('Table found:', gameTable ? 'yes' : 'no');
  console.log('Table name:', gameTable?.header?.name || 'unknown');
  console.log('Table header recordCount:', gameTable?.header?.recordCount);
  console.log('Table header data1RecordCount:', gameTable?.header?.data1RecordCount);

  console.log('Before readRecords - records:', gameTable.records?.length);
  console.log('readRecords function:', typeof gameTable.readRecords);

  const result = await gameTable.readRecords();
  console.log('readRecords result:', result);
  console.log('Records array length after readRecords:', gameTable.records.length);

  // Try accessing via header
  console.log('header.data1 length:', gameTable.header?.data1?.length);

  // Check available properties
  console.log('gameTable keys:', Object.keys(gameTable).filter(k => !k.startsWith('_')));

  // Count non-empty records
  let nonEmptyCount = 0;
  for (const r of gameTable.records) {
    if (!r.isEmpty) nonEmptyCount++;
  }
  console.log('Total records:', gameTable.records.length);
  console.log('Non-empty records:', nonEmptyCount);

  // Find a RegularSeason Week 17 game
  let week17Game = null;
  for (const record of gameTable.records) {
    if (record.isEmpty) continue;
    const week = record.SeasonWeek;
    const weekType = record.SeasonWeekType;
    if (week === 17 && weekType === 'RegularSeason') {
      week17Game = record;
      break;
    }
  }

  if (week17Game) {
    console.log('\n=== Found Week 17 RegularSeason Game ===');
    console.log('Current SeasonWeekType:', week17Game.SeasonWeekType);
    console.log('Type of SeasonWeekType:', typeof week17Game.SeasonWeekType);

    // Try to set it to OffSeason
    console.log('\nTrying to set SeasonWeekType to "OffSeason"...');
    try {
      week17Game.SeasonWeekType = 'OffSeason';
      console.log('SUCCESS! New value:', week17Game.SeasonWeekType);
    } catch (error) {
      console.log('FAILED with string "OffSeason":', error.message);

      // Try numeric value
      console.log('\nTrying to set SeasonWeekType to 8...');
      try {
        week17Game.SeasonWeekType = 8;
        console.log('SUCCESS with number! New value:', week17Game.SeasonWeekType);
      } catch (error2) {
        console.log('FAILED with number 8:', error2.message);
      }
    }
  } else {
    console.log('No Week 17 RegularSeason game found');

    // Show what weeks exist
    const weekTypes = {};
    for (const record of gameTable.records) {
      if (record.isEmpty) continue;
      const week = record.SeasonWeek;
      const type = record.SeasonWeekType;
      const key = `Week ${week}`;
      if (!weekTypes[key]) weekTypes[key] = {};
      weekTypes[key][type] = (weekTypes[key][type] || 0) + 1;
    }

    console.log('\nWeek breakdown:');
    for (let w = 0; w <= 20; w++) {
      const key = `Week ${w}`;
      if (weekTypes[key]) {
        const types = Object.entries(weekTypes[key]).map(([t, c]) => `${t}:${c}`).join(', ');
        console.log(`  ${key}: ${types}`);
      }
    }
  }
}

test().catch(console.error);
