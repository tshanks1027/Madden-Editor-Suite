// Check the current schedule state in the franchise file

async function checkSchedule() {
  const module = await import('madden-franchise');

  const filePath = 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden NFL 26\\Saves\\CAREER-NOV23-05h38m58p-AUTOSAVE';
  const franchise = await module.create(filePath, {
    schemaDirectory: 'C:\\Users\\tshan\\AppData\\Local\\Programs\\MyFranchise'
  });

  // Get Team table
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

  // Get SeasonGame table
  let gameTable = franchise.getTableByUniqueId(2816609684);
  if (!gameTable) gameTable = franchise.getTableByName('SeasonGame');
  await gameTable.readRecords();

  // Find Browns games (teamIndex 4, recordIndex 5)
  console.log('=== All Games Involving Browns (recordIndex=5) ===\n');

  const brownsRecordIndex = 5;
  let brownsGames = [];

  for (const rec of gameTable.records) {
    if (rec.isEmpty) continue;
    if (rec.SeasonWeekType !== 1 && rec.SeasonWeekType !== 'RegularSeason') continue;

    const homeRI = rec.HomeTeam ? parseInt(rec.HomeTeam.slice(-8), 2) : -1;
    const awayRI = rec.AwayTeam ? parseInt(rec.AwayTeam.slice(-8), 2) : -1;

    if (homeRI === brownsRecordIndex || awayRI === brownsRecordIndex) {
      const home = recordIndexToTeam.get(homeRI);
      const away = recordIndexToTeam.get(awayRI);
      brownsGames.push({
        week: rec.SeasonWeek,
        home: home?.name || '?',
        away: away?.name || '?',
        homeRI,
        awayRI,
        isHome: homeRI === brownsRecordIndex
      });
    }
  }

  brownsGames.sort((a, b) => a.week - b.week);
  for (const game of brownsGames.slice(0, 20)) {
    console.log(`Week ${game.week}: ${game.away} @ ${game.home}${game.isHome ? ' (Browns home)' : ' (Browns away)'}`);
  }

  // Show all Week 0 and Week 1 games
  console.log('\n=== Week 0 Schedule ===\n');
  let w0Count = 0;
  for (const rec of gameTable.records) {
    if (rec.isEmpty) continue;
    if (rec.SeasonWeek !== 0) continue;
    if (rec.SeasonWeekType !== 1 && rec.SeasonWeekType !== 'RegularSeason') continue;

    w0Count++;
    const homeRI = rec.HomeTeam ? parseInt(rec.HomeTeam.slice(-8), 2) : -1;
    const awayRI = rec.AwayTeam ? parseInt(rec.AwayTeam.slice(-8), 2) : -1;
    const home = recordIndexToTeam.get(homeRI);
    const away = recordIndexToTeam.get(awayRI);
    console.log(`${w0Count.toString().padStart(2)}. ${away?.name || '?'} @ ${home?.name || '?'}`);
  }

  console.log('\n=== Week 1 Schedule ===\n');
  let w1Count = 0;
  for (const rec of gameTable.records) {
    if (rec.isEmpty) continue;
    if (rec.SeasonWeek !== 1) continue;
    if (rec.SeasonWeekType !== 1 && rec.SeasonWeekType !== 'RegularSeason') continue;

    w1Count++;
    const homeRI = rec.HomeTeam ? parseInt(rec.HomeTeam.slice(-8), 2) : -1;
    const awayRI = rec.AwayTeam ? parseInt(rec.AwayTeam.slice(-8), 2) : -1;
    const home = recordIndexToTeam.get(homeRI);
    const away = recordIndexToTeam.get(awayRI);
    console.log(`${w1Count.toString().padStart(2)}. ${away?.name || '?'} @ ${home?.name || '?'}`);
  }

  // Check SeasonInfo
  console.log('\n=== SeasonInfo ===\n');
  const seasonInfoTable = franchise.getTableByUniqueId(3123991521);
  if (seasonInfoTable) {
    await seasonInfoTable.readRecords();
    const rec = seasonInfoTable.records[0];
    if (rec) {
      console.log('CurrentSeasonYear:', rec.CurrentSeasonYear);
      console.log('CurrentWeek:', rec.CurrentWeek);
      console.log('CurrentWeekType:', rec.CurrentWeekType);
      console.log('SeasonYear:', rec.SeasonYear);
    }
  }
}

checkSchedule().catch(console.error);
