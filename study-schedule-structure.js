/**
 * Study schedule structure - compare working 2011 mod with fresh file
 * NO CHANGES - RESEARCH ONLY
 */
async function study() {
  const mf = await import('madden-franchise');

  const files = {
    '2011 MOD': 'C:/Users/tshan/Downloads/2011 Throwback V0.9/2011 Throwback V0.9/CAREER-2011THROWBACKV09',
    'REAL': 'C:/Users/tshan/Documents/Madden NFL 26/Saves/CAREER-REAL'
  };

  for (const [name, path] of Object.entries(files)) {
    console.log('\n' + '='.repeat(60));
    console.log(`FILE: ${name}`);
    console.log('='.repeat(60));

    try {
      const franchise = await mf.create(path);
      const gameTable = franchise.getTableByName('SeasonGame');
      await gameTable.readRecords();

      // Get SeasonInfo to understand the current state
      const seasonInfo = franchise.getTableByName('SeasonInfo');
      if (seasonInfo) {
        await seasonInfo.readRecords();
        const si = seasonInfo.records.find(r => !r.isEmpty);
        if (si) {
          console.log('\nSeasonInfo:');
          console.log('  CurrentWeek:', si.CurrentWeek);
          console.log('  CurrentWeekType:', String(si.CurrentWeekType));
          console.log('  CurrentSeasonYear:', si.CurrentSeasonYear);
        }
      }

      // Analyze all games
      const games = gameTable.records.filter(r => !r.isEmpty);
      console.log('\nTotal non-empty SeasonGame records:', games.length);

      // Count by type
      let preseasonCount = 0;
      let regularCount = 0;
      let playoffCount = 0;
      let otherCount = 0;

      for (const g of games) {
        const type = String(g.SeasonWeekType);
        if (type === 'PreSeason') preseasonCount++;
        else if (type === 'RegularSeason') regularCount++;
        else if (type.includes('Playoff') || type.includes('Bowl')) playoffCount++;
        else otherCount++;
      }

      console.log('\nGames by SeasonWeekType:');
      console.log('  PreSeason:', preseasonCount);
      console.log('  RegularSeason:', regularCount);
      console.log('  Playoffs/Bowl:', playoffCount);
      console.log('  Other:', otherCount);

      // For preseason, show detailed breakdown
      const preseason = games.filter(g => String(g.SeasonWeekType) === 'PreSeason');
      if (preseason.length > 0) {
        console.log('\nPRESEASON DETAILS:');

        // Count by week
        const week0 = preseason.filter(g => g.SeasonWeek === 0);
        const week1 = preseason.filter(g => g.SeasonWeek === 1);
        const week2 = preseason.filter(g => g.SeasonWeek === 2);
        const week3 = preseason.filter(g => g.SeasonWeek === 3);

        console.log('  Week 0:', week0.length, 'games');
        console.log('  Week 1:', week1.length, 'games');
        console.log('  Week 2:', week2.length, 'games');
        console.log('  Week 3:', week3.length, 'games');

        // Count by status
        let unplayed = 0, homeWon = 0, awayWon = 0, invalid = 0, other = 0;
        for (const g of preseason) {
          const status = String(g.GameStatus);
          if (status === 'Unplayed') unplayed++;
          else if (status === 'HomeWon') homeWon++;
          else if (status === 'AwayWon') awayWon++;
          else if (status === 'Invalid_') invalid++;
          else other++;
        }

        console.log('\n  By GameStatus:');
        console.log('    Unplayed:', unplayed);
        console.log('    HomeWon:', homeWon);
        console.log('    AwayWon:', awayWon);
        console.log('    Invalid_:', invalid);
        console.log('    Other:', other);

        // Show first few preseason records in detail
        console.log('\n  First 5 preseason records (by index):');
        const sorted = [...preseason].sort((a, b) => a.index - b.index);
        for (let i = 0; i < Math.min(5, sorted.length); i++) {
          const g = sorted[i];
          console.log(`    Record ${g.index}:`);
          console.log(`      SeasonWeek: ${g.SeasonWeek}`);
          console.log(`      GameStatus: ${String(g.GameStatus)}`);
          console.log(`      HomeTeam: ${g.HomeTeam}`);
          console.log(`      AwayTeam: ${g.AwayTeam}`);
        }

        // Show Invalid_ records specifically
        const invalidRecords = preseason.filter(g => String(g.GameStatus) === 'Invalid_');
        if (invalidRecords.length > 0) {
          console.log('\n  Invalid_ record indices:', invalidRecords.map(g => g.index).join(', '));
        } else {
          console.log('\n  NO Invalid_ records in preseason!');
        }
      }

      // For regular season, show week distribution
      const regularSeason = games.filter(g => String(g.SeasonWeekType) === 'RegularSeason');
      if (regularSeason.length > 0) {
        console.log('\nREGULAR SEASON DETAILS:');
        console.log('  Total games:', regularSeason.length);

        // Count games per week
        const weekCounts = {};
        for (const g of regularSeason) {
          weekCounts[g.SeasonWeek] = (weekCounts[g.SeasonWeek] || 0) + 1;
        }
        const weeks = Object.keys(weekCounts).map(Number).sort((a, b) => a - b);
        console.log('  Week range:', weeks[0], 'to', weeks[weeks.length - 1]);
        console.log('  Games per week:', weeks.map(w => weekCounts[w]).join(', '));
      }

    } catch (err) {
      console.log('ERROR loading file:', err.message, err.stack);
    }
  }
}

study().catch(e => console.error(e));
