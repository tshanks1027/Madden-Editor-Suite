/**
 * Test applying preseason schedule directly and verify data is written correctly
 */
const { create } = require('madden-franchise');
const fs = require('fs');
const path = require('path');

async function testPreseasonFix() {
  // Use a copy of the file to test
  const originalPath = 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/CAREER-1980test-AUTOSAVE';

  console.log('Loading franchise file...');
  const franchise = await create(originalPath);

  // Get the correct Team table
  const teamTable = franchise.getTableByUniqueId(637929298);
  await teamTable.readRecords();

  // Build team mapping
  const teamIndexToRecordIndex = new Map();
  for (const team of teamTable.records) {
    if (team.isEmpty) continue;
    if (team.TeamIndex < 32) {
      teamIndexToRecordIndex.set(team.TeamIndex, team.index);
    }
  }

  // Get team ref prefix from existing game
  let gameTable = franchise.getTableByName('SeasonGame');
  await gameTable.readRecords();

  let teamRefPrefix = '001011100011101000000000';
  for (const record of gameTable.records) {
    if (record.isEmpty) continue;
    if (record.HomeTeam && record.HomeTeam !== '00000000000000000000000000000000') {
      teamRefPrefix = record.HomeTeam.slice(0, 24);
      break;
    }
  }

  console.log('Team ref prefix:', teamRefPrefix);

  // Load 1980 schedule
  const scheduleData = JSON.parse(fs.readFileSync('./data/retro/schedules/1980.json', 'utf-8'));
  const preseasonGames = scheduleData.games.filter(g => g.weekType === 'preseason' && g.week === 1);

  console.log(`\nHistorical Week 1 has ${preseasonGames.length} games`);

  // Get preseason week 0 slots from franchise
  const week0Slots = [];
  for (const record of gameTable.records) {
    if (record.isEmpty) continue;
    const weekType = record.SeasonWeekType;
    if (weekType !== 0 && weekType !== 'PreSeason') continue;
    if (record.SeasonWeek !== 0) continue;
    week0Slots.push(record);
  }

  console.log(`Franchise Week 0 preseason has ${week0Slots.length} slots`);

  // Apply first 3 games and verify
  console.log('\n=== APPLYING FIRST 3 GAMES ===');

  for (let i = 0; i < Math.min(3, preseasonGames.length); i++) {
    const historical = preseasonGames[i];
    const slot = week0Slots[i];

    const homeRecIdx = teamIndexToRecordIndex.get(historical.homeTeamIndex);
    const awayRecIdx = teamIndexToRecordIndex.get(historical.awayTeamIndex);

    const homeRef = teamRefPrefix + homeRecIdx.toString(2).padStart(8, '0');
    const awayRef = teamRefPrefix + awayRecIdx.toString(2).padStart(8, '0');

    console.log(`\nGame ${i + 1}: ${historical.awayTeam} @ ${historical.homeTeam}`);
    console.log(`  Historical: away=${historical.awayTeamIndex}, home=${historical.homeTeamIndex}`);
    console.log(`  Mapping: awayRec=${awayRecIdx}, homeRec=${homeRecIdx}`);
    console.log(`  Expected refs: Home=${homeRef}, Away=${awayRef}`);

    // BEFORE
    console.log(`  BEFORE: HomeTeam=${slot.HomeTeam}, AwayTeam=${slot.AwayTeam}`);

    // Apply
    slot.HomeTeam = homeRef;
    slot.AwayTeam = awayRef;

    // AFTER (read back immediately)
    console.log(`  AFTER:  HomeTeam=${slot.HomeTeam}, AwayTeam=${slot.AwayTeam}`);

    // Verify
    const homeMatch = slot.HomeTeam === homeRef;
    const awayMatch = slot.AwayTeam === awayRef;
    console.log(`  VERIFY: Home=${homeMatch ? 'OK' : 'FAIL'}, Away=${awayMatch ? 'OK' : 'FAIL'}`);

    if (!homeMatch || !awayMatch) {
      console.log('  >>> BUG DETECTED: Field assignment failed!');
    }
  }

  // Save the file
  console.log('\n=== SAVING FILE ===');
  await franchise.save();
  console.log('File saved.');

  // Reload and verify
  console.log('\n=== RELOADING TO VERIFY ===');
  const franchise2 = await create(originalPath);
  let gameTable2 = franchise2.getTableByName('SeasonGame');
  await gameTable2.readRecords();

  const week0Slots2 = [];
  for (const record of gameTable2.records) {
    if (record.isEmpty) continue;
    if ((record.SeasonWeekType === 0 || record.SeasonWeekType === 'PreSeason') && record.SeasonWeek === 0) {
      week0Slots2.push(record);
    }
  }

  console.log('\nAfter reload:');
  for (let i = 0; i < Math.min(3, preseasonGames.length); i++) {
    const historical = preseasonGames[i];
    const slot = week0Slots2[i];

    const homeRecIdx = teamIndexToRecordIndex.get(historical.homeTeamIndex);
    const awayRecIdx = teamIndexToRecordIndex.get(historical.awayTeamIndex);

    const homeRef = teamRefPrefix + homeRecIdx.toString(2).padStart(8, '0');
    const awayRef = teamRefPrefix + awayRecIdx.toString(2).padStart(8, '0');

    const actualHomeRecIdx = parseInt(slot.HomeTeam.slice(-8), 2);
    const actualAwayRecIdx = parseInt(slot.AwayTeam.slice(-8), 2);

    console.log(`Game ${i + 1}: Expected ${historical.awayTeam} @ ${historical.homeTeam}`);
    console.log(`  Expected: awayRec=${awayRecIdx}, homeRec=${homeRecIdx}`);
    console.log(`  Actual:   awayRec=${actualAwayRecIdx}, homeRec=${actualHomeRecIdx}`);

    const homeOk = actualHomeRecIdx === homeRecIdx;
    const awayOk = actualAwayRecIdx === awayRecIdx;
    console.log(`  Status: Home=${homeOk ? 'OK' : 'WRONG'}, Away=${awayOk ? 'OK' : 'WRONG'}`);
  }
}

testPreseasonFix().catch(console.error);
