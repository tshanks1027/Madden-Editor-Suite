/**
 * Hex dump of M26 draft class file to see raw byte values
 */
const fs = require('fs');
const path = require('path');

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

function analyzeM26File(filePath) {
  const buffer = fs.readFileSync(filePath);

  console.log(`=== M26 HEX DUMP: ${path.basename(filePath)} ===\n`);

  const BLOCK_SIZE = 4296;
  const ATTR_OFFSET = 0x1000;
  const DATA_START = 0x34;

  // Dump first 3 prospects - focus on attribute section (0x40 - 0xA0)
  for (let i = 0; i < 3; i++) {
    const blockStart = DATA_START + (i * BLOCK_SIZE);
    const attrStart = blockStart + ATTR_OFFSET;

    const firstName = buffer.toString('ascii', attrStart, attrStart + 0x11).replace(/\0/g, '').trim();
    const lastName = buffer.toString('ascii', attrStart + 0x11, attrStart + 0x26).replace(/\0/g, '').trim();

    console.log(`=== PROSPECT ${i + 1}: ${firstName} ${lastName} ===`);
    console.log(`Block start: 0x${blockStart.toString(16)}, Attr start: 0x${attrStart.toString(16)}\n`);

    // Dump bytes 0x40 to 0x60 (key metadata)
    console.log('Bytes 0x40-0x60 (metadata area):');
    console.log(hexDump(buffer, attrStart + 0x40, 0x20));

    // Dump bytes 0x80-0xA0 (throw ratings, tackle, etc.)
    console.log('Bytes 0x80-0xA0 (ratings area):');
    console.log(hexDump(buffer, attrStart + 0x80, 0x20));

    console.log('');
  }

  // Look for any prospects with non-zero values in draft fields
  console.log('=== SEARCHING FOR NON-ZERO DRAFT FIELDS ===\n');

  for (let i = 0; i < 402; i++) {
    const blockStart = DATA_START + (i * BLOCK_SIZE);
    const attrStart = blockStart + ATTR_OFFSET;

    if (attrStart + 0x52 >= buffer.length) break;

    const draftable = buffer[attrStart + 0x4d];
    const draftPick = buffer.readUInt16LE(attrStart + 0x4e); // Read as 2 bytes
    const draftRound = buffer[attrStart + 0x50];
    const overall = buffer[attrStart + 0x51];

    if (draftPick > 0 || draftRound > 0 || overall > 0 || draftable > 0) {
      const firstName = buffer.toString('ascii', attrStart, attrStart + 0x11).replace(/\0/g, '').trim();
      const lastName = buffer.toString('ascii', attrStart + 0x11, attrStart + 0x26).replace(/\0/g, '').trim();
      console.log(`Block ${i}: ${firstName} ${lastName}`);
      console.log(`  draftable (0x4d): ${draftable}`);
      console.log(`  draftPick (0x4e-0x4f as uint16): ${draftPick}`);
      console.log(`  draftRound (0x50): ${draftRound}`);
      console.log(`  overall (0x51): ${overall}`);
      console.log('');
    }
  }

  // Let's also look at the visual JSON to see if there's draft info there
  console.log('\n=== CHECKING VISUAL JSON FOR DRAFT INFO ===\n');
  const firstVisualStart = DATA_START;
  let jsonStart = -1;

  for (let i = firstVisualStart; i < firstVisualStart + 0x1000; i++) {
    if (buffer[i] === 0x7B) { // '{'
      jsonStart = i;
      break;
    }
  }

  if (jsonStart !== -1) {
    // Find JSON end
    let braceCount = 0;
    let jsonEnd = -1;
    for (let i = jsonStart; i < firstVisualStart + 0x1000; i++) {
      if (buffer[i] === 0x7B) braceCount++;
      if (buffer[i] === 0x7D) {
        braceCount--;
        if (braceCount === 0) {
          jsonEnd = i + 1;
          break;
        }
      }
    }

    if (jsonEnd !== -1) {
      const jsonStr = buffer.toString('utf8', jsonStart, jsonEnd);
      try {
        const visual = JSON.parse(jsonStr);
        console.log('First prospect visual JSON keys:', Object.keys(visual));
        console.log('assetName:', visual.assetName);
        console.log('genericHeadName:', visual.genericHeadName);
      } catch (e) {
        console.log('Failed to parse JSON');
      }
    }
  }
}

const testFile = process.argv[2] || 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/CAREERDRAFT-2026NOV22';

if (fs.existsSync(testFile)) {
  analyzeM26File(testFile);
} else {
  console.log(`File not found: ${testFile}`);
}
