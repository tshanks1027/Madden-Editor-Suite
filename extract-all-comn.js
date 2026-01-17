// Extract ALL records from COMN table, distinguishing TMCP vs non-TMCP
const fs = require('fs');

const filePath = 'C:\\Users\\tshan\\Downloads\\PAM\\Gamemode\\streameddata.DB';
const buf = fs.readFileSync(filePath);

const comnStart = 0x1f120;
const tmcpData = 0x1f320;
const comnEnd = 0x4ca08;

// Record structure: 20-byte name + 4-byte value
const RECORD_SIZE = 24;

// First, find where TMCP ends by looking for a non-name pattern
// TMCP has 15 in header, but let's verify

console.log('=== Extracting COMN records ===\n');

// Extract TMCP records (starting at 0x1f320)
const tmcpRecords = [];
let offset = tmcpData;
let recordNum = 0;

while (offset < comnEnd - RECORD_SIZE) {
    const nameBytes = buf.slice(offset, offset + 20);
    const name = nameBytes.toString().replace(/\0/g, '');
    const value = buf.readUInt32LE(offset + 20);

    // Check if this still looks like a valid record
    // Name should start with printable ASCII
    if (nameBytes[0] >= 65 && nameBytes[0] <= 90) { // A-Z
        tmcpRecords.push({ name, value, offset, isInTmcp: offset < tmcpData + 10000 });
        recordNum++;
        offset += RECORD_SIZE;
    } else {
        // Not a valid name, might be end of table or different structure
        break;
    }

    if (recordNum > 8000) break; // Safety limit
}

console.log(`Extracted ${tmcpRecords.length} records\n`);

// Show records where the shift formula works vs doesn't
console.log('=== Records where stored >> 9 gives reasonable PCMT (1-9999) ===');
let shiftWorks = 0;
let shiftFails = 0;

for (const rec of tmcpRecords.slice(0, 100)) {
    const shifted = rec.value >> 9;
    const direct = rec.value;

    if (shifted >= 1 && shifted <= 9999) {
        shiftWorks++;
        if (shiftWorks <= 20) {
            console.log(`  ${rec.name}: stored=${rec.value}, shifted=${shifted}`);
        }
    } else if (direct >= 1 && direct <= 9999) {
        // Maybe it's stored directly
    } else {
        shiftFails++;
    }
}

console.log(`\nShift formula works for ${shiftWorks} of first 100 records`);

// Check if stored values in low range (under 10000) might be direct PCMTs
console.log('\n=== Records with stored value < 10000 (possibly direct PCMT) ===');
let directCount = 0;
for (const rec of tmcpRecords.slice(0, 200)) {
    if (rec.value >= 1 && rec.value <= 9999) {
        directCount++;
        if (directCount <= 20) {
            console.log(`  ${rec.name}: value=${rec.value}`);
        }
    }
}
console.log(`\nDirect values < 10000: ${directCount} of first 200 records`);

// Try to find the actual PCMT encoding
// Maybe it's in the high 16 bits vs low 16 bits?
console.log('\n=== Trying different interpretations ===');

for (const rec of tmcpRecords.slice(0, 10)) {
    const stored = rec.value;
    const low16 = stored & 0xFFFF;
    const high16 = (stored >> 16) & 0xFFFF;
    const shifted9 = stored >> 9;
    const shifted8 = stored >> 8;
    const shifted7 = stored >> 7;
    const low13 = stored & 0x1FFF; // 13 bits for values up to 8191
    const low14 = stored & 0x3FFF; // 14 bits for values up to 16383

    console.log(`${rec.name}: stored=${stored}`);
    console.log(`  low16=${low16}, high16=${high16}`);
    console.log(`  >>9=${shifted9}, >>8=${shifted8}, >>7=${shifted7}`);
    console.log(`  low13=${low13}, low14=${low14}`);
    console.log(`  swapped=${((stored & 0xFF) << 8) | ((stored >> 8) & 0xFF)}`);
}

// Save first 500 records to CSV for analysis
console.log('\n=== Saving first 500 records to CSV ===');
const csv = ['name,stored_value,shifted_value,offset'];
for (const rec of tmcpRecords.slice(0, 500)) {
    csv.push(`${rec.name},${rec.value},${rec.value >> 9},0x${rec.offset.toString(16)}`);
}
fs.writeFileSync('comn_records_raw.csv', csv.join('\n'));
console.log('Saved to comn_records_raw.csv');

// Now let's see if maybe the table has TWO different formats
// Check byte pattern at specific boundary
console.log('\n=== Looking for format boundary ===');
for (let i = 0; i < 20; i++) {
    const off = tmcpData + i * RECORD_SIZE + 20; // Value position
    const val = buf.readUInt32LE(off);
    const name = buf.slice(tmcpData + i * RECORD_SIZE, tmcpData + i * RECORD_SIZE + 20).toString().replace(/\0/g, '');
    const shifted = val >> 9;
    console.log(`${i}: ${name.padEnd(15)} val=${val.toString().padStart(6)} shifted=${shifted.toString().padStart(4)}`);
}
