const fs = require('fs');
const Decompressor = require('./src/main/lib/draft-class/Decompressor.js');
const FileParser = require('./src/main/lib/draft-class/FileParser.js');
const { parseHeader } = require('./src/main/lib/draft-class/draftClassFunctions.js');

const filePath = 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden NFL 26\\Saves\\CAREERDRAFT-2020DRAFT';

// Read and decompress
const compressed = fs.readFileSync(filePath);
const buffer = Decompressor.decompress(compressed);

// Parse header
const parser = new FileParser(buffer);
const header = parseHeader(parser);

const BLOCK_SIZE = 4296;

// Check first 5 prospects
const prospects = [
  { name: 'Joe Burrow', index: 0, expectedArchetype: 'QB (0-4)' },
  { name: 'Chase Young', index: 1, expectedArchetype: 'DE (~33-40)' },
  { name: 'Jeff Okudah', index: 2, expectedArchetype: 'CB (~52-56)' },
  { name: 'Andrew Thomas', index: 3, expectedArchetype: 'OT (~29-32)' },
  { name: 'Tua Tagovailoa', index: 4, expectedArchetype: 'QB (0-4)' }
];

prospects.forEach(prospect => {
  const blockStart = header.dataStartOffset + (prospect.index * BLOCK_SIZE);
  const attributeOffset = blockStart + 0x1000;

  console.log(`\n=== ${prospect.name} - Expected: ${prospect.expectedArchetype} ===`);

  // Read position (confirmed correct at 0x4a)
  const position = buffer[attributeOffset + 0x4a];
  const positionNames = ['QB', 'HB', 'FB', 'WR', 'TE', 'LT', 'LG', 'C', 'RG', 'RT', 'LE', 'REDG', 'DT', 'ROLB', 'MLB', 'LOLB', 'CB', 'FS', 'SS', 'K', 'P'];
  console.log(`Position: ${positionNames[position]}`);

  // Try reading as uint8 at different offsets
  console.log('\nSingle-byte values:');
  for (let i = 0x49; i <= 0x52; i++) {
    const value = buffer[attributeOffset + i];
    console.log(`  0x${i.toString(16)}: ${value}`);
  }

  // Try reading as uint16 (little-endian) at different offsets
  console.log('\nTwo-byte (uint16LE) values:');
  for (let i = 0x49; i <= 0x51; i++) {
    const value = buffer.readUInt16LE(attributeOffset + i);
    console.log(`  0x${i.toString(16)}-0x${(i+1).toString(16)}: ${value}`);
  }
});
