const { readDraftClass } = require('./src/main/lib/draft-class/DraftClassParser.js');

const filePath = 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden NFL 26\\Saves\\CAREERDRAFT-2020DRAFT';
console.log(`Parsing file: ${filePath}`);

const result = readDraftClass(filePath);

console.log(`\nParsed ${result.prospects.length} prospects`);
console.log(`File type: ${result.fileType}`);
console.log(`Year: ${result.year}`);

// Show first 5 prospects' archetype values
console.log('\n=== First 5 Prospects Archetypes ===');
for (let i = 0; i < 5; i++) {
  const p = result.prospects[i];
  console.log(`\n#${i + 1}: ${p.firstName} ${p.lastName} (${p.position})`);
  console.log(`  archetype value: ${p.archetype}`);

  if (p._archetypeDebug) {
    console.log('  Debug offsets:');
    for (const [offset, value] of Object.entries(p._archetypeDebug)) {
      console.log(`    ${offset}: ${value}`);
    }
  }
}
