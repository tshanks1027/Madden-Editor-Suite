/**
 * Check team indices - what team is at each index
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

    console.log('Team table (record index -> team):');
    let idx = 0;
    for (const t of tt.records) {
      if (t.isEmpty === false) {
        console.log('  Index ' + idx + ': ' + t.ShortName + ' (' + t.LongName + ' ' + t.DisplayName + ')');
      }
      idx++;
    }
  }
}

check().catch(console.error);
