/**
 * Find the correct zlib compression offset in FBCHUNKS file
 */

const fs = require('fs').promises;
const zlib = require('zlib');
const path = require('path');

// File path
const ROSTER_FILE = path.join(__dirname, '..', 'Madden Files', 'ROSTER-Official');

async function findZlibOffset() {
    console.log('\n=== Finding zlib compression offset ===\n');

    try {
        const fileData = await fs.readFile(ROSTER_FILE);
        console.log(`File size: ${fileData.length} bytes`);

        // Test the correct offset from research: 82 (0x52)
        console.log('Testing research-based offset 82...');
        const testOffset = 82;
        const testBytes = fileData.subarray(testOffset, testOffset + 2);
        console.log(`Bytes at offset ${testOffset}: ${testBytes.toString('hex')}`);

        try {
            const compressedData = fileData.subarray(testOffset);
            const decompressed = zlib.inflateSync(compressedData);
            console.log(`✅ SUCCESS at offset ${testOffset}: ${compressedData.length} → ${decompressed.length} bytes`);

            const preview = decompressed.subarray(0, 100);
            console.log(`First 100 bytes: ${preview.toString('hex')}`);
            console.log(`As ASCII: "${preview.toString('ascii').replace(/[^\x20-\x7E]/g, '.')}"\\n`);
            return testOffset;
        } catch (e) {
            console.log(`Failed at offset ${testOffset}: ${e.message}`);
        }

        // If 82 fails, check every offset from 0 to 200 for zlib signature
        for (let offset = 0; offset < 200; offset++) {
            const bytes = fileData.subarray(offset, offset + 2);

            // zlib signatures: 0x78 0x9C (default), 0x78 0xDA (highest compression), 0x78 0x01 (no compression)
            if (bytes[0] === 0x78 && (bytes[1] === 0x9C || bytes[1] === 0xDA || bytes[1] === 0x01)) {
                console.log(`Found potential zlib at offset ${offset}: ${bytes.toString('hex')}`);

                try {
                    const compressedData = fileData.subarray(offset);
                    const decompressed = zlib.inflateSync(compressedData);
                    console.log(`✅ SUCCESS at offset ${offset}: ${compressedData.length} → ${decompressed.length} bytes`);

                    // Show first 32 bytes of decompressed data
                    const preview = decompressed.subarray(0, 32);
                    console.log(`First 32 bytes: ${preview.toString('hex')}`);
                    console.log(`As ASCII: "${preview.toString('ascii').replace(/[^\x20-\x7E]/g, '.')}"\\n`);

                    return offset;
                } catch (e) {
                    console.log(`  Failed decompression: ${e.message}`);
                }
            }
        }

        console.log('No zlib signature found in first 200 bytes');
        return null;

    } catch (error) {
        console.error('Error:', error.message);
        return null;
    }
}

findZlibOffset().then(offset => {
    if (offset !== null) {
        console.log(`\n✅ Correct zlib offset: ${offset}`);
    } else {
        console.log('\n❌ Could not find zlib compression offset');
    }
}).catch(console.error);