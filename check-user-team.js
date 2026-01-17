/**
 * Check what team the FranchiseUser is set to
 */
const { create } = require('madden-franchise');

async function check() {
  const files = [
    { name: '1980test', path: 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/CAREER-1980test' },
    { name: 'AUTOSAVE', path: 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/CAREER-1980test-AUTOSAVE' },
    { name: '2011 Throwback', path: 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/CAREER-2011THROWBACKV09' }
  ];

  for (const file of files) {
    console.log('\n========== ' + file.name + ' ==========');
    const f = await create(file.path);

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

    // Get FranchiseUser
    const fu = f.getTableByName('FranchiseUser');
    await fu.readRecords();

    for (const r of fu.records) {
      if (r.isEmpty) continue;
      console.log('FranchiseUser:');
      console.log('  Team ref:', r.Team);

      if (r.Team) {
        const teamIdx = parseInt(r.Team.slice(-8), 2);
        console.log('  Team index:', teamIdx);
        console.log('  Team name:', teamMap[teamIdx] || 'UNKNOWN');
      }

      console.log('  UserName:', r.UserName);
      console.log('  TeamType:', r.TeamType);
      console.log('  IsOwnerMode:', r.IsOwnerMode);
    }

    // Check the Cowboys (DAL) position in team table
    console.log('\nTeam positions:');
    idx = 0;
    for (const t of tt.records) {
      if (t.isEmpty === false) {
        if (t.ShortName === 'DAL' || t.ShortName === 'LV' || t.ShortName === 'OAK') {
          console.log('  ' + t.ShortName + ' at record index ' + idx);
        }
      }
      idx++;
    }
  }
}

check().catch(console.error);
