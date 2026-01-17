/**
 * Analyze the saved draft class file from Madden saves folder
 */
const fs = require('fs');
const path = require('path');

const savedPath = 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden NFL 26\\Saves\\CAREERDRAFT-EDITED1';
console.log('Analyzing saved draft class:', savedPath);

const buffer = fs.readFileSync(savedPath);
console.log('File size:', buffer.length, 'bytes');

const BLOCK_SIZE = 4322;
const HEADER_OFFSET = 0x46;

// Rating offsets from M26Parser.js
const ratingOffsets = {
  speed: 0x7B,
  acceleration: 0x52,
  agility: 0x53,
  awareness: 0x54,
  strength: 0x7F,
  throwPower: 0x86,
  throwAccuracyShort: 0x84,
  throwAccuracyMid: 0x82,
  throwAccuracyDeep: 0x81,
  throwOnTheRun: 0x85,
  throwUnderPressure: 0x87,
  injury: 0x60,
  stamina: 0x7D,
  devTrait: 0x8c,
  draftPick: 0x4e,
  position: 0x4a
};

// Analyze first 5 prospects
console.log('\n=== ANALYZING SAVED FILE ===\n');

for (let i = 0; i < 5; i++) {
  const blockStart = HEADER_OFFSET + (i * BLOCK_SIZE);
  const attrStart = blockStart + 0x1000;

  if (attrStart + 0xE2 > buffer.length) {
    console.log(`Prospect ${i + 1}: Past end of file`);
    break;
  }

  const firstName = buffer.toString('ascii', attrStart, attrStart + 0x11).replace(/\0/g, '').trim();
  const lastName = buffer.toString('ascii', attrStart + 0x11, attrStart + 0x26).replace(/\0/g, '').trim();

  console.log(`=== Prospect #${i + 1}: ${firstName} ${lastName} ===`);
  console.log(`Block start: 0x${blockStart.toString(16)}, Attr start: 0x${attrStart.toString(16)}`);

  // Read all ratings
  console.log('Ratings:');
  for (const [name, offset] of Object.entries(ratingOffsets)) {
    const value = buffer[attrStart + offset];
    console.log(`  ${name} (0x${offset.toString(16)}): ${value}`);
  }
  console.log('');
}

// Show raw hex for Andrew Luck's attribute section
console.log('\n=== RAW HEX FOR ANDREW LUCK (Prospect #2) ===');
const andrewBlockStart = HEADER_OFFSET + (1 * BLOCK_SIZE); // Second prospect
const andrewAttrStart = andrewBlockStart + 0x1000;
const attrData = buffer.subarray(andrewAttrStart, andrewAttrStart + 0xE2);

// Print in 16-byte rows
for (let i = 0; i < attrData.length; i += 16) {
  const row = attrData.subarray(i, Math.min(i + 16, attrData.length));
  const hex = Array.from(row).map(b => b.toString(16).padStart(2, '0')).join(' ');
  const ascii = Array.from(row).map(b => (b >= 32 && b < 127) ? String.fromCharCode(b) : '.').join('');

  // Highlight key offsets
  const highlights = [];
  if (i <= 0x4a && i + 16 > 0x4a) highlights.push('position@0x4a');
  if (i <= 0x4e && i + 16 > 0x4e) highlights.push('draftPick@0x4e');
  if (i <= 0x52 && i + 16 > 0x52) highlights.push('acceleration@0x52');
  if (i <= 0x54 && i + 16 > 0x54) highlights.push('awareness@0x54');
  if (i <= 0x7B && i + 16 > 0x7B) highlights.push('speed@0x7B');
  if (i <= 0x86 && i + 16 > 0x86) highlights.push('throwPower@0x86');

  console.log(`0x${i.toString(16).padStart(3, '0')}: ${hex.padEnd(48)} ${ascii} ${highlights.length ? '<<< ' + highlights.join(', ') : ''}`);
}
