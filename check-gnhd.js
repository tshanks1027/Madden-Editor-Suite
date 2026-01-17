/**
 * Check GNHD field in BLBM records
 */
const path = require('path');
process.chdir(__dirname);

const MaddenRosterHelper = require('./src/main/lib/helpers/MaddenRosterHelper');

async function check(rosterPath) {
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

  // Check first 30 players with all fields
  console.log('\n=== First 30 BLBM Records ===');
  for (let i = 0; i < Math.min(30, blbm._records.length); i++) {
    const rec = blbm._records[i];
    const fields = rec.fields || rec._fields || {};

    const cnid = fields['CNID']?.value ?? fields['CNID']?._value ?? 'N/A';
    const genr = fields['GENR']?.value ?? fields['GENR']?._value ?? 'N/A';
    const sknt = fields['SKNT']?.value ?? fields['SKNT']?._value ?? 'N/A';
    const gnhd = fields['GNHD']?.value ?? fields['GNHD']?._value ?? 'N/A';
    const asnm = fields['ASNM']?.value ?? fields['ASNM']?._value ?? 'N/A';

    // Get player name
    let name = '???';
    if (play?.records?.[i]) {
      const p = play.records[i];
      name = `${p.fields?.PFNA?.value || ''} ${p.fields?.PLNA?.value || ''}`.trim();
    }

    console.log(`[${i}] ${name.padEnd(25)} CNID=${String(cnid).padEnd(6)} GNHD=${String(gnhd).padEnd(4)} GENR=${String(genr).padEnd(20)} SKNT=${sknt} ASNM="${asnm}"`);
  }

  // Count GNHD distribution
  const gnhdCounts = new Map();
  for (const rec of blbm._records) {
    const fields = rec.fields || rec._fields || {};
    const gnhd = fields['GNHD']?.value ?? fields['GNHD']?._value ?? -1;
    gnhdCounts.set(gnhd, (gnhdCounts.get(gnhd) || 0) + 1);
  }

  console.log('\n=== GNHD Distribution ===');
  const sortedGnhd = Array.from(gnhdCounts.entries()).sort((a,b) => b[1] - a[1]);
  sortedGnhd.slice(0, 20).forEach(([gnhd, count]) => {
    console.log(`  GNHD=${gnhd}: ${count} players`);
  });

  // Check range
  const gnhdValues = Array.from(gnhdCounts.keys()).filter(v => v !== -1 && v !== 'N/A');
  if (gnhdValues.length > 0) {
    console.log('\nGNHD Range:', Math.min(...gnhdValues), 'to', Math.max(...gnhdValues));
    console.log('Unique GNHD values:', gnhdValues.length);
  }
}

const rosterPath = process.argv[2] || 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/ROSTER-EDITED';
check(rosterPath).catch(console.error);
