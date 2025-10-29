/**
 * Check ALL properties of College field from madden-franchise library
 */

const Franchise = require('madden-franchise');
const TEST_FILE = 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden NFL 26\\Saves\\CAREER-TEST';

async function checkRawValues() {
  try {
    const franchise = await Franchise.create(TEST_FILE, { gameYearOverride: 26 });
    const playerTable = franchise.getTableByName('Player');
    await playerTable.readRecords();

    const targetPlayers = [
      'Abanikanda',
      'Abdullah',
      'Abernathy',
      'Abraham'
    ];

    console.log('\n=== RAW COLLEGE FIELD INSPECTION ===\n');

    for (const targetName of targetPlayers) {
      const player = playerTable.records.find(r =>
        r.LastName && r.LastName.includes(targetName)
      );

      if (!player) continue;

      console.log(`\n--- ${player.FirstName} ${player.LastName} ---`);

      // Check the College field object itself
      const collegeField = player.fieldsArray.find(f => f.key === 'College');

      if (collegeField) {
        console.log('College field object keys:', Object.keys(collegeField));
        console.log('  value:', collegeField.value);
        console.log('  _value:', collegeField._value);
        console.log('  _unformattedValue:', collegeField._unformattedValue);

        if (collegeField.offset) {
          console.log('  offset.type:', collegeField.offset.type);
          console.log('  offset.length:', collegeField.offset.length);
          console.log('  offset.isReference:', collegeField.offset.isReference);
          console.log('  offset.enum:', collegeField.offset.enum ? 'YES' : 'NO');
        }

        // Try to get the raw unformatted value
        if (collegeField._unformattedValue && collegeField._unformattedValue.getBits) {
          const rawBits = collegeField._unformattedValue.getBits(
            collegeField.offset.offset,
            collegeField.offset.length
          );
          console.log('  RAW getBits():', rawBits);
        }
      }

      // Also check direct record access
      console.log('Direct record.College:', player.College);
    }

    console.log('\n=== DONE ===\n');

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

checkRawValues();
