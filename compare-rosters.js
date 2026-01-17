const path = require('path');
const testPath = 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/ROSTER-Test';
const officialPath = 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/ROSTER-Official';

async function compare() {
  const MaddenRosterHelper = require(path.join(__dirname, 'src', 'main', 'lib', 'helpers', 'MaddenRosterHelper'));
  const helper = new MaddenRosterHelper();

  const testFile = await helper.load(testPath);
  const officialFile = await helper.load(officialPath);

  const testPlayers = testFile.PLAY.records.map(record => {
    const player = {};
    for (const fieldName in record.fields) {
      player[fieldName] = record.fields[fieldName].value;
    }
    return player;
  });

  const officialPlayers = officialFile.PLAY.records.map(record => {
    const player = {};
    for (const fieldName in record.fields) {
      player[fieldName] = record.fields[fieldName].value;
    }
    return player;
  });

  // Find players where PLPL or PEPS changed between official and test
  console.log('=== PLAYERS WITH CHANGED PLPL OR PEPS ===');
  let changedCount = 0;

  testPlayers.forEach(test => {
    const official = officialPlayers.find(o => o.PFNA === test.PFNA && o.PLNA === test.PLNA);
    if (official && (official.PLPL !== test.PLPL || official.PEPS !== test.PEPS)) {
      changedCount++;
      console.log('');
      console.log(test.PFNA + ' ' + test.PLNA + ':');
      console.log('  OFFICIAL: PLPL=' + official.PLPL + ', PEPS=' + official.PEPS + ', PGHE=' + official.PGHE + ', PSKI=' + official.PSKI);
      console.log('  TEST:     PLPL=' + test.PLPL + ', PEPS=' + test.PEPS + ', PGHE=' + test.PGHE + ', PSKI=' + test.PSKI);
    }
  });

  console.log('');
  console.log('Total changed players:', changedCount);
}

compare().catch(e => console.error('Error:', e));
