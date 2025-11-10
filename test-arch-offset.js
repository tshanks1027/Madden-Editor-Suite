const fs = require('fs');
const path = require('path');
const Decompressor = require('./src/main/lib/draft-class/Decompressor.js');

const filePath = 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden NFL 26\\Saves\\CAREERDRAFT-2020DRAFT';
console.log(`Reading file: ${filePath}`);

const fileBuffer = fs.readFileSync(filePath);
const decompressed = Decompressor.decompress(fileBuffer);

console.log(`Decompressed size: ${decompressed.length} bytes`);

// Joe Burrow is prospect #1 (index 0)
// Data starts at offset 0x3011 (header.dataStartOffset)
// First block starts at 0x3011
// Attributes at block + 0x1000 = 0x4011

const blockStart = 0x3011;
const attrOffset = blockStart + 0x1000; // 0x4011

console.log(`\nJoe Burrow attribute area (offset 0x${attrOffset.toString(16)}):`);
console.log('Bytes 0x49-0x52 (archetype candidates):');
for (let i = 0x49; i <= 0x52; i++) {
  const value = decompressed[attrOffset + i];
  console.log(`  0x${i.toString(16).padStart(2, '0')}: ${value.toString().padStart(3)} (0x${value.toString(16).padStart(2, '0').toUpperCase()})`);
}

// Also check Tua (prospect #5, index 4)
const tuaBlockStart = 0x3011 + (4 * 4296);
const tuaAttrOffset = tuaBlockStart + 0x1000;

console.log(`\nTua Tagovailoa attribute area (offset 0x${tuaAttrOffset.toString(16)}):`);
console.log('Bytes 0x49-0x52 (archetype candidates):');
for (let i = 0x49; i <= 0x52; i++) {
  const value = decompressed[tuaAttrOffset + i];
  console.log(`  0x${i.toString(16).padStart(2, '0')}: ${value.toString().padStart(3)} (0x${value.toString(16).padStart(2, '0').toUpperCase()})`);
}
