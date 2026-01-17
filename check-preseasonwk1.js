/**
 * Check PRESEASONWK1 state
 */
const { create } = require('madden-franchise');

async function check() {
  const f = await create('C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/CAREER-PRESEASONWK1');

  // Check coaches
  const ct = f.getTableByName('Coach');
  await ct.readRecords();
  console.log('=== COACHES ===');
  let count = 0;
  for (const c of ct.records) {
    if (c.isEmpty) continue;
    console.log('Coach ' + count + ': Name="' + c.Name + '", First="' + c.FirstName + '", Last="' + c.LastName + '"');
    count++;
    if (count >= 5) break;
  }

  // Check preseason weeks
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

  console.log('\n=== PRESEASON WEEKS ===');
  for (const week of Object.keys(weeks).sort((a, b) => Number(a) - Number(b))) {
    console.log('Week ' + week + ': ' + weeks[week] + ' games');
  }

  // Check game at idx 344
  console.log('\n=== GAME AT IDX 344 ===');
  for (const g of gt.records) {
    if (g.index === 344) {
      console.log('SeasonWeekType:', g.SeasonWeekType);
      console.log('GameStatus:', g.GameStatus);
      console.log('SeasonWeek:', g.SeasonWeek);
      break;
    }
  }
}

check().catch(console.error);
