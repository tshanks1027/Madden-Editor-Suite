/**
 * Check for binary fields or combined fields that could produce 3-digit face numbers
 */

const path = require('path');
const fs = require('fs');

async function check() {
  const MaddenRosterHelper = require('./src/main/lib/helpers/MaddenRosterHelper');

  // Load PID mapping
  const mappingPath = path.join(__dirname, 'data/lookups/PID_Portrait_Mapping.csv');
  const mappingContent = fs.readFileSync(mappingPath, 'utf-8');
  const mappingLines = mappingContent.trim().split('\n');

  const pidsWithRealPAM = new Set();
  for (let i = 1; i < mappingLines.length; i++) {
    const values = mappingLines[i].split(',');
    const pid = parseInt(values[0]);
    const pam = values[4];
    if (pam && pam !== '' && pam !== '0') {
      pidsWithRealPAM.add(pid);
    }
  }

  // Load roster
  const rosterPath = 'C:/Users/tshan/Documents/Dev/madden-editor-suite/data/templates/ROSTER-Official';
  const helper = new MaddenRosterHelper();
  const file = await helper.load(rosterPath);
  const playerTable = file.PLAY;

  // Get first player without real PAM to examine all fields
  let samplePlayer = null;
  for (const record of playerTable.records) {
    const pid = record.fields['PSXP']?.value;
    if (!pidsWithRealPAM.has(pid)) {
      samplePlayer = record;
      break;
    }
  }

  console.log('=== ALL FIELDS AND THEIR TYPES ===\n');

  const fieldInfo = [];
  for (const fieldName in samplePlayer.fields) {
    const field = samplePlayer.fields[fieldName];
    const value = field.value;
    const type = typeof value;

    fieldInfo.push({
      name: fieldName,
      value: value,
      type: type,
      fieldType: field.constructor?.name || 'unknown'
    });
  }

  // Sort by name
  fieldInfo.sort((a, b) => a.name.localeCompare(b.name));

  fieldInfo.forEach(f => {
    console.log(`${f.name}: ${f.value} (${f.type}, ${f.fieldType})`);
  });

  // Now look at potential binary/small value fields
  console.log('\n\n=== SMALL VALUE FIELDS (0-10) ===\n');

  const smallFields = fieldInfo.filter(f => typeof f.value === 'number' && f.value >= 0 && f.value <= 10);
  smallFields.forEach(f => {
    console.log(`${f.name}: ${f.value}`);
  });

  // Check for fields that could be bit flags (powers of 2)
  console.log('\n\n=== POTENTIAL BIT FLAG FIELDS ===\n');

  const bitFlags = fieldInfo.filter(f => {
    if (typeof f.value !== 'number') return false;
    const v = f.value;
    return v === 0 || v === 1 || v === 2 || v === 4 || v === 8 || v === 16 || v === 32 || v === 64 || v === 128 || v === 256;
  });
  bitFlags.forEach(f => {
    console.log(`${f.name}: ${f.value}`);
  });

  // Scan multiple players and look for fields with values 100-264 specifically
  console.log('\n\n=== FIELDS WITH VALUES 100-264 (potential face numbers) ===\n');

  const fieldsIn100To264 = {};
  let count = 0;

  for (const record of playerTable.records) {
    const pid = record.fields['PSXP']?.value;
    if (pidsWithRealPAM.has(pid)) continue;

    count++;
    for (const fieldName in record.fields) {
      const value = record.fields[fieldName].value;
      if (typeof value === 'number' && value >= 100 && value <= 264) {
        if (!fieldsIn100To264[fieldName]) {
          fieldsIn100To264[fieldName] = new Set();
        }
        fieldsIn100To264[fieldName].add(value);
      }
    }
  }

  console.log(`Scanned ${count} players without real PAMs\n`);

  Object.entries(fieldsIn100To264)
    .sort((a, b) => b[1].size - a[1].size)
    .forEach(([field, values]) => {
      const arr = [...values].sort((a, b) => a - b);
      console.log(`${field}: ${arr.length} unique values in 100-264 range`);
      console.log(`  Values: ${arr.slice(0, 20).join(', ')}${arr.length > 20 ? '...' : ''}`);
    });

  // Check string fields for patterns
  console.log('\n\n=== STRING FIELDS ===\n');

  const stringFields = fieldInfo.filter(f => typeof f.value === 'string');
  stringFields.forEach(f => {
    console.log(`${f.name}: "${f.value}"`);
  });

  // Check for any field combinations that could make 1-264
  console.log('\n\n=== CHECKING FIELD COMBINATIONS ===\n');

  // Get a few players and see if any combo of small fields = 1-264
  const players = [];
  for (const record of playerTable.records) {
    const pid = record.fields['PSXP']?.value;
    if (!pidsWithRealPAM.has(pid)) {
      const data = {};
      for (const fieldName in record.fields) {
        data[fieldName] = record.fields[fieldName].value;
      }
      data._name = `${data.PFNA} ${data.PLNA}`;
      players.push(data);
      if (players.length >= 10) break;
    }
  }

  // Show PCBT, PSKI, PGHE, PLPL combinations
  console.log('Sample players - appearance-related fields:');
  players.forEach(p => {
    console.log(`${p._name}:`);
    console.log(`  PCBT=${p.PCBT}, PSKI=${p.PSKI}, PGHE=${p.PGHE}, PLPL=${p.PLPL}, PLHT=${p.PLHT}`);
    // Try some combinations
    console.log(`  PCBT*100 + PSKI = ${p.PCBT * 100 + p.PSKI}`);
    console.log(`  PGHE % 264 = ${p.PGHE % 264}`);
    console.log(`  PGHE - 200 = ${p.PGHE - 200}`);
  });
}

check().catch(console.error);
