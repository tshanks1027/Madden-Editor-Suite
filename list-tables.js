/**
 * List all tables in M26 franchise file
 */

const Franchise = require('madden-franchise');

const TEST_FILE = 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden NFL 26\\Saves\\CAREER-TEST';

async function listTables() {
  console.log('\n=== M26 FRANCHISE TABLES ===\n');

  try {
    const franchise = await Franchise.create(TEST_FILE, {
      gameYearOverride: 26
    });

    console.log('Tables in franchise file:\n');

    franchise.tables.forEach((table, index) => {
      console.log(`[${index}] ID: ${table.header.tableId}, Name: ${table.header.name}, Records: ${table.header.recordCapacity}`);
    });

    // Look for College table
    const collegeTable = franchise.tables.find(t =>
      t.header.name.toLowerCase().includes('college')
    );

    if (collegeTable) {
      console.log('\n✓ Found College table!');
      console.log('  Table ID:', collegeTable.header.tableId);
      console.log('  Name:', collegeTable.header.name);
      console.log('  Record capacity:', collegeTable.header.recordCapacity);

      await collegeTable.readRecords();
      console.log('  Actual records:', collegeTable.records.length);

      if (collegeTable.records.length > 0) {
        console.log('\n  First 5 college records:');
        for (let i = 0; i < Math.min(5, collegeTable.records.length); i++) {
          const record = collegeTable.records[i];
          console.log(`    [${i}] Fields:`, Object.keys(record.fields).slice(0, 10).join(', '));
        }
      }
    } else {
      console.log('\n⚠️ NO College table found!');
    }

    console.log('\n=== DONE ===\n');

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

listTables();
