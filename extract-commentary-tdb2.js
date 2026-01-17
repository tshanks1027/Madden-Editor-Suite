// Extract COMN table from streameddata.DB using TDB2 parser
const fs = require('fs');
const path = require('path');

// Use the vendored madden-franchise TDB2 parser
const TDB2Parser = require('./src/main/lib/streams/TDB2/TDB2Parser');

const filePath = 'C:\\Users\\tshan\\Downloads\\PAM\\Gamemode\\streameddata.DB';

async function parseTDB2(filePath) {
    return new Promise((resolve, reject) => {
        const parser = new TDB2Parser();
        const fileStream = fs.createReadStream(filePath);

        parser.on('done', () => {
            resolve(parser.file);
        });

        parser.on('error', (err) => {
            reject(err);
        });

        fileStream.pipe(parser);
    });
}

async function main() {
    console.log('Parsing streameddata.DB using TDB2 parser...\n');

    try {
        const tdb2File = await parseTDB2(filePath);

        console.log('Tables found:');
        for (const table of tdb2File.tables) {
            console.log(`  - ${table.name} (${table.records.length} records)`);
        }

        // Look for COMN or TMCP table
        const comnTable = tdb2File.tables.find(t => t.name === 'COMN' || t.name === 'TMCP');

        if (comnTable) {
            console.log(`\nFound table: ${comnTable.name}`);
            console.log(`Records: ${comnTable.records.length}`);
            console.log(`Field definitions:`, comnTable.fieldDefinitions.map(f => f.name));

            // Show first 30 records
            console.log('\nFirst 30 records:');
            for (let i = 0; i < Math.min(30, comnTable.records.length); i++) {
                const record = comnTable.records[i];
                const fields = Object.keys(record.fields || {});

                // Try to find name and ID fields
                let name = '';
                let id = '';

                for (const fieldName of fields) {
                    const value = record[fieldName];
                    if (typeof value === 'string' && value.length > 0) {
                        name = value;
                    } else if (typeof value === 'number') {
                        id = value;
                    }
                }

                console.log(`  ${i}: ${JSON.stringify({fields, name, id, raw: record.fields})}`);
            }

            // Also look for specific names
            console.log('\nSearching for Earl, Brady, Brees, Aaitui...');
            for (const record of comnTable.records) {
                const fields = Object.keys(record.fields || {});
                for (const fieldName of fields) {
                    const value = record[fieldName];
                    if (typeof value === 'string') {
                        const lower = value.toLowerCase();
                        if (lower === 'earl' || lower === 'brady' || lower === 'brees' || lower === 'aaitui') {
                            console.log(`Found ${value}:`, record.fields);
                        }
                    }
                }
            }
        } else {
            console.log('\nNo COMN or TMCP table found');
            console.log('Available tables:', tdb2File.tables.map(t => t.name));
        }

    } catch (err) {
        console.error('Error parsing file:', err);
    }
}

main();
