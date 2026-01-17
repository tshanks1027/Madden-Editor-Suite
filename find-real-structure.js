/**
 * Find the REAL M26 attribute structure by searching for known patterns
 */
const fs = require('fs');

const testFile = 'C:/Users/tshan/OneDrive/Documents/Madden NFL 26/Saves/CAREERDRAFT-2026NOV22';
const buffer = fs.readFileSync(testFile);

const BLOCK_SIZE = 4296;
const DATA_START = 52;

console.log('=== FINDING REAL M26 STRUCTURE ===\n');

// First, find where the visual JSON actually ends
const block0Start = DATA_START;

// Find JSON end
let jsonStart = -1;
for (let i = block0Start; i < block0Start + 4096; i++) {
  if (buffer[i] === 0x7B) {
    jsonStart = i;
    break;
  }
}

console.log(`JSON starts at: 0x${jsonStart.toString(16)} (offset from block: 0x${(jsonStart - block0Start).toString(16)})`);

let jsonEnd = -1;
let braceCount = 0;
for (let i = jsonStart; i < block0Start + 4096; i++) {
  if (buffer[i] === 0x7B) braceCount++;
  if (buffer[i] === 0x7D) {
    braceCount--;
    if (braceCount === 0) {
      jsonEnd = i + 1;
      break;
    }
  }
}

console.log(`JSON ends at: 0x${jsonEnd.toString(16)} (offset from block: 0x${(jsonEnd - block0Start).toString(16)})`);
console.log(`JSON length: ${jsonEnd - jsonStart} bytes`);

// What comes after JSON?
console.log('\n=== BYTES AFTER JSON END ===\n');
const attrStart = jsonEnd;
console.log(`Attribute data might start at: 0x${attrStart.toString(16)}`);

// Dump 300 bytes after JSON to see the real structure
console.log('\nHex dump of 300 bytes after JSON:');
for (let i = 0; i < 300; i += 16) {
  const offset = attrStart + i;
  let hex = '';
  let ascii = '';
  for (let j = 0; j < 16 && offset + j < buffer.length; j++) {
    const b = buffer[offset + j];
    hex += b.toString(16).padStart(2, '0') + ' ';
    ascii += (b >= 32 && b < 127) ? String.fromCharCode(b) : '.';
  }
  console.log(`${offset.toString(16).padStart(6, '0')}: ${hex.padEnd(48)} ${ascii}`);
}

// Now let's try to find where "Fernando" and "Mendoza" are stored
console.log('\n=== SEARCHING FOR NAME DATA ===\n');

// Search for "Fernando" in block 0
const nameSearch = Buffer.from('Fernando');
const block0End = block0Start + BLOCK_SIZE;

for (let i = block0Start; i < block0End - 8; i++) {
  if (buffer.slice(i, i + 8).equals(nameSearch)) {
    console.log(`Found "Fernando" at absolute offset 0x${i.toString(16)}`);
    console.log(`  Relative to block start: 0x${(i - block0Start).toString(16)}`);
    console.log(`  Relative to JSON end: 0x${(i - jsonEnd).toString(16)}`);
  }
}

// Search for "Mendoza"
const lastNameSearch = Buffer.from('Mendoza');
for (let i = block0Start; i < block0End - 7; i++) {
  if (buffer.slice(i, i + 7).equals(lastNameSearch)) {
    console.log(`Found "Mendoza" at absolute offset 0x${i.toString(16)}`);
    console.log(`  Relative to block start: 0x${(i - block0Start).toString(16)}`);
    console.log(`  Relative to JSON end: 0x${(i - jsonEnd).toString(16)}`);
  }
}

// Now let's look at a few different prospects to understand the pattern
console.log('\n=== PATTERN ANALYSIS ACROSS BLOCKS ===\n');

const expectedFirstNames = ['Fernando', 'Ty', 'Rueben'];  // First 3 prospects

for (let blockNum = 0; blockNum < 3; blockNum++) {
  const blockStart = DATA_START + (blockNum * BLOCK_SIZE);

  // Find JSON in this block
  let jStart = -1;
  for (let i = blockStart; i < blockStart + 4096; i++) {
    if (buffer[i] === 0x7B) {
      jStart = i;
      break;
    }
  }

  let jEnd = -1;
  let bc = 0;
  for (let i = jStart; i < blockStart + 4096; i++) {
    if (buffer[i] === 0x7B) bc++;
    if (buffer[i] === 0x7D) {
      bc--;
      if (bc === 0) {
        jEnd = i + 1;
        break;
      }
    }
  }

  console.log(`Block ${blockNum}:`);
  console.log(`  Block starts at: 0x${blockStart.toString(16)}`);
  console.log(`  JSON: 0x${jStart.toString(16)} - 0x${jEnd.toString(16)} (${jEnd - jStart} bytes)`);

  // Search for expected first name
  const nameToFind = Buffer.from(expectedFirstNames[blockNum]);
  for (let i = blockStart; i < blockStart + BLOCK_SIZE - nameToFind.length; i++) {
    if (buffer.slice(i, i + nameToFind.length).equals(nameToFind)) {
      const relOffset = i - jEnd;
      console.log(`  "${expectedFirstNames[blockNum]}" found at offset from JSON end: 0x${relOffset.toString(16)} (${relOffset})`);
    }
  }

  console.log('');
}

// Now read the real attribute data
console.log('\n=== READING ATTRIBUTES FROM CORRECT OFFSET ===\n');

// Based on M25 structure, the attribute data starts right after JSON (after padding)
// Let's find where the first non-null byte is after JSON padding

for (let blockNum = 0; blockNum < 3; blockNum++) {
  const blockStart = DATA_START + (blockNum * BLOCK_SIZE);

  // Find JSON end
  let jStart = -1;
  for (let i = blockStart; i < blockStart + 4096; i++) {
    if (buffer[i] === 0x7B) { jStart = i; break; }
  }
  let jEnd = -1, bc = 0;
  for (let i = jStart; i < blockStart + 4096; i++) {
    if (buffer[i] === 0x7B) bc++;
    if (buffer[i] === 0x7D) { bc--; if (bc === 0) { jEnd = i + 1; break; } }
  }

  // Find first non-null byte after JSON
  let attrStart = jEnd;
  while (buffer[attrStart] === 0 && attrStart < blockStart + 4096) {
    attrStart++;
  }

  console.log(`Block ${blockNum} - Attribute data starts at: 0x${attrStart.toString(16)} (${attrStart - jEnd} bytes after JSON)`);

  // Try reading from the standard offset (block + 0x1000 = 4096)
  const stdAttrOffset = blockStart + 0x1000;
  console.log(`  Standard offset (block + 0x1000): 0x${stdAttrOffset.toString(16)}`);

  // Read firstName from standard offset
  const fn1 = buffer.toString('ascii', stdAttrOffset, stdAttrOffset + 17).replace(/\0/g, '').trim();
  console.log(`  firstName at std offset: "${fn1}"`);

  // Look for where the real data is
  // In M26, maybe the visual section is < 4096 bytes?
  const realAttrOffset = jEnd;
  const fn2 = buffer.toString('ascii', realAttrOffset, realAttrOffset + 17).replace(/\0/g, '').trim();
  console.log(`  firstName right after JSON: "${fn2}"`);

  console.log('');
}

// Try to figure out the actual block structure
console.log('\n=== CHECKING IF BLOCK SIZE IS CORRECT ===\n');

// If block size is 4296, then block 1 should start at DATA_START + 4296
// Let's verify by checking if block 1's JSON starts at expected location

for (let testBlockSize = 4200; testBlockSize <= 4400; testBlockSize++) {
  const block1ExpectedStart = DATA_START + testBlockSize;

  // Check if there's JSON starting soon after
  let foundJson = false;
  for (let i = block1ExpectedStart; i < block1ExpectedStart + 100; i++) {
    if (i < buffer.length && buffer[i] === 0x7B) {
      // Parse a bit to verify it's real JSON
      const snippet = buffer.toString('utf8', i, i + 20);
      if (snippet.includes('genericHead') || snippet.includes('bodyType') || snippet.includes('loadouts')) {
        console.log(`Block size ${testBlockSize}: JSON found at offset ${i - block1ExpectedStart} from block start`);
        foundJson = true;
        break;
      }
    }
  }
}
