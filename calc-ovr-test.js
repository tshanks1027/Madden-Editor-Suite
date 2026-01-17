const fs = require('fs');

// Load the generated file and calculate what OVR the game SHOULD show
const generatedFile = 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/CAREERDRAFT-2020DRAFT';
const genBuffer = fs.readFileSync(generatedFile);

const genAttr = 0x46 + 0x1000;

// Read all attributes for Joe Burrow
const attrs = {
  position: genBuffer[genAttr + 0x4a],
  archetype: genBuffer[genAttr + 0x4b],
  storedOVR: genBuffer[genAttr + 0x51],

  // Physical
  speed: genBuffer[genAttr + 0x7B],
  acceleration: genBuffer[genAttr + 0x52],
  agility: genBuffer[genAttr + 0x53],
  strength: genBuffer[genAttr + 0x7F],
  awareness: genBuffer[genAttr + 0x54],
  stamina: genBuffer[genAttr + 0x7D],
  changeOfDirection: genBuffer[genAttr + 0x5C],
  jumping: genBuffer[genAttr + 0x62],

  // Throwing
  throwPower: genBuffer[genAttr + 0x86],
  throwAccuracyShort: genBuffer[genAttr + 0x84],
  throwAccuracyMid: genBuffer[genAttr + 0x83],
  throwAccuracyDeep: genBuffer[genAttr + 0x81],
  throwOnTheRun: genBuffer[genAttr + 0x85],
  throwUnderPressure: genBuffer[genAttr + 0x87],
  playAction: genBuffer[genAttr + 0x6D],
  breakSack: genBuffer[genAttr + 0x57],

  // Other
  injury: genBuffer[genAttr + 0x60],
  toughness: genBuffer[genAttr + 0x88]
};

console.log('=== JOE BURROW ATTRIBUTES IN GENERATED FILE ===');
console.log('Position:', attrs.position, '(0=QB)');
console.log('Archetype:', attrs.archetype);
console.log('Stored OVR:', attrs.storedOVR);
console.log('');
console.log('Ratings:');
for (const [k, v] of Object.entries(attrs)) {
  if (k !== 'position' && k !== 'archetype' && k !== 'storedOVR') {
    console.log('  ' + k + ':', v);
  }
}

// Now load ovrweights.json and calculate what OVR should be
const weightsPath = './data/lookups/ovrweights.json';
if (fs.existsSync(weightsPath)) {
  const weights = JSON.parse(fs.readFileSync(weightsPath, 'utf-8'));

  // Find QB archetype formula - archetype ID 2 = QB_Improviser per the mapping
  const ARCHETYPE_ID_TO_FORMULA = {
    0: 'QB_FieldGeneral',
    1: 'QB_StrongArm',
    2: 'QB_Improviser',
    3: 'QB_Scrambler',
    4: 'QB_Scrambler'
  };

  const formulaName = ARCHETYPE_ID_TO_FORMULA[attrs.archetype] || 'QB_FieldGeneral';
  console.log('');
  console.log('Using formula:', formulaName);

  const qbFormula = weights.find(w => w.Archetype === formulaName);
  if (qbFormula) {
    console.log('Formula found:', qbFormula.Archetype);

    // Calculate OVR using the weights
    // Mapping attribute names to our field values
    const attrMapping = {
      'SpeedRating': attrs.speed,
      'AccelerationRating': attrs.acceleration,
      'AgilityRating': attrs.agility,
      'StrengthRating': attrs.strength,
      'AwarenessRating': attrs.awareness,
      'ThrowPowerRating': attrs.throwPower,
      'ThrowAccuracyShortRating': attrs.throwAccuracyShort,
      'ThrowAccuracyMidRating': attrs.throwAccuracyMid,
      'ThrowAccuracyDeepRating': attrs.throwAccuracyDeep,
      'ThrowOnTheRunRating': attrs.throwOnTheRun,
      'ThrowUnderPressureRating': attrs.throwUnderPressure,
      'PlayActionRating': attrs.playAction,
      'BreakSackRating': attrs.breakSack,
      'InjuryRating': attrs.injury,
      'ToughnessRating': attrs.toughness,
      'StaminaRating': attrs.stamina,
      'ChangeOfDirectionRating': attrs.changeOfDirection,
      'JumpingRating': attrs.jumping
    };

    let weightedSum = 0;
    let totalWeight = 0;

    console.log('');
    console.log('Attribute contributions:');
    for (const [attrName, value] of Object.entries(attrMapping)) {
      const weight = parseFloat(qbFormula[attrName]) || 0;
      if (weight > 0) {
        const contribution = value * weight / 10;
        weightedSum += value * weight;
        totalWeight += weight;
        console.log('  ' + attrName + ': ' + value + ' * ' + weight + ' = ' + contribution.toFixed(2));
      }
    }

    const calculatedOVR = Math.round(weightedSum / 10);
    console.log('');
    console.log('Total weighted sum:', weightedSum);
    console.log('Total weight:', totalWeight);
    console.log('Calculated OVR:', calculatedOVR);
    console.log('Stored OVR:', attrs.storedOVR);
    console.log('Game shows:', 64);
  }
}
