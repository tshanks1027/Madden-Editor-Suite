// Find all tables that might contain schedule data

async function findGameTables() {
  const module = await import('madden-franchise');
  const franchise = await module.create('C:\\Users\\tshan\\OneDrive\\Documents\\Madden NFL 26\\Saves\\CAREER-NOV23-05h38m58p-AUTOSAVE', {
    schemaDirectory: 'C:\\Users\\tshan\\AppData\\Local\\Programs\\MyFranchise'
  });

  console.log('=== Looking for game/schedule tables ===\n');

  // Search for tables with "Game" or "Schedule" or "Season" in the name
  const tables = franchise.tables || [];

  const gameTables = [];
  for (const table of tables) {
    const name = table.name || '';
    if (name.toLowerCase().includes('game') ||
        name.toLowerCase().includes('schedule') ||
        name.toLowerCase().includes('season')) {
      gameTables.push({
        name: name,
        uniqueId: table.uniqueId,
        recordCount: table.records ? table.records.length : 'unknown'
      });
    }
  }

  console.log('Tables found:');
  for (const t of gameTables) {
    console.log(`  ${t.name} (ID: ${t.uniqueId})`);
  }

  // Try to read SeasonGame by name
  console.log('\n=== Trying to get SeasonGame table by name ===\n');
  const seasonGameByName = franchise.getTableByName('SeasonGame');
  if (seasonGameByName) {
    await seasonGameByName.readRecords();
    console.log(`SeasonGame table found by name!`);
    console.log(`  UniqueId: ${seasonGameByName.uniqueId}`);
    console.log(`  Record count: ${seasonGameByName.records.length}`);

    // Show first few records
    let count = 0;
    for (const record of seasonGameByName.records) {
      if (record.isEmpty) continue;
      if (count >= 3) break;
      count++;

      console.log(`\n  Record ${record.index}:`);
      // Print all field names
      const fieldNames = Object.keys(record).filter(k => !k.startsWith('_') && typeof record[k] !== 'function').slice(0, 10);
      for (const field of fieldNames) {
        console.log(`    ${field}: ${record[field]}`);
      }
    }
  } else {
    console.log('SeasonGame table NOT found by name');
  }

  // Try with the ID we're using
  console.log('\n=== Trying to get table by ID 2816609684 ===\n');
  const byId = franchise.getTableByUniqueId(2816609684);
  if (byId) {
    console.log(`Table found by ID 2816609684: ${byId.name}`);
  } else {
    console.log('Table NOT found by ID 2816609684');
  }
}

findGameTables().catch(console.error);
