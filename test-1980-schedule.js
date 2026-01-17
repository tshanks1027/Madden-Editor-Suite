/**
 * Test script for 1980 schedule application (28 teams, 16-game season)
 * Missing teams: JAX(16), CAR(20), BAL(24), HOU(31)
 */
async function test() {
  const mf = await import('madden-franchise');
  const fs = require('fs');

  const src = 'C:/Users/tshan/Documents/Madden NFL 26/Saves/CAREER-REAL';
  const dst = 'C:/Users/tshan/Documents/Madden NFL 26/Saves/CAREER-1980TEST';

  console.log('Creating fresh copy...');
  fs.copyFileSync(src, dst);

  const franchise = await mf.create(dst);

  // Load team table for mapping
  const teamTable = franchise.getTableByUniqueId(637929298);
  await teamTable.readRecords();

  const teamIndexToRecordIndex = new Map();
  const teamIndexToName = new Map();
  for (const t of teamTable.records) {
    if (!t.isEmpty && t.TeamIndex !== undefined && t.TeamIndex < 32) {
      teamIndexToRecordIndex.set(t.TeamIndex, t.index);
      teamIndexToName.set(t.TeamIndex, t.ShortName || t.DisplayName || `Team${t.TeamIndex}`);
    }
  }
  console.log('Team mappings loaded:', teamIndexToRecordIndex.size);

  // Get existing team ref prefix
  const gameTable = franchise.getTableByName('SeasonGame');
  await gameTable.readRecords();

  let prefix = '001011100011101000000000';
  for (const r of gameTable.records) {
    if (!r.isEmpty && r.HomeTeam && r.HomeTeam.length === 32 && r.HomeTeam !== '00000000000000000000000000000000') {
      prefix = r.HomeTeam.slice(0, 24);
      break;
    }
  }
  console.log('Team ref prefix:', prefix);

  // Load 1980 schedule
  const schedule = JSON.parse(fs.readFileSync('data/retro/schedules/1980.json', 'utf8'));
  const regularGames = schedule.games.filter(g => g.weekType !== 'preseason');
  console.log('Regular season games to apply:', regularGames.length);
  console.log('Season length:', schedule.seasonLength);

  // Check which teams are in the schedule
  const teamsInSchedule = new Set();
  for (const g of regularGames) {
    teamsInSchedule.add(g.homeTeamIndex);
    teamsInSchedule.add(g.awayTeamIndex);
  }
  console.log('Unique teams in schedule:', teamsInSchedule.size);

  // Group schedule games by week
  const gamesByMaddenWeek = new Map();
  for (const g of regularGames) {
    const maddenWeek = g.week - 1;
    if (!gamesByMaddenWeek.has(maddenWeek)) gamesByMaddenWeek.set(maddenWeek, []);
    gamesByMaddenWeek.get(maddenWeek).push(g);
  }

  // Get all regular season slots
  const regularSlots = gameTable.records.filter(r =>
    !r.isEmpty && String(r.SeasonWeekType) === 'RegularSeason'
  ).sort((a, b) => a.index - b.index);
  console.log('Regular season slots in file:', regularSlots.length);

  // Group slots by week
  const slotsByWeek = new Map();
  for (const s of regularSlots) {
    const week = s.SeasonWeek;
    if (!slotsByWeek.has(week)) slotsByWeek.set(week, []);
    slotsByWeek.get(week).push(s);
  }

  // Show comparison
  console.log('\n=== WEEK BY WEEK COMPARISON ===');
  for (let w = 0; w <= 17; w++) {
    const slots = slotsByWeek.get(w) || [];
    const games = gamesByMaddenWeek.get(w) || [];
    const diff = slots.length - games.length;
    const diffStr = diff > 0 ? `+${diff} extra` : diff < 0 ? `${diff} short` : 'exact';
    console.log(`Week ${w.toString().padStart(2)}: ${slots.length} slots, ${games.length} games (${diffStr})`);
  }

  const nullRef = '00000000000000000000000000000000';
  let gamesApplied = 0;
  let offSeasonCount = 0;
  let droppedGames = 0;

  // Process each week
  for (const [maddenWeek, slots] of slotsByWeek) {
    const historicalGames = gamesByMaddenWeek.get(maddenWeek) || [];

    if (historicalGames.length === 0) {
      // No games for this week - mark all as OffSeason
      for (const slot of slots) {
        slot.SeasonWeekType = 'OffSeason';
        slot.HomeTeam = nullRef;
        slot.AwayTeam = nullRef;
        slot.GameStatus = 'Unplayed';
        offSeasonCount++;
      }
    } else {
      const gamesToApply = Math.min(slots.length, historicalGames.length);
      droppedGames += Math.max(0, historicalGames.length - slots.length);

      for (let i = 0; i < gamesToApply; i++) {
        const slot = slots[i];
        const game = historicalGames[i];

        const homeRecIdx = teamIndexToRecordIndex.get(game.homeTeamIndex);
        const awayRecIdx = teamIndexToRecordIndex.get(game.awayTeamIndex);

        if (homeRecIdx !== undefined && awayRecIdx !== undefined) {
          slot.HomeTeam = prefix + homeRecIdx.toString(2).padStart(8, '0');
          slot.AwayTeam = prefix + awayRecIdx.toString(2).padStart(8, '0');
          slot.GameStatus = 'Unplayed';
          gamesApplied++;
        } else {
          console.warn(`Could not map: ${game.homeTeam} (${game.homeTeamIndex}) vs ${game.awayTeam} (${game.awayTeamIndex})`);
        }
      }

      // Extra slots become OffSeason
      for (let i = gamesToApply; i < slots.length; i++) {
        slots[i].SeasonWeekType = 'OffSeason';
        slots[i].HomeTeam = nullRef;
        slots[i].AwayTeam = nullRef;
        slots[i].GameStatus = 'Unplayed';
        offSeasonCount++;
      }
    }
  }

  console.log('\n=== SUMMARY ===');
  console.log('Games applied:', gamesApplied);
  console.log('OffSeason slots:', offSeasonCount);
  console.log('Dropped games:', droppedGames);

  await franchise.save();
  console.log('Saved to:', dst);

  // Verify
  console.log('\n=== VERIFICATION ===');
  const verify = await mf.create(dst);
  const vg = verify.getTableByName('SeasonGame');
  await vg.readRecords();

  const regSeason = vg.records.filter(r => !r.isEmpty && String(r.SeasonWeekType) === 'RegularSeason');
  const offSeason = vg.records.filter(r => !r.isEmpty && String(r.SeasonWeekType) === 'OffSeason');
  const preseason = vg.records.filter(r => !r.isEmpty && String(r.SeasonWeekType) === 'PreSeason');

  console.log('PreSeason:', preseason.length);
  console.log('RegularSeason:', regSeason.length);
  console.log('OffSeason:', offSeason.length);
  console.log('Total:', preseason.length + regSeason.length + offSeason.length);

  // Check team game counts in regular season
  const vt = verify.getTableByUniqueId(637929298);
  await vt.readRecords();
  const r2t = new Map();
  for (const t of vt.records) {
    if (!t.isEmpty && t.TeamIndex !== undefined && t.TeamIndex < 32) {
      r2t.set(t.index, t.TeamIndex);
    }
  }

  const teamGameCounts = {};
  for (const g of regSeason) {
    if (g.HomeTeam && g.HomeTeam !== nullRef) {
      const ri = parseInt(g.HomeTeam.slice(24), 2);
      const ti = r2t.get(ri);
      if (ti !== undefined) teamGameCounts[ti] = (teamGameCounts[ti] || 0) + 1;
    }
    if (g.AwayTeam && g.AwayTeam !== nullRef) {
      const ri = parseInt(g.AwayTeam.slice(24), 2);
      const ti = r2t.get(ri);
      if (ti !== undefined) teamGameCounts[ti] = (teamGameCounts[ti] || 0) + 1;
    }
  }

  console.log('\n=== TEAM GAME COUNTS ===');
  const expansionTeams = [16, 20, 24, 31]; // JAX, CAR, BAL, HOU
  for (let ti = 0; ti < 32; ti++) {
    const count = teamGameCounts[ti] || 0;
    const name = teamIndexToName.get(ti) || `Team${ti}`;
    const marker = expansionTeams.includes(ti) ? ' (EXPANSION - should be 0)' : '';
    if (count !== 16 || marker) {
      console.log(`  Team ${ti} (${name}): ${count} games${marker}`);
    }
  }

  console.log('\n=== TRY LOADING CAREER-1980TEST IN MADDEN ===');
}

test().catch(e => console.error(e));
