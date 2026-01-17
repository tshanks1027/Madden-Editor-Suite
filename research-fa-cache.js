// RESEARCH: Look for FA caches, dirty flags, or player indices
// NO CODING - RESEARCH ONLY

async function analyzeFACache() {
  const filePath = 'C:\\Users\\tshan\\Documents\\Madden NFL 26\\Saves\\CAREER-Testing';

  console.log('='.repeat(80));
  console.log('FA CACHE AND STATE RESEARCH');
  console.log('='.repeat(80));

  const FranchiseModule = await import('madden-franchise');
  const franchise = await FranchiseModule.create(filePath);

  // Get Player table
  const playerTable = franchise.tables.find(t => t.name === 'Player');
  await playerTable.readRecords();

  console.log(`\nPlayer table records: ${playerTable.records.length}`);
  console.log(`Non-empty: ${playerTable.records.filter(r => !r.isEmpty).length}`);

  // Look for any "DIRTY" or "MODIFIED" or "FLAG" or "CACHE" fields in Player table
  const samplePlayer = playerTable.records.find(r => !r.isEmpty);
  if (samplePlayer) {
    const allFields = Object.keys(samplePlayer).filter(k => !k.startsWith('_'));

    console.log('\n' + '-'.repeat(80));
    console.log('LOOKING FOR STATE/FLAG FIELDS IN PLAYER TABLE:');
    console.log('-'.repeat(80));

    const stateFields = allFields.filter(f => {
      const fl = f.toLowerCase();
      return fl.includes('dirty') ||
        fl.includes('flag') ||
        fl.includes('state') ||
        fl.includes('cache') ||
        fl.includes('modified') ||
        fl.includes('updated') ||
        fl.includes('changed') ||
        fl.includes('valid') ||
        fl.includes('active') ||
        fl.includes('visible') ||
        fl.includes('show') ||
        fl.includes('display') ||
        fl.includes('load') ||
        fl.includes('sync');
    });

    if (stateFields.length > 0) {
      console.log(`Found ${stateFields.length} potential state fields:`);
      for (const f of stateFields) {
        console.log(`  ${f}: ${samplePlayer[f]}`);
      }
    } else {
      console.log('No obvious state/flag fields found');
    }

    // Print ALL fields that have "boolean" type values (true/false)
    console.log('\n' + '-'.repeat(80));
    console.log('ALL BOOLEAN FIELDS:');
    console.log('-'.repeat(80));

    for (const f of allFields) {
      const val = samplePlayer[f];
      if (val === true || val === false) {
        console.log(`  ${f}: ${val}`);
      }
    }
  }

  // Look for tables that might cache FA player list
  console.log('\n' + '='.repeat(80));
  console.log('SEARCHING FOR FA INDEX/CACHE TABLES:');
  console.log('='.repeat(80));

  const cacheTableNames = [
    'FreeAgentList',
    'FreeAgentPool',
    'FreeAgentIndex',
    'AvailablePlayers',
    'PlayerIndex',
    'ReleasePool',
    'UnsignedPlayers',
    'AgentPool'
  ];

  for (const name of cacheTableNames) {
    const table = franchise.tables.find(t => t.name && t.name.toLowerCase().includes(name.toLowerCase()));
    if (table) {
      console.log(`\nFound table: ${table.name}`);
      await table.readRecords();
      console.log(`  Records: ${table.records.filter(r => !r.isEmpty).length} non-empty`);
    }
  }

  // Check tables with "Cache" or "Index" in name
  const potentialCacheTables = franchise.tables.filter(t =>
    t.name && (
      t.name.toLowerCase().includes('cache') ||
      t.name.toLowerCase().includes('index') ||
      t.name.toLowerCase().includes('pool') ||
      t.name.toLowerCase().includes('list') ||
      t.name.toLowerCase().includes('available')
    )
  );

  console.log(`\nTables with cache/index/pool/list in name: ${potentialCacheTables.length}`);
  for (const table of potentialCacheTables.slice(0, 20)) {
    console.log(`  ${table.name}`);
  }

  // Check if there's a specific "FranchiseServer" table that manages state
  console.log('\n' + '-'.repeat(80));
  console.log('FRANCHISE SERVER STATE TABLES:');
  console.log('-'.repeat(80));

  const serverTables = franchise.tables.filter(t =>
    t.name && t.name.includes('FranchiseServer')
  );

  for (const table of serverTables.slice(0, 10)) {
    try {
      await table.readRecords();
      const nonEmpty = table.records.filter(r => !r.isEmpty).length;
      if (nonEmpty > 0) {
        console.log(`\n${table.name}: ${nonEmpty} non-empty`);

        const rec = table.records.find(r => !r.isEmpty);
        if (rec) {
          const fields = Object.keys(rec).filter(k => !k.startsWith('_'));
          console.log(`  Fields: ${fields.join(', ')}`);
        }
      }
    } catch (e) {
      // Skip
    }
  }

  // Look at PlayerManager table if it exists
  console.log('\n' + '-'.repeat(80));
  console.log('MANAGER TABLES:');
  console.log('-'.repeat(80));

  const managerTables = franchise.tables.filter(t =>
    t.name && t.name.includes('Manager')
  );

  for (const table of managerTables.slice(0, 15)) {
    try {
      await table.readRecords();
      const nonEmpty = table.records.filter(r => !r.isEmpty).length;
      if (nonEmpty > 0) {
        console.log(`\n${table.name}: ${nonEmpty} non-empty`);

        const rec = table.records.find(r => !r.isEmpty);
        if (rec) {
          const fields = Object.keys(rec).filter(k => !k.startsWith('_'));

          // Show any reference fields
          if (typeof rec.getReferenceDataByKey === 'function') {
            for (const field of fields) {
              const ref = rec.getReferenceDataByKey(field);
              if (ref && ref.tableId) {
                console.log(`  ${field} -> tableId=${ref.tableId}`);
              }
            }
          }
        }
      }
    } catch (e) {
      // Skip
    }
  }

  // Check CharacterVisuals table - might affect visibility
  console.log('\n' + '-'.repeat(80));
  console.log('CHARACTER VISUALS TABLE:');
  console.log('-'.repeat(80));

  const visualsTable = franchise.tables.find(t => t.name === 'CharacterVisuals');
  if (visualsTable) {
    await visualsTable.readRecords();
    const nonEmpty = visualsTable.records.filter(r => !r.isEmpty).length;
    console.log(`Records: ${nonEmpty} non-empty`);

    // Check if there are visuals for FA players
    const faPlayers = playerTable.records.filter(r =>
      !r.isEmpty && Number(r.TeamIndex) === 32
    );

    console.log(`\nFA players count: ${faPlayers.length}`);

    // Sample: check if visible FA (Shaq Mason) has a visual entry
    const shaq = playerTable.records.find(r =>
      !r.isEmpty && r.FirstName === 'Shaq' && r.LastName === 'Mason'
    );

    if (shaq) {
      console.log(`\nShaq Mason (visible FA):`);
      console.log(`  Player record index: ${shaq.index}`);

      // Look for CharacterVisuals reference
      if (typeof shaq.getReferenceDataByKey === 'function') {
        const visualRef = shaq.getReferenceDataByKey('CharacterVisuals');
        console.log(`  CharacterVisuals ref: ${JSON.stringify(visualRef)}`);
      }

      // Check PLYR_ASSETNAME
      console.log(`  PLYR_ASSETNAME: ${shaq.PLYR_ASSETNAME}`);
    }

    // Compare with invisible FA (Bryce Young - in edited file this would be FA)
    const bryce = playerTable.records.find(r =>
      !r.isEmpty && r.FirstName === 'Bryce' && r.LastName === 'Young'
    );

    if (bryce) {
      console.log(`\nBryce Young:`);
      console.log(`  Player record index: ${bryce.index}`);
      console.log(`  TeamIndex: ${bryce.TeamIndex}`);
      console.log(`  ContractStatus: ${bryce.ContractStatus}`);

      if (typeof bryce.getReferenceDataByKey === 'function') {
        const visualRef = bryce.getReferenceDataByKey('CharacterVisuals');
        console.log(`  CharacterVisuals ref: ${JSON.stringify(visualRef)}`);
      }

      console.log(`  PLYR_ASSETNAME: ${bryce.PLYR_ASSETNAME}`);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('RESEARCH COMPLETE');
  console.log('='.repeat(80));
}

analyzeFACache().catch(console.error);
