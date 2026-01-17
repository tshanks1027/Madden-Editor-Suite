// Test the FIXED flow (no 'in' checks)
const fs = require('fs');

const originalPath = 'C:/Users/tshan/Documents/Madden NFL 26/saves/CAREER-95exp';
const testPath = originalPath + '-FIXED-TEST';

async function test() {
  fs.copyFileSync(originalPath, testPath);

  const FranchiseModule = await import('madden-franchise');
  const franchise = await FranchiseModule.create(testPath);
  const table = franchise.getTableByUniqueId(3123991521);
  await table.readRecords();
  const seasonRecord = table.records[0];

  console.log('Testing FIXED flow (no "in" checks):\n');

  console.log('BEFORE:');
  console.log('  CurrentSeasonYear:', seasonRecord.CurrentSeasonYear);
  console.log('  BaseCalendarYear:', seasonRecord.BaseCalendarYear);
  console.log('  BaseSuperBowlNumber:', seasonRecord.BaseSuperBowlNumber);

  const targetYear = 1995;
  const superBowlNumber = 30;

  // Direct assignment - NO 'in' check!
  try {
    console.log(`\nSetting CurrentSeasonYear: ${seasonRecord.CurrentSeasonYear} -> ${targetYear}`);
    seasonRecord.CurrentSeasonYear = targetYear;
    console.log(`  Result: ${seasonRecord.CurrentSeasonYear}`);
  } catch (e) {
    console.error('  ERROR:', e.message);
  }

  try {
    console.log(`\nSetting BaseCalendarYear: ${seasonRecord.BaseCalendarYear} -> ${targetYear}`);
    seasonRecord.BaseCalendarYear = targetYear;
    console.log(`  Result: ${seasonRecord.BaseCalendarYear}`);
  } catch (e) {
    console.error('  ERROR:', e.message);
  }

  try {
    console.log(`\nSetting BaseSuperBowlNumber: ${seasonRecord.BaseSuperBowlNumber} -> ${superBowlNumber}`);
    seasonRecord.BaseSuperBowlNumber = superBowlNumber;
    console.log(`  Result: ${seasonRecord.BaseSuperBowlNumber}`);
  } catch (e) {
    console.error('  ERROR:', e.message);
  }

  console.log('\nAFTER (in memory):');
  console.log('  CurrentSeasonYear:', seasonRecord.CurrentSeasonYear);
  console.log('  BaseCalendarYear:', seasonRecord.BaseCalendarYear);
  console.log('  BaseSuperBowlNumber:', seasonRecord.BaseSuperBowlNumber);

  console.log('\nSaving...');
  await franchise.save(testPath);

  console.log('\nReloading...');
  const franchise2 = await FranchiseModule.create(testPath);
  const table2 = franchise2.getTableByUniqueId(3123991521);
  await table2.readRecords();

  console.log('\nAFTER RELOAD:');
  console.log('  CurrentSeasonYear:', table2.records[0].CurrentSeasonYear);
  console.log('  BaseCalendarYear:', table2.records[0].BaseCalendarYear);
  console.log('  BaseSuperBowlNumber:', table2.records[0].BaseSuperBowlNumber);

  if (table2.records[0].CurrentSeasonYear === targetYear) {
    console.log('\n✅ SUCCESS! Year changes persisted!');
    console.log(`\nTest file: ${testPath}`);
    console.log('>>> Load this in Madden to verify the year shows 1995');
  } else {
    console.log('\n❌ FAILED - changes did not persist');
  }
}

test().catch(console.error);
