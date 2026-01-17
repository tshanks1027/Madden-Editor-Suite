/**
 * Test GNHD mapping - verify we can look up GNHD for GENR codes
 */
const fs = require('fs');

// Load GENR -> GNHD mapping
const genrToGnhd = JSON.parse(fs.readFileSync('./data/lookups/genr-to-gnhd.json', 'utf8'));

// Load verified portrait mapping
const verified = JSON.parse(fs.readFileSync('./data/lookups/verified-portrait-genr.json', 'utf8'));

console.log('=== GNHD Mapping Test ===\n');
console.log('GENR -> GNHD mappings:', Object.keys(genrToGnhd).length);
console.log('Verified portraits:', Object.keys(verified).length);

// Test lookups for verified portraits
console.log('\n=== Sample Lookups ===\n');

let foundCount = 0;
let missingCount = 0;
const samples = Object.entries(verified).slice(0, 15);

for (const [portrait, data] of samples) {
  const genr = data.genr;
  const gnhdData = genrToGnhd[genr];
  const gnhd = gnhdData ? gnhdData.gnhd : 'NOT FOUND';

  if (gnhdData) {
    foundCount++;
    console.log(`✓ ${portrait}`);
    console.log(`    GENR: ${genr} -> GNHD: ${gnhd}, SKNT: ${data.sknt}`);
  } else {
    missingCount++;
    console.log(`✗ ${portrait}`);
    console.log(`    GENR: ${genr} -> GNHD: NOT FOUND`);
  }
}

console.log('\n=== Summary ===');
console.log(`Found GNHD: ${foundCount}/15`);
console.log(`Missing GNHD: ${missingCount}/15`);

// Count total coverage
let totalFound = 0;
let totalMissing = 0;
for (const data of Object.values(verified)) {
  if (genrToGnhd[data.genr]) {
    totalFound++;
  } else {
    totalMissing++;
  }
}
console.log(`\nTotal coverage: ${totalFound}/${Object.keys(verified).length} verified faces have GNHD mappings`);
console.log(`Missing: ${totalMissing} faces without GNHD mapping`);
