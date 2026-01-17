/**
 * Check ALL tables in the roster file, not just PLAY
 */

const path = require('path');

async function checkTables() {
  const MaddenRosterHelper = require('./src/main/lib/helpers/MaddenRosterHelper');

  const rosterPath = 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/ROSTER-Official';

  console.log('Loading roster...');
  const helper = new MaddenRosterHelper();
  const file = await helper.load(rosterPath);

  console.log('\n=== ALL TABLES IN ROSTER FILE ===\n');

  file.tables.forEach(table => {
    console.log(`${table.name}: ${table.records.length} records`);

    // Show field names for each table
    if (table.records.length > 0) {
      const fields = Object.keys(table.records[0].fields).sort();
      console.log(`  Fields: ${fields.join(', ')}`);
    }
    console.log('');
  });
}

checkTables().catch(console.error);
