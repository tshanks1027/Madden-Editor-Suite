/**
 * Dump working file attribute bytes to find real offset mappings
 */
const fs = require('fs');

const workingPath = 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden Files\\1994 Mod V3\\Draft Classes\\CAREERDRAFT-2012V1';
const working = fs.readFileSync(workingPath);

const HEADER_OFFSET = 0x46;
const attrStart = HEADER_OFFSET + 0x1000;

console.log('=== WORKING FILE: ANDREW LUCK RAW VALUES (0x40-0xA0) ===');
console.log('Looking for patterns in attribute bytes:\n');

// Known offsets from M26Parser
const known = {
  0x4a: 'position',
  0x4e: 'draftPick',
  0x52: 'acceleration',
  0x53: 'agility',
  0x54: 'awareness',
  0x55: 'ballCarrierVision',
  0x58: 'breakTackle',
  0x59: 'carrying',
  0x5A: 'catching',
  0x5B: 'catchInTraffic',
  0x5E: 'hitPower',
  0x60: 'injury',
  0x68: 'manCoverage',
  0x6E: 'playRecognition',
  0x71: 'pursuit',
  0x73: 'deepRouteRunning',
  0x74: 'mediumRouteRunning',
  0x75: 'shortRouteRunning',
  0x7A: 'spectacularCatch',
  0x7B: 'speed',
  0x7D: 'stamina',
  0x7F: 'strength',
  0x80: 'tackle',
  0x81: 'throwAccuracyDeep',
  0x82: 'throwAccuracyMid',
  0x84: 'throwAccuracyShort',
  0x85: 'throwOnTheRun',
  0x86: 'throwPower',
  0x87: 'throwUnderPressure',
  0x88: 'toughness',
  0x89: 'trucking',
  0x8A: 'zoneCoverage',
  0x8c: 'devTrait'
};

// Show all bytes from 0x40 to 0xA0 with their values
for (let i = 0x40; i <= 0xA0; i++) {
  const val = working[attrStart + i];
  const marker = [];

  // Check for realistic QB rating values (70-99)
  if (val >= 70 && val <= 99) marker.push('*QB-RANGE*');

  if (known[i]) marker.push(known[i]);

  console.log(`0x${i.toString(16).padStart(2, '0')}: ${String(val).padStart(3)} ${marker.join(' ')}`);
}

// Now look for where Andrew Luck's REAL ratings would be
// According to the game, he should have: Speed 72-75, ThrowPower 88-92, Awareness 80-85
console.log('\n\n=== SEARCHING FOR REALISTIC QB RATINGS ===');
console.log('Andrew Luck expected: Speed ~72, ThrowPower ~88, Awareness ~85\n');

// Search for speed value 72 in attributes area
console.log('Offsets with value 72 (speed):');
for (let i = 0x40; i <= 0xE0; i++) {
  if (working[attrStart + i] === 72) {
    console.log(`  0x${i.toString(16)}: 72 ${known[i] ? '(' + known[i] + ')' : ''}`);
  }
}

console.log('\nOffsets with value 88 (throwPower):');
for (let i = 0x40; i <= 0xE0; i++) {
  if (working[attrStart + i] === 88) {
    console.log(`  0x${i.toString(16)}: 88 ${known[i] ? '(' + known[i] + ')' : ''}`);
  }
}

console.log('\nOffsets with value 85 (awareness):');
for (let i = 0x40; i <= 0xE0; i++) {
  if (working[attrStart + i] === 85) {
    console.log(`  0x${i.toString(16)}: 85 ${known[i] ? '(' + known[i] + ')' : ''}`);
  }
}

// Check if the file structure might be different
console.log('\n\n=== CHECKING HEADER BYTES ===');
for (let i = 0; i < 0x50; i++) {
  if (i % 16 === 0) process.stdout.write(`\n0x${i.toString(16).padStart(3, '0')}: `);
  process.stdout.write(working[i].toString(16).padStart(2, '0') + ' ');
}

console.log('\n\n=== FILE SIZE CHECK ===');
console.log('Working file size:', working.length);
console.log('Expected prospects:', Math.floor((working.length - HEADER_OFFSET) / 4322));
