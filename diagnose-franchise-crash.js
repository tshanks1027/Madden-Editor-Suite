// Diagnostic script to understand franchise file structure and identify crash cause
// Run: node diagnose-franchise-crash.js "C:/path/to/franchise"

const filePath = process.argv[2] || 'C:/Users/tshan/Documents/Madden NFL 26/saves/CAREER-95exp';

// Table IDs from the codebase
const TABLE_IDS = {
  seasonInfoTable: 3123991521,
  salaryInfoTable: 3759217828,
  leagueTable: 4097,  // For comparison
  teamTable: 3938984019
};

async function diagnose() {
  console.log('='.repeat(60));
  console.log('FRANCHISE FILE DIAGNOSTIC');
  console.log('='.repeat(60));
  console.log('File:', filePath);
  console.log('');

  // Import madden-franchise
  const FranchiseModule = await import('madden-franchise');
  const createFranchise = FranchiseModule.create;
  if (!createFranchise) {
    throw new Error('Could not find create function in madden-franchise');
  }

  const franchise = await createFranchise(filePath);
  console.log('Franchise loaded successfully\n');

  // Diagnose SeasonInfo table
  console.log('='.repeat(60));
  console.log('SEASONINFO TABLE (ID: 3123991521)');
  console.log('='.repeat(60));

  try {
    const seasonTable = franchise.getTableByUniqueId(TABLE_IDS.seasonInfoTable);
    if (!seasonTable) {
      console.log('ERROR: SeasonInfo table NOT FOUND by ID');
    } else {
      await seasonTable.readRecords();
      console.log(`Found ${seasonTable.records.length} records`);

      if (seasonTable.records.length > 0) {
        const record = seasonTable.records[0];

        // Get all field names
        const allKeys = new Set();
        // From record itself
        for (const key of Object.keys(record)) {
          if (!key.startsWith('_')) allKeys.add(key);
        }
        // From prototype getters
        const proto = Object.getPrototypeOf(record);
        const descriptors = Object.getOwnPropertyDescriptors(proto);
        for (const key of Object.keys(descriptors)) {
          if (descriptors[key].get && !key.startsWith('_')) allKeys.add(key);
        }

        console.log('\nAvailable fields:', Array.from(allKeys).sort().join(', '));

        // Check specific fields we care about
        const keyFields = [
          'CurrentSeasonYear', 'SeasonYear', 'CalendarYear', 'BaseCalendarYear',
          'SuperBowlNumber', 'BaseSuperBowlNumber', 'NflseasonWeekCount',
          'RegularSeasonWeeks', 'SeasonWeekCount'
        ];

        console.log('\nKey field values:');
        for (const field of keyFields) {
          try {
            const value = record[field];
            if (value !== undefined) {
              console.log(`  ${field}: ${value} (type: ${typeof value})`);
            }
          } catch (e) {}
        }
      }
    }
  } catch (e) {
    console.log('ERROR reading SeasonInfo:', e.message);
  }

  // Diagnose SalaryInfo table
  console.log('\n' + '='.repeat(60));
  console.log('SALARYINFO TABLE (ID: 3759217828)');
  console.log('='.repeat(60));

  try {
    let salaryTable = franchise.getTableByUniqueId(TABLE_IDS.salaryInfoTable);
    if (!salaryTable) {
      salaryTable = franchise.getTableByName('SalaryInfo');
    }

    if (!salaryTable) {
      console.log('ERROR: SalaryInfo table NOT FOUND');

      // Try to find it by name search
      console.log('\nSearching for salary-related tables...');
      const allTables = franchise.tables || [];
      for (const t of allTables) {
        const name = t.name || '';
        if (name.toLowerCase().includes('salary') || name.toLowerCase().includes('cap')) {
          console.log(`  Found: ${name} (ID: ${t.header?.uniqueId || 'unknown'})`);
        }
      }
    } else {
      await salaryTable.readRecords();
      console.log(`Found ${salaryTable.records.length} records`);

      const activeRecords = salaryTable.records.filter(r => !r.isEmpty);
      console.log(`Active records: ${activeRecords.length}`);

      if (activeRecords.length > 0) {
        const record = activeRecords[0];

        // Get all field names
        const allKeys = new Set();
        for (const key of Object.keys(record)) {
          if (!key.startsWith('_')) allKeys.add(key);
        }
        const proto = Object.getPrototypeOf(record);
        const descriptors = Object.getOwnPropertyDescriptors(proto);
        for (const key of Object.keys(descriptors)) {
          if (descriptors[key].get && !key.startsWith('_')) allKeys.add(key);
        }

        console.log('\nAvailable fields:', Array.from(allKeys).sort().join(', '));

        // Check salary cap fields
        const salaryFields = [
          'TeamSalaryCap', 'InitialSalaryCap', 'SalaryCap', 'Cap',
          'LeagueSalaryCap', 'TeamSalaryCapSpace'
        ];

        console.log('\nSalary cap field values:');
        for (const field of salaryFields) {
          try {
            const value = record[field];
            if (value !== undefined) {
              const dollars = value * 1000;
              console.log(`  ${field}: ${value} (= $${dollars.toLocaleString()})`);
            }
          } catch (e) {}
        }
      }
    }
  } catch (e) {
    console.log('ERROR reading SalaryInfo:', e.message);
  }

  // Check League table for comparison
  console.log('\n' + '='.repeat(60));
  console.log('LEAGUE TABLE (ID: 4097) - For comparison');
  console.log('='.repeat(60));

  try {
    let leagueTable = franchise.getTableByUniqueId(TABLE_IDS.leagueTable);
    if (!leagueTable) {
      leagueTable = franchise.getTableByName('League');
    }

    if (!leagueTable) {
      console.log('League table NOT FOUND');
    } else {
      await leagueTable.readRecords();
      console.log(`Found ${leagueTable.records.length} records`);

      if (leagueTable.records.length > 0) {
        const record = leagueTable.records[0];

        // Get all field names
        const allKeys = new Set();
        for (const key of Object.keys(record)) {
          if (!key.startsWith('_')) allKeys.add(key);
        }
        const proto = Object.getPrototypeOf(record);
        const descriptors = Object.getOwnPropertyDescriptors(proto);
        for (const key of Object.keys(descriptors)) {
          if (descriptors[key].get && !key.startsWith('_')) allKeys.add(key);
        }

        console.log('\nAvailable fields (first 30):', Array.from(allKeys).sort().slice(0, 30).join(', '));

        // Check if salary cap is here
        const capFields = ['SalaryCap', 'TeamSalaryCap', 'InitialSalaryCap', 'LeagueSalaryCap'];
        console.log('\nChecking for salary cap fields:');
        for (const field of capFields) {
          try {
            const value = record[field];
            if (value !== undefined) {
              console.log(`  ${field}: ${value}`);
            }
          } catch (e) {}
        }
      }
    }
  } catch (e) {
    console.log('ERROR reading League:', e.message);
  }

  // List all tables with "Salary" or "Season" in name
  console.log('\n' + '='.repeat(60));
  console.log('ALL TABLES WITH SALARY/SEASON/LEAGUE IN NAME');
  console.log('='.repeat(60));

  const tables = franchise.tables || [];
  for (const t of tables) {
    const name = t.name || '';
    if (name.toLowerCase().includes('salary') ||
        name.toLowerCase().includes('season') ||
        name.toLowerCase().includes('league') ||
        name.toLowerCase().includes('cap')) {
      const id = t.header?.uniqueId || 'unknown';
      const recordCount = t.records?.length || 0;
      console.log(`  ${name} (ID: ${id}, Records: ${recordCount})`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('DIAGNOSTIC COMPLETE');
  console.log('='.repeat(60));

  process.exit(0);
}

diagnose().catch(err => {
  console.error('FATAL ERROR:', err.message);
  console.error(err.stack);
  process.exit(1);
});
