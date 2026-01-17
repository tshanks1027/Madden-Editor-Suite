/**
 * Test script to verify GenericFaceService CNID fix
 * Run with: node test-generic-face-fix.js <roster-file>
 */

const path = require('path');
const fs = require('fs');

// Add lib paths for require to work
process.chdir(__dirname);

// Load the MaddenRosterHelper
const MaddenRosterHelper = require('./src/main/lib/helpers/MaddenRosterHelper');

async function testGenericFaceFix(rosterPath) {
  console.log('=== Generic Face Fix Test ===');
  console.log('Roster:', rosterPath);

  if (!fs.existsSync(rosterPath)) {
    console.error('File not found:', rosterPath);
    return;
  }

  // Load roster
  const helper = new MaddenRosterHelper();
  const file = await helper.load(rosterPath);
  console.log('Loaded roster with', file.tables.length, 'tables');

  // Get BLBM
  const blob = file.BLOB?.records?.[0];
  if (!blob) {
    console.error('No BLOB table found');
    return;
  }

  const blbm = blob.fields?.['BLBM']?.value;
  if (!blbm || !blbm._records) {
    console.error('No BLBM records found');
    return;
  }

  console.log('BLBM has', blbm._records.length, 'records');

  // Get PLAY
  const playTable = file.PLAY;
  if (!playTable) {
    console.error('No PLAY table found');
    return;
  }

  console.log('PLAY has', playTable.records.length, 'players');

  // Check first 20 players
  console.log('\n=== First 20 Players BLBM Check ===');
  console.log('Index | Name                      | PLPL | CNID | GENR                    | SKNT');
  console.log('------|---------------------------|------|------|-------------------------|------');

  for (let i = 0; i < Math.min(20, playTable.records.length); i++) {
    const player = playTable.records[i];
    const playerName = `${player.fields.PFNA?.value || ''} ${player.fields.PLNA?.value || ''}`.trim();
    const plpl = player.fields.PLPL?.value ?? '?';

    const blbmRec = blbm._records[i];
    const fields = blbmRec?.fields || blbmRec?._fields || {};

    const cnid = fields['CNID']?.value ?? fields['CNID']?._value ?? '?';
    const genr = fields['GENR']?.value ?? fields['GENR']?._value ?? '?';
    const sknt = fields['SKNT']?.value ?? fields['SKNT']?._value ?? '?';

    console.log(
      String(i).padEnd(6) + '|',
      playerName.padEnd(25) + '|',
      String(plpl).padEnd(4) + '|',
      String(cnid).padEnd(4) + '|',
      String(genr).padEnd(23) + '|',
      sknt
    );
  }

  // Count generic face players with CNID != 0
  let genericWithBadCNID = 0;
  let genericWithGoodCNID = 0;

  for (let i = 0; i < Math.min(playTable.records.length, blbm._records.length); i++) {
    const player = playTable.records[i];
    const plpl = player.fields.PLPL?.value ?? 0;

    if (plpl === 0 || plpl === '0') {
      const blbmRec = blbm._records[i];
      const fields = blbmRec?.fields || blbmRec?._fields || {};
      const cnid = fields['CNID']?.value ?? fields['CNID']?._value ?? 0;

      if (cnid === 0) {
        genericWithGoodCNID++;
      } else {
        genericWithBadCNID++;
      }
    }
  }

  console.log('\n=== Summary ===');
  console.log('Generic face players with CNID=0 (GOOD):', genericWithGoodCNID);
  console.log('Generic face players with CNID!=0 (BAD):', genericWithBadCNID);

  if (genericWithBadCNID > 0) {
    console.log('\n⚠️  WARNING: Some generic face players have CNID != 0');
    console.log('   These players will show wrong faces in-game!');
    console.log('   The fix needs to run during save to set CNID=0.');
  } else if (genericWithGoodCNID > 0) {
    console.log('\n✅ All generic face players have CNID=0');
    console.log('   Faces should display correctly in-game.');
  }
}

// Run test
const rosterPath = process.argv[2] || 'C:/MODS/M26/ROSTER-EDITED';
testGenericFaceFix(rosterPath).catch(console.error);
