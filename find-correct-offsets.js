/**
 * Find the correct offsets by searching for known CSV values in the binary
 *
 * From CSV, Andrew Luck 2013 should have:
 * PSPD=82, PACC=88, PAGI=84, PAWR=60, PTHP=92, PTAS=93, PTAM=90, PTAD=81
 */
const fs = require('fs');

const file = 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/CAREERDRAFT-2012DRAFT';
const buffer = fs.readFileSync(file);

const DATA_START = 0x46;
const BLOCK_SIZE = 0x10C8;
const ATTR_OFFSET = 0x1000;

const blockStart = DATA_START;
const attrStart = blockStart + ATTR_OFFSET;

// Known CSV values for Luck
const csvValues = {
  speed: 82,
  acceleration: 88,
  agility: 84,
  awareness: 60,
  throwPower: 92,
  throwAccuracyShort: 93,
  throwAccuracyMid: 90,
  throwAccuracyDeep: 81,
  throwOnTheRun: 88,
  throwUnderPressure: 17,  // This was noted as low
  breakSack: 26,           // This was noted as low
  carrying: 58,
  ballCarrierVision: 72,
  injury: 98,
  stamina: 97,
  playAction: 74,
};

console.log('=== SEARCHING FOR CSV VALUES IN ATTRIBUTE SECTION ===\n');
console.log('Looking for these values from CSV:');
for (const [name, value] of Object.entries(csvValues)) {
  console.log(`  ${name}: ${value}`);
}

console.log('\n=== ATTRIBUTE SECTION HEX (offset 0x1000 from block start) ===\n');

// Dump the entire attribute section with both hex and decimal
for (let i = 0; i < 0xC8; i++) {
  const byte = buffer[attrStart + i];
  const offsetHex = i.toString(16).padStart(2, '0');

  // Check if this byte matches any known CSV value
  const matches = [];
  for (const [name, value] of Object.entries(csvValues)) {
    if (byte === value) {
      matches.push(name);
    }
  }

  if (matches.length > 0 || byte >= 50 && byte <= 99) {
    console.log(`0x${offsetHex}: ${byte.toString().padStart(3)} ${matches.length > 0 ? '<-- ' + matches.join(', ') : ''}`);
  }
}

// Now let's look at the raw hex dump more carefully
console.log('\n=== RAW HEX WITH ANNOTATIONS ===\n');
console.log('Offset | Hex  | Dec | Possible Field');
console.log('-------|------|-----|---------------');

// Key offsets according to M26Parser
const m26Offsets = {
  0x4a: 'position',
  0x4b: 'archetype',
  0x51: 'overall',
  0x52: 'acceleration',
  0x53: 'agility',
  0x54: 'awareness',
  0x7b: 'speed',
  0x81: 'throwAccuracyDeep',
  0x82: 'throwAccuracyMid',
  0x84: 'throwAccuracyShort',
  0x85: 'throwOnTheRun',
  0x86: 'throwPower',
  0x87: 'throwUnderPressure',
};

for (let i = 0x40; i < 0x90; i++) {
  const byte = buffer[attrStart + i];
  const offsetHex = '0x' + i.toString(16);
  const m26Field = m26Offsets[i] || '';

  // Check CSV matches
  const csvMatches = [];
  for (const [name, value] of Object.entries(csvValues)) {
    if (byte === value) {
      csvMatches.push(name);
    }
  }

  console.log(`${offsetHex.padEnd(6)} | ${byte.toString(16).padStart(2, '0')}   | ${byte.toString().padStart(3)} | ${m26Field.padEnd(20)} ${csvMatches.length > 0 ? '<<< CSV: ' + csvMatches.join(', ') : ''}`);
}

// Build a corrected offset map by finding where values actually are
console.log('\n\n=== BUILDING CORRECTED OFFSET MAP ===\n');

// Look at every byte in the attribute section and find all instances of our known values
for (const [name, value] of Object.entries(csvValues)) {
  const foundAt = [];
  for (let i = 0; i < 0xC8; i++) {
    if (buffer[attrStart + i] === value) {
      foundAt.push('0x' + i.toString(16));
    }
  }
  console.log(`${name} (${value}): found at offsets ${foundAt.join(', ') || 'NOT FOUND'}`);
}
