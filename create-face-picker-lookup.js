/**
 * Create definitive face picker -> GENR/SKNT lookup
 * Face picker numbers 001-264 map to specific GENR codes
 */
const fs = require('fs');

// Load the extracted mapping
const completeMapping = JSON.parse(fs.readFileSync('./data/lookups/face-complete-mapping.json', 'utf8'));

// Create face picker -> GENR lookup
const facePickerToGenr = {};
for (const entry of completeMapping) {
  facePickerToGenr[entry.faceNum] = {
    genr: entry.genr,
    sknt: entry.sknt
  };
}

console.log('=== FACE PICKER TO GENR MAPPING ===\n');
console.log(`Total faces mapped: ${Object.keys(facePickerToGenr).length}`);

// Count unique GENR values
const uniqueGenr = [...new Set(Object.values(facePickerToGenr).map(v => v.genr))];
console.log(`Unique GENR codes: ${uniqueGenr.length}`);

// Check if any faces have same GENR
const genrCounts = {};
for (const data of Object.values(facePickerToGenr)) {
  genrCounts[data.genr] = (genrCounts[data.genr] || 0) + 1;
}
const duplicateGenr = Object.entries(genrCounts).filter(([k,v]) => v > 1);
console.log(`Duplicate GENR codes: ${duplicateGenr.length}`);

if (duplicateGenr.length > 0) {
  console.log('\nFaces with same GENR:');
  for (const [genr, count] of duplicateGenr.slice(0, 10)) {
    const faces = Object.entries(facePickerToGenr)
      .filter(([k, v]) => v.genr === genr)
      .map(([k]) => k);
    console.log(`  ${genr}: faces ${faces.join(', ')}`);
  }
}

// Create reverse lookup: GENR -> face picker numbers
const genrToFacePicker = {};
for (const [faceNum, data] of Object.entries(facePickerToGenr)) {
  if (!genrToFacePicker[data.genr]) {
    genrToFacePicker[data.genr] = [];
  }
  genrToFacePicker[data.genr].push(parseInt(faceNum));
}

// Save mappings
fs.writeFileSync('./data/lookups/face-picker-to-genr.json', JSON.stringify(facePickerToGenr, null, 2));
console.log('\nSaved: data/lookups/face-picker-to-genr.json');

fs.writeFileSync('./data/lookups/genr-to-face-picker.json', JSON.stringify(genrToFacePicker, null, 2));
console.log('Saved: data/lookups/genr-to-face-picker.json');

// Show sample entries
console.log('\n=== SAMPLE MAPPINGS ===\n');
for (let i = 1; i <= 20; i++) {
  const data = facePickerToGenr[i];
  console.log(`Face ${String(i).padStart(3, '0')}: ${data.genr} (SKNT ${data.sknt})`);
}
