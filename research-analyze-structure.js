// Analyze the dumped franchise structure
const fs = require('fs');
const path = require('path');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'franchise-complete-structure.json'), 'utf8'));

console.log('='.repeat(80));
console.log('FREE AGENT RELATED TABLES');
console.log('='.repeat(80));
console.log(JSON.stringify(data.tablesByCategory.freeAgent, null, 2));

console.log('\n' + '='.repeat(80));
console.log('ROSTER RELATED TABLES');
console.log('='.repeat(80));
console.log(JSON.stringify(data.tablesByCategory.roster, null, 2));

console.log('\n' + '='.repeat(80));
console.log('CONTRACT RELATED TABLES');
console.log('='.repeat(80));
console.log(JSON.stringify(data.tablesByCategory.contract, null, 2));

console.log('\n' + '='.repeat(80));
console.log('SALARY RELATED TABLES');
console.log('='.repeat(80));
console.log(JSON.stringify(data.tablesByCategory.salary, null, 2));

// Find the main Player table
console.log('\n' + '='.repeat(80));
console.log('MAIN PLAYER TABLE DETAILS');
console.log('='.repeat(80));

const playerTable = data.allTables.find(t => t.name === 'Player' && t.nonEmptyCount > 1000);
if (playerTable) {
  console.log(`Table Index: ${playerTable.index}`);
  console.log(`UniqueId: ${playerTable.uniqueId}`);
  console.log(`Records: ${playerTable.recordCount} (${playerTable.nonEmptyCount} non-empty)`);
  console.log(`Total Fields: ${playerTable.fields.length}`);
  console.log('\nAll Fields:');
  console.log(playerTable.fields.join(', '));
  console.log('\nSample Values:');
  console.log(JSON.stringify(playerTable.sampleValues, null, 2));
}

// Find main Team table
console.log('\n' + '='.repeat(80));
console.log('MAIN TEAM TABLE DETAILS');
console.log('='.repeat(80));

const teamTable = data.allTables.find(t => t.name === 'Team' && t.nonEmptyCount > 30);
if (teamTable) {
  console.log(`Table Index: ${teamTable.index}`);
  console.log(`UniqueId: ${teamTable.uniqueId}`);
  console.log(`Records: ${teamTable.recordCount} (${teamTable.nonEmptyCount} non-empty)`);
  console.log(`Total Fields: ${teamTable.fields.length}`);
  console.log('\nAll Fields:');
  console.log(teamTable.fields.join(', '));
  console.log('\nSample Values:');
  console.log(JSON.stringify(teamTable.sampleValues, null, 2));
}

// Find FreeAgent related tables with data
console.log('\n' + '='.repeat(80));
console.log('FA TABLES WITH DATA');
console.log('='.repeat(80));

for (const tableName of data.tablesByCategory.freeAgent) {
  const table = data.allTables.find(t => t.name === tableName);
  if (table && table.nonEmptyCount > 0) {
    console.log(`\n${tableName}: ${table.nonEmptyCount} records`);
    console.log(`  Fields: ${table.fields.slice(0, 10).join(', ')}${table.fields.length > 10 ? '...' : ''}`);
  }
}

// Look for any tables that mention "array" and have player data
console.log('\n' + '='.repeat(80));
console.log('PLAYER ARRAY TABLES');
console.log('='.repeat(80));

const playerArrayTables = data.allTables.filter(t =>
  t.name && t.name.includes('Player[]') && t.nonEmptyCount > 0
);

for (const table of playerArrayTables.slice(0, 20)) {
  console.log(`\n${table.name} (index ${table.index}): ${table.nonEmptyCount} records`);
  console.log(`  Fields: ${table.fields.slice(0, 5).join(', ')}`);
  console.log(`  Sample: ${JSON.stringify(table.sampleValues)}`);
}
