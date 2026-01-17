/**
 * Find specific players in ROSTER-GENHEADTEST
 */
const path = require('path');
process.chdir(__dirname);

const MaddenRosterHelper = require('./src/main/lib/helpers/MaddenRosterHelper');

async function findPlayers() {
  const testPath = 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/ROSTER-GENHEADTEST';

  const helper = new MaddenRosterHelper();
  const file = await helper.load(testPath);

  const play = file.PLAY;
  const blbm = file.BLOB?.records?.[0]?.fields?.['BLBM']?.value;

  console.log('Searching for Bill Acker and Greg Boykin...\n');

  // Find by name
  for (let i = 0; i < play.records.length; i++) {
    const rec = play.records[i];
    const pfna = rec.fields?.['PFNA']?.value ?? '';
    const plna = rec.fields?.['PLNA']?.value ?? '';
    const name = `${pfna} ${plna}`.toLowerCase();

    if (name.includes('acker') || name.includes('boykin')) {
      const blbmRec = blbm._records[i];
      const blbmFields = blbmRec.fields || blbmRec._fields || {};

      const gnhd = blbmFields['GNHD']?.value ?? blbmFields['GNHD']?._value ?? 0;
      const cnid = blbmFields['CNID']?.value ?? blbmFields['CNID']?._value ?? 0;
      const genr = blbmFields['GENR']?.value ?? blbmFields['GENR']?._value ?? '';
      const sknt = blbmFields['SKNT']?.value ?? blbmFields['SKNT']?._value ?? 0;

      console.log(`Position ${i}: ${pfna} ${plna}`);
      console.log(`  GNHD=${gnhd}, CNID=${cnid}, GENR=${genr}, SKNT=${sknt}\n`);
    }
  }

  // Also show first 10 and last 10 players by position
  console.log('\n=== First 10 players by position ===');
  for (let i = 0; i < 10; i++) {
    const rec = play.records[i];
    const pfna = rec.fields?.['PFNA']?.value ?? '';
    const plna = rec.fields?.['PLNA']?.value ?? '';
    console.log(`[${i}] ${pfna} ${plna}`);
  }

  console.log('\n=== Players 260-270 ===');
  for (let i = 260; i < Math.min(270, play.records.length); i++) {
    const rec = play.records[i];
    const pfna = rec.fields?.['PFNA']?.value ?? '';
    const plna = rec.fields?.['PLNA']?.value ?? '';
    console.log(`[${i}] ${pfna} ${plna}`);
  }

  // Sort names alphabetically and show first/last
  const allNames = [];
  for (let i = 0; i < play.records.length; i++) {
    const rec = play.records[i];
    const pfna = rec.fields?.['PFNA']?.value ?? '';
    const plna = rec.fields?.['PLNA']?.value ?? '';
    allNames.push({ pos: i, name: `${plna}, ${pfna}` });
  }
  allNames.sort((a, b) => a.name.localeCompare(b.name));

  console.log('\n=== First 10 alphabetically ===');
  for (let i = 0; i < 10; i++) {
    console.log(`[alphabetical ${i}] Position ${allNames[i].pos}: ${allNames[i].name}`);
  }

  console.log('\n=== Around 264 alphabetically ===');
  for (let i = 260; i < 270 && i < allNames.length; i++) {
    console.log(`[alphabetical ${i}] Position ${allNames[i].pos}: ${allNames[i].name}`);
  }
}

findPlayers().catch(console.error);
