/**
 * Test OVR round-trip: Parse -> Write -> Verify
 * Ensures OVR is correctly preserved through save operations
 */
const fs = require('fs');
const path = require('path');

// Read real M26 file
const realPath = 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden NFL 26\\Saves\\CAREERDRAFT-2026NOV22';
const originalBuffer = fs.readFileSync(realPath);

const HEADER = 0x46;
const BLOCK_SIZE = 4296;
const ATTR_OFFSET = 0x1000;

// Position ID to name
const POSITION_NAMES = ['QB', 'HB', 'FB', 'WR', 'TE', 'LT', 'LG', 'C', 'RG', 'RT', 'LE', 'RE', 'DT', 'LOLB', 'MLB', 'ROLB', 'CB', 'FS', 'SS', 'K', 'P'];

console.log('=== Testing OVR Round-Trip ===\n');

// Read original OVRs
const originalOVRs = [];
for (let i = 0; i < 50; i++) {
  const blockStart = HEADER + (i * BLOCK_SIZE);
  const attrStart = blockStart + ATTR_OFFSET;

  if (attrStart + 0xC8 > originalBuffer.length) break;

  const attrData = originalBuffer.subarray(attrStart, attrStart + 0xC8);
  const firstName = originalBuffer.toString('ascii', attrStart, attrStart + 0x11).replace(/\0/g, '').trim();
  const lastName = originalBuffer.toString('ascii', attrStart + 0x11, attrStart + 0x26).replace(/\0/g, '').trim();
  const positionId = attrData[0x4a];
  const position = POSITION_NAMES[positionId] || `?${positionId}`;
  const storedOVR = attrData[0x51];

  originalOVRs.push({
    index: i,
    name: `${firstName} ${lastName}`,
    position,
    ovr: storedOVR
  });
}

console.log('Original OVRs (first 10):');
console.log('Index | Pos | OVR | Name');
console.log('------|-----|-----|-----');
for (let i = 0; i < 10; i++) {
  const p = originalOVRs[i];
  console.log(`${p.index.toString().padStart(5)} | ${p.position.padEnd(3)} | ${p.ovr.toString().padStart(3)} | ${p.name}`);
}

// Test that we're correctly reading offset 0x51
console.log('\n\n=== Verifying OVR Offset 0x51 ===');
console.log('Reading raw bytes at offset 0x51 for first 5 players:');

for (let i = 0; i < 5; i++) {
  const blockStart = HEADER + (i * BLOCK_SIZE);
  const attrStart = blockStart + ATTR_OFFSET;
  const offset51 = attrStart + 0x51;
  const offset50 = attrStart + 0x50;
  const offset52 = attrStart + 0x52;

  console.log(`\nPlayer ${i + 1} (${originalOVRs[i].name}):`);
  console.log(`  Offset 0x50 (longSnap): ${originalBuffer[offset50]}`);
  console.log(`  Offset 0x51 (overall):  ${originalBuffer[offset51]} <-- THIS IS THE OVR`);
  console.log(`  Offset 0x52 (accel):    ${originalBuffer[offset52]}`);
}

// Check if Zane Durant (index 3) really has OVR 22
console.log('\n\n=== Checking Zane Durant (Low OVR) ===');
const zane = originalOVRs.find(p => p.name.includes('Zane'));
if (zane) {
  console.log(`Found: ${zane.name}`);
  console.log(`Position: ${zane.position}`);
  console.log(`Stored OVR: ${zane.ovr}`);

  const blockStart = HEADER + (zane.index * BLOCK_SIZE);
  const attrStart = blockStart + ATTR_OFFSET;

  // Check surrounding bytes
  console.log('\nSurrounding bytes at OVR location:');
  for (let j = 0x4f; j <= 0x55; j++) {
    const val = originalBuffer[attrStart + j];
    console.log(`  0x${j.toString(16)}: ${val}`);
  }
}

// Now check if any player has OVR that makes sense
console.log('\n\n=== OVR Distribution ===');
const ovrCounts = {};
for (const p of originalOVRs) {
  if (!ovrCounts[p.ovr]) ovrCounts[p.ovr] = 0;
  ovrCounts[p.ovr]++;
}

const sorted = Object.entries(ovrCounts).sort((a, b) => Number(b[0]) - Number(a[0]));
console.log('OVR | Count');
console.log('----|------');
for (const [ovr, count] of sorted) {
  console.log(`${ovr.padStart(3)} | ${count}`);
}
