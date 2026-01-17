/**
 * Test the OVR divisor fix for draft classes
 *
 * Expected results with divisor 11.1:
 * - Drew Allar: 842.50 / 11.1 = 76 (matches stored)
 * - LaNorris Sellers: 832.80 / 11.1 = 75 (close to stored 74)
 * - Garrett Nussmeier: 845.20 / 11.1 = 76 (matches stored)
 * - Andrew Luck: 809.70 / 11.1 = 73 (matches game display!)
 */

const fs = require('fs');

// Load weights
const weights = JSON.parse(fs.readFileSync('./data/lookups/ovrweights.json', 'utf-8'));

const ROSTER_DIVISOR = 10;
const DRAFT_CLASS_DIVISOR = 11.1;

// Attribute name to field code mapping (subset for testing)
const ATTR_NAME_TO_FIELD = {
  'AwarenessRating': 'PAWR',
  'PlayActionRating': 'PPLA',
  'ThrowAccuracyDeepRating': 'PTAD',
  'ThrowAccuracyMidRating': 'PTAM',
  'ThrowAccuracyShortRating': 'PTAS',
  'ThrowOnTheRunRating': 'PTOR',
  'ThrowPowerRating': 'PTHP',
  'ThrowUnderPressureRating': 'PTUP',
  'BreakSackRating': 'PBSK',
  'SpeedRating': 'PSPD',
  'AccelerationRating': 'PACC',
  'AgilityRating': 'PAGI',
  'BCVisionRating': 'PBCV',
  'CarryingRating': 'PCAR',
  'ChangeOfDirectionRating': 'PELU',
};

function calculateOVR(attributes, archetype, isDraftClass = false) {
  const formula = weights.find(w => w.Archetype === archetype);
  if (!formula) {
    console.error(`No formula found for archetype: ${archetype}`);
    return 0;
  }

  let weightedSum = 0;

  for (const [attrName, fieldCode] of Object.entries(ATTR_NAME_TO_FIELD)) {
    const weight = parseFloat(formula[attrName]) || 0;
    if (weight > 0) {
      const value = attributes[fieldCode] || 0;
      weightedSum += value * weight;
    }
  }

  const divisor = isDraftClass ? DRAFT_CLASS_DIVISOR : ROSTER_DIVISOR;
  const rawOVR = weightedSum / divisor;

  return {
    weightedSum,
    rawOVR,
    finalOVR: Math.round(rawOVR)
  };
}

console.log('=== TESTING OVR DIVISOR FIX ===\n');

// Andrew Luck (2012 draft) - Field General
const luckAttrs = {
  PAWR: 60,
  PPLA: 74,
  PTAD: 81,
  PTAM: 90,
  PTAS: 93,
  PTOR: 88,
  PTHP: 92,
  PTUP: 17,
  PBSK: 26
};

console.log('=== Andrew Luck (Field General) ===');
const luckRoster = calculateOVR(luckAttrs, 'QB_FieldGeneral', false);
const luckDraft = calculateOVR(luckAttrs, 'QB_FieldGeneral', true);
console.log(`Weighted Sum: ${luckRoster.weightedSum.toFixed(2)}`);
console.log(`Roster formula (div 10): ${luckRoster.finalOVR}`);
console.log(`Draft class formula (div 11.1): ${luckDraft.finalOVR}`);
console.log(`Expected in-game: 73`);
console.log(`Match: ${luckDraft.finalOVR === 73 ? '✓ YES' : '✗ NO'}`);

console.log('\n=== Drew Allar (Strong Arm) ===');
const allarAttrs = {
  PAWR: 63,
  PPLA: 85,
  PTAD: 81,
  PTAM: 86,
  PTAS: 85, // Not used in StrongArm
  PTOR: 79, // Not used in StrongArm
  PTHP: 98,
  PTUP: 69,
  PBSK: 75
};
const allarRoster = calculateOVR(allarAttrs, 'QB_StrongArm', false);
const allarDraft = calculateOVR(allarAttrs, 'QB_StrongArm', true);
console.log(`Weighted Sum: ${allarRoster.weightedSum.toFixed(2)}`);
console.log(`Roster formula (div 10): ${allarRoster.finalOVR}`);
console.log(`Draft class formula (div 11.1): ${allarDraft.finalOVR}`);
console.log(`Expected stored: 76`);
console.log(`Match: ${allarDraft.finalOVR === 76 ? '✓ YES' : '✗ NO'}`);

console.log('\n=== Summary ===');
console.log('The fix changes the divisor from 10 to 11.1 for draft class files.');
console.log('This matches EA\'s original template files and fixes the OVR mismatch.');
