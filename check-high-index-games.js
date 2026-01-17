/**
 * Check high-index preseason games (the HOF game slots)
 */
const { create } = require('madden-franchise');

async function check() {
  const files = [
    { name: '2011 Throwback', path: 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/CAREER-2011THROWBACKV09' },
    { name: 'PRESEASONWK1', path: 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/CAREER-PRESEASONWK1' },
    { name: '1980test', path: 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/CAREER-1980test' }
  ];

  for (const file of files) {
    console.log('\n\n=== ' + file.name + ' ===');
    const f = await create(file.path);

    // Get team prefix from FranchiseUser
    const fu = f.getTableByName('FranchiseUser');
    await fu.readRecords();
    let correctPrefix = '';
    let userTeamIdx = -1;
    for (const r of fu.records) {
      if (r.isEmpty === false && r.Team) {
        correctPrefix = r.Team.slice(0, 24);
        userTeamIdx = parseInt(r.Team.slice(-8), 2);
        break;
      }
    }
    console.log('Correct team prefix:', correctPrefix);
    console.log('User team index:', userTeamIdx);

    const gt = f.getTableByUniqueId(1607878349);
    await gt.readRecords();

    // Find games with index > 300 that are preseason
    console.log('\nHigh-index preseason games (idx > 300):');
    for (const g of gt.records) {
      if (g.isEmpty) continue;
      const wt = g.SeasonWeekType;
      if ((wt === 0 || wt === 'PreSeason') && g.index > 300) {
        const homePrefix = g.HomeTeam ? g.HomeTeam.slice(0, 24) : 'null';
        const awayPrefix = g.AwayTeam ? g.AwayTeam.slice(0, 24) : 'null';

        const homeBad = homePrefix !== correctPrefix && homePrefix !== '000000000000000000000000' ? ' **BAD**' : '';
        const awayBad = awayPrefix !== correctPrefix && awayPrefix !== '000000000000000000000000' ? ' **BAD**' : '';

        console.log('  idx=' + g.index + ':');
        console.log('    HomeTeam:', g.HomeTeam, homeBad);
        console.log('    AwayTeam:', g.AwayTeam, awayBad);
        console.log('    SeasonGameNum:', g.SeasonGameNum);
        console.log('    GameStatus:', g.GameStatus);
      }
    }

    // Also check if there are ANY games with wrong prefix
    console.log('\nAll games with wrong team prefix:');
    let count = 0;
    for (const g of gt.records) {
      if (g.isEmpty) continue;
      const homePrefix = g.HomeTeam ? g.HomeTeam.slice(0, 24) : '000000000000000000000000';
      const awayPrefix = g.AwayTeam ? g.AwayTeam.slice(0, 24) : '000000000000000000000000';

      if ((homePrefix !== correctPrefix && homePrefix !== '000000000000000000000000') ||
          (awayPrefix !== correctPrefix && awayPrefix !== '000000000000000000000000')) {
        console.log('  idx=' + g.index + ': Week ' + g.SeasonWeek + ' ' + g.SeasonWeekType);
        console.log('    HomeTeam:', g.HomeTeam);
        console.log('    AwayTeam:', g.AwayTeam);
        count++;
        if (count >= 10) {
          console.log('  ... and more');
          break;
        }
      }
    }
    if (count === 0) console.log('  None found');
  }
}

check().catch(console.error);
