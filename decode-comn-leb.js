// Try decoding COMN values using Modified LEB encoding
const fs = require('fs');
const utilService = require('./src/main/lib/services/utilService');

const filePath = 'C:\\Users\\tshan\\Downloads\\PAM\\Gamemode\\streameddata.DB';
const buf = fs.readFileSync(filePath);

// Known name offsets and expected values from Frosty
const testCases = [
    { name: 'Aaitui', offset: 0x1f320, expected: 5657 },
    { name: 'Aaron', offset: 0x1f338, expected: 7553 },
    { name: 'Abdullah', offset: 0x1f3c8, expected: 4 },
    { name: 'Adams', offset: 0x1f5a8, expected: 19 },
];

console.log('=== Trying LEB decoding ===\n');

for (const tc of testCases) {
    console.log(`${tc.name} at 0x${tc.offset.toString(16)} (expected: ${tc.expected}):`);

    // Value starts at offset + 20
    const valueOffset = tc.offset + 20;

    // Read raw bytes
    const raw1 = buf.slice(valueOffset, valueOffset + 1);
    const raw2 = buf.slice(valueOffset, valueOffset + 2);
    const raw3 = buf.slice(valueOffset, valueOffset + 3);
    const raw4 = buf.slice(valueOffset, valueOffset + 4);

    console.log(`  Raw bytes: ${raw4.toString('hex')}`);
    console.log(`  uint32LE: ${buf.readUInt32LE(valueOffset)}`);
    console.log(`  uint16LE: ${buf.readUInt16LE(valueOffset)}`);
    console.log(`  uint16BE: ${buf.readUInt16BE(valueOffset)}`);

    // Try LEB decoding with different byte lengths
    try {
        const leb1 = utilService.readModifiedLebCompressedInteger(raw1);
        console.log(`  LEB (1 byte): ${leb1}`);
    } catch (e) {}

    try {
        const leb2 = utilService.readModifiedLebCompressedInteger(raw2);
        console.log(`  LEB (2 bytes): ${leb2}`);
    } catch (e) {}

    try {
        const leb3 = utilService.readModifiedLebCompressedInteger(raw3);
        console.log(`  LEB (3 bytes): ${leb3}`);
    } catch (e) {}

    try {
        const leb4 = utilService.readModifiedLebCompressedInteger(raw4);
        console.log(`  LEB (4 bytes): ${leb4}`);
    } catch (e) {}

    // Try reading value BEFORE the name (in case structure is [value][name])
    const beforeOffset = tc.offset - 4;
    const rawBefore = buf.slice(beforeOffset, beforeOffset + 4);
    console.log(`  Before name (${rawBefore.toString('hex')}): uint32LE=${buf.readUInt32LE(beforeOffset)}`);

    // Try byte swapping
    const swapped = Buffer.from([raw4[1], raw4[0], raw4[3], raw4[2]]);
    console.log(`  Byte-swapped uint16s: ${swapped.readUInt16LE(0)}, ${swapped.readUInt16LE(2)}`);

    console.log('');
}

// Check the exact hex of the COMN region
console.log('\n=== Raw hex around first few records ===');
const startOffset = 0x1f318;
for (let i = 0; i < 10; i++) {
    const offset = startOffset + i * 24;
    const hex = buf.slice(offset, offset + 24).toString('hex');
    const name = buf.slice(offset, offset + 20).toString().replace(/\0/g, '');
    const val = buf.readUInt32LE(offset + 20);
    console.log(`0x${offset.toString(16)}: ${hex}`);
    console.log(`         Name: "${name}", Val: ${val}`);
}
