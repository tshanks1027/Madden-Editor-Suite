/**
 * Test what's at offset 0x4e and 0x4f in the M26 file
 */
const fs = require('fs');

const realPath = 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden NFL 26\\Saves\\CAREERDRAFT-2026NOV22';
const buffer = fs.readFileSync(realPath);

const HEADER = 0x46;
const BLOCK_SIZE = 4296;
const ATTR_OFFSET = 0x1000;

const POSITION_NAMES = ['QB', 'HB', 'FB', 'WR', 'TE', 'LT', 'LG', 'C', 'RG', 'RT', 'LE', 'RE', 'DT', 'LOLB', 'MLB', 'ROLB', 'CB', 'FS', 'SS', 'K', 'P'];

console.log('=== Checking Draft Pick Offsets ===\n');
console.log('Block | Pos | 0x4d | 0x4e | 0x4f | 0x50 | Name');
console.log('------|-----|------|------|------|------|-----');

for (let i = 0; i < 50; i++) {
  const blockStart = HEADER + (i * BLOCK_SIZE);
  const attrStart = blockStart + ATTR_OFFSET;

  if (attrStart + 0xC8 > buffer.length) break;

  const firstName = buffer.toString('ascii', attrStart, attrStart + 0x11).replace(/\0/g, '').trim();
  const lastName = buffer.toString('ascii', attrStart + 0x11, attrStart + 0x26).replace(/\0/g, '').trim();
  const positionId = buffer[attrStart + 0x4a];
  const position = POSITION_NAMES[positionId] || `?${positionId}`;

  const byte4d = buffer[attrStart + 0x4d];
  const byte4e = buffer[attrStart + 0x4e];
  const byte4f = buffer[attrStart + 0x4f];
  const byte50 = buffer[attrStart + 0x50];

  console.log(`${(i + 1).toString().padStart(5)} | ${position.padEnd(3)} | ${byte4d.toString().padStart(4)} | ${byte4e.toString().padStart(4)} | ${byte4f.toString().padStart(4)} | ${byte50.toString().padStart(4)} | ${firstName} ${lastName}`);
}

// Look at UDFAs too (around prospect 225+)
console.log('\n\n=== Later Prospects (around 220-240) ===');
console.log('Block | Pos | 0x4d | 0x4e | 0x4f | 0x50 | Name');
console.log('------|-----|------|------|------|------|-----');

for (let i = 220; i < 240; i++) {
  const blockStart = HEADER + (i * BLOCK_SIZE);
  const attrStart = blockStart + ATTR_OFFSET;

  if (attrStart + 0xC8 > buffer.length) break;

  const firstName = buffer.toString('ascii', attrStart, attrStart + 0x11).replace(/\0/g, '').trim();
  const lastName = buffer.toString('ascii', attrStart + 0x11, attrStart + 0x26).replace(/\0/g, '').trim();
  if (!firstName) continue;

  const positionId = buffer[attrStart + 0x4a];
  const position = POSITION_NAMES[positionId] || `?${positionId}`;

  const byte4d = buffer[attrStart + 0x4d];
  const byte4e = buffer[attrStart + 0x4e];
  const byte4f = buffer[attrStart + 0x4f];
  const byte50 = buffer[attrStart + 0x50];

  console.log(`${(i + 1).toString().padStart(5)} | ${position.padEnd(3)} | ${byte4d.toString().padStart(4)} | ${byte4e.toString().padStart(4)} | ${byte4f.toString().padStart(4)} | ${byte50.toString().padStart(4)} | ${firstName} ${lastName}`);
}
