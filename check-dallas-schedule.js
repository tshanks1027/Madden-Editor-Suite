/**
 * Check Dallas Cowboys preseason schedule
 */
const { create } = require('madden-franchise');

async function check() {
  const files = [
    { name: '1980test', path: 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/CAREER-1980test' },
    { name: '2011 Throwback', path: 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/CAREER-2011THROWBACKV09' }
  ];

  for (const file of files) {
    console.log('\n========== ' + file.name + ' ==========');
    const f = await create(file.path);

    // Get team table
    const tt = f.getTableByUniqueId(637929298);
    await tt.readRecords();

    const teamMap = {};
    let dalIdx = -1;
    let neIdx = -1;
    let idx = 0;
    for (const t of tt.records) {
      if (t.isEmpty === false) {
        teamMap[idx] = t.ShortName;
        if (t.ShortName === 'DAL') dalIdx = idx;
        if (t.ShortName === 'NE') neIdx = idx;
      }
      idx++;
    }

    // Get user's team index
    const fu = f.getTableByName('FranchiseUser');
    await fu.readRecords();
    let userTeamIdx = -1;
    let userTeamPrefix = '';
    for (const r of fu.records) {
      if (r.isEmpty === false && r.Team) {
        userTeamIdx = parseInt(r.Team.slice(-8), 2);
        userTeamPrefix = r.Team.slice(0, 24);
        break;
      }
    }

    console.log('User team:', teamMap[userTeamIdx], '(index ' + userTeamIdx + ')');

    // Get games table
    const gt = f.getTableByUniqueId(1607878349);
    await gt.readRecords();

    // Find all preseason games involving user's team
    console.log('\nPreseason games involving user team:');
    for (const g of gt.records) {
      if (g.isEmpty) continue;
      const wt = g.SeasonWeekType;
      if (wt === 0 || wt === 'PreSeason') {
        const homeRef = g.HomeTeam;
        const awayRef = g.AwayTeam;

        if (!homeRef || !awayRef) continue;

        const homeIdx = parseInt(homeRef.slice(-8), 2);
        const awayIdx = parseInt(awayRef.slice(-8), 2);

        if (homeIdx === userTeamIdx || awayIdx === userTeamIdx) {
          const homeName = teamMap[homeIdx] || 'UNK' + homeIdx;
          const awayName = teamMap[awayIdx] || 'UNK' + awayIdx;
          const isHome = homeIdx === userTeamIdx ? ' (USER HOME)' : '';
          const isAway = awayIdx === userTeamIdx ? ' (USER AWAY)' : '';

          console.log('  Week ' + g.SeasonWeek + ': ' + awayName + isAway + ' @ ' + homeName + isHome);
          console.log('    GameStatus:', g.GameStatus);
        }
      }
    }
  }
}

check().catch(console.error);
