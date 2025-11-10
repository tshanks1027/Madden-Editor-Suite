const fs = require('fs');
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

const BLOCK_SIZE = 4296;

// Check first 5 prospects
const prospects = [
  { name: 'Joe Burrow', index: 0 },
  { name: 'Chase Young', index: 1 },
  { name: 'Jeff Okudah', index: 2 },
  { name: 'Andrew Thomas', index: 3 },
  { name: 'Tua Tagovailoa', index: 4 }
];

prospects.forEach(prospect => {
  const blockStart = header.dataStartOffset + (prospect.index * BLOCK_SIZE);
  const attributeOffset = blockStart + 0x1000;

  console.log(`\n=== ${prospect.name} (Prospect #${prospect.index + 1}) ===`);
  console.log(`Block start: 0x${blockStart.toString(16)}`);
  console.log(`Attribute offset: 0x${attributeOffset.toString(16)}`);

  // Read position (confirmed correct at 0x4a)
  const position = buffer[attributeOffset + 0x4a];
  const positionNames = ['QB', 'HB', 'FB', 'WR', 'TE', 'LT', 'LG', 'C', 'RG', 'RT', 'LE', 'REDG', 'DT', 'ROLB', 'MLB', 'LOLB', 'CB', 'FS', 'SS', 'K', 'P'];
  console.log(`Position (0x4a): ${position} = ${positionNames[position] || 'Unknown'}`);

  // Read bytes around archetype area
  console.log('Archetype area bytes (0x49-0x52):');
  for (let i = 0x49; i <= 0x52; i++) {
    const value = buffer[attributeOffset + i];
    const marker = (i === 0x4b) ? ' ← OLD OFFSET' : (i === 0x50) ? ' ← NEW OFFSET' : '';
    console.log(`  0x${i.toString(16).padStart(2, '0')}: ${value.toString().padStart(3)} (0x${value.toString(16).padStart(2, '0').toUpperCase()})${marker}`);
  }
});
