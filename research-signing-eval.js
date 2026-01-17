// RESEARCH: PlayerSigningEval and transaction-related tables
// These might control what the game thinks is a valid FA
// NO CODING - RESEARCH ONLY

async function analyzeSigningTables() {
  const filePath = 'C:\\Users\\tshan\\Documents\\Madden NFL 26\\Saves\\CAREER-Testing';

  console.log('='.repeat(80));
  console.log('SIGNING/EVAL TABLES RESEARCH');
  console.log('='.repeat(80));

  const FranchiseModule = await import('madden-franchise');
  const franchise = await FranchiseModule.create(filePath);

  // Look for PlayerSigningEval
  const signingEval = franchise.tables.find(t => t.name === 'PlayerSigningEval');
  if (signingEval) {
    await signingEval.readRecords();
    console.log('\n' + '-'.repeat(80));
    console.log('PLAYER SIGNING EVAL:');
    console.log('-'.repeat(80));
    console.log(`Records: ${signingEval.records.filter(r => !r.isEmpty).length} non-empty`);

    const rec = signingEval.records.find(r => !r.isEmpty);
    if (rec) {
      const fields = Object.keys(rec).filter(k => !k.startsWith('_'));
      console.log(`Fields: ${fields.join(', ')}`);

      // Check for player array references
      if (typeof rec.getReferenceDataByKey === 'function') {
        for (const field of fields) {
          const ref = rec.getReferenceDataByKey(field);
          if (ref && ref.tableId) {
            console.log(`  ${field} -> tableId=${ref.tableId}, row=${ref.rowNumber}`);
          }
        }
      }
    }
  }

  // Look for any table with "Transaction" in the name
  console.log('\n' + '-'.repeat(80));
  console.log('TRANSACTION TABLES:');
  console.log('-'.repeat(80));

  const transactionTables = franchise.tables.filter(t =>
    t.name && t.name.includes('Transaction')
  );

  for (const table of transactionTables.slice(0, 20)) {
    try {
      await table.readRecords();
      const nonEmpty = table.records.filter(r => !r.isEmpty).length;
      console.log(`${table.name}: ${nonEmpty} non-empty`);
    } catch (e) {
      console.log(`${table.name}: Error`);
    }
  }

  // Check for PlayerReSignNegotiation - this might need to be set up for FA visibility
  console.log('\n' + '-'.repeat(80));
  console.log('PLAYER RESIGN NEGOTIATION:');
  console.log('-'.repeat(80));

  const resignTable = franchise.tables.find(t => t.name === 'PlayerReSignNegotiation');
  if (resignTable) {
    await resignTable.readRecords();
    const nonEmpty = resignTable.records.filter(r => !r.isEmpty).length;
    console.log(`Records: ${nonEmpty} non-empty (out of ${resignTable.records.length})`);

    if (nonEmpty > 0) {
      const rec = resignTable.records.find(r => !r.isEmpty);
      if (rec) {
        const fields = Object.keys(rec).filter(k => !k.startsWith('_'));
        console.log(`Fields: ${fields.join(', ')}`);
      }
    }
  }

  // Check ContractOffer tables
  console.log('\n' + '-'.repeat(80));
  console.log('CONTRACT OFFER TABLES:');
  console.log('-'.repeat(80));

  const contractOfferTables = franchise.tables.filter(t =>
    t.name && t.name.includes('ContractOffer')
  );

  for (const table of contractOfferTables) {
    try {
      await table.readRecords();
      const nonEmpty = table.records.filter(r => !r.isEmpty).length;
      console.log(`${table.name}: ${nonEmpty} non-empty`);
    } catch (e) {
      console.log(`${table.name}: Error`);
    }
  }

  // Look for PlayerAcquisitionEvaluation - this has many records
  console.log('\n' + '-'.repeat(80));
  console.log('PLAYER ACQUISITION EVALUATION:');
  console.log('-'.repeat(80));

  const paeTable = franchise.tables.find(t => t.name === 'PlayerAcquisitionEvaluation');
  if (paeTable) {
    await paeTable.readRecords();
    const nonEmpty = paeTable.records.filter(r => !r.isEmpty).length;
    console.log(`Records: ${nonEmpty} non-empty (out of ${paeTable.records.length})`);

    const rec = paeTable.records.find(r => !r.isEmpty);
    if (rec) {
      const fields = Object.keys(rec).filter(k => !k.startsWith('_'));
      console.log(`Fields: ${fields.join(', ')}`);

      // Show sample data
      for (const f of fields.slice(0, 15)) {
        console.log(`  ${f}: ${rec[f]}`);
      }
    }
  }

  // Get the Player table to compare FA player indices with PAE entries
  const playerTable = franchise.tables.find(t => t.name === 'Player');
  await playerTable.readRecords();

  // Find Shaq Mason (visible FA) and Bryce Young
  const shaq = playerTable.records.find(r =>
    !r.isEmpty && r.FirstName === 'Shaq' && r.LastName === 'Mason'
  );
  const bryce = playerTable.records.find(r =>
    !r.isEmpty && r.FirstName === 'Bryce' && r.LastName === 'Young'
  );

  if (paeTable && shaq) {
    console.log('\n' + '-'.repeat(80));
    console.log('CHECKING IF SHAQ MASON HAS PAE ENTRIES:');
    console.log('-'.repeat(80));
    console.log(`Shaq Mason player index: ${shaq.index}`);

    // Check if any PAE record references Shaq
    let foundShaq = false;
    for (const rec of paeTable.records) {
      if (rec.isEmpty) continue;

      // Check if the record has a player reference
      if (typeof rec.getReferenceDataByKey === 'function') {
        const playerRef = rec.getReferenceDataByKey('Player');
        if (playerRef && playerRef.rowNumber === shaq.index) {
          console.log(`Found PAE entry for Shaq at record ${rec.index}`);
          foundShaq = true;
          break;
        }
      }
    }

    if (!foundShaq) {
      console.log('No direct PAE entry found for Shaq');
    }
  }

  // Check SeasonWeek and other state tables
  console.log('\n' + '-'.repeat(80));
  console.log('SEASON/WEEK STATE TABLES:');
  console.log('-'.repeat(80));

  const stateTables = [
    'SeasonInfo',
    'SeasonWeek',
    'FranchiseInfo',
    'CareerInfo',
    'LeagueInfo'
  ];

  for (const name of stateTables) {
    const table = franchise.tables.find(t => t.name === name);
    if (table) {
      try {
        await table.readRecords();
        const nonEmpty = table.records.filter(r => !r.isEmpty).length;
        console.log(`\n${name}: ${nonEmpty} non-empty`);

        const rec = table.records.find(r => !r.isEmpty);
        if (rec) {
          const fields = Object.keys(rec).filter(k => !k.startsWith('_'));
          console.log(`  Fields: ${fields.join(', ')}`);

          // Show all values
          for (const f of fields.slice(0, 10)) {
            console.log(`    ${f}: ${rec[f]}`);
          }
        }
      } catch (e) {
        console.log(`${name}: Error - ${e.message}`);
      }
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('RESEARCH COMPLETE');
  console.log('='.repeat(80));
}

analyzeSigningTables().catch(console.error);
