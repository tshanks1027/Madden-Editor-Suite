/**
 * Dump all BLBM records to find GNHD to GENR mapping
 */

async function dump() {
  const MaddenRosterHelper = require('./src/main/lib/helpers/MaddenRosterHelper');

  const rosterPath = 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/ROSTER-Official';

  console.log('Loading roster...');
  const helper = new MaddenRosterHelper();
  const file = await helper.load(rosterPath);

  const blob = file.BLOB.records[0];
  const blbm = blob.fields['BLBM']?.value;

  if (!blbm || !blbm._records) {
    console.log('No BLBM records found');
    return;
  }

  console.log(`\nTotal BLBM records: ${blbm._records.length}\n`);
  console.log('GNHD,GENR,SKNT,CFNM,CLNM');

  // Dump all records
  for (const rec of blbm._records) {
    const fields = rec.fields || rec._fields;

    const gnhd = fields['GNHD']?.value ?? fields['GNHD']?._value ?? '';
    const genr = fields['GENR']?.value ?? fields['GENR']?._value ?? '';
    const sknt = fields['SKNT']?.value ?? fields['SKNT']?._value ?? '';
    const cfnm = fields['CFNM']?.value ?? fields['CFNM']?._value ?? '';
    const clnm = fields['CLNM']?.value ?? fields['CLNM']?._value ?? '';

    // Only output if GENR has a value (generic face)
    if (genr && genr.startsWith('gen_')) {
      console.log(`${gnhd},${genr},${sknt},${cfnm},${clnm}`);
    }
  }
}

dump().catch(console.error);
