/**
 * Read Andrew Luck's ratings from the actual draft class file
 * and compare with what CSV says they should be
 */
const fs = require('fs');

const file = 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/CAREERDRAFT-2012DRAFT';
const buffer = fs.readFileSync(file);

const DATA_START = 0x46;
const BLOCK_SIZE = 0x10C8;
const ATTR_OFFSET = 0x1000;

// Andrew Luck should be player 0 (first pick)
const playerIndex = 0;
const blockStart = DATA_START + (playerIndex * BLOCK_SIZE);
const attrStart = blockStart + ATTR_OFFSET;

// Read name to confirm
const name = buffer.toString('ascii', attrStart, attrStart + 0x26).replace(/\0/g, ' ').trim();
console.log(`Player: ${name}`);
console.log(`Position byte at 0x4a: ${buffer[attrStart + 0x4a]} (0=QB)`);
console.log(`Archetype byte at 0x4b: ${buffer[attrStart + 0x4b]} (0=FieldGeneral, 3=Scrambler)`);
console.log(`Stored OVR at 0x51: ${buffer[attrStart + 0x51]}`);

// M26Parser.js offset mappings (from the file)
const ratingOffsets = {
  // Physical
  speed: 0x7B,
  acceleration: 0x52,
  agility: 0x53,
  awareness: 0x54,
  strength: 0x7F,

  // Throwing (QB important)
  throwPower: 0x86,
  throwAccuracyShort: 0x84,
  throwAccuracyMid: 0x82,
  throwAccuracyDeep: 0x81,
  throwOnTheRun: 0x85,
  throwUnderPressure: 0x87,
  playAction: 0x6D,
  breakSack: 0x57,

  // Other
  carrying: 0x59,
  ballCarrierVision: 0x55,
  changeOfDirection: 0x5C,
  injury: 0x60,
  stamina: 0x7D,
  toughness: 0x88,
};

console.log('\n=== Ratings from DRAFT CLASS FILE ===\n');
console.log('Rating               | Offset | File Value | Expected (CSV)');
console.log('---------------------|--------|------------|---------------');

// Expected CSV values for Luck 2013
const csvExpected = {
  speed: 82,
  acceleration: 88,
  agility: 84,
  awareness: 60,
  strength: 59,
  throwPower: 92,
  throwAccuracyShort: 93,
  throwAccuracyMid: 90,
  throwAccuracyDeep: 81,
  throwOnTheRun: 88,
  throwUnderPressure: 17,
  playAction: 74,
  breakSack: 26,
  carrying: 58,
  ballCarrierVision: 72,
  changeOfDirection: 55,
  injury: 98,
  stamina: 97,
  toughness: 69,
};

for (const [name, offset] of Object.entries(ratingOffsets)) {
  const fileValue = buffer[attrStart + offset];
  const expected = csvExpected[name] || '?';
  const match = fileValue === expected ? '✓' : '✗ MISMATCH';
  console.log(`${name.padEnd(20)} | 0x${offset.toString(16).padStart(2, '0')}   | ${fileValue.toString().padStart(10)} | ${expected.toString().padStart(8)} ${match}`);
}

// Now calculate OVR from file values using QB_FieldGeneral
console.log('\n=== OVR Calculation from FILE VALUES ===\n');

const weights = JSON.parse(fs.readFileSync('./data/lookups/ovrweights.json', 'utf-8'));
const qbFieldGeneral = weights.find(w => w.Archetype === 'QB_FieldGeneral');

const fileRatings = {
  awareness: buffer[attrStart + 0x54],
  playAction: buffer[attrStart + 0x6D],
  throwAccuracyDeep: buffer[attrStart + 0x81],
  throwAccuracyMid: buffer[attrStart + 0x82],
  throwAccuracyShort: buffer[attrStart + 0x84],
  throwOnTheRun: buffer[attrStart + 0x85],
  throwPower: buffer[attrStart + 0x86],
  throwUnderPressure: buffer[attrStart + 0x87],
};

console.log('File values for QB OVR calculation:');
let totalWeightedSum = 0;

const weightMapping = {
  'AwarenessRating': 'awareness',
  'PlayActionRating': 'playAction',
  'ThrowAccuracyDeepRating': 'throwAccuracyDeep',
  'ThrowAccuracyMidRating': 'throwAccuracyMid',
  'ThrowAccuracyShortRating': 'throwAccuracyShort',
  'ThrowOnTheRunRating': 'throwOnTheRun',
  'ThrowPowerRating': 'throwPower',
  'ThrowUnderPressureRating': 'throwUnderPressure',
};

for (const [weightKey, ratingKey] of Object.entries(weightMapping)) {
  const weight = parseFloat(qbFieldGeneral[weightKey]) || 0;
  const value = fileRatings[ratingKey];
  const contribution = weight * value;
  totalWeightedSum += contribution;
  console.log(`  ${weightKey.padEnd(30)} weight=${weight} * ${value.toString().padStart(2)} = ${contribution.toFixed(2)}`);
}

console.log(`\n  Total weighted sum: ${totalWeightedSum.toFixed(2)}`);
console.log(`  OVR (Math.round(sum / 10)): ${Math.round(totalWeightedSum / 10)}`);
console.log(`  OVR (Math.floor(sum / 10)): ${Math.floor(totalWeightedSum / 10)}`);

console.log('\n=== SUMMARY ===');
console.log(`File stored OVR: ${buffer[attrStart + 0x51]}`);
console.log(`Calculated from file values: ${Math.round(totalWeightedSum / 10)}`);
console.log(`Game shows: 73`);
