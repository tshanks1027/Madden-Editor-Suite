/**
 * Comprehensive test of the complete draft class flow with all fixes
 */

const Franchise = require('madden-franchise');
const path = require('path');
const fs = require('fs');

async function testCompleteDraftFlow() {
    const filePath = path.join(process.env.USERPROFILE, 'OneDrive', 'Documents', 'Madden NFL 26', 'Saves', 'CAREER-TEST-AUTOSAVE');

    console.log('=== COMPREHENSIVE DRAFT CLASS HANDLER TEST ===\n');
    console.log('Loading franchise file...\n');

    const franchise = await Franchise.create(filePath, { gameYearOverride: 26 });

    // Load lookups using same method as handler
    const collegesPath = path.join(__dirname, 'data', 'lookups', 'college_lookup.csv');
    const collegeMappingPath = path.join(__dirname, 'data', 'franchise-college-mapping.json');
    const pidMappingPath = path.join(__dirname, 'data', 'lookups', 'PID_Portrait_Mapping.csv');

    // Load colleges
    const colleges = new Map();
    const collegesContent = fs.readFileSync(collegesPath, 'utf-8');
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

    // Load college mapping (array of objects, build into Map)
    const collegeMapping = new Map();
    const mappingContent = fs.readFileSync(collegeMappingPath, 'utf-8');
    const mappingArray = JSON.parse(mappingContent);
    for (const entry of mappingArray) {
        collegeMapping.set(entry.franchiseId, entry.rosterId);
    }

    // Load PID mapping
    const plpoToPidMapping = new Map();
    const pidMappingContent = fs.readFileSync(pidMappingPath, 'utf-8');
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

    console.log('=== PROCESSING FIRST 3 DRAFT PROSPECTS ===\n');

    let testCount = 0;
    for (const draftRecord of draftRecords) {
        if (testCount >= 3) break;

        const playerField = draftRecord.fieldsArray.find(f => f.key === 'Player');
        if (!playerField || !playerField.referenceData) continue;

        const playerRowIndex = playerField.referenceData.rowNumber;
        const playerRecord = playerTable.records[playerRowIndex];

        if (!playerRecord || playerRecord.isEmpty) continue;
        if (playerRecord.YearsPro !== 0) continue; // Filter out rookies already drafted

        testCount++;

        console.log(`--- PROSPECT ${testCount}: ${playerRecord.FirstName} ${playerRecord.LastName} ---`);

        // Test College parsing (exact logic from handler)
        const collegeField = playerRecord.fieldsArray.find(f => f.key === 'College');
        if (collegeField) {
            const rawValue = collegeField.value;
            let collegeName = 'UNKNOWN';

            if (typeof rawValue === 'string' && rawValue.match(/^[01]{32}$/)) {
                // Extract last 8 bits for franchise college ID
                const last8Bits = rawValue.substring(24);
                const franchiseCollegeId = parseInt(last8Bits, 2);

                // Map franchise ID → roster ID → college name
                const rosterCollegeId = collegeMapping.get(franchiseCollegeId);
                if (rosterCollegeId !== undefined) {
                    const mapped = colleges.get(rosterCollegeId);
                    if (mapped) {
                        collegeName = mapped;
                    }
                }

                console.log(`  College: Franchise ID ${franchiseCollegeId} → Roster ID ${rosterCollegeId} → ${collegeName}`);
            }
        }

        // Test PID mapping (exact logic from handler with padding fix)
        const genericHeadField = playerRecord.fieldsArray.find(f => f.key === 'GenericHeadAssetName');
        if (genericHeadField) {
            const genericHeadName = genericHeadField.value;
            console.log(`  GenericHeadAssetName: ${genericHeadName}`);

            if (genericHeadName && typeof genericHeadName === 'string') {
                const parts = genericHeadName.toLowerCase().split('_');
                if (parts.length >= 3) {
                    const skinTone = parts[1];
                    const faceNumber = parts[parts.length - 1].padStart(3, '0'); // FIX: Pad to 3 digits
                    const plpoName = `plpo_generic_${skinTone}_${faceNumber}`;
                    const mappedPID = plpoToPidMapping.get(plpoName);

                    console.log(`  PLPO: ${plpoName}`);
                    console.log(`  Mapped PID: ${mappedPID || 'NOT FOUND (will use fallback)'}`);

                    if (!mappedPID) {
                        const fallbackPLPO = 'plpo_generic_1_001';
                        const fallbackPID = plpoToPidMapping.get(fallbackPLPO);
                        console.log(`  Fallback PID: ${fallbackPID}`);
                    }
                }
            }
        }

        // Show original values that should be skipped
        const pidField = playerRecord.fieldsArray.find(f => f.key === 'PresentationId');
        const pepsField = playerRecord.fieldsArray.find(f => f.key === 'PLYR_PORTRAIT');
        console.log(`  [SHOULD BE SKIPPED] Original PresentationId: ${pidField ? pidField.value : 'N/A'}`);
        console.log(`  [SHOULD BE SKIPPED] Original PLYR_PORTRAIT: ${pepsField ? pepsField.value : 'N/A'}`);

        console.log('');
    }

    console.log('=== TEST COMPLETE ===');
    console.log('\nExpected results:');
    console.log('- Colleges should show real names (e.g., "Miami", "Clemson", "Penn State")');
    console.log('- PIDs should be in 3000-4000 range for generic faces');
    console.log('- PLPOs should have 3-digit face numbers (e.g., plpo_generic_6_004)');
}

testCompleteDraftFlow().catch(console.error);
