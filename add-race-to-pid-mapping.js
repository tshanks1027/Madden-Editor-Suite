const fs = require('fs');
const Papa = require('papaparse');

// Load ALL_PLAYER_LOOKUP.csv for race data
const allPlayerPath = './data/lookups/ALL_PLAYER_LOOKUP.csv';
const pidMappingPath = './data/lookups/PID_Portrait_Mapping.csv';

const allPlayerContent = fs.readFileSync(allPlayerPath, 'utf8');
const allPlayerParsed = Papa.parse(allPlayerContent, { header: true, skipEmptyLines: true });

// Build name -> race lookup from ALL_PLAYER_LOOKUP
const nameToRace = new Map();
for (const row of allPlayerParsed.data) {
  const firstName = (row['First Name'] || '').trim();
  const lastName = (row['Last Name'] || '').trim();
  const race = (row['Race'] || '').trim();

  if (firstName && lastName && race) {
    const key = `${firstName} ${lastName}`.toLowerCase();
    nameToRace.set(key, race);
  }
}

console.log(`Loaded ${nameToRace.size} name->race mappings from ALL_PLAYER_LOOKUP.csv`);

// Load PID_Portrait_Mapping.csv
const pidContent = fs.readFileSync(pidMappingPath, 'utf8');
const pidParsed = Papa.parse(pidContent, { header: true, skipEmptyLines: true });

// Add Race column
let raceAdded = 0;
let raceMissing = 0;
const missingNames = [];

for (const row of pidParsed.data) {
  const playerName = (row['Player Name'] || '').trim();

  // Try to find race from ALL_PLAYER_LOOKUP
  const nameLower = playerName.toLowerCase()
    .replace(' (r)', '')  // Remove (R) suffix
    .replace(' (l)', '');  // Remove (L) suffix

  let race = nameToRace.get(nameLower);

  // If not found, try reversing first/last name
  if (!race) {
    const parts = nameLower.split(' ');
    if (parts.length >= 2) {
      const reversed = `${parts[parts.length - 1]} ${parts.slice(0, -1).join(' ')}`;
      race = nameToRace.get(reversed);
    }
  }

  if (race) {
    row['Race'] = race;
    raceAdded++;
  } else {
    // Default based on NFL demographics and common knowledge for legends
    // This is imperfect but better than nothing
    row['Race'] = '7'; // Default to black (70% of NFL)
    raceMissing++;
    if (row['Type'] === 'legend') {
      missingNames.push(playerName);
    }
  }
}

console.log(`Added race for ${raceAdded} players`);
console.log(`Defaulted race for ${raceMissing} players`);
console.log(`\nLegends missing race data (will default to black):`);
missingNames.slice(0, 50).forEach(name => console.log(`  - ${name}`));

// Write back to CSV
const output = Papa.unparse(pidParsed.data, { header: true });
fs.writeFileSync(pidMappingPath, output, 'utf8');
console.log(`\nSaved updated PID_Portrait_Mapping.csv with Race column`);
