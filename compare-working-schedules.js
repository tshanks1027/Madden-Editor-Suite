/**
 * Compare two WORKING schedule files to understand correct structure
 */
async function compare() {
  const mf = await import('madden-franchise');

  const files = {
    'MOD_2011': 'C:/Users/tshan/Downloads/2011 Throwback V0.9/2011 Throwback V0.9/CAREER-2011THROWBACKV09',
    'REAL': 'C:/Users/tshan/Documents/Madden NFL 26/Saves/CAREER-REAL'
  };

  const data = {};

  for (const [name, path] of Object.entries(files)) {
    console.log(`\nLoading ${name}...`);
    const franchise = await mf.create(path);
    const gameTable = franchise.getTableByName('SeasonGame');
    await gameTable.readRecords();

    const teamTable = franchise.getTableByUniqueId(637929298);
    await teamTable.readRecords();

    // Build team maps
    const t2r = new Map();
    const r2t = new Map();
    for (const t of teamTable.records) {
      if (!t.isEmpty && t.TeamIndex !== undefined && t.TeamIndex < 32) {
        t2r.set(t.TeamIndex, t.index);
        r2t.set(t.index, t.TeamIndex);
      }
    }

    // Get preseason records
    const preseason = gameTable.records.filter(r => !r.isEmpty && String(r.SeasonWeekType) === 'PreSeason').sort((a, b) => a.index - b.index);

    data[name] = { preseason, t2r, r2t };
  }

  console.log('\n' + '='.repeat(60));
  console.log('COMPARISON');
  console.log('='.repeat(60));

  // Compare first few records
  console.log('\n=== FIRST 10 PRESEASON RECORDS ===\n');

  for (let i = 0; i < 10; i++) {
    const mod = data.MOD_2011.preseason[i];
    const real = data.REAL.preseason[i];

    console.log(`--- Record ${i} (index ${mod?.index || '?'} / ${real?.index || '?'}) ---`);

    if (mod && real) {
      console.log(`  SeasonWeek: MOD=${mod.SeasonWeek} REAL=${real.SeasonWeek}`);
      console.log(`  GameStatus: MOD=${String(mod.GameStatus)} REAL=${String(real.GameStatus)}`);
      console.log(`  HomeTeam prefix: MOD=${mod.HomeTeam.slice(0,24)} REAL=${real.HomeTeam.slice(0,24)}`);

      // Decode team indices
      if (mod.HomeTeam !== '00000000000000000000000000000000') {
        const modHomeRI = parseInt(mod.HomeTeam.slice(24), 2);
        const modAwayRI = parseInt(mod.AwayTeam.slice(24), 2);
        const modHomeTI = data.MOD_2011.r2t.get(modHomeRI);
        const modAwayTI = data.MOD_2011.r2t.get(modAwayRI);
        console.log(`  MOD matchup: TeamIndex ${modHomeTI} vs ${modAwayTI}`);
      }

      if (real.HomeTeam !== '00000000000000000000000000000000') {
        const realHomeRI = parseInt(real.HomeTeam.slice(24), 2);
        const realAwayRI = parseInt(real.AwayTeam.slice(24), 2);
        const realHomeTI = data.REAL.r2t.get(realHomeRI);
        const realAwayTI = data.REAL.r2t.get(realAwayRI);
        console.log(`  REAL matchup: TeamIndex ${realHomeTI} vs ${realAwayTI}`);
      }
    }
    console.log('');
  }

  // Show week distributions
  console.log('\n=== WEEK DISTRIBUTION ===\n');

  for (const [name, d] of Object.entries(data)) {
    const valid = d.preseason.filter(g => String(g.GameStatus) !== 'Invalid_');
    const byWeek = [0, 0, 0, 0];
    for (const g of valid) {
      byWeek[g.SeasonWeek] = (byWeek[g.SeasonWeek] || 0) + 1;
    }
    console.log(`${name}: Week0=${byWeek[0]} Week1=${byWeek[1]} Week2=${byWeek[2]} Week3=${byWeek[3]}`);
  }

  // Show team game counts
  console.log('\n=== TEAM GAME COUNTS ===\n');
  const nullRef = '00000000000000000000000000000000';

  for (const [name, d] of Object.entries(data)) {
    const valid = d.preseason.filter(g => String(g.GameStatus) !== 'Invalid_');
    const tc = {};

    for (const g of valid) {
      if (g.HomeTeam && g.HomeTeam !== nullRef) {
        const ri = parseInt(g.HomeTeam.slice(24), 2);
        const ti = d.r2t.get(ri);
        if (ti !== undefined) tc[ti] = (tc[ti] || 0) + 1;
      }
      if (g.AwayTeam && g.AwayTeam !== nullRef) {
        const ri = parseInt(g.AwayTeam.slice(24), 2);
        const ti = d.r2t.get(ri);
        if (ti !== undefined) tc[ti] = (tc[ti] || 0) + 1;
      }
    }

    const counts = Object.values(tc);
    const uniqueCounts = [...new Set(counts)];
    console.log(`${name}: ${Object.keys(tc).length} teams, game counts: ${uniqueCounts.join(', ')}`);

    // Show any teams with != 3 games
    for (const [ti, count] of Object.entries(tc)) {
      if (count !== 3) {
        console.log(`  WARNING: TeamIndex ${ti} has ${count} games`);
      }
    }
  }

  // Check specific fields that might differ
  console.log('\n=== ALL FIELDS ON FIRST VALID GAME ===\n');

  const modValid = data.MOD_2011.preseason.find(g => String(g.GameStatus) !== 'Invalid_');
  const realValid = data.REAL.preseason.find(g => String(g.GameStatus) !== 'Invalid_');

  if (modValid && realValid) {
    // Try to get field list
    const fields = ['HomeTeam', 'AwayTeam', 'SeasonWeek', 'SeasonWeekType', 'GameStatus',
                    'HomeScore', 'AwayScore', 'DayOfWeek', 'TimeOfDay', 'Stadium',
                    'IsPracticeMode', 'SeasonYear', 'IsNeutralSite'];

    for (const field of fields) {
      try {
        console.log(`${field}:`);
        console.log(`  MOD:  ${modValid[field]}`);
        console.log(`  REAL: ${realValid[field]}`);
      } catch (e) {}
    }
  }
}

compare().catch(e => console.error(e));
