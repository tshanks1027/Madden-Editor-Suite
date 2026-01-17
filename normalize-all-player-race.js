const fs = require('fs');
const Papa = require('papaparse');

// Load ALL_PLAYER_LOOKUP.csv
const allPlayerPath = './data/lookups/ALL_PLAYER_LOOKUP.csv';
const allPlayerContent = fs.readFileSync(allPlayerPath, 'utf8');
const allPlayerParsed = Papa.parse(allPlayerContent, { header: true, skipEmptyLines: true });

// Load PID_Portrait_Mapping.csv to get race data for matched PIDs
const pidMappingPath = './data/lookups/PID_Portrait_Mapping.csv';
const pidContent = fs.readFileSync(pidMappingPath, 'utf8');
const pidParsed = Papa.parse(pidContent, { header: true, skipEmptyLines: true });

// Build PID -> Race mapping from PID_Portrait_Mapping.csv
const pidToRace = new Map();
for (const row of pidParsed.data) {
  const pid = parseInt(row.PID);
  const race = row.Race;
  if (!isNaN(pid) && race) {
    pidToRace.set(pid, race);
  }
}
console.log(`Loaded ${pidToRace.size} PID->Race mappings`);

// Build name -> race mapping from PID_Portrait_Mapping.csv (for name-based lookup)
const nameToRace = new Map();
for (const row of pidParsed.data) {
  const name = (row['Player Name'] || '').trim().toLowerCase();
  const race = row.Race;
  if (name && race && race !== '7') { // Only store non-default race values
    nameToRace.set(name, race);
  }
}
console.log(`Loaded ${nameToRace.size} name->race mappings (non-default)`);

// Convert text race to numeric code
function textToNumericRace(textRace) {
  if (!textRace) return '';
  const normalized = textRace.toString().trim().toLowerCase();
  switch (normalized) {
    case 'white':
    case 'caucasian':
    case 'light':
      return '1';
    case 'hispanic':
    case 'latino':
    case 'pacific islander':
      return '5';
    case 'mixed':
    case 'multiracial':
      return '6';
    case 'black':
    case 'african american':
    case '7':
      return '7';
    case 'asian':
      return '1'; // Map Asian to similar skin tone
    case '1':
    case '5':
    case '6':
      return normalized;
    default:
      return '';
  }
}

let normalizedCount = 0;
let pidMatchCount = 0;
let nameMatchCount = 0;
let unchangedCount = 0;

for (const row of allPlayerParsed.data) {
  const firstName = (row['First Name'] || '').trim();
  const lastName = (row['Last Name'] || '').trim();
  const fullName = `${firstName} ${lastName}`.toLowerCase();
  const photoId = parseInt(row.PhotoID);
  const currentRace = (row.Race || '').trim();

  // First try to normalize existing text race value
  if (currentRace && !['1', '5', '6', '7'].includes(currentRace)) {
    const numeric = textToNumericRace(currentRace);
    if (numeric) {
      row.Race = numeric;
      normalizedCount++;
      continue;
    }
  }

  // If no race, try to get from PID mapping
  if (!currentRace || currentRace === '') {
    // Try PhotoID first
    if (!isNaN(photoId) && photoId > 0 && pidToRace.has(photoId)) {
      row.Race = pidToRace.get(photoId);
      pidMatchCount++;
      continue;
    }

    // Try name match
    if (nameToRace.has(fullName)) {
      row.Race = nameToRace.get(fullName);
      nameMatchCount++;
      continue;
    }
  }

  unchangedCount++;
}

console.log('');
console.log('=== RESULTS ===');
console.log(`Text->Numeric normalized: ${normalizedCount}`);
console.log(`PID-matched: ${pidMatchCount}`);
console.log(`Name-matched: ${nameMatchCount}`);
console.log(`Unchanged (no match): ${unchangedCount}`);

// Write back
const output = Papa.unparse(allPlayerParsed.data, { header: true });
fs.writeFileSync(allPlayerPath, output, 'utf8');
console.log(`\nSaved updated ALL_PLAYER_LOOKUP.csv`);

// Show new race distribution
console.log('\n=== NEW RACE DISTRIBUTION ===');
const raceCount = {};
for (const row of allPlayerParsed.data) {
  const race = row.Race || 'EMPTY';
  raceCount[race] = (raceCount[race] || 0) + 1;
}
Object.entries(raceCount).sort((a, b) => b[1] - a[1]).forEach(([race, count]) => {
  console.log(`  ${race}: ${count}`);
});
