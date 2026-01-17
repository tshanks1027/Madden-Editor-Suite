// RESEARCH: Find the correct Player table
// NO CODING - RESEARCH ONLY

async function findPlayerTable() {
  const filePath = 'C:\\Users\\tshan\\Documents\\Madden NFL 26\\Saves\\CAREER-Testing';

  console.log('='.repeat(80));
  console.log('FINDING PLAYER TABLE');
  console.log('='.repeat(80));

  const FranchiseModule = await import('madden-franchise');
  const franchise = await FranchiseModule.create(filePath);

  // Try by name first
  console.log('\nSearching by name "Player"...');
  const tables = franchise.tables.filter(t => t.name === 'Player');
  console.log(`Found ${tables.length} tables named "Player"`);

  for (const table of tables) {
    try {
      await table.readRecords();
      const nonEmpty = table.records.filter(r => !r.isEmpty).length;
      console.log(`\n  Table index ${table.header?.tableIndex || 'N/A'}`);
      console.log(`  UniqueId: ${table.header?.uniqueId || 'N/A'}`);
      console.log(`  Records: ${table.records.length} (${nonEmpty} non-empty)`);

      // Check if it has player fields
      if (nonEmpty > 0) {
        const sample = table.records.find(r => !r.isEmpty);
        if (sample && sample.FirstName) {
          console.log(`  Sample: ${sample.FirstName} ${sample.LastName} (Team: ${sample.TeamIndex})`);

          // Get field count from header
          if (table.header && table.header.record2Fields) {
            console.log(`  Schema fields: ${table.header.record2Fields.length}`);
          }
        }
      }
    } catch (e) {
      console.log(`  Error: ${e.message}`);
    }
  }

  // Find by searching for tables with FirstName field
  console.log('\n' + '='.repeat(80));
  console.log('SEARCHING FOR TABLES WITH PLAYER DATA');
  console.log('='.repeat(80));

  for (let i = 0; i < Math.min(franchise.tables.length, 200); i++) {
    const table = franchise.tables[i];
    try {
      await table.readRecords();
      if (table.records.length > 100) {
        const sample = table.records.find(r => !r.isEmpty);
        if (sample && sample.FirstName !== undefined) {
          console.log(`\nTable ${i}: ${table.name || 'Unknown'}`);
          console.log(`  UniqueId: ${table.header?.uniqueId || 'N/A'}`);
          console.log(`  Records: ${table.records.length} (${table.records.filter(r => !r.isEmpty).length} non-empty)`);
          console.log(`  Sample: ${sample.FirstName} ${sample.LastName}`);

          // This is likely the Player table - get all fields
          if (table.header && table.header.record2Fields) {
            const fields = table.header.record2Fields;
            console.log(`  Total fields: ${fields.length}`);
            console.log(`  First 50 fields: ${fields.slice(0, 50).map(f => f.name).join(', ')}`);
          }

          // Check for specific players
          const bryce = table.records.find(r => r.FirstName === 'Bryce' && r.LastName === 'Young');
          const shaq = table.records.find(r => r.FirstName === 'Shaq' && r.LastName === 'Mason');

          if (bryce) {
            console.log(`\n  BRYCE YOUNG:`);
            console.log(`    TeamIndex: ${bryce.TeamIndex}`);
            console.log(`    ContractStatus: ${bryce.ContractStatus}`);
            console.log(`    ContractLength: ${bryce.ContractLength}`);
            console.log(`    ContractYear: ${bryce.ContractYear}`);
            console.log(`    YearsPro: ${bryce.YearsPro}`);

            // PLYR_ fields
            const plyrFields = Object.keys(bryce).filter(k => k.startsWith('PLYR_'));
            for (const pf of plyrFields.slice(0, 20)) {
              console.log(`    ${pf}: ${bryce[pf]}`);
            }
          }

          if (shaq) {
            console.log(`\n  SHAQ MASON:`);
            console.log(`    TeamIndex: ${shaq.TeamIndex}`);
            console.log(`    ContractStatus: ${shaq.ContractStatus}`);
            console.log(`    ContractLength: ${shaq.ContractLength}`);
            console.log(`    ContractYear: ${shaq.ContractYear}`);
            console.log(`    YearsPro: ${shaq.YearsPro}`);

            // PLYR_ fields
            const plyrFields = Object.keys(shaq).filter(k => k.startsWith('PLYR_'));
            for (const pf of plyrFields.slice(0, 20)) {
              console.log(`    ${pf}: ${shaq[pf]}`);
            }
          }
        }
      }
    } catch (e) {
      // Skip
    }
  }
}

findPlayerTable().catch(console.error);
