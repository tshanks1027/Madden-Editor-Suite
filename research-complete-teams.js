// RESEARCH: Understand ALL 35 teams complete
// NO CODING - RESEARCH ONLY

async function analyzeCompleteTeams() {
  const filePath = 'C:\\Users\\tshan\\Documents\\Madden NFL 26\\Saves\\CAREER-Testing';

  console.log('='.repeat(80));
  console.log('COMPLETE TEAM ANALYSIS');
  console.log('='.repeat(80));

  const FranchiseModule = await import('madden-franchise');
  const franchise = await FranchiseModule.create(filePath);

  // Get Team table
  const teamTable = franchise.tables.find(t => t.name === 'Team');
  await teamTable.readRecords();

  console.log(`\nTeam table: ${teamTable.records.length} total records`);
  console.log(`Non-empty: ${teamTable.records.filter(r => !r.isEmpty).length}`);

  // Get Player table
  const playerTable = franchise.tables.find(t => t.name === 'Player');
  await playerTable.readRecords();

  // Count players per TeamIndex
  const playerCounts = {};
  for (const p of playerTable.records) {
    if (p.isEmpty) continue;
    const ti = Number(p.TeamIndex);
    playerCounts[ti] = (playerCounts[ti] || 0) + 1;
  }

  console.log('\n' + '-'.repeat(80));
  console.log('ALL NON-EMPTY TEAM RECORDS:');
  console.log('-'.repeat(80));

  let teamCount = 0;
  for (const team of teamTable.records) {
    if (team.isEmpty) continue;
    teamCount++;

    const teamIdx = Number(team.TeamIndex);
    const longName = team.LongName || '';
    const shortName = team.ShortName || '';
    const displayName = team.DisplayName || '';
    const teamType = team.TEAM_TYPE || '';

    console.log(`\nTeam ${teamIdx}: ${longName || displayName || shortName || 'Unknown'}`);
    console.log(`  LongName: ${longName}, ShortName: ${shortName}, DisplayName: ${displayName}`);
    console.log(`  TEAM_TYPE: ${teamType}`);
    console.log(`  Players: ${playerCounts[teamIdx] || 0}`);

    // Check roster array
    if (typeof team.getReferenceDataByKey === 'function') {
      const rosterRef = team.getReferenceDataByKey('Roster');
      if (rosterRef && rosterRef.tableId) {
        const rosterTable = franchise.getTableById(rosterRef.tableId);
        if (rosterTable) {
          await rosterTable.readRecords();
          const rosterRecord = rosterTable.records[rosterRef.rowNumber];
          if (rosterRecord) {
            const arraySize = rosterRecord.arraySize || 0;
            console.log(`  Roster Array Size: ${arraySize}`);

            // Show some players from the array
            if (arraySize > 0 && arraySize < 100) {
              console.log(`  First 5 roster entries:`);
              for (let i = 0; i < Math.min(5, arraySize); i++) {
                const ref = rosterRecord[`Player${i}`];
                console.log(`    Player${i}: ${ref}`);
              }
            }
          }
        }
      } else {
        console.log(`  Roster: NO REFERENCE`);
      }
    }
  }

  console.log(`\nTotal non-empty teams: ${teamCount}`);

  // Now let's look at the FranchiseServer_FreeAgentsFlow table more closely
  console.log('\n' + '='.repeat(80));
  console.log('FREE AGENTS FLOW TABLE DEEP DIVE:');
  console.log('='.repeat(80));

  const faFlowTable = franchise.tables.find(t => t.name === 'FranchiseServer_FreeAgentsFlow');
  if (faFlowTable) {
    await faFlowTable.readRecords();
    console.log(`Records: ${faFlowTable.records.length}`);

    // Check if it has a player array reference
    const rec = faFlowTable.records.find(r => !r.isEmpty);
    if (rec) {
      const fields = Object.keys(rec).filter(k => !k.startsWith('_'));
      console.log(`Fields: ${fields.join(', ')}`);

      // Check for any references
      if (typeof rec.getReferenceDataByKey === 'function') {
        for (const field of fields) {
          const ref = rec.getReferenceDataByKey(field);
          if (ref && ref.tableId) {
            console.log(`  ${field} reference: tableId=${ref.tableId}, row=${ref.rowNumber}`);
          }
        }
      }
    }
  }

  // Check RosterInfo table
  console.log('\n' + '='.repeat(80));
  console.log('ROSTER INFO TABLE:');
  console.log('='.repeat(80));

  const rosterInfoTable = franchise.tables.find(t => t.name === 'RosterInfo');
  if (rosterInfoTable) {
    await rosterInfoTable.readRecords();
    console.log(`Records: ${rosterInfoTable.records.length}`);

    for (const rec of rosterInfoTable.records) {
      if (rec.isEmpty) continue;

      const fields = Object.keys(rec).filter(k => !k.startsWith('_'));
      console.log(`\nFields: ${fields.join(', ')}`);

      // Show all field values
      for (const field of fields) {
        try {
          const value = rec[field];
          if (value !== undefined && value !== null) {
            console.log(`  ${field}: ${value}`);
          }
        } catch (e) {
          // Skip
        }
      }
    }
  }

  // Let's also look for any tables that have a large number of player references
  console.log('\n' + '='.repeat(80));
  console.log('SEARCHING FOR FA PLAYER POOL:');
  console.log('='.repeat(80));

  // Check PlayerAcquisitionEvaluation - might track FA status
  const paeTable = franchise.tables.find(t => t.name === 'PlayerAcquisitionEvaluation');
  if (paeTable) {
    await paeTable.readRecords();
    console.log(`\nPlayerAcquisitionEvaluation: ${paeTable.records.filter(r => !r.isEmpty).length} non-empty`);

    const sample = paeTable.records.find(r => !r.isEmpty);
    if (sample) {
      const fields = Object.keys(sample).filter(k => !k.startsWith('_'));
      console.log(`Fields: ${fields.join(', ')}`);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('RESEARCH COMPLETE');
  console.log('='.repeat(80));
}

analyzeCompleteTeams().catch(console.error);
