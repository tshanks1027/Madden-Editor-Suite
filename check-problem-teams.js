/**
 * Check the specific problem teams (DAL, DET, MIN) in detail
 */
const { create } = require('madden-franchise');

async function checkProblemTeams() {
  const filePath = 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/CAREER-1980test-AUTOSAVE';

  console.log('Loading franchise file...');
  const franchise = await create(filePath);

  // Get the correct Team table
  const teamTable = franchise.getTableByUniqueId(637929298);
  await teamTable.readRecords();

  console.log('\n=== PROBLEM TEAMS (DAL=10, DET=18, MIN=30) ===');

  const problemIndices = [10, 18, 30];

  for (const record of teamTable.records) {
    if (record.isEmpty) continue;
    if (!problemIndices.includes(record.TeamIndex)) continue;

    console.log(`\n--- TeamIndex ${record.TeamIndex} (Record ${record.index}) ---`);

    // Check all fields from _fieldsArray
    if (record._fieldsArray) {
      for (const field of record._fieldsArray) {
        const name = field.name || field.key;
        if (!name) continue;
        const val = field.value;
        if (val === undefined || val === null || val === '') continue;
        // Skip long binary strings
        if (typeof val === 'string' && val.length > 40 && val.match(/^[01]+$/)) continue;

        // Focus on name-related fields
        if (name.toLowerCase().includes('name') ||
            name.toLowerCase().includes('short') ||
            name.toLowerCase().includes('long') ||
            name.toLowerCase().includes('display') ||
            name.toLowerCase().includes('abbr') ||
            name.toLowerCase().includes('city') ||
            name.toLowerCase().includes('nick') ||
            name === 'TeamIndex') {
          console.log(`  ${name}: ${val}`);
        }
      }
    }
  }

  // Compare with a working team
  console.log('\n=== WORKING TEAM (Chicago Bears, TeamIndex 0) ===');
  for (const record of teamTable.records) {
    if (record.isEmpty) continue;
    if (record.TeamIndex !== 0) continue;

    console.log(`\n--- TeamIndex 0 (Record ${record.index}) ---`);

    if (record._fieldsArray) {
      for (const field of record._fieldsArray) {
        const name = field.name || field.key;
        if (!name) continue;
        const val = field.value;
        if (val === undefined || val === null || val === '') continue;
        if (typeof val === 'string' && val.length > 40 && val.match(/^[01]+$/)) continue;

        if (name.toLowerCase().includes('name') ||
            name.toLowerCase().includes('short') ||
            name.toLowerCase().includes('long') ||
            name.toLowerCase().includes('display') ||
            name.toLowerCase().includes('abbr') ||
            name.toLowerCase().includes('city') ||
            name.toLowerCase().includes('nick') ||
            name === 'TeamIndex') {
          console.log(`  ${name}: ${val}`);
        }
      }
    }
    break;
  }

  // Also check if the user's team selection is set correctly
  console.log('\n\n=== FRANCHISE USER TABLE ===');
  const userTable = franchise.getTableByName('FranchiseUser');
  if (userTable) {
    await userTable.readRecords();
    for (const record of userTable.records) {
      if (record.isEmpty) continue;

      console.log(`Record ${record.index}:`);
      if (record._fieldsArray) {
        for (const field of record._fieldsArray) {
          const name = field.name || field.key;
          if (!name) continue;
          const val = field.value;
          if (val === undefined || val === null || val === '') continue;
          // Skip long binary strings but show team references
          if (typeof val === 'string' && val.length > 40 && val.match(/^[01]+$/) && !name.includes('Team')) continue;

          if (name.toLowerCase().includes('team') ||
              name.toLowerCase().includes('user') ||
              name.toLowerCase().includes('control') ||
              name.toLowerCase().includes('index')) {
            console.log(`  ${name}: ${val}`);
          }
        }
      }
    }
  }
}

checkProblemTeams().catch(console.error);
