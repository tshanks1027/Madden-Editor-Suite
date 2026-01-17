const { FranchiseFile } = require('madden-franchise');

// Compare two franchise files
const throwbackPath = 'C:/Users/tshan/OneDrive/Documents/2011 Throwback/2011 Throwback V0.9/2011 Throwback V0.9/CAREER-2011THROWBACKV09';
// Use a default/test franchise if available
const defaultPath = process.argv[2] || throwbackPath;

async function analyze() {
  console.log('Analyzing:', throwbackPath);
  const franchise = new FranchiseFile(throwbackPath);
  await franchise.parse();

  // Get SeasonInfo table
  const seasonInfo = franchise.getTableByName('SeasonInfo');
  if (!seasonInfo) {
    console.log('SeasonInfo table not found');
    return;
  }

  await seasonInfo.readRecords();

  console.log('=== 2011 Throwback SeasonInfo ===');
  console.log('Records:', seasonInfo.records.length);

  if (seasonInfo.records.length > 0) {
    const record = seasonInfo.records[0];
    console.log('Record type:', typeof record);

    // Try to get all field headers
    if (seasonInfo.header && seasonInfo.header.fields) {
      console.log('Fields from header:');
      for (const field of seasonInfo.header.fields) {
        const name = field.name || field.fieldName || `Field_${field.offset}`;
        try {
          const val = record[name];
          if (name.toLowerCase().includes('week') ||
              name.toLowerCase().includes('season') ||
              name.toLowerCase().includes('nfl') ||
              name.toLowerCase().includes('count') ||
              name.toLowerCase().includes('num')) {
            console.log('  ' + name + ':', val);
          }
        } catch (e) {}
      }
    }

    // Also try generic field access
    console.log('\nGeneric fields (Field_0 to Field_50):');
    for (let i = 0; i <= 50; i++) {
      try {
        const val = record['Field_' + i];
        if (val !== undefined && val !== null && val !== '') {
          console.log('  Field_' + i + ':', val);
        }
      } catch (e) {}
    }
  }

  // Also check SeasonGame table for week 17/18 games
  console.log('\n=== SeasonGame Week Analysis ===');
  const gameTable = franchise.getTableByName('SeasonGame');
  if (gameTable) {
    await gameTable.readRecords();
    console.log('Total game records:', gameTable.records.length);

    const weekCounts = {};
    let regularSeasonGames = 0;
    let preseasonGames = 0;

    for (const game of gameTable.records) {
      if (game.isEmpty) continue;

      // Try different field access methods
      let week = game.SeasonWeek;
      let weekType = game.SeasonWeekType;

      // Fallback to generic fields (Field_52 = SeasonWeek, Field_53 = SeasonWeekType)
      if (week === undefined) week = game.Field_52;
      if (weekType === undefined) weekType = game.Field_53;

      if (week !== undefined) {
        // Show raw type number
        const key = `Week ${week} (Type=${weekType})`;
        weekCounts[key] = (weekCounts[key] || 0) + 1;

        if (weekType === 1) regularSeasonGames++;
        if (weekType === 0) preseasonGames++;
      }
    }

    console.log('Regular season games:', regularSeasonGames);
    console.log('Preseason games:', preseasonGames);

    // Sort and print
    const sorted = Object.entries(weekCounts).sort((a, b) => {
      const weekA = parseInt(a[0].match(/Week (\d+)/)?.[1] || '0');
      const weekB = parseInt(b[0].match(/Week (\d+)/)?.[1] || '0');
      return weekA - weekB;
    });

    console.log('\nBreakdown by week:');
    for (const [key, count] of sorted) {
      console.log('  ' + key + ':', count, 'games');
    }
  }
}

analyze().catch(console.error);
