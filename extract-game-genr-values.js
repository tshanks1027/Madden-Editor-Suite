/**
 * Extract ALL unique GENR values from the working roster file
 * This will tell us exactly what GENR values the game actually uses
 */

const path = require('path');
const MaddenRosterHelper = require('./src/main/lib/helpers/MaddenRosterHelper');

async function extractGenrValues() {
    const workingPath = 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden NFL 26\\Saves\\ROSTER-GENERATED';

    console.log('Loading ROSTER-GENERATED (working file)...');
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

    // Extract all unique GENR values
    const genrValues = new Map(); // GENR -> count
    const skntValues = new Map(); // SKNT -> count
    const genrBySknt = new Map(); // SKNT -> Set of GENR values

    for (const rec of blbm._records) {
        const fields = rec.fields || rec._fields;
        const genr = fields?.['GENR']?.value ?? fields?.['GENR']?._value;
        const sknt = fields?.['SKNT']?.value ?? fields?.['SKNT']?._value;

        if (genr) {
            genrValues.set(genr, (genrValues.get(genr) || 0) + 1);
        }
        if (sknt !== undefined) {
            skntValues.set(sknt, (skntValues.get(sknt) || 0) + 1);

            if (!genrBySknt.has(sknt)) {
                genrBySknt.set(sknt, new Set());
            }
            if (genr) {
                genrBySknt.get(sknt).add(genr);
            }
        }
    }

    console.log('=== UNIQUE GENR VALUES IN WORKING FILE ===');
    console.log(`Total unique GENR values: ${genrValues.size}\n`);

    // Sort by GENR prefix (gen_1, gen_2, etc.)
    const sortedGenr = [...genrValues.entries()].sort((a, b) => a[0].localeCompare(b[0]));

    // Group by skin tone prefix
    const byPrefix = new Map();
    for (const [genr, count] of sortedGenr) {
        const match = genr.match(/^gen_(\d+)/);
        const prefix = match ? `gen_${match[1]}` : 'other';
        if (!byPrefix.has(prefix)) {
            byPrefix.set(prefix, []);
        }
        byPrefix.set(prefix, [...byPrefix.get(prefix), { genr, count }]);
    }

    for (const [prefix, values] of [...byPrefix.entries()].sort()) {
        console.log(`\n${prefix} (${values.length} unique values):`);
        for (const { genr, count } of values) {
            console.log(`  "${genr}" - used ${count} times`);
        }
    }

    console.log('\n\n=== SKNT VALUE DISTRIBUTION ===');
    for (const [sknt, count] of [...skntValues.entries()].sort((a,b) => a[0] - b[0])) {
        console.log(`SKNT ${sknt}: ${count} players, ${genrBySknt.get(sknt)?.size || 0} unique GENR values`);
    }

    // Output as JSON for use in code
    console.log('\n\n=== JSON OUTPUT FOR CODE ===');
    const genrBySkntJson = {};
    for (const [sknt, genrSet] of genrBySknt.entries()) {
        genrBySkntJson[sknt] = [...genrSet].sort();
    }
    console.log(JSON.stringify(genrBySkntJson, null, 2));
}

extractGenrValues().catch(console.error);
