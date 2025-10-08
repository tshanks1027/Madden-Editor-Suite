const fs = require('fs');
const path = require('path');

// Import the parser
const { readDraftClass } = require('./src/main/lib/draft-class/DraftClassParser.js');

const filePath = 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden NFL 26\\Saves\\CAREERDRAFT-2026DRAFT7RND';

console.log('=== Debugging M26 Prospect Parsing ===\n');

const draftClass = readDraftClass(filePath);

console.log(`Total prospects: ${draftClass.prospects.length}`);
console.log(`Game version: ${draftClass.header.gameVersion}`);
console.log(`Data start offset: 0x${draftClass.header.dataStartOffset.toString(16)}`);

// Check first 5 prospects
console.log('\n=== First 5 Prospects ===');
for (let i = 0; i < Math.min(5, draftClass.prospects.length); i++) {
  const p = draftClass.prospects[i];
  console.log(`\n[${i + 1}] ${p.firstName} ${p.lastName}`);
  console.log(`  Position: ${p.position}, College: ${p.college}, Age: ${p.age}`);
  console.log(`  Hometown: ${p.homeTown}, State: ${p.homeState}`);
  console.log(`  Overall: ${p.overall}, Speed: ${p.speed}`);
  console.log(`  Visuals parsed: ${p.visuals ? 'YES' : 'NO'}`);
  if (p.visuals) {
    console.log(`  Visual keys: ${Object.keys(p.visuals).join(', ')}`);
  }
}

// Check prospects that showed garbage (rows 9-15 from screenshot)
console.log('\n\n=== Prospects 9-15 (showed JSON fragments) ===');
for (let i = 8; i < Math.min(15, draftClass.prospects.length); i++) {
  const p = draftClass.prospects[i];
  console.log(`\n[${i + 1}] ${p.firstName} ${p.lastName}`);
  console.log(`  Position: ${p.position}, College: ${p.college}`);
  console.log(`  Visuals parsed: ${p.visuals ? 'YES' : 'NO'}`);

  // Check if firstName/lastName contain JSON fragments
  if (p.firstName && (p.firstName.includes('{') || p.firstName.includes('"'))) {
    console.log(`  ⚠️ firstName contains JSON: ${p.firstName.substring(0, 50)}`);
  }
  if (p.lastName && (p.lastName.includes('{') || p.lastName.includes('"'))) {
    console.log(`  ⚠️ lastName contains JSON: ${p.lastName.substring(0, 50)}`);
  }
}
