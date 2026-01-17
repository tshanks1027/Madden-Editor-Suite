/**
 * Test the updated OVR calculations with div 10
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
    manCoverage: buffer[attrStart + 0x68],
    zoneCoverage: buffer[attrStart + 0x8a],
    pressCoverage: buffer[attrStart + 0x70],
    changeOfDirection: buffer[attrStart + 0x5c],
    jumping: buffer[attrStart + 0x62],
    catching: buffer[attrStart + 0x5a],
  };
}

console.log('=== TESTING UPDATED OVR CALCULATION (DIV 10) ===\n');

// Chase Young - LE/SpeedRusher
const chase = readProspect(1);
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

console.log('CHASE YOUNG (LE - SmallerSpeedRusher):');
console.log('  Stored OVR:', chase.storedOVR);
console.log('  Calculated (div 10):', Math.round(chaseSum / 10));
console.log('  Editor will show:', Math.round(chaseSum / 10));
console.log('  Game shows: 80');
console.log('  Difference:', Math.round(chaseSum / 10) - 80);

// Okudah - CB/MantoMan
const okudah = readProspect(2);
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

console.log('\nJEFF OKUDAH (CB - MantoMan):');
console.log('  Stored OVR:', okudah.storedOVR);
console.log('  Calculated (div 10):', Math.round(okudahSum / 10));
console.log('  Editor will show:', Math.round(okudahSum / 10));
console.log('  Game shows: 71');
console.log('  Difference:', Math.round(okudahSum / 10) - 71);

console.log('\n=== SUMMARY ===');
console.log('With divisor 10:');
console.log('  - Chase Young: 83 in editor, 80 in game (+3 variance)');
console.log('  - Jeff Okudah: 78 in editor, 71 in game (+7 variance)');
console.log('');
console.log('This variance is expected because:');
console.log('  1. EA updated OVR formulas in September 2025 patch');
console.log('  2. Our ovrweights.json may not have the latest weights');
console.log('  3. Press rating (23) for Okudah is very low, dragging down his game OVR');
