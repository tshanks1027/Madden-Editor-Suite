/**
 * Compare 1980 vs 2011 Throwback franchise files
 */
const { create } = require('madden-franchise');

async function compareFiles() {
  const file1980 = 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/CAREER-1980test-AUTOSAVE';
  const file2011 = 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/CAREER-2011THROWBACKV09';

  console.log('Loading both files...');
  const f1980 = await create(file1980);
  const f2011 = await create(file2011);

  // Compare FranchiseUser
  console.log('\n=== FRANCHISE USER COMPARISON ===');
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

  console.log('1980 Team ref:', user1980?.Team);
  console.log('2011 Team ref:', user2011?.Team);

  // Decode team record index
  if (user1980?.Team) {
    const recIdx1980 = parseInt(user1980.Team.slice(-8), 2);
    console.log('1980 Team record index:', recIdx1980);
  }
  if (user2011?.Team) {
    const recIdx2011 = parseInt(user2011.Team.slice(-8), 2);
    console.log('2011 Team record index:', recIdx2011);
  }

  // Compare SeasonInfo
  console.log('\n=== SEASON INFO COMPARISON ===');
  const si1980 = f1980.getTableByName('SeasonInfo');
  const si2011 = f2011.getTableByName('SeasonInfo');

  await si1980.readRecords();
  await si2011.readRecords();

  let info1980 = null;
  let info2011 = null;
  for (const r of si1980.records) {
    if (r.isEmpty === false) { info1980 = r; break; }
  }
  for (const r of si2011.records) {
    if (r.isEmpty === false) { info2011 = r; break; }
  }

  const fields = ['CurrentWeek', 'CurrentSeasonWeek', 'SeasonWeekType', 'CurrentYear', 'NflSeasonWeekCount', 'SeasonYear'];
  for (const field of fields) {
    console.log(field + ': 1980=' + info1980?.[field] + ', 2011=' + info2011?.[field]);
  }

  // Compare preseason game fields
  console.log('\n=== PRESEASON GAME FIELDS COMPARISON ===');
  const gt1980 = f1980.getTableByUniqueId(1607878349);
  const gt2011 = f2011.getTableByUniqueId(1607878349);

  await gt1980.readRecords();
  await gt2011.readRecords();

  // Get first preseason week 0 game from each
  let game1980 = null;
  let game2011 = null;

  for (const g of gt1980.records) {
    if (g.isEmpty) continue;
    const wt = g.SeasonWeekType;
    if ((wt === 0 || wt === 'PreSeason') && g.SeasonWeek === 0) {
      game1980 = g;
      break;
    }
  }

  for (const g of gt2011.records) {
    if (g.isEmpty) continue;
    const wt = g.SeasonWeekType;
    if ((wt === 0 || wt === 'PreSeason') && g.SeasonWeek === 0) {
      game2011 = g;
      break;
    }
  }

  if (game1980 && game2011) {
    console.log('\nFirst preseason game comparison:');
    const gameFields = ['GameStatus', 'SeasonGameNum', 'DayOfWeek', 'TimeOfDay', 'Stadium', 'IsPracticeMode', 'HomeTeam', 'AwayTeam'];
    for (const field of gameFields) {
      const v1980 = game1980[field];
      const v2011 = game2011[field];
      const match = v1980 === v2011 ? '✓' : '✗';
      console.log('  ' + field + ': 1980=' + v1980 + ', 2011=' + v2011 + ' ' + match);
    }
  }

  // Check for ScheduleWeekState or similar tables
  console.log('\n=== SCHEDULE/WEEK STATE TABLES ===');
  for (const table of f2011.tables) {
    if (table.name && (table.name.includes('Schedule') || table.name.includes('Week'))) {
      console.log('  ' + table.name);
    }
  }
}

compareFiles().catch(console.error);
