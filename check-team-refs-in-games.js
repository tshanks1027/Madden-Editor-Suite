/**
 * Check if team references in games resolve correctly
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

    // Get team table to understand the reference format
    const tt = f.getTableByUniqueId(637929298);
    await tt.readRecords();

    // Build a map of record index to team name
    const teamMap = {};
    let idx = 0;
    for (const t of tt.records) {
      if (t.isEmpty === false) {
        teamMap[idx] = t.ShortName || 'Team' + idx;
      }
      idx++;
    }

    // Get games table
    const gt = f.getTableByUniqueId(1607878349);
    await gt.readRecords();

    // Check a few preseason games
    console.log('\nPreseason games (first 5):');
    let count = 0;
    for (const g of gt.records) {
      if (g.isEmpty) continue;
      const wt = g.SeasonWeekType;
      if (wt === 0 || wt === 'PreSeason') {
        const homeRef = g.HomeTeam;
        const awayRef = g.AwayTeam;

        // Extract record index from last 8 bits
        const homeIdx = homeRef ? parseInt(homeRef.slice(-8), 2) : -1;
        const awayIdx = awayRef ? parseInt(awayRef.slice(-8), 2) : -1;

        const homeName = teamMap[homeIdx] || 'UNKNOWN(' + homeIdx + ')';
        const awayName = teamMap[awayIdx] || 'UNKNOWN(' + awayIdx + ')';

        console.log('  Week ' + g.SeasonWeek + ': ' + awayName + ' @ ' + homeName);
        console.log('    HomeTeam ref: ' + homeRef);
        console.log('    AwayTeam ref: ' + awayRef);
        console.log('    Home record index: ' + homeIdx + ', Away record index: ' + awayIdx);

        count++;
        if (count >= 5) break;
      }
    }

    // Check the team reference prefix
    console.log('\nTeam reference prefix analysis:');
    const fu = f.getTableByName('FranchiseUser');
    await fu.readRecords();
    for (const r of fu.records) {
      if (r.isEmpty === false && r.Team) {
        console.log('FranchiseUser.Team prefix: ' + r.Team.slice(0, 24));
        break;
      }
    }

    // Check a game's prefix
    for (const g of gt.records) {
      if (g.isEmpty) continue;
      if (g.HomeTeam && g.HomeTeam !== '00000000000000000000000000000000') {
        console.log('SeasonGame.HomeTeam prefix: ' + g.HomeTeam.slice(0, 24));
        break;
      }
    }
  }
}

check().catch(console.error);
