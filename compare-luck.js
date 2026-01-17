/**
 * Compare Andrew Luck between saved file and working file byte-by-byte
 */
const fs = require('fs');

const savedPath = 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden NFL 26\\Saves\\CAREERDRAFT-EDITED';
const workingPath = 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden Files\\1994 Mod V3\\Draft Classes\\CAREERDRAFT-2012V1';

const saved = fs.readFileSync(savedPath);
const working = fs.readFileSync(workingPath);

const HEADER_OFFSET = 0x46;
const BLOCK_SIZE = 4322;

// Prospect #1 in both files should be Andrew Luck (but different slots in working)
const savedAttr = HEADER_OFFSET + 0x1000;  // Prospect 1 in saved
const workingAttr = HEADER_OFFSET + 0x1000; // Prospect 1 in working

console.log('=== ANDREW LUCK COMPARISON ===');
console.log('Saved:', saved.toString('ascii', savedAttr, savedAttr + 0x26).replace(/\0/g, ' ').trim());
console.log('Working:', working.toString('ascii', workingAttr, workingAttr + 0x26).replace(/\0/g, ' ').trim());

// Compare all attribute bytes
const offsets = {
  position: 0x4a,
  archetype: 0x4b,
  jerseyNum: 0x4c,
  draftPick: 0x4e,
  acceleration: 0x52,
  agility: 0x53,
  awareness: 0x54,
  ballCarrierVision: 0x55,
  blockShedding: 0x56,
  breakSack: 0x57,
  breakTackle: 0x58,
  carrying: 0x59,
  catching: 0x5A,
  catchInTraffic: 0x5B,
  changeOfDirection: 0x5C,
  finesseMoves: 0x5D,
  hitPower: 0x5E,
  impactBlocking: 0x5F,
  injury: 0x60,
  jukeMove: 0x61,
  jumping: 0x62,
  kickAccuracy: 0x63,
  kickPower: 0x64,
  kickReturn: 0x65,
  leadBlock: 0x66,
  manCoverage: 0x68,
  passBlockPower: 0x69,
  passBlockFinesse: 0x6A,
  passBlock: 0x6B,
  playAction: 0x6D,
  playRecognition: 0x6E,
  powerMoves: 0x6F,
  pressCoverage: 0x70,
  pursuit: 0x71,
  release: 0x72,
  deepRouteRunning: 0x73,
  mediumRouteRunning: 0x74,
  shortRouteRunning: 0x75,
  runBlockFinesse: 0x76,
  runBlockPower: 0x77,
  runBlock: 0x78,
  spectacularCatch: 0x7A,
  speed: 0x7B,
  spinMove: 0x7C,
  stamina: 0x7D,
  stiffArm: 0x7E,
  strength: 0x7F,
  tackle: 0x80,
  throwAccuracyDeep: 0x81,
  throwAccuracyMid: 0x83,
  throwAccuracyShort: 0x84,
  throwOnTheRun: 0x85,
  throwPower: 0x86,
  throwUnderPressure: 0x87,
  toughness: 0x88,
  trucking: 0x89,
  zoneCoverage: 0x8A,
  longSnap: 0x8B,
  devTrait: 0x8c
};

console.log('\n=== ATTRIBUTE COMPARISON ===');
console.log('Attribute'.padEnd(22), 'Saved'.padStart(6), 'Working'.padStart(8), 'Match?');
console.log('-'.repeat(45));

let mismatches = 0;
for (const [name, offset] of Object.entries(offsets)) {
  const savedVal = saved[savedAttr + offset];
  const workingVal = working[workingAttr + offset];
  const match = savedVal === workingVal ? '✓' : '✗';
  if (savedVal !== workingVal) {
    mismatches++;
    console.log(`${name.padEnd(22)} ${String(savedVal).padStart(6)} ${String(workingVal).padStart(8)} ${match} DIFFERENT!`);
  }
}

console.log('\n=== SUMMARY ===');
console.log(`Total attributes checked: ${Object.keys(offsets).length}`);
console.log(`Mismatches: ${mismatches}`);

// Also show the key QB attributes side by side
console.log('\n=== KEY QB ATTRIBUTES ===');
const qbAttrs = ['speed', 'throwPower', 'throwAccuracyDeep', 'throwAccuracyMid', 'throwAccuracyShort', 'throwOnTheRun', 'throwUnderPressure', 'awareness', 'acceleration', 'agility'];
console.log('Attribute'.padEnd(22), 'Saved'.padStart(6), 'Working'.padStart(8));
for (const name of qbAttrs) {
  const offset = offsets[name];
  console.log(`${name.padEnd(22)} ${String(saved[savedAttr + offset]).padStart(6)} ${String(working[workingAttr + offset]).padStart(8)}`);
}
