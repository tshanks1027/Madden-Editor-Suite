/**
 * Scan entire roster - find players without real PAMs
 * Look for face number (001-264) in their data
 */

const path = require('path');
const fs = require('fs');

async function scan() {
  const MaddenRosterHelper = require('./src/main/lib/helpers/MaddenRosterHelper');

  // Load PID mapping - get PIDs with REAL PAMs
  const mappingPath = path.join(__dirname, 'data/lookups/PID_Portrait_Mapping.csv');
  const mappingContent = fs.readFileSync(mappingPath, 'utf-8');
  const mappingLines = mappingContent.trim().split('\n');

  const pidsWithRealPAM = new Set();
  for (let i = 1; i < mappingLines.length; i++) {
    const values = mappingLines[i].split(',');
    const pid = parseInt(values[0]);
    const pam = values[4]; // PAM column

    // Only PIDs with actual PAM strings (not empty, not "0")
    if (pam && pam !== '' && pam !== '0') {
      pidsWithRealPAM.add(pid);
    }
  }

  console.log(`PIDs with real PAMs in mapping: ${pidsWithRealPAM.size}`);

  // Load roster
  const rosterPath = 'C:/Users/tshan/Documents/Dev/madden-editor-suite/data/templates/ROSTER-Official';
  const helper = new MaddenRosterHelper();
  const file = await helper.load(rosterPath);
  const playerTable = file.PLAY;

  console.log(`Total players in roster: ${playerTable.records.length}`);

  // Find players without real PAMs
  const playersWithoutRealPAM = [];

  for (const record of playerTable.records) {
    const playerData = {};
    for (const fieldName in record.fields) {
      playerData[fieldName] = record.fields[fieldName].value;
    }

    const pid = playerData.PSXP;

    // If PID is NOT in our real PAM set, they don't have a face scan
    if (!pidsWithRealPAM.has(pid)) {
      playersWithoutRealPAM.push({
        pid: pid,
        name: `${playerData.PFNA} ${playerData.PLNA}`,
        data: playerData
      });
    }
  }

  console.log(`Players WITHOUT real PAMs: ${playersWithoutRealPAM.length}\n`);

  // For each player, find ALL numeric fields with values 1-264
  console.log('=== SEARCHING FOR FACE NUMBER (1-264) IN PLAYER DATA ===\n');

  // Count how often each field has values in 1-264 range
  const fieldValueCounts = {};

  // Also group by field+value to see patterns
  const fieldValuePlayers = {};

  playersWithoutRealPAM.forEach(player => {
    for (const field in player.data) {
      const value = player.data[field];
      if (typeof value === 'number' && value >= 1 && value <= 264) {
        if (!fieldValueCounts[field]) fieldValueCounts[field] = 0;
        fieldValueCounts[field]++;

        const key = `${field}:${value}`;
        if (!fieldValuePlayers[key]) fieldValuePlayers[key] = [];
        if (fieldValuePlayers[key].length < 3) {
          fieldValuePlayers[key].push(player.name);
        }
      }
    }
  });

  // Sort fields by how many players have values in 1-264 range
  const sortedFields = Object.entries(fieldValueCounts)
    .sort((a, b) => b[1] - a[1]);

  console.log('Fields most commonly containing values 1-264:');
  sortedFields.slice(0, 30).forEach(([field, count]) => {
    console.log(`  ${field}: ${count} players`);
  });

  // Focus on fields that are ALWAYS in the 1-264 range for ALL players
  console.log('\n\n=== FIELDS ALWAYS IN 1-264 RANGE ===\n');

  const alwaysInRange = sortedFields.filter(([field, count]) =>
    count === playersWithoutRealPAM.length
  );

  if (alwaysInRange.length > 0) {
    console.log('Fields where ALL players have values 1-264:');
    alwaysInRange.forEach(([field, count]) => {
      // Get unique values for this field
      const uniqueVals = new Set();
      playersWithoutRealPAM.forEach(p => uniqueVals.add(p.data[field]));
      console.log(`  ${field}: ${uniqueVals.size} unique values (min: ${Math.min(...uniqueVals)}, max: ${Math.max(...uniqueVals)})`);
    });
  }

  // Show PGHE distribution
  console.log('\n\n=== PGHE VALUE DISTRIBUTION ===\n');

  const pgheValues = {};
  playersWithoutRealPAM.forEach(p => {
    const pghe = p.data.PGHE;
    if (!pgheValues[pghe]) pgheValues[pghe] = [];
    pgheValues[pghe].push(p.name);
  });

  const sortedPGHE = Object.keys(pgheValues).map(Number).sort((a, b) => a - b);
  console.log(`PGHE range: ${Math.min(...sortedPGHE)} - ${Math.max(...sortedPGHE)}`);
  console.log(`Unique PGHE values: ${sortedPGHE.length}`);

  console.log('\nPGHE values (first 50):');
  sortedPGHE.slice(0, 50).forEach(pghe => {
    const players = pgheValues[pghe];
    console.log(`  PGHE ${pghe}: ${players.length} players - ${players.slice(0, 2).join(', ')}`);
  });

  // Check if any field has EXACTLY 264 unique values (matching face count)
  console.log('\n\n=== FIELDS WITH UNIQUE VALUE COUNTS NEAR 264 ===\n');

  const fieldUniqueCounts = {};
  sortedFields.forEach(([field]) => {
    const uniqueVals = new Set();
    playersWithoutRealPAM.forEach(p => {
      const v = p.data[field];
      if (v >= 1 && v <= 264) uniqueVals.add(v);
    });
    fieldUniqueCounts[field] = uniqueVals.size;
  });

  // Sort by closest to 264
  const byUniqueCount = Object.entries(fieldUniqueCounts)
    .sort((a, b) => Math.abs(264 - b[1]) - Math.abs(264 - a[1]));

  byUniqueCount.slice(0, 20).forEach(([field, count]) => {
    console.log(`${field}: ${count} unique values in 1-264 range`);
  });

  // Dump sample of different PGHE values
  console.log('\n\n=== SAMPLE PLAYERS BY PGHE ===\n');

  // Pick various PGHE values to sample
  const samplePGHEs = [1, 7, 11, 50, 100, 141, 200, 209, 264, 287];
  samplePGHEs.forEach(targetPGHE => {
    const player = playersWithoutRealPAM.find(p => p.data.PGHE === targetPGHE);
    if (player) {
      console.log(`PGHE ${targetPGHE}: ${player.name}`);
      // Show all fields 1-264
      const fieldsInRange = [];
      for (const field in player.data) {
        const v = player.data[field];
        if (typeof v === 'number' && v >= 1 && v <= 264) {
          fieldsInRange.push(`${field}=${v}`);
        }
      }
      console.log(`  Fields 1-264: ${fieldsInRange.join(', ')}`);
      console.log('');
    }
  });
}

scan().catch(console.error);
