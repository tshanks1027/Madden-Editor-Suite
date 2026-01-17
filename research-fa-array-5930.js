// RESEARCH: Investigate Player[] table 5930 - appears to be the FA list!
// arraySize=1117 exactly matches the number of Free Agents
// NO CODING - RESEARCH ONLY

async function investigateFAArray() {
  const FranchiseModule = await import('madden-franchise');
  const filePath = 'C:\\Users\\tshan\\Documents\\Madden NFL 26\\Saves\\CAREER-Testing';

  console.log('='.repeat(80));
  console.log('INVESTIGATING PLAYER[] TABLE 5930 - POTENTIAL FA LIST');
  console.log('='.repeat(80));

  const franchise = await FranchiseModule.create(filePath);

  // Get Player table for reference
  const playerTable = franchise.tables.find(t => t.name === 'Player');
  await playerTable.readRecords();

  // Get the Player[] table (id=5930)
  const faArrayTable = franchise.getTableById(5930);
  if (!faArrayTable) {
    console.log('ERROR: Could not find table 5930');
    return;
  }

  await faArrayTable.readRecords();
  console.log(`\nTable name: ${faArrayTable.name}`);
  console.log(`Records: ${faArrayTable.records.length}`);

  const faArray = faArrayTable.records[0];
  if (!faArray) {
    console.log('ERROR: No record at row 0');
    return;
  }

  console.log(`\nFA Array record:`);
  console.log(`  arraySize: ${faArray.arraySize}`);
  console.log(`  isEmpty: ${faArray.isEmpty}`);

  // Get all fields
  const fields = Object.keys(faArray).filter(k => !k.startsWith('_'));
  console.log(`  Fields: ${fields.join(', ')}`);

  // Count FA players in Player table for comparison
  const faPlayers = playerTable.records.filter(p =>
    !p.isEmpty &&
    Number(p.TeamIndex) === 32 &&
    p.ContractStatus === 'FreeAgent'
  );
  console.log(`\nFA players in Player table: ${faPlayers.length}`);
  console.log(`FA array size: ${faArray.arraySize}`);

  if (faArray.arraySize !== faPlayers.length) {
    console.log(`\n*** MISMATCH! Array size doesn't match FA player count! ***`);
  } else {
    console.log(`\n*** MATCH! Array size equals FA player count! ***`);
  }

  // Now check which players are in this array
  console.log('\n' + '-'.repeat(80));
  console.log('PLAYERS IN FA ARRAY:');
  console.log('-'.repeat(80));

  const playersInArray = [];
  const notFoundInArray = [];

  // Get first 20 players in the array
  console.log('\nFirst 20 players in FA array:');
  for (let i = 0; i < Math.min(20, faArray.arraySize); i++) {
    try {
      const playerRef = faArray.getReferenceDataByKey(`Player${i}`);
      if (playerRef && playerRef.rowNumber !== undefined) {
        const player = playerTable.records[playerRef.rowNumber];
        if (player && !player.isEmpty) {
          console.log(`  Player${i}: ${player.FirstName} ${player.LastName} (TeamIndex=${player.TeamIndex}, Status=${player.ContractStatus})`);
          playersInArray.push(player.index);
        }
      }
    } catch (e) {
      console.log(`  Player${i}: ERROR - ${e.message}`);
    }
  }

  // Check if Shaq Mason is in this array
  console.log('\n' + '-'.repeat(80));
  console.log('CHECKING IF SPECIFIC PLAYERS ARE IN FA ARRAY:');
  console.log('-'.repeat(80));

  const shaqMason = playerTable.records.find(p =>
    !p.isEmpty && p.FirstName === 'Shaq' && p.LastName === 'Mason'
  );

  if (shaqMason) {
    // Search for Shaq Mason in the array
    let foundShaq = false;
    for (let i = 0; i < faArray.arraySize; i++) {
      try {
        const playerRef = faArray.getReferenceDataByKey(`Player${i}`);
        if (playerRef && playerRef.rowNumber === shaqMason.index) {
          console.log(`\nShaq Mason (index ${shaqMason.index}): FOUND at position ${i} in FA array`);
          foundShaq = true;
          break;
        }
      } catch (e) {
        // Skip
      }
    }
    if (!foundShaq) {
      console.log(`\nShaq Mason (index ${shaqMason.index}): NOT FOUND in FA array`);
    }
  }

  // Let's get ALL players in the FA array and their indices
  console.log('\n' + '-'.repeat(80));
  console.log('BUILDING COMPLETE FA ARRAY INDEX LIST:');
  console.log('-'.repeat(80));

  const faArrayPlayerIndices = new Set();
  for (let i = 0; i < faArray.arraySize; i++) {
    try {
      const playerRef = faArray.getReferenceDataByKey(`Player${i}`);
      if (playerRef && playerRef.rowNumber !== undefined) {
        faArrayPlayerIndices.add(playerRef.rowNumber);
      }
    } catch (e) {
      // Skip
    }
  }

  console.log(`Players in FA array: ${faArrayPlayerIndices.size}`);

  // Check how many FA players are NOT in the array
  const faPlayerIndices = new Set(faPlayers.map(p => p.index));
  const inArrayButNotFA = [...faArrayPlayerIndices].filter(i => !faPlayerIndices.has(i));
  const inFAButNotArray = [...faPlayerIndices].filter(i => !faArrayPlayerIndices.has(i));

  console.log(`\nFA players (from Player table): ${faPlayerIndices.size}`);
  console.log(`Players in array but not marked as FA: ${inArrayButNotFA.length}`);
  console.log(`FA players not in array: ${inFAButNotArray.length}`);

  if (inFAButNotArray.length > 0) {
    console.log(`\n*** POTENTIAL PROBLEM: ${inFAButNotArray.length} FA players are NOT in the FA array! ***`);
    console.log('First 10 missing from array:');
    for (const idx of inFAButNotArray.slice(0, 10)) {
      const player = playerTable.records[idx];
      if (player) {
        console.log(`  ${player.FirstName} ${player.LastName} (index ${idx})`);
      }
    }
  }

  if (inArrayButNotFA.length > 0) {
    console.log(`\nPlayers in array but with different status:`);
    for (const idx of inArrayButNotFA.slice(0, 10)) {
      const player = playerTable.records[idx];
      if (player) {
        console.log(`  ${player.FirstName} ${player.LastName}: TeamIndex=${player.TeamIndex}, Status=${player.ContractStatus}`);
      }
    }
  }

  // Now let's find what table REFERENCES this FA array
  console.log('\n' + '='.repeat(80));
  console.log('FINDING WHAT REFERENCES FA ARRAY TABLE 5930:');
  console.log('='.repeat(80));

  // Check FranchiseUser or similar manager tables
  const managerTables = franchise.tables.filter(t =>
    t.name && (
      t.name.includes('Manager') ||
      t.name.includes('Eval') ||
      t.name === 'FranchiseUser'
    )
  );

  let foundReference = false;
  for (const table of managerTables) {
    try {
      await table.readRecords();
      const rec = table.records.find(r => !r.isEmpty);
      if (!rec) continue;

      const fields = Object.keys(rec).filter(k => !k.startsWith('_'));

      for (const field of fields) {
        try {
          const ref = rec.getReferenceDataByKey ? rec.getReferenceDataByKey(field) : null;
          if (ref && ref.tableId === 5930) {
            console.log(`\nFOUND! ${table.name}.${field} references table 5930`);
            foundReference = true;
          }
        } catch (e) {
          // Skip
        }
      }
    } catch (e) {
      // Skip
    }
  }

  if (!foundReference) {
    // Search ALL tables for reference to 5930
    console.log('\nSearching ALL tables for reference to 5930...');
    for (const table of franchise.tables) {
      if (!table.name) continue;

      try {
        await table.readRecords();
        const rec = table.records.find(r => !r.isEmpty);
        if (!rec) continue;

        const fields = Object.keys(rec).filter(k => !k.startsWith('_'));

        for (const field of fields) {
          try {
            const ref = rec.getReferenceDataByKey ? rec.getReferenceDataByKey(field) : null;
            if (ref && ref.tableId === 5930) {
              console.log(`FOUND! ${table.name}.${field} references table 5930 (row=${ref.rowNumber})`);
              foundReference = true;
            }
          } catch (e) {
            // Skip
          }
        }
      } catch (e) {
        // Skip
      }
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('INVESTIGATION COMPLETE');
  console.log('='.repeat(80));
}

investigateFAArray().catch(console.error);
