/**
 * Analyze draft order in real M26 file to understand how Madden sorts prospects
 */
const fs = require('fs');

const realPath = 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden NFL 26\\Saves\\CAREERDRAFT-2026NOV22';
const real = fs.readFileSync(realPath);

const HEADER = 0x46;
const BLOCK_SIZE = 4296;
const ATTR_OFFSET = 0x1000;

console.log('=== Analyzing Draft Order in Real M26 File ===\n');

// Check first 50 prospects to see how draftPick values work
console.log('First 50 prospects:');
console.log('Block | draftPick | Name');
console.log('------|-----------|--------------------');

for (let i = 0; i < 50; i++) {
  const blockStart = HEADER + (i * BLOCK_SIZE);
  const attrStart = blockStart + ATTR_OFFSET;

  if (attrStart + 0x50 > real.length) break;

  const firstName = real.toString('ascii', attrStart, attrStart + 0x11).replace(/\0/g, '').trim();
  const lastName = real.toString('ascii', attrStart + 0x11, attrStart + 0x26).replace(/\0/g, '').trim();
  const draftPick = real[attrStart + 0x4e];

  console.log(`${(i + 1).toString().padStart(5)} | ${draftPick.toString().padStart(9)} | ${firstName} ${lastName}`);
}

// Check around pick 28 - where UDFAs appear
console.log('\n\nProspects around position 25-35:');
console.log('Block | draftPick | Name');
console.log('------|-----------|--------------------');

for (let i = 24; i < 35; i++) {
  const blockStart = HEADER + (i * BLOCK_SIZE);
  const attrStart = blockStart + ATTR_OFFSET;

  if (attrStart + 0x50 > real.length) break;

  const firstName = real.toString('ascii', attrStart, attrStart + 0x11).replace(/\0/g, '').trim();
  const lastName = real.toString('ascii', attrStart + 0x11, attrStart + 0x26).replace(/\0/g, '').trim();
  const draftPick = real[attrStart + 0x4e];

  console.log(`${(i + 1).toString().padStart(5)} | ${draftPick.toString().padStart(9)} | ${firstName} ${lastName}`);
}

// Count how draftPick values are distributed
console.log('\n\n=== DraftPick Value Distribution ===');
let pickCounts = {};
let pickZeroCount = 0;

for (let i = 0; i < 402; i++) {
  const blockStart = HEADER + (i * BLOCK_SIZE);
  const attrStart = blockStart + ATTR_OFFSET;

  if (attrStart + 0x50 > real.length) break;

  const firstName = real.toString('ascii', attrStart, attrStart + 0x11).replace(/\0/g, '').trim();
  if (!firstName || firstName.length === 0) continue;

  const draftPick = real[attrStart + 0x4e];

  if (draftPick === 0) {
    pickZeroCount++;
  } else {
    pickCounts[draftPick] = (pickCounts[draftPick] || 0) + 1;
  }
}

console.log(`Prospects with draftPick=0 (UDFAs): ${pickZeroCount}`);
console.log(`Prospects with draftPick > 0: ${Object.keys(pickCounts).length} unique values`);

// Show distribution
const sortedPicks = Object.entries(pickCounts).sort((a, b) => parseInt(a[0]) - parseInt(b[0]));
console.log('\nPick number distribution:');
for (const [pick, count] of sortedPicks.slice(0, 20)) {
  console.log(`  Pick ${pick}: ${count} player(s)`);
}

// Check if block position correlates with draft order
console.log('\n\n=== Block Position vs Draft Order ===');
console.log('(Do prospects need to be sorted by pick, or is block position independent?)');

let positionMatchesPick = 0;
let positionDoesNotMatch = 0;

for (let i = 0; i < 249; i++) {
  const blockStart = HEADER + (i * BLOCK_SIZE);
  const attrStart = blockStart + ATTR_OFFSET;

  if (attrStart + 0x50 > real.length) break;

  const draftPick = real[attrStart + 0x4e];

  if (draftPick > 0 && draftPick === i + 1) {
    positionMatchesPick++;
  } else if (draftPick > 0) {
    positionDoesNotMatch++;
  }
}

console.log(`Block position matches draftPick: ${positionMatchesPick}`);
console.log(`Block position != draftPick: ${positionDoesNotMatch}`);
