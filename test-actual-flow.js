// Simulate the exact flow that happens in the Retro Editor UI
// This will help identify where the problem is

const fs = require('fs');
const path = require('path');

const originalPath = 'C:/Users/tshan/Documents/Madden NFL 26/saves/CAREER-95exp';
const testPath = originalPath + '-FLOW-TEST';

// Same table IDs as RetroEditorService
const TABLE_IDS = {
  seasonInfoTable: 3123991521,
  salaryInfoTable: 3759217828
};

async function testFlow() {
  console.log('='.repeat(60));
  console.log('TESTING ACTUAL RETRO EDITOR FLOW');
  console.log('='.repeat(60));

  // Copy file
  fs.copyFileSync(originalPath, testPath);
  console.log('Created test file:', testPath);

  // Load franchise (simulates loadFranchiseFile)
  const FranchiseModule = await import('madden-franchise');
  const franchise = await FranchiseModule.create(testPath);
  console.log('Franchise loaded');

  // Simulate setSeasonYear(filePath, 1995)
  const targetYear = 1995;
  console.log(`\nSimulating setSeasonYear to ${targetYear}...`);

  const seasonInfoTable = franchise.getTableByUniqueId(TABLE_IDS.seasonInfoTable);
  await seasonInfoTable.readRecords();
  const seasonRecord = seasonInfoTable.records[0];

  console.log('BEFORE:');
  console.log('  CurrentSeasonYear:', seasonRecord.CurrentSeasonYear);
  console.log('  BaseCalendarYear:', seasonRecord.BaseCalendarYear);
  console.log('  BaseSuperBowlNumber:', seasonRecord.BaseSuperBowlNumber);

  // Apply changes exactly like setSeasonYear does
  if ('CurrentSeasonYear' in seasonRecord) {
    seasonRecord.CurrentSeasonYear = targetYear;
    console.log(`  Set CurrentSeasonYear = ${targetYear}`);
  }
  if ('BaseCalendarYear' in seasonRecord) {
    seasonRecord.BaseCalendarYear = targetYear;
    console.log(`  Set BaseCalendarYear = ${targetYear}`);
  }
  if ('BaseSuperBowlNumber' in seasonRecord) {
    seasonRecord.BaseSuperBowlNumber = 30; // Super Bowl XXX
    console.log(`  Set BaseSuperBowlNumber = 30`);
  }

  console.log('\nAFTER (in memory):');
  console.log('  CurrentSeasonYear:', seasonRecord.CurrentSeasonYear);
  console.log('  BaseCalendarYear:', seasonRecord.BaseCalendarYear);
  console.log('  BaseSuperBowlNumber:', seasonRecord.BaseSuperBowlNumber);

  // Simulate saveFranchiseFile
  console.log('\nSaving franchise file...');
  await franchise.save(testPath);
  console.log('Save completed');

  // Reload and verify
  console.log('\nReloading to verify...');
  const franchise2 = await FranchiseModule.create(testPath);
  const seasonTable2 = franchise2.getTableByUniqueId(TABLE_IDS.seasonInfoTable);
  await seasonTable2.readRecords();

  console.log('\nAFTER RELOAD:');
  console.log('  CurrentSeasonYear:', seasonTable2.records[0].CurrentSeasonYear);
  console.log('  BaseCalendarYear:', seasonTable2.records[0].BaseCalendarYear);
  console.log('  BaseSuperBowlNumber:', seasonTable2.records[0].BaseSuperBowlNumber);

  // Check if it worked
  if (seasonTable2.records[0].CurrentSeasonYear === targetYear) {
    console.log('\n✅ SUCCESS: Year change persisted correctly!');
    console.log(`\nTest file saved at: ${testPath}`);
    console.log('>>> Load this in Madden and check if the year shows 1995');
  } else {
    console.log('\n❌ FAILURE: Year did not persist!');
  }

  process.exit(0);
}

testFlow().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
