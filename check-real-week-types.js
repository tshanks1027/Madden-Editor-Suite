/**
 * Check week types in REAL file for comparison
 */
async function check() {
  const mf = await import('madden-franchise');

  const realPath = 'C:/Users/tshan/Documents/Madden NFL 26/Saves/CAREER-REAL';

  console.log('Loading REAL file...');
  const franchise = await mf.create(realPath);
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

  // Total slots calculation
  const nonEmpty = gameTable.records.filter(r => !r.isEmpty);
  console.log('\nTotal non-empty records:', nonEmpty.length);

  // Check OffSeason records
  const offSeason = gameTable.records.filter(r => !r.isEmpty && String(r.SeasonWeekType) === 'OffSeason');
  console.log('OffSeason records:', offSeason.length);

  if (offSeason.length > 0) {
    console.log('\nFirst OffSeason records:');
    for (let i = 0; i < Math.min(3, offSeason.length); i++) {
      const r = offSeason[i];
      console.log(`  Index ${r.index}: Week ${r.SeasonWeek}, Home=${r.HomeTeam?.slice(-8)}, Away=${r.AwayTeam?.slice(-8)}`);
    }
  }
}

check().catch(e => console.error(e));
