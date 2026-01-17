/**
 * Analyze generic faces in the official roster template
 * Find the real way skin tone/race is stored
 */

const path = require('path');

async function analyzeGenericFaces() {
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

  // Find players with generic PAMs (gen_X patterns)
  const genericPlayers = players.filter(p => {
    const pam = String(p.PLPL || '');
    return pam.startsWith('gen_');
  });

  console.log('Players with generic PAMs (gen_X):', genericPlayers.length);
  console.log('');

  // Show sample generic players with ALL their relevant fields
  console.log('=== Sample Generic Face Players ===');
  genericPlayers.slice(0, 10).forEach(p => {
    console.log(`\n${p.PFNA} ${p.PLNA}:`);
    console.log(`  PSXP (PID): ${p.PSXP}`);
    console.log(`  PLPL (PAM): ${p.PLPL}`);
    console.log(`  PEPS: ${p.PEPS}`);
    console.log(`  PSKI: ${p.PSKI}`);
    console.log(`  PCBT (Body): ${p.PCBT}`);
    // Check for any other skin/race related fields
    console.log(`  PGHE: ${p.PGHE}`);
    console.log(`  PLHT: ${p.PLHT}`);
  });

  // Group generic PAMs by their race letter (B, H, M, T)
  console.log('\n=== Generic PAM Patterns ===');
  const pamPatterns = {};
  genericPlayers.forEach(p => {
    const pam = String(p.PLPL || '');
    // Extract pattern like "gen_1_B", "gen_2_M", etc.
    const match = pam.match(/^(gen_\d+_[A-Za-z])/);
    if (match) {
      const pattern = match[1];
      if (!pamPatterns[pattern]) {
        pamPatterns[pattern] = { count: 0, pskiValues: new Set(), players: [] };
      }
      pamPatterns[pattern].count++;
      pamPatterns[pattern].pskiValues.add(p.PSKI);
      if (pamPatterns[pattern].players.length < 3) {
        pamPatterns[pattern].players.push(`${p.PFNA} ${p.PLNA}`);
      }
    }
  });

  Object.entries(pamPatterns).sort((a, b) => b[1].count - a[1].count).forEach(([pattern, data]) => {
    console.log(`\n${pattern}: ${data.count} players`);
    console.log(`  PSKI values: [${[...data.pskiValues].sort().join(', ')}]`);
    console.log(`  Examples: ${data.players.join(', ')}`);
  });

  // Now look at players WITHOUT generic PAMs to understand skin tone mapping
  console.log('\n\n=== Non-Generic Players by PSKI ===');
  const nonGenericPlayers = players.filter(p => {
    const pam = String(p.PLPL || '');
    return !pam.startsWith('gen_') && pam !== '' && pam !== '100';
  });

  console.log('Non-generic players with real PAMs:', nonGenericPlayers.length);

  // Group by PSKI
  const pskiGroups = {};
  nonGenericPlayers.forEach(p => {
    const pski = p.PSKI;
    if (!pskiGroups[pski]) {
      pskiGroups[pski] = [];
    }
    if (pskiGroups[pski].length < 5) {
      pskiGroups[pski].push({ name: `${p.PFNA} ${p.PLNA}`, pam: p.PLPL });
    }
  });

  Object.entries(pskiGroups).forEach(([pski, players]) => {
    console.log(`\nPSKI ${pski}:`);
    players.forEach(p => console.log(`  ${p.name} - PAM: ${p.pam}`));
  });

  // Check what fields might control skin tone
  console.log('\n\n=== All Fields in a Generic Player ===');
  const sampleGeneric = genericPlayers[0];
  if (sampleGeneric) {
    const sortedFields = Object.keys(sampleGeneric).sort();
    sortedFields.forEach(field => {
      const val = sampleGeneric[field];
      // Only show fields that might be relevant (small values, not ratings)
      if (typeof val === 'number' && val >= 0 && val <= 20) {
        console.log(`  ${field}: ${val}`);
      } else if (typeof val === 'string' && val.length > 0 && val.length < 50) {
        console.log(`  ${field}: "${val}"`);
      }
    });
  }
}

analyzeGenericFaces().catch(console.error);
