/**
 * Deep analysis of Andrew Luck in the draft class file
 * Goal: Figure out why game shows 73 OVR when we calculate 81
 */
const fs = require('fs');

const file = 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/CAREERDRAFT-2012DRAFT';
const buffer = fs.readFileSync(file);

const DATA_START = 0x46;
const BLOCK_SIZE = 0x10C8;
const ATTR_OFFSET = 0x1000;

// Player 0 = Andrew Luck
const playerIndex = 0;
const blockStart = DATA_START + (playerIndex * BLOCK_SIZE);
const attrStart = blockStart + ATTR_OFFSET;

console.log('=== ANDREW LUCK - COMPLETE BINARY DUMP ===\n');
console.log(`Block start: 0x${blockStart.toString(16)}`);
console.log(`Attr section start: 0x${attrStart.toString(16)}`);

// First, let's dump the ENTIRE attribute section (200 bytes) as hex
console.log('\n=== RAW HEX DUMP OF ATTRIBUTE SECTION (0x1000 - 0x10C8) ===\n');
const attrSection = buffer.slice(attrStart, attrStart + 0xC8);
for (let i = 0; i < attrSection.length; i += 16) {
  const hex = [];
  const ascii = [];
  for (let j = 0; j < 16 && i + j < attrSection.length; j++) {
    const byte = attrSection[i + j];
    hex.push(byte.toString(16).padStart(2, '0'));
    ascii.push(byte >= 32 && byte < 127 ? String.fromCharCode(byte) : '.');
  }
  console.log(`${(i).toString(16).padStart(4, '0')}: ${hex.join(' ')}  ${ascii.join('')}`);
}

// Load the weights
const weights = JSON.parse(fs.readFileSync('./data/lookups/ovrweights.json', 'utf-8'));

// Get archetype from file
const positionCode = buffer[attrStart + 0x4a];
const archetypeCode = buffer[attrStart + 0x4b];
const storedOVR = buffer[attrStart + 0x51];

console.log('\n=== KEY FIELDS ===');
console.log(`Position code at 0x4a: ${positionCode} (0=QB)`);
console.log(`Archetype code at 0x4b: ${archetypeCode}`);
console.log(`Stored OVR at 0x51: ${storedOVR}`);

// Map archetype code to formula name
const QB_ARCHETYPES = {
  0: 'QB_FieldGeneral',
  1: 'QB_StrongArm',
  2: 'QB_Improviser',
  3: 'QB_Scrambler'
};

const archetypeName = QB_ARCHETYPES[archetypeCode] || 'Unknown';
console.log(`Archetype: ${archetypeName}`);

// Now read ALL possible rating bytes and calculate with BOTH formulas
console.log('\n=== ALL BYTES IN RATING RANGE (0x52 - 0x8A) ===');
for (let offset = 0x52; offset <= 0x8A; offset++) {
  const value = buffer[attrStart + offset];
  if (value > 0 && value <= 99) {
    console.log(`0x${offset.toString(16)}: ${value}`);
  }
}

// M26Parser offset mappings
const knownOffsets = {
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

console.log('\n=== NAMED RATINGS FROM FILE ===');
const fileRatings = {};
for (const [offsetHex, name] of Object.entries(knownOffsets)) {
  const offset = parseInt(offsetHex, 16);
  const value = buffer[attrStart + offset];
  fileRatings[name] = value;
  console.log(`${name.padEnd(22)}: ${value}`);
}

// Calculate OVR with Field General (what game shows)
console.log('\n=== OVR CALCULATION WITH QB_FieldGeneral (archetype 0) ===');
const fieldGeneral = weights.find(w => w.Archetype === 'QB_FieldGeneral');

const fgMapping = {
  'AwarenessRating': fileRatings.awareness,
  'PlayActionRating': fileRatings.playAction,
  'ThrowAccuracyDeepRating': fileRatings.throwAccuracyDeep,
  'ThrowAccuracyMidRating': fileRatings.throwAccuracyMid,
  'ThrowAccuracyShortRating': fileRatings.throwAccuracyShort,
  'ThrowOnTheRunRating': fileRatings.throwOnTheRun,
  'ThrowPowerRating': fileRatings.throwPower,
  'ThrowUnderPressureRating': fileRatings.throwUnderPressure,
};

let fgSum = 0;
for (const [weightName, value] of Object.entries(fgMapping)) {
  const weight = parseFloat(fieldGeneral[weightName]) || 0;
  const contrib = weight * value;
  fgSum += contrib;
  console.log(`${weightName.padEnd(28)}: ${value} * ${weight} = ${contrib.toFixed(2)}`);
}
console.log(`\nTotal: ${fgSum.toFixed(2)}`);
console.log(`OVR (round): ${Math.round(fgSum / 10)}`);
console.log(`OVR (floor): ${Math.floor(fgSum / 10)}`);

// Calculate with Scrambler too for comparison
console.log('\n=== OVR CALCULATION WITH QB_Scrambler (archetype 3) ===');
const scrambler = weights.find(w => w.Archetype === 'QB_Scrambler');

const scramblerMapping = {
  'SpeedRating': fileRatings.speed,
  'AccelerationRating': fileRatings.acceleration,
  'AgilityRating': fileRatings.agility,
  'AwarenessRating': fileRatings.awareness,
  'BCVisionRating': fileRatings.ballCarrierVision,
  'BreakSackRating': fileRatings.breakSack,
  'CarryingRating': fileRatings.carrying,
  'ChangeOfDirectionRating': fileRatings.changeOfDirection,
  'ThrowAccuracyDeepRating': fileRatings.throwAccuracyDeep,
  'ThrowAccuracyMidRating': fileRatings.throwAccuracyMid,
  'ThrowAccuracyShortRating': fileRatings.throwAccuracyShort,
  'ThrowOnTheRunRating': fileRatings.throwOnTheRun,
  'ThrowPowerRating': fileRatings.throwPower,
  'ThrowUnderPressureRating': fileRatings.throwUnderPressure,
};

let scrSum = 0;
for (const [weightName, value] of Object.entries(scramblerMapping)) {
  const weight = parseFloat(scrambler[weightName]) || 0;
  if (weight > 0) {
    const contrib = weight * value;
    scrSum += contrib;
    console.log(`${weightName.padEnd(28)}: ${value} * ${weight} = ${contrib.toFixed(2)}`);
  }
}
console.log(`\nTotal: ${scrSum.toFixed(2)}`);
console.log(`OVR (round): ${Math.round(scrSum / 10)}`);
console.log(`OVR (floor): ${Math.floor(scrSum / 10)}`);

// What OVR would give us 73?
console.log('\n=== REVERSE ENGINEER: What ratings would give OVR 73? ===');
console.log('If game shows 73, then weighted sum should be ~730');
console.log(`Our Field General sum: ${fgSum.toFixed(2)}`);
console.log(`Difference: ${fgSum - 730} (we're ${((fgSum - 730) / 730 * 100).toFixed(1)}% too high)`);

// Check if there might be different offset mappings
console.log('\n=== CHECKING FOR UNMAPPED BYTES ===');
for (let offset = 0x52; offset <= 0x8A; offset++) {
  const offsetHex = '0x' + offset.toString(16);
  if (!knownOffsets[offsetHex]) {
    const value = buffer[attrStart + offset];
    if (value > 0) {
      console.log(`UNMAPPED 0x${offset.toString(16)}: ${value}`);
    }
  }
}

// Check bytes BEFORE 0x52 that might be ratings
console.log('\n=== BYTES BEFORE 0x52 (might be additional ratings) ===');
for (let offset = 0x40; offset < 0x52; offset++) {
  const value = buffer[attrStart + offset];
  console.log(`0x${offset.toString(16)}: ${value}`);
}
