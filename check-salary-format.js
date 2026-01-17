// Check actual salary cap format in franchise files
const fs = require('fs');

async function check() {
  const FranchiseModule = await import('madden-franchise');

  // Check the user's current file
  const testPath = 'C:/Users/tshan/Documents/Madden NFL 26/saves/CAREER-95exp';

  const franchise = await FranchiseModule.create(testPath);

  // SalaryInfo table
  let salaryTable = franchise.getTableByUniqueId(3759217828);
  if (!salaryTable) salaryTable = franchise.getTableByName('SalaryInfo');

  if (salaryTable) {
    await salaryTable.readRecords();
    const rec = salaryTable.records.find(r => !r.isEmpty);
    if (rec) {
      console.log('SalaryInfo record:');
      console.log('  TeamSalaryCap:', rec.TeamSalaryCap);
      console.log('  InitialSalaryCap:', rec.InitialSalaryCap);

      // Check if there are other salary-related fields
      const proto = Object.getPrototypeOf(rec);
      const desc = Object.getOwnPropertyDescriptors(proto);
      const salaryFields = Object.keys(desc).filter(k =>
        k.toLowerCase().includes('salary') || k.toLowerCase().includes('cap')
      );
      console.log('\n  All salary/cap related fields:', salaryFields);

      for (const field of salaryFields) {
        try {
          console.log(`    ${field}: ${rec[field]}`);
        } catch(e) {}
      }
    }
  }

  // Also check League table
  let leagueTable = franchise.getTableByName('League');
  if (leagueTable) {
    await leagueTable.readRecords();
    const rec = leagueTable.records[0];
    if (rec) {
      console.log('\nLeague record salary fields:');
      const proto = Object.getPrototypeOf(rec);
      const desc = Object.getOwnPropertyDescriptors(proto);
      const salaryFields = Object.keys(desc).filter(k =>
        k.toLowerCase().includes('salary') || k.toLowerCase().includes('cap')
      );
      for (const field of salaryFields) {
        try {
          console.log(`  ${field}: ${rec[field]}`);
        } catch(e) {}
      }
    }
  }

  // Check Team table for team salary caps
  let teamTable = franchise.getTableByUniqueId(3938984019);
  if (teamTable) {
    await teamTable.readRecords();
    const cowboys = teamTable.records.find(r => r.ShortName === 'Cowboys' || r.DisplayName === 'Cowboys');
    if (cowboys) {
      console.log('\nCowboys team salary fields:');
      const proto = Object.getPrototypeOf(cowboys);
      const desc = Object.getOwnPropertyDescriptors(proto);
      const salaryFields = Object.keys(desc).filter(k =>
        k.toLowerCase().includes('salary') || k.toLowerCase().includes('cap')
      );
      for (const field of salaryFields) {
        try {
          console.log(`  ${field}: ${cowboys[field]}`);
        } catch(e) {}
      }
    }
  }
}

check().catch(console.error);
