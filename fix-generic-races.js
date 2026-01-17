const fs = require('fs');
const Papa = require('papaparse');

const pidMappingPath = './data/lookups/PID_Portrait_Mapping.csv';

// Load PID_Portrait_Mapping.csv
const pidContent = fs.readFileSync(pidMappingPath, 'utf8');
const pidParsed = Papa.parse(pidContent, { header: true, skipEmptyLines: true });

let genericFixed = 0;
let genericUnfixed = 0;

// Map skin tone (1-7) to race code
// Skin tone 1-2 = Race 1 (Caucasian)
// Skin tone 3-4 = Race 5 (Hispanic/mixed)
// Skin tone 5-7 = Race 7 (Black)
function skinToneToRace(skinTone) {
  if (skinTone <= 2) return 1; // White
  if (skinTone <= 4) return 5; // Hispanic/mixed
  return 7; // Black
}

for (const row of pidParsed.data) {
  const type = row.Type || '';
  const portrait = row.Portrait || '';

  // Only fix generics - legends/players need manual assignment
  if (type === 'generic' && portrait.startsWith('plpo_generic_')) {
    // Extract skin tone from portrait name: plpo_generic_X_Y_Z_NNN where X is skin tone
    const headName = portrait.substring('plpo_generic_'.length);
    const firstChar = headName.charAt(0);
    const skinTone = parseInt(firstChar);

    if (!isNaN(skinTone) && skinTone >= 1 && skinTone <= 7) {
      const race = skinToneToRace(skinTone);
      row.Race = String(race);
      genericFixed++;
    } else {
      genericUnfixed++;
    }
  }
}

console.log(`=== GENERIC FACES FIXED ===`);
console.log(`Fixed: ${genericFixed}`);
console.log(`Could not fix: ${genericUnfixed}`);

// Write back
const output = Papa.unparse(pidParsed.data, { header: true });
fs.writeFileSync(pidMappingPath, output, 'utf8');
console.log(`\nSaved updated PID_Portrait_Mapping.csv`);

// Now count remaining issues
console.log(`\n=== REMAINING RACE DISTRIBUTION ===`);
const raceCount = {};
for (const row of pidParsed.data) {
  const race = row.Race || 'EMPTY';
  raceCount[race] = (raceCount[race] || 0) + 1;
}
Object.entries(raceCount).sort((a, b) => b[1] - a[1]).forEach(([race, count]) => {
  console.log(`  Race ${race}: ${count}`);
});

// Show legends/players still at Race=7 (may need review)
const legendsStillBlack = pidParsed.data.filter(r =>
  (r.Type === 'legend' || r.Type === 'player') && r.Race === '7'
);
console.log(`\n=== LEGENDS/PLAYERS STILL RACE=7 (${legendsStillBlack.length}) ===`);
console.log(`(These default to black - most are correct, but some white players may need fixing)`);
