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

    console.log('=== Investigating Array Methods ===');

    // Check push method signature
    console.log('push:', brownsRow.push);
    console.log('push toString:', brownsRow.push?.toString?.());

    console.log('\npop:', brownsRow.pop);
    console.log('pop toString:', brownsRow.pop?.toString?.());

    console.log('\nsplice:', brownsRow.splice);
    console.log('\naddReference:', brownsRow.addReference);
    console.log('\nremoveReference:', brownsRow.removeReference);

    // Check the prototype chain for these methods
    const proto = Object.getPrototypeOf(brownsRow);
    console.log('\n=== Prototype Methods ===');
    const protoMethods = Object.getOwnPropertyNames(proto).filter(m => typeof proto[m] === 'function');
    console.log('Methods:', protoMethods);

    // Check if there's an empty method that works
    console.log('\n=== Empty method ===');
    console.log('empty:', brownsRow.empty);
    console.log('empty toString:', brownsRow.empty?.toString?.());

    // Try to find how to set a reference value
    console.log('\n=== Checking getValueByKey ===');
    console.log('getValueByKey(Player0):', brownsRow.getValueByKey('Player0'));
    console.log('getReferenceDataByKey(Player0):', brownsRow.getReferenceDataByKey('Player0'));

    // Check if we can set fields directly
    console.log('\n=== Direct Field Setting ===');
    console.log('Can set Player0?');
    const descriptor = Object.getOwnPropertyDescriptor(brownsRow, 'Player0');
    console.log('Player0 descriptor:', descriptor);

    // Check if fields have setters
    console.log('\n=== Check field getters/setters ===');
    const field = brownsRow._fieldsArray[0];
    console.log('Field methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(field)));
    console.log('Field value getter:', Object.getOwnPropertyDescriptor(Object.getPrototypeOf(field), 'value'));

    // Check the reference table methods
    console.log('\n=== Table Methods ===');
    const tableMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(rosterArrayTable));
    console.log('Table methods:', tableMethods);

    // Check if table has methods for references
    console.log('\ncreateReference:', rosterArrayTable.createReference);
    console.log('setReference:', rosterArrayTable.setReference);

  } catch (err) {
    console.error('Error:', err.message, err.stack);
  }
}

main();
