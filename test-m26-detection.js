/**
 * Test Script: Detect Madden Version from Franchise File
 *
 * Uses madden-franchise library to identify the game version
 */

const Franchise = require('madden-franchise');
const path = require('path');

const testFile = 'c:\\Users\\tshan\\OneDrive\\Documents\\Madden Files\\KNuttZFranchiseSandBox\\Madden Files\\CAREER-AUG07-02h00m07p-AUTOSAVE';

console.log('=== Madden Franchise File Detection Test ===\n');
console.log(`Testing file: ${testFile}\n`);

async function detectVersion() {
  try {
    const franchise = new Franchise(testFile);

    console.log('Opening franchise file...');
    await franchise.on('ready', async () => {
      console.log('✓ File opened successfully!\n');

      // Get game year
      const gameYear = franchise.schema.meta.gameYear;
      console.log(`Game Year: ${gameYear}`);

      // Get schema version
      const schemaVersion = franchise.schema.meta.major;
      console.log(`Schema Version: ${schemaVersion}`);

      // Determine if M25 or M26
      if (gameYear === 26 || gameYear === 2026) {
        console.log('\n🎮 This is a MADDEN 26 franchise file!\n');
      } else if (gameYear === 25 || gameYear === 2025) {
        console.log('\n🎮 This is a MADDEN 25 franchise file!\n');
      } else {
        console.log(`\n🎮 This is a MADDEN ${gameYear} franchise file!\n`);
      }

      // Additional metadata
      console.log('Additional Info:');
      console.log(`- Schema major: ${franchise.schema.meta.major}`);
      console.log(`- Schema minor: ${franchise.schema.meta.minor || 'N/A'}`);

      // Count tables
      const tables = franchise.getAllTables();
      console.log(`- Available tables: ${tables.length}`);

      // Show some key tables
      console.log('\nKey Tables Found:');
      const keyTables = ['Player', 'Team', 'Coach', 'Schedule', 'Draft', 'CharacterVisuals'];
      keyTables.forEach(tableName => {
        const table = franchise.getTableByName(tableName);
        if (table) {
          console.log(`  ✓ ${tableName} table exists`);
        } else {
          console.log(`  ✗ ${tableName} table NOT found`);
        }
      });

      process.exit(0);
    });

    // Error handling
    franchise.on('error', (err) => {
      console.error('\n✗ Error opening franchise file:');
      console.error(err.message);
      console.error('\nStack trace:', err.stack);
      process.exit(1);
    });

  } catch (error) {
    console.error('\n✗ Fatal error:');
    console.error(error.message);
    console.error('\nStack trace:', error.stack);
    process.exit(1);
  }
}

detectVersion();
