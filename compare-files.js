const fs = require('fs');

const templatePath = 'C:/Users/tshan/Documents/Dev/madden-editor-suite/data/templates/CAREERDRAFT-2026Template';
const savedPath = 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/CAREERDRAFT-EDITED';

const template = fs.readFileSync(templatePath);
const saved = fs.readFileSync(savedPath);

console.log('Template size:', template.length);
console.log('Saved size:', saved.length);

// M26 structure: Header 0x46, Block size 4322, Attributes at block_start + 0x1000
const HEADER = 0x46;
const BLOCK = 4322;
const ATTR_OFFSET = 0x1000;

// First prospect attribute section
const attr1_template = HEADER + ATTR_OFFSET;
const attr1_saved = HEADER + ATTR_OFFSET;

console.log('\n=== FIRST PROSPECT COMPARISON ===');
console.log('Attribute section starts at offset:', attr1_template);

// Key attribute offsets
const offsets = {
  'firstName': [0x00, 17],
  'lastName': [0x11, 21],
  'overall (0x49)': [0x49, 1],
  'acceleration (0x52)': [0x52, 1],
  'awareness (0x54)': [0x54, 1],
  'speed (0x7B)': [0x7B, 1],
  'throwAccuracyDeep (0x81)': [0x81, 1],
  'throwAccuracyMid (0x83)': [0x83, 1],
  'throwAccuracyShort (0x84)': [0x84, 1],
  'throwPower (0x86)': [0x86, 1],
};

for (const [name, [off, len]] of Object.entries(offsets)) {
  const tVal = len === 1 ? template[attr1_template + off] : template.slice(attr1_template + off, attr1_template + off + len).toString('ascii').replace(/\0/g, '');
  const sVal = len === 1 ? saved[attr1_saved + off] : saved.slice(attr1_saved + off, attr1_saved + off + len).toString('ascii').replace(/\0/g, '');
  const match = tVal === sVal ? 'SAME (NOT WRITTEN!)' : 'DIFFERENT';
  console.log(name + ': Template=' + tVal + ', Saved=' + sVal + ' [' + match + ']');
}

// Count total differences in first prospect's attribute section
let diffCount = 0;
const diffs = [];
for (let i = 0; i < 256; i++) {
  if (template[attr1_template + i] !== saved[attr1_saved + i]) {
    diffCount++;
    if (diffs.length < 20) {
      diffs.push('  0x' + i.toString(16) + ': ' + template[attr1_template + i] + ' -> ' + saved[attr1_saved + i]);
    }
  }
}
console.log('\nTotal byte differences in first 256 bytes of attributes:', diffCount);
if (diffs.length > 0) {
  console.log('First differences:');
  diffs.forEach(d => console.log(d));
}
