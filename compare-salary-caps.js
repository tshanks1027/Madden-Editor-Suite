// Compare salary cap values across different franchise files
async function compare() {
  const FranchiseModule = await import('madden-franchise');

  const files = [
    'C:/Users/tshan/Documents/Madden NFL 26/saves/CAREER-REAL',
    'C:/Users/tshan/Documents/Madden NFL 26/saves/CAREER-95exp',
    'C:/Users/tshan/Documents/Madden NFL 26/saves/CAREER-2011THROWBACKV09'
  ];

  for (const filePath of files) {
    console.log(`\n${filePath.split('/').pop()}:`);
    try {
      const franchise = await FranchiseModule.create(filePath);

      let salaryTable = franchise.getTableByUniqueId(3759217828);
      if (!salaryTable) salaryTable = franchise.getTableByName('SalaryInfo');

      if (salaryTable) {
        await salaryTable.readRecords();
        const rec = salaryTable.records.find(r => !r.isEmpty);
        if (rec) {
          console.log('  TeamSalaryCap:', rec.TeamSalaryCap);
          console.log('  InitialSalaryCap:', rec.InitialSalaryCap);

          // Calculate what this means in dollars
          // Try different multipliers
          console.log('  Interpretations:');
          console.log('    If in thousands: $' + (rec.TeamSalaryCap * 1000).toLocaleString());
          console.log('    If in ten-thousands: $' + (rec.TeamSalaryCap * 10000).toLocaleString());
          console.log('    If in full dollars: $' + rec.TeamSalaryCap.toLocaleString());
        }
      }

      // Also check SeasonInfo
      const seasonTable = franchise.getTableByUniqueId(3123991521);
      if (seasonTable) {
        await seasonTable.readRecords();
        console.log('  CurrentSeasonYear:', seasonTable.records[0].CurrentSeasonYear);
      }
    } catch (e) {
      console.log('  ERROR:', e.message);
    }
  }
}

compare().catch(console.error);
