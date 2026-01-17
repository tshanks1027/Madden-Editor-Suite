/**
 * Compare preseason structure between 1980 and 2011
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
    console.log('User team:', teamMap[userTeamIdx] || 'Unknown', '(index ' + userTeamIdx + ')');

    const gt = f.getTableByUniqueId(1607878349);
    await gt.readRecords();

    // Show first 5 Week 0 games with all relevant fields
    console.log('\nFirst Week 0 games (record index order):');
    let count = 0;
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

        const isUserGame = (homeIdx === userTeamIdx || awayIdx === userTeamIdx) ? ' *** USER ***' : '';

        console.log('  rec.index=' + g.index + ' SGN=' + g.SeasonGameNum + ' ' + awayName + '@' + homeName + ' [' + g.GameStatus + ']' + isUserGame);
        count++;
        if (count >= 10) break;
      }
    }

    // Show user's preseason games
    console.log('\nUser preseason games (all weeks):');
    for (const g of gt.records) {
      if (g.isEmpty) continue;
      const wt = g.SeasonWeekType;
      if (wt === 0 || wt === 'PreSeason') {
        const homeRef = g.HomeTeam;
        const awayRef = g.AwayTeam;
        const homeIdx = homeRef ? parseInt(homeRef.slice(-8), 2) : -1;
        const awayIdx = awayRef ? parseInt(awayRef.slice(-8), 2) : -1;

        if (homeIdx === userTeamIdx || awayIdx === userTeamIdx) {
          const homeName = teamMap[homeIdx] || 'UNK';
          const awayName = teamMap[awayIdx] || 'UNK';
          const role = homeIdx === userTeamIdx ? '(HOME)' : '(AWAY)';

          console.log('  Week ' + g.SeasonWeek + ': ' + awayName + '@' + homeName + ' ' + role + ' rec.index=' + g.index + ' SGN=' + g.SeasonGameNum);
        }
      }
    }
  }
}

check().catch(console.error);
