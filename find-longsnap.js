const fs = require('fs');

// Load an original unedited draft class file
const filePath = 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden NFL 26\\Saves\\CAREERDRAFT-2026DRAFT7RND';
const buffer = fs.readFileSync(filePath);

const DATA_START = 0x46;
const BLOCK_SIZE = 4296;
const ATTRIBUTE_OFFSET = 0x1000;

// Check first 10 prospects
console.log('Looking for long snap pattern (most should be 1-10, actual LS should be higher)\n');

for (let prospectNum = 0; prospectNum < 10; prospectNum++) {
  const blockStart = DATA_START + (prospectNum * BLOCK_SIZE);
  const attributeStart = blockStart + ATTRIBUTE_OFFSET;

  const firstName = buffer.toString('ascii', attributeStart, attributeStart + 0x11).replace(/\0/g, '').trim();
  const lastName = buffer.toString('ascii', attributeStart + 0x11, attributeStart + 0x26).replace(/\0/g, '').trim();
  const position = buffer[attributeStart + 0x4a];

  console.log(`\n=== Prospect ${prospectNum + 1}: ${firstName} ${lastName} (Pos: ${position}) ===`);

  // Current mapping says long snap is at 0x8B
  console.log(`Current 0x8B: ${buffer[attributeStart + 0x8B]}`);

  // Look for bytes with value 1-15 in the attribute block
  console.log('Bytes with values 1-15 (potential LS):');
  for (let offset = 0x50; offset < 0xA0; offset++) {
    const val = buffer[attributeStart + offset];
    if (val >= 1 && val <= 15) {
      console.log(`  0x${offset.toString(16)}: ${val}`);
    }
  }
}
