/**
 * Verify all Luck ratings in file match what editor should display
 */
const fs = require('fs');

const file = 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/CAREERDRAFT-2012DRAFT';
const buffer = fs.readFileSync(file);

const DATA_START = 0x46;
const ATTR_OFFSET = 0x1000;
const attrStart = DATA_START + ATTR_OFFSET;

console.log('=== ANDREW LUCK - ALL RATINGS FROM FILE ===\n');

// From screenshot: ACC=88, AGI=84, AWR=60, STK=37, BCV=72, BSH=19, BSK=38...
// Let me read ALL fields and see what's there

const ratings = {
  // From M26Parser.js mappings
  acceleration: { offset: 0x52, value: buffer[attrStart + 0x52] },
  agility: { offset: 0x53, value: buffer[attrStart + 0x53] },
  awareness: { offset: 0x54, value: buffer[attrStart + 0x54] },
  ballCarrierVision: { offset: 0x55, value: buffer[attrStart + 0x55] },
  blockShedding: { offset: 0x56, value: buffer[attrStart + 0x56] },
  breakSack: { offset: 0x57, value: buffer[attrStart + 0x57] },
  breakTackle: { offset: 0x58, value: buffer[attrStart + 0x58] },
  carrying: { offset: 0x59, value: buffer[attrStart + 0x59] },
  catching: { offset: 0x5A, value: buffer[attrStart + 0x5A] },
  catchInTraffic: { offset: 0x5B, value: buffer[attrStart + 0x5B] },
  changeOfDirection: { offset: 0x5C, value: buffer[attrStart + 0x5C] },
  finesseMoves: { offset: 0x5D, value: buffer[attrStart + 0x5D] },
  hitPower: { offset: 0x5E, value: buffer[attrStart + 0x5E] },
  impactBlocking: { offset: 0x5F, value: buffer[attrStart + 0x5F] },
  injury: { offset: 0x60, value: buffer[attrStart + 0x60] },
  jukeMove: { offset: 0x61, value: buffer[attrStart + 0x61] },
  jumping: { offset: 0x62, value: buffer[attrStart + 0x62] },
  kickAccuracy: { offset: 0x63, value: buffer[attrStart + 0x63] },
  kickPower: { offset: 0x64, value: buffer[attrStart + 0x64] },
  kickReturn: { offset: 0x65, value: buffer[attrStart + 0x65] },
  leadBlock: { offset: 0x66, value: buffer[attrStart + 0x66] },
  manCoverage: { offset: 0x68, value: buffer[attrStart + 0x68] },
  passBlockPower: { offset: 0x69, value: buffer[attrStart + 0x69] },
  passBlockFinesse: { offset: 0x6A, value: buffer[attrStart + 0x6A] },
  passBlock: { offset: 0x6B, value: buffer[attrStart + 0x6B] },
  playAction: { offset: 0x6D, value: buffer[attrStart + 0x6D] },
  playRecognition: { offset: 0x6E, value: buffer[attrStart + 0x6E] },
  powerMoves: { offset: 0x6F, value: buffer[attrStart + 0x6F] },
  pressCoverage: { offset: 0x70, value: buffer[attrStart + 0x70] },
  pursuit: { offset: 0x71, value: buffer[attrStart + 0x71] },
  release: { offset: 0x72, value: buffer[attrStart + 0x72] },
  deepRouteRunning: { offset: 0x73, value: buffer[attrStart + 0x73] },
  mediumRouteRunning: { offset: 0x74, value: buffer[attrStart + 0x74] },
  shortRouteRunning: { offset: 0x75, value: buffer[attrStart + 0x75] },
  runBlockFinesse: { offset: 0x76, value: buffer[attrStart + 0x76] },
  runBlockPower: { offset: 0x77, value: buffer[attrStart + 0x77] },
  runBlock: { offset: 0x78, value: buffer[attrStart + 0x78] },
  spectacularCatch: { offset: 0x7A, value: buffer[attrStart + 0x7A] },
  speed: { offset: 0x7B, value: buffer[attrStart + 0x7B] },
  spinMove: { offset: 0x7C, value: buffer[attrStart + 0x7C] },
  stamina: { offset: 0x7D, value: buffer[attrStart + 0x7D] },
  stiffArm: { offset: 0x7E, value: buffer[attrStart + 0x7E] },
  strength: { offset: 0x7F, value: buffer[attrStart + 0x7F] },
  tackle: { offset: 0x80, value: buffer[attrStart + 0x80] },
  throwAccuracyDeep: { offset: 0x81, value: buffer[attrStart + 0x81] },
  throwAccuracyMid: { offset: 0x82, value: buffer[attrStart + 0x82] },
  throwAccuracyShort: { offset: 0x84, value: buffer[attrStart + 0x84] },
  throwOnTheRun: { offset: 0x85, value: buffer[attrStart + 0x85] },
  throwPower: { offset: 0x86, value: buffer[attrStart + 0x86] },
  throwUnderPressure: { offset: 0x87, value: buffer[attrStart + 0x87] },
  toughness: { offset: 0x88, value: buffer[attrStart + 0x88] },
  trucking: { offset: 0x89, value: buffer[attrStart + 0x89] },
  zoneCoverage: { offset: 0x8A, value: buffer[attrStart + 0x8A] },
  overall: { offset: 0x51, value: buffer[attrStart + 0x51] },
};

console.log('Rating          | Offset | Value');
console.log('----------------|--------|------');
for (const [name, data] of Object.entries(ratings)) {
  console.log(`${name.padEnd(16)}| 0x${data.offset.toString(16).padStart(2, '0')}   | ${data.value}`);
}

// Now compare with what's shown in screenshot
console.log('\n\n=== COMPARISON WITH SCREENSHOT ===');
console.log('From screenshot visible columns:');
console.log('OVR=82, ACC=88, AGI=84, AWR=60, STK=37, BCV=72, BSH=19, BSK=38, CAR=58');
console.log('');
console.log('From file:');
console.log(`OVR=${ratings.overall.value}, ACC=${ratings.acceleration.value}, AGI=${ratings.agility.value}, AWR=${ratings.awareness.value}`);
console.log(`STK=${ratings.stiffArm.value}, BCV=${ratings.ballCarrierVision.value}, BSH=${ratings.blockShedding.value}, BSK=${ratings.breakSack.value}, CAR=${ratings.carrying.value}`);

// Check the problematic throwUnderPressure
console.log('\n\n=== THROW UNDER PRESSURE CHECK ===');
console.log(`throwUnderPressure (0x87): ${ratings.throwUnderPressure.value}`);
console.log('This is VERY LOW and would hurt QB OVR significantly');
console.log('');

// Calculate what OVR game would show with QB_Scrambler formula
console.log('\n=== RECALCULATING OVR WITH CORRECT DATA ===');

const weights = JSON.parse(fs.readFileSync('./data/lookups/ovrweights.json', 'utf-8'));
const formula = weights.find(w => w.Archetype === 'QB_Scrambler');

const attrMapping = {
  'SpeedRating': ratings.speed.value,
  'AccelerationRating': ratings.acceleration.value,
  'AgilityRating': ratings.agility.value,
  'AwarenessRating': ratings.awareness.value,
  'ThrowPowerRating': ratings.throwPower.value,
  'ThrowAccuracyShortRating': ratings.throwAccuracyShort.value,
  'ThrowAccuracyMidRating': ratings.throwAccuracyMid.value,
  'ThrowAccuracyDeepRating': ratings.throwAccuracyDeep.value,
  'ThrowOnTheRunRating': ratings.throwOnTheRun.value,
  'ThrowUnderPressureRating': ratings.throwUnderPressure.value,
  'BreakSackRating': ratings.breakSack.value,
  'ChangeOfDirectionRating': ratings.changeOfDirection.value,
  'BCVisionRating': ratings.ballCarrierVision.value,
  'CarryingRating': ratings.carrying.value,
};

let weightedSum = 0;
console.log('\nQB_Scrambler formula weights:');
for (const [attrName, value] of Object.entries(attrMapping)) {
  const weight = parseFloat(formula[attrName]) || 0;
  if (weight > 0) {
    const contribution = value * weight;
    weightedSum += contribution;
    console.log(`  ${attrName}: ${value} * ${weight} = ${contribution.toFixed(2)}`);
  }
}

const calculatedOVR = Math.round(weightedSum / 10);
console.log(`\nTotal weighted sum: ${weightedSum.toFixed(2)}`);
console.log(`Calculated OVR (sum/10): ${calculatedOVR}`);
console.log(`Stored OVR: ${ratings.overall.value}`);
console.log(`Game shows: 69`);

// What if throwUnderPressure was a reasonable value like 80?
console.log('\n\n=== WHAT IF TUP WAS 80 INSTEAD OF 17? ===');
const goodTUP = 80;
const tupWeight = parseFloat(formula['ThrowUnderPressureRating']) || 0;
const oldContrib = ratings.throwUnderPressure.value * tupWeight;
const newContrib = goodTUP * tupWeight;
const adjustedSum = weightedSum - oldContrib + newContrib;
const adjustedOVR = Math.round(adjustedSum / 10);

console.log(`Old TUP contribution: ${ratings.throwUnderPressure.value} * ${tupWeight} = ${oldContrib.toFixed(2)}`);
console.log(`New TUP contribution: ${goodTUP} * ${tupWeight} = ${newContrib.toFixed(2)}`);
console.log(`Adjusted weighted sum: ${adjustedSum.toFixed(2)}`);
console.log(`Adjusted OVR: ${adjustedOVR}`);
