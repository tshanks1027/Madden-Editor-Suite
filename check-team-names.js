/**
 * Check team names/abbreviations in 1980 vs 2011
 */
const { create } = require('madden-franchise');

async function check() {
  const files = [
    { name: '1980test', path: 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/CAREER-1980test' },
    { name: '2011 Throwback', path: 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/CAREER-2011THROWBACKV09' }
  ];

  for (const file of files) {
    console.log('\n========== ' + file.name + ' ==========');
    const f = await create(file.path);

    const tt = f.getTableByUniqueId(637929298);
    await tt.readRecords();

    console.log('Team table fields:', Object.keys(tt.records[0] || {}).filter(k => !k.startsWith('_')).slice(0, 20));

    console.log('\nFirst 5 teams:');
    let count = 0;
    for (const t of tt.records) {
      if (t.isEmpty) continue;
      console.log('  Team ' + count + ':');
      console.log('    ShortName:', t.ShortName);
      console.log('    LongName:', t.LongName);
      console.log('    NickName:', t.NickName);
      console.log('    DisplayName:', t.DisplayName);
      console.log('    Abbreviation:', t.Abbreviation);
      console.log('    Name:', t.Name);
      count++;
      if (count >= 5) break;
    }
  }
}

check().catch(console.error);
