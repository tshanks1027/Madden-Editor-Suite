/**
 * Check skin tone (PSKI) values and their correlation with face PIDs in roster file
 */

const path = require('path');

async function checkSkinTones() {
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

  console.log('Total players:', players.length);
  console.log('');

  // Check PSKI distribution
  const pskiDistribution = {};
  players.forEach(p => {
    const val = p.PSKI;
    pskiDistribution[val] = (pskiDistribution[val] || 0) + 1;
  });

  console.log('=== PSKI (Skin Tone) Distribution ===');
  Object.entries(pskiDistribution).sort((a, b) => parseInt(a[0]) - parseInt(b[0])).forEach(([val, count]) => {
    console.log(`  PSKI ${val}: ${count} players`);
  });
  console.log('');

  // Show some sample players with their PSKI and PID
  console.log('=== Sample Players by PSKI ===');
  for (let pski = 0; pski <= 10; pski++) {
    const pskiPlayers = players.filter(p => p.PSKI === pski).slice(0, 3);
    if (pskiPlayers.length > 0) {
      console.log(`\nPSKI ${pski}:`);
      pskiPlayers.forEach(p => {
        console.log(`  ${p.PFNA} ${p.PLNA} - PID(PSXP)=${p.PSXP}, PAM(PLPL)=${p.PLPL || '(empty)'}`);
      });
    }
  }

  // Check what PAM values look like for different PSKI values
  console.log('\n=== PAM patterns by PSKI ===');
  for (let pski = 0; pski <= 10; pski++) {
    const pskiPlayers = players.filter(p => p.PSKI === pski);
    if (pskiPlayers.length > 0) {
      // Get unique PAM prefixes
      const pamPatterns = new Map();
      pskiPlayers.forEach(p => {
        const pam = p.PLPL || '';
        if (pam) {
          // Extract prefix like "gen_1_B" or "gen_2_M"
          const match = pam.match(/^(gen_\d+_[A-Z])/i);
          if (match) {
            const key = match[1];
            pamPatterns.set(key, (pamPatterns.get(key) || 0) + 1);
          }
        }
      });
      if (pamPatterns.size > 0) {
        console.log(`\nPSKI ${pski} PAM patterns:`);
        [...pamPatterns.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).forEach(([pattern, count]) => {
          console.log(`  ${pattern}: ${count}`);
        });
      }
    }
  }
}

checkSkinTones().catch(console.error);
