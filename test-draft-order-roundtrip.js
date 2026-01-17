/**
 * Test Draft Order Round-Trip: Parse -> Write -> Verify draftPick values preserved
 */
const fs = require('fs');
const path = require('path');

// Import actual parser and writer
const { parseM26Prospects } = require('./src/main/lib/draft-class/M26Parser.js');
const { writeM26DraftClass } = require('./src/main/lib/draft-class/M26Writer.js');

// Read original M26 file
const realPath = 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden NFL 26\\Saves\\CAREERDRAFT-2026NOV22';
const originalBuffer = fs.readFileSync(realPath);

console.log('=== Draft Order Round-Trip Test ===\n');

const HEADER = 0x46;
const BLOCK_SIZE = 4296;
const ATTR_OFFSET = 0x1000;
const POSITION_NAMES = ['QB', 'HB', 'FB', 'WR', 'TE', 'LT', 'LG', 'C', 'RG', 'RT', 'LE', 'RE', 'DT', 'LOLB', 'MLB', 'ROLB', 'CB', 'FS', 'SS', 'K', 'P'];

// Step 1: Read original draft pick values directly from file
console.log('--- Step 1: Original Draft Picks (raw binary) ---');
const originalDraftPicks = [];
for (let i = 0; i < 50; i++) {
  const blockStart = HEADER + (i * BLOCK_SIZE);
  const attrStart = blockStart + ATTR_OFFSET;

  if (attrStart + 0xC8 > originalBuffer.length) break;

  const firstName = originalBuffer.toString('ascii', attrStart, attrStart + 0x11).replace(/\0/g, '').trim();
  const lastName = originalBuffer.toString('ascii', attrStart + 0x11, attrStart + 0x26).replace(/\0/g, '').trim();
  const positionId = originalBuffer[attrStart + 0x4a];
  const position = POSITION_NAMES[positionId] || `?${positionId}`;
  const draftPick = originalBuffer[attrStart + 0x4e];
  const round = originalBuffer[attrStart + 0x50];

  originalDraftPicks.push({ index: i, firstName, lastName, position, draftPick, round });
}

console.log('Index | Pos | Pick | Round | Name');
console.log('------|-----|------|-------|-----');
for (let i = 0; i < 20; i++) {
  const p = originalDraftPicks[i];
  console.log(`${(i+1).toString().padStart(5)} | ${p.position.padEnd(3)} | ${p.draftPick.toString().padStart(4)} | ${p.round.toString().padStart(5)} | ${p.firstName} ${p.lastName}`);
}

// Step 2: Parse using M26Parser
console.log('\n--- Step 2: Parsed draftPick values ---');
const header = { dataStartOffset: HEADER };
const prospects = parseM26Prospects(originalBuffer, header);

console.log('Index | Pos | Parsed draftPick | Name');
console.log('------|-----|-----------------|-----');
for (let i = 0; i < 20; i++) {
  const p = prospects[i];
  const pos = POSITION_NAMES[p.position] || `?${p.position}`;
  console.log(`${(i+1).toString().padStart(5)} | ${pos.padEnd(3)} | ${(p.draftPick ?? 'undefined').toString().padStart(15)} | ${p.firstName} ${p.lastName}`);
}

// Step 3: Write back and verify
console.log('\n--- Step 3: Write and Verify ---');
const modifiedBuffer = writeM26DraftClass(originalBuffer, prospects, header);

console.log('\nComparing draft picks:');
console.log('Index | Pos | Original | Written | Match | Name');
console.log('------|-----|----------|---------|-------|-----');

let mismatchCount = 0;
for (let i = 0; i < 40; i++) {
  const blockStart = HEADER + (i * BLOCK_SIZE);
  const attrStart = blockStart + ATTR_OFFSET;

  const originalPick = originalBuffer[attrStart + 0x4e];
  const writtenPick = modifiedBuffer[attrStart + 0x4e];
  const match = originalPick === writtenPick ? 'YES' : 'NO ❌';

  if (originalPick !== writtenPick) mismatchCount++;

  const p = originalDraftPicks[i];
  console.log(`${(i+1).toString().padStart(5)} | ${p.position.padEnd(3)} | ${originalPick.toString().padStart(8)} | ${writtenPick.toString().padStart(7)} | ${match.padEnd(5)} | ${p.firstName} ${p.lastName}`);
}

// Also check some later prospects (UDFAs typically have pick = 224+)
console.log('\n--- Later Prospects (220-240, typically UDFAs) ---');
console.log('Index | Original | Written | Match');
console.log('------|----------|---------|------');
for (let i = 220; i < 240; i++) {
  const blockStart = HEADER + (i * BLOCK_SIZE);
  const attrStart = blockStart + ATTR_OFFSET;

  if (attrStart + 0xC8 > originalBuffer.length) break;

  const firstName = originalBuffer.toString('ascii', attrStart, attrStart + 0x11).replace(/\0/g, '').trim();
  if (!firstName) continue;

  const originalPick = originalBuffer[attrStart + 0x4e];
  const writtenPick = modifiedBuffer[attrStart + 0x4e];
  const match = originalPick === writtenPick ? 'YES' : 'NO ❌';

  if (originalPick !== writtenPick) mismatchCount++;

  console.log(`${(i+1).toString().padStart(5)} | ${originalPick.toString().padStart(8)} | ${writtenPick.toString().padStart(7)} | ${match}`);
}

// Summary
console.log('\n--- Summary ---');
console.log(`Total mismatches: ${mismatchCount}`);

if (mismatchCount === 0) {
  console.log('\n✅ Draft Order Round-Trip PASSED - All draft picks preserved correctly!');
} else {
  console.log('\n❌ Draft Order Round-Trip FAILED - Some draft picks were modified!');
}
