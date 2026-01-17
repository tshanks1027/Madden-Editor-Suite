/**
 * Map PGHE values to skin tone by looking at players with known PSKI
 */

const path = require('path');

async function mapPGHE() {
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

  // Get generic players with PSKI = 1 (black) or PSKI = 2 (white)
  const genericPlayers = players.filter(p => String(p.PLPL) === '0');

  const blackGeneric = genericPlayers.filter(p => p.PSKI === 1);
  const whiteGeneric = genericPlayers.filter(p => p.PSKI === 2);

  console.log('=== PGHE values for BLACK generic players (PSKI=1) ===');
  console.log('Count:', blackGeneric.length);
  const blackPGHEs = new Set(blackGeneric.map(p => p.PGHE));
  console.log('Unique PGHEs:', [...blackPGHEs].sort((a,b) => a-b).join(', '));

  console.log('\nSample black players:');
  blackGeneric.slice(0, 15).forEach(p => {
    console.log(`  ${p.PFNA} ${p.PLNA}: PGHE=${p.PGHE}`);
  });

  console.log('\n\n=== PGHE values for WHITE generic players (PSKI=2) ===');
  console.log('Count:', whiteGeneric.length);
  const whitePGHEs = new Set(whiteGeneric.map(p => p.PGHE));
  console.log('Unique PGHEs:', [...whitePGHEs].sort((a,b) => a-b).join(', '));

  console.log('\nSample white players:');
  whiteGeneric.slice(0, 15).forEach(p => {
    console.log(`  ${p.PFNA} ${p.PLNA}: PGHE=${p.PGHE}`);
  });

  // Check for overlap
  const overlap = [...blackPGHEs].filter(x => whitePGHEs.has(x));
  console.log('\n\n=== OVERLAP (PGHEs used by both black and white) ===');
  console.log('Overlapping PGHEs:', overlap.join(', ') || 'NONE');

  // Now check what real face players tell us about PSKI
  console.log('\n\n=== What real face players tell us about PSKI ===');
  const realFace = players.filter(p => String(p.PLPL) === '100');

  const pskiCount = { 0: 0, 1: 0, 2: 0, 3: 0 };
  realFace.forEach(p => {
    pskiCount[p.PSKI] = (pskiCount[p.PSKI] || 0) + 1;
  });
  console.log('Real face PSKI distribution:', pskiCount);

  // PSKI 1 players (should be black)
  console.log('\nPSKI 1 real face players (should be black):');
  realFace.filter(p => p.PSKI === 1).slice(0, 10).forEach(p => {
    console.log(`  ${p.PFNA} ${p.PLNA}`);
  });

  // PSKI 2 players (should be white)
  console.log('\nPSKI 2 real face players (should be white):');
  realFace.filter(p => p.PSKI === 2).slice(0, 10).forEach(p => {
    console.log(`  ${p.PFNA} ${p.PLNA}`);
  });

  // Export the PGHE lists
  console.log('\n\n=== EXPORT: PGHE ranges by skin ===');
  console.log('BLACK_PGHEs = [' + [...blackPGHEs].sort((a,b) => a-b).join(', ') + ']');
  console.log('WHITE_PGHEs = [' + [...whitePGHEs].sort((a,b) => a-b).join(', ') + ']');
}

mapPGHE().catch(console.error);
