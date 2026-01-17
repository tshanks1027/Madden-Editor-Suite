/**
 * Create PID to GENR mapping for generic faces
 * Matches PIDs from PID_Portrait_Mapping.csv to GENRs
 */

const fs = require('fs');
const path = require('path');

// Read PID_Portrait_Mapping.csv
const csvPath = path.join(__dirname, 'data', 'lookups', 'PID_Portrait_Mapping.csv');
const content = fs.readFileSync(csvPath, 'utf-8');
const lines = content.split('\n');

// Parse CSV - format: PID,Player Name,Type,Portrait,PAM,Race
const genericMapping = [];

for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const parts = line.split(',');
    if (parts.length < 4) continue;

    const pid = parseInt(parts[0].trim());
    const name = parts[1].trim();
    const type = parts[2].trim();
    const portrait = parts[3].trim();
    const race = parts.length >= 6 ? parseInt(parts[5].trim()) : null;

    // Only process generic faces
    if (type === 'generic' && portrait.startsWith('plpo_generic_')) {
        // Convert portrait to GENR: plpo_generic_X_Y_Z_NNN -> gen_X_Y_Z_NNN
        const genr = portrait.replace('plpo_generic_', 'gen_');

        // Extract SKNT from portrait (first number after generic_)
        const skntMatch = portrait.match(/generic_(\d+)/);
        const sknt = skntMatch ? parseInt(skntMatch[1]) : null;

        genericMapping.push({
            pid,
            portrait,
            genr,
            sknt,
            race
        });
    }
}

console.log(`Found ${genericMapping.length} generic face entries with PIDs`);

// Create PID -> GENR lookup (for setting PID when you know the GENR)
const pidByGenr = {};
for (const entry of genericMapping) {
    if (!pidByGenr[entry.genr]) {
        pidByGenr[entry.genr] = [];
    }
    pidByGenr[entry.genr].push(entry.pid);
}

// Create GENR -> PID lookup (for getting PID from GENR)
const genrToPid = {};
for (const entry of genericMapping) {
    genrToPid[entry.genr] = entry.pid;
}

// Create Portrait -> PID lookup
const portraitToPid = {};
for (const entry of genericMapping) {
    portraitToPid[entry.portrait] = entry.pid;
}

// Save all mappings
const outputPath = path.join(__dirname, 'data', 'lookups', 'generic-pid-mapping.json');
fs.writeFileSync(outputPath, JSON.stringify({
    byGenr: genrToPid,
    byPortrait: portraitToPid,
    entries: genericMapping
}, null, 2));

console.log(`Saved to ${outputPath}`);

// Print sample
console.log('\nSample entries:');
for (let i = 0; i < Math.min(10, genericMapping.length); i++) {
    const e = genericMapping[i];
    console.log(`  PID ${e.pid}: ${e.genr} -> ${e.portrait} (SKNT=${e.sknt}, Race=${e.race})`);
}

// Also update face-picker-to-genr.json to include PIDs
const facePickerPath = path.join(__dirname, 'data', 'lookups', 'face-picker-to-genr.json');
const facePickerData = JSON.parse(fs.readFileSync(facePickerPath, 'utf-8'));

let pidsAdded = 0;
for (const [faceNum, data] of Object.entries(facePickerData)) {
    const genr = data.genr;
    if (genrToPid[genr]) {
        data.pid = genrToPid[genr];
        pidsAdded++;
    } else {
        // Try converting genr to portrait format and looking up
        const portrait = genr.replace('gen_', 'plpo_generic_');
        if (portraitToPid[portrait]) {
            data.pid = portraitToPid[portrait];
            pidsAdded++;
        }
    }
}

// Save updated face picker mapping
fs.writeFileSync(facePickerPath, JSON.stringify(facePickerData, null, 2));
console.log(`\nUpdated face-picker-to-genr.json with ${pidsAdded} PIDs`);

// Print how many face picker entries got PIDs
const withPid = Object.values(facePickerData).filter(d => d.pid).length;
const total = Object.keys(facePickerData).length;
console.log(`Face picker entries with PID: ${withPid}/${total}`);
