// Inspect SeasonGame table structure

async function inspectSeasonGame() {
  const module = await import('madden-franchise');
  const franchise = await module.create('C:\\Users\\tshan\\OneDrive\\Documents\\Madden NFL 26\\Saves\\CAREER-NOV23-05h38m58p-AUTOSAVE', {
    schemaDirectory: 'C:\\Users\\tshan\\AppData\\Local\\Programs\\MyFranchise'
  });

  const seasonGameTable = franchise.getTableByName('SeasonGame');
  if (!seasonGameTable) {
    console.log('SeasonGame table not found!');
    return;
  }

  await seasonGameTable.readRecords();

  console.log('=== SeasonGame Table Info ===\n');
  console.log(`Table name: ${seasonGameTable.name}`);
  console.log(`UniqueId: ${seasonGameTable.uniqueId}`);
  console.log(`Record count: ${seasonGameTable.records.length}`);

  // Get first non-empty record
  const firstRecord = seasonGameTable.records.find(r => !r.isEmpty);
  if (!firstRecord) {
    console.log('No non-empty records found!');
    return;
  }

  console.log('\n=== First Record Fields ===\n');

  // Get all field names
  const allKeys = Object.keys(firstRecord);
  console.log('All keys on record object:', allKeys.length);

  // Filter to get property names (not methods/internal)
  for (const key of allKeys) {
    const value = firstRecord[key];
    if (typeof value !== 'function') {
      console.log(`  ${key}: ${JSON.stringify(value)}`);
    }
  }

  // Try to access known fields directly
  console.log('\n=== Direct Field Access ===\n');
  console.log(`SeasonWeek: ${firstRecord.SeasonWeek}`);
  console.log(`SeasonWeekType: ${firstRecord.SeasonWeekType}`);
  console.log(`HomeTeam: ${firstRecord.HomeTeam}`);
  console.log(`AwayTeam: ${firstRecord.AwayTeam}`);

  // Check if there's a different way to access fields
  console.log('\n=== Table Header ===\n');
  if (seasonGameTable.header) {
    console.log('Header:', JSON.stringify(seasonGameTable.header, null, 2).slice(0, 500));
  }

  // Check fields array
  if (seasonGameTable.fields) {
    console.log('\nFields:', seasonGameTable.fields.slice(0, 10));
  }

  // Look for columns
  if (seasonGameTable.columns) {
    console.log('\nColumns:', seasonGameTable.columns);
  }
}

inspectSeasonGame().catch(console.error);
