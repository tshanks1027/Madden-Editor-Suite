/**
 * Analyze M26 attribute offsets by comparing known players with expected values
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

const testFile = process.argv[2] || 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/CAREERDRAFT-2026NOV22';
const buffer = fs.readFileSync(testFile);

const BLOCK_SIZE = 4296;
const ATTR_OFFSET = 0x1000;
const DATA_START = 0x34;

// Known player data for Fernando Mendoza (Block 0)
// From game: Should be QB, likely pick 1 round 1
const knownPlayers = [
  { block: 0, name: 'Fernando Mendoza', expectedPosition: 0, expectedSpeed: 77 },  // QB
  { block: 2, name: 'Rueben Baines', expectedPosition: 3, expectedSpeed: 93 },      // WR
];

console.log('=== M26 ATTRIBUTE OFFSET ANALYSIS ===\n');

// Dump full 200-byte attribute section for first player
const attrStart = DATA_START + ATTR_OFFSET;
console.log('=== FULL ATTRIBUTE SECTION (200 bytes) for Block 0 ===\n');
console.log(hexDump(buffer, attrStart, 200));

// Now let's find where position and speed actually are
console.log('\n=== SEARCHING FOR KNOWN VALUES ===\n');

// For Fernando Mendoza (QB), we expect:
// - Position = 0 (QB)
// - Speed likely 77-80 range based on typical QB
// - OVR likely 70-80 range

// Let's look for patterns by checking every byte
console.log('Block 0 - Checking all 200 attribute bytes:\n');

for (let offset = 0; offset < 200; offset++) {
  const val = buffer[attrStart + offset];
  if (val >= 70 && val <= 99) {
    console.log(`  0x${offset.toString(16).padStart(2, '0')} (${offset}): ${val} - potential rating`);
  }
}

// Also check for common position values
console.log('\n\nLooking for position field (value 0-20):');
for (let offset = 0x40; offset < 0x60; offset++) {
  const val = buffer[attrStart + offset];
  if (val <= 20) {
    console.log(`  0x${offset.toString(16).padStart(2, '0')}: ${val}`);
  }
}

// Try to identify draft fields by checking patterns across multiple blocks
console.log('\n\n=== CHECKING DRAFT FIELD PATTERNS ACROSS BLOCKS ===\n');
console.log('If block position = draft position, then:');
console.log('- First few blocks should have lower pick/round values');
console.log('- Later blocks (UDFAs) should have round = 63\n');

for (let blockNum = 0; blockNum < 5; blockNum++) {
  const blockAttrStart = DATA_START + (blockNum * BLOCK_SIZE) + ATTR_OFFSET;

  const firstName = buffer.toString('ascii', blockAttrStart, blockAttrStart + 0x11).replace(/\0/g, '').trim();
  const lastName = buffer.toString('ascii', blockAttrStart + 0x11, blockAttrStart + 0x26).replace(/\0/g, '').trim();

  console.log(`Block ${blockNum}: ${firstName} ${lastName}`);

  // Check bytes from 0x42 to 0x60 for position/draft info
  console.log('  Bytes 0x42-0x54:');
  for (let i = 0x42; i <= 0x54; i++) {
    const val = buffer[blockAttrStart + i];
    if (val !== 0) {
      console.log(`    0x${i.toString(16)}: ${val}`);
    }
  }
  console.log('');
}

// Try reading with M25-style sequential structure
console.log('\n=== TRYING M25-STYLE SEQUENTIAL READ ===\n');

// M25 structure starts right after names:
// firstName: 0x00-0x10 (17 bytes)
// lastName: 0x11-0x25 (21 bytes)
// homeState: 0x26 (1 byte)
// homeTown: 0x27-0x41 (27 bytes)
// college: 0x42-0x43 (2 bytes, UShort)
// birthDate: 0x44-0x45 (2 bytes)
// age: 0x46 (1 byte)
// heightInches: 0x47 (1 byte)
// weight: 0x48-0x49 (2 bytes)
// position: 0x4a (1 byte)
// archetype: 0x4b (1 byte)
// jerseyNum: 0x4c (1 byte)
// draftable: 0x4d (1 byte)
// draftPick: 0x4e-0x4f (2 bytes, UShort)
// draftRound: 0x50 (1 byte)
// overall: 0x51 (1 byte)

const block0AttrStart = DATA_START + ATTR_OFFSET;

console.log('Attempting M25-style read for Block 0:\n');

const firstName = buffer.toString('ascii', block0AttrStart, block0AttrStart + 0x11).replace(/\0/g, '').trim();
const lastName = buffer.toString('ascii', block0AttrStart + 0x11, block0AttrStart + 0x26).replace(/\0/g, '').trim();
const homeState = buffer[block0AttrStart + 0x26];
const homeTown = buffer.toString('ascii', block0AttrStart + 0x27, block0AttrStart + 0x42).replace(/\0/g, '').trim();
const college = buffer.readUInt16LE(block0AttrStart + 0x42);  // 2 bytes
const birthDate = buffer.readUInt16LE(block0AttrStart + 0x44);
const age = buffer[block0AttrStart + 0x46];
const heightInches = buffer[block0AttrStart + 0x47];
const weight = buffer.readUInt16LE(block0AttrStart + 0x48) + 160;
const position = buffer[block0AttrStart + 0x4a];
const archetype = buffer[block0AttrStart + 0x4b];
const jerseyNum = buffer[block0AttrStart + 0x4c];
const draftable = buffer[block0AttrStart + 0x4d];
const draftPick = buffer.readUInt16LE(block0AttrStart + 0x4e);
const draftRound = buffer[block0AttrStart + 0x50];
const overall = buffer[block0AttrStart + 0x51];

console.log(`Name: ${firstName} ${lastName}`);
console.log(`homeState: ${homeState}`);
console.log(`homeTown: "${homeTown}"`);
console.log(`college (0x42, 2 bytes): ${college}`);
console.log(`birthDate (0x44): ${birthDate}`);
console.log(`age (0x46): ${age}`);
console.log(`heightInches (0x47): ${heightInches}`);
console.log(`weight (0x48): ${weight}`);
console.log(`position (0x4a): ${position}`);
console.log(`archetype (0x4b): ${archetype}`);
console.log(`jerseyNum (0x4c): ${jerseyNum}`);
console.log(`draftable (0x4d): ${draftable}`);
console.log(`draftPick (0x4e, 2 bytes): ${draftPick}`);
console.log(`draftRound (0x50): ${draftRound}`);
console.log(`overall (0x51): ${overall}`);

// Now check what's after overall for the ratings
console.log('\n\nRatings section starting at 0x52:');
const ratingNames = [
  'acceleration', 'agility', 'awareness', 'ballCarrierVision',
  'blockShedding', 'breakSack', 'breakTackle', 'carrying',
  'catching', 'catchInTraffic', 'changeOfDirection', 'finesseMoves',
  'hitPower', 'impactBlocking', 'injury', 'jukeMove',
  'jumping', 'kickAccuracy', 'kickPower', 'kickReturn',
  'leadBlock', 'manCoverage', 'passBlockFinesse', 'passBlockPower'
];

for (let i = 0; i < 24; i++) {
  const offset = 0x52 + i;
  const val = buffer[block0AttrStart + offset];
  console.log(`  0x${offset.toString(16)} ${ratingNames[i] || 'unknown'}: ${val}`);
}
