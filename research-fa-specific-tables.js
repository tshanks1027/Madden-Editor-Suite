// RESEARCH: Find dedicated Free Agent tables/lists
// The FA team doesn't use a roster array - there must be another mechanism
// NO CODING - RESEARCH ONLY

async function investigateFATables() {
  const FranchiseModule = await import('madden-franchise');
  const filePath = 'C:\\Users\\tshan\\Documents\\Madden NFL 26\\Saves\\CAREER-Testing';

  console.log('='.repeat(80));
  console.log('FREE AGENT SPECIFIC TABLES INVESTIGATION');
  console.log('='.repeat(80));

  const franchise = await FranchiseModule.create(filePath);

  // Get Player table for reference
  const playerTable = franchise.tables.find(t => t.name === 'Player');
  await playerTable.readRecords();

  // Find ALL tables with "Free" or "FA" in the name
  console.log('\n--- Tables with "Free" or "FA" in name ---');

  const faTables = franchise.tables.filter(t =>
    t.name && (
      t.name.toLowerCase().includes('free') ||
      t.name.toLowerCase().includes('freeagent') ||
      /\bfa\b/i.test(t.name)
    )
  );

  console.log(`Found ${faTables.length} FA-related tables\n`);

  for (const table of faTables) {
    try {
      await table.readRecords();
      const nonEmpty = table.records.filter(r => !r.isEmpty).length;
      console.log(`\n${table.name} (id=${table.header?.tableId})`);
      console.log(`  Records: ${table.records.length}, Non-empty: ${nonEmpty}`);

      if (nonEmpty > 0) {
        const rec = table.records.find(r => !r.isEmpty);
        const fields = Object.keys(rec).filter(k => !k.startsWith('_'));
        console.log(`  Fields: ${fields.join(', ')}`);

        // If there's arraySize, show it
        if (rec.arraySize !== undefined && rec.arraySize !== null) {
          console.log(`  Array size: ${rec.arraySize}`);
        }

        // Show first few field values
        for (const f of fields.slice(0, 10)) {
          if (f === 'index' || f === 'arraySize' || f === 'isEmpty') continue;
          try {
            const val = rec[f];
            console.log(`    ${f}: ${val}`);
          } catch (e) {
            // Skip
          }
        }
      }
    } catch (e) {
      console.log(`  Error: ${e.message}`);
    }
  }

  // Look for PlayerAcquisitionEvaluation tables - these track signable players
  console.log('\n' + '='.repeat(80));
  console.log('PLAYER ACQUISITION EVALUATION TABLES:');
  console.log('='.repeat(80));

  const paeTables = franchise.tables.filter(t =>
    t.name && t.name.includes('PlayerAcquisition')
  );

  console.log(`Found ${paeTables.length} PAE tables`);

  for (const table of paeTables.slice(0, 5)) {
    try {
      await table.readRecords();
      const nonEmpty = table.records.filter(r => !r.isEmpty).length;
      console.log(`\n${table.name}: ${nonEmpty} non-empty`);

      if (nonEmpty > 0) {
        const rec = table.records.find(r => !r.isEmpty);
        const fields = Object.keys(rec).filter(k => !k.startsWith('_'));
        console.log(`  Fields: ${fields.join(', ')}`);
      }
    } catch (e) {
      console.log(`  Error: ${e.message}`);
    }
  }

  // Look for Signing/Sign tables
  console.log('\n' + '='.repeat(80));
  console.log('SIGNING-RELATED TABLES:');
  console.log('='.repeat(80));

  const signTables = franchise.tables.filter(t =>
    t.name && (
      t.name.toLowerCase().includes('sign') ||
      t.name.toLowerCase().includes('offer') ||
      t.name.toLowerCase().includes('contract')
    )
  );

  console.log(`Found ${signTables.length} signing-related tables`);

  // Show ones with actual data
  const signWithData = [];
  for (const table of signTables) {
    try {
      await table.readRecords();
      const nonEmpty = table.records.filter(r => !r.isEmpty).length;
      if (nonEmpty > 0) {
        signWithData.push({ table, nonEmpty });
      }
    } catch (e) {
      // Skip
    }
  }

  console.log(`\nTables with data: ${signWithData.length}`);
  for (const { table, nonEmpty } of signWithData.slice(0, 15)) {
    console.log(`  ${table.name} (id=${table.header?.tableId}): ${nonEmpty} records`);
  }

  // Look for tables that might contain "available" or "pool" of players
  console.log('\n' + '='.repeat(80));
  console.log('PLAYER POOL / AVAILABLE TABLES:');
  console.log('='.repeat(80));

  const poolTables = franchise.tables.filter(t =>
    t.name && (
      t.name.toLowerCase().includes('pool') ||
      t.name.toLowerCase().includes('available') ||
      t.name.toLowerCase().includes('market')
    )
  );

  console.log(`Found ${poolTables.length} pool-related tables`);

  for (const table of poolTables) {
    try {
      await table.readRecords();
      const nonEmpty = table.records.filter(r => !r.isEmpty).length;
      console.log(`\n${table.name}: ${nonEmpty}/${table.records.length} records`);

      if (nonEmpty > 0) {
        const rec = table.records.find(r => !r.isEmpty);
        const fields = Object.keys(rec).filter(k => !k.startsWith('_'));
        console.log(`  Fields: ${fields.join(', ')}`);
      }
    } catch (e) {
      console.log(`  Error: ${e.message}`);
    }
  }

  // Look for tables with "Player" arrays specifically
  console.log('\n' + '='.repeat(80));
  console.log('TABLES WITH PLAYER ARRAYS (Player[]):');
  console.log('='.repeat(80));

  const playerArrayTables = franchise.tables.filter(t =>
    t.name && t.name === 'Player[]'
  );

  console.log(`Found ${playerArrayTables.length} Player[] tables`);

  for (const table of playerArrayTables) {
    try {
      await table.readRecords();
      const withSize = table.records.filter(r => !r.isEmpty && r.arraySize > 0);
      console.log(`\nPlayer[] (id=${table.header?.tableId}): ${withSize.length} arrays with data`);

      // Show sizes
      for (const rec of withSize.slice(0, 10)) {
        console.log(`  Row ${rec.index}: arraySize=${rec.arraySize}`);
      }
    } catch (e) {
      console.log(`  Error: ${e.message}`);
    }
  }

  // Critical: Look for tables that might track "active" FA status
  console.log('\n' + '='.repeat(80));
  console.log('LOOKING FOR FA ACTIVE/STATUS TRACKING:');
  console.log('='.repeat(80));

  // Search for tables with both "status" and player references
  const statusTables = franchise.tables.filter(t =>
    t.name && (
      t.name.toLowerCase().includes('status') ||
      t.name.toLowerCase().includes('state') ||
      t.name.toLowerCase().includes('active')
    )
  );

  console.log(`Found ${statusTables.length} status/state tables`);

  let foundPlayerStatusTables = [];
  for (const table of statusTables) {
    try {
      await table.readRecords();
      const nonEmpty = table.records.filter(r => !r.isEmpty).length;
      if (nonEmpty > 0) {
        const rec = table.records.find(r => !r.isEmpty);
        const fields = Object.keys(rec).filter(k => !k.startsWith('_'));
        const hasPlayerRef = fields.some(f => f.toLowerCase().includes('player'));
        if (hasPlayerRef) {
          foundPlayerStatusTables.push({
            name: table.name,
            tableId: table.header?.tableId,
            nonEmpty,
            fields
          });
        }
      }
    } catch (e) {
      // Skip
    }
  }

  console.log(`\nTables with player references: ${foundPlayerStatusTables.length}`);
  for (const t of foundPlayerStatusTables) {
    console.log(`  ${t.name}: ${t.nonEmpty} records`);
    const playerFields = t.fields.filter(f => f.toLowerCase().includes('player'));
    console.log(`    Player fields: ${playerFields.join(', ')}`);
  }

  // Check if Shaq Mason (visible FA) vs a player we moved to FA are different
  console.log('\n' + '='.repeat(80));
  console.log('COMPARING VISIBLE FA vs MOVED-TO-FA PLAYERS:');
  console.log('='.repeat(80));

  // Find Shaq Mason (known visible FA)
  const shaqMason = playerTable.records.find(p =>
    !p.isEmpty && p.FirstName === 'Shaq' && p.LastName === 'Mason'
  );

  // Find any player we might have moved to FA (look for high-profile players with TeamIndex=32)
  // Actually, let's just compare a few FAs and see if we can find any differences
  const freeAgents = playerTable.records.filter(p =>
    !p.isEmpty && p.ContractStatus === 'FreeAgent' && Number(p.TeamIndex) === 32
  );

  console.log(`\nTotal Free Agents: ${freeAgents.length}`);

  if (shaqMason) {
    console.log(`\nShaq Mason (known visible FA):`);
    console.log(`  Index: ${shaqMason.index}`);
    console.log(`  TeamIndex: ${shaqMason.TeamIndex}`);
    console.log(`  ContractStatus: ${shaqMason.ContractStatus}`);
    console.log(`  ContractLength: ${shaqMason.ContractLength}`);

    // Get all field values to compare
    const allFields = Object.keys(shaqMason).filter(k => !k.startsWith('_'));

    // Find fields that might be different
    const interestingFields = allFields.filter(f =>
      f.toLowerCase().includes('active') ||
      f.toLowerCase().includes('flag') ||
      f.toLowerCase().includes('visible') ||
      f.toLowerCase().includes('market') ||
      f.toLowerCase().includes('available') ||
      f.toLowerCase().includes('list')
    );

    if (interestingFields.length > 0) {
      console.log(`\nInteresting fields:`);
      for (const f of interestingFields) {
        console.log(`  ${f}: ${shaqMason[f]}`);
      }
    }
  }

  // Check for any "dirty" or "modified" flags in the file
  console.log('\n' + '='.repeat(80));
  console.log('FRANCHISE FILE METADATA:');
  console.log('='.repeat(80));

  // Look for FranchiseUser or similar tables that might track state
  const metaTables = franchise.tables.filter(t =>
    t.name && (
      t.name.toLowerCase().includes('franchiseuser') ||
      t.name.toLowerCase().includes('metadata') ||
      t.name.toLowerCase().includes('gamestate')
    )
  );

  console.log(`Found ${metaTables.length} metadata tables`);

  for (const table of metaTables.slice(0, 5)) {
    try {
      await table.readRecords();
      const nonEmpty = table.records.filter(r => !r.isEmpty).length;
      console.log(`\n${table.name}: ${nonEmpty} records`);

      if (nonEmpty > 0) {
        const rec = table.records.find(r => !r.isEmpty);
        const fields = Object.keys(rec).filter(k => !k.startsWith('_'));
        console.log(`  Fields: ${fields.slice(0, 15).join(', ')}`);
      }
    } catch (e) {
      console.log(`  Error: ${e.message}`);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('INVESTIGATION COMPLETE');
  console.log('='.repeat(80));
}

investigateFATables().catch(console.error);
