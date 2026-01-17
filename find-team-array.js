/**
 * Find the array table containing NFL team data
 */
const { create } = require('madden-franchise');

async function findTeamArray() {
  const filePath = 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/CAREER-1980test-AUTOSAVE';

  console.log('Loading franchise file...');
  const franchise = await create(filePath);

  console.log('\n=== SEARCHING FOR Team[] ARRAY TABLES ===');
  for (const table of franchise.tables) {
    if (!table.name) continue;
    if (table.name === 'Team[]') {
      await table.readRecords();
      const nonEmpty = table.records.filter(r => !r.isEmpty).length;
      console.log(`\nTeam[] (uniqueId: ${table.header?.uniqueId}): ${nonEmpty} non-empty of ${table.records.length} total`);

      if (nonEmpty > 0 && nonEmpty <= 40) {
        // Show first few records
        for (const record of table.records.slice(0, 5)) {
          if (record.isEmpty) continue;

          console.log(`  Record ${record.index}:`);
          if (record._fieldsArray) {
            for (const field of record._fieldsArray.slice(0, 15)) {
              const name = field.name || field.key;
              if (!name) continue;
              const val = field.value;
              if (val === undefined || val === null || val === '') continue;
              if (typeof val === 'string' && val.length > 40 && val.match(/^[01]+$/)) continue;
              console.log(`    ${name}: ${val}`);
            }
          }
        }
      }
    }
  }

  // Also look for specific NFL team properties in the data
  console.log('\n\n=== CHECKING FOR TeamSetting - might have team config ===');
  const settingTable = franchise.getTableByName('TeamSetting');
  if (settingTable) {
    await settingTable.readRecords();
    console.log(`TeamSetting: ${settingTable.records.filter(r => !r.isEmpty).length} records`);

    // Show first few
    for (const record of settingTable.records.slice(0, 35)) {
      if (record.isEmpty) continue;

      const idx = record.index;
      console.log(`\nRecord ${idx}:`);

      if (record._fieldsArray) {
        for (const field of record._fieldsArray) {
          const name = field.name || field.key;
          if (!name) continue;
          const val = field.value;
          if (val === undefined || val === null || val === '') continue;
          if (typeof val === 'string' && val.length > 40 && val.match(/^[01]+$/)) continue;
          console.log(`  ${name}: ${val}`);
        }
      }
    }
  }
}

findTeamArray().catch(console.error);
