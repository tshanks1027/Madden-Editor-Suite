const fs = require('fs');

const filePath = 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden NFL 26\\Saves\\CAREERDRAFT-EDITED';
const buffer = fs.readFileSync(filePath);

const DATA_START = 0x46;
const BLOCK_SIZE = 4296;
const ATTRIBUTE_OFFSET = 0x1000;

// Todd Shanks is prospect #1 (index 0)
const toddBlockStart = DATA_START;
const toddAttributeStart = toddBlockStart + ATTRIBUTE_OFFSET;
const toddBlockEnd = toddBlockStart + BLOCK_SIZE;

console.log('Searching for value 95 (0x5F) in Todd Shanks block...\n');
console.log(`Todd's block: 0x${toddBlockStart.toString(16)} - 0x${toddBlockEnd.toString(16)}`);
console.log(`Todd's attributes start: 0x${toddAttributeStart.toString(16)}\n`);

console.log('=== ALL INSTANCES OF 95 (0x5F) IN TODD\'S BLOCK ===');
let count = 0;
for (let i = toddBlockStart; i < toddBlockEnd && i < buffer.length; i++) {
  if (buffer[i] === 95) {
    const offsetFromBlock = i - toddBlockStart;
    const offsetFromAttr = i - toddAttributeStart;
    console.log(`Found 95 at 0x${i.toString(16)} (block + 0x${offsetFromBlock.toString(16)}, attr + 0x${offsetFromAttr.toString(16)})`);
    count++;
  }
}
console.log(`\nTotal: ${count} instances of 95 in Todd's block`);

console.log(`\n=== CURRENT MAPPING ===`);
console.log(`At offset +0x6C: ${buffer[toddAttributeStart + 0x6C]} (we think this is throwPower, but game shows 30)`);
console.log(`At offset +0x86: ${buffer[toddAttributeStart + 0x86]} (game ACTUALLY reads throwPower from here = 30)`);
console.log(`At offset +0x8D: ${buffer[toddAttributeStart + 0x8D]} (we think this is injury, but game shows 95)`);
