/**
 * Analyze if block position determines draft order
 * Theory: Madden sorts by block position, using draftPick for display
 */
const fs = require('fs');

const realPath = 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden NFL 26\\Saves\\CAREERDRAFT-2026NOV22';
const real = fs.readFileSync(realPath);

const HEADER = 0x46;
const BLOCK_SIZE = 4296;
const ATTR_OFFSET = 0x1000;

console.log('=== Understanding Draft Order Structure ===\n');

// Check the boundary between round 7 and UDFAs
console.log('Boundary between Round 7 and UDFAs (blocks 220-260):');
console.log('Block | 0x4e | 0x4f | 0x50 | Type | Name');
console.log('------|------|------|------|------|-----');

for (let i = 220; i < 270; i++) {
  const blockStart = HEADER + (i * BLOCK_SIZE);
  const attrStart = blockStart + ATTR_OFFSET;

  if (attrStart + 0x60 < real.length) {
    const firstName = real.toString('ascii', attrStart, attrStart + 0x11).replace(/\0/g, '').trim();
    if (!firstName) continue;

    const byte4e = real[attrStart + 0x4e];
    const byte4f = real[attrStart + 0x4f];
    const byte50 = real[attrStart + 0x50];

    // Determine type
    let type;
    if (i < 224) {
      type = `R${Math.floor(i / 32) + 1}P${(i % 32) + 1}`;
    } else if (byte4f === 0 && byte4e > 0) {
      type = 'UDFA-listed';
    } else if (byte4f === 1 || byte4e === 0) {
      type = 'UDFA-true';
    } else {
      type = 'Unknown';
    }

    console.log(`${(i + 1).toString().padStart(5)} | ${byte4e.toString().padStart(4)} | ${byte4f.toString().padStart(4)} | ${byte4f.toString().padStart(4)} | ${type.padStart(10)} | ${firstName}`);
  }
}

// Theory: Block position = overall draft order
// Blocks 0-223 = 7 rounds * 32 picks = 224 picks
// Blocks 224+ = UDFAs

console.log('\n\n=== Summary ===');
console.log('Based on the data:');
console.log('- Blocks 0-31: Round 1 (picks 1-32), draftPick stores 1-32');
console.log('- Blocks 32-63: Round 2 (picks 33-64), draftPick stores 1-32');
console.log('- ... and so on ...');
console.log('- Blocks 192-223: Round 7 (picks 193-224), draftPick stores 1-32');
console.log('- Blocks 224+: UDFAs');
console.log('');
console.log('The game uses BLOCK POSITION to determine draft order!');
console.log('draftPick at 0x4e stores pick-within-round (1-32) for display.');
console.log('');
console.log('For our Writer, we need to:');
console.log('1. Sort prospects by overall pick (draftPick)');
console.log('2. Place Round 1 picks in blocks 0-31');
console.log('3. Place Round 2 picks in blocks 32-63');
console.log('4. ... and so on');
console.log('5. Place UDFAs (round=0 or pick=0) in blocks 224+');
console.log('6. Write pick-within-round to 0x4e');
