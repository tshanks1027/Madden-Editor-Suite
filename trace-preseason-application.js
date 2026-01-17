/**
 * Trace exactly how preseason games should be applied and compare with what's in the file
 */
const { create } = require('madden-franchise');
const fs = require('fs');

async function tracePreseason() {
  const filePath = 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/CAREER-1980test-AUTOSAVE';

  console.log('Loading franchise file...');
  const franchise = await create(filePath);

  // Get the correct Team table and build mapping
  const teamTable = franchise.getTableByUniqueId(637929298);
  await teamTable.readRecords();

  const teamIndexToRecordIndex = new Map();
  const teamByRecordIdx = new Map();
  for (const team of teamTable.records) {
    if (team.isEmpty) continue;
    const teamIndex = team.TeamIndex;
    if (teamIndex !== undefined && teamIndex < 32) {
      teamIndexToRecordIndex.set(teamIndex, team.index);
      teamByRecordIdx.set(team.index, { teamIndex, shortName: team.ShortName });
    }
  }

  // Get team reference prefix from an existing game
  let gameTable = franchise.getTableByName('SeasonGame');
  await gameTable.readRecords();

  let teamRefPrefix = '001011100011101000000000';
  for (const record of gameTable.records) {
    if (record.isEmpty) continue;
    const homeTeam = record.HomeTeam;
    if (homeTeam && homeTeam !== '00000000000000000000000000000000' && homeTeam.length === 32) {
      teamRefPrefix = homeTeam.slice(0, 24);
      console.log('Team reference prefix:', teamRefPrefix);
      break;
    }
  }

  // Load historical schedule
  const scheduleData = JSON.parse(fs.readFileSync('./data/retro/schedules/1980.json', 'utf-8'));
  const preseasonGames = scheduleData.games.filter(g => g.weekType === 'preseason');

  // Group by week
  const preseasonByWeek = new Map();
  for (const game of preseasonGames) {
    if (!preseasonByWeek.has(game.week)) preseasonByWeek.set(game.week, []);
    preseasonByWeek.get(game.week).push(game);
  }

  console.log('\n=== HISTORICAL WEEK 1 GAMES (should map to Madden Week 0) ===');
  const week1Games = preseasonByWeek.get(1) || [];
  console.log(`${week1Games.length} games to apply:`);

  for (let i = 0; i < week1Games.length; i++) {
    const game = week1Games[i];
    const homeRecIdx = teamIndexToRecordIndex.get(game.homeTeamIndex);
    const awayRecIdx = teamIndexToRecordIndex.get(game.awayTeamIndex);

    const homeRef = teamRefPrefix + homeRecIdx.toString(2).padStart(8, '0');
    const awayRef = teamRefPrefix + awayRecIdx.toString(2).padStart(8, '0');

    const homeTeam = teamByRecordIdx.get(homeRecIdx);
    const awayTeam = teamByRecordIdx.get(awayRecIdx);

    console.log(`\nGame ${i + 1}:`);
    console.log(`  Historical: ${game.awayTeam} (idx ${game.awayTeamIndex}) @ ${game.homeTeam} (idx ${game.homeTeamIndex})`);
    console.log(`  Should create: ${awayTeam?.shortName} (rec ${awayRecIdx}) @ ${homeTeam?.shortName} (rec ${homeRecIdx})`);
    console.log(`  HomeRef: ${homeRef}`);
    console.log(`  AwayRef: ${awayRef}`);
  }

  // Now check what's actually in Madden Week 0 preseason
  console.log('\n\n=== ACTUAL MADDEN WEEK 0 PRESEASON GAMES ===');
  const maddenWeek0Games = [];
  for (const record of gameTable.records) {
    if (record.isEmpty) continue;
    const weekType = record.SeasonWeekType;
    if (weekType !== 0 && weekType !== 'PreSeason') continue;
    if (record.SeasonWeek !== 0) continue;

    maddenWeek0Games.push(record);
  }

  console.log(`${maddenWeek0Games.length} games in Madden Week 0 preseason:\n`);

  for (let i = 0; i < Math.min(maddenWeek0Games.length, 14); i++) {
    const record = maddenWeek0Games[i];
    const homeTeamRef = record.HomeTeam;
    const awayTeamRef = record.AwayTeam;

    const homeRecIdx = homeTeamRef ? parseInt(homeTeamRef.slice(-8), 2) : -1;
    const awayRecIdx = awayTeamRef ? parseInt(awayTeamRef.slice(-8), 2) : -1;

    const homeTeam = teamByRecordIdx.get(homeRecIdx);
    const awayTeam = teamByRecordIdx.get(awayRecIdx);

    const expectedGame = week1Games[i];
    const expectedHomeRecIdx = expectedGame ? teamIndexToRecordIndex.get(expectedGame.homeTeamIndex) : -1;
    const expectedAwayRecIdx = expectedGame ? teamIndexToRecordIndex.get(expectedGame.awayTeamIndex) : -1;

    const homeMatch = homeRecIdx === expectedHomeRecIdx;
    const awayMatch = awayRecIdx === expectedAwayRecIdx;

    console.log(`Game ${i + 1}: ${awayTeam?.shortName || '???'} @ ${homeTeam?.shortName || '???'}`);
    console.log(`  Actual refs: Home=${homeTeamRef?.slice(-12)}, Away=${awayTeamRef?.slice(-12)}`);

    if (expectedGame) {
      console.log(`  Expected: ${teamByRecordIdx.get(expectedAwayRecIdx)?.shortName} @ ${teamByRecordIdx.get(expectedHomeRecIdx)?.shortName}`);
      console.log(`  Match: Home=${homeMatch ? 'YES' : 'NO'}, Away=${awayMatch ? 'YES' : 'NO'}`);
    }
  }

  // Count matches
  console.log('\n\n=== SUMMARY ===');
  let matches = 0;
  for (let i = 0; i < Math.min(maddenWeek0Games.length, week1Games.length); i++) {
    const record = maddenWeek0Games[i];
    const expectedGame = week1Games[i];

    const homeRecIdx = parseInt(record.HomeTeam.slice(-8), 2);
    const awayRecIdx = parseInt(record.AwayTeam.slice(-8), 2);

    const expectedHomeRecIdx = teamIndexToRecordIndex.get(expectedGame.homeTeamIndex);
    const expectedAwayRecIdx = teamIndexToRecordIndex.get(expectedGame.awayTeamIndex);

    if (homeRecIdx === expectedHomeRecIdx && awayRecIdx === expectedAwayRecIdx) {
      matches++;
    }
  }

  console.log(`Games matching expected: ${matches} out of ${Math.min(maddenWeek0Games.length, week1Games.length)}`);
  console.log(`Games NOT matching: ${Math.min(maddenWeek0Games.length, week1Games.length) - matches}`);
}

tracePreseason().catch(console.error);
