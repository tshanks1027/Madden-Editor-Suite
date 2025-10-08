const fs = require('fs');

const filePath = 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden NFL 26\\Saves\\CAREERDRAFT-2026DRAFT7RND';
const buffer = fs.readFileSync(filePath);

const DATA_START = 0x46;
const BLOCK_SIZE = 4296;
const ATTRIBUTE_OFFSET = 0x1000;

// Check first prospect (index 0)
const blockStart = DATA_START;
const attributeStart = blockStart + ATTRIBUTE_OFFSET;

console.log('=== FIRST PROSPECT BLOCK STRUCTURE ===');
console.log(`Block starts at: 0x${blockStart.toString(16)}`);
console.log(`Attributes start at: 0x${attributeStart.toString(16)}`);
console.log('');

// Search for JSON in the first 0x1000 bytes (before attributes)
const JSON_START_MARKER = Buffer.from('{"bodyType"');
const jsonStartIndex = buffer.indexOf(JSON_START_MARKER, blockStart);

if (jsonStartIndex !== -1 && jsonStartIndex < attributeStart) {
  console.log(`JSON found at: 0x${jsonStartIndex.toString(16)}`);
  console.log(`Offset from block start: 0x${(jsonStartIndex - blockStart).toString(16)}`);

  // Find end of JSON
  let braceCount = 0;
  let jsonEnd = -1;

  for (let i = jsonStartIndex; i < attributeStart; i++) {
    const char = String.fromCharCode(buffer[i]);
    if (char === '{') braceCount++;
    if (char === '}') {
      braceCount--;
      if (braceCount === 0) {
        jsonEnd = i + 1;
        break;
      }
    }
  }

  if (jsonEnd !== -1) {
    const jsonString = buffer.toString('utf8', jsonStartIndex, jsonEnd);
    console.log('\nJSON content:');
    console.log(jsonString);

    const json = JSON.parse(jsonString);
    console.log('\nParsed values:');
    console.log('  genericHeadName (PEPS):', json.genericHeadName);
    console.log('  bodyType:', json.bodyType);
  }
} else {
  console.log('NO JSON FOUND in first 0x1000 bytes of prospect block!');
}

console.log('\n=== CHECKING WHERE JSON ACTUALLY IS ===');
// Search entire file for first occurrence
const firstJSON = buffer.indexOf(JSON_START_MARKER, 0);
if (firstJSON !== -1) {
  console.log(`First JSON in file at: 0x${firstJSON.toString(16)}`);

  if (firstJSON >= DATA_START) {
    const offsetFromData = firstJSON - DATA_START;
    const prospectNum = Math.floor(offsetFromData / BLOCK_SIZE);
    const offsetInBlock = offsetFromData % BLOCK_SIZE;

    console.log(`  Prospect #${prospectNum + 1}`);
    console.log(`  Offset in block: 0x${offsetInBlock.toString(16)}`);
  }
}
