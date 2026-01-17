/**
 * Calculate Okudah's OVR properly with correct attribute reading
 */
const fs = require('fs');

const file = 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/CAREERDRAFT-2020DRAFT';
const buffer = fs.readFileSync(file);

const DATA_START = 0x46;
const BLOCK_SIZE = 0x10C8;
const ATTR_OFFSET = 0x1000;

const weights = JSON.parse(fs.readFileSync('./data/lookups/ovrweights.json', 'utf-8'));

// Okudah is index 2 (0-indexed)
const blockStart = DATA_START + (2 * BLOCK_SIZE);
const attrStart = blockStart + ATTR_OFFSET;

console.log('=== OKUDAH PROPER OVR CALCULATION ===\n');

// Read ratings using correct offsets
const ratings = {
  acceleration: buffer[attrStart + 0x52],      // 89
  agility: buffer[attrStart + 0x53],           // 88
  awareness: buffer[attrStart + 0x54],         // 78
  speed: buffer[attrStart + 0x7b],             // 90
  strength: buffer[attrStart + 0x7f],          // 66
  tackle: buffer[attrStart + 0x80],            // Check
  manCoverage: buffer[attrStart + 0x68],       // Check
  zoneCoverage: buffer[attrStart + 0x8a],      // Check
  pressCoverage: buffer[attrStart + 0x70],     // Check
  pursuit: buffer[attrStart + 0x71],           // Check
  playRecognition: buffer[attrStart + 0x6e],   // Check
  jumping: buffer[attrStart + 0x62],           // Check
  catching: buffer[attrStart + 0x5a],          // Check
  changeOfDirection: buffer[attrStart + 0x5c], // Check
  hitPower: buffer[attrStart + 0x5e],          // Check
};

console.log('Stored OVR:', buffer[attrStart + 0x51]);
console.log('Position:', buffer[attrStart + 0x4a], '(16=CB)');
console.log('Archetype:', buffer[attrStart + 0x4b], '(54=MantoMan)');
console.log('');
console.log('Ratings from file:');
for (const [name, value] of Object.entries(ratings)) {
  console.log(`  ${name.padEnd(20)}: ${value}`);
}

// Now calculate with CB_MantoMan formula
console.log('\n=== CB_MantoMan Formula ===');
const formula = weights.find(w => w.Archetype === 'CB_MantoMan');

// Print all non-zero weights in the formula
console.log('\nCB_MantoMan weights:');
for (const [key, val] of Object.entries(formula)) {
  const weight = parseFloat(val);
  if (weight > 0 && key.endsWith('Rating')) {
    console.log(`  ${key}: ${weight}`);
  }
}

// Map attributes for calculation
const attrMap = {
  'SpeedRating': ratings.speed,
  'AccelerationRating': ratings.acceleration,
  'AgilityRating': ratings.agility,
  'AwarenessRating': ratings.awareness,
  'ChangeOfDirectionRating': ratings.changeOfDirection,
  'TackleRating': ratings.tackle,
  'PlayRecognitionRating': ratings.playRecognition,
  'ManCoverageRating': ratings.manCoverage,
  'ZoneCoverageRating': ratings.zoneCoverage,
  'PressRating': ratings.pressCoverage,
  'JumpingRating': ratings.jumping,
  'CatchingRating': ratings.catching,
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
console.log(`OVR with divisor 11.1: ${Math.round(weightedSum / 11.1)}`);
console.log('');
console.log(`Stored OVR in file: ${buffer[attrStart + 0x51]}`);
console.log('Editor shows: 74');
console.log('Game shows: 71');
