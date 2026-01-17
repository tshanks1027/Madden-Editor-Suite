/**
 * Check PAM (PEPS) and PSKI fields in the official roster
 * to verify the skin tone logic is correct
 */

const path = require('path');

async function checkRoster() {
  // Check a generated historical roster that uses generic PAMs
  const rosterPath = 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/ROSTER-1990to2020';

  console.log('Loading roster file...');

  // Use MaddenRosterHelper from vendored library (same as RosterParser.js)
  const MaddenRosterHelper = require(path.join(__dirname, 'src', 'main', 'lib', 'helpers', 'MaddenRosterHelper'));
  const helper = new MaddenRosterHelper();
  const file = await helper.load(rosterPath);

  console.log('Found', file.tables.length, 'tables');

  // Get player table (PLAY in TDB2 format)
  const playerTable = file.PLAY;
  if (!playerTable) {
    console.log('PLAY table not found!');
    console.log('Available tables:', file.tables.map(t => t.name).join(', '));
    return;
  }

  // Convert to array of records with fields accessible
  const records = playerTable.records.map(record => {
    const player = {};
    for (const fieldName in record.fields) {
      player[fieldName] = record.fields[fieldName].value;
    }
    return player;
  });

  console.log('Total players:', records.length);
  console.log('');

  // Sample some players with generic faces
  console.log('=== PLAYERS WITH GENERIC PAMs (gen_*) ===');
  console.log('');

  let genericCount = 0;
  const skinMismatches = [];

  for (const record of records) {
    const peps = record.PEPS || '';
    const pski = record.PSKI;
    const firstName = record.PFNA || '';
    const lastName = record.PLNA || '';

    // Skip empty records (no name)
    if (!firstName && !lastName) continue;

    // Only check generic PAMs
    if (peps && peps.startsWith('gen_')) {
      genericCount++;

      // Extract race code from PAM (gen_X_RACE_FACE_NUM)
      const match = peps.match(/gen_\d+_([A-Z]+)_/i);
      if (match) {
        const raceCode = match[1].toUpperCase();

        // Check if PSKI matches race code
        // M, T = white (PSKI 0-1)
        // H = hispanic (PSKI ~1-2)
        // B, BM, BMH = black (PSKI 2-3)
        let expectedPski;
        let skinType;
        if (raceCode === 'M' || raceCode === 'T') {
          expectedPski = [0, 1];
          skinType = 'WHITE';
        } else if (raceCode === 'H') {
          expectedPski = [1, 2];
          skinType = 'HISPANIC';
        } else if (raceCode === 'B' || raceCode === 'BM' || raceCode === 'BMH') {
          expectedPski = [2, 3];
          skinType = 'BLACK';
        }

        const isMatch = expectedPski && expectedPski.includes(pski);

        if (genericCount <= 30) {
          console.log(`${firstName} ${lastName} | PAM: ${peps} | PSKI: ${pski} | RaceCode: ${raceCode} (${skinType}) | Match: ${isMatch ? 'YES' : 'NO - MISMATCH'}`);
        }

        if (!isMatch && expectedPski) {
          skinMismatches.push({
            name: `${firstName} ${lastName}`,
            pam: peps,
            raceCode,
            skinType,
            pski,
            expectedPski
          });
        }
      }
    }
  }

  console.log('');
  console.log('=== SUMMARY ===');
  console.log('Total players with generic PAMs:', genericCount);
  console.log('Skin tone mismatches:', skinMismatches.length);
  console.log('');

  if (skinMismatches.length > 0) {
    console.log('=== MISMATCHES (first 20) ===');
    skinMismatches.slice(0, 20).forEach(m => {
      console.log(`${m.name} | PAM: ${m.pam} | PSKI: ${m.pski} | Expected PSKI: ${m.expectedPski.join(' or ')} (${m.skinType})`);
    });
  }

  // Also check the PAM distribution
  const pamStats = { white: 0, hispanic: 0, black: 0, other: 0 };
  for (const record of records) {
    const peps = record.PEPS || '';
    if (peps.startsWith('gen_')) {
      if (peps.includes('_M_') || peps.includes('_T_')) pamStats.white++;
      else if (peps.includes('_H_')) pamStats.hispanic++;
      else if (peps.includes('_B_') || peps.includes('_BM_') || peps.includes('_BMH_')) pamStats.black++;
      else pamStats.other++;
    }
  }

  console.log('');
  console.log('=== PAM RACE DISTRIBUTION IN ROSTER ===');
  console.log('White (M/T):', pamStats.white);
  console.log('Hispanic (H):', pamStats.hispanic);
  console.log('Black (B/BM/BMH):', pamStats.black);
  console.log('Other:', pamStats.other);

  // Show sample PAMs from the roster to understand what's being used
  console.log('');
  console.log('=== SAMPLE PEPS VALUES FROM ROSTER ===');
  let sampleCount = 0;
  const pepsTypes = { real: 0, generic: 0, empty: 0 };
  const pskiDistribution = {};

  for (const record of records) {
    const peps = record.PEPS || '';
    const pski = record.PSKI;
    const firstName = record.PFNA || '';
    const lastName = record.PLNA || '';

    // Skip empty records
    if (!firstName && !lastName) continue;

    // Track PSKI distribution
    if (pskiDistribution[pski] === undefined) pskiDistribution[pski] = 0;
    pskiDistribution[pski]++;

    // Categorize PEPS
    if (!peps || peps === '') {
      pepsTypes.empty++;
    } else if (peps.toLowerCase().startsWith('gen_')) {
      pepsTypes.generic++;
    } else {
      pepsTypes.real++;
    }

    // Show first 20 samples with PSKI
    if (sampleCount < 20 && firstName && lastName) {
      console.log(`${firstName} ${lastName} | PEPS: "${peps}" | PSKI: ${pski}`);
      sampleCount++;
    }
  }

  console.log('');
  console.log('=== PEPS TYPE BREAKDOWN ===');
  console.log('Real player assets:', pepsTypes.real);
  console.log('Generic assets (gen_*):', pepsTypes.generic);
  console.log('Empty/missing:', pepsTypes.empty);

  console.log('');
  console.log('=== PSKI DISTRIBUTION ===');
  const sortedPski = Object.keys(pskiDistribution).sort((a, b) => Number(a) - Number(b));
  for (const pski of sortedPski) {
    console.log(`PSKI ${pski}: ${pskiDistribution[pski]} players`);
  }
}

checkRoster().catch(console.error);
