/**
 * Verify OVR calculations for both Chase Young AND Okudah
 * to find the correct divisor
 */
const fs = require('fs');
const weights = require('./data/lookups/ovrweights.json');

const file = 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/CAREERDRAFT-2020DRAFT';
const buffer = fs.readFileSync(file);

const DATA_START = 0x46;
const BLOCK_SIZE = 0x10C8;
const ATTR_OFFSET = 0x1000;

function getProspect(index) {
  const blockStart = DATA_START + (index * BLOCK_SIZE);
  const attrStart = blockStart + ATTR_OFFSET;

  return {
    position: buffer[attrStart + 0x4a],
    archetype: buffer[attrStart + 0x4b],
    storedOVR: buffer[attrStart + 0x51],
    acceleration: buffer[attrStart + 0x52],
    agility: buffer[attrStart + 0x53],
    awareness: buffer[attrStart + 0x54],
    speed: buffer[attrStart + 0x7b],
    strength: buffer[attrStart + 0x7f],
    tackle: buffer[attrStart + 0x80],
    pursuit: buffer[attrStart + 0x71],
    playRecognition: buffer[attrStart + 0x6e],
    powerMoves: buffer[attrStart + 0x6f],
    finesseMoves: buffer[attrStart + 0x5d],
    blockShedding: buffer[attrStart + 0x56],
    hitPower: buffer[attrStart + 0x5e],
    manCoverage: buffer[attrStart + 0x68],
    zoneCoverage: buffer[attrStart + 0x8a],
    pressCoverage: buffer[attrStart + 0x70],
    jumping: buffer[attrStart + 0x62],
    catching: buffer[attrStart + 0x5a],
    changeOfDirection: buffer[attrStart + 0x5c],
  };
}

// Chase Young (index 1) - LE/SpeedRusher
const chase = getProspect(1);
console.log('=== CHASE YOUNG (index 1) ===');
console.log('Position:', chase.position, '(10=LE)');
console.log('Archetype:', chase.archetype, '(39=SpeedRusher)');
console.log('Stored OVR:', chase.storedOVR);

// Calculate with DE_SmallerSpeedRusher
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

console.log('Weighted sum:', chaseSum.toFixed(2));
console.log('Div 10:', Math.round(chaseSum / 10));
console.log('Div 10.34:', Math.round(chaseSum / 10.34));
console.log('Editor shows: 75, Game shows: 80');

// Jeff Okudah (index 2) - CB/MantoMan
const okudah = getProspect(2);
console.log('\n=== JEFF OKUDAH (index 2) ===');
console.log('Position:', okudah.position, '(16=CB)');
console.log('Archetype:', okudah.archetype, '(54=MantoMan)');
console.log('Stored OVR:', okudah.storedOVR);

// Calculate with CB_MantoMan
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

console.log('Weighted sum:', okudahSum.toFixed(2));
console.log('Div 10:', Math.round(okudahSum / 10));
console.log('Div 11.0:', Math.round(okudahSum / 11.0));
console.log('Editor shows: 74, Game shows: 71');

console.log('\n=== ANALYSIS ===');
console.log('If divisor = 10:');
console.log('  Chase: ' + Math.round(chaseSum / 10) + ' (game=80) - OFF BY ' + (Math.round(chaseSum / 10) - 80));
console.log('  Okudah: ' + Math.round(okudahSum / 10) + ' (game=71) - OFF BY ' + (Math.round(okudahSum / 10) - 71));

console.log('\nIf divisor = 10.34 (Chase\'s needed):');
console.log('  Chase: ' + Math.round(chaseSum / 10.34) + ' (game=80)');
console.log('  Okudah: ' + Math.round(okudahSum / 10.34) + ' (game=71) - OFF BY ' + (Math.round(okudahSum / 10.34) - 71));

console.log('\nIf divisor = 11.0:');
console.log('  Chase: ' + Math.round(chaseSum / 11.0) + ' (game=80) - OFF BY ' + (Math.round(chaseSum / 11.0) - 80));
console.log('  Okudah: ' + Math.round(okudahSum / 11.0) + ' (game=71) - OFF BY ' + (Math.round(okudahSum / 11.0) - 71));
