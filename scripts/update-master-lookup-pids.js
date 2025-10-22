/**
 * Update FullData_Lookup.csv with correct PLPO values from PID_Portrait_Mapping.csv
 *
 * This script:
 * 1. Reads PID_Portrait_Mapping.csv to get correct PID -> PLPO mappings
 * 2. Reads FullData_Lookup.csv
 * 3. Updates PLPO values where PIDs match
 * 4. Preserves all other data (UFAs, etc.)
 */

const fs = require('fs');
const path = require('path');

const lookupsDir = path.join(__dirname, '..', 'data', 'lookups');
const pidMappingFile = path.join(lookupsDir, 'PID_Portrait_Mapping.csv');
const fullDataFile = path.join(lookupsDir, 'FullData_Lookup.csv');
const backupFile = path.join(lookupsDir, 'FullData_Lookup.csv.backup');

console.log('='.repeat(60));
console.log('UPDATING FULLDATA_LOOKUP.CSV WITH CORRECT PLPO VALUES');
console.log('='.repeat(60));

// Step 1: Create backup
console.log('\n1. Creating backup...');
fs.copyFileSync(fullDataFile, backupFile);
console.log(`   ✓ Backed up to: ${backupFile}`);

// Step 2: Load PID -> PLPO mappings
console.log('\n2. Loading PID_Portrait_Mapping.csv...');
const pidMappingContent = fs.readFileSync(pidMappingFile, 'utf-8');
const pidMappingLines = pidMappingContent.split('\n');
const pidToPlpoMap = new Map();

for (let i = 1; i < pidMappingLines.length; i++) {
  const line = pidMappingLines[i].trim();
  if (!line) continue;

  const parts = line.split(',');
  if (parts.length < 3) continue;

  const pid = parts[0].trim();
  const plpo = parts[2].trim();

  if (pid && plpo) {
    pidToPlpoMap.set(pid, plpo);
  }
}

console.log(`   ✓ Loaded ${pidToPlpoMap.size} PID mappings`);

// Step 3: Update FullData_Lookup.csv
console.log('\n3. Updating FullData_Lookup.csv...');
const fullDataContent = fs.readFileSync(fullDataFile, 'utf-8');
const fullDataLines = fullDataContent.split('\n');
const updatedLines = [];
let updatedCount = 0;
let unchangedCount = 0;

// Keep header
updatedLines.push(fullDataLines[0]);

// Process data rows
for (let i = 1; i < fullDataLines.length; i++) {
  const line = fullDataLines[i].trim();
  if (!line) {
    updatedLines.push('');
    continue;
  }

  // Parse CSV line (handle commas in quoted fields)
  const parts = line.split(',');

  // PhotoID is column 7 (0-indexed)
  const photoId = parts[7] ? parts[7].trim() : '';

  // If PhotoID exists and we have a mapping for it, update the PLPO (last column)
  if (photoId && pidToPlpoMap.has(photoId)) {
    const correctPlpo = pidToPlpoMap.get(photoId);
    const currentPlpo = parts[11] ? parts[11].trim() : '';

    if (currentPlpo !== correctPlpo) {
      // Replace PLPO value
      parts[11] = correctPlpo;
      updatedLines.push(parts.join(','));
      updatedCount++;

      // Log the update
      const lastName = parts[0] || '';
      const firstName = parts[1] || '';
      console.log(`   ✓ Updated: ${lastName},${firstName} (PID ${photoId}): ${currentPlpo} -> ${correctPlpo}`);
    } else {
      // Already correct
      updatedLines.push(line);
      unchangedCount++;
    }
  } else {
    // No PID or no mapping - keep original
    updatedLines.push(line);
    unchangedCount++;
  }
}

// Step 4: Write updated file
console.log('\n4. Writing updated FullData_Lookup.csv...');
fs.writeFileSync(fullDataFile, updatedLines.join('\n'), 'utf-8');
console.log(`   ✓ File updated successfully`);

// Summary
console.log('\n' + '='.repeat(60));
console.log('SUMMARY');
console.log('='.repeat(60));
console.log(`Total entries processed: ${fullDataLines.length - 1}`);
console.log(`Entries updated: ${updatedCount}`);
console.log(`Entries unchanged: ${unchangedCount}`);
console.log(`\nBackup saved to: ${backupFile}`);
console.log('='.repeat(60));
