/**
 * Extract definitive face mapping from ROSTER-GENHEADTEST
 * Face 001 = Player 0 (Bill Acker), Face 264 = Player 263 (Greg Boykin)
 */
const path = require('path');
const fs = require('fs');
process.chdir(__dirname);

const MaddenRosterHelper = require('./src/main/lib/helpers/MaddenRosterHelper');

async function extractMapping() {
  const testPath = 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/ROSTER-GENHEADTEST';
  const editedPath = 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/ROSTER-EDITED';

  console.log('=== EXTRACTING FACE MAPPING ===\n');

  // Load test file (known good mapping)
  console.log('Loading ROSTER-GENHEADTEST...');
  const testHelper = new MaddenRosterHelper();
  const testFile = await testHelper.load(testPath);

  const testPlay = testFile.PLAY;
  const testBlob = testFile.BLOB?.records?.[0];
  const testBlbm = testBlob?.fields?.['BLBM']?.value;

  if (!testPlay?.records || !testBlbm?._records) {
    console.error('Missing PLAY or BLBM in test file');
    return;
  }

  console.log(`Test file: ${testPlay.records.length} PLAY, ${testBlbm._records.length} BLBM\n`);

  // Extract mapping for faces 001-264 (positions 0-263)
  const faceMapping = [];

  console.log('=== FACE MAPPING (001-264) ===\n');
  console.log('Face# | Player Name              | PGID   | CNID   | GNHD  | GENR                    | SKNT | ASNM');
  console.log('-'.repeat(120));

  for (let i = 0; i < 264 && i < testBlbm._records.length; i++) {
    const faceNum = i + 1; // Face picker number (001-264)

    const playRec = testPlay.records[i];
    const blbmRec = testBlbm._records[i];

    const playFields = playRec.fields || {};
    const blbmFields = blbmRec.fields || blbmRec._fields || {};

    // Extract PLAY fields
    const pfna = playFields['PFNA']?.value ?? '';
    const plna = playFields['PLNA']?.value ?? '';
    const pgid = playFields['PGID']?.value ?? 0;
    const playerName = `${pfna} ${plna}`.trim();

    // Extract BLBM fields
    const cnid = blbmFields['CNID']?.value ?? blbmFields['CNID']?._value ?? 0;
    const gnhd = blbmFields['GNHD']?.value ?? blbmFields['GNHD']?._value ?? 0;
    const genr = blbmFields['GENR']?.value ?? blbmFields['GENR']?._value ?? '';
    const sknt = blbmFields['SKNT']?.value ?? blbmFields['SKNT']?._value ?? 0;
    const asnm = blbmFields['ASNM']?.value ?? blbmFields['ASNM']?._value ?? '';

    const entry = {
      faceNum,
      playerName,
      pgid,
      cnid,
      gnhd,
      genr,
      sknt,
      asnm
    };
    faceMapping.push(entry);

    // Print first 30 and last 10
    if (i < 30 || i >= 254) {
      console.log(
        `${String(faceNum).padStart(3, '0')}   | ` +
        `${playerName.padEnd(24)} | ` +
        `${String(pgid).padEnd(6)} | ` +
        `${String(cnid).padEnd(6)} | ` +
        `${String(gnhd).padEnd(5)} | ` +
        `${genr.padEnd(23)} | ` +
        `${String(sknt).padEnd(4)} | ` +
        `${asnm}`
      );
    } else if (i === 30) {
      console.log('... (skipping middle entries) ...');
    }
  }

  console.log('\n=== ANALYSIS ===\n');

  // Analyze GNHD distribution
  const gnhdValues = faceMapping.map(f => f.gnhd);
  const uniqueGnhd = [...new Set(gnhdValues)].sort((a, b) => a - b);
  console.log(`Unique GNHD values: ${uniqueGnhd.length}`);
  console.log(`GNHD range: ${Math.min(...gnhdValues)} to ${Math.max(...gnhdValues)}`);

  // Check if face# matches GNHD
  let gnhdMatchesFaceNum = 0;
  for (const entry of faceMapping) {
    if (entry.gnhd === entry.faceNum) gnhdMatchesFaceNum++;
  }
  console.log(`Face# equals GNHD: ${gnhdMatchesFaceNum}/264`);

  // Analyze GENR patterns
  const genrValues = faceMapping.map(f => f.genr);
  const uniqueGenr = [...new Set(genrValues)];
  console.log(`Unique GENR values: ${uniqueGenr.length}`);

  // Check CNID values
  const cnidZero = faceMapping.filter(f => f.cnid === 0).length;
  const cnidNonZero = faceMapping.filter(f => f.cnid !== 0).length;
  console.log(`CNID=0: ${cnidZero}, CNID!=0: ${cnidNonZero}`);

  // Create lookup table: faceNum -> {gnhd, genr, sknt}
  const faceLookup = {};
  for (const entry of faceMapping) {
    faceLookup[entry.faceNum] = {
      gnhd: entry.gnhd,
      genr: entry.genr,
      sknt: entry.sknt
    };
  }

  // Also create reverse lookup: gnhd -> faceNum
  const gnhdToFaceNum = {};
  for (const entry of faceMapping) {
    if (!gnhdToFaceNum[entry.gnhd]) {
      gnhdToFaceNum[entry.gnhd] = entry.faceNum;
    }
  }

  // Save mappings
  fs.writeFileSync('./data/lookups/face-picker-to-blbm.json', JSON.stringify(faceLookup, null, 2));
  console.log('\nSaved: data/lookups/face-picker-to-blbm.json');

  fs.writeFileSync('./data/lookups/gnhd-to-face-picker.json', JSON.stringify(gnhdToFaceNum, null, 2));
  console.log('Saved: data/lookups/gnhd-to-face-picker.json');

  // Save full mapping with all details
  fs.writeFileSync('./data/lookups/generic-face-complete-mapping.json', JSON.stringify(faceMapping, null, 2));
  console.log('Saved: data/lookups/generic-face-complete-mapping.json');

  // Now compare with ROSTER-EDITED
  console.log('\n=== COMPARING WITH ROSTER-EDITED ===\n');

  const editedHelper = new MaddenRosterHelper();
  const editedFile = await editedHelper.load(editedPath);

  const editedPlay = editedFile.PLAY;
  const editedBlob = editedFile.BLOB?.records?.[0];
  const editedBlbm = editedBlob?.fields?.['BLBM']?.value;

  // Compare first 10 players
  console.log('First 10 players comparison:');
  console.log('Player               | TEST GNHD | EDITED GNHD | TEST CNID | EDITED CNID | TEST GENR');
  console.log('-'.repeat(100));

  for (let i = 0; i < 10; i++) {
    const testBlbmFields = testBlbm._records[i].fields || testBlbm._records[i]._fields || {};
    const editedBlbmFields = editedBlbm._records[i].fields || editedBlbm._records[i]._fields || {};

    const testGnhd = testBlbmFields['GNHD']?.value ?? testBlbmFields['GNHD']?._value ?? 0;
    const editedGnhd = editedBlbmFields['GNHD']?.value ?? editedBlbmFields['GNHD']?._value ?? 0;
    const testCnid = testBlbmFields['CNID']?.value ?? testBlbmFields['CNID']?._value ?? 0;
    const editedCnid = editedBlbmFields['CNID']?.value ?? editedBlbmFields['CNID']?._value ?? 0;
    const testGenr = testBlbmFields['GENR']?.value ?? testBlbmFields['GENR']?._value ?? '';

    const playFields = testPlay.records[i].fields || {};
    const playerName = `${playFields['PFNA']?.value ?? ''} ${playFields['PLNA']?.value ?? ''}`.trim();

    const gnhdMatch = testGnhd === editedGnhd ? '✓' : '✗';
    const cnidMatch = testCnid === editedCnid ? '✓' : '✗';

    console.log(
      `${playerName.padEnd(20)} | ${String(testGnhd).padEnd(9)} | ${String(editedGnhd).padEnd(11)}${gnhdMatch} | ` +
      `${String(testCnid).padEnd(9)} | ${String(editedCnid).padEnd(11)}${cnidMatch} | ${testGenr}`
    );
  }

  return faceMapping;
}

extractMapping().catch(console.error);
