/**
 * Compare saved file vs working 2012 file at exact byte level
 */
const fs = require('fs');

const savedPath = 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden NFL 26\\Saves\\CAREERDRAFT-EDITED1';
const workingPath = 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden Files\\1994 Mod V3\\Draft Classes\\CAREERDRAFT-2012V1';

const saved = fs.readFileSync(savedPath);
const working = fs.readFileSync(workingPath);

console.log('Saved file size:', saved.length);
console.log('Working file size:', working.length);

const BLOCK_SIZE = 4322;
const HEADER_OFFSET = 0x46;

// Compare first prospect (should be Andrew Luck in both)
const savedAttr = HEADER_OFFSET + 0x1000;  // Prospect 1 attrs in saved file
const workingAttr = HEADER_OFFSET + 0x1000;  // Prospect 1 attrs in working file

console.log('\n=== PROSPECT #1 COMPARISON ===');
console.log('Saved name:', saved.toString('ascii', savedAttr, savedAttr + 0x26).replace(/\0/g, ' ').trim());
console.log('Working name:', working.toString('ascii', workingAttr, workingAttr + 0x26).replace(/\0/g, ' ').trim());

// Compare key offsets
const offsets = {
  position: 0x4a,
  draftPick: 0x4e,
  acceleration: 0x52,
  agility: 0x53,
  awareness: 0x54,
  injury: 0x60,
  speed: 0x7B,
  stamina: 0x7D,
  strength: 0x7F,
  tackle: 0x80,
  throwAccuracyDeep: 0x81,
  throwAccuracyMid: 0x83,
  throwAccuracyShort: 0x84,
  throwOnTheRun: 0x85,
  throwPower: 0x86,
  throwUnderPressure: 0x87,
  devTrait: 0x8c
};

console.log('\nOffset | Saved | Working | Description');
console.log('-------|-------|---------|------------');

for (const [name, offset] of Object.entries(offsets)) {
  const savedVal = saved[savedAttr + offset];
  const workingVal = working[workingAttr + offset];
  const diff = savedVal !== workingVal ? ' <-- DIFFERENT!' : '';
  console.log(`0x${offset.toString(16).padStart(2, '0')}   | ${String(savedVal).padStart(5)} | ${String(workingVal).padStart(7)} | ${name}${diff}`);
}

// Show adjacent bytes around speed (0x7B) to look for different speed location
console.log('\n=== BYTES AROUND SPEED (0x78-0x82) IN SAVED ===');
for (let i = 0x78; i <= 0x82; i++) {
  console.log(`  0x${i.toString(16)}: ${saved[savedAttr + i]} (${String.fromCharCode(saved[savedAttr + i])}`);
}

console.log('\n=== BYTES AROUND SPEED (0x78-0x82) IN WORKING ===');
for (let i = 0x78; i <= 0x82; i++) {
  console.log(`  0x${i.toString(16)}: ${working[workingAttr + i]} (${String.fromCharCode(working[workingAttr + i])}`);
}

// Check if there's a value of 15 anywhere in the attribute area
console.log('\n=== SEARCH FOR VALUE 15 IN SAVED ATTRS (0x40-0x90) ===');
for (let i = 0x40; i <= 0x90; i++) {
  if (saved[savedAttr + i] === 15) {
    console.log(`  Found 15 at offset 0x${i.toString(16)}`);
  }
}

// Check OVR-related bytes
console.log('\n=== CHECK FOR OVR VALUE ===');
console.log('Saved bytes at potential OVR locations:');
console.log('  0x4f:', saved[savedAttr + 0x4f]);
console.log('  0x50:', saved[savedAttr + 0x50]);
console.log('  0x51:', saved[savedAttr + 0x51]);
console.log('  0x94:', saved[savedAttr + 0x94]);
console.log('  0x95:', saved[savedAttr + 0x95]);
