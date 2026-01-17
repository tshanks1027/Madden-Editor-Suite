/**
 * Test expansion team roster clearing logic
 * Run with: node test-expansion-roster-clear.js <franchise-file-path> <year>
 *
 * This script tests:
 * 1. Can we identify expansion teams for a given year?
 * 2. Do those teams have players on their rosters?
 * 3. Can we move those players to FA (TeamIndex 32)?
 *
 * NOTE: This does NOT save changes - it only tests if the logic works
 */

const path = require('path');
const fs = require('fs');

const Franchise = require('madden-franchise');

// Expansion history from the data file
const EXPANSION_HISTORY = [
  { team: "Cowboys", teamIndex: 10, year: 1960 },
  { team: "Vikings", teamIndex: 30, year: 1961 },
  { team: "Falcons", teamIndex: 13, year: 1966 },
  { team: "Dolphins", teamIndex: 11, year: 1966 },
  { team: "Saints", teamIndex: 26, year: 1967 },
  { team: "Bengals", teamIndex: 1, year: 1968 },
  { team: "Seahawks", teamIndex: 27, year: 1976 },
  { team: "Buccaneers", teamIndex: 5, year: 1976 },
  { team: "Panthers", teamIndex: 20, year: 1995 },
  { team: "Jaguars", teamIndex: 16, year: 1995 },
  { team: "Ravens", teamIndex: 24, year: 1996 },
  { team: "Texans", teamIndex: 31, year: 2002 }
];

const FREE_AGENT_TEAM_INDEX = 32;

// Team index to name mapping
const TEAM_NAMES = {
  0: 'Bears', 1: 'Bengals', 2: 'Bills', 3: 'Broncos', 4: 'Browns',
  5: 'Buccaneers', 6: 'Cardinals', 7: 'Chargers', 8: 'Chiefs', 9: 'Colts',
  10: 'Cowboys', 11: 'Dolphins', 12: 'Eagles', 13: 'Falcons', 14: 'Giants',
  15: '49ers', 16: 'Jaguars', 17: 'Jets', 18: 'Lions', 19: 'Packers',
  20: 'Panthers', 21: 'Patriots', 22: 'Raiders', 23: 'Rams', 24: 'Ravens',
  25: 'Commanders', 26: 'Saints', 27: 'Seahawks', 28: 'Steelers', 29: 'Titans',
  30: 'Vikings', 31: 'Texans', 32: 'Free Agents'
};

async function testExpansionRosterClear(filePath, targetYear) {
  console.log('='.repeat(80));
  console.log('EXPANSION TEAM ROSTER CLEARING TEST');
  console.log('='.repeat(80));
  console.log(`File: ${filePath}`);
  console.log(`Target Year: ${targetYear}`);
  console.log('NOTE: No changes will be saved - this is a read-only test');
  console.log('');

  const franchise = await Franchise.create(filePath);
  // File is read by Franchise.create()

  // ============================================
  // STEP 1: Identify expansion teams for this year
  // ============================================
  console.log('\n' + '='.repeat(80));
  console.log('STEP 1: Identify Expansion Teams for Year ' + targetYear);
  console.log('='.repeat(80));

  const expansionTeamsThisYear = EXPANSION_HISTORY.filter(t => t.year === targetYear);

  if (expansionTeamsThisYear.length === 0) {
    console.log(`\nNo expansion teams found for year ${targetYear}`);
    console.log(`\nAvailable expansion years:`);
    const years = [...new Set(EXPANSION_HISTORY.map(t => t.year))].sort((a,b) => a-b);
    for (const y of years) {
      const teams = EXPANSION_HISTORY.filter(t => t.year === y).map(t => t.team);
      console.log(`  ${y}: ${teams.join(', ')}`);
    }
    return;
  }

  console.log(`\nExpansion teams for ${targetYear}:`);
  for (const team of expansionTeamsThisYear) {
    console.log(`  - ${team.team} (TeamIndex: ${team.teamIndex})`);
  }

  // ============================================
  // STEP 2: Get Player table and count players per team
  // ============================================
  console.log('\n' + '='.repeat(80));
  console.log('STEP 2: Count Players on Expansion Teams');
  console.log('='.repeat(80));

  const playerTable = franchise.getTableByName('Player');
  if (!playerTable) {
    console.log('\nERROR: Could not find Player table');
    return;
  }

  await playerTable.readRecords();
  console.log(`\nTotal players in table: ${playerTable.records.length}`);

  // Count players per team
  const teamCounts = new Map();
  const teamPlayers = new Map();

  for (const player of playerTable.records) {
    if (player.isEmpty) continue;

    const teamIndex = Number(player.TeamIndex);
    if (!teamCounts.has(teamIndex)) {
      teamCounts.set(teamIndex, 0);
      teamPlayers.set(teamIndex, []);
    }
    teamCounts.set(teamIndex, teamCounts.get(teamIndex) + 1);

    // Store first 5 players per team for display
    const players = teamPlayers.get(teamIndex);
    if (players.length < 5) {
      players.push({
        name: `${player.FirstName || ''} ${player.LastName || ''}`.trim(),
        position: player.Position || 'UNK',
        overall: player.OverallRating || player.PlayerWeightRating || 0
      });
    }
  }

  console.log(`\nPlayers on expansion teams:`);
  for (const team of expansionTeamsThisYear) {
    const count = teamCounts.get(team.teamIndex) || 0;
    const players = teamPlayers.get(team.teamIndex) || [];

    console.log(`\n  ${team.team} (TeamIndex ${team.teamIndex}): ${count} players`);

    if (count > 0 && players.length > 0) {
      console.log(`  Sample players:`);
      for (const p of players) {
        console.log(`    - ${p.name} (${p.position}, OVR: ${p.overall})`);
      }
      if (count > 5) {
        console.log(`    ... and ${count - 5} more`);
      }
    }
  }

  // ============================================
  // STEP 3: Test moving players to FA (without saving)
  // ============================================
  console.log('\n' + '='.repeat(80));
  console.log('STEP 3: Test Moving Players to Free Agency');
  console.log('='.repeat(80));

  let totalToMove = 0;
  let successfulMoves = 0;
  const moveResults = [];

  for (const team of expansionTeamsThisYear) {
    const teamIndex = team.teamIndex;
    let teamMoves = 0;
    let teamErrors = 0;

    for (const player of playerTable.records) {
      if (player.isEmpty) continue;
      if (Number(player.TeamIndex) !== teamIndex) continue;

      totalToMove++;

      try {
        const originalTeam = player.TeamIndex;
        const playerName = `${player.FirstName || ''} ${player.LastName || ''}`.trim();

        // Test setting TeamIndex to FA (32)
        player.TeamIndex = FREE_AGENT_TEAM_INDEX;

        // Verify it was set
        if (Number(player.TeamIndex) === FREE_AGENT_TEAM_INDEX) {
          successfulMoves++;
          teamMoves++;

          if (teamMoves <= 3) {
            console.log(`  [OK] ${playerName}: ${TEAM_NAMES[originalTeam]} -> Free Agents`);
          }
        } else {
          teamErrors++;
          console.log(`  [FAIL] ${playerName}: TeamIndex not changed`);
        }

        // Restore original (since we're not saving)
        player.TeamIndex = originalTeam;

      } catch (err) {
        teamErrors++;
        console.log(`  [ERROR] Failed to move player: ${err.message}`);
      }
    }

    moveResults.push({
      team: team.team,
      teamIndex: teamIndex,
      playerCount: teamCounts.get(teamIndex) || 0,
      successfulMoves: teamMoves,
      errors: teamErrors
    });

    if (teamMoves > 3) {
      console.log(`  ... and ${teamMoves - 3} more successful moves from ${team.team}`);
    }
  }

  // ============================================
  // SUMMARY
  // ============================================
  console.log('\n' + '='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));

  console.log(`\nTarget Year: ${targetYear}`);
  console.log(`Expansion Teams: ${expansionTeamsThisYear.map(t => t.team).join(', ')}`);
  console.log(`\nPlayers to Move: ${totalToMove}`);
  console.log(`Successful Test Moves: ${successfulMoves}`);
  console.log(`Success Rate: ${totalToMove > 0 ? ((successfulMoves / totalToMove) * 100).toFixed(1) : 0}%`);

  console.log(`\nBy Team:`);
  for (const result of moveResults) {
    const status = result.errors === 0 ? 'OK' : `${result.errors} ERRORS`;
    console.log(`  ${result.team}: ${result.playerCount} players - ${result.successfulMoves} moves (${status})`);
  }

  console.log(`\nCONCLUSION:`);
  if (successfulMoves === totalToMove && totalToMove > 0) {
    console.log(`  All ${totalToMove} players CAN be moved to Free Agency`);
    console.log(`  The expansion roster clearing logic SHOULD WORK`);
  } else if (successfulMoves > 0) {
    console.log(`  ${successfulMoves}/${totalToMove} players can be moved`);
    console.log(`  Some issues may occur with certain players`);
  } else if (totalToMove === 0) {
    console.log(`  No players found on expansion teams`);
    console.log(`  Either rosters are empty or TeamIndex mapping is wrong`);
  } else {
    console.log(`  FAILED to move any players`);
    console.log(`  Check Player table structure and TeamIndex field`);
  }

  // Also show what teams have players (for debugging)
  console.log(`\n\nAll teams with players (for reference):`);
  const sortedTeams = [...teamCounts.entries()].sort((a, b) => b[1] - a[1]);
  for (const [teamIdx, count] of sortedTeams.slice(0, 10)) {
    const name = TEAM_NAMES[teamIdx] || `Team ${teamIdx}`;
    console.log(`  ${name} (${teamIdx}): ${count} players`);
  }

  return {
    targetYear,
    expansionTeams: expansionTeamsThisYear,
    totalPlayers: totalToMove,
    successfulMoves,
    moveResults
  };
}

// Main execution
const args = process.argv.slice(2);
if (args.length < 2) {
  console.log('Usage: node test-expansion-roster-clear.js <franchise-file-path> <year>');
  console.log('Example: node test-expansion-roster-clear.js "C:/path/to/YOURFRANCHISE" 1976');
  console.log('');
  console.log('Available expansion years:');
  const years = [...new Set(EXPANSION_HISTORY.map(t => t.year))].sort((a,b) => a-b);
  for (const y of years) {
    const teams = EXPANSION_HISTORY.filter(t => t.year === y).map(t => t.team);
    console.log(`  ${y}: ${teams.join(', ')}`);
  }
  process.exit(1);
}

const filePath = args[0];
const year = parseInt(args[1], 10);

if (!fs.existsSync(filePath)) {
  console.error(`File not found: ${filePath}`);
  process.exit(1);
}

if (isNaN(year) || year < 1960 || year > 2030) {
  console.error(`Invalid year: ${args[1]}`);
  process.exit(1);
}

testExpansionRosterClear(filePath, year)
  .then((results) => {
    console.log('\n' + '='.repeat(80));
    console.log('Test complete. No changes were saved to the franchise file.');
    console.log('='.repeat(80));
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
