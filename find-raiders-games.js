/**
 * Find all Raiders games and their order
 */
const { create } = require('madden-franchise');

async function find() {
  const files = [
    { name: '2011 Throwback (WORKING)', path: 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/CAREER-2011THROWBACKV09' },
    { name: 'PRESEASONWK1 (BROKEN)', path: 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/CAREER-PRESEASONWK1' }
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
    let oakIdx = -1;
    let idx = 0;
    for (const t of tt.records) {
      if (t.isEmpty === false) {
        teamMap[idx] = t.ShortName;
        if (t.ShortName === 'OAK' || t.ShortName === 'LV') oakIdx = idx;
      }
      idx++;
    }
    console.log('Raiders index:', oakIdx, '(' + teamMap[oakIdx] + ')');

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
    console.log('User team index:', userTeamIdx, '(' + teamMap[userTeamIdx] + ')');

    const gt = f.getTableByUniqueId(1607878349);
    await gt.readRecords();

    // Find all Raiders preseason games
    console.log('\nRaiders preseason games:');
    for (const g of gt.records) {
      if (g.isEmpty) continue;
      const wt = g.SeasonWeekType;
      if (wt === 0 || wt === 'PreSeason') {
        const homeIdx = g.HomeTeam ? parseInt(g.HomeTeam.slice(-8), 2) : -1;
        const awayIdx = g.AwayTeam ? parseInt(g.AwayTeam.slice(-8), 2) : -1;

        if (homeIdx === oakIdx || awayIdx === oakIdx) {
          console.log('  Week ' + g.SeasonWeek + ': ' + (teamMap[awayIdx] || 'UNK') + ' @ ' + (teamMap[homeIdx] || 'UNK'));
          console.log('    SeasonGameNum=' + g.SeasonGameNum + ', index=' + g.index + ', Status=' + g.GameStatus);
        }
      }
    }

    // Find user's preseason games
    console.log('\nUser (' + teamMap[userTeamIdx] + ') preseason games:');
    for (const g of gt.records) {
      if (g.isEmpty) continue;
      const wt = g.SeasonWeekType;
      if (wt === 0 || wt === 'PreSeason') {
        const homeIdx = g.HomeTeam ? parseInt(g.HomeTeam.slice(-8), 2) : -1;
        const awayIdx = g.AwayTeam ? parseInt(g.AwayTeam.slice(-8), 2) : -1;

        if (homeIdx === userTeamIdx || awayIdx === userTeamIdx) {
          console.log('  Week ' + g.SeasonWeek + ': ' + (teamMap[awayIdx] || 'UNK') + ' @ ' + (teamMap[homeIdx] || 'UNK'));
          console.log('    SeasonGameNum=' + g.SeasonGameNum + ', index=' + g.index + ', Status=' + g.GameStatus);
        }
      }
    }

    // Check if any game has user as participant but wrong team showing
    console.log('\nAll Week 0 games sorted by SeasonGameNum:');
    const week0Games = [];
    for (const g of gt.records) {
      if (g.isEmpty) continue;
      const wt = g.SeasonWeekType;
      if ((wt === 0 || wt === 'PreSeason') && g.SeasonWeek === 0) {
        week0Games.push(g);
      }
    }
    week0Games.sort((a, b) => a.SeasonGameNum - b.SeasonGameNum);
    for (const g of week0Games) {
      const homeIdx = g.HomeTeam ? parseInt(g.HomeTeam.slice(-8), 2) : -1;
      const awayIdx = g.AwayTeam ? parseInt(g.AwayTeam.slice(-8), 2) : -1;
      const isUser = (homeIdx === userTeamIdx || awayIdx === userTeamIdx) ? ' **USER**' : '';
      const isRaiders = (homeIdx === oakIdx || awayIdx === oakIdx) ? ' [RAIDERS]' : '';
      console.log('  SGN=' + g.SeasonGameNum + ': ' + (teamMap[awayIdx] || 'UNK') + '@' + (teamMap[homeIdx] || 'UNK') + isUser + isRaiders);
    }
  }
}

find().catch(console.error);
