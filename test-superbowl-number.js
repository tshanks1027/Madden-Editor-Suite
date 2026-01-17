/**
 * Test setting the correct Super Bowl number for historical years
 * Run with: node test-superbowl-number.js <franchise-file-path> <year>
 *
 * This tests if we can update SeasonInfo.BaseSuperBowlNumber to the correct value
 * for a historical year.
 *
 * Super Bowl I was after the 1966 season, so:
 * - 1966 → Super Bowl I (1)
 * - 1976 → Super Bowl XI (11)
 * - 1995 → Super Bowl XXX (30)
 * - 2002 → Super Bowl XXXVII (37)
 * - 2024 → Super Bowl LIX (59)
 *
 * NOTE: This does NOT save changes - it only tests if manipulation is possible
 */

const fs = require('fs');
const Franchise = require('madden-franchise');

// Roman numeral conversion for display
function toRoman(num) {
  const romanNumerals = [
    { value: 50, numeral: 'L' },
    { value: 40, numeral: 'XL' },
    { value: 10, numeral: 'X' },
    { value: 9, numeral: 'IX' },
    { value: 5, numeral: 'V' },
    { value: 4, numeral: 'IV' },
    { value: 1, numeral: 'I' }
  ];

  let result = '';
  for (const { value, numeral } of romanNumerals) {
    while (num >= value) {
      result += numeral;
      num -= value;
    }
  }
  return result;
}

async function testSuperBowlNumber(filePath, targetYear) {
  console.log('='.repeat(80));
  console.log('SUPER BOWL NUMBER UPDATE TEST');
  console.log('='.repeat(80));
  console.log(`File: ${filePath}`);
  console.log(`Target Year: ${targetYear}`);
  console.log('NOTE: No changes will be saved - this is a read-only test');
  console.log('');

  const franchise = await Franchise.create(filePath);

  // Calculate expected Super Bowl number
  // Super Bowl I was after the 1966 season
  const targetSuperBowlNumber = Math.max(0, targetYear - 1965);
  const romanNumeral = toRoman(targetSuperBowlNumber);

  console.log(`\nExpected Super Bowl for ${targetYear}: ${targetSuperBowlNumber} (Super Bowl ${romanNumeral})`);

  // Find SeasonInfo table
  console.log('\n' + '='.repeat(80));
  console.log('CHECKING SeasonInfo TABLE');
  console.log('='.repeat(80));

  const seasonInfoTable = franchise.getTableByName('SeasonInfo');
  if (!seasonInfoTable) {
    console.log('\nERROR: SeasonInfo table not found');
    return;
  }

  await seasonInfoTable.readRecords();
  console.log(`\nSeasonInfo table found with ${seasonInfoTable.records.length} records`);

  // Find non-empty records
  const nonEmpty = seasonInfoTable.records.filter(r => r.isEmpty === false);
  console.log(`Non-empty records: ${nonEmpty.length}`);

  if (nonEmpty.length === 0) {
    console.log('\nNo non-empty SeasonInfo records found');
    return;
  }

  // Show all fields on the first record
  const sample = nonEmpty[0];
  const fields = Object.keys(sample).filter(k =>
    !k.startsWith('_') && typeof sample[k] !== 'function'
  );

  console.log(`\nSeasonInfo fields: ${fields.join(', ')}`);

  // Check for BaseSuperBowlNumber field
  console.log('\n' + '='.repeat(80));
  console.log('SUPER BOWL NUMBER MANIPULATION TEST');
  console.log('='.repeat(80));

  let foundField = false;
  let testSuccess = false;

  for (const record of nonEmpty) {
    if (record.BaseSuperBowlNumber !== undefined) {
      foundField = true;
      const currentValue = record.BaseSuperBowlNumber;
      const currentRoman = toRoman(currentValue);

      console.log(`\nCurrent BaseSuperBowlNumber: ${currentValue} (Super Bowl ${currentRoman})`);
      console.log(`Target BaseSuperBowlNumber: ${targetSuperBowlNumber} (Super Bowl ${romanNumeral})`);

      // Test if we can change it
      console.log('\nAttempting to change value...');
      try {
        record.BaseSuperBowlNumber = targetSuperBowlNumber;

        // Verify it changed
        if (record.BaseSuperBowlNumber === targetSuperBowlNumber) {
          console.log(`SUCCESS: Value changed from ${currentValue} to ${targetSuperBowlNumber}`);
          testSuccess = true;

          // Restore original (since we're not saving)
          record.BaseSuperBowlNumber = currentValue;
          console.log(`Restored to original value: ${currentValue}`);
        } else {
          console.log(`PARTIAL: Set attempted but read back as ${record.BaseSuperBowlNumber}`);
        }
      } catch (err) {
        console.log(`FAILED: ${err.message}`);
      }

      break;
    }
  }

  if (!foundField) {
    // Check if it's stored under a different name
    console.log('\nBaseSuperBowlNumber field not found directly. Searching for related fields...');

    const superBowlFields = fields.filter(f => {
      const fl = f.toLowerCase();
      return fl.includes('super') || fl.includes('bowl') || fl.includes('championship');
    });

    if (superBowlFields.length > 0) {
      console.log(`Found related fields: ${superBowlFields.join(', ')}`);
      for (const field of superBowlFields) {
        console.log(`  ${field}: ${sample[field]}`);
      }
    } else {
      console.log('No Super Bowl related fields found in SeasonInfo');
    }
  }

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));

  console.log(`\nTarget Year: ${targetYear}`);
  console.log(`Expected Super Bowl: ${targetSuperBowlNumber} (Super Bowl ${romanNumeral})`);
  console.log(`BaseSuperBowlNumber field found: ${foundField ? 'YES' : 'NO'}`);
  console.log(`Can update value: ${testSuccess ? 'YES' : 'UNKNOWN'}`);

  if (testSuccess) {
    console.log(`\nCONCLUSION: Setting Super Bowl number SHOULD WORK`);
    console.log(`When you apply retro settings for ${targetYear}, the game should show Super Bowl ${romanNumeral}`);
  } else if (foundField) {
    console.log(`\nCONCLUSION: Field found but update not confirmed`);
  } else {
    console.log(`\nCONCLUSION: BaseSuperBowlNumber field not found - may need different approach`);
  }

  // Also show some reference Super Bowl numbers
  console.log('\n' + '='.repeat(80));
  console.log('REFERENCE: Super Bowl Numbers by Year');
  console.log('='.repeat(80));

  const referenceYears = [1966, 1976, 1980, 1990, 1995, 2000, 2002, 2010, 2020, 2024];
  for (const y of referenceYears) {
    const sbNum = y - 1965;
    console.log(`  ${y}: Super Bowl ${toRoman(sbNum)} (${sbNum})`);
  }

  return {
    targetYear,
    targetSuperBowlNumber,
    romanNumeral,
    fieldFound: foundField,
    testSuccess
  };
}

// Main execution
const args = process.argv.slice(2);
if (args.length < 2) {
  console.log('Usage: node test-superbowl-number.js <franchise-file-path> <year>');
  console.log('Example: node test-superbowl-number.js "C:/path/to/YOURFRANCHISE" 1976');
  console.log('');
  console.log('Reference: Super Bowl I was after the 1966 season');
  console.log('  So Super Bowl number = Year - 1965');
  process.exit(1);
}

const filePath = args[0];
const year = parseInt(args[1], 10);

if (!fs.existsSync(filePath)) {
  console.error(`File not found: ${filePath}`);
  process.exit(1);
}

if (isNaN(year) || year < 1966 || year > 2030) {
  console.error(`Invalid year: ${args[1]} (must be 1966-2030)`);
  process.exit(1);
}

testSuperBowlNumber(filePath, year)
  .then((results) => {
    console.log('\n' + '='.repeat(80));
    console.log('Test complete. No changes were saved to the franchise file.');
    console.log('='.repeat(80));
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
