/**
 * Extract PGHE table from streameddata.DB and create lookup
 */

async function extractPGHE() {
    const fs = require('fs');
    const path = require('path');

    const dbPath = 'C:/Users/tshan/Downloads/PAM/Gamemode/streameddata.DB';
    console.log('Loading:', dbPath);

    // Try TDBHelper for raw DB files
    const TDBHelper = require('./src/main/lib/helpers/TDBHelper');
    const helper = new TDBHelper();
    const franchise = await helper.load(dbPath);
    console.log('File loaded');

    // List all tables
    const tables = franchise.tables || [];
    console.log('Total tables:', tables.length);

    // List all table names first
    console.log('Tables:');
    tables.forEach((t, i) => {
        const name = t.name || t.header?.name || 'unknown';
        const recCount = t.records?.length || t._records?.length || 0;
        console.log(`  ${i}: ${name} (${recCount} records)`);
    });

    // Find PGHE table
    const pgheTable = tables.find(t => t.name === 'PGHE' || (t.header && t.header.name === 'PGHE'));

    if (!pgheTable) {
        console.log('PGHE table not found');
        return;
    }

    console.log('\nPGHE table object keys:', Object.keys(pgheTable));

    // Try different record access methods
    let records = pgheTable.records || pgheTable._records || [];
    if (pgheTable.readRecords) {
        console.log('Calling readRecords...');
        records = await pgheTable.readRecords();
    }
    console.log('Found PGHE table with', records.length, 'records');

    // Show first record structure
    if (records.length > 0) {
        const firstRec = records[0];
        const fields = firstRec.fields || firstRec._fields || firstRec;
        console.log('\nFirst record fields:', Object.keys(fields));
        console.log('First record:', JSON.stringify(fields, null, 2));
    }

    // Export all records
    const exportData = [];
    for (let i = 0; i < records.length; i++) {
        const rec = records[i];
        const fields = rec.fields || rec._fields || rec;

        const entry = {};
        for (const [key, val] of Object.entries(fields)) {
            entry[key] = val?.value !== undefined ? val.value : val;
        }
        entry._index = i;
        exportData.push(entry);
    }

    // Save to JSON
    const outputPath = path.join(__dirname, 'data', 'lookups', 'PGHE_lookup.json');
    fs.writeFileSync(outputPath, JSON.stringify(exportData, null, 2));
    console.log('\nExported', exportData.length, 'records to', outputPath);

    // Show first 10
    console.log('\nFirst 10 records:');
    exportData.slice(0, 10).forEach((rec, i) => {
        console.log(i + ':', JSON.stringify(rec));
    });
}

extractPGHE().catch(console.error);
