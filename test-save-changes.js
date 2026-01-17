/**
 * Test if changes to franchise files are actually saved
 * Run with: node test-save-changes.js <franchise-file-path>
 *
 * This test:
 * 1. Loads the franchise file
 * 2. Finds a player and records their TeamIndex
 * 3. Changes the TeamIndex
 * 4. Saves the file
 * 5. Reloads the file
 * 6. Verifies the change persisted
 */

const fs = require('fs');
const path = require('path');
const Franchise = require('madden-franchise');

async function testSaveChanges(filePath) {
  console.log('='.repeat(80));
  console.log('SAVE CHANGES VERIFICATION TEST');
  console.log('='.repeat(80));
  console.log(`File: ${filePath}`);
  console.log('');

  // Create a backup
  const backupPath = filePath + '.backup-test';
  console.log(`Creating backup at: ${backupPath}`);
  fs.copyFileSync(filePath, backupPath);

  try {
    // PHASE 1: Load, modify, and save
    console.log('\n' + '='.repeat(80));
    console.log('PHASE 1: Load, Modify, and Save');
    console.log('='.repeat(80));

    let franchise = await Franchise.create(filePath);

    // Get player table
    const playerTable = franchise.getTableByName('Player');
    if (!playerTable) {
      throw new Error('Player table not found');
    }
    await playerTable.readRecords();
    console.log(`Found ${playerTable.records.length} player records`);

    // Find a non-FA player to modify
    let testPlayer = null;
    let originalTeamIndex = null;
    const FA_INDEX = 32;
    const TEST_TEAM_INDEX = 31; // Texans

    for (const player of playerTable.records) {
      if (player.isEmpty) continue;
      const teamIndex = Number(player.TeamIndex);
      if (teamIndex >= 0 && teamIndex < 32 && teamIndex !== TEST_TEAM_INDEX) {
        testPlayer = player;
        originalTeamIndex = teamIndex;
        break;
      }
    }

    if (!testPlayer) {
      throw new Error('Could not find a suitable test player');
    }

    const playerName = `${testPlayer.FirstName || ''} ${testPlayer.LastName || ''}`.trim();
    const playerIndex = testPlayer.index;

    console.log(`\nTest Player: ${playerName}`);
    console.log(`Player Record Index: ${playerIndex}`);
    console.log(`Original TeamIndex: ${originalTeamIndex}`);
    console.log(`Will change to: ${TEST_TEAM_INDEX}`);

    // Change the TeamIndex
    console.log('\nModifying TeamIndex...');
    testPlayer.TeamIndex = TEST_TEAM_INDEX;

    // Verify in-memory change
    const afterSetTeamIndex = testPlayer.TeamIndex;
    console.log(`TeamIndex after set: ${afterSetTeamIndex}`);

    if (Number(afterSetTeamIndex) !== TEST_TEAM_INDEX) {
      console.log('WARNING: In-memory change did not take effect!');
    }

    // Save the file
    console.log('\nSaving franchise file...');
    await franchise.save(filePath);
    console.log('Save completed');

    // Clear the franchise object
    franchise = null;

    // PHASE 2: Reload and verify
    console.log('\n' + '='.repeat(80));
    console.log('PHASE 2: Reload and Verify');
    console.log('='.repeat(80));

    console.log('\nReloading franchise file...');
    franchise = await Franchise.create(filePath);

    const playerTable2 = franchise.getTableByName('Player');
    await playerTable2.readRecords();

    const reloadedPlayer = playerTable2.records[playerIndex];
    const reloadedTeamIndex = Number(reloadedPlayer.TeamIndex);
    const reloadedName = `${reloadedPlayer.FirstName || ''} ${reloadedPlayer.LastName || ''}`.trim();

    console.log(`\nReloaded Player: ${reloadedName}`);
    console.log(`Expected TeamIndex: ${TEST_TEAM_INDEX}`);
    console.log(`Actual TeamIndex: ${reloadedTeamIndex}`);

    // PHASE 3: Restore original
    console.log('\n' + '='.repeat(80));
    console.log('PHASE 3: Restore Original');
    console.log('='.repeat(80));

    // Restore from backup
    console.log('\nRestoring from backup...');
    fs.copyFileSync(backupPath, filePath);
    fs.unlinkSync(backupPath);
    console.log('Backup restored and deleted');

    // SUMMARY
    console.log('\n' + '='.repeat(80));
    console.log('SUMMARY');
    console.log('='.repeat(80));

    console.log(`\nPlayer: ${playerName}`);
    console.log(`Original TeamIndex: ${originalTeamIndex}`);
    console.log(`Target TeamIndex: ${TEST_TEAM_INDEX}`);
    console.log(`After Save+Reload TeamIndex: ${reloadedTeamIndex}`);

    if (reloadedTeamIndex === TEST_TEAM_INDEX) {
      console.log('\n*** SUCCESS: Changes were saved and persisted! ***');
      return { success: true };
    } else if (reloadedTeamIndex === originalTeamIndex) {
      console.log('\n*** FAILURE: Changes were NOT saved - file unchanged ***');
      console.log('The franchise.save() method may not be writing changes correctly.');
      return { success: false, reason: 'Changes not persisted' };
    } else {
      console.log('\n*** UNEXPECTED: TeamIndex is different from both original and target ***');
      return { success: false, reason: 'Unexpected value' };
    }

  } catch (err) {
    console.error('\nError:', err.message);

    // Restore backup on error
    if (fs.existsSync(backupPath)) {
      console.log('Restoring from backup due to error...');
      fs.copyFileSync(backupPath, filePath);
      fs.unlinkSync(backupPath);
    }

    return { success: false, reason: err.message };
  }
}

// Main execution
const args = process.argv.slice(2);
if (args.length === 0) {
  console.log('Usage: node test-save-changes.js <franchise-file-path>');
  console.log('Example: node test-save-changes.js "C:/path/to/YOURFRANCHISE"');
  console.log('');
  console.log('WARNING: This test WILL modify your franchise file!');
  console.log('A backup will be created and restored, but use a test file.');
  process.exit(1);
}

const filePath = args[0];
if (!fs.existsSync(filePath)) {
  console.error(`File not found: ${filePath}`);
  process.exit(1);
}

testSaveChanges(filePath)
  .then((result) => {
    console.log('\n' + '='.repeat(80));
    if (result.success) {
      console.log('Test PASSED: franchise.save() works correctly');
    } else {
      console.log('Test FAILED:', result.reason);
    }
    console.log('='.repeat(80));
    process.exit(result.success ? 0 : 1);
  })
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
