const fs = require('fs');
const path = require('path');

const filePath = 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden NFL 26\\Saves\\ROSTER-Official';

console.log('Reading file:', filePath);
const data = fs.readFileSync(filePath);

console.log('\n===== FILE HEADER ANALYSIS =====');
console.log('File size:', data.length, 'bytes');
console.log('\nFirst 4 bytes (signature):', data.slice(0, 4).toString());
console.log('As hex:', data.slice(0, 4).toString('hex'));

console.log('\nByte at 0x2A (decimal 42):', data[0x2A]);
console.log('As hex:', data[0x2A].toString(16));
console.log('As char:', String.fromCharCode(data[0x2A]));

console.log('\nBytes around 0x2A (0x28-0x30):');
for (let i = 0x28; i < 0x30; i++) {
  console.log(`  [0x${i.toString(16)}]: ${data[i]} (0x${data[i].toString(16).padStart(2, '0')}) '${String.fromCharCode(data[i])}'`);
}

console.log('\nFirst 100 bytes as hex:');
console.log(data.slice(0, 100).toString('hex').match(/.{1,32}/g).join('\n'));
