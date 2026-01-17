// Create commentary lookup with hybrid formula based on table position
// TMCP region (early): uint16BE / 2
// Main region (later): uint16LE directly
const fs = require('fs');

const filePath = 'C:\\Users\\tshan\\Downloads\\PAM\\Gamemode\\streameddata.DB';
const buf = fs.readFileSync(filePath);

const RECORD_SIZE = 24;
const comnStart = 0x1f120;
const comnEnd = 0x4ca08;

// TMCP subtable seems to end before the main player list
// Let me find where encoding changes by checking both interpretations

// Find first aligned offset
let startOffset = comnStart;
while (startOffset % RECORD_SIZE !== 0) {
    startOffset++;
}

console.log(`Starting at offset 0x${startOffset.toString(16)}\n`);

// Extract all valid records with BOTH encodings
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
            const valueOffset = offset + 20;

            // Calculate both possible PCMT values
            const rawBE = buf.readUInt16BE(valueOffset);
            const rawLE = buf.readUInt16LE(valueOffset);
            const pcmtFromBE = Math.floor(rawBE / 2);
            const pcmtFromLE = rawLE;

            records.push({
                name,
                offset,
                pcmtFromBE,
                pcmtFromLE,
                rawBE,
                rawLE
            });
        }
    }
    offset += RECORD_SIZE;
}

console.log(`Extracted ${records.length} records\n`);

// Known values from Frosty to determine encoding rule
const frostyValues = {
    'aaitui': 5657,
    'aaron': 7553,
    'abdullah': 4,
    'adams': 19,
    'brady': 31748,
    'brees': 47108,
    'abram': 7281,
    'abbot': 6693,
};

// Check which encoding works for each known name
console.log('=== Determining encoding rule ===');
for (const [name, expected] of Object.entries(frostyValues)) {
    const rec = records.find(r => r.name.toLowerCase() === name);
    if (rec) {
        const matchesBE = rec.pcmtFromBE === expected;
        const matchesLE = rec.pcmtFromLE === expected;
        console.log(`  ${name}: BE/2=${rec.pcmtFromBE} ${matchesBE ? '✓' : ''}, LE=${rec.pcmtFromLE} ${matchesLE ? '✓' : ''}, offset=0x${rec.offset.toString(16)}`);
    }
}

// Find the boundary where encoding changes
// From looking at Brady vs Aaitui offsets
const bradyRec = records.find(r => r.name === 'Brady');
const abanikandaRec = records.find(r => r.name === 'Abanikanda');

console.log(`\nBrady offset: 0x${bradyRec?.offset.toString(16)}`);
console.log(`Abanikanda offset: 0x${abanikandaRec?.offset.toString(16)}`);

// The pattern seems to be:
// - Early records (TMCP area): use BE/2
// - Later records: use LE directly
//
// Let's find the transition by looking at where BE/2 stops giving reasonable PCMTs
// or where records start having LE values that look like valid PCMTs

// Actually, let me check if the encoding is based on record position
// TMCP appears to be a subtable from ~0x1f320 with ~200 records
// After that, main records use direct LE

// Check a few B-names around Brady
console.log('\n=== B-name records ===');
const bNames = records.filter(r => r.name.startsWith('B')).slice(0, 10);
for (const rec of bNames) {
    console.log(`  ${rec.name.padEnd(15)}: offset=0x${rec.offset.toString(16)}, BE/2=${rec.pcmtFromBE}, LE=${rec.pcmtFromLE}`);
}

// Find the first B-name
const firstBname = records.find(r => r.name.startsWith('B'));
console.log(`\nFirst B-name: ${firstBname?.name} at 0x${firstBname?.offset.toString(16)}`);

// Try a simple rule: if offset < X, use BE/2; else use LE
// X appears to be somewhere after A-names end

// Find last A-name
const aNames = records.filter(r => r.name.startsWith('A'));
const lastAname = aNames[aNames.length - 1];
console.log(`Last A-name: ${lastAname?.name} at 0x${lastAname?.offset.toString(16)}`);

// The boundary might be at the last A-name + 24
const boundary = (lastAname?.offset || 0) + RECORD_SIZE;
console.log(`Proposed boundary: 0x${boundary.toString(16)}`);

// Apply hybrid rule
console.log('\n=== Applying hybrid encoding ===');
const finalRecords = records.map(rec => {
    // Rule: if offset < boundary (in TMCP region), use BE/2
    // Otherwise use LE
    const pcmt = rec.offset < boundary ? rec.pcmtFromBE : rec.pcmtFromLE;
    return { name: rec.name, pcmt, offset: rec.offset };
});

// Verify
console.log('\n=== Verification ===');
const checks = [
    { name: 'Aaitui', expected: 5657 },
    { name: 'Aaron', expected: 7553 },
    { name: 'Abdullah', expected: 4 },
    { name: 'Adams', expected: 19 },
    { name: 'Abram', expected: 7281 },
    { name: 'Brady', expected: 31748 },
    { name: 'Brees', expected: 47108 },
];

let matches = 0;
for (const { name, expected } of checks) {
    const rec = finalRecords.find(r => r.name.toLowerCase() === name.toLowerCase());
    if (rec) {
        const status = rec.pcmt === expected ? '✓' : `✗ (got ${rec.pcmt})`;
        if (rec.pcmt === expected) matches++;
        console.log(`  ${name}: ${rec.pcmt} ${status}`);
    }
}
console.log(`Matched: ${matches}/${checks.length}`);

// Save if good
if (matches >= 6) {
    const nameMap = new Map();
    for (const rec of finalRecords) {
        const nameLower = rec.name.toLowerCase();
        if (!nameMap.has(nameLower) && rec.pcmt >= 1 && rec.pcmt <= 65535) {
            nameMap.set(nameLower, rec);
        }
    }

    const sorted = Array.from(nameMap.values()).sort((a, b) =>
        a.name.toLowerCase().localeCompare(b.name.toLowerCase())
    );

    const csv = ['id,name'];
    for (const rec of sorted) {
        const safeName = rec.name.includes(',') ? `"${rec.name}"` : rec.name;
        csv.push(`${rec.pcmt},${safeName}`);
    }

    fs.writeFileSync('data/lookups/commentary_lookup.csv', csv.join('\n'));
    console.log(`\nSaved ${sorted.length} entries to commentary_lookup.csv`);
}
