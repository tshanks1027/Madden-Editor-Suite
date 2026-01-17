const fs = require('fs');

const parserContent = fs.readFileSync('src/main/lib/draft-class/M26Parser.js', 'utf-8');
const writerContent = fs.readFileSync('src/main/lib/draft-class/M26Writer.js', 'utf-8');

// Extract attribute offsets from parser
const parserOffsets = {};
const parserRegex = /attributes\.(\w+)\s*=\s*attributeData\[0x([0-9A-Fa-f]+)\]/g;
let match;
while ((match = parserRegex.exec(parserContent)) !== null) {
  parserOffsets[match[1]] = match[2].toUpperCase();
}

// Extract attribute offsets from writer
const writerOffsets = {};
const writerRegex = /buffer\[offset \+ 0x([0-9A-Fa-f]+)\]\s*=\s*prospect\.(\w+)/g;
while ((match = writerRegex.exec(writerContent)) !== null) {
  writerOffsets[match[2]] = match[1].toUpperCase();
}

// Compare
const allKeys = new Set([...Object.keys(parserOffsets), ...Object.keys(writerOffsets)]);
const qbAttrs = ['throwPower', 'throwAccuracyShort', 'throwAccuracyMid', 'throwAccuracyDeep', 'throwOnTheRun', 'throwUnderPressure', 'playAction', 'breakSack', 'awareness', 'speed', 'acceleration', 'agility', 'strength'];

console.log('=== QB-RELEVANT ATTRIBUTES ===');
for (const attr of qbAttrs) {
  const pOffset = parserOffsets[attr] || 'NOT FOUND';
  const wOffset = writerOffsets[attr] || 'NOT FOUND';
  const status = pOffset === wOffset ? 'MATCH' : 'MISMATCH';
  console.log(`${attr}: Parser=0x${pOffset}, Writer=0x${wOffset} [${status}]`);
}

console.log('\n=== ALL ATTRIBUTE OFFSETS ===');
for (const key of Array.from(allKeys).sort()) {
  const pOffset = parserOffsets[key] || '--';
  const wOffset = writerOffsets[key] || '--';
  const status = pOffset === wOffset ? '' : ' << MISMATCH';
  console.log(`${key.padEnd(25)}: Parser=0x${pOffset.padEnd(4)}, Writer=0x${wOffset.padEnd(4)}${status}`);
}
