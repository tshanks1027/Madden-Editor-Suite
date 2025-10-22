/**
 * Update MASTER_LOOKUP_FINAL.csv PhotoID column with values from PID_Portrait_Mapping.csv
 *
 * This script:
 * 1. Loads PID_Portrait_Mapping.csv to get Portrait -> PID mappings
 * 2. Loads MASTER_LOOKUP_FINAL.csv
 * 3. For each row, if PLPO exists, finds matching PID from PID_Portrait_Mapping
 * 4. Updates PhotoID column with the correct PID
 * 5. Preserves all other data
 */

const fs = require('fs');
const path = require('path');

const lookupsDir = path.join(__dirname, '..', 'data', 'lookups');
const pidMappingFile = path.join(lookupsDir, 'PID_Portrait_Mapping.csv');
const masterFinalFile = path.join(lookupsDir, 'MASTER_LOOKUP_FINAL.csv');
const backupFile = path.join(lookupsDir, 'MASTER_LOOKUP_FINAL.csv.backup');

console.log('='.repeat(60));
console.log('UPDATING MASTER_LOOKUP_FINAL.CSV WITH PHOTOID VALUES');
console.log('='.repeat(60));

// Step 1: Create backup
console.log('\n1. Creating backup...');
fs.copyFileSync(masterFinalFile, backupFile);
console.log(`   ✓ Backed up to: ${backupFile}`);

// Step 2: Load PID_Portrait_Mapping.csv - Create Portrait -> PID map
console.log('\n2. Loading PID_Portrait_Mapping.csv...');
const pidMappingContent = fs.readFileSync(pidMappingFile, 'utf-8');
const pidMappingLines = pidMappingContent.split('\n');
const portraitToPidMap = new Map();

for (let i = 1; i < pidMappingLines.length; i++) {
  const line = pidMappingLines[i].trim();
  if (!line) continue;

  const parts = line.split(',');
  if (parts.length < 3) continue;

  const pid = parts[0].trim();
  const portrait = parts[2].trim().toLowerCase();

  if (pid && portrait) {
    portraitToPidMap.set(portrait, pid);
  }
}

console.log(`   ✓ Loaded ${portraitToPidMap.size} portrait mappings`);

// Step 3: Update MASTER_LOOKUP_FINAL.csv
console.log('\n3. Updating MASTER_LOOKUP_FINAL.csv...');
const masterContent = fs.readFileSync(masterFinalFile, 'utf-8');
const masterLines = masterContent.split('\n');
const updatedLines = [];
let updatedCount = 0;
let noPlpoCount = 0;
let notFoundCount = 0;

// Keep header
const header = masterLines[0];
updatedLines.push(header);

// Find column indices
const headerParts = header.split(',');
const photoIdIndex = headerParts.findIndex(h => h.trim() === 'PhotoID');
const plpoIndex = headerParts.findIndex(h => h.trim() === 'PLPO');

console.log(`   PhotoID column index: ${photoIdIndex}`);
console.log(`   PLPO column index: ${plpoIndex}`);

// Process data rows
for (let i = 1; i < masterLines.length; i++) {
  const line = masterLines[i].trim();
  if (!line) {
    updatedLines.push('');
    continue;
  }

  // Parse CSV line (simple split for now - assumes no commas in quoted fields in PhotoID/PLPO columns)
  const parts = line.split(',');

  // Get PLPO value
  const plpo = parts[plpoIndex] ? parts[plpoIndex].trim().toLowerCase() : '';

  if (!plpo) {
    // No PLPO - can't look up PID
    updatedLines.push(line);
    noPlpoCount++;
    continue;
  }

  // Look up PID from portrait mapping
  const pid = portraitToPidMap.get(plpo);

  if (pid) {
    // Update PhotoID column
    const currentPhotoId = parts[photoIdIndex] ? parts[photoIdIndex].trim() : '';

    if (currentPhotoId !== pid) {
      parts[photoIdIndex] = pid;
      updatedLines.push(parts.join(','));
      updatedCount++;

      // Log the update
      const lastName = parts[0] || '';
      const firstName = parts[1] || '';
      console.log(`   ✓ Updated: ${lastName},${firstName} (PLPO: ${plpo}): "${currentPhotoId}" -> ${pid}`);
    } else {
      // Already correct
      updatedLines.push(line);
    }
  } else {
    // PLPO exists but no PID mapping found
    updatedLines.push(line);
    notFoundCount++;

    if (notFoundCount <= 5) {
      const lastName = parts[0] || '';
      const firstName = parts[1] || '';
      console.log(`   ⚠️ No PID found for: ${lastName},${firstName} (PLPO: ${plpo})`);
    }
  }
}

// Step 4: Write updated file
console.log('\n4. Writing updated MASTER_LOOKUP_FINAL.csv...');
fs.writeFileSync(masterFinalFile, updatedLines.join('\n'), 'utf-8');
console.log(`   ✓ File updated successfully`);

// Summary
console.log('\n' + '='.repeat(60));
console.log('SUMMARY');
console.log('='.repeat(60));
console.log(`Total entries processed: ${masterLines.length - 1}`);
console.log(`Entries updated: ${updatedCount}`);
console.log(`Entries with no PLPO: ${noPlpoCount}`);
console.log(`Entries with PLPO but no PID match: ${notFoundCount}`);
console.log(`\nBackup saved to: ${backupFile}`);
console.log('='.repeat(60));
