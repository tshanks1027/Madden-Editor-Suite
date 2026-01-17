/**
 * Update ALL_PLAYER_LOOKUP.csv to use correct race-based PAMs
 *
 * Strategy:
 * 1. For players with generic PAMs (gen_X_B_*), check their PLPO or use era-based logic
 * 2. Early era players (pre-1960) were predominantly white
 * 3. Modern players use skin tone from PLPO mapping
 */

const fs = require('fs');

// Load PAM race mapping
const pamMapping = JSON.parse(fs.readFileSync('./data/lookups/pam-race-mapping.json'));

// Load PID_Portrait_Mapping.csv to get PLPO -> skin tone mapping
const pidMappingContent = fs.readFileSync('./data/lookups/PID_Portrait_Mapping.csv', 'utf8');
const pidMappingLines = pidMappingContent.split('\n');

// Build PID to PAM lookup from updated mapping
const pidToPam = new Map();
for (let i = 1; i < pidMappingLines.length; i++) {
  const cols = pidMappingLines[i].split(',');
  if (cols.length >= 5) {
    const pid = cols[0];
    const pam = cols[4];
    if (pid && pam) {
      pidToPam.set(pid, pam);
    }
  }
}

console.log('Loaded', pidToPam.size, 'PID to PAM mappings');

// Read ALL_PLAYER_LOOKUP.csv
const lookupPath = './data/lookups/ALL_PLAYER_LOOKUP.csv';
const lookupContent = fs.readFileSync(lookupPath, 'utf8');
const lines = lookupContent.split('\n');
const header = lines[0];
const headerCols = header.split(',');

// Find column indices
const pamIdx = headerCols.indexOf('Player Assets ID');
const pidIdx = headerCols.indexOf('PhotoID');
const draftYearIdx = headerCols.indexOf('Draft Class');
const raceIdx = headerCols.indexOf('Race');
const firstNameIdx = headerCols.indexOf('First Name');
const lastNameIdx = headerCols.indexOf('Last Name');

console.log('Column indices - PAM:', pamIdx, 'PID:', pidIdx, 'DraftYear:', draftYearIdx);

// Get a random PAM for a skin tone
function getRandomPam(skinTone) {
  let pams;
  if (skinTone === 'white') {
    pams = pamMapping.white;
  } else if (skinTone === 'hispanic') {
    pams = pamMapping.hispanic;
  } else {
    pams = pamMapping.black;
  }
  return pams[Math.floor(Math.random() * pams.length)];
}

// Determine skin tone from PAM
function getSkinToneFromPam(pam) {
  if (!pam) return null;
  if (pam.includes('_M_') || pam.includes('_T_')) return 'white';
  if (pam.includes('_H_')) return 'hispanic';
  if (pam.includes('_B_')) return 'black';
  return null;
}

// Determine skin tone for a player
function determineSkinTone(cols) {
  const pid = cols[pidIdx];
  const currentPam = cols[pamIdx] ? cols[pamIdx].trim() : '';
  const race = cols[raceIdx] ? cols[raceIdx].trim().toLowerCase() : '';
  const draftYear = parseInt(cols[draftYearIdx]) || 0;

  // If we have a race specified, use it
  if (race === 'white' || race === 'light') return 'white';
  if (race === 'black') return 'black';
  if (race === 'hispanic' || race === 'mixed') return 'hispanic';

  // If we have a PID, check if it maps to a specific PAM type
  if (pid && pidToPam.has(pid)) {
    const mappedPam = pidToPam.get(pid);
    const mappedSkinTone = getSkinToneFromPam(mappedPam);
    if (mappedSkinTone) return mappedSkinTone;
  }

  // Era-based logic: NFL was predominantly white before 1946
  // Integration started in 1946, but was slow until 1960s
  if (draftYear > 0 && draftYear < 1946) return 'white';
  if (draftYear >= 1946 && draftYear < 1960) {
    // Mostly white but some black players
    return Math.random() < 0.85 ? 'white' : 'black';
  }

  // Modern era: use roughly realistic proportions
  // NFL is ~70% Black, ~25% White, ~5% Hispanic/Other
  const rand = Math.random();
  if (rand < 0.70) return 'black';
  if (rand < 0.95) return 'white';
  return 'hispanic';
}

let updated = 0;
let unchanged = 0;
let noGenericPam = 0;

const newLines = [header];

for (let i = 1; i < lines.length; i++) {
  if (!lines[i].trim()) continue;

  const cols = lines[i].split(',');
  const currentPam = cols[pamIdx] ? cols[pamIdx].trim() : '';

  // Only process players with generic PAMs
  if (!currentPam || !currentPam.startsWith('gen_')) {
    newLines.push(lines[i]);
    noGenericPam++;
    continue;
  }

  // Check if current PAM is already correct type
  const currentSkinTone = getSkinToneFromPam(currentPam);
  const targetSkinTone = determineSkinTone(cols);

  if (currentSkinTone === targetSkinTone) {
    newLines.push(lines[i]);
    unchanged++;
    continue;
  }

  // Update to correct PAM type
  const newPam = getRandomPam(targetSkinTone);
  cols[pamIdx] = newPam;
  newLines.push(cols.join(','));
  updated++;
}

// Write updated file
fs.writeFileSync(lookupPath, newLines.join('\n'));

console.log('');
console.log('=== RESULTS ===');
console.log('Updated PAMs:', updated);
console.log('Already correct:', unchanged);
console.log('No generic PAM:', noGenericPam);
console.log('');
console.log('ALL_PLAYER_LOOKUP.csv has been updated!');

// Show sample of changes
console.log('');
console.log('Sample players that needed updating (would have been updated):');
