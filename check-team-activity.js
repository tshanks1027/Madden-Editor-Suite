/**
 * Check team activity status in 2011 mod vs real file
 * How does 2011 mod handle 32 teams when it only needs 32?
 */
async function check() {
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
    const teamTable = franchise.getTableByUniqueId(637929298);
    await teamTable.readRecords();

    console.log('\nTeam records:', teamTable.records.length);

    // Check all teams
    const teams = [];
    for (const t of teamTable.records) {
      if (t.isEmpty) continue;
      if (t.TeamIndex === undefined || t.TeamIndex >= 32) continue;

      teams.push({
        index: t.index,
        teamIndex: t.TeamIndex,
        name: t.ShortName || t.DisplayName || 'Unknown',
        longName: t.LongName || 'Unknown'
      });
    }

    teams.sort((a, b) => a.teamIndex - b.teamIndex);

    console.log('\nActive teams (TeamIndex < 32):');
    for (const t of teams) {
      console.log(`  TI${t.teamIndex.toString().padStart(2)}: ${t.name.padEnd(5)} (${t.longName})`);
    }

    // Check regular season to see which teams actually play
    const gameTable = franchise.getTableByName('SeasonGame');
    await gameTable.readRecords();

    const r2t = new Map();
    for (const t of teams) {
      r2t.set(t.index, t.teamIndex);
    }

    const regularSeason = gameTable.records.filter(r => !r.isEmpty && String(r.SeasonWeekType) === 'RegularSeason');

    const tc = {};
    const nullRef = '00000000000000000000000000000000';
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

    console.log('\nTeams with regular season games:');
    for (const t of teams) {
      const games = tc[t.teamIndex] || 0;
      console.log(`  TI${t.teamIndex.toString().padStart(2)}: ${games} games - ${t.name}`);
    }

    // Check if any teams have 0 games
    const teamsWithNoGames = teams.filter(t => !tc[t.teamIndex]);
    if (teamsWithNoGames.length > 0) {
      console.log('\nTEAMS WITH NO GAMES:', teamsWithNoGames.map(t => `${t.name}(TI${t.teamIndex})`).join(', '));
    } else {
      console.log('\nALL TEAMS HAVE GAMES');
    }
  }
}

check().catch(e => console.error(e));
