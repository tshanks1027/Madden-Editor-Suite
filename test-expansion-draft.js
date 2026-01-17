// Test expansion draft for 1995 (Panthers + Jaguars)
// This tests what happens when we clear and repopulate expansion team rosters
const fs = require('fs');
const path = require('path');

const originalPath = 'C:/Users/tshan/Documents/Madden NFL 26/saves/CAREER-REAL';
const testPath = path.dirname(originalPath) + '/TEST-EXPANSION-DRAFT';
const YEAR = 1995;

const TABLE_IDS = {
  teamTable: 637929298,
  playerTable: 4222,
};

const EXPANSION_TEAMS = [
  { teamIndex: 20, name: 'Carolina Panthers' },
  { teamIndex: 16, name: 'Jacksonville Jaguars' }
];
const FREE_AGENT_TEAM = 32;

async function test() {
  // Copy fresh file
  fs.copyFileSync(originalPath, testPath);
  console.log('Created test file:', testPath);

  const FranchiseModule = await import('madden-franchise');
  const franchise = await FranchiseModule.create(testPath);

  // Get Player table
  let playerTable = franchise.getTableByName('Player');
  if (!playerTable) playerTable = franchise.getTableByUniqueId(TABLE_IDS.playerTable);
  await playerTable.readRecords();
  console.log('Loaded', playerTable.records.length, 'player records');

  // Count players on expansion teams BEFORE
  console.log('\n=== BEFORE ===');
  const expansionIndices = new Set(EXPANSION_TEAMS.map(t => t.teamIndex));
  let expansionPlayers = { 20: [], 16: [] };

  for (const player of playerTable.records) {
    if (player.isEmpty) continue;
    const teamIndex = Number(player.TeamIndex);
    if (expansionIndices.has(teamIndex)) {
      const name = `${player.FirstName || ''} ${player.LastName || ''}`.trim() || `Player_${player.index}`;
      expansionPlayers[teamIndex].push(name);
    }
  }

  for (const team of EXPANSION_TEAMS) {
    console.log(`${team.name} (${team.teamIndex}): ${expansionPlayers[team.teamIndex].length} players`);
    if (expansionPlayers[team.teamIndex].length > 0) {
      console.log(`  Sample: ${expansionPlayers[team.teamIndex].slice(0, 5).join(', ')}`);
    }
  }

  // === TEST: Move expansion team players to FA ===
  console.log('\n=== MOVING EXPANSION PLAYERS TO FA ===');

  let movedCount = 0;
  for (const player of playerTable.records) {
    if (player.isEmpty) continue;
    const teamIndex = Number(player.TeamIndex);
    if (expansionIndices.has(teamIndex)) {
      const name = `${player.FirstName || ''} ${player.LastName || ''}`.trim();

      try {
        player.TeamIndex = FREE_AGENT_TEAM;
        movedCount++;

        // Also update contract status
        try { player.ContractStatus = 'FreeAgent'; } catch (e) {}

        if (movedCount <= 5) {
          console.log(`  Moved ${name} from team ${teamIndex} to FA (${FREE_AGENT_TEAM})`);
        }
      } catch (e) {
        console.log(`  Error moving ${name}: ${e.message}`);
      }
    }
  }
  console.log(`Moved ${movedCount} players to FA`);

  // === VERIFY in memory ===
  console.log('\n=== AFTER (in memory) ===');
  let afterCounts = { 20: 0, 16: 0, 32: 0 };
  for (const player of playerTable.records) {
    if (player.isEmpty) continue;
    const teamIndex = Number(player.TeamIndex);
    if (teamIndex === 20) afterCounts[20]++;
    if (teamIndex === 16) afterCounts[16]++;
    if (teamIndex === 32) afterCounts[32]++;
  }

  console.log('Panthers (20):', afterCounts[20]);
  console.log('Jaguars (16):', afterCounts[16]);
  console.log('Free Agents (32):', afterCounts[32]);

  // Save
  console.log('\n=== SAVING ===');
  await franchise.save(testPath);
  console.log('File saved');

  // Reload and verify
  console.log('\n=== AFTER RELOAD ===');
  const franchise2 = await FranchiseModule.create(testPath);
  let playerTable2 = franchise2.getTableByName('Player');
  if (!playerTable2) playerTable2 = franchise2.getTableByUniqueId(TABLE_IDS.playerTable);
  await playerTable2.readRecords();

  let reloadCounts = { 20: 0, 16: 0, 32: 0 };
  for (const player of playerTable2.records) {
    if (player.isEmpty) continue;
    const teamIndex = Number(player.TeamIndex);
    if (teamIndex === 20) reloadCounts[20]++;
    if (teamIndex === 16) reloadCounts[16]++;
    if (teamIndex === 32) reloadCounts[32]++;
  }

  console.log('Panthers (20):', reloadCounts[20]);
  console.log('Jaguars (16):', reloadCounts[16]);
  console.log('Free Agents (32):', reloadCounts[32]);

  if (reloadCounts[20] === 0 && reloadCounts[16] === 0) {
    console.log('\n✅ SUCCESS: Expansion team players moved to FA');
  } else {
    console.log('\n❌ ISSUE: Some players still on expansion teams');
  }

  console.log('\nTest file:', testPath);
  console.log('>>> Load this file in Madden and try to sim a week');
  console.log('>>> If it crashes, expansion/roster manipulation is the issue');
}

test().catch(console.error);
