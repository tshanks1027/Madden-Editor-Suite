/**
 * Analyze PGHE (generic head) field and its correlation with skin tone
 * Try to find which PGHE values are black vs white
 */

const path = require('path');

async function analyzePGHE() {
  const rosterPath = 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/ROSTER-Official';

  const MaddenRosterHelper = require(path.join(__dirname, 'src', 'main', 'lib', 'helpers', 'MaddenRosterHelper'));
  const helper = new MaddenRosterHelper();
  const file = await helper.load(rosterPath);
  const playerTable = file.PLAY;

  if (!playerTable) {
    console.log('PLAY table not found!');
    return;
  }

  // Get all players
  const players = playerTable.records.map(record => {
    const player = {};
    for (const fieldName in record.fields) {
      player[fieldName] = record.fields[fieldName].value;
    }
    return player;
  });

  // Get players with real faces (PLPL = "100") to see PSKI correlation
  const realFacePlayers = players.filter(p => String(p.PLPL) === '100');

  console.log('=== Real Face Players by PSKI ===');
  const realByPSKI = {};
  realFacePlayers.forEach(p => {
    const pski = p.PSKI;
    if (!realByPSKI[pski]) realByPSKI[pski] = [];
    if (realByPSKI[pski].length < 5) {
      realByPSKI[pski].push(`${p.PFNA} ${p.PLNA}`);
    }
  });

  Object.entries(realByPSKI).forEach(([pski, names]) => {
    console.log(`\nPSKI ${pski}: (sample: ${names.join(', ')})`);
  });

  // Get players with generic faces (PLPL = "0")
  const genericPlayers = players.filter(p => String(p.PLPL) === '0');

  console.log('\n\n=== Generic Face Players Analysis ===');
  console.log('Total generic players:', genericPlayers.length);

  // Group by PGHE and show player names (we might recognize them)
  const byPGHE = {};
  genericPlayers.forEach(p => {
    const pghe = p.PGHE;
    if (!byPGHE[pghe]) byPGHE[pghe] = [];
    byPGHE[pghe].push({ name: `${p.PFNA} ${p.PLNA}`, pski: p.PSKI, pghe: p.PGHE });
  });

  // Show PGHE groups with most players
  console.log('\n=== Top PGHE Values (Generic Head IDs) ===');
  Object.entries(byPGHE)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 30)
    .forEach(([pghe, players]) => {
      console.log(`\nPGHE ${pghe}: ${players.length} players`);
      players.slice(0, 3).forEach(p => console.log(`  - ${p.name} (PSKI: ${p.pski})`));
    });

  // Check for known black players with generic faces
  console.log('\n\n=== Searching for Known Players ===');
  const knownBlack = ['Williams', 'Johnson', 'Jackson', 'Brown', 'Davis'];
  const knownWhite = ['Smith', 'Miller', 'Anderson', 'Wilson'];

  console.log('\nPlayers with common "black" last names:');
  genericPlayers.filter(p => knownBlack.some(n => p.PLNA === n)).slice(0, 10).forEach(p => {
    console.log(`  ${p.PFNA} ${p.PLNA}: PGHE=${p.PGHE}, PSKI=${p.PSKI}`);
  });

  console.log('\nPlayers with common "white" last names:');
  genericPlayers.filter(p => knownWhite.some(n => p.PLNA === n)).slice(0, 10).forEach(p => {
    console.log(`  ${p.PFNA} ${p.PLNA}: PGHE=${p.PGHE}, PSKI=${p.PSKI}`);
  });

  // Check PSKI distribution for generic players
  console.log('\n=== PSKI Distribution for Generic Players ===');
  const pskiDist = {};
  genericPlayers.forEach(p => {
    pskiDist[p.PSKI] = (pskiDist[p.PSKI] || 0) + 1;
  });
  Object.entries(pskiDist).forEach(([pski, count]) => {
    console.log(`  PSKI ${pski}: ${count} players`);
  });
}

analyzePGHE().catch(console.error);
