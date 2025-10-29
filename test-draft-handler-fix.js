/**
 * Test the draft class handler fixes for college parsing and PID mapping
 */

const Franchise = require('madden-franchise');
const path = require('path');
const fs = require('fs');

async function testDraftHandlerFix() {
    const filePath = path.join(process.env.USERPROFILE, 'OneDrive', 'Documents', 'Madden NFL 26', 'Saves', 'CAREER-TEST-AUTOSAVE');

    console.log('Loading franchise file...\n');
    const franchise = await Franchise.create(filePath, { gameYearOverride: 26 });

    // Load lookups
    const collegesPath = path.join(__dirname, 'data', 'lookups', 'college_lookup.csv');
    const collegeMappingPath = path.join(__dirname, 'data', 'franchise-college-mapping.json');
    const pidMappingPath = path.join(__dirname, 'data', 'lookups', 'PID_Portrait_Mapping.csv');

    const collegesContent = fs.readFileSync(collegesPath, 'utf-8');
    const collegeMappingContent = fs.readFileSync(collegeMappingPath, 'utf-8');
    const pidMappingContent = fs.readFileSync(pidMappingPath, 'utf-8');

    // Parse colleges
    const colleges = new Map();
    const collegeLines = collegesContent.split('\n');
    for (let i = 1; i < collegeLines.length; i++) {
        const line = collegeLines[i].trim();
        if (!line) continue;
        const [idStr, name] = line.split(',');
        const id = parseInt(idStr, 10);
        if (!isNaN(id) && name) {
            colleges.set(id, name.trim());
        }
    }

    // Parse college mapping
    const collegeMapping = new Map();
    const mappingData = JSON.parse(collegeMappingContent);
    for (const [franchiseId, rosterId] of Object.entries(mappingData)) {
        collegeMapping.set(parseInt(franchiseId), parseInt(rosterId));
    }

    // Parse PID mapping
    const plpoToPidMapping = new Map();
    const pidLines = pidMappingContent.split('\n');
    for (let i = 1; i < pidLines.length; i++) {
        const line = pidLines[i].trim();
        if (!line) continue;
        const [pidStr, type, portrait] = line.split(',');
        const pid = parseInt(pidStr, 10);
        if (!isNaN(pid) && portrait) {
            const plpo = portrait.trim();
            if (!plpoToPidMapping.has(plpo)) {
                plpoToPidMapping.set(plpo, pid);
            }
        }
    }

    console.log(`Loaded ${colleges.size} colleges`);
    console.log(`Loaded ${collegeMapping.size} franchise college mappings`);
    console.log(`Loaded ${plpoToPidMapping.size} PLPO->PID mappings\n`);

    const draftPlayerTable = franchise.getTableByName('DraftPlayer');
    const playerTable = franchise.getTableByName('Player');

    await draftPlayerTable.readRecords();
    await playerTable.readRecords();

    const draftRecords = draftPlayerTable.records.filter(r => !r.isEmpty);

    console.log('=== TESTING FIRST 3 PROSPECTS ===\n');

    let testCount = 0;
    for (const draftRecord of draftRecords) {
        if (testCount >= 3) break;

        const playerField = draftRecord.fieldsArray.find(f => f.key === 'Player');
        if (!playerField || !playerField.referenceData) continue;

        const playerRowIndex = playerField.referenceData.rowNumber;
        const playerRecord = playerTable.records[playerRowIndex];

        if (!playerRecord || playerRecord.isEmpty) continue;
        if (playerRecord.YearsPro !== 0) continue;

        testCount++;

        console.log(`\n--- PROSPECT ${testCount}: ${playerRecord.FirstName} ${playerRecord.LastName} ---`);

        // Test College parsing
        const collegeField = playerRecord.fieldsArray.find(f => f.key === 'College');
        if (collegeField) {
            const rawValue = collegeField.value;
            console.log('College field raw:', rawValue, typeof rawValue);

            if (typeof rawValue === 'string' && rawValue.match(/^[01]{32}$/)) {
                const last8Bits = rawValue.substring(24);
                const franchiseCollegeId = parseInt(last8Bits, 2);
                const rosterCollegeId = collegeMapping.get(franchiseCollegeId);
                const collegeName = colleges.get(rosterCollegeId);

                console.log(`  Franchise ID: ${franchiseCollegeId}`);
                console.log(`  Roster ID: ${rosterCollegeId}`);
                console.log(`  College Name: ${collegeName || 'UNKNOWN'}`);
            }
        }

        // Test PID mapping
        const genericHeadField = playerRecord.fieldsArray.find(f => f.key === 'GenericHeadAssetName');
        if (genericHeadField) {
            const genericHeadName = genericHeadField.value;
            console.log('GenericHeadAssetName:', genericHeadName);

            if (genericHeadName && typeof genericHeadName === 'string') {
                const parts = genericHeadName.toLowerCase().split('_');
                const skinTone = parts[1];
                const faceNumber = parts[parts.length - 1];
                const plpoName = `plpo_generic_${skinTone}_${faceNumber}`;
                const mappedPID = plpoToPidMapping.get(plpoName);

                console.log(`  Skin Tone: ${skinTone}`);
                console.log(`  Face Number: ${faceNumber}`);
                console.log(`  PLPO: ${plpoName}`);
                console.log(`  Mapped PID: ${mappedPID || 'NOT FOUND'}`);
            }
        }

        // Check original PID/PEPS values (should be skipped)
        const pidField = playerRecord.fieldsArray.find(f => f.key === 'PresentationId');
        const pepsField = playerRecord.fieldsArray.find(f => f.key === 'PLYR_PORTRAIT');
        console.log('Original PresentationId:', pidField ? pidField.value : 'NOT FOUND');
        console.log('Original PLYR_PORTRAIT:', pepsField ? pepsField.value : 'NOT FOUND');
    }

    console.log('\n=== TEST COMPLETE ===');
}

testDraftHandlerFix().catch(console.error);
