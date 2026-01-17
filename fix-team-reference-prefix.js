/**
 * Fix team reference prefix in 1980 franchise file
 * The prefix needs to match what the game expects for Team table references
 */
const { create } = require('madden-franchise');

async function fixTeamReferencePrefix() {
  const filePath = 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/CAREER-1980test-AUTOSAVE';

  console.log('Loading franchise file...');
  const franchise = await create(filePath);

  // Get the correct prefix from FranchiseUser.Team (which is known to work)
  const fu = franchise.getTableByName('FranchiseUser');
  await fu.readRecords();

  let correctPrefix = null;
  for (const r of fu.records) {
    if (r.isEmpty === false && r.Team) {
      correctPrefix = r.Team.slice(0, 24);
      console.log('Correct prefix from FranchiseUser:', correctPrefix);
      break;
    }
  }

  if (!correctPrefix) {
    console.log('ERROR: Could not find correct prefix from FranchiseUser');
    return;
  }

  // Get SeasonGame table
  const gameTable = franchise.getTableByUniqueId(1607878349);
  await gameTable.readRecords();

  let gamesFixed = 0;

  for (const record of gameTable.records) {
    if (record.isEmpty) continue;

    // Fix HomeTeam if it has a reference
    if (record.HomeTeam && record.HomeTeam !== '00000000000000000000000000000000') {
      const oldPrefix = record.HomeTeam.slice(0, 24);
      if (oldPrefix !== correctPrefix) {
        const recordIndex = record.HomeTeam.slice(-8);
        record.HomeTeam = correctPrefix + recordIndex;
        gamesFixed++;
      }
    }

    // Fix AwayTeam if it has a reference
    if (record.AwayTeam && record.AwayTeam !== '00000000000000000000000000000000') {
      const oldPrefix = record.AwayTeam.slice(0, 24);
      if (oldPrefix !== correctPrefix) {
        const recordIndex = record.AwayTeam.slice(-8);
        record.AwayTeam = correctPrefix + recordIndex;
      }
    }
  }

  console.log('Fixed', gamesFixed, 'game records with incorrect prefix');

  // Save
  console.log('Saving...');
  await franchise.save(filePath);
  console.log('Done!');

  // Verify
  console.log('\n=== VERIFICATION ===');
  const franchise2 = await create(filePath);
  const gameTable2 = franchise2.getTableByUniqueId(1607878349);
  await gameTable2.readRecords();

  for (const record of gameTable2.records) {
    if (record.isEmpty) continue;
    const wt = record.SeasonWeekType;
    if ((wt === 0 || wt === 'PreSeason') && record.SeasonWeek === 0) {
      console.log('Preseason Week 0 game:');
      console.log('  HomeTeam:', record.HomeTeam);
      console.log('  AwayTeam:', record.AwayTeam);
      console.log('  Prefix matches:', record.HomeTeam.slice(0, 24) === correctPrefix ? 'YES' : 'NO');
      break;
    }
  }
}

fixTeamReferencePrefix().catch(console.error);
