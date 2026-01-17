async function analyze() {
  try {
    const mf = await import('madden-franchise');

    // Change this to analyze the corrupted file
const filePath = 'C:/Users/tshan/Documents/Madden NFL 26/Saves/CAREER-1994TEST';

    // Use the create function
    const franchise = await mf.create(filePath);
    console.log('Franchise loaded');

    // Get game table by unique ID (same as in RetroEditorService)
    let gameTable = franchise.getTableByUniqueId(2816609684);
    if (!gameTable) {
      console.log('Game table not found by ID, trying by name');
      gameTable = franchise.getTableByName('SeasonGame');
    }
    await gameTable.readRecords();

    console.log('SeasonGame records:', gameTable.records.length);

    // Get team table to understand mapping
    const teamTable = franchise.getTableByUniqueId(637929298);
    await teamTable.readRecords();
    console.log('Team records:', teamTable.records.length);

    // Show ALL teams, sorted by TeamIndex
    console.log('\n=== TEAM MAPPING (sorted by TeamIndex) ===');
    const allTeams = [];
    for (const team of teamTable.records) {
      if (team.isEmpty) continue;
      allTeams.push({
        teamIndex: team.TeamIndex,
        recordIndex: team.index,
        name: team.LongName || team.DisplayName
      });
    }
    allTeams.sort((a, b) => a.teamIndex - b.teamIndex);
    for (const t of allTeams) {
      console.log('TeamIndex:', t.teamIndex.toString().padStart(2), '| RecordIdx:', t.recordIndex.toString().padStart(2), '| Name:', t.name);
    }

    // Check for missing team indices
    console.log('\n=== MISSING TEAM INDICES ===');
    const expected1994 = [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,17,18,19,21,22,23,25,26,27,28,29,30];
    for (const idx of expected1994) {
      const found = allTeams.find(t => t.teamIndex === idx);
      if (!found) {
        console.log('MISSING TeamIndex', idx);
      }
    }

    // Look at preseason games
    console.log('\n=== PRESEASON GAMES (first 10) ===');
    let count = 0;
    for (const rec of gameTable.records) {
      if (rec.isEmpty) continue;
      const weekType = rec.SeasonWeekType;
      if (weekType !== 'PreSeason' && weekType !== 0) continue;
      if (count++ >= 10) break;

      console.log('---');
      console.log('Index:', rec.index, '| Week:', rec.SeasonWeek, '| Type:', weekType);
      console.log('HomeTeam:', rec.HomeTeam);
      console.log('AwayTeam:', rec.AwayTeam);
    }

    // Count games per week type
    console.log('\n=== GAMES BY WEEK TYPE ===');
    const byType = {};
    for (const rec of gameTable.records) {
      if (rec.isEmpty) continue;
      const t = String(rec.SeasonWeekType);
      byType[t] = (byType[t] || 0) + 1;
    }
    console.log(byType);

    // Count preseason games per week
    console.log('\n=== PRESEASON GAMES PER WEEK ===');
    const byWeek = {};
    for (const rec of gameTable.records) {
      if (rec.isEmpty) continue;
      const weekType = rec.SeasonWeekType;
      if (weekType !== 'PreSeason' && weekType !== 0) continue;
      const w = rec.SeasonWeek;
      byWeek[w] = (byWeek[w] || 0) + 1;
    }
    console.log(byWeek);

    // Build reverse mapping: RecordIdx -> TeamIndex
    const recordIdxToTeamIdx = {};
    for (const team of teamTable.records) {
      if (team.isEmpty) continue;
      if (team.TeamIndex < 32) {
        recordIdxToTeamIdx[team.index] = team.TeamIndex;
      }
    }

    // Count preseason games PER TEAM
    console.log('\n=== PRESEASON GAMES PER TEAM ===');
    const teamGameCount = {};
    const prefix = '001011100011101000000000';

    for (const rec of gameTable.records) {
      if (rec.isEmpty) continue;
      const weekType = rec.SeasonWeekType;
      if (weekType !== 'PreSeason' && weekType !== 0) continue;

      const homeRef = rec.HomeTeam;
      const awayRef = rec.AwayTeam;

      // Decode home team
      if (homeRef && homeRef.startsWith(prefix)) {
        const recIdx = parseInt(homeRef.slice(24), 2);
        const teamIdx = recordIdxToTeamIdx[recIdx];
        if (teamIdx !== undefined) {
          teamGameCount[teamIdx] = (teamGameCount[teamIdx] || 0) + 1;
        }
      }

      // Decode away team
      if (awayRef && awayRef.startsWith(prefix)) {
        const recIdx = parseInt(awayRef.slice(24), 2);
        const teamIdx = recordIdxToTeamIdx[recIdx];
        if (teamIdx !== undefined) {
          teamGameCount[teamIdx] = (teamGameCount[teamIdx] || 0) + 1;
        }
      }
    }

    // Print sorted by TeamIndex
    console.log('TeamIndex -> Preseason Games:');
    const sorted = Object.entries(teamGameCount).sort((a,b) => parseInt(a[0]) - parseInt(b[0]));
    for (const [teamIdx, count] of sorted) {
      console.log(`  Team ${teamIdx}: ${count} games`);
    }

  } catch (err) {
    console.error('Error:', err.message, err.stack);
  }
}

analyze();
