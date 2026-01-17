/**
 * Check actual table IDs vs what's in TABLE_IDS
 */
const { create } = require('madden-franchise');

async function checkTableIds() {
  const filePath = 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/CAREER-1980test-AUTOSAVE';

  console.log('Loading franchise file...');
  const franchise = await create(filePath);

  console.log('\n=== TABLE ID CHECK ===');

  // Team table
  console.log('\nTeam table:');
  console.log('  Expected ID: 637929298');
  const teamById = franchise.getTableByUniqueId(637929298);
  console.log('  getTableByUniqueId(637929298):', teamById ? 'FOUND' : 'NOT FOUND');
  const teamByName = franchise.getTableByName('Team');
  if (teamByName) {
    console.log('  getTableByName("Team") uniqueId:', teamByName.header?.uniqueId);
  }

  // SeasonGame table
  console.log('\nSeasonGame table:');
  console.log('  Expected ID in code: 2816609684');
  const gameById = franchise.getTableByUniqueId(2816609684);
  console.log('  getTableByUniqueId(2816609684):', gameById ? 'FOUND' : 'NOT FOUND');

  const gameByName = franchise.getTableByName('SeasonGame');
  if (gameByName) {
    console.log('  getTableByName("SeasonGame") uniqueId:', gameByName.header?.uniqueId);
    await gameByName.readRecords();
    console.log('  Records:', gameByName.records.length);
  } else {
    console.log('  getTableByName("SeasonGame"): NOT FOUND');
  }

  // Find all SeasonGame tables
  console.log('\nAll SeasonGame tables:');
  for (const table of franchise.tables) {
    if (table.name === 'SeasonGame') {
      console.log(`  - uniqueId: ${table.header?.uniqueId}, tableId: ${table.header?.tableId}`);
    }
  }

  // Find what table has ID 2816609684
  console.log('\nTable with ID 2816609684:');
  const mysterTable = franchise.getTableByUniqueId(2816609684);
  if (mysterTable) {
    console.log('  Name:', mysterTable.name);
  } else {
    console.log('  NOT FOUND');
  }

  // Check if SeasonGame ID 1607878349 exists (from earlier trace)
  console.log('\nTable with ID 1607878349:');
  const altGame = franchise.getTableByUniqueId(1607878349);
  if (altGame) {
    console.log('  Name:', altGame.name);
    await altGame.readRecords();
    console.log('  Records:', altGame.records.length);
  } else {
    console.log('  NOT FOUND');
  }
}

checkTableIds().catch(console.error);
