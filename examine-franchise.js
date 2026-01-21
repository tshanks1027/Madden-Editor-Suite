/**
 * Examine franchise file fields for archetype and skin
 */
const Franchise = require('madden-franchise');

async function examine() {
  const f = await Franchise.create('C:/Users/tshan/Documents/Madden NFL 26/Saves/CAREER-ARCHETYPTEST');

  console.log('=== FRANCHISE FILE TABLES ===');
  const tableNames = f.tables.map(t => t.name).filter(n => n && n.indexOf('[]') === -1);
  console.log('Tables:', tableNames.slice(0, 30).join(', '));

  const playerTable = f.getTableByName('Player');
  if (playerTable) {
    await playerTable.readRecords();
    const players = playerTable.records.filter(r => r && !r.isEmpty);
    console.log('\nPlayer table has', players.length, 'non-empty players');

    if (players[0] && players[0]._fields) {
      const fields = Object.keys(players[0]._fields);

      console.log('\n--- All fields containing "arch", "type" ---');
      fields.filter(f => f.toLowerCase().includes('arch') || f.toLowerCase().includes('type')).forEach(f => {
        console.log('  ' + f + ': ' + players[0][f]);
      });

      console.log('\n--- All fields containing "skin", "body", "race" ---');
      fields.filter(f => f.toLowerCase().includes('skin') || f.toLowerCase().includes('body') || f.toLowerCase().includes('race')).forEach(f => {
        console.log('  ' + f + ': ' + players[0][f]);
      });

      // Find test players (ZZARCH-*)
      console.log('\n=== TEST PLAYERS (ZZARCH-*) ===');
      const testPlayers = players.filter(p => p.LastName && p.LastName.startsWith('ZZARCH'));
      console.log('Found', testPlayers.length, 'test players');

      for (const p of testPlayers) {
        console.log('\n' + p.FirstName + ' ' + p.LastName + ':');
        console.log('  Position:', p.Position);
        console.log('  PlayerType:', p.PlayerType);
        console.log('  Overall:', p.Overall);
        console.log('  OverallGrade:', p.OverallGrade);

        // Look for any archetype-related fields
        const archFields = Object.keys(p._fields).filter(f =>
          f.toLowerCase().includes('arch') ||
          f.toLowerCase().includes('type') ||
          f.toLowerCase().includes('ovr') ||
          f.toLowerCase().includes('overall')
        );
        if (archFields.length > 0) {
          console.log('  Archetype-related fields:');
          archFields.forEach(f => console.log(`    ${f}: ${p[f]}`));
        }
      }

      // Show first 3 regular players for comparison
      console.log('\n=== SAMPLE REGULAR PLAYERS ===');
      const regularPlayers = players.filter(p => p.LastName && !p.LastName.startsWith('ZZ')).slice(0, 3);
      for (const p of regularPlayers) {
        console.log('\n' + p.FirstName + ' ' + p.LastName + ':');
        console.log('  Position:', p.Position);
        console.log('  PlayerType:', p.PlayerType);
        console.log('  Overall:', p.Overall);
      }
    }
  }
}

examine().catch(e => console.error(e));
