/**
 * Detailed comparison of template vs generated files
 * Focus on attribute section bytes
 */
const fs = require('fs');

const templateFile = 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/CAREERDRAFT-2026NOV22';
const generatedFile = 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/CAREERDRAFT-2020DRAFT';

const templateBuf = fs.readFileSync(templateFile);
const generatedBuf = fs.readFileSync(generatedFile);

const DATA_START = 0x46;
const BLOCK_SIZE = 4296;
const ATTR_OFFSET = 0x1000;

// Block 0 attribute sections
const tAttr = DATA_START + ATTR_OFFSET;
const gAttr = DATA_START + ATTR_OFFSET;

console.log('=== COMPARING ATTRIBUTE SECTIONS BYTE BY BYTE ===\n');

// Template: Fernando Mendoza, Generated: Joe Burrow
const tName = templateBuf.toString('ascii', tAttr, tAttr + 0x26).replace(/\0/g, ' ').trim();
const gName = generatedBuf.toString('ascii', gAttr, gAttr + 0x26).replace(/\0/g, ' ').trim();

console.log(`Template: ${tName}`);
console.log(`Generated: ${gName}`);
console.log('');

// Compare bytes from 0x50 to 0xA0
console.log('Offset | Template | Generated | Diff | Known Field');
console.log('-------|----------|-----------|------|------------');

const KNOWN_FIELDS = {
  0x51: 'OVR',
  0x52: 'acceleration',
  0x53: 'agility',
  0x54: 'awareness',
  0x55: 'ballCarrierVision',
  0x56: 'blockShedding',
  0x57: 'breakSack',
  0x58: 'breakTackle',
  0x59: 'carrying',
  0x5A: 'catching',
  0x5B: 'catchInTraffic',
  0x5C: 'changeOfDirection',
  0x5D: 'finesseMoves',
  0x5E: 'hitPower',
  0x5F: 'impactBlocking',
  0x60: 'injury',
  0x61: 'jukeMove',
  0x62: 'jumping',
  0x63: 'kickAccuracy',
  0x64: 'kickPower',
  0x65: 'kickReturn',
  0x66: 'leadBlock',
  0x67: '??? (varies)',
  0x68: 'manCoverage',
  0x69: 'passBlockPower',
  0x6A: 'passBlockFinesse',
  0x6B: 'passBlock',
  0x6C: '??? UNKNOWN',
  0x6D: 'playAction',
  0x6E: 'playRecognition',
  0x6F: 'powerMoves',
  0x70: 'pressCoverage',
  0x71: 'pursuit',
  0x72: 'release',
  0x73: 'deepRouteRunning',
  0x74: 'mediumRouteRunning',
  0x75: 'shortRouteRunning',
  0x76: 'runBlockFinesse',
  0x77: 'runBlockPower',
  0x78: 'runBlock',
  0x79: '??? (flag)',
  0x7A: 'spectacularCatch',
  0x7B: 'speed',
  0x7C: 'spinMove',
  0x7D: 'stamina',
  0x7E: 'stiffArm',
  0x7F: 'strength',
  0x80: 'tackle',
  0x81: 'throwAccuracyDeep',
  0x82: 'throwAccuracyMid',
  0x83: '??? UNKNOWN',
  0x84: 'throwAccuracyShort',
  0x85: 'throwOnTheRun',
  0x86: 'throwPower',
  0x87: 'throwUnderPressure',
  0x88: 'toughness',
  0x89: 'trucking',
  0x8A: 'zoneCoverage',
  0x8B: 'longSnap',
  0x8C: 'devTrait',
};

// Focus on problem area 0x67 and 0x6C
for (let off = 0x50; off <= 0x90; off++) {
  const tVal = templateBuf[tAttr + off];
  const gVal = generatedBuf[gAttr + off];
  const diff = (tVal !== gVal) ? '***' : '';
  const fieldName = KNOWN_FIELDS[off] || '';

  console.log(`0x${off.toString(16).padStart(2, '0')}   | ${tVal.toString().padStart(8)} | ${gVal.toString().padStart(9)} | ${diff.padStart(4)} | ${fieldName}`);
}

// Now let's check what Burrow's expected ratings should be
console.log('\n\n=== JOE BURROW EXPECTED VS GENERATED ===');
console.log('Joe Burrow 2020 draft prospect expected ratings:');
console.log('  ThrowPower: ~95-97');
console.log('  ThrowAccuracyShort: ~85-90');
console.log('  ThrowAccuracyMid: ~85-90');
console.log('  ThrowAccuracyDeep: ~85-90');
console.log('  Speed: ~75-80');
console.log('  OVR: ~83-85 (for top prospect)');

console.log('\nGenerated Burrow values:');
console.log(`  OVR (0x51): ${generatedBuf[gAttr + 0x51]}`);
console.log(`  ThrowPower (0x86): ${generatedBuf[gAttr + 0x86]}`);
console.log(`  ThrowAccuracyShort (0x84): ${generatedBuf[gAttr + 0x84]}`);
console.log(`  ThrowAccuracyMid (0x82): ${generatedBuf[gAttr + 0x82]}`);
console.log(`  ThrowAccuracyDeep (0x81): ${generatedBuf[gAttr + 0x81]}`);
console.log(`  Speed (0x7B): ${generatedBuf[gAttr + 0x7B]}`);
console.log(`  Awareness (0x54): ${generatedBuf[gAttr + 0x54]}`);

// Check 0x67 and 0x6C specifically - why do these differ?
console.log('\n\n=== UNKNOWN FIELDS ANALYSIS ===');
console.log(`0x67 - Template: ${templateBuf[tAttr + 0x67]}, Generated: ${generatedBuf[gAttr + 0x67]}`);
console.log(`0x6C - Template: ${templateBuf[tAttr + 0x6C]}, Generated: ${generatedBuf[gAttr + 0x6C]}`);
console.log(`0x83 - Template: ${templateBuf[tAttr + 0x83]}, Generated: ${generatedBuf[gAttr + 0x83]}`);

// Let's also check the EDITED file (which works correctly)
const editedPath = 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/CAREERDRAFT-EDITED';
if (fs.existsSync(editedPath)) {
  const editedBuf = fs.readFileSync(editedPath);
  const eAttr = DATA_START + ATTR_OFFSET;
  const eName = editedBuf.toString('ascii', eAttr, eAttr + 0x26).replace(/\0/g, ' ').trim();

  console.log('\n\n=== EDITED FILE COMPARISON ===');
  console.log(`Edited file player: ${eName}`);
  console.log(`0x67 - Edited: ${editedBuf[eAttr + 0x67]}`);
  console.log(`0x6C - Edited: ${editedBuf[eAttr + 0x6C]}`);
  console.log(`0x83 - Edited: ${editedBuf[eAttr + 0x83]}`);
  console.log(`OVR (0x51) - Edited: ${editedBuf[eAttr + 0x51]}`);
}

// What's different between how we EDIT vs GENERATE?
// EDIT: read original buffer -> modify specific fields -> write back
// GENERATE: read template -> create new prospects -> write to template positions

console.log('\n\n=== HYPOTHESIS ===');
console.log('The difference might be:');
console.log('1. When EDITING, we preserve all unknown fields from original');
console.log('2. When GENERATING, we overwrite original template data');
console.log('3. The unknown fields (0x67, 0x6C, 0x83) may be calculated by the game');
console.log('   based on other attributes, OR they are attributes we SHOULD be writing');
console.log('');
console.log('Need to identify what these mystery fields are!');
