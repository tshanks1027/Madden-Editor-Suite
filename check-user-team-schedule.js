/**
 * Check the user's team (Cowboys, TeamIndex 10) schedule in the franchise file
 */
const { create } = require('madden-franchise');

async function checkUserTeamSchedule() {
  const filePath = 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/CAREER-1980test-AUTOSAVE';

  console.log('Loading franchise file...');
  const franchise = await create(filePath);

  // Get the correct Team table
  const teamTable = franchise.getTableByUniqueId(637929298);
  await teamTable.readRecords();

  // Build lookup
  const teamByRecordIdx = new Map();
  for (const team of teamTable.records) {
    if (team.isEmpty) continue;
    teamByRecordIdx.set(team.index, {
      teamIndex: team.TeamIndex,
      shortName: team.ShortName,
      longName: team.LongName
    });
  }

  // User's team is Cowboys (TeamIndex 10, Record 14)
  const userTeamRecordIdx = 14;
  const userTeam = teamByRecordIdx.get(userTeamRecordIdx);
  console.log(`\nUser's team: ${userTeam?.shortName} (TeamIndex ${userTeam?.teamIndex}, Record ${userTeamRecordIdx})`);

  // Get SeasonGame table
  let gameTable = franchise.getTableByName('SeasonGame');
  await gameTable.readRecords();

  console.log('\n=== USER TEAM (COWBOYS) PRESEASON SCHEDULE ===');

  for (const record of gameTable.records) {
    if (record.isEmpty) continue;

    const weekType = record.SeasonWeekType;
    const isPreseason = weekType === 0 || weekType === 'PreSeason';
    if (!isPreseason) continue;

    const weekNum = record.SeasonWeek;

    const homeTeamRef = record.HomeTeam;
    const awayTeamRef = record.AwayTeam;

    if (!homeTeamRef || homeTeamRef === '00000000000000000000000000000000') continue;

    const homeRecIdx = parseInt(homeTeamRef.slice(-8), 2);
    const awayRecIdx = parseInt(awayTeamRef.slice(-8), 2);

    // Check if Cowboys are involved
    if (homeRecIdx === userTeamRecordIdx || awayRecIdx === userTeamRecordIdx) {
      const homeTeam = teamByRecordIdx.get(homeRecIdx);
      const awayTeam = teamByRecordIdx.get(awayRecIdx);

      const homeDisplay = homeTeam ? `${homeTeam.shortName} (idx ${homeTeam.teamIndex}, rec ${homeRecIdx})` : `UNKNOWN rec ${homeRecIdx}`;
      const awayDisplay = awayTeam ? `${awayTeam.shortName} (idx ${awayTeam.teamIndex}, rec ${awayRecIdx})` : `UNKNOWN rec ${awayRecIdx}`;

      const isHome = homeRecIdx === userTeamRecordIdx;
      console.log(`Preseason Week ${weekNum}: ${awayDisplay} @ ${homeDisplay} [User is ${isHome ? 'HOME' : 'AWAY'}]`);
    }
  }

  console.log('\n=== USER TEAM (COWBOYS) REGULAR SEASON (First 4 weeks) ===');

  for (const record of gameTable.records) {
    if (record.isEmpty) continue;

    const weekType = record.SeasonWeekType;
    const isRegular = weekType === 1 || weekType === 'RegularSeason';
    if (!isRegular) continue;

    const weekNum = record.SeasonWeek;
    if (weekNum > 3) continue;

    const homeTeamRef = record.HomeTeam;
    const awayTeamRef = record.AwayTeam;

    if (!homeTeamRef || homeTeamRef === '00000000000000000000000000000000') continue;

    const homeRecIdx = parseInt(homeTeamRef.slice(-8), 2);
    const awayRecIdx = parseInt(awayTeamRef.slice(-8), 2);

    // Check if Cowboys are involved
    if (homeRecIdx === userTeamRecordIdx || awayRecIdx === userTeamRecordIdx) {
      const homeTeam = teamByRecordIdx.get(homeRecIdx);
      const awayTeam = teamByRecordIdx.get(awayRecIdx);

      const homeDisplay = homeTeam ? `${homeTeam.shortName} (idx ${homeTeam.teamIndex}, rec ${homeRecIdx})` : `UNKNOWN rec ${homeRecIdx}`;
      const awayDisplay = awayTeam ? `${awayTeam.shortName} (idx ${awayTeam.teamIndex}, rec ${awayRecIdx})` : `UNKNOWN rec ${awayRecIdx}`;

      const isHome = homeRecIdx === userTeamRecordIdx;
      console.log(`Week ${weekNum}: ${awayDisplay} @ ${homeDisplay} [User is ${isHome ? 'HOME' : 'AWAY'}]`);
    }
  }

  // Also check what the historical 1980 schedule says
  console.log('\n=== EXPECTED 1980 COWBOYS SCHEDULE ===');
  const fs = require('fs');
  const scheduleData = JSON.parse(fs.readFileSync('./data/retro/schedules/1980.json', 'utf-8'));

  // Preseason
  console.log('\nPreseason:');
  for (const game of scheduleData.games.filter(g => g.weekType === 'preseason')) {
    if (game.homeTeamIndex === 10 || game.awayTeamIndex === 10) {
      const isHome = game.homeTeamIndex === 10;
      console.log(`Week ${game.week}: ${game.awayTeam} @ ${game.homeTeam} [Cowboys ${isHome ? 'HOME' : 'AWAY'}]`);
    }
  }

  // Regular season first few weeks
  console.log('\nRegular season (first 4 weeks):');
  for (const game of scheduleData.games.filter(g => g.weekType === 'regular' && g.week <= 4)) {
    if (game.homeTeamIndex === 10 || game.awayTeamIndex === 10) {
      const isHome = game.homeTeamIndex === 10;
      console.log(`Week ${game.week}: ${game.awayTeam} @ ${game.homeTeam} [Cowboys ${isHome ? 'HOME' : 'AWAY'}]`);
    }
  }

  // Check Raiders games to see if there's an issue
  console.log('\n=== RAIDERS SCHEDULE IN FRANCHISE (First 4 weeks each) ===');
  const raidersRecordIdx = 28; // OAK

  console.log('\nPreseason:');
  for (const record of gameTable.records) {
    if (record.isEmpty) continue;
    const weekType = record.SeasonWeekType;
    if (weekType !== 0 && weekType !== 'PreSeason') continue;

    const homeTeamRef = record.HomeTeam;
    const awayTeamRef = record.AwayTeam;
    if (!homeTeamRef || homeTeamRef === '00000000000000000000000000000000') continue;

    const homeRecIdx = parseInt(homeTeamRef.slice(-8), 2);
    const awayRecIdx = parseInt(awayTeamRef.slice(-8), 2);

    if (homeRecIdx === raidersRecordIdx || awayRecIdx === raidersRecordIdx) {
      const weekNum = record.SeasonWeek;
      const homeTeam = teamByRecordIdx.get(homeRecIdx);
      const awayTeam = teamByRecordIdx.get(awayRecIdx);

      const homeDisplay = homeTeam ? homeTeam.shortName : `rec ${homeRecIdx}`;
      const awayDisplay = awayTeam ? awayTeam.shortName : `rec ${awayRecIdx}`;

      console.log(`Week ${weekNum}: ${awayDisplay} @ ${homeDisplay}`);
    }
  }
}

checkUserTeamSchedule().catch(console.error);
