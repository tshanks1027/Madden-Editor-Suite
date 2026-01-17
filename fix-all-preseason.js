/**
 * Apply complete preseason schedule to the franchise file
 */
const { create } = require('madden-franchise');
const fs = require('fs');

async function fixAllPreseason() {
  const filePath = 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/CAREER-1980test-AUTOSAVE';

  console.log('Loading franchise file...');
  const franchise = await create(filePath);

  // Get the correct Team table
  const teamTable = franchise.getTableByUniqueId(637929298);
  await teamTable.readRecords();

  // Build team mapping
  const teamIndexToRecordIndex = new Map();
  const teamByRecordIdx = new Map();
  for (const team of teamTable.records) {
    if (team.isEmpty) continue;
    if (team.TeamIndex < 32) {
      teamIndexToRecordIndex.set(team.TeamIndex, team.index);
      teamByRecordIdx.set(team.index, { teamIndex: team.TeamIndex, shortName: team.ShortName });
    }
  }

  // Get team ref prefix
  let gameTable = franchise.getTableByName('SeasonGame');
  await gameTable.readRecords();

  let teamRefPrefix = '001011100011101000000000';
  for (const record of gameTable.records) {
    if (record.isEmpty) continue;
    if (record.HomeTeam && record.HomeTeam !== '00000000000000000000000000000000') {
      teamRefPrefix = record.HomeTeam.slice(0, 24);
      break;
    }
  }

  // Load 1980 schedule
  const scheduleData = JSON.parse(fs.readFileSync('./data/retro/schedules/1980.json', 'utf-8'));

  // Group preseason by week
  const preseasonByWeek = new Map();
  for (const game of scheduleData.games) {
    if (game.weekType !== 'preseason') continue;
    if (!preseasonByWeek.has(game.week)) preseasonByWeek.set(game.week, []);
    preseasonByWeek.get(game.week).push(game);
  }

  // Group franchise preseason slots by week
  const franchiseByWeek = new Map();
  for (const record of gameTable.records) {
    if (record.isEmpty) continue;
    const weekType = record.SeasonWeekType;
    if (weekType !== 0 && weekType !== 'PreSeason') continue;
    const weekNum = record.SeasonWeek;
    if (!franchiseByWeek.has(weekNum)) franchiseByWeek.set(weekNum, []);
    franchiseByWeek.get(weekNum).push(record);
  }

  console.log('Franchise preseason weeks:', [...franchiseByWeek.keys()].sort((a, b) => a - b).join(', '));
  console.log('Historical preseason weeks:', [...preseasonByWeek.keys()].sort((a, b) => a - b).join(', '));

  let totalFixed = 0;

  // Apply each week (Historical 1-4 -> Madden 0-3)
  for (let historicalWeek = 1; historicalWeek <= 4; historicalWeek++) {
    const maddenWeek = historicalWeek - 1;
    const historicalGames = preseasonByWeek.get(historicalWeek) || [];
    const franchiseSlots = franchiseByWeek.get(maddenWeek) || [];

    console.log(`\nWeek ${historicalWeek} (Madden ${maddenWeek}): ${historicalGames.length} games, ${franchiseSlots.length} slots`);

    const gamesToApply = Math.min(historicalGames.length, franchiseSlots.length);

    for (let i = 0; i < gamesToApply; i++) {
      const game = historicalGames[i];
      const slot = franchiseSlots[i];

      const homeRecIdx = teamIndexToRecordIndex.get(game.homeTeamIndex);
      const awayRecIdx = teamIndexToRecordIndex.get(game.awayTeamIndex);

      if (homeRecIdx === undefined || awayRecIdx === undefined) {
        console.log(`  Skipping: ${game.awayTeam} @ ${game.homeTeam} (missing team mapping)`);
        continue;
      }

      const homeRef = teamRefPrefix + homeRecIdx.toString(2).padStart(8, '0');
      const awayRef = teamRefPrefix + awayRecIdx.toString(2).padStart(8, '0');

      slot.HomeTeam = homeRef;
      slot.AwayTeam = awayRef;
      totalFixed++;

      if (i < 2 || i === gamesToApply - 1) {
        const homeTeam = teamByRecordIdx.get(homeRecIdx);
        const awayTeam = teamByRecordIdx.get(awayRecIdx);
        console.log(`  ${awayTeam?.shortName} @ ${homeTeam?.shortName}`);
      } else if (i === 2) {
        console.log(`  ... (${gamesToApply - 3} more games)`);
      }
    }
  }

  console.log(`\nTotal games fixed: ${totalFixed}`);

  // Save
  console.log('\nSaving...');
  await franchise.save();
  console.log('Done!');

  // Quick verification
  console.log('\n=== VERIFICATION ===');
  const franchise2 = await create(filePath);
  let gameTable2 = franchise2.getTableByName('SeasonGame');
  await gameTable2.readRecords();

  let correctCount = 0;
  let totalChecked = 0;

  for (let historicalWeek = 1; historicalWeek <= 4; historicalWeek++) {
    const maddenWeek = historicalWeek - 1;
    const historicalGames = preseasonByWeek.get(historicalWeek) || [];

    const slots2 = [];
    for (const record of gameTable2.records) {
      if (record.isEmpty) continue;
      if ((record.SeasonWeekType === 0 || record.SeasonWeekType === 'PreSeason') && record.SeasonWeek === maddenWeek) {
        slots2.push(record);
      }
    }

    for (let i = 0; i < Math.min(historicalGames.length, slots2.length); i++) {
      const game = historicalGames[i];
      const slot = slots2[i];

      const expectedHomeRec = teamIndexToRecordIndex.get(game.homeTeamIndex);
      const expectedAwayRec = teamIndexToRecordIndex.get(game.awayTeamIndex);

      const actualHomeRec = parseInt(slot.HomeTeam.slice(-8), 2);
      const actualAwayRec = parseInt(slot.AwayTeam.slice(-8), 2);

      totalChecked++;
      if (actualHomeRec === expectedHomeRec && actualAwayRec === expectedAwayRec) {
        correctCount++;
      }
    }
  }

  console.log(`Correct: ${correctCount}/${totalChecked} games`);
}

fixAllPreseason().catch(console.error);
