/**
 * Compare Payton Turner's BLBM fields across 3 roster files
 */

async function compare() {
  const MaddenRosterHelper = require('./src/main/lib/helpers/MaddenRosterHelper');

  const files = [
    { path: 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/ROSTER-Official', head: 128 },
    { path: 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/ROSTER-TEST1', head: 34 },
    { path: 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/ROSTER-TEST2', head: 189 }
  ];

  for (const fileInfo of files) {
    console.log(`\n=== ${fileInfo.path.split('/').pop()} (in-game head ${fileInfo.head}) ===\n`);

    const helper = new MaddenRosterHelper();
    const file = await helper.load(fileInfo.path);

    const blob = file.BLOB.records[0];
    const blbm = blob.fields['BLBM']?.value;

    for (const rec of blbm._records) {
      const fields = rec.fields || rec._fields;
      const clnm = fields['CLNM']?.value ?? fields['CLNM']?._value;
      const cfnm = fields['CFNM']?.value ?? fields['CFNM']?._value;

      if (clnm === 'Turner' && cfnm === 'Payton') {
        const fieldNames = Object.keys(fields).sort();
        for (const fname of fieldNames) {
          const f = fields[fname];
          const val = f.value !== undefined ? f.value : f._value;
          if (typeof val !== 'object' || val === null) {
            console.log(`${fname}: ${val}`);
          }
        }
        break;
      }
    }
  }
}

compare().catch(console.error);
