// RESEARCH: Deep investigation into Team tables and roster arrays
// NO CODING - RESEARCH ONLY

async function investigateTeamTable() {
  const FranchiseModule = await import('madden-franchise');
  const filePath = 'C:\\Users\\tshan\\Documents\\Madden NFL 26\\Saves\\CAREER-Testing';

  console.log('='.repeat(80));
  console.log('INVESTIGATING TEAM TABLES');
  console.log('='.repeat(80));

  const franchise = await FranchiseModule.create(filePath);

  // Find ALL Team-related tables
  const teamTables = franchise.tables.filter(t =>
    t.name && t.name.toLowerCase().includes('team')
  );

  console.log('\nTeam-related tables found:', teamTables.length);

  for (const table of teamTables) {
    try {
      await table.readRecords();
      const nonEmpty = table.records ? table.records.filter(r => !r.isEmpty).length : 0;
      console.log(`  ${table.name} (id=${table.header?.tableId || 'unknown'}): ${nonEmpty} non-empty records`);
    } catch (e) {
      console.log(`  ${table.name}: Error - ${e.message}`);
    }
  }

  // Get the main Team table by table ID (637929298) or UniqueId
  console.log('\n' + '-'.repeat(80));
  console.log('GETTING TEAM TABLE BY ID:');
  console.log('-'.repeat(80));

  let mainTeamTable = franchise.getTableById(637929298);
  if (!mainTeamTable) {
    mainTeamTable = franchise.getTableByUniqueId(637929298);
  }

  if (mainTeamTable) {
    await mainTeamTable.readRecords();
    console.log(`Found main Team table: ${mainTeamTable.records.filter(r => !r.isEmpty).length} non-empty`);

    // Get first few team fields
    const team = mainTeamTable.records.find(r => !r.isEmpty);
    if (team) {
      const fields = Object.keys(team).filter(k => !k.startsWith('_')).slice(0, 30);
      console.log('\nFirst 30 fields:', fields.join(', '));
    }

    // Show teams
    console.log('\nTeams:');
    for (const t of mainTeamTable.records) {
      if (t.isEmpty) continue;
      console.log(`  Index ${t.TeamIndex}: ${t.ShortName || t.DisplayName || t.LongName || 'unnamed'}`);
    }
  } else {
    console.log('Could not find main Team table by ID');

    // Try finding the Team table by name
    const teamByName = franchise.tables.find(t => t.name === 'Team');
    if (teamByName) {
      console.log('\nFound Team table by name');
      await teamByName.readRecords();
      console.log(`Records: ${teamByName.records.length}, Non-empty: ${teamByName.records.filter(r => !r.isEmpty).length}`);
    }
  }

  // Look at ALL tables that might have roster arrays
  console.log('\n' + '='.repeat(80));
  console.log('INVESTIGATING ALL ROSTER-RELATED TABLES:');
  console.log('='.repeat(80));

  const rosterRelated = franchise.tables.filter(t =>
    t.name && (
      t.name.toLowerCase().includes('roster') ||
      t.name.toLowerCase().includes('playerarray') ||
      t.name.toLowerCase().includes('teamplayer')
    )
  );

  for (const table of rosterRelated) {
    try {
      await table.readRecords();
      const nonEmpty = table.records ? table.records.filter(r => !r.isEmpty).length : 0;
      console.log(`\n${table.name} (id=${table.header?.tableId || 'unknown'}): ${nonEmpty}/${table.records.length} non-empty`);

      // Show structure of first non-empty record
      const first = table.records.find(r => !r.isEmpty);
      if (first) {
        const fields = Object.keys(first).filter(k => !k.startsWith('_'));
        console.log(`  Fields: ${fields.join(', ')}`);

        if (first.arraySize !== undefined) {
          console.log(`  Array size: ${first.arraySize}`);
        }

        // Check for Player references
        const playerFields = fields.filter(f => f.toLowerCase().includes('player'));
        if (playerFields.length > 0) {
          console.log(`  Player fields: ${playerFields.join(', ')}`);

          // Show first few player values
          for (let i = 0; i < Math.min(3, playerFields.length); i++) {
            const pf = playerFields[i];
            console.log(`    ${pf}: ${first[pf]}`);
          }
        }
      }
    } catch (e) {
      console.log(`  ${table.name}: Error - ${e.message}`);
    }
  }

  // Search for tables containing player references
  console.log('\n' + '='.repeat(80));
  console.log('SEARCHING FOR TABLES WITH PLAYER ARRAYS:');
  console.log('='.repeat(80));

  let foundPlayerArrays = [];

  for (const table of franchise.tables) {
    if (!table.name) continue;

    try {
      await table.readRecords();
      if (!table.records || table.records.length === 0) continue;

      const first = table.records.find(r => !r.isEmpty);
      if (!first) continue;

      const fields = Object.keys(first).filter(k => !k.startsWith('_'));

      // Check for Player0, Player1, etc. pattern
      const hasPlayerArray = fields.some(f => /^Player\d+$/.test(f));

      if (hasPlayerArray) {
        foundPlayerArrays.push({
          name: table.name,
          tableId: table.header?.tableId || 'unknown',
          arraySize: first.arraySize || 0
        });
      }
    } catch (e) {
      // Skip
    }
  }

  console.log(`\nTables with Player arrays: ${foundPlayerArrays.length}`);
  for (const t of foundPlayerArrays.slice(0, 20)) {
    console.log(`  ${t.name} (id=${t.tableId}): arraySize=${t.arraySize}`);
  }

  // Now investigate the specific roster table for Team 32
  console.log('\n' + '='.repeat(80));
  console.log('TEAM 32 ROSTER INVESTIGATION:');
  console.log('='.repeat(80));

  // Find Team 32 and its roster reference
  for (const table of franchise.tables) {
    if (table.name !== 'Team') continue;

    await table.readRecords();

    for (const team of table.records) {
      if (team.isEmpty) continue;

      const teamIdx = team.TeamIndex;
      if (teamIdx !== undefined && Number(teamIdx) === 32) {
        console.log(`\nTeam 32 found!`);

        // Show all references
        if (typeof team.getReferenceDataByKey === 'function') {
          const fields = Object.keys(team).filter(k => !k.startsWith('_'));
          for (const f of fields) {
            try {
              const ref = team.getReferenceDataByKey(f);
              if (ref && ref.tableId) {
                const refTable = franchise.getTableById(ref.tableId);
                console.log(`  ${f} -> tableId=${ref.tableId} (${refTable?.name || 'unknown'}), row=${ref.rowNumber}`);

                // If it's a roster reference, show its contents
                if (f.toLowerCase().includes('roster') && refTable) {
                  await refTable.readRecords();
                  const rosterRec = refTable.records[ref.rowNumber];
                  if (rosterRec) {
                    console.log(`    Roster array size: ${rosterRec.arraySize || 0}`);
                    const rosterFields = Object.keys(rosterRec).filter(k => !k.startsWith('_'));
                    console.log(`    Roster fields: ${rosterFields.slice(0, 10).join(', ')}`);
                  }
                }
              }
            } catch (e) {
              // Skip
            }
          }
        }
      }
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('INVESTIGATION COMPLETE');
  console.log('='.repeat(80));
}

investigateTeamTable().catch(console.error);
