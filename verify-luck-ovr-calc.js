/**
 * Manually verify Andrew Luck's OVR calculation with QB_FieldGeneral
 */
const fs = require('fs');

// Load OVR weights
const weights = JSON.parse(fs.readFileSync('./data/lookups/ovrweights.json', 'utf-8'));
const qbFieldGeneral = weights.find(w => w.Archetype === 'QB_FieldGeneral');

console.log('=== QB_FieldGeneral OVR Formula ===\n');
console.log('Non-zero weights:');
for (const [key, value] of Object.entries(qbFieldGeneral)) {
  if (typeof value === 'number' && value > 0 && key !== 'DesiredHigh' && key !== 'DesiredLow' && key !== 'Sum') {
    console.log(`  ${key}: ${value}`);
  }
}

// Andrew Luck 2013 rookie CSV values (from the grep output)
// Format: Year,Season_Team,Player_Name,First_Name,Last_Name,Position,Jersey,Age,PID,PAM,College,Height,Weight,POVR,Archetype,PSPD,PACC,PSTR,PAGI,PAWR,PCTH,PCAR,PTHP,PKPW,PKAC,PRBK,PPBK,PTAK,PBTK,PJMP,PINJ,PSTA,PTGH,PTRK,PCOD,PBCV,PSTF,PSPM,PJUM,PIBL,PRBP,PRBF,PPBP,PPBF,PLDB,PBRS,PTUP,PPWM,PFNM,PBSH,PPUR,PPRC,PMCV,PZCV,PSPC,PCIT,PSRR,PMRR,PDRR,PHTP,PPRS,PREL,PTAS,PTAM,PTAD,PPLA,PTOR
// 2013,Colts,Andrew Luck,Andrew,Luck,QB,12,0,6295,gen_2_B_N_0018,Stanford,76,240,82,QB_Scrambler,82,88,59,84,60,72,58,92,25,28,26,22,21,37,86,98,97,69,49,55,72,24,66,72,15,52,23,45,33,47,26,17,10,10,19,24,25,15,21,83,39,55,36,14,12,10,26,93,90,81,74,88

const luckRatings = {
  // From CSV positions based on header
  PSPD: 82,      // Speed
  PACC: 88,      // Acceleration
  PSTR: 59,      // Strength
  PAGI: 84,      // Agility
  PAWR: 60,      // Awareness
  PCTH: 72,      // Catching
  PCAR: 58,      // Carrying
  PTHP: 92,      // Throw Power
  PKPW: 25,      // Kick Power
  PKAC: 28,      // Kick Accuracy
  PRBK: 26,      // Run Block
  PPBK: 22,      // Pass Block
  PTAK: 21,      // Tackle
  PBTK: 37,      // Break Tackle
  PJMP: 86,      // Jump
  PINJ: 98,      // Injury
  PSTA: 97,      // Stamina
  PTGH: 69,      // Toughness
  PTRK: 49,      // Trucking
  PCOD: 55,      // Change of Direction / Elusiveness
  PBCV: 72,      // Ball Carrier Vision
  PSTF: 24,      // Stiff Arm
  PSPM: 66,      // Spin Move
  PJUM: 72,      // Jumping (duplicate?)
  PIBL: 15,      // Impact Blocking
  PRBP: 52,      // Run Block Power
  PRBF: 23,      // Run Block Finesse
  PPBP: 45,      // Pass Block Power
  PPBF: 33,      // Pass Block Finesse
  PLDB: 47,      // Lead Block
  PBRS: 26,      // Break Sack (this is what the CSV uses)
  PTUP: 17,      // Throw Under Pressure
  PPWM: 10,      // Power Moves
  PFNM: 10,      // Finesse Moves
  PBSH: 19,      // Block Shedding
  PPUR: 24,      // Pursuit
  PPRC: 25,      // Play Recognition
  PMCV: 15,      // Man Coverage
  PZCV: 21,      // Zone Coverage
  PSPC: 83,      // Spectacular Catch
  PCIT: 39,      // Catch in Traffic
  PSRR: 55,      // Short Route Running
  PMRR: 36,      // Medium Route Running
  PDRR: 14,      // Deep Route Running
  PHTP: 12,      // Hit Power
  PPRS: 10,      // Press
  PREL: 26,      // Release
  PTAS: 93,      // Throw Accuracy Short
  PTAM: 90,      // Throw Accuracy Mid
  PTAD: 81,      // Throw Accuracy Deep
  PPLA: 74,      // Play Action
  PTOR: 88,      // Throw On The Run
};

console.log('\n=== Andrew Luck 2013 CSV Ratings ===\n');
console.log('Key QB ratings:');
console.log(`  ThrowPower (PTHP): ${luckRatings.PTHP}`);
console.log(`  ThrowAccuracyShort (PTAS): ${luckRatings.PTAS}`);
console.log(`  ThrowAccuracyMid (PTAM): ${luckRatings.PTAM}`);
console.log(`  ThrowAccuracyDeep (PTAD): ${luckRatings.PTAD}`);
console.log(`  ThrowOnTheRun (PTOR): ${luckRatings.PTOR}`);
console.log(`  ThrowUnderPressure (PTUP): ${luckRatings.PTUP}`);
console.log(`  Awareness (PAWR): ${luckRatings.PAWR}`);
console.log(`  PlayAction (PPLA): ${luckRatings.PPLA}`);
console.log(`  BreakSack (PBRS): ${luckRatings.PBRS}`);

console.log('\n=== OVR Calculation for QB_FieldGeneral ===\n');

// Map CSV fields to OVR weight field names
const fieldMapping = {
  'AwarenessRating': 'PAWR',
  'PlayActionRating': 'PPLA',
  'ThrowAccuracyDeepRating': 'PTAD',
  'ThrowAccuracyMidRating': 'PTAM',
  'ThrowAccuracyShortRating': 'PTAS',
  'ThrowOnTheRunRating': 'PTOR',
  'ThrowPowerRating': 'PTHP',
  'ThrowUnderPressureRating': 'PTUP',
};

let totalWeightedSum = 0;
console.log('Weight calculation:');

for (const [weightKey, csvField] of Object.entries(fieldMapping)) {
  const weight = parseFloat(qbFieldGeneral[weightKey]) || 0;
  const value = luckRatings[csvField] || 0;
  const contribution = weight * value;
  totalWeightedSum += contribution;
  console.log(`  ${weightKey.padEnd(30)} weight=${weight} * ${csvField}=${value.toString().padStart(2)} = ${contribution.toFixed(2)}`);
}

console.log(`\n  Total weighted sum: ${totalWeightedSum.toFixed(2)}`);
console.log(`  OVR (sum / 10): ${Math.round(totalWeightedSum / 10)}`);
console.log(`  OVR (Math.floor(sum / 10)): ${Math.floor(totalWeightedSum / 10)}`);

console.log('\n=== Comparison ===\n');
console.log('CSV stored OVR: 82');
console.log('Our calculated OVR: ' + Math.round(totalWeightedSum / 10));
console.log('Game shows OVR: 73');

// What if game uses floor instead of round?
console.log('\n=== If game uses floor ===');
console.log('Floor OVR: ' + Math.floor(totalWeightedSum / 10));

// Check sum of weights
let weightSum = 0;
for (const [key, value] of Object.entries(qbFieldGeneral)) {
  if (typeof value === 'number' && key.endsWith('Rating')) {
    weightSum += value;
  }
}
console.log('\n=== Weight Sum Verification ===');
console.log('Sum of all weights: ' + weightSum.toFixed(2));
console.log('Expected: 10');
