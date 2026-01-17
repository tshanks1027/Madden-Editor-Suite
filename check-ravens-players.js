/**
 * Check where Ravens players went after relocation
 */

async function main() {
  const mf = await import('madden-franchise');
  const franchise = await mf.create('C:/Users/tshan/Documents/Madden NFL 26/Saves/CAREER-RELOCTEST3');

  // Get Player table
  let playerTable = franchise.getTableByName('Player');
  if (!playerTable) {
    const t = franchise.getAllTablesByName('Player');
    if (t?.length) playerTable = t[0];
  }
  await playerTable.readRecords();

  // Count by TeamIndex
  const teamCounts = new Map();
  for (const p of playerTable.records) {
    if (p.isEmpty) continue;
    const ti = Number(p.TeamIndex);
    teamCounts.set(ti, (teamCounts.get(ti) || 0) + 1);
  }

  console.log('=== PLAYER TeamIndex DISTRIBUTION ===');
  const sorted = [...teamCounts.entries()].sort((a,b) => a[0] - b[0]);
  for (const [ti, count] of sorted) {
    console.log(`  TeamIndex=${ti}: ${count} players`);
  }

  // Check TeamIndex=32 players (supposed to be original Ravens)
  console.log('\n=== PLAYERS WITH TeamIndex=32 (first 10) ===');
  let count = 0;
  for (const p of playerTable.records) {
    if (p.isEmpty) continue;
    if (Number(p.TeamIndex) === 32 && count < 10) {
      console.log(`  ${p.FirstName} ${p.LastName} - Position: ${p.Position}`);
      count++;
    }
  }
  console.log(`  ... total: ${teamCounts.get(32) || 0} players with TeamIndex=32`);

  // Now check what's in the actual roster arrays
  console.log('\n=== CHECKING ROSTER ARRAYS ===');

  const teamTable = franchise.getTableByUniqueId(637929298);
  await teamTable.readRecords();

  // Find Ravens and check their roster
  for (const team of teamTable.records) {
    if (team.isEmpty) continue;
    const ti = Number(team.TeamIndex);
    if (ti === 24 || ti === 4 || ti >= 32) {
      const name = team.ShortName || team.DisplayName || `Team ${ti}`;
      const rosterRef = team.getReferenceDataByKey('Roster');
      console.log(`\nTeam ${ti} (${name}):`);
      console.log(`  Roster ref: tableId=${rosterRef?.tableId}, rowNumber=${rosterRef?.rowNumber}`);

      if (rosterRef && rosterRef.tableId !== 0) {
        const rosterTable = franchise.getTableById(rosterRef.tableId);
        await rosterTable.readRecords();
        const roster = rosterTable.records[rosterRef.rowNumber];
        console.log(`  arraySize: ${roster?.arraySize || 0}`);

        // Show first 3 players
        for (let i = 0; i < Math.min(3, roster?.arraySize || 0); i++) {
          const pRef = roster.getReferenceDataByKey(`Player${i}`);
          if (pRef?.rowNumber !== undefined) {
            const p = playerTable.records[pRef.rowNumber];
            if (p && !p.isEmpty) {
              console.log(`    Player${i}: ${p.FirstName} ${p.LastName} (TeamIndex=${p.TeamIndex})`);
            }
          }
        }
      }
    }
  }
}

main().catch(console.error);
