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

    console.log('Browns arraySize:', brownsRow.arraySize);
    console.log('Ravens arraySize:', ravensRow.arraySize);

    // Check what methods are available on the record for array manipulation
    console.log('\nMethods on roster array record:');
    const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(brownsRow))
      .filter(m => typeof brownsRow[m] === 'function');
    console.log(methods);

    // Check if there's an 'empty' method to clear the array
    console.log('\nHas empty():', typeof brownsRow.empty);

    // Check the _fieldsArray structure
    console.log('\nBrowns _fieldsArray length:', brownsRow._fieldsArray?.length);

    // Show first 3 player references from Browns roster
    console.log('\nFirst 3 Browns roster references:');
    for (let i = 0; i < 3; i++) {
      const field = brownsRow._fieldsArray?.[i];
      if (field) {
        console.log(`  ${i}: refData=${JSON.stringify(field.referenceData)}, value=${brownsRow['Player' + i]}`);
      }
    }

  } catch (err) {
    console.error('Error:', err.message, err.stack);
  }
}

main();
