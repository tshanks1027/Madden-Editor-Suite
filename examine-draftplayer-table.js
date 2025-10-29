/**
 * Examine DraftPlayer table structure
 */

const Franchise = require('madden-franchise');
const path = require('path');

async function examineDraftPlayerTable() {
    const filePath = path.join(process.env.USERPROFILE, 'OneDrive', 'Documents', 'Madden NFL 26', 'Saves', 'CAREER-TEST-AUTOSAVE');

    console.log('Loading franchise file...');
    const franchise = await Franchise.create(filePath, { gameYearOverride: 26 });

    // Get DraftPlayer table
    const draftPlayerTable = franchise.getTableByName('DraftPlayer');
    if (!draftPlayerTable) {
        console.error('DraftPlayer table not found!');
        return;
    }

    await draftPlayerTable.readRecords();

    const activeRecords = draftPlayerTable.records.filter(r => !r.isEmpty);
    console.log(`\nDraftPlayer table: ${activeRecords.length} active records`);

    // Show all field names
    console.log('\n=== ALL FIELDS ===');
    if (draftPlayerTable.schema && draftPlayerTable.schema.attributes) {
        const fieldNames = draftPlayerTable.schema.attributes.map(a => a.name);
        console.log(fieldNames.join(', '));
        console.log(`\nTotal fields: ${fieldNames.length}`);
    }

    // Show first few prospects
    console.log('\n=== FIRST 5 PROSPECTS ===');
    activeRecords.slice(0, 5).forEach((record, index) => {
        console.log(`\nProspect ${index + 1}:`);

        // Try to find player reference fields
        const fields = record.fieldsArray || [];
        fields.forEach(field => {
            if (field.key.toLowerCase().includes('player') ||
                field.key.toLowerCase().includes('name') ||
                field.key.toLowerCase().includes('position') ||
                field.key.toLowerCase().includes('overall') ||
                field.key.toLowerCase().includes('college')) {
                console.log(`  ${field.key}: ${field.value}`);
            }
        });
    });

    // Try Player table to see if there's a link
    console.log('\n=== CHECKING PLAYER TABLE ===');
    const playerTable = franchise.getTableByName('Player');
    if (playerTable) {
        await playerTable.readRecords();
        const playerRecords = playerTable.records.filter(r => !r.isEmpty);

        console.log(`Player table: ${playerRecords.length} active records`);

        // Look for draft-related fields in Player table
        if (playerTable.schema && playerTable.schema.attributes) {
            const draftFields = playerTable.schema.attributes
                .map(a => a.name)
                .filter(name =>
                    name.toLowerCase().includes('draft') ||
                    name.toLowerCase().includes('prospect')
                );
            console.log('\nDraft-related fields in Player table:', draftFields);
        }
    }
}

examineDraftPlayerTable().catch(console.error);
