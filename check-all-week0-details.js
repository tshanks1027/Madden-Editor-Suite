/**
 * Check EVERY Week 0 game with ALL fields
 */
const { create } = require('madden-franchise');

async function check() {
  const f = await create('C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/CAREER-PRESEASONWK1');

  // Get team table
  const tt = f.getTableByUniqueId(637929298);
  await tt.readRecords();
  const teamMap = {};
  let idx = 0;
  for (const t of tt.records) {
    if (t.isEmpty === false) teamMap[idx] = t.ShortName;
    idx++;
  }

  // Get user team
  const fu = f.getTableByName('FranchiseUser');
  await fu.readRecords();
  let userTeamIdx = -1;
  let userTeamRef = '';
  for (const r of fu.records) {
    if (r.isEmpty === false && r.Team) {
      userTeamIdx = parseInt(r.Team.slice(-8), 2);
      userTeamRef = r.Team;
      break;
    }
  }
  console.log('User team:', teamMap[userTeamIdx], 'ref:', userTeamRef);

  const gt = f.getTableByUniqueId(1607878349);
  await gt.readRecords();

  // Get ALL fields for one game to see what's available
  console.log('\n=== ALL GAME FIELDS ===');
  for (const g of gt.records) {
    if (g.isEmpty) continue;
    const fields = Object.keys(g).filter(k => !k.startsWith('_'));
    console.log('Fields:', fields.join(', '));
    break;
  }

  // Check every Week 0 game
  console.log('\n=== ALL WEEK 0 GAMES ===');
  const games = [];
  for (const g of gt.records) {
    if (g.isEmpty) continue;
    const wt = g.SeasonWeekType;
    if ((wt === 0 || wt === 'PreSeason') && g.SeasonWeek === 0) {
      games.push(g);
    }
  }

  // Sort by record index
  games.sort((a, b) => a.index - b.index);

  for (const g of games) {
    const homeIdx = g.HomeTeam ? parseInt(g.HomeTeam.slice(-8), 2) : -1;
    const awayIdx = g.AwayTeam ? parseInt(g.AwayTeam.slice(-8), 2) : -1;
    const isUser = (homeIdx === userTeamIdx || awayIdx === userTeamIdx);

    console.log('\n--- idx=' + g.index + ' ' + (teamMap[awayIdx] || 'UNK') + '@' + (teamMap[homeIdx] || 'UNK') + (isUser ? ' **USER**' : '') + ' ---');
    console.log('  HomeTeam:', g.HomeTeam);
    console.log('  AwayTeam:', g.AwayTeam);
    console.log('  GameStatus:', g.GameStatus);
    console.log('  SeasonGameNum:', g.SeasonGameNum);
    console.log('  SeasonWeek:', g.SeasonWeek);
    console.log('  SeasonWeekType:', g.SeasonWeekType);
    console.log('  IsPracticeGame:', g.IsPracticeGame);
    console.log('  IsExhibitionGame:', g.IsExhibitionGame);
    console.log('  IsFeatured:', g.IsFeatured);
  }
}

check().catch(console.error);
