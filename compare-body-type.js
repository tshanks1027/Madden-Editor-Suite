/**
 * Compare ROSTER-EDITED vs ROSTER-BODYTEST to find body type field differences
 *
 * Changed players:
 * - B.Acker - Lean (Thin)
 * - R.Acks - Muscular
 * - M.Adamle - Standard
 * - W.Adams - Thin
 * - B.Adams - Heavy
 */

const path = require('path');
const MaddenRosterHelper = require('./src/main/lib/helpers/MaddenRosterHelper');

async function compare() {
  const editedPath = 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/ROSTER-EDITED';
  const bodyTestPath = 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/ROSTER-BODYTEST';

  console.log('Loading ROSTER-EDITED...');
  const helper1 = new MaddenRosterHelper();
  const file1 = await helper1.load(editedPath);

  console.log('Loading ROSTER-BODYTEST...');
  const helper2 = new MaddenRosterHelper();
  const file2 = await helper2.load(bodyTestPath);

  // Get PLAY tables
  const play1 = file1.PLAY.records.map(rec => {
    const p = {};
    for (const fn in rec.fields) {
      p[fn] = rec.fields[fn].value;
    }
    return p;
  });

  const play2 = file2.PLAY.records.map(rec => {
    const p = {};
    for (const fn in rec.fields) {
      p[fn] = rec.fields[fn].value;
    }
    return p;
  });

  // Get BLBM tables
  const blob1 = file1.BLOB?._records?.[0];
  const blbm1 = (blob1?.fields || blob1?._fields)?.['BLBM']?.value;

  const blob2 = file2.BLOB?._records?.[0];
  const blbm2 = (blob2?.fields || blob2?._fields)?.['BLBM']?.value;

  if (!blbm1 || !blbm2) {
    console.error('Could not find BLBM tables');
    return;
  }

  // Target players (search by last name starting letters)
  const targets = ['Acker', 'Acks', 'Adamle', 'Adams'];

  console.log('\n=== COMPARING PLAY TABLE DIFFERENCES ===');

  for (let i = 0; i < Math.min(play1.length, play2.length); i++) {
    const p1 = play1[i];
    const p2 = play2[i];
    const lastName = p1.PLNA || '';

    // Check if this is one of our target players
    const isTarget = targets.some(t => lastName.startsWith(t));
    if (!isTarget) continue;

    const firstName = p1.PFNA || '';
    const name = `${firstName} ${lastName}`;

    // Find differences
    const diffs = [];
    for (const field of Object.keys(p1)) {
      if (p1[field] !== p2[field]) {
        diffs.push({ field, old: p1[field], new: p2[field] });
      }
    }

    if (diffs.length > 0) {
      console.log(`\n${name} (index ${i}):`);
      diffs.forEach(d => {
        console.log(`  ${d.field}: ${d.old} -> ${d.new}`);
      });
    }
  }

  console.log('\n=== COMPARING BLBM TABLE DIFFERENCES ===');

  for (let i = 0; i < Math.min(blbm1._records.length, blbm2._records.length); i++) {
    const rec1 = blbm1._records[i];
    const rec2 = blbm2._records[i];
    const f1 = rec1.fields || rec1._fields;
    const f2 = rec2.fields || rec2._fields;

    // Get player name from PLAY table
    const player = play1[i];
    const lastName = player?.PLNA || '';
    const firstName = player?.PFNA || '';
    const name = `${firstName} ${lastName}`;

    // Check if this is one of our target players
    const isTarget = targets.some(t => lastName.startsWith(t));
    if (!isTarget) continue;

    // Find differences
    const diffs = [];
    for (const field of Object.keys(f1 || {})) {
      const v1 = f1[field]?.value ?? f1[field]?._value;
      const v2 = f2[field]?.value ?? f2[field]?._value;
      if (v1 !== v2) {
        diffs.push({ field, old: v1, new: v2 });
      }
    }

    if (diffs.length > 0) {
      console.log(`\n${name} (index ${i}):`);
      diffs.forEach(d => {
        console.log(`  ${d.field}: ${d.old} -> ${d.new}`);
      });
    }
  }

  // Also show current values for target players
  console.log('\n=== CURRENT VALUES IN ROSTER-BODYTEST ===');
  for (let i = 0; i < Math.min(play2.length, 50); i++) {
    const p = play2[i];
    const lastName = p.PLNA || '';
    const isTarget = targets.some(t => lastName.startsWith(t));
    if (!isTarget) continue;

    const firstName = p.PFNA || '';
    const name = `${firstName} ${lastName}`;

    const rec = blbm2._records[i];
    const f = rec?.fields || rec?._fields;
    const wlbs = f?.['WLBS']?.value ?? f?.['WLBS']?._value;

    console.log(`${name}: PCBT=${p.PCBT}, PWGT=${p.PWGT}, BLBM.WLBS=${wlbs}`);
  }
}

compare().catch(e => console.error('Error:', e.message, e.stack));
