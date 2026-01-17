/**
 * Check what player IDs exist in PLAY table
 */
const path = require('path');
process.chdir(__dirname);

const MaddenRosterHelper = require('./src/main/lib/helpers/MaddenRosterHelper');

async function check(rosterPath) {
  console.log('Loading:', rosterPath);

  const helper = new MaddenRosterHelper();
  const file = await helper.load(rosterPath);

  const play = file.PLAY;

  if (!play?.records) {
    console.error('No PLAY records');
    return;
  }

  console.log('PLAY records:', play.records.length);

  // Check first 30 players
  console.log('\n=== First 30 PLAY Records ===');
  for (let i = 0; i < Math.min(30, play.records.length); i++) {
    const rec = play.records[i];
    const fields = rec.fields || {};

    // Check various ID fields
    const plid = fields['PLID']?.value ?? 'N/A';
    const pgid = fields['PGID']?.value ?? 'N/A';
    const plri = fields['PLRI']?.value ?? 'N/A';
    const pfna = fields['PFNA']?.value ?? '';
    const plna = fields['PLNA']?.value ?? '';

    console.log(`[${i}] ${(pfna + ' ' + plna).padEnd(25)} PLID=${String(plid).padEnd(6)} PGID=${String(pgid).padEnd(6)} PLRI=${plri}`);
  }

  // Show all field names from first record
  console.log('\n=== PLAY Field Names ===');
  const firstRec = play.records[0];
  const fieldNames = Object.keys(firstRec.fields || {}).filter(f => f.includes('ID') || f.includes('id') || f.length === 4);
  console.log('ID-related fields:', fieldNames.join(', '));
}

const rosterPath = process.argv[2] || 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/ROSTER-EDITED';
check(rosterPath).catch(console.error);
