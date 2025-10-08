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

console.log('Searching for value 30 (0x1E) in Todd Shanks block...\n');
console.log(`Todd's block: 0x${toddBlockStart.toString(16)} - 0x${toddBlockEnd.toString(16)}`);
console.log(`Todd's attributes start: 0x${toddAttributeStart.toString(16)}\n`);

console.log('=== ALL INSTANCES OF 30 (0x1E) IN TODD\'S BLOCK ===');
let count = 0;
for (let i = toddBlockStart; i < toddBlockEnd && i < buffer.length; i++) {
  if (buffer[i] === 30) {
    const offsetFromBlock = i - toddBlockStart;
    const offsetFromAttr = i - toddAttributeStart;
    console.log(`Found 30 at 0x${i.toString(16)} (block + 0x${offsetFromBlock.toString(16)}, attr + 0x${offsetFromAttr.toString(16)})`);
    count++;
  }
}
console.log(`\nTotal: ${count} instances of 30 in Todd's block`);

// Also check what's at offset 0x6C (where we think throwPower is)
console.log(`\n=== CURRENT MAPPING ===`);
console.log(`At offset +0x6C (throwPower): ${buffer[toddAttributeStart + 0x6C]}`);
console.log(`At offset +0x8D (injury): ${buffer[toddAttributeStart + 0x8D]}`);
