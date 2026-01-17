// Test applying 1984 schedule and team names

const fs = require('fs');
const path = require('path');

const TABLE_IDS = {
  teamTable: 637929298,
  gameTable: 2816609684,
};

async function test1984() {
  const module = await import('madden-franchise');

  // Create a fresh copy of the franchise file
  const originalPath = 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden NFL 26\\Saves\\CAREER-NOV23-05h38m58p-AUTOSAVE';
  const testPath = originalPath + '-1984-TEST';

  // Copy original file
  fs.copyFileSync(originalPath, testPath);

  const franchise = await module.create(testPath, {
    schemaDirectory: 'C:\\Users\\tshan\\AppData\\Local\\Programs\\MyFranchise'
  });

  console.log('=== Loading Team Table ===\n');

  // Get team table
  const teamTable = franchise.getTableByUniqueId(TABLE_IDS.teamTable);
  await teamTable.readRecords();

  // Load historical teams data
  const historicalTeamsPath = path.join(__dirname, 'data', 'retro', 'historical-teams.json');
  const historicalData = JSON.parse(fs.readFileSync(historicalTeamsPath, 'utf-8'));

  // Helper: get team info for a year
  function getTeamInfoForYear(team, year) {
    for (const change of team.changes || []) {
      if (year >= change.yearRange[0] && year <= change.yearRange[1]) {
        return change;
      }
    }
    return null;
  }

  // Build TeamIndex -> RecordIndex mapping
  const teamIndexToRecordIndex = new Map();
  const recordIndexToTeam = new Map();

  console.log('Team changes for 1984:\n');
  console.log('TeamIndex | Current Name | 1984 Name | 1984 City | 1984 Abbr');
  console.log('----------|--------------|-----------|-----------|----------');

  for (const team of teamTable.records) {
    if (team.isEmpty) continue;
    const teamIndex = team.TeamIndex;
    if (teamIndex === undefined || teamIndex >= 32) continue;

    teamIndexToRecordIndex.set(teamIndex, team.index);
    recordIndexToTeam.set(team.index, {
      teamIndex,
      shortName: team.ShortName,
      longName: team.LongName
    });

    // Find historical team data
    const histTeam = historicalData.teams.find(t => t.teamIndex === teamIndex);
    if (histTeam) {
      const info1984 = getTeamInfoForYear(histTeam, 1984);
      if (info1984) {
        const needsChange = info1984.city !== histTeam.currentCity || info1984.name !== histTeam.currentName;
        console.log(
          `${teamIndex.toString().padStart(9)} | ${histTeam.currentName.padEnd(12)} | ${(info1984.name || 'N/A').padEnd(9)} | ${(info1984.city || 'N/A').padEnd(9)} | ${info1984.abbreviation || 'N/A'}${needsChange ? ' *CHANGE*' : ''}`
        );
      }
    }
  }

  // Load 1984 schedule
  const schedulePath = path.join(__dirname, 'data', 'retro', 'schedules', '1984.json');
  const schedule = JSON.parse(fs.readFileSync(schedulePath, 'utf-8'));

  console.log(`\n=== 1984 Schedule Week 1 (first 8 games) ===\n`);
  const week1Games = schedule.games.filter(g => g.week === 1).slice(0, 8);

  week1Games.forEach((game, i) => {
    const homeRI = teamIndexToRecordIndex.get(game.homeTeamIndex);
    const awayRI = teamIndexToRecordIndex.get(game.awayTeamIndex);
    const homeTeam = recordIndexToTeam.get(homeRI);
    const awayTeam = recordIndexToTeam.get(awayRI);

    console.log(`Game ${i+1}: ${game.awayTeam} @ ${game.homeTeam}`);
    console.log(`  Home: TI=${game.homeTeamIndex} -> RI=${homeRI} (current: ${homeTeam?.shortName})`);
    console.log(`  Away: TI=${game.awayTeamIndex} -> RI=${awayRI} (current: ${awayTeam?.shortName})`);
  });

  // Now apply team name changes for 1984
  console.log('\n=== Applying Team Name Changes for 1984 ===\n');

  for (const team of teamTable.records) {
    if (team.isEmpty) continue;
    const teamIndex = team.TeamIndex;
    if (teamIndex === undefined || teamIndex >= 32) continue;

    const histTeam = historicalData.teams.find(t => t.teamIndex === teamIndex);
    if (!histTeam) continue;

    const info1984 = getTeamInfoForYear(histTeam, 1984);
    if (!info1984 || info1984.inactive) continue;

    // Check if we need to change
    if (info1984.city !== histTeam.currentCity || info1984.name !== histTeam.currentName) {
      console.log(`TeamIndex ${teamIndex}: ${team.LongName} ${team.DisplayName} -> ${info1984.city} ${info1984.name}`);

      // Apply changes
      if (info1984.city) team.LongName = info1984.city;
      if (info1984.name) team.DisplayName = info1984.name;
      if (info1984.abbreviation) team.ShortName = info1984.abbreviation;
      if (info1984.name) team.NickName = info1984.name;
    }
  }

  // Apply schedule
  console.log('\n=== Applying 1984 Schedule ===\n');

  let gameTable = franchise.getTableByUniqueId(TABLE_IDS.gameTable);
  if (!gameTable) {
    gameTable = franchise.getTableByName('SeasonGame');
  }
  await gameTable.readRecords();

  // Find team reference prefix
  let teamRefPrefix = '001011100011101000000000';
  for (const record of gameTable.records) {
    if (record.isEmpty) continue;
    const homeTeam = record.HomeTeam;
    if (homeTeam && homeTeam !== '00000000000000000000000000000000' && homeTeam.length === 32) {
      teamRefPrefix = homeTeam.slice(0, 24);
      break;
    }
  }

  const createTeamRef = (teamIndex) => {
    const recordIndex = teamIndexToRecordIndex.get(teamIndex);
    if (recordIndex === undefined) return '00000000000000000000000000000000';
    return teamRefPrefix + recordIndex.toString(2).padStart(8, '0');
  };

  // Group franchise games by week
  const franchiseGamesByWeek = new Map();
  for (const record of gameTable.records) {
    if (record.isEmpty) continue;
    const weekNum = record.SeasonWeek;
    const weekType = record.SeasonWeekType;
    if (weekType !== 1 && weekType !== 'RegularSeason') continue;
    if (!franchiseGamesByWeek.has(weekNum)) {
      franchiseGamesByWeek.set(weekNum, []);
    }
    franchiseGamesByWeek.get(weekNum).push(record);
  }

  // Group schedule games by week
  const gamesByWeek = new Map();
  for (const game of schedule.games) {
    if (game.weekType !== 'regular') continue;
    if (!gamesByWeek.has(game.week)) {
      gamesByWeek.set(game.week, []);
    }
    gamesByWeek.get(game.week).push(game);
  }

  let gamesUpdated = 0;
  for (const [weekNum, franchiseGames] of franchiseGamesByWeek) {
    const historicalGames = gamesByWeek.get(weekNum);
    if (!historicalGames) continue;

    const count = Math.min(franchiseGames.length, historicalGames.length);
    for (let i = 0; i < count; i++) {
      const franchiseRecord = franchiseGames[i];
      const historicalGame = historicalGames[i];

      franchiseRecord.HomeTeam = createTeamRef(historicalGame.homeTeamIndex);
      franchiseRecord.AwayTeam = createTeamRef(historicalGame.awayTeamIndex);
      gamesUpdated++;
    }
  }

  console.log(`Updated ${gamesUpdated} games`);

  // Save
  console.log(`\nSaving to ${testPath}...`);
  await franchise.save(testPath);
  console.log('Saved!');

  // Reload and verify
  console.log('\n=== Verifying Week 1 after save ===\n');

  const verifyFranchise = await module.create(testPath, {
    schemaDirectory: 'C:\\Users\\tshan\\AppData\\Local\\Programs\\MyFranchise'
  });

  const verifyTeamTable = verifyFranchise.getTableByUniqueId(TABLE_IDS.teamTable);
  await verifyTeamTable.readRecords();

  // Rebuild mappings with updated names
  const verifyRecordToTeam = new Map();
  for (const team of verifyTeamTable.records) {
    if (team.isEmpty) continue;
    if (team.TeamIndex !== undefined && team.TeamIndex < 32) {
      verifyRecordToTeam.set(team.index, {
        shortName: team.ShortName,
        displayName: team.DisplayName,
        longName: team.LongName
      });
    }
  }

  let verifyGameTable = verifyFranchise.getTableByUniqueId(TABLE_IDS.gameTable);
  if (!verifyGameTable) {
    verifyGameTable = verifyFranchise.getTableByName('SeasonGame');
  }
  await verifyGameTable.readRecords();

  let gameNum = 0;
  console.log('Week 1 games (should show 1984 teams and matchups):');
  console.log('Expected | Actual');
  console.log('---------|--------');

  for (const record of verifyGameTable.records) {
    if (record.isEmpty) continue;
    if (record.SeasonWeek !== 1) continue;
    if (record.SeasonWeekType !== 1 && record.SeasonWeekType !== 'RegularSeason') continue;

    gameNum++;
    const homeRI = parseInt(record.HomeTeam.slice(-8), 2);
    const awayRI = parseInt(record.AwayTeam.slice(-8), 2);
    const homeInfo = verifyRecordToTeam.get(homeRI);
    const awayInfo = verifyRecordToTeam.get(awayRI);

    const expected = week1Games[gameNum - 1];
    if (expected) {
      console.log(
        `${expected.awayTeam.substring(0, 15).padEnd(15)} @ ${expected.homeTeam.substring(0, 15).padEnd(15)} | ${awayInfo?.shortName || '?'} @ ${homeInfo?.shortName || '?'}`
      );
    } else {
      console.log(
        `${''.padEnd(34)} | ${awayInfo?.shortName || '?'} @ ${homeInfo?.shortName || '?'}`
      );
    }

    if (gameNum >= 8) break;
  }

  console.log('\n=== Check specific teams after update ===\n');
  console.log('Team check (should show 1984 names):');
  for (const team of verifyTeamTable.records) {
    if (team.isEmpty) continue;
    const ti = team.TeamIndex;
    if (ti === 25 || ti === 29 || ti === 7 || ti === 23 || ti === 22) { // WAS, TEN/HOU, LAC/SD, LAR/LA, LV/LA
      console.log(`TI ${ti}: ${team.ShortName} - ${team.LongName} ${team.DisplayName}`);
    }
  }
}

test1984().catch(console.error);
