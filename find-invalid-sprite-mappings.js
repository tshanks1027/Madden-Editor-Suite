const fs = require('fs');

// Load roster PIDs
const rosterPids = JSON.parse(fs.readFileSync('roster-pids.json', 'utf8'));
console.log(`Total PIDs in roster: ${rosterPids.length}`);

// Load portrait atlas to get all valid sprite keys
const atlas = JSON.parse(fs.readFileSync('data/portrait-atlas.json', 'utf8'));
const validSprites = new Set(atlas.portraits.map(p => p.id));
console.log(`Valid sprites in atlas: ${validSprites.size}`);

// Build complete PID→PLPO mapping from both files
const pidToPlpo = new Map();

// Load from ALL_PLAYER_LOOKUP.csv
const allPlayerLookup = fs.readFileSync('data/lookups/ALL_PLAYER_LOOKUP.csv', 'utf8');
allPlayerLookup.split('\n').slice(1).forEach(line => {
    if (!line.trim()) return;
    const parts = line.split(',');
    if (parts.length >= 12 && parts[8] && parts[11]) {
        const pid = parseInt(parts[8].trim());
        const plpo = parts[11].trim();
        if (pid > 0 && plpo) {
            pidToPlpo.set(pid, { source: 'ALL_PLAYER_LOOKUP', plpo: plpo });
        }
    }
});
console.log(`Loaded ${pidToPlpo.size} mappings from ALL_PLAYER_LOOKUP.csv`);

// Load from PID_Portrait_Mapping.csv (overwrites if duplicate)
const pidPortraitMapping = fs.readFileSync('data/lookups/PID_Portrait_Mapping.csv', 'utf8');
let mappingCount = 0;
pidPortraitMapping.split('\n').slice(1).forEach(line => {
    if (!line.trim()) return;
    const parts = line.split(',');
    if (parts.length >= 3 && parts[0] && parts[2]) {
        const pid = parseInt(parts[0].trim());
        const portrait = parts[2].trim();
        if (pid >= 0 && portrait) {
            if (!pidToPlpo.has(pid)) {
                pidToPlpo.set(pid, { source: 'PID_Portrait_Mapping', plpo: portrait });
                mappingCount++;
            }
        }
    }
});
console.log(`Added ${mappingCount} new mappings from PID_Portrait_Mapping.csv`);
console.log(`Total PID mappings: ${pidToPlpo.size}`);

// Check each roster PID for invalid sprite mapping
const invalidMappings = [];
const missingMappings = [];

rosterPids.forEach(pid => {
    const mapping = pidToPlpo.get(pid);

    if (!mapping) {
        missingMappings.push(pid);
    } else {
        const plpoKey = mapping.plpo;
        if (!validSprites.has(plpoKey)) {
            invalidMappings.push({
                pid: pid,
                plpo: plpoKey,
                source: mapping.source
            });
        }
    }
});

console.log(`\n=== RESULTS ===`);
console.log(`PIDs with no mapping: ${missingMappings.length}`);
console.log(`PIDs with invalid sprite (not in atlas): ${invalidMappings.length}`);

if (invalidMappings.length > 0) {
    console.log(`\nInvalid mappings (first 20):`);
    invalidMappings.slice(0, 20).forEach(m => {
        console.log(`  PID ${m.pid}: "${m.plpo}" (from ${m.source})`);
    });
}

if (missingMappings.length > 0) {
    console.log(`\nMissing mappings (first 20):`);
    console.log(`  PIDs: ${missingMappings.slice(0, 20).join(', ')}`);
}

// Save results
fs.writeFileSync('invalid-sprite-mappings.json', JSON.stringify({
    missingMappings,
    invalidMappings
}, null, 2));
console.log(`\nSaved results to invalid-sprite-mappings.json`);
