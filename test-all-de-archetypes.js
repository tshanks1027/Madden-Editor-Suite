/**
 * Test all DE archetypes to find which matches Chase Young's 80 OVR
 */
const fs = require('fs');
const weights = require('./data/lookups/ovrweights.json');

const file = 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/CAREERDRAFT-2020DRAFT';
const buffer = fs.readFileSync(file);

const DATA_START = 0x46;
const BLOCK_SIZE = 0x10C8;
const ATTR_OFFSET = 0x1000;

// Chase is index 1
const blockStart = DATA_START + (1 * BLOCK_SIZE);
const attrStart = blockStart + ATTR_OFFSET;

// Read Chase's actual attributes
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

console.log('=== Chase Young Ratings ===');
for (const [k,v] of Object.entries(ratings)) console.log('  ' + k + ': ' + v);

console.log('\n=== Testing ALL DE archetypes ===');

const deArchetypes = ['DE_PowerRusher', 'DE_RunStopper', 'DE_SmallerSpeedRusher'];

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

for (const archetype of deArchetypes) {
  const formula = weights.find(w => w.Archetype === archetype);
  if (!formula) continue;

  let weightedSum = 0;
  for (const [attrName, value] of Object.entries(attrMap)) {
    const weight = parseFloat(formula[attrName]) || 0;
    weightedSum += value * weight;
  }

  console.log('\n' + archetype + ':');
  console.log('  Sum: ' + weightedSum.toFixed(2));
  console.log('  Div 10: ' + Math.round(weightedSum / 10));
  console.log('  Div 11.0: ' + Math.round(weightedSum / 11.0));
  console.log('  Divisor needed for 80: ' + (weightedSum / 80).toFixed(2));
}

console.log('\n=== Target OVR ===');
console.log('Game shows: 80');
console.log('Editor shows: 75');
console.log('Stored in file: ' + buffer[attrStart + 0x51]);
