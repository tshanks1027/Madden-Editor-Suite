/**
 * Debug script to check schedule team references in franchise file
 */
const { create } = require('madden-franchise');

async function debugScheduleTeams() {
  const filePath = 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/CAREER-1980test-AUTOSAVE';

  console.log('Loading franchise file...');
  const franchise = await create(filePath);

  // Get Team table
  let teamTable = franchise.getTableByUniqueId(2079398721);
  if (!teamTable) teamTable = franchise.getTableByName('Team');
  await teamTable.readRecords();

  // Build team info by index
  const teamInfo = new Map();
  for (const team of teamTable.records) {
    if (team.isEmpty) continue;
    if (team.TeamIndex < 32) {
      teamInfo.set(team.index, {
        teamIndex: team.TeamIndex,
        shortName: team.ShortName,
        longName: team.LongName,
        displayName: team.DisplayName || team.NickName || team.ShortName
      });
    }
  }

  console.log('\n=== TEAM TABLE (NFL Teams Only) ===');
  console.log('Record Index -> TeamIndex: Name');
  const sortedByTeamIndex = [...teamInfo.entries()].sort((a, b) => a[1].teamIndex - b[1].teamIndex);
  for (const [recIdx, info] of sortedByTeamIndex) {
    console.log(`  Record ${recIdx} -> TeamIndex ${info.teamIndex}: ${info.shortName} (${info.displayName})`);
  }

  // Check for Vikings (30), Cowboys (10), Lions (18) specifically
  console.log('\n=== CHECKING PROBLEM TEAMS ===');
  const problemIndices = [10, 18, 30]; // Cowboys, Lions, Vikings
  for (const ti of problemIndices) {
    const teamEntry = [...teamInfo.entries()].find(([_, info]) => info.teamIndex === ti);
    if (teamEntry) {
      console.log(`TeamIndex ${ti}: Record ${teamEntry[0]}, ${teamEntry[1].shortName}`);
    } else {
      console.log(`TeamIndex ${ti}: NOT FOUND!`);
    }
  }

  // Get SeasonGame table
  let gameTable = franchise.getTableByUniqueId(748954923);
  if (!gameTable) gameTable = franchise.getTableByName('SeasonGame');
  await gameTable.readRecords();

  console.log('\n=== PRESEASON GAMES (First 3 weeks) ===');

  // Check preseason games for these teams
  for (const record of gameTable.records) {
    if (record.isEmpty) continue;

    const weekType = record.SeasonWeekType;
    const isPreseason = weekType === 0 || weekType === 'PreSeason';
    if (!isPreseason) continue;

    const weekNum = record.SeasonWeek;
    if (weekNum > 2) continue; // Only first 3 weeks

    const homeTeamRef = record.HomeTeam;
    const awayTeamRef = record.AwayTeam;

    // Decode team references
    let homeTeamInfo = '???';
    let awayTeamInfo = '???';

    if (homeTeamRef && homeTeamRef.length === 32) {
      const homeRecIdx = parseInt(homeTeamRef.slice(-8), 2);
      const home = teamInfo.get(homeRecIdx);
      homeTeamInfo = home ? `${home.shortName} (idx ${home.teamIndex})` : `RecIdx ${homeRecIdx}`;
    }

    if (awayTeamRef && awayTeamRef.length === 32) {
      const awayRecIdx = parseInt(awayTeamRef.slice(-8), 2);
      const away = teamInfo.get(awayRecIdx);
      awayTeamInfo = away ? `${away.shortName} (idx ${away.teamIndex})` : `RecIdx ${awayRecIdx}`;
    }

    // Check if this game involves problem teams
    const homeRecIdx = homeTeamRef ? parseInt(homeTeamRef.slice(-8), 2) : -1;
    const awayRecIdx = awayTeamRef ? parseInt(awayTeamRef.slice(-8), 2) : -1;
    const homeTeam = teamInfo.get(homeRecIdx);
    const awayTeam = teamInfo.get(awayRecIdx);

    const involvesProblemTeam =
      (homeTeam && problemIndices.includes(homeTeam.teamIndex)) ||
      (awayTeam && problemIndices.includes(awayTeam.teamIndex));

    if (involvesProblemTeam) {
      console.log(`\nWeek ${weekNum}: ${awayTeamInfo} @ ${homeTeamInfo}`);
      console.log(`  HomeTeam ref: ${homeTeamRef}`);
      console.log(`  AwayTeam ref: ${awayTeamRef}`);
    }
  }

  // Check FranchiseUser table for user's team
  console.log('\n=== FRANCHISE USER TEAM ===');
  const userTable = franchise.getTableByName('FranchiseUser');
  if (userTable) {
    await userTable.readRecords();
    for (const record of userTable.records) {
      if (record.isEmpty) continue;
      console.log('FranchiseUser record:');

      // Try to find team-related fields
      const proto = Object.getPrototypeOf(record);
      const desc = Object.getOwnPropertyDescriptors(proto);

      for (const [key, d] of Object.entries(desc)) {
        if (d.get && !key.startsWith('_')) {
          const lower = key.toLowerCase();
          if (lower.includes('team') || lower.includes('index') || lower.includes('user') || lower.includes('control')) {
            try {
              const val = record[key];
              if (val !== undefined && val !== null && val !== '') {
                console.log(`  ${key}: ${typeof val === 'string' && val.length > 40 ? val.slice(0, 40) + '...' : val}`);
              }
            } catch (e) {}
          }
        }
      }
    }
  }

  // Also check what games show for regular season week 1
  console.log('\n=== REGULAR SEASON WEEK 0 (Madden Week 0 = Historical Week 1) ===');
  for (const record of gameTable.records) {
    if (record.isEmpty) continue;

    const weekType = record.SeasonWeekType;
    const isRegular = weekType === 1 || weekType === 'RegularSeason';
    if (!isRegular) continue;

    const weekNum = record.SeasonWeek;
    if (weekNum !== 0) continue;

    const homeTeamRef = record.HomeTeam;
    const awayTeamRef = record.AwayTeam;

    let homeTeamInfo = '???';
    let awayTeamInfo = '???';

    if (homeTeamRef && homeTeamRef.length === 32) {
      const homeRecIdx = parseInt(homeTeamRef.slice(-8), 2);
      const home = teamInfo.get(homeRecIdx);
      homeTeamInfo = home ? `${home.shortName} (idx ${home.teamIndex}, rec ${homeRecIdx})` : `RecIdx ${homeRecIdx}`;
    }

    if (awayTeamRef && awayTeamRef.length === 32) {
      const awayRecIdx = parseInt(awayTeamRef.slice(-8), 2);
      const away = teamInfo.get(awayRecIdx);
      awayTeamInfo = away ? `${away.shortName} (idx ${away.teamIndex}, rec ${awayRecIdx})` : `RecIdx ${awayRecIdx}`;
    }

    console.log(`${awayTeamInfo} @ ${homeTeamInfo}`);
  }
}

debugScheduleTeams().catch(console.error);
