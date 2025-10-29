/**
 * Test how to resolve DraftPlayer -> Player references
 */

const Franchise = require('madden-franchise');
const path = require('path');

async function testDraftPlayerReferences() {
    const filePath = path.join(process.env.USERPROFILE, 'OneDrive', 'Documents', 'Madden NFL 26', 'Saves', 'CAREER-TEST-AUTOSAVE');

    console.log('Loading franchise file...');
    const franchise = await Franchise.create(filePath, { gameYearOverride: 26 });

    const draftPlayerTable = franchise.getTableByName('DraftPlayer');
    const playerTable = franchise.getTableByName('Player');

    await draftPlayerTable.readRecords();
    await playerTable.readRecords();

    const draftRecords = draftPlayerTable.records.filter(r => !r.isEmpty);
    console.log(`\nFound ${draftRecords.length} draft prospects`);

    // Examine first draft prospect
    const firstDraft = draftRecords[1]; // Use index 1 since 0 might be empty
    console.log('\n=== FIRST DRAFT PROSPECT ===');
    console.log('Player field type:', typeof firstDraft.Player);
    console.log('Player field value:', firstDraft.Player);

    // Try different ways to get the reference
    console.log('\n=== TRYING DIFFERENT REFERENCE METHODS ===');

    // Method 1: Direct access
    console.log('1. firstDraft.Player:', firstDraft.Player);

    // Method 2: Check if it's an object with row
    if (firstDraft.Player && typeof firstDraft.Player === 'object') {
        console.log('2. firstDraft.Player.row:', firstDraft.Player.row);
        console.log('2. firstDraft.Player.tableId:', firstDraft.Player.tableId);
    }

    // Method 3: Check raw field data
    const playerField = firstDraft.fieldsArray.find(f => f.key === 'Player');
    if (playerField) {
        console.log('3. playerField.value:', playerField.value);
        console.log('3. playerField.value type:', typeof playerField.value);
        console.log('3. playerField.offset:', playerField.offset);
        console.log('3. playerField.isReference:', playerField.isReference);

        // Try to parse if it's a binary string
        if (typeof playerField.value === 'string' && playerField.value.match(/^[01]+$/)) {
            const rowIndex = parseInt(playerField.value, 2);
            console.log('3. Parsed row index from binary:', rowIndex);

            // Try to get player at that index
            if (playerTable.records[rowIndex]) {
                const playerRecord = playerTable.records[rowIndex];
                console.log('3. Found player:', playerRecord.FirstName, playerRecord.LastName);
            }
        }

        // Check if there's a reference property
        if (playerField.referenceData) {
            console.log('3. playerField.referenceData:', playerField.referenceData);
        }
    }

    // Method 4: Use madden-franchise's getReferenceData
    if (firstDraft.Player && firstDraft.Player.getReferenceData) {
        const refData = firstDraft.Player.getReferenceData();
        console.log('4. getReferenceData():', refData);
    }

    // Method 5: Check table schema for reference info
    const playerSchemaAttr = draftPlayerTable.schema.attributes.find(a => a.name === 'Player');
    if (playerSchemaAttr) {
        console.log('\n5. Schema attribute for Player:');
        console.log('   Type:', playerSchemaAttr.type);
        console.log('   isReference:', playerSchemaAttr.isReference);
        console.log('   enum:', playerSchemaAttr.enum);
    }
}

testDraftPlayerReferences().catch(console.error);
