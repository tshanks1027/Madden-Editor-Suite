/**
 * Compare OVRs across Template, Generated, and Edited files
 * Try to find the pattern
 */
const fs = require('fs');

const files = {
  template: 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/CAREERDRAFT-2026NOV22',
  generated: 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/CAREERDRAFT-2020DRAFT',
};

// Check if edited file exists
const editedPath = 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/CAREERDRAFT-EDITED';
if (fs.existsSync(editedPath)) {
  files.edited = editedPath;
}

const DATA_START = 0x46;
const BLOCK_SIZE = 4296;
const ATTR_OFFSET = 0x1000;

const weights = JSON.parse(fs.readFileSync('./data/lookups/ovrweights.json', 'utf-8'));

const ARCHETYPE_MAP = {
  0: 'QB_FieldGeneral',
  1: 'QB_StrongArm',
  2: 'QB_Improviser',
  3: 'QB_Scrambler'
};

function calculateOVR(buffer, attrStart, archetype) {
  const formulaName = ARCHETYPE_MAP[archetype] || 'QB_FieldGeneral';
  const formula = weights.find(w => w.Archetype === formulaName);

  if (!formula) return 0;

  const attrs = {
    speed: buffer[attrStart + 0x7B],
    acceleration: buffer[attrStart + 0x52],
    agility: buffer[attrStart + 0x53],
    awareness: buffer[attrStart + 0x54],
    throwPower: buffer[attrStart + 0x86],
    throwAccuracyShort: buffer[attrStart + 0x84],
    throwAccuracyMid: buffer[attrStart + 0x82],
    throwAccuracyDeep: buffer[attrStart + 0x81],
    throwOnTheRun: buffer[attrStart + 0x85],
    throwUnderPressure: buffer[attrStart + 0x87],
    playAction: buffer[attrStart + 0x6D],
    breakSack: buffer[attrStart + 0x57],
    changeOfDirection: buffer[attrStart + 0x5C],
  };

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
    changeOfDirection: 'ChangeOfDirectionRating',
  };

  let weightedSum = 0;
  for (const [attrName, value] of Object.entries(attrs)) {
    const weightName = attrToWeight[attrName];
    const weight = parseFloat(formula[weightName]) || 0;
    weightedSum += value * weight;
  }

  return Math.round(weightedSum / 10);
}

console.log('=== OVR COMPARISON ACROSS FILES ===\n');
console.log('File       | Player                | Arch | Stored | Calc | Game? | Diff');
console.log('-----------|----------------------|------|--------|------|-------|-----');

for (const [label, filePath] of Object.entries(files)) {
  const buffer = fs.readFileSync(filePath);

  // Check first 5 QBs
  let qbCount = 0;
  for (let block = 0; block < 100 && qbCount < 5; block++) {
    const attrStart = DATA_START + (block * BLOCK_SIZE) + ATTR_OFFSET;
    const position = buffer[attrStart + 0x4a];

    if (position !== 0) continue; // Skip non-QBs
    qbCount++;

    const name = buffer.toString('ascii', attrStart, attrStart + 0x26).replace(/\0/g, ' ').trim().slice(0, 20);
    const archetype = buffer[attrStart + 0x4b];
    const storedOVR = buffer[attrStart + 0x51];
    const calcOVR = calculateOVR(buffer, attrStart, archetype);
    const diff = storedOVR - calcOVR;

    console.log(`${label.padEnd(10)} | ${name.padEnd(20)} | ${archetype}    | ${storedOVR.toString().padStart(6)} | ${calcOVR.toString().padStart(4)} |       | ${diff >= 0 ? '+' : ''}${diff}`);
  }
  console.log('');
}

console.log('\n=== KEY INSIGHT ===');
console.log('If stored OVR differs from calculated OVR by a consistent amount,');
console.log('that tells us the game uses a different formula for draft prospects.');
console.log('');
console.log('The user says:');
console.log('  - Template file shows correct OVRs in game');
console.log('  - Generated file shows wrong OVRs in game (Burrow 76 instead of 83)');
console.log('');
console.log('So the question is: what makes template "correct" and generated "wrong"?');
