// Compare team mappings between Team table and game references

async function compareMappings() {
  const module = await import('madden-franchise');
  const franchise = await module.create('C:\\Users\\tshan\\OneDrive\\Documents\\Madden NFL 26\\Saves\\CAREER-NOV23-05h38m58p-AUTOSAVE', {
    schemaDirectory: 'C:\\Users\\tshan\\AppData\\Local\\Programs\\MyFranchise'
  });

  // Build team lookup
  const teamTable = franchise.getTableByName('Team');
  await teamTable.readRecords();

  console.log('=== All Teams by RecordIndex ===\n');
  console.log('RecordIndex | TeamIndex | ShortName | LongName');
  console.log('------------|-----------|-----------|----------');

  const allTeams = [];
  for (const team of teamTable.records) {
    if (team.isEmpty) continue;
    allTeams.push({
      recordIndex: team.index,
      teamIndex: team.TeamIndex,
      shortName: team.ShortName,
      longName: team.LongName
    });
  }

  // Sort by recordIndex
  allTeams.sort((a, b) => a.recordIndex - b.recordIndex);

  for (const t of allTeams) {
    console.log(`     ${t.recordIndex.toString().padStart(2)}      |     ${(t.teamIndex ?? '?').toString().padStart(2)}    | ${(t.shortName || '').padEnd(9)} | ${t.longName || ''}`);
  }

  // Build the map
  const recordIndexToTeam = new Map();
  for (const t of allTeams) {
    if (t.teamIndex !== undefined && t.teamIndex < 32) {
      recordIndexToTeam.set(t.recordIndex, t);
    }
  }

  // Now read some games and check
  const seasonGameTable = franchise.getTableByName('SeasonGame');
  await seasonGameTable.readRecords();

  console.log('\n=== Week 1 Games with Team Lookup ===\n');

  let gameCount = 0;
  for (const record of seasonGameTable.records) {
    if (record.isEmpty) continue;
    if (record.SeasonWeek !== 1) continue;
    if (record.SeasonWeekType !== 'RegularSeason') continue;

    const homeTeamRef = record.HomeTeam;
    const awayTeamRef = record.AwayTeam;

    const homeRecordIndex = parseInt(homeTeamRef.slice(-8), 2);
    const awayRecordIndex = parseInt(awayTeamRef.slice(-8), 2);

    const homeTeam = recordIndexToTeam.get(homeRecordIndex);
    const awayTeam = recordIndexToTeam.get(awayRecordIndex);

    gameCount++;
    console.log(`Game ${gameCount}: ${awayTeam?.shortName || `RI=${awayRecordIndex}`} @ ${homeTeam?.shortName || `RI=${homeRecordIndex}`}`);

    if (gameCount >= 16) break;
  }
}

compareMappings().catch(console.error);
