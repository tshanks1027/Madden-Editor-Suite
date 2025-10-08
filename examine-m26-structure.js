const fs = require('fs');

const filePath = 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden NFL 26\\Saves\\CAREERDRAFT-2026DRAFT7RND';
const buffer = fs.readFileSync(filePath);

console.log('=== M26 Prospect Record Structure ===\n');

// First prospect starts at 0x46
const prospect1Start = 0x46;

// Find where first visual JSON ends
const visualStart = prospect1Start;
const visualText = buffer.toString('utf8', visualStart, visualStart + 5000);
const jsonStart = visualText.indexOf('{');
const jsonEnd = visualText.indexOf('}', jsonStart) + 1; // Find closing brace

// But JSON might have nested braces, need to find the REAL end
let braceCount = 0;
let realJsonEnd = -1;
for (let i = jsonStart; i < visualText.length; i++) {
  if (visualText[i] === '{') braceCount++;
  if (visualText[i] === '}') {
    braceCount--;
    if (braceCount === 0) {
      realJsonEnd = i + 1;
      break;
    }
  }
}

console.log('First Prospect:');
console.log('  Visual JSON starts at char:', jsonStart);
console.log('  Visual JSON ends at char:', realJsonEnd);
console.log('  Visual JSON length:', realJsonEnd);

const jsonString = visualText.substring(jsonStart, realJsonEnd);
console.log('  Visual JSON preview:', jsonString.substring(0, 100) + '...');

// After visual JSON, there should be attribute data
const attributeDataStart = prospect1Start + realJsonEnd;
console.log('\n  Attribute data should start at:', attributeDataStart, `(0x${attributeDataStart.toString(16)})`);

// Show bytes at that position
console.log('  Bytes at attribute start:');
const attrBytes = buffer.subarray(attributeDataStart, attributeDataStart + 50);
console.log('  Hex:', attrBytes.toString('hex').match(/.{2}/g).slice(0, 25).join(' '));
console.log('  Text:', JSON.stringify(attrBytes.toString('utf8', 0, 25)));

// Try to find where prospect 2 starts
// Look for next occurrence of {"bodyType"
const prospect2Search = buffer.indexOf(Buffer.from('{"bodyType"'), prospect1Start + 100);
if (prospect2Search !== -1) {
  console.log('\n\nSecond Prospect:');
  console.log('  Found {"bodyType" at:', prospect2Search, `(0x${prospect2Search.toString(16)})`);
  console.log('  Distance from first prospect:', prospect2Search - prospect1Start, 'bytes');
  console.log('  Expected (4322):', 4322);
  console.log('  Difference:', (prospect2Search - prospect1Start) - 4322);
}
