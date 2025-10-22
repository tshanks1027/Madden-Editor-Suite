/**
 * Merge PhotoID values from FullData_Lookup.csv into MASTER_LOOKUP_FINAL.csv
 *
 * This adds PhotoIDs for legends and other players that exist in FullData_Lookup
 * but may be missing from MASTER_LOOKUP_FINAL
 */

const fs = require('fs');
const path = require('path');

const lookupsDir = path.join(__dirname, '..', 'data', 'lookups');
const fullDataFile = path.join(lookupsDir, 'FullData_Lookup.csv');
const masterFinalFile = path.join(lookupsDir, 'MASTER_LOOKUP_FINAL.csv');
const backupFile = path.join(lookupsDir, 'MASTER_LOOKUP_FINAL.csv.backup3');

console.log('='.repeat(60));
console.log('MERGING FULLDATA_LOOKUP PHOTOIDS INTO MASTER_LOOKUP_FINAL');
console.log('='.repeat(60));

// Backup
console.log('\n1. Creating backup...');
fs.copyFileSync(masterFinalFile, backupFile);
console.log(`   ✓ Backed up to: ${backupFile}`);

// Load FullData_Lookup PhotoIDs
console.log('\n2. Loading FullData_Lookup.csv PhotoIDs...');
const fullDataContent = fs.readFileSync(fullDataFile, 'utf-8');
const fullDataLines = fullDataContent.split('\n');
const nameToPhotoIdMap = new Map();

// Parse header
const fullDataHeader = fullDataLines[0].split(',');
const fdFirstNameIdx = fullDataHeader.findIndex(h => h.trim() === 'First Name');
const fdLastNameIdx = fullDataHeader.findIndex(h => h.trim() === 'Last Name');
const fdPhotoIdIdx = fullDataHeader.findIndex(h => h.trim() === 'PhotoID');

for (let i = 1; i < fullDataLines.length; i++) {
  const line = fullDataLines[i].trim();
  if (!line) continue;

  const parts = line.split(',');
  const firstName = parts[fdFirstNameIdx] ? parts[fdFirstNameIdx].trim() : '';
  const lastName = parts[fdLastNameIdx] ? parts[fdLastNameIdx].trim() : '';
  const photoId = parts[fdPhotoIdIdx] ? parts[fdPhotoIdIdx].trim() : '';

  if (firstName && lastName && photoId && !isNaN(parseInt(photoId))) {
    const key = `${firstName.toLowerCase()}|${lastName.toLowerCase()}`;
    nameToPhotoIdMap.set(key, photoId);
  }
}

console.log(`   ✓ Loaded ${nameToPhotoIdMap.size} PhotoID mappings`);

// Update MASTER_LOOKUP_FINAL
console.log('\n3. Updating MASTER_LOOKUP_FINAL.csv...');
const masterContent = fs.readFileSync(masterFinalFile, 'utf-8');
const masterLines = masterContent.split('\n');
const updatedLines = [];
let updatedCount = 0;

// Keep header
const header = masterLines[0];
updatedLines.push(header);

const headerParts = header.split(',');
const mFirstNameIdx = headerParts.findIndex(h => h.trim() === 'First Name');
const mLastNameIdx = headerParts.findIndex(h => h.trim() === 'Last Name');
const mPhotoIdIdx = headerParts.findIndex(h => h.trim() === 'PhotoID');

// Process rows
for (let i = 1; i < masterLines.length; i++) {
  const line = masterLines[i].trim();
  if (!line) {
    updatedLines.push('');
    continue;
  }

  const parts = line.split(',');
  const firstName = parts[mFirstNameIdx] ? parts[mFirstNameIdx].trim() : '';
  const lastName = parts[mLastNameIdx] ? parts[mLastNameIdx].trim() : '';

  if (!firstName || !lastName) {
    updatedLines.push(line);
    continue;
  }

  const key = `${firstName.toLowerCase()}|${lastName.toLowerCase()}`;
  const photoId = nameToPhotoIdMap.get(key);

  if (photoId) {
    const currentPhotoId = parts[mPhotoIdIdx] ? parts[mPhotoIdIdx].trim() : '';

    if (!currentPhotoId || currentPhotoId === '') {
      // Add PhotoID
      parts[mPhotoIdIdx] = photoId;
      updatedLines.push(parts.join(','));
      updatedCount++;

      if (parseInt(photoId) <= 10000) {
        console.log(`   ✓ Added: ${lastName},${firstName} -> ${photoId}`);
      }
    } else {
      updatedLines.push(line);
    }
  } else {
    updatedLines.push(line);
  }
}

// Write
console.log('\n4. Writing updated file...');
fs.writeFileSync(masterFinalFile, updatedLines.join('\n'), 'utf-8');
console.log(`   ✓ File updated`);

console.log('\n' + '='.repeat(60));
console.log('SUMMARY');
console.log('='.repeat(60));
console.log(`PhotoIDs added: ${updatedCount}`);
console.log(`Backup: ${backupFile}`);
console.log('='.repeat(60));
