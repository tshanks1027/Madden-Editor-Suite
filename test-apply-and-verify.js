/**
 * Test the full apply flow and verify changes persist
 * Run with: node test-apply-and-verify.js <franchise-file-path> <year>
 *
 * WARNING: This WILL modify your franchise file! Creates a backup first.
 */

const fs = require('fs');
const path = require('path');
const Franchise = require('madden-franchise');

// Load expansion history
const expansionHistoryPath = path.join(__dirname, 'data', 'retro', 'expansion-history.json');
let expansionHistory = [];

if (fs.existsSync(expansionHistoryPath)) {
  const data = JSON.parse(fs.readFileSync(expansionHistoryPath, 'utf-8'));
  expansionHistory = data.expansions || [];
}

async function testApplyAndVerify(filePath, year) {
  console.log('='.repeat(80));
  console.log('APPLY AND VERIFY TEST');
  console.log('='.repeat(80));
  console.log('File:', filePath);
  console.log('Year:', year);

  // Create backup
  const backupPath = filePath + '.backup-test-' + Date.now();
  console.log('\nCreating backup:', backupPath);
  fs.copyFileSync(filePath, backupPath);

  try {
    // Get expansion teams for this year
    const expansionTeamsThisYear = expansionHistory.filter(team => team.year === year);
    const expansionTeamIndices = new Set(expansionTeamsThisYear.map(t => t.teamIndex));
    const expectedSuperBowl = year - 1965;

    console.log('\nExpansion teams for', year + ':', expansionTeamsThisYear.map(t => `${t.team}(${t.teamIndex})`).join(', '));
    console.log('Expected Super Bowl:', expectedSuperBowl);

    // PHASE 1: Count before
    console.log('\n' + '='.repeat(80));
    console.log('PHASE 1: STATE BEFORE CHANGES');
    console.log('='.repeat(80));

    let franchise = await Franchise.create(filePath);
    let playerTable = franchise.getTableByName('Player');
    await playerTable.readRecords();

    let beforeCounts = countPlayersByTeam(playerTable, expansionTeamIndices);
    console.log('\nExpansion team players BEFORE:', beforeCounts.expansion);
    console.log('FA players BEFORE:', beforeCounts.fa);

    let seasonInfo = franchise.getTableByName('SeasonInfo');
    await seasonInfo.readRecords();
    let beforeSuperBowl = seasonInfo.records[0]?.BaseSuperBowlNumber;
    console.log('Super Bowl number BEFORE:', beforeSuperBowl);

    // PHASE 2: Apply changes
    console.log('\n' + '='.repeat(80));
    console.log('PHASE 2: APPLYING CHANGES');
    console.log('='.repeat(80));

    // Move expansion team players to FA
    let movedCount = 0;
    for (const player of playerTable.records) {
      if (player.isEmpty) continue;
      const teamIndex = Number(player.TeamIndex);
      if (expansionTeamIndices.has(teamIndex)) {
        const name = `${player.FirstName || ''} ${player.LastName || ''}`.trim();
        const pos = player.Position;
        if (movedCount < 5) {
          console.log(`Moving ${name} (${pos}) from team ${teamIndex} to FA`);
        }
        player.TeamIndex = 32;
        movedCount++;
      }
    }
    console.log(`Moved ${movedCount} players to FA`);

    // Set Super Bowl number
    if (seasonInfo.records[0]?.BaseSuperBowlNumber !== undefined) {
      seasonInfo.records[0].BaseSuperBowlNumber = expectedSuperBowl;
      console.log(`Set BaseSuperBowlNumber to ${expectedSuperBowl}`);
    }

    // PHASE 3: Verify in-memory changes
    console.log('\n' + '='.repeat(80));
    console.log('PHASE 3: VERIFY IN-MEMORY CHANGES');
    console.log('='.repeat(80));

    let afterCounts = countPlayersByTeam(playerTable, expansionTeamIndices);
    console.log('\nExpansion team players AFTER (in memory):', afterCounts.expansion);
    console.log('FA players AFTER (in memory):', afterCounts.fa);
    console.log('Super Bowl AFTER (in memory):', seasonInfo.records[0]?.BaseSuperBowlNumber);

    if (afterCounts.expansion !== 0) {
      console.log('\nWARNING: Expansion teams still have players after move!');
    }

    // PHASE 4: Save
    console.log('\n' + '='.repeat(80));
    console.log('PHASE 4: SAVING FILE');
    console.log('='.repeat(80));

    console.log('Saving franchise file...');
    await franchise.save(filePath);
    console.log('Save complete');

    // Clear and reload
    franchise = null;
    playerTable = null;
    seasonInfo = null;

    // PHASE 5: Reload and verify
    console.log('\n' + '='.repeat(80));
    console.log('PHASE 5: RELOAD AND VERIFY');
    console.log('='.repeat(80));

    console.log('Reloading franchise file...');
    franchise = await Franchise.create(filePath);
    playerTable = franchise.getTableByName('Player');
    await playerTable.readRecords();
    seasonInfo = franchise.getTableByName('SeasonInfo');
    await seasonInfo.readRecords();

    let reloadCounts = countPlayersByTeam(playerTable, expansionTeamIndices);
    let reloadSuperBowl = seasonInfo.records[0]?.BaseSuperBowlNumber;

    console.log('\nExpansion team players AFTER RELOAD:', reloadCounts.expansion);
    console.log('FA players AFTER RELOAD:', reloadCounts.fa);
    console.log('Super Bowl AFTER RELOAD:', reloadSuperBowl);

    // SUMMARY
    console.log('\n' + '='.repeat(80));
    console.log('SUMMARY');
    console.log('='.repeat(80));

    console.log('\nPlayer Movement:');
    console.log(`  Before: ${beforeCounts.expansion} on expansion teams, ${beforeCounts.fa} FA`);
    console.log(`  After:  ${reloadCounts.expansion} on expansion teams, ${reloadCounts.fa} FA`);
    console.log(`  Moved:  ${beforeCounts.expansion - reloadCounts.expansion} players`);

    console.log('\nSuper Bowl:');
    console.log(`  Before: ${beforeSuperBowl}`);
    console.log(`  After:  ${reloadSuperBowl}`);
    console.log(`  Expected: ${expectedSuperBowl}`);

    const playersSuccess = reloadCounts.expansion === 0;
    const superBowlSuccess = reloadSuperBowl === expectedSuperBowl;

    console.log('\nResults:');
    console.log(`  Player move: ${playersSuccess ? 'SUCCESS' : 'FAILED'}`);
    console.log(`  Super Bowl:  ${superBowlSuccess ? 'SUCCESS' : 'FAILED'}`);

    // Restore backup
    console.log('\n' + '='.repeat(80));
    console.log('RESTORING BACKUP');
    console.log('='.repeat(80));

    fs.copyFileSync(backupPath, filePath);
    fs.unlinkSync(backupPath);
    console.log('Backup restored and deleted');

    return { playersSuccess, superBowlSuccess };

  } catch (err) {
    console.error('\nError:', err);
    // Restore backup on error
    if (fs.existsSync(backupPath)) {
      console.log('Restoring backup due to error...');
      fs.copyFileSync(backupPath, filePath);
      fs.unlinkSync(backupPath);
    }
    throw err;
  }
}

function countPlayersByTeam(playerTable, expansionTeamIndices) {
  let expansion = 0;
  let fa = 0;

  for (const player of playerTable.records) {
    if (player.isEmpty) continue;
    const teamIndex = Number(player.TeamIndex);
    if (expansionTeamIndices.has(teamIndex)) {
      expansion++;
    }
    if (teamIndex === 32) {
      fa++;
    }
  }

  return { expansion, fa };
}

// Main
const args = process.argv.slice(2);
if (args.length < 2) {
  console.log('Usage: node test-apply-and-verify.js <franchise-file-path> <year>');
  console.log('\nWARNING: This will modify your franchise file (backup is created and restored)');
  process.exit(1);
}

const filePath = args[0];
const year = parseInt(args[1], 10);

if (!fs.existsSync(filePath)) {
  console.error('File not found:', filePath);
  process.exit(1);
}

testApplyAndVerify(filePath, year)
  .then(result => {
    console.log('\n' + '='.repeat(80));
    if (result.playersSuccess && result.superBowlSuccess) {
      console.log('ALL TESTS PASSED - Changes work correctly');
    } else {
      console.log('TESTS FAILED - Changes are not being saved properly');
    }
    console.log('='.repeat(80));
    process.exit(result.playersSuccess && result.superBowlSuccess ? 0 : 1);
  })
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
