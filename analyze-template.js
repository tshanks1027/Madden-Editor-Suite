/**
 * DEFINITIVE M26 Structure Analysis
 * Find exactly where player data is stored relative to JSON
 */

const fs = require('fs');
const path = require('path');

const BLOCK_SIZE = 4296;

// Read a WORKING draft class file
const templatePath = 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden Files\\1994 Mod V3\\Draft Classes\\CAREERDRAFT-2012V1';
console.log('Reading working draft class from:', templatePath);

const buffer = fs.readFileSync(templatePath);
console.log('File size:', buffer.length, 'bytes');

// Find Andrew Luck's data
const andrewPos = buffer.indexOf(Buffer.from('Andrew', 'ascii'));
console.log(`\n"Andrew" found at position: 0x${andrewPos.toString(16)} (${andrewPos})`);

// This should be the start of the first name field
// Let's see what's at known offsets relative to this position
console.log('\n=== ANDREW LUCK DATA ANALYSIS ===');
const baseOffset = andrewPos;

// firstName should be at offset 0, last name at 0x11
const firstName = buffer.toString('ascii', baseOffset, baseOffset + 0x11).replace(/\0/g, '');
const lastName = buffer.toString('ascii', baseOffset + 0x11, baseOffset + 0x26).replace(/\0/g, '');
console.log(`firstName (0x00): "${firstName}"`);
console.log(`lastName (0x11): "${lastName}"`);

// Show raw hex of the next 200 bytes from Andrew
console.log('\n=== RAW HEX FROM "Andrew" (200 bytes) ===');
const data = buffer.subarray(baseOffset, baseOffset + 200);
for (let i = 0; i < data.length; i += 16) {
  const row = data.subarray(i, Math.min(i + 16, data.length));
  const hex = Array.from(row).map(b => b.toString(16).padStart(2, '0')).join(' ');
  const ascii = Array.from(row).map(b => (b >= 32 && b < 127) ? String.fromCharCode(b) : '.').join('');
  console.log(`0x${i.toString(16).padStart(3, '0')}: ${hex.padEnd(48)} ${ascii}`);
}

// Now let's interpret specific byte offsets
console.log('\n=== INTERPRETED VALUES (using current parser offsets) ===');
console.log(`homeState (0x26): ${data[0x26]} (TX=43, should be Texas/Ind for Luck)`);
console.log(`college (0x42): ${data[0x42]} (201=Stanford)`);
console.log(`age (0x46): ${data[0x46]}`);
console.log(`heightInches (0x47): ${data[0x47]}`);
console.log(`weight-160 (0x48): ${data[0x48]} -> ${data[0x48] + 160} lbs`);
console.log(`position (0x4a): ${data[0x4a]} (0=QB)`);
console.log(`archetype (0x4b): ${data[0x4b]}`);
console.log(`jerseyNum (0x4c): ${data[0x4c]}`);
console.log(`draftPick (0x4e): ${data[0x4e]}`);
console.log(`speed (0x7B): ${data[0x7B]}`);
console.log(`acceleration (0x52): ${data[0x52]}`);
console.log(`agility (0x53): ${data[0x53]}`);
console.log(`awareness (0x54): ${data[0x54]}`);
console.log(`strength (0x7F): ${data[0x7F]}`);
console.log(`throwPower (0x86): ${data[0x86]}`);
console.log(`throwAccShort (0x84): ${data[0x84]}`);
console.log(`throwAccMid (0x82): ${data[0x82]}`);
console.log(`throwAccDeep (0x81): ${data[0x81]}`);
console.log(`devTrait (0x8c): ${data[0x8c]} (0=Normal, 1=Star, 2=SS, 3=XF)`);

// Let's look at Robert Griffin III
const robertPos = buffer.indexOf(Buffer.from('Robert', 'ascii'));
console.log(`\n\n=== ROBERT GRIFFIN III DATA ===`);
console.log(`"Robert" found at: 0x${robertPos.toString(16)} (${robertPos})`);

if (robertPos !== -1) {
  const rg3Data = buffer.subarray(robertPos, robertPos + 200);
  const rg3FirstName = buffer.toString('ascii', robertPos, robertPos + 0x11).replace(/\0/g, '');
  const rg3LastName = buffer.toString('ascii', robertPos + 0x11, robertPos + 0x26).replace(/\0/g, '');
  console.log(`firstName: "${rg3FirstName}"`);
  console.log(`lastName: "${rg3LastName}"`);
  console.log(`position (0x4a): ${rg3Data[0x4a]} (0=QB)`);
  console.log(`draftPick (0x4e): ${rg3Data[0x4e]}`);
  console.log(`speed (0x7B): ${rg3Data[0x7B]}`);
  console.log(`throwPower (0x86): ${rg3Data[0x86]}`);
}

// Now let's figure out the actual block boundaries
console.log('\n\n=== BLOCK BOUNDARY ANALYSIS ===');

// Find all JSON starts
const jsonMarker = Buffer.from('{"bodyType"');
let jsonPositions = [];
let searchPos = 0;
while ((searchPos = buffer.indexOf(jsonMarker, searchPos)) !== -1) {
  jsonPositions.push(searchPos);
  searchPos++;
}

// Find all first name starts (search for Andrew, Robert, Trent)
const namePositions = [];
const namesToFind = ['Andrew', 'Robert', 'Trent', 'Morris', 'Matt'];
for (const name of namesToFind) {
  let pos = 0;
  while ((pos = buffer.indexOf(Buffer.from(name, 'ascii'), pos)) !== -1) {
    namePositions.push({ name, pos });
    pos++;
  }
}
namePositions.sort((a, b) => a.pos - b.pos);

console.log('\nFirst 10 JSON positions:', jsonPositions.slice(0, 10));
console.log('\nName positions found:', namePositions.slice(0, 10));

// Calculate the ACTUAL offset from JSON to player data
console.log('\n\n=== CALCULATING JSON TO PLAYER DATA OFFSET ===');

// First JSON is at 0x46, Andrew is at 0x1046
const firstJsonStart = 0x46;  // We saw this in the first run
const firstNameStart = 0x1046; // Where "Andrew" starts

console.log(`First JSON start: 0x${firstJsonStart.toString(16)}`);
console.log(`First player name start: 0x${firstNameStart.toString(16)}`);
console.log(`Offset from JSON start to name: 0x${(firstNameStart - firstJsonStart).toString(16)} (${firstNameStart - firstJsonStart} bytes)`);

// Let's find what's at the STANDARD attribute offset for comparison
const standardAttrOffset = 0x64 + 0x1000; // Old assumption: block start + 0x1000
console.log(`\nStandard attr offset (0x64 + 0x1000): 0x${standardAttrOffset.toString(16)}`);
console.log(`Data there: "${buffer.toString('ascii', standardAttrOffset, standardAttrOffset + 20).replace(/\0/g, '')}"`);

// Let's look at what's between JSON end and player data
console.log('\n\n=== BYTES BETWEEN FIRST JSON END AND ANDREW ===');
const firstJsonEnd = 0x6dd; // From previous run
console.log(`JSON ends at: 0x${firstJsonEnd.toString(16)}`);
console.log(`Andrew starts at: 0x${firstNameStart.toString(16)}`);
console.log(`Gap: ${firstNameStart - firstJsonEnd} bytes (0x${(firstNameStart - firstJsonEnd).toString(16)})`);

// The gap is filled with zeros - this is padding
// So the player data starts at a FIXED offset from the START of the file/block

// Let's check if block size is correct
console.log('\n\n=== VERIFYING BLOCK SIZE ===');
// If blocks are 4296 bytes, and first block starts at 0x64:
// Block 0: 0x64 to 0x112B (4296 bytes)
// Block 1: 0x112C to 0x21F3 (4296 bytes)
// Block 2: 0x21F4 to 0x32BB (4296 bytes)

// Andrew is at 0x1046, which is 0x1046 - 0x64 = 0xFE2 (4066) into the first block
console.log(`Andrew position in block 0: 0x${(firstNameStart - 0x64).toString(16)} (${firstNameStart - 0x64} bytes from block start)`);

// But block size is 4296 (0x10C8), so attribute area at block_start + 0x1000 = 0x1064
// But Andrew is at 0x1046... that's BEFORE 0x1064!
// Wait, 0x1046 - 0x64 = 0xFE2 = 4066 bytes from block start
// That means attributes start at offset 0xFE2 from block start, not 0x1000

// WAIT - I need to re-examine. First JSON is at 0x46, but that's BEFORE 0x64!
// So the actual file header might be different

console.log('\n\n=== FILE HEADER ANALYSIS ===');
console.log('First 100 bytes of file:');
const headerData = buffer.subarray(0, 100);
for (let i = 0; i < headerData.length; i += 16) {
  const row = headerData.subarray(i, Math.min(i + 16, headerData.length));
  const hex = Array.from(row).map(b => b.toString(16).padStart(2, '0')).join(' ');
  const ascii = Array.from(row).map(b => (b >= 32 && b < 127) ? String.fromCharCode(b) : '.').join('');
  console.log(`0x${i.toString(16).padStart(3, '0')}: ${hex.padEnd(48)} ${ascii}`);
}

// First JSON at 0x46 means the header is only 0x46 bytes!
// Let's recalculate with header = 0x46
const newHeaderSize = 0x46;
console.log(`\n\nHeader size appears to be: 0x${newHeaderSize.toString(16)} (${newHeaderSize} bytes)`);

// If block size is still 4296 and first block starts at 0x46:
// Block 0: 0x46 to 0x110D (4296 bytes)
// Andrew at 0x1046 would be at offset 0x1046 - 0x46 = 0x1000 (4096) from block start!
// THAT'S THE ATTRIBUTE OFFSET! 0x1000 from block start!

const headerOffset = 0x46;
const blockNum = 0;
const blockStart = headerOffset + (blockNum * BLOCK_SIZE);
const attrOffsetInBlock = firstNameStart - blockStart;

console.log(`\nWith header at 0x46:`);
console.log(`Block 0 starts at: 0x${blockStart.toString(16)}`);
console.log(`Andrew at 0x${firstNameStart.toString(16)} is offset 0x${attrOffsetInBlock.toString(16)} (${attrOffsetInBlock}) from block start`);
console.log(`THIS CONFIRMS: Attributes are at block_start + 0x1000!`);

// Now let's verify with Block 1
console.log('\n\n=== VERIFY WITH SECOND PLAYER ===');
// Robert Griffin III should be in block 1 if he's pick #2
// Block 1 starts at 0x46 + 4296 = 0x110E
// Attributes for block 1 at 0x110E + 0x1000 = 0x210E

const block1Start = headerOffset + (1 * BLOCK_SIZE);
const block1AttrStart = block1Start + 0x1000;
console.log(`Block 1 starts at: 0x${block1Start.toString(16)}`);
console.log(`Block 1 attrs at: 0x${block1AttrStart.toString(16)}`);

const block1Name = buffer.toString('ascii', block1AttrStart, block1AttrStart + 0x26).replace(/\0/g, ' ').trim();
console.log(`Data at block 1 attrs: "${block1Name}"`);

// Where is Robert actually?
console.log(`\nRobert is actually at: 0x${robertPos.toString(16)} (${robertPos})`);
const expectedRobertBlock = Math.floor((robertPos - headerOffset) / BLOCK_SIZE);
console.log(`Robert is in block: ${expectedRobertBlock}`);

// If Robert is block 1, his offset from block 1 start should be 0x1000
if (expectedRobertBlock === 1) {
  const robertOffsetInBlock = robertPos - block1Start;
  console.log(`Robert's offset in block 1: 0x${robertOffsetInBlock.toString(16)}`);
}

// THE REAL ISSUE: Our code uses header.dataStartOffset = 0x64, but it should be 0x46!
console.log('\n\n=== ROOT CAUSE FOUND ===');
console.log('The parser/writer uses dataStartOffset = 0x64 (100 bytes)');
console.log('But the ACTUAL header is only 0x46 (70 bytes)!');
console.log('This 30-byte (0x1E) offset error causes ALL data to be misaligned!');
