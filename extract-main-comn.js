// Extract main COMN records (skip TMCP subtable, extract records with correct PCMT at +20)
const fs = require('fs');

const filePath = 'C:\\Users\\tshan\\Downloads\\PAM\\Gamemode\\streameddata.DB';
const buf = fs.readFileSync(filePath);

// COMN table range
const comnEnd = 0x4ca08;
const RECORD_SIZE = 24;

// Start after TMCP by finding records where names make sense
// We know Brady is at 0x23d18, so scan from there backwards to find start

console.log('=== Scanning for main COMN records (with direct PCMT values) ===\n');

// Find the start of main player names by scanning for valid 24-byte records
// where the value at +20 is in reasonable PCMT range (1-65535)

const validRecords = [];
let currentOffset = 0x20000; // Start scanning from around here

while (currentOffset < comnEnd - RECORD_SIZE) {
    const nameBytes = buf.slice(currentOffset, currentOffset + 20);
    const value = buf.readUInt32LE(currentOffset + 20);

    // Check if this is a valid name (starts with uppercase A-Z, contains only printable ASCII and nulls)
    const firstChar = nameBytes[0];
    let isValidName = firstChar >= 65 && firstChar <= 90; // A-Z

    if (isValidName) {
        // Check rest of name is printable or null
        for (let i = 1; i < 20; i++) {
            const c = nameBytes[i];
            if (c !== 0 && (c < 32 || c > 126)) {
                isValidName = false;
                break;
            }
        }
    }

    // Check if value is in PCMT range (we expect 1-65535)
    const isValidPcmt = value >= 1 && value <= 65535;

    if (isValidName && isValidPcmt) {
        const name = nameBytes.toString().replace(/\0/g, '');
        validRecords.push({ name, pcmt: value, offset: currentOffset });
    }

    currentOffset += RECORD_SIZE;
}

console.log(`Found ${validRecords.length} valid records\n`);

// Show some sample records
console.log('Sample records:');
for (const rec of validRecords.slice(0, 20)) {
    console.log(`  ${rec.name.padEnd(20)} PCMT=${rec.pcmt}`);
}

// Find specific names
console.log('\n=== Looking for known names ===');
const knownNames = ['Brady', 'Brees', 'Aaitui', 'Aaron', 'Abdullah', 'Adams', 'Earl'];
for (const name of knownNames) {
    const found = validRecords.filter(r => r.name.toLowerCase() === name.toLowerCase());
    if (found.length > 0) {
        for (const rec of found) {
            console.log(`  ${rec.name}: PCMT=${rec.pcmt} at 0x${rec.offset.toString(16)}`);
        }
    } else {
        console.log(`  ${name}: NOT FOUND in valid records`);
    }
}

// Now extract ALL valid records and create a proper lookup
console.log('\n=== Creating commentary_lookup.csv ===');

// Deduplicate by name (keep first occurrence)
const nameMap = new Map();
for (const rec of validRecords) {
    const nameLower = rec.name.toLowerCase();
    if (!nameMap.has(nameLower) || rec.pcmt < nameMap.get(nameLower).pcmt) {
        nameMap.set(nameLower, rec);
    }
}

// Sort by name
const sortedRecords = Array.from(nameMap.values()).sort((a, b) =>
    a.name.toLowerCase().localeCompare(b.name.toLowerCase())
);

console.log(`Unique names: ${sortedRecords.length}`);

// Save to CSV
const csv = ['id,name'];
for (const rec of sortedRecords) {
    // Escape name if it contains comma
    const safeName = rec.name.includes(',') ? `"${rec.name}"` : rec.name;
    csv.push(`${rec.pcmt},${safeName}`);
}

fs.writeFileSync('data/lookups/commentary_lookup.csv', csv.join('\n'));
console.log('Saved to data/lookups/commentary_lookup.csv');

// Show first and last few entries
console.log('\nFirst 10 entries:');
for (const rec of sortedRecords.slice(0, 10)) {
    console.log(`  ${rec.pcmt}: ${rec.name}`);
}

console.log('\nLast 10 entries:');
for (const rec of sortedRecords.slice(-10)) {
    console.log(`  ${rec.pcmt}: ${rec.name}`);
}
