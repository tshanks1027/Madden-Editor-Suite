/**
 * Analyze the 2026 template (original game file) to see if stored OVR matches calculated OVR
 * If they match in the template, we know our formula is correct
 * If they don't match, the game uses a different formula for draft classes
 */
const fs = require('fs');

const file = 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/CAREERDRAFT-2026Template';
const buffer = fs.readFileSync(file);

const DATA_START = 0x46;
const BLOCK_SIZE = 0x10C8;
const ATTR_OFFSET = 0x1000;

const weights = JSON.parse(fs.readFileSync('./data/lookups/ovrweights.json', 'utf-8'));

// QB archetype mappings
const QB_ARCHETYPES = {
  0: 'QB_FieldGeneral',
  1: 'QB_StrongArm',
  2: 'QB_Improviser',
  3: 'QB_Scrambler'
};

console.log('=== ANALYZING 2026 TEMPLATE (ORIGINAL GAME FILE) ===\n');
console.log('Looking for QBs to compare stored OVR vs calculated OVR\n');

let qbCount = 0;
for (let i = 0; i < 50 && qbCount < 5; i++) {
  const blockStart = DATA_START + (i * BLOCK_SIZE);
  const attrStart = blockStart + ATTR_OFFSET;

  const positionCode = buffer[attrStart + 0x4a];

  if (positionCode !== 0) continue; // Skip non-QBs
  qbCount++;

  const firstName = buffer.toString('ascii', attrStart, attrStart + 0x10).replace(/\0/g, '').trim();
  const lastName = buffer.toString('ascii', attrStart + 0x11, attrStart + 0x26).replace(/\0/g, '').trim();
  const archetypeCode = buffer[attrStart + 0x4b];
  const storedOVR = buffer[attrStart + 0x51];

  // Read QB ratings
  const ratings = {
    awareness: buffer[attrStart + 0x54],
    playAction: buffer[attrStart + 0x6d],
    throwAccuracyDeep: buffer[attrStart + 0x81],
    throwAccuracyMid: buffer[attrStart + 0x82],
    throwAccuracyShort: buffer[attrStart + 0x84],
    throwOnTheRun: buffer[attrStart + 0x85],
    throwPower: buffer[attrStart + 0x86],
    throwUnderPressure: buffer[attrStart + 0x87],
    // For scrambler formula
    speed: buffer[attrStart + 0x7b],
    acceleration: buffer[attrStart + 0x52],
    agility: buffer[attrStart + 0x53],
    ballCarrierVision: buffer[attrStart + 0x55],
    breakSack: buffer[attrStart + 0x57],
    carrying: buffer[attrStart + 0x59],
    changeOfDirection: buffer[attrStart + 0x5c],
  };

  const archetypeName = QB_ARCHETYPES[archetypeCode] || 'Unknown';
  const formula = weights.find(w => w.Archetype === archetypeName);

  console.log(`\n=== QB ${qbCount}: ${firstName} ${lastName} ===`);
  console.log(`Archetype: ${archetypeName} (code ${archetypeCode})`);
  console.log(`Stored OVR: ${storedOVR}`);
  console.log('Ratings:');
  console.log(`  THP: ${ratings.throwPower}, TAS: ${ratings.throwAccuracyShort}, TAM: ${ratings.throwAccuracyMid}, TAD: ${ratings.throwAccuracyDeep}`);
  console.log(`  TOR: ${ratings.throwOnTheRun}, TUP: ${ratings.throwUnderPressure}, AWR: ${ratings.awareness}, PLA: ${ratings.playAction}`);
  console.log(`  SPD: ${ratings.speed}, ACC: ${ratings.acceleration}, AGI: ${ratings.agility}, BSK: ${ratings.breakSack}`);

  if (!formula) {
    console.log('ERROR: Could not find formula for archetype');
    continue;
  }

  // Calculate OVR
  let calcSum = 0;
  const ratingMap = {
    'SpeedRating': ratings.speed,
    'AccelerationRating': ratings.acceleration,
    'AgilityRating': ratings.agility,
    'AwarenessRating': ratings.awareness,
    'BCVisionRating': ratings.ballCarrierVision,
    'BreakSackRating': ratings.breakSack,
    'CarryingRating': ratings.carrying,
    'ChangeOfDirectionRating': ratings.changeOfDirection,
    'PlayActionRating': ratings.playAction,
    'ThrowAccuracyDeepRating': ratings.throwAccuracyDeep,
    'ThrowAccuracyMidRating': ratings.throwAccuracyMid,
    'ThrowAccuracyShortRating': ratings.throwAccuracyShort,
    'ThrowOnTheRunRating': ratings.throwOnTheRun,
    'ThrowPowerRating': ratings.throwPower,
    'ThrowUnderPressureRating': ratings.throwUnderPressure,
  };

  console.log('\nCalculation:');
  for (const [weightName, value] of Object.entries(ratingMap)) {
    const weight = parseFloat(formula[weightName]) || 0;
    if (weight > 0) {
      const contrib = value * weight;
      calcSum += contrib;
      console.log(`  ${weightName.padEnd(28)}: ${value} * ${weight} = ${contrib.toFixed(2)}`);
    }
  }

  const calcOVR = Math.round(calcSum / 10);
  const floorOVR = Math.floor(calcSum / 10);
  console.log(`\nWeighted sum: ${calcSum.toFixed(2)}`);
  console.log(`Calculated OVR (round): ${calcOVR}`);
  console.log(`Calculated OVR (floor): ${floorOVR}`);
  console.log(`Stored OVR: ${storedOVR}`);
  console.log(`Match: ${calcOVR === storedOVR || floorOVR === storedOVR ? 'YES ✓' : `NO ✗ (diff: ${storedOVR - calcOVR})`}`);
}

console.log('\n\n=== CONCLUSION ===');
console.log('If the original template has matching stored/calculated OVRs, our formula is correct.');
console.log('If they don\'t match, the game uses a different calculation for draft classes.');
