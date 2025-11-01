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

// Parse existing PIDs from PID_lookup.csv
const existingPIDs = new Set();
for (let i = 1; i < pidLookupLines.length; i++) {
    const line = pidLookupLines[i].trim();
    if (!line) continue;
    const parts = line.split(',');
    const pid = parseInt(parts[0]);
    if (!isNaN(pid)) {
        existingPIDs.add(pid);
    }
}

console.log(`Existing PIDs in PID_lookup.csv: ${existingPIDs.size}`);

// Find missing PIDs and generate names from PLPO
const missingEntries = [];
for (let i = 1; i < portraitMappingLines.length; i++) {
    const line = portraitMappingLines[i].trim();
    if (!line) continue;

    const parts = line.split(',');
    if (parts.length < 3) continue;

    const pid = parseInt(parts[0]);
    const type = parts[1];
    const portrait = parts[2];

    if (isNaN(pid)) continue;

    // Skip if already in PID_lookup.csv
    if (existingPIDs.has(pid)) continue;

    let playerName = '';

    if (pid === 0) {
        playerName = 'Blank';
    } else if (type === 'generic') {
        playerName = 'Generic Face';
    } else {
        // Extract name from PLPO
        // e.g., "plpo_CodringtonBrandon" -> "Brandon Codrington"
        const nameMatch = portrait.match(/plpo_(.+)/);
        if (nameMatch) {
            const camelCase = nameMatch[1];
            // Split camelCase: "CodringtonBrandon" -> "Codrington Brandon"
            const spacedName = camelCase.replace(/([A-Z])/g, ' $1').trim();

            // Reverse to "FirstName LastName" format
            const parts = spacedName.split(' ');
            if (parts.length >= 2) {
                // "Codrington Brandon" -> "Brandon Codrington"
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

    missingEntries.push({ pid, name: playerName });
}

console.log(`Missing PIDs: ${missingEntries.length}`);

// Sort by PID
missingEntries.sort((a, b) => a.pid - b.pid);

// Append to PID_lookup.csv
const newLines = missingEntries.map(entry => `${entry.pid},${entry.name}`);
const updatedContent = pidLookupContent.trimEnd() + '\n' + newLines.join('\n') + '\n';

fs.writeFileSync(pidLookupPath, updatedContent, 'utf8');

console.log(`Added ${missingEntries.length} entries to PID_lookup.csv`);
console.log(`First 5 new entries:`);
missingEntries.slice(0, 5).forEach(entry => {
    console.log(`  ${entry.pid}: ${entry.name}`);
});

// Show specific entry for 10884
const entry10884 = missingEntries.find(e => e.pid === 10884);
if (entry10884) {
    console.log(`\nPID 10884: ${entry10884.name}`);
}
