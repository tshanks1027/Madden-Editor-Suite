// Full dump of franchise file teams and Week 1 games

const TABLE_IDS = {
  teamTable: 637929298
};

async function fullDump() {
  const module = await import('madden-franchise');
  const franchise = await module.create('C:\\Users\\tshan\\OneDrive\\Documents\\Madden NFL 26\\Saves\\CAREER-NOV23-05h38m58p-AUTOSAVE', {
    schemaDirectory: 'C:\\Users\\tshan\\AppData\\Local\\Programs\\MyFranchise'
  });

  // Get Team table using UniqueId (the correct way)
  const teamTable = franchise.getTableByUniqueId(TABLE_IDS.teamTable);
  await teamTable.readRecords();

  console.log('=== Team Table (via UniqueId) ===\n');
  console.log('RI  | TI | ShortName | LongName');
  console.log('----|----|-----------|---------');

  const recordIndexToTeam = new Map();
  const teamIndexToRecordIndex = new Map();

  for (const team of teamTable.records) {
    if (team.isEmpty) continue;
    const ti = team.TeamIndex;
    if (ti !== undefined && ti < 32) {
      recordIndexToTeam.set(team.index, {
        teamIndex: ti,
        shortName: team.ShortName,
        longName: team.LongName,
        displayName: team.DisplayName
      });
      teamIndexToRecordIndex.set(ti, team.index);
      console.log(`${team.index.toString().padStart(3)} | ${ti.toString().padStart(2)} | ${(team.ShortName || '').padEnd(9)} | ${team.LongName || ''}`);
    }
  }

  // Get SeasonGame table
  const seasonGameTable = franchise.getTableByName('SeasonGame');
  await seasonGameTable.readRecords();

  console.log('\n=== Week 1 Regular Season Games ===\n');
  console.log('# | Home (RI→TI) | Away (RI→TI) | Matchup');
  console.log('--|--------------|--------------|--------');

  let gameNum = 0;
  for (const game of seasonGameTable.records) {
    if (game.isEmpty) continue;
    if (game.SeasonWeek !== 1) continue;
    if (game.SeasonWeekType !== 'RegularSeason') continue;

    gameNum++;

    const homeRef = game.HomeTeam;
    const awayRef = game.AwayTeam;

    const homeRI = parseInt(homeRef.slice(-8), 2);
    const awayRI = parseInt(awayRef.slice(-8), 2);

    const homeTeam = recordIndexToTeam.get(homeRI);
    const awayTeam = recordIndexToTeam.get(awayRI);

    const homeTI = homeTeam?.teamIndex ?? '?';
    const awayTI = awayTeam?.teamIndex ?? '?';
    const homeAbbr = homeTeam?.shortName ?? '???';
    const awayAbbr = awayTeam?.shortName ?? '???';

    console.log(`${gameNum.toString().padStart(2)} | ${homeRI.toString().padStart(2)}→${homeTI.toString().padStart(2)} ${homeAbbr.padEnd(4)} | ${awayRI.toString().padStart(2)}→${awayTI.toString().padStart(2)} ${awayAbbr.padEnd(4)} | ${awayAbbr} @ ${homeAbbr}`);

    if (gameNum >= 16) break;
  }

  // Now show what 2024 schedule expects
  const fs = require('fs');
  const path = require('path');
  const schedule2024 = JSON.parse(fs.readFileSync(
    path.join(__dirname, 'data', 'retro', 'schedules', '2024.json'),
    'utf-8'
  ));

  console.log('\n=== Expected from 2024.json (Week 1) ===\n');
  console.log('# | Home TI→RI | Away TI→RI | Expected Matchup');
  console.log('--|------------|------------|------------------');

  const week1 = schedule2024.games.filter(g => g.week === 1);
  for (let i = 0; i < Math.min(16, week1.length); i++) {
    const g = week1[i];
    const homeRI = teamIndexToRecordIndex.get(g.homeTeamIndex) ?? '?';
    const awayRI = teamIndexToRecordIndex.get(g.awayTeamIndex) ?? '?';

    console.log(`${(i+1).toString().padStart(2)} | ${g.homeTeamIndex.toString().padStart(2)}→${homeRI.toString().padStart(2)}     | ${g.awayTeamIndex.toString().padStart(2)}→${awayRI.toString().padStart(2)}     | ${g.awayTeam} @ ${g.homeTeam}`);
  }
}

fullDump().catch(console.error);
