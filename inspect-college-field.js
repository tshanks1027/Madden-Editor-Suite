/**
 * Inspect College Field Structure in M26
 *
 * This checks what the madden-franchise library says about the College field
 * to understand if it's an enum, reference, or something else in M26.
 */

const Franchise = require('madden-franchise');
const path = require('path');

const TEST_FILE = 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden NFL 26\\Saves\\CAREER-TEST';

async function inspectCollegeField() {
  console.log('\n=== INSPECTING COLLEGE FIELD STRUCTURE ===\n');

  try {
    const franchise = await Franchise.create(TEST_FILE, {
      gameYearOverride: 26
    });

    const playerTable = franchise.getTableByName('Player');
    await playerTable.readRecords();

    const firstPlayer = playerTable.records[0];

    // Find the College field in the offset table
    const collegeOffset = playerTable.offsetTable.find(offset =>
      offset.name === 'College' || offset.name.includes('College')
    );

    if (collegeOffset) {
      console.log('College field offset structure:');
      console.log('  Name:', collegeOffset.name);
      console.log('  Type:', collegeOffset.type);
      console.log('  Offset:', collegeOffset.offset);
      console.log('  Length:', collegeOffset.length);
      console.log('  Enum?:', collegeOffset.enum ? 'YES' : 'NO');

      if (collegeOffset.enum) {
        console.log('\n  Enum details:');
        console.log('    Name:', collegeOffset.enum.name);
        console.log('    Members count:', collegeOffset.enum.members ? collegeOffset.enum.members.length : 0);
        console.log('    Max length:', collegeOffset.enum._maxLength);

        if (collegeOffset.enum.members && collegeOffset.enum.members.length > 0) {
          console.log('    First 5 members:', collegeOffset.enum.members.slice(0, 5).map(m => m.name));
        } else {
          console.log('    ⚠️ ENUM HAS NO MEMBERS!');
        }
      }

      console.log('  Reference?:', collegeOffset.isReference ? 'YES' : 'NO');
      console.log('  Value in second table?:', collegeOffset.valueInSecondTable);
      console.log('  Value in third table?:', collegeOffset.valueInThirdTable);
    } else {
      console.log('⚠️ College field not found in offset table!');
    }

    // Check the actual field value structure
    console.log('\n--- First Player College Field ---');
    const collegeField = firstPlayer.fieldsArray.find(f => f.key === 'College');

    if (collegeField) {
      console.log('Field key:', collegeField.key);
      console.log('Field value type:', typeof collegeField.value);
      console.log('Field value:', collegeField.value);

      if (collegeField.offset) {
        console.log('\nField offset details:');
        console.log('  Type:', collegeField.offset.type);
        console.log('  Is enum?:', collegeField.offset.enum ? 'YES' : 'NO');
        console.log('  Is reference?:', collegeField.offset.isReference ? 'YES' : 'NO');
      }
    }

    // Try to access the field directly
    console.log('\n--- Direct College Access ---');
    console.log('record.College:', firstPlayer.College);
    console.log('Type:', typeof firstPlayer.College);

    console.log('\n=== DONE ===\n');

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

inspectCollegeField();
