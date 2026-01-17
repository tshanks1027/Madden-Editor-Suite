/**
 * Check the user's edited draft class file
 */
const fs = require('fs');

const savedPath = 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden NFL 26\\Saves\\CAREERDRAFT-EDITED';
const saved = fs.readFileSync(savedPath);

console.log('Analyzing:', savedPath);
console.log('File size:', saved.length);

const HEADER_OFFSET = 0x46;
const BLOCK_SIZE = 4322;

console.log('\nFirst 15 prospects in saved file:');
for (let i = 0; i < 15; i++) {
  const attrStart = HEADER_OFFSET + (i * BLOCK_SIZE) + 0x1000;
  const firstName = saved.toString('ascii', attrStart, attrStart + 0x11).replace(/\0/g, '').trim();
  const lastName = saved.toString('ascii', attrStart + 0x11, attrStart + 0x26).replace(/\0/g, '').trim();
  const pos = saved[attrStart + 0x4a];
  const speed = saved[attrStart + 0x7B];
  const throwPower = saved[attrStart + 0x86];
  const awareness = saved[attrStart + 0x54];
  const acceleration = saved[attrStart + 0x52];
  const draftPick = saved[attrStart + 0x4e];
  console.log(`#${i+1}: ${firstName.padEnd(15)} ${lastName.padEnd(15)} | pos=${String(pos).padStart(2)} | pick=${String(draftPick).padStart(3)} | spd=${speed} | TP=${throwPower} | AWR=${awareness} | ACC=${acceleration}`);
}

// Also check the template
console.log('\n=== TEMPLATE FILE ===');
const templatePath = 'C:\\Users\\tshan\\Documents\\Dev\\madden-editor-suite\\data\\Templates\\CAREERDRAFT-2026Template';
const template = fs.readFileSync(templatePath);
console.log('Template size:', template.length);
console.log('\nFirst 15 prospects in TEMPLATE:');
for (let i = 0; i < 15; i++) {
  const attrStart = HEADER_OFFSET + (i * BLOCK_SIZE) + 0x1000;
  const firstName = template.toString('ascii', attrStart, attrStart + 0x11).replace(/\0/g, '').trim();
  const lastName = template.toString('ascii', attrStart + 0x11, attrStart + 0x26).replace(/\0/g, '').trim();
  const pos = template[attrStart + 0x4a];
  const speed = template[attrStart + 0x7B];
  const throwPower = template[attrStart + 0x86];
  const awareness = template[attrStart + 0x54];
  console.log(`#${i+1}: ${firstName.padEnd(15)} ${lastName.padEnd(15)} | pos=${String(pos).padStart(2)} | spd=${speed} | TP=${throwPower} | AWR=${awareness}`);
}
