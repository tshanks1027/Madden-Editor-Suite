/**
 * Check game ordering fields
 */
const { create } = require('madden-franchise');

async function check() {
  const f = await create('C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/CAREER-1980test');

  const gt = f.getTableByUniqueId(1607878349);
  await gt.readRecords();

  // Get first game to see available fields
  let firstGame = null;
  for (const g of gt.records) {
    if (g.isEmpty === false) {
      firstGame = g;
      break;
    }
  }

  console.log('SeasonGame fields:');
  const fields = Object.keys(firstGame).filter(k => !k.startsWith('_'));
  console.log(fields.join(', '));

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

  console.log('\n\nWeek 0 games with all ordering-related fields:');
  for (const g of gt.records) {
    if (g.isEmpty) continue;
    const wt = g.SeasonWeekType;
    if ((wt === 0 || wt === 'PreSeason') && g.SeasonWeek === 0) {
      const homeRef = g.HomeTeam;
      const awayRef = g.AwayTeam;
      const homeIdx = homeRef ? parseInt(homeRef.slice(-8), 2) : -1;
      const awayIdx = awayRef ? parseInt(awayRef.slice(-8), 2) : -1;
      const homeName = teamMap[homeIdx] || 'UNK';
      const awayName = teamMap[awayIdx] || 'UNK';

      console.log('\n' + awayName + ' @ ' + homeName + ':');
      console.log('  SeasonGameNum:', g.SeasonGameNum);
      console.log('  GameOfDay:', g.GameOfDay);
      console.log('  DayOfWeek:', g.DayOfWeek);
      console.log('  TimeOfDay:', g.TimeOfDay);
      console.log('  index:', g.index);
    }
  }
}

check().catch(console.error);
