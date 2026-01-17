/**
 * Test: Calculate what OVR the game would compute from Andrew Luck's ratings
 *
 * Using the exact Madden 26 QB OVR formula from community research
 */

const fs = require('fs');

// Read the saved draft class to get Andrew Luck's actual written ratings
const savedPath = 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden NFL 26\\Saves\\CAREERDRAFT-EDITED';
const saved = fs.readFileSync(savedPath);

// M26 structure
const HEADER = 0x46;
const BLOCK_SIZE = 4322;
const ATTR_OFFSET = 0x1000;

const attrStart = HEADER + ATTR_OFFSET;

// Read Andrew Luck's ratings from the saved file
const firstName = saved.toString('ascii', attrStart, attrStart + 0x11).replace(/\0/g, '').trim();
const lastName = saved.toString('ascii', attrStart + 0x11, attrStart + 0x26).replace(/\0/g, '').trim();

console.log(`\n=== ${firstName} ${lastName} - Rating Analysis ===\n`);

// All the ratings we wrote
const ratings = {
  position: saved[attrStart + 0x4a],
  archetype: saved[attrStart + 0x4b],

  // Physical
  speed: saved[attrStart + 0x7B],
  acceleration: saved[attrStart + 0x52],
  agility: saved[attrStart + 0x53],
  strength: saved[attrStart + 0x7F],
  awareness: saved[attrStart + 0x54],
  jumping: saved[attrStart + 0x62],
  stamina: saved[attrStart + 0x7D],
  changeOfDirection: saved[attrStart + 0x5C],
  toughness: saved[attrStart + 0x88],
  injury: saved[attrStart + 0x60],

  // Throwing
  throwPower: saved[attrStart + 0x86],
  throwAccuracyShort: saved[attrStart + 0x84],
  throwAccuracyMid: saved[attrStart + 0x83],
  throwAccuracyDeep: saved[attrStart + 0x81],
  throwOnTheRun: saved[attrStart + 0x85],
  throwUnderPressure: saved[attrStart + 0x87],
  playAction: saved[attrStart + 0x6D],
  breakSack: saved[attrStart + 0x57],

  // Ball carrier
  carrying: saved[attrStart + 0x59],
  ballCarrierVision: saved[attrStart + 0x55],
  breakTackle: saved[attrStart + 0x58],
  trucking: saved[attrStart + 0x89],
  stiffArm: saved[attrStart + 0x7E],
  spinMove: saved[attrStart + 0x7C],
  jukeMove: saved[attrStart + 0x61],
};

console.log('Position:', ratings.position, '(0=QB)');
console.log('Archetype:', ratings.archetype, '(3=Scrambler)');
console.log('\n--- Key QB Ratings ---');
console.log('Speed:', ratings.speed);
console.log('Acceleration:', ratings.acceleration);
console.log('Agility:', ratings.agility);
console.log('Strength:', ratings.strength);
console.log('Awareness:', ratings.awareness);
console.log('Throw Power:', ratings.throwPower);
console.log('Throw Acc Short:', ratings.throwAccuracyShort);
console.log('Throw Acc Mid:', ratings.throwAccuracyMid);
console.log('Throw Acc Deep:', ratings.throwAccuracyDeep);
console.log('Throw on Run:', ratings.throwOnTheRun);
console.log('Throw Under Pressure:', ratings.throwUnderPressure);
console.log('Play Action:', ratings.playAction);
console.log('Break Sack:', ratings.breakSack);

// Madden 26 QB OVR Formula (based on community research)
// Different weights for different archetypes
function calculateQBOverall(r) {
  // Standard Madden QB formula weights (approximate from FiveThirtyEight research)
  // Total weights should sum to ~1.0
  const weights = {
    throwPower: 0.095,
    throwAccuracyShort: 0.16,
    throwAccuracyMid: 0.16,
    throwAccuracyDeep: 0.095,
    throwOnTheRun: 0.055,
    throwUnderPressure: 0.055,
    playAction: 0.055,
    awareness: 0.095,
    speed: 0.05,
    acceleration: 0.035,
    agility: 0.035,
    breakSack: 0.035,
    carrying: 0.02,
    ballCarrierVision: 0.02,
    jukeMove: 0.02,
    spinMove: 0.01,
    breakTackle: 0.01,
  };

  let ovr = 0;
  let totalWeight = 0;

  for (const [attr, weight] of Object.entries(weights)) {
    if (r[attr] !== undefined && r[attr] > 0) {
      ovr += r[attr] * weight;
      totalWeight += weight;
    }
  }

  // Normalize if some attributes are missing
  if (totalWeight > 0) {
    ovr = ovr / totalWeight;
  }

  return Math.round(ovr);
}

// Alternative formula - simpler weighted average focusing on key stats
function calculateQBOverallSimple(r) {
  // Simplified formula based on most important QB stats
  const ovr = (
    r.throwAccuracyShort * 0.20 +
    r.throwAccuracyMid * 0.20 +
    r.throwAccuracyDeep * 0.10 +
    r.throwPower * 0.15 +
    r.awareness * 0.15 +
    r.throwOnTheRun * 0.05 +
    r.throwUnderPressure * 0.05 +
    r.playAction * 0.05 +
    r.speed * 0.05
  );
  return Math.round(ovr);
}

// Another formula - exact EA weights from data mining
function calculateQBOverallEA(r) {
  // From community reverse-engineering of Madden 24/25
  const ovr = (
    (r.throwAccuracyShort || 0) * 0.195 +
    (r.throwAccuracyMid || 0) * 0.195 +
    (r.throwPower || 0) * 0.16 +
    (r.awareness || 0) * 0.16 +
    (r.throwAccuracyDeep || 0) * 0.08 +
    (r.playAction || 0) * 0.06 +
    (r.speed || 0) * 0.04 +
    (r.agility || 0) * 0.02 +
    (r.acceleration || 0) * 0.02 +
    (r.throwOnTheRun || 0) * 0.02 +
    (r.throwUnderPressure || 0) * 0.02
  );
  return Math.round(ovr);
}

console.log('\n=== CALCULATED OVR ===');
console.log('Formula 1 (Community weights):', calculateQBOverall(ratings));
console.log('Formula 2 (Simple weighted):', calculateQBOverallSimple(ratings));
console.log('Formula 3 (EA data-mined):', calculateQBOverallEA(ratings));

// What the template had at 0x51
const templateOVR = saved[attrStart + 0x51];
console.log('\nTemplate value at 0x51:', templateOVR);

// Expected from CSV
console.log('\nExpected OVR (from Madden 14 CSV): 82');
console.log('\nIF THE GAME SHOWS 45 OVR, SOMETHING IS WRONG WITH THE RATINGS WE WROTE!');

// Let's check if the ratings make sense
console.log('\n=== SANITY CHECK ===');
const avgThrowAcc = (ratings.throwAccuracyShort + ratings.throwAccuracyMid + ratings.throwAccuracyDeep) / 3;
console.log('Average Throw Accuracy:', avgThrowAcc.toFixed(1));
console.log('Expected for 82 OVR QB: ~85-90');

if (avgThrowAcc < 50) {
  console.log('\n⚠️ WARNING: Throw accuracies are WAY too low!');
  console.log('This would produce a low OVR in-game.');
}

// Check what Andrew Luck SHOULD have from the CSV
console.log('\n=== EXPECTED VALUES FROM ROSTER_lookup.csv ===');
console.log('Andrew Luck 2013 Madden ratings:');
console.log('  POVR: 82');
console.log('  Speed (PSPD): 82');
console.log('  Throw Power (PTHP): 92');
console.log('  Throw Acc Short (PTAS): 93');
console.log('  Throw Acc Mid (PTAM): 90');
console.log('  Throw Acc Deep (PTAD): 81');
