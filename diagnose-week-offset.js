// Diagnose week offset and team alignment issues

const fs = require('fs');
const path = require('path');

const TABLE_IDS = {
  teamTable: 637929298,
  gameTable: 2816609684,
  seasonInfoTable: 3123991521,
};

async function diagnose() {
  const module = await import('madden-franchise');

  const filePath = 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden NFL 26\\Saves\\CAREER-NOV23-05h38m58p-AUTOSAVE';
  const franchise = await module.create(filePath, {
    schemaDirectory: 'C:\\Users\\tshan\\AppData\\Local\\Programs\\MyFranchise'
  });

  // Check SeasonInfo first
  console.log('=== SeasonInfo Table ===\n');
  const seasonInfoTable = franchise.getTableByUniqueId(TABLE_IDS.seasonInfoTable);
  if (seasonInfoTable) {
    await seasonInfoTable.readRecords();
    const record = seasonInfoTable.records[0];
    if (record) {
      console.log('SeasonInfo fields:');
      const keys = Object.keys(record).filter(k => !k.startsWith('_') && typeof record[k] !== 'function');
      for (const key of keys.slice(0, 30)) {
        console.log(`  ${key}: ${record[key]}`);
      }
    }
  }

  // Get team table
  console.log('\n=== Team Table ===\n');
  const teamTable = franchise.getTableByUniqueId(TABLE_IDS.teamTable);
  await teamTable.readRecords();

  const teamIndexToRecordIndex = new Map();
  const recordIndexToTeam = new Map();

  for (const team of teamTable.records) {
    if (team.isEmpty) continue;
    const teamIndex = team.TeamIndex;
    if (teamIndex !== undefined && teamIndex < 32) {
      teamIndexToRecordIndex.set(teamIndex, team.index);
      recordIndexToTeam.set(team.index, {
        teamIndex,
        shortName: team.ShortName,
        longName: team.LongName,
        displayName: team.DisplayName
      });
    }
  }

  // Check what TeamIndex the Browns have (should be 4)
  console.log('Browns check:');
  for (const [ri, team] of recordIndexToTeam) {
    if (team.shortName === 'CLE' || team.longName?.includes('Cleveland')) {
      console.log(`  Browns: RI=${ri}, TI=${team.teamIndex}, ${team.shortName} - ${team.longName} ${team.displayName}`);
    }
  }

  // Check what TeamIndex the Giants have (should be 15)
  console.log('\nGiants check:');
  for (const [ri, team] of recordIndexToTeam) {
    if (team.shortName === 'NYG' || team.longName?.includes('New York') && team.displayName?.includes('Giants')) {
      console.log(`  Giants: RI=${ri}, TI=${team.teamIndex}, ${team.shortName} - ${team.longName} ${team.displayName}`);
    }
  }

  // Get game table and analyze week structure
  console.log('\n=== SeasonGame Table Analysis ===\n');
  let gameTable = franchise.getTableByUniqueId(TABLE_IDS.gameTable);
  if (!gameTable) {
    gameTable = franchise.getTableByName('SeasonGame');
  }
  await gameTable.readRecords();

  // Analyze week types and week numbers
  const weekTypeStats = new Map();
  const weekNumStats = new Map();

  for (const record of gameTable.records) {
    if (record.isEmpty) continue;

    const weekType = record.SeasonWeekType;
    const weekNum = record.SeasonWeek;

    const typeKey = `${weekType}`;
    weekTypeStats.set(typeKey, (weekTypeStats.get(typeKey) || 0) + 1);

    const numKey = `Week ${weekNum} (Type ${weekType})`;
    weekNumStats.set(numKey, (weekNumStats.get(numKey) || 0) + 1);
  }

  console.log('Week Type distribution:');
  for (const [type, count] of weekTypeStats) {
    console.log(`  Type ${type}: ${count} games`);
  }

  console.log('\nWeek Number distribution (first 25):');
  const sortedWeeks = [...weekNumStats.entries()].sort((a, b) => {
    const aNum = parseInt(a[0].match(/Week (\d+)/)?.[1] || '0');
    const bNum = parseInt(b[0].match(/Week (\d+)/)?.[1] || '0');
    return aNum - bNum;
  });
  for (const [week, count] of sortedWeeks.slice(0, 25)) {
    console.log(`  ${week}: ${count} games`);
  }

  // Show first game record details
  console.log('\n=== First Non-Empty Game Record ===\n');
  const firstGame = gameTable.records.find(r => !r.isEmpty);
  if (firstGame) {
    const keys = Object.keys(firstGame).filter(k => !k.startsWith('_') && typeof firstGame[k] !== 'function');
    for (const key of keys) {
      console.log(`  ${key}: ${firstGame[key]}`);
    }
  }

  // Show preseason games (type 0)
  console.log('\n=== PreSeason Games (Type 0) ===\n');
  let preseasonCount = 0;
  for (const record of gameTable.records) {
    if (record.isEmpty) continue;
    if (record.SeasonWeekType === 0 || record.SeasonWeekType === 'PreSeason') {
      preseasonCount++;
      if (preseasonCount <= 5) {
        const homeRI = record.HomeTeam ? parseInt(record.HomeTeam.slice(-8), 2) : -1;
        const awayRI = record.AwayTeam ? parseInt(record.AwayTeam.slice(-8), 2) : -1;
        const homeTeam = recordIndexToTeam.get(homeRI);
        const awayTeam = recordIndexToTeam.get(awayRI);
        console.log(`  PreSeason Week ${record.SeasonWeek}: ${awayTeam?.shortName || '?'} @ ${homeTeam?.shortName || '?'}`);
      }
    }
  }
  console.log(`  Total preseason games: ${preseasonCount}`);

  // Show Week 0 games specifically
  console.log('\n=== Week 0 Games ===\n');
  let week0Count = 0;
  for (const record of gameTable.records) {
    if (record.isEmpty) continue;
    if (record.SeasonWeek === 0) {
      week0Count++;
      if (week0Count <= 5) {
        const homeRI = record.HomeTeam ? parseInt(record.HomeTeam.slice(-8), 2) : -1;
        const awayRI = record.AwayTeam ? parseInt(record.AwayTeam.slice(-8), 2) : -1;
        const homeTeam = recordIndexToTeam.get(homeRI);
        const awayTeam = recordIndexToTeam.get(awayRI);
        console.log(`  Week 0 Type ${record.SeasonWeekType}: ${awayTeam?.shortName || '?'} @ ${homeTeam?.shortName || '?'}`);
      }
    }
  }
  console.log(`  Total Week 0 games: ${week0Count}`);

  // Show Week 1 RegularSeason games
  console.log('\n=== Week 1 Regular Season Games ===\n');
  let week1Count = 0;
  for (const record of gameTable.records) {
    if (record.isEmpty) continue;
    if (record.SeasonWeek === 1 && (record.SeasonWeekType === 1 || record.SeasonWeekType === 'RegularSeason')) {
      week1Count++;
      const homeRI = record.HomeTeam ? parseInt(record.HomeTeam.slice(-8), 2) : -1;
      const awayRI = record.AwayTeam ? parseInt(record.AwayTeam.slice(-8), 2) : -1;
      const homeTeam = recordIndexToTeam.get(homeRI);
      const awayTeam = recordIndexToTeam.get(awayRI);
      console.log(`  ${week1Count}. ${awayTeam?.shortName || '?'} @ ${homeTeam?.shortName || '?'}`);
    }
  }
  console.log(`  Total Week 1 regular season games: ${week1Count}`);

  // Check the 1980 schedule
  console.log('\n=== 1980 Schedule Week 1 Expected ===\n');
  const schedulePath = path.join(__dirname, 'data', 'retro', 'schedules', '1980.json');
  if (fs.existsSync(schedulePath)) {
    const schedule = JSON.parse(fs.readFileSync(schedulePath, 'utf-8'));
    const week1Games = schedule.games.filter(g => g.week === 1 && g.weekType === 'regular');
    console.log(`1980 has ${week1Games.length} Week 1 games:`);
    week1Games.slice(0, 8).forEach((game, i) => {
      console.log(`  ${i+1}. ${game.awayTeam} @ ${game.homeTeam}`);
    });
  }
}

diagnose().catch(console.error);
