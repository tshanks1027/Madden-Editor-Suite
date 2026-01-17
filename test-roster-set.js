const path = require('path');

async function main() {
  try {
    const module = await import('madden-franchise');
    const createFranchise = module.create;

    const franchise = await createFranchise('C:/Users/tshan/Documents/Madden NFL 26/Saves/CAREER-1994TEST');

    // Get the Player table
    const playerTable = franchise.getTableByName('Player');
    await playerTable.readRecords();

    // Get the Player[] roster array table (ID 5907)
    const rosterArrayTable = franchise.getTableById(5907);
    await rosterArrayTable.readRecords();

    const brownsRow = rosterArrayTable.records[4];

    console.log('=== Testing getBinaryReferenceToRecord ===');

    // Get binary reference to player at index 0 (should be Browns first player)
    const playerRecord = playerTable.records[4]; // Row 4 from Browns roster
    console.log('Player at index 4:', playerRecord?.FirstName, playerRecord?.LastName);

    // Try to get binary reference
    console.log('\nTrying getBinaryReferenceToRecord...');
    const binaryRef = playerTable.getBinaryReferenceToRecord(4);
    console.log('Binary ref to player 4:', binaryRef);

    // Compare with what's in the roster array
    console.log('\nCurrent Player0 value:', brownsRow.Player0);

    // Try to access _fieldsArray and set value
    console.log('\n=== Testing field value setter ===');
    const field0 = brownsRow._fieldsArray[0];
    console.log('Field 0 current value:', field0.value);
    console.log('Field 0 key:', field0.key);

    // Check if we can set arraySize directly on the record
    console.log('\n=== Testing arraySize modification ===');
    console.log('Current arraySize:', brownsRow.arraySize);
    console.log('typeof arraySize:', typeof brownsRow.arraySize);

    // Check if arraySize is a field
    const arraySizeField = brownsRow.getFieldByKey('arraySize');
    console.log('arraySizeField:', arraySizeField);
    console.log('arraySizeField value:', arraySizeField?.value);

    // Check the data structure
    console.log('\n=== brownsRow._data ===');
    console.log('_data keys:', Object.keys(brownsRow._data || {}));

    // Look at how to set values via getValueByKey equivalent setter
    console.log('\n=== Checking setValueByKey or similar ===');
    const protoMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(brownsRow));
    console.log('All proto methods:', protoMethods);

    // Check the offsetTable structure
    console.log('\n=== _offsetTable ===');
    console.log('_offsetTable:', brownsRow._offsetTable);

    // Try accessing Player0 as a property
    console.log('\n=== Property Access Test ===');
    console.log('Has Player0 property:', 'Player0' in brownsRow);

    // Dynamically check property descriptor on the object itself
    for (let key of Object.keys(brownsRow)) {
      if (key.startsWith('Player')) {
        console.log(`${key} is direct property`);
        break;
      }
    }

    // The field value likely updates the record when set
    console.log('\n=== Testing direct field value assignment ===');
    console.log('field0._isChanged before:', field0._isChanged);

    // Get reference to player 100 (arbitrary test)
    const testRef = playerTable.getBinaryReferenceToRecord(100);
    console.log('Test reference to player 100:', testRef);

  } catch (err) {
    console.error('Error:', err.message, err.stack);
  }
}

main();
