/**
 * Check kicking stats in the official roster
 */

const path = require('path');

async function checkKickingStats() {
  const rosterPath = 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/ROSTER-Official';

  const MaddenRosterHelper = require(path.join(__dirname, 'src', 'main', 'lib', 'helpers', 'MaddenRosterHelper'));
  const helper = new MaddenRosterHelper();
  const file = await helper.load(rosterPath);
  const playerTable = file.PLAY;

  if (!playerTable) {
    console.log('PLAY table not found!');
    return;
  }

  const records = playerTable.records.map(record => {
    const player = {};
    for (const fieldName in record.fields) {
      player[fieldName] = record.fields[fieldName].value;
    }
    return player;
  });

  // Check what fields exist
  const samplePlayer = records[0];
  const allFields = Object.keys(samplePlayer).sort();
  const kickFields = allFields.filter(f => f.includes('PK') || f.toLowerCase().includes('kick'));
  console.log('Kick-related fields found:', kickFields.join(', ') || 'NONE');
  console.log('');

  // Filter for kickers and punters (PPOS 19 = K, 20 = P)
  const kickers = records.filter(r => r.PPOS === 19 || r.PPOS === 20);

  console.log('Kickers/Punters found:', kickers.length);
  console.log('');
  console.log('Sample kicker/punter stats:');
  kickers.slice(0, 10).forEach(k => {
    console.log(k.PFNA + ' ' + k.PLNA + ' (POS ' + k.PPOS + '): PKPR=' + k.PKPR + ', PKAC=' + k.PKAC);
  });

  // Also check non-kickers for comparison
  console.log('');
  console.log('Sample NON-kicker kick stats (first 5 players):');
  const nonKickers = records.filter(r => r.PPOS !== 19 && r.PPOS !== 20).slice(0, 5);
  nonKickers.forEach(k => {
    console.log(k.PFNA + ' ' + k.PLNA + ' (POS ' + k.PPOS + '): PKPR=' + k.PKPR + ', PKAC=' + k.PKAC);
  });
}

checkKickingStats().catch(console.error);
