/**
 * Direct Test of Franchise Handler Logic
 *
 * This bypasses Electron IPC and directly tests the data conversion logic
 * to verify College field binary string conversion works.
 */

const Franchise = require('madden-franchise');
const fs = require('fs');
const path = require('path');

// Find the franchise file
const possiblePaths = [
  'C:\\Users\\tshan\\OneDrive\\Documents\\Madden NFL 26\\Saves\\CAREER-TEST',
  'C:\\Users\\tshan\\OneDrive\\Documents\\Madden Files\\Madden 26\\CAREER-DOUGFLUTIE',
  'C:\\Users\\tshan\\Documents\\Madden Files\\Madden 26\\CAREER-DOUGFLUTIE'
];

let testFile = null;
for (const filePath of possiblePaths) {
  if (fs.existsSync(filePath)) {
    testFile = filePath;
    break;
  }
}

if (!testFile) {
  console.error('❌ No franchise file found. Tried:');
  possiblePaths.forEach(p => console.error(`  - ${p}`));
  process.exit(1);
}

// Load college lookup CSV
const collegeLookupPath = path.join(__dirname, 'data', 'lookups', 'college_lookup.csv');
if (!fs.existsSync(collegeLookupPath)) {
  console.error('❌ College lookup not found:', collegeLookupPath);
  process.exit(1);
}

const collegeCSV = fs.readFileSync(collegeLookupPath, 'utf-8');
const colleges = new Map();

// Parse CSV manually (header row + data rows)
const lines = collegeCSV.split('\n').filter(line => line.trim());
const headers = lines[0].split(',').map(h => h.trim());

// Find column indices - handle PCOL,CollegeName format
const idIndex = headers.findIndex(h =>
  h.toLowerCase().includes('id') ||
  h.toUpperCase() === 'PCOL'
);
const nameIndex = headers.findIndex(h =>
  h.toLowerCase().includes('name') ||
  h.toLowerCase().includes('college')
);

for (let i = 1; i < lines.length; i++) {
  const values = lines[i].split(',');
  const id = parseInt(values[idIndex]?.trim());
  const name = values[nameIndex]?.trim();

  if (!isNaN(id) && name) {
    colleges.set(id, name);
  }
}

console.log(`\n✓ Loaded ${colleges.size} colleges from CSV`);

async function testFranchiseHandlerLogic() {
  console.log('\n=== TESTING FRANCHISE HANDLER LOGIC ===\n');
  console.log('Test file:', testFile);

  try {
    // Step 1: Load franchise
    console.log('\n[1] Loading franchise...');
    const franchise = await Franchise.create(testFile, {
      gameYearOverride: 26
    });

    const playerTable = franchise.getTableByName('Player');
    if (!playerTable) {
      throw new Error('Player table not found');
    }

    await playerTable.readRecords();
    console.log(`✓ Loaded ${playerTable.records.length} players`);

    // Step 2: Process first 5 players (simulating what franchise-handlers.ts does)
    console.log('\n[2] Processing first 5 players:');

    for (let i = 0; i < Math.min(5, playerTable.records.length); i++) {
      const record = playerTable.records[i];
      if (record.isEmpty) continue;

      console.log(`\n--- Player ${i + 1}: ${record.FirstName} ${record.LastName} ---`);

      // Check College field in fieldsArray
      const collegeField = record.fieldsArray.find(f => f.key === 'College');
      if (collegeField) {
        const rawValue = collegeField.value;
        console.log(`  fieldsArray College:`, {
          type: typeof rawValue,
          value: typeof rawValue === 'string' ? rawValue.slice(0, 20) + '...' : rawValue,
          isBinary: typeof rawValue === 'string' && rawValue.match(/^[01]{32}$/) ? 'YES' : 'NO'
        });

        // Simulate the conversion logic from franchise-handlers.ts
        if (typeof rawValue === 'string' && rawValue.match(/^[01]{32}$/)) {
          const binaryInt = parseInt(rawValue, 2);
          const enumIndex = binaryInt & 0x7FFFFFFF;
          const collegeName = colleges.get(enumIndex);

          console.log(`  Binary conversion:`);
          console.log(`    Binary → Integer: ${binaryInt}`);
          console.log(`    Masked enum index: ${enumIndex}`);
          console.log(`    College name: ${collegeName || '(not found in CSV)'}`);

          if (collegeName) {
            console.log(`  ✅ Conversion successful: ${enumIndex} → ${collegeName}`);
          } else {
            console.log(`  ⚠️ College ID ${enumIndex} not in CSV (have ${colleges.size} entries)`);
          }
        } else {
          console.log(`  ℹ️ College value is not a binary string, no conversion needed`);
        }
      } else {
        console.log(`  ⚠️ College field not found in fieldsArray`);
      }

      // Also check direct record.College access
      if (record.College !== undefined) {
        console.log(`  Direct record.College: ${typeof record.College === 'string' ? record.College.slice(0, 20) + '...' : record.College}`);
      }
    }

    console.log('\n=== TEST COMPLETE ===\n');

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testFranchiseHandlerLogic();
