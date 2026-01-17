// RESEARCH: How do roster arrays work?
// Do players need to be in roster arrays to appear?
// NO CODING - RESEARCH ONLY

async function analyzeRosterArrays() {
  const filePath = 'C:\\Users\\tshan\\Documents\\Madden NFL 26\\Saves\\CAREER-95Testing';

  console.log('='.repeat(80));
  console.log('ROSTER ARRAY RESEARCH');
  console.log('='.repeat(80));

  const FranchiseModule = await import('madden-franchise');
  const franchise = await FranchiseModule.create(filePath);

  // Get Team table
  const teamTable = franchise.tables.find(t => t.name === 'Team');
  if (!teamTable) {
    console.log('Team table not found!');
    return;
  }

  await teamTable.readRecords();

  // Get Player table for name lookup
  const playerTable = franchise.tables.find(t => t.name === 'Player');
  await playerTable.readRecords();

  const playerLookup = {};
  for (const p of playerTable.records) {
    if (!p.isEmpty) {
      playerLookup[p.index] = `${p.FirstName} ${p.LastName}`;
    }
  }

  console.log('\n' + '-'.repeat(80));
  console.log('CHECKING ROSTER ARRAYS FOR EACH TEAM:');
  console.log('-'.repeat(80));

  for (const team of teamTable.records) {
    if (team.isEmpty) continue;

    const teamIdx = Number(team.TeamIndex);
    const teamName = team.LongName || team.DisplayName || team.ShortName || `Team ${teamIdx}`;

    // Get roster reference
    let rosterRef = null;
    if (typeof team.getReferenceDataByKey === 'function') {
      rosterRef = team.getReferenceDataByKey('Roster');
    }

    if (!rosterRef || !rosterRef.tableId) {
      console.log(`\nTeam ${teamIdx} (${teamName}): NO ROSTER REFERENCE`);
      continue;
    }

    const rosterTable = franchise.getTableById(rosterRef.tableId);
    if (!rosterTable) {
      console.log(`\nTeam ${teamIdx} (${teamName}): Roster table not found`);
      continue;
    }

    await rosterTable.readRecords();
    const rosterRecord = rosterTable.records[rosterRef.rowNumber];

    if (!rosterRecord) {
      console.log(`\nTeam ${teamIdx} (${teamName}): Roster record not found`);
      continue;
    }

    const arraySize = rosterRecord.arraySize || 0;
    console.log(`\nTeam ${teamIdx} (${teamName}): Roster array size = ${arraySize}`);

    if (arraySize > 0) {
      // Show first 10 players in roster array
      console.log('  First 10 players in roster array:');
      for (let i = 0; i < Math.min(10, arraySize); i++) {
        const playerRef = rosterRecord[`Player${i}`];
        if (playerRef && playerRef !== '00000000000000000000000000000000') {
          // Parse player reference to get index
          // Format is typically tableId_rowNumber in binary
          console.log(`    Player${i}: ${playerRef}`);
        }
      }
    }

    // Count how many players have this TeamIndex
    const playersWithTeamIdx = playerTable.records.filter(
      p => !p.isEmpty && Number(p.TeamIndex) === teamIdx
    ).length;
    console.log(`  Players with TeamIndex=${teamIdx}: ${playersWithTeamIdx}`);
  }

  // Now specifically check if visible FA players are in any roster array
  console.log('\n' + '='.repeat(80));
  console.log('CHECKING IF VISIBLE FA PLAYERS ARE IN A ROSTER ARRAY:');
  console.log('='.repeat(80));

  // Find Shaq Mason and Stephon Gilmore (visible FA players)
  const visibleFAs = playerTable.records.filter(p =>
    !p.isEmpty &&
    (p.FirstName === 'Shaq' && p.LastName === 'Mason') ||
    (p.FirstName === 'Stephon' && p.LastName === 'Gilmore')
  );

  // Find Bryce Young and Trevor Lawrence (should now be FA but not visible)
  const invisibleFAs = playerTable.records.filter(p =>
    !p.isEmpty &&
    ((p.FirstName === 'Bryce' && p.LastName === 'Young') ||
      (p.FirstName === 'Trevor' && p.LastName === 'Lawrence'))
  );

  console.log('\nVisible FA players:');
  for (const p of visibleFAs) {
    console.log(`  ${p.FirstName} ${p.LastName} (record index ${p.index})`);
  }

  console.log('\nInvisible FA players (should be FA):');
  for (const p of invisibleFAs) {
    console.log(`  ${p.FirstName} ${p.LastName} (record index ${p.index})`);
  }

  // Check if any of these players appear in any roster array
  console.log('\n' + '-'.repeat(80));
  console.log('SEARCHING ALL PLAYER ARRAY TABLES:');
  console.log('-'.repeat(80));

  const targetIndices = [
    ...visibleFAs.map(p => p.index),
    ...invisibleFAs.map(p => p.index)
  ];

  // Find all Player[] tables
  const playerArrayTables = franchise.tables.filter(t =>
    t.name && t.name.includes('Player[]')
  );

  console.log(`\nFound ${playerArrayTables.length} Player[] tables`);

  for (const arrTable of playerArrayTables) {
    try {
      await arrTable.readRecords();

      for (const record of arrTable.records) {
        if (record.isEmpty) continue;

        const arraySize = record.arraySize || 0;
        for (let i = 0; i < arraySize; i++) {
          const ref = record[`Player${i}`];
          if (ref && ref !== '00000000000000000000000000000000') {
            // Check if this reference contains any of our target player indices
            for (const targetIdx of targetIndices) {
              if (ref.includes(String(targetIdx).padStart(5, '0')) ||
                ref.includes(`_${targetIdx}_`) ||
                ref.includes(`row:${targetIdx}`)) {
                const playerName = playerLookup[targetIdx] || `Player ${targetIdx}`;
                console.log(`Found ${playerName} in ${arrTable.name} (record ${record.index}, Player${i}): ${ref}`);
              }
            }
          }
        }
      }
    } catch (e) {
      // Skip errors
    }
  }

  // Let's also look at other potential tables that might control FA visibility
  console.log('\n' + '='.repeat(80));
  console.log('LOOKING FOR OTHER FA-RELATED DATA:');
  console.log('='.repeat(80));

  // Search for tables with "FreeAgent" in the name
  const faTables = franchise.tables.filter(t =>
    t.name && t.name.toLowerCase().includes('free')
  );

  console.log(`\nTables with "free" in name:`);
  for (const table of faTables) {
    try {
      await table.readRecords();
      const nonEmpty = table.records.filter(r => !r.isEmpty).length;
      console.log(`  ${table.name}: ${nonEmpty} non-empty records`);

      // If it has data, show sample fields
      if (nonEmpty > 0 && table.header && table.header.record2Fields) {
        const fields = table.header.record2Fields.map(f => f.name).slice(0, 10);
        console.log(`    Fields: ${fields.join(', ')}`);
      }
    } catch (e) {
      console.log(`  ${table.name}: Error - ${e.message}`);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('RESEARCH COMPLETE');
  console.log('='.repeat(80));
}

analyzeRosterArrays().catch(console.error);
