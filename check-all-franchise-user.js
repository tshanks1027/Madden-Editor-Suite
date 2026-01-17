/**
 * Check all FranchiseUser records and team-related tables
 */
const { create } = require('madden-franchise');

async function check() {
  const f = await create('C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/CAREER-1980test');

  // Get team table
  const tt = f.getTableByUniqueId(637929298);
  await tt.readRecords();
  const teamMap = {};
  let idx = 0;
  for (const t of tt.records) {
    if (t.isEmpty === false) {
      teamMap[idx] = t.ShortName;
    }
    idx++;
  }

  // Get ALL FranchiseUser records
  const fu = f.getTableByName('FranchiseUser');
  await fu.readRecords();

  console.log('=== ALL FRANCHISE USER RECORDS ===');
  idx = 0;
  for (const r of fu.records) {
    console.log('\nRecord ' + idx + ' (isEmpty=' + r.isEmpty + '):');
    if (!r.isEmpty) {
      const teamIdx = r.Team ? parseInt(r.Team.slice(-8), 2) : -1;
      console.log('  Team:', teamMap[teamIdx] || 'Unknown', '(index ' + teamIdx + ')');
      console.log('  Team ref:', r.Team);
      console.log('  UserName:', r.UserName);
      console.log('  AdminLevel:', r.AdminLevel);
      console.log('  HumanControlled:', r.HumanControlled);
    }
    idx++;
    if (idx > 5) break;
  }

  // Check TeamSeasonSetting table
  console.log('\n\n=== TEAM SEASON SETTING ===');
  try {
    const tss = f.getTableByName('TeamSeasonSetting');
    await tss.readRecords();
    let count = 0;
    for (const r of tss.records) {
      if (r.isEmpty) continue;
      console.log('Record ' + count + ':');
      console.log('  Team:', r.Team);
      console.log('  IsUserControlled:', r.IsUserControlled);
      if (r.Team) {
        const teamIdx = parseInt(r.Team.slice(-8), 2);
        console.log('  Team name:', teamMap[teamIdx] || 'Unknown');
      }
      count++;
      if (count >= 10) break;
    }
  } catch (e) {
    console.log('Error:', e.message);
  }

  // Check any table with "Controller" in the name
  console.log('\n\n=== TABLES WITH "CONTROL" ===');
  const allTables = f.tables || f.getAllTables() || [];
  for (const table of allTables) {
    const name = table.name || table.header?.name || '';
    if (name.toLowerCase().includes('control') || name.toLowerCase().includes('user')) {
      console.log('Table:', name);
    }
  }
}

check().catch(console.error);
