// COMPREHENSIVE RESEARCH: Dump ALL tables from franchise file
// NO CODING - RESEARCH ONLY

const fs = require('fs');

async function dumpAllTables() {
  const filePath = 'C:\\Users\\tshan\\Documents\\Madden NFL 26\\Saves\\CAREER-Testing';

  console.log('='.repeat(80));
  console.log('COMPREHENSIVE FRANCHISE FILE STRUCTURE RESEARCH');
  console.log('='.repeat(80));
  console.log(`File: ${filePath}\n`);

  const FranchiseModule = await import('madden-franchise');
  const franchise = await FranchiseModule.create(filePath);

  const output = {
    totalTables: franchise.tables.length,
    tablesWithData: 0,
    tablesByCategory: {
      player: [],
      team: [],
      roster: [],
      contract: [],
      salary: [],
      freeAgent: [],
      schedule: [],
      draft: [],
      coach: [],
      stadium: [],
      history: [],
      other: []
    },
    allTables: []
  };

  console.log(`Analyzing all ${franchise.tables.length} tables...\n`);

  for (let i = 0; i < franchise.tables.length; i++) {
    const table = franchise.tables[i];
    const tableInfo = {
      index: i,
      name: table.name || 'Unknown',
      uniqueId: table.header?.uniqueId || null,
      recordCount: 0,
      nonEmptyCount: 0,
      fields: [],
      sampleValues: {}
    };

    try {
      await table.readRecords();
      tableInfo.recordCount = table.records ? table.records.length : 0;
      tableInfo.nonEmptyCount = table.records ? table.records.filter(r => !r.isEmpty).length : 0;

      // Get field names and sample values from first non-empty record
      if (tableInfo.nonEmptyCount > 0) {
        output.tablesWithData++;
        const sample = table.records.find(r => !r.isEmpty);
        if (sample) {
          const fields = Object.keys(sample).filter(k => !k.startsWith('_'));
          tableInfo.fields = fields;

          // Get sample values for first 20 fields
          for (const field of fields.slice(0, 20)) {
            try {
              tableInfo.sampleValues[field] = String(sample[field]).substring(0, 100);
            } catch (e) {
              tableInfo.sampleValues[field] = 'ERROR';
            }
          }
        }
      }
    } catch (e) {
      tableInfo.error = e.message;
    }

    // Categorize the table
    const nameLower = (tableInfo.name || '').toLowerCase();
    if (nameLower.includes('player') || nameLower === 'prol' || nameLower.includes('plyr')) {
      output.tablesByCategory.player.push(tableInfo.name);
    }
    if (nameLower.includes('team') || nameLower.includes('tgid')) {
      output.tablesByCategory.team.push(tableInfo.name);
    }
    if (nameLower.includes('roster') || nameLower.includes('array')) {
      output.tablesByCategory.roster.push(tableInfo.name);
    }
    if (nameLower.includes('contract')) {
      output.tablesByCategory.contract.push(tableInfo.name);
    }
    if (nameLower.includes('salary') || nameLower.includes('cap')) {
      output.tablesByCategory.salary.push(tableInfo.name);
    }
    if (nameLower.includes('free') || nameLower.includes('agent') || nameLower.includes(' fa')) {
      output.tablesByCategory.freeAgent.push(tableInfo.name);
    }
    if (nameLower.includes('schedule') || nameLower.includes('game') || nameLower.includes('week')) {
      output.tablesByCategory.schedule.push(tableInfo.name);
    }
    if (nameLower.includes('draft')) {
      output.tablesByCategory.draft.push(tableInfo.name);
    }
    if (nameLower.includes('coach')) {
      output.tablesByCategory.coach.push(tableInfo.name);
    }
    if (nameLower.includes('stadium')) {
      output.tablesByCategory.stadium.push(tableInfo.name);
    }
    if (nameLower.includes('history') || nameLower.includes('award') || nameLower.includes('stat')) {
      output.tablesByCategory.history.push(tableInfo.name);
    }

    output.allTables.push(tableInfo);

    if (i % 200 === 0) {
      console.log(`Processed ${i}/${franchise.tables.length} tables`);
    }
  }

  // Write to file
  fs.writeFileSync('franchise-complete-structure.json', JSON.stringify(output, null, 2));

  console.log('\n' + '='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total tables: ${output.totalTables}`);
  console.log(`Tables with data: ${output.tablesWithData}`);
  console.log('\nTables by category:');
  for (const [category, tables] of Object.entries(output.tablesByCategory)) {
    if (tables.length > 0) {
      console.log(`  ${category}: ${tables.length} tables`);
    }
  }

  console.log('\nComplete structure written to franchise-complete-structure.json');
}

dumpAllTables().catch(console.error);
