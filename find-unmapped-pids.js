const fs = require('fs');
const path = require('path');

// Load roster PIDs
const rosterPids = JSON.parse(fs.readFileSync('roster-pids.json', 'utf8'));
console.log(`Total PIDs in roster: ${rosterPids.length}`);

// Load ALL_PLAYER_LOOKUP.csv
const allPlayerLookup = fs.readFileSync('data/lookups/ALL_PLAYER_LOOKUP.csv', 'utf8');
const allPlayerPids = new Set();
allPlayerLookup.split('\n').slice(1).forEach(line => {
    if (!line.trim()) return;
    const parts = line.split(',');
    if (parts.length >= 9 && parts[8]) {
        const pid = parseInt(parts[8].trim());
        if (pid > 0) {
            allPlayerPids.add(pid);
        }
    }
});
console.log(`PIDs in ALL_PLAYER_LOOKUP.csv: ${allPlayerPids.size}`);

// Load PID_Portrait_Mapping.csv
const pidPortraitMapping = fs.readFileSync('data/lookups/PID_Portrait_Mapping.csv', 'utf8');
const mappedPids = new Set();
pidPortraitMapping.split('\n').slice(1).forEach(line => {
    if (!line.trim()) return;
    const parts = line.split(',');
    if (parts.length >= 1 && parts[0]) {
        const pid = parseInt(parts[0].trim());
        if (pid >= 0) {
            mappedPids.add(pid);
        }
    }
});
console.log(`PIDs in PID_Portrait_Mapping.csv: ${mappedPids.size}`);

// Find PIDs that are NOT in either file
const unmappedPids = rosterPids.filter(pid => {
    return !allPlayerPids.has(pid) && !mappedPids.has(pid);
});

console.log(`\nUnmapped PIDs that need generic faces: ${unmappedPids.length}`);
console.log(`PIDs: ${unmappedPids.slice(0, 50).join(', ')}${unmappedPids.length > 50 ? '...' : ''}`);

// Save unmapped PIDs
fs.writeFileSync('unmapped-pids.json', JSON.stringify(unmappedPids, null, 2));
console.log(`\nSaved unmapped PIDs to unmapped-pids.json`);
