// Find where the user's controlled team is stored

const TABLE_IDS = {
  teamTable: 637929298,
};

async function findUserTeam() {
  const module = await import('madden-franchise');

  const filePath = 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden NFL 26\\Saves\\CAREER-NOV23-05h38m58p-AUTOSAVE';
  const franchise = await module.create(filePath, {
    schemaDirectory: 'C:\\Users\\tshan\\AppData\\Local\\Programs\\MyFranchise'
  });

  console.log('=== Searching for User/Owner/Coach tables ===\n');

  // Look for tables that might control user team
  const relevantTables = [];
  for (const table of franchise.tables) {
    const name = table.name?.toLowerCase() || '';
    if (name.includes('user') ||
        name.includes('owner') ||
        name.includes('coach') ||
        name.includes('franchise') ||
        name.includes('career') ||
        name.includes('control') ||
        name.includes('human')) {
      relevantTables.push(table);
    }
  }

  console.log(`Found ${relevantTables.length} potentially relevant tables:`);
  for (const table of relevantTables) {
    console.log(`  - ${table.name}`);
  }

  // Check each table
  for (const table of relevantTables) {
    console.log(`\n=== ${table.name} ===\n`);
    try {
      await table.readRecords();
      console.log(`Records: ${table.records.length}`);

      // Find non-empty records
      const nonEmpty = table.records.filter(r => !r.isEmpty);
      console.log(`Non-empty: ${nonEmpty.length}`);

      if (nonEmpty.length > 0 && nonEmpty.length <= 5) {
        // Show fields for first record
        const rec = nonEmpty[0];
        const keys = Object.keys(rec).filter(k => !k.startsWith('_') && typeof rec[k] !== 'function');
        console.log('First record fields:');
        for (const key of keys.slice(0, 20)) {
          console.log(`  ${key}: ${rec[key]}`);
        }
      }
    } catch (e) {
      console.log(`Error reading: ${e.message}`);
    }
  }

  // Also check SeasonInfo for any team references
  console.log('\n=== SeasonInfo (for team references) ===\n');
  const seasonInfoTable = franchise.getTableByName('SeasonInfo');
  if (seasonInfoTable) {
    await seasonInfoTable.readRecords();
    const rec = seasonInfoTable.records[0];
    if (rec) {
      const keys = Object.keys(rec).filter(k => !k.startsWith('_') && typeof rec[k] !== 'function');
      for (const key of keys) {
        const val = rec[key];
        if (typeof val === 'string' || typeof val === 'number') {
          console.log(`  ${key}: ${val}`);
        }
      }
    }
  }
}

findUserTeam().catch(console.error);
