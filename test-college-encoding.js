/**
 * Test different College binary encodings
 */

const Franchise = require('madden-franchise');
const fs = require('fs');
const path = require('path');

const TEST_FILE = 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden NFL 26\\Saves\\CAREER-TEST';
const collegeLookupPath = path.join(__dirname, 'data', 'lookups', 'college_lookup.csv');

// Load college CSV
const collegeCSV = fs.readFileSync(collegeLookupPath, 'utf-8');
const colleges = new Map();
const lines = collegeCSV.split('\n').filter(line => line.trim());
const headers = lines[0].split(',').map(h => h.trim());
const idIndex = headers.findIndex(h => h.toUpperCase() === 'PCOL');
const nameIndex = headers.findIndex(h => h.toLowerCase().includes('name'));

for (let i = 1; i < lines.length; i++) {
  const values = lines[i].split(',');
  const id = parseInt(values[idIndex]?.trim());
  const name = values[nameIndex]?.trim();
  if (!isNaN(id) && name) {
    colleges.set(id, name);
  }
}

console.log(`\n✓ Loaded ${colleges.size} colleges from CSV (range 0-${colleges.size - 1})\n`);

async function testEncodings() {
  try {
    const franchise = await Franchise.create(TEST_FILE, { gameYearOverride: 26 });
    const playerTable = franchise.getTableByName('Player');
    await playerTable.readRecords();

    console.log('Testing different bit extraction methods on first 10 players:\n');

    for (let i = 0; i < Math.min(10, playerTable.records.length); i++) {
      const record = playerTable.records[i];
      if (record.isEmpty) continue;

      const collegeField = record.fieldsArray.find(f => f.key === 'College');
      if (!collegeField) continue;

      const binaryString = collegeField.value;
      if (typeof binaryString !== 'string' || !binaryString.match(/^[01]{32}$/)) continue;

      console.log(`Player ${i + 1}: ${record.FirstName} ${record.LastName}`);
      console.log(`  Binary: ${binaryString}`);

      // Method 1: Last 16 bits (MyFranchise reference style)
      const last16Bits = binaryString.substring(16);
      const id16 = parseInt(last16Bits, 2);
      console.log(`  Last 16 bits: ${last16Bits} = ${id16} → ${colleges.get(id16) || 'NOT FOUND'}`);

      // Method 2: Last 10 bits
      const last10Bits = binaryString.substring(22);
      const id10 = parseInt(last10Bits, 2);
      console.log(`  Last 10 bits: ${last10Bits} = ${id10} → ${colleges.get(id10) || 'NOT FOUND'}`);

      // Method 3: Last 9 bits
      const last9Bits = binaryString.substring(23);
      const id9 = parseInt(last9Bits, 2);
      console.log(`  Last 9 bits: ${last9Bits} = ${id9} → ${colleges.get(id9) || 'NOT FOUND'}`);

      // Method 4: Last 8 bits
      const last8Bits = binaryString.substring(24);
      const id8 = parseInt(last8Bits, 2);
      console.log(`  Last 8 bits: ${last8Bits} = ${id8} → ${colleges.get(id8) || 'NOT FOUND'}`);

      // Method 5: Parse entire string and mask
      const fullValue = parseInt(binaryString, 2);
      const masked = fullValue & 0x7FFFFFFF;
      console.log(`  Full value masked: ${masked} → ${colleges.get(masked) || 'NOT FOUND'}`);

      console.log();
    }

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    process.exit(1);
  }
}

testEncodings();
