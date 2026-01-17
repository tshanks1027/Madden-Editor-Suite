/**
 * Debug Jeff Okudah's attributes to understand the OVR mismatch
 * Editor shows 74, Game shows 71
 * Our calculation with div 10 gives 70
 */
const fs = require('fs');

const file = 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/CAREERDRAFT-2020DRAFT';
const buffer = fs.readFileSync(file);

const DATA_START = 0x46;
const BLOCK_SIZE = 0x10C8;
const ATTR_OFFSET = 0x1000;

const weights = JSON.parse(fs.readFileSync('./data/lookups/ovrweights.json', 'utf-8'));

// Okudah is index 2 (3rd prospect)
const blockStart = DATA_START + (2 * BLOCK_SIZE);
const attrStart = blockStart + ATTR_OFFSET;

console.log('=== JEFF OKUDAH FULL ATTRIBUTE DUMP ===\n');

// M26Parser offset mappings for all ratings
const offsets = {
  0x52: 'acceleration',
  0x53: 'agility',
  0x54: 'awareness',
  0x55: 'ballCarrierVision',
  0x56: 'blockShedding',
  0x57: 'breakSack',
  0x58: 'breakTackle',
  0x59: 'carrying',
  0x5A: 'catching',
  0x5B: 'catchInTraffic',
  0x5C: 'changeOfDirection',
  0x5D: 'finesseMoves',
  0x5E: 'hitPower',
  0x5F: 'impactBlocking',
  0x60: 'injury',
  0x61: 'jukeMove',
  0x62: 'jumping',
  0x63: 'kickAccuracy',
  0x64: 'kickPower',
  0x65: 'kickReturn',
  0x66: 'leadBlock',
  0x68: 'manCoverage',
  0x69: 'passBlockPower',
  0x6A: 'passBlockFinesse',
  0x6B: 'passBlock',
  0x6D: 'playAction',
  0x6E: 'playRecognition',
  0x6F: 'powerMoves',
  0x70: 'pressCoverage',
  0x71: 'pursuit',
  0x72: 'release',
  0x73: 'deepRouteRunning',
  0x74: 'mediumRouteRunning',
  0x75: 'shortRouteRunning',
  0x76: 'runBlockFinesse',
  0x77: 'runBlockPower',
  0x78: 'runBlock',
  0x7A: 'spectacularCatch',
  0x7B: 'speed',
  0x7C: 'spinMove',
  0x7D: 'stamina',
  0x7E: 'stiffArm',
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
};

// Read all attributes
const attrs = {};
for (const [offset, name] of Object.entries(offsets)) {
  const off = parseInt(offset, 16);
  attrs[name] = buffer[attrStart + off];
}

console.log('Position code:', buffer[attrStart + 0x4a]);
console.log('Archetype code:', buffer[attrStart + 0x4b]);
console.log('Stored OVR:', buffer[attrStart + 0x51]);
console.log('');

// Print all attributes
for (const [name, value] of Object.entries(attrs)) {
  console.log(`${name.padEnd(25)}: ${value}`);
}

// Now calculate OVR using CB_MantoMan formula
console.log('\n=== CB_MantoMan Formula Calculation ===\n');
const formula = weights.find(w => w.Archetype === 'CB_MantoMan');

// OVRWeightsCalculator uses these mappings
const attrMapping = {
  'SpeedRating': attrs.speed,
  'AccelerationRating': attrs.acceleration,
  'AgilityRating': attrs.agility,
  'AwarenessRating': attrs.awareness,
  'ChangeOfDirectionRating': attrs.changeOfDirection,
  'TackleRating': attrs.tackle,
  'HitPowerRating': attrs.hitPower,
  'PlayRecognitionRating': attrs.playRecognition,
  'ManCoverageRating': attrs.manCoverage,
  'ZoneCoverageRating': attrs.zoneCoverage,
  'PressRating': attrs.pressCoverage,
  'PursuitRating': attrs.pursuit,
  'JumpingRating': attrs.jumping,
  'CatchingRating': attrs.catching,
};

let weightedSum = 0;
for (const [attrName, value] of Object.entries(attrMapping)) {
  const weight = parseFloat(formula[attrName]) || 0;
  if (weight > 0) {
    const contrib = value * weight;
    weightedSum += contrib;
    console.log(`${attrName.padEnd(28)}: ${value} * ${weight} = ${contrib.toFixed(2)}`);
  }
}

console.log(`\nWeighted sum: ${weightedSum.toFixed(2)}`);
console.log(`OVR with divisor 10: ${Math.round(weightedSum / 10)}`);
console.log(`OVR with divisor 11.1: ${Math.round(weightedSum / 11.1)}`);
console.log(`\nStored OVR: ${buffer[attrStart + 0x51]}`);
console.log('Game shows: 71');
console.log('Editor shows: 74');
