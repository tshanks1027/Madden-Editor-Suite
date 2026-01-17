// Test script to verify franchise file save functionality
// This will test if changes actually persist after saving

const fs = require('fs');
const path = require('path');

// Use a test copy to avoid corrupting original
const originalPath = process.argv[2] || 'C:/Users/tshan/Documents/Madden NFL 26/saves/CAREER-95exp';
const testPath = originalPath + '-TEST-SAVE';

const SEASON_INFO_TABLE_ID = 3123991521;

async function testSave() {
  console.log('='.repeat(60));
  console.log('FRANCHISE SAVE TEST');
  console.log('='.repeat(60));

  // Step 1: Copy original to test file
  console.log('\n1. Copying original file to test file...');
  fs.copyFileSync(originalPath, testPath);
  console.log('   Created:', testPath);

  // Step 2: Load and read initial value
  console.log('\n2. Loading test file and reading SeasonInfo...');
  const FranchiseModule = await import('madden-franchise');
  const createFranchise = FranchiseModule.create;

  let franchise = await createFranchise(testPath);
  let seasonTable = franchise.getTableByUniqueId(SEASON_INFO_TABLE_ID);
  await seasonTable.readRecords();

  const originalYear = seasonTable.records[0].CurrentSeasonYear;
  console.log('   Original CurrentSeasonYear:', originalYear);

  // Step 3: Modify the value
  const newYear = 1999;
  console.log('\n3. Setting CurrentSeasonYear to', newYear, '...');
  seasonTable.records[0].CurrentSeasonYear = newYear;

  // Check if it changed in memory
  console.log('   In-memory value after assignment:', seasonTable.records[0].CurrentSeasonYear);

  // Step 4: Save the file
  console.log('\n4. Saving franchise file...');
  await franchise.save(testPath);
  console.log('   Save completed');

  // Step 5: Clear instance and reload
  console.log('\n5. Reloading file to verify persistence...');
  franchise = null;

  // Create new instance
  franchise = await createFranchise(testPath);
  seasonTable = franchise.getTableByUniqueId(SEASON_INFO_TABLE_ID);
  await seasonTable.readRecords();

  const reloadedYear = seasonTable.records[0].CurrentSeasonYear;
  console.log('   Reloaded CurrentSeasonYear:', reloadedYear);

  // Step 6: Report results
  console.log('\n' + '='.repeat(60));
  console.log('RESULTS');
  console.log('='.repeat(60));
  console.log('Original value:', originalYear);
  console.log('Set to:', newYear);
  console.log('After reload:', reloadedYear);

  if (reloadedYear === newYear) {
    console.log('\n✅ SUCCESS: Changes persisted correctly!');
    console.log('   The madden-franchise library is working properly.');
  } else if (reloadedYear === originalYear) {
    console.log('\n❌ FAILURE: Changes did NOT persist!');
    console.log('   The madden-franchise library is NOT saving changes.');
    console.log('   This is the root cause of the issue.');
  } else {
    console.log('\n⚠️ UNEXPECTED: Value is different from both original and new!');
    console.log('   Something strange is happening.');
  }

  // Cleanup
  console.log('\n6. Cleaning up test file...');
  try {
    fs.unlinkSync(testPath);
    console.log('   Deleted:', testPath);
  } catch (e) {
    console.log('   Could not delete test file:', e.message);
  }

  console.log('\nTest complete.');
  process.exit(0);
}

testSave().catch(err => {
  console.error('ERROR:', err.message);
  console.error(err.stack);
  process.exit(1);
});
