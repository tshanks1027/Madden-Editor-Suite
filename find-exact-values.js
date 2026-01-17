// Search for exact PCMT values shown in Frosty
const fs = require('fs');

const filePath = 'C:\\Users\\tshan\\Downloads\\PAM\\Gamemode\\streameddata.DB';
const buf = fs.readFileSync(filePath);

// Values from Frosty screenshot:
// Aaitui = 5657, Aaron = 7553, Abdullah = 4, Adams = 19, Earl = 1417

const targets = [
    { name: 'Aaitui', value: 5657 },
    { name: 'Aaron', value: 7553 },
    { name: 'Abdullah', value: 4 },
    { name: 'Adams', value: 19 },
    { name: 'Earl', value: 1417 },
    { name: 'Brady', value: 31748 }, // Common name
    { name: 'Brees', value: 47108 }, // Common name
];

console.log('=== Global Search for PCMT Values ===\n');

for (const { name, value } of targets) {
    console.log(`\n${name} = ${value} (0x${value.toString(16)}):`);

    // Find all occurrences of the value
    const found = [];
    for (let i = 0; i < buf.length - 1; i++) {
        if (buf.readUInt16LE(i) === value) {
            found.push({ offset: i, type: '16LE' });
        }
        if (buf.readUInt16BE(i) === value) {
            found.push({ offset: i, type: '16BE' });
        }
    }
    for (let i = 0; i < buf.length - 3; i++) {
        if (buf.readUInt32LE(i) === value) {
            // Only add if not already found as 16-bit
            if (!found.some(f => f.offset === i)) {
                found.push({ offset: i, type: '32LE' });
            }
        }
    }

    if (found.length === 0) {
        console.log('  NOT FOUND in file');
    } else if (found.length > 20) {
        console.log(`  Found ${found.length} occurrences (showing first 20)`);
        found.slice(0, 20).forEach(f => {
            console.log(`    0x${f.offset.toString(16)} (${f.type})`);
        });
    } else {
        found.forEach(f => {
            console.log(`    0x${f.offset.toString(16)} (${f.type})`);
            // Show context
            const start = Math.max(0, f.offset - 24);
            const hex = buf.slice(start, f.offset + 8).toString('hex');
            const ascii = [];
            for (let i = start; i < f.offset + 8 && i < buf.length; i++) {
                const c = buf[i];
                ascii.push((c >= 32 && c <= 126) ? String.fromCharCode(c) : '.');
            }
            console.log(`      Context: ${ascii.join('')}`);
        });
    }

    // Also find the name in file
    const nameOffset = buf.indexOf(name);
    if (nameOffset !== -1) {
        console.log(`  Name "${name}" at 0x${nameOffset.toString(16)}`);

        // Check if any found value is within 32 bytes of the name
        for (const f of found.slice(0, 20)) {
            const distance = Math.abs(f.offset - nameOffset);
            if (distance <= 32) {
                console.log(`    >>> MATCH: value at 0x${f.offset.toString(16)} is ${distance} bytes from name!`);
            }
        }
    }
}

// Now let's analyze the actual structure more carefully
console.log('\n\n=== COMN Table Structure Analysis ===');
const comnOffset = 0x1f120;
const tmcpOffset = 0x1f318;

console.log(`\nCOMN table at 0x${comnOffset.toString(16)}`);
console.log(`TMCP subtable at 0x${tmcpOffset.toString(16)}`);

// Look at TMCP header
console.log('\nTMCP header bytes:');
for (let i = tmcpOffset - 16; i < tmcpOffset + 32; i += 16) {
    const hex = [];
    const ascii = [];
    for (let j = 0; j < 16; j++) {
        hex.push(buf[i + j].toString(16).padStart(2, '0'));
        const c = buf[i + j];
        ascii.push((c >= 32 && c <= 126) ? String.fromCharCode(c) : '.');
    }
    console.log(`${i.toString(16).padStart(6, '0')}: ${hex.join(' ')}  ${ascii.join('')}`);
}

// At 0x1f318: 54 4d 43 50 = "TMCP"
// At 0x1f31c: 00 00 00 0f = 15 (maybe field count or something?)
// Then Aaitui starts at 0x1f320

// Try to understand if there's a separate index or if values are stored elsewhere
console.log('\n\nLooking at what\'s BEFORE the TMCP table (maybe there\'s an index)...');
for (let i = tmcpOffset - 128; i < tmcpOffset; i += 16) {
    const hex = [];
    const ascii = [];
    for (let j = 0; j < 16 && i + j < buf.length; j++) {
        hex.push(buf[i + j].toString(16).padStart(2, '0'));
        const c = buf[i + j];
        ascii.push((c >= 32 && c <= 126) ? String.fromCharCode(c) : '.');
    }
    console.log(`${i.toString(16).padStart(6, '0')}: ${hex.join(' ')}  ${ascii.join('')}`);
}
