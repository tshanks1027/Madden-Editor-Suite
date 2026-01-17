const path = require('path');

async function main() {
  try {
    const module = await import('madden-franchise');
    const createFranchise = module.create;

    // Open franchise file
    const franchise = await createFranchise('C:/Users/tshan/Documents/Madden NFL 26/Saves/CAREER-1994TEST');

    // Get the Player table
    const playerTable = franchise.getTableByName('Player');
    await playerTable.readRecords();

    // Get the Player[] roster array table (ID 5907)
    const rosterArrayTable = franchise.getTableById(5907);
    await rosterArrayTable.readRecords();

    const BROWNS_INDEX = 4;
    const RAVENS_INDEX = 24;

    const brownsRoster = rosterArrayTable.records[BROWNS_INDEX];
    const ravensRoster = rosterArrayTable.records[RAVENS_INDEX];

    console.log('=== BEFORE SWAP ===');
    console.log('Browns arraySize:', brownsRoster.arraySize);
    console.log('Ravens arraySize:', ravensRoster.arraySize);

    // Get all Browns player references
    const brownsPlayerRefs = [];
    for (let i = 0; i < brownsRoster.arraySize; i++) {
      const fieldKey = `Player${i}`;
      const refValue = brownsRoster[fieldKey];
      const refData = brownsRoster.getReferenceDataByKey(fieldKey);
      brownsPlayerRefs.push({ index: i, value: refValue, refData });
    }

    console.log(`\nCollected ${brownsPlayerRefs.length} Browns player refs`);
    console.log('First 3:', brownsPlayerRefs.slice(0, 3).map(r => r.refData?.rowNumber));

    // Get all Ravens player references
    const ravensPlayerRefs = [];
    for (let i = 0; i < ravensRoster.arraySize; i++) {
      const fieldKey = `Player${i}`;
      const refValue = ravensRoster[fieldKey];
      const refData = ravensRoster.getReferenceDataByKey(fieldKey);
      ravensPlayerRefs.push({ index: i, value: refValue, refData });
    }

    console.log(`Collected ${ravensPlayerRefs.length} Ravens player refs`);
    console.log('First 3:', ravensPlayerRefs.slice(0, 3).map(r => r.refData?.rowNumber));

    // Now try to set field values directly on _fieldsArray
    console.log('\n=== TESTING FIELD ASSIGNMENT ===');

    // Try setting Browns Player0 to Ravens Player0 value
    const brownsField0 = brownsRoster._fieldsArray[0];
    const ravensPlayer0Ref = ravensPlayerRefs[0].value;

    console.log('Browns Player0 before:', brownsField0.value);
    console.log('Setting to Ravens Player0:', ravensPlayer0Ref);

    // Try direct assignment
    brownsField0.value = ravensPlayer0Ref;

    console.log('Browns Player0 after:', brownsField0.value);
    console.log('isChanged:', brownsField0._isChanged);

    // Check if the assignment worked by reading again
    console.log('Re-read brownsRoster.Player0:', brownsRoster.Player0);

    // Try using the getFieldByKey to get field and set
    console.log('\n=== TESTING getFieldByKey + setValue ===');
    const field1 = brownsRoster.getFieldByKey('Player1');
    if (field1) {
      console.log('Player1 field before:', field1.value);
      field1.value = ravensPlayerRefs[1].value;
      console.log('Player1 field after:', field1.value);
    }

    // Check how to update arraySize
    console.log('\n=== TESTING arraySize UPDATE ===');
    console.log('Current arraySize:', brownsRoster.arraySize);
    console.log('Trying to set arraySize to 50...');

    // Try direct assignment
    const origArraySize = brownsRoster.arraySize;
    brownsRoster.arraySize = 50;
    console.log('arraySize after direct assignment:', brownsRoster.arraySize);

    // Restore
    brownsRoster.arraySize = origArraySize;

    // Check if record has a way to mark fields as changed
    console.log('\n=== Record _isChanged ===');
    console.log('brownsRoster._isChanged:', brownsRoster._isChanged);

    // Check how to get the empty reference value
    console.log('\n=== Empty Reference Value ===');
    // Look at a slot past arraySize - should be empty
    const emptySlotField = brownsRoster._fieldsArray[brownsRoster.arraySize];
    if (emptySlotField) {
      console.log(`Player${brownsRoster.arraySize} value:`, emptySlotField.value);
      console.log(`Player${brownsRoster.arraySize} refData:`, emptySlotField.referenceData);
    }

    console.log('\n=== TEST COMPLETE - NOT SAVED ===');

  } catch (err) {
    console.error('Error:', err.message, err.stack);
  }
}

main();
