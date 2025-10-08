const fs = require('fs');

// Read both files
const originalPath = 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden NFL 26\\Saves\\CAREERDRAFT-2026DRAFT7RND';
const editedPath = 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden NFL 26\\Saves\\CAREERDRAFT-EDITED';

console.log('Comparing draft class files...\n');

const original = fs.readFileSync(originalPath);
const edited = fs.readFileSync(editedPath);

console.log(`Original size: ${original.length} bytes`);
console.log(`Edited size: ${edited.length} bytes\n`);

// M26 structure
const BLOCK_SIZE = 4296;
const ATTRIBUTE_OFFSET = 0x1000; // 4096 bytes into each block
const DATA_START = 0x46; // Header size for M26

// Check if files are identical
let identical = true;
for (let i = 0; i < original.length; i++) {
  if (original[i] !== edited[i]) {
    identical = false;
    break;
  }
}

if (identical) {
  console.log('⚠️  FILES ARE IDENTICAL - No changes were saved!\n');
} else {
  console.log('✓ Files are different - changes were saved\n');
}

// List first 10 prospects from each file
console.log('=== FIRST 10 PROSPECTS IN ORIGINAL ===\n');
for (let i = 0; i < 10; i++) {
  const blockStart = DATA_START + (i * BLOCK_SIZE);
  const attributeOffset = blockStart + ATTRIBUTE_OFFSET;

  if (attributeOffset + 0x4a > original.length) break;

  const firstName = original.toString('ascii', attributeOffset, attributeOffset + 0x11).replace(/\0/g, '').trim();
  const lastName = original.toString('ascii', attributeOffset + 0x11, attributeOffset + 0x26).replace(/\0/g, '').trim();
  const position = original[attributeOffset + 0x4a];

  if (firstName || lastName) {
    console.log(`${i + 1}. ${firstName} ${lastName} (Pos: ${position})`);
  }
}

console.log('\n=== FIRST 10 PROSPECTS IN EDITED ===\n');
for (let i = 0; i < 10; i++) {
  const blockStart = DATA_START + (i * BLOCK_SIZE);
  const attributeOffset = blockStart + ATTRIBUTE_OFFSET;

  if (attributeOffset + 0x4a > edited.length) break;

  const firstName = edited.toString('ascii', attributeOffset, attributeOffset + 0x11).replace(/\0/g, '').trim();
  const lastName = edited.toString('ascii', attributeOffset + 0x11, attributeOffset + 0x26).replace(/\0/g, '').trim();
  const position = edited[attributeOffset + 0x4a];

  if (firstName || lastName) {
    console.log(`${i + 1}. ${firstName} ${lastName} (Pos: ${position})`);
  }
}

// Now analyze Todd Shanks (prospect #1, index 0)
const toddBlockStart = DATA_START;
const toddAttributeOffset = toddBlockStart + ATTRIBUTE_OFFSET;

console.log('\n=== TODD SHANKS ANALYSIS ===\n');
console.log(`Block start: 0x${toddBlockStart.toString(16)}`);
console.log(`Attribute offset: 0x${toddAttributeOffset.toString(16)}`);

// Check throw power and injury
const throwPowerOffset = toddAttributeOffset + 0x6C;
const injuryOffset = toddAttributeOffset + 0x8D;

console.log('\n--- THROW POWER ---');
console.log(`Offset: 0x${throwPowerOffset.toString(16)} (attribute + 0x6C)`);
console.log(`Original value: ${original[throwPowerOffset]}`);
console.log(`Edited value: ${edited[throwPowerOffset]}`);

console.log('\n--- INJURY ---');
console.log(`Offset: 0x${injuryOffset.toString(16)} (attribute + 0x8D)`);
console.log(`Original value: ${original[injuryOffset]}`);
console.log(`Edited value: ${edited[injuryOffset]}`);

// Check other key stats to verify they're all 90
console.log('\n--- OTHER STATS (all should be 90 in edited) ---');
const statsToCheck = {
  'Speed (0x7B)': 0x7B,
  'Acceleration (0x52)': 0x52,
  'Agility (0x53)': 0x53,
  'Strength (0x7F)': 0x7F,
  'Awareness (0x54)': 0x54,
  'Catching (0x5A)': 0x5A,
  'Tackle (0x80)': 0x80,
  'Carrying (0x59)': 0x59,
};

for (const [name, offset] of Object.entries(statsToCheck)) {
  const fullOffset = toddAttributeOffset + offset;
  const origVal = original[fullOffset];
  const editedVal = edited[fullOffset];
  const match = editedVal === 90 ? '✓' : '✗';
  console.log(`${name}: Original=${origVal}, Edited=${editedVal} ${match}`);
}

// Check the ORIGINAL Francis Mauigoa's stats (he was prospect #1 originally)
console.log('\n=== ORIGINAL FRANCIS MAUIGOA (was prospect #1) ===');
const francisAttributeOffset = toddAttributeOffset;  // Same position
console.log(`Throw Power: ${original[francisAttributeOffset + 0x6C]}`);
console.log(`Injury: ${original[francisAttributeOffset + 0x8D]}`);

