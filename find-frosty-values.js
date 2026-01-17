// Find where Frosty's exact PCMT values are stored
const fs = require('fs');

const filePath = 'C:\\Users\\tshan\\Downloads\\PAM\\Gamemode\\streameddata.DB';
const buf = fs.readFileSync(filePath);

// Exact values from Frosty screenshot:
const frostyValues = [
    { name: 'Aaitui', pcmt: 5657 },
    { name: 'Aaron', pcmt: 7553 },
    { name: 'Abanikanda', pcmt: 8677 },
    { name: 'Abbot', pcmt: 6693 },
    { name: 'Abbrederis', pcmt: 5788 },
    { name: 'Abdesmad', pcmt: 6356 },
    { name: 'Abel', pcmt: 7554 },
    { name: 'Aboushi', pcmt: 5543 },
    { name: 'Abram', pcmt: 7281 },
    { name: 'Abrams-Draine', pcmt: 9044 },
    { name: 'Abreu', pcmt: 7555 },
    { name: 'Achane', pcmt: 8665 },
    { name: 'Acker', pcmt: 5789 },
];

console.log('=== Searching for Frosty PCMT values in file ===\n');

for (const { name, pcmt } of frostyValues) {
    console.log(`\n${name} = ${pcmt} (0x${pcmt.toString(16)}):`);

    // Find name in file
    const nameOffset = buf.indexOf(name);
    console.log(`  Name at: 0x${nameOffset.toString(16)}`);

    // Search for the PCMT value within 100 bytes of the name
    const searchStart = Math.max(0, nameOffset - 50);
    const searchEnd = Math.min(buf.length - 2, nameOffset + 100);

    let found = false;
    for (let i = searchStart; i < searchEnd; i++) {
        const val16LE = buf.readUInt16LE(i);
        const val16BE = buf.readUInt16BE(i);

        if (val16LE === pcmt) {
            console.log(`  FOUND as 16-bit LE at 0x${i.toString(16)} (offset from name: ${i - nameOffset})`);
            found = true;
        }
        if (val16BE === pcmt) {
            console.log(`  FOUND as 16-bit BE at 0x${i.toString(16)} (offset from name: ${i - nameOffset})`);
            found = true;
        }
    }

    if (!found) {
        console.log(`  NOT FOUND near name`);

        // Search entire file
        let globalCount = 0;
        for (let i = 0; i < buf.length - 2; i++) {
            if (buf.readUInt16LE(i) === pcmt) globalCount++;
        }
        console.log(`  Global occurrences as 16-bit LE: ${globalCount}`);
    }
}

// Maybe the values are encoded differently
// Let's check if there's a simple offset or XOR
console.log('\n\n=== Checking encoding patterns ===');

// My stored values
const myValues = [12844, 571, 51779, 18996, 14381, 43057, 1083, 20011, 57912, 43078, 1595, 45635, 14893];
const frostyPcmt = [5657, 7553, 8677, 6693, 5788, 6356, 7554, 5543, 7281, 9044, 7555, 8665, 5789];

console.log('\nStored vs Frosty comparison:');
for (let i = 0; i < myValues.length; i++) {
    const stored = myValues[i];
    const frosty = frostyPcmt[i];
    const diff = stored - frosty;
    const ratio = stored / frosty;
    const xor = stored ^ frosty;

    console.log(`  stored=${stored.toString().padStart(6)}, frosty=${frosty.toString().padStart(5)}, diff=${diff.toString().padStart(6)}, ratio=${ratio.toFixed(2).padStart(6)}, xor=${xor.toString(16).padStart(5)}`);
}

// Look for a pattern in the differences
console.log('\n=== Looking for record index correlation ===');
// Maybe frosty PCMT = index + offset?
// Aaitui is first record, pcmt 5657
// If there's an offset of 5656, then index 1 + 5656 = 5657...

// Let me check if the stored value encodes both index and actual PCMT
// stored = (index * 512) + remainder?
console.log('\nChecking if stored = (index * something) + frosty:');
for (let i = 0; i < myValues.length; i++) {
    const stored = myValues[i];
    const frosty = frostyPcmt[i];
    // stored - frosty = index * multiplier?
    const diff = stored - frosty;
    console.log(`  i=${i}: stored=${stored}, frosty=${frosty}, diff=${diff}, diff/i=${i > 0 ? (diff/i).toFixed(1) : 'N/A'}`);
}
