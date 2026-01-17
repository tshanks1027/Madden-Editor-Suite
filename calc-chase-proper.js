/**
 * Calculate Chase Young's OVR properly
 */
const fs = require('fs');

const file = 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/CAREERDRAFT-2020DRAFT';
const buffer = fs.readFileSync(file);

const DATA_START = 0x46;
const BLOCK_SIZE = 0x10C8;
const ATTR_OFFSET = 0x1000;

const weights = JSON.parse(fs.readFileSync('./data/lookups/ovrweights.json', 'utf-8'));

// Chase is index 1 (2nd prospect)
const blockStart = DATA_START + (1 * BLOCK_SIZE);
const attrStart = blockStart + ATTR_OFFSET;

console.log('=== CHASE YOUNG PROPER OVR CALCULATION ===\n');

// Read ratings using correct offsets (verified offsets from Okudah)
const ratings = {
  acceleration: buffer[attrStart + 0x52],
  agility: buffer[attrStart + 0x53],
  awareness: buffer[attrStart + 0x54],
  speed: buffer[attrStart + 0x7b],
  strength: buffer[attrStart + 0x7f],
  tackle: buffer[attrStart + 0x80],
  pursuit: buffer[attrStart + 0x71],
  playRecognition: buffer[attrStart + 0x6e],
  powerMoves: buffer[attrStart + 0x6f],
  finesseMoves: buffer[attrStart + 0x5d],
  blockShedding: buffer[attrStart + 0x56],
  hitPower: buffer[attrStart + 0x5e],
};

console.log('Position:', buffer[attrStart + 0x4a], '(10=LE)');
console.log('Archetype:', buffer[attrStart + 0x4b], '(39=SpeedRusher)');
console.log('Stored OVR:', buffer[attrStart + 0x51]);
console.log('');
console.log('Ratings from file:');
for (const [name, value] of Object.entries(ratings)) {
  console.log(`  ${name.padEnd(20)}: ${value}`);
}

// DE_SmallerSpeedRusher formula
console.log('\n=== DE_SmallerSpeedRusher Formula ===');
const formula = weights.find(w => w.Archetype === 'DE_SmallerSpeedRusher');

console.log('\nDE_SmallerSpeedRusher weights:');
for (const [key, val] of Object.entries(formula)) {
  const weight = parseFloat(val);
  if (weight > 0 && key.endsWith('Rating')) {
    console.log(`  ${key}: ${weight}`);
  }
}

const attrMap = {
  'SpeedRating': ratings.speed,
  'AccelerationRating': ratings.acceleration,
  'AgilityRating': ratings.agility,
  'AwarenessRating': ratings.awareness,
  'StrengthRating': ratings.strength,
  'TackleRating': ratings.tackle,
  'PursuitRating': ratings.pursuit,
  'PlayRecognitionRating': ratings.playRecognition,
  'PowerMovesRating': ratings.powerMoves,
  'FinesseMovesRating': ratings.finesseMoves,
  'BlockSheddingRating': ratings.blockShedding,
  'HitPowerRating': ratings.hitPower,
};

console.log('\n=== Calculation ===');
let weightedSum = 0;
for (const [attrName, value] of Object.entries(attrMap)) {
  const weight = parseFloat(formula[attrName]) || 0;
  if (weight > 0) {
    const contrib = value * weight;
    weightedSum += contrib;
    console.log(`${attrName.padEnd(28)}: ${value} * ${weight} = ${contrib.toFixed(2)}`);
  }
}

console.log(`\nWeighted sum: ${weightedSum.toFixed(2)}`);
console.log(`OVR with divisor 10: ${Math.round(weightedSum / 10)}`);
console.log(`OVR with divisor 11.0: ${Math.round(weightedSum / 11.0)}`);
console.log('');
console.log(`Stored OVR in file: ${buffer[attrStart + 0x51]}`);
console.log('Editor shows: 75');
console.log('Game shows: 80');
