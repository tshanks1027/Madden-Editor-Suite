/**
 * Verify round field at 0x50 across all rounds and UDFAs
 */
const fs = require('fs');

const realPath = 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden NFL 26\\Saves\\CAREERDRAFT-2026NOV22';
const real = fs.readFileSync(realPath);

const HEADER = 0x46;
const BLOCK_SIZE = 4296;
const ATTR_OFFSET = 0x1000;

console.log('=== Verifying Round Field at 0x50 ===\n');

// Check first pick of each round
console.log('First pick of each round:');
console.log('Round | Block | 0x4e (pick) | 0x4f | 0x50 | Name');
console.log('------|-------|-------------|------|------|-----');

for (let round = 1; round <= 7; round++) {
  const firstOfRound = (round - 1) * 32;
  const blockStart = HEADER + (firstOfRound * BLOCK_SIZE);
  const attrStart = blockStart + ATTR_OFFSET;

  if (attrStart + 0x60 < real.length) {
    const firstName = real.toString('ascii', attrStart, attrStart + 0x11).replace(/\0/g, '').trim();
    const lastName = real.toString('ascii', attrStart + 0x11, attrStart + 0x26).replace(/\0/g, '').trim();
    const byte4e = real[attrStart + 0x4e]; // draftPick
    const byte4f = real[attrStart + 0x4f];
    const byte50 = real[attrStart + 0x50];

    console.log(`${round.toString().padStart(5)} | ${(firstOfRound + 1).toString().padStart(5)} | ${byte4e.toString().padStart(11)} | ${byte4f.toString().padStart(4)} | ${byte50.toString().padStart(4)} | ${firstName} ${lastName}`);
  }
}

// Check UDFAs (players after pick 224)
console.log('\n\nUDFAs (prospects after 224):');
console.log('Block | 0x4e (pick) | 0x4f | 0x50 | Name');
console.log('------|-------------|------|------|-----');

for (let i = 224; i < 260; i++) {
  const blockStart = HEADER + (i * BLOCK_SIZE);
  const attrStart = blockStart + ATTR_OFFSET;

  if (attrStart + 0x60 < real.length) {
    const firstName = real.toString('ascii', attrStart, attrStart + 0x11).replace(/\0/g, '').trim();
    const lastName = real.toString('ascii', attrStart + 0x11, attrStart + 0x26).replace(/\0/g, '').trim();
    const byte4e = real[attrStart + 0x4e];
    const byte4f = real[attrStart + 0x4f];
    const byte50 = real[attrStart + 0x50];

    // Skip empty blocks
    if (firstName.length === 0) continue;

    console.log(`${(i + 1).toString().padStart(5)} | ${byte4e.toString().padStart(11)} | ${byte4f.toString().padStart(4)} | ${byte50.toString().padStart(4)} | ${firstName} ${lastName}`);
  }
}

// Check around transition from drafted to UDFA
console.log('\n\nTransition area (around pick 220-250):');
console.log('Block | 0x4e (pick) | 0x4f | 0x50 | OVR (0x51) | Name');
console.log('------|-------------|------|------|------------|-----');

for (let i = 220; i < 260; i++) {
  const blockStart = HEADER + (i * BLOCK_SIZE);
  const attrStart = blockStart + ATTR_OFFSET;

  if (attrStart + 0x60 < real.length) {
    const firstName = real.toString('ascii', attrStart, attrStart + 0x11).replace(/\0/g, '').trim();
    if (!firstName) continue;

    const lastName = real.toString('ascii', attrStart + 0x11, attrStart + 0x26).replace(/\0/g, '').trim();
    const byte4e = real[attrStart + 0x4e];
    const byte4f = real[attrStart + 0x4f];
    const byte50 = real[attrStart + 0x50];
    const byte51 = real[attrStart + 0x51];

    console.log(`${(i + 1).toString().padStart(5)} | ${byte4e.toString().padStart(11)} | ${byte4f.toString().padStart(4)} | ${byte50.toString().padStart(4)} | ${byte51.toString().padStart(10)} | ${firstName} ${lastName}`);
  }
}

// Also check if 0x4d might store round (check all picks)
console.log('\n\n=== Checking 0x4d pattern ===');
console.log('Block | 0x4d | 0x4e | Expected Round | Name');
console.log('------|------|------|----------------|-----');

for (let i = 0; i < 100; i++) {
  const blockStart = HEADER + (i * BLOCK_SIZE);
  const attrStart = blockStart + ATTR_OFFSET;

  if (attrStart + 0x60 < real.length) {
    const firstName = real.toString('ascii', attrStart, attrStart + 0x11).replace(/\0/g, '').trim();
    if (!firstName) continue;

    const byte4d = real[attrStart + 0x4d];
    const byte4e = real[attrStart + 0x4e];
    const expectedRound = Math.floor(i / 32) + 1;

    console.log(`${(i + 1).toString().padStart(5)} | ${byte4d.toString().padStart(4)} | ${byte4e.toString().padStart(4)} | ${expectedRound.toString().padStart(14)} | ${firstName}`);
  }
}
