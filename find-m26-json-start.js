const fs = require('fs');

const filePath = 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden NFL 26\\Saves\\CAREERDRAFT-2026DRAFT7RND';
const buffer = fs.readFileSync(filePath);

console.log('=== Finding M26 JSON Start ===\n');

// Search for first occurrence of {"bodyType" which should be start of visual JSON
const searchString = '{"bodyType"';
const searchIndex = buffer.indexOf(Buffer.from(searchString));

if (searchIndex !== -1) {
  console.log('Found', JSON.stringify(searchString), 'at byte offset:', searchIndex, `(0x${searchIndex.toString(16)})`);

  // Show context
  console.log('\n20 bytes before:');
  const before = buffer.subarray(searchIndex - 20, searchIndex);
  console.log('Hex:', before.toString('hex').match(/.{2}/g).join(' '));
  console.log('Text:', JSON.stringify(before.toString('utf8')));

  console.log('\n100 chars of JSON:');
  const json = buffer.toString('utf8', searchIndex, searchIndex + 100);
  console.log(json);

  // This should be the start offset for first prospect
  console.log('\n\nSuggested M26 data start offset:', searchIndex, `(0x${searchIndex.toString(16)})`);
  console.log('Difference from header end (0x40):', searchIndex - 0x40, 'bytes');
  console.log('Difference from M25 offset (0x4C/76):', searchIndex - 0x4C, 'bytes');
} else {
  console.log('Not found. Searching for just "bodyType":');
  const alt = buffer.indexOf(Buffer.from('"bodyType"'));
  if (alt !== -1) {
    console.log('Found "bodyType" at:', alt, `(0x${alt.toString(16)})`);
    console.log('Context:', buffer.toString('utf8', alt - 5, alt + 50));
  }
}
