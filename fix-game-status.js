/**
 * Fix GameStatus for all games in 1980 franchise file
 * Reset all preseason and regular season games to 'Unplayed'
 */
const { create } = require('madden-franchise');

async function fixGameStatus() {
  const filePath = 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/CAREER-1980test';

  console.log('Loading franchise file...');
  const franchise = await create(filePath);

  const gt = franchise.getTableByUniqueId(1607878349);
  await gt.readRecords();

  console.log('Resetting GameStatus for all games...');

  let fixed = 0;
  let skipped = 0;
  for (const g of gt.records) {
    if (g.isEmpty) continue;

    const currentStatus = String(g.GameStatus);

    // Skip Invalid_ and Unscheduled games
    if (currentStatus === 'Invalid_' || currentStatus === 'Unscheduled') {
      skipped++;
      continue;
    }

    // Reset any non-Unplayed games
    if (currentStatus !== 'Unplayed') {
      console.log('  Resetting game: ' + currentStatus + ' -> Unplayed');
      g.GameStatus = 'Unplayed';
      fixed++;
    }
  }

  console.log('Fixed ' + fixed + ' games, skipped ' + skipped + ' (Invalid/Unscheduled)');

  // Also reset CurrentWeek to 0
  const si = franchise.getTableByName('SeasonInfo');
  await si.readRecords();
  for (const r of si.records) {
    if (r.isEmpty === false) {
      console.log('CurrentWeek before:', r.CurrentWeek);
      r.CurrentWeek = 0;
      console.log('CurrentWeek after:', r.CurrentWeek);
    }
  }

  console.log('Saving...');
  await franchise.save(filePath);
  console.log('Done!');

  // Verify
  console.log('\n=== VERIFICATION ===');
  const f2 = await create(filePath);
  const gt2 = f2.getTableByUniqueId(1607878349);
  await gt2.readRecords();

  const weekCounts = {};
  for (const g of gt2.records) {
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

  console.log('Preseason structure after fix:');
  const sorted = Object.keys(weekCounts).map(Number).sort((a, b) => a - b);
  for (const week of sorted) {
    const d = weekCounts[week];
    console.log('Week ' + week + ': ' + d.total + ' games');
    for (const [s, c] of Object.entries(d.statuses)) {
      console.log('  ' + s + ': ' + c);
    }
  }
}

fixGameStatus().catch(console.error);
