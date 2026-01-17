/**
 * Check how BLBM and PLAY records correlate
 */

async function check() {
  const MaddenRosterHelper = require('./src/main/lib/helpers/MaddenRosterHelper');

  const rosterPath = 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/ROSTER-Official';

  console.log('Loading roster...');
  const helper = new MaddenRosterHelper();
  const file = await helper.load(rosterPath);

  // Get PLAY table
  const playTable = file.PLAY;
  console.log(`\nPLAY table has ${playTable.records.length} records`);

  // Get BLBM table
  const blob = file.BLOB.records[0];
  const blbm = blob.fields['BLBM']?.value;
  console.log(`BLBM table has ${blbm._records.length} records`);

  // Check first 10 PLAY records vs BLBM records
  console.log('\n=== First 10 records comparison ===\n');
  console.log('Index | PLAY (PFNA PLNA, PSXP) | BLBM (CFNM CLNM, CNID)');
  console.log('------|------------------------|------------------------');

  for (let i = 0; i < 10 && i < playTable.records.length; i++) {
    const playRec = playTable.records[i];
    const blbmRec = blbm._records[i];

    const playName = `${playRec.fields['PFNA']?.value} ${playRec.fields['PLNA']?.value}`;
    const playPID = playRec.fields['PSXP']?.value;

    const blbmFields = blbmRec?.fields || blbmRec?._fields;
    const blbmName = `${blbmFields?.['CFNM']?.value ?? blbmFields?.['CFNM']?._value} ${blbmFields?.['CLNM']?.value ?? blbmFields?.['CLNM']?._value}`;
    const blbmCNID = blbmFields?.['CNID']?.value ?? blbmFields?.['CNID']?._value;

    console.log(`${i.toString().padStart(5)} | ${playName.padEnd(22)} ${playPID} | ${blbmName.padEnd(20)} ${blbmCNID}`);
  }

  // Check if CNID matches PSXP
  console.log('\n=== Checking CNID == PSXP correlation ===\n');
  let matchCount = 0;
  let mismatchCount = 0;

  for (let i = 0; i < Math.min(100, playTable.records.length); i++) {
    const playRec = playTable.records[i];
    const blbmRec = blbm._records[i];

    if (!blbmRec) continue;

    const playPID = playRec.fields['PSXP']?.value;
    const blbmFields = blbmRec?.fields || blbmRec?._fields;
    const blbmCNID = blbmFields?.['CNID']?.value ?? blbmFields?.['CNID']?._value;

    if (playPID === blbmCNID) {
      matchCount++;
    } else {
      mismatchCount++;
      if (mismatchCount <= 5) {
        const playName = `${playRec.fields['PFNA']?.value} ${playRec.fields['PLNA']?.value}`;
        console.log(`Mismatch at index ${i}: ${playName} - PSXP=${playPID}, CNID=${blbmCNID}`);
      }
    }
  }

  console.log(`\nMatches: ${matchCount}, Mismatches: ${mismatchCount}`);
  console.log(`Match by index seems ${matchCount > mismatchCount ? 'VIABLE' : 'NOT VIABLE'}`);
}

check().catch(console.error);
