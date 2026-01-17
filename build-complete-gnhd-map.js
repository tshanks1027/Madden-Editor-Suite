/**
 * Build complete GENR -> GNHD mapping from leaguevisuals.JSON
 * and match against verified-portrait-genr.json to find missing entries
 */
const fs = require('fs');

// Load leaguevisuals.JSON
const data = JSON.parse(fs.readFileSync('C:/Users/tshan/Downloads/PAM/Gamemode/leaguevisuals.JSON', 'utf8'));

// Load verified portrait mapping
const verified = JSON.parse(fs.readFileSync('./data/lookups/verified-portrait-genr.json', 'utf8'));

console.log('Verified portraits:', Object.keys(verified).length);

// Build GENR -> GNHD mapping from leaguevisuals
const genrToGnhd = {};
for (const [id, player] of Object.entries(data.characterVisualsPlayerMap || {})) {
  const genericHead = player.genericHead;
  const genericHeadName = player.genericHeadName;

  if (genericHead !== undefined && genericHeadName) {
    if (!genrToGnhd[genericHeadName]) {
      genrToGnhd[genericHeadName] = genericHead;
    }
  }
}

console.log('GENR codes in leaguevisuals:', Object.keys(genrToGnhd).length);

// Check which verified faces have GNHD mappings
let found = 0;
let missing = 0;
const missingGenrs = [];

for (const [portrait, data] of Object.entries(verified)) {
  const genr = data.genr;
  if (genrToGnhd[genr]) {
    found++;
  } else {
    missing++;
    missingGenrs.push(genr);
  }
}

console.log(`\nVerified faces with GNHD mapping: ${found}`);
console.log(`Verified faces MISSING GNHD: ${missing}`);

if (missingGenrs.length > 0 && missingGenrs.length <= 50) {
  console.log('\nMissing GENR codes:');
  missingGenrs.forEach(g => console.log(`  ${g}`));
}

// Create combined mapping with GNHD
const combinedMapping = {};
for (const [portrait, data] of Object.entries(verified)) {
  const genr = data.genr;
  const gnhd = genrToGnhd[genr];
  combinedMapping[portrait] = {
    genr: data.genr,
    sknt: data.sknt,
    gnhd: gnhd || null
  };
}

// Save combined mapping
fs.writeFileSync('./data/lookups/verified-portrait-complete.json', JSON.stringify(combinedMapping, null, 2));
console.log('\nSaved to data/lookups/verified-portrait-complete.json');

// Show sample with GNHD
console.log('\nSample mappings with GNHD:');
Object.entries(combinedMapping).slice(0, 10).forEach(([portrait, data]) => {
  console.log(`  ${portrait} -> GENR=${data.genr}, SKNT=${data.sknt}, GNHD=${data.gnhd}`);
});
