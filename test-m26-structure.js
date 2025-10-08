const fs = require('fs');

const filePath = 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden NFL 26\\Saves\\CAREERDRAFT-2026DRAFT7RND';
const buffer = fs.readFileSync(filePath);

console.log('=== M26 Draft Class Structure ===\n');

// Header info
console.log('Signature:', buffer.toString('ascii', 0, 8));
console.log('Version:', buffer.readUInt8(8));
console.log('Year:', buffer.readUInt16LE(0x16));
console.log('Product:', buffer.toString('ascii', 0x22, 0x37).replace(/\0/g, ''));

// First prospect starts at 0x4C (76 bytes)
const firstProspectOffset = 0x4C;
const visualDataSize = 4096;

console.log('\n=== First Prospect Visual Data (first 100 bytes) ===');
const firstVisual = buffer.subarray(firstProspectOffset, firstProspectOffset + 100);

// Show hex
let hexStr = '';
for (let i = 0; i < 100; i++) {
  hexStr += firstVisual[i].toString(16).padStart(2, '0').toUpperCase() + ' ';
  if ((i + 1) % 16 === 0) hexStr += '\n';
}
console.log(hexStr);

// Check for magic bytes
const gzipMagic = Buffer.from([0x1F, 0x8B]);
const zstdMagic = Buffer.from([0x28, 0xB5, 0x2F, 0xFD]);

const gzipIndex = firstVisual.indexOf(gzipMagic);
const zstdIndex = firstVisual.indexOf(zstdMagic);

console.log('\nGzip magic bytes at index:', gzipIndex);
console.log('Zstd magic bytes at index:', zstdIndex);

// Check first 2 bytes (length prefix?)
console.log('\nFirst 2 bytes as LE uint16:', firstVisual.readUInt16LE(0));
console.log('First 2 bytes as BE uint16:', firstVisual.readUInt16BE(0));

// Try to find JSON
const jsonIndex = firstVisual.indexOf(Buffer.from('{'));
console.log('First { character at index:', jsonIndex);

// Show full visual data as text
const fullVisual = buffer.subarray(firstProspectOffset, firstProspectOffset + visualDataSize);
const visualText = fullVisual.toString('utf8');
console.log('\n=== Visual Data Text (first 300 chars) ===');
console.log(visualText.substring(0, 300));

const fullJsonStart = visualText.indexOf('{');
console.log('\n{ starts at char:', fullJsonStart);
if (fullJsonStart > 0) {
  console.log('Before JSON:', JSON.stringify(visualText.substring(0, fullJsonStart)));
}

// Check if there's a length prefix
console.log('\n=== Checking for length prefix ===');
const potentialLength = buffer.readUInt16LE(firstProspectOffset - 2);
console.log('2 bytes before visual data (LE):', potentialLength);
console.log('Hex:', buffer.subarray(firstProspectOffset - 2, firstProspectOffset).toString('hex'));

// Maybe the visual data section has its own header?
console.log('\n=== Raw bytes at prospect start ===');
console.log('Offset 0x4C-2 to 0x4C+10:');
const headerBytes = buffer.subarray(firstProspectOffset - 2, firstProspectOffset + 10);
console.log(headerBytes.toString('hex').match(/.{2}/g).join(' '));
console.log('As text:', headerBytes.toString('utf8'));
