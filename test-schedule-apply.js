async function test() {
  const mf = await import('madden-franchise');
  const fs = require('fs');

  const src = 'C:/Users/tshan/Documents/Madden NFL 26/Saves/CAREER-PRESEASONWK1';
  const dst = 'C:/Users/tshan/Documents/Madden NFL 26/Saves/CAREER-SCHEDULE-TEST';
  fs.copyFileSync(src, dst);
  console.log('Fresh copy created');

  const franchise = await mf.create(dst);
  const teamTable = franchise.getTableByUniqueId(637929298);
  await teamTable.readRecords();

  const t2r = new Map();
  for (const t of teamTable.records) {
    if (!t.isEmpty && t.TeamIndex !== undefined && t.TeamIndex < 32) {
      t2r.set(t.TeamIndex, t.index);
    }
  }

  const gameTable = franchise.getTableByName('SeasonGame');
  await gameTable.readRecords();

  let prefix = '001011100011101000000000';
  for (const r of gameTable.records) {
    if (!r.isEmpty && r.HomeTeam && r.HomeTeam.length === 32 && r.HomeTeam !== '00000000000000000000000000000000') {
      prefix = r.HomeTeam.slice(0, 24);
      break;
    }
  }
  console.log('Prefix:', prefix);

  const schedule = JSON.parse(fs.readFileSync('data/retro/schedules/1994.json', 'utf8'));
  const pre = schedule.games.filter(g => g.weekType === 'preseason');
  console.log('Games to apply:', pre.length);

  // Get ALL preseason slots
  const slots = gameTable.records.filter(r => !r.isEmpty && (r.SeasonWeekType === 'PreSeason' || r.SeasonWeekType === 0));
  console.log('Preseason slots:', slots.length);

  // NULL reference for Invalid_ slots
  const nullRef = '00000000000000000000000000000000';

  // Apply 42 games, mark remaining 7 as Invalid_
  let applied = 0;
  for (let i = 0; i < slots.length; i++) {
    const s = slots[i];
    
    if (i < pre.length) {
      // Apply real game
      const g = pre[i];
      const hr = t2r.get(g.homeTeamIndex);
      const ar = t2r.get(g.awayTeamIndex);
      
      if (hr !== undefined && ar !== undefined) {
        s.HomeTeam = prefix + hr.toString(2).padStart(8, '0');
        s.AwayTeam = prefix + ar.toString(2).padStart(8, '0');
        s.SeasonWeek = (g.week || 1) - 1;
        s.SeasonWeekType = 'PreSeason';
        s.GameStatus = 'Unplayed';
        applied++;
      }
    } else {
      // Mark as Invalid_ with null teams (like the fresh file does)
      s.HomeTeam = nullRef;
      s.AwayTeam = nullRef;
      s.SeasonWeekType = 'PreSeason';
      s.GameStatus = 'Invalid_';
      s.SeasonWeek = 0;
    }
  }
  console.log('Applied', applied, 'games');
  console.log('Marked', slots.length - applied, 'as Invalid_');

  await franchise.save();
  console.log('Saved!');

  // Verify
  const v = await mf.create(dst);
  const vg = v.getTableByName('SeasonGame');
  await vg.readRecords();
  const vt = v.getTableByUniqueId(637929298);
  await vt.readRecords();
  
  const r2t = new Map();
  for (const t of vt.records) {
    if (!t.isEmpty && t.TeamIndex !== undefined && t.TeamIndex < 32) {
      r2t.set(t.index, t.TeamIndex);
    }
  }

  const tc = {};
  let validGames = 0, invalidGames = 0;
  for (const r of vg.records) {
    if (r.isEmpty) continue;
    if (r.SeasonWeekType !== 'PreSeason' && r.SeasonWeekType !== 0) continue;
    
    if (r.GameStatus === 'Invalid_') {
      invalidGames++;
      continue;
    }
    
    validGames++;
    if (r.HomeTeam && r.HomeTeam !== nullRef) {
      const ti = r2t.get(parseInt(r.HomeTeam.slice(24), 2));
      if (ti !== undefined) tc[ti] = (tc[ti] || 0) + 1;
    }
    if (r.AwayTeam && r.AwayTeam !== nullRef) {
      const ti = r2t.get(parseInt(r.AwayTeam.slice(24), 2));
      if (ti !== undefined) tc[ti] = (tc[ti] || 0) + 1;
    }
  }
  
  console.log('');
  console.log('Valid preseason games:', validGames);
  console.log('Invalid_ slots:', invalidGames);
  console.log('');
  
  const counts = [...new Set(Object.values(tc))];
  console.log('Unique team game counts:', counts);
  
  // Check all 28 active 1994 teams have 3 games
  const active1994 = [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,17,18,19,21,22,23,25,26,27,28,29,30];
  let allHave3 = true;
  for (const ti of active1994) {
    if (tc[ti] !== 3) {
      console.log('Team', ti, 'has', tc[ti] || 0, 'games (expected 3)');
      allHave3 = false;
    }
  }
  
  if (allHave3) {
    console.log('SUCCESS: All 28 active 1994 teams have exactly 3 games!');
  }
}
test().catch(e => console.error(e));
