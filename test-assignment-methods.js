// Test different ways of assigning to franchise records
const fs = require('fs');

const originalPath = 'C:/Users/tshan/Documents/Madden NFL 26/saves/CAREER-95exp';
const testPath = originalPath + '-ASSIGN-TEST';

async function test() {
  fs.copyFileSync(originalPath, testPath);

  const FranchiseModule = await import('madden-franchise');
  const franchise = await FranchiseModule.create(testPath);
  const table = franchise.getTableByUniqueId(3123991521);
  await table.readRecords();

  console.log('Testing different assignment methods:\n');

  // Method 1: Direct via table.records[0]
  console.log('Method 1: table.records[0].CurrentSeasonYear = 1999');
  console.log('  Before:', table.records[0].CurrentSeasonYear);
  table.records[0].CurrentSeasonYear = 1999;
  console.log('  After:', table.records[0].CurrentSeasonYear);

  // Method 2: Via variable
  const record = table.records[0];
  console.log('\nMethod 2: record = table.records[0]; record.CurrentSeasonYear = 1998');
  console.log('  Before:', record.CurrentSeasonYear);
  record.CurrentSeasonYear = 1998;
  console.log('  After:', record.CurrentSeasonYear);
  console.log('  Via table.records[0]:', table.records[0].CurrentSeasonYear);

  // Method 3: Check what "in" operator returns
  console.log('\nMethod 3: Testing "in" operator');
  console.log('  "CurrentSeasonYear" in record:', 'CurrentSeasonYear' in record);
  console.log('  record.CurrentSeasonYear !== undefined:', record.CurrentSeasonYear !== undefined);
  console.log('  Object.keys(record):', Object.keys(record).slice(0, 10));

  // Method 4: Check prototype
  const proto = Object.getPrototypeOf(record);
  const desc = Object.getOwnPropertyDescriptor(proto, 'CurrentSeasonYear');
  console.log('\nMethod 4: Checking prototype');
  console.log('  Has getter on prototype:', desc?.get !== undefined);
  console.log('  Has setter on prototype:', desc?.set !== undefined);

  // Save and reload
  console.log('\nSaving...');
  await franchise.save(testPath);

  const franchise2 = await FranchiseModule.create(testPath);
  const table2 = franchise2.getTableByUniqueId(3123991521);
  await table2.readRecords();
  console.log('\nAfter reload:', table2.records[0].CurrentSeasonYear);

  fs.unlinkSync(testPath);
  console.log('\nTest complete');
}

test().catch(console.error);
