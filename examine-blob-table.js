/**
 * Examine the BLOB table for player data patterns
 */

const fs = require('fs').promises;
const zlib = require('zlib');
const path = require('path');

// Import our TypeScript StandaloneTDB2Parser
const { StandaloneTDB2Parser } = require('./src/main/parsers/StandaloneTDB2Parser.ts');

// File path
const ROSTER_FILE = path.join(__dirname, '..', 'Madden Files', 'ROSTER-Official');

async function examineBlob() {
    console.log('\n=== Examining BLOB Table for Player Data ===\n');

    try {
        const fileData = await fs.readFile(ROSTER_FILE);
        const compressedData = fileData.subarray(74);
        const decompressed = zlib.inflateSync(compressedData);

        console.log(`Decompressed: ${compressedData.length} -> ${decompressed.length} bytes`);

        const parser = new StandaloneTDB2Parser();
        const tdb2File = parser.parse(decompressed);

        // Find BLOB table
        const blobTable = tdb2File.getTable('BLOB');

        if (blobTable) {
            console.log(`\n🎯 Found BLOB table: ${blobTable.records.length} records`);

            // Examine first BLOB record
            if (blobTable.records.length > 0) {
                const record = blobTable.records[0];
                console.log(`\nBLOB Record ${record.index}:`);
                console.log(`Fields: ${Object.keys(record.fields).length}`);

                // Show all fields
                Object.keys(record.fields).forEach(key => {
                    const field = record.fields[key];
                    console.log(`  ${key}: type=${field.type}, value="${field.value || 'null'}", raw=${field.raw ? field.raw.toString('hex').substring(0, 20) : 'none'}...`);
                });

                // Check for subrecord
                if (record.subRecord) {
                    console.log(`\nSubRecord found:`);
                    console.log(`SubRecord fields: ${Object.keys(record.subRecord.fields).length}`);

                    Object.keys(record.subRecord.fields).forEach(key => {
                        const field = record.subRecord.fields[key];
                        console.log(`  SUB ${key}: type=${field.type}, value="${field.value || 'null'}", raw=${field.raw ? field.raw.toString('hex').substring(0, 20) : 'none'}...`);
                    });
                }
            }
        }

        // Look through first 10 tables for any player-like data
        console.log('\n=== Examining First 10 Tables ===');

        for (let i = 0; i < Math.min(10, tdb2File.tables.length); i++) {
            const table = tdb2File.tables[i];
            console.log(`\nTable ${i + 1}: "${table.name}" (type: ${table.type}, records: ${table.records.length})`);

            if (table.records.length > 0) {
                const firstRecord = table.records[0];
                const fieldKeys = Object.keys(firstRecord.fields);

                if (fieldKeys.length > 0) {
                    console.log(`  Field count: ${fieldKeys.length}`);
                    console.log(`  Fields: ${fieldKeys.join(', ')}`);

                    // Look for player-like field names
                    const playerFields = fieldKeys.filter(key =>
                        key.includes('PL') || key.includes('PN') || key.includes('FN') ||
                        key.includes('NAME') || key.includes('OVR') || key.includes('POS')
                    );

                    if (playerFields.length > 0) {
                        console.log(`  🎯 POTENTIAL PLAYER FIELDS: ${playerFields.join(', ')}`);

                        // Show values for these fields
                        playerFields.forEach(key => {
                            const field = firstRecord.fields[key];
                            if (field.value) {
                                console.log(`    ${key} = "${field.value}"`);
                            }
                        });
                    }
                }

                // Check subrecords too
                if (firstRecord.subRecord && Object.keys(firstRecord.subRecord.fields).length > 0) {
                    const subFieldKeys = Object.keys(firstRecord.subRecord.fields);
                    const subPlayerFields = subFieldKeys.filter(key =>
                        key.includes('PL') || key.includes('PN') || key.includes('FN') ||
                        key.includes('NAME') || key.includes('OVR') || key.includes('POS')
                    );

                    if (subPlayerFields.length > 0) {
                        console.log(`  🎯 POTENTIAL PLAYER SUBFIELDS: ${subPlayerFields.join(', ')}`);
                    }
                }
            }
        }

        return true;

    } catch (error) {
        console.error('Examination failed:', error.message);
        console.error(error.stack);
        return false;
    }
}

examineBlob().then(success => {
    console.log(success ? '\n✅ BLOB examination complete!' : '\n❌ Examination failed!');
}).catch(console.error);