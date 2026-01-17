// Match GenericHeadAssetName format to Portrait XML entries
const fs = require('fs');

// Load the portrait lookup we created
const portraitLookup = JSON.parse(
  fs.readFileSync('data/lookups/coach-generic-faces.json', 'utf8')
);

// The franchise uses format like: coachhead_M_0013_HS
// The XML portraits use format like: Coachhead_HS_Generic_M_Scan_0013

console.log('=== Matching GenericHeadAssetName to Portrait PIDs ===\n');

// Extract scan numbers from HS Generic portraits
const hsGenericPortraits = portraitLookup.filter(p =>
  p.faceName.includes('Coachhead_HS_Generic')
);

console.log(`Found ${hsGenericPortraits.length} HS Generic scan portraits\n`);

// Create a mapping from scan number to PID
const scanToPortrait = {};
hsGenericPortraits.forEach(p => {
  // Extract number from Coachhead_HS_Generic_M_Scan_0013
  const match = p.faceName.match(/Scan_(\d+)/);
  if (match) {
    const scanNum = match[1];
    scanToPortrait[scanNum] = {
      pid: p.pid,
      faceName: p.faceName,
      gender: p.faceName.includes('_F_') ? 'F' : 'M'
    };
  }
});

console.log('Sample mappings (scan number → portrait PID):');
Object.entries(scanToPortrait).slice(0, 20).forEach(([scanNum, data]) => {
  console.log(`  coachhead_${data.gender}_${scanNum}_HS → PID ${data.pid} (${data.faceName})`);
});

// Count by gender
const maleScans = Object.values(scanToPortrait).filter(s => s.gender === 'M').length;
const femaleScans = Object.values(scanToPortrait).filter(s => s.gender === 'F').length;
console.log(`\nTotal: ${maleScans} male scans, ${femaleScans} female scans`);

// Now look at the non-HS portraits (the ones with race codes)
console.log('\n=== Non-HS Generic Portraits (with race codes) ===\n');
const nonHsPortraits = portraitLookup.filter(p =>
  !p.faceName.includes('Coachhead_HS_Generic')
);

console.log(`Found ${nonHsPortraits.length} non-HS portraits (with race codes)\n`);

// Group by pattern
const patterns = {};
nonHsPortraits.forEach(p => {
  // Extract the base pattern like "Coachhead_1_B" or "Coachhead_2_m_wht"
  let pattern = 'Unknown';

  // New style: Coachhead_2_m_wht_d_001
  let match = p.faceName.match(/(Coachhead_\d+_[mf]_\w+)/i);
  if (match) {
    pattern = match[1];
  } else {
    // Old style: Coachhead_1_B_N_01
    match = p.faceName.match(/(Coachhead_\d+_[BHMT])/i);
    if (match) {
      pattern = match[1];
    }
  }

  if (!patterns[pattern]) patterns[pattern] = [];
  patterns[pattern].push(p);
});

console.log('Portrait types:');
Object.entries(patterns).sort((a, b) => b[1].length - a[1].length).forEach(([pattern, items]) => {
  console.log(`  ${pattern}: ${items.length} portraits`);
  items.slice(0, 3).forEach(p => {
    console.log(`    PID ${p.pid}: ${p.faceName} (${p.race})`);
  });
});

// Create the final mapping file
console.log('\n=== Creating Final Mapping ===\n');

const finalMapping = {
  // HS Generic scans - map GenericHeadAssetName to portrait PID
  hsGenericScans: {},
  // Race-coded portraits - for when we know the coach's race
  raceCodedPortraits: {
    White: [],
    Black: [],
    Hispanic: [],
    Asian: [],
    Unknown: []
  }
};

// Add HS scans
Object.entries(scanToPortrait).forEach(([scanNum, data]) => {
  // The franchise format is: coachhead_M_XXXX_HS
  const franchiseKey = `coachhead_${data.gender}_${scanNum}_HS`;
  finalMapping.hsGenericScans[franchiseKey] = data.pid;
});

// Add race-coded portraits
nonHsPortraits.forEach(p => {
  finalMapping.raceCodedPortraits[p.race].push({
    pid: p.pid,
    faceName: p.faceName,
    gender: p.gender
  });
});

// Write the mapping
const mappingPath = 'data/lookups/coach-portrait-mapping.json';
fs.writeFileSync(mappingPath, JSON.stringify(finalMapping, null, 2));
console.log(`Wrote mapping to ${mappingPath}`);

console.log('\nMapping summary:');
console.log(`  HS Generic scans: ${Object.keys(finalMapping.hsGenericScans).length}`);
Object.entries(finalMapping.raceCodedPortraits).forEach(([race, items]) => {
  console.log(`  ${race} portraits: ${items.length}`);
});
