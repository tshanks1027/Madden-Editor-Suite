// RESEARCH: Deep dive into Team roster arrays
// Check if FA players need to be added to Team 32's roster array
// NO CODING - RESEARCH ONLY

async function analyzeTeamRosters() {
  const filePath = 'C:\\Users\\tshan\\Documents\\Madden NFL 26\\Saves\\CAREER-Testing';

  console.log('='.repeat(80));
  console.log('DEEP TEAM ROSTER ANALYSIS');
  console.log('='.repeat(80));

  const FranchiseModule = await import('madden-franchise');
  const franchise = await FranchiseModule.create(filePath);

  const teamTable = franchise.tables.find(t => t.name === 'Team');
  await teamTable.readRecords();

  const playerTable = franchise.tables.find(t => t.name === 'Player');
  await playerTable.readRecords();

  console.log(`\nTeam table: ${teamTable.records.filter(r => !r.isEmpty).length} non-empty teams`);

  // Get all team fields to understand the structure
  const sampleTeam = teamTable.records.find(r => !r.isEmpty);
  if (sampleTeam) {
    const teamFields = Object.keys(sampleTeam).filter(k => !k.startsWith('_'));
    console.log(`\nTeam table fields (${teamFields.length}):`);

    // Filter for roster/player-related fields
    const rosterFields = teamFields.filter(f =>
      f.toLowerCase().includes('roster') ||
      f.toLowerCase().includes('player') ||
      f.toLowerCase().includes('array')
    );
    console.log(`Roster-related fields: ${rosterFields.join(', ') || 'NONE'}`);

    // Show all fields that might be relevant
    console.log('\nAll Team fields:');
    for (const f of teamFields) {
      console.log(`  ${f}`);
    }
  }

  // Check each team's roster reference
  console.log('\n' + '='.repeat(80));
  console.log('TEAM ROSTER REFERENCES:');
  console.log('='.repeat(80));

  for (const team of teamTable.records) {
    if (team.isEmpty) continue;

    const teamIdx = Number(team.TeamIndex);
    const teamName = team.ShortName || team.DisplayName || `Team${teamIdx}`;

    // Count players with this TeamIndex
    const playerCount = playerTable.records.filter(p =>
      !p.isEmpty && Number(p.TeamIndex) === teamIdx
    ).length;

    console.log(`\nTeam ${teamIdx} (${teamName}): ${playerCount} players with this TeamIndex`);

    // Check Roster field
    if (team.Roster) {
      console.log(`  Roster field: ${team.Roster}`);
    }

    // Check for reference
    if (typeof team.getReferenceDataByKey === 'function') {
      const rosterRef = team.getReferenceDataByKey('Roster');
      if (rosterRef && rosterRef.tableId) {
        console.log(`  Roster reference: tableId=${rosterRef.tableId}, row=${rosterRef.rowNumber}`);

        // Get the roster table
        const rosterTable = franchise.getTableById(rosterRef.tableId);
        if (rosterTable) {
          await rosterTable.readRecords();
          const rosterRec = rosterTable.records[rosterRef.rowNumber];
          if (rosterRec) {
            console.log(`  Roster array size: ${rosterRec.arraySize || 0}`);

            // Show first few player refs if any
            if (rosterRec.arraySize > 0) {
              console.log(`  First 3 player refs:`);
              for (let i = 0; i < Math.min(3, rosterRec.arraySize); i++) {
                const playerRef = rosterRec[`Player${i}`];
                console.log(`    Player${i}: ${playerRef}`);

                // Try to get the actual player
                if (typeof rosterRec.getReferenceDataByKey === 'function') {
                  const pRef = rosterRec.getReferenceDataByKey(`Player${i}`);
                  if (pRef && pRef.rowNumber !== undefined) {
                    const player = playerTable.records[pRef.rowNumber];
                    if (player) {
                      console.log(`      -> ${player.FirstName} ${player.LastName} (TeamIndex: ${player.TeamIndex})`);
                    }
                  }
                }
              }
            }
          }
        }
      } else {
        console.log(`  NO Roster reference found`);
      }
    }
  }

  // Specifically look at Team 32 (FA/Practice)
  console.log('\n' + '='.repeat(80));
  console.log('DETAILED TEAM 32 (FA/PRACTICE) ANALYSIS:');
  console.log('='.repeat(80));

  const team32 = teamTable.records.find(t => !t.isEmpty && Number(t.TeamIndex) === 32);
  if (team32) {
    const fields = Object.keys(team32).filter(k => !k.startsWith('_'));
    console.log('\nAll fields for Team 32:');
    for (const f of fields) {
      try {
        const val = team32[f];
        if (val !== undefined && val !== null && val !== '') {
          console.log(`  ${f}: ${val}`);
        }
      } catch (e) {
        // Skip
      }
    }

    // Check all references
    console.log('\nAll references from Team 32:');
    if (typeof team32.getReferenceDataByKey === 'function') {
      for (const f of fields) {
        const ref = team32.getReferenceDataByKey(f);
        if (ref && ref.tableId) {
          const refTable = franchise.getTableById(ref.tableId);
          console.log(`  ${f} -> tableId=${ref.tableId} (${refTable?.name || 'unknown'}), row=${ref.rowNumber}`);
        }
      }
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('RESEARCH COMPLETE');
  console.log('='.repeat(80));
}

analyzeTeamRosters().catch(console.error);
