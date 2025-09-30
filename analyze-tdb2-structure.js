/**
 * Analyze the actual structure of decompressed TDB2 data
 */

const fs = require('fs').promises;
const zlib = require('zlib');
const path = require('path');

const ROSTER_FILE = path.join(__dirname, '..', 'Madden Files', 'ROSTER-Official');

async function analyzeTDB2Structure() {
    console.log('\n=== Analyzing TDB2 Binary Structure ===\n');

    try {
        const fileData = await fs.readFile(ROSTER_FILE);
        const compressedData = fileData.subarray(74);
        const decompressed = zlib.inflateSync(compressedData);

        console.log(`Decompressed data: ${decompressed.length} bytes`);

        // Show first 200 bytes in hex and ASCII
        const first200 = decompressed.subarray(0, 200);
        console.log('First 200 bytes:');

        for (let i = 0; i < first200.length; i += 16) {
            const chunk = first200.subarray(i, Math.min(i + 16, first200.length));
            const hex = chunk.toString('hex').match(/.{2}/g).join(' ');
            const ascii = chunk.toString('ascii').replace(/[^\x20-\x7E]/g, '.');
            console.log(`${i.toString(16).padStart(4, '0')}: ${hex.padEnd(47)} ${ascii}`);
        }

        // Look for patterns that might indicate table structures
        console.log('\n=== Looking for patterns ===');

        // Check for known table names in ASCII
        const knownTableNames = ['PLAY', 'TEAM', 'COACH', 'STAD', 'SEAS'];
        for (const tableName of knownTableNames) {
            const index = decompressed.indexOf(tableName);
            if (index >= 0) {
                console.log(`Found "${tableName}" at offset ${index} (0x${index.toString(16)})`);

                // Show surrounding data
                const start = Math.max(0, index - 16);
                const end = Math.min(decompressed.length, index + 48);
                const surrounding = decompressed.subarray(start, end);

                console.log(`Context around "${tableName}":`);
                for (let i = 0; i < surrounding.length; i += 16) {
                    const offset = start + i;
                    const chunk = surrounding.subarray(i, Math.min(i + 16, surrounding.length));
                    const hex = chunk.toString('hex').match(/.{2}/g).join(' ');
                    const ascii = chunk.toString('ascii').replace(/[^\x20-\x7E]/g, '.');
                    const marker = (offset === index) ? ' <-- HERE' : '';
                    console.log(`${offset.toString(16).padStart(4, '0')}: ${hex.padEnd(47)} ${ascii}${marker}`);
                }
                console.log('');
            }
        }

        // Check for repeated patterns that might be table headers
        console.log('=== Looking for potential table headers ===');

        // Look for 16-byte boundaries that might be table headers
        const potentialTables = [];
        for (let i = 0; i < Math.min(10000, decompressed.length - 16); i += 4) {
            // Look for patterns: 4 bytes that could be ASCII table names
            const chunk = decompressed.subarray(i, i + 4);
            const ascii = chunk.toString('ascii');

            // Check if it looks like a table name (all uppercase letters)
            if (/^[A-Z]{4}$/.test(ascii)) {
                const followingBytes = decompressed.subarray(i + 4, i + 12);
                potentialTables.push({
                    offset: i,
                    name: ascii,
                    hex: followingBytes.toString('hex')
                });
            }
        }

        console.log(`Found ${potentialTables.length} potential table headers:`);
        potentialTables.slice(0, 10).forEach(table => {
            console.log(`  ${table.offset.toString(16).padStart(4, '0')}: "${table.name}" followed by ${table.hex}`);
        });

        return true;

    } catch (error) {
        console.error('Analysis failed:', error.message);
        return false;
    }
}

analyzeTDB2Structure().then(success => {
    console.log(success ? '\n✅ Analysis complete!' : '\n❌ Analysis failed!');
}).catch(console.error);