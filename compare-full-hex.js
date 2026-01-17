/**
 * Full hex comparison: Template vs Edited for first prospect
 * Looking for ANY differences that might explain why game shows wrong OVR
 */

const fs = require('fs');

const templatePath = 'C:\\Users\\tshan\\Documents\\Dev\\madden-editor-suite\\data\\templates\\CAREERDRAFT-2026Template';
const editedPath = 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden NFL 26\\Saves\\CAREERDRAFT-EDITED';

const template = fs.readFileSync(templatePath);
const edited = fs.readFileSync(editedPath);

// M26 structure
const HEADER = 0x46;
const BLOCK_SIZE = 4322;
const ATTR_OFFSET = 0x1000;

const attrStart = HEADER + ATTR_OFFSET;

console.log('=== FULL HEX DUMP COMPARISON (Attribute Section, 256 bytes) ===\n');
console.log('Format: OFFSET: TEMPLATE -> EDITED [LABEL]');
console.log('Only showing DIFFERENCES\n');

// Known byte labels
const labels = {
  0x00: 'firstName[0]',
  0x11: 'lastName[0]',
  0x26: 'homeState',
  0x42: 'college',
  0x46: 'age',
  0x47: 'heightInches',
  0x48: 'weight+160',
  0x49: 'UNKNOWN_49',
  0x4a: 'position',
  0x4b: 'archetype',
  0x4c: 'jerseyNum',
  0x4d: 'UNKNOWN_4D',
  0x4e: 'draftPick',
  0x4f: 'UNKNOWN_4F',
  0x50: 'longSnap',
  0x51: 'UNKNOWN_51_OVR?',
  0x52: 'acceleration',
  0x53: 'agility',
  0x54: 'awareness',
  0x55: 'ballCarrierVision',
  0x56: 'blockShedding',
  0x57: 'breakSack',
  0x58: 'breakTackle',
  0x59: 'carrying',
  0x5a: 'catching',
  0x5b: 'catchInTraffic',
  0x5c: 'changeOfDirection',
  0x5d: 'finesseMoves',
  0x5e: 'hitPower',
  0x5f: 'impactBlocking',
  0x60: 'injury',
  0x61: 'jukeMove',
  0x62: 'jumping',
  0x63: 'kickAccuracy',
  0x64: 'kickPower',
  0x65: 'kickReturn',
  0x66: 'leadBlock',
  0x67: 'UNKNOWN_67',
  0x68: 'manCoverage',
  0x69: 'passBlockPower',
  0x6a: 'passBlockFinesse',
  0x6b: 'passBlock',
  0x6c: 'UNKNOWN_6C',
  0x6d: 'playAction',
  0x6e: 'playRecognition',
  0x6f: 'powerMoves',
  0x70: 'pressCoverage',
  0x71: 'pursuit',
  0x72: 'release',
  0x73: 'deepRouteRunning',
  0x74: 'mediumRouteRunning',
  0x75: 'shortRouteRunning',
  0x76: 'runBlockFinesse',
  0x77: 'runBlockPower',
  0x78: 'runBlock',
  0x79: 'UNKNOWN_79',
  0x7a: 'spectacularCatch',
  0x7b: 'speed',
  0x7c: 'spinMove',
  0x7d: 'stamina',
  0x7e: 'stiffArm',
  0x7f: 'strength',
  0x80: 'tackle',
  0x81: 'throwAccuracyDeep',
  0x82: 'UNKNOWN_82',
  0x83: 'throwAccuracyMid',
  0x84: 'throwAccuracyShort',
  0x85: 'throwOnTheRun',
  0x86: 'throwPower',
  0x87: 'throwUnderPressure',
  0x88: 'toughness',
  0x89: 'trucking',
  0x8a: 'zoneCoverage',
  0x8b: 'UNKNOWN_8B',
  0x8c: 'devTrait',
  0x92: 'PID_low',
  0x93: 'PID_high',
  0x9e: 'assetName[0]',
};

// Count different bytes
let diffCount = 0;
const diffs = [];

for (let i = 0; i < 256; i++) {
  const tByte = template[attrStart + i];
  const eByte = edited[attrStart + i];

  if (tByte !== eByte) {
    diffCount++;
    const label = labels[i] || `UNKNOWN_${i.toString(16).toUpperCase()}`;
    diffs.push({
      offset: i,
      template: tByte,
      edited: eByte,
      label
    });
  }
}

console.log(`Total differences: ${diffCount}\n`);

// Print all differences
for (const d of diffs) {
  console.log(`0x${d.offset.toString(16).padStart(2,'0')}: ${d.template.toString().padStart(3)} -> ${d.edited.toString().padStart(3)} [${d.label}]`);
}

// Print critical QB stats
console.log('\n=== CRITICAL QB STATS IN EDITED FILE ===');
console.log(`0x51 (possible OVR): ${edited[attrStart + 0x51]}`);
console.log(`0x52 (acceleration): ${edited[attrStart + 0x52]}`);
console.log(`0x54 (awareness): ${edited[attrStart + 0x54]}`);
console.log(`0x7b (speed): ${edited[attrStart + 0x7b]}`);
console.log(`0x81 (throwAccDeep): ${edited[attrStart + 0x81]}`);
console.log(`0x83 (throwAccMid): ${edited[attrStart + 0x83]}`);
console.log(`0x84 (throwAccShort): ${edited[attrStart + 0x84]}`);
console.log(`0x86 (throwPower): ${edited[attrStart + 0x86]}`);

// Print same stats from template
console.log('\n=== SAME STATS IN TEMPLATE (Francis Mauigoa - OT) ===');
console.log(`0x51 (possible OVR): ${template[attrStart + 0x51]}`);
console.log(`0x52 (acceleration): ${template[attrStart + 0x52]}`);
console.log(`0x54 (awareness): ${template[attrStart + 0x54]}`);
console.log(`0x7b (speed): ${template[attrStart + 0x7b]}`);
console.log(`0x81 (throwAccDeep): ${template[attrStart + 0x81]}`);
console.log(`0x83 (throwAccMid): ${template[attrStart + 0x83]}`);
console.log(`0x84 (throwAccShort): ${template[attrStart + 0x84]}`);
console.log(`0x86 (throwPower): ${template[attrStart + 0x86]}`);

// Check if position changed correctly
console.log('\n=== POSITION CHECK ===');
console.log(`Template position (0x4a): ${template[attrStart + 0x4a]} (expected 5 for OT)`);
console.log(`Edited position (0x4a): ${edited[attrStart + 0x4a]} (expected 0 for QB)`);

// Check archetype
console.log('\n=== ARCHETYPE CHECK ===');
console.log(`Template archetype (0x4b): ${template[attrStart + 0x4b]}`);
console.log(`Edited archetype (0x4b): ${edited[attrStart + 0x4b]} (expected 3 for Scrambler)`);
