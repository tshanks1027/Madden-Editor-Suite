/**
 * Study regular season structure in depth
 * Find what makes schedules work vs crash
 */
async function study() {
  const mf = await import('madden-franchise');

  const files = {
    'MOD_2011': 'C:/Users/tshan/Downloads/2011 Throwback V0.9/2011 Throwback V0.9/CAREER-2011THROWBACKV09',
    'REAL': 'C:/Users/tshan/Documents/Madden NFL 26/Saves/CAREER-REAL'
  };

  for (const [name, path] of Object.entries(files)) {
    console.log('\n' + '='.repeat(60));
    console.log(`FILE: ${name}`);
    console.log('='.repeat(60));

    const franchise = await mf.create(path);
    const gameTable = franchise.getTableByName('SeasonGame');
    await gameTable.readRecords();

    const teamTable = franchise.getTableByUniqueId(637929298);
    await teamTable.readRecords();

    // Build team map
    const r2t = new Map();
    const t2name = new Map();
    for (const t of teamTable.records) {
      if (!t.isEmpty && t.TeamIndex !== undefined && t.TeamIndex < 32) {
        r2t.set(t.index, t.TeamIndex);
        t2name.set(t.TeamIndex, t.ShortName || t.DisplayName || `Team${t.TeamIndex}`);
      }
    }

    // Get regular season games
    const regularSeason = gameTable.records.filter(r => !r.isEmpty && String(r.SeasonWeekType) === 'RegularSeason');
    console.log('\nRegular season games:', regularSeason.length);

    // Check week distribution
    const byWeek = {};
    for (const g of regularSeason) {
      byWeek[g.SeasonWeek] = (byWeek[g.SeasonWeek] || 0) + 1;
    }
    const weeks = Object.keys(byWeek).map(Number).sort((a, b) => a - b);
    console.log('Weeks:', weeks.length, '(', weeks[0], 'to', weeks[weeks.length - 1], ')');
    console.log('Games per week:', weeks.map(w => byWeek[w]).join(', '));

    // Check team game counts
    const nullRef = '00000000000000000000000000000000';
    const tc = {};
    for (const g of regularSeason) {
      if (g.HomeTeam && g.HomeTeam !== nullRef) {
        const ri = parseInt(g.HomeTeam.slice(24), 2);
        const ti = r2t.get(ri);
        if (ti !== undefined) tc[ti] = (tc[ti] || 0) + 1;
      }
      if (g.AwayTeam && g.AwayTeam !== nullRef) {
        const ri = parseInt(g.AwayTeam.slice(24), 2);
        const ti = r2t.get(ri);
        if (ti !== undefined) tc[ti] = (tc[ti] || 0) + 1;
      }
    }

    const counts = [...new Set(Object.values(tc))].sort((a, b) => a - b);
    console.log('Team game counts:', counts.join(', '));
    console.log('Teams with games:', Object.keys(tc).length);

    // Show all fields on first regular season game
    console.log('\n=== FIRST REGULAR SEASON GAME FIELDS ===');
    const first = regularSeason.sort((a, b) => a.index - b.index)[0];
    if (first) {
      console.log('Record index:', first.index);

      const fields = [
        'HomeTeam', 'AwayTeam', 'SeasonWeek', 'SeasonWeekType', 'GameStatus',
        'HomeScore', 'AwayScore', 'DayOfWeek', 'TimeOfDay', 'Stadium',
        'IsPracticeMode', 'SeasonYear', 'IsNeutralSite'
      ];

      for (const field of fields) {
        try {
          console.log(`  ${field}: ${first[field]}`);
        } catch (e) {}
      }

      // Decode teams
      if (first.HomeTeam !== nullRef) {
        const homeRI = parseInt(first.HomeTeam.slice(24), 2);
        const awayRI = parseInt(first.AwayTeam.slice(24), 2);
        const homeTI = r2t.get(homeRI);
        const awayTI = r2t.get(awayRI);
        console.log(`  Matchup: ${t2name.get(homeTI)} (TI${homeTI}) vs ${t2name.get(awayTI)} (TI${awayTI})`);
      }
    }

    // Check for any games with Invalid_ status in regular season
    const invalidRegSeason = regularSeason.filter(g => String(g.GameStatus) === 'Invalid_');
    console.log('\nInvalid_ games in regular season:', invalidRegSeason.length);

    // Check for bye weeks
    console.log('\n=== BYE WEEK ANALYSIS ===');
    for (const week of weeks) {
      const weekGames = regularSeason.filter(g => g.SeasonWeek === week);
      const teamsPlaying = new Set();
      for (const g of weekGames) {
        if (g.HomeTeam !== nullRef) {
          const ri = parseInt(g.HomeTeam.slice(24), 2);
          const ti = r2t.get(ri);
          if (ti !== undefined) teamsPlaying.add(ti);
        }
        if (g.AwayTeam !== nullRef) {
          const ri = parseInt(g.AwayTeam.slice(24), 2);
          const ti = r2t.get(ri);
          if (ti !== undefined) teamsPlaying.add(ti);
        }
      }

      const teamsOnBye = 32 - teamsPlaying.size;
      if (teamsOnBye > 0) {
        console.log(`  Week ${week}: ${teamsOnBye} teams on bye`);
      }
    }

    // Show record index ranges
    const indices = regularSeason.map(g => g.index).sort((a, b) => a - b);
    console.log('\nRecord index range:', indices[0], 'to', indices[indices.length - 1]);
  }
}

study().catch(e => console.error(e));
