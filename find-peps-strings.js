const fs = require('fs');

const filePath = 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden NFL 26\\Saves\\CAREERDRAFT-2026DRAFT7RND';
const buffer = fs.readFileSync(filePath);

const DATA_START = 0x46;
const BLOCK_SIZE = 4296;
const ATTRIBUTE_OFFSET = 0x1000;

console.log('Searching for PEPS strings in first 10 prospects...\n');

// Look for generic PEPS patterns like "gen_" in the attribute section
for (let prospectNum = 0; prospectNum < 10; prospectNum++) {
  const blockStart = DATA_START + (prospectNum * BLOCK_SIZE);
  const attributeStart = blockStart + ATTRIBUTE_OFFSET;
  const attributeEnd = attributeStart + 0xE2;

  const firstName = buffer.toString('ascii', attributeStart, attributeStart + 0x11).replace(/\0/g, '').trim();
  const lastName = buffer.toString('ascii', attributeStart + 0x11, attributeStart + 0x26).replace(/\0/g, '').trim();

  console.log(`\n=== Prospect #${prospectNum + 1}: ${firstName} ${lastName} ===`);

  // Search for strings containing "gen_" or ending in numbers (PEPS pattern)
  // PEPS strings are typically 15-25 characters
  for (let offset = 0; offset < 0xE2; offset++) {
    // Try to read a potential string
    let str = '';
    let validChars = 0;

    for (let i = 0; i < 30 && offset + i < 0xE2; i++) {
      const byte = buffer[attributeStart + offset + i];

      // Check if it's a printable ASCII character
      if (byte >= 32 && byte <= 126) {
        str += String.fromCharCode(byte);
        validChars++;
      } else if (byte === 0) {
        // Null terminator
        break;
      } else {
        // Non-printable character, not a string
        break;
      }
    }

    // If we found a string with "gen_" or looks like PEPS format
    if (str.includes('gen_') || (str.length > 10 && str.match(/[a-zA-Z]+_\d+/))) {
      console.log(`  Offset +0x${offset.toString(16)}: "${str}"`);
    }
  }
}

console.log('\n\n=== SEARCHING ENTIRE FILE FOR PEPS-LIKE STRINGS ===');
// Search for known generic PEPS patterns
const patterns = ['gen_5_M_M_005', 'gen_7_T_G_007', 'gen_'];

patterns.forEach(pattern => {
  const patternBuffer = Buffer.from(pattern, 'ascii');
  let offset = buffer.indexOf(patternBuffer, 0);
  let count = 0;

  while (offset !== -1 && count < 5) {
    if (offset >= DATA_START) {
      const offsetFromData = offset - DATA_START;
      const prospectNum = Math.floor(offsetFromData / BLOCK_SIZE);
      const offsetInBlock = offsetFromData % BLOCK_SIZE;
      const blockStart = DATA_START + (prospectNum * BLOCK_SIZE);
      const attributeStart = blockStart + ATTRIBUTE_OFFSET;

      // Check if it's in the attribute section or before it
      const section = offset < attributeStart ? 'JSON section' : 'attribute section';
      const relativeOffset = offset < attributeStart
        ? offset - blockStart
        : offset - attributeStart;

      console.log(`\nFound "${pattern}" at 0x${offset.toString(16)}`);
      console.log(`  Prospect #${prospectNum + 1}`);
      console.log(`  Section: ${section}`);
      console.log(`  Offset in ${section}: +0x${relativeOffset.toString(16)}`);
    }

    offset = buffer.indexOf(patternBuffer, offset + 1);
    count++;
  }
});
