// Script to understand team reference format in franchise files
// The HomeTeam/AwayTeam fields use binary reference strings

const TABLE_IDS = {
  seasonInfoTable: 3123991521,
  teamTable: 637929298,
  gameTable: 2816609684
};

async function analyzeTeamReferences(filePath) {
  console.log(`Loading franchise file: ${filePath}`);

  const module = await import('madden-franchise');
  const createFranchise = module.create;

  const franchise = await createFranchise(filePath);
  console.log('Franchise file loaded successfully');

  // Get Team table
  let teamTable = franchise.getTableByUniqueId(TABLE_IDS.teamTable);
  if (!teamTable) {
    teamTable = franchise.getTableByName('Team');
  }

  if (!teamTable) {
    console.log('Could not find Team table');
    return;
  }

  await teamTable.readRecords();
  const nonEmptyTeams = teamTable.records.filter(r => !r.isEmpty);

  console.log('\n=== Team Table Structure ===');
  console.log(`Table name: ${teamTable.name}`);
  console.log(`Table header name: ${teamTable.header?.name}`);
  console.log(`Table id: ${teamTable.header?.uniqueId}`);
  console.log(`Total teams: ${nonEmptyTeams.length}`);

  // Create maps: teamIndex -> record index, and record index -> teamIndex
  const teamIndexToRecordIndex = new Map();
  const recordIndexToTeamInfo = new Map();

  console.log('\n=== Team Mappings ===');
  console.log('RecordIndex -> TeamIndex -> ShortName');
  for (const team of nonEmptyTeams) {
    teamIndexToRecordIndex.set(team.TeamIndex, team.index);
    recordIndexToTeamInfo.set(team.index, { teamIndex: team.TeamIndex, name: team.ShortName });
    console.log(`  [Record ${team.index}] TeamIndex=${team.TeamIndex}, Name=${team.ShortName}`);
  }

  // Get SeasonGame table
  let gameTable = franchise.getTableByUniqueId(TABLE_IDS.gameTable);
  if (!gameTable) {
    gameTable = franchise.getTableByName('SeasonGame');
  }

  if (!gameTable) {
    console.log('Could not find SeasonGame table');
    return;
  }

  await gameTable.readRecords();

  // Find regular season games with teams assigned
  const regularGames = gameTable.records.filter(r =>
    !r.isEmpty &&
    r.SeasonWeekType === 'RegularSeason' &&
    r.HomeTeam && r.HomeTeam !== '00000000000000000000000000000000'
  );

  console.log('\n=== Analyzing Team References ===');
  console.log(`Found ${regularGames.length} regular season games with teams assigned`);

  // Parse first few references to understand the format
  const first5 = regularGames.slice(0, 5);
  for (const game of first5) {
    const homeRef = game.HomeTeam;
    const awayRef = game.AwayTeam;

    console.log(`\nGame (Week ${game.SeasonWeek}):`);
    console.log(`  HomeTeam binary: ${homeRef}`);
    console.log(`  AwayTeam binary: ${awayRef}`);

    // Parse the binary - the last bits represent the row index
    // Format appears to be: tableId (bits) + rowIndex (bits)
    // Let's extract row index from last part

    // The reference format: 00101110001110100000000000XXXXXX
    // Where XXXXXX is the team record index

    const homeRecordIndex = parseInt(homeRef.slice(-8), 2); // Last 8 bits
    const awayRecordIndex = parseInt(awayRef.slice(-8), 2);

    const homeTeamInfo = recordIndexToTeamInfo.get(homeRecordIndex);
    const awayTeamInfo = recordIndexToTeamInfo.get(awayRecordIndex);

    console.log(`  Home record index: ${homeRecordIndex} -> ${homeTeamInfo?.name || 'Unknown'}`);
    console.log(`  Away record index: ${awayRecordIndex} -> ${awayTeamInfo?.name || 'Unknown'}`);
  }

  // Now understand how to CREATE a reference
  console.log('\n=== Reference Construction ===');

  // The prefix seems constant for the Team table
  // Let's extract it from a known reference
  if (regularGames.length > 0) {
    const sampleRef = regularGames[0].HomeTeam;
    const prefix = sampleRef.slice(0, -8); // Everything except last 8 bits
    console.log(`Reference prefix: ${prefix}`);
    console.log(`Reference prefix (decimal): ${parseInt(prefix, 2)}`);

    // Test constructing references
    console.log('\n=== Test Reference Construction ===');
    for (const [teamIndex, recordIndex] of teamIndexToRecordIndex.entries()) {
      if (teamIndex >= 32) continue; // Skip non-NFL teams
      const newRef = prefix + recordIndex.toString(2).padStart(8, '0');
      console.log(`  TeamIndex ${teamIndex} (record ${recordIndex}): ${newRef}`);
    }
  }
}

// Run
const args = process.argv.slice(2);
if (args.length === 0) {
  console.log('Usage: node test-team-references.js <franchise-file-path>');
  process.exit(1);
}

analyzeTeamReferences(args[0]).catch(console.error);
