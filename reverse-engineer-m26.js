const fs = require('fs');

const m26Path = 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden NFL 26\\Saves\\CAREERDRAFT-2026DRAFT7RND';
const buffer = fs.readFileSync(m26Path);

console.log('=== Reverse Engineering M26 Block Structure ===\n');

const BLOCK_SIZE = 4296; // Discovered block size
const FIRST_PROSPECT_OFFSET = 0x46;

// Theory: Each prospect has a length prefix somewhere
// Let's check what's BEFORE each {"bodyType"

function findProspectStarts(buf, maxCount = 20) {
  const prospects = [];
  let offset = 0;
  while (prospects.length < maxCount) {
    const found = buf.indexOf(Buffer.from('{"bodyType"'), offset);
    if (found === -1) break;
    prospects.push(found);
    offset = found + 1;
  }
  return prospects;
}

const prospectStarts = findProspectStarts(buffer);

console.log('Analyzing first 10 prospects:\n');

for (let i = 0; i < Math.min(10, prospectStarts.length); i++) {
  const start = prospectStarts[i];
  const nextStart = prospectStarts[i + 1] || buffer.length;
  const prospectSize = nextStart - start;
  const numBlocks = Math.ceil(prospectSize / BLOCK_SIZE);

  console.log(`Prospect ${i + 1}:`);
  console.log(`  Start: 0x${start.toString(16)} (${start})`);
  console.log(`  Size: ${prospectSize} bytes`);
  console.log(`  Blocks: ${numBlocks} (${prospectSize} / ${BLOCK_SIZE})`);

  // Check bytes BEFORE the JSON
  if (start >= 8) {
    const before = buffer.subarray(start - 8, start);
    console.log(`  8 bytes before JSON:`, before.toString('hex').match(/.{2}/g).join(' '));

    // Try to find length field
    const uint32_4 = buffer.readUInt32LE(start - 4);
    const uint16_4 = buffer.readUInt16LE(start - 4);
    const uint16_2 = buffer.readUInt16LE(start - 2);

    console.log(`    uint32 at -4: ${uint32_4}`);
    console.log(`    uint16 at -4: ${uint16_4}`);
    console.log(`    uint16 at -2: ${uint16_2}`);
  }

  // Find where JSON ends
  let braceCount = 0;
  let jsonEnd = -1;
  for (let j = start; j < start + 10000; j++) {
    const char = String.fromCharCode(buffer[j]);
    if (char === '{') braceCount++;
    if (char === '}') {
      braceCount--;
      if (braceCount === 0) {
        jsonEnd = j + 1;
        break;
      }
    }
  }

  if (jsonEnd !== -1) {
    const jsonLength = jsonEnd - start;
    console.log(`  JSON length: ${jsonLength} bytes`);
    console.log(`  Padding after JSON: ${prospectSize - jsonLength} bytes`);
  }

  console.log();
}

// Check if there's a pattern in the header
console.log('\n=== Checking for prospect count/metadata ===');
const prospectCount = prospectStarts.length;
console.log(`Total prospects found: ${prospectCount}`);
console.log(`Value at 0x42 (uint16): ${buffer.readUInt16LE(0x42)}`);
console.log(`Value at 0x40 (uint16): ${buffer.readUInt16LE(0x40)}`);
console.log(`Value at 0x44 (uint16): ${buffer.readUInt16LE(0x44)}`);

// Check if 402 relates to prospect count
console.log(`\n402 / ${prospectCount} = ${402 / prospectCount}`);
console.log(`Is 402 close to prospect count? ${Math.abs(402 - prospectCount) < 50}`);
