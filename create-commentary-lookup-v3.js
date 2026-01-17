// Create commentary lookup with smart transformation
// Rule: if storedValue % 512 === 0, use >> 9; otherwise use direct value
const fs = require('fs');

const filePath = 'C:\\Users\\tshan\\Downloads\\PAM\\Gamemode\\streameddata.DB';
const buf = fs.readFileSync(filePath);

const RECORD_SIZE = 24;
const comnStart = 0x1f120;
const comnEnd = 0x4ca08;

// Find first aligned offset (Brady at 0x23d18 is aligned to 24)
// 0x23d18 % 24 = 0, so records align to offset 0
let startOffset = comnStart;
while (startOffset % RECORD_SIZE !== 0) {
    startOffset++;
}
console.log(`Starting at offset 0x${startOffset.toString(16)}`);

// Extract all valid records
const records = [];
let offset = startOffset;

while (offset < comnEnd - RECORD_SIZE) {
    const nameBytes = buf.slice(offset, offset + 20);
    const storedValue = buf.readUInt32LE(offset + 20);
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
            records.push({ name, storedValue, offset });
        }
    }
    offset += RECORD_SIZE;
}

console.log(`Extracted ${records.length} records\n`);

// Apply smart transformation
function getPCMT(storedValue) {
    // If divisible by 512, it's encoded - shift right by 9
    // Otherwise, use the value directly
    if (storedValue % 512 === 0 && storedValue > 0) {
        return storedValue >> 9;
    }
    return storedValue;
}

// Create lookup
const nameMap = new Map();
for (const rec of records) {
    const pcmt = getPCMT(rec.storedValue);
    if (pcmt >= 1 && pcmt <= 65535) {
        const nameLower = rec.name.toLowerCase();
        if (!nameMap.has(nameLower)) {
            nameMap.set(nameLower, { name: rec.name, pcmt, storedValue: rec.storedValue });
        }
    }
}

const sorted = Array.from(nameMap.values()).sort((a, b) =>
    a.name.toLowerCase().localeCompare(b.name.toLowerCase())
);

console.log(`Valid entries: ${sorted.length}\n`);

// Verification
console.log('=== Verification ===');
const checks = [
    { name: 'Brady', expected: 31748 },
    { name: 'Brees', expected: 47108 },
    { name: 'Abdullah', expected: 4 },
    { name: 'Adams', expected: 19 },
    { name: 'Aaitui', expected: 5657 },
    { name: 'Earl', expected: 1417 },
];

for (const { name, expected } of checks) {
    const entry = nameMap.get(name.toLowerCase());
    if (entry) {
        const status = entry.pcmt === expected ? '✓' : `✗ (got ${entry.pcmt}, stored=${entry.storedValue})`;
        console.log(`  ${name}: ${entry.pcmt} ${status}`);
    } else {
        console.log(`  ${name}: NOT FOUND`);
    }
}

// Check how many use shift vs direct
let shifted = 0, direct = 0;
for (const rec of records) {
    if (rec.storedValue % 512 === 0) shifted++;
    else direct++;
}
console.log(`\nShifted (stored % 512 == 0): ${shifted}`);
console.log(`Direct (stored % 512 != 0): ${direct}`);

// Save CSV
const csv = ['id,name'];
for (const rec of sorted) {
    const safeName = rec.name.includes(',') ? `"${rec.name}"` : rec.name;
    csv.push(`${rec.pcmt},${safeName}`);
}

fs.writeFileSync('data/lookups/commentary_lookup.csv', csv.join('\n'));
console.log(`\nSaved ${sorted.length} entries to commentary_lookup.csv`);

// Sample entries
console.log('\nSample (first 20):');
for (const rec of sorted.slice(0, 20)) {
    console.log(`  ${rec.pcmt}: ${rec.name}`);
}

console.log('\nBrady area:');
const bradyArea = sorted.filter(r => r.name.startsWith('Brad'));
for (const rec of bradyArea) {
    console.log(`  ${rec.pcmt}: ${rec.name}`);
}
