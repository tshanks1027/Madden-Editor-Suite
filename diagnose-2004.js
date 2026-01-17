const { FranchiseFile } = require('madden-franchise');

async function diagnose() {
  // Check the 2011 Throwback for comparison
  const throwbackPath = 'C:/Users/tshan/OneDrive/Documents/2011 Throwback/2011 Throwback V0.9/2011 Throwback V0.9/CAREER-2011THROWBACKV09';

  console.log('=== 2011 Throwback (WORKING MOD) ===');
  const throwback = new FranchiseFile(throwbackPath);
  await throwback.parse();

  const tbSeasonInfo = throwback.getTableByName('SeasonInfo');
  await tbSeasonInfo.readRecords();
  const tbSeason = tbSeasonInfo.records.find(r => !r.isEmpty);
  if (tbSeason) {
    console.log('NflseasonWeekCount:', tbSeason.NflseasonWeekCount);
    console.log('PreseasonWeekCount:', tbSeason.PreseasonWeekCount);
  } else {
    console.log('No non-empty SeasonInfo record found');
  }

  const tbGameTable = throwback.getTableByName('SeasonGame');
  await tbGameTable.readRecords();

  // Count games by week and type
  const tbWeekData = {};
  for (const game of tbGameTable.records) {
    if (game.isEmpty) continue;
    const week = game.SeasonWeek;
    const type = game.SeasonWeekType;
    if (!tbWeekData[week]) tbWeekData[week] = {};
    tbWeekData[week][type] = (tbWeekData[week][type] || 0) + 1;
  }

  console.log('\nWeek breakdown (first 20 weeks):');
  for (let w = 0; w <= 20; w++) {
    if (tbWeekData[w]) {
      const types = Object.entries(tbWeekData[w]).map(([t, c]) => `${t}:${c}`).join(', ');
      console.log(`  Week ${w}: ${types}`);
    }
  }

  // Find max regular season week
  let tbMaxRegular = 0;
  for (const game of tbGameTable.records) {
    if (game.isEmpty) continue;
    if (game.SeasonWeekType === 'RegularSeason' && game.SeasonWeek > tbMaxRegular) {
      tbMaxRegular = game.SeasonWeek;
    }
  }
  console.log('\nMax RegularSeason week:', tbMaxRegular);

  // Now check the user's test franchise (if they provide the path)
  const testPath = process.argv[2];
  if (testPath) {
    console.log('\n\n=== USER TEST FRANCHISE ===');
    console.log('Path:', testPath);

    const test = new FranchiseFile(testPath);
    await test.parse();

    const testSeasonInfo = test.getTableByName('SeasonInfo');
    await testSeasonInfo.readRecords();
    const testSeason = testSeasonInfo.records.find(r => !r.isEmpty);
    if (testSeason) {
      console.log('NflseasonWeekCount:', testSeason.NflseasonWeekCount);
      console.log('PreseasonWeekCount:', testSeason.PreseasonWeekCount);
    } else {
      console.log('No non-empty SeasonInfo record found');
    }

    const testGameTable = test.getTableByName('SeasonGame');
    await testGameTable.readRecords();

    const testWeekData = {};
    for (const game of testGameTable.records) {
      if (game.isEmpty) continue;
      const week = game.SeasonWeek;
      const type = game.SeasonWeekType;
      if (!testWeekData[week]) testWeekData[week] = {};
      testWeekData[week][type] = (testWeekData[week][type] || 0) + 1;
    }

    console.log('\nWeek breakdown (first 20 weeks):');
    for (let w = 0; w <= 20; w++) {
      if (testWeekData[w]) {
        const types = Object.entries(testWeekData[w]).map(([t, c]) => `${t}:${c}`).join(', ');
        console.log(`  Week ${w}: ${types}`);
      }
    }

    let testMaxRegular = 0;
    for (const game of testGameTable.records) {
      if (game.isEmpty) continue;
      if (game.SeasonWeekType === 'RegularSeason' && game.SeasonWeek > testMaxRegular) {
        testMaxRegular = game.SeasonWeek;
      }
    }
    console.log('\nMax RegularSeason week:', testMaxRegular);
  } else {
    console.log('\n\nTo analyze your test franchise, run:');
    console.log('node diagnose-2004.js "path/to/your/franchise"');
  }
}

diagnose().catch(console.error);
