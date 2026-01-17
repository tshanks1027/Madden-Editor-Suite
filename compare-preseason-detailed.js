/**
 * Detailed comparison of preseason schedule in franchise vs expected
 */
const { create } = require('madden-franchise');
const fs = require('fs');

async function comparePreseason() {
  const filePath = 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/CAREER-1980test-AUTOSAVE';

  console.log('Loading franchise file...');
  const franchise = await create(filePath);

  // Get the correct Team table
  const teamTable = franchise.getTableByUniqueId(637929298);
  await teamTable.readRecords();

  // Build lookup by TeamIndex
  const teamByIndex = new Map();
  const teamByRecordIdx = new Map();
  for (const team of teamTable.records) {
    if (team.isEmpty) continue;
    teamByIndex.set(team.TeamIndex, {
      recordIdx: team.index,
      shortName: team.ShortName
    });
    teamByRecordIdx.set(team.index, {
      teamIndex: team.TeamIndex,
      shortName: team.ShortName
    });
  }

  // Get SeasonGame table
  let gameTable = franchise.getTableByName('SeasonGame');
  await gameTable.readRecords();

  // Collect ALL preseason games from franchise file
  console.log('\n=== FRANCHISE FILE PRESEASON GAMES ===');
  const franchisePreseason = [];

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

    const homeTeam = teamByRecordIdx.get(homeRecIdx);
    const awayTeam = teamByRecordIdx.get(awayRecIdx);

    if (homeTeam && awayTeam) {
      franchisePreseason.push({
        week: weekNum,
        homeTeamIndex: homeTeam.teamIndex,
        awayTeamIndex: awayTeam.teamIndex,
        homeShort: homeTeam.shortName,
        awayShort: awayTeam.shortName
      });
    }
  }

  // Sort by week
  franchisePreseason.sort((a, b) => a.week - b.week);

  // Group by week
  const franchiseByWeek = {};
  for (const game of franchisePreseason) {
    if (!franchiseByWeek[game.week]) franchiseByWeek[game.week] = [];
    franchiseByWeek[game.week].push(game);
  }

  for (const [week, games] of Object.entries(franchiseByWeek).sort((a, b) => parseInt(a[0]) - parseInt(b[0]))) {
    console.log(`\nWeek ${week} (${games.length} games):`);
    for (const g of games) {
      console.log(`  ${g.awayShort} (${g.awayTeamIndex}) @ ${g.homeShort} (${g.homeTeamIndex})`);
    }
  }

  // Load expected 1980 preseason
  console.log('\n\n=== EXPECTED 1980 PRESEASON (Historical Week 1 = Madden Week 0) ===');
  const scheduleData = JSON.parse(fs.readFileSync('./data/retro/schedules/1980.json', 'utf-8'));
  const historicalPreseason = scheduleData.games.filter(g => g.weekType === 'preseason');

  // Group by week
  const historicalByWeek = {};
  for (const game of historicalPreseason) {
    if (!historicalByWeek[game.week]) historicalByWeek[game.week] = [];
    historicalByWeek[game.week].push(game);
  }

  for (const [week, games] of Object.entries(historicalByWeek).sort((a, b) => parseInt(a[0]) - parseInt(b[0]))) {
    const maddenWeek = parseInt(week) - 1; // Historical week 1 = Madden week 0
    console.log(`\nHistorical Week ${week} (Madden Week ${maddenWeek}) - ${games.length} games:`);
    for (const g of games.slice(0, 5)) {
      const awayInfo = teamByIndex.get(g.awayTeamIndex);
      const homeInfo = teamByIndex.get(g.homeTeamIndex);
      const awayShort = awayInfo ? awayInfo.shortName : '???';
      const homeShort = homeInfo ? homeInfo.shortName : '???';
      console.log(`  ${awayShort} (${g.awayTeamIndex}) @ ${homeShort} (${g.homeTeamIndex})`);
    }
    if (games.length > 5) {
      console.log(`  ... and ${games.length - 5} more`);
    }
  }

  // Compare week by week
  console.log('\n\n=== COMPARISON: FRANCHISE vs EXPECTED ===');
  for (let maddenWeek = 0; maddenWeek <= 3; maddenWeek++) {
    const historicalWeek = maddenWeek + 1;
    const franchiseGames = franchiseByWeek[maddenWeek] || [];
    const historicalGames = historicalByWeek[historicalWeek] || [];

    console.log(`\nMadden Week ${maddenWeek} (Historical Week ${historicalWeek}):`);
    console.log(`  Franchise: ${franchiseGames.length} games`);
    console.log(`  Expected:  ${historicalGames.length} games`);

    if (franchiseGames.length > 0 && historicalGames.length > 0) {
      // Check if games match
      let matches = 0;
      for (const fg of franchiseGames) {
        for (const hg of historicalGames) {
          if (fg.homeTeamIndex === hg.homeTeamIndex && fg.awayTeamIndex === hg.awayTeamIndex) {
            matches++;
            break;
          }
        }
      }
      console.log(`  Matching games: ${matches}`);
    }
  }
}

comparePreseason().catch(console.error);
