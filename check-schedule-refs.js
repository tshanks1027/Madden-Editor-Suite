/**
 * Check the actual team references in the schedule and see if they match
 * the correct Team table
 */
const { create } = require('madden-franchise');

async function checkScheduleRefs() {
  const filePath = 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/CAREER-1980test-AUTOSAVE';

  console.log('Loading franchise file...');
  const franchise = await create(filePath);

  // Get the correct Team table
  const teamTable = franchise.getTableByUniqueId(637929298);
  await teamTable.readRecords();

  // Build team info by record index
  const teamByRecordIdx = new Map();
  for (const team of teamTable.records) {
    if (team.isEmpty) continue;
    teamByRecordIdx.set(team.index, {
      teamIndex: team.TeamIndex,
      shortName: team.ShortName
    });
  }

  console.log(`\nLoaded ${teamByRecordIdx.size} teams from correct table`);

  // Get SeasonGame table
  let gameTable = franchise.getTableByName('SeasonGame');
  await gameTable.readRecords();

  console.log('\n=== CHECKING REGULAR SEASON WEEK 0 (Historical Week 1) ===');
  console.log('Looking for Cowboys (DAL), Lions (DET), Vikings (MIN)...\n');

  let problemGames = [];

  for (const record of gameTable.records) {
    if (record.isEmpty) continue;

    const weekType = record.SeasonWeekType;
    const isRegular = weekType === 1 || weekType === 'RegularSeason';
    if (!isRegular) continue;

    const weekNum = record.SeasonWeek;
    if (weekNum > 3) continue; // Check first few weeks

    const homeTeamRef = record.HomeTeam;
    const awayTeamRef = record.AwayTeam;

    if (!homeTeamRef || homeTeamRef === '00000000000000000000000000000000') continue;

    // Decode team references
    const homeRecIdx = parseInt(homeTeamRef.slice(-8), 2);
    const awayRecIdx = parseInt(awayTeamRef.slice(-8), 2);

    const homeTeam = teamByRecordIdx.get(homeRecIdx);
    const awayTeam = teamByRecordIdx.get(awayRecIdx);

    const homeDisplay = homeTeam ? `${homeTeam.shortName} (idx ${homeTeam.teamIndex}, rec ${homeRecIdx})` : `UNKNOWN rec ${homeRecIdx}`;
    const awayDisplay = awayTeam ? `${awayTeam.shortName} (idx ${awayTeam.teamIndex}, rec ${awayRecIdx})` : `UNKNOWN rec ${awayRecIdx}`;

    // Check if this game involves the problem teams (DAL=10, DET=18, MIN=30)
    const involvesProblem =
      (homeTeam && [10, 18, 30].includes(homeTeam.teamIndex)) ||
      (awayTeam && [10, 18, 30].includes(awayTeam.teamIndex));

    if (involvesProblem) {
      console.log(`Week ${weekNum}: ${awayDisplay} @ ${homeDisplay}`);
      console.log(`  HomeTeam ref: ${homeTeamRef}`);
      console.log(`  AwayTeam ref: ${awayTeamRef}`);
      problemGames.push({ weekNum, homeTeam, awayTeam, homeRecIdx, awayRecIdx });
    }
  }

  // Also check what the reference prefix is
  console.log('\n=== CHECKING REFERENCE FORMAT ===');
  for (const record of gameTable.records) {
    if (record.isEmpty) continue;
    const homeTeamRef = record.HomeTeam;
    if (homeTeamRef && homeTeamRef !== '00000000000000000000000000000000') {
      const prefix = homeTeamRef.slice(0, 24);
      console.log(`Reference prefix: ${prefix}`);

      // Try to match this prefix to a table
      for (const table of franchise.tables) {
        if (!table.header) continue;
        const uid = table.header.uniqueId;
        const uidBin = uid?.toString(2).padStart(32, '0');
        // Check if prefix matches
        if (uidBin && prefix === uidBin.slice(0, 24)) {
          console.log(`Prefix matches table: ${table.name} (uniqueId: ${uid})`);
        }
      }
      break;
    }
  }

  // Show what schedule says for historical week 1 from our data
  console.log('\n=== EXPECTED GAMES FOR HISTORICAL WEEK 1 (1980) ===');
  const fs = require('fs');
  const scheduleData = JSON.parse(fs.readFileSync('./data/retro/schedules/1980.json', 'utf-8'));

  const week1Games = scheduleData.games.filter(g => g.weekType === 'regular' && g.week === 1);
  console.log(`${week1Games.length} games scheduled:`);

  // Find problem teams
  for (const game of week1Games) {
    if ([10, 18, 30].includes(game.homeTeamIndex) || [10, 18, 30].includes(game.awayTeamIndex)) {
      console.log(`${game.awayTeam} @ ${game.homeTeam} (away: ${game.awayTeamIndex}, home: ${game.homeTeamIndex})`);
    }
  }
}

checkScheduleRefs().catch(console.error);
