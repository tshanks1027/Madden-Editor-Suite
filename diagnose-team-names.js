// Check all team name fields to diagnose why names are mismatched

const TABLE_IDS = {
  teamTable: 637929298,
};

async function diagnoseTeams() {
  const module = await import('madden-franchise');

  const filePath = 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden NFL 26\\Saves\\CAREER-NOV23-05h38m58p-AUTOSAVE';
  const franchise = await module.create(filePath, {
    schemaDirectory: 'C:\\Users\\tshan\\AppData\\Local\\Programs\\MyFranchise'
  });

  const teamTable = franchise.getTableByUniqueId(TABLE_IDS.teamTable);
  await teamTable.readRecords();

  console.log('=== All Teams in Franchise File ===\n');
  console.log('RecIdx | TeamIdx | ShortName | LongName      | DisplayName   | NickName');
  console.log('-------|---------|-----------|---------------|---------------|----------');

  const teams = [];
  for (const team of teamTable.records) {
    if (team.isEmpty) continue;
    teams.push({
      ri: team.index,
      ti: team.TeamIndex,
      short: team.ShortName || '',
      long: team.LongName || '',
      display: team.DisplayName || '',
      nick: team.NickName || ''
    });
  }

  // Sort by TeamIndex
  teams.sort((a, b) => (a.ti ?? 999) - (b.ti ?? 999));

  for (const t of teams) {
    console.log(
      `${(t.ri ?? '?').toString().padStart(6)} | ${(t.ti ?? '?').toString().padStart(7)} | ${t.short.padEnd(9)} | ${t.long.padEnd(13)} | ${t.display.padEnd(13)} | ${t.nick}`
    );
  }

  // Check for any teams with mismatched names (e.g., Green Bay with Redskins)
  console.log('\n=== Checking for Mismatched Team Names ===\n');
  for (const t of teams) {
    const expected = getExpectedTeam(t.ti);
    if (!expected) continue;

    const issues = [];
    if (t.short && !expected.shorts.includes(t.short)) {
      issues.push(`ShortName "${t.short}" unexpected (expected: ${expected.shorts.join('/')})`);
    }
    if (t.long && !expected.cities.some(c => t.long.includes(c))) {
      issues.push(`LongName "${t.long}" unexpected (expected city: ${expected.cities.join('/')})`);
    }
    if (t.display && !expected.names.some(n => t.display.includes(n))) {
      issues.push(`DisplayName "${t.display}" unexpected (expected: ${expected.names.join('/')})`);
    }

    if (issues.length > 0) {
      console.log(`TeamIndex ${t.ti} (${expected.current}):`);
      issues.forEach(i => console.log(`  - ${i}`));
    }
  }
}

// Helper: expected team info by TeamIndex
function getExpectedTeam(teamIndex) {
  const teams = {
    0: { current: 'Bears', cities: ['Chicago'], names: ['Bears'], shorts: ['CHI'] },
    1: { current: 'Bengals', cities: ['Cincinnati'], names: ['Bengals'], shorts: ['CIN'] },
    2: { current: 'Bills', cities: ['Buffalo'], names: ['Bills'], shorts: ['BUF'] },
    3: { current: 'Broncos', cities: ['Denver'], names: ['Broncos'], shorts: ['DEN'] },
    4: { current: 'Browns', cities: ['Cleveland'], names: ['Browns'], shorts: ['CLE'] },
    5: { current: 'Buccaneers', cities: ['Tampa Bay', 'Tampa'], names: ['Buccaneers', 'Bucs'], shorts: ['TB', 'TAM'] },
    6: { current: 'Cardinals', cities: ['Arizona', 'Phoenix', 'St. Louis', 'Chicago'], names: ['Cardinals'], shorts: ['ARI', 'AZ', 'PHX', 'STL', 'CHI'] },
    7: { current: 'Chargers', cities: ['Los Angeles', 'San Diego'], names: ['Chargers'], shorts: ['LAC', 'SD', 'LA'] },
    8: { current: 'Chiefs', cities: ['Kansas City', 'Dallas'], names: ['Chiefs', 'Texans'], shorts: ['KC', 'DAL'] },
    9: { current: 'Colts', cities: ['Indianapolis', 'Baltimore'], names: ['Colts'], shorts: ['IND', 'BAL'] },
    10: { current: 'Cowboys', cities: ['Dallas'], names: ['Cowboys'], shorts: ['DAL'] },
    11: { current: 'Dolphins', cities: ['Miami'], names: ['Dolphins'], shorts: ['MIA'] },
    12: { current: 'Eagles', cities: ['Philadelphia'], names: ['Eagles'], shorts: ['PHI'] },
    13: { current: 'Falcons', cities: ['Atlanta'], names: ['Falcons'], shorts: ['ATL'] },
    14: { current: '49ers', cities: ['San Francisco'], names: ['49ers'], shorts: ['SF'] },
    15: { current: 'Giants', cities: ['New York'], names: ['Giants'], shorts: ['NYG', 'NY'] },
    16: { current: 'Jaguars', cities: ['Jacksonville'], names: ['Jaguars'], shorts: ['JAX', 'JAC'] },
    17: { current: 'Jets', cities: ['New York'], names: ['Jets'], shorts: ['NYJ', 'NY'] },
    18: { current: 'Lions', cities: ['Detroit'], names: ['Lions'], shorts: ['DET'] },
    19: { current: 'Packers', cities: ['Green Bay'], names: ['Packers'], shorts: ['GB', 'GNB'] },
    20: { current: 'Panthers', cities: ['Carolina', 'Charlotte'], names: ['Panthers'], shorts: ['CAR'] },
    21: { current: 'Patriots', cities: ['New England', 'Boston'], names: ['Patriots'], shorts: ['NE', 'NEP'] },
    22: { current: 'Raiders', cities: ['Las Vegas', 'Oakland', 'Los Angeles'], names: ['Raiders'], shorts: ['LV', 'OAK', 'LA', 'LAR'] },
    23: { current: 'Rams', cities: ['Los Angeles', 'St. Louis', 'Cleveland'], names: ['Rams'], shorts: ['LAR', 'LA', 'STL', 'CLE'] },
    24: { current: 'Ravens', cities: ['Baltimore'], names: ['Ravens'], shorts: ['BAL'] },
    25: { current: 'Commanders', cities: ['Washington'], names: ['Commanders', 'Redskins', 'Football Team'], shorts: ['WAS', 'WSH'] },
    26: { current: 'Saints', cities: ['New Orleans'], names: ['Saints'], shorts: ['NO', 'NOR'] },
    27: { current: 'Seahawks', cities: ['Seattle'], names: ['Seahawks'], shorts: ['SEA'] },
    28: { current: 'Steelers', cities: ['Pittsburgh'], names: ['Steelers', 'Pirates'], shorts: ['PIT'] },
    29: { current: 'Titans', cities: ['Tennessee', 'Houston', 'Nashville'], names: ['Titans', 'Oilers'], shorts: ['TEN', 'HOU'] },
    30: { current: 'Vikings', cities: ['Minnesota'], names: ['Vikings'], shorts: ['MIN'] },
    31: { current: 'Texans', cities: ['Houston'], names: ['Texans'], shorts: ['HOU'] },
  };
  return teams[teamIndex];
}

diagnoseTeams().catch(console.error);
