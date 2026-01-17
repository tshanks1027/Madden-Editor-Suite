/**
 * Extract CNID -> GENR mapping from the working roster file
 * CNID appears to be the player ID that links BLBM records to players
 */

const path = require('path');
const MaddenRosterHelper = require('./src/main/lib/helpers/MaddenRosterHelper');
const fs = require('fs');

async function extractCnidGenrMapping() {
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

    // Build CNID -> {GENR, SKNT, Name} mapping
    const cnidMapping = {};
    let genericCount = 0;

    for (const rec of blbm._records) {
        const f = rec.fields || rec._fields;
        const cnid = f?.['CNID']?.value ?? f?.['CNID']?._value ?? f?.['CNID'];
        const genr = f?.['GENR']?.value ?? f?.['GENR']?._value ?? f?.['GENR'];
        const sknt = f?.['SKNT']?.value ?? f?.['SKNT']?._value ?? f?.['SKNT'];
        const firstName = f?.['CFNM']?.value ?? f?.['CFNM']?._value ?? f?.['CFNM'];
        const lastName = f?.['CLNM']?.value ?? f?.['CLNM']?._value ?? f?.['CLNM'];
        const assetName = f?.['ASNM']?.value ?? f?.['ASNM']?._value ?? f?.['ASNM'];

        if (cnid !== undefined && cnid !== null) {
            // Check if this is a generic face (has GENR value starting with gen_)
            if (genr && typeof genr === 'string' && genr.startsWith('gen_')) {
                genericCount++;
                cnidMapping[cnid] = {
                    genr: genr,
                    sknt: sknt,
                    name: `${firstName} ${lastName}`,
                    asset: assetName
                };
            }
        }
    }

    console.log(`Found ${genericCount} generic faces`);
    console.log(`Unique CNIDs with generic faces: ${Object.keys(cnidMapping).length}\n`);

    // Save to JSON file
    const outputPath = path.join(__dirname, 'data', 'lookups', 'cnid-genr-mapping.json');
    fs.writeFileSync(outputPath, JSON.stringify(cnidMapping, null, 2));
    console.log(`Saved mapping to: ${outputPath}`);

    // Show sample mappings grouped by GENR
    console.log('\n=== GENR USAGE BREAKDOWN ===');
    const genrUsage = new Map();
    for (const [cnid, data] of Object.entries(cnidMapping)) {
        if (!genrUsage.has(data.genr)) {
            genrUsage.set(data.genr, []);
        }
        genrUsage.get(data.genr).push({ cnid, name: data.name });
    }

    // Sort by GENR and show
    const sortedGenr = [...genrUsage.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    for (const [genr, players] of sortedGenr.slice(0, 20)) {
        console.log(`\n${genr} (${players.length} players):`);
        for (const p of players.slice(0, 3)) {
            console.log(`  CNID ${p.cnid}: ${p.name}`);
        }
        if (players.length > 3) console.log(`  ... and ${players.length - 3} more`);
    }

    // Now let's also see the Asset Name patterns
    console.log('\n\n=== ASSET NAME -> GENR ANALYSIS ===');
    const assetToGenr = new Map();
    for (const [cnid, data] of Object.entries(cnidMapping)) {
        // Extract the base part of the asset name (before the _number)
        const assetBase = data.asset?.replace(/_\d+$/, '') || 'unknown';
        if (!assetToGenr.has(assetBase)) {
            assetToGenr.set(assetBase, new Set());
        }
        assetToGenr.get(assetBase).add(data.genr);
    }

    // Check relationship between asset names and GENR
    let uniqueAssets = 0;
    let multiGenrAssets = 0;
    for (const [asset, genrSet] of assetToGenr) {
        uniqueAssets++;
        if (genrSet.size > 1) {
            multiGenrAssets++;
        }
    }
    console.log(`Unique asset name bases: ${uniqueAssets}`);
    console.log(`Assets with multiple GENR values: ${multiGenrAssets}`);

    // Show some examples
    console.log('\nExample asset->GENR mappings:');
    let shown = 0;
    for (const [asset, genrSet] of [...assetToGenr.entries()].slice(0, 15)) {
        const genrs = [...genrSet];
        if (genrs.length === 1) {
            console.log(`  ${asset} -> ${genrs[0]}`);
        } else {
            console.log(`  ${asset} -> [${genrs.join(', ')}]`);
        }
    }
}

extractCnidGenrMapping().catch(console.error);
