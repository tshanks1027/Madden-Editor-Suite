/**
 * Fix games with bad team reference prefixes
 */
const { create } = require('madden-franchise');

async function fix() {
  const filePath = 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/CAREER-PRESEASONWK1';

  console.log('Loading:', filePath);
  const f = await create(filePath);

  // Get correct team prefix from FranchiseUser
  const fu = f.getTableByName('FranchiseUser');
  await fu.readRecords();
  let correctPrefix = '';
  for (const r of fu.records) {
    if (r.isEmpty === false && r.Team) {
      correctPrefix = r.Team.slice(0, 24);
      break;
    }
  }
  console.log('Correct prefix:', correctPrefix);

  const gt = f.getTableByUniqueId(1607878349);
  await gt.readRecords();

  const nullRef = '000000000000000000000000';
  let fixed = 0;

  for (const g of gt.records) {
    if (g.isEmpty) continue;

    const homePrefix = g.HomeTeam ? g.HomeTeam.slice(0, 24) : null;
    const awayPrefix = g.AwayTeam ? g.AwayTeam.slice(0, 24) : null;

    const homeBad = homePrefix && homePrefix !== correctPrefix && homePrefix !== nullRef;
    const awayBad = awayPrefix && awayPrefix !== correctPrefix && awayPrefix !== nullRef;

    if (homeBad || awayBad) {
      console.log('Fixing game at idx=' + g.index + ':');
      console.log('  Before: SeasonWeekType=' + g.SeasonWeekType + ', GameStatus=' + g.GameStatus);
      console.log('  HomePrefix=' + homePrefix + ', AwayPrefix=' + awayPrefix);

      g.GameStatus = 'Invalid_';
      g.SeasonWeekType = 'OffSeason';

      console.log('  After: SeasonWeekType=' + g.SeasonWeekType + ', GameStatus=' + g.GameStatus);
      fixed++;
    }
  }

  console.log('\nFixed ' + fixed + ' games');

  console.log('Saving...');
  await f.save(filePath);
  console.log('Done!');

  // Verify
  console.log('\n=== VERIFICATION ===');
  const f2 = await create(filePath);
  const gt2 = f2.getTableByUniqueId(1607878349);
  await gt2.readRecords();

  for (const g of gt2.records) {
    if (g.isEmpty) continue;
    if (g.index === 344) {
      console.log('Game at idx=344:');
      console.log('  SeasonWeekType:', g.SeasonWeekType);
      console.log('  GameStatus:', g.GameStatus);
      console.log('  HomeTeam:', g.HomeTeam);
      console.log('  AwayTeam:', g.AwayTeam);
    }
  }
}

fix().catch(console.error);
