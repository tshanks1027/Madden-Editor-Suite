const fs = require('fs');

const m26Path = 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden NFL 26\\Saves\\CAREERDRAFT-2026DRAFT7RND';
const buffer = fs.readFileSync(m26Path);

const BLOCK_SIZE = 4296;

console.log('=== Determining M26 Block Count Method ===\n');

// Find all prospects
function findAllProspects(buf) {
  const prospects = [];
  let offset = 0;
  while (true) {
    const found = buf.indexOf(Buffer.from('{"bodyType"'), offset);
    if (found === -1) break;
    prospects.push(found);
    offset = found + 1;
  }
  return prospects;
}

const prospects = findAllProspects(buffer);
console.log(`Total prospects in file: ${prospects.length}\n`);

// Theory: Block count might be encoded somewhere BEFORE the JSON
// Or we need to scan for next prospect

console.log('Checking for block count hints:\n');

for (let i = 0; i < Math.min(15, prospects.length); i++) {
  const start = prospects[i];
  const nextStart = prospects[i + 1] || buffer.length;
  const distance = nextStart - start;
  const numBlocks = distance / BLOCK_SIZE;

  // Check various byte positions before the JSON
  let blockCountFound = false;

  // Check if numBlocks is encoded anywhere in the 20 bytes before JSON
  for (let offset = -20; offset < 0; offset++) {
    if (start + offset >= 0) {
      const byte = buffer[start + offset];
      if (byte === numBlocks) {
        console.log(`Prospect ${i + 1}: ${numBlocks} blocks - byte value ${numBlocks} found at offset ${offset}`);
        blockCountFound = true;
        break;
      }
    }
  }

  if (!blockCountFound) {
    console.log(`Prospect ${i + 1}: ${numBlocks} blocks - NO block count hint found`);
  }
}

console.log('\n\n=== Conclusion ===');
console.log('If no consistent block count marker found, we must:');
console.log('1. Parse JSON to find its end');
console.log('2. Search forward in 4296-byte increments for next {"bodyType"');
console.log('3. Or scan for next non-null byte after padding');
