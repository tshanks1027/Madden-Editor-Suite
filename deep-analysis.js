/**
 * DEEP ANALYSIS: What is byte 0x82?
 *
 * The working file has value 78 at 0x82
 * The edited file has value 21 at 0x82
 *
 * Could this be the ACTUAL throwAccuracyMid or some other attribute?
 */

const fs = require('fs');

// Files
const WORKING_PATH = 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden NFL 26\\Saves\\CAREERDRAFT-2026NOV22';
const EDITED_PATH = 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden NFL 26\\Saves\\CAREERDRAFT-EDITED';
const TEMPLATE_PATH = 'C:\\Users\\tshan\\Documents\\Dev\\madden-editor-suite\\data\\templates\\CAREERDRAFT-2026Template';

const working = fs.readFileSync(WORKING_PATH);
const edited = fs.readFileSync(EDITED_PATH);
const template = fs.readFileSync(TEMPLATE_PATH);

// M26 structure
const HEADER = 0x46;
const BLOCK_SIZE = 4322;
const ATTR_OFFSET = 0x1000;

function getAttrStart(prospectIndex) {
  return HEADER + (prospectIndex * BLOCK_SIZE) + ATTR_OFFSET;
}

console.log('=== BYTE 0x82 ANALYSIS ===\n');

// Check first 10 prospects in each file
for (let i = 0; i < 10; i++) {
  const attrStart = getAttrStart(i);
  const wName = working.toString('ascii', attrStart, attrStart + 17).replace(/\0/g, '').trim() + ' ' +
                working.toString('ascii', attrStart + 0x11, attrStart + 0x26).replace(/\0/g, '').trim();
  const eName = edited.toString('ascii', attrStart, attrStart + 17).replace(/\0/g, '').trim() + ' ' +
                edited.toString('ascii', attrStart + 0x11, attrStart + 0x26).replace(/\0/g, '').trim();
  const tName = template.toString('ascii', attrStart, attrStart + 17).replace(/\0/g, '').trim() + ' ' +
                template.toString('ascii', attrStart + 0x11, attrStart + 0x26).replace(/\0/g, '').trim();

  // Get throwing attributes around 0x82
  console.log(`\n=== Prospect ${i + 1} ===`);
  console.log(`WORKING: ${wName}`);
  console.log(`EDITED: ${eName}`);
  console.log(`TEMPLATE: ${tName}`);

  const wPos = working[attrStart + 0x4a];
  const ePos = edited[attrStart + 0x4a];
  const posNames = ['QB', 'HB', 'FB', 'WR', 'TE', 'LT', 'LG', 'C', 'RG', 'RT', 'LE', 'RE', 'DT', 'LOLB', 'MLB', 'ROLB', 'CB', 'FS', 'SS', 'K', 'P'];

  console.log(`Position: WORKING=${posNames[wPos] || wPos}, EDITED=${posNames[ePos] || ePos}`);

  // Bytes 0x81 - 0x8A (throwing/misc area)
  console.log('\nByte'.padEnd(8) + 'WORKING'.padEnd(10) + 'EDITED'.padEnd(10) + 'TEMPLATE'.padEnd(10) + 'Known As');
  console.log('-'.repeat(60));

  const labels = {
    0x81: 'throwAccuracyDeep',
    0x82: '???MYSTERY???',
    0x83: 'throwAccuracyMid',
    0x84: 'throwAccuracyShort',
    0x85: 'throwOnTheRun',
    0x86: 'throwPower',
    0x87: 'throwUnderPressure',
    0x88: 'toughness',
    0x89: 'trucking',
    0x8a: 'zoneCoverage',
  };

  for (let off = 0x81; off <= 0x8a; off++) {
    const w = working[attrStart + off];
    const e = edited[attrStart + off];
    const t = template[attrStart + off];
    const label = labels[off] || '?';
    const diff = (w !== e) ? '⚠️' : '';
    console.log(`0x${off.toString(16).padStart(2,'0')}`.padEnd(8) + String(w).padEnd(10) + String(e).padEnd(10) + String(t).padEnd(10) + label + diff);
  }
}

// Let's check if 0x51 might be overall
console.log('\n\n=== CHECKING OFFSET 0x51 (possible OVR?) ===\n');
for (let i = 0; i < 10; i++) {
  const attrStart = getAttrStart(i);
  const wName = working.toString('ascii', attrStart, attrStart + 17).replace(/\0/g, '').trim();
  const eName = edited.toString('ascii', attrStart, attrStart + 17).replace(/\0/g, '').trim();

  const w51 = working[attrStart + 0x51];
  const e51 = edited[attrStart + 0x51];
  const t51 = template[attrStart + 0x51];

  // Also get what we think is speed for reference
  const wSpd = working[attrStart + 0x7b];
  const eSpd = edited[attrStart + 0x7b];

  console.log(`Prospect ${i + 1}:`);
  console.log(`  WORKING: ${wName.padEnd(15)} 0x51=${w51}, speed=${wSpd}`);
  console.log(`  EDITED:  ${eName.padEnd(15)} 0x51=${e51}, speed=${eSpd}`);
  console.log(`  TEMPLATE: 0x51=${t51}`);
}

// Check for OVERALL attribute - scan all bytes for something that makes sense
console.log('\n\n=== HUNTING FOR OVERALL BYTE ===\n');
console.log('Looking for a byte that could be calculated OVR...\n');

// For Andrew Luck OVR 82, check which bytes in the edited file have value around 82
const attrStart = getAttrStart(0);
console.log('Bytes in EDITED file (Andrew Luck) with values 40-99:');
for (let off = 0x49; off < 0x9E; off++) {
  const val = edited[attrStart + off];
  if (val >= 40 && val <= 99) {
    console.log(`  0x${off.toString(16)}: ${val}`);
  }
}

// Check if there's a byte we're NOT writing to that should have OVR
console.log('\n\n=== BYTES IN 0x49-0x51 RANGE ===\n');
const range = [0x49, 0x4a, 0x4b, 0x4c, 0x4d, 0x4e, 0x4f, 0x50, 0x51];
for (const off of range) {
  const w = working[attrStart + off];
  const e = edited[attrStart + off];
  const t = template[attrStart + off];
  console.log(`0x${off.toString(16)}: WORKING=${w}, EDITED=${e}, TEMPLATE=${t}`);
}

// Check if OVR is stored elsewhere - maybe at 0x49?
console.log('\n\n=== IS 0x49 THE OVERALL? ===\n');
for (let i = 0; i < 10; i++) {
  const attrStart = getAttrStart(i);
  const wName = working.toString('ascii', attrStart, attrStart + 17).replace(/\0/g, '').trim();
  const eName = edited.toString('ascii', attrStart, attrStart + 17).replace(/\0/g, '').trim();

  const w49 = working[attrStart + 0x49];
  const e49 = edited[attrStart + 0x49];
  const t49 = template[attrStart + 0x49];

  console.log(`${wName.padEnd(15)}: 0x49=${w49} | ${eName.padEnd(15)}: 0x49=${e49} | Template: 0x49=${t49}`);
}
