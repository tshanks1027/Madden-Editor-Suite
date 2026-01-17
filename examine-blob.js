/**
 * Examine the BLOB table to see what's stored there
 */

const path = require('path');

async function examine() {
  const MaddenRosterHelper = require('./src/main/lib/helpers/MaddenRosterHelper');

  const files = [
    { path: 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/ROSTER-Official', head: 128 },
    { path: 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/ROSTER-TEST1', head: 34 },
    { path: 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/ROSTER-TEST2', head: 189 }
  ];

  for (const fileInfo of files) {
    console.log(`\n=== ${fileInfo.path.split('/').pop()} (head ${fileInfo.head}) ===\n`);

    const helper = new MaddenRosterHelper();
    const file = await helper.load(fileInfo.path);

    const blob = file.BLOB.records[0];

    for (const fieldName in blob.fields) {
      const field = blob.fields[fieldName];
      const value = field.value;

      console.log(`${fieldName}:`);
      console.log(`  Type: ${typeof value}`);
      console.log(`  Constructor: ${value?.constructor?.name}`);

      if (Buffer.isBuffer(value)) {
        console.log(`  Buffer length: ${value.length}`);
        console.log(`  First 100 bytes hex: ${value.slice(0, 100).toString('hex')}`);
      } else if (value instanceof Uint8Array) {
        console.log(`  Uint8Array length: ${value.length}`);
        console.log(`  First 100 bytes: ${Array.from(value.slice(0, 100)).join(',')}`);
      } else if (typeof value === 'object' && value !== null) {
        console.log(`  Keys: ${Object.keys(value).join(', ')}`);
        console.log(`  JSON preview: ${JSON.stringify(value).substring(0, 200)}`);
      } else {
        console.log(`  Value: ${value}`);
      }
    }
  }
}

examine().catch(console.error);
