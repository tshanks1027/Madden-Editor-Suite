/**
 * Examine draft class file structure
 */

const fs = require('fs');
const path = require('path');

// DEVELOPMENT ONLY: Update this path to point to your test file
// This file should NOT be included in production builds
const FILE = process.argv[2] || ''; // Pass file path as command line argument

if (!FILE) {
  console.error('Usage: node examine-file.js <path-to-draft-file>');
  process.exit(1);
}

console.log('Reading file:', FILE);

const buffer = fs.readFileSync(FILE);

console.log('\nFile size:', buffer.length, 'bytes');
console.log('Expected players:', Math.floor(buffer.length / 4322));

console.log('\n--- HEADER (first 100 bytes) ---');
console.log('Hex:');
const hexLines = [];
for (let i = 0; i < 100; i += 16) {
  const hex = [];
  const ascii = [];
  for (let j = 0; j < 16 && i + j < 100; j++) {
    const byte = buffer[i + j];
    hex.push(byte.toString(16).padStart(2, '0'));
    ascii.push(byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : '.');
  }
  console.log(`0x${i.toString(16).padStart(4, '0')}  ${hex.join(' ').padEnd(48)}  ${ascii.join('')}`);
}

console.log('\n--- HEADER FIELDS ---');
console.log('Signature:', buffer.toString('ascii', 0, 8));
console.log('Version:', buffer.readUInt8(8));
console.log('Year:', buffer.readUInt16LE(0x16));
console.log('Product:', buffer.toString('ascii', 0x22, 0x40).replace(/\x00/g, ''));

console.log('\n--- FIRST PLAYER RECORD (bytes 0x4C - 0x10E7) ---');
console.log('Player record start offset: 0x4C =', 0x4C);
console.log('Player record size: 4322 bytes = 0x10E2');

// Look at first 200 bytes of first player
console.log('\nFirst 200 bytes of first player record:');
for (let i = 0x4C; i < 0x4C + 200; i += 16) {
  const hex = [];
  const ascii = [];
  for (let j = 0; j < 16; j++) {
    const byte = buffer[i + j];
    hex.push(byte.toString(16).padStart(2, '0'));
    ascii.push(byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : '.');
  }
  console.log(`0x${i.toString(16).padStart(4, '0')}  ${hex.join(' ').padEnd(48)}  ${ascii.join('')}`);
}

// Look for JSON
console.log('\n--- Searching for JSON patterns ---');
const jsonStart = buffer.indexOf('{', 0x4C);
console.log('First "{" found at offset:', '0x' + jsonStart.toString(16));

if (jsonStart !== -1) {
  // Try to extract JSON
  let jsonEnd = jsonStart;
  while (jsonEnd < buffer.length && buffer[jsonEnd] !== 0) {
    jsonEnd++;
  }

  const jsonStr = buffer.toString('utf8', jsonStart, Math.min(jsonEnd, jsonStart + 500));
  console.log('\nJSON preview (first 500 chars):');
  console.log(jsonStr);
}

// Check if data is actually in different format
console.log('\n--- Checking for compression signatures ---');
const gzipSig = Buffer.from([0x1F, 0x8B]);
const zstdSig = Buffer.from([0x28, 0xB5, 0x2F, 0xFD]);

const gzipIdx = buffer.indexOf(gzipSig, 0x4C);
const zstdIdx = buffer.indexOf(zstdSig, 0x4C);

console.log('Gzip signature (0x1F 0x8B):', gzipIdx === -1 ? 'NOT FOUND' : '0x' + gzipIdx.toString(16));
console.log('Zstd signature (0x28 0xB5 0x2F 0xFD):', zstdIdx === -1 ? 'NOT FOUND' : '0x' + zstdIdx.toString(16));

// Look at the structure at offset 0x4C + 4096 (where attributes should start)
const attrStart = 0x4C + 4096;
console.log(`\n--- ATTRIBUTE SECTION (offset 0x${attrStart.toString(16)}) ---`);
console.log('First 100 bytes of attribute section:');
for (let i = attrStart; i < attrStart + 100; i += 16) {
  const hex = [];
  const ascii = [];
  for (let j = 0; j < 16; j++) {
    const byte = buffer[i + j];
    hex.push(byte.toString(16).padStart(2, '0'));
    ascii.push(byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : '.');
  }
  console.log(`0x${i.toString(16).padStart(4, '0')}  ${hex.join(' ').padEnd(48)}  ${ascii.join('')}`);
}
