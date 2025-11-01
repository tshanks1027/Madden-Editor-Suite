const fs = require('fs');
const path = require('path');

// Read PID_Portrait_Mapping.csv
const portraitMappingPath = path.join(__dirname, 'data', 'lookups', 'PID_Portrait_Mapping.csv');
const portraitMappingContent = fs.readFileSync(portraitMappingPath, 'utf8');
const portraitMappingLines = portraitMappingContent.split('\n');

// Read PID_lookup.csv
const pidLookupPath = path.join(__dirname, 'data', 'lookups', 'PID_lookup.csv');
const pidLookupContent = fs.readFileSync(pidLookupPath, 'utf8');
const pidLookupLines = pidLookupContent.split('\n');

// Parse PID_lookup.csv into map
const pidToName = new Map();
for (let i = 1; i < pidLookupLines.length; i++) {
    const line = pidLookupLines[i].trim();
    if (!line) continue;
    const parts = line.split(',');
    const pid = parseInt(parts[0]);
    const name = parts.slice(1).join(',').trim(); // Handle names with commas
    if (!isNaN(pid) && name) {
        pidToName.set(pid, name);
    }
}

console.log(`Loaded ${pidToName.size} names from PID_lookup.csv`);

// Build combined data
const combined = new Map();

// Process PID_Portrait_Mapping.csv
for (let i = 1; i < portraitMappingLines.length; i++) {
    const line = portraitMappingLines[i].trim();
    if (!line) continue;

    const parts = line.split(',');
    if (parts.length < 3) continue;

    const pid = parseInt(parts[0]);
    const type = parts[1];
    const portrait = parts[2];

    if (isNaN(pid)) continue;

    // Get name from PID_lookup.csv or generate from PLPO
    let playerName = pidToName.get(pid);

    if (!playerName) {
        if (pid === 0) {
            playerName = 'Blank';
        } else if (type === 'generic') {
            playerName = 'Generic Face';
        } else {
            // Extract from PLPO
            const nameMatch = portrait.match(/plpo_(.+)/);
            if (nameMatch) {
                const camelCase = nameMatch[1];
                const spacedName = camelCase.replace(/([A-Z])/g, ' $1').trim();
                const parts = spacedName.split(' ');
                if (parts.length >= 2) {
                    const lastName = parts[0];
                    const firstName = parts.slice(1).join(' ');
                    playerName = `${firstName} ${lastName}`;
                } else {
                    playerName = spacedName;
                }
            } else {
                playerName = 'Unknown';
            }
        }
    }

    combined.set(pid, { pid, name: playerName, type, portrait });
}

console.log(`Combined ${combined.size} total entries`);

// Sort by PID
const sortedEntries = Array.from(combined.values()).sort((a, b) => a.pid - b.pid);

// Write combined file
const combinedPath = path.join(__dirname, 'data', 'lookups', 'PID_Portrait_Mapping.csv');
const header = 'PID,Player Name,Type,Portrait';
const rows = sortedEntries.map(entry => `${entry.pid},${entry.name},${entry.type},${entry.portrait}`);
const newContent = header + '\n' + rows.join('\n') + '\n';

fs.writeFileSync(combinedPath, newContent, 'utf8');

console.log(`Written ${sortedEntries.length} entries to PID_Portrait_Mapping.csv`);
console.log(`First 5 entries:`);
sortedEntries.slice(0, 5).forEach(entry => {
    console.log(`  ${entry.pid}: ${entry.name} (${entry.portrait})`);
});

// Check 10884
const entry10884 = sortedEntries.find(e => e.pid === 10884);
if (entry10884) {
    console.log(`\nPID 10884: ${entry10884.name} -> ${entry10884.portrait}`);
}
