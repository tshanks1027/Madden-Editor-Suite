/**
 * Check how Free Agents work in the franchise file
 */

async function main() {
  const mf = await import('madden-franchise');
  const franchise = await mf.create('C:/Users/tshan/Documents/Madden NFL 26/Saves/CAREER-2011THROWBACKV09');

  const teamTable = franchise.getTableByUniqueId(637929298);
  await teamTable.readRecords();

  console.log('=== ALL TEAMS WITH TeamIndex >= 32 ===\n');

  for (const team of teamTable.records) {
    if (team.isEmpty) continue;
    const idx = Number(team.TeamIndex);
    if (idx >= 32) {
      console.log(`TeamIndex=${idx}: ${team.ShortName || team.DisplayName || team.LongName}`);
      const rosterRef = team.getReferenceDataByKey('Roster');
      console.log(`  Roster ref: tableId=${rosterRef?.tableId}, rowNumber=${rosterRef?.rowNumber}`);
    }
  }

  // Also check what teams exist
  console.log('\n=== ALL TEAM INDICES ===');
  const indices = [];
  for (const team of teamTable.records) {
    if (team.isEmpty) continue;
    indices.push(Number(team.TeamIndex));
  }
  indices.sort((a,b) => a-b);
  console.log(indices.join(', '));

  // Check Player table for TeamIndex values
  let playerTable = franchise.getTableByName('Player');
  if (!playerTable) {
    const tables = franchise.getAllTablesByName('Player');
    if (tables?.length) playerTable = tables[0];
  }
  await playerTable.readRecords();

  console.log('\n=== PLAYER TeamIndex DISTRIBUTION ===');
  const teamCounts = new Map();
  for (const p of playerTable.records) {
    if (p.isEmpty) continue;
    const ti = Number(p.TeamIndex);
    teamCounts.set(ti, (teamCounts.get(ti) || 0) + 1);
  }

  const sorted = [...teamCounts.entries()].sort((a,b) => a[0] - b[0]);
  for (const [ti, count] of sorted) {
    if (ti >= 32 || count > 50) {
      console.log(`  TeamIndex=${ti}: ${count} players`);
    }
  }
}

main().catch(console.error);
