/**
 * Compare CNID (from BLBM) with PID (from Player table) to understand the relationship
 * Also examine how portrait names relate to GENR values
 */

const path = require('path');
const MaddenRosterHelper = require('./src/main/lib/helpers/MaddenRosterHelper');
const fs = require('fs');

async function compareCnidPid() {
    const workingPath = 'C:\\Users\\tshan\\OneDrive\\Documents\\Madden NFL 26\\Saves\\ROSTER-GENERATED';

    console.log('Loading ROSTER-GENERATED...');
    const helper = new MaddenRosterHelper();
    const file = await helper.load(workingPath);

    // Get Player table to see PID (photoId) field
    const playerTable = file.PLAY || file.Player;
    if (!playerTable?._records) {
        console.error('Could not find Player table');
        return;
    }

    console.log(`Found ${playerTable._records.length} Player records\n`);

    // Build PID -> player info map
    const pidToPlayer = new Map();
    for (const rec of playerTable._records) {
        const f = rec.fields || rec._fields;
        const firstName = f?.['firstName']?.value ?? f?.['firstName']?._value ?? f?.['firstName'];
        const lastName = f?.['lastName']?.value ?? f?.['lastName']?._value ?? f?.['lastName'];
        const photoId = f?.['photoId']?.value ?? f?.['photoId']?._value ?? f?.['photoId'];

        if (photoId) {
            pidToPlayer.set(photoId, { firstName, lastName });
        }
    }
    console.log(`Found ${pidToPlayer.size} players with photoId in Player table`);

    // Load BLBM CNID mapping we just created
    const cnidMappingPath = path.join(__dirname, 'data', 'lookups', 'cnid-genr-mapping.json');
    const cnidMapping = JSON.parse(fs.readFileSync(cnidMappingPath, 'utf8'));
    const cnidSet = new Set(Object.keys(cnidMapping).map(k => parseInt(k)));
    console.log(`Loaded ${cnidSet.size} CNIDs from mapping\n`);

    // Check overlap between PID and CNID
    let matchCount = 0;
    let mismatchCount = 0;
    const examples = [];

    for (const [pid, playerData] of pidToPlayer) {
        if (cnidSet.has(pid)) {
            matchCount++;
            const cnidData = cnidMapping[pid];
            if (examples.length < 20) {
                examples.push({
                    pid,
                    playerFirst: playerData.firstName,
                    playerLast: playerData.lastName,
                    cnidName: cnidData.name,
                    genr: cnidData.genr,
                    sknt: cnidData.sknt
                });
            }
        }
    }

    console.log(`=== PID/CNID ANALYSIS ===`);
    console.log(`PIDs in Player table: ${pidToPlayer.size}`);
    console.log(`CNIDs in BLBM: ${cnidSet.size}`);
    console.log(`Matching IDs: ${matchCount}\n`);

    console.log('Sample matching records:');
    for (const ex of examples) {
        console.log(`  PID ${ex.pid}: Player="${ex.playerFirst} ${ex.playerLast}", BLBM="${ex.cnidName}", GENR="${ex.genr}", SKNT=${ex.sknt}`);
    }

    // Now load PID_Portrait_Mapping.csv to see portrait associations
    console.log('\n\n=== PORTRAIT MAPPING ANALYSIS ===');
    const portraitMappingPath = path.join(__dirname, 'data', 'lookups', 'PID_Portrait_Mapping.csv');
    const portraitContent = fs.readFileSync(portraitMappingPath, 'utf8');
    const portraitLines = portraitContent.split('\n');

    // Parse: PID,Player Name,Type,Portrait,PAM
    const pidToPortrait = new Map();
    for (let i = 1; i < portraitLines.length; i++) {
        const line = portraitLines[i].trim();
        if (!line) continue;
        const parts = line.split(',');
        if (parts.length < 4) continue;

        const pid = parseInt(parts[0]);
        const name = parts[1];
        const type = parts[2]; // 'scanned' or 'generic'
        const portrait = parts[3]; // plpo_XXX

        if (!isNaN(pid)) {
            pidToPortrait.set(pid, { name, type, portrait });
        }
    }
    console.log(`Loaded ${pidToPortrait.size} portrait mappings`);

    // Find generic faces and see if we can map them to GENR
    console.log('\n=== GENERIC PORTRAIT -> GENR MAPPING ATTEMPT ===');
    const genericPortraits = [];
    for (const [pid, pData] of pidToPortrait) {
        if (pData.type === 'generic' && pData.portrait.startsWith('plpo_generic_')) {
            const cnidData = cnidMapping[pid];
            if (cnidData) {
                genericPortraits.push({
                    pid,
                    portrait: pData.portrait,
                    genr: cnidData.genr,
                    sknt: cnidData.sknt,
                    name: pData.name
                });
            }
        }
    }
    console.log(`Found ${genericPortraits.length} generic portraits with matching CNID data`);

    // Build portrait -> GENR mapping
    const portraitToGenr = new Map();
    for (const g of genericPortraits) {
        if (!portraitToGenr.has(g.portrait)) {
            portraitToGenr.set(g.portrait, []);
        }
        portraitToGenr.get(g.portrait).push(g.genr);
    }

    console.log(`\nUnique portrait names: ${portraitToGenr.size}`);

    // Check consistency
    let consistentCount = 0;
    let inconsistentCount = 0;
    const inconsistentExamples = [];
    const consistentExamples = [];

    for (const [portrait, genrs] of portraitToGenr) {
        const uniqueGenrs = [...new Set(genrs)];
        if (uniqueGenrs.length === 1) {
            consistentCount++;
            if (consistentExamples.length < 10) {
                consistentExamples.push({ portrait, genr: uniqueGenrs[0] });
            }
        } else {
            inconsistentCount++;
            if (inconsistentExamples.length < 10) {
                inconsistentExamples.push({ portrait, genrs: uniqueGenrs });
            }
        }
    }

    console.log(`Consistent (1:1) portrait->GENR: ${consistentCount}`);
    console.log(`Inconsistent (1:many) portrait->GENR: ${inconsistentCount}`);

    console.log('\nConsistent examples:');
    for (const ex of consistentExamples) {
        console.log(`  ${ex.portrait} -> ${ex.genr}`);
    }

    if (inconsistentExamples.length > 0) {
        console.log('\nInconsistent examples (same portrait, different GENR):');
        for (const ex of inconsistentExamples) {
            console.log(`  ${ex.portrait} -> [${ex.genrs.join(', ')}]`);
        }
    }

    // Save the portrait->GENR mapping
    const finalMapping = {};
    for (const [portrait, genrs] of portraitToGenr) {
        const uniqueGenrs = [...new Set(genrs)];
        // For consistent mappings, use the single GENR
        // For inconsistent, use the most common or first
        const genrCounts = {};
        for (const g of genrs) {
            genrCounts[g] = (genrCounts[g] || 0) + 1;
        }
        const sortedGenrs = Object.entries(genrCounts).sort((a, b) => b[1] - a[1]);
        finalMapping[portrait] = {
            genr: sortedGenrs[0][0],
            sknt: parseInt(sortedGenrs[0][0].split('_')[1]) || 1
        };
    }

    const mappingPath = path.join(__dirname, 'data', 'lookups', 'portrait-to-genr.json');
    fs.writeFileSync(mappingPath, JSON.stringify(finalMapping, null, 2));
    console.log(`\nSaved portrait->GENR mapping to: ${mappingPath}`);
    console.log(`Total mappings: ${Object.keys(finalMapping).length}`);
}

compareCnidPid().catch(console.error);
