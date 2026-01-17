/**
 * Compare 2011 Throwback (working) vs 1980 files (broken)
 * Find what's ACTUALLY different
 */
const { create } = require('madden-franchise');

async function compare() {
  const files = [
    { name: '2011 Throwback (WORKING)', path: 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/CAREER-2011THROWBACKV09' },
    { name: '1980test', path: 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/CAREER-1980test' },
    { name: 'PRESEASONWK1', path: 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/CAREER-PRESEASONWK1' }
  ];

  for (const file of files) {
    console.log('\n\n' + '='.repeat(60));
    console.log(file.name);
    console.log('='.repeat(60));

    const f = await create(file.path);

    // Get team table
    const tt = f.getTableByUniqueId(637929298);
    await tt.readRecords();
    const teamMap = {};
    let idx = 0;
    for (const t of tt.records) {
      if (t.isEmpty === false) teamMap[idx] = t.ShortName;
      idx++;
    }

    // FranchiseUser
    const fu = f.getTableByName('FranchiseUser');
    await fu.readRecords();
    for (const r of fu.records) {
      if (r.isEmpty) continue;
      const teamIdx = r.Team ? parseInt(r.Team.slice(-8), 2) : -1;
      console.log('\nFranchiseUser:');
      console.log('  Team:', teamMap[teamIdx], '(index ' + teamIdx + ')');
      console.log('  Team ref:', r.Team);
      console.log('  Team prefix:', r.Team ? r.Team.slice(0, 24) : 'null');
      break;
    }

    // First user's preseason game
    const gt = f.getTableByUniqueId(1607878349);
    await gt.readRecords();

    // Get user team index
    let userTeamIdx = -1;
    for (const r of fu.records) {
      if (r.isEmpty === false && r.Team) {
        userTeamIdx = parseInt(r.Team.slice(-8), 2);
        break;
      }
    }

    console.log('\nUser preseason Week 0 game:');
    for (const g of gt.records) {
      if (g.isEmpty) continue;
      const wt = g.SeasonWeekType;
      if ((wt === 0 || wt === 'PreSeason') && g.SeasonWeek === 0) {
        const homeIdx = g.HomeTeam ? parseInt(g.HomeTeam.slice(-8), 2) : -1;
        const awayIdx = g.AwayTeam ? parseInt(g.AwayTeam.slice(-8), 2) : -1;

        if (homeIdx === userTeamIdx || awayIdx === userTeamIdx) {
          console.log('  ' + (teamMap[awayIdx] || 'UNK') + ' @ ' + (teamMap[homeIdx] || 'UNK'));
          console.log('  HomeTeam ref:', g.HomeTeam);
          console.log('  AwayTeam ref:', g.AwayTeam);
          console.log('  Home prefix:', g.HomeTeam ? g.HomeTeam.slice(0, 24) : 'null');
          console.log('  GameStatus:', g.GameStatus);
          console.log('  SeasonGameNum:', g.SeasonGameNum);
          console.log('  index:', g.index);
          break;
        }
      }
    }

    // Check game with SeasonGameNum = 0 (first game of week)
    console.log('\nFirst game of Week 0 (SeasonGameNum=0):');
    for (const g of gt.records) {
      if (g.isEmpty) continue;
      const wt = g.SeasonWeekType;
      if ((wt === 0 || wt === 'PreSeason') && g.SeasonWeek === 0 && g.SeasonGameNum === 0) {
        const homeIdx = g.HomeTeam ? parseInt(g.HomeTeam.slice(-8), 2) : -1;
        const awayIdx = g.AwayTeam ? parseInt(g.AwayTeam.slice(-8), 2) : -1;
        console.log('  ' + (teamMap[awayIdx] || 'UNK') + ' @ ' + (teamMap[homeIdx] || 'UNK'));
        console.log('  Is user game:', (homeIdx === userTeamIdx || awayIdx === userTeamIdx) ? 'YES' : 'NO');
        break;
      }
    }

    // Check what game is at record index 0 for preseason
    console.log('\nLowest record index preseason game:');
    let lowestIdx = 999999;
    let lowestGame = null;
    for (const g of gt.records) {
      if (g.isEmpty) continue;
      const wt = g.SeasonWeekType;
      if ((wt === 0 || wt === 'PreSeason') && g.index < lowestIdx) {
        lowestIdx = g.index;
        lowestGame = g;
      }
    }
    if (lowestGame) {
      const homeIdx = lowestGame.HomeTeam ? parseInt(lowestGame.HomeTeam.slice(-8), 2) : -1;
      const awayIdx = lowestGame.AwayTeam ? parseInt(lowestGame.AwayTeam.slice(-8), 2) : -1;
      console.log('  Record index:', lowestGame.index);
      console.log('  ' + (teamMap[awayIdx] || 'UNK') + ' @ ' + (teamMap[homeIdx] || 'UNK'));
      console.log('  SeasonGameNum:', lowestGame.SeasonGameNum);
      console.log('  GameStatus:', lowestGame.GameStatus);
    }
  }
}

compare().catch(console.error);
