/**
 * Step-by-step test of retro editor flow
 * This will show EXACTLY where the problem is
 */

const fs = require('fs');
const path = require('path');
const Franchise = require('madden-franchise');

const PANTHERS_INDEX = 20;
const JAGUARS_INDEX = 16;
const FA_INDEX = 32;

async function testStepByStep(filePath) {
  console.log('='.repeat(80));
  console.log('STEP-BY-STEP RETRO EDITOR TEST');
  console.log('='.repeat(80));
  console.log('File:', filePath);
  console.log('');

  // Create backup
  const backupPath = filePath + '.test-backup-' + Date.now();
  console.log('Creating backup:', backupPath);
  fs.copyFileSync(filePath, backupPath);

  try {
    // ============ STEP 1: INITIAL STATE ============
    console.log('\n' + '='.repeat(80));
    console.log('STEP 1: INITIAL STATE');
    console.log('='.repeat(80));

    let franchise = await Franchise.create(filePath);
    let playerTable = franchise.getTableByName('Player');
    await playerTable.readRecords();

    let seasonInfo = franchise.getTableByName('SeasonInfo');
    await seasonInfo.readRecords();

    let counts = countPlayers(playerTable);
    console.log('\nPlayer counts:');
    console.log('  Panthers (20):', counts.panthers);
    console.log('  Jaguars (16):', counts.jaguars);
    console.log('  Free Agents (32):', counts.fa);
    console.log('  Total players:', counts.total);

    console.log('\nPanthers QBs:', counts.panthersQBs.join(', ') || 'NONE');
    console.log('Jaguars QBs:', counts.jaguarsQBs.join(', ') || 'NONE');

    let superBowl = seasonInfo.records[0]?.BaseSuperBowlNumber;
    console.log('\nSuper Bowl number:', superBowl);

    // ============ STEP 2: MOVE TO FA ============
    console.log('\n' + '='.repeat(80));
    console.log('STEP 2: MOVE PANTHERS/JAGUARS TO FA');
    console.log('='.repeat(80));

    let moved = 0;
    for (const player of playerTable.records) {
      if (player.isEmpty) continue;
      const teamIndex = Number(player.TeamIndex);
      if (teamIndex === PANTHERS_INDEX || teamIndex === JAGUARS_INDEX) {
        const name = `${player.FirstName || ''} ${player.LastName || ''}`.trim();
        if (moved < 5) {
          console.log(`Moving ${name} from team ${teamIndex} to FA`);
        }
        player.TeamIndex = FA_INDEX;
        moved++;
      }
    }
    console.log(`\nMoved ${moved} players to FA`);

    counts = countPlayers(playerTable);
    console.log('\nPlayer counts AFTER MOVE (in memory):');
    console.log('  Panthers (20):', counts.panthers, counts.panthers === 0 ? '✓' : '✗ STILL HAS PLAYERS');
    console.log('  Jaguars (16):', counts.jaguars, counts.jaguars === 0 ? '✓' : '✗ STILL HAS PLAYERS');
    console.log('  Free Agents (32):', counts.fa);

    // ============ STEP 3: SET SUPER BOWL ============
    console.log('\n' + '='.repeat(80));
    console.log('STEP 3: SET SUPER BOWL TO 30 (1995)');
    console.log('='.repeat(80));

    const oldSB = seasonInfo.records[0]?.BaseSuperBowlNumber;
    seasonInfo.records[0].BaseSuperBowlNumber = 30;
    const newSB = seasonInfo.records[0]?.BaseSuperBowlNumber;
    console.log(`Changed Super Bowl: ${oldSB} -> ${newSB}`);

    // ============ STEP 4: SAVE ============
    console.log('\n' + '='.repeat(80));
    console.log('STEP 4: SAVE FILE');
    console.log('='.repeat(80));

    console.log('Saving...');
    await franchise.save(filePath);
    console.log('Save complete');

    // Clear references
    franchise = null;
    playerTable = null;
    seasonInfo = null;

    // ============ STEP 5: RELOAD AND VERIFY ============
    console.log('\n' + '='.repeat(80));
    console.log('STEP 5: RELOAD AND VERIFY');
    console.log('='.repeat(80));

    console.log('Reloading file...');
    franchise = await Franchise.create(filePath);
    playerTable = franchise.getTableByName('Player');
    await playerTable.readRecords();
    seasonInfo = franchise.getTableByName('SeasonInfo');
    await seasonInfo.readRecords();

    counts = countPlayers(playerTable);
    console.log('\nPlayer counts AFTER RELOAD:');
    console.log('  Panthers (20):', counts.panthers, counts.panthers === 0 ? '✓ CORRECT' : '✗ FAILED - STILL HAS PLAYERS');
    console.log('  Jaguars (16):', counts.jaguars, counts.jaguars === 0 ? '✓ CORRECT' : '✗ FAILED - STILL HAS PLAYERS');
    console.log('  Free Agents (32):', counts.fa);

    console.log('\nPanthers QBs after reload:', counts.panthersQBs.join(', ') || 'NONE (correct)');
    console.log('Jaguars QBs after reload:', counts.jaguarsQBs.join(', ') || 'NONE (correct)');

    superBowl = seasonInfo.records[0]?.BaseSuperBowlNumber;
    console.log('\nSuper Bowl after reload:', superBowl, superBowl === 30 ? '✓ CORRECT' : '✗ FAILED');

    // ============ SUMMARY ============
    console.log('\n' + '='.repeat(80));
    console.log('SUMMARY');
    console.log('='.repeat(80));

    const moveSuccess = counts.panthers === 0 && counts.jaguars === 0;
    const sbSuccess = superBowl === 30;

    if (moveSuccess && sbSuccess) {
      console.log('\n✓ ALL CHANGES PERSISTED CORRECTLY');
      console.log('The direct code works. The problem is in the app flow.');
    } else {
      console.log('\n✗ CHANGES DID NOT PERSIST');
      if (!moveSuccess) {
        console.log('  - Player move FAILED');
      }
      if (!sbSuccess) {
        console.log('  - Super Bowl change FAILED');
      }
    }

    // Restore backup
    console.log('\n' + '='.repeat(80));
    console.log('RESTORING BACKUP');
    console.log('='.repeat(80));
    fs.copyFileSync(backupPath, filePath);
    fs.unlinkSync(backupPath);
    console.log('Backup restored');

    return { moveSuccess, sbSuccess };

  } catch (err) {
    console.error('\nError:', err);
    if (fs.existsSync(backupPath)) {
      fs.copyFileSync(backupPath, filePath);
      fs.unlinkSync(backupPath);
      console.log('Backup restored due to error');
    }
    throw err;
  }
}

function countPlayers(playerTable) {
  let panthers = 0, jaguars = 0, fa = 0, total = 0;
  let panthersQBs = [], jaguarsQBs = [];

  for (const player of playerTable.records) {
    if (player.isEmpty) continue;
    total++;
    const teamIndex = Number(player.TeamIndex);
    const name = `${player.FirstName || ''} ${player.LastName || ''}`.trim();
    const pos = player.Position;

    if (teamIndex === PANTHERS_INDEX) {
      panthers++;
      if (pos === 'QB' || pos === 0) panthersQBs.push(name);
    } else if (teamIndex === JAGUARS_INDEX) {
      jaguars++;
      if (pos === 'QB' || pos === 0) jaguarsQBs.push(name);
    } else if (teamIndex === FA_INDEX) {
      fa++;
    }
  }

  return { panthers, jaguars, fa, total, panthersQBs, jaguarsQBs };
}

// Main
const filePath = process.argv[2];
if (!filePath) {
  console.log('Usage: node test-retro-step-by-step.js <franchise-file-path>');
  process.exit(1);
}

if (!fs.existsSync(filePath)) {
  console.error('File not found:', filePath);
  process.exit(1);
}

testStepByStep(filePath)
  .then(result => {
    process.exit(result.moveSuccess && result.sbSuccess ? 0 : 1);
  })
  .catch(err => {
    console.error('Fatal:', err);
    process.exit(1);
  });
