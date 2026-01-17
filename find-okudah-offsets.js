/**
 * Find correct offsets for Okudah by searching for known values
 * From editor screenshot:
 * OVR: 74, ACC: 89, AGI: 88, AWR: 78, SPD: 90, etc.
 */
const fs = require('fs');

const file = 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/CAREERDRAFT-2020DRAFT';
const buffer = fs.readFileSync(file);

const DATA_START = 0x46;
const BLOCK_SIZE = 0x10C8;
const ATTR_OFFSET = 0x1000;

// Okudah is index 2 (3rd prospect)
const blockStart = DATA_START + (2 * BLOCK_SIZE);
const attrStart = blockStart + ATTR_OFFSET;

// Known values from editor
const knownValues = {
  ovr: 74,
  acc: 89,
  agi: 88,
  awr: 78,
  spd: 90,
  str: 66,
  jmp: 98,  // jumping
  sta: 95,  // stamina
  inj: 97,  // injury
};

console.log('=== SEARCHING FOR OKUDAH\'S KNOWN VALUES ===\n');
console.log(`Block starts at: 0x${blockStart.toString(16)}`);
console.log(`Attr section at: 0x${attrStart.toString(16)}`);
console.log('');

// Search entire attribute section for each known value
for (const [name, value] of Object.entries(knownValues)) {
  const foundAt = [];
  for (let offset = 0; offset < 0xC8; offset++) {
    if (buffer[attrStart + offset] === value) {
      foundAt.push('0x' + offset.toString(16).padStart(2, '0'));
    }
  }
  console.log(`${name.padEnd(5)} (${value}): found at ${foundAt.join(', ') || 'NOT FOUND'}`);
}

console.log('\n=== RAW HEX DUMP OF ATTR SECTION (first 200 bytes) ===\n');

// Dump as hex with annotations
for (let i = 0; i < 0xC8; i += 16) {
  const hex = [];
  const dec = [];
  for (let j = 0; j < 16 && i + j < 0xC8; j++) {
    const byte = buffer[attrStart + i + j];
    hex.push(byte.toString(16).padStart(2, '0'));
    dec.push(byte.toString().padStart(3, ' '));
  }
  const offsetStr = '0x' + i.toString(16).padStart(2, '0');
  console.log(`${offsetStr}: ${hex.join(' ')} | ${dec.join(' ')}`);
}

// Look for clustering of values in the 60-99 range (typical rating values)
console.log('\n=== POTENTIAL RATING CLUSTERS (values 40-99) ===');
let clusterStart = -1;
for (let i = 0; i < 0xC8; i++) {
  const val = buffer[attrStart + i];
  if (val >= 40 && val <= 99) {
    if (clusterStart === -1) clusterStart = i;
  } else {
    if (clusterStart !== -1 && i - clusterStart >= 4) {
      console.log(`Cluster at 0x${clusterStart.toString(16)}-0x${(i-1).toString(16)}`);
    }
    clusterStart = -1;
  }
}
