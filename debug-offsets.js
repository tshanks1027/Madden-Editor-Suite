/**
 * Debug script to verify M26 offset mappings
 * Look at the raw hex and verify attribute locations
 */
const fs = require('fs');

const templateFile = 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/CAREERDRAFT-2026NOV22';
const buffer = fs.readFileSync(templateFile);

const DATA_START = 0x46; // 70 decimal - confirmed from draftClassFunctions.js for M26
const BLOCK_SIZE = 4296;
const ATTR_OFFSET = 0x1000;

console.log('=== M26 OFFSET VERIFICATION ===\n');

// Block 0 attribute section
const block0Start = DATA_START;
const attr0Start = block0Start + ATTR_OFFSET;

console.log(`File header info:`);
console.log(`  dataStartOffset: 0x${DATA_START.toString(16)} (${DATA_START})`);
console.log(`  Block 0 visual section: 0x${block0Start.toString(16)} - 0x${(block0Start + ATTR_OFFSET - 1).toString(16)}`);
console.log(`  Block 0 attribute section: 0x${attr0Start.toString(16)} - 0x${(attr0Start + 200 - 1).toString(16)}`);

// Dump attribute section for block 0 as hex
console.log('\n=== BLOCK 0 ATTRIBUTE SECTION DUMP (first 150 bytes) ===\n');
console.log('Offset  | Hex Data                                        | ASCII');
console.log('--------|--------------------------------------------------|------');

for (let row = 0; row < 150; row += 16) {
  const offset = attr0Start + row;
  let hex = '';
  let ascii = '';

  for (let col = 0; col < 16; col++) {
    const byteOffset = offset + col;
    if (byteOffset < buffer.length) {
      const b = buffer[byteOffset];
      hex += b.toString(16).padStart(2, '0') + ' ';
      ascii += (b >= 32 && b < 127) ? String.fromCharCode(b) : '.';
    }
  }

  const relativeOffset = row.toString(16).padStart(4, '0');
  console.log(`+0x${relativeOffset} | ${hex.padEnd(48)} | ${ascii}`);
}

// Read and display first name
console.log('\n=== PARSED ATTRIBUTES FOR BLOCK 0 ===\n');

const firstName = buffer.toString('ascii', attr0Start, attr0Start + 0x11).replace(/\0/g, '').trim();
const lastName = buffer.toString('ascii', attr0Start + 0x11, attr0Start + 0x26).replace(/\0/g, '').trim();

console.log(`Name: "${firstName}" "${lastName}"`);
console.log(`Age (0x46): ${buffer[attr0Start + 0x46]}`);
console.log(`Height (0x47): ${buffer[attr0Start + 0x47]} inches = ${Math.floor(buffer[attr0Start + 0x47]/12)}'${buffer[attr0Start + 0x47]%12}"`);
console.log(`Weight (0x48): ${buffer[attr0Start + 0x48]} + 160 = ${buffer[attr0Start + 0x48] + 160} lbs`);
console.log(`Position (0x4a): ${buffer[attr0Start + 0x4a]}`);
console.log(`Archetype (0x4b): ${buffer[attr0Start + 0x4b]}`);

// Now check key QB ratings
console.log('\n=== QB RATINGS ===');
console.log(`Acceleration (0x52): ${buffer[attr0Start + 0x52]}`);
console.log(`Agility (0x53): ${buffer[attr0Start + 0x53]}`);
console.log(`Awareness (0x54): ${buffer[attr0Start + 0x54]}`);
console.log(`Speed (0x7B): ${buffer[attr0Start + 0x7B]}`);
console.log(`ThrowPower (0x86): ${buffer[attr0Start + 0x86]}`);
console.log(`ThrowAccShort (0x84): ${buffer[attr0Start + 0x84]}`);
console.log(`ThrowAccMid (0x82): ${buffer[attr0Start + 0x82]}`);
console.log(`ThrowAccDeep (0x81): ${buffer[attr0Start + 0x81]}`);
console.log(`ThrowOnTheRun (0x85): ${buffer[attr0Start + 0x85]}`);
console.log(`ThrowUnderPressure (0x87): ${buffer[attr0Start + 0x87]}`);
console.log(`PlayAction (0x6D): ${buffer[attr0Start + 0x6D]}`);
console.log(`BreakSack (0x57): ${buffer[attr0Start + 0x57]}`);

console.log('\n=== CHECKING 0x6C AREA ===');
console.log(`PassBlockPower (0x69): ${buffer[attr0Start + 0x69]}`);
console.log(`PassBlockFinesse (0x6A): ${buffer[attr0Start + 0x6A]}`);
console.log(`PassBlock (0x6B): ${buffer[attr0Start + 0x6B]}`);
console.log(`UNKNOWN (0x6C): ${buffer[attr0Start + 0x6C]}`);
console.log(`PlayAction (0x6D): ${buffer[attr0Start + 0x6D]}`);
console.log(`PlayRecognition (0x6E): ${buffer[attr0Start + 0x6E]}`);

// Check what's REALLY at 0x57 (breakSack is supposed to be there)
console.log('\n=== CHECKING 0x55-0x60 AREA ===');
for (let off = 0x55; off <= 0x60; off++) {
  console.log(`0x${off.toString(16)}: ${buffer[attr0Start + off]}`);
}

// Look for Fernando Mendoza's expected stats
// According to Madden 26, Fernando Mendoza (SDSU QB) draft prospect should have:
// - High throw power (90s range)
// - Decent accuracy
// This can help us verify offsets

console.log('\n=== FINDING RATINGS IN 90s RANGE (likely throwPower) ===');
for (let off = 0x50; off < 0xC8; off++) {
  const val = buffer[attr0Start + off];
  if (val >= 85 && val <= 99) {
    console.log(`  0x${off.toString(16)}: ${val}`);
  }
}

console.log('\n=== OVERALL RATING CHECK ===');
console.log(`OVR stored at 0x51: ${buffer[attr0Start + 0x51]}`);

// Let me also check if there's an 18-byte offset issue
console.log('\n\n=== CHECKING WITH +0x12 OFFSET (18 bytes) ===');
const adjusted = attr0Start + 0x12;
const adjFirstName = buffer.toString('ascii', adjusted, adjusted + 0x11).replace(/\0/g, '').trim();
const adjLastName = buffer.toString('ascii', adjusted + 0x11, adjusted + 0x26).replace(/\0/g, '').trim();
console.log(`Name with +0x12: "${adjFirstName}" "${adjLastName}"`);
console.log(`ThrowPower at adjusted 0x86: ${buffer[adjusted + 0x86]}`);
