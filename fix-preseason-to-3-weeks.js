/**
 * Fix preseason to 3 weeks like 2011 Throwback
 * Mark Week 3 preseason games as OffSeason
 */
const { create } = require('madden-franchise');

async function fix() {
  const files = [
    { name: '1980test', path: 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/CAREER-1980test' },
    { name: 'AUTOSAVE', path: 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/CAREER-1980test-AUTOSAVE' }
  ];

  for (const file of files) {
    console.log('\n========== FIXING: ' + file.name + ' ==========');
    const f = await create(file.path);

    const gt = f.getTableByUniqueId(1607878349);
    await gt.readRecords();

    let fixed = 0;
    for (const g of gt.records) {
      if (g.isEmpty) continue;
      const wt = g.SeasonWeekType;
      // Week 3 preseason should be marked as OffSeason (like 2011 doesn't have it)
      if ((wt === 0 || wt === 'PreSeason') && g.SeasonWeek === 3) {
        console.log('Marking Week 3 preseason game as OffSeason');
        g.SeasonWeekType = 'OffSeason';
        fixed++;
      }
    }
    console.log('Fixed ' + fixed + ' Week 3 preseason games');

    console.log('Saving...');
    await f.save(file.path);
    console.log('Done');
  }

  // Verify
  console.log('\n========== VERIFICATION ==========');
  const f = await create(files[0].path);
  const gt = f.getTableByUniqueId(1607878349);
  await gt.readRecords();

  const weeks = {};
  for (const g of gt.records) {
    if (g.isEmpty) continue;
    const wt = g.SeasonWeekType;
    if (wt === 0 || wt === 'PreSeason') {
      const week = g.SeasonWeek;
      if (weeks[week] === undefined) weeks[week] = 0;
      weeks[week]++;
    }
  }

  console.log('Preseason weeks after fix:');
  for (const week of Object.keys(weeks).sort((a, b) => Number(a) - Number(b))) {
    console.log('  Week ' + week + ': ' + weeks[week] + ' games');
  }
}

fix().catch(console.error);
