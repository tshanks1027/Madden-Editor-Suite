const fs = require('fs');

// Check the 2020 draft file to see actual ratings
const file = 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/CAREERDRAFT-2020DRAFT';
const buffer = fs.readFileSync(file);

const DATA_START = 0x46;
const BLOCK_SIZE = 0x10C8;
const ATTR_OFFSET = 0x1000;

// Load OVR weights
const weights = JSON.parse(fs.readFileSync('./data/lookups/ovrweights.json', 'utf-8'));

console.log('=== 2020 DRAFT CLASS - QB RATINGS ANALYSIS ===\n');

// Check first 10 players (QBs should be in there)
for (let i = 0; i < 15; i++) {
  const blockStart = DATA_START + (i * BLOCK_SIZE);
  const attrStart = blockStart + ATTR_OFFSET;

  const name = buffer.toString('ascii', attrStart, attrStart + 0x26).replace(/\0/g, ' ').trim();
  const position = buffer[attrStart + 0x4a];
  const archetype = buffer[attrStart + 0x4b];
  const storedOVR = buffer[attrStart + 0x51];

  // Read all QB-relevant ratings
  const ratings = {
    SPD: buffer[attrStart + 0x7B],
    ACC: buffer[attrStart + 0x52],
    AGI: buffer[attrStart + 0x53],
    AWR: buffer[attrStart + 0x54],
    THP: buffer[attrStart + 0x86],
    TAS: buffer[attrStart + 0x84],
    TAM: buffer[attrStart + 0x82],
    TAD: buffer[attrStart + 0x81],
    TOR: buffer[attrStart + 0x85],
    TUP: buffer[attrStart + 0x87],
    BSK: buffer[attrStart + 0x57],
    COD: buffer[attrStart + 0x5C],
    BCV: buffer[attrStart + 0x55],
    CAR: buffer[attrStart + 0x59]
  };

  // Only show QBs or first few players
  if (position === 0 || i < 6) {
    console.log(`${i+1}. ${name}`);
    console.log(`   Position: ${position} (0=QB), Archetype: ${archetype}, Stored OVR: ${storedOVR}`);

    if (position === 0) {
      // Calculate OVR using QB archetype formulas
      const archetypeMap = {0: 'QB_FieldGeneral', 1: 'QB_StrongArm', 2: 'QB_Improviser', 3: 'QB_Scrambler'};
      const archName = archetypeMap[archetype] || 'QB_FieldGeneral';
      const formula = weights.find(w => w.Archetype === archName);

      console.log(`   Using archetype: ${archName}`);
      console.log(`   TUP=${ratings.TUP}, BSK=${ratings.BSK}, TOR=${ratings.TOR}`);
      console.log(`   THP=${ratings.THP}, TAS=${ratings.TAS}, TAM=${ratings.TAM}, TAD=${ratings.TAD}`);

      if (formula) {
        let weightedSum = 0;
        const attrMap = {
          'SpeedRating': 'SPD', 'AccelerationRating': 'ACC', 'AgilityRating': 'AGI',
          'AwarenessRating': 'AWR', 'ThrowPowerRating': 'THP', 'ThrowAccuracyShortRating': 'TAS',
          'ThrowAccuracyMidRating': 'TAM', 'ThrowAccuracyDeepRating': 'TAD',
          'ThrowOnTheRunRating': 'TOR', 'ThrowUnderPressureRating': 'TUP',
          'BreakSackRating': 'BSK', 'ChangeOfDirectionRating': 'COD',
          'BCVisionRating': 'BCV', 'CarryingRating': 'CAR'
        };

        for (const [weightName, shortName] of Object.entries(attrMap)) {
          const weight = parseFloat(formula[weightName]) || 0;
          const value = ratings[shortName] || 0;
          weightedSum += value * weight;
        }

        const calculatedOVR = Math.round(weightedSum / 10);
        console.log(`   Calculated OVR: ${calculatedOVR} (game shows: ?)`);
        console.log(`   Diff from stored: ${storedOVR - calculatedOVR}`);
      }
    }
    console.log('');
  }
}

console.log('\n=== KEY FINDINGS ===');
console.log('If TUP and BSK are still low (< 50), the fix was not applied to this file.');
console.log('The fix only affects NEW draft classes generated after the code change.');
console.log('Existing files need to be regenerated to get the fix.');
