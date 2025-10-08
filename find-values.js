const fs = require('fs');

const editedPath = 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden NFL 26\\Saves\\CAREERDRAFT-EDITED';
const edited = fs.readFileSync(editedPath);

console.log('Searching for byte value 95 (0x5F) and 30 (0x1E) in edited file...\n');

// Find all instances of 95 and 30 near Todd Shanks block
const DATA_START = 0x46;
const BLOCK_SIZE = 4296;
const toddBlockStart = DATA_START;
const toddBlockEnd = toddBlockStart + BLOCK_SIZE;

console.log(`Todd Shanks block: 0x${toddBlockStart.toString(16)} - 0x${toddBlockEnd.toString(16)}\n`);

console.log('=== INSTANCES OF 95 (0x5F) IN TODD\'S BLOCK ===');
let count95 = 0;
for (let i = toddBlockStart; i < toddBlockEnd && i < edited.length; i++) {
  if (edited[i] === 95) {
    console.log(`Found 95 at offset 0x${i.toString(16)} (block + 0x${(i - toddBlockStart).toString(16)})`);
    count95++;
  }
}
console.log(`Total: ${count95} instances\n`);

console.log('=== INSTANCES OF 30 (0x1E) IN TODD\'S BLOCK ===');
let count30 = 0;
for (let i = toddBlockStart; i < toddBlockEnd && i < edited.length; i++) {
  if (edited[i] === 30) {
    console.log(`Found 30 at offset 0x${i.toString(16)} (block + 0x${(i - toddBlockStart).toString(16)})`);
    count30++;
  }
}
console.log(`Total: ${count30} instances\n`);

// Check what's actually at attribute offset
const ATTRIBUTE_OFFSET = 0x1000;
const attributeStart = toddBlockStart + ATTRIBUTE_OFFSET;

console.log('=== VALUES AT KEY ATTRIBUTE OFFSETS ===');
console.log(`Attribute block starts at: 0x${attributeStart.toString(16)}`);
console.log(`throwPower (+ 0x6C): ${edited[attributeStart + 0x6C]}`);
console.log(`injury (+ 0x8D): ${edited[attributeStart + 0x8D]}`);
console.log(`speed (+ 0x7B): ${edited[attributeStart + 0x7B]}`);
console.log(`strength (+ 0x7F): ${edited[attributeStart + 0x7F]}`);
