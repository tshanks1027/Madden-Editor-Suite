/**
 * List all available fields on Coach records
 */

const Franchise = require('madden-franchise');
const path = require('path');

async function listCoachFields() {
    const filePath = path.join(process.env.USERPROFILE, 'OneDrive', 'Documents', 'Madden NFL 26', 'Saves', 'CAREER-TEST-AUTOSAVE');

    const franchise = await Franchise.create(filePath, { gameYearOverride: 26 });

    console.log('=== COACH TABLE FIELDS ===\n');

    const coachTable = franchise.getTableByName('Coach');
    await coachTable.readRecords();

    const coaches = coachTable.records.filter(r => !r.isEmpty);

    console.log(`Found ${coaches.length} non-empty coaches\n`);

    if (coaches.length > 0) {
        const firstCoach = coaches[0];

        // Get all keys that don't start with underscore
        const fields = Object.keys(firstCoach).filter(k => !k.startsWith('_') && k !== 'isEmpty' && k !== 'index' && k !== 'arraySize');

        console.log(`Coach record has ${fields.length} fields:\n`);

        fields.forEach(field => {
            const value = firstCoach[field];
            const type = typeof value;
            console.log(`  ${field}: ${type} = ${value}`);
        });
    }

    console.log('\n=== DONE ===');
}

listCoachFields().catch(console.error);
