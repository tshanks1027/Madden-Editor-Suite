/**
 * Debug why CAREER-1994TEST has 0 players transferring
 */

const FRANCHISE_PATH = 'C:/Users/tshan/Documents/Madden NFL 26/Saves/CAREER-1994TEST';

async function main() {
  try {
    const mf = await import('madden-franchise');
    const franchise = await mf.create(FRANCHISE_PATH);

    console.log('=== DEBUG CAREER-1994TEST ===\n');

    // Get Player table
    let playerTable = franchise.getTableByName('Player');
    if (!playerTable) {
      const playerTables = franchise.getAllTablesByName('Player');
      if (playerTables && playerTables.length > 0) {
        playerTable = playerTables[0];
      }
    }
    
    if (!playerTable) {
      console.log('ERROR: Player table not found!');
      return;
    }
    
    await playerTable.readRecords();
    console.log('Player table records:', playerTable.records.length);

    // Count by TeamIndex
    const counts = new Map();
    let totalActive = 0;
    
    for (const player of playerTable.records) {
      if (player.isEmpty) continue;
      totalActive++;
      
      const teamIdx = player.TeamIndex;
      counts.set(teamIdx, (counts.get(teamIdx) || 0) + 1);
    }
    
    console.log('Total active player records:', totalActive);
    console.log('\nPlayers by TeamIndex:');
    
    const sorted = [...counts.entries()].sort((a,b) => a[0] - b[0]);
    for (const [teamIdx, count] of sorted) {
      console.log('  TeamIndex ' + teamIdx + ': ' + count + ' players');
    }
    
    // Check Browns (4) and Ravens (24) specifically
    console.log('\n=== KEY TEAMS ===');
    console.log('Browns (TeamIndex=4):', counts.get(4) || 0, 'players');
    console.log('Ravens (TeamIndex=24):', counts.get(24) || 0, 'players');
    
    // Sample some players
    console.log('\nSample Browns players:');
    let brownsCount = 0;
    for (const player of playerTable.records) {
      if (player.isEmpty) continue;
      if (player.TeamIndex === 4) {
        console.log('  ' + player.FirstName + ' ' + player.LastName);
        brownsCount++;
        if (brownsCount >= 3) break;
      }
    }
    
    console.log('\nSample Ravens players:');
    let ravensCount = 0;
    for (const player of playerTable.records) {
      if (player.isEmpty) continue;
      if (player.TeamIndex === 24) {
        console.log('  ' + player.FirstName + ' ' + player.LastName);
        ravensCount++;
        if (ravensCount >= 3) break;
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

main();
