/**
 * Analyze generic faces in official EA roster to understand PAM/PSKI correlation
 */
const path = require('path');
const MaddenRosterHelper = require('./src/main/lib/helpers/MaddenRosterHelper');

async function analyze() {
  const templatePath = 'C:/Users/tshan/Documents/Dev/madden-editor-suite/data/templates/ROSTER-Official';

  console.log('Loading roster file...');
  const helper = new MaddenRosterHelper();
  const file = await helper.load(templatePath);

  const playerTable = file.PLAY;
  console.log('Total players:', playerTable.records.length);

  // Find players with generic faces (PLPL=0)
  const genericPlayers = playerTable.records.filter(p => p.PLPL === 0);
  console.log('Generic face players (PLPL=0):', genericPlayers.length);

  console.log('\n=== GENERIC FACE ANALYSIS ===\n');
  console.log('Name | PID(PSXP) | PAM(PEPS) | PSKI | PGHE | PLPL');
  console.log('-'.repeat(100));

  genericPlayers.slice(0, 50).forEach(p => {
    const name = (p.PFNA + ' ' + p.PLNA).padEnd(25);
    const pid = String(p.PSXP || 0).padEnd(8);
    const pam = (p.PEPS || '(blank)').padEnd(25);
    const pski = String(p.PSKI || 0).padEnd(5);
    const pghe = String(p.PGHE || 0).padEnd(5);
    const plpl = String(p.PLPL || 0);
    console.log(name + ' | ' + pid + ' | ' + pam + ' | ' + pski + ' | ' + pghe + ' | ' + plpl);
  });

  // Analyze PAM body code vs PSKI correlation
  console.log('\n=== PAM BODY CODE vs PSKI CORRELATION ===\n');
  const bodyCodePski = {};
  genericPlayers.forEach(p => {
    const pam = p.PEPS || '';
    if (pam.startsWith('gen_')) {
      const parts = pam.split('_');
      if (parts.length >= 3) {
        const bodyCode = parts[2];
        if (!bodyCodePski[bodyCode]) bodyCodePski[bodyCode] = {};
        const pski = p.PSKI || 0;
        bodyCodePski[bodyCode][pski] = (bodyCodePski[bodyCode][pski] || 0) + 1;
      }
    }
  });

  Object.keys(bodyCodePski).sort().forEach(bodyCode => {
    console.log('Body Code: ' + bodyCode);
    const pskis = bodyCodePski[bodyCode];
    Object.keys(pskis).sort((a,b) => a-b).forEach(pski => {
      console.log('  PSKI ' + pski + ': ' + pskis[pski] + ' players');
    });
    console.log('');
  });

  // Check blank PAM players
  const blankPam = genericPlayers.filter(p => !p.PEPS || p.PEPS === '');
  console.log('=== PLAYERS WITH BLANK PAM ===');
  console.log('Count:', blankPam.length);
  blankPam.slice(0, 20).forEach(p => {
    console.log(p.PFNA + ' ' + p.PLNA + ' - PSKI:' + p.PSKI + ' PGHE:' + p.PGHE);
  });
}

analyze().catch(console.error);
