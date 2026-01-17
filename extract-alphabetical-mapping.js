/**
 * Extract face mapping by ALPHABETICAL order
 * Face 001 = Bill Acker (alphabetically first)
 * Face 264 = Greg Boykin (alphabetically 264th)
 */
const path = require('path');
const fs = require('fs');
process.chdir(__dirname);

const MaddenRosterHelper = require('./src/main/lib/helpers/MaddenRosterHelper');

async function extractAlphabeticalMapping() {
  const testPath = 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/ROSTER-GENHEADTEST';

  console.log('=== EXTRACTING ALPHABETICAL FACE MAPPING ===\n');
  console.log('Loading ROSTER-GENHEADTEST...');

  const helper = new MaddenRosterHelper();
  const file = await helper.load(testPath);

  const play = file.PLAY;
  const blbm = file.BLOB?.records?.[0]?.fields?.['BLBM']?.value;

  // Build array with all player data
  const players = [];
  for (let i = 0; i < play.records.length; i++) {
    const playRec = play.records[i];
    const blbmRec = blbm._records[i];

    const playFields = playRec.fields || {};
    const blbmFields = blbmRec.fields || blbmRec._fields || {};

    const pfna = playFields['PFNA']?.value ?? '';
    const plna = playFields['PLNA']?.value ?? '';
    const pgid = playFields['PGID']?.value ?? 0;
    const pghe = playFields['PGHE']?.value ?? playFields['PGHE']?._value ?? 0;

    const cnid = blbmFields['CNID']?.value ?? blbmFields['CNID']?._value ?? 0;
    const gnhd = blbmFields['GNHD']?.value ?? blbmFields['GNHD']?._value ?? 0;
    const genr = blbmFields['GENR']?.value ?? blbmFields['GENR']?._value ?? '';
    const sknt = blbmFields['SKNT']?.value ?? blbmFields['SKNT']?._value ?? 0;
    const asnm = blbmFields['ASNM']?.value ?? blbmFields['ASNM']?._value ?? '';

    players.push({
      position: i,
      firstName: pfna,
      lastName: plna,
      sortName: `${plna}, ${pfna}`.toLowerCase(),
      pgid,
      pghe,
      cnid,
      gnhd,
      genr,
      sknt,
      asnm
    });
  }

  // Sort alphabetically by last name, first name
  players.sort((a, b) => a.sortName.localeCompare(b.sortName));

  console.log(`Total players: ${players.length}`);
  console.log(`Extracting faces 001-264 (alphabetically sorted)\n`);

  // Extract first 264 (face picker 001-264)
  const faceMapping = [];

  console.log('Face# | Player Name              | Pos   | PGID   | PGHE  | CNID   | GNHD  | GENR                    | SKNT');
  console.log('-'.repeat(130));

  for (let i = 0; i < 264 && i < players.length; i++) {
    const faceNum = i + 1;
    const p = players[i];

    const entry = {
      faceNum,
      playerName: `${p.firstName} ${p.lastName}`.trim(),
      position: p.position,
      pgid: p.pgid,
      pghe: p.pghe,
      cnid: p.cnid,
      gnhd: p.gnhd,
      genr: p.genr,
      sknt: p.sknt,
      asnm: p.asnm
    };
    faceMapping.push(entry);

    // Print all 264 entries
    if (i < 30 || i >= 254) {
      console.log(
        `${String(faceNum).padStart(3, '0')}   | ` +
        `${entry.playerName.padEnd(24)} | ` +
        `${String(p.position).padEnd(5)} | ` +
        `${String(p.pgid).padEnd(6)} | ` +
        `${String(p.pghe).padEnd(5)} | ` +
        `${String(p.cnid).padEnd(6)} | ` +
        `${String(p.gnhd).padEnd(5)} | ` +
        `${p.genr.padEnd(23)} | ` +
        `${p.sknt}`
      );
    } else if (i === 30) {
      console.log('... (showing first 30 and last 10) ...');
    }
  }

  console.log('\n=== ANALYSIS ===\n');

  // Count assigned vs unassigned
  const assigned = faceMapping.filter(f => f.cnid !== 0);
  const unassigned = faceMapping.filter(f => f.cnid === 0);
  console.log(`Assigned (CNID!=0): ${assigned.length}`);
  console.log(`Unassigned (CNID=0): ${unassigned.length}`);

  // Check if Face# correlates with any field
  let gnhdMatchesFace = 0;
  let pgheMatchesFace = 0;
  for (const f of faceMapping) {
    if (f.gnhd === f.faceNum) gnhdMatchesFace++;
    if (f.pghe === f.faceNum) pgheMatchesFace++;
  }
  console.log(`Face# equals GNHD: ${gnhdMatchesFace}/264`);
  console.log(`Face# equals PGHE: ${pgheMatchesFace}/264`);

  // GNHD distribution for assigned faces
  const assignedGnhd = assigned.map(f => f.gnhd);
  const uniqueGnhd = [...new Set(assignedGnhd)].sort((a, b) => a - b);
  console.log(`\nUnique GNHD values (assigned only): ${uniqueGnhd.length}`);
  console.log(`GNHD range: ${Math.min(...assignedGnhd)} to ${Math.max(...assignedGnhd)}`);

  // PGHE distribution
  const assignedPghe = assigned.map(f => f.pghe);
  const uniquePghe = [...new Set(assignedPghe)].sort((a, b) => a - b);
  console.log(`Unique PGHE values (assigned only): ${uniquePghe.length}`);
  console.log(`PGHE range: ${Math.min(...assignedPghe)} to ${Math.max(...assignedPghe)}`);

  // Show unassigned faces
  if (unassigned.length > 0) {
    console.log(`\n=== UNASSIGNED FACES (CNID=0) ===`);
    for (const f of unassigned) {
      console.log(`Face ${String(f.faceNum).padStart(3, '0')}: ${f.playerName} - GNHD=${f.gnhd}, PGHE=${f.pghe}, GENR=${f.genr}`);
    }
  }

  // Create lookup: faceNum -> {gnhd, pghe, genr, sknt}
  const faceLookup = {};
  for (const f of faceMapping) {
    if (f.cnid !== 0) { // Only include assigned faces
      faceLookup[f.faceNum] = {
        gnhd: f.gnhd,
        pghe: f.pghe,
        genr: f.genr,
        sknt: f.sknt
      };
    }
  }

  // Create reverse lookups
  const gnhdToFace = {};
  const pgheToFace = {};
  for (const f of faceMapping) {
    if (f.cnid !== 0) {
      if (!gnhdToFace[f.gnhd]) gnhdToFace[f.gnhd] = f.faceNum;
      if (!pgheToFace[f.pghe]) pgheToFace[f.pghe] = f.faceNum;
    }
  }

  // Save all mappings
  fs.writeFileSync('./data/lookups/face-picker-mapping.json', JSON.stringify(faceLookup, null, 2));
  console.log('\nSaved: data/lookups/face-picker-mapping.json');

  fs.writeFileSync('./data/lookups/gnhd-to-face.json', JSON.stringify(gnhdToFace, null, 2));
  console.log('Saved: data/lookups/gnhd-to-face.json');

  fs.writeFileSync('./data/lookups/pghe-to-face.json', JSON.stringify(pgheToFace, null, 2));
  console.log('Saved: data/lookups/pghe-to-face.json');

  fs.writeFileSync('./data/lookups/face-complete-mapping.json', JSON.stringify(faceMapping, null, 2));
  console.log('Saved: data/lookups/face-complete-mapping.json');

  return faceMapping;
}

extractAlphabeticalMapping().catch(console.error);
