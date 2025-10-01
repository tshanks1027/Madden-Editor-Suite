const fs = require('fs');

const filePath = 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden NFL 26\\Saves\\ROSTER-Official';
const data = fs.readFileSync(filePath);

console.log('===== ROSTER FILE ANALYSIS =====\n');
console.log('File size:', data.length, 'bytes\n');

console.log('--- HEADER INFO ---');
console.log('Signature (0x00-0x04):', data.slice(0, 4).toString()); // FBCH
console.log('Unknown (0x04-0x08):', data.slice(4, 8).toString('hex'));
console.log('Version offset (0x08-0x0C):', data.readUInt32LE(8));
console.log('Bytes at 0x2A:', data[0x2A], '(0x' + data[0x2A].toString(16) + ')');

console.log('\n--- VERSION STRING ---');
const versionStart = 0x2E;
const versionEnd = data.indexOf(0x00, versionStart);
const versionString = data.slice(versionStart, versionEnd).toString();
console.log('Version:', versionString);

console.log('\n--- SEARCHING FOR TABLE MARKERS ---');
// Common table markers from madden-franchise
const markers = [
  { name: 'SPBF', hex: '53504246' },
  { name: 'ASTO', hex: '4153544f' },
  { name: 'SPEX', hex: '53504558' }
];

markers.forEach(marker => {
  const buf = Buffer.from(marker.hex, 'hex');
  let offset = 0;
  let count = 0;
  while ((offset = data.indexOf(buf, offset)) !== -1) {
    console.log(`Found ${marker.name} at offset: 0x${offset.toString(16)} (${offset})`);
    count++;
    offset += 4;
    if (count > 10) {
      console.log(`  ... (${count} total found)`);
      break;
    }
  }
  if (count === 0) {
    console.log(`${marker.name}: Not found`);
  }
});

console.log('\n--- LOOKING FOR PLAYER DATA PATTERNS ---');
// Search for "Player" string
const playerStr = Buffer.from('Player');
let playerOffset = data.indexOf(playerStr);
if (playerOffset !== -1) {
  console.log('Found "Player" string at:', '0x' + playerOffset.toString(16));
  console.log('Context:', data.slice(playerOffset - 20, playerOffset + 50).toString('hex'));
}

// Look for repeating patterns (potential player records)
console.log('\n--- CHECKING FOR COMPRESSED DATA ---');
const zlibHeader = Buffer.from([0x78, 0x9c]);
if (data.slice(0, 2).equals(zlibHeader) || data.indexOf(zlibHeader) !== -1) {
  console.log('File appears to contain zlib compressed data');
  const zlibOffset = data.indexOf(zlibHeader);
  console.log('zlib header at offset:', '0x' + zlibOffset.toString(16));
} else {
  console.log('No zlib compression detected');
}

console.log('\n--- FIRST 200 BYTES (HEX) ---');
console.log(data.slice(0, 200).toString('hex').match(/.{1,32}/g).join('\n'));

console.log('\n--- FIRST 200 BYTES (ASCII where printable) ---');
let ascii = '';
for (let i = 0; i < 200; i++) {
  const byte = data[i];
  if (byte >= 32 && byte <= 126) {
    ascii += String.fromCharCode(byte);
  } else {
    ascii += '.';
  }
}
console.log(ascii.match(/.{1,64}/g).join('\n'));
