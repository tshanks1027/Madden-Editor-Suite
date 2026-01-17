// RESEARCH: Understand ALL teams and their roster arrays
// NO CODING - RESEARCH ONLY

async function analyzeAllTeams() {
  const filePath = 'C:\\Users\\tshan\\Documents\\Madden NFL 26\\Saves\\CAREER-95Testing';

  console.log('='.repeat(80));
  console.log('ALL TEAMS RESEARCH');
  console.log('='.repeat(80));

  const FranchiseModule = await import('madden-franchise');
  const franchise = await FranchiseModule.create(filePath);

  // Get Team table
  const teamTable = franchise.tables.find(t => t.name === 'Team');
  await teamTable.readRecords();

  // Get all field names for Team table
  const teamFields = [];
  if (teamTable.header && teamTable.header.record2Fields) {
    for (const field of teamTable.header.record2Fields) {
      teamFields.push(field.name);
    }
  }

  console.log(`\nTeam table fields (${teamFields.length}):`);
  console.log(teamFields.join(', '));

  // Get Player table
  const playerTable = franchise.tables.find(t => t.name === 'Player');
  await playerTable.readRecords();

  // Count players per team
  const playerCounts = {};
  for (const p of playerTable.records) {
    if (p.isEmpty) continue;
    const ti = Number(p.TeamIndex);
    playerCounts[ti] = (playerCounts[ti] || 0) + 1;
  }

  console.log('\n' + '-'.repeat(80));
  console.log('ALL TEAMS:');
  console.log('-'.repeat(80));

  for (const team of teamTable.records) {
    if (team.isEmpty) continue;

    const teamIdx = Number(team.TeamIndex);
    const teamName = team.LongName || team.DisplayName || team.ShortName || 'Unknown';

    console.log(`\nTeam ${teamIdx}: ${teamName}`);

    // Show key fields
    const keyFields = ['TGID', 'TeamIndex', 'LongName', 'ShortName', 'DisplayName',
      'NickName', 'Abbreviation', 'CityAbbrev', 'TEAM_TYPE', 'TEAM_ARCHETYPE'];

    for (const field of keyFields) {
      try {
        const value = team[field];
        if (value !== undefined && value !== null && value !== '') {
          console.log(`  ${field}: ${value}`);
        }
      } catch (e) {
        // Skip
      }
    }

    // Check roster
    if (typeof team.getReferenceDataByKey === 'function') {
      const rosterRef = team.getReferenceDataByKey('Roster');
      if (rosterRef && rosterRef.tableId) {
        const rosterTable = franchise.getTableById(rosterRef.tableId);
        if (rosterTable) {
          await rosterTable.readRecords();
          const rosterRecord = rosterTable.records[rosterRef.rowNumber];
          if (rosterRecord) {
            console.log(`  Roster Array Size: ${rosterRecord.arraySize || 0}`);
          }
        }
      }
    }

    console.log(`  Players with this TeamIndex: ${playerCounts[teamIdx] || 0}`);
  }

  // Also check for any other tables that might identify FA
  console.log('\n' + '='.repeat(80));
  console.log('LOOKING FOR TGID REFERENCES:');
  console.log('='.repeat(80));

  // Check player table for TGID field
  const samplePlayer = playerTable.records.find(r => !r.isEmpty);
  if (samplePlayer) {
    const playerFields = Object.keys(samplePlayer).filter(k => !k.startsWith('_'));
    const tgidFields = playerFields.filter(f =>
      f.toLowerCase().includes('tgid') ||
      f.toLowerCase().includes('groupid')
    );

    console.log(`\nPlayer TGID-related fields: ${tgidFields.join(', ') || 'NONE'}`);

    // Check if there's a TGID field
    if (samplePlayer.TGID !== undefined) {
      console.log(`\nSample player TGID: ${samplePlayer.TGID}`);
    }
  }

  // Check if there's a separate FreeAgent table/pool
  console.log('\n' + '-'.repeat(80));
  console.log('SEARCHING FOR FA POOL TABLES:');
  console.log('-'.repeat(80));

  const potentialFATables = franchise.tables.filter(t =>
    t.name && (
      t.name.includes('FreeAgent') ||
      t.name.includes('FA') ||
      t.name.includes('AvailablePlayers') ||
      t.name.includes('ReleasePool')
    )
  );

  for (const table of potentialFATables) {
    try {
      await table.readRecords();
      const nonEmpty = table.records.filter(r => !r.isEmpty).length;
      console.log(`\n${table.name}: ${nonEmpty} non-empty records`);

      if (nonEmpty > 0 && table.records[0]) {
        const fields = Object.keys(table.records[0]).filter(k => !k.startsWith('_'));
        console.log(`  Fields: ${fields.join(', ')}`);

        // Show first record
        const first = table.records.find(r => !r.isEmpty);
        if (first) {
          console.log(`  Sample record: ${JSON.stringify(Object.fromEntries(
            fields.slice(0, 5).map(f => [f, first[f]])
          ))}`);
        }
      }
    } catch (e) {
      console.log(`${table.name}: Error - ${e.message}`);
    }
  }

  // Look for PlayerPersonnel table - might have FA tracking
  console.log('\n' + '-'.repeat(80));
  console.log('PLAYER PERSONNEL TABLE:');
  console.log('-'.repeat(80));

  const personnelTable = franchise.tables.find(t => t.name === 'PlayerPersonnel');
  if (personnelTable) {
    await personnelTable.readRecords();
    console.log(`Records: ${personnelTable.records.length}`);

    const firstRec = personnelTable.records.find(r => !r.isEmpty);
    if (firstRec) {
      const fields = Object.keys(firstRec).filter(k => !k.startsWith('_'));
      console.log(`Fields: ${fields.join(', ')}`);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('RESEARCH COMPLETE');
  console.log('='.repeat(80));
}

analyzeAllTeams().catch(console.error);
