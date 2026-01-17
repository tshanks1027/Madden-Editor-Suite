// Check for Bryce Young and Trevor Lawrence in both files

async function checkPlayers(filePath, label) {
  const FranchiseModule = await import('madden-franchise');
  console.log(`\n=== ${label} ===`);
  console.log(`File: ${filePath}`);

  const franchise = await FranchiseModule.create(filePath);

  let playerTable = franchise.getTableByName('Player');
  if (!playerTable) {
    playerTable = franchise.getTableByUniqueId(4195422891);
  }
  await playerTable.readRecords();

  console.log(`Total player records: ${playerTable.records.length}`);

  // Search for specific players
  const targets = ['Bryce Young', 'Trevor Lawrence', 'Shaq Mason', 'Stephon Gilmore'];

  for (const target of targets) {
    const [first, last] = target.split(' ');
    let found = false;

    for (const player of playerTable.records) {
      if (player.isEmpty) continue;

      const pFirst = player.FirstName || '';
      const pLast = player.LastName || '';

      if (pFirst === first && pLast === last) {
        const teamIndex = Number(player.TeamIndex);
        console.log(`FOUND ${target}: TeamIndex=${teamIndex}, Overall=${player.OverallRating || player.Overall}, isEmpty=${player.isEmpty}`);
        found = true;
        break;
      }
    }

    if (!found) {
      console.log(`NOT FOUND: ${target}`);
    }
  }

  // Count by team
  const teamCounts = new Map();
  for (const player of playerTable.records) {
    if (player.isEmpty) continue;
    const ti = Number(player.TeamIndex);
    teamCounts.set(ti, (teamCounts.get(ti) || 0) + 1);
  }

  console.log(`\nTeam 16 (Jaguars): ${teamCounts.get(16) || 0}`);
  console.log(`Team 20 (Panthers): ${teamCounts.get(20) || 0}`);
  console.log(`Team 32 (FA): ${teamCounts.get(32) || 0}`);
}

async function main() {
  try {
    await checkPlayers('C:\\Users\\tshan\\Documents\\Madden NFL 26\\Saves\\CAREER-Testing', 'ORIGINAL FILE');
    await checkPlayers('C:\\Users\\tshan\\Documents\\Madden NFL 26\\Saves\\CAREER-95Testing', 'AFTER EDIT');
  } catch (err) {
    console.error('Error:', err.message);
    console.error(err.stack);
  }
}

main();
