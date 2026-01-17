/**
 * Check team reference format between 1980 and 2011
 */
const { create } = require('madden-franchise');

async function checkTeamRefFormat() {
  const file1980 = 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/CAREER-1980test-AUTOSAVE';
  const file2011 = 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/CAREER-2011THROWBACKV09';

  const f1980 = await create(file1980);
  const f2011 = await create(file2011);

  // Get FranchiseUser team reference
  const fu1980 = f1980.getTableByName('FranchiseUser');
  const fu2011 = f2011.getTableByName('FranchiseUser');

  await fu1980.readRecords();
  await fu2011.readRecords();

  let user1980 = null;
  let user2011 = null;
  for (const r of fu1980.records) {
    if (r.isEmpty === false) { user1980 = r; break; }
  }
  for (const r of fu2011.records) {
    if (r.isEmpty === false) { user2011 = r; break; }
  }

  console.log('=== FRANCHISE USER TEAM REFERENCE FORMAT ===');
  console.log('1980:', user1980?.Team);
  console.log('2011:', user2011?.Team);

  // Get SeasonGame tables
  const gt1980 = f1980.getTableByUniqueId(1607878349);
  const gt2011 = f2011.getTableByUniqueId(1607878349);

  await gt1980.readRecords();
  await gt2011.readRecords();

  console.log('\n=== REGULAR SEASON GAME TEAM REFERENCES ===');

  // Find a regular season game with teams in 1980
  for (const g of gt1980.records) {
    if (g.isEmpty) continue;
    const wt = g.SeasonWeekType;
    if (wt === 1 || wt === 'RegularSeason') {
      if (g.HomeTeam && g.HomeTeam !== '00000000000000000000000000000000') {
        console.log('1980 Regular Season Game:');
        console.log('  HomeTeam:', g.HomeTeam);
        console.log('  AwayTeam:', g.AwayTeam);
        console.log('  Home record idx:', parseInt(g.HomeTeam.slice(-8), 2));
        console.log('  Away record idx:', parseInt(g.AwayTeam.slice(-8), 2));
        break;
      }
    }
  }

  // Find a regular season game with teams in 2011
  for (const g of gt2011.records) {
    if (g.isEmpty) continue;
    const wt = g.SeasonWeekType;
    if (wt === 1 || wt === 'RegularSeason') {
      if (g.HomeTeam && g.HomeTeam !== '00000000000000000000000000000000') {
        console.log('2011 Regular Season Game:');
        console.log('  HomeTeam:', g.HomeTeam);
        console.log('  AwayTeam:', g.AwayTeam);
        console.log('  Home record idx:', parseInt(g.HomeTeam.slice(-8), 2));
        console.log('  Away record idx:', parseInt(g.AwayTeam.slice(-8), 2));
        break;
      }
    }
  }

  // Check prefix comparison
  console.log('\n=== TEAM REFERENCE PREFIX ===');
  console.log('1980 FranchiseUser prefix:', user1980?.Team?.slice(0, 24));
  console.log('2011 FranchiseUser prefix:', user2011?.Team?.slice(0, 24));

  // Get what team table uses
  const teamTable = f1980.getTableByUniqueId(637929298);
  console.log('\nTeam table uniqueId:', teamTable?.header?.uniqueId);
  console.log('Team table header tableId:', teamTable?.header?.tableId);
}

checkTeamRefFormat().catch(console.error);
