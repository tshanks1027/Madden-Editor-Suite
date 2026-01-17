/**
 * Test script for roster swap functionality
 * Uses Player.TeamIndex as the primary mechanism (same as MFT)
 *
 * This test does NOT modify the file - it just logs what WOULD happen
 * Run with: node test-roster-swap-v2.js
 */

const FRANCHISE_PATH = 'C:/Users/tshan/Documents/Madden NFL 26/Saves/CAREER-REAL';

// Browns → Ravens relocation (1996)
const SOURCE_TEAM_INDEX = 4;  // Browns
const DEST_TEAM_INDEX = 24;   // Ravens

async function main() {
  try {
    const mf = await import('madden-franchise');
    const franchise = await mf.create(FRANCHISE_PATH);

    console.log('='.repeat(60));
    console.log('ROSTER SWAP TEST');
    console.log('Using Player.TeamIndex approach (same as MFT)');
    console.log('='.repeat(60));
    console.log(`\nSource Team: TeamIndex=${SOURCE_TEAM_INDEX} (Browns)`);
    console.log(`Dest Team: TeamIndex=${DEST_TEAM_INDEX} (Ravens)`);

    // Get Team table for names
    const teamTable = franchise.getTableByUniqueId(637929298);
    await teamTable.readRecords();

    // Build TeamIndex to name mapping
    const teamNameMap = new Map();
    for (const team of teamTable.records) {
      if (team.isEmpty) continue;
      if (team.TeamIndex !== undefined && team.TeamIndex < 33) {
        teamNameMap.set(team.TeamIndex, team.ShortName || team.DisplayName || 'Team ' + team.TeamIndex);
      }
    }

    console.log('\nSource team name: ' + teamNameMap.get(SOURCE_TEAM_INDEX));
    console.log('Dest team name: ' + teamNameMap.get(DEST_TEAM_INDEX));

    // Get Player table
    let playerTable = franchise.getTableByName('Player');
    if (!playerTable) {
      const playerTables = franchise.getAllTablesByName('Player');
      if (playerTables && playerTables.length > 0) {
        playerTable = playerTables[0];
      }
    }
    if (!playerTable) {
      throw new Error('Player table not found');
    }
    await playerTable.readRecords();

    console.log('\nPlayer table has ' + playerTable.records.length + ' records');

    // Find all players on source team (Browns)
    const sourcePlayers = [];
    for (const player of playerTable.records) {
      if (player.isEmpty) continue;
      if (player.TeamIndex === SOURCE_TEAM_INDEX) {
        sourcePlayers.push({
          index: player.index,
          name: player.FirstName + ' ' + player.LastName,
          position: player.Position,
          overall: player.OverallRating || player.Overall
        });
      }
    }

    // Find all players on dest team (Ravens)
    const destPlayers = [];
    for (const player of playerTable.records) {
      if (player.isEmpty) continue;
      if (player.TeamIndex === DEST_TEAM_INDEX) {
        destPlayers.push({
          index: player.index,
          name: player.FirstName + ' ' + player.LastName,
          position: player.Position,
          overall: player.OverallRating || player.Overall
        });
      }
    }

    console.log('\n--- BEFORE SWAP ---');
    console.log('\n' + teamNameMap.get(SOURCE_TEAM_INDEX) + ' (TeamIndex=' + SOURCE_TEAM_INDEX + '): ' + sourcePlayers.length + ' players');
    sourcePlayers.slice(0, 5).forEach(function(p) { console.log('  - ' + p.name + ' (' + p.position + ') [record ' + p.index + ']'); });
    if (sourcePlayers.length > 5) console.log('  ... and ' + (sourcePlayers.length - 5) + ' more');

    console.log('\n' + teamNameMap.get(DEST_TEAM_INDEX) + ' (TeamIndex=' + DEST_TEAM_INDEX + '): ' + destPlayers.length + ' players');
    destPlayers.slice(0, 5).forEach(function(p) { console.log('  - ' + p.name + ' (' + p.position + ') [record ' + p.index + ']'); });
    if (destPlayers.length > 5) console.log('  ... and ' + (destPlayers.length - 5) + ' more');

    console.log('\n--- SIMULATING SWAP (DRY RUN) ---');
    console.log('Step 1: Would change ' + sourcePlayers.length + ' Browns players to TeamIndex=' + DEST_TEAM_INDEX + ' (Ravens)');
    console.log('Step 2: Would change ' + destPlayers.length + ' Ravens players to TeamIndex=' + SOURCE_TEAM_INDEX + ' (Browns)');
    
    console.log('\n--- AFTER SWAP (SIMULATED) ---');
    console.log('Browns (TeamIndex=4): would have ' + destPlayers.length + ' players (former Ravens)');
    console.log('Ravens (TeamIndex=24): would have ' + sourcePlayers.length + ' players (former Browns)');

    console.log('\n=== CONCLUSION ===');
    console.log('The swap is straightforward: just change Player.TeamIndex values!');
    console.log('No roster array manipulation needed.');

  } catch (error) {
    console.error('Error:', error);
    console.error('Stack:', error.stack);
  }
}

main();
