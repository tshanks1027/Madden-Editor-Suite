// Test portrait service in isolation
const fs = require('fs');
const path = require('path');

console.log('Testing portrait system...');
console.log('CWD:', process.cwd());

// Check if files exist
const atlasPath = path.join(process.cwd(), 'data', 'portrait-atlas.json');
const mappingPath = path.join(process.cwd(), 'data', 'lookups', 'PID_Portrait_Mapping.csv');
const spritesDir = path.join(process.cwd(), 'data', 'portrait-sprites');

console.log('\nChecking files:');
console.log('Atlas exists:', fs.existsSync(atlasPath));
console.log('Mapping exists:', fs.existsSync(mappingPath));
console.log('Sprites dir exists:', fs.existsSync(spritesDir));

if (fs.existsSync(spritesDir)) {
  const files = fs.readdirSync(spritesDir);
  console.log(`Sprites dir has ${files.length} files`);
}

// Load and check atlas
if (fs.existsSync(atlasPath)) {
  const atlas = JSON.parse(fs.readFileSync(atlasPath, 'utf8'));
  console.log(`\nAtlas has ${atlas.portraits.length} portraits`);

  // Find SmithGeno
  const smithGeno = atlas.portraits.find(p => p.id === 'SmithGeno');
  if (smithGeno) {
    console.log('Found SmithGeno:', JSON.stringify(smithGeno, null, 2));
  } else {
    console.log('SmithGeno NOT found in atlas');
  }
}

// Check PID mapping
if (fs.existsSync(mappingPath)) {
  const mapping = fs.readFileSync(mappingPath, 'utf8');
  const lines = mapping.split('\n');
  const pid6078 = lines.find(line => line.startsWith('6078,'));
  console.log('\nPID 6078 mapping:', pid6078);
}
