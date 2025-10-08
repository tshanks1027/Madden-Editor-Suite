const fs = require('fs');

const m26Path = 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden NFL 26\\Saves\\CAREERDRAFT-2026DRAFT7RND';
const m26 = fs.readFileSync(m26Path);

console.log('=== M26 vs M25 Structure Comparison ===\n');

console.log('M26 Structure:');
console.log('Product:', m26.toString('ascii', 0x22, 0x37).replace(/\0/g, ''));

// Check bytes before first prospect
console.log('\nBytes at 0x42-0x4A (before first JSON):');
const header = m26.subarray(0x42, 0x4A);
console.log('Hex:', header.toString('hex').match(/.{2}/g).join(' '));
console.log('As uint32 LE at 0x42:', m26.readUInt32LE(0x42));
console.log('As uint16 LE at 0x42:', m26.readUInt16LE(0x42));
console.log('As uint16 LE at 0x44:', m26.readUInt16LE(0x44));

// M26 uses FIXED blocks, but what size?
// Let's find all {"bodyType" occurrences
console.log('\n\nFinding all prospect starts ({"bodyType"):');
let offset = 0;
const prospects = [];
while (true) {
  const found = m26.indexOf(Buffer.from('{"bodyType"'), offset);
  if (found === -1) break;
  prospects.push(found);
  offset = found + 1;
  if (prospects.length > 10) break; // Just first 10
}

console.log('First 10 prospect offsets:');
prospects.forEach((pos, i) => {
  console.log(`  [${i + 1}] 0x${pos.toString(16).padStart(4, '0')} (${pos})`);
  if (i > 0) {
    const distance = pos - prospects[i - 1];
    console.log(`       Distance from previous: ${distance} bytes ${distance === 4322 ? '✓' : '✗'}`);
  }
});

// Calculate average distance
if (prospects.length > 1) {
  const distances = [];
  for (let i = 1; i < prospects.length; i++) {
    distances.push(prospects[i] - prospects[i - 1]);
  }
  const avg = distances.reduce((a, b) => a + b) / distances.length;
  console.log(`\nAverage distance: ${avg.toFixed(1)} bytes`);
  console.log(`Expected (M25): 4322 bytes`);
  console.log(`All same distance?`, distances.every(d => d === distances[0]));
}
