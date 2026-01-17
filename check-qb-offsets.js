/**
 * Check QB rating byte offsets in working 2012 file
 * Andrew Luck's values should be realistic (75-95 range for all QB attributes)
 */
const fs = require('fs');

const workingPath = 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden Files\\1994 Mod V3\\Draft Classes\\CAREERDRAFT-2012V1';
const working = fs.readFileSync(workingPath);

const HEADER_OFFSET = 0x46;
const attrStart = HEADER_OFFSET + 0x1000;

// Known M26 offsets from M26Writer.js
const knownOffsets = {
  speed: 0x7B,
  acceleration: 0x52,
  agility: 0x53,
  strength: 0x7F,
  awareness: 0x54,
  stamina: 0x7D,
  throwPower: 0x86,
  throwAccuracyShort: 0x84,
  throwAccuracyMid: 0x82,
  throwAccuracyDeep: 0x81,
  throwOnTheRun: 0x85,
  throwUnderPressure: 0x87
};

console.log('=== ANDREW LUCK QB RATINGS AT KNOWN OFFSETS ===\n');

for (const [name, offset] of Object.entries(knownOffsets)) {
  const value = working[attrStart + offset];
  const isGoodQBValue = value >= 70 && value <= 95;
  console.log(`${name.padEnd(20)} (0x${offset.toString(16).padStart(2, '0')}): ${value} ${isGoodQBValue ? '✓' : '⚠️ SUSPICIOUS'}`);
}

// Now let's look for the REAL throw accuracy values
// Andrew Luck as a rookie should have:
// - Speed: ~72-75 (he wasn't super fast)
// - Throw Power: ~88-92 (strong arm)
// - Throw Accuracy Short: ~82-88
// - Throw Accuracy Mid: ~78-85
// - Throw Accuracy Deep: ~76-82

console.log('\n=== SEARCHING FOR QB THROW ACCURACY PATTERN ===');
console.log('Looking for 3 consecutive values in 75-95 range (TAS/TAM/TAD)...\n');

for (let i = 0x78; i <= 0x90; i++) {
  const v1 = working[attrStart + i];
  const v2 = working[attrStart + i + 1];
  const v3 = working[attrStart + i + 2];

  // Check if all 3 are in realistic QB accuracy range
  if (v1 >= 70 && v1 <= 95 && v2 >= 70 && v2 <= 95 && v3 >= 70 && v3 <= 95) {
    console.log(`Potential at 0x${i.toString(16)}: ${v1}, ${v2}, ${v3}`);
  }
}

// Show raw bytes 0x80-0x90 for manual inspection
console.log('\n=== RAW BYTES 0x80-0x90 ===');
for (let i = 0x80; i <= 0x90; i++) {
  const val = working[attrStart + i];
  console.log(`0x${i.toString(16)}: ${val}`);
}

// Check the QB-specific bytes that M26Parser reads
console.log('\n=== M26PARSER QB OFFSETS ===');
const parserOffsets = {
  // From M26Parser.js
  throwAccuracyDeep: 0x81,
  throwAccuracyMid: 0x82,
  throwAccuracyShort: 0x84,
  throwOnTheRun: 0x85,
  throwPower: 0x86,
  throwUnderPressure: 0x87
};

for (const [name, offset] of Object.entries(parserOffsets)) {
  const value = working[attrStart + offset];
  console.log(`${name.padEnd(20)} (0x${offset.toString(16)}): ${value}`);
}
