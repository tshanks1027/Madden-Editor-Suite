/**
 * Convert MyFranchise genHeadPortrait.json to PID_Portrait_Mapping.csv format
 *
 * Usage: node scripts/convert-myfranchise-mappings.js
 */

const fs = require('fs');
const path = require('path');

const genHeadPath = path.join(__dirname, '..', 'temp', 'myfranchise-extracted', 'dist', 'electron', 'static', 'genHeadPortrait.json');
const currentCSVPath = path.join(__dirname, '..', 'data', 'lookups', 'PID_Portrait_Mapping.csv');

console.log('Reading genHeadPortrait.json...');
const genHeadData = JSON.parse(fs.readFileSync(genHeadPath, 'utf8'));
const assetToPID = genHeadData.GenericHeadAssetName;

console.log(`Found ${Object.keys(assetToPID).length} asset→PID mappings`);

// Reverse the mapping: PID → Asset
const pidToAsset = new Map();
for (const [asset, pid] of Object.entries(assetToPID)) {
  if (pid > 0) { // Skip PID 0 entries
    pidToAsset.set(pid, asset);
  }
}

console.log(`Created ${pidToAsset.size} PID→Asset mappings (excluding PID 0)`);

// Convert asset names to PLPO format
const pidToPortrait = new Map();
for (const [pid, asset] of pidToAsset.entries()) {
  // Asset format: "1_B_B_005", "5_M_N_073", etc.
  // Convert to: "plpo_generic_1_B_B_005", "plpo_generic_5_M_N_073"
  let plpoName = '';

  // Skip special entries
  if (asset.includes('MorphHead') || asset === 'NoHead' || asset === 'DefaultValue') {
    continue;
  }

  // Standard format: add plpo_generic_ prefix
  plpoName = `plpo_generic_${asset}`;

  pidToPortrait.set(pid, plpoName);
}

console.log(`Created ${pidToPortrait.size} PID→PLPO mappings`);

// Read existing CSV
console.log('\nReading existing PID_Portrait_Mapping.csv...');
const csvContent = fs.readFileSync(currentCSVPath, 'utf8');
const lines = csvContent.split('\n');

// Parse existing mappings
const existingMappings = new Map();
const header = lines[0];

for (let i = 1; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) continue;

  const parts = line.split(',');
  if (parts.length < 4) continue;

  const pid = parseInt(parts[0]);
  const name = parts[1];
  const type = parts[2];
  const portrait = parts[3] || '';

  existingMappings.set(pid, { name, type, portrait });
}

console.log(`Found ${existingMappings.size} existing PID entries in CSV`);

// Merge: MyFranchise data takes precedence for generic faces
let updated = 0;
let added = 0;

for (const [pid, plpoName] of pidToPortrait.entries()) {
  if (existingMappings.has(pid)) {
    const existing = existingMappings.get(pid);
    if (!existing.portrait || existing.portrait.trim() === '') {
      // Empty portrait field - fill it in
      existing.portrait = plpoName;
      updated++;
    }
  } else {
    // New PID not in CSV yet
    existingMappings.set(pid, {
      name: 'Generic Face',
      type: 'generic',
      portrait: plpoName
    });
    added++;
  }
}

console.log(`\nUpdated ${updated} empty portrait entries`);
console.log(`Added ${added} new PID entries`);

// Sort by PID
const sortedPIDs = Array.from(existingMappings.keys()).sort((a, b) => a - b);

// Generate new CSV content
const newLines = [header];
for (const pid of sortedPIDs) {
  const mapping = existingMappings.get(pid);
  newLines.push(`${pid},${mapping.name},${mapping.type},${mapping.portrait}`);
}

// Save updated CSV
const outputPath = path.join(__dirname, '..', 'data', 'lookups', 'PID_Portrait_Mapping_UPDATED.csv');
fs.writeFileSync(outputPath, newLines.join('\n'), 'utf8');

console.log(`\nSaved updated mappings to: ${outputPath}`);
console.log(`Total entries: ${sortedPIDs.length}`);

// Show sample of new mappings
console.log('\n=== SAMPLE NEW MAPPINGS ===');
let sampleCount = 0;
for (const [pid, plpoName] of Array.from(pidToPortrait.entries()).slice(0, 20)) {
  const existing = existingMappings.get(pid);
  if (existing) {
    console.log(`PID ${pid}: ${plpoName}`);
    sampleCount++;
  }
  if (sampleCount >= 10) break;
}

console.log('\n✓ Conversion complete!');
