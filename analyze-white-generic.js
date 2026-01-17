/**
 * Analyze the 2 white generic face players found in the official roster
 * Compare them to black players to find the race-determining field
 */

const path = require('path');
const fs = require('fs');

async function analyze() {
  const MaddenRosterHelper = require('./src/main/lib/helpers/MaddenRosterHelper');

  // Load PID mapping
  const mappingPath = path.join(__dirname, 'data/lookups/PID_Portrait_Mapping.csv');
  const mappingContent = fs.readFileSync(mappingPath, 'utf-8');
  const mappingLines = mappingContent.trim().split('\n');

  const pidsWithRealPAM = new Set();
  const pidToRace = new Map();

  for (let i = 1; i < mappingLines.length; i++) {
    const values = mappingLines[i].split(',');
    const pid = parseInt(values[0]);
    const pam = values[4];
    const race = parseInt(values[5]);

    pidToRace.set(pid, race);
    if (pam && pam !== '' && pam !== '0') {
      pidsWithRealPAM.add(pid);
    }
  }

  // Load roster
  const rosterPath = 'C:/Users/tshan/Documents/Dev/madden-editor-suite/data/templates/ROSTER-Official';
  const helper = new MaddenRosterHelper();
  const file = await helper.load(rosterPath);
  const playerTable = file.PLAY;

  // Find white and black generic players
  const whiteGeneric = [];
  const blackGeneric = [];

  for (const record of playerTable.records) {
    const playerData = {};
    for (const fieldName in record.fields) {
      playerData[fieldName] = record.fields[fieldName].value;
    }

    const pid = playerData.PSXP;
    const race = pidToRace.get(pid);

    // Only include if NOT having real PAM (generic face)
    if (!pidsWithRealPAM.has(pid) && race !== undefined) {
      if (race === 1) {
        whiteGeneric.push({ pid, name: `${playerData.PFNA} ${playerData.PLNA}`, data: playerData });
      } else if (race === 7) {
        blackGeneric.push({ pid, name: `${playerData.PFNA} ${playerData.PLNA}`, data: playerData });
      }
    }
  }

  console.log(`Found ${whiteGeneric.length} white generic players`);
  console.log(`Found ${blackGeneric.length} black generic players`);

  // Dump COMPLETE data for white players
  console.log('\n\n========== WHITE GENERIC PLAYERS - COMPLETE DATA ==========\n');

  whiteGeneric.forEach(player => {
    console.log(`\n--- ${player.name} (PID ${player.pid}) ---\n`);

    const fields = Object.keys(player.data).sort();
    fields.forEach(field => {
      const value = player.data[field];
      // Show all numeric fields and short strings
      if (typeof value === 'number') {
        console.log(`${field}: ${value}`);
      } else if (typeof value === 'string' && value.length < 100) {
        console.log(`${field}: "${value}"`);
      }
    });
  });

  // Pick 2 random black players for comparison
  console.log('\n\n========== COMPARISON BLACK PLAYERS - COMPLETE DATA ==========\n');

  const sampleBlack = blackGeneric.slice(0, 2);
  sampleBlack.forEach(player => {
    console.log(`\n--- ${player.name} (PID ${player.pid}) ---\n`);

    const fields = Object.keys(player.data).sort();
    fields.forEach(field => {
      const value = player.data[field];
      if (typeof value === 'number') {
        console.log(`${field}: ${value}`);
      } else if (typeof value === 'string' && value.length < 100) {
        console.log(`${field}: "${value}"`);
      }
    });
  });

  // Direct field-by-field comparison
  console.log('\n\n========== DIRECT FIELD COMPARISON ==========\n');

  if (whiteGeneric.length > 0 && blackGeneric.length > 0) {
    const white1 = whiteGeneric[0];
    const black1 = blackGeneric[0];

    const fields = Object.keys(white1.data).sort();
    console.log(`Comparing: ${white1.name} (WHITE) vs ${black1.name} (BLACK)\n`);
    console.log('Fields where values differ (numeric only < 1000):\n');

    fields.forEach(field => {
      const wVal = white1.data[field];
      const bVal = black1.data[field];

      if (wVal !== bVal && typeof wVal === 'number' && typeof bVal === 'number') {
        if (wVal < 1000 && bVal < 1000) {
          console.log(`${field}: WHITE=${wVal}, BLACK=${bVal}`);
        }
      }
    });
  }

  // Check which PIDs the white players have
  console.log('\n\n========== WHITE PLAYER PID INFO ==========\n');
  whiteGeneric.forEach(p => {
    console.log(`PID ${p.pid}: ${p.name}`);
    // Check what the mapping says
    for (let i = 1; i < mappingLines.length; i++) {
      const values = mappingLines[i].split(',');
      if (parseInt(values[0]) === p.pid) {
        console.log(`  Mapping: ${values.join(', ')}`);
        break;
      }
    }
  });
}

analyze().catch(console.error);
