/**
 * Show ALL fields for Payton Turner across 3 files
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
    const helper = new MaddenRosterHelper();
    const file = await helper.load(fileInfo.path);
    const playerTable = file.PLAY;

    for (const record of playerTable.records) {
      const firstName = record.fields['PFNA']?.value;
      const lastName = record.fields['PLNA']?.value;
      if (firstName === 'Payton' && lastName === 'Turner') {
        const data = {};
        for (const fieldName in record.fields) {
          data[fieldName] = record.fields[fieldName].value;
        }
        playerData.push({ file: fileInfo.path.split('/').pop(), head: fileInfo.head, data: data });
        break;
      }
    }
  }

  // Show key appearance fields side by side
  console.log('=== PAYTON TURNER - KEY FIELDS ===\n');

  const keyFields = ['PSXP', 'PEPS', 'PGHE', 'PSKI', 'PCBT', 'PLPL', 'PLHT', 'PHGT'];

  console.log('Field'.padEnd(10) + 'Official (128)'.padEnd(25) + 'TEST1 (034)'.padEnd(25) + 'TEST2 (189)'.padEnd(25));
  console.log('-'.repeat(85));

  keyFields.forEach(field => {
    const v1 = String(playerData[0].data[field] ?? '').padEnd(25);
    const v2 = String(playerData[1].data[field] ?? '').padEnd(25);
    const v3 = String(playerData[2].data[field] ?? '').padEnd(25);
    console.log(field.padEnd(10) + v1 + v2 + v3);
  });

  // Show ALL changed fields
  console.log('\n\n=== ALL CHANGED FIELDS ===\n');

  const allFields = Object.keys(playerData[0].data).sort();

  allFields.forEach(field => {
    const v1 = playerData[0].data[field];
    const v2 = playerData[1].data[field];
    const v3 = playerData[2].data[field];

    if (v1 !== v2 || v2 !== v3) {
      console.log(`${field}: ${v1} → ${v2} → ${v3}`);
    }
  });

  // Now let's look at PIDs 4207 and 3871 to see if they map to heads 034 and 189
  console.log('\n\n=== PID ANALYSIS ===\n');
  console.log('TEST1: PID 4207 = head 034');
  console.log('TEST2: PID 3871 = head 189');
  console.log('\nMaybe the head number is stored in PID_Portrait_Mapping.csv?');
}

compare().catch(console.error);
