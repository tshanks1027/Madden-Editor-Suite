/**
 * Comparison Tool via App IPC Handlers
 *
 * Uses the app's existing franchise and roster handlers to compare data.
 * This avoids duplicating file loading logic.
 */

const { app, ipcMain } = require('electron');
const path = require('path');

// Import IPC handlers
require('../src/main/ipc/parser-handlers');
require('../src/main/ipc/franchise-handlers');

const ROSTER_FILE = 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden NFL 26\\Saves\\ROSTER-Official';
const FRANCHISE_FILE = 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden NFL 26\\Saves\\CAREERDRAFT-Test';

const FIELDS_TO_COMPARE = [
  { name: 'First Name', rosterCode: 'PFNA', franchiseCode: 'PFNA' },
  { name: 'Last Name', rosterCode: 'PLNA', franchiseCode: 'PLNA' },
  { name: 'College', rosterCode: 'PCOL', franchiseCode: 'PCOL' },
  { name: 'Position', rosterCode: 'PPOS', franchiseCode: 'PPOS' },
  { name: 'Team', rosterCode: 'TGID', franchiseCode: 'TGID' },
  { name: 'PID', rosterCode: 'PSXP', franchiseCode: 'PSXP' },
  { name: 'Hometown', rosterCode: 'PHTN', franchiseCode: 'PHTN' },
  { name: 'Home State', rosterCode: 'PHSN', franchiseCode: 'PHSN' },
];

async function loadRosterData() {
  console.log('\n[ROSTER] Loading via app handlers...');

  const loadResult = await new Promise((resolve) => {
    ipcMain.emit('roster:load-file', { reply: (result) => resolve(result) }, ROSTER_FILE);
  });

  if (!loadResult.success) {
    throw new Error(`Failed to load roster: ${loadResult.error}`);
  }

  console.log(`[ROSTER] Loaded ${loadResult.players?.length || 0} players`);
  return loadResult.players || [];
}

async function loadFranchiseData() {
  console.log('\n[FRANCHISE] Loading via app handlers...');

  const loadResult = await new Promise((resolve) => {
    ipcMain.emit('franchise:load-file', { reply: (result) => resolve(result) }, FRANCHISE_FILE);
  });

  if (!loadResult.success) {
    throw new Error(`Failed to load franchise: ${loadResult.error}`);
  }

  console.log(`[FRANCHISE] Loaded successfully`);

  const tableData = await new Promise((resolve) => {
    ipcMain.emit('franchise:get-table-data', { reply: (result) => resolve(result) }, FRANCHISE_FILE, 'Player');
  });

  if (!tableData.success) {
    throw new Error(`Failed to get Player table: ${tableData.error}`);
  }

  console.log(`[FRANCHISE] Retrieved ${tableData.records?.length || 0} players`);
  return tableData.records || [];
}

function compareData(rosterPlayers, franchisePlayers) {
  const NUM_TO_COMPARE = Math.min(20, rosterPlayers.length, franchisePlayers.length);

  console.log(`\n${'='.repeat(100)}`);
  console.log(`COMPARING FIRST ${NUM_TO_COMPARE} PLAYERS`);
  console.log(`${'='.repeat(100)}\n`);

  let totalMismatches = 0;
  const mismatchesByField = {};

  FIELDS_TO_COMPARE.forEach(field => {
    mismatchesByField[field.name] = 0;
  });

  for (let i = 0; i < NUM_TO_COMPARE; i++) {
    const rosterPlayer = rosterPlayers[i];
    const franchisePlayer = franchisePlayers[i];

    let playerHasMismatch = false;
    const mismatches = [];

    FIELDS_TO_COMPARE.forEach(fieldDef => {
      const rosterValue = rosterPlayer[fieldDef.rosterCode];
      const franchiseValue = franchisePlayer[fieldDef.franchiseCode];

      if (rosterValue !== franchiseValue) {
        playerHasMismatch = true;
        mismatches.push({
          field: fieldDef.name,
          roster: rosterValue,
          franchise: franchiseValue
        });
        mismatchesByField[fieldDef.name]++;
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

  console.log(`Total players compared: ${NUM_TO_COMPARE}`);
  console.log(`Players with mismatches: ${totalMismatches}`);
  console.log(`Players matching perfectly: ${NUM_TO_COMPARE - totalMismatches}\n`);

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

app.whenReady().then(async () => {
  try {
    console.log('Starting Roster vs Franchise Comparison via App Handlers...\n');

    const [rosterPlayers, franchisePlayers] = await Promise.all([
      loadRosterData(),
      loadFranchiseData()
    ]);

    const success = compareData(rosterPlayers, franchisePlayers);

    process.exit(success ? 0 : 1);
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
});
