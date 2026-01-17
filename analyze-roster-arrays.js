/**
 * Analyze how the GAME reads rosters via Team.Roster references
 * Compare working 2011 mod with current test file
 */

async function analyzeFile(filePath, label) {
  const mf = await import('madden-franchise');
  const franchise = await mf.create(filePath);

  console.log('\n' + '='.repeat(60));
  console.log(label);
  console.log('='.repeat(60));

  // Get Team table
  const teamTable = franchise.getTableByUniqueId(637929298);
  await teamTable.readRecords();

  // Get Player table for name lookups
  let playerTable = franchise.getTableByName('Player');
  if (!playerTable) {
    const tables = franchise.getAllTablesByName('Player');
    if (tables && tables.length > 0) playerTable = tables[0];
  }
  await playerTable.readRecords();

  // Check Browns (TeamIndex=4) and Ravens (TeamIndex=24) and Titans (TeamIndex=29)
  const teamsToCheck = [4, 24, 29];

  for (const targetTeamIndex of teamsToCheck) {
    // Find the team record with this TeamIndex
    let teamRecord = null;
    let teamRecordIndex = -1;

    for (let i = 0; i < teamTable.records.length; i++) {
      const team = teamTable.records[i];
      if (team.isEmpty) continue;
      if (team.TeamIndex === targetTeamIndex) {
        teamRecord = team;
        teamRecordIndex = i;
        break;
      }
    }

    if (!teamRecord) {
      console.log('\nTeamIndex ' + targetTeamIndex + ': NOT FOUND in Team table');
      continue;
    }

    const teamName = teamRecord.ShortName || teamRecord.DisplayName || 'Unknown';
    console.log('\n--- TeamIndex ' + targetTeamIndex + ' (' + teamName + ') ---');
    console.log('  Team table record position: records[' + teamRecordIndex + ']');

    // Get Roster reference
    try {
      const rosterRef = teamRecord.getReferenceDataByKey('Roster');
      if (rosterRef && rosterRef.tableId) {
        console.log('  Roster reference: tableId=' + rosterRef.tableId + ', rowNumber=' + rosterRef.rowNumber);

        // Get the roster array table
        const rosterTable = franchise.getTableById(rosterRef.tableId);
        if (rosterTable) {
          await rosterTable.readRecords();
          const roster = rosterTable.records[rosterRef.rowNumber];

          if (roster) {
            const arraySize = roster.arraySize || 0;
            console.log('  Roster array size: ' + arraySize + ' players');

            // Get first 3 player names from roster array
            const players = [];
            for (let j = 0; j < Math.min(3, arraySize); j++) {
              try {
                const playerRef = roster.getReferenceDataByKey('Player' + j);
                if (playerRef && playerRef.rowNumber !== undefined) {
                  const p = playerTable.records[playerRef.rowNumber];
                  if (p && !p.isEmpty) {
                    players.push(p.FirstName + ' ' + p.LastName);
                  }
                }
              } catch (e) {}
            }
            if (players.length > 0) {
              console.log('  First players in roster array: ' + players.join(', '));
            } else {
              console.log('  First players in roster array: none');
            }
          }
        }
      }
    } catch (e) {
      console.log('  Roster reference: ERROR - ' + e.message);
    }

    // Also count players by TeamIndex for comparison
    let countByTeamIndex = 0;
    for (const p of playerTable.records) {
      if (p.isEmpty) continue;
      if (Number(p.TeamIndex) === targetTeamIndex) countByTeamIndex++;
    }
    console.log('  Players with TeamIndex=' + targetTeamIndex + ': ' + countByTeamIndex);
  }
}

async function main() {
  try {
    await analyzeFile('C:/Users/tshan/Documents/Madden NFL 26/Saves/CAREER-2011THROWBACKV09', 'WORKING 2011 MOD');
    await analyzeFile('C:/Users/tshan/Documents/Madden NFL 26/Saves/CAREER-1994TEST', 'CURRENT TEST FILE');
  } catch (e) {
    console.error('Error:', e);
  }
}

main();
