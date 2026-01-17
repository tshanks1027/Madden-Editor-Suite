// Create commentary lookup with CORRECT formula: uint16BE / 2
const fs = require('fs');

const filePath = 'C:\\Users\\tshan\\Downloads\\PAM\\Gamemode\\streameddata.DB';
const buf = fs.readFileSync(filePath);

const RECORD_SIZE = 24;
const comnStart = 0x1f120;
const comnEnd = 0x4ca08;

// Find first aligned offset
let startOffset = comnStart;
while (startOffset % RECORD_SIZE !== 0) {
    startOffset++;
}

console.log(`Starting at offset 0x${startOffset.toString(16)}\n`);

// Extract all valid records
const records = [];
let offset = startOffset;

while (offset < comnEnd - RECORD_SIZE) {
    const nameBytes = buf.slice(offset, offset + 20);
    const firstChar = nameBytes[0];

    if (firstChar >= 65 && firstChar <= 90) {
        let name = '';
        let valid = true;
        for (let i = 0; i < 20; i++) {
            const c = nameBytes[i];
            if (c === 0) break;
            if (c >= 32 && c <= 126) name += String.fromCharCode(c);
            else { valid = false; break; }
        }

        if (valid && name.length >= 2 && !['ANLP', 'TMCP', 'COMN'].includes(name)) {
            // CORRECT FORMULA: read first 2 bytes of value as uint16BE, divide by 2
            const valueOffset = offset + 20;
            const rawBE = buf.readUInt16BE(valueOffset);
            const pcmt = Math.floor(rawBE / 2);

            if (pcmt >= 1 && pcmt <= 65535) {
                records.push({ name, pcmt, rawBE, offset });
            }
        }
    }
    offset += RECORD_SIZE;
}

console.log(`Extracted ${records.length} records\n`);

// Create lookup (dedupe by name)
const nameMap = new Map();
for (const rec of records) {
    const nameLower = rec.name.toLowerCase();
    if (!nameMap.has(nameLower)) {
        nameMap.set(nameLower, rec);
    }
}

const sorted = Array.from(nameMap.values()).sort((a, b) =>
    a.name.toLowerCase().localeCompare(b.name.toLowerCase())
);

console.log(`Unique names: ${sorted.length}\n`);

// Verification against Frosty values
console.log('=== Verification against Frosty screenshot ===');
const frostyChecks = [
    { name: 'Aaitui', expected: 5657 },
    { name: 'Aaron', expected: 7553 },
    { name: 'Abanikanda', expected: 8677 },
    { name: 'Abbot', expected: 6693 },
    { name: 'Abbrederis', expected: 5788 },
    { name: 'Abdesmad', expected: 6356 },
    { name: 'Abdul-Quddus', expected: 5 },
    { name: 'Abdullah', expected: 4 },
    { name: 'Abel', expected: 7554 },
    { name: 'Abernathy', expected: 7 },
    { name: 'Abiamiri', expected: 8 },
    { name: 'Aboushi', expected: 5543 },
    { name: 'Abraham', expected: 9 },
    { name: 'Abram', expected: 7281 },
    { name: 'Abrams', expected: 11 },
    { name: 'Adams', expected: 19 },
    { name: 'Brady', expected: 31748 },
    { name: 'Brees', expected: 47108 },
];

let matches = 0;
for (const { name, expected } of frostyChecks) {
    const entry = nameMap.get(name.toLowerCase());
    if (entry) {
        const status = entry.pcmt === expected ? '✓' : `✗ (got ${entry.pcmt})`;
        if (entry.pcmt === expected) matches++;
        console.log(`  ${name}: ${entry.pcmt} ${status}`);
    } else {
        console.log(`  ${name}: NOT FOUND`);
    }
}
console.log(`\nMatched: ${matches}/${frostyChecks.length}`);

// Save to CSV
const csv = ['id,name'];
for (const rec of sorted) {
    const safeName = rec.name.includes(',') ? `"${rec.name}"` : rec.name;
    csv.push(`${rec.pcmt},${safeName}`);
}

fs.writeFileSync('data/lookups/commentary_lookup.csv', csv.join('\n'));
console.log(`\nSaved ${sorted.length} entries to commentary_lookup.csv`);

// Sample
console.log('\nFirst 20 entries:');
for (const rec of sorted.slice(0, 20)) {
    console.log(`  ${rec.pcmt}: ${rec.name}`);
}
