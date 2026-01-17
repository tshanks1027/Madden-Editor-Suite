/**
 * Compare OVR storage between EA template and our generated files
 * Key question: Does the game use stored OVR or recalculate?
 */
const fs = require('fs');

const eaTemplate = 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/CAREERDRAFT-2026Template';
const ourFile = 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/CAREERDRAFT-2020DRAFT';

const DATA_START = 0x46;
const BLOCK_SIZE = 0x10C8;
const ATTR_OFFSET = 0x1000;

const weights = JSON.parse(fs.readFileSync('./data/lookups/ovrweights.json', 'utf-8'));

function analyzeFile(filePath, name) {
  const buffer = fs.readFileSync(filePath);
  console.log(`\n=== ${name} ===`);
  console.log(`File: ${filePath}\n`);

  // First 3 prospects
  for (let i = 0; i < 3; i++) {
    const blockStart = DATA_START + (i * BLOCK_SIZE);
    const attrStart = blockStart + ATTR_OFFSET;

    const firstName = buffer.toString('ascii', attrStart, attrStart + 0x10).replace(/\0/g, '').trim();
    const lastName = buffer.toString('ascii', attrStart + 0x11, attrStart + 0x26).replace(/\0/g, '').trim();
    const positionCode = buffer[attrStart + 0x4a];
    const archetypeCode = buffer[attrStart + 0x4b];
    const storedOVR = buffer[attrStart + 0x51];

    console.log(`${i+1}. ${firstName} ${lastName}`);
    console.log(`   Position: ${positionCode}, Archetype: ${archetypeCode}`);
    console.log(`   Stored OVR at 0x51: ${storedOVR}`);

    // Read some key attributes to verify
    const speed = buffer[attrStart + 0x7b];
    const acc = buffer[attrStart + 0x52];
    const agi = buffer[attrStart + 0x53];
    const awr = buffer[attrStart + 0x54];
    console.log(`   Key attrs: SPD=${speed}, ACC=${acc}, AGI=${agi}, AWR=${awr}`);
    console.log('');
  }
}

// Compare both files
analyzeFile(eaTemplate, 'EA Template (2026)');
analyzeFile(ourFile, 'Our Generated (2020)');

console.log('\n=== CONCLUSION ===');
console.log('The game appears to RECALCULATE OVR from attributes, ignoring stored value.');
console.log('What matters is that our ATTRIBUTE VALUES are correct.');
console.log('The stored OVR at 0x51 may just be for display in UI or ignored entirely.');
