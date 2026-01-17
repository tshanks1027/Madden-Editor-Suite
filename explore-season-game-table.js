// Script to explore SeasonGame table structure in a franchise file
// Usage: node explore-season-game-table.js <franchise-file-path>

// M26 Table IDs from madden-franchise-utils
const TABLE_IDS = {
  seasonInfoTable: 3123991521,
  teamTable: 637929298,
  draftPickTable: 1097032632,
  gameTable: 2816609684
};

async function exploreSeasonGameTable(filePath) {
  console.log(`Loading franchise file: ${filePath}`);

  // Dynamic import for ESM module
  const module = await import('madden-franchise');
  const createFranchise = module.create;

  const franchise = await createFranchise(filePath);
  console.log('Franchise file loaded successfully');

  console.log('\n--- Tables in franchise file ---');
  const tables = franchise.tables || [];
  console.log(`Total tables: ${tables.length}`);

  // Get SeasonInfo
  console.log('\n=== SeasonInfo ===');
  let seasonInfoTable = franchise.getTableByUniqueId(TABLE_IDS.seasonInfoTable);
  if (!seasonInfoTable) {
    seasonInfoTable = franchise.getTableByName('SeasonInfo');
  }

  if (seasonInfoTable) {
    await seasonInfoTable.readRecords();
    const rec = seasonInfoTable.records[0];
    console.log(`  CurrentSeasonYear: ${rec.CurrentSeasonYear}`);
    console.log(`  CurrentWeek: ${rec.CurrentWeek}`);
    console.log(`  CurrentStage: ${rec.CurrentStage}`);
  }

  // Get Team table
  console.log('\n=== Team Table ===');
  let teamTable = franchise.getTableByUniqueId(TABLE_IDS.teamTable);
  if (!teamTable) {
    teamTable = franchise.getTableByName('Team');
  }

  const teamIndexMap = {};
  if (teamTable) {
    await teamTable.readRecords();
    const nonEmptyTeams = teamTable.records.filter(r => !r.isEmpty);
    console.log(`Total teams: ${nonEmptyTeams.length}`);

    for (let i = 0; i < nonEmptyTeams.length; i++) {
      const team = nonEmptyTeams[i];
      teamIndexMap[team.index] = team.ShortName || team.LongName || `Team${i}`;
      if (i < 36) {
        console.log(`  [${team.index}] TeamIndex=${team.TeamIndex}, Name=${team.ShortName || team.LongName}`);
      }
    }
  }

  // Get SeasonGame table
  console.log('\n=== SeasonGame Table ===');
  let gameTable = franchise.getTableByUniqueId(TABLE_IDS.gameTable);
  if (!gameTable) {
    gameTable = franchise.getTableByName('SeasonGame');
  }

  if (gameTable) {
    await gameTable.readRecords();
    const nonEmptyGames = gameTable.records.filter(r => !r.isEmpty);
    console.log(`Total game records: ${nonEmptyGames.length}`);

    // Group by SeasonWeekType
    const gamesByType = {};
    for (const game of nonEmptyGames) {
      const weekType = game.SeasonWeekType || 'Unknown';
      if (!gamesByType[weekType]) {
        gamesByType[weekType] = [];
      }
      gamesByType[weekType].push(game);
    }

    console.log('\nGames by week type:');
    for (const [type, games] of Object.entries(gamesByType)) {
      console.log(`  ${type}: ${games.length} games`);
    }

    // Show regular season games by week
    console.log('\n=== Regular Season Games ===');
    const regularGames = nonEmptyGames.filter(g => g.SeasonWeekType === 'RegularSeason');
    const gamesByWeek = {};
    for (const game of regularGames) {
      const week = game.SeasonWeek;
      if (!gamesByWeek[week]) {
        gamesByWeek[week] = [];
      }
      gamesByWeek[week].push(game);
    }

    for (const week of Object.keys(gamesByWeek).sort((a, b) => parseInt(a) - parseInt(b))) {
      const games = gamesByWeek[week];
      console.log(`\nWeek ${week}: ${games.length} games`);
      for (let i = 0; i < Math.min(3, games.length); i++) {
        const game = games[i];
        // HomeTeam/AwayTeam are references - let's see how they look
        console.log(`  Game ${i + 1}: Home=${game.HomeTeam}, Away=${game.AwayTeam}, Status=${game.GameStatus}`);
      }
    }

    // Show first few games with all fields
    console.log('\n=== First 3 Games (all fields) ===');
    for (let i = 0; i < Math.min(3, nonEmptyGames.length); i++) {
      const game = nonEmptyGames[i];
      console.log(`\nGame ${i + 1} (index ${game.index}):`);
      console.log(`  SeasonWeek: ${game.SeasonWeek}`);
      console.log(`  SeasonWeekType: ${game.SeasonWeekType}`);
      console.log(`  SeasonYear: ${game.SeasonYear}`);
      console.log(`  HomeTeam: ${game.HomeTeam}`);
      console.log(`  AwayTeam: ${game.AwayTeam}`);
      console.log(`  GameStatus: ${game.GameStatus}`);
      console.log(`  DayOfWeek: ${game.DayOfWeek}`);
      console.log(`  Stadium: ${game.Stadium}`);
    }
  }
}

// Run
const args = process.argv.slice(2);
if (args.length === 0) {
  console.log('Usage: node explore-season-game-table.js <franchise-file-path>');
  process.exit(1);
}

exploreSeasonGameTable(args[0]).catch(console.error);
