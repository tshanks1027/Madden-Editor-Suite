/**
 * Check 1980 original file preseason structure
 */
const { create } = require('madden-franchise');

async function check() {
  const f = await create('C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/CAREER-1980test');
  const gt = f.getTableByUniqueId(1607878349);
  await gt.readRecords();

  console.log('=== 1980 Original Preseason Structure ===');
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

  console.log('\n=== 2011 Throwback for comparison ===');
  const f2 = await create('C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/CAREER-2011THROWBACKV09');
  const gt2 = f2.getTableByUniqueId(1607878349);
  await gt2.readRecords();

  const weekCounts2 = {};
  for (const g of gt2.records) {
    if (g.isEmpty) continue;
    const wt = g.SeasonWeekType;
    if (wt === 0 || wt === 'PreSeason') {
      const week = g.SeasonWeek;
      if (weekCounts2[week] === undefined) weekCounts2[week] = { total: 0, statuses: {} };
      weekCounts2[week].total++;
      const status = String(g.GameStatus || 'Unknown');
      weekCounts2[week].statuses[status] = (weekCounts2[week].statuses[status] || 0) + 1;
    }
  }

  const sorted2 = Object.keys(weekCounts2).map(Number).sort((a, b) => a - b);
  for (const week of sorted2) {
    const d = weekCounts2[week];
    console.log('Week ' + week + ': ' + d.total + ' games');
  }

  console.log('\n=== Total Games Comparison ===');
  let total1980 = 0;
  for (const g of gt.records) {
    if (g.isEmpty === false) total1980++;
  }
  let total2011 = 0;
  for (const g of gt2.records) {
    if (g.isEmpty === false) total2011++;
  }
  console.log('1980 total games:', total1980);
  console.log('2011 total games:', total2011);
}

check().catch(console.error);
