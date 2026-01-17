// Test actual schedule modification like the retro editor does
const fs = require('fs');
const path = require('path');

const originalPath = 'C:/Users/tshan/Documents/Madden NFL 26/saves/CAREER-REAL';
const testPath = originalPath.replace('CAREER-REAL', 'RETRO-TEST-SCHEDULE-MOD');

const TABLE_IDS = {
  teamTable: 637929298,
  gameTable: 2816609684,
  seasonInfoTable: 3123991521,
};

async function test() {
  // Copy fresh file
  fs.copyFileSync(originalPath, testPath);
  console.log('Created test file:', testPath);

  const FranchiseModule = await import('madden-franchise');
  const franchise = await FranchiseModule.create(testPath);

  // Get team table for reference format
  const teamTable = franchise.getTableByUniqueId(TABLE_IDS.teamTable) ||
                    franchise.getTableByName('Team');
  await teamTable.readRecords();

  // Build TeamIndex -> RecordIndex mapping
  const teamIndexToRecordIndex = new Map();
  for (const team of teamTable.records) {
    if (team.isEmpty) continue;
    const teamIndex = team.TeamIndex;
    if (teamIndex !== undefined && teamIndex < 32) {
      teamIndexToRecordIndex.set(teamIndex, team.index);
    }
  }
  console.log('Built team mapping for', teamIndexToRecordIndex.size, 'teams');

  // Get game table
  const gameTable = franchise.getTableByName('SeasonGame') ||
                    franchise.getTableByUniqueId(TABLE_IDS.gameTable);
  await gameTable.readRecords();
  console.log('Loaded', gameTable.records.length, 'game records');

  // Find reference prefix from existing game
  let teamRefPrefix = '001011100011101000000000'; // Default
  for (const rec of gameTable.records) {
    if (rec.isEmpty) continue;
    const homeTeam = rec.HomeTeam;
    if (homeTeam && homeTeam !== '00000000000000000000000000000000' && homeTeam.length === 32) {
      teamRefPrefix = homeTeam.slice(0, 24);
      console.log('Found team ref prefix:', teamRefPrefix);
      break;
    }
  }

  // Helper to create team reference
  const createTeamRef = (teamIndex) => {
    const recordIndex = teamIndexToRecordIndex.get(teamIndex);
    if (recordIndex === undefined) {
      console.warn('No record index for TeamIndex', teamIndex);
      return '00000000000000000000000000000000';
    }
    return teamRefPrefix + recordIndex.toString(2).padStart(8, '0');
  };

  // Count games by week type BEFORE
  console.log('\n=== BEFORE MODIFICATION ===');
  const weekTypeCounts = {};
  let regularSeasonGames = [];
  for (const rec of gameTable.records) {
    if (rec.isEmpty) continue;
    const weekType = rec.SeasonWeekType || rec.Field_53;
    const typeKey = String(weekType);
    weekTypeCounts[typeKey] = (weekTypeCounts[typeKey] || 0) + 1;

    if (weekType === 1 || weekType === 'RegularSeason') {
      regularSeasonGames.push(rec);
    }
  }
  console.log('Games by week type:', weekTypeCounts);
  console.log('Regular season games:', regularSeasonGames.length);

  // Test 1: Modify HomeTeam/AwayTeam references
  console.log('\n=== TEST 1: Modify Team References ===');
  const testGame = regularSeasonGames[0];
  if (testGame) {
    const oldHome = testGame.HomeTeam;
    const oldAway = testGame.AwayTeam;
    console.log('Original HomeTeam:', oldHome);
    console.log('Original AwayTeam:', oldAway);

    // Try swapping home and away
    const cowboys = 10; // Dallas Cowboys
    const giants = 21;  // NY Giants
    const newHomeRef = createTeamRef(cowboys);
    const newAwayRef = createTeamRef(giants);

    console.log('Setting HomeTeam to Cowboys (10):', newHomeRef);
    console.log('Setting AwayTeam to Giants (21):', newAwayRef);

    testGame.HomeTeam = newHomeRef;
    testGame.AwayTeam = newAwayRef;

    console.log('After set - HomeTeam:', testGame.HomeTeam);
    console.log('After set - AwayTeam:', testGame.AwayTeam);
  }

  // Test 2: Set a game to OffSeason (like retro editor does for extra weeks)
  console.log('\n=== TEST 2: Mark Game as OffSeason ===');
  const lastGame = regularSeasonGames[regularSeasonGames.length - 1];
  if (lastGame) {
    const oldWeekType = lastGame.SeasonWeekType || lastGame.Field_53;
    console.log('Original SeasonWeekType:', oldWeekType);

    // Try setting to OffSeason (8 numeric, or 'OffSeason' string)
    try {
      // The retro editor uses string value
      lastGame.SeasonWeekType = 'OffSeason';
      console.log('After set (string) - SeasonWeekType:', lastGame.SeasonWeekType);
    } catch (e) {
      console.log('String set failed:', e.message);
      // Try numeric
      try {
        lastGame.SeasonWeekType = 8;
        console.log('After set (numeric) - SeasonWeekType:', lastGame.SeasonWeekType);
      } catch (e2) {
        console.log('Numeric set also failed:', e2.message);
      }
    }

    // Also set null team refs like retro editor does
    lastGame.HomeTeam = '00000000000000000000000000000000';
    lastGame.AwayTeam = '00000000000000000000000000000000';
    console.log('Set HomeTeam/AwayTeam to zero refs');
  }

  // Save
  console.log('\n=== SAVING ===');
  await franchise.save(testPath);
  console.log('Saved');

  // Reload and verify
  console.log('\n=== AFTER RELOAD ===');
  const franchise2 = await FranchiseModule.create(testPath);
  const gameTable2 = franchise2.getTableByName('SeasonGame') ||
                     franchise2.getTableByUniqueId(TABLE_IDS.gameTable);
  await gameTable2.readRecords();

  // Check the modified games
  const modifiedGame = gameTable2.records[testGame.index];
  console.log('First modified game:');
  console.log('  HomeTeam:', modifiedGame.HomeTeam);
  console.log('  AwayTeam:', modifiedGame.AwayTeam);

  const offseasonGame = gameTable2.records[lastGame.index];
  console.log('OffSeason marked game:');
  console.log('  SeasonWeekType:', offseasonGame.SeasonWeekType || offseasonGame.Field_53);
  console.log('  HomeTeam:', offseasonGame.HomeTeam);
  console.log('  AwayTeam:', offseasonGame.AwayTeam);

  // Count by week type after
  const weekTypeCountsAfter = {};
  for (const rec of gameTable2.records) {
    if (rec.isEmpty) continue;
    const weekType = rec.SeasonWeekType || rec.Field_53;
    const typeKey = String(weekType);
    weekTypeCountsAfter[typeKey] = (weekTypeCountsAfter[typeKey] || 0) + 1;
  }
  console.log('\nGames by week type after:', weekTypeCountsAfter);

  console.log('\n✅ Test complete');
  console.log('Test file:', testPath);
  console.log('>>> Load this file in Madden and sim to test for crashes');
}

test().catch(console.error);
