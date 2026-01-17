/**
 * Full Round-Trip Test: Parse -> Write -> Verify
 * This tests the complete flow: M26Parser -> M26Writer -> verify OVR preserved
 */
const fs = require('fs');
const path = require('path');

// Import actual parser and writer
const { parseM26Prospects } = require('./src/main/lib/draft-class/M26Parser.js');
const { writeM26DraftClass } = require('./src/main/lib/draft-class/M26Writer.js');

// Read original M26 file
const realPath = 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden NFL 26\\Saves\\CAREERDRAFT-2026NOV22';
const originalBuffer = fs.readFileSync(realPath);

console.log('=== Full Round-Trip Test ===\n');
console.log(`Original file size: ${originalBuffer.length} bytes`);

// M26 file header
const HEADER_OFFSET = 0x46;  // Standard M26 data start offset

// Parse the file
console.log('\n--- Step 1: Parsing ---');
const header = { dataStartOffset: HEADER_OFFSET };
const prospects = parseM26Prospects(originalBuffer, header);
const parsed = { header, prospects };
console.log(`Parsed ${prospects.length} prospects`);

// Show first 10 prospects OVRs
console.log('\nOriginal OVRs from parser (first 10):');
console.log('Index | Pos | OVR | Name');
console.log('------|-----|-----|-----');
const POSITION_NAMES = ['QB', 'HB', 'FB', 'WR', 'TE', 'LT', 'LG', 'C', 'RG', 'RT', 'LE', 'RE', 'DT', 'LOLB', 'MLB', 'ROLB', 'CB', 'FS', 'SS', 'K', 'P'];

for (let i = 0; i < Math.min(10, parsed.prospects.length); i++) {
  const p = parsed.prospects[i];
  const pos = POSITION_NAMES[p.position] || `?${p.position}`;
  console.log(`${(i + 1).toString().padStart(5)} | ${pos.padEnd(3)} | ${(p.overall || 0).toString().padStart(3)} | ${p.firstName} ${p.lastName}`);
}

// Write back (without modifications)
console.log('\n--- Step 2: Writing (no modifications) ---');
const modifiedBuffer = writeM26DraftClass(originalBuffer, parsed.prospects, parsed.header);
console.log(`Modified buffer size: ${modifiedBuffer.length} bytes`);

// Verify OVRs are preserved
console.log('\n--- Step 3: Verifying OVRs preserved ---');
const HEADER = 0x46;
const BLOCK_SIZE = 4296;
const ATTR_OFFSET = 0x1000;

let mismatchCount = 0;
console.log('\nComparing written OVRs (first 20):');
console.log('Index | Original | Written | Match | Name');
console.log('------|----------|---------|-------|-----');

for (let i = 0; i < Math.min(20, parsed.prospects.length); i++) {
  const p = parsed.prospects[i];
  const blockStart = HEADER + (i * BLOCK_SIZE);
  const attrStart = blockStart + ATTR_OFFSET;

  const writtenOVR = modifiedBuffer[attrStart + 0x51];
  const originalOVR = p.overall || 0;
  const match = writtenOVR === originalOVR ? 'YES' : 'NO ❌';

  if (writtenOVR !== originalOVR) {
    mismatchCount++;
  }

  console.log(`${(i + 1).toString().padStart(5)} | ${originalOVR.toString().padStart(8)} | ${writtenOVR.toString().padStart(7)} | ${match.padEnd(5)} | ${p.firstName} ${p.lastName}`);
}

// Final summary
console.log('\n--- Summary ---');
console.log(`Total prospects: ${parsed.prospects.length}`);
console.log(`Mismatches in first 20: ${mismatchCount}`);

if (mismatchCount === 0) {
  console.log('\n✅ OVR Round-Trip PASSED - All OVRs preserved correctly!');
} else {
  console.log('\n❌ OVR Round-Trip FAILED - Some OVRs were modified!');
}

// Also verify that the OVR values are what we expect (not 0)
let zeroCount = 0;
for (let i = 0; i < Math.min(50, parsed.prospects.length); i++) {
  const blockStart = HEADER + (i * BLOCK_SIZE);
  const attrStart = blockStart + ATTR_OFFSET;
  if (modifiedBuffer[attrStart + 0x51] === 0) {
    zeroCount++;
  }
}
console.log(`\nZero OVRs in first 50: ${zeroCount}`);
if (zeroCount > 5) {
  console.log('⚠️ Warning: Too many zero OVRs - might be writing issue');
}
