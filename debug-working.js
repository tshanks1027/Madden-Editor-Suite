const path = require('path');
const M26Parser = require('./src/main/lib/draft-class/M26Parser.js');
const fs = require('fs');

const filePath = 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden NFL 26\\Saves\\CAREERDRAFT-2026DRAFT7RND';
const buffer = fs.readFileSync(filePath);

const header = {
  dataStartOffset: 0x800,
  prospectCount: 402
};

const prospects = M26Parser.parseM26Prospects(buffer, header);

console.log('=== WORKING FILE - FIRST 5 PROSPECTS ===');
for (let i = 0; i < 5; i++) {
  const p = prospects[i];
  console.log(`\nProspect ${i + 1}: ${p.firstName} ${p.lastName}`);
  console.log(`  PID: ${p.PID}`);
  console.log(`  PEPS: ${p.PEPS}`);
  console.log(`  Visuals: ${p.visuals ? 'YES' : 'NO'}`);
  if (p.visuals) {
    console.log(`    genericHeadName: ${p.visuals.genericHeadName}`);
    console.log(`    assetName: ${p.visuals.assetName}`);
    console.log(`    bodyType: ${p.visuals.bodyType}`);
  }
}
