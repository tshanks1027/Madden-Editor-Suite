/**
 * Extract PIDs and PAMs from ROSTER-GENHEADTEST
 * Shows what PID each player has and their portrait/PAM
 */

const path = require('path');
const MaddenRosterHelper = require('./src/main/lib/helpers/MaddenRosterHelper');
const fs = require('fs');

async function extractPidPam() {
    const rosterPath = 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden NFL 26\\Saves\\ROSTER-GENHEADTEST';

    console.log('Loading roster:', rosterPath);
    const helper = new MaddenRosterHelper();
    const file = await helper.load(rosterPath);

    // Get PLAY table (players)
    const playTable = file.tables.find(t => t.name === 'PLAY' || t.header?.name === 'PLAY');
    if (!playTable) {
        console.error('PLAY table not found');
        return;
    }

    // Get BLOB table for BLBM data
    const blobTable = file.tables.find(t => t.name === 'BLOB' || t.header?.name === 'BLOB');
    let blbm = null;
    if (blobTable?.records?.[0]?.fields?.BLBM?.value) {
        blbm = blobTable.records[0].fields.BLBM.value;
    }

    const records = playTable.records || [];
    console.log(`Found ${records.length} player records`);

    // Extract PID and PAM for each player
    const results = [];

    for (let i = 0; i < records.length; i++) {
        const rec = records[i];
        const fields = rec.fields || rec._fields;
        if (!fields) continue;

        const firstName = fields['PFNA']?.value ?? '';
        const lastName = fields['PLNA']?.value ?? '';
        const pid = fields['PSXP']?.value ?? fields['PSXP']?._value ?? 0;  // Photo ID (PID)
        const peps = fields['PEPS']?.value ?? '';  // PAM/Asset ID
        const plpl = fields['PLPL']?.value ?? 0;   // Player picture level

        // Get BLBM data
        let genr = '', sknt = '', cnid = '';
        if (blbm?._records?.[i]) {
            const blbmFields = blbm._records[i].fields || blbm._records[i]._fields;
            genr = blbmFields?.['GENR']?.value ?? '';
            sknt = blbmFields?.['SKNT']?.value ?? '';
            cnid = blbmFields?.['CNID']?.value ?? '';
        }

        results.push({
            index: i,
            name: `${firstName} ${lastName}`.trim(),
            pid,
            pam: peps,
            plpl,
            genr,
            sknt,
            cnid
        });
    }

    // Sort by name (alphabetical)
    results.sort((a, b) => a.name.localeCompare(b.name));

    // Show first 50 entries
    console.log('\n=== PID to PAM Mapping (first 50 alphabetically) ===');
    console.log('Index | PID | Name | PAM (PEPS) | GENR | SKNT | CNID');
    console.log('-'.repeat(100));

    for (let i = 0; i < Math.min(50, results.length); i++) {
        const r = results[i];
        console.log(`${String(r.index).padStart(4)} | ${String(r.pid).padStart(5)} | ${r.name.padEnd(25)} | ${(r.pam || '-').padEnd(30)} | ${(r.genr || '-').padEnd(20)} | ${String(r.sknt).padStart(2)} | ${r.cnid}`);
    }

    // Save full mapping
    const outputPath = path.join(__dirname, 'data', 'lookups', 'roster-pid-pam-mapping.json');
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
    console.log(`\nSaved full mapping (${results.length} entries) to ${outputPath}`);

    // Also show unique PIDs and their PAMs
    console.log('\n=== Unique PIDs with non-empty PAM ===');
    const withPam = results.filter(r => r.pam && r.pam.length > 0);
    console.log(`Found ${withPam.length} entries with PAM values`);

    for (let i = 0; i < Math.min(20, withPam.length); i++) {
        const r = withPam[i];
        console.log(`  PID ${r.pid}: ${r.name} -> PAM: ${r.pam}`);
    }
}

extractPidPam().catch(console.error);
