/**
 * Check archetypes stored in M26 file and compare OVR with correct archetype
 */
const fs = require('fs');
const path = require('path');

// Read OVR weights
const weightsPath = path.join(__dirname, 'data/lookups/ovrweights.json');
const weights = JSON.parse(fs.readFileSync(weightsPath, 'utf-8'));

// Get weights by archetype
const weightsByArchetype = {};
for (const w of weights) {
  weightsByArchetype[w.Archetype] = w;
}

// Position ID to name
const POSITION_NAMES = ['QB', 'HB', 'FB', 'WR', 'TE', 'LT', 'LG', 'C', 'RG', 'RT', 'LE', 'RE', 'DT', 'LOLB', 'MLB', 'ROLB', 'CB', 'FS', 'SS', 'K', 'P'];

// All archetype definitions
const ALL_ARCHETYPES = weights.map(w => w.Archetype);
console.log('Available archetypes:', ALL_ARCHETYPES.length);

// Read real M26 file
const realPath = 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden NFL 26\\Saves\\CAREERDRAFT-2026NOV22';
const real = fs.readFileSync(realPath);

const HEADER = 0x46;
const BLOCK_SIZE = 4296;
const ATTR_OFFSET = 0x1000;

console.log('\n=== Checking Archetypes in M26 File ===\n');

console.log('Block | Pos | Archetype ID | Archetype Name | Stored OVR | Name');
console.log('------|-----|--------------|----------------|------------|-----');

// Check archetype field at 0x4b
for (let i = 0; i < 50; i++) {
  const blockStart = HEADER + (i * BLOCK_SIZE);
  const attrStart = blockStart + ATTR_OFFSET;

  if (attrStart + 0xC8 > real.length) break;

  const attrData = real.subarray(attrStart, attrStart + 0xC8);

  const firstName = real.toString('ascii', attrStart, attrStart + 0x11).replace(/\0/g, '').trim();
  const lastName = real.toString('ascii', attrStart + 0x11, attrStart + 0x26).replace(/\0/g, '').trim();
  const positionId = attrData[0x4a];
  const position = POSITION_NAMES[positionId] || `?${positionId}`;
  const archetypeId = attrData[0x4b];
  const storedOVR = attrData[0x51];

  console.log(`${(i + 1).toString().padStart(5)} | ${position.padEnd(3)} | ${archetypeId.toString().padStart(12)} | ${archetypeId.toString().padStart(14)} | ${storedOVR.toString().padStart(10)} | ${firstName} ${lastName}`);
}

// Let's look at what the archetype ID values are and see if they map to something
console.log('\n\n=== Unique Archetype IDs ===');
const archetypeIds = new Map();

for (let i = 0; i < 402; i++) {
  const blockStart = HEADER + (i * BLOCK_SIZE);
  const attrStart = blockStart + ATTR_OFFSET;

  if (attrStart + 0xC8 > real.length) break;

  const attrData = real.subarray(attrStart, attrStart + 0xC8);
  const firstName = real.toString('ascii', attrStart, attrStart + 0x11).replace(/\0/g, '').trim();
  if (!firstName) continue;

  const positionId = attrData[0x4a];
  const position = POSITION_NAMES[positionId] || `?${positionId}`;
  const archetypeId = attrData[0x4b];

  const key = `${position}_${archetypeId}`;
  if (!archetypeIds.has(key)) {
    archetypeIds.set(key, { position, archetypeId, count: 0, example: `${firstName}` });
  }
  archetypeIds.get(key).count++;
}

// Sort and display
const sorted = Array.from(archetypeIds.entries()).sort((a, b) => {
  if (a[1].position !== b[1].position) return a[1].position.localeCompare(b[1].position);
  return a[1].archetypeId - b[1].archetypeId;
});

console.log('\nPosition | Archetype ID | Count | Example');
console.log('---------|--------------|-------|--------');
for (const [key, data] of sorted) {
  console.log(`${data.position.padEnd(8)} | ${data.archetypeId.toString().padStart(12)} | ${data.count.toString().padStart(5)} | ${data.example}`);
}

// List all archetypes in ovrweights.json by position
console.log('\n\n=== Archetypes in ovrweights.json ===');
const byPos = {};
for (const arch of ALL_ARCHETYPES) {
  const pos = arch.split('_')[0];
  if (!byPos[pos]) byPos[pos] = [];
  byPos[pos].push(arch);
}

for (const [pos, archs] of Object.entries(byPos)) {
  console.log(`${pos}: ${archs.join(', ')}`);
}
