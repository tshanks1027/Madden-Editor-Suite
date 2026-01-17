/**
 * Analyze the actual 2012 draft file
 *
 * Problem:
 * - Andrew Luck: Editor shows 82, Game shows 69
 * - RGIII: Editor shows 81, Game shows 66
 * - Richardson: Editor shows 80, Game shows 79
 *
 * Need to find: What's causing the discrepancy?
 */
const fs = require('fs');

const file = 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/CAREERDRAFT-2012DRAFT';
const buffer = fs.readFileSync(file);

const DATA_START = 0x46;
const BLOCK_SIZE = 4296;
const ATTR_OFFSET = 0x1000;

console.log('=== ANALYZING 2012 DRAFT CLASS ===\n');
console.log('File:', file);
console.log('Size:', buffer.length, 'bytes\n');

// Analyze first 3 prospects (Luck, RGIII, Richardson)
const prospects = [
  { name: 'Andrew Luck', editorOVR: 82, gameOVR: 69 },
  { name: 'Robert Griffin III', editorOVR: 81, gameOVR: 66 },
  { name: 'Trent Richardson', editorOVR: 80, gameOVR: 79 }
];

for (let i = 0; i < 3; i++) {
  const blockStart = DATA_START + (i * BLOCK_SIZE);
  const attrStart = blockStart + ATTR_OFFSET;

  const firstName = buffer.toString('ascii', attrStart, attrStart + 0x11).replace(/\0/g, '').trim();
  const lastName = buffer.toString('ascii', attrStart + 0x11, attrStart + 0x26).replace(/\0/g, '').trim();

  console.log(`\n=== BLOCK ${i}: ${firstName} ${lastName} ===`);
  console.log(`Expected: ${prospects[i].name}`);
  console.log(`Editor OVR: ${prospects[i].editorOVR}, Game OVR: ${prospects[i].gameOVR}`);
  console.log(`Difference: ${prospects[i].editorOVR - prospects[i].gameOVR} points\n`);

  // Basic info
  const position = buffer[attrStart + 0x4a];
  const archetype = buffer[attrStart + 0x4b];
  const storedOVR = buffer[attrStart + 0x51];

  console.log('Basic Info:');
  console.log(`  Position (0x4a): ${position} (0=QB, 1=HB)`);
  console.log(`  Archetype (0x4b): ${archetype}`);
  console.log(`  Stored OVR (0x51): ${storedOVR}`);

  // Key QB ratings (for Luck and RGIII)
  if (position === 0) {
    console.log('\nQB Ratings:');
    console.log(`  Speed (0x7B): ${buffer[attrStart + 0x7B]}`);
    console.log(`  Acceleration (0x52): ${buffer[attrStart + 0x52]}`);
    console.log(`  Agility (0x53): ${buffer[attrStart + 0x53]}`);
    console.log(`  Awareness (0x54): ${buffer[attrStart + 0x54]}`);
    console.log(`  ThrowPower (0x86): ${buffer[attrStart + 0x86]}`);
    console.log(`  ThrowAccShort (0x84): ${buffer[attrStart + 0x84]}`);
    console.log(`  ThrowAccMid (0x82): ${buffer[attrStart + 0x82]}`);
    console.log(`  ThrowAccDeep (0x81): ${buffer[attrStart + 0x81]}`);
    console.log(`  ThrowOnRun (0x85): ${buffer[attrStart + 0x85]}`);
    console.log(`  ThrowUnderPressure (0x87): ${buffer[attrStart + 0x87]}`);
    console.log(`  PlayAction (0x6D): ${buffer[attrStart + 0x6D]}`);
    console.log(`  BreakSack (0x57): ${buffer[attrStart + 0x57]}`);
  }

  // Key HB ratings (for Richardson)
  if (position === 1) {
    console.log('\nHB Ratings:');
    console.log(`  Speed (0x7B): ${buffer[attrStart + 0x7B]}`);
    console.log(`  Acceleration (0x52): ${buffer[attrStart + 0x52]}`);
    console.log(`  Agility (0x53): ${buffer[attrStart + 0x53]}`);
    console.log(`  Awareness (0x54): ${buffer[attrStart + 0x54]}`);
    console.log(`  Carrying (0x59): ${buffer[attrStart + 0x59]}`);
    console.log(`  BallCarrierVision (0x55): ${buffer[attrStart + 0x55]}`);
    console.log(`  BreakTackle (0x58): ${buffer[attrStart + 0x58]}`);
    console.log(`  Trucking (0x89): ${buffer[attrStart + 0x89]}`);
    console.log(`  Catching (0x5A): ${buffer[attrStart + 0x5A]}`);
    console.log(`  JukeMove (0x61): ${buffer[attrStart + 0x61]}`);
    console.log(`  SpinMove (0x7C): ${buffer[attrStart + 0x7C]}`);
    console.log(`  StiffArm (0x7E): ${buffer[attrStart + 0x7E]}`);
  }

  // Dump ALL bytes from 0x50 to 0x90 to see what's there
  console.log('\nRaw bytes 0x50-0x90:');
  for (let row = 0x50; row < 0x90; row += 16) {
    let hex = '';
    let vals = '';
    for (let col = 0; col < 16 && (row + col) < 0x90; col++) {
      const b = buffer[attrStart + row + col];
      hex += b.toString(16).padStart(2, '0') + ' ';
      vals += b.toString().padStart(3) + ' ';
    }
    console.log(`  0x${row.toString(16)}: ${hex}`);
    console.log(`       ${vals}`);
  }
}

// Now let's calculate what OVR the game SHOULD show based on our understanding
console.log('\n\n=== OVR CALCULATION CHECK ===');
console.log('Loading ovrweights.json...');

const weights = JSON.parse(fs.readFileSync('./data/lookups/ovrweights.json', 'utf-8'));

// Archetype mappings
const ARCHETYPE_MAP = {
  0: 'QB_FieldGeneral',
  1: 'QB_StrongArm',
  2: 'QB_Improviser',
  3: 'QB_Scrambler'
};

const HB_ARCHETYPE_MAP = {
  5: 'HB_PowerBack',
  6: 'HB_ElusiveBack',
  7: 'HB_ReceivingBack'
};

for (let i = 0; i < 3; i++) {
  const blockStart = DATA_START + (i * BLOCK_SIZE);
  const attrStart = blockStart + ATTR_OFFSET;

  const firstName = buffer.toString('ascii', attrStart, attrStart + 0x11).replace(/\0/g, '').trim();
  const lastName = buffer.toString('ascii', attrStart + 0x11, attrStart + 0x26).replace(/\0/g, '').trim();
  const position = buffer[attrStart + 0x4a];
  const archetype = buffer[attrStart + 0x4b];
  const storedOVR = buffer[attrStart + 0x51];

  let formula;
  if (position === 0) {
    formula = weights.find(w => w.Archetype === (ARCHETYPE_MAP[archetype] || 'QB_FieldGeneral'));
  } else if (position === 1) {
    formula = weights.find(w => w.Archetype === (HB_ARCHETYPE_MAP[archetype] || 'HB_PowerBack'));
  }

  if (formula) {
    console.log(`\n${firstName} ${lastName} - Archetype: ${formula.Archetype}`);

    // Calculate using formula
    let weightedSum = 0;
    const attrMapping = {
      'SpeedRating': buffer[attrStart + 0x7B],
      'AccelerationRating': buffer[attrStart + 0x52],
      'AgilityRating': buffer[attrStart + 0x53],
      'AwarenessRating': buffer[attrStart + 0x54],
      'StrengthRating': buffer[attrStart + 0x7F],
      'ThrowPowerRating': buffer[attrStart + 0x86],
      'ThrowAccuracyShortRating': buffer[attrStart + 0x84],
      'ThrowAccuracyMidRating': buffer[attrStart + 0x82],
      'ThrowAccuracyDeepRating': buffer[attrStart + 0x81],
      'ThrowOnTheRunRating': buffer[attrStart + 0x85],
      'ThrowUnderPressureRating': buffer[attrStart + 0x87],
      'PlayActionRating': buffer[attrStart + 0x6D],
      'BreakSackRating': buffer[attrStart + 0x57],
      'ChangeOfDirectionRating': buffer[attrStart + 0x5C],
      'BCVisionRating': buffer[attrStart + 0x55],
      'CarryingRating': buffer[attrStart + 0x59],
      'BreakTackleRating': buffer[attrStart + 0x58],
      'TruckingRating': buffer[attrStart + 0x89],
      'CatchingRating': buffer[attrStart + 0x5A],
      'JukeMoveRating': buffer[attrStart + 0x61],
      'SpinMoveRating': buffer[attrStart + 0x7C],
      'StiffArmRating': buffer[attrStart + 0x7E],
      'StaminaRating': buffer[attrStart + 0x7D],
      'InjuryRating': buffer[attrStart + 0x60],
      'ToughnessRating': buffer[attrStart + 0x88],
    };

    console.log('Weighted contributions:');
    for (const [attrName, value] of Object.entries(attrMapping)) {
      const weight = parseFloat(formula[attrName]) || 0;
      if (weight > 0) {
        const contribution = value * weight;
        weightedSum += contribution;
        console.log(`  ${attrName}: ${value} * ${weight} = ${contribution.toFixed(2)}`);
      }
    }

    const calculatedOVR = Math.round(weightedSum / 10);
    console.log(`\nWeighted Sum: ${weightedSum.toFixed(2)}`);
    console.log(`Calculated OVR: ${calculatedOVR}`);
    console.log(`Stored OVR: ${storedOVR}`);
    console.log(`Game shows: ${prospects[i].gameOVR}`);
    console.log(`Editor shows: ${prospects[i].editorOVR}`);
  }
}
