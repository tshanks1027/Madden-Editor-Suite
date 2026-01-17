// Analyze header of streameddata.DB
const fs = require('fs');
const path = require('path');

const filePath = 'C:\\Users\\tshan\\Downloads\\PAM\\Gamemode\\streameddata.DB';
const buf = fs.readFileSync(filePath);

console.log('File size:', buf.length);
console.log('\nFirst 256 bytes (hex):');
for (let i = 0; i < 256; i += 16) {
    const hex = [];
    const ascii = [];
    for (let j = 0; j < 16 && i + j < buf.length; j++) {
        hex.push(buf[i+j].toString(16).padStart(2, '0'));
        const c = buf[i+j];
        ascii.push((c >= 32 && c <= 126) ? String.fromCharCode(c) : '.');
    }
    console.log(`${i.toString(16).padStart(6, '0')}: ${hex.join(' ')}  ${ascii.join('')}`);
}

// Look for "COMN" or "TMCP" strings in file
console.log('\n\nSearching for table markers...');
const fileStr = buf.toString('binary');

// Search for 4-char markers that might be table names
const markers = ['COMN', 'TMCP', 'PLNA', 'PCMT', 'DATA', 'TABL'];
for (const marker of markers) {
    const idx = fileStr.indexOf(marker);
    if (idx !== -1) {
        console.log(`Found "${marker}" at offset 0x${idx.toString(16)}`);
        console.log(`  Context: ${buf.slice(Math.max(0, idx-8), idx+32).toString('hex')}`);
    }
}

// Look for the EBX magic
const ebxMagic = buf.readUInt32BE(0);
console.log(`\nFirst 4 bytes as BE: 0x${ebxMagic.toString(16)}`);
console.log(`First 4 bytes as LE: 0x${buf.readUInt32LE(0).toString(16)}`);

// Check if it starts with DB magic
if (buf.slice(0, 2).toString('hex') === '4442') {
    console.log('\nFile starts with "DB" magic!');
}
