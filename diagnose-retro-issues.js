/**
 * Diagnose why retro editor changes aren't working
 * Run with: node diagnose-retro-issues.js <franchise-file-path> <year>
 */

const fs = require('fs');
const path = require('path');
const Franchise = require('madden-franchise');

// Load expansion history directly
const expansionHistoryPath = path.join(__dirname, 'data', 'retro', 'expansion-history.json');
let expansionHistory = [];

if (fs.existsSync(expansionHistoryPath)) {
  const data = JSON.parse(fs.readFileSync(expansionHistoryPath, 'utf-8'));
  expansionHistory = data.expansions || [];
  console.log('Loaded expansion history:', expansionHistory.length, 'teams');
} else {
  console.error('ERROR: expansion-history.json not found at:', expansionHistoryPath);
}

async function diagnose(filePath, year) {
  console.log('='.repeat(80));
  console.log('RETRO EDITOR DIAGNOSTIC');
  console.log('='.repeat(80));
  console.log('File:', filePath);
  console.log('Year:', year);
  console.log('');

  // 1. Check expansion teams for this year
  console.log('='.repeat(80));
  console.log('1. EXPANSION TEAMS FOR YEAR', year);
  console.log('='.repeat(80));

  const expansionTeamsThisYear = expansionHistory.filter(team => team.year === year);
  console.log('Filter: team.year === ' + year);
  console.log('Found:', expansionTeamsThisYear.length, 'expansion teams');

  if (expansionTeamsThisYear.length === 0) {
    console.log('\nWARNING: No expansion teams found for this year!');
    console.log('Available expansion years:');
    const years = [...new Set(expansionHistory.map(t => t.year))].sort((a, b) => a - b);
    for (const y of years) {
      const teams = expansionHistory.filter(t => t.year === y);
      console.log(`  ${y}: ${teams.map(t => t.team).join(', ')}`);
    }
  } else {
    for (const team of expansionTeamsThisYear) {
      console.log(`  - ${team.team} (TeamIndex: ${team.teamIndex})`);
    }
  }

  // 2. Load franchise and check player distribution
  console.log('\n' + '='.repeat(80));
  console.log('2. PLAYER DISTRIBUTION BY TEAM');
  console.log('='.repeat(80));

  const franchise = await Franchise.create(filePath);
  const playerTable = franchise.getTableByName('Player');
  await playerTable.readRecords();

  const teamCounts = new Map();
  const teamQBs = new Map();

  for (const player of playerTable.records) {
    if (player.isEmpty) continue;
    const teamIndex = Number(player.TeamIndex);
    const position = player.Position;
    const name = `${player.FirstName || ''} ${player.LastName || ''}`.trim();

    teamCounts.set(teamIndex, (teamCounts.get(teamIndex) || 0) + 1);

    // Track QBs specifically
    if (position === 'QB' || position === 0) {
      if (!teamQBs.has(teamIndex)) {
        teamQBs.set(teamIndex, []);
      }
      teamQBs.get(teamIndex).push(name);
    }
  }

  // Show expansion team player counts
  console.log('\nExpansion team player counts:');
  for (const team of expansionTeamsThisYear) {
    const count = teamCounts.get(team.teamIndex) || 0;
    const qbs = teamQBs.get(team.teamIndex) || [];
    console.log(`  ${team.team} (TeamIndex ${team.teamIndex}): ${count} players`);
    if (qbs.length > 0) {
      console.log(`    QBs: ${qbs.join(', ')}`);
    }
  }

  // Show FA count
  const faCount = teamCounts.get(32) || 0;
  const faQBs = teamQBs.get(32) || [];
  console.log(`\n  Free Agents (TeamIndex 32): ${faCount} players`);
  console.log(`    QBs in FA: ${faQBs.length > 0 ? faQBs.slice(0, 10).join(', ') : 'None'}`);
  if (faQBs.length > 10) {
    console.log(`    ... and ${faQBs.length - 10} more QBs`);
  }

  // 3. Check SeasonInfo.BaseSuperBowlNumber
  console.log('\n' + '='.repeat(80));
  console.log('3. SUPER BOWL NUMBER CHECK');
  console.log('='.repeat(80));

  const expectedSB = year - 1965;
  console.log(`\nExpected Super Bowl for ${year}: ${expectedSB} (Super Bowl ${toRoman(expectedSB)})`);

  const seasonInfoTable = franchise.getTableByName('SeasonInfo');
  if (seasonInfoTable) {
    await seasonInfoTable.readRecords();
    for (const record of seasonInfoTable.records) {
      if (record.isEmpty) continue;
      const currentSB = record.BaseSuperBowlNumber;
      console.log(`Current BaseSuperBowlNumber: ${currentSB} (Super Bowl ${toRoman(currentSB)})`);
      if (currentSB !== expectedSB) {
        console.log(`\nMISMATCH! Should be ${expectedSB}, currently ${currentSB}`);
      } else {
        console.log(`\nOK: Super Bowl number is correct`);
      }
    }
  } else {
    console.log('ERROR: SeasonInfo table not found');
  }

  // 4. Test moving players to FA
  console.log('\n' + '='.repeat(80));
  console.log('4. TEST MOVE TO FA (without saving)');
  console.log('='.repeat(80));

  const expansionTeamIndices = new Set(expansionTeamsThisYear.map(t => t.teamIndex));
  let wouldMove = 0;

  for (const player of playerTable.records) {
    if (player.isEmpty) continue;
    const teamIndex = Number(player.TeamIndex);
    if (expansionTeamIndices.has(teamIndex)) {
      const name = `${player.FirstName || ''} ${player.LastName || ''}`.trim();
      const position = player.Position;
      if (wouldMove < 10) {
        console.log(`Would move: ${name} (${position}) from team ${teamIndex}`);
      }
      wouldMove++;
    }
  }

  if (wouldMove > 10) {
    console.log(`... and ${wouldMove - 10} more`);
  }

  console.log(`\nTotal players that WOULD be moved to FA: ${wouldMove}`);

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));

  console.log('\n1. Expansion teams for ' + year + ':',
    expansionTeamsThisYear.length > 0
      ? expansionTeamsThisYear.map(t => `${t.team} (${t.teamIndex})`).join(', ')
      : 'NONE');

  console.log('2. Players on expansion teams:', wouldMove);
  console.log('3. Super Bowl number: ' +
    (seasonInfoTable ? 'See above' : 'Could not check'));

  if (expansionTeamsThisYear.length === 0) {
    console.log('\n*** PROBLEM: No expansion teams defined for this year ***');
    console.log('The moveInactiveTeamPlayersToFA function will do nothing.');
  }

  if (wouldMove === 0 && expansionTeamsThisYear.length > 0) {
    console.log('\n*** PROBLEM: Expansion teams have no players ***');
    console.log('Either teams have wrong TeamIndex or players are already FAs.');
  }
}

function toRoman(num) {
  if (num <= 0) return '0';
  const romanNumerals = [
    { value: 50, numeral: 'L' },
    { value: 40, numeral: 'XL' },
    { value: 10, numeral: 'X' },
    { value: 9, numeral: 'IX' },
    { value: 5, numeral: 'V' },
    { value: 4, numeral: 'IV' },
    { value: 1, numeral: 'I' }
  ];
  let result = '';
  for (const { value, numeral } of romanNumerals) {
    while (num >= value) {
      result += numeral;
      num -= value;
    }
  }
  return result;
}

// Main
const args = process.argv.slice(2);
if (args.length < 2) {
  console.log('Usage: node diagnose-retro-issues.js <franchise-file-path> <year>');
  process.exit(1);
}

const filePath = args[0];
const year = parseInt(args[1], 10);

if (!fs.existsSync(filePath)) {
  console.error('File not found:', filePath);
  process.exit(1);
}

diagnose(filePath, year)
  .then(() => {
    console.log('\nDiagnostic complete.');
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
