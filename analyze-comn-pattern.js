// Analyze pattern of COMN values - check if shift is needed based on position
const fs = require('fs');

const filePath = 'C:\\Users\\tshan\\Downloads\\PAM\\Gamemode\\streameddata.DB';
const buf = fs.readFileSync(filePath);

const BRADY_OFFSET = 0x23d18;
const RECORD_SIZE = 24;
const comnStart = 0x1f120;
const comnEnd = 0x4ca08;

// Extract all records
const records = [];
let offset = comnStart + (comnStart % 24 === 0 ? 0 : 24 - (comnStart % 24));

while (offset < comnEnd - RECORD_SIZE) {
    const nameBytes = buf.slice(offset, offset + 20);
    const value = buf.readUInt32LE(offset + 20);
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
        if (valid && name.length >= 2 && value > 0) {
            records.push({ name, value, offset });
        }
    }
    offset += RECORD_SIZE;
}

console.log(`Total records: ${records.length}\n`);

// Find the boundary where values change from needing shift to being direct
console.log('=== Analyzing value patterns by first letter ===\n');

const letterStats = {};
for (const rec of records) {
    const letter = rec.name[0];
    if (!letterStats[letter]) {
        letterStats[letter] = {
            count: 0,
            minVal: Infinity,
            maxVal: 0,
            avgVal: 0,
            samples: []
        };
    }
    const stat = letterStats[letter];
    stat.count++;
    stat.minVal = Math.min(stat.minVal, rec.value);
    stat.maxVal = Math.max(stat.maxVal, rec.value);
    stat.avgVal += rec.value;
    if (stat.samples.length < 5) stat.samples.push({ name: rec.name, value: rec.value });
}

for (const letter of Object.keys(letterStats).sort()) {
    const stat = letterStats[letter];
    stat.avgVal = Math.round(stat.avgVal / stat.count);
    const needsShift = stat.avgVal > 10000;
    console.log(`${letter}: count=${stat.count}, min=${stat.minVal}, max=${stat.maxVal}, avg=${stat.avgVal} ${needsShift ? '(likely needs >>9)' : ''}`);
}

// Check specific examples from each letter to verify
console.log('\n=== Checking if shift pattern is consistent ===');

// For A-names, check if >> 9 gives reasonable values
console.log('\nA-names (first 10):');
const aNames = records.filter(r => r.name[0] === 'A').slice(0, 10);
for (const rec of aNames) {
    const shifted = rec.value >> 9;
    console.log(`  ${rec.name.padEnd(20)} stored=${rec.value.toString().padStart(6)} >>9=${shifted.toString().padStart(4)}`);
}

// For B-names (where Brady is), check if direct values are used
console.log('\nB-names (around Brady):');
const bradyRec = records.find(r => r.name === 'Brady');
const bradyIdx = records.indexOf(bradyRec);
if (bradyIdx >= 0) {
    for (let i = bradyIdx - 2; i <= bradyIdx + 2; i++) {
        if (i >= 0 && i < records.length) {
            const rec = records[i];
            console.log(`  ${rec.name.padEnd(20)} stored=${rec.value.toString().padStart(6)} (expected direct PCMT)`);
        }
    }
}

// Let's check where the transition happens
console.log('\n=== Finding transition point ===');

// Look for where values suddenly become smaller (direct PCMT)
let lastLargeValueIdx = -1;
for (let i = 0; i < records.length; i++) {
    if (records[i].value > 65535) {
        lastLargeValueIdx = i;
    }
}

console.log(`Last record with value > 65535: index ${lastLargeValueIdx}`);
if (lastLargeValueIdx >= 0) {
    console.log(`  Name: ${records[lastLargeValueIdx].name}, value: ${records[lastLargeValueIdx].value}`);
    console.log(`  Offset: 0x${records[lastLargeValueIdx].offset.toString(16)}`);
    if (lastLargeValueIdx + 1 < records.length) {
        const next = records[lastLargeValueIdx + 1];
        console.log(`  Next record: ${next.name}, value: ${next.value}, offset: 0x${next.offset.toString(16)}`);
    }
}

// Check distribution of values
console.log('\n=== Value distribution ===');
let under100 = 0, under1000 = 0, under10000 = 0, under65536 = 0, over65536 = 0;
for (const rec of records) {
    if (rec.value < 100) under100++;
    else if (rec.value < 1000) under1000++;
    else if (rec.value < 10000) under10000++;
    else if (rec.value < 65536) under65536++;
    else over65536++;
}
console.log(`  < 100: ${under100}`);
console.log(`  100-999: ${under1000}`);
console.log(`  1000-9999: ${under10000}`);
console.log(`  10000-65535: ${under65536}`);
console.log(`  > 65535: ${over65536}`);

// The key question: can we reliably identify which records need >> 9?
// Hypothesis: if stored value > 65535, use >> 9
console.log('\n=== Creating lookup with transformation ===');

const lookup = new Map();
for (const rec of records) {
    // Apply shift only if value is too large
    let pcmt = rec.value;
    if (pcmt > 65535) {
        pcmt = pcmt >> 9;
    }

    const nameLower = rec.name.toLowerCase();
    if (!lookup.has(nameLower)) {
        lookup.set(nameLower, { name: rec.name, pcmt });
    }
}

// Check known values with transformation
console.log('\nKnown values after transformation:');
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
    const entry = lookup.get(name.toLowerCase());
    if (entry) {
        const match = entry.pcmt === expected ? '✓' : `✗ (got ${entry.pcmt})`;
        console.log(`  ${name}: PCMT=${entry.pcmt} ${match}`);
    } else {
        console.log(`  ${name}: NOT FOUND`);
    }
}

// The transformation didn't fix Aaitui and Aaron because their values are under 65535
// Let me check what those specific values are
console.log('\n=== Problematic records detail ===');
for (const { name, expected } of knownNames) {
    const rec = records.find(r => r.name.toLowerCase() === name.toLowerCase());
    if (rec) {
        console.log(`${name}: stored=${rec.value}, >>9=${rec.value >> 9}, expected=${expected}`);
        // Is there any shift that would work?
        for (let shift = 0; shift <= 12; shift++) {
            if ((rec.value >> shift) === expected) {
                console.log(`  >> ${shift} = ${expected} ✓`);
            }
        }
        if (rec.value === expected) console.log('  direct ✓');
    }
}
