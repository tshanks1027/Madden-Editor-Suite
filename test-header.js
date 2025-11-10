const fs = require('fs');
const Decompressor = require('./src/main/lib/draft-class/Decompressor.js');
const FileParser = require('./src/main/lib/draft-class/FileParser.js');

const filePath = 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden NFL 26\\Saves\\CAREERDRAFT-2020DRAFT';
console.log(`Reading file: ${filePath}`);

const fileBuffer = fs.readFileSync(filePath);
const decompressed = Decompressor.decompress(fileBuffer);

console.log(`Decompressed size: ${decompressed.length} bytes`);

// Parse header
const header = FileParser.parseHeader(decompressed);

console.log('\nHeader:');
console.log(`  fileType: ${header.fileType}`);
console.log(`  year: ${header.year}`);
console.log(`  prospectCount: ${header.prospectCount}`);
console.log(`  dataStartOffset: 0x${header.dataStartOffset.toString(16)} (${header.dataStartOffset})`);

// Now calculate correct offsets
const blockStart = header.dataStartOffset;
const attrOffset = blockStart + 0x1000;

console.log(`\nJoe Burrow (Prospect #1):`);
console.log(`  Block starts at: 0x${blockStart.toString(16)}`);
console.log(`  Attributes at: 0x${attrOffset.toString(16)}`);
console.log('  Archetype area (0x49-0x52):');

for (let i = 0x49; i <= 0x52; i++) {
  const value = decompressed[attrOffset + i];
  console.log(`    0x${i.toString(16).padStart(2, '0')}: ${value.toString().padStart(3)} (0x${value.toString(16).padStart(2, '0').toUpperCase()})`);
}
