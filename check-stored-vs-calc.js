/**
 * Check what OVR is stored in the file vs what we calculate
 */
const fs = require('fs');

const file = 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/CAREERDRAFT-2020DRAFT';
const buffer = fs.readFileSync(file);

const DATA_START = 0x46;
const BLOCK_SIZE = 0x10C8;
const ATTR_OFFSET = 0x1000;

// First 3 prospects
const prospects = [
  { name: 'Joe Burrow', gameOVR: 76 },
  { name: 'Chase Young', gameOVR: 81 },
  { name: 'Jeff Okudah', gameOVR: 71 }
];

console.log('=== STORED OVR VALUES IN FILE ===\n');

for (let i = 0; i < 3; i++) {
  const blockStart = DATA_START + (i * BLOCK_SIZE);
  const attrStart = blockStart + ATTR_OFFSET;

  const storedOVR = buffer[attrStart + 0x51];

  console.log(`${prospects[i].name}:`);
  console.log(`  Stored in file at 0x51: ${storedOVR}`);
  console.log(`  Game shows: ${prospects[i].gameOVR}`);
  console.log(`  Match: ${storedOVR === prospects[i].gameOVR ? 'YES' : 'NO'}`);
  console.log('');
}

console.log('=== CONCLUSION ===');
console.log('If stored OVR matches game OVR, the editor should DISPLAY the stored value,');
console.log('not recalculate it.');
