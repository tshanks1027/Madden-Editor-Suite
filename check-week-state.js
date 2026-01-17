/**
 * Check week state in AUTOSAVE
 */
const { create } = require('madden-franchise');

async function checkAutosave() {
  const filePath = 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/CAREER-1980test-AUTOSAVE';
  const franchise = await create(filePath);

  // Check SeasonInfo
  const si = franchise.getTableByName('SeasonInfo');
  await si.readRecords();
  for (const r of si.records) {
    if (r.isEmpty === false) {
      console.log('CurrentWeek:', r.CurrentWeek);
    }
  }

  // Check week counts
  const gt = franchise.getTableByUniqueId(1607878349);
  await gt.readRecords();

  console.log('\nPreseason games by week:');
  const weekCounts = {};
  for (const g of gt.records) {
    if (g.isEmpty) continue;
    const wt = g.SeasonWeekType;
    if (wt === 0 || wt === 'PreSeason') {
      const week = g.SeasonWeek;
      if (weekCounts[week] === undefined) weekCounts[week] = { total: 0, statuses: {} };
      weekCounts[week].total++;
      const status = String(g.GameStatus || 'Unknown');
      weekCounts[week].statuses[status] = (weekCounts[week].statuses[status] || 0) + 1;
    }
  }

  const sortedWeeks = Object.keys(weekCounts).map(Number).sort((a, b) => a - b);
  for (const week of sortedWeeks) {
    const data = weekCounts[week];
    console.log('Week ' + week + ': ' + data.total + ' games');
    for (const [status, count] of Object.entries(data.statuses)) {
      console.log('  ' + status + ': ' + count);
    }
  }
}

checkAutosave().catch(console.error);
