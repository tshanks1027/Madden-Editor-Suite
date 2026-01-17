/**
 * Check 2011 Throwback preseason structure
 */
const { create } = require('madden-franchise');

async function check() {
  const f = await create('C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/CAREER-2011THROWBACKV09');
  const gt = f.getTableByUniqueId(1607878349);
  await gt.readRecords();

  console.log('=== 2011 Throwback Preseason Structure ===');
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

  const sorted = Object.keys(weekCounts).map(Number).sort((a, b) => a - b);
  for (const week of sorted) {
    const d = weekCounts[week];
    console.log('Week ' + week + ': ' + d.total + ' games');
    for (const [s, c] of Object.entries(d.statuses)) {
      console.log('  ' + s + ': ' + c);
    }
  }

  const si = f.getTableByName('SeasonInfo');
  await si.readRecords();
  for (const r of si.records) {
    if (r.isEmpty === false) {
      console.log('\nCurrentWeek:', r.CurrentWeek);
    }
  }
}

check().catch(console.error);
