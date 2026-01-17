/**
 * Verify the 18-byte block header theory
 *
 * Hypothesis: Each block has an 18-byte header before the visual JSON
 * Block structure:
 *   0x00 - 0x11: Block header (18 bytes)
 *   0x12 - ???: Visual JSON
 *   0x1000+: Attribute data (starts at fixed offset from block start)
 */
const fs = require('fs');

const testFile = 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/CAREERDRAFT-2026NOV22';
const buffer = fs.readFileSync(testFile);

const BLOCK_SIZE = 4296;
const DATA_START = 52;

console.log('=== VERIFYING BLOCK HEADER STRUCTURE ===\n');

// Check first 3 blocks
for (let blockNum = 0; blockNum < 5; blockNum++) {
  const blockStart = DATA_START + (blockNum * BLOCK_SIZE);

  console.log(`=== BLOCK ${blockNum} (starts at 0x${blockStart.toString(16)}) ===`);

  // Dump first 32 bytes (potential header + JSON start)
  console.log('First 32 bytes:');
  for (let i = 0; i < 32; i += 16) {
    let hex = '';
    let ascii = '';
    for (let j = 0; j < 16; j++) {
      const b = buffer[blockStart + i + j];
      hex += b.toString(16).padStart(2, '0') + ' ';
      ascii += (b >= 32 && b < 127) ? String.fromCharCode(b) : '.';
    }
    console.log(`  0x${i.toString(16).padStart(2, '0')}: ${hex} ${ascii}`);
  }

  // Check if JSON starts at offset 0x12
  const jsonCheckOffset = blockStart + 0x12;
  const jsonCheck = buffer.toString('ascii', jsonCheckOffset, jsonCheckOffset + 20);
  console.log(`\nByte 0x12: ${buffer[blockStart + 0x12].toString(16)} ('${buffer[blockStart + 0x12] === 0x7B ? '{' : '?'}')`);
  console.log(`JSON check at 0x12: "${jsonCheck}..."`);

  // Read firstName from offset 0x1000
  const attrOffset = blockStart + 0x1000;
  const fn = buffer.toString('ascii', attrOffset, attrOffset + 0x11).replace(/\0/g, '').trim();
  const ln = buffer.toString('ascii', attrOffset + 0x11, attrOffset + 0x26).replace(/\0/g, '').trim();

  console.log(`\nAttribute data at 0x1000:`);
  console.log(`  firstName (0x00): "${fn}"`);
  console.log(`  lastName (0x11): "${ln}"`);

  // Wait - firstName is empty. Let me check if there's a different offset
  // Maybe the name is further into the attribute section?

  // Let's search for where the name actually is
  const searchRange = 100;
  console.log(`\nSearching for name data in attribute section (first ${searchRange} bytes):`);
  let nameFound = false;
  for (let offset = 0; offset < searchRange; offset++) {
    const testFn = buffer.toString('ascii', attrOffset + offset, attrOffset + offset + 10).replace(/\0/g, '').trim();
    if (testFn.length >= 3 && /^[A-Za-z]+$/.test(testFn)) {
      console.log(`  Potential name at +0x${offset.toString(16)}: "${testFn}"`);
      nameFound = true;
      if (nameFound) break;
    }
  }

  console.log('');
}

// Dump the attribute area more carefully
console.log('\n=== DETAILED ATTRIBUTE DUMP FOR BLOCK 0 ===\n');

const block0AttrStart = DATA_START + 0x1000;

// The issue might be that the parser reads the wrong section
// Let me dump the area around where "Fernando" was found (0x1046)
console.log('Dumping bytes from 0x1034 to 0x10C8 (200 bytes of attributes):');

for (let i = 0; i < 200; i += 16) {
  const offset = block0AttrStart + i;
  let hex = '';
  let ascii = '';
  for (let j = 0; j < 16 && i + j < 200; j++) {
    const b = buffer[offset + j];
    hex += b.toString(16).padStart(2, '0') + ' ';
    ascii += (b >= 32 && b < 127) ? String.fromCharCode(b) : '.';
  }
  const globalOff = (DATA_START + 0x1000 + i).toString(16).padStart(4, '0');
  const relOff = i.toString(16).padStart(2, '0');
  console.log(`${globalOff} (+0x${relOff}): ${hex} ${ascii}`);
}

// The firstName starts at +0x12 within the attribute section
// Let's recalculate
console.log('\n=== TRYING DIFFERENT ATTRIBUTE OFFSETS ===\n');

// What if the attribute section ALSO has an 18-byte header?
const testOffsets = [0x00, 0x12, 0x14, 0x16];

for (const baseOffset of testOffsets) {
  const fn = buffer.toString('ascii', block0AttrStart + baseOffset, block0AttrStart + baseOffset + 17).replace(/\0/g, '').trim();
  const ln = buffer.toString('ascii', block0AttrStart + baseOffset + 0x11, block0AttrStart + baseOffset + 0x26).replace(/\0/g, '').trim();
  console.log(`Base offset +0x${baseOffset.toString(16).padStart(2, '0')}: firstName="${fn}", lastName="${ln}"`);
}

// It looks like the names are at +0x12 within the attribute section too!
// So the attribute section has the same 18-byte header as the visual section
console.log('\n=== HYPOTHESIS: Both visual and attribute sections have 18-byte headers ===\n');

const HEADER_SIZE = 18;  // 0x12
const newAttrStart = block0AttrStart + HEADER_SIZE;

const firstName = buffer.toString('ascii', newAttrStart, newAttrStart + 17).replace(/\0/g, '').trim();
const lastName = buffer.toString('ascii', newAttrStart + 0x11, newAttrStart + 0x26).replace(/\0/g, '').trim();
const homeState = buffer[newAttrStart + 0x26];
const college = buffer[newAttrStart + 0x42];
const age = buffer[newAttrStart + 0x46];
const heightInches = buffer[newAttrStart + 0x47];
const weight = buffer[newAttrStart + 0x48] + 160;
const position = buffer[newAttrStart + 0x4a];

console.log(`With +0x12 offset adjustment:`);
console.log(`  firstName: "${firstName}"`);
console.log(`  lastName: "${lastName}"`);
console.log(`  homeState: ${homeState}`);
console.log(`  college: ${college}`);
console.log(`  age: ${age}`);
console.log(`  heightInches: ${heightInches}`);
console.log(`  weight: ${weight}`);
console.log(`  position: ${position}`);
