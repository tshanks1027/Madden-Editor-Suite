/**
 * Check preseason week count and structure
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

    const gt = f.getTableByUniqueId(1607878349);
    await gt.readRecords();

    // Count games by week for preseason
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

    console.log('Preseason weeks:');
    const sorted = Object.keys(weeks).map(Number).sort((a, b) => a - b);
    for (const week of sorted) {
      console.log('  Week ' + week + ': ' + weeks[week] + ' games');
    }
    console.log('Total preseason weeks:', sorted.length);

    // Check SeasonInfo
    const si = f.getTableByName('SeasonInfo');
    await si.readRecords();
    for (const r of si.records) {
      if (r.isEmpty === false) {
        console.log('\nSeasonInfo:');
        console.log('  NflseasonWeekCount:', r.NflseasonWeekCount);
        console.log('  NflpreseasonWeekCount:', r.NflpreseasonWeekCount);
        console.log('  CurrentWeek:', r.CurrentWeek);
      }
    }
  }
}

check().catch(console.error);
