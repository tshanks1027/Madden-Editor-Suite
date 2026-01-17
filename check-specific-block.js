/**
 * Check specific block for draft fields
 */
const fs = require('fs');

function hexDump(buffer, offset, length) {
  let result = '';
  for (let i = 0; i < length; i += 16) {
    const lineOffset = offset + i;
    const hexPart = [];
    const asciiPart = [];

    for (let j = 0; j < 16 && (i + j) < length; j++) {
      const byte = buffer[lineOffset + j];
      hexPart.push(byte.toString(16).padStart(2, '0'));
      asciiPart.push(byte >= 32 && byte < 127 ? String.fromCharCode(byte) : '.');
    }

    result += `${lineOffset.toString(16).padStart(6, '0')}: ${hexPart.join(' ').padEnd(48)} ${asciiPart.join('')}\n`;
  }
  return result;
}

const testFile = process.argv[2] || 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/CAREERDRAFT-2026NOV22';
const buffer = fs.readFileSync(testFile);

const BLOCK_SIZE = 4296;
const ATTR_OFFSET = 0x1000;
const DATA_START = 0x34;

// Check blocks 0-10
for (let i = 0; i < 10; i++) {
  const blockStart = DATA_START + (i * BLOCK_SIZE);
  const attrStart = blockStart + ATTR_OFFSET;

  const firstName = buffer.toString('ascii', attrStart, attrStart + 0x11).replace(/\0/g, '').trim();
  const lastName = buffer.toString('ascii', attrStart + 0x11, attrStart + 0x26).replace(/\0/g, '').trim();

  console.log(`\n=== BLOCK ${i}: ${firstName} ${lastName} ===`);
  console.log(`attrStart: 0x${attrStart.toString(16)}`);

  // Read specific bytes
  console.log(`  0x4a (position): ${buffer[attrStart + 0x4a]}`);
  console.log(`  0x4b (archetype): ${buffer[attrStart + 0x4b]}`);
  console.log(`  0x4c: ${buffer[attrStart + 0x4c]}`);
  console.log(`  0x4d: ${buffer[attrStart + 0x4d]}`);
  console.log(`  0x4e: ${buffer[attrStart + 0x4e]}`);
  console.log(`  0x4f: ${buffer[attrStart + 0x4f]}`);
  console.log(`  0x50: ${buffer[attrStart + 0x50]}`);
  console.log(`  0x51: ${buffer[attrStart + 0x51]}`);

  // Full hex dump from 0x40 to 0x60
  console.log('\nHex 0x40-0x60:');
  console.log(hexDump(buffer, attrStart + 0x40, 0x20));
}

// Now also check if there's an alternate file structure
// Maybe the visual JSON itself contains draft position?
console.log('\n=== CHECKING IF VISUAL JSON HAS MORE DATA ===');
for (let i = 0; i < 3; i++) {
  const blockStart = DATA_START + (i * BLOCK_SIZE);

  // Search for JSON in visual section
  let jsonStart = -1;
  for (let j = blockStart; j < blockStart + 0x1000; j++) {
    if (buffer[j] === 0x7B) {
      jsonStart = j;
      break;
    }
  }

  if (jsonStart !== -1) {
    let braceCount = 0;
    let jsonEnd = -1;
    for (let j = jsonStart; j < blockStart + 0x1000; j++) {
      if (buffer[j] === 0x7B) braceCount++;
      if (buffer[j] === 0x7D) {
        braceCount--;
        if (braceCount === 0) {
          jsonEnd = j + 1;
          break;
        }
      }
    }

    if (jsonEnd !== -1) {
      const jsonStr = buffer.toString('utf8', jsonStart, jsonEnd);
      try {
        const visual = JSON.parse(jsonStr);
        console.log(`\nBlock ${i} Visual JSON:`);
        console.log(JSON.stringify(visual, null, 2));
      } catch (e) {
        console.log(`Block ${i} JSON parse failed`);
      }
    }
  }
}
