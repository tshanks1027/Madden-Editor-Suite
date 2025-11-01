const fs = require('fs');

// Simulate what PortraitSpriteService.initialize() does
const atlas = JSON.parse(fs.readFileSync('data/portrait-atlas.json', 'utf8'));
const portraitMap = new Map();

for (const entry of atlas.portraits) {
    // Store by ID (e.g., "HarrisNajee")
    portraitMap.set(entry.id.toLowerCase(), entry);

    // Also store by full filename (e.g., "plpo_HarrisNajee")
    const fullKey = `plpo_${entry.id}`.toLowerCase();
    portraitMap.set(fullKey, entry);

    // Handle legends with prefix
    if (entry.category === 'legends') {
        const legendKey = `plpo_legends_${entry.id}`.toLowerCase();
        portraitMap.set(legendKey, entry);
    }

    // Handle generic with morphed suffix
    if (entry.category === 'generic') {
        const morphedKey = `plpo_generic_${entry.id}_morphed`.toLowerCase();
        portraitMap.set(morphedKey, entry);
    }
}

console.log(`Total portrait map keys: ${portraitMap.size}`);
console.log(`Atlas portraits: ${atlas.portraits.length}`);

// Check some sample generic keys
console.log('\nSample generic face keys in map:');
const sampleGenerics = [
    'generic_1_001_morphed',
    'plpo_generic_1_001_morphed',
    'plpo_generic_generic_1_001_morphed_morphed',
    'generic_1_023_morphed',
    'plpo_generic_1_023_morphed'
];

sampleGenerics.forEach(key => {
    const exists = portraitMap.has(key);
    console.log(`  ${key}: ${exists ? 'EXISTS' : 'NOT FOUND'}`);
});

// Count different categories
const byCategory = {};
atlas.portraits.forEach(p => {
    byCategory[p.category] = (byCategory[p.category] || 0) + 1;
});
console.log('\nPortraits by category:');
Object.entries(byCategory).forEach(([cat, count]) => {
    console.log(`  ${cat}: ${count}`);
});

// Check the PIDs from our roster against this map
const rosterPids = JSON.parse(fs.readFileSync('roster-pids.json', 'utf8'));

// Build PID→PLPO mapping from CSV files
const pidToPlpo = new Map();

// Load from ALL_PLAYER_LOOKUP.csv
const allPlayerLookup = fs.readFileSync('data/lookups/ALL_PLAYER_LOOKUP.csv', 'utf8');
allPlayerLookup.split('\n').slice(1).forEach(line => {
    if (!line.trim()) return;
    const parts = line.split(',');
    if (parts.length >= 12 && parts[8] && parts[11]) {
        const pid = parseInt(parts[8].trim());
        const plpo = parts[11].trim().toLowerCase();
        if (pid > 0 && plpo) {
            pidToPlpo.set(pid, { source: 'ALL_PLAYER_LOOKUP', plpo: plpo });
        }
    }
});

// Load from PID_Portrait_Mapping.csv
const pidPortraitMapping = fs.readFileSync('data/lookups/PID_Portrait_Mapping.csv', 'utf8');
pidPortraitMapping.split('\n').slice(1).forEach(line => {
    if (!line.trim()) return;
    const parts = line.split(',');
    if (parts.length >= 3 && parts[0] && parts[2]) {
        const pid = parseInt(parts[0].trim());
        const portrait = parts[2].trim().toLowerCase();
        if (pid >= 0 && portrait) {
            if (!pidToPlpo.has(pid)) {
                pidToPlpo.set(pid, { source: 'PID_Portrait_Mapping', plpo: portrait });
            }
        }
    }
});

// Check roster PIDs
let validCount = 0;
let invalidCount = 0;
const invalidSamples = [];

rosterPids.forEach(pid => {
    const mapping = pidToPlpo.get(pid);
    if (!mapping) {
        invalidCount++;
        return;
    }

    if (portraitMap.has(mapping.plpo)) {
        validCount++;
    } else {
        invalidCount++;
        if (invalidSamples.length < 10) {
            invalidSamples.push({ pid, plpo: mapping.plpo, source: mapping.source });
        }
    }
});

console.log(`\n=== ROSTER VALIDATION ===`);
console.log(`Total roster PIDs: ${rosterPids.length}`);
console.log(`Valid portraits: ${validCount}`);
console.log(`Invalid/missing portraits: ${invalidCount}`);

if (invalidSamples.length > 0) {
    console.log(`\nInvalid samples:`);
    invalidSamples.forEach(s => {
        console.log(`  PID ${s.pid}: "${s.plpo}" (from ${s.source})`);
    });
}
