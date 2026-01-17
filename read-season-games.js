// Read SeasonGame table and show actual game data

async function readSeasonGames() {
  const module = await import('madden-franchise');
  const franchise = await module.create('C:\\Users\\tshan\\OneDrive\\Documents\\Madden NFL 26\\Saves\\CAREER-NOV23-05h38m58p-AUTOSAVE', {
    schemaDirectory: 'C:\\Users\\tshan\\AppData\\Local\\Programs\\MyFranchise'
  });

  // Build team lookup first
  const teamTable = franchise.getTableByName('Team');
  await teamTable.readRecords();

  const recordIndexToTeam = new Map();
  for (const team of teamTable.records) {
    if (team.isEmpty) continue;
    const teamIndex = team.TeamIndex;
    if (teamIndex !== undefined && teamIndex < 32) {
      recordIndexToTeam.set(team.index, {
        shortName: team.ShortName,
        longName: team.LongName
      });
    }
  }

  // Read SeasonGame table
  const seasonGameTable = franchise.getTableByName('SeasonGame');
  await seasonGameTable.readRecords();

  console.log('=== Week 1 Regular Season Games ===\n');

  let gameCount = 0;
  for (const record of seasonGameTable.records) {
    if (record.isEmpty) continue;

    // Access fields directly
    const seasonWeek = record.SeasonWeek;
    const seasonWeekType = record.SeasonWeekType;

    // Only show Week 1 Regular Season games
    if (seasonWeek !== 1) continue;
    if (seasonWeekType !== 1 && seasonWeekType !== 'RegularSeason') continue;

    const homeTeamRef = record.HomeTeam;
    const awayTeamRef = record.AwayTeam;

    console.log(`Game ${++gameCount}:`);
    console.log(`  SeasonWeek: ${seasonWeek}`);
    console.log(`  SeasonWeekType: ${seasonWeekType}`);
    console.log(`  HomeTeam raw: ${homeTeamRef}`);
    console.log(`  AwayTeam raw: ${awayTeamRef}`);

    // Parse the team reference
    if (homeTeamRef && typeof homeTeamRef === 'string' && homeTeamRef.length === 32) {
      const homeRecordIndex = parseInt(homeTeamRef.slice(-8), 2);
      const awayRecordIndex = awayTeamRef ? parseInt(awayTeamRef.slice(-8), 2) : -1;
      const homeTeam = recordIndexToTeam.get(homeRecordIndex);
      const awayTeam = recordIndexToTeam.get(awayRecordIndex);
      console.log(`  Home: ${homeTeam?.shortName || 'UNKNOWN'} (RecordIndex ${homeRecordIndex})`);
      console.log(`  Away: ${awayTeam?.shortName || 'UNKNOWN'} (RecordIndex ${awayRecordIndex})`);
      console.log(`  Matchup: ${awayTeam?.shortName || '?'} @ ${homeTeam?.shortName || '?'}`);
    }

    console.log('');

    if (gameCount >= 16) break;
  }
}

readSeasonGames().catch(console.error);
