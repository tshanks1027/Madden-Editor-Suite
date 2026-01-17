// Parse coach portrait XML to create lookup with PID, asset name, and race
const fs = require('fs');
const path = require('path');

const xmlPath = 'C:/Users/tshan/Downloads/PAM/assetlibrary_managementportraits_brt.xml';
const outputPath = path.join(__dirname, 'data/lookups/coach-generic-faces.json');

// Read XML
const xml = fs.readFileSync(xmlPath, 'utf8');

// Extract all AssetMetaData entries
const entries = [];
const regex = /<AssetMetaData>\s*<AssetName>([^<]+)<\/AssetName>\s*<AssetId>(\d+)<\/AssetId>\s*<\/AssetMetaData>/g;
let match;

while ((match = regex.exec(xml)) !== null) {
  const fullPath = match[1];
  const assetId = parseInt(match[2], 10);

  // Extract just the face name from the path
  const parts = fullPath.split('/');
  const fileName = parts[parts.length - 1];

  // Skip non-coach entries
  if (!fileName.includes('Coachhead') && !fileName.includes('coachhead')) continue;

  // Extract face name (remove prefix)
  let faceName = fileName.replace('mapo_coachportraits_generic_', '');

  // Determine race from naming patterns
  let race = 'Unknown';
  let gender = 'M'; // Default male

  // New-style lowercase patterns
  if (faceName.includes('_wht_') || faceName.includes('_whi_')) {
    race = 'White';
  } else if (faceName.includes('_blk_')) {
    race = 'Black';
  } else if (faceName.includes('_asn_')) {
    race = 'Asian';
  } else if (faceName.includes('_hsp_')) {
    race = 'Hispanic';
  }
  // Old-style uppercase patterns (e.g., Coachhead_1_B_N_01)
  else {
    const oldStyleMatch = faceName.match(/Coachhead_\d+_([BHMT])_/i);
    if (oldStyleMatch) {
      const code = oldStyleMatch[1].toUpperCase();
      if (code === 'B') race = 'Black';
      else if (code === 'H') race = 'Hispanic';
      else if (code === 'M') race = 'White'; // M seems to be mixed/white
      else if (code === 'T') race = 'White'; // T appears to be light-skinned
    }
  }

  // Detect gender
  if (faceName.includes('_f_') || faceName.includes('_F_')) {
    gender = 'F';
  }

  entries.push({
    pid: assetId,
    faceName: faceName,
    race: race,
    gender: gender,
    fullPath: fullPath
  });
}

// Sort by PID
entries.sort((a, b) => a.pid - b.pid);

// Output stats
console.log(`Found ${entries.length} coach portraits`);

// Count by race
const raceCounts = {};
entries.forEach(e => {
  raceCounts[e.race] = (raceCounts[e.race] || 0) + 1;
});
console.log('\nBy Race:');
Object.entries(raceCounts).sort((a, b) => b[1] - a[1]).forEach(([race, count]) => {
  console.log(`  ${race}: ${count}`);
});

// Count by gender
const genderCounts = {};
entries.forEach(e => {
  genderCounts[e.gender] = (genderCounts[e.gender] || 0) + 1;
});
console.log('\nBy Gender:');
Object.entries(genderCounts).forEach(([gender, count]) => {
  console.log(`  ${gender}: ${count}`);
});

// Show sample entries
console.log('\n=== Sample Entries ===');
console.log('\nWhite faces:');
entries.filter(e => e.race === 'White').slice(0, 5).forEach(e => {
  console.log(`  PID ${e.pid}: ${e.faceName}`);
});

console.log('\nBlack faces:');
entries.filter(e => e.race === 'Black').slice(0, 5).forEach(e => {
  console.log(`  PID ${e.pid}: ${e.faceName}`);
});

console.log('\nHispanic faces:');
entries.filter(e => e.race === 'Hispanic').slice(0, 5).forEach(e => {
  console.log(`  PID ${e.pid}: ${e.faceName}`);
});

console.log('\nAsian faces:');
entries.filter(e => e.race === 'Asian').slice(0, 5).forEach(e => {
  console.log(`  PID ${e.pid}: ${e.faceName}`);
});

// Write JSON lookup
fs.writeFileSync(outputPath, JSON.stringify(entries, null, 2));
console.log(`\nWrote ${entries.length} entries to ${outputPath}`);

// Also create a simpler CSV format
const csvPath = path.join(__dirname, 'data/lookups/coach-generic-faces.csv');
const csvLines = ['PID,FaceName,Race,Gender'];
entries.forEach(e => {
  csvLines.push(`${e.pid},${e.faceName},${e.race},${e.gender}`);
});
fs.writeFileSync(csvPath, csvLines.join('\n'));
console.log(`Wrote CSV to ${csvPath}`);
