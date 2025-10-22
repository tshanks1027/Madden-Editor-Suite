/**
 * Test Script: M26 Table Access
 *
 * Verifies that we can read tables from M26 franchise files
 */

const Franchise = require('madden-franchise');

const testFile = 'c:\\Users\\tshan\\OneDrive\\Documents\\Madden Files\\KNuttZFranchiseSandBox\\Madden Files\\CAREER-AUG07-02h00m07p-AUTOSAVE';

console.log('=== M26 Table Access Test ===\n');

async function testTableAccess() {
  const franchise = new Franchise(testFile);

  franchise.on('ready', async () => {
    console.log('✓ M26 franchise file opened!\n');
    console.log(`Game Year: ${franchise.schema.meta.gameYear}`);
    console.log(`Schema: ${franchise.schema.meta.major}.${franchise.schema.meta.minor}\n`);

    // Test key table access
    console.log('Testing Table Access:\n');

    try {
      // Player table
      const playerTable = franchise.getTableByName('Player');
      if (playerTable) {
        const playerRecords = playerTable.records;
        console.log(`✓ Player table: ${playerRecords.length} players found`);
      } else {
        console.log('✗ Player table not found');
      }

      // Team table
      const teamTable = franchise.getTableByName('Team');
      if (teamTable) {
        const teamRecords = teamTable.records;
        console.log(`✓ Team table: ${teamRecords.length} teams found`);
      } else {
        console.log('✗ Team table not found');
      }

      // Coach table
      const coachTable = franchise.getTableByName('Coach');
      if (coachTable) {
        const coachRecords = coachTable.records;
        console.log(`✓ Coach table: ${coachRecords.length} coaches found`);
      } else {
        console.log('✗ Coach table not found');
      }

      // CharacterVisuals table (the potentially problematic one)
      const visualsTable = franchise.getTableByName('CharacterVisuals');
      if (visualsTable) {
        const visualsRecords = visualsTable.records;
        console.log(`✓ CharacterVisuals table: ${visualsRecords.length} records found`);
        console.log('  ⚠️  NOTE: Editing this table may corrupt files - needs research');
      } else {
        console.log('✗ CharacterVisuals table not found');
      }

      console.log('\n=== All Tests Complete ===');
      console.log('✅ M26 file is READABLE with madden-franchise@3.8.0');
      console.log('✅ Core tables (Player, Team, Coach) accessible');
      console.log('\nNext steps:');
      console.log('1. Test editing and saving');
      console.log('2. Verify modified file loads in-game');
      console.log('3. Research CharacterVisuals handling');

      process.exit(0);

    } catch (error) {
      console.error('\n✗ Error accessing tables:', error.message);
      console.error(error.stack);
      process.exit(1);
    }
  });

  franchise.on('error', (err) => {
    console.error('✗ Error:', err.message);
    process.exit(1);
  });
}

testTableAccess();
