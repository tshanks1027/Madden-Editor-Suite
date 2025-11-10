const fs = require('fs');
const path = require('path');
const Decompressor = require('./src/main/lib/draft-class/Decompressor.js');
const FileParser = require('./src/main/lib/draft-class/FileParser.js');
const { parseHeader } = require('./src/main/lib/draft-class/draftClassFunctions.js');

const filePath = 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden NFL 26\\Saves\\CAREERDRAFT-2020DRAFT';

// Read and decompress
const compressed = fs.readFileSync(filePath);
const buffer = Decompressor.decompress(compressed);

console.log(`Decompressed size: ${buffer.length} bytes`);

// Parse header
const parser = new FileParser(buffer);
const header = parseHeader(parser);

console.log(`Header dataStartOffset: 0x${header.dataStartOffset.toString(16)}`);

// Constants from M26Parser
const BLOCK_SIZE = 4296;

// Check Joe Burrow (prospect #0)
const blockStart = header.dataStartOffset;
const attributeOffset = blockStart + 0x1000; // 4096 bytes

console.log(`\n=== Joe Burrow (Prospect #1) ===`);
console.log(`Block start: 0x${blockStart.toString(16)}`);
console.log(`Attribute offset: 0x${attributeOffset.toString(16)}`);

// Read archetype area bytes
console.log('\nArchetype area bytes (0x49-0x52):');
for (let i = 0x49; i <= 0x52; i++) {
  const value = buffer[attributeOffset + i];
  console.log(`  ${attributeOffset.toString(16)}+0x${i.toString(16).padStart(2, '0')} = 0x${(attributeOffset + i).toString(16)}: ${value.toString().padStart(3)} (0x${value.toString(16).padStart(2, '0').toUpperCase()})`);
}

// Also check position which we know is correct
const positionValue = buffer[attributeOffset + 0x4a];
console.log(`\nPosition byte (0x4a): ${positionValue} (should be 0 for QB)`);
