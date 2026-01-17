const path = require('path');

async function main() {
  try {
    const module = await import('madden-franchise');
    const createFranchise = module.create;

    const franchise = await createFranchise('C:/Users/tshan/Documents/Madden NFL 26/Saves/CAREER-1994TEST');

    // Get the Player[] roster array table (ID 5907)
    const rosterArrayTable = franchise.getTableById(5907);
    await rosterArrayTable.readRecords();

    const brownsRow = rosterArrayTable.records[4];
    const ravensRow = rosterArrayTable.records[24];

    console.log('=== Browns Roster Array (Row 4) ===');
    console.log('arraySize:', brownsRow.arraySize);

    // Check if we can directly set arraySize
    console.log('\nIs arraySize settable?');
    console.log('typeof brownsRow.arraySize:', typeof brownsRow.arraySize);

    // Check field structure
    console.log('\n=== Field Structure ===');
    const field0 = brownsRow._fieldsArray?.[0];
    if (field0) {
      console.log('Field 0 properties:', Object.keys(field0));
      console.log('Field 0 value type:', typeof field0.value);
      console.log('Field 0 referenceData:', field0.referenceData);
    }

    // Check if we can set individual fields
    console.log('\n=== Testing Field Assignment ===');
    console.log('brownsRow.Player0 (before):', brownsRow.Player0);

    // Check all available properties on the record
    console.log('\n=== All Properties on Record ===');
    const allProps = Object.getOwnPropertyNames(brownsRow);
    console.log('Properties (first 20):', allProps.slice(0, 20));

    // Look for setter methods
    console.log('\n=== Looking for Setters ===');
    const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(brownsRow), 'arraySize');
    console.log('arraySize descriptor:', descriptor);

    // Check Ravens row structure
    console.log('\n=== Ravens Roster Array (Row 24) ===');
    console.log('arraySize:', ravensRow.arraySize);
    console.log('First 3 player refs:');
    for (let i = 0; i < 3; i++) {
      const field = ravensRow._fieldsArray?.[i];
      if (field) {
        console.log(`  Player${i}: refData=${JSON.stringify(field.referenceData)}`);
      }
    }

    // Check for methods to add/remove references
    console.log('\n=== Checking for push/pop/splice methods ===');
    console.log('push:', typeof brownsRow.push);
    console.log('pop:', typeof brownsRow.pop);
    console.log('splice:', typeof brownsRow.splice);
    console.log('addReference:', typeof brownsRow.addReference);
    console.log('removeReference:', typeof brownsRow.removeReference);

    // Check _fieldsArray directly
    console.log('\n=== Direct _fieldsArray manipulation ===');
    console.log('_fieldsArray is array:', Array.isArray(brownsRow._fieldsArray));
    console.log('_fieldsArray length:', brownsRow._fieldsArray?.length);

    // Try to understand how to build a player reference binary value
    console.log('\n=== Reference Binary Format ===');
    const ref0 = brownsRow.Player0;
    console.log('Player0 value:', ref0);
    console.log('Player0 ref data:', brownsRow._fieldsArray[0].referenceData);

    // Check if there's a way to create a reference
    console.log('\n=== FranchiseTable reference creation methods ===');
    const franchiseMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(franchise));
    console.log('Franchise methods:', franchiseMethods);

  } catch (err) {
    console.error('Error:', err.message, err.stack);
  }
}

main();
