const fs = require('fs');

const filePath = 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden NFL 26\\Saves\\CAREERDRAFT-2026DRAFT7RND';
const buffer = fs.readFileSync(filePath);

console.log('=== M26 Draft Class with Corrected Offset ===\n');

// M26 starts at 0x4A instead of 0x4C
const firstProspectOffset = 0x4A;
const visualDataSize = 4096;
const attributeDataSize = 226;

console.log('Reading from offset 0x4A (74 bytes)');

// Visual data (4096 bytes)
const visualData = buffer.subarray(firstProspectOffset, firstProspectOffset + visualDataSize);
const visualText = visualData.toString('utf8');

console.log('\n=== Visual Data (first 500 chars) ===');
console.log(visualText.substring(0, 500));

// Check if valid JSON
const jsonStart = visualText.indexOf('{');
const jsonEnd = visualText.lastIndexOf('}');

if (jsonStart !== -1 && jsonEnd > jsonStart) {
  const jsonString = visualText.substring(jsonStart, jsonEnd + 1);
  try {
    const json = JSON.parse(jsonString);
    console.log('\n✓ Valid JSON found!');
    console.log('Keys:', Object.keys(json));
  } catch (e) {
    console.log('\n✗ JSON parse failed:', e.message);
    console.log('JSON string (first 200 chars):', jsonString.substring(0, 200));
  }
}

// Attribute data (226 bytes after visual)
const attributeData = buffer.subarray(firstProspectOffset + visualDataSize, firstProspectOffset + visualDataSize + attributeDataSize);

console.log('\n\n=== Attribute Data (first 100 bytes hex) ===');
let hex = '';
for (let i = 0; i < 100; i++) {
  hex += attributeData[i].toString(16).padStart(2, '0').toUpperCase() + ' ';
  if ((i + 1) % 16 === 0) hex += '\n';
}
console.log(hex);

// Try to parse strings from attribute data (M25 offsets)
console.log('\n=== Attempting M25 String Parsing ===');
const firstName = attributeData.toString('utf8', 0, 17).replace(/\0/g, '');
const lastName = attributeData.toString('utf8', 17, 38).replace(/\0/g, '');
const hometown = attributeData.toString('utf8', 38, 65).replace(/\0/g, '');

console.log('First Name (0-17):', JSON.stringify(firstName));
console.log('Last Name (17-38):', JSON.stringify(lastName));
console.log('Hometown (38-65):', JSON.stringify(hometown));
