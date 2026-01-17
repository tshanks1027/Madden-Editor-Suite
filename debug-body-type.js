/**
 * Debug script to compare PCBT (PLAY table) vs WLBS (BLBM table)
 * to understand where body type is actually stored
 */

const path = require('path');
const rosterPath = 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/ROSTER-BODYTEST';

async function debug() {
  console.log('Loading roster file...');

  const MaddenRosterHelper = require(path.join(__dirname, 'src', 'main', 'lib', 'helpers', 'MaddenRosterHelper'));
  const helper = new MaddenRosterHelper();
  const file = await helper.load(rosterPath);

  // Get PLAY table
  const playTable = file.PLAY;
  if (!playTable) {
    console.log('PLAY table not found!');
    return;
  }

  // Get BLOB table (contains BLBM)
  const blobTable = file.BLOB;
  if (!blobTable) {
    console.log('BLOB table not found!');
    return;
  }

  const blob = blobTable.records[0];
  const blbm = blob?.fields?.['BLBM']?.value;

  if (!blbm || !blbm._records) {
    console.log('BLBM table not found in BLOB!');
    return;
  }

  console.log(`\nPLAY table: ${playTable.records.length} players`);
  console.log(`BLBM table: ${blbm._records.length} records`);

  // PCBT to body type name
  const PCBT_NAMES = ['Standard', 'Thin', 'Muscular', 'Heavy', 'Lean'];

  // Compare first 30 players - focus on BTYP (BLBM) vs PCBT (PLAY)
  console.log('\n=== COMPARING PCBT (PLAY) vs BTYP (BLBM) ===');
  console.log('Player Name                  | PCBT (PLAY) | BTYP (BLBM) | WLBS | Match?');
  console.log('-'.repeat(80));

  for (let i = 0; i < Math.min(30, playTable.records.length); i++) {
    const playRec = playTable.records[i];
    const blbmRec = blbm._records[i];

    // Get player name from PLAY
    const firstName = playRec.fields['PFNA']?.value || '';
    const lastName = playRec.fields['PLNA']?.value || '';
    const playerName = `${firstName} ${lastName}`.padEnd(28);

    // Get PCBT from PLAY
    const pcbt = playRec.fields['PCBT']?.value;
    const pcbtName = PCBT_NAMES[pcbt] || `Unknown(${pcbt})`;

    // Get BTYP and WLBS from BLBM
    const blbmFields = blbmRec?.fields || blbmRec?._fields;
    const btyp = blbmFields?.['BTYP']?.value ?? blbmFields?.['BTYP']?._value ?? 'N/A';
    const btypName = PCBT_NAMES[btyp] || `Unknown(${btyp})`;
    const wlbs = blbmFields?.['WLBS']?.value ?? blbmFields?.['WLBS']?._value ?? 'N/A';

    const match = pcbt === btyp;

    console.log(`${playerName} | ${pcbtName.padEnd(11)} | ${btypName.padEnd(11)} | ${String(wlbs).padEnd(4)} | ${match ? '✓' : '✗ MISMATCH'}`);
  }

  // Count mismatches
  let mismatches = 0;
  for (let i = 0; i < playTable.records.length; i++) {
    const pcbt = playTable.records[i].fields['PCBT']?.value;
    const blbmFields = blbm._records[i]?.fields || blbm._records[i]?._fields;
    const btyp = blbmFields?.['BTYP']?.value ?? blbmFields?.['BTYP']?._value;
    if (pcbt !== btyp) mismatches++;
  }
  console.log(`\n=== SUMMARY: ${mismatches} / ${playTable.records.length} players have PCBT != BTYP ===`);

  // Also show all BLBM fields for first player
  console.log('\n=== ALL BLBM FIELDS FOR FIRST PLAYER ===');
  const firstBlbm = blbm._records[0];
  const fields = firstBlbm?.fields || firstBlbm?._fields;
  if (fields) {
    const fieldNames = Object.keys(fields).sort();
    console.log('Fields:', fieldNames.join(', '));

    // Show body-related fields
    const bodyFields = fieldNames.filter(f =>
      f.includes('WL') || f.includes('BOD') || f.includes('BTY') ||
      f.includes('HGT') || f.includes('WGT') || f === 'PBOD'
    );
    console.log('\nBody-related fields:');
    bodyFields.forEach(f => {
      const val = fields[f]?.value ?? fields[f]?._value;
      console.log(`  ${f} = ${val}`);
    });
  }
}

debug().catch(console.error);
