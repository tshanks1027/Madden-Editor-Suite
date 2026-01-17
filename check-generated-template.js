/**
 * Check which template the generated file came from
 * The generated file should match the template structure for non-written bytes
 */
const fs = require('fs');

const generatedFile = 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/CAREERDRAFT-2020DRAFT';
const templateFile = 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/CAREERDRAFT-2026NOV22';

const genBuf = fs.readFileSync(generatedFile);
const tmpBuf = fs.readFileSync(templateFile);

const DATA_START = 0x46;
const BLOCK_SIZE = 4296;
const ATTR_OFFSET = 0x1000;

// First, check if these files have the same header structure
console.log('=== FILE HEADERS ===');
console.log('Generated signature:', genBuf.toString('ascii', 0, 8));
console.log('Template signature:', tmpBuf.toString('ascii', 0, 8));
console.log('');
console.log('Generated product:', genBuf.toString('ascii', 0x22, 0x37).replace(/\0/g, ''));
console.log('Template product:', tmpBuf.toString('ascii', 0x22, 0x37).replace(/\0/g, ''));

// Check file sizes
console.log('\n=== FILE SIZES ===');
console.log('Generated size:', genBuf.length);
console.log('Template size:', tmpBuf.length);

// Check if they're the same original structure
console.log('\n=== BLOCK 0 - CHECKING IF SAME ORIGINAL ===');

// What we're really trying to understand:
// The generated file has 0x6C = 75 but template has 0x6C = 59
// If the writer truly uses template as base and doesn't write to 0x6C,
// they should be the same.

// Wait - maybe the issue is that the GENERATED file was created using
// a DIFFERENT process that DOES write to 0x6C?

// Let me check if the generated file was perhaps NOT generated from
// the template file, but from a different source

// Check the file names in the header (if stored)
console.log('\n=== CHECKING BYTES 0x67-0x6F ACROSS MULTIPLE BLOCKS ===');
console.log('If 0x6C varies by player, it SHOULD be different per block');
console.log('If 0x6C is constant, it might be a flag or unused');

for (let block = 0; block < 10; block++) {
  const tAttr = DATA_START + (block * BLOCK_SIZE) + ATTR_OFFSET;
  const gAttr = DATA_START + (block * BLOCK_SIZE) + ATTR_OFFSET;

  const tName = tmpBuf.toString('ascii', tAttr, tAttr + 0x26).replace(/\0/g, ' ').trim().slice(0, 20);
  const gName = genBuf.toString('ascii', gAttr, gAttr + 0x26).replace(/\0/g, ' ').trim().slice(0, 20);

  console.log(`\nBlock ${block}:`);
  console.log(`  Template: ${tName.padEnd(20)} | 0x6C=${tmpBuf[tAttr + 0x6C]} 0x67=${tmpBuf[tAttr + 0x67]} 0x83=${tmpBuf[tAttr + 0x83]}`);
  console.log(`  Generated: ${gName.padEnd(20)} | 0x6C=${genBuf[gAttr + 0x6C]} 0x67=${genBuf[gAttr + 0x67]} 0x83=${genBuf[gAttr + 0x83]}`);
}

// Check if the visual JSON sections match (unchanged)
console.log('\n\n=== CHECKING VISUAL SECTIONS ===');
console.log('If visual sections are completely different, the generated file');
console.log('might have been created with a different process');

const tVis0 = DATA_START;
const gVis0 = DATA_START;

// Find JSON start in both
let tJsonStart = -1;
let gJsonStart = -1;

for (let i = 0; i < 0x1000; i++) {
  if (tmpBuf[tVis0 + i] === 123) { tJsonStart = i; break; } // '{'
}
for (let i = 0; i < 0x1000; i++) {
  if (genBuf[gVis0 + i] === 123) { gJsonStart = i; break; }
}

console.log(`Template JSON starts at offset: 0x${tJsonStart.toString(16)}`);
console.log(`Generated JSON starts at offset: 0x${gJsonStart.toString(16)}`);

// Read first 100 bytes of each JSON section
const tJson = tmpBuf.toString('utf8', tVis0 + tJsonStart, tVis0 + tJsonStart + 100);
const gJson = genBuf.toString('utf8', gVis0 + gJsonStart, gVis0 + gJsonStart + 100);

console.log(`\nTemplate JSON preview: ${tJson.slice(0, 80)}...`);
console.log(`Generated JSON preview: ${gJson.slice(0, 80)}...`);
