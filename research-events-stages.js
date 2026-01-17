// RESEARCH: Look for event/stage/state mechanisms that might trigger FA list refresh
// NO CODING - RESEARCH ONLY

async function analyzeEventsStages() {
  const filePath = 'C:\\Users\\tshan\\Documents\\Madden NFL 26\\Saves\\CAREER-Testing';

  console.log('='.repeat(80));
  console.log('EVENTS AND STAGES RESEARCH');
  console.log('='.repeat(80));

  const FranchiseModule = await import('madden-franchise');
  const franchise = await FranchiseModule.create(filePath);

  // Look for Stage-related tables
  console.log('\n' + '-'.repeat(80));
  console.log('STAGE TABLES:');
  console.log('-'.repeat(80));

  const stageTables = franchise.tables.filter(t =>
    t.name && t.name.toLowerCase().includes('stage')
  );

  console.log(`Found ${stageTables.length} stage tables`);

  for (const table of stageTables.slice(0, 20)) {
    try {
      await table.readRecords();
      const nonEmpty = table.records.filter(r => !r.isEmpty).length;
      console.log(`${table.name}: ${nonEmpty} non-empty`);
    } catch (e) {
      console.log(`${table.name}: Error`);
    }
  }

  // Look for FreeAgency-related Event tables specifically
  console.log('\n' + '-'.repeat(80));
  console.log('FREE AGENCY EVENT/PERIOD TABLES:');
  console.log('-'.repeat(80));

  const faEventTables = franchise.tables.filter(t =>
    t.name && (
      t.name.includes('FreeAgency') ||
      t.name.includes('FreeAgent')
    )
  );

  for (const table of faEventTables) {
    try {
      await table.readRecords();
      const nonEmpty = table.records.filter(r => !r.isEmpty).length;

      console.log(`\n${table.name}: ${nonEmpty} non-empty`);

      if (nonEmpty > 0) {
        const rec = table.records.find(r => !r.isEmpty);
        if (rec) {
          const fields = Object.keys(rec).filter(k => !k.startsWith('_'));

          // Show all field values
          for (const f of fields) {
            if (f !== 'isEmpty') {
              console.log(`  ${f}: ${rec[f]}`);
            }
          }
        }
      }
    } catch (e) {
      console.log(`${table.name}: Error - ${e.message}`);
    }
  }

  // Look for "Scheduler" tables
  console.log('\n' + '-'.repeat(80));
  console.log('SCHEDULER TABLES:');
  console.log('-'.repeat(80));

  const schedulerTables = franchise.tables.filter(t =>
    t.name && t.name.includes('Scheduler')
  );

  for (const table of schedulerTables) {
    try {
      await table.readRecords();
      const nonEmpty = table.records.filter(r => !r.isEmpty).length;
      console.log(`${table.name}: ${nonEmpty} non-empty`);

      if (nonEmpty > 0 && nonEmpty < 10) {
        const rec = table.records.find(r => !r.isEmpty);
        if (rec) {
          const fields = Object.keys(rec).filter(k => !k.startsWith('_'));
          console.log(`  Fields: ${fields.join(', ')}`);
        }
      }
    } catch (e) {
      console.log(`${table.name}: Error`);
    }
  }

  // Look for "Period" tables that might define FA periods
  console.log('\n' + '-'.repeat(80));
  console.log('PERIOD TABLES:');
  console.log('-'.repeat(80));

  const periodTables = franchise.tables.filter(t =>
    t.name && t.name.toLowerCase().includes('period')
  );

  for (const table of periodTables) {
    try {
      await table.readRecords();
      const nonEmpty = table.records.filter(r => !r.isEmpty).length;
      console.log(`${table.name}: ${nonEmpty} non-empty`);
    } catch (e) {
      console.log(`${table.name}: Error`);
    }
  }

  // Look for any "Dirty" or "Invalidate" or "Refresh" related tables
  console.log('\n' + '-'.repeat(80));
  console.log('REFRESH/DIRTY/INVALIDATE TABLES:');
  console.log('-'.repeat(80));

  const refreshTables = franchise.tables.filter(t =>
    t.name && (
      t.name.toLowerCase().includes('dirty') ||
      t.name.toLowerCase().includes('invalid') ||
      t.name.toLowerCase().includes('refresh') ||
      t.name.toLowerCase().includes('rebuild') ||
      t.name.toLowerCase().includes('recalc')
    )
  );

  console.log(`Found ${refreshTables.length} refresh-related tables`);

  for (const table of refreshTables) {
    try {
      await table.readRecords();
      const nonEmpty = table.records.filter(r => !r.isEmpty).length;
      console.log(`${table.name}: ${nonEmpty} non-empty`);
    } catch (e) {
      console.log(`${table.name}: Error`);
    }
  }

  // Look at the "Flow" tables more carefully - these orchestrate game flow
  console.log('\n' + '-'.repeat(80));
  console.log('FLOW TABLES (ORCHESTRATION):');
  console.log('-'.repeat(80));

  const flowTables = franchise.tables.filter(t =>
    t.name && t.name.includes('Flow')
  );

  console.log(`Found ${flowTables.length} flow tables`);

  // Focus on FA-related flows
  const faFlows = flowTables.filter(t =>
    t.name.toLowerCase().includes('freeagent') ||
    t.name.toLowerCase().includes('signing') ||
    t.name.toLowerCase().includes('roster')
  );

  for (const table of faFlows) {
    try {
      await table.readRecords();
      const nonEmpty = table.records.filter(r => !r.isEmpty).length;

      console.log(`\n${table.name}: ${nonEmpty} non-empty`);

      if (nonEmpty > 0) {
        const rec = table.records.find(r => !r.isEmpty);
        if (rec) {
          const fields = Object.keys(rec).filter(k => !k.startsWith('_'));
          console.log(`  Fields: ${fields.join(', ')}`);
        }
      }
    } catch (e) {
      console.log(`${table.name}: Error - ${e.message}`);
    }
  }

  // Check CareerInfo or similar game state tables
  console.log('\n' + '-'.repeat(80));
  console.log('CAREER/GAME STATE TABLES:');
  console.log('-'.repeat(80));

  const stateTableNames = [
    'CareerInfo',
    'FranchiseUser',
    'UserInfo',
    'GameState',
    'CareerState',
    'SessionInfo'
  ];

  for (const name of stateTableNames) {
    const table = franchise.tables.find(t => t.name === name);
    if (table) {
      try {
        await table.readRecords();
        const nonEmpty = table.records.filter(r => !r.isEmpty).length;

        console.log(`\n${name}: ${nonEmpty} non-empty`);

        if (nonEmpty > 0) {
          const rec = table.records.find(r => !r.isEmpty);
          if (rec) {
            const fields = Object.keys(rec).filter(k => !k.startsWith('_'));
            console.log(`  Fields: ${fields.slice(0, 20).join(', ')}`);
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

analyzeEventsStages().catch(console.error);
