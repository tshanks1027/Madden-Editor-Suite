/**
 * Test script for 2011 schedule application
 * Goal: Apply 2011 regular season schedule, verify it matches working 2011 mod
 * DOES NOT modify preseason - keeps Madden default
 */
async function test() {
  const mf = await import('madden-franchise');
  const fs = require('fs');

  // Use REAL file as base (has 17-game structure we need to convert to 16-game)
  const src = 'C:/Users/tshan/Documents/Madden NFL 26/Saves/CAREER-REAL';
  const dst = 'C:/Users/tshan/Documents/Madden NFL 26/Saves/CAREER-2011TEST';

  console.log('Creating fresh copy...');
  fs.copyFileSync(src, dst);

  const franchise = await mf.create(dst);

  // Load team table for mapping
  const teamTable = franchise.getTableByUniqueId(637929298);
  await teamTable.readRecords();

  const teamIndexToRecordIndex = new Map();
  for (const t of teamTable.records) {
    if (!t.isEmpty && t.TeamIndex !== undefined && t.TeamIndex < 32) {
      teamIndexToRecordIndex.set(t.TeamIndex, t.index);
    }
  }
  console.log('Team mappings loaded:', teamIndexToRecordIndex.size);

  // Get existing team ref prefix from a valid game
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

  // Load 2011 schedule
  const schedule = JSON.parse(fs.readFileSync('data/retro/schedules/2011.json', 'utf8'));
  const regularGames = schedule.games.filter(g => g.weekType !== 'preseason');
  console.log('Regular season games to apply:', regularGames.length);

  // Group schedule games by week (historical week 1 = Madden week 0)
  const gamesByMaddenWeek = new Map();
  for (const g of regularGames) {
    const maddenWeek = g.week - 1; // Historical week 1 -> Madden week 0
    if (!gamesByMaddenWeek.has(maddenWeek)) gamesByMaddenWeek.set(maddenWeek, []);
    gamesByMaddenWeek.get(maddenWeek).push(g);
  }

  // Get all regular season slots from franchise
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
    const diffStr = diff > 0 ? `+${diff} extra slots` : diff < 0 ? `${diff} slots short!` : 'exact';
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
      // No games for this week - mark all as OffSeason with null teams
      for (const slot of slots) {
        slot.SeasonWeekType = 'OffSeason';
        slot.HomeTeam = nullRef;
        slot.AwayTeam = nullRef;
        slot.GameStatus = 'Unplayed';
        offSeasonCount++;
      }
    } else {
      // Apply historical games up to available slots
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
          console.warn(`Could not map teams for: ${game.homeTeam} vs ${game.awayTeam}`);
        }
      }

      // Mark extra slots as OffSeason
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
  console.log('Dropped games (slots short):', droppedGames);

  // Save
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

  console.log('PreSeason records:', preseason.length);
  console.log('RegularSeason records:', regSeason.length);
  console.log('OffSeason records:', offSeason.length);

  // Check OffSeason has null teams
  const offSeasonNulls = offSeason.filter(r => r.HomeTeam === nullRef && r.AwayTeam === nullRef);
  console.log('OffSeason with null teams:', offSeasonNulls.length);

  // Compare with 2011 mod
  console.log('\n=== COMPARISON WITH WORKING 2011 MOD ===');
  console.log('2011 MOD has: 256 RegularSeason, 16 OffSeason');
  console.log('Our test has:', regSeason.length, 'RegularSeason,', offSeason.length, 'OffSeason');

  console.log('\n=== TRY LOADING CAREER-2011TEST IN MADDEN ===');
}

test().catch(e => console.error(e));
