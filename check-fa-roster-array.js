// Check if FA team has a roster array and if players are in it

async function checkFARoster(filePath, label) {
  const FranchiseModule = await import('madden-franchise');
  console.log(`\n=== ${label} ===`);
  console.log(`File: ${filePath}`);

  const franchise = await FranchiseModule.create(filePath);

  // Get team table
  const teamTable = franchise.getTableByUniqueId(637929298);
  await teamTable.readRecords();

  console.log(`\nTeam table records: ${teamTable.records.length}`);

  // Find FA team (index 32) or any team with high index
  for (const team of teamTable.records) {
    if (team.isEmpty) continue;
    const teamIdx = Number(team.TeamIndex);

    // Check teams 32+ (FA pool)
    if (teamIdx >= 32) {
      console.log(`\nTeam ${teamIdx}: ${team.LongName || team.DisplayName || 'Unknown'}`);

      // Check roster reference
      const rosterRef = team.getReferenceDataByKey ? team.getReferenceDataByKey('Roster') : null;
      if (rosterRef) {
        console.log(`  Roster ref: tableId=${rosterRef.tableId}, row=${rosterRef.rowNumber}`);

        // Read the roster
        const rosterTable = franchise.getTableById(rosterRef.tableId);
        if (rosterTable) {
          await rosterTable.readRecords();
          const rosterRecord = rosterTable.records[rosterRef.rowNumber];
          if (rosterRecord) {
            const arraySize = rosterRecord.arraySize || 0;
            console.log(`  Roster array size: ${arraySize}`);

            // Count non-zero refs
            let nonZeroCount = 0;
            for (let i = 0; i < Math.min(100, arraySize); i++) {
              const playerRef = rosterRecord[`Player${i}`];
              if (playerRef && playerRef !== '00000000-00000000-00000000-00000001') {
                nonZeroCount++;
              }
            }
            console.log(`  Non-zero player refs (first 100): ${nonZeroCount}`);
          }
        }
      } else {
        console.log(`  No roster reference found`);
      }
    }
  }

  // Also check player table for players with TeamIndex=32 but search for specific names
  const playerTable = franchise.getTableByName('Player');
  await playerTable.readRecords();

  let faPlayers = [];
  for (const player of playerTable.records) {
    if (player.isEmpty) continue;
    const ti = Number(player.TeamIndex);
    if (ti === 32) {
      const name = `${player.FirstName || ''} ${player.LastName || ''}`.trim();
      const ovr = player.OverallRating || player.Overall || 0;
      faPlayers.push({ name, ovr, index: player.index });
    }
  }

  console.log(`\nTotal FA players in Player table: ${faPlayers.length}`);

  // Show some specific players
  const targets = ['Bryce Young', 'Trevor Lawrence'];
  for (const target of targets) {
    const found = faPlayers.find(p => p.name === target);
    if (found) {
      console.log(`  ${target}: recordIndex=${found.index}, Overall=${found.ovr}`);
    }
  }
}

async function main() {
  try {
    await checkFARoster('C:\\Users\\tshan\\Documents\\Madden NFL 26\\Saves\\CAREER-95Testing', 'AFTER EDIT - FA Roster Check');
  } catch (err) {
    console.error('Error:', err.message);
    console.error(err.stack);
  }
}

main();
