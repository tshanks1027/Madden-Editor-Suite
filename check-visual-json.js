/**
 * Check the Visual JSON section for any rating data
 * Maybe the game reads ratings from JSON instead of binary?
 */

const fs = require('fs');

const editedPath = 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden NFL 26\\Saves\\CAREERDRAFT-EDITED';
const edited = fs.readFileSync(editedPath);

// M26 structure
const HEADER = 0x46;
const BLOCK_SIZE = 4322;
const ATTR_OFFSET = 0x1000;

// Block 1 starts right after header
const blockStart = HEADER;
const attrStart = blockStart + ATTR_OFFSET;

console.log('=== VISUAL JSON SECTION CHECK ===\n');

// Find JSON in first block
const jsonStartMarker = edited.indexOf(Buffer.from('{"'), blockStart);
if (jsonStartMarker === -1 || jsonStartMarker >= attrStart) {
  console.log('No JSON found in visual section!');
  process.exit(0);
}

// Find end of JSON
let braceCount = 0;
let jsonEnd = -1;
for (let i = jsonStartMarker; i < attrStart; i++) {
  if (edited[i] === 0x7B) braceCount++; // {
  if (edited[i] === 0x7D) { // }
    braceCount--;
    if (braceCount === 0) {
      jsonEnd = i + 1;
      break;
    }
  }
}

if (jsonEnd === -1) {
  console.log('Could not find end of JSON');
  process.exit(0);
}

const jsonStr = edited.toString('utf8', jsonStartMarker, jsonEnd);
console.log('Visual JSON for prospect #1:');
console.log(jsonStr);

// Parse and look for any rating-like fields
try {
  const json = JSON.parse(jsonStr);
  console.log('\n=== PARSED JSON KEYS ===');
  console.log(Object.keys(json));

  // Look for anything that looks like a rating
  console.log('\n=== LOOKING FOR RATING FIELDS ===');
  for (const [key, value] of Object.entries(json)) {
    if (typeof value === 'number' && value >= 0 && value <= 99) {
      console.log(`${key}: ${value} (could be a rating)`);
    }
  }

  // Check nested objects
  for (const [key, value] of Object.entries(json)) {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      console.log(`\nNested object "${key}":`);
      for (const [k2, v2] of Object.entries(value)) {
        if (typeof v2 === 'number' && v2 >= 0 && v2 <= 99) {
          console.log(`  ${k2}: ${v2} (could be a rating)`);
        }
      }
    }
  }
} catch (e) {
  console.log('Failed to parse JSON:', e.message);
}

// Also check if there's a second JSON block or more data
console.log('\n=== CHECKING FOR MORE JSON IN BLOCK ===');
const secondJson = edited.indexOf(Buffer.from('{"'), jsonEnd);
if (secondJson !== -1 && secondJson < attrStart) {
  console.log(`Found another JSON starting at offset ${secondJson}`);
} else {
  console.log('No additional JSON found');
}
