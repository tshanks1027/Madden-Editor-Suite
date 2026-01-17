// Extract COMN records using Brady's position as alignment anchor
const fs = require('fs');

const filePath = 'C:\\Users\\tshan\\Downloads\\PAM\\Gamemode\\streameddata.DB';
const buf = fs.readFileSync(filePath);

// Brady is at 0x23d18 with PCMT 31748 at +20
const BRADY_OFFSET = 0x23d18;
const RECORD_SIZE = 24;

// COMN table boundaries
const comnStart = 0x1f120;
const comnEnd = 0x4ca08;

console.log('=== Extracting COMN records aligned to Brady position ===\n');

// Calculate alignment: records should align to Brady's position
// Brady offset mod 24 = 0x23d18 mod 24 = ?
console.log(`Brady offset: 0x${BRADY_OFFSET.toString(16)} = ${BRADY_OFFSET}`);
console.log(`Brady offset mod 24: ${BRADY_OFFSET % 24}`);

// Find the first record position in COMN table with same alignment
const alignment = BRADY_OFFSET % 24;
let startOffset = comnStart;
while ((startOffset % 24) !== alignment) {
    startOffset++;
}
console.log(`First aligned offset after COMN start: 0x${startOffset.toString(16)}`);

// Extract records with this alignment
const records = [];
let offset = startOffset;

while (offset < comnEnd - RECORD_SIZE) {
    const nameBytes = buf.slice(offset, offset + 20);
    const value = buf.readUInt32LE(offset + 20);

    // Check if name is valid (starts with A-Z, printable ASCII)
    const firstChar = nameBytes[0];
    let isValidName = firstChar >= 65 && firstChar <= 90;

    if (isValidName) {
        let name = '';
        for (let i = 0; i < 20; i++) {
            const c = nameBytes[i];
            if (c === 0) break;
            if (c >= 32 && c <= 126) {
                name += String.fromCharCode(c);
            } else {
                isValidName = false;
                break;
            }
        }

        if (isValidName && name.length >= 2) {
            // Value should be reasonable PCMT (1-65535)
            if (value >= 1 && value <= 65535) {
                records.push({ name, pcmt: value, offset });
            }
        }
    }

    offset += RECORD_SIZE;
}

console.log(`Found ${records.length} valid records\n`);

// Check known names
console.log('=== Known names check ===');
const knownNames = [
    { name: 'Brady', expected: 31748 },
    { name: 'Brees', expected: 47108 },
    { name: 'Aaitui', expected: 5657 },
    { name: 'Aaron', expected: 7553 },
    { name: 'Abdullah', expected: 4 },
    { name: 'Adams', expected: 19 },
    { name: 'Earl', expected: 1417 },
];

for (const { name, expected } of knownNames) {
    const found = records.find(r => r.name === name);
    if (found) {
        const match = found.pcmt === expected ? '✓' : `✗ (got ${found.pcmt})`;
        console.log(`  ${name}: PCMT=${found.pcmt} at 0x${found.offset.toString(16)} ${match}`);
    } else {
        console.log(`  ${name}: NOT FOUND`);
    }
}

// Sample records
console.log('\n=== Sample records ===');
for (let i = 0; i < Math.min(20, records.length); i++) {
    const rec = records[i];
    console.log(`  ${rec.name.padEnd(20)} PCMT=${rec.pcmt}`);
}

// Look at records around Brady
console.log('\n=== Records around Brady ===');
const bradyIndex = records.findIndex(r => r.name === 'Brady');
if (bradyIndex >= 0) {
    for (let i = Math.max(0, bradyIndex - 3); i <= Math.min(records.length - 1, bradyIndex + 3); i++) {
        const rec = records[i];
        const marker = i === bradyIndex ? ' <--' : '';
        console.log(`  ${rec.name.padEnd(20)} PCMT=${rec.pcmt}${marker}`);
    }
}

// Save all records
if (records.length > 100) {
    console.log('\n=== Saving to CSV ===');
    const csv = ['id,name'];
    for (const rec of records) {
        const safeName = rec.name.includes(',') ? `"${rec.name}"` : rec.name;
        csv.push(`${rec.pcmt},${safeName}`);
    }
    fs.writeFileSync('data/lookups/commentary_lookup.csv', csv.join('\n'));
    console.log(`Saved ${records.length} records to data/lookups/commentary_lookup.csv`);
}
