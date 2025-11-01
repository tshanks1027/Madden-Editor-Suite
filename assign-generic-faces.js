const fs = require('fs');

// Load the list of PIDs needing generics
const data = JSON.parse(fs.readFileSync('pids-needing-generics.json', 'utf8'));
const needGeneric = data.players;
const cowboys = data.cowboys;

console.log(`Total PIDs needing generic faces: ${needGeneric.length}`);
console.log(`Cowboys needing generic faces: ${cowboys.length}\n`);

// Load atlas to get all generic faces
const atlas = JSON.parse(fs.readFileSync('data/portrait-atlas.json', 'utf8'));
const genericFaces = atlas.portraits
    .filter(p => p.category === 'generic')
    .map(p => p.id)
    .sort();

console.log(`Available generic faces in atlas: ${genericFaces.length}`);
console.log(`First few: ${genericFaces.slice(0, 5).join(', ')}`);
console.log(`Last few: ${genericFaces.slice(-5).join(', ')}\n`);

// Assign generic faces
const assignments = [];

// Assign last generic faces to Cowboys (as per user hint)
const lastGenericFaces = genericFaces.slice(-cowboys.length);
cowboys.forEach((player, index) => {
    assignments.push({
        pid: player.pid,
        type: 'generic',
        portrait: lastGenericFaces[index],
        note: `Cowboys: ${player.name}`
    });
});

console.log(`Assigned last ${cowboys.length} generic faces to Cowboys`);

// Assign remaining generic faces to other players
const otherPlayers = needGeneric.filter(p => !cowboys.find(c => c.pid === p.pid));
const availableGenericFaces = genericFaces.slice(0, -cowboys.length);

otherPlayers.forEach((player, index) => {
    const faceIndex = index % availableGenericFaces.length;
    assignments.push({
        pid: player.pid,
        type: 'generic',
        portrait: availableGenericFaces[faceIndex],
        note: player.name
    });
});

console.log(`Assigned generic faces to ${otherPlayers.length} other players\n`);

// Load existing PID_Portrait_Mapping.csv
const existingMapping = fs.readFileSync('data/lookups/PID_Portrait_Mapping.csv', 'utf8');
const existingLines = existingMapping.split('\n');
const header = existingLines[0];
const existingPids = new Set();

existingLines.slice(1).forEach(line => {
    if (!line.trim()) return;
    const parts = line.split(',');
    if (parts.length >= 1 && parts[0]) {
        existingPids.add(parseInt(parts[0].trim()));
    }
});

console.log(`Existing mappings in PID_Portrait_Mapping.csv: ${existingPids.size}`);

// Filter out assignments that already exist
const newAssignments = assignments.filter(a => !existingPids.has(a.pid));

console.log(`New assignments to add: ${newAssignments.length}\n`);

// Append new assignments to PID_Portrait_Mapping.csv
const newLines = newAssignments.map(a => `${a.pid},${a.type},${a.portrait}`);
const updatedMapping = existingMapping.trim() + '\n' + newLines.join('\n') + '\n';

fs.writeFileSync('data/lookups/PID_Portrait_Mapping.csv', updatedMapping, 'utf8');

console.log(`✓ Updated PID_Portrait_Mapping.csv with ${newLines.length} new mappings`);
console.log(`  Total mappings now: ${existingPids.size + newLines.length}`);

// Save detailed assignment list
fs.writeFileSync('generic-face-assignments.json', JSON.stringify({
    totalAssignments: assignments.length,
    newAssignments: newAssignments.length,
    cowboys: assignments.filter(a => a.note && a.note.includes('Cowboys')),
    others: assignments.filter(a => !a.note || !a.note.includes('Cowboys')).slice(0, 20),
    allAssignments: assignments
}, null, 2));

console.log(`\n✓ Saved assignment details to generic-face-assignments.json`);

// Show sample assignments
console.log(`\n=== SAMPLE ASSIGNMENTS ===`);
console.log(`\nCowboys (last ${cowboys.length} generic faces):`);
assignments.filter(a => a.note && a.note.includes('Cowboys')).forEach(a => {
    console.log(`  PID ${a.pid}: ${a.portrait} (${a.note})`);
});

console.log(`\nOther players (first 10):`);
assignments.filter(a => !a.note || !a.note.includes('Cowboys')).slice(0, 10).forEach(a => {
    console.log(`  PID ${a.pid}: ${a.portrait} (${a.note})`);
});
