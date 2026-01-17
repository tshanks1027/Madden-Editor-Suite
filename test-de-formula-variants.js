/**
 * Test different DE formula variants to find one that gives 80 for Chase Young
 */
const chase = {
  speed: 85,
  acceleration: 91,
  agility: 86,
  awareness: 74,
  strength: 86,
  tackle: 83,
  pursuit: 84,
  playRecognition: 71,
  powerMoves: 73,
  finesseMoves: 80,
  blockShedding: 75,
  hitPower: 84,
};

// Current DE_SmallerSpeedRusher formula
const currentWeights = {
  speed: 1,
  acceleration: 1.4,
  agility: 0.9,
  awareness: 1.2,
  strength: 0.5,
  tackle: 1.5,
  pursuit: 0.7,
  playRecognition: 0.2,
  powerMoves: 0.1,
  finesseMoves: 2.3,
  hitPower: 0.2,
  blockShedding: 0,
};

function calcOVR(weights, divisor) {
  let sum = 0;
  for (const [attr, weight] of Object.entries(weights)) {
    sum += chase[attr] * weight;
  }
  return { sum, ovr: Math.round(sum / divisor) };
}

console.log('=== CHASE YOUNG OVR CALCULATION ===\n');
console.log('Target: Game shows 80\n');

const current = calcOVR(currentWeights, 10);
console.log('Current DE_SmallerSpeedRusher (div 10):');
console.log(`  Sum: ${current.sum}, OVR: ${current.ovr}`);
console.log('');

// Test adding BlockShedding to formula
console.log('Testing with BlockShedding added:');
for (let bsWeight = 0.5; bsWeight <= 2; bsWeight += 0.5) {
  const testWeights = {...currentWeights, blockShedding: bsWeight};
  const result = calcOVR(testWeights, 10);
  console.log(`  BlockShed=${bsWeight}: Sum=${result.sum}, OVR=${result.ovr}`);
}

// What weight adjustments would give 80?
console.log('\n=== REVERSE ENGINEERING ===');
console.log('For OVR=80 with div 10, need sum=800');
console.log(`Current sum: ${current.sum}`);
console.log(`Need to reduce by: ${current.sum - 800}`);

// Try different divisors
console.log('\n=== DIVISOR SEARCH ===');
for (let div = 9.5; div <= 11.5; div += 0.25) {
  const ovr = Math.round(current.sum / div);
  console.log(`Div ${div.toFixed(2)}: OVR = ${ovr}`);
}

// The game might use a different formula entirely
// Let's see what formula would give exactly 800
console.log('\n=== HYPOTHETICAL FORMULA ===');
// If the game uses a simple formula with just key attributes:
const simpleCalc = {
  'Speed + Accel + Strength + Tackle + Finesse + Power + Pursuit + BlockShed':
    chase.speed + chase.acceleration + chase.strength + chase.tackle + chase.finesseMoves + chase.powerMoves + chase.pursuit + chase.blockShedding,
  'Speed*1.5 + Accel*1 + Finesse*2 + Tackle*1.5 + Others':
    chase.speed*1.5 + chase.acceleration*1 + chase.finesseMoves*2 + chase.tackle*1.5 + chase.pursuit*0.7 + chase.powerMoves*0.3 + chase.blockShedding*1 + chase.awareness*1,
};

for (const [name, sum] of Object.entries(simpleCalc)) {
  console.log(`${name}`);
  console.log(`  Sum: ${sum}, Div10 OVR: ${Math.round(sum/10)}`);
}

// Test if there's another archetype that gives closer result
console.log('\n=== OTHER DE ARCHETYPES ===');
const fs = require('fs');
const weights = require('./data/lookups/ovrweights.json');

['DE_PowerRusher', 'DE_RunStopper', 'DE_SmallerSpeedRusher'].forEach(arch => {
  const formula = weights.find(w => w.Archetype === arch);
  let sum = 0;
  sum += chase.speed * parseFloat(formula.SpeedRating || 0);
  sum += chase.acceleration * parseFloat(formula.AccelerationRating || 0);
  sum += chase.agility * parseFloat(formula.AgilityRating || 0);
  sum += chase.awareness * parseFloat(formula.AwarenessRating || 0);
  sum += chase.strength * parseFloat(formula.StrengthRating || 0);
  sum += chase.tackle * parseFloat(formula.TackleRating || 0);
  sum += chase.pursuit * parseFloat(formula.PursuitRating || 0);
  sum += chase.playRecognition * parseFloat(formula.PlayRecognitionRating || 0);
  sum += chase.powerMoves * parseFloat(formula.PowerMovesRating || 0);
  sum += chase.finesseMoves * parseFloat(formula.FinesseMovesRating || 0);
  sum += chase.hitPower * parseFloat(formula.HitPowerRating || 0);
  sum += chase.blockShedding * parseFloat(formula.BlockSheddingRating || 0);

  console.log(`${arch}:`);
  console.log(`  Sum: ${sum.toFixed(2)}, Div10: ${Math.round(sum/10)}, Div11: ${Math.round(sum/11)}`);
});

// Maybe BlockShedding is included?
console.log('\n=== CHECKING FOR MISSING ATTRIBUTES ===');
const deFormula = weights.find(w => w.Archetype === 'DE_SmallerSpeedRusher');
console.log('DE_SmallerSpeedRusher all weights:');
for (const [key, val] of Object.entries(deFormula)) {
  if (key !== 'Archetype') {
    const weight = parseFloat(val);
    if (weight > 0) {
      console.log(`  ${key}: ${weight}`);
    }
  }
}
