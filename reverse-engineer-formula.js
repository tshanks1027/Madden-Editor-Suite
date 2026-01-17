/**
 * Reverse engineer the actual OVR formula by looking at game-generated draft classes
 */
const fs = require('fs');

const file = 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/CAREERDRAFT-2026Template';
const buffer = fs.readFileSync(file);

const DATA_START = 0x46;
const BLOCK_SIZE = 0x10C8;
const ATTR_OFFSET = 0x1000;

console.log('=== REVERSE ENGINEERING THE OVR FORMULA ===\n');

// For Field General, the weights sum to 10:
// AWR: 1.6, PLA: 0.3, TAD: 1.2, TAM: 1.8, TAS: 1.8, TOR: 0.3, THP: 2.5, TUP: 0.5

// If stored OVR is 8-9 points lower than calculated, what multiplier would give that?
// Calculated: 84, Stored: 76 -> 76/84 = 0.905 (90.5%)
// Calculated: 83, Stored: 74 -> 74/83 = 0.892 (89.2%)
// Calculated: 85, Stored: 76 -> 76/85 = 0.894 (89.4%)

console.log('Ratio of Stored/Calculated OVR:');
console.log('Drew Allar: 76/84 = ' + (76/84).toFixed(4) + ' (' + (76/84*100).toFixed(1) + '%)');
console.log('LaNorris Sellers: 74/83 = ' + (74/83).toFixed(4) + ' (' + (74/83*100).toFixed(1) + '%)');
console.log('Garrett Nussmeier: 76/85 = ' + (76/85).toFixed(4) + ' (' + (76/85*100).toFixed(1) + '%)');

console.log('\nAverage ratio: ' + ((76/84 + 74/83 + 76/85) / 3).toFixed(4));

// Let's try another theory: maybe it's sumWeight/divisor is different
// Instead of dividing by 10, maybe draft classes divide by something else?
console.log('\n\n=== TESTING DIFFERENT DIVISORS ===');

// Drew Allar: weighted sum was 842.50, stored 76
// If sum/X = 76, then X = 842.50/76 = 11.09
console.log('Drew Allar: 842.50 / 76 = ' + (842.50/76).toFixed(2));

// LaNorris Sellers: weighted sum was 832.80, stored 74
// If sum/X = 74, then X = 832.80/74 = 11.25
console.log('LaNorris Sellers: 832.80 / 74 = ' + (832.80/74).toFixed(2));

// Garrett Nussmeier: weighted sum was 845.20, stored 76
// If sum/X = 76, then X = 845.20/76 = 11.12
console.log('Garrett Nussmeier: 845.20 / 76 = ' + (845.20/76).toFixed(2));

console.log('\nAverage divisor: ~11.15 instead of 10');

console.log('\n\n=== LET\'S TEST WITH DIVISOR 11.15 ===');
console.log('Drew Allar: 842.50 / 11.15 = ' + Math.round(842.50/11.15));
console.log('LaNorris Sellers: 832.80 / 11.15 = ' + Math.round(832.80/11.15));
console.log('Garrett Nussmeier: 845.20 / 11.15 = ' + Math.round(845.20/11.15));

console.log('\n\n=== TEST WITH Andrew Luck (2012 draft) ===');
// Luck's sum was 809.70, game shows 73
console.log('Luck weighted sum: 809.70');
console.log('If divisor is 11.15: ' + Math.round(809.70/11.15));
console.log('If divisor is 11: ' + Math.round(809.70/11));
console.log('If divisor is 11.1: ' + Math.round(809.70/11.1));
console.log('Game shows: 73');

// What divisor gives us 73?
console.log('\nTo get 73: 809.70 / 73 = ' + (809.70/73).toFixed(2));
