// RESEARCH: Compare FA team (32) roster vs regular team rosters
// This is the key investigation - what's different about Team 32's Roster?
// NO CODING - RESEARCH ONLY

async function investigateFATeamRoster() {
  const FranchiseModule = await import('madden-franchise');
  const filePath = 'C:\\Users\\tshan\\Documents\\Madden NFL 26\\Saves\\CAREER-Testing';

  console.log('='.repeat(80));
  console.log('FA TEAM ROSTER vs REGULAR TEAM ROSTER INVESTIGATION');
  console.log('='.repeat(80));

  const franchise = await FranchiseModule.create(filePath);

  // Get the main Team table (id=5917)
  const teamTable = franchise.getTableById(5917);
  await teamTable.readRecords();

  // Get Player table for reference
  const playerTable = franchise.tables.find(t => t.name === 'Player');
  await playerTable.readRecords();

  // Find FA team (TeamIndex=32, DisplayName contains FA or Practice)
  console.log('\n--- Looking for FA Team ---');

  const allTeams = teamTable.records.filter(r => !r.isEmpty);
  console.log(`Total non-empty teams: ${allTeams.length}`);

  // Group by TeamIndex
  const byIndex = {};
  for (const team of allTeams) {
    const idx = team.TeamIndex;
    if (!byIndex[idx]) byIndex[idx] = [];
    byIndex[idx].push(team);
  }

  console.log('\nTeams by index:');
  for (const [idx, teams] of Object.entries(byIndex)) {
    const names = teams.map(t => t.ShortName || t.DisplayName || 'unknown');
    console.log(`  ${idx}: ${names.join(', ')}`);
  }

  // Investigate Team 32 entries
  console.log('\n' + '='.repeat(80));
  console.log('TEAM 32 ROSTER INVESTIGATION:');
  console.log('='.repeat(80));

  const team32List = byIndex[32] || [];
  console.log(`\nTeam 32 has ${team32List.length} entries`);

  for (const team of team32List) {
    const name = team.ShortName || team.DisplayName || 'unknown';
    console.log(`\n--- Team 32: ${name} ---`);

    // Get Roster reference
    const rosterRef = team.Roster;
    console.log(`Roster field value: ${rosterRef}`);

    // Parse the reference
    if (typeof team.getReferenceDataByKey === 'function') {
      const refData = team.getReferenceDataByKey('Roster');
      if (refData) {
        console.log(`Roster reference: tableId=${refData.tableId}, row=${refData.rowNumber}`);

        // Get the roster table
        const rosterTable = franchise.getTableById(refData.tableId);
        if (rosterTable) {
          await rosterTable.readRecords();
          console.log(`Roster table name: ${rosterTable.name}`);

          const rosterRec = rosterTable.records[refData.rowNumber];
          if (rosterRec) {
            console.log(`Roster array size: ${rosterRec.arraySize}`);

            // Show roster structure
            const fields = Object.keys(rosterRec).filter(k => !k.startsWith('_'));
            console.log(`Roster fields: ${fields.slice(0, 20).join(', ')}`);

            // If arraySize > 0, show first few players
            if (rosterRec.arraySize > 0) {
              console.log(`\nFirst 5 players in roster array:`);
              for (let i = 0; i < Math.min(5, rosterRec.arraySize); i++) {
                const playerField = `Player${i}`;
                const playerVal = rosterRec[playerField];
                console.log(`  ${playerField}: ${playerVal}`);

                // Get actual player data
                const pRef = rosterRec.getReferenceDataByKey(playerField);
                if (pRef && pRef.rowNumber !== undefined) {
                  const player = playerTable.records[pRef.rowNumber];
                  if (player && !player.isEmpty) {
                    console.log(`    -> ${player.FirstName} ${player.LastName}, TeamIndex=${player.TeamIndex}, ContractStatus=${player.ContractStatus}`);
                  }
                }
              }
            } else {
              console.log(`Roster array is EMPTY (size: ${rosterRec.arraySize})`);
            }
          }
        }
      }
    }

    // Also check PracticeSquad reference
    const psRef = team.getReferenceDataByKey ? team.getReferenceDataByKey('PracticeSquad') : null;
    if (psRef && psRef.tableId) {
      console.log(`\nPracticeSquad reference: tableId=${psRef.tableId}, row=${psRef.rowNumber}`);
      const psTable = franchise.getTableById(psRef.tableId);
      if (psTable) {
        await psTable.readRecords();
        const psRec = psTable.records[psRef.rowNumber];
        if (psRec) {
          console.log(`PracticeSquad array size: ${psRec.arraySize}`);
        }
      }
    }
  }

  // Now compare with a regular team (e.g., Kansas City Chiefs - TeamIndex 8)
  console.log('\n' + '='.repeat(80));
  console.log('REGULAR TEAM (KC Chiefs - Index 8) ROSTER FOR COMPARISON:');
  console.log('='.repeat(80));

  const kcTeam = allTeams.find(t => t.TeamIndex === 8);
  if (kcTeam) {
    console.log(`\n--- Kansas City Chiefs ---`);

    const rosterRef = kcTeam.getReferenceDataByKey('Roster');
    if (rosterRef) {
      console.log(`Roster reference: tableId=${rosterRef.tableId}, row=${rosterRef.rowNumber}`);

      const rosterTable = franchise.getTableById(rosterRef.tableId);
      if (rosterTable) {
        await rosterTable.readRecords();
        const rosterRec = rosterTable.records[rosterRef.rowNumber];
        if (rosterRec) {
          console.log(`Roster array size: ${rosterRec.arraySize}`);

          if (rosterRec.arraySize > 0) {
            console.log(`\nFirst 5 players in KC roster:`);
            for (let i = 0; i < Math.min(5, rosterRec.arraySize); i++) {
              const playerField = `Player${i}`;
              const pRef = rosterRec.getReferenceDataByKey(playerField);
              if (pRef && pRef.rowNumber !== undefined) {
                const player = playerTable.records[pRef.rowNumber];
                if (player && !player.isEmpty) {
                  console.log(`  ${player.FirstName} ${player.LastName}, TeamIndex=${player.TeamIndex}, ContractStatus=${player.ContractStatus}`);
                }
              }
            }
          }
        }
      }
    }

    // Count KC players in Player table
    const kcPlayers = playerTable.records.filter(p =>
      !p.isEmpty && Number(p.TeamIndex) === 8
    );
    console.log(`\nPlayers with TeamIndex=8 in Player table: ${kcPlayers.length}`);
  }

  // Count players in Player table with TeamIndex=32
  console.log('\n' + '='.repeat(80));
  console.log('PLAYERS WITH TEAMINDEX=32 IN PLAYER TABLE:');
  console.log('='.repeat(80));

  const team32Players = playerTable.records.filter(p =>
    !p.isEmpty && Number(p.TeamIndex) === 32
  );
  console.log(`Total players with TeamIndex=32: ${team32Players.length}`);

  // Group by ContractStatus
  const byStatus = {};
  for (const p of team32Players) {
    const status = p.ContractStatus;
    if (!byStatus[status]) byStatus[status] = [];
    byStatus[status].push(p);
  }

  console.log('\nBy ContractStatus:');
  for (const [status, players] of Object.entries(byStatus)) {
    console.log(`  ${status}: ${players.length}`);
  }

  // Show sample FA players
  const freeAgents = byStatus['FreeAgent'] || [];
  console.log(`\nSample FreeAgent players (first 10):`);
  for (const p of freeAgents.slice(0, 10)) {
    console.log(`  ${p.FirstName} ${p.LastName} - Overall: ${p.Overall}, Position: ${p.Position}`);
  }

  console.log('\n' + '='.repeat(80));
  console.log('KEY QUESTION: Are FA players supposed to be in ANY roster array?');
  console.log('='.repeat(80));

  // Look for ALL player array tables and check if any contain Team 32 players
  console.log('\nSearching for tables that contain Team 32 player references...');

  const playerArrayTables = [];

  // Find tables with arraySize and Player fields
  for (const table of franchise.tables) {
    if (!table.name) continue;

    try {
      await table.readRecords();
      const rec = table.records.find(r => !r.isEmpty && r.arraySize > 0);
      if (!rec) continue;

      const fields = Object.keys(rec).filter(k => !k.startsWith('_'));
      const hasPlayerField = fields.some(f => /^Player\d*$/.test(f));

      if (hasPlayerField) {
        playerArrayTables.push({
          name: table.name,
          tableId: table.header?.tableId,
          records: table.records.filter(r => !r.isEmpty && r.arraySize > 0)
        });
      }
    } catch (e) {
      // Skip
    }
  }

  console.log(`\nFound ${playerArrayTables.length} tables with Player arrays`);

  // Check each for Team 32 players
  for (const tbl of playerArrayTables) {
    let foundTeam32 = false;

    for (const rec of tbl.records) {
      if (!rec.arraySize) continue;

      for (let i = 0; i < Math.min(rec.arraySize, 100); i++) {
        try {
          const pRef = rec.getReferenceDataByKey(`Player${i}`);
          if (pRef && pRef.rowNumber !== undefined) {
            const player = playerTable.records[pRef.rowNumber];
            if (player && !player.isEmpty && Number(player.TeamIndex) === 32) {
              foundTeam32 = true;
              break;
            }
          }
        } catch (e) {
          // Skip
        }
      }
      if (foundTeam32) break;
    }

    if (foundTeam32) {
      console.log(`  ${tbl.name} (id=${tbl.tableId}): CONTAINS Team 32 players`);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('INVESTIGATION COMPLETE');
  console.log('='.repeat(80));
}

investigateFATeamRoster().catch(console.error);
