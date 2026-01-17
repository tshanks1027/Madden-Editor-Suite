// Test each change in isolation to find what causes the crash
// Run: node test-isolate-crash.js

const fs = require('fs');
const path = require('path');

const originalPath = 'C:/Users/tshan/Documents/Madden NFL 26/saves/CAREER-95exp';
const testDir = 'C:/Users/tshan/Documents/Madden NFL 26/saves/';

const SEASON_INFO_TABLE_ID = 3123991521;
const TEAM_TABLE_ID = 3938984019;

async function runTest(testName, modifyFn) {
  const testPath = path.join(testDir, `TEST-${testName}`);

  console.log(`\n${'='.repeat(50)}`);
  console.log(`TEST: ${testName}`);
  console.log('='.repeat(50));

  // Copy fresh file
  fs.copyFileSync(originalPath, testPath);
  console.log('Created test file:', testPath);

  // Load, modify, save
  const FranchiseModule = await import('madden-franchise');
  const franchise = await FranchiseModule.create(testPath);

  await modifyFn(franchise);

  await franchise.save(testPath);
  console.log('Saved');

  // Verify save worked
  const franchise2 = await FranchiseModule.create(testPath);
  const seasonTable = franchise2.getTableByUniqueId(SEASON_INFO_TABLE_ID);
  await seasonTable.readRecords();

  console.log('After reload - CurrentSeasonYear:', seasonTable.records[0].CurrentSeasonYear);
  console.log('');
  console.log(`>>> Test file saved at: ${testPath}`);
  console.log('>>> Load this in Madden and try to sim one week');
  console.log('>>> Report: Does it crash? If not, this change is SAFE');

  return testPath;
}

async function main() {
  const FranchiseModule = await import('madden-franchise');

  console.log('CRASH ISOLATION TEST');
  console.log('This will create separate test files for each type of change');
  console.log('Load each one in Madden and see which one crashes\n');

  // Test 1: Only change CurrentSeasonYear
  await runTest('YEAR-ONLY', async (franchise) => {
    const table = franchise.getTableByUniqueId(SEASON_INFO_TABLE_ID);
    await table.readRecords();
    console.log('Before:', table.records[0].CurrentSeasonYear);
    table.records[0].CurrentSeasonYear = 1995;
    console.log('After:', table.records[0].CurrentSeasonYear);
  });

  // Test 2: Only change BaseCalendarYear
  await runTest('CALENDAR-ONLY', async (franchise) => {
    const table = franchise.getTableByUniqueId(SEASON_INFO_TABLE_ID);
    await table.readRecords();
    console.log('Before:', table.records[0].BaseCalendarYear);
    table.records[0].BaseCalendarYear = 1995;
    console.log('After:', table.records[0].BaseCalendarYear);
  });

  // Test 3: Only change BaseSuperBowlNumber
  await runTest('SUPERBOWL-ONLY', async (franchise) => {
    const table = franchise.getTableByUniqueId(SEASON_INFO_TABLE_ID);
    await table.readRecords();
    console.log('Before:', table.records[0].BaseSuperBowlNumber);
    table.records[0].BaseSuperBowlNumber = 30; // Super Bowl XXX for 1995
    console.log('After:', table.records[0].BaseSuperBowlNumber);
  });

  // Test 4: Change all year fields together
  await runTest('ALL-YEAR-FIELDS', async (franchise) => {
    const table = franchise.getTableByUniqueId(SEASON_INFO_TABLE_ID);
    await table.readRecords();
    table.records[0].CurrentSeasonYear = 1995;
    table.records[0].BaseCalendarYear = 1995;
    table.records[0].BaseSuperBowlNumber = 30;
    console.log('Set all year fields to 1995');
  });

  // Test 5: No changes at all (baseline - just load and save)
  await runTest('NO-CHANGES', async (franchise) => {
    console.log('No changes made - just load and save');
  });

  console.log('\n' + '='.repeat(50));
  console.log('ALL TEST FILES CREATED');
  console.log('='.repeat(50));
  console.log('\nTest files in:', testDir);
  console.log('\nInstructions:');
  console.log('1. Start with TEST-NO-CHANGES - if THIS crashes, the save itself is broken');
  console.log('2. Then try TEST-YEAR-ONLY - if this crashes, changing year causes issues');
  console.log('3. Continue with each test to isolate the problem');
  console.log('\nReport back which test(s) crash the game!');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
