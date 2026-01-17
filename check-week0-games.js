/**
 * Check all Week 0 preseason games in order
 */
const { create } = require('madden-franchise');

async function check() {
  const f = await create('C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/CAREER-1980test');

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

  // Get user team
  const fu = f.getTableByName('FranchiseUser');
  await fu.readRecords();
  let userTeamIdx = -1;
  for (const r of fu.records) {
    if (r.isEmpty === false && r.Team) {
      userTeamIdx = parseInt(r.Team.slice(-8), 2);
      break;
    }
  }
  console.log('User team:', teamMap[userTeamIdx], '(index ' + userTeamIdx + ')');

  // Get games table
  const gt = f.getTableByUniqueId(1607878349);
  await gt.readRecords();

  // Find all week 0 preseason games in record order
  console.log('\nWeek 0 preseason games (in record order):');
  let gameNum = 0;
  for (const g of gt.records) {
    if (g.isEmpty) continue;
    const wt = g.SeasonWeekType;
    if ((wt === 0 || wt === 'PreSeason') && g.SeasonWeek === 0) {
      const homeRef = g.HomeTeam;
      const awayRef = g.AwayTeam;

      const homeIdx = homeRef ? parseInt(homeRef.slice(-8), 2) : -1;
      const awayIdx = awayRef ? parseInt(awayRef.slice(-8), 2) : -1;

      const homeName = teamMap[homeIdx] || 'UNK' + homeIdx;
      const awayName = teamMap[awayIdx] || 'UNK' + awayIdx;

      const isUserGame = (homeIdx === userTeamIdx || awayIdx === userTeamIdx) ? ' *** USER GAME ***' : '';
      const hasOAK = (homeName === 'OAK' || awayName === 'OAK') ? ' (RAIDERS)' : '';

      console.log('  Game ' + gameNum + ': ' + awayName + ' @ ' + homeName + ' [' + g.GameStatus + ']' + isUserGame + hasOAK);
      gameNum++;
    }
  }
}

check().catch(console.error);
