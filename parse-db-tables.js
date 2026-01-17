// Parse DB file tables from streameddata.DB
const fs = require('fs');

const filePath = 'C:\\Users\\tshan\\Downloads\\PAM\\Gamemode\\streameddata.DB';
const buf = fs.readFileSync(filePath);

console.log('File size:', buf.length);

// Parse header
const magic = buf.slice(0, 2).toString();
const version = buf.readUInt16LE(2);
console.log(`Magic: ${magic}, Version: ${version}`);

// Header appears to have table directory starting at offset 0x20
// Each entry: 4 byte name (reversed) + 4 byte offset

console.log('\n=== Table Directory ===');
let offset = 0x20;
const tables = [];

while (offset < 0x200) {
    const nameBytes = buf.slice(offset, offset + 4);
    const name = nameBytes.toString().split('').reverse().join('');
    const tableOffset = buf.readUInt32BE(offset + 4);

    if (tableOffset === 0 || nameBytes[0] === 0) break;

    tables.push({ name, offset: tableOffset, nameRaw: nameBytes.toString() });
    console.log(`${name} (raw: ${nameBytes.toString()}) at offset 0x${tableOffset.toString(16)}`);
    offset += 8;
}

// Find COMN table
const comnEntry = tables.find(t => t.name === 'COMN');
console.log('\n=== COMN Table Analysis ===');
if (comnEntry) {
    console.log(`COMN table at offset 0x${comnEntry.offset.toString(16)}`);

    const tableStart = comnEntry.offset;
    console.log(`\nBytes at table start:`);
    for (let i = 0; i < 128; i += 16) {
        const hex = [];
        const ascii = [];
        for (let j = 0; j < 16; j++) {
            hex.push(buf[tableStart + i + j].toString(16).padStart(2, '0'));
            const c = buf[tableStart + i + j];
            ascii.push((c >= 32 && c <= 126) ? String.fromCharCode(c) : '.');
        }
        console.log(`${(tableStart + i).toString(16).padStart(6, '0')}: ${hex.join(' ')}  ${ascii.join('')}`);
    }

    // Try to understand the record structure
    // Looking at the screenshot, we have PLNA (name) and PCMT (id)
    // The table header likely has: record count, field count, field definitions, then data

    // Read potential table header
    const recordCount = buf.readUInt32BE(tableStart);
    const recordCount2 = buf.readUInt32LE(tableStart);
    console.log(`\nPotential record count (BE): ${recordCount}`);
    console.log(`Potential record count (LE): ${recordCount2}`);

    // Skip to find the first name "Aaitui"
    const aaitui = buf.indexOf('Aaitui');
    if (aaitui !== -1) {
        console.log(`\nFound "Aaitui" at offset 0x${aaitui.toString(16)}`);
        console.log('Context around Aaitui:');
        const start = Math.max(0, aaitui - 32);
        for (let i = start; i < aaitui + 48; i += 16) {
            const hex = [];
            const ascii = [];
            for (let j = 0; j < 16 && i + j < buf.length; j++) {
                hex.push(buf[i + j].toString(16).padStart(2, '0'));
                const c = buf[i + j];
                ascii.push((c >= 32 && c <= 126) ? String.fromCharCode(c) : '.');
            }
            console.log(`${i.toString(16).padStart(6, '0')}: ${hex.join(' ')}  ${ascii.join('')}`);
        }

        // The value after the name (at offset 20 from name start based on 20-byte name field)
        const valueOffset = aaitui + 20;
        console.log(`\nValue bytes at offset 0x${valueOffset.toString(16)}:`);
        console.log(`  4 bytes BE: ${buf.readUInt32BE(valueOffset)}`);
        console.log(`  4 bytes LE: ${buf.readUInt32LE(valueOffset)}`);
        console.log(`  2 bytes BE: ${buf.readUInt16BE(valueOffset)}`);
        console.log(`  2 bytes LE: ${buf.readUInt16LE(valueOffset)}`);
        console.log(`  2 bytes at +2 BE: ${buf.readUInt16BE(valueOffset + 2)}`);
        console.log(`  2 bytes at +2 LE: ${buf.readUInt16LE(valueOffset + 2)}`);

        // Target value for Aaitui should be 5657
        console.log(`\nTarget: 5657 (0x${(5657).toString(16)})`);

        // Search for 5657 near Aaitui
        console.log('\nSearching for value 5657 near Aaitui...');
        const target = 5657;
        for (let i = aaitui - 32; i < aaitui + 64; i++) {
            if (buf.readUInt16BE(i) === target) {
                console.log(`  Found as 16-bit BE at offset 0x${i.toString(16)}`);
            }
            if (buf.readUInt16LE(i) === target) {
                console.log(`  Found as 16-bit LE at offset 0x${i.toString(16)}`);
            }
        }
    }
}

// Also look for Earl and its value 1417
console.log('\n\n=== Searching for Earl ===');
const earl = buf.indexOf('Earl');
if (earl !== -1) {
    console.log(`Found "Earl" at offset 0x${earl.toString(16)}`);
    console.log('Context:');
    const start = Math.max(0, earl - 16);
    for (let i = start; i < earl + 48; i += 16) {
        const hex = [];
        const ascii = [];
        for (let j = 0; j < 16 && i + j < buf.length; j++) {
            hex.push(buf[i + j].toString(16).padStart(2, '0'));
            const c = buf[i + j];
            ascii.push((c >= 32 && c <= 126) ? String.fromCharCode(c) : '.');
        }
        console.log(`${i.toString(16).padStart(6, '0')}: ${hex.join(' ')}  ${ascii.join('')}`);
    }

    // Search for 1417 near Earl
    console.log('\nSearching for value 1417 near Earl...');
    for (let i = earl - 32; i < earl + 64; i++) {
        if (buf.readUInt16BE(i) === 1417) {
            console.log(`  Found 1417 as 16-bit BE at offset 0x${i.toString(16)}`);
        }
        if (buf.readUInt16LE(i) === 1417) {
            console.log(`  Found 1417 as 16-bit LE at offset 0x${i.toString(16)}`);
        }
    }
}

// Let's look for Brady with value 31748
console.log('\n\n=== Searching for Brady ===');
const brady = buf.indexOf('Brady');
if (brady !== -1) {
    console.log(`Found "Brady" at offset 0x${brady.toString(16)}`);
    console.log('Context:');
    const start = Math.max(0, brady - 16);
    for (let i = start; i < brady + 48; i += 16) {
        const hex = [];
        const ascii = [];
        for (let j = 0; j < 16 && i + j < buf.length; j++) {
            hex.push(buf[i + j].toString(16).padStart(2, '0'));
            const c = buf[i + j];
            ascii.push((c >= 32 && c <= 126) ? String.fromCharCode(c) : '.');
        }
        console.log(`${i.toString(16).padStart(6, '0')}: ${hex.join(' ')}  ${ascii.join('')}`);
    }

    // Search for 31748 near Brady
    console.log('\nSearching for value 31748 near Brady...');
    for (let i = brady - 32; i < brady + 64; i++) {
        if (buf.readUInt16BE(i) === 31748) {
            console.log(`  Found 31748 as 16-bit BE at offset 0x${i.toString(16)}`);
        }
        if (buf.readUInt16LE(i) === 31748) {
            console.log(`  Found 31748 as 16-bit LE at offset 0x${i.toString(16)}`);
        }
    }
}
