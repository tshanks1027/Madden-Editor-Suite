/**
 * Check what PLAY table fields exist that match PGHE lookup
 */

const path = require('path');
const MaddenRosterHelper = require('./src/main/lib/helpers/MaddenRosterHelper');

async function inspectPLAYFields() {
    const workingPath = 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden NFL 26\\Saves\\ROSTER-GENERATED';
    const helper = new MaddenRosterHelper();
    const file = await helper.load(workingPath);

    const play = file.PLAY;
    if (!play || !play.records || play.records.length === 0) {
        console.error('No PLAY records');
        return;
    }

    // Get all field names from first player
    const firstRec = play.records[0];
    const f = firstRec.fields || firstRec._fields;
    const fieldNames = Object.keys(f).sort();

    console.log('=== PLAY TABLE FIELDS (' + fieldNames.length + ' total) ===\n');

    // Look specifically for fields that might match PGHE lookup
    // PGHE lookup: PGHE, PFCG, GPAN, GSLP, PSXP, CPVF
    const pgheRelated = ['PGHE', 'PFCG', 'GPAN', 'GSLP', 'PSXP', 'CPVF', 'PEPS', 'PLPL', 'PSKI', 'PLRC'];
    console.log('PGHE-related fields in PLAY table:');
    for (const fn of pgheRelated) {
        if (f[fn]) {
            const val = f[fn].value !== undefined ? f[fn].value : (f[fn]._value !== undefined ? f[fn]._value : 'N/A');
            console.log('  ' + fn + ': ' + val + ' (EXISTS)');
        } else {
            console.log('  ' + fn + ': NOT FOUND');
        }
    }

    // Check for any field that contains 'GP', 'PG', 'CP' to find potential matches
    console.log('\nFields containing GP, PG, CP, SL:');
    const matches = fieldNames.filter(n => n.includes('GP') || n.includes('PG') || n.includes('CP') || n.includes('SL'));
    for (const m of matches) {
        const val = f[m].value !== undefined ? f[m].value : (f[m]._value !== undefined ? f[m]._value : 'N/A');
        console.log('  ' + m + ': ' + val);
    }

    // Print all field names
    console.log('\n=== ALL PLAY FIELD NAMES ===');
    console.log(fieldNames.join(', '));
}

inspectPLAYFields().catch(console.error);
