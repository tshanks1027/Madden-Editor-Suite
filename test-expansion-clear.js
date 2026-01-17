// Test that expansion team clearing works (move players to FA)
const fs = require('fs');
const path = require('path');

const originalPath = 'C:/Users/tshan/Documents/Madden NFL 26/saves/CAREER-95exp';
const testPath = path.dirname(originalPath) + '/TEST-EXPANSION-CLEAR';

async function test() {
  // Copy fresh file
  fs.copyFileSync(originalPath, testPath);
  console.log('Created test file:', testPath);

  const FranchiseModule = await import('madden-franchise');
  const franchise = await FranchiseModule.create(testPath);

  // Get player table
  let playerTable = franchise.getTableByName('Player');
  if (!playerTable) {
    playerTable = franchise.getTableByUniqueId(4222);
  }
  await playerTable.readRecords();

  // Expansion teams for 1995: Panthers (20), Jaguars (16)
  const EXPANSION_TEAMS = [20, 16];
  const FREE_AGENT_TEAM = 32;

  // Count players on expansion teams BEFORE
  console.log('\n=== BEFORE ===');
  let playersBefore = { 20: [], 16: [] };
  for (const player of playerTable.records) {
    if (player.isEmpty) continue;
    const teamIndex = Number(player.TeamIndex);
    if (EXPANSION_TEAMS.includes(teamIndex)) {
      const name = `${player.FirstName || ''} ${player.LastName || ''}`.trim();
      playersBefore[teamIndex].push(name);
    }
  }
  console.log(`Panthers (20) players: ${playersBefore[20].length}`);
  console.log(`  Sample: ${playersBefore[20].slice(0, 5).join(', ')}`);
  console.log(`Jaguars (16) players: ${playersBefore[16].length}`);
  console.log(`  Sample: ${playersBefore[16].slice(0, 5).join(', ')}`);

  // Move players to FA
  console.log('\n=== MOVING TO FA ===');
  let movedCount = 0;
  for (const player of playerTable.records) {
    if (player.isEmpty) continue;
    const teamIndex = Number(player.TeamIndex);
    if (EXPANSION_TEAMS.includes(teamIndex)) {
      const name = `${player.FirstName || ''} ${player.LastName || ''}`.trim();
      const oldTeam = player.TeamIndex;

      // Try direct assignment
      try {
        player.TeamIndex = FREE_AGENT_TEAM;
        const newTeam = player.TeamIndex;
        console.log(`  ${name}: TeamIndex ${oldTeam} -> ${newTeam}`);
        movedCount++;

        // Verify it actually changed
        if (Number(player.TeamIndex) !== FREE_AGENT_TEAM) {
          console.log(`    *** WARNING: TeamIndex did not change! Still ${player.TeamIndex}`);
        }
      } catch (e) {
        console.log(`  ERROR setting TeamIndex for ${name}: ${e.message}`);
      }

      // Only show first 10
      if (movedCount >= 10) {
        console.log('  ... (showing first 10)');
        break;
      }
    }
  }

  // Complete moving ALL players
  for (const player of playerTable.records) {
    if (player.isEmpty) continue;
    const teamIndex = Number(player.TeamIndex);
    if (EXPANSION_TEAMS.includes(teamIndex)) {
      try {
        player.TeamIndex = FREE_AGENT_TEAM;
      } catch (e) {
        // Ignore
      }
    }
  }

  // Count players on expansion teams AFTER (in memory)
  console.log('\n=== AFTER (in memory) ===');
  let playersAfterMemory = { 20: 0, 16: 0 };
  for (const player of playerTable.records) {
    if (player.isEmpty) continue;
    const teamIndex = Number(player.TeamIndex);
    if (teamIndex === 20) playersAfterMemory[20]++;
    if (teamIndex === 16) playersAfterMemory[16]++;
  }
  console.log(`Panthers (20) players: ${playersAfterMemory[20]}`);
  console.log(`Jaguars (16) players: ${playersAfterMemory[16]}`);

  // Save and reload
  console.log('\n=== SAVING ===');
  await franchise.save(testPath);
  console.log('File saved');

  // Reload and check
  console.log('\n=== AFTER RELOAD ===');
  const franchise2 = await FranchiseModule.create(testPath);
  let playerTable2 = franchise2.getTableByName('Player');
  if (!playerTable2) {
    playerTable2 = franchise2.getTableByUniqueId(4222);
  }
  await playerTable2.readRecords();

  let playersAfterReload = { 20: 0, 16: 0, 32: 0 };
  for (const player of playerTable2.records) {
    if (player.isEmpty) continue;
    const teamIndex = Number(player.TeamIndex);
    if (teamIndex === 20) playersAfterReload[20]++;
    if (teamIndex === 16) playersAfterReload[16]++;
    if (teamIndex === 32) playersAfterReload[32]++;
  }
  console.log(`Panthers (20) players: ${playersAfterReload[20]}`);
  console.log(`Jaguars (16) players: ${playersAfterReload[16]}`);
  console.log(`Free Agents (32) players: ${playersAfterReload[32]}`);

  if (playersAfterReload[20] === 0 && playersAfterReload[16] === 0) {
    console.log('\n✅ SUCCESS: Expansion team players moved to FA');
  } else {
    console.log('\n❌ FAILED: Players still on expansion teams');
  }

  console.log(`\nTest file: ${testPath}`);
}

test().catch(console.error);
