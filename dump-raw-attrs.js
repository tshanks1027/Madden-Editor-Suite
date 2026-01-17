/**
 * Dump raw attribute bytes for Chase and Okudah to verify we're reading correctly
 */
const fs = require('fs');

const file = 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/CAREERDRAFT-2020DRAFT';
const buffer = fs.readFileSync(file);

const DATA_START = 0x46;
const BLOCK_SIZE = 0x10C8;
const ATTR_OFFSET = 0x1000;

// Known offsets from M26Parser
const offsets = {
  0x4a: 'position',
  0x4b: 'archetype',
  0x51: 'overallRating',
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
  0x68: 'manCoverage',
  0x69: 'passBlockPower',
  0x6a: 'passBlockFinesse',
  0x6b: 'passBlock',
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
  0x7a: 'spectacularCatch',
  0x7b: 'speed',
  0x7c: 'spinMove',
  0x7d: 'stamina',
  0x7e: 'stiffArm',
  0x7f: 'strength',
  0x80: 'tackle',
  0x81: 'throwAccuracyDeep',
  0x82: 'throwAccuracyMid',
  0x84: 'throwAccuracyShort',
  0x85: 'throwOnTheRun',
  0x86: 'throwPower',
  0x87: 'throwUnderPressure',
  0x88: 'toughness',
  0x89: 'trucking',
  0x8a: 'zoneCoverage',
};

function dumpProspect(index, name) {
  const blockStart = DATA_START + (index * BLOCK_SIZE);
  const attrStart = blockStart + ATTR_OFFSET;

  console.log(`\n=== ${name} (index ${index}) ===`);
  console.log(`Block at 0x${blockStart.toString(16)}, Attrs at 0x${attrStart.toString(16)}`);
  console.log('');

  // Sort by offset for clarity
  const sortedOffsets = Object.keys(offsets).sort((a, b) => parseInt(a) - parseInt(b));

  for (const offsetHex of sortedOffsets) {
    const offset = parseInt(offsetHex);
    const name = offsets[offsetHex];
    const value = buffer[attrStart + offset];
    console.log(`0x${offset.toString(16).padStart(2, '0')}: ${name.padEnd(22)} = ${value}`);
  }
}

// Dump Chase Young (index 1) and Okudah (index 2)
dumpProspect(1, 'CHASE YOUNG');
dumpProspect(2, 'JEFF OKUDAH');

// Also show what the formula expects
console.log('\n=== CB_MantoMan FORMULA ATTRIBUTES ===');
const weights = require('./data/lookups/ovrweights.json');
const cbFormula = weights.find(w => w.Archetype === 'CB_MantoMan');
console.log('Attributes with non-zero weights:');
for (const [key, val] of Object.entries(cbFormula)) {
  const weight = parseFloat(val);
  if (weight > 0 && key.endsWith('Rating')) {
    console.log(`  ${key}: ${weight}`);
  }
}

console.log('\n=== DE_SmallerSpeedRusher FORMULA ATTRIBUTES ===');
const deFormula = weights.find(w => w.Archetype === 'DE_SmallerSpeedRusher');
console.log('Attributes with non-zero weights:');
for (const [key, val] of Object.entries(deFormula)) {
  const weight = parseFloat(val);
  if (weight > 0 && key.endsWith('Rating')) {
    console.log(`  ${key}: ${weight}`);
  }
}
