/**
 * Check template file values for prospect 1
 */
const fs = require('fs');

const templatePath = 'C:\\Users\\tshan\\Documents\\Dev\\madden-editor-suite\\data\\Templates\\CAREERDRAFT-2026Template';
const template = fs.readFileSync(templatePath);

console.log('Template file size:', template.length);

const HEADER_OFFSET = 0x46;
const attrStart = HEADER_OFFSET + 0x1000;

const firstName = template.toString('ascii', attrStart, attrStart + 0x11).replace(/\0/g, ' ').trim();
const lastName = template.toString('ascii', attrStart + 0x11, attrStart + 0x26).replace(/\0/g, ' ').trim();

console.log('Prospect #1 name:', firstName, lastName);

const offsets = {
  position: 0x4a,
  acceleration: 0x52,
  agility: 0x53,
  awareness: 0x54,
  injury: 0x60,
  speed: 0x7B,
  stamina: 0x7D,
  strength: 0x7F,
  tackle: 0x80,
  throwAccuracyDeep: 0x81,
  throwAccuracyMid: 0x83,
  throwAccuracyShort: 0x84,
  throwOnTheRun: 0x85,
  throwPower: 0x86,
  throwUnderPressure: 0x87
};

console.log('\nTemplate prospect #1 values:');
for (const [name, offset] of Object.entries(offsets)) {
  console.log(`  ${name}: ${template[attrStart + offset]}`);
}
