/**
 * Verify ratings with +0x12 offset correction
 */
const fs = require('fs');

const testFile = 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/CAREERDRAFT-2026NOV22';
const buffer = fs.readFileSync(testFile);

const BLOCK_SIZE = 4296;
const DATA_START = 52;
const HEADER_OFFSET = 0x12;  // 18 bytes header within attribute section

// Current parser offsets (relative to attribute section start WITHOUT header)
const CURRENT_OFFSETS = {
  firstName: 0x00, lastName: 0x11,
  homeState: 0x26, college: 0x42,
  age: 0x46, heightInches: 0x47, weight: 0x48,
  position: 0x4a, archetype: 0x4b, jerseyNum: 0x4c,
  draftPick: 0x4e, longSnap_or_round: 0x50, overall: 0x51,
  acceleration: 0x52, agility: 0x53, awareness: 0x54,
  speed: 0x7B, throwPower: 0x86, throwAccuracyShort: 0x84,
  throwAccuracyMid: 0x83, throwAccuracyDeep: 0x81,
  strength: 0x7F, tackle: 0x80
};

console.log('=== VERIFYING RATINGS WITH +0x12 OFFSET ===\n');

// Read first 5 prospects
for (let blockNum = 0; blockNum < 5; blockNum++) {
  const blockStart = DATA_START + (blockNum * BLOCK_SIZE);
  const rawAttrStart = blockStart + 0x1000;
  const correctedAttrStart = rawAttrStart + HEADER_OFFSET;

  console.log(`=== BLOCK ${blockNum} ===`);
  console.log(`Block start: 0x${blockStart.toString(16)}`);
  console.log(`Raw attr start: 0x${rawAttrStart.toString(16)}`);
  console.log(`Corrected attr start: 0x${correctedAttrStart.toString(16)}\n`);

  // Read with corrected offset
  const firstName = buffer.toString('ascii', correctedAttrStart, correctedAttrStart + 17).replace(/\0/g, '').trim();
  const lastName = buffer.toString('ascii', correctedAttrStart + 0x11, correctedAttrStart + 0x26).replace(/\0/g, '').trim();

  console.log(`Name: ${firstName} ${lastName}`);

  // Read metadata
  console.log(`homeState (0x26): ${buffer[correctedAttrStart + 0x26]}`);
  console.log(`college (0x42): ${buffer[correctedAttrStart + 0x42]}`);
  console.log(`age (0x46): ${buffer[correctedAttrStart + 0x46]}`);
  console.log(`heightInches (0x47): ${buffer[correctedAttrStart + 0x47]} (${Math.floor(buffer[correctedAttrStart + 0x47] / 12)}'${buffer[correctedAttrStart + 0x47] % 12}")`);
  console.log(`weight (0x48): ${buffer[correctedAttrStart + 0x48] + 160}`);
  console.log(`position (0x4a): ${buffer[correctedAttrStart + 0x4a]}`);
  console.log(`archetype (0x4b): ${buffer[correctedAttrStart + 0x4b]}`);
  console.log(`jerseyNum (0x4c): ${buffer[correctedAttrStart + 0x4c]}`);

  // Draft fields
  console.log(`\nDraft fields:`);
  console.log(`  0x4d: ${buffer[correctedAttrStart + 0x4d]}`);
  console.log(`  0x4e (draftPick?): ${buffer[correctedAttrStart + 0x4e]}`);
  console.log(`  0x4f: ${buffer[correctedAttrStart + 0x4f]}`);
  console.log(`  0x50: ${buffer[correctedAttrStart + 0x50]}`);
  console.log(`  0x51 (overall?): ${buffer[correctedAttrStart + 0x51]}`);

  // Key ratings
  console.log(`\nKey Ratings:`);
  console.log(`  acceleration (0x52): ${buffer[correctedAttrStart + 0x52]}`);
  console.log(`  agility (0x53): ${buffer[correctedAttrStart + 0x53]}`);
  console.log(`  awareness (0x54): ${buffer[correctedAttrStart + 0x54]}`);
  console.log(`  speed (0x7B): ${buffer[correctedAttrStart + 0x7B]}`);
  console.log(`  strength (0x7F): ${buffer[correctedAttrStart + 0x7F]}`);
  console.log(`  throwPower (0x86): ${buffer[correctedAttrStart + 0x86]}`);
  console.log(`  throwAccuracyShort (0x84): ${buffer[correctedAttrStart + 0x84]}`);
  console.log(`  throwAccuracyMid (0x83): ${buffer[correctedAttrStart + 0x83]}`);
  console.log(`  throwAccuracyDeep (0x81): ${buffer[correctedAttrStart + 0x81]}`);
  console.log(`  tackle (0x80): ${buffer[correctedAttrStart + 0x80]}`);

  // Dev trait
  console.log(`  devTrait (0x8c): ${buffer[correctedAttrStart + 0x8c]}`);

  console.log('\n' + '='.repeat(50) + '\n');
}

// Compare with what the CURRENT parser would read (without offset)
console.log('\n=== COMPARISON: With vs Without +0x12 Offset ===\n');

const block0AttrStart = DATA_START + 0x1000;
const corrected = block0AttrStart + HEADER_OFFSET;

console.log('Field              | Without 0x12 | With 0x12    | Correct?');
console.log('-------------------|--------------|--------------|----------');

const fields = [
  ['firstName', 0x00, 17, 'string', 'Fernando'],
  ['lastName', 0x11, 21, 'string', 'Mendoza'],
  ['position', 0x4a, 1, 'byte', 0],  // QB
  ['age', 0x46, 1, 'byte', 22],
  ['heightInches', 0x47, 1, 'byte', 77],  // 6'5"
  ['overall', 0x51, 1, 'byte', null],  // Unknown expected
  ['speed', 0x7B, 1, 'byte', 77],  // Expected ~77
  ['throwPower', 0x86, 1, 'byte', 91],  // Expected ~91
];

for (const [name, offset, size, type, expected] of fields) {
  let withoutVal, withVal;

  if (type === 'string') {
    withoutVal = buffer.toString('ascii', block0AttrStart + offset, block0AttrStart + offset + size).replace(/\0/g, '').trim();
    withVal = buffer.toString('ascii', corrected + offset, corrected + offset + size).replace(/\0/g, '').trim();
  } else {
    withoutVal = buffer[block0AttrStart + offset];
    withVal = buffer[corrected + offset];
  }

  const correct = expected !== null ? (withVal === expected || withVal.toString() === expected.toString() ? '✓' : '✗') : '?';
  console.log(`${name.padEnd(18)} | ${String(withoutVal).padEnd(12)} | ${String(withVal).padEnd(12)} | ${correct}`);
}
