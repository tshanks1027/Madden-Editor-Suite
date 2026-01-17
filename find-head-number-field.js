/**
 * Find where the in-game head number (001-264) is stored in player data
 *
 * Approach:
 * 1. Load PID_Portrait_Mapping.csv to find players WITHOUT real PAMs
 * 2. Load official roster and find those players
 * 3. Dump ALL their numeric fields looking for values 1-264
 * 4. Cross-reference with user's PGHE→Head mapping:
 *    PGHE 287 → Head 001
 *    PGHE 209 → Head 134
 *    PGHE 7 → Head 083
 *    PGHE 141 → Head 007
 *    PGHE 11 → Head 148
 *    PGHE 50 → Head 031
 */

const path = require('path');
const fs = require('fs');

async function findHeadNumberField() {
  const MaddenRosterHelper = require('./src/main/lib/helpers/MaddenRosterHelper');

  // Step 1: Load PID_Portrait_Mapping.csv to find players without real PAMs
  console.log('=== LOADING PID PORTRAIT MAPPING ===\n');
  const mappingPath = path.join(__dirname, 'data/lookups/PID_Portrait_Mapping.csv');
  const mappingContent = fs.readFileSync(mappingPath, 'utf-8');
  const mappingLines = mappingContent.trim().split('\n');
  const headers = mappingLines[0].split(',');

  // Find PIDs with empty or "0" PAM (no real face scan)
  const pidsWithoutPAM = [];
  for (let i = 1; i < mappingLines.length; i++) {
    const values = mappingLines[i].split(',');
    const pid = parseInt(values[0]);
    const playerName = values[1];
    const pam = values[4]; // PAM column
    const race = parseInt(values[5]); // Race column

    // If PAM is empty or "0", they don't have a real face scan
    if (!pam || pam === '' || pam === '0') {
      pidsWithoutPAM.push({ pid, playerName, race });
    }
  }

  console.log(`Found ${pidsWithoutPAM.length} players without real PAMs\n`);
  console.log('Sample players without PAMs:');
  pidsWithoutPAM.slice(0, 10).forEach(p => {
    const raceStr = p.race === 1 ? 'White' : p.race === 7 ? 'Black' : p.race === 5 ? 'Mixed' : p.race;
    console.log(`  PID ${p.pid}: ${p.playerName} (Race: ${raceStr})`);
  });

  // Step 2: Load official roster
  console.log('\n=== LOADING OFFICIAL ROSTER ===\n');
  const rosterPath = 'C:/Users/tshan/Documents/Dev/madden-editor-suite/data/templates/ROSTER-Official';
  const helper = new MaddenRosterHelper();
  const file = await helper.load(rosterPath);
  const playerTable = file.PLAY;

  console.log(`Roster has ${playerTable.records.length} players\n`);

  // Step 3: Find players from our list in the roster
  console.log('=== SEARCHING FOR PLAYERS WITHOUT PAMS IN ROSTER ===\n');

  const foundPlayers = [];
  const pidSet = new Set(pidsWithoutPAM.map(p => p.pid));

  for (const record of playerTable.records) {
    const psxp = record.fields['PSXP']?.value;
    if (pidSet.has(psxp)) {
      const playerInfo = pidsWithoutPAM.find(p => p.pid === psxp);
      const playerData = {};

      // Extract ALL field values
      for (const fieldName in record.fields) {
        playerData[fieldName] = record.fields[fieldName].value;
      }

      foundPlayers.push({
        pid: psxp,
        name: playerInfo.playerName,
        race: playerInfo.race,
        rosterName: `${playerData.PFNA} ${playerData.PLNA}`,
        data: playerData
      });
    }
  }

  console.log(`Found ${foundPlayers.length} players from our list in roster\n`);

  // Step 4: Analyze fields looking for values 1-264
  console.log('=== ANALYZING FIELDS FOR HEAD NUMBER (1-264) ===\n');

  // For each player, find numeric fields with values 1-264
  foundPlayers.slice(0, 20).forEach(player => {
    const raceStr = player.race === 1 ? 'White' : player.race === 7 ? 'Black' : player.race === 5 ? 'Mixed' : player.race;
    console.log(`\n--- ${player.rosterName} (PID ${player.pid}, ${raceStr}) ---`);

    const fieldsIn1To264 = [];
    for (const fieldName in player.data) {
      const value = player.data[fieldName];
      if (typeof value === 'number' && value >= 1 && value <= 264) {
        fieldsIn1To264.push({ field: fieldName, value });
      }
    }

    // Sort by value
    fieldsIn1To264.sort((a, b) => a.value - b.value);

    console.log('Fields with values 1-264:');
    fieldsIn1To264.forEach(f => {
      console.log(`  ${f.field}: ${f.value}`);
    });

    // Specifically check PGHE
    console.log(`  PGHE: ${player.data.PGHE}`);
    console.log(`  PEPS (PAM): "${player.data.PEPS}"`);
    console.log(`  PSKI: ${player.data.PSKI}`);
  });

  // Step 5: Group by race and compare fields
  console.log('\n\n=== COMPARING WHITE VS BLACK PLAYERS ===\n');

  const whitePlayers = foundPlayers.filter(p => p.race === 1);
  const blackPlayers = foundPlayers.filter(p => p.race === 7);

  console.log(`White players (Race=1): ${whitePlayers.length}`);
  console.log(`Black players (Race=7): ${blackPlayers.length}`);

  // Find fields that might differ by race
  const fieldsToCompare = ['PGHE', 'PSKI', 'PLPL', 'PCBT', 'PLHT', 'PLTY'];

  console.log('\nField value distributions:');
  fieldsToCompare.forEach(field => {
    const whiteValues = {};
    const blackValues = {};

    whitePlayers.forEach(p => {
      const v = p.data[field];
      whiteValues[v] = (whiteValues[v] || 0) + 1;
    });

    blackPlayers.forEach(p => {
      const v = p.data[field];
      blackValues[v] = (blackValues[v] || 0) + 1;
    });

    console.log(`\n${field}:`);
    console.log(`  White: ${JSON.stringify(whiteValues)}`);
    console.log(`  Black: ${JSON.stringify(blackValues)}`);
  });

  // Step 6: Look for any field that correlates with race
  console.log('\n\n=== SEARCHING FOR RACE-CORRELATED FIELDS ===\n');

  // Get all field names from first player
  const allFields = Object.keys(foundPlayers[0].data);
  const correlatedFields = [];

  allFields.forEach(field => {
    const whiteValues = new Set();
    const blackValues = new Set();

    whitePlayers.slice(0, 50).forEach(p => {
      const v = p.data[field];
      if (typeof v === 'number') whiteValues.add(v);
    });

    blackPlayers.slice(0, 50).forEach(p => {
      const v = p.data[field];
      if (typeof v === 'number') blackValues.add(v);
    });

    // Check if there's ANY overlap
    const overlap = [...whiteValues].filter(v => blackValues.has(v));

    // If sets don't overlap at all, this field might correlate with race
    if (whiteValues.size > 0 && blackValues.size > 0 && overlap.length === 0) {
      correlatedFields.push({
        field,
        whiteRange: `${Math.min(...whiteValues)}-${Math.max(...whiteValues)}`,
        blackRange: `${Math.min(...blackValues)}-${Math.max(...blackValues)}`
      });
    }
  });

  if (correlatedFields.length > 0) {
    console.log('Fields with NO overlap between white/black players:');
    correlatedFields.forEach(f => {
      console.log(`  ${f.field}: White=${f.whiteRange}, Black=${f.blackRange}`);
    });
  } else {
    console.log('No fields found with complete race separation');
  }

  // Step 7: Dump complete data for Howie Long and Marcus Allen
  console.log('\n\n=== COMPLETE DATA FOR HOWIE LONG (PID 8, White) ===\n');
  const howie = foundPlayers.find(p => p.pid === 8);
  if (howie) {
    const sortedFields = Object.keys(howie.data).sort();
    sortedFields.forEach(field => {
      const v = howie.data[field];
      if (typeof v === 'number' || (typeof v === 'string' && v.length < 50)) {
        console.log(`${field}: ${v}`);
      }
    });
  }

  console.log('\n\n=== COMPLETE DATA FOR MARCUS ALLEN (PID 24, Black) ===\n');
  const marcus = foundPlayers.find(p => p.pid === 24);
  if (marcus) {
    const sortedFields = Object.keys(marcus.data).sort();
    sortedFields.forEach(field => {
      const v = marcus.data[field];
      if (typeof v === 'number' || (typeof v === 'string' && v.length < 50)) {
        console.log(`${field}: ${v}`);
      }
    });
  }

  // Step 8: Compare differences between Howie and Marcus
  console.log('\n\n=== FIELD DIFFERENCES: HOWIE LONG vs MARCUS ALLEN ===\n');
  if (howie && marcus) {
    const fields = Object.keys(howie.data).sort();
    fields.forEach(field => {
      const hVal = howie.data[field];
      const mVal = marcus.data[field];
      if (hVal !== mVal && typeof hVal === 'number' && typeof mVal === 'number') {
        // Only show small numeric differences
        if (hVal < 1000 && mVal < 1000) {
          console.log(`${field}: Howie=${hVal}, Marcus=${mVal}`);
        }
      }
    });
  }
}

findHeadNumberField().catch(console.error);
