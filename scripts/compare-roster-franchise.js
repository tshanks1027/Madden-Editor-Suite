/**
 * Roster vs Franchise Data Comparison Tool
 *
 * Loads both roster and franchise files and compares player data side-by-side
 * to verify franchise parsing is working correctly.
 *
 * Usage: node scripts/compare-roster-franchise.js
 */

const Franchise = require('madden-franchise');
const path = require('path');

// File paths
const ROSTER_FILE = 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden NFL 26\\Saves\\ROSTER-Official';
const FRANCHISE_FILE = 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden NFL 26\\Saves\\CAREERDRAFT-Test';

// Fields to compare
const FIELDS_TO_COMPARE = [
  { franchise: 'FirstName', roster: 'PFNA', display: 'First Name' },
  { franchise: 'LastName', roster: 'PLNA', display: 'Last Name' },
  { franchise: 'College', roster: 'PCOL', display: 'College' },
  { franchise: 'Position', roster: 'PPOS', display: 'Position' },
  { franchise: 'TeamIndex', roster: 'TGID', display: 'Team' },
  { franchise: 'PresentationId', roster: 'PSXP', display: 'PID' },
  { franchise: 'Hometown', roster: 'PHTN', display: 'Hometown' },
  { franchise: 'HomeState', roster: 'PHSN', display: 'Home State' },
  { franchise: 'PLYR_ASSETNAME', roster: 'PLAYERPIC', display: 'Player Pic' },
  { franchise: 'PLYR_PORTRAIT', roster: 'PEPS', display: 'Portrait' }
];

// Number of players to compare
const NUM_PLAYERS_TO_COMPARE = 20;

async function loadFranchiseData(filePath) {
  try {
    console.log(`\n[FRANCHISE] Loading: ${path.basename(filePath)}`);

    const franchise = await Franchise.create(filePath, {
      gameYearOverride: 26  // Help auto-detect M26 files
    });

    return await (async () => {
    console.log(`[FRANCHISE] Game year: ${franchise.schema?.meta?.gameYear}`);
    console.log(`[FRANCHISE] Tables count: ${franchise.tables?.length || 0}`);

    // Get Player table
    const playerTable = franchise.getTableByName('Player');

    if (!playerTable) {
      throw new Error('Player table not found');
    }

    // Read records
    await playerTable.readRecords();

    const activeRecords = playerTable.records.filter(r => !r.isEmpty);
    console.log(`[FRANCHISE] Active players: ${activeRecords.length}`);

    // Extract player data
    const players = [];

    for (let i = 0; i < Math.min(NUM_PLAYERS_TO_COMPARE, activeRecords.length); i++) {
      const record = activeRecords[i];
      const player = {};

      // Extract each field using direct property access (like working editor)
      FIELDS_TO_COMPARE.forEach(fieldDef => {
        player[fieldDef.franchise] = record[fieldDef.franchise];
      });

      players.push(player);
    }

    return players;
    })();
  } catch (error) {
    throw error;
  }
}

async function loadRosterData(filePath) {
  try {
    console.log(`\n[ROSTER] Loading: ${path.basename(filePath)}`);

    const franchise = await Franchise.create(filePath, {
      gameYearOverride: 26  // Help auto-detect M26 files
    });

    console.log(`[ROSTER] Game year: ${franchise.schema?.meta?.gameYear}`);
    console.log(`[ROSTER] Tables count: ${franchise.tables?.length || 0}`);

    // Get Player table
    const playerTable = franchise.getTableByName('Player');

    if (!playerTable) {
      throw new Error('Player table not found');
    }

    // Read records
    await playerTable.readRecords();

    const activeRecords = playerTable.records.filter(r => !r.isEmpty);
    console.log(`[ROSTER] Active players: ${activeRecords.length}`);

    // Extract player data
    const players = [];

    for (let i = 0; i < Math.min(NUM_PLAYERS_TO_COMPARE, activeRecords.length); i++) {
      const record = activeRecords[i];
      const player = {};

      // Extract each field using roster field codes
      FIELDS_TO_COMPARE.forEach(fieldDef => {
        // Get the franchise attribute name (they should be the same in roster)
        player[fieldDef.roster] = record[fieldDef.franchise];
      });

      players.push(player);
    }

    return players;
  } catch (error) {
    throw error;
  }
}

function compareData(rosterPlayers, franchisePlayers) {
  console.log(`\n${'='.repeat(100)}`);
  console.log('COMPARISON RESULTS');
  console.log(`${'='.repeat(100)}\n`);

  let totalMismatches = 0;
  const mismatchesByField = {};

  FIELDS_TO_COMPARE.forEach(field => {
    mismatchesByField[field.display] = 0;
  });

  for (let i = 0; i < NUM_PLAYERS_TO_COMPARE; i++) {
    const rosterPlayer = rosterPlayers[i];
    const franchisePlayer = franchisePlayers[i];

    let playerHasMismatch = false;
    const mismatches = [];

    FIELDS_TO_COMPARE.forEach(fieldDef => {
      const rosterValue = rosterPlayer[fieldDef.roster];
      const franchiseValue = franchisePlayer[fieldDef.franchise];

      if (rosterValue !== franchiseValue) {
        playerHasMismatch = true;
        mismatches.push({
          field: fieldDef.display,
          roster: rosterValue,
          franchise: franchiseValue
        });
        mismatchesByField[fieldDef.display]++;
      }
    });

    if (playerHasMismatch) {
      totalMismatches++;
      console.log(`\n❌ PLAYER ${i + 1}: ${rosterPlayer.PFNA} ${rosterPlayer.PLNA}`);
      console.log(`${'-'.repeat(80)}`);

      mismatches.forEach(m => {
        console.log(`  ${m.field.padEnd(15)} | Roster: ${String(m.roster).padEnd(20)} | Franchise: ${m.franchise}`);
      });
    } else {
      console.log(`✅ PLAYER ${i + 1}: ${rosterPlayer.PFNA} ${rosterPlayer.PLNA} - ALL FIELDS MATCH`);
    }
  }

  console.log(`\n${'='.repeat(100)}`);
  console.log('SUMMARY');
  console.log(`${'='.repeat(100)}\n`);

  console.log(`Total players compared: ${NUM_PLAYERS_TO_COMPARE}`);
  console.log(`Players with mismatches: ${totalMismatches}`);
  console.log(`Players matching perfectly: ${NUM_PLAYERS_TO_COMPARE - totalMismatches}\n`);

  console.log('Mismatches by field:');
  Object.entries(mismatchesByField).forEach(([field, count]) => {
    const status = count === 0 ? '✅' : '❌';
    console.log(`  ${status} ${field.padEnd(15)}: ${count} mismatches`);
  });

  console.log(`\n${'='.repeat(100)}\n`);

  if (totalMismatches === 0) {
    console.log('🎉 SUCCESS: All fields match between roster and franchise!\n');
    return true;
  } else {
    console.log('⚠️  FAILURE: Mismatches found. Franchise parsing needs fixes.\n');
    return false;
  }
}

async function main() {
  try {
    console.log('Starting Roster vs Franchise Comparison...\n');
    console.log(`Comparing first ${NUM_PLAYERS_TO_COMPARE} players\n`);

    // Load both files
    const rosterPlayers = await loadRosterData(ROSTER_FILE);
    const franchisePlayers = await loadFranchiseData(FRANCHISE_FILE);

    // Compare
    const success = compareData(rosterPlayers, franchisePlayers);

    process.exit(success ? 0 : 1);
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
