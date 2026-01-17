/**
 * Calculate Luck's OVR with verified file values
 */
const fs = require('fs');

// Load weights
const weights = JSON.parse(fs.readFileSync('./data/lookups/ovrweights.json', 'utf-8'));
const fieldGeneral = weights.find(w => w.Archetype === 'QB_FieldGeneral');

// VERIFIED file values from the binary:
const fileValues = {
  speed: 82,           // 0x7b
  acceleration: 88,    // 0x52
  agility: 84,         // 0x53
  awareness: 60,       // 0x54
  throwPower: 92,      // 0x86
  throwAccuracyShort: 93,  // 0x84
  throwAccuracyMid: 90,    // 0x82
  throwAccuracyDeep: 81,   // 0x81
  throwOnTheRun: 88,       // 0x85
  throwUnderPressure: 17,  // 0x87
  playAction: 74,          // 0x6d
};

console.log('=== OVR CALCULATION WITH VERIFIED FILE VALUES ===\n');
console.log('Using QB_FieldGeneral formula (what game uses for Luck):\n');

// QB_FieldGeneral weights:
// AwarenessRating: 1.6
// PlayActionRating: 0.3
// ThrowAccuracyDeepRating: 1.2
// ThrowAccuracyMidRating: 1.8
// ThrowAccuracyShortRating: 1.8
// ThrowOnTheRunRating: 0.3
// ThrowPowerRating: 2.5
// ThrowUnderPressureRating: 0.5

const calculation = {
  'AwarenessRating': { value: fileValues.awareness, weight: 1.6 },
  'PlayActionRating': { value: fileValues.playAction, weight: 0.3 },
  'ThrowAccuracyDeepRating': { value: fileValues.throwAccuracyDeep, weight: 1.2 },
  'ThrowAccuracyMidRating': { value: fileValues.throwAccuracyMid, weight: 1.8 },
  'ThrowAccuracyShortRating': { value: fileValues.throwAccuracyShort, weight: 1.8 },
  'ThrowOnTheRunRating': { value: fileValues.throwOnTheRun, weight: 0.3 },
  'ThrowPowerRating': { value: fileValues.throwPower, weight: 2.5 },
  'ThrowUnderPressureRating': { value: fileValues.throwUnderPressure, weight: 0.5 },
};

let total = 0;
for (const [name, data] of Object.entries(calculation)) {
  const contrib = data.value * data.weight;
  total += contrib;
  console.log(`${name.padEnd(28)}: ${data.value} * ${data.weight} = ${contrib.toFixed(2)}`);
}

console.log(`\nTotal weighted sum: ${total.toFixed(2)}`);
console.log(`OVR (Math.round(sum / 10)): ${Math.round(total / 10)}`);
console.log(`OVR (Math.floor(sum / 10)): ${Math.floor(total / 10)}`);

console.log('\n=== COMPARISON ===');
console.log('Stored OVR in file (0x51): 81');
console.log('Game shows: 73');
console.log(`Our calculation: ${Math.round(total / 10)}`);

// Check if game might be using stored OVR or calculating differently
console.log('\n=== THEORY CHECK ===');
console.log('If game shows 73, what weighted sum would that require?');
console.log('73 * 10 = 730');
console.log(`Our sum: ${total.toFixed(2)}`);
console.log(`Difference: ${(730 - total).toFixed(2)} (need ${((730 - total) / total * 100).toFixed(1)}% more)`);

// What if TUP is being ignored?
console.log('\n=== WHAT IF TUP IS IGNORED? ===');
const noTupTotal = total - (17 * 0.5);
console.log(`Sum without TUP: ${noTupTotal.toFixed(2)}`);
console.log(`OVR without TUP: ${Math.round(noTupTotal / 10)}`);
