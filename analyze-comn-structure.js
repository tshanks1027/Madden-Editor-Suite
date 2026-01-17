// Analyze full COMN table structure
const fs = require('fs');

const filePath = 'C:\\Users\\tshan\\Downloads\\PAM\\Gamemode\\streameddata.DB';
const buf = fs.readFileSync(filePath);

// COMN table starts at 0x1f120
// TMCP subtable header at 0x1f318
// TMCP data starts at 0x1f320

const comnStart = 0x1f120;
const tmcpHeader = 0x1f318;
const tmcpData = 0x1f320;
const comnEnd = 0x4ca08; // CONF table starts here

console.log('=== COMN Table Structure Analysis ===\n');

// Count names by first letter in the entire COMN table
const letterCounts = {};
let currentOffset = comnStart;
let recordCount = 0;

// Look for the TMCP header value
console.log('TMCP header bytes:');
console.log(`  At 0x${tmcpHeader.toString(16)}: ${buf.slice(tmcpHeader, tmcpHeader + 8).toString('hex')}`);
const tmcpRecordCount = buf.readUInt32BE(tmcpHeader + 4);
console.log(`  Header value (BE): ${tmcpRecordCount}`);

// Find where TMCP ends and regular records begin
console.log('\n=== Scanning for table structure changes ===');

// Look for 4-char table markers in the COMN region
const tableMarkers = [];
for (let i = comnStart; i < comnEnd - 4; i++) {
    const bytes = buf.slice(i, i + 4);
    // Check if looks like a 4-char uppercase name
    if (bytes[0] >= 0x41 && bytes[0] <= 0x5A &&
        bytes[1] >= 0x41 && bytes[1] <= 0x5A &&
        bytes[2] >= 0x41 && bytes[2] <= 0x5A &&
        bytes[3] >= 0x41 && bytes[3] <= 0x5A) {
        const name = bytes.toString();
        // Check if followed by what looks like a count or header
        const nextBytes = buf.readUInt32BE(i + 4);
        if (nextBytes <= 10000) { // Reasonable count
            tableMarkers.push({ offset: i, name, value: nextBytes });
        }
    }
}

// Deduplicate and show unique markers
const seen = new Set();
console.log('\nPotential subtable headers in COMN region:');
for (const m of tableMarkers) {
    const key = `${m.name}@${m.offset}`;
    if (!seen.has(key) && !m.name.match(/^[A-Z][a-z]/)) { // Skip proper names
        seen.add(key);
        if (m.offset < 0x30000) { // Show only first portion
            console.log(`  ${m.name} at 0x${m.offset.toString(16)}, value=${m.value}`);
        }
    }
}

// Now let's examine specific names and their values
console.log('\n\n=== Examining specific records ===');

const namesToCheck = [
    { name: 'Aaitui', expectedPcmt: 5657 },
    { name: 'Aaron', expectedPcmt: 7553 },
    { name: 'Abdullah', expectedPcmt: 4 },
    { name: 'Adams', expectedPcmt: 19 },
    { name: 'Brady', expectedPcmt: 31748 },
    { name: 'Brees', expectedPcmt: 47108 },
    { name: 'Earl', expectedPcmt: 1417 },
];

for (const { name, expectedPcmt } of namesToCheck) {
    // Find all occurrences of this name
    let searchOffset = 0;
    const occurrences = [];
    while (true) {
        const idx = buf.indexOf(name, searchOffset);
        if (idx === -1 || idx >= buf.length) break;
        occurrences.push(idx);
        searchOffset = idx + 1;
    }

    console.log(`\n${name} (expected PCMT: ${expectedPcmt}):`);
    for (const offset of occurrences.slice(0, 3)) { // Show up to 3 occurrences
        console.log(`  At 0x${offset.toString(16)}:`);

        // Check value at +20 (after 20-byte name field)
        const value20 = buf.readUInt32LE(offset + 20);
        const value20BE = buf.readUInt32BE(offset + 20);
        console.log(`    Value at +20: ${value20} (LE), ${value20BE} (BE)`);

        // Check value at -4 (before name, in case structure is [value][name])
        if (offset >= 4) {
            const valueBefore = buf.readUInt32LE(offset - 4);
            const valueBeforeBE = buf.readUInt32BE(offset - 4);
            console.log(`    Value at -4: ${valueBefore} (LE), ${valueBeforeBE} (BE)`);
        }

        // Check if this is in TMCP region
        if (offset >= tmcpData && offset < tmcpData + 10000) {
            console.log(`    (In TMCP region)`);
        }

        // Check if value matches expected
        if (value20 === expectedPcmt) {
            console.log(`    >>> MATCHES expected at +20!`);
        }
    }
}

// Let's also try to understand the TMCP record format
console.log('\n\n=== First 10 TMCP records ===');
for (let i = 0; i < 10; i++) {
    const recordOffset = tmcpData + i * 24;
    const name = buf.slice(recordOffset, recordOffset + 20).toString().replace(/\0/g, '');
    const storedValue = buf.readUInt32LE(recordOffset + 20);
    const storedValueBE = buf.readUInt32BE(recordOffset + 20);
    console.log(`  ${i}: "${name}" -> stored: ${storedValue} (LE) / ${storedValueBE} (BE)`);
}

// Compare with first 10 records AFTER TMCP ends (at Brady's location)
console.log('\n=== First 10 records around Brady (non-TMCP region) ===');
const bradyOffset = 0x23d18;
// Assume Brady is at offset +20 from record start
const firstNonTmcpRecord = bradyOffset - 20 - (4 * 24); // Go back 4 records
for (let i = 0; i < 10; i++) {
    const recordOffset = firstNonTmcpRecord + i * 24;
    if (recordOffset < buf.length - 24) {
        const name = buf.slice(recordOffset + 4, recordOffset + 24).toString().replace(/\0/g, '');
        const storedValue = buf.readUInt32LE(recordOffset);
        console.log(`  ${i}: "${name.slice(0, 15)}" -> stored: ${storedValue}`);
    }
}

// Actually let's try structure: [4-byte value][20-byte name]
console.log('\n=== Try [value][name] structure around Brady ===');
for (let i = -3; i <= 3; i++) {
    const recordOffset = bradyOffset + i * 24;
    if (recordOffset >= 4 && recordOffset < buf.length - 20) {
        const storedValue = buf.readUInt32LE(recordOffset - 4);
        const name = buf.slice(recordOffset, recordOffset + 20).toString().replace(/\0/g, '');
        console.log(`  offset 0x${recordOffset.toString(16)}: "${name.slice(0, 15)}" <- value: ${storedValue}`);
    }
}
