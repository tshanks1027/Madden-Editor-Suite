/**
 * Fix bad team refs in all 1980 files
 */
const { create } = require('madden-franchise');

async function fix(filePath, name) {
  console.log('\n=== ' + name + ' ===');
  const f = await create(filePath);

  const fu = f.getTableByName('FranchiseUser');
  await fu.readRecords();
  let correctPrefix = '';
  for (const r of fu.records) {
    if (r.isEmpty === false && r.Team) {
      correctPrefix = r.Team.slice(0, 24);
      break;
    }
  }

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
      g.GameStatus = 'Invalid_';
      g.SeasonWeekType = 'OffSeason';
      fixed++;
    }
  }

  if (fixed > 0) {
    console.log('Fixed ' + fixed + ' games');
    await f.save(filePath);
    console.log('Saved');
  } else {
    console.log('No fixes needed');
  }
}

async function main() {
  await fix('C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/CAREER-1980test', '1980test');
  await fix('C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/CAREER-1980test-AUTOSAVE', '1980test-AUTOSAVE');
}

main().catch(console.error);
