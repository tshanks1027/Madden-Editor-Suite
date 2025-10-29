/**
 * Test the draft class handler to see what data is returned
 */

const { ipcMain } = require('electron');
const path = require('path');

// Manually load the franchise handler
const Franchise = require('madden-franchise');
const fs = require('fs');
const { app } = require('electron');

// Copy the handler code to test it
async function testDraftClassHandler() {
    const filePath = path.join(process.env.USERPROFILE, 'OneDrive', 'Documents', 'Madden NFL 26', 'Saves', 'CAREER-TEST-AUTOSAVE');

    console.log('Testing draft class handler...\n');

    const franchise = await Franchise.create(filePath, { gameYearOverride: 26 });

    const draftPlayerTable = franchise.getTableByName('DraftPlayer');
    const playerTable = franchise.getTableByName('Player');

    await draftPlayerTable.readRecords();
    await playerTable.readRecords();

    const draftRecords = draftPlayerTable.records.filter(r => !r.isEmpty);
    console.log(`Found ${draftRecords.length} draft records\n`);

    // Get first valid prospect
    let firstProspect = null;
    for (const draftRecord of draftRecords) {
        const playerField = draftRecord.fieldsArray.find(f => f.key === 'Player');
        if (!playerField || !playerField.referenceData) continue;

        const playerRowIndex = playerField.referenceData.rowNumber;
        const playerRecord = playerTable.records[playerRowIndex];

        if (!playerRecord || playerRecord.isEmpty) continue;
        if (playerRecord.YearsPro !== 0) continue;

        // Found a valid prospect
        firstProspect = {
            draftRecord,
            playerRecord
        };
        break;
    }

    if (!firstProspect) {
        console.log('No valid prospects found!');
        return;
    }

    const { playerRecord } = firstProspect;

    console.log('=== FIRST PROSPECT RAW DATA ===\n');
    console.log('Name:', playerRecord.FirstName, playerRecord.LastName);
    console.log('Position:', playerRecord.Position);
    console.log('College:', playerRecord.College, typeof playerRecord.College);
    console.log('PLYR_HOME_TOWN:', playerRecord.PLYR_HOME_TOWN);
    console.log('GenericHeadAssetName:', playerRecord.GenericHeadAssetName);
    console.log('PLYR_GENERICHEAD:', playerRecord.PLYR_GENERICHEAD);
    console.log('PresentationId (PSXP):', playerRecord.PresentationId);
    console.log('PLYR_PORTRAIT (PEPS):', playerRecord.PLYR_PORTRAIT);

    console.log('\n=== CHECKING FIELD ARRAYS ===\n');
    const collegeField = playerRecord.fieldsArray.find(f => f.key === 'College');
    console.log('College field:', collegeField ? collegeField.value : 'NOT FOUND');

    const hometownField = playerRecord.fieldsArray.find(f => f.key === 'PLYR_HOME_TOWN');
    console.log('Hometown field:', hometownField ? hometownField.value : 'NOT FOUND');

    const genericHeadField = playerRecord.fieldsArray.find(f => f.key === 'GenericHeadAssetName');
    console.log('GenericHeadAssetName field:', genericHeadField ? genericHeadField.value : 'NOT FOUND');
}

testDraftClassHandler().catch(console.error);
