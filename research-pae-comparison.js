// RESEARCH: Compare PlayerAcquisitionEvaluation entries for visible vs invisible FA
// This table might be the key to FA visibility
// NO CODING - RESEARCH ONLY

async function comparePAE() {
  const filePath = 'C:\\Users\\tshan\\Documents\\Madden NFL 26\\Saves\\CAREER-Testing';

  console.log('='.repeat(80));
  console.log('PLAYER ACQUISITION EVALUATION (PAE) COMPARISON');
  console.log('='.repeat(80));

  const FranchiseModule = await import('madden-franchise');
  const franchise = await FranchiseModule.create(filePath);

  // Get Player table
  const playerTable = franchise.tables.find(t => t.name === 'Player');
  await playerTable.readRecords();

  // Get PAE table
  const paeTable = franchise.tables.find(t => t.name === 'PlayerAcquisitionEvaluation');
  await paeTable.readRecords();

  console.log(`\nPAE table records: ${paeTable.records.length}`);
  console.log(`Non-empty PAE: ${paeTable.records.filter(r => !r.isEmpty).length}`);

  // Get PAE table by unique ID to access all records properly
  const paeTableById = franchise.getTableByUniqueId(2531183555);
  if (paeTableById) {
    await paeTableById.readRecords();

    // Get field names from header
    const paeFields = [];
    if (paeTableById.header && paeTableById.header.record2Fields) {
      for (const field of paeTableById.header.record2Fields) {
        paeFields.push(field.name);
      }
    }

    console.log(`\nPAE fields (${paeFields.length}): ${paeFields.join(', ')}`);
  }

  // Target players
  const targets = [
    { name: 'Shaq Mason', expected: 'visible FA' },
    { name: 'Stephon Gilmore', expected: 'visible FA' },
    { name: 'Bryce Young', expected: 'team 20, should be moved to FA' },
    { name: 'Trevor Lawrence', expected: 'team 16, should be moved to FA' },
    { name: 'Patrick Mahomes', expected: 'team 8, signed' }
  ];

  console.log('\n' + '-'.repeat(80));
  console.log('SEARCHING FOR PLAYER PAE ENTRIES:');
  console.log('-'.repeat(80));

  for (const target of targets) {
    const [firstName, lastName] = target.name.split(' ');
    const player = playerTable.records.find(r =>
      !r.isEmpty && r.FirstName === firstName && r.LastName === lastName
    );

    if (!player) {
      console.log(`\n${target.name}: NOT FOUND IN PLAYER TABLE`);
      continue;
    }

    console.log(`\n${target.name} (${target.expected}):`);
    console.log(`  Player index: ${player.index}`);
    console.log(`  TeamIndex: ${player.TeamIndex}`);
    console.log(`  ContractStatus: ${player.ContractStatus}`);

    // Search for PAE entry
    let foundPAE = false;
    for (const rec of paeTable.records) {
      if (rec.isEmpty) continue;

      // Check if this PAE record references this player
      if (typeof rec.getReferenceDataByKey === 'function') {
        const playerRef = rec.getReferenceDataByKey('Player');
        if (playerRef && playerRef.rowNumber === player.index) {
          console.log(`  PAE record index: ${rec.index}`);
          foundPAE = true;

          // Print all PAE fields for this record
          const fields = Object.keys(rec).filter(k => !k.startsWith('_'));
          console.log(`  PAE fields: ${fields.join(', ')}`);

          for (const f of fields) {
            if (f !== 'isEmpty' && f !== 'index' && f !== 'arraySize') {
              console.log(`    ${f}: ${rec[f]}`);
            }
          }
          break;
        }
      }
    }

    if (!foundPAE) {
      console.log(`  NO PAE ENTRY FOUND`);
    }
  }

  // Now let's also look at the PlayerAcquisitionEvaluation[][] table
  console.log('\n' + '='.repeat(80));
  console.log('PAE ARRAY TABLES:');
  console.log('='.repeat(80));

  const paeArrayTables = franchise.tables.filter(t =>
    t.name && t.name.includes('PlayerAcquisitionEvaluation')
  );

  for (const table of paeArrayTables) {
    try {
      await table.readRecords();
      const nonEmpty = table.records.filter(r => !r.isEmpty).length;
      console.log(`\n${table.name}: ${nonEmpty} non-empty (out of ${table.records.length})`);
    } catch (e) {
      console.log(`${table.name}: Error`);
    }
  }

  // Let's also check how many FA players (TeamIndex=32) have PAE entries
  console.log('\n' + '='.repeat(80));
  console.log('FA PLAYERS WITH PAE ENTRIES:');
  console.log('='.repeat(80));

  const faPlayers = playerTable.records.filter(r =>
    !r.isEmpty && Number(r.TeamIndex) === 32
  );

  console.log(`\nTotal FA players (TeamIndex=32): ${faPlayers.length}`);

  // Count how many have PAE entries
  let faWithPAE = 0;
  let faWithoutPAE = 0;

  const paePlayerIndices = new Set();
  for (const rec of paeTable.records) {
    if (rec.isEmpty) continue;
    if (typeof rec.getReferenceDataByKey === 'function') {
      const playerRef = rec.getReferenceDataByKey('Player');
      if (playerRef) {
        paePlayerIndices.add(playerRef.rowNumber);
      }
    }
  }

  for (const faPlayer of faPlayers) {
    if (paePlayerIndices.has(faPlayer.index)) {
      faWithPAE++;
    } else {
      faWithoutPAE++;
    }
  }

  console.log(`FA players WITH PAE entry: ${faWithPAE}`);
  console.log(`FA players WITHOUT PAE entry: ${faWithoutPAE}`);

  // Show first 10 FA players without PAE entries
  if (faWithoutPAE > 0) {
    console.log('\nFirst 10 FA players WITHOUT PAE entry:');
    let count = 0;
    for (const faPlayer of faPlayers) {
      if (!paePlayerIndices.has(faPlayer.index)) {
        console.log(`  ${faPlayer.FirstName} ${faPlayer.LastName} (index ${faPlayer.index})`);
        count++;
        if (count >= 10) break;
      }
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('RESEARCH COMPLETE');
  console.log('='.repeat(80));
}

comparePAE().catch(console.error);
