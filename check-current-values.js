// Simple script to check current values in franchise file
const filePath = process.argv[2] || 'C:/Users/tshan/Documents/Madden NFL 26/saves/CAREER-95exp';

async function checkValues() {
  const FranchiseModule = await import('madden-franchise');
  const franchise = await FranchiseModule.create(filePath);

  // SeasonInfo
  const seasonTable = franchise.getTableByUniqueId(3123991521);
  await seasonTable.readRecords();
  const season = seasonTable.records[0];

  // SalaryInfo
  let salaryTable = franchise.getTableByUniqueId(3759217828);
  if (!salaryTable) salaryTable = franchise.getTableByName('SalaryInfo');
  await salaryTable.readRecords();
  const salary = salaryTable.records.find(r => !r.isEmpty);

  console.log('File:', filePath);
  console.log('');
  console.log('SeasonInfo:');
  console.log('  CurrentSeasonYear:', season.CurrentSeasonYear);
  console.log('  BaseCalendarYear:', season.BaseCalendarYear);
  console.log('  BaseSuperBowlNumber:', season.BaseSuperBowlNumber);
  console.log('  NflseasonWeekCount:', season.NflseasonWeekCount);
  console.log('');
  console.log('SalaryInfo:');
  console.log('  TeamSalaryCap:', salary?.TeamSalaryCap, '($' + (salary?.TeamSalaryCap * 1000).toLocaleString() + ')');
  console.log('  InitialSalaryCap:', salary?.InitialSalaryCap, '($' + (salary?.InitialSalaryCap * 1000).toLocaleString() + ')');

  process.exit(0);
}

checkValues().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
