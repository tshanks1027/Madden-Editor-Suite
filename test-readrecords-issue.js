/**
 * Test if calling readRecords() multiple times discards in-memory changes
 * This mimics what the app does
 */

const fs = require('fs');
const Franchise = require('madden-franchise');

const PANTHERS = 20;
const JAGUARS = 16;
const FA = 32;

async function test(filePath) {
  console.log('Testing readRecords behavior...\n');

  // Create backup
  const backup = filePath + '.readtest-' + Date.now();
  fs.copyFileSync(filePath, backup);

  try {
    const franchise = await Franchise.create(filePath);

    // ============ STEP 1: First readRecords, make changes ============
    console.log('STEP 1: First readRecords and make changes');
    let playerTable = franchise.getTableByName('Player');
    await playerTable.readRecords();

    let before = countTeam(playerTable, PANTHERS);
    console.log('  Panthers BEFORE change:', before);

    // Move Panthers to FA
    let moved = 0;
    for (const p of playerTable.records) {
      if (p.isEmpty) continue;
      if (Number(p.TeamIndex) === PANTHERS) {
        p.TeamIndex = FA;
        moved++;
      }
    }
    console.log('  Moved', moved, 'Panthers to FA');

    let after = countTeam(playerTable, PANTHERS);
    console.log('  Panthers AFTER change (same table ref):', after);

    // ============ STEP 2: Call readRecords AGAIN on same table ============
    console.log('\nSTEP 2: Call readRecords() AGAIN on SAME table object');
    await playerTable.readRecords();

    let afterReread = countTeam(playerTable, PANTHERS);
    console.log('  Panthers AFTER second readRecords:', afterReread);

    if (afterReread > 0) {
      console.log('  *** BUG CONFIRMED: readRecords() DISCARDS in-memory changes! ***');
    } else {
      console.log('  Changes preserved (readRecords is idempotent)');
    }

    // ============ STEP 3: Get table again from franchise ============
    console.log('\nSTEP 3: Get fresh table reference from franchise');

    // First, make changes again if they were lost
    if (afterReread > 0) {
      console.log('  Re-making changes...');
      for (const p of playerTable.records) {
        if (p.isEmpty) continue;
        if (Number(p.TeamIndex) === PANTHERS) {
          p.TeamIndex = FA;
        }
      }
    }

    // Now get a "fresh" table reference
    let playerTable2 = franchise.getTableByName('Player');
    console.log('  Same object?', playerTable === playerTable2);

    await playerTable2.readRecords();
    let afterNewRef = countTeam(playerTable2, PANTHERS);
    console.log('  Panthers via new table ref:', afterNewRef);

    // ============ STEP 4: Save and verify ============
    console.log('\nSTEP 4: Save and reload');

    // Make sure changes are in place
    for (const p of playerTable.records) {
      if (p.isEmpty) continue;
      if (Number(p.TeamIndex) === PANTHERS) {
        p.TeamIndex = FA;
      }
    }

    await franchise.save(filePath);
    console.log('  Saved');

    // Reload
    const franchise2 = await Franchise.create(filePath);
    const playerTable3 = franchise2.getTableByName('Player');
    await playerTable3.readRecords();

    let final = countTeam(playerTable3, PANTHERS);
    console.log('  Panthers AFTER reload:', final);

    if (final === 0) {
      console.log('\n✓ Changes persisted correctly to disk');
    } else {
      console.log('\n✗ Changes did NOT persist - save problem');
    }

    // Restore backup
    fs.copyFileSync(backup, filePath);
    fs.unlinkSync(backup);
    console.log('\nBackup restored');

  } catch (err) {
    console.error('Error:', err);
    fs.copyFileSync(backup, filePath);
    fs.unlinkSync(backup);
  }
}

function countTeam(table, teamIndex) {
  let count = 0;
  for (const p of table.records) {
    if (p.isEmpty) continue;
    if (Number(p.TeamIndex) === teamIndex) count++;
  }
  return count;
}

const filePath = process.argv[2];
if (!filePath || !fs.existsSync(filePath)) {
  console.log('Usage: node test-readrecords-issue.js <franchise-file>');
  process.exit(1);
}

test(filePath);
