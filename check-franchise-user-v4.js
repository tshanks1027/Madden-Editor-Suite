// Check FranchiseUser table fields - Get actual values

async function checkFranchiseUser() {
  const module = await import('madden-franchise');

  const filePath = 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden NFL 26\\Saves\\CAREER-NOV23-05h38m58p-AUTOSAVE';
  const franchise = await module.create(filePath, {
    schemaDirectory: 'C:\\Users\\tshan\\AppData\\Local\\Programs\\MyFranchise'
  });

  // Get Team table first to decode team references
  const teamTable = franchise.getTableByUniqueId(637929298);
  await teamTable.readRecords();

  const recordIndexToTeam = new Map();
  for (const team of teamTable.records) {
    if (team.isEmpty) continue;
    if (team.TeamIndex !== undefined && team.TeamIndex < 32) {
      recordIndexToTeam.set(team.index, {
        name: team.ShortName,
        city: team.LongName,
        teamIndex: team.TeamIndex
      });
    }
  }

  console.log('=== FranchiseUser Table - Actual Values ===\n');
  const franchiseUserTable = franchise.getTableByName('FranchiseUser');
  if (franchiseUserTable) {
    await franchiseUserTable.readRecords();

    for (const rec of franchiseUserTable.records) {
      if (rec.isEmpty) continue;
      console.log('FranchiseUser record', rec.index, ':');

      // Get Team field value directly
      try {
        const teamVal = rec.Team;
        console.log('  Team (raw):', teamVal);
        if (teamVal && typeof teamVal === 'string' && teamVal.length === 32) {
          const recordIndex = parseInt(teamVal.slice(-8), 2);
          const teamInfo = recordIndexToTeam.get(recordIndex);
          console.log('  Team (decoded): recordIndex=' + recordIndex, teamInfo || 'Unknown');
        }
      } catch (e) {
        console.log('  Team error:', e.message);
      }

      // Check TeamSetting
      try {
        const teamSetting = rec.TeamSetting;
        console.log('  TeamSetting (raw):', teamSetting);
        if (teamSetting && typeof teamSetting === 'string' && teamSetting.length === 32) {
          const recordIndex = parseInt(teamSetting.slice(-8), 2);
          const teamInfo = recordIndexToTeam.get(recordIndex);
          console.log('  TeamSetting (decoded): recordIndex=' + recordIndex, teamInfo || 'Unknown');
        }
      } catch (e) {
        console.log('  TeamSetting error:', e.message);
      }

      // Check UserEntity
      try {
        console.log('  UserEntity:', rec.UserEntity);
      } catch (e) {
        console.log('  UserEntity error:', e.message);
      }
      console.log('');
    }
  }

  // Check SchedulerUser table if exists
  console.log('=== SchedulerUser Table ===\n');
  const schedulerUserTable = franchise.getTableByName('SchedulerUser');
  if (schedulerUserTable) {
    await schedulerUserTable.readRecords();
    console.log('Records:', schedulerUserTable.records.length);
    for (const rec of schedulerUserTable.records) {
      if (rec.isEmpty) continue;
      console.log('SchedulerUser record', rec.index, ':');
      try {
        console.log('  HomeTeam:', rec.HomeTeam);
        console.log('  AwayTeam:', rec.AwayTeam);
        console.log('  Team:', rec.Team);
      } catch (e) {}
    }
  } else {
    console.log('No SchedulerUser table found');
  }

  // Check SeasonGame records for user game
  console.log('\n=== First SeasonGame Week 0 records ===\n');
  let gameTable = franchise.getTableByUniqueId(2816609684);
  if (!gameTable) gameTable = franchise.getTableByName('SeasonGame');
  await gameTable.readRecords();

  let count = 0;
  for (const rec of gameTable.records) {
    if (rec.isEmpty) continue;
    if (rec.SeasonWeek !== 0) continue;
    if (rec.SeasonWeekType !== 1 && rec.SeasonWeekType !== 'RegularSeason') continue;
    count++;
    if (count <= 3) {
      console.log(`Game ${count}:`);
      console.log('  HomeTeam:', rec.HomeTeam);
      console.log('  AwayTeam:', rec.AwayTeam);
      console.log('  IsFranchiseUserGame:', rec.IsFranchiseUserGame);
      console.log('  IsUserGame:', rec.IsUserGame);
      console.log('  IsUserControlled:', rec.IsUserControlled);

      // Decode teams
      if (rec.HomeTeam && rec.HomeTeam.length === 32) {
        const ri = parseInt(rec.HomeTeam.slice(-8), 2);
        console.log('  Home decoded:', recordIndexToTeam.get(ri));
      }
      if (rec.AwayTeam && rec.AwayTeam.length === 32) {
        const ri = parseInt(rec.AwayTeam.slice(-8), 2);
        console.log('  Away decoded:', recordIndexToTeam.get(ri));
      }
      console.log('');
    }
  }
  console.log(`Total Week 0 RegularSeason games: ${count}`);
}

checkFranchiseUser().catch(console.error);
