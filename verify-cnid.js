/**
 * Verify CNID values in saved roster
 * Run: node verify-cnid.js "C:\path\to\roster"
 */
const path = require('path');
process.chdir(__dirname);

const MaddenRosterHelper = require('./src/main/lib/helpers/MaddenRosterHelper');

async function verify(rosterPath) {
  console.log('Loading:', rosterPath);

  const helper = new MaddenRosterHelper();
  const file = await helper.load(rosterPath);

  const blob = file.BLOB?.records?.[0];
  const blbm = blob?.fields?.['BLBM']?.value;
  const play = file.PLAY;

  if (!blbm?._records) {
    console.error('No BLBM records');
    return;
  }

  console.log('BLBM records:', blbm._records.length);
  console.log('PLAY records:', play?.records?.length);

  // Check first 20 players
  console.log('\n=== First 20 BLBM Records ===');
  for (let i = 0; i < Math.min(20, blbm._records.length); i++) {
    const rec = blbm._records[i];
    const fields = rec.fields || rec._fields || {};

    const cnid = fields['CNID']?.value ?? fields['CNID']?._value ?? 'N/A';
    const genr = fields['GENR']?.value ?? fields['GENR']?._value ?? 'N/A';
    const sknt = fields['SKNT']?.value ?? fields['SKNT']?._value ?? 'N/A';
    const asnm = fields['ASNM']?.value ?? fields['ASNM']?._value ?? 'N/A';

    // Get player name
    let name = '???';
    if (play?.records?.[i]) {
      const p = play.records[i];
      name = `${p.fields?.PFNA?.value || ''} ${p.fields?.PLNA?.value || ''}`.trim();
    }

    console.log(`[${i}] ${name.padEnd(25)} CNID=${String(cnid).padEnd(6)} GENR=${String(genr).padEnd(20)} SKNT=${sknt} ASNM="${asnm}"`);
  }

  // Count CNID values
  let cnid0 = 0, cnidOther = 0;
  for (const rec of blbm._records) {
    const fields = rec.fields || rec._fields || {};
    const cnid = fields['CNID']?.value ?? fields['CNID']?._value ?? -1;
    if (cnid === 0) cnid0++;
    else cnidOther++;
  }

  console.log('\n=== Summary ===');
  console.log('CNID = 0:', cnid0);
  console.log('CNID != 0:', cnidOther);

  if (cnidOther > 0) {
    console.log('\n*** PROBLEM: Some players still have CNID != 0 ***');
  }
}

const rosterPath = process.argv[2] || 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/ROSTER-EDITED';
verify(rosterPath).catch(console.error);
