const Franchise = require('madden-franchise');

const filePath = 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden NFL 26\\Saves\\ROSTER-Official';

console.log('[TEST] Attempting to parse roster file with madden-franchise...');
console.log('[TEST] File:', filePath);

Franchise.create(filePath, { schemaDirectory: null })
  .then((franchise) => {
    console.log('\n[SUCCESS] File loaded!');
    console.log('Game Year:', franchise.gameYear);
    console.log('File Type:', franchise.type);
    console.log('Number of tables:', franchise.tables.length);

    console.log('\n[TABLES] Available tables:');
    franchise.tables.forEach((table, index) => {
      console.log(`  ${index + 1}. ${table.name} (${table.header ? table.header.numMembers : '?'} records)`);
    });

    // Look for player-related tables
    const playerTables = franchise.tables.filter(t =>
      t.name.toLowerCase().includes('play') ||
      t.name.toLowerCase().includes('player')
    );

    if (playerTables.length > 0) {
      console.log('\n[PLAYER TABLES] Found:');
      playerTables.forEach(table => {
        console.log(`  - ${table.name}: ${table.header ? table.header.numMembers : '?'} records`);
      });
    }

    process.exit(0);
  })
  .catch((error) => {
    console.error('\n[ERROR] Failed to parse:');
    console.error('Type:', error.constructor.name);
    console.error('Message:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  });
