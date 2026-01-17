/**
 * Verify OVR calculation matches what game expects
 *
 * The problem: Burrow shows 83 in editor but 76 in game
 * We write 83 to 0x51, but game shows 76
 *
 * Hypothesis:
 * 1. Game recalculates OVR from attributes?
 * 2. There's a modifier or scaling factor?
 * 3. Some attribute is wrong, causing OVR to recalculate lower?
 */
const fs = require('fs');

const generatedFile = 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/CAREERDRAFT-2020DRAFT';
const buffer = fs.readFileSync(generatedFile);

const DATA_START = 0x46;
const BLOCK_SIZE = 4296;
const ATTR_OFFSET = 0x1000;

// Block 0 = Joe Burrow
const attr0 = DATA_START + ATTR_OFFSET;

console.log('=== JOE BURROW (GENERATED FILE) ===\n');

const name = buffer.toString('ascii', attr0, attr0 + 0x26).replace(/\0/g, ' ').trim();
console.log(`Name: ${name}`);

// Position and archetype
const position = buffer[attr0 + 0x4a];
const archetype = buffer[attr0 + 0x4b];
const storedOVR = buffer[attr0 + 0x51];

console.log(`Position: ${position} (0=QB)`);
console.log(`Archetype: ${archetype}`);
console.log(`Stored OVR (0x51): ${storedOVR}`);
console.log(`Game shows: 76 (per user)`);

// Read all QB-relevant attributes
const attrs = {
  speed: buffer[attr0 + 0x7B],
  acceleration: buffer[attr0 + 0x52],
  agility: buffer[attr0 + 0x53],
  awareness: buffer[attr0 + 0x54],
  throwPower: buffer[attr0 + 0x86],
  throwAccuracyShort: buffer[attr0 + 0x84],
  throwAccuracyMid: buffer[attr0 + 0x82],
  throwAccuracyDeep: buffer[attr0 + 0x81],
  throwOnTheRun: buffer[attr0 + 0x85],
  throwUnderPressure: buffer[attr0 + 0x87],
  playAction: buffer[attr0 + 0x6D],
  breakSack: buffer[attr0 + 0x57],
  injury: buffer[attr0 + 0x60],
  stamina: buffer[attr0 + 0x7D],
  toughness: buffer[attr0 + 0x88],
  strength: buffer[attr0 + 0x7F],
  changeOfDirection: buffer[attr0 + 0x5C],
  ballCarrierVision: buffer[attr0 + 0x55],
  carrying: buffer[attr0 + 0x59],
  jumping: buffer[attr0 + 0x62],
};

console.log('\n=== QB ATTRIBUTES ===');
for (const [k, v] of Object.entries(attrs)) {
  console.log(`  ${k}: ${v}`);
}

// Load OVR weights and calculate expected OVR
console.log('\n\n=== CALCULATING OVR WITH WEIGHTS ===');

const weightsPath = 'data/lookups/ovrweights.json';
let weights;
try {
  weights = JSON.parse(fs.readFileSync(weightsPath, 'utf-8'));
} catch (e) {
  console.log('Could not load ovrweights.json, checking alternate path');
  weights = JSON.parse(fs.readFileSync('./data/lookups/ovrweights.json', 'utf-8'));
}

// Find QB archetype formula
// Archetype mapping: 0=FieldGeneral, 1=StrongArm, 2=Improviser, 3=Scrambler
const ARCHETYPE_MAP = {
  0: 'QB_FieldGeneral',
  1: 'QB_StrongArm',
  2: 'QB_Improviser',
  3: 'QB_Scrambler'
};

const formulaName = ARCHETYPE_MAP[archetype] || 'QB_FieldGeneral';
const formula = weights.find(w => w.Archetype === formulaName);

console.log(`Using formula: ${formulaName}`);

if (formula) {
  // Map our attribute names to weight file names
  const attrToWeight = {
    speed: 'SpeedRating',
    acceleration: 'AccelerationRating',
    agility: 'AgilityRating',
    awareness: 'AwarenessRating',
    throwPower: 'ThrowPowerRating',
    throwAccuracyShort: 'ThrowAccuracyShortRating',
    throwAccuracyMid: 'ThrowAccuracyMidRating',
    throwAccuracyDeep: 'ThrowAccuracyDeepRating',
    throwOnTheRun: 'ThrowOnTheRunRating',
    throwUnderPressure: 'ThrowUnderPressureRating',
    playAction: 'PlayActionRating',
    breakSack: 'BreakSackRating',
    injury: 'InjuryRating',
    stamina: 'StaminaRating',
    toughness: 'ToughnessRating',
    strength: 'StrengthRating',
    changeOfDirection: 'ChangeOfDirectionRating',
    ballCarrierVision: 'BCVisionRating',
    carrying: 'CarryingRating',
    jumping: 'JumpingRating',
  };

  let weightedSum = 0;
  let totalWeight = 0;

  console.log('\nAttribute contributions:');
  for (const [attrName, value] of Object.entries(attrs)) {
    const weightName = attrToWeight[attrName];
    const weight = parseFloat(formula[weightName]) || 0;
    if (weight > 0) {
      weightedSum += value * weight;
      totalWeight += weight;
      console.log(`  ${attrName}: ${value} * ${weight} = ${(value * weight).toFixed(2)}`);
    }
  }

  // Standard OVR calculation: weightedSum / 10 (weights sum to 10)
  const calculatedOVR = Math.round(weightedSum / 10);

  console.log('\n=== OVR COMPARISON ===');
  console.log(`Weighted sum: ${weightedSum.toFixed(2)}`);
  console.log(`Total weight: ${totalWeight.toFixed(2)}`);
  console.log(`Calculated OVR: ${calculatedOVR}`);
  console.log(`Stored OVR: ${storedOVR}`);
  console.log(`Game shows: 76`);

  if (calculatedOVR !== storedOVR) {
    console.log(`\n*** MISMATCH! Calculated ${calculatedOVR} but stored ${storedOVR}`);
  }

  if (calculatedOVR !== 76) {
    console.log(`\n*** Game shows 76 but we calculate ${calculatedOVR}`);
    console.log(`   This suggests either:`);
    console.log(`   1. Game uses different weights`);
    console.log(`   2. One or more attributes are being read from wrong offset`);
    console.log(`   3. Game has additional factors not in our calculation`);
  }
}

// Also check 0x83 - the unknown field
console.log('\n\n=== UNKNOWN FIELD 0x83 ===');
console.log(`Value at 0x83: ${buffer[attr0 + 0x83]}`);
console.log('This field has low values (10-36) and may affect something');

// Check field 0x6C
console.log('\n=== UNKNOWN FIELD 0x6C ===');
console.log(`Value at 0x6C: ${buffer[attr0 + 0x6C]}`);
