const fs = require('fs');

// Read a working draft class file
const buffer = fs.readFileSync('C:\\Users\\tshan\\OneDrive\\Documents\\Madden Files\\1994 Mod V3\\Draft Classes\\CAREERDRAFT-2012V1');

console.log('Verifying M26 block size...\n');

// Find first few player names
const names = ['Andrew', 'Robert', 'Trent', 'Morris'];
const positions = [];

for (const name of names) {
  const pos = buffer.indexOf(Buffer.from(name, 'ascii'));
  if (pos !== -1) {
    positions.push({ name, pos });
  }
}

console.log('Name positions:');
positions.forEach(p => console.log(`  ${p.name}: 0x${p.pos.toString(16)} (${p.pos})`));

if (positions.length >= 2) {
  const p1 = positions[0];
  const p2 = positions[1];

  // If both names are at offset 0x1000 within their blocks:
  // block0_start = p1.pos - 0x1000
  // block1_start = p2.pos - 0x1000
  // block_size = block1_start - block0_start

  const block0Start = p1.pos - 0x1000;
  const block1Start = p2.pos - 0x1000;
  const actualBlockSize = block1Start - block0Start;

  console.log('\nCalculated block boundaries:');
  console.log(`  ${p1.name} block start: 0x${block0Start.toString(16)}`);
  console.log(`  ${p2.name} block start: 0x${block1Start.toString(16)}`);
  console.log(`  ACTUAL BLOCK SIZE: ${actualBlockSize} bytes (0x${actualBlockSize.toString(16)})`);

  console.log('\n=== VERIFICATION ===');
  console.log(`M26Parser/Writer use BLOCK_SIZE = 4296 (0x10C8)`);
  console.log(`Actual block size is: ${actualBlockSize} (0x${actualBlockSize.toString(16)})`);

  if (actualBlockSize !== 4296) {
    console.log(`\n*** ERROR: Block size mismatch! ***`);
    console.log(`Difference: ${actualBlockSize - 4296} bytes`);
    console.log(`This explains why data is misaligned!`);
  }
}

// Also verify with more positions
console.log('\n=== BLOCK BOUNDARIES FOR FIRST 10 PROSPECTS ===');
const headerOffset = 0x46;
const calculatedBlockSize = 4322; // What I calculated

for (let i = 0; i < 10; i++) {
  const blockStart = headerOffset + (i * calculatedBlockSize);
  const attrOffset = blockStart + 0x1000;

  if (attrOffset + 50 > buffer.length) break;

  const firstName = buffer.toString('ascii', attrOffset, attrOffset + 0x11).replace(/\0/g, '');
  const lastName = buffer.toString('ascii', attrOffset + 0x11, attrOffset + 0x26).replace(/\0/g, '');
  const draftPick = buffer[attrOffset + 0x4e];
  const speed = buffer[attrOffset + 0x7B];

  console.log(`Block ${i}: "${firstName} ${lastName}" | draftPick=${draftPick} | speed=${speed}`);
}
