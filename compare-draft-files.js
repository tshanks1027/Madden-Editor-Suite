/**
 * Compare original vs edited M26 draft class files
 * to find where draft order is stored
 */
const fs = require('fs');

function hexDump(buffer, offset, length) {
  let result = '';
  for (let i = 0; i < length; i += 16) {
    const lineOffset = offset + i;
    const hexPart = [];
    const asciiPart = [];

    for (let j = 0; j < 16 && (i + j) < length; j++) {
      const byte = buffer[lineOffset + j];
      hexPart.push(byte.toString(16).padStart(2, '0'));
      asciiPart.push(byte >= 32 && byte < 127 ? String.fromCharCode(byte) : '.');
    }

    result += `${lineOffset.toString(16).padStart(6, '0')}: ${hexPart.join(' ').padEnd(48)} ${asciiPart.join('')}\n`;
  }
  return result;
}

const originalFile = 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/CAREERDRAFT-2026NOV22';
const editedFile = 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/CAREERDRAFT-EDITED';

const originalBuffer = fs.readFileSync(originalFile);
const editedBuffer = fs.readFileSync(editedFile);

console.log('=== COMPARING ORIGINAL vs EDITED M26 DRAFT CLASS ===\n');
console.log(`Original: ${originalFile} (${originalBuffer.length} bytes)`);
console.log(`Edited: ${editedFile} (${editedBuffer.length} bytes)\n`);

const BLOCK_SIZE = 4296;
const ATTR_OFFSET = 0x1000;
const DATA_START = 0x34;

// Compare first 10 blocks
console.log('=== COMPARING FIRST 10 BLOCKS ===\n');

for (let blockNum = 0; blockNum < 10; blockNum++) {
  const blockAttrStart = DATA_START + (blockNum * BLOCK_SIZE) + ATTR_OFFSET;

  const origFirst = originalBuffer.toString('ascii', blockAttrStart, blockAttrStart + 0x11).replace(/\0/g, '').trim();
  const origLast = originalBuffer.toString('ascii', blockAttrStart + 0x11, blockAttrStart + 0x26).replace(/\0/g, '').trim();

  const editFirst = editedBuffer.toString('ascii', blockAttrStart, blockAttrStart + 0x11).replace(/\0/g, '').trim();
  const editLast = editedBuffer.toString('ascii', blockAttrStart + 0x11, blockAttrStart + 0x26).replace(/\0/g, '').trim();

  const sameName = (origFirst === editFirst && origLast === editLast);

  console.log(`Block ${blockNum}:`);
  console.log(`  Original: ${origFirst} ${origLast}`);
  console.log(`  Edited:   ${editFirst} ${editLast}`);
  console.log(`  Same: ${sameName ? 'YES' : 'NO - DIFFERENT!'}`);

  // Check draft-related bytes
  console.log('  Draft bytes (0x4d-0x51):');
  for (let offset = 0x4d; offset <= 0x51; offset++) {
    const origVal = originalBuffer[blockAttrStart + offset];
    const editVal = editedBuffer[blockAttrStart + offset];
    const diff = origVal !== editVal ? ' <-- DIFFERENT!' : '';
    console.log(`    0x${offset.toString(16)}: orig=${origVal.toString().padStart(3)}, edit=${editVal.toString().padStart(3)}${diff}`);
  }
  console.log('');
}

// Find ALL byte differences in the attribute sections
console.log('\n=== FINDING ALL BYTE DIFFERENCES IN ATTRIBUTES ===\n');

let totalDiffs = 0;
const diffsByOffset = {};

for (let blockNum = 0; blockNum < 402; blockNum++) {
  const blockAttrStart = DATA_START + (blockNum * BLOCK_SIZE) + ATTR_OFFSET;

  if (blockAttrStart + 200 >= originalBuffer.length || blockAttrStart + 200 >= editedBuffer.length) break;

  for (let offset = 0; offset < 200; offset++) {
    const origVal = originalBuffer[blockAttrStart + offset];
    const editVal = editedBuffer[blockAttrStart + offset];

    if (origVal !== editVal) {
      totalDiffs++;
      const key = `0x${offset.toString(16).padStart(2, '0')}`;
      if (!diffsByOffset[key]) {
        diffsByOffset[key] = { count: 0, examples: [] };
      }
      diffsByOffset[key].count++;
      if (diffsByOffset[key].examples.length < 3) {
        const firstName = originalBuffer.toString('ascii', blockAttrStart, blockAttrStart + 0x11).replace(/\0/g, '').trim();
        diffsByOffset[key].examples.push({ block: blockNum, name: firstName, orig: origVal, edit: editVal });
      }
    }
  }
}

console.log(`Total byte differences: ${totalDiffs}\n`);
console.log('Differences by offset (sorted by count):');

const sortedOffsets = Object.entries(diffsByOffset).sort((a, b) => b[1].count - a[1].count);

for (const [offset, data] of sortedOffsets.slice(0, 20)) {
  console.log(`\n${offset}: ${data.count} differences`);
  for (const ex of data.examples) {
    console.log(`  Block ${ex.block} (${ex.name}): ${ex.orig} -> ${ex.edit}`);
  }
}

// Also check if the BLOCK ORDER changed (different names in same block positions)
console.log('\n\n=== CHECKING IF BLOCK ORDER CHANGED ===\n');

let orderChanged = false;
for (let blockNum = 0; blockNum < 20; blockNum++) {
  const blockAttrStart = DATA_START + (blockNum * BLOCK_SIZE) + ATTR_OFFSET;

  const origFirst = originalBuffer.toString('ascii', blockAttrStart, blockAttrStart + 0x11).replace(/\0/g, '').trim();
  const editFirst = editedBuffer.toString('ascii', blockAttrStart, blockAttrStart + 0x11).replace(/\0/g, '').trim();

  if (origFirst !== editFirst) {
    orderChanged = true;
    console.log(`Block ${blockNum}: "${origFirst}" -> "${editFirst}"`);
  }
}

if (!orderChanged) {
  console.log('Block order appears UNCHANGED (same names in same positions)');
}
