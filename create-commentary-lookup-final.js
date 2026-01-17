// Create commentary lookup using >> 9 transformation
// This matches known values: Abdullah=4, Adams=19
const fs = require('fs');

const filePath = 'C:\\Users\\tshan\\Downloads\\PAM\\Gamemode\\streameddata.DB';
const buf = fs.readFileSync(filePath);

const RECORD_SIZE = 24;
const comnStart = 0x1f120;
const comnEnd = 0x4ca08;

// Extract all valid name records
const records = [];
let offset = comnStart;

while (offset < comnEnd - RECORD_SIZE) {
    const nameBytes = buf.slice(offset, offset + 20);
    const storedValue = buf.readUInt32LE(offset + 20);
    const firstChar = nameBytes[0];

    // Check for valid name (A-Z start, printable ASCII)
    if (firstChar >= 65 && firstChar <= 90) {
        let name = '';
        let valid = true;
        for (let i = 0; i < 20; i++) {
            const c = nameBytes[i];
            if (c === 0) break;
            if (c >= 32 && c <= 126) name += String.fromCharCode(c);
            else { valid = false; break; }
        }

        // Skip table headers like ANLP, TMCP
        if (valid && name.length >= 2 && !['ANLP', 'TMCP'].includes(name)) {
            // Apply >> 9 transformation
            const pcmt = storedValue >> 9;

            // Only include if PCMT is in valid range (1-65535)
            if (pcmt >= 1 && pcmt <= 65535) {
                records.push({ name, pcmt, storedValue, offset });
            }
        }
    }
    offset += RECORD_SIZE;
}

console.log(`Extracted ${records.length} commentary entries\n`);

// Deduplicate by name (keep first)
const nameMap = new Map();
for (const rec of records) {
    const nameLower = rec.name.toLowerCase();
    if (!nameMap.has(nameLower)) {
        nameMap.set(nameLower, rec);
    }
}

// Sort by name
const sorted = Array.from(nameMap.values()).sort((a, b) =>
    a.name.toLowerCase().localeCompare(b.name.toLowerCase())
);

console.log(`Unique names: ${sorted.length}\n`);

// Verify known values
console.log('=== Verification ===');
const knownNames = [
    { name: 'Abdullah', expected: 4 },
    { name: 'Adams', expected: 19 },
    { name: 'Brady', expected: 31748 },
    { name: 'Brees', expected: 47108 },
    { name: 'Aaitui', expected: 5657 },
    { name: 'Earl', expected: 1417 },
];

for (const { name, expected } of knownNames) {
    const entry = nameMap.get(name.toLowerCase());
    if (entry) {
        const status = entry.pcmt === expected ? '✓' : `✗ (got ${entry.pcmt}, stored was ${entry.storedValue})`;
        console.log(`  ${name}: ${entry.pcmt} ${status}`);
    } else {
        console.log(`  ${name}: NOT FOUND`);
    }
}

// Show sample entries
console.log('\n=== Sample entries (first 20) ===');
for (const rec of sorted.slice(0, 20)) {
    console.log(`  ${rec.pcmt}: ${rec.name}`);
}

// Save to CSV
const csv = ['id,name'];
for (const rec of sorted) {
    const safeName = rec.name.includes(',') ? `"${rec.name}"` : rec.name;
    csv.push(`${rec.pcmt},${safeName}`);
}

fs.writeFileSync('data/lookups/commentary_lookup.csv', csv.join('\n'));
console.log(`\nSaved ${sorted.length} entries to data/lookups/commentary_lookup.csv`);

// Show some stats
console.log('\n=== Stats ===');
const pcmtValues = sorted.map(r => r.pcmt);
console.log(`  Min PCMT: ${Math.min(...pcmtValues)}`);
console.log(`  Max PCMT: ${Math.max(...pcmtValues)}`);
console.log(`  Unique PCMT values: ${new Set(pcmtValues).size}`);
