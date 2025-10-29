/**
 * Direct Test for Franchise Save Handler
 *
 * This script directly tests the franchise save functionality without Playwright.
 * It loads a franchise file, modifies a player, saves it, and reloads to verify.
 */

const path = require('path');
const Franchise = require('madden-franchise');

const TEST_FILE = path.join(
  process.env.USERPROFILE,
  'OneDrive',
  'Documents',
  'Madden Files',
  'Madden 26',
  'Tools',
  'CAREER-DOUGFLUTIE'
);

async function testFranchiseSave() {
  console.log('\n=== FRANCHISE SAVE TEST ===\n');
  console.log('Test file:', TEST_FILE);

  try {
    // Step 1: Load franchise file
    console.log('\n[1] Loading franchise file...');
    const franchise = await Franchise.create(TEST_FILE, {
      gameYearOverride: 26
    });

    const playerTable = franchise.getTableByName('Player');
    if (!playerTable) {
      throw new Error('Player table not found');
    }

    await playerTable.readRecords();
    console.log(`✓ Loaded ${playerTable.records.length} players`);

    // Step 2: Check first player BEFORE edit
    const firstPlayer = playerTable.records[0];
    if (!firstPlayer || firstPlayer.isEmpty) {
      throw new Error('First player is empty');
    }

    const originalFirstName = firstPlayer.FirstName;
    const originalCollege = firstPlayer.College;
    console.log(`\n[2] First player BEFORE edit:`);
    console.log(`  - FirstName: ${originalFirstName}`);
    console.log(`  - College: ${originalCollege} (type: ${typeof originalCollege})`);

    // Step 3: Edit the first player
    const testFirstName = 'TESTNAME' + Date.now();
    console.log(`\n[3] Editing first player name: ${originalFirstName} → ${testFirstName}`);
    firstPlayer.FirstName = testFirstName;

    // Step 4: Save the file
    console.log('\n[4] Saving franchise file...');
    await new Promise((resolve, reject) => {
      franchise.save(TEST_FILE, (err) => {
        if (err) reject(err);
        else resolve(true);
      });
    });
    console.log('✓ Franchise file saved');

    // Step 5: Reload the file
    console.log('\n[5] Reloading franchise file to verify...');
    const franchise2 = await Franchise.create(TEST_FILE, {
      gameYearOverride: 26
    });

    const playerTable2 = franchise2.getTableByName('Player');
    await playerTable2.readRecords();

    const firstPlayer2 = playerTable2.records[0];
    const reloadedFirstName = firstPlayer2.FirstName;
    const reloadedCollege = firstPlayer2.College;

    console.log(`\n[6] First player AFTER reload:`);
    console.log(`  - FirstName: ${reloadedFirstName}`);
    console.log(`  - College: ${reloadedCollege} (type: ${typeof reloadedCollege})`);

    // Step 6: Verify the edit persisted
    console.log('\n[7] Verification:');
    if (reloadedFirstName === testFirstName) {
      console.log('✓ SUCCESS: Edit persisted through save/reload cycle!');
      console.log(`  Expected: ${testFirstName}`);
      console.log(`  Got: ${reloadedFirstName}`);
    } else {
      console.log('✗ FAILED: Edit did NOT persist');
      console.log(`  Expected: ${testFirstName}`);
      console.log(`  Got: ${reloadedFirstName}`);
      process.exit(1);
    }

    // Step 7: Restore original value
    console.log('\n[8] Restoring original first name...');
    firstPlayer2.FirstName = originalFirstName;
    await new Promise((resolve, reject) => {
      franchise2.save(TEST_FILE, (err) => {
        if (err) reject(err);
        else resolve(true);
      });
    });
    console.log('✓ Original value restored');

    console.log('\n=== TEST PASSED ===\n');

  } catch (error) {
    console.error('\n✗ TEST FAILED:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the test
testFranchiseSave();
