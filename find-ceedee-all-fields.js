/**
 * Find CeeDee Lamb and dump ALL his BLBM fields
 */

async function find() {
  const MaddenRosterHelper = require('./src/main/lib/helpers/MaddenRosterHelper');

  const rosterPath = 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/ROSTER-Official';

  console.log('Loading roster...');
  const helper = new MaddenRosterHelper();
  const file = await helper.load(rosterPath);

  const blob = file.BLOB.records[0];
  const blbm = blob.fields['BLBM']?.value;

  for (const rec of blbm._records) {
    const fields = rec.fields || rec._fields;
    const clnm = fields['CLNM']?.value ?? fields['CLNM']?._value;
    const cfnm = fields['CFNM']?.value ?? fields['CFNM']?._value;

    if (clnm === 'Lamb' && cfnm === 'CeeDee') {
      console.log('\n=== CeeDee Lamb - ALL BLBM Fields ===\n');

      // Get all field names and sort them
      const fieldNames = Object.keys(fields).sort();

      for (const fname of fieldNames) {
        const f = fields[fname];
        const val = f.value !== undefined ? f.value : f._value;
        if (typeof val !== 'object' || val === null) {
          console.log(`${fname}: ${val}`);
        } else if (val._name) {
          console.log(`${fname}: [Table: ${val._name}]`);
        } else {
          console.log(`${fname}: [Object]`);
        }
      }
      break;
    }
  }
}

find().catch(console.error);
