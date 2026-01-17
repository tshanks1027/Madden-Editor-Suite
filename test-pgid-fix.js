/**
 * Test PGID-based CNID assignment before running full app
 */
const path = require('path');
process.chdir(__dirname);

const MaddenRosterHelper = require('./src/main/lib/helpers/MaddenRosterHelper');

async function test(rosterPath) {
  console.log('Loading:', rosterPath);

  const helper = new MaddenRosterHelper();
  const file = await helper.load(rosterPath);

  const play = file.PLAY;
  const blob = file.BLOB?.records?.[0];
  const blbm = blob?.fields?.['BLBM']?.value;

  if (!play?.records || !blbm?._records) {
    console.error('Missing PLAY or BLBM records');
    return;
  }

  console.log('PLAY records:', play.records.length);
  console.log('BLBM records:', blbm._records.length);

  console.log('\n=== Before Fix: First 10 Players ===');
  for (let i = 0; i < Math.min(10, blbm._records.length); i++) {
    const playRec = play.records[i];
    const blbmRec = blbm._records[i];

    const pgid = playRec.fields?.['PGID']?.value ?? playRec.fields?.['PGID']?._value ?? 'N/A';
    const pfna = playRec.fields?.['PFNA']?.value ?? '';
    const plna = playRec.fields?.['PLNA']?.value ?? '';
    const name = `${pfna} ${plna}`.trim();

    const blbmFields = blbmRec.fields || blbmRec._fields;
    const cnid = blbmFields['CNID']?.value ?? blbmFields['CNID']?._value ?? 'N/A';
    const asnm = blbmFields['ASNM']?.value ?? blbmFields['ASNM']?._value ?? 'N/A';
    const gnhd = blbmFields['GNHD']?.value ?? blbmFields['GNHD']?._value ?? 'N/A';

    console.log(`[${i}] ${name.padEnd(25)} PGID=${String(pgid).padEnd(6)} CNID=${String(cnid).padEnd(6)} GNHD=${String(gnhd).padEnd(4)} ASNM="${asnm}"`);
  }

  // Simulate the fix
  console.log('\n=== After Fix (Simulated): First 10 Players ===');
  for (let i = 0; i < Math.min(10, blbm._records.length); i++) {
    const playRec = play.records[i];
    const blbmRec = blbm._records[i];

    const pgid = playRec.fields?.['PGID']?.value ?? playRec.fields?.['PGID']?._value ?? null;
    const pfna = playRec.fields?.['PFNA']?.value ?? '';
    const plna = playRec.fields?.['PLNA']?.value ?? '';
    const name = `${pfna} ${plna}`.trim();

    const blbmFields = blbmRec.fields || blbmRec._fields;
    const gnhd = blbmFields['GNHD']?.value ?? blbmFields['GNHD']?._value ?? 'N/A';

    // Calculate what the fix would set
    const lastName = plna.replace(/[^a-zA-Z]/g, '');
    const firstName = pfna.replace(/[^a-zA-Z]/g, '');
    const newCnid = pgid || (i + 10000);
    const newAsnm = `${lastName}${firstName}_${newCnid}`;

    console.log(`[${i}] ${name.padEnd(25)} PGID=${String(pgid).padEnd(6)} -> CNID=${String(newCnid).padEnd(6)} GNHD=${String(gnhd).padEnd(4)} ASNM="${newAsnm}"`);
  }

  // Count how many players would use own PGID vs fallback
  let ownPgid = 0;
  let fallback = 0;
  for (let i = 0; i < play.records.length; i++) {
    const playRec = play.records[i];
    const pgid = playRec.fields?.['PGID']?.value ?? playRec.fields?.['PGID']?._value ?? null;
    if (pgid) {
      ownPgid++;
    } else {
      fallback++;
    }
  }

  console.log('\n=== Summary ===');
  console.log(`Players with PGID: ${ownPgid}`);
  console.log(`Players needing fallback ID: ${fallback}`);
}

const rosterPath = process.argv[2] || 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/ROSTER-EDITED';
test(rosterPath).catch(console.error);
