/**
 * Analyze test roster to check PAM/PSKI/PGHE values for specific players
 * Testing: Todd Shanks (white, blank PAM), Ryan Flournoy (black), Marist Liuafu (hawaiian)
 */

const path = require('path');
const { parseRosterFile } = require('./src/main/parsers/RosterParser.js');

const ROSTER_PATH = 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden NFL 26\\Saves\\ROSTER-GENERATED';

// Players to find (correct spelling)
const targetPlayers = ['shanks', 'flournoy', 'liufau'];

async function analyzeRoster() {
  console.log('='.repeat(70));
  console.log('ROSTER ANALYSIS: PAM/PSKI/PGHE Field Values');
  console.log('='.repeat(70));
  console.log(`\nLoading roster: ${ROSTER_PATH}\n`);

  try {
    const result = await parseRosterFile(ROSTER_PATH);
    const players = result.players;

    console.log(`Found ${players.length} players\n`);

    // Search for target players
    for (const record of players) {
      const firstName = record.PFNA || '';
      const lastName = record.PLNA || '';
      const fullName = `${firstName} ${lastName}`.toLowerCase();

      // Check if this is one of our target players
      const isTarget = targetPlayers.some(name => fullName.includes(name));

      if (isTarget) {
        console.log('-'.repeat(70));
        console.log(`PLAYER: ${firstName} ${lastName}`);
        console.log('-'.repeat(70));

        // Get all appearance-related fields
        const fields = {
          'PEPS (PAM)': record.PEPS || '',
          'PSKI (Skin)': record.PSKI ?? 'N/A',
          'PGHE (Head)': record.PGHE ?? 'N/A',
          'PLPL (Face Type)': record.PLPL ?? 'N/A',
          'PSXP (PID)': record.PSXP ?? 'N/A',
        };

        for (const [name, value] of Object.entries(fields)) {
          console.log(`  ${name.padEnd(20)}: ${value}`);
        }

        // Analysis
        console.log('\n  ANALYSIS:');
        const pam = fields['PEPS (PAM)'];
        const pski = fields['PSKI (Skin)'];

        if (!pam || pam === '') {
          console.log('  - PAM is BLANK - game must be auto-assigning face');
          console.log(`  - PSKI = ${pski} ${pski === 1 ? '(black body)' : pski === 2 ? '(white body)' : '(unknown)'}`);
        } else {
          // Extract skin code from PAM
          const pamMatch = pam.match(/^gen_\d+_([BTHM]+)_/i);
          if (pamMatch) {
            const skinCode = pamMatch[1].toUpperCase();
            console.log(`  - PAM skin code: ${skinCode} ${skinCode === 'B' ? '(black)' : skinCode === 'T' || skinCode === 'M' ? '(white/tan)' : '(hispanic/mixed)'}`);
            console.log(`  - PSKI = ${pski} ${pski === 1 ? '(black body)' : pski === 2 ? '(white body)' : '(unknown)'}`);

            // Check for mismatch
            const pamIsBlack = skinCode === 'B';
            const pskiIsBlack = pski === 1;
            if (pamIsBlack !== pskiIsBlack) {
              console.log('  - ⚠️  MISMATCH: PAM skin code does not match PSKI!');
            } else {
              console.log('  - ✓ PAM and PSKI are consistent');
            }
          } else {
            console.log(`  - PAM format not recognized: ${pam}`);
          }
        }
        console.log('');
      }
    }

    console.log('='.repeat(70));
    console.log('DONE');

  } catch (error) {
    console.error('Error reading roster:', error);
  }
}

analyzeRoster();
