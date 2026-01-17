/**
 * Compare Payton Turner across 3 roster files to find what controls head number
 * - ROSTER-Official: head 128
 * - ROSTER-TEST1: head 034
 * - ROSTER-TEST2: head 189
 */

const path = require('path');

async function compare() {
  const MaddenRosterHelper = require('./src/main/lib/helpers/MaddenRosterHelper');

  const files = [
    { path: 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/ROSTER-Official', head: 128 },
    { path: 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/ROSTER-TEST1', head: 34 },
    { path: 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/ROSTER-TEST2', head: 189 }
  ];

  const playerData = [];

  for (const fileInfo of files) {
    console.log(`Loading ${fileInfo.path}...`);
    const helper = new MaddenRosterHelper();
    const file = await helper.load(fileInfo.path);
    const playerTable = file.PLAY;

    // Find Payton Turner
    let payton = null;
    for (const record of playerTable.records) {
      const firstName = record.fields['PFNA']?.value;
      const lastName = record.fields['PLNA']?.value;
      if (firstName === 'Payton' && lastName === 'Turner') {
        const data = {};
        for (const fieldName in record.fields) {
          data[fieldName] = record.fields[fieldName].value;
        }
        payton = data;
        break;
      }
    }

    if (payton) {
      playerData.push({ file: fileInfo.path, head: fileInfo.head, data: payton });
      console.log(`  Found Payton Turner`);
    } else {
      console.log(`  Payton Turner NOT FOUND`);
    }
  }

  if (playerData.length < 3) {
    console.log('Could not find Payton Turner in all files');
    return;
  }

  // Compare all fields between the 3 files
  console.log('\n\n=== FIELDS THAT CHANGED ===\n');

  const allFields = Object.keys(playerData[0].data).sort();

  const changedFields = [];

  allFields.forEach(field => {
    const val1 = playerData[0].data[field];
    const val2 = playerData[1].data[field];
    const val3 = playerData[2].data[field];

    if (val1 !== val2 || val2 !== val3 || val1 !== val3) {
      changedFields.push({
        field,
        official: val1,
        test1: val2,
        test2: val3
      });
    }
  });

  console.log('Expected head values: Official=128, TEST1=034, TEST2=189\n');

  changedFields.forEach(f => {
    console.log(`${f.field}:`);
    console.log(`  Official (head 128): ${f.official}`);
    console.log(`  TEST1 (head 034): ${f.test1}`);
    console.log(`  TEST2 (head 189): ${f.test2}`);
    console.log('');
  });

  // Highlight the field that matches the head numbers
  console.log('\n=== CHECKING FOR EXACT MATCH TO HEAD NUMBERS ===\n');

  changedFields.forEach(f => {
    // Check if values match expected head numbers (128, 34, 189)
    if (f.official === 128 && f.test1 === 34 && f.test2 === 189) {
      console.log(`*** EXACT MATCH: ${f.field} ***`);
      console.log(`  Official: ${f.official} = head 128 ✓`);
      console.log(`  TEST1: ${f.test1} = head 034 ✓`);
      console.log(`  TEST2: ${f.test2} = head 189 ✓`);
    }
  });
}

compare().catch(console.error);
