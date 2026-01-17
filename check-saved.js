/**
 * Check saved draft class file content
 */
const fs = require('fs');
const path = require('path');

// Check different possible save locations
const possiblePaths = [
  'C:\\Users\\tshan\\OneDrive\\Documents\\Madden NFL 26\\Saves\\CAREERDRAFT-EDITED1',
  'C:\\Users\\tshan\\Documents\\Madden NFL 26\\Saves\\CAREERDRAFT-EDITED1',
  'C:\\Users\\tshan\\OneDrive\\Documents\\Madden Files\\CAREERDRAFT-EDITED',
];

let savedPath = null;
for (const p of possiblePaths) {
  if (fs.existsSync(p)) {
    savedPath = p;
    break;
  }
}

// Also check for any recently modified CAREERDRAFT files
const searchDirs = [
  'C:\\Users\\tshan\\OneDrive\\Documents\\Madden NFL 26\\Saves',
  'C:\\Users\\tshan\\Documents\\Madden NFL 26\\Saves',
  'C:\\Users\\tshan\\OneDrive\\Documents\\Madden Files'
];

console.log('Searching for CAREERDRAFT files...');
for (const dir of searchDirs) {
  if (fs.existsSync(dir)) {
    const files = fs.readdirSync(dir).filter(f => f.startsWith('CAREERDRAFT'));
    if (files.length > 0) {
      console.log(`Found in ${dir}:`);
      files.forEach(f => {
        const fullPath = path.join(dir, f);
        const stat = fs.statSync(fullPath);
        console.log(`  ${f} - ${stat.size} bytes - modified ${stat.mtime}`);
      });
    }
  }
}

if (!savedPath) {
  console.log('\nNo saved file found at expected paths. Looking at working file instead...');
  savedPath = 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden Files\\1994 Mod V3\\Draft Classes\\CAREERDRAFT-2012V1';
}

if (!fs.existsSync(savedPath)) {
  console.log('File not found:', savedPath);
  process.exit(1);
}

const saved = fs.readFileSync(savedPath);
console.log('\nAnalyzing:', savedPath);
console.log('File size:', saved.length);

const HEADER_OFFSET = 0x46;
const BLOCK_SIZE = 4322;

console.log('\nFirst 10 prospects in file:');
for (let i = 0; i < 10; i++) {
  const attrStart = HEADER_OFFSET + (i * BLOCK_SIZE) + 0x1000;
  const firstName = saved.toString('ascii', attrStart, attrStart + 0x11).replace(/\0/g, '').trim();
  const lastName = saved.toString('ascii', attrStart + 0x11, attrStart + 0x26).replace(/\0/g, '').trim();
  const pos = saved[attrStart + 0x4a];
  const speed = saved[attrStart + 0x7B];
  const throwPower = saved[attrStart + 0x86];
  const awareness = saved[attrStart + 0x54];
  console.log(`#${i+1}: ${firstName} ${lastName} | pos=${pos} | spd=${speed} | TP=${throwPower} | AWR=${awareness}`);
}
