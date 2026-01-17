/**
 * Identify what field 0x6C represents by comparing template vs generated files
 *
 * From previous analysis:
 * - Template Fernando at 0x6C: 59
 * - Generated Burrow at 0x6C: 75
 * - This field CHANGES even though we don't explicitly write to it
 */
const fs = require('fs');

const templateFile = 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/CAREERDRAFT-2026NOV22';
const generatedFile = 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/CAREERDRAFT-2020DRAFT';

const templateBuf = fs.readFileSync(templateFile);
const generatedBuf = fs.readFileSync(generatedFile);

const DATA_START = 0x34; // 52 decimal
const BLOCK_SIZE = 4296;
const ATTR_OFFSET = 0x1000;

console.log('=== COMPARING OFFSETS BETWEEN TEMPLATE AND GENERATED ===\n');

// Known mappings from M26Parser for context
const KNOWN_OFFSETS = {
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
  0x67: '??? (always 127)',
  0x68: 'manCoverage',
  0x69: 'passBlockPower',
  0x6A: 'passBlockFinesse',
  0x6B: 'passBlock',
  0x6C: '??? UNKNOWN (changes)',
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
  0x79: '??? (always 1)',
  0x7A: 'spectacularCatch',
  0x7B: 'speed',
  0x7C: 'spinMove',
  0x7D: 'stamina',
  0x7E: 'stiffArm',
  0x7F: 'strength',
  0x80: 'tackle',
  0x81: 'throwAccuracyDeep',
  0x82: 'throwAccuracyMid',
  0x83: '??? UNKNOWN (low vals)',
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

// Read first 5 blocks from both files
for (let block = 0; block < 3; block++) {
  const blockStart = DATA_START + (block * BLOCK_SIZE);
  const attrStart = blockStart + ATTR_OFFSET;

  // Get names
  const tName = templateBuf.toString('ascii', attrStart, attrStart + 0x11).replace(/\0/g, '').trim() + ' ' +
               templateBuf.toString('ascii', attrStart + 0x11, attrStart + 0x26).replace(/\0/g, '').trim();
  const gName = generatedBuf.toString('ascii', attrStart, attrStart + 0x11).replace(/\0/g, '').trim() + ' ' +
               generatedBuf.toString('ascii', attrStart + 0x11, attrStart + 0x26).replace(/\0/g, '').trim();

  console.log(`\n=== BLOCK ${block} ===`);
  console.log(`Template: ${tName}`);
  console.log(`Generated: ${gName}`);
  console.log(`Position: ${templateBuf[attrStart + 0x4a]} vs ${generatedBuf[attrStart + 0x4a]}`);

  // Focus on 0x66-0x70 area
  console.log('\n--- Offsets 0x66-0x70 (around the unknown 0x6C) ---');
  for (let off = 0x66; off <= 0x70; off++) {
    const tVal = templateBuf[attrStart + off];
    const gVal = generatedBuf[attrStart + off];
    const name = KNOWN_OFFSETS[off] || '???';
    const diff = tVal !== gVal ? ' <-- DIFFERENT' : '';
    console.log(`  0x${off.toString(16)}: ${name.padEnd(25)} | T:${tVal.toString().padStart(3)} | G:${gVal.toString().padStart(3)}${diff}`);
  }
}

// Now let's look at QB prospects across MULTIPLE positions to see what 0x6C might be
// Check what values 0x6C has for different positions
console.log('\n\n=== 0x6C VALUES BY POSITION ===');

// Sample 10 prospects from template
for (let block = 0; block < 20; block++) {
  const blockStart = DATA_START + (block * BLOCK_SIZE);
  const attrStart = blockStart + ATTR_OFFSET;

  const name = templateBuf.toString('ascii', attrStart, attrStart + 0x11).replace(/\0/g, '').trim() + ' ' +
               templateBuf.toString('ascii', attrStart + 0x11, attrStart + 0x26).replace(/\0/g, '').trim();
  const position = templateBuf[attrStart + 0x4a];
  const val6C = templateBuf[attrStart + 0x6C];
  const passBlock = templateBuf[attrStart + 0x6B];
  const playAction = templateBuf[attrStart + 0x6D];

  // Position names
  const posNames = {0:'QB', 1:'HB', 2:'FB', 3:'WR', 4:'TE', 5:'LT', 6:'LG', 7:'C', 8:'RG', 9:'RT', 10:'LE', 11:'RE', 12:'DT', 13:'LOLB', 14:'MLB', 15:'ROLB', 16:'CB', 17:'FS', 18:'SS', 19:'K', 20:'P'};
  const posName = posNames[position] || `P${position}`;

  console.log(`  Block ${block.toString().padStart(2)}: ${name.padEnd(25)} ${posName.padEnd(4)} | 0x6B(passBlock)=${passBlock.toString().padStart(2)} | 0x6C(?)=${val6C.toString().padStart(2)} | 0x6D(playAction)=${playAction.toString().padStart(2)}`);
}

// Let's also check if there's another attribute in the OVR weights that we're missing
console.log('\n\n=== CHECKING WHICH FIELD 0x6C COULD BE ===');

// Look at relationship between 0x6C and other known fields
// For QBs, 0x6C seems to vary (59, 75, etc.) - what QB-relevant attribute varies like this?
// Let me check if it correlates with any known QB stats

const block0 = DATA_START + ATTR_OFFSET;
console.log('\nQB attributes from template block 0 (Fernando Mendoza):');
console.log(`  0x6C value: ${templateBuf[block0 + 0x6C]}`);
console.log(`  throwPower (0x86): ${templateBuf[block0 + 0x86]}`);
console.log(`  throwAccuracyShort (0x84): ${templateBuf[block0 + 0x84]}`);
console.log(`  throwAccuracyMid (0x82): ${templateBuf[block0 + 0x82]}`);
console.log(`  throwAccuracyDeep (0x81): ${templateBuf[block0 + 0x81]}`);
console.log(`  breakSack (0x57): ${templateBuf[block0 + 0x57]}`);
console.log(`  playAction (0x6D): ${templateBuf[block0 + 0x6D]}`);

// What if 0x6C is throwOnTheRun??? Let me check
console.log('\n\nChecking throwOnTheRun at 0x85 vs 0x6C:');
console.log(`  throwOnTheRun (0x85): ${templateBuf[block0 + 0x85]}`);
console.log(`  0x6C value: ${templateBuf[block0 + 0x6C]}`);

// Let me also search for a pattern - what attribute would be around 59 for Fernando?
// According to Madden, throwOnTheRun for draft prospects is typically in the 50s-70s range
// And for non-QBs it would be lower

console.log('\n\n=== SEARCHING FOR POSSIBLE ATTRIBUTE MATCH FOR 0x6C ===');
console.log('Looking for attributes that match the 0x6C pattern...');

// Check first QB vs first non-QB
for (let block = 0; block < 20; block++) {
  const blockStart = DATA_START + (block * BLOCK_SIZE);
  const attrStart = blockStart + ATTR_OFFSET;
  const pos = templateBuf[attrStart + 0x4a];

  if (pos === 0) { // QB
    console.log(`\nQB at block ${block}:`);
    console.log(`  0x6C: ${templateBuf[attrStart + 0x6C]}`);
    console.log(`  throwOnTheRun(0x85): ${templateBuf[attrStart + 0x85]}`);
    console.log(`  throwUnderPressure(0x87): ${templateBuf[attrStart + 0x87]}`);
    console.log(`  breakSack(0x57): ${templateBuf[attrStart + 0x57]}`);
    break;
  }
}

// Find a WR
for (let block = 0; block < 100; block++) {
  const blockStart = DATA_START + (block * BLOCK_SIZE);
  const attrStart = blockStart + ATTR_OFFSET;
  const pos = templateBuf[attrStart + 0x4a];

  if (pos === 3) { // WR
    const name = templateBuf.toString('ascii', attrStart, attrStart + 0x26).replace(/\0/g, '').trim();
    console.log(`\nWR at block ${block} (${name}):`);
    console.log(`  0x6C: ${templateBuf[attrStart + 0x6C]}`);
    console.log(`  release(0x72): ${templateBuf[attrStart + 0x72]}`);
    console.log(`  catching(0x5A): ${templateBuf[attrStart + 0x5A]}`);
    break;
  }
}

// Find an OL
for (let block = 0; block < 100; block++) {
  const blockStart = DATA_START + (block * BLOCK_SIZE);
  const attrStart = blockStart + ATTR_OFFSET;
  const pos = templateBuf[attrStart + 0x4a];

  if (pos >= 5 && pos <= 9) { // OL
    const name = templateBuf.toString('ascii', attrStart, attrStart + 0x26).replace(/\0/g, '').trim();
    const posNames = {5:'LT', 6:'LG', 7:'C', 8:'RG', 9:'RT'};
    console.log(`\n${posNames[pos]} at block ${block} (${name}):`);
    console.log(`  0x6C: ${templateBuf[attrStart + 0x6C]}`);
    console.log(`  passBlock(0x6B): ${templateBuf[attrStart + 0x6B]}`);
    console.log(`  runBlock(0x78): ${templateBuf[attrStart + 0x78]}`);
    break;
  }
}
