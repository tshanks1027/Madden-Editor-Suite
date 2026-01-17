/**
 * Debug PKPR field data in roster file
 */

const path = require('path');

async function debugPKPR() {
  const rosterPath = 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/ROSTER-Official';

  const MaddenRosterHelper = require(path.join(__dirname, 'src', 'main', 'lib', 'helpers', 'MaddenRosterHelper'));
  const helper = new MaddenRosterHelper();
  const file = await helper.load(rosterPath);
  const playerTable = file.PLAY;

  if (!playerTable) {
    console.log('PLAY table not found!');
    return;
  }

  // Get all field names from first record
  const firstRecord = playerTable.records[0];
  const allFields = Object.keys(firstRecord.fields).sort();

  console.log('Total fields in player record:', allFields.length);

  // Check if PKPR and PKAC exist
  const pkprExists = allFields.includes('PKPR');
  const pkacExists = allFields.includes('PKAC');

  console.log('PKPR field exists:', pkprExists);
  console.log('PKAC field exists:', pkacExists);

  // Find kickers and show their values
  const players = playerTable.records.map(record => {
    const player = {};
    for (const fieldName in record.fields) {
      player[fieldName] = record.fields[fieldName].value;
    }
    return player;
  });

  // Find some kickers (PPOS 19 = K)
  const kickers = players.filter(p => p.PPOS === 19).slice(0, 5);
  console.log('\nKickers (PPOS=19):');
  kickers.forEach(k => {
    console.log(`  ${k.PFNA} ${k.PLNA}: PKPR=${k.PKPR}, PKAC=${k.PKAC}`);
  });

  // Find some QBs for comparison
  const qbs = players.filter(p => p.PPOS === 0).slice(0, 5);
  console.log('\nQBs (PPOS=0):');
  qbs.forEach(q => {
    console.log(`  ${q.PFNA} ${q.PLNA}: PKPR=${q.PKPR}, PKAC=${q.PKAC}`);
  });

  // List all kick-related fields
  console.log('\nAll kick-related fields found:');
  const kickFields = allFields.filter(f =>
    f.includes('PK') ||
    f.toLowerCase().includes('kick')
  );
  console.log(kickFields.join(', '));
}

debugPKPR().catch(console.error);
