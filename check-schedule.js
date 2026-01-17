/**
 * Check schedule for Browns and Ravens games
 */

async function main() {
  const mf = await import('madden-franchise');
  const franchise = await mf.create('C:/Users/tshan/Documents/Madden NFL 26/Saves/CAREER-RELOCTEST3');

  // Get SeasonGame table
  const scheduleTable = franchise.getTableByName('SeasonGame');
  if (!scheduleTable) {
    console.log('SeasonGame table not found');
    return;
  }
  await scheduleTable.readRecords();

  console.log('Total SeasonGame records:', scheduleTable.records.length);

  // Find Browns (4) and Ravens (24) games
  let brownsGames = [];
  let ravensGames = [];

  for (const game of scheduleTable.records) {
    if (game.isEmpty) continue;

    // Check both HomeTeam and AwayTeam fields (they might be references or direct values)
    let homeTeam, awayTeam;

    // Try direct access
    homeTeam = game.HomeTeam;
    awayTeam = game.AwayTeam;

    // If they're references, try to get the reference data
    if (typeof homeTeam === 'string' && homeTeam.includes('0')) {
      const ref = game.getReferenceDataByKey('HomeTeam');
      if (ref) homeTeam = ref.rowNumber;
    }
    if (typeof awayTeam === 'string' && awayTeam.includes('0')) {
      const ref = game.getReferenceDataByKey('AwayTeam');
      if (ref) awayTeam = ref.rowNumber;
    }

    const home = Number(homeTeam);
    const away = Number(awayTeam);

    if (home === 4 || away === 4) {
      brownsGames.push({ home, away, week: game.WeekIndex, type: game.SeasonWeekType });
    }
    if (home === 24 || away === 24) {
      ravensGames.push({ home, away, week: game.WeekIndex, type: game.SeasonWeekType });
    }
  }

  console.log(`\nBrowns (TeamIndex=4) games: ${brownsGames.length}`);
  for (const g of brownsGames.slice(0, 5)) {
    console.log(`  Week ${g.week}: Home=${g.home} vs Away=${g.away} (type=${g.type})`);
  }

  console.log(`\nRavens (TeamIndex=24) games: ${ravensGames.length}`);
  for (const g of ravensGames.slice(0, 5)) {
    console.log(`  Week ${g.week}: Home=${g.home} vs Away=${g.away} (type=${g.type})`);
  }

  // Check field names
  console.log('\nSeasonGame fields:');
  const fields = Object.keys(scheduleTable.records[0].fields);
  console.log(fields.join(', '));
}

main().catch(console.error);
