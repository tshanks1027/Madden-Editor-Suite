/**
 * Find where round number is stored in M26 attribute data
 */
const fs = require('fs');

const realPath = 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden NFL 26\\Saves\\CAREERDRAFT-2026NOV22';
const real = fs.readFileSync(realPath);

const HEADER = 0x46;
const BLOCK_SIZE = 4296;
const ATTR_OFFSET = 0x1000;

console.log('=== Finding Round Field in M26 ===\n');

// Compare byte values between Round 1 and Round 2 players
// Block 1 = Round 1, Pick 1
// Block 33 = Round 2, Pick 1

const block1AttrStart = HEADER + (0 * BLOCK_SIZE) + ATTR_OFFSET;
const block33AttrStart = HEADER + (32 * BLOCK_SIZE) + ATTR_OFFSET;

console.log('Comparing Block 1 (Round 1, Pick 1) vs Block 33 (Round 2, Pick 1):\n');

// Read both attribute sections
const attr1 = real.subarray(block1AttrStart, block1AttrStart + 200);
const attr33 = real.subarray(block33AttrStart, block33AttrStart + 200);

const firstName1 = real.toString('ascii', block1AttrStart, block1AttrStart + 0x11).replace(/\0/g, '').trim();
const firstName33 = real.toString('ascii', block33AttrStart, block33AttrStart + 0x11).replace(/\0/g, '').trim();

console.log(`Block 1: ${firstName1}`);
console.log(`Block 33: ${firstName33}`);
console.log('');

// Find bytes that differ and could represent round
console.log('Bytes that differ between Round 1 and Round 2 players:');
console.log('Offset | R1 Value | R2 Value | Difference');
console.log('-------|----------|----------|----------');

for (let i = 0x40; i < 0x60; i++) {
  // Focus on the area around known fields
  if (attr1[i] !== attr33[i]) {
    console.log(`0x${i.toString(16).padStart(2, '0')}   | ${attr1[i].toString().padStart(8)} | ${attr33[i].toString().padStart(8)} | ${attr33[i] - attr1[i]}`);
  }
}

// Check specific offsets
console.log('\n\nChecking specific offsets for first 40 prospects:');
console.log('Block | Round? (expected) | 0x4d | 0x4f | 0x4a(pos) | Name');
console.log('------|-------------------|------|------|-----------|-----');

for (let i = 0; i < 40; i++) {
  const blockStart = HEADER + (i * BLOCK_SIZE);
  const attrStart = blockStart + ATTR_OFFSET;

  const firstName = real.toString('ascii', attrStart, attrStart + 0x11).replace(/\0/g, '').trim();
  const lastName = real.toString('ascii', attrStart + 0x11, attrStart + 0x26).replace(/\0/g, '').trim();
  const byte4d = real[attrStart + 0x4d];
  const byte4e = real[attrStart + 0x4e]; // draftPick
  const byte4f = real[attrStart + 0x4f];
  const position = real[attrStart + 0x4a];

  const expectedRound = Math.floor(i / 32) + 1;

  console.log(`${(i + 1).toString().padStart(5)} | ${expectedRound.toString().padStart(17)} | ${byte4d.toString().padStart(4)} | ${byte4f.toString().padStart(4)} | ${position.toString().padStart(9)} | ${firstName} ${lastName}`);
}

// Check around offset 0x4d which is right before 0x4e (draftPick)
console.log('\n\nMost likely round field candidates near 0x4e (draftPick):');

for (let offset = 0x4c; offset <= 0x50; offset++) {
  console.log(`\nOffset 0x${offset.toString(16)}:`);
  for (let round = 1; round <= 3; round++) {
    const firstOfRound = (round - 1) * 32;
    const blockStart = HEADER + (firstOfRound * BLOCK_SIZE);
    const attrStart = blockStart + ATTR_OFFSET;

    if (attrStart + offset < real.length) {
      const value = real[attrStart + offset];
      const firstName = real.toString('ascii', attrStart, attrStart + 0x11).replace(/\0/g, '').trim();
      console.log(`  Round ${round}, Block ${firstOfRound + 1} (${firstName}): value = ${value}`);
    }
  }
}
