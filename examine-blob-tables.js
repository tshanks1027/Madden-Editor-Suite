/**
 * Examine the nested tables inside BLOB
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
    console.log(`\n========== ${fileInfo.path.split('/').pop()} (head ${fileInfo.head}) ==========\n`);

    const helper = new MaddenRosterHelper();
    const file = await helper.load(fileInfo.path);

    const blob = file.BLOB.records[0];
    const blbm = blob.fields['BLBM']?.value;

    if (blbm && blbm._name) {
      console.log(`BLBM is a table named: ${blbm._name}`);
      console.log(`Records: ${blbm._records?.length || 0}`);

      // Check if it has nested tables
      if (blbm.tables) {
        console.log(`\nNested tables in BLBM:`);
        blbm.tables.forEach(t => {
          console.log(`  ${t.name}: ${t.records.length} records`);
        });
      }

      // Check records
      if (blbm._records && blbm._records.length > 0) {
        console.log(`\nBLBM records:`);
        blbm._records.slice(0, 5).forEach((rec, i) => {
          console.log(`  Record ${i}:`);
          if (rec.fields || rec._fields) {
            const fields = rec.fields || rec._fields;
            for (const fname in fields) {
              const f = fields[fname];
              const val = f.value !== undefined ? f.value : f._value;
              if (typeof val !== 'object') {
                console.log(`    ${fname}: ${val}`);
              } else if (val && val._name) {
                console.log(`    ${fname}: [Table: ${val._name}, ${val._records?.length || 0} records]`);
              }
            }
          }
        });
      }
    }

    // Also check for any table that might have PINS (player INS?)
    console.log('\nLooking for PINS or similar tables...');
    if (blbm && typeof blbm === 'object') {
      const keys = Object.keys(blbm);
      keys.forEach(k => {
        if (k.startsWith('_')) return;
        const val = blbm[k];
        if (val && typeof val === 'object') {
          console.log(`  ${k}: ${val._name || val.constructor?.name}`);
        }
      });
    }
  }
}

examine().catch(console.error);
