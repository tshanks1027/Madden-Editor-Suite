/**
 * Find where the in-game head number (001-264) is stored
 *
 * Strategy:
 * 1. Build a SET of PIDs that have REAL PAMs from PID_Portrait_Mapping.csv
 * 2. Load roster and find players NOT in that set (they have placeholder PAMs, not real face scans)
 * 3. Analyze their fields looking for the head number pattern
 *
 * User mapping from test:
 *   PGHE 287 → Head 001
 *   PGHE 209 → Head 134
 *   PGHE 7 → Head 083
 *   PGHE 141 → Head 007
 *   PGHE 11 → Head 148
 *   PGHE 50 → Head 031
 */

const path = require('path');
const fs = require('fs');

async function findHeadNumber() {
  const MaddenRosterHelper = require('./src/main/lib/helpers/MaddenRosterHelper');

  // Step 1: Load PID_Portrait_Mapping.csv and build set of PIDs with REAL PAMs
  console.log('=== LOADING PID PORTRAIT MAPPING ===\n');
  const mappingPath = path.join(__dirname, 'data/lookups/PID_Portrait_Mapping.csv');
  const mappingContent = fs.readFileSync(mappingPath, 'utf-8');
  const mappingLines = mappingContent.trim().split('\n');

  const pidsWithRealPAM = new Set();
  const pidToRace = new Map(); // Track race for all PIDs
  const pidToInfo = new Map(); // Track full info

  for (let i = 1; i < mappingLines.length; i++) {
    const values = mappingLines[i].split(',');
    const pid = parseInt(values[0]);
    const playerName = values[1];
    const pam = values[4]; // PAM column
    const race = parseInt(values[5]); // Race: 1=White, 5=Mixed, 7=Black

    pidToRace.set(pid, race);
    pidToInfo.set(pid, { name: playerName, race: race, pam: pam });

    // Only add to "real PAM" set if PAM is not empty and not "0"
    if (pam && pam !== '' && pam !== '0') {
      pidsWithRealPAM.add(pid);
    }
  }

  console.log(`Total PIDs in mapping: ${pidToInfo.size}`);
  console.log(`PIDs with REAL PAMs (face scans): ${pidsWithRealPAM.size}`);
  console.log(`PIDs without real PAMs: ${pidToInfo.size - pidsWithRealPAM.size}\n`);

  // Step 2: Load official roster
  console.log('=== LOADING OFFICIAL ROSTER ===\n');
  const rosterPath = 'C:/Users/tshan/Documents/Dev/madden-editor-suite/data/templates/ROSTER-Official';
  const helper = new MaddenRosterHelper();
  const file = await helper.load(rosterPath);
  const playerTable = file.PLAY;

  console.log(`Roster has ${playerTable.records.length} players\n`);

  // Step 3: Find ALL players and check if they have real PAM
  const playersWithoutRealPAM = [];
  const playersWithRealPAM = [];

  for (const record of playerTable.records) {
    const playerData = {};
    for (const fieldName in record.fields) {
      playerData[fieldName] = record.fields[fieldName].value;
    }

    const pid = playerData.PSXP;
    const info = pidToInfo.get(pid);

    // If PID is in our mapping and has a real PAM, they have a face scan
    if (pidsWithRealPAM.has(pid)) {
      playersWithRealPAM.push({
        pid: pid,
        name: `${playerData.PFNA} ${playerData.PLNA}`,
        race: info?.race,
        data: playerData
      });
    } else {
      // No real PAM - uses generic face
      playersWithoutRealPAM.push({
        pid: pid,
        name: `${playerData.PFNA} ${playerData.PLNA}`,
        race: info?.race, // May be undefined if not in mapping
        data: playerData
      });
    }
  }

  console.log(`Players WITH real face scans in roster: ${playersWithRealPAM.length}`);
  console.log(`Players WITHOUT real face scans in roster: ${playersWithoutRealPAM.length}\n`);

  // Step 4: Look at players WITHOUT real PAMs (generic faces)
  // Find those where we know their race from the mapping
  const genericWithKnownRace = playersWithoutRealPAM.filter(p => p.race !== undefined);
  console.log(`Generic face players with known race: ${genericWithKnownRace.length}\n`);

  const whiteGeneric = genericWithKnownRace.filter(p => p.race === 1);
  const blackGeneric = genericWithKnownRace.filter(p => p.race === 7);
  const mixedGeneric = genericWithKnownRace.filter(p => p.race === 5);

  console.log(`  White (Race=1): ${whiteGeneric.length}`);
  console.log(`  Black (Race=7): ${blackGeneric.length}`);
  console.log(`  Mixed (Race=5): ${mixedGeneric.length}\n`);

  // Step 5: Show some specific known players
  console.log('=== CHECKING SPECIFIC KNOWN PLAYERS ===\n');

  // Look for specific PIDs
  const targetPIDs = [8, 24, 1, 2, 5, 7, 10, 21, 23, 26]; // Howie Long, Marcus Allen, etc.
  for (const targetPID of targetPIDs) {
    const info = pidToInfo.get(targetPID);
    if (info) {
      // Search roster for this PID
      const found = playerTable.records.find(r => r.fields['PSXP']?.value === targetPID);
      if (found) {
        const raceStr = info.race === 1 ? 'White' : info.race === 7 ? 'Black' : info.race === 5 ? 'Mixed' : info.race;
        console.log(`✓ PID ${targetPID} (${info.name}, ${raceStr}) FOUND in roster`);
        console.log(`  PGHE: ${found.fields['PGHE']?.value}`);
        console.log(`  PSKI: ${found.fields['PSKI']?.value}`);
        console.log(`  PEPS: "${found.fields['PEPS']?.value}"`);
        console.log(`  PLPL: ${found.fields['PLPL']?.value}`);
        console.log('');
      } else {
        console.log(`✗ PID ${targetPID} (${info.name}) NOT in roster`);
      }
    }
  }

  // Step 6: If we have both white and black generic face players, compare them
  if (whiteGeneric.length > 0 && blackGeneric.length > 0) {
    console.log('\n=== FIELD COMPARISON: WHITE vs BLACK GENERIC FACES ===\n');

    // Get all numeric fields
    const allFields = Object.keys(whiteGeneric[0].data).filter(f => {
      const v = whiteGeneric[0].data[f];
      return typeof v === 'number' && v < 10000; // Small numbers only
    });

    // For each field, compute avg for white and black
    const fieldComparison = [];
    allFields.forEach(field => {
      const whiteVals = whiteGeneric.map(p => p.data[field]).filter(v => v !== undefined);
      const blackVals = blackGeneric.map(p => p.data[field]).filter(v => v !== undefined);

      if (whiteVals.length > 0 && blackVals.length > 0) {
        const whiteAvg = whiteVals.reduce((a, b) => a + b, 0) / whiteVals.length;
        const blackAvg = blackVals.reduce((a, b) => a + b, 0) / blackVals.length;
        const diff = Math.abs(whiteAvg - blackAvg);

        // Check overlap
        const whiteMin = Math.min(...whiteVals);
        const whiteMax = Math.max(...whiteVals);
        const blackMin = Math.min(...blackVals);
        const blackMax = Math.max(...blackVals);

        // Does white range NOT overlap with black range?
        const noOverlap = whiteMax < blackMin || blackMax < whiteMin;

        fieldComparison.push({
          field,
          whiteAvg: whiteAvg.toFixed(1),
          blackAvg: blackAvg.toFixed(1),
          diff: diff.toFixed(1),
          whiteRange: `${whiteMin}-${whiteMax}`,
          blackRange: `${blackMin}-${blackMax}`,
          noOverlap
        });
      }
    });

    // Sort by difference
    fieldComparison.sort((a, b) => parseFloat(b.diff) - parseFloat(a.diff));

    console.log('Top 20 fields with largest avg difference:');
    fieldComparison.slice(0, 20).forEach(f => {
      const overlapStr = f.noOverlap ? '*** NO OVERLAP ***' : '';
      console.log(`${f.field}: White=${f.whiteAvg} (${f.whiteRange}), Black=${f.blackAvg} (${f.blackRange}), Diff=${f.diff} ${overlapStr}`);
    });

    console.log('\n\nFields with NO OVERLAP between white and black:');
    const noOverlapFields = fieldComparison.filter(f => f.noOverlap);
    if (noOverlapFields.length > 0) {
      noOverlapFields.forEach(f => {
        console.log(`${f.field}: White=${f.whiteRange}, Black=${f.blackRange}`);
      });
    } else {
      console.log('None found - all fields have some overlap');
    }

  } else {
    console.log('\nNot enough known white/black generic players to compare');
  }

  // Step 7: Analyze PGHE distribution for players we know the race of
  console.log('\n\n=== PGHE VALUES BY RACE (Generic Face Players) ===\n');

  if (whiteGeneric.length > 0) {
    const whitePGHE = whiteGeneric.map(p => p.data.PGHE).sort((a, b) => a - b);
    console.log(`White players (${whiteGeneric.length}) PGHE values:`);
    console.log(`  Min: ${Math.min(...whitePGHE)}`);
    console.log(`  Max: ${Math.max(...whitePGHE)}`);
    console.log(`  Values: ${whitePGHE.slice(0, 30).join(', ')}${whitePGHE.length > 30 ? '...' : ''}`);
  }

  if (blackGeneric.length > 0) {
    const blackPGHE = blackGeneric.map(p => p.data.PGHE).sort((a, b) => a - b);
    console.log(`\nBlack players (${blackGeneric.length}) PGHE values:`);
    console.log(`  Min: ${Math.min(...blackPGHE)}`);
    console.log(`  Max: ${Math.max(...blackPGHE)}`);
    // Show distribution
    const pgheHist = {};
    blackPGHE.forEach(v => pgheHist[v] = (pgheHist[v] || 0) + 1);
    const sorted = Object.entries(pgheHist).sort((a, b) => parseInt(a[0]) - parseInt(b[0]));
    console.log(`  Distribution (first 30):`);
    sorted.slice(0, 30).forEach(([val, count]) => {
      console.log(`    PGHE ${val}: ${count} players`);
    });
  }

  // Step 8: Look at all players without known race and analyze PGHE patterns
  console.log('\n\n=== ANALYZING ALL GENERIC FACE PLAYERS (UNKNOWN RACE) ===\n');

  const unknownRace = playersWithoutRealPAM.filter(p => p.race === undefined);
  console.log(`Players with generic faces but unknown race: ${unknownRace.length}`);

  // Group by PGHE
  const pgheGroups = {};
  unknownRace.forEach(p => {
    const pghe = p.data.PGHE;
    if (!pgheGroups[pghe]) pgheGroups[pghe] = [];
    pgheGroups[pghe].push(p);
  });

  // Show PGHE distribution
  console.log(`\nPGHE value distribution:`);
  const sortedPGHE = Object.keys(pgheGroups).map(Number).sort((a, b) => a - b);
  sortedPGHE.forEach(pghe => {
    const players = pgheGroups[pghe];
    const sample = players.slice(0, 2).map(p => p.name).join(', ');
    console.log(`  PGHE ${pghe}: ${players.length} players (e.g., ${sample})`);
  });

  // Step 9: Dump full data for sample players from different PGHE ranges
  console.log('\n\n=== SAMPLE PLAYER DATA BY PGHE RANGE ===\n');

  // Pick some different PGHE values to examine
  const samplePGHEs = [7, 50, 141, 209, 287]; // From user's mapping
  for (const targetPGHE of samplePGHEs) {
    const players = [...playersWithoutRealPAM, ...playersWithRealPAM].filter(p => p.data.PGHE === targetPGHE);
    if (players.length > 0) {
      const p = players[0];
      console.log(`--- PGHE ${targetPGHE}: ${p.name} (PID ${p.pid}) ---`);
      console.log(`  PEPS (PAM): "${p.data.PEPS}"`);
      console.log(`  PSKI: ${p.data.PSKI}`);
      console.log(`  PLPL: ${p.data.PLPL}`);
      console.log(`  PCBT (Body): ${p.data.PCBT}`);
      console.log(`  PLHT: ${p.data.PLHT}`);
      console.log(`  Known Race: ${p.race === 1 ? 'White' : p.race === 7 ? 'Black' : p.race === 5 ? 'Mixed' : 'Unknown'}`);
      console.log('');
    } else {
      console.log(`No players found with PGHE ${targetPGHE}`);
    }
  }
}

findHeadNumber().catch(console.error);
