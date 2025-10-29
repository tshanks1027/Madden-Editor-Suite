/**
 * Check why Abanikanda shows up in draft class when he's a free agent
 */

const Franchise = require('madden-franchise');
const path = require('path');

async function checkAbanikandaDraftStatus() {
    const filePath = path.join(process.env.USERPROFILE, 'OneDrive', 'Documents', 'Madden NFL 26', 'Saves', 'CAREER-TEST-AUTOSAVE');

    console.log('Loading franchise file...');
    const franchise = await Franchise.create(filePath, { gameYearOverride: 26 });

    const draftPlayerTable = franchise.getTableByName('DraftPlayer');
    const playerTable = franchise.getTableByName('Player');

    await draftPlayerTable.readRecords();
    await playerTable.readRecords();

    const draftRecords = draftPlayerTable.records.filter(r => !r.isEmpty);

    // Find Abanikanda in DraftPlayer table
    for (const draftRecord of draftRecords) {
        const playerField = draftRecord.fieldsArray.find(f => f.key === 'Player');
        if (!playerField || !playerField.referenceData) continue;

        const playerRowIndex = playerField.referenceData.rowNumber;
        const playerRecord = playerTable.records[playerRowIndex];

        if (playerRecord && !playerRecord.isEmpty) {
            const firstName = playerRecord.FirstName;
            const lastName = playerRecord.LastName;

            if (lastName && lastName.toLowerCase().includes('abanikanda')) {
                console.log('\n=== FOUND ABANIKANDA ===');
                console.log('First Name:', firstName);
                console.log('Last Name:', lastName);
                console.log('TeamIndex:', playerRecord.TeamIndex);
                console.log('YearsPro:', playerRecord.YearsPro);
                console.log('Position:', playerRecord.Position);
                console.log('\nDraftPlayer fields:');
                draftRecord.fieldsArray.forEach(f => {
                    console.log(`  ${f.key}: ${f.value}`);
                });
                console.log('\nPlayer fields (subset):');
                console.log('  College:', playerRecord.College);
                console.log('  PLYR_DRAFTROUND:', playerRecord.PLYR_DRAFTROUND);
                console.log('  PLYR_DRAFTPICK:', playerRecord.PLYR_DRAFTPICK);
                console.log('  PLYR_DRAFTTEAM:', playerRecord.PLYR_DRAFTTEAM);
                console.log('  YearDrafted:', playerRecord.YearDrafted);
            }
        }
    }

    // Also check what IsVisible means in DraftPlayer
    console.log('\n=== CHECKING IsVisible FIELD ===');
    let visibleCount = 0;
    let notVisibleCount = 0;

    for (const draftRecord of draftRecords) {
        if (draftRecord.IsVisible === true || draftRecord.IsVisible === 1) {
            visibleCount++;
        } else {
            notVisibleCount++;
        }
    }

    console.log(`IsVisible = true/1: ${visibleCount}`);
    console.log(`IsVisible = false/0: ${notVisibleCount}`);
}

checkAbanikandaDraftStatus().catch(console.error);
