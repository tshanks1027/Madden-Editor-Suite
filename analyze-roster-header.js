/**
 * Analyze ROSTER file header structure
 */

const fs = require('fs').promises;
const path = require('path');

const ROSTER_FILE = path.join(__dirname, '..', 'Madden Files', 'ROSTER-Official');

async function analyzeRosterHeader() {
    console.log('\n=== Analyzing ROSTER File Header ===\n');

    try {
        const fileData = await fs.readFile(ROSTER_FILE);
        console.log(`File size: ${fileData.length} bytes`);

        // Show first 100 bytes in detail
        const header = fileData.subarray(0, 100);

        console.log('\n=== First 100 bytes (hex) ===');
        for (let i = 0; i < header.length; i += 16) {
            const chunk = header.subarray(i, Math.min(i + 16, header.length));
            const hex = chunk.toString('hex').padEnd(32, ' ').match(/.{1,2}/g).join(' ');
            const ascii = chunk.toString('ascii').replace(/[^\x20-\x7E]/g, '.');
            console.log(`${i.toString(16).padStart(4, '0')}: ${hex} | ${ascii}`);
        }

        console.log('\n=== Signature Analysis ===');

        // Check for FBCHUNKS signature
        const fbchunks = fileData.subarray(0, 8).toString('ascii');
        console.log(`First 8 bytes as ASCII: "${fbchunks}"`);

        if (fbchunks === 'FBCHUNKS') {
            console.log('✅ FBCHUNKS signature confirmed');
        } else {
            console.log('❌ FBCHUNKS signature NOT found');
        }

        // Check various offsets for potential signatures
        console.log('\n=== Checking various offsets for signatures ===');
        const checkOffsets = [8, 16, 24, 32, 40, 48, 56, 64, 72, 74, 80, 82];

        checkOffsets.forEach(offset => {
            const bytes = fileData.subarray(offset, offset + 8);
            const hex = bytes.toString('hex');
            const ascii = bytes.toString('ascii').replace(/[^\x20-\x7E]/g, '.');
            console.log(`Offset ${offset.toString().padStart(2, ' ')}: ${hex} | "${ascii}"`);
        });

        // Check year field (mentioned in MaddenRosterHelper)
        console.log('\n=== Year Field Analysis ===');
        const yearOffset = 0x16; // 22 decimal
        if (fileData.length > yearOffset + 2) {
            const year = fileData.readUInt16LE(yearOffset);
            console.log(`Year at offset 0x16 (${yearOffset}): ${year}`);

            // This should determine the data start offset
            const dataStart = year >= 2021 ? 0x4A : 0x3E;
            console.log(`Expected data start: 0x${dataStart.toString(16)} (${dataStart} decimal)`);
        }

        return true;

    } catch (error) {
        console.error('Analysis failed:', error.message);
        return false;
    }
}

analyzeRosterHeader().then(success => {
    console.log(success ? '\n✅ Header analysis complete!' : '\n❌ Header analysis failed!');
}).catch(console.error);