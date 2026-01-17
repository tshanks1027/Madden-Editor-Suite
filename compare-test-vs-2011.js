/**
 * Compare crashed test file with working 2011 mod
 * Find EXACTLY what's different
 */
async function compare() {
  const mf = await import('madden-franchise');

  // Only compare if test file exists
  const fs = require('fs');
  const testPath = 'C:/Users/tshan/Documents/Madden NFL 26/Saves/CAREER-SCHEDULE-TEST2';
  const modPath = 'C:/Users/tshan/Downloads/2011 Throwback V0.9/2011 Throwback V0.9/CAREER-2011THROWBACKV09';

  if (!fs.existsSync(testPath)) {
    console.log('Test file not found, comparing REAL vs 2011 MOD');
    return;
  }

  console.log('Loading 2011 MOD (working)...');
  const mod = await mf.create(modPath);
  const modGame = mod.getTableByName('SeasonGame');
  await modGame.readRecords();

  console.log('Loading TEST (crashed)...');
  const test = await mf.create(testPath);
  const testGame = test.getTableByName('SeasonGame');
  await testGame.readRecords();

  // Get team tables
  const modTeam = mod.getTableByUniqueId(637929298);
  await modTeam.readRecords();
  const testTeam = test.getTableByUniqueId(637929298);
  await testTeam.readRecords();

  // Build team index maps
  const modT2R = new Map();
  const modR2T = new Map();
  for (const t of modTeam.records) {
    if (!t.isEmpty && t.TeamIndex !== undefined && t.TeamIndex < 32) {
      modT2R.set(t.TeamIndex, t.index);
      modR2T.set(t.index, t.TeamIndex);
    }
  }

  const testT2R = new Map();
  const testR2T = new Map();
  for (const t of testTeam.records) {
    if (!t.isEmpty && t.TeamIndex !== undefined && t.TeamIndex < 32) {
      testT2R.set(t.TeamIndex, t.index);
      testR2T.set(t.index, t.TeamIndex);
    }
  }

  console.log('\n=== TEAM INDEX MAPPING ===');
  console.log('MOD TeamIndex 0 -> RecordIndex:', modT2R.get(0));
  console.log('TEST TeamIndex 0 -> RecordIndex:', testT2R.get(0));

  // Get preseason records
  const modPre = modGame.records.filter(r => !r.isEmpty && String(r.SeasonWeekType) === 'PreSeason').sort((a, b) => a.index - b.index);
  const testPre = testGame.records.filter(r => !r.isEmpty && String(r.SeasonWeekType) === 'PreSeason').sort((a, b) => a.index - b.index);

  console.log('\n=== PRESEASON COMPARISON ===');
  console.log('MOD preseason records:', modPre.length);
  console.log('TEST preseason records:', testPre.length);

  // Show first valid game from each
  const modFirstValid = modPre.find(g => String(g.GameStatus) !== 'Invalid_');
  const testFirstValid = testPre.find(g => String(g.GameStatus) !== 'Invalid_');

  console.log('\n=== FIRST VALID GAME ===');
  if (modFirstValid) {
    console.log('MOD (index', modFirstValid.index, '):');
    console.log('  HomeTeam:', modFirstValid.HomeTeam);
    console.log('  AwayTeam:', modFirstValid.AwayTeam);
    console.log('  Prefix:', modFirstValid.HomeTeam.slice(0, 24));
  }
  if (testFirstValid) {
    console.log('TEST (index', testFirstValid.index, '):');
    console.log('  HomeTeam:', testFirstValid.HomeTeam);
    console.log('  AwayTeam:', testFirstValid.AwayTeam);
    console.log('  Prefix:', testFirstValid.HomeTeam.slice(0, 24));
  }

  // Check all fields on the Invalid_ record
  console.log('\n=== INVALID_ RECORD FIELDS ===');
  const modInvalid = modPre.find(g => String(g.GameStatus) === 'Invalid_');
  const testInvalid = testPre.find(g => String(g.GameStatus) === 'Invalid_');

  // Get all field names from the table
  const knownFields = [
    'HomeTeam', 'AwayTeam', 'SeasonWeek', 'SeasonWeekType', 'GameStatus',
    'HomeScore', 'AwayScore', 'DayOfWeek', 'TimeOfDay', 'Stadium',
    'IsPracticeMode', 'SeasonYear', 'IsNeutralSite', 'InjuryStatus',
    'WeatherType', 'Temperature', 'WindSpeed'
  ];

  if (modInvalid && testInvalid) {
    console.log('\nField comparison for Invalid_ records:');
    for (const field of knownFields) {
      try {
        const modVal = modInvalid[field];
        const testVal = testInvalid[field];
        const match = String(modVal) === String(testVal);
        if (!match) {
          console.log(`  ${field}: MOD="${modVal}" TEST="${testVal}" DIFFERENT!`);
        }
      } catch (e) {}
    }
  }

  // Check how many Invalid_ records exist
  const modInvalidCount = modPre.filter(g => String(g.GameStatus) === 'Invalid_').length;
  const testInvalidCount = testPre.filter(g => String(g.GameStatus) === 'Invalid_').length;
  console.log('\nInvalid_ counts: MOD=', modInvalidCount, 'TEST=', testInvalidCount);

  // Check team game counts in TEST
  console.log('\n=== TEAM GAME COUNTS (TEST) ===');
  const nullRef = '00000000000000000000000000000000';
  const tc = {};
  for (const g of testPre) {
    if (String(g.GameStatus) === 'Invalid_') continue;
    if (g.HomeTeam && g.HomeTeam !== nullRef) {
      const ri = parseInt(g.HomeTeam.slice(24), 2);
      const ti = testR2T.get(ri);
      if (ti !== undefined) tc[ti] = (tc[ti] || 0) + 1;
    }
    if (g.AwayTeam && g.AwayTeam !== nullRef) {
      const ri = parseInt(g.AwayTeam.slice(24), 2);
      const ti = testR2T.get(ri);
      if (ti !== undefined) tc[ti] = (tc[ti] || 0) + 1;
    }
  }

  const counts = Object.entries(tc).sort((a, b) => Number(a[0]) - Number(b[0]));
  console.log('Teams with games:', counts.length);
  for (const [ti, count] of counts) {
    if (count !== 3) {
      console.log(`  Team ${ti}: ${count} games (expected 3)`);
    }
  }

  // Check if any teams have 0 games that should have games
  const expectedTeams = [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,17,18,19,21,22,23,25,26,27,28,29,30]; // 28 teams for 1994
  for (const ti of expectedTeams) {
    if (!tc[ti]) {
      console.log(`  Team ${ti}: 0 games!`);
    }
  }
}

compare().catch(e => console.error(e));
