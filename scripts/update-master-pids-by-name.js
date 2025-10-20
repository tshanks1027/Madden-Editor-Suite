/**
 * Update MASTER_LOOKUP_FINAL.csv PhotoID column by matching names with PID_lookup.csv
 *
 * This script:
 * 1. Loads PID_lookup.csv to get PID -> Name mappings
 * 2. Loads MASTER_LOOKUP_FINAL.csv
 * 3. For each row, matches FirstName + LastName to find correct PID
 * 4. Updates PhotoID column with the correct PID
 * 5. Preserves all other data
 */

const fs = require('fs');
const path = require('path');

const lookupsDir = path.join(__dirname, '..', 'data', 'lookups');
const pidLookupFile = path.join(lookupsDir, 'PID_lookup.csv');
const masterFinalFile = path.join(lookupsDir, 'MASTER_LOOKUP_FINAL.csv');
const backupFile = path.join(lookupsDir, 'MASTER_LOOKUP_FINAL.csv.backup2');

console.log('='.repeat(60));
console.log('UPDATING MASTER_LOOKUP_FINAL.CSV PHOTOID BY NAME MATCHING');
console.log('='.repeat(60));

// Step 1: Create backup
console.log('\n1. Creating backup...');
fs.copyFileSync(masterFinalFile, backupFile);
console.log(`   ✓ Backed up to: ${backupFile}`);

// Step 2: Load PID_lookup.csv - Create Name -> PID map
console.log('\n2. Loading PID_lookup.csv...');
const pidLookupContent = fs.readFileSync(pidLookupFile, 'utf-8');
const pidLookupLines = pidLookupContent.split('\n');
const nameToPidMap = new Map();

for (let i = 1; i < pidLookupLines.length; i++) {
  const line = pidLookupLines[i].trim();
  if (!line) continue;

  const parts = line.split(',');
  if (parts.length < 2) continue;

  const pid = parts[0].trim();
  let playerName = parts[1].trim();

  // Skip entries with " (R)" suffix (these are replacement/alternate portraits of worse quality)
  if (playerName.endsWith('(R)')) {
    continue;
  }

  if (pid && playerName) {
    // Normalize name for matching
    const normalizedName = playerName.toLowerCase();

    // Only set if not already present (avoids duplicates, keeps first occurrence)
    if (!nameToPidMap.has(normalizedName)) {
      nameToPidMap.set(normalizedName, pid);
    }
  }
}

console.log(`   ✓ Loaded ${nameToPidMap.size} name-to-PID mappings`);

// Step 3: Update MASTER_LOOKUP_FINAL.csv
console.log('\n3. Updating MASTER_LOOKUP_FINAL.csv...');
const masterContent = fs.readFileSync(masterFinalFile, 'utf-8');
const masterLines = masterContent.split('\n');
const updatedLines = [];
let updatedCount = 0;
let notFoundCount = 0;

// Keep header
const header = masterLines[0];
updatedLines.push(header);

// Find column indices
const headerParts = header.split(',');
const firstNameIndex = headerParts.findIndex(h => h.trim() === 'First Name');
const lastNameIndex = headerParts.findIndex(h => h.trim() === 'Last Name');
const photoIdIndex = headerParts.findIndex(h => h.trim() === 'PhotoID');

console.log(`   FirstName column index: ${firstNameIndex}`);
console.log(`   LastName column index: ${lastNameIndex}`);
console.log(`   PhotoID column index: ${photoIdIndex}`);

// Process data rows
for (let i = 1; i < masterLines.length; i++) {
  const line = masterLines[i].trim();
  if (!line) {
    updatedLines.push('');
    continue;
  }

  // Parse CSV line
  const parts = line.split(',');

  // Get player name
  const firstName = parts[firstNameIndex] ? parts[firstNameIndex].trim() : '';
  const lastName = parts[lastNameIndex] ? parts[lastNameIndex].trim() : '';

  if (!firstName || !lastName) {
    updatedLines.push(line);
    continue;
  }

  // Build name to match against PID_lookup (FirstName LastName format)
  const fullName = `${firstName} ${lastName}`.toLowerCase();

  // Look up PID
  const pid = nameToPidMap.get(fullName);

  if (pid) {
    // Update PhotoID column
    const currentPhotoId = parts[photoIdIndex] ? parts[photoIdIndex].trim() : '';

    if (currentPhotoId !== pid) {
      parts[photoIdIndex] = pid;
      updatedLines.push(parts.join(','));
      updatedCount++;

      // Log notable updates (legends, etc.)
      if (parseInt(pid) >= 1 && parseInt(pid) <= 10000) {
        console.log(`   ✓ Updated: ${lastName},${firstName}: "${currentPhotoId}" -> ${pid}`);
      }
    } else {
      // Already correct
      updatedLines.push(line);
    }
  } else {
    // No PID mapping found - leave empty
    updatedLines.push(line);
    notFoundCount++;
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
console.log(`Entries updated with PhotoID: ${updatedCount}`);
console.log(`Entries with no PID match: ${notFoundCount}`);
console.log(`\nBackup saved to: ${backupFile}`);
console.log('='.repeat(60));
