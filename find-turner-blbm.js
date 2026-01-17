/**
 * Find Payton Turner in BLBM table across 3 files
 */

const path = require('path');

async function find() {
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
    const blbm = blob.fields['BLBM']?.value;

    // Find Turner by CNID (21688) or name
    for (const rec of blbm._records) {
      const fields = rec.fields || rec._fields;
      const clnm = fields['CLNM']?.value ?? fields['CLNM']?._value;
      const cfnm = fields['CFNM']?.value ?? fields['CFNM']?._value;
      const cnid = fields['CNID']?.value ?? fields['CNID']?._value;

      if (clnm === 'Turner' && cfnm === 'Payton') {
        console.log('Found Payton Turner in BLBM:');
        for (const fname in fields) {
          const f = fields[fname];
          const val = f.value !== undefined ? f.value : f._value;
          if (typeof val !== 'object') {
            console.log(`  ${fname}: ${val}`);
          }
        }
        break;
      }
    }
  }
}

find().catch(console.error);
