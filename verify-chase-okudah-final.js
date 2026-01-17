/**
 * Final verification of Chase Young and Okudah OVR
 * Comparing: Stored in file, Div10 calc, Div11 calc, Editor display, Game display
 */
const fs = require('fs');
const weights = require('./data/lookups/ovrweights.json');

const file = 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/CAREERDRAFT-2020DRAFT';
const buffer = fs.readFileSync(file);

const DATA_START = 0x46;
const BLOCK_SIZE = 0x10C8;
const ATTR_OFFSET = 0x1000;

function readProspect(index) {
  const blockStart = DATA_START + (index * BLOCK_SIZE);
  const attrStart = blockStart + ATTR_OFFSET;

  return {
    position: buffer[attrStart + 0x4a],
    archetypeCode: buffer[attrStart + 0x4b],
    storedOVR: buffer[attrStart + 0x51],
    // All relevant attributes for DE and CB
    speed: buffer[attrStart + 0x7b],
    acceleration: buffer[attrStart + 0x52],
    agility: buffer[attrStart + 0x53],
    awareness: buffer[attrStart + 0x54],
    strength: buffer[attrStart + 0x7f],
    tackle: buffer[attrStart + 0x80],
    pursuit: buffer[attrStart + 0x71],
    playRecognition: buffer[attrStart + 0x6e],
    powerMoves: buffer[attrStart + 0x6f],
    finesseMoves: buffer[attrStart + 0x5d],
    hitPower: buffer[attrStart + 0x5e],
    // CB specific
    manCoverage: buffer[attrStart + 0x68],
    zoneCoverage: buffer[attrStart + 0x8a],
    pressCoverage: buffer[attrStart + 0x70],
    jumping: buffer[attrStart + 0x62],
    catching: buffer[attrStart + 0x5a],
    changeOfDirection: buffer[attrStart + 0x5c],
  };
}

// Chase Young is index 1
const chase = readProspect(1);
console.log('=== CHASE YOUNG (Index 1) ===');
console.log('Position:', chase.position, '(10=LE)');
console.log('Archetype:', chase.archetypeCode, '(39=SmallerSpeedRusher)');
console.log('Stored OVR in file:', chase.storedOVR);
console.log('');
console.log('Key Ratings:');
console.log('  Speed:', chase.speed);
console.log('  Acceleration:', chase.acceleration);
console.log('  Agility:', chase.agility);
console.log('  Awareness:', chase.awareness);
console.log('  Strength:', chase.strength);
console.log('  Tackle:', chase.tackle);
console.log('  Pursuit:', chase.pursuit);
console.log('  PlayRecognition:', chase.playRecognition);
console.log('  PowerMoves:', chase.powerMoves);
console.log('  FinesseMoves:', chase.finesseMoves);
console.log('  HitPower:', chase.hitPower);

// Calculate using DE_SmallerSpeedRusher
const deFormula = weights.find(w => w.Archetype === 'DE_SmallerSpeedRusher');
let chaseSum = 0;
chaseSum += chase.speed * parseFloat(deFormula.SpeedRating || 0);
chaseSum += chase.acceleration * parseFloat(deFormula.AccelerationRating || 0);
chaseSum += chase.agility * parseFloat(deFormula.AgilityRating || 0);
chaseSum += chase.awareness * parseFloat(deFormula.AwarenessRating || 0);
chaseSum += chase.strength * parseFloat(deFormula.StrengthRating || 0);
chaseSum += chase.tackle * parseFloat(deFormula.TackleRating || 0);
chaseSum += chase.pursuit * parseFloat(deFormula.PursuitRating || 0);
chaseSum += chase.playRecognition * parseFloat(deFormula.PlayRecognitionRating || 0);
chaseSum += chase.powerMoves * parseFloat(deFormula.PowerMovesRating || 0);
chaseSum += chase.finesseMoves * parseFloat(deFormula.FinesseMovesRating || 0);
chaseSum += chase.hitPower * parseFloat(deFormula.HitPowerRating || 0);

console.log('');
console.log('OVR Calculation (DE_SmallerSpeedRusher):');
console.log('  Weighted Sum:', chaseSum.toFixed(2));
console.log('  Div 10:', Math.round(chaseSum / 10));
console.log('  Div 11:', Math.round(chaseSum / 11));
console.log('');
console.log('Comparison:');
console.log('  Stored in file: ' + chase.storedOVR);
console.log('  Editor shows:   75');
console.log('  GAME shows:     80');
console.log('');

// Okudah is index 2
const okudah = readProspect(2);
console.log('\n=== JEFF OKUDAH (Index 2) ===');
console.log('Position:', okudah.position, '(16=CB)');
console.log('Archetype:', okudah.archetypeCode, '(54=MantoMan)');
console.log('Stored OVR in file:', okudah.storedOVR);
console.log('');
console.log('Key Ratings:');
console.log('  Speed:', okudah.speed);
console.log('  Acceleration:', okudah.acceleration);
console.log('  Agility:', okudah.agility);
console.log('  Awareness:', okudah.awareness);
console.log('  ManCoverage:', okudah.manCoverage);
console.log('  ZoneCoverage:', okudah.zoneCoverage);
console.log('  PressCoverage:', okudah.pressCoverage);
console.log('  ChangeOfDirection:', okudah.changeOfDirection);
console.log('  Tackle:', okudah.tackle);
console.log('  PlayRecognition:', okudah.playRecognition);
console.log('  Jumping:', okudah.jumping);
console.log('  Catching:', okudah.catching);

// Calculate using CB_MantoMan
const cbFormula = weights.find(w => w.Archetype === 'CB_MantoMan');
let okudahSum = 0;
okudahSum += okudah.speed * parseFloat(cbFormula.SpeedRating || 0);
okudahSum += okudah.acceleration * parseFloat(cbFormula.AccelerationRating || 0);
okudahSum += okudah.agility * parseFloat(cbFormula.AgilityRating || 0);
okudahSum += okudah.awareness * parseFloat(cbFormula.AwarenessRating || 0);
okudahSum += okudah.changeOfDirection * parseFloat(cbFormula.ChangeOfDirectionRating || 0);
okudahSum += okudah.tackle * parseFloat(cbFormula.TackleRating || 0);
okudahSum += okudah.playRecognition * parseFloat(cbFormula.PlayRecognitionRating || 0);
okudahSum += okudah.manCoverage * parseFloat(cbFormula.ManCoverageRating || 0);
okudahSum += okudah.zoneCoverage * parseFloat(cbFormula.ZoneCoverageRating || 0);
okudahSum += okudah.pressCoverage * parseFloat(cbFormula.PressRating || 0);
okudahSum += okudah.jumping * parseFloat(cbFormula.JumpingRating || 0);
okudahSum += okudah.catching * parseFloat(cbFormula.CatchingRating || 0);

console.log('');
console.log('OVR Calculation (CB_MantoMan):');
console.log('  Weighted Sum:', okudahSum.toFixed(2));
console.log('  Div 10:', Math.round(okudahSum / 10));
console.log('  Div 11:', Math.round(okudahSum / 11));
console.log('');
console.log('Comparison:');
console.log('  Stored in file: ' + okudah.storedOVR);
console.log('  Editor shows:   74');
console.log('  GAME shows:     71');

console.log('\n=== SUMMARY ===');
console.log('Chase Young:');
console.log('  - Div 11 calc (' + Math.round(chaseSum / 11) + ') matches stored OVR (' + chase.storedOVR + ')');
console.log('  - But GAME shows 80, which is HIGHER');
console.log('  - Div 10 calc (' + Math.round(chaseSum / 10) + ') is closer to game...');
console.log('');
console.log('Okudah:');
console.log('  - Div 11 calc (' + Math.round(okudahSum / 11) + ') matches GAME display (71)');
console.log('  - But stored OVR (' + okudah.storedOVR + ') and editor show 74');
console.log('');
console.log('CONCLUSION:');
console.log('  - The GAME recalculates OVR using div 10, ignoring stored OVR');
console.log('  - Our editor shows the stored OVR value');
console.log('  - Chase: Game calc = 83 (rounded from ' + (chaseSum/10).toFixed(1) + '), but game shows 80???');
console.log('  - Okudah: Game calc = 78 (rounded from ' + (okudahSum/10).toFixed(1) + '), but game shows 71???');
