/**
 * Analyze specific players in the generated roster
 */
const path = require('path');
const { parseRosterFile } = require('./src/main/parsers/RosterParser.js');

const ROSTER_PATH = 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden NFL 26\\Saves\\ROSTER-GENERATED';

const targetPlayers = ['jones', 'gallup', 'vander esch', 'kearse'];

async function analyze() {
  console.log('Loading roster from:', ROSTER_PATH);
  const result = await parseRosterFile(ROSTER_PATH);
  const players = result.players;
  console.log('Found', players.length, 'players\n');

  for (const record of players) {
    const firstName = record.PFNA || '';
    const lastName = record.PLNA || '';
    const fullName = (firstName + ' ' + lastName).toLowerCase();

    const isTarget = targetPlayers.some(name => fullName.includes(name));
    if (isTarget) {
      console.log('='.repeat(60));
      console.log('PLAYER:', firstName, lastName);
      console.log('-'.repeat(60));
      console.log('  PEPS (PAM):', record.PEPS || '(empty)');
      console.log('  PSKI (Skin):', record.PSKI);
      console.log('  PGHE (Head):', record.PGHE);
      console.log('  PLPL (FaceType):', record.PLPL);
      console.log('  PSXP (PID):', record.PSXP);
      console.log('  PBOD (Body):', record.PBOD);

      // Analyze PAM skin code
      const pam = record.PEPS || '';
      const pamMatch = pam.match(/^gen_\d+_([A-Za-z])/i);
      if (pamMatch) {
        const skinCode = pamMatch[1].toUpperCase();
        console.log('  PAM Skin Code:', skinCode, skinCode === 'B' ? '(black)' : skinCode === 'T' || skinCode === 'M' ? '(white/tan)' : '(other)');
      } else if (pam) {
        console.log('  PAM Format: Player-format or unknown');
      }
      console.log('');
    }
  }
}

analyze().catch(console.error);
