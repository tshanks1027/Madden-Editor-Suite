/**
 * Test script to analyze Coach table structure
 */
const path = require('path');
const Franchise = require('./src/main/lib/madden-franchise');

async function analyzeCoachTable(filePath) {
  console.log('Loading franchise file:', filePath);

  const franchise = new Franchise(filePath);
  await franchise.readFile();

  // Try getting Coach table by unique ID
  let coachTable = franchise.getTableByUniqueId(1864063867);
  if (!coachTable) {
    coachTable = franchise.getTableByName('Coach');
  }

  if (!coachTable) {
    console.log('Could not find Coach table!');

    // List all tables
    console.log('\nAll tables in file:');
    for (const table of franchise.tables || []) {
      if (table.name && table.name.toLowerCase().includes('coach')) {
        console.log(`  - ${table.name} (unique ID: ${table.header?.uniqueId})`);
      }
    }
    return;
  }

  console.log(`Found Coach table with ${coachTable.header?.recordCount || '?'} records`);

  await coachTable.readRecords();
  console.log(`\nLoaded ${coachTable.records.length} coach records`);

  // Show first record's fields
  if (coachTable.records.length > 0) {
    const firstRecord = coachTable.records[0];
    const fieldNames = Object.keys(firstRecord).filter(k => !k.startsWith('_') && typeof firstRecord[k] !== 'function');
    console.log('\nCoach table fields:');
    fieldNames.forEach(f => {
      const val = firstRecord[f];
      console.log(`  ${f}: ${typeof val === 'object' ? JSON.stringify(val) : val}`);
    });
  }

  // Group coaches by TeamIndex and Position
  console.log('\n\nCoaches by Team (first 5 teams):');
  const coachesByTeam = new Map();

  for (const record of coachTable.records) {
    if (record.isEmpty) continue;

    const teamIndex = record.TeamIndex;
    if (teamIndex === undefined) continue;

    if (!coachesByTeam.has(teamIndex)) {
      coachesByTeam.set(teamIndex, []);
    }
    coachesByTeam.get(teamIndex).push({
      Position: record.Position,
      FirstName: record.FirstName,
      LastName: record.LastName,
      isEmpty: record.isEmpty
    });
  }

  // Show first 5 teams
  let count = 0;
  for (const [teamIndex, coaches] of coachesByTeam) {
    if (count >= 5 || teamIndex >= 32) continue;
    console.log(`\n  Team ${teamIndex}:`);
    coaches.forEach(c => {
      console.log(`    Position ${c.Position}: ${c.FirstName} ${c.LastName}`);
    });
    count++;
  }

  // Show position value distribution
  console.log('\n\nPosition value distribution:');
  const positionCounts = {};
  for (const record of coachTable.records) {
    if (record.isEmpty) continue;
    if (record.TeamIndex >= 32) continue; // Only NFL teams
    const pos = record.Position;
    positionCounts[pos] = (positionCounts[pos] || 0) + 1;
  }
  console.log(positionCounts);
}

// Use a franchise file path from command line or default
const testFile = process.argv[2] || 'C:\\Users\\tshan\\Documents\\Dev\\madden-editor-suite\\data\\franchise\\testfranchise';
analyzeCoachTable(testFile).catch(err => console.error('Error:', err));
