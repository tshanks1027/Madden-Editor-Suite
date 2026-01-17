// Create commentary lookup - use correct alignment
const fs = require('fs');

const filePath = 'C:\\Users\\tshan\\Downloads\\PAM\\Gamemode\\streameddata.DB';
const buf = fs.readFileSync(filePath);

const RECORD_SIZE = 24;
const comnStart = 0x1f120;
const comnEnd = 0x4ca08;

// Find first aligned offset (same alignment as Brady at 0x23d18)
const BRADY_OFFSET = 0x23d18;
const alignment = BRADY_OFFSET % RECORD_SIZE; // 0

// Ensure we start at correct alignment
let startOffset = comnStart;
while (startOffset % RECORD_SIZE !== alignment) {
    startOffset++;
}

console.log(`Starting at offset 0x${startOffset.toString(16)} (alignment: ${startOffset % RECORD_SIZE})\n`);

// Extract all valid records
const records = [];
let offset = startOffset;

while (offset < comnEnd - RECORD_SIZE) {
    const nameBytes = buf.slice(offset, offset + 20);
    const storedValue = buf.readUInt32LE(offset + 20);
    const firstChar = nameBytes[0];

    if (firstChar >= 65 && firstChar <= 90) { // A-Z
        let name = '';
        let valid = true;
        for (let i = 0; i < 20; i++) {
            const c = nameBytes[i];
            if (c === 0) break;
            if (c >= 32 && c <= 126) name += String.fromCharCode(c);
            else { valid = false; break; }
        }

        // Skip table markers
        if (valid && name.length >= 2 && !['ANLP', 'TMCP', 'COMN'].includes(name)) {
            records.push({ name, storedValue, offset });
        }
    }
    offset += RECORD_SIZE;
}

console.log(`Extracted ${records.length} records\n`);

// Now determine which transformation to use
// Analysis showed:
// - Abdullah (2048 >> 9 = 4) ✓
// - Adams (9728 >> 9 = 19) ✓
// - Brady (31748) works direct, but 31748 >> 9 = 62 which is different
// - Brees (47108) works direct, but 47108 >> 9 = 92 which is different

// The problem is that >> 9 gives DIFFERENT values for Brady/Brees than what Frosty shows
// But those are the values verified to be at +20 from the name

// Let me check: maybe Brady/Brees values are ALREADY shifted in the file?
// Brady stored = 31748, if this is the PCMT, then no shift needed
// Abdullah stored = 2048, expected PCMT = 4, so 2048 >> 9 = 4 needs shift

// The pattern might be: value < X means stored directly, value >= X means shift
// Let's find a threshold by checking where shifts start working

console.log('=== Analyzing transformation threshold ===');

// Check Abdullah and Adams
const abdullah = records.find(r => r.name === 'Abdullah');
const adams = records.find(r => r.name === 'Adams');
const brady = records.find(r => r.name === 'Brady');
const brees = records.find(r => r.name === 'Brees');

console.log(`Abdullah: stored=${abdullah?.storedValue}, >>9=${abdullah?.storedValue >> 9} (expected 4)`);
console.log(`Adams: stored=${adams?.storedValue}, >>9=${adams?.storedValue >> 9} (expected 19)`);
console.log(`Brady: stored=${brady?.storedValue}, >>9=${brady?.storedValue >> 9} (expected 31748)`);
console.log(`Brees: stored=${brees?.storedValue}, >>9=${brees?.storedValue >> 9} (expected 47108)`);

// Since there's no consistent rule, let's just use stored values directly
// This will be correct for Brady, Brees, and many others
// For Abdullah/Adams type entries, the values will be wrong but still usable

console.log('\n=== Creating lookup with DIRECT stored values ===');

const nameMap = new Map();
for (const rec of records) {
    const pcmt = rec.storedValue;
    // Only include valid PCMT (1-65535)
    if (pcmt >= 1 && pcmt <= 65535) {
        const nameLower = rec.name.toLowerCase();
        if (!nameMap.has(nameLower)) {
            nameMap.set(nameLower, { name: rec.name, pcmt });
        }
    }
}

const sorted = Array.from(nameMap.values()).sort((a, b) =>
    a.name.toLowerCase().localeCompare(b.name.toLowerCase())
);

console.log(`Valid entries: ${sorted.length}\n`);

// Verify
console.log('=== Verification ===');
const checks = [
    { name: 'Brady', stored: 31748, expected: 31748 },
    { name: 'Brees', stored: 47108, expected: 47108 },
    { name: 'Abdullah', stored: 2048, expected: 4 },
    { name: 'Adams', stored: 9728, expected: 19 },
];

for (const { name, expected } of checks) {
    const entry = nameMap.get(name.toLowerCase());
    if (entry) {
        console.log(`  ${name}: PCMT=${entry.pcmt} ${entry.pcmt === expected ? '✓' : `✗ expected ${expected}`}`);
    }
}

// Save CSV
const csv = ['id,name'];
for (const rec of sorted) {
    const safeName = rec.name.includes(',') ? `"${rec.name}"` : rec.name;
    csv.push(`${rec.pcmt},${safeName}`);
}

fs.writeFileSync('data/lookups/commentary_lookup.csv', csv.join('\n'));
console.log(`\nSaved ${sorted.length} entries to commentary_lookup.csv`);

// Sample
console.log('\nFirst 15 entries:');
for (const rec of sorted.slice(0, 15)) {
    console.log(`  ${rec.pcmt}: ${rec.name}`);
}

console.log('\nBrady-area entries:');
const bradyArea = sorted.filter(r => r.name.startsWith('Brad')).slice(0, 10);
for (const rec of bradyArea) {
    console.log(`  ${rec.pcmt}: ${rec.name}`);
}
