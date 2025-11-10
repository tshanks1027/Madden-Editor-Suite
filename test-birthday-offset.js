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

// Known birthdays for 2020 draft prospects
const prospects = [
  { name: 'Joe Burrow', index: 0, birthday: 19961210, age: 24 },      // Dec 10, 1996
  { name: 'Tua Tagovailoa', index: 4, birthday: 19980302, age: 22 },  // Mar 2, 1998
  { name: 'Justin Herbert', index: 5, birthday: 19980310, age: 22 }   // Mar 10, 1998
];

console.log('Testing birthday offset positions...\n');

// Try offsets around the known age field (0x46)
const testOffsets = [
  0x40, 0x41, 0x42, 0x43, 0x44, 0x45,  // Before age
  0x47, 0x48, 0x49, 0x4a,             // After age (0x4a is position)
  0x4d, 0x4e, 0x4f, 0x50,             // After jersey/draftPick
  0x8d, 0x8e, 0x8f, 0x90, 0x91        // Around devTrait (0x8c) and PID (0x92)
];

testOffsets.forEach(offset => {
  console.log(`\n=== Testing offset 0x${offset.toString(16)} ===`);

  prospects.forEach(prospect => {
    const blockStart = header.dataStartOffset + (prospect.index * BLOCK_SIZE);
    const attributeOffset = blockStart + 0x1000;

    // Read as uint32LE (birthday format YYYYMMDD)
    const value = buffer.readUInt32LE(attributeOffset + offset);

    // Check if this looks like a valid birthday
    const year = Math.floor(value / 10000);
    const month = Math.floor((value % 10000) / 100);
    const day = value % 100;

    const isValidBirthday = year >= 1990 && year <= 2010 && month >= 1 && month <= 12 && day >= 1 && day <= 31;
    const matchesExpected = value === prospect.birthday;

    console.log(`${prospect.name}: ${value} (Year: ${year}, Month: ${month}, Day: ${day}) ${matchesExpected ? '✓ MATCH!' : ''} ${isValidBirthday ? '(valid)' : ''}`);
  });
});
