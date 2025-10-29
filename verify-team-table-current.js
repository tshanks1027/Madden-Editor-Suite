const Franchise = require('madden-franchise');

const FRANCHISE_FILE = 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden NFL 26\\Saves\\CAREER-TEST';

async function verifyTeamTable() {
  console.log('Opening franchise file...');
  const franchise = await Franchise.create(FRANCHISE_FILE, { gameYearOverride: 26 });

  const teamTable = franchise.getTableByName('Team');
  await teamTable.readRecords();

  console.log(`\nTeam table has ${teamTable.records.length} records\n`);

  teamTable.records.forEach((team, idx) => {
    if (team.isEmpty) {
      console.log(`Record ${idx}: EMPTY`);
      return;
    }

    const teamIndex = team.TeamIndex !== undefined ? team.TeamIndex : 'undefined';
    const cityName = team.CityName || 'N/A';
    const displayName = team.DisplayName || 'N/A';
    const longName = team.LongName || 'N/A';
    const nickname = team.Nickname || 'N/A';

    console.log(`Record ${idx}: TeamIndex=${teamIndex}, City="${cityName}", Display="${displayName}", Long="${longName}", Nickname="${nickname}"`);
  });

  // Check what TeamIndex values would pass the filter (1-32)
  const filteredTeams = teamTable.records.filter(team => {
    if (team.isEmpty) return false;
    const teamId = team.TeamIndex !== undefined ? team.TeamIndex : -1;
    return teamId >= 1 && teamId <= 32;
  });

  console.log(`\n${filteredTeams.length} teams pass the filter (TeamIndex 1-32)`);
  filteredTeams.forEach(team => {
    console.log(`  TeamIndex ${team.TeamIndex}`);
  });

  await franchise.close();
}

verifyTeamTable().catch(console.error);
