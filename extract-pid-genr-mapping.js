/**
 * Extract PID -> GENR mapping from the working roster file
 * This will give us the exact GENR value for each player by their PID
 */

const path = require('path');
const MaddenRosterHelper = require('./src/main/lib/helpers/MaddenRosterHelper');
const fs = require('fs');

async function extractPidGenrMapping() {
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

    // Build PID -> {GENR, SKNT, PAM} mapping
    const pidMapping = {};
    let genericCount = 0;
    let scannedCount = 0;

    for (const rec of blbm._records) {
        const f = rec.fields || rec._fields;
        const pid = f?.['BPID']?.value ?? f?.['BPID']?._value ?? f?.['BPID'];
        const genr = f?.['GENR']?.value ?? f?.['GENR']?._value ?? f?.['GENR'];
        const sknt = f?.['SKNT']?.value ?? f?.['SKNT']?._value ?? f?.['SKNT'];
        const pam = f?.['PEPS']?.value ?? f?.['PEPS']?._value ?? f?.['PEPS'];

        if (pid !== undefined && pid !== null) {
            scannedCount++;

            // Check if this is a generic face (has GENR value starting with gen_)
            if (genr && typeof genr === 'string' && genr.startsWith('gen_')) {
                genericCount++;
                pidMapping[pid] = {
                    genr: genr,
                    sknt: sknt,
                    pam: pam || ''
                };
            }
        }
    }

    console.log(`Scanned ${scannedCount} records with PIDs`);
    console.log(`Found ${genericCount} generic faces`);
    console.log(`Unique PIDs with generic faces: ${Object.keys(pidMapping).length}\n`);

    // Save to JSON file
    const outputPath = path.join(__dirname, 'data', 'lookups', 'pid-genr-mapping.json');
    fs.writeFileSync(outputPath, JSON.stringify(pidMapping, null, 2));
    console.log(`Saved mapping to: ${outputPath}`);

    // Also show some sample mappings
    console.log('\n=== SAMPLE PID -> GENR MAPPINGS ===');
    const entries = Object.entries(pidMapping).slice(0, 20);
    for (const [pid, data] of entries) {
        console.log(`PID ${pid}: GENR="${data.genr}", SKNT=${data.sknt}, PAM="${data.pam}"`);
    }

    // Group by PAM prefix to understand portrait->GENR relationship
    console.log('\n=== PAM/PORTRAIT TO GENR ANALYSIS ===');
    const pamToGenr = new Map();
    for (const [pid, data] of Object.entries(pidMapping)) {
        const pam = data.pam;
        if (pam && pam.startsWith('plpo_generic_')) {
            if (!pamToGenr.has(pam)) {
                pamToGenr.set(pam, new Set());
            }
            pamToGenr.get(pam).add(data.genr);
        }
    }

    console.log(`\nUnique portrait names (PAM): ${pamToGenr.size}`);

    // Show portrait -> GENR mappings
    const sortedPam = [...pamToGenr.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    console.log('\nPortrait -> GENR mappings (showing first 30):');
    for (const [pam, genrSet] of sortedPam.slice(0, 30)) {
        const genrs = [...genrSet];
        if (genrs.length === 1) {
            console.log(`  ${pam} -> ${genrs[0]}`);
        } else {
            console.log(`  ${pam} -> [MULTIPLE: ${genrs.join(', ')}]`);
        }
    }

    // Check if there's a 1:1 mapping
    let oneToOne = 0;
    let oneToMany = 0;
    for (const [pam, genrSet] of pamToGenr) {
        if (genrSet.size === 1) {
            oneToOne++;
        } else {
            oneToMany++;
        }
    }
    console.log(`\n1:1 portrait->GENR mappings: ${oneToOne}`);
    console.log(`1:many portrait->GENR mappings: ${oneToMany}`);

    // Create direct portrait->GENR mapping for faces that have 1:1 relationship
    const portraitGenrMapping = {};
    for (const [pam, genrSet] of pamToGenr) {
        const genrs = [...genrSet];
        if (genrs.length === 1) {
            portraitGenrMapping[pam] = {
                genr: genrs[0],
                // Extract SKNT from GENR (first number after gen_)
                sknt: parseInt(genrs[0].split('_')[1]) || 1
            };
        } else {
            // For 1:many, pick most common or first
            portraitGenrMapping[pam] = {
                genr: genrs[0],
                sknt: parseInt(genrs[0].split('_')[1]) || 1,
                alternatives: genrs.slice(1)
            };
        }
    }

    const portraitMapPath = path.join(__dirname, 'data', 'lookups', 'portrait-genr-mapping.json');
    fs.writeFileSync(portraitMapPath, JSON.stringify(portraitGenrMapping, null, 2));
    console.log(`\nSaved portrait->GENR mapping to: ${portraitMapPath}`);
}

extractPidGenrMapping().catch(console.error);
