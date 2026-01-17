/**
 * Update PID_Portrait_Mapping.csv to use correct race-based PAMs
 *
 * PLPO to PAM mapping based on skin tone:
 * - generic_1_*, generic_2_* (Sheet 0-1) = WHITE -> gen_X_M_* or gen_X_T_*
 * - generic_3_*, generic_4_*, generic_5_*, generic_6_* (Sheet 2-4) = MIXED -> gen_X_H_*
 * - generic_7_* (Sheet 5-6) = BLACK -> gen_X_B_*
 */

const fs = require('fs');

// Load PAM race mapping
const pamMapping = JSON.parse(fs.readFileSync('./data/lookups/pam-race-mapping.json'));

// Define which PLPO generations map to which skin tone
function getSkinToneForPLPO(plpo) {
  // Extract generation number from PLPO like plpo_generic_1_001 or plpo_generic_2_M_B_01
  const match = plpo.match(/generic_(\d+)/);
  if (!match) return null;

  const gen = parseInt(match[1]);

  // Sheet mapping based on portrait-atlas.json analysis:
  // Gen 1-2 = Sheet 0-1 = WHITE
  // Gen 3-6 = Sheet 2-4 = MIXED/HISPANIC
  // Gen 7 = Sheet 5-6 = BLACK
  if (gen <= 2) return 'white';
  if (gen <= 6) return 'hispanic';
  return 'black';
}

// Get a PAM for a given skin tone and generation
function getPamForSkinTone(skinTone, preferGen) {
  let pams;
  if (skinTone === 'white') {
    pams = pamMapping.white;
  } else if (skinTone === 'hispanic') {
    pams = pamMapping.hispanic;
  } else {
    pams = pamMapping.black;
  }

  // Try to find one matching the preferred generation
  const genPrefix = `gen_${preferGen}`;
  const matchingGen = pams.filter(p => p.toLowerCase().startsWith(genPrefix.toLowerCase()));

  if (matchingGen.length > 0) {
    // Return a random one from matching generation
    return matchingGen[Math.floor(Math.random() * matchingGen.length)];
  }

  // Fall back to any available
  return pams[Math.floor(Math.random() * pams.length)];
}

// Read PID_Portrait_Mapping.csv
const mappingPath = './data/lookups/PID_Portrait_Mapping.csv';
const content = fs.readFileSync(mappingPath, 'utf8');
const lines = content.split('\n');
const header = lines[0];

console.log('Updating PID_Portrait_Mapping.csv...');
console.log('');

let updated = 0;
let skipped = 0;
let unchanged = 0;

const newLines = [header];

for (let i = 1; i < lines.length; i++) {
  if (!lines[i].trim()) continue;

  const cols = lines[i].split(',');
  const pid = cols[0];
  const name = cols[1];
  const type = cols[2];
  const plpo = cols[3];
  const currentPam = cols[4] || '';

  // Only process generic portraits
  if (type !== 'generic' || !plpo.includes('generic_')) {
    newLines.push(lines[i]);
    skipped++;
    continue;
  }

  // Determine skin tone from PLPO
  const skinTone = getSkinToneForPLPO(plpo);
  if (!skinTone) {
    newLines.push(lines[i]);
    skipped++;
    continue;
  }

  // Extract generation from PLPO
  const genMatch = plpo.match(/generic_(\d+)/);
  const gen = genMatch ? genMatch[1] : '2';

  // Get appropriate PAM for this skin tone
  const newPam = getPamForSkinTone(skinTone, gen);

  // Check if PAM needs updating
  const currentRace = currentPam.includes('_B_') ? 'black' :
                      (currentPam.includes('_M_') || currentPam.includes('_T_')) ? 'white' :
                      currentPam.includes('_H_') ? 'hispanic' : 'unknown';

  if (currentRace !== skinTone) {
    // PAM race doesn't match PLPO skin tone - update it
    newLines.push(`${pid},${name},${type},${plpo},${newPam}`);
    updated++;
  } else {
    newLines.push(lines[i]);
    unchanged++;
  }
}

// Write updated file
fs.writeFileSync(mappingPath, newLines.join('\n'));

console.log('=== RESULTS ===');
console.log('Updated PAMs:', updated);
console.log('Already correct:', unchanged);
console.log('Skipped (non-generic):', skipped);
console.log('');
console.log('PID_Portrait_Mapping.csv has been updated!');
