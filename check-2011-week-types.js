/**
 * Check what week types the 2011 mod uses for all SeasonGame records
 */
async function check() {
  const mf = await import('madden-franchise');

  const modPath = 'C:/Users/tshan/Downloads/2011 Throwback V0.9/2011 Throwback V0.9/CAREER-2011THROWBACKV09';

  console.log('Loading 2011 MOD...');
  const franchise = await mf.create(modPath);
  const gameTable = franchise.getTableByName('SeasonGame');
  await gameTable.readRecords();

  console.log('Total records:', gameTable.records.length);

  // Group by SeasonWeekType
  const byType = {};
  for (const r of gameTable.records) {
    if (r.isEmpty) continue;
    const type = String(r.SeasonWeekType);
    if (!byType[type]) byType[type] = { count: 0, indices: [], weeks: new Set() };
    byType[type].count++;
    if (byType[type].indices.length < 5) byType[type].indices.push(r.index);
    byType[type].weeks.add(r.SeasonWeek);
  }

  console.log('\n=== GAME RECORDS BY WEEK TYPE ===\n');
  for (const [type, data] of Object.entries(byType)) {
    const weeks = [...data.weeks].sort((a, b) => a - b);
    console.log(`${type}: ${data.count} records`);
    console.log(`  Weeks: ${weeks.join(', ')}`);
    console.log(`  First indices: ${data.indices.join(', ')}`);
  }

  // Check for OffSeason specifically
  const offSeason = gameTable.records.filter(r => !r.isEmpty && String(r.SeasonWeekType) === 'OffSeason');
  console.log('\n=== OFFSEASON RECORDS DETAIL ===');
  console.log('Count:', offSeason.length);

  if (offSeason.length > 0) {
    console.log('\nFirst 5 OffSeason records:');
    for (let i = 0; i < Math.min(5, offSeason.length); i++) {
      const r = offSeason[i];
      console.log(`  Index ${r.index}: Week ${r.SeasonWeek}, Status ${String(r.GameStatus)}, Home=${r.HomeTeam?.slice(-8)}, Away=${r.AwayTeam?.slice(-8)}`);
    }
  }

  // Check regular season games per week
  const regularSeason = gameTable.records.filter(r => !r.isEmpty && String(r.SeasonWeekType) === 'RegularSeason');
  console.log('\n=== REGULAR SEASON WEEK BREAKDOWN ===');

  const byWeek = {};
  for (const r of regularSeason) {
    byWeek[r.SeasonWeek] = (byWeek[r.SeasonWeek] || 0) + 1;
  }

  for (const week of Object.keys(byWeek).sort((a, b) => Number(a) - Number(b))) {
    console.log(`  Week ${week}: ${byWeek[week]} games`);
  }

  // Check what's in week 17+ (if any regular season exists there)
  const week17Plus = regularSeason.filter(r => r.SeasonWeek >= 17);
  console.log('\nRegular season games in week 17+:', week17Plus.length);
}

check().catch(e => console.error(e));
