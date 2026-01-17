const path = require('path');

async function searchRoster() {
  const rosterPath = 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/ROSTER-GENERATED';
  
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
  
  console.log('Total players:', players.length);
  console.log('');
  
  // Search for Todd Shanks or PGHE=236
  const matches = players.filter(p => {
    const firstName = String(p.PFNA || '').toLowerCase();
    const lastName = String(p.PLNA || '').toLowerCase();
    const pghe = p.PGHE;
    
    return (
      lastName === 'shanks' ||
      firstName === 'todd' ||
      pghe === 236
    );
  });
  
  console.log('=== Search Results ===');
  console.log('Matches found:', matches.length);
  console.log('');
  
  matches.forEach(p => {
    console.log('Player: ' + p.PFNA + ' ' + p.PLNA);
    console.log('  PFNA: ' + p.PFNA);
    console.log('  PLNA: ' + p.PLNA);
    console.log('  TGID: ' + p.TGID);
    console.log('  PPOS: ' + p.PPOS);
    console.log('  PLPL: ' + p.PLPL);
    console.log('  PSXP: ' + p.PSXP);
    console.log('  PEPS: ' + p.PEPS);
    console.log('  PGHE: ' + p.PGHE);
    console.log('  PSKI: ' + p.PSKI);
    console.log('');
  });
}

searchRoster().catch(console.error);
