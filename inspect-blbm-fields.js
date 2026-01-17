/**
 * Inspect BLBM field structure to find correct field names
 */

const path = require('path');
const MaddenRosterHelper = require('./src/main/lib/helpers/MaddenRosterHelper');

async function inspectBlbmFields() {
    const workingPath = 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden NFL 26\\Saves\\ROSTER-GENERATED';

    console.log('Loading ROSTER-GENERATED...');
    const helper = new MaddenRosterHelper();
    const file = await helper.load(workingPath);

    // Access BLBM
    const blobRec = file.BLOB?._records?.[0];
    const fields = blobRec?.fields || blobRec?._fields;
    const blbm = fields?.['BLBM']?.value || fields?.['BLBM'];

    if (!blbm?._records) {
        console.error('Could not find BLBM');
        return;
    }

    console.log(`Found ${blbm._records.length} BLBM records\n`);

    // Get first record and inspect its structure
    const firstRec = blbm._records[0];
    console.log('=== FIRST RECORD STRUCTURE ===');
    console.log('Keys:', Object.keys(firstRec));

    const f = firstRec.fields || firstRec._fields;
    console.log('\nField keys:', f ? Object.keys(f) : 'no fields');

    // Show first few field values
    if (f) {
        console.log('\n=== FIELD VALUES (first record) ===');
        for (const [key, val] of Object.entries(f)) {
            const value = val?.value ?? val?._value ?? val;
            console.log(`  ${key}: ${JSON.stringify(value).substring(0, 100)}`);
        }
    }

    // Check a few more records to see if GENR is populated
    console.log('\n=== CHECKING GENR IN FIRST 10 RECORDS ===');
    for (let i = 0; i < Math.min(10, blbm._records.length); i++) {
        const rec = blbm._records[i];
        const f = rec.fields || rec._fields;
        const genr = f?.['GENR']?.value ?? f?.['GENR']?._value ?? f?.['GENR'];
        const sknt = f?.['SKNT']?.value ?? f?.['SKNT']?._value ?? f?.['SKNT'];
        const peps = f?.['PEPS']?.value ?? f?.['PEPS']?._value ?? f?.['PEPS'];
        console.log(`Record ${i}: GENR="${genr}", SKNT=${sknt}, PEPS="${peps}"`);
    }
}

inspectBlbmFields().catch(console.error);
