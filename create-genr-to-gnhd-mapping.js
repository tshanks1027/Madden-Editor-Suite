/**
 * Create reverse mapping: GENR -> GNHD
 * This allows us to look up the correct GNHD when we know the GENR
 */
const fs = require('fs');

// Load the genericHead -> GENR catalog
const catalog = JSON.parse(fs.readFileSync('./data/lookups/generic-face-catalog.json', 'utf8'));

// Create reverse mapping: GENR -> GNHD
const genrToGnhd = {};

for (const [gnhd, data] of Object.entries(catalog)) {
  const genr = data.genr;
  // If multiple GNHDs map to same GENR, keep the first one
  if (!genrToGnhd[genr]) {
    genrToGnhd[genr] = {
      gnhd: parseInt(gnhd),
      sknt: data.sknt
    };
  }
}

console.log('Created GENR -> GNHD mapping with', Object.keys(genrToGnhd).length, 'entries');

// Show some examples
console.log('\nSample mappings:');
const samples = Object.entries(genrToGnhd).slice(0, 20);
for (const [genr, data] of samples) {
  console.log(`  ${genr} -> GNHD ${data.gnhd}, SKNT ${data.sknt}`);
}

// Save the mapping
fs.writeFileSync('./data/lookups/genr-to-gnhd.json', JSON.stringify(genrToGnhd, null, 2));
console.log('\nSaved to data/lookups/genr-to-gnhd.json');

// Also show if any common GENR codes are missing
const testGenrs = [
  'gen_1_B_B_005', 'gen_7_M_G_005', 'gen_7_M_N_005',
  'gen_2_B_N_01', 'gen_6_B_G_03', 'gen_7_B_B_001'
];
console.log('\nChecking common GENR codes:');
for (const genr of testGenrs) {
  const mapping = genrToGnhd[genr];
  if (mapping) {
    console.log(`  ✓ ${genr} -> GNHD ${mapping.gnhd}`);
  } else {
    console.log(`  ✗ ${genr} NOT FOUND`);
  }
}
